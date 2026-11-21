import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analysis, axeViolations, issue, mockFetch, renderWithProviders } from '../test/utils';
import ReportPage, { validateReport } from './ReportPage';

describe('validateReport', () => {
  it('requires a meaningful description and a location', () => {
    expect(validateReport({ title: '', description: 'short', address: '' })).toEqual({
      description: expect.any(String),
      address: expect.any(String),
    });
    expect(
      validateReport({ title: '', description: 'A long enough description', address: 'Main road' }),
    ).toEqual({});
  });

  it('allows an empty title but rejects a too-short one', () => {
    expect(
      validateReport({
        title: 'abc',
        description: 'A long enough description',
        address: 'Main road',
      }).title,
    ).toBeDefined();
  });
});

describe('ReportPage', () => {
  it('shows inline errors and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportPage />);
    await user.click(screen.getByRole('button', { name: /analyse with ai/i }));
    const description = screen.getByLabelText(/description/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveFocus();
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
  });

  it('runs AI triage, shows duplicates, then submits and shows the tracking code', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'POST /api/ai/analyze': {
        analysis,
        duplicates: [
          { issue: { ...issue, code: 'CR-DUP222', id: 'dup' }, score: 0.8, distanceMeters: 40 },
        ],
      },
      'POST /api/issues': (body: unknown) => ({
        issue: { ...issue, title: (body as { title: string }).title },
      }),
    });
    renderWithProviders(<ReportPage />);

    await user.type(
      screen.getByLabelText(/description/i),
      'Deep pothole near the bus stop, bikes are skidding',
    );
    await user.click(screen.getByRole('button', { name: /analyse with ai/i }));

    expect(await screen.findByText(/high accident risk/)).toBeInTheDocument();
    expect(screen.getByText(/Already reported nearby/)).toBeInTheDocument();
    expect(screen.getByText(/40 m away/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use this title/i }));
    expect(screen.getByLabelText(/short title/i)).toHaveValue('Deep pothole near bus stop');

    await user.type(screen.getByLabelText(/address or landmark/i), 'Avinashi Road');
    await user.click(screen.getByRole('button', { name: /submit complaint/i }));

    expect(await screen.findByText('CR-ABC234')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /complaint submitted/i })).toBeInTheDocument();

    const createCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST' && String(init.body).includes('Avinashi'),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      title: 'Deep pothole near bus stop',
      location: { address: 'Avinashi Road' },
    });
  });

  it('surfaces API errors to the user', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Too many requests — please slow down' }), {
            status: 429,
          }),
      ),
    );
    renderWithProviders(<ReportPage />);
    await user.type(
      screen.getByLabelText(/description/i),
      'Garbage overflowing for many days near market',
    );
    await user.click(screen.getByRole('button', { name: /analyse with ai/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/too many requests/i));
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<ReportPage />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
