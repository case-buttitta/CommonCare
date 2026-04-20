import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { applyTheme } from '../utils/theme';

const ThemeSettings = ({ locationId, onThemeUpdated }) => {
  const { token } = useAuth();
  const [colors, setColors] = useState({
    primary_color: '#780606',
    secondary_color: '#DE6464',
    header_color: '#780606',
    background_color: '#f8fafc',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/themes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.theme?.colors) {
            setColors({
              primary_color: data.theme.colors.primary || '#3b82f6',
              secondary_color: data.theme.colors.secondary || '#1e40af',
              header_color: data.theme.colors.header || '#1e293b',
              background_color: data.theme.colors.background || '#f8fafc',
            });
          }
        }
      } catch {
        // non-critical
      }
    };
    fetchTheme();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/themes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(colors),
      });

      if (res.ok) {
        const data = await res.json();
        applyTheme(data.theme);
        if (onThemeUpdated) onThemeUpdated(data.theme);
        setToast({ message: 'Theme saved!', type: 'success' });
        setTimeout(() => setToast(null), 2500);
      } else {
        const err = await res.json();
        setToast({ message: err.error || 'Failed to save theme', type: 'error' });
        setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setToast({ message: 'Failed to save theme', type: 'error' });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const colorFields = [
    { key: 'header_color', label: 'Header Background' },
    { key: 'background_color', label: 'Page Background' },
    { key: 'primary_color', label: 'Primary Color' },
    { key: 'secondary_color', label: 'Secondary Color' },
  ];

  return (
    <div className="theme-settings-panel">
      {toast && (
        <div className={`profile-toast ${toast.type}`}>{toast.message}</div>
      )}
      <div className="theme-color-grid">
        {colorFields.map(({ key, label }) => (
          <div className="theme-color-row" key={key}>
            <label className="theme-color-label">{label}</label>
            <div className="theme-color-input-group">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                className="theme-color-picker"
              />
              <span className="theme-color-hex">{colors[key]}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="theme-preview" style={{
        backgroundColor: colors.background_color,
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        marginTop: '16px',
      }}>
        <div style={{
          backgroundColor: colors.header_color,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>CommonCare</span>
          <span style={{
            background: colors.primary_color,
            color: '#fff',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
          }}>Preview</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <button style={{
            background: colors.primary_color,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            marginRight: '8px',
          }}>Primary Button</button>
          <button style={{
            background: colors.secondary_color,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
          }}>Secondary Button</button>
        </div>
      </div>
      <button
        className="auth-button"
        style={{ marginTop: '16px' }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Theme'}
      </button>
    </div>
  );
};

export default ThemeSettings;
