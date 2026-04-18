export const applyTheme = (themeData) => {
  if (!themeData || !themeData.colors) return;
  const root = document.documentElement;
  root.style.setProperty('--primary-color', themeData.colors.primary);
  root.style.setProperty('--secondary-color', themeData.colors.secondary);
  root.style.setProperty('--accent-color', themeData.colors.accent);
};