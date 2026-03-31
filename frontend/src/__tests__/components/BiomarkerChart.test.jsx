import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BiomarkerChart from '../../components/BiomarkerChart';

// Recharts uses ResizeObserver internally; provide a no-op stub for jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const SAMPLE_DATA = [
  { date: '2024-01-15', value: 72, appointment_id: 1, doctor_name: 'Dr. Smith' },
  { date: '2024-02-20', value: 78, appointment_id: 2, doctor_name: 'Dr. Smith' },
  { date: '2024-03-10', value: 68, appointment_id: 3, doctor_name: 'Dr. Smith' },
];

describe('BiomarkerChart', () => {
  it('renders empty state when data is null', () => {
    render(<BiomarkerChart data={null} type="heart_rate" unit="bpm" />);
    expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
  });

  it('renders empty state when data is an empty array', () => {
    render(<BiomarkerChart data={[]} type="heart_rate" unit="bpm" />);
    expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
  });

  it('renders the chart container when data is provided', () => {
    const { container } = render(
      <BiomarkerChart data={SAMPLE_DATA} type="heart_rate" unit="bpm" />
    );
    expect(container.querySelector('.biomarker-chart')).toBeInTheDocument();
  });

  it('renders a chart title derived from the type prop', () => {
    render(<BiomarkerChart data={SAMPLE_DATA} type="heart_rate" unit="bpm" />);
    // underscores replaced with spaces, "Trend" appended
    expect(screen.getByText(/heart rate trend/i)).toBeInTheDocument();
  });

  it('formats multi-word type names by replacing underscores', () => {
    render(
      <BiomarkerChart data={SAMPLE_DATA} type="blood_pressure_systolic" unit="mmHg" />
    );
    expect(screen.getByText(/blood pressure systolic trend/i)).toBeInTheDocument();
  });

  it('does not render empty-state message when data is provided', () => {
    render(<BiomarkerChart data={SAMPLE_DATA} type="heart_rate" unit="bpm" />);
    expect(screen.queryByText(/no trend data available/i)).toBeNull();
  });

  it('renders with a single data point without crashing', () => {
    const single = [{ date: '2024-01-01', value: 72 }];
    const { container } = render(
      <BiomarkerChart data={single} type="heart_rate" unit="bpm" />
    );
    expect(container.querySelector('.biomarker-chart')).toBeInTheDocument();
  });
});
