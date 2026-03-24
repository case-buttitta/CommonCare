const API_BASE = import.meta.env.VITE_API_URL || '';

export function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options);
}
