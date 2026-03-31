import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// Helper component to expose context values
function AuthConsumer({ onValue }) {
  const ctx = useAuth();
  onValue(ctx);
  return null;
}

function renderWithAuth(onValue) {
  return render(
    <AuthProvider>
      <AuthConsumer onValue={onValue} />
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with null user when no token in localStorage', async () => {
    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));
    expect(ctx.user).toBeNull();
  });

  it('fetches user when token is present in localStorage', async () => {
    localStorage.setItem('token', 'mock-token');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, email: 'test@test.com', user_type: 'patient' }),
    });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));
    expect(ctx.user).toEqual({ id: 1, email: 'test@test.com', user_type: 'patient' });
  });

  it('logs out when stored token is invalid', async () => {
    localStorage.setItem('token', 'bad-token');
    fetch.mockResolvedValueOnce({ ok: false });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));
    expect(ctx.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('login sets user and token on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'new-token', user: { id: 2, email: 'u@test.com' } }),
    });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));

    await act(async () => { await ctx.login('u@test.com', 'pass123'); });

    expect(localStorage.getItem('token')).toBe('new-token');
    expect(ctx.user).toEqual({ id: 2, email: 'u@test.com' });
  });

  it('login throws on bad credentials', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));

    await expect(act(async () => {
      await ctx.login('bad@test.com', 'wrong');
    })).rejects.toThrow('Invalid email or password');
  });

  it('logout clears user and token', async () => {
    localStorage.setItem('token', 'tok');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, email: 'u@test.com' }),
    });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));

    act(() => { ctx.logout(); });

    expect(ctx.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('signup stores token and user', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'signup-tok', user: { id: 3, email: 'new@test.com' } }),
    });

    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));

    await act(async () => {
      await ctx.signup({ email: 'new@test.com', password: 'pass123', full_name: 'New', user_type: 'patient' });
    });

    expect(localStorage.getItem('token')).toBe('signup-tok');
    expect(ctx.user.email).toBe('new@test.com');
  });

  it('updateUser replaces current user', async () => {
    let ctx;
    renderWithAuth((v) => { ctx = v; });
    await waitFor(() => expect(ctx.loading).toBe(false));

    act(() => { ctx.updateUser({ id: 99, email: 'updated@test.com' }); });

    expect(ctx.user).toEqual({ id: 99, email: 'updated@test.com' });
  });
});

describe('useAuth outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer onValue={() => {}} />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    spy.mockRestore();
  });
});
