import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../api';

describe('api()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with the given path', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await api('/api/health');
    expect(fetch).toHaveBeenCalledWith('/api/health', {});
  });

  it('passes options to fetch', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    const opts = { method: 'POST', body: JSON.stringify({ a: 1 }) };
    await api('/api/test', opts);
    expect(fetch).toHaveBeenCalledWith('/api/test', opts);
  });

  it('returns the fetch response', async () => {
    const mockResponse = { ok: true, status: 200 };
    fetch.mockResolvedValueOnce(mockResponse);
    const result = await api('/api/health');
    expect(result).toBe(mockResponse);
  });

  it('propagates fetch errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(api('/api/health')).rejects.toThrow('Network error');
  });
});
