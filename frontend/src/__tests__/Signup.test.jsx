import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Signup from '../Signup';
import { AuthProvider } from '../AuthContext';

function renderSignup(onSwitch = vi.fn()) {
  return render(
    <AuthProvider>
      <Signup onSwitchToLogin={onSwitch} />
    </AuthProvider>
  );
}

describe('Signup component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders required fields', () => {
    renderSignup();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderSignup();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@test.com');
    await userEvent.type(screen.getByLabelText(/full name/i), 'A B');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'pass123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    renderSignup();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@test.com');
    await userEvent.type(screen.getByLabelText(/full name/i), 'A B');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'abc');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'abc');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls signup API on valid submission', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok', user: { id: 1, user_type: 'patient' } }),
    });

    renderSignup();
    await userEvent.type(screen.getByLabelText(/email/i), 'new@test.com');
    await userEvent.type(screen.getByLabelText(/full name/i), 'New User');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'pass123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('shows API error message on signup failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already registered' }),
    });

    renderSignup();
    await userEvent.type(screen.getByLabelText(/email/i), 'dup@test.com');
    await userEvent.type(screen.getByLabelText(/full name/i), 'Dup User');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'pass123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    );
  });

  it('calls onSwitchToLogin when sign in link clicked', async () => {
    const onSwitch = vi.fn();
    renderSignup(onSwitch);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('does not send confirmPassword to the API', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 't', user: { id: 1, user_type: 'patient' } }),
    });

    renderSignup();
    await userEvent.type(screen.getByLabelText(/email/i), 'x@test.com');
    await userEvent.type(screen.getByLabelText(/full name/i), 'X');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'pass123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('confirmPassword');
  });
});
