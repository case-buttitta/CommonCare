import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedicalHistory from '../../components/MedicalHistory';

const RECORDS = [
  { id: 1, condition: 'Hypertension', diagnosis_date: '2023-01-15', status: 'Managed', notes: 'Monitor BP' },
  { id: 2, condition: 'Diabetes', diagnosis_date: '2022-05-10', status: 'Active', notes: '' },
];

function mockFetch(data, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => data,
  });
}

describe('MedicalHistory component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<MedicalHistory patientId={1} userType="patient" />);
    expect(screen.getByText(/loading history/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('renders history records after load', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="patient" />);

    await waitFor(() => expect(screen.getByText('Hypertension')).toBeInTheDocument());
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows empty message when no history', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<MedicalHistory patientId={1} userType="patient" />);

    await waitFor(() =>
      expect(screen.getByText(/no medical history recorded/i)).toBeInTheDocument()
    );
    vi.unstubAllGlobals();
  });

  it('does NOT show Add Condition button for patients', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<MedicalHistory patientId={1} userType="patient" />);
    await waitFor(() => screen.getByText(/no medical history/i));
    expect(screen.queryByRole('button', { name: /add condition/i })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('shows Add Condition button for staff', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText(/no medical history/i));
    expect(screen.getByRole('button', { name: /add condition/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows Edit and Delete buttons for staff', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText('Hypertension'));
    expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it('does NOT show Edit/Delete buttons for patients', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="patient" />);
    await waitFor(() => screen.getByText('Hypertension'));
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('opens the add form when Add Condition is clicked', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText(/no medical history/i));
    await userEvent.click(screen.getByRole('button', { name: /add condition/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('opens delete confirmation modal when Delete is clicked', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText('Hypertension'));
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(screen.getByText(/permanently delete this record/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('populates form when Edit is clicked', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText('Hypertension'));
    await userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(screen.getByDisplayValue('Hypertension')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    render(<MedicalHistory patientId={1} userType="patient" />);
    await waitFor(() =>
      expect(screen.getByText(/failed to fetch medical history/i)).toBeInTheDocument()
    );
    vi.unstubAllGlobals();
  });

  it('shows Update button (not Save) when editing an existing record', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText('Hypertension'));
    await userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('closes the form when Cancel is clicked', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<MedicalHistory patientId={1} userType="staff" />);
    await waitFor(() => screen.getByText(/no medical history/i));
    await userEvent.click(screen.getByRole('button', { name: /add condition/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('displays notes when a record has notes', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="patient" />);
    await waitFor(() => screen.getByText('Monitor BP'));
    expect(screen.getByText('Monitor BP')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('displays the record status', async () => {
    vi.stubGlobal('fetch', mockFetch(RECORDS));
    render(<MedicalHistory patientId={1} userType="patient" />);
    await waitFor(() => screen.getByText('Hypertension'));
    expect(screen.getByText(/managed/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
