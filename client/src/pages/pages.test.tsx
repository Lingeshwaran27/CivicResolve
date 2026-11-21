import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StatusStepper, Timeline } from '../components/StatusTracker';
import { timeAgo, formatHours } from '../lib/format';
import { axeViolations, issue, mockFetch, renderWithProviders } from '../test/utils';
import { HomePage } from './HomePage';
import TrackPage from './TrackPage';

const stats = {
  total: 14,
  open: 9,
  overdue: 2,
  byStatus: { reported: 6, in_progress: 3, resolved: 3, rejected: 2 },
  byPriority: { critical: 3, high: 6, medium: 4, low: 1 },
  byCategory: { 'Roads & Potholes': 2 },
  byDepartment: {},
  avgResolutionHours: 30,
  satisfaction: 4.3,
  aiOverrideRate: 0.1,
  trend: [],
};

describe('HomePage', () => {
  it('shows live city statistics and urgent reports', async () => {
    mockFetch({ 'GET /api/stats': stats, 'GET /api/issues': { items: [issue], total: 1 } });
    const { container } = renderWithProviders(<HomePage />);
    expect(await screen.findByText('Deep pothole near bus stop')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('30 h')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('TrackPage', () => {
  const renderTrack = (route: string) =>
    renderWithProviders(
      <Routes>
        <Route path="/track" element={<TrackPage />} />
        <Route path="/track/:code" element={<TrackPage />} />
      </Routes>,
      { route },
    );

  it('validates the tracking code format', async () => {
    const user = userEvent.setup();
    renderTrack('/track');
    await user.type(screen.getByLabelText(/tracking code/i), 'hello');
    await user.click(screen.getByRole('button', { name: 'Track' }));
    expect(screen.getByText(/look like CR-/)).toBeInTheDocument();
  });

  it('shows progress, timeline and AI triage for a complaint', async () => {
    mockFetch({ 'GET /api/issues/CR-ABC234': { issue } });
    const { container } = renderTrack('/track/CR-ABC234');
    expect(await screen.findByRole('heading', { level: 1, name: issue.title })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /resolution progress/i })).toBeInTheDocument();
    expect(screen.getByText('Complaint received.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /affected too/i })).toBeEnabled();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('lets citizens support an open complaint', async () => {
    const user = userEvent.setup();
    mockFetch({
      'GET /api/issues/CR-ABC234': { issue },
      'POST /api/issues/CR-ABC234/upvote': { issue: { ...issue, upvotes: 4 } },
    });
    renderTrack('/track/CR-ABC234');
    await user.click(await screen.findByRole('button', { name: /affected too/i }));
    expect(await screen.findByText(/4 citizens have supported/)).toBeInTheDocument();
  });
});

describe('status components', () => {
  it('marks the current step', () => {
    renderWithProviders(<StatusStepper status="in_progress" />);
    expect(screen.getByText('In Progress').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('renders the newest event first', () => {
    renderWithProviders(
      <Timeline
        events={[
          { status: 'reported', note: 'first', at: '2026-11-01T00:00:00Z', by: 'citizen' },
          { status: 'resolved', note: 'second', at: '2026-11-02T00:00:00Z', by: 'admin' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('second');
  });
});

describe('format helpers', () => {
  it('formats relative time and durations', () => {
    const now = Date.parse('2026-11-21T12:00:00Z');
    expect(timeAgo('2026-11-21T10:00:00Z', now)).toBe('2 hours ago');
    expect(formatHours(72)).toBe('3.0 days');
    expect(formatHours(null)).toBe('—');
  });
});
