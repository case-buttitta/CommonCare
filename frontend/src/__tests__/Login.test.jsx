import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { AuthProvider } from '../AuthContext';

function renderLogin(onSwitch = vi.fn()) {
  return render(
    <AuthProvider>
      <Login onSwitchToSignup={onSwitch} />
    </AuthProvider>
  );
}

describe('Login component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders sign in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login with entered email and password', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok', user: { id: 1, user_type: 'patient' } }),
    });
    // also mock the /api/auth/me fetch that AuthContext triggers after login
    fetch.mockResolvedValueOnce({ ok: false });

    renderLogin();
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
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    );
  });

  it('disables button while loading', async () => {
    let resolve;
    fetch.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'u@test.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'pass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    // clean up
    resolve({ ok: false, json: async () => ({ error: 'fail' }) });
  });

  it('quick-login button fills in email', async () => {
    renderLogin();
    const useBtn = screen.getAllByRole('button', { name: /use/i })[0];
    await userEvent.click(useBtn);
    expect(screen.getByLabelText(/email/i)).toHaveValue('patient@test.com');
  });

  it('calls onSwitchToSignup when create account link clicked', async () => {
    const onSwitch = vi.fn();
    renderLogin(onSwitch);
    await userEvent.click(screen.getByRole('button', { name: /create one/i }));
    expect(onSwitch).toHaveBeenCalled();
  });
});
