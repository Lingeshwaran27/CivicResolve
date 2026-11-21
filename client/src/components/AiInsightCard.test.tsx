import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analysis, axeViolations, renderWithProviders } from '../test/utils';
import { AiInsightCard } from './AiInsightCard';

describe('AiInsightCard', () => {
  it('explains the AI decision', () => {
    renderWithProviders(<AiInsightCard analysis={analysis} />);
    expect(screen.getByText('Roads & Potholes')).toBeInTheDocument();
    expect(screen.getByText('Public Works Department (Roads)')).toBeInTheDocument();
    expect(screen.getByText(/high accident risk/)).toBeInTheDocument();
    expect(screen.getByText(/Two-wheeler skids/)).toBeInTheDocument();
    expect(screen.getByText(/Translated from Tamil/)).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '74');
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();
  });

  it('labels rule-based fallback results honestly', () => {
    renderWithProviders(<AiInsightCard analysis={{ ...analysis, provider: 'heuristic' }} />);
    expect(screen.getByText(/rule-based classifier was used/)).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithProviders(<AiInsightCard analysis={analysis} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
