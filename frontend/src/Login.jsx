import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getBrand, applyLoginTheme } from './utils/locationBranding';

const API = import.meta.env.VITE_API_URL;

const ROLE_LABELS = {
  patient: 'Patient',
  staff: 'Staff',
  location_admin: 'Admin',
};

export default function Login({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocId, setSelectedLocId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/locations/public`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLocations(data);
      })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLocation = locations.find((l) => String(l.id) === String(selectedLocId));

  const handleLocationChange = (locId) => {
    setSelectedLocId(locId);
    setEmail('');
    setError('');
    const loc = locations.find((l) => String(l.id) === String(locId));
    if (loc) {
      setPassword(loc.default_password);
      applyLoginTheme(loc.theme);
    } else {
      setPassword('');
    }
  };

  const handleSelectUser = (userEmail) => {
    setEmail(userEmail);
    setDropdownOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const brand = selectedLocation ? getBrand(selectedLocation.name) : null;
  const LogoComp = brand ? brand.Logo : null;
  const brandColor = brand ? brand.color : 'var(--primary-color, #780606)';

  const locationUsers = selectedLocation?.users || [];

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          {LogoComp ? (
            <div className="login-brand">
              <LogoComp size={40} color={brandColor} />
              <span className="login-brand-name">{selectedLocation.name}</span>
            </div>
          ) : (
            <h1>CommonCare</h1>
          )}
          <p>Welcome back! Please sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          {/* Location selector */}
          <div className="form-group">
            <label htmlFor="location-select">Medical Office</label>
            <select
              id="location-select"
              value={selectedLocId}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="location-select"
            >
              <option value="">— Select a location —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Email — custom two-column dropdown when a location is selected */}
          <div className="form-group">
            <label htmlFor="email-input">Email</label>
            {selectedLocation ? (
              <div className="email-dropdown" ref={dropdownRef}>
                <div
                  className={`email-dropdown-trigger${dropdownOpen ? ' open' : ''}`}
                  onClick={() => setDropdownOpen((v) => !v)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setDropdownOpen((v) => !v)}
                >
                  <span className="email-dropdown-value">
                    {email || 'Select an account…'}
                  </span>
                  <span className="email-dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                </div>
                {dropdownOpen && (
                  <div className="email-dropdown-menu">
                    {locationUsers.map((u) => (
                      <div
                        key={u.email}
                        className={`email-dropdown-item${email === u.email ? ' selected' : ''}`}
                        onClick={() => handleSelectUser(u.email)}
                      >
                        <span className="email-dropdown-email">{u.email}</span>
                        <span className={`email-dropdown-role role-${u.user_type}`}>
                          {ROLE_LABELS[u.user_type] || u.user_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading || !email}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="link-button">
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
