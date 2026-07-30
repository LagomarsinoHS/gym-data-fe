(() => {
  try {
    const theme = localStorage.getItem('FLEX_THEME');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (_) {}
})();
