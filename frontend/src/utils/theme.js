export const applyTheme = (themeData) => {
  if (!themeData || !themeData.colors) return;
  const root = document.documentElement;
  if (themeData.colors.primary) root.style.setProperty('--primary-color', themeData.colors.primary);
  if (themeData.colors.secondary) root.style.setProperty('--secondary-color', themeData.colors.secondary);
  if (themeData.colors.header) root.style.setProperty('--header-bg-color', themeData.colors.header);
  if (themeData.colors.background) root.style.setProperty('--page-bg-color', themeData.colors.background);
};

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
