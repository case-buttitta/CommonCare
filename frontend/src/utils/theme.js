export const applyTheme = (themeData) => {
  if (!themeData || !themeData.colors) return;
  const root = document.documentElement;
  const { primary, secondary, header, background } = themeData.colors;

  if (primary) {
    root.style.setProperty('--primary-color', primary);
    root.style.setProperty('--primary', primary);
    // Derive a lighter tint (~40% opacity blend toward white)
    root.style.setProperty('--primary-light', _lighten(primary, 0.6));
    root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${primary} 0%, ${_lighten(primary, 0.25)} 100%)`);
  }
  if (secondary) root.style.setProperty('--secondary-color', secondary);
  if (header) root.style.setProperty('--header-bg-color', header);
  if (background) root.style.setProperty('--page-bg-color', background);
};

// Blend a hex color toward white by `amount` (0=original, 1=white)
function _lighten(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export const loadAndApplyTheme = async (token) => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/themes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.theme) applyTheme(data.theme);
    }
  } catch {
    // theme load is non-critical
  }
};
