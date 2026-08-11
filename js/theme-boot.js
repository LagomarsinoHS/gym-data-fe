/* Sync head boot (no modules): mirrors js/utils/prefs.js THEME_KEY to avoid FOUC.
 * Also migrates legacy FLEX_* keys → steelPulse.* once per browser. */
(() => {
  try {
    const legacy = [
      ['FLEX_THEME', 'steelPulse.theme'],
      ['FLEX_LANG', 'steelPulse.lang'],
      ['FLEX_TOKEN', 'steelPulse.token'],
      ['FLEX_FEATURE_HINTS', 'steelPulse.featureHints'],
      ['FLEX_SEEN_NEW_ATHLETES', 'steelPulse.seenNewAthletes'],
    ];
    for (const [from, to] of legacy) {
      const oldVal = localStorage.getItem(from);
      if (oldVal == null) continue;
      if (localStorage.getItem(to) == null) localStorage.setItem(to, oldVal);
      localStorage.removeItem(from);
    }

    const theme = localStorage.getItem('steelPulse.theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (_) {}
})();
