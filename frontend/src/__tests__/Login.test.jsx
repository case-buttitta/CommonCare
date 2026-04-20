import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { AuthProvider } from '../AuthContext';

// Minimal locations payload used by most tests (no location selected)
const emptyLocations = { ok: true, json: async () => [] };

// One location with two users — used by location-feature tests
const mockLocation = {
  id: 1,
  name: 'Charlotte Medical Center',
  theme: { colors: { primary: '#780606', header: '#780606', background: '#f8fafc', secondary: '#DE6464' } },
  default_password: 'password123',
  users: [
    { email: 'patient@test.com', user_type: 'patient', full_name: 'John Smith' },
    { email: 'doctor@test.com', user_type: 'staff', full_name: 'Dr. Emily Carter' },
  ],
};

function renderLogin(onSwitch = vi.fn()) {
  return render(
    <AuthProvider>
      <Login onSwitchToSignup={onSwitch} />
    </AuthProvider>
  );
}

// Wait for the initial /api/locations/public fetch to resolve so the form is stable
async function waitForForm() {
  await waitFor(() => expect(screen.getByLabelText(/medical office/i)).toBeInTheDocument());
}

describe('Login component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders location select, email field, password field, and sign in button', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    renderLogin();
    await waitForForm();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('sign in button is disabled when email is empty', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    renderLogin();
    await waitForForm();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('calls login with entered email and password when no location selected', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok', user: { id: 1, user_type: 'patient' } }),
    });

    renderLogin();
    await waitForForm();

    await userEvent.type(screen.getByLabelText(/email/i), 'user@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('shows error message on failed login', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    renderLogin();
    await waitForForm();

    await userEvent.type(screen.getByLabelText(/email/i), 'bad@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    );
  });

  it('disables button while loading', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    let resolve;
    fetch.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));

    renderLogin();
    await waitForForm();

    await userEvent.type(screen.getByLabelText(/email/i), 'u@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    // clean up
    resolve({ ok: false, json: async () => ({ error: 'fail' }) });
  });

  it('calls onSwitchToSignup when create account link clicked', async () => {
    fetch.mockResolvedValueOnce(emptyLocations);
    const onSwitch = vi.fn();
    renderLogin(onSwitch);
    await waitForForm();
    await userEvent.click(screen.getByRole('button', { name: /create one/i }));
    expect(onSwitch).toHaveBeenCalled();
  });

  describe('location selection', () => {
    it('loads and displays locations in the select', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => [mockLocation] });
      renderLogin();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Charlotte Medical Center' })).toBeInTheDocument()
      );
    });

    it('auto-fills password when a location is selected', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => [mockLocation] });
      renderLogin();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Charlotte Medical Center' })).toBeInTheDocument()
      );
      await userEvent.selectOptions(screen.getByLabelText(/medical office/i), '1');
      expect(screen.getByLabelText(/password/i)).toHaveValue('password123');
    });

    it('replaces plain email input with custom dropdown when a location is selected', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => [mockLocation] });
      renderLogin();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Charlotte Medical Center' })).toBeInTheDocument()
      );
      await userEvent.selectOptions(screen.getByLabelText(/medical office/i), '1');
      expect(screen.queryByRole('textbox', { name: /email/i })).toBeNull();
      expect(screen.getByText(/select an account/i)).toBeInTheDocument();
    });

    it('clicking a user in the dropdown fills the email trigger', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => [mockLocation] });
      renderLogin();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Charlotte Medical Center' })).toBeInTheDocument()
      );
      await userEvent.selectOptions(screen.getByLabelText(/medical office/i), '1');
      // open the dropdown
      await userEvent.click(screen.getByText(/select an account/i));
      // pick the patient
      await userEvent.click(screen.getByText('patient@test.com'));
      expect(screen.getByText('patient@test.com')).toBeInTheDocument();
    });

    it('shows the location name in the header after selecting a location', async () => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => [mockLocation] });
      renderLogin();
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Charlotte Medical Center' })).toBeInTheDocument()
      );
      await userEvent.selectOptions(screen.getByLabelText(/medical office/i), '1');
      expect(screen.getByText('Charlotte Medical Center')).toBeInTheDocument();
    });
  });
});
