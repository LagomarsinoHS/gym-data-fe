export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Personal fields from GET /users/me (`user.profile`).
 * Also accepts flat name holders (coach summary, invite athlete snippet).
 */
export function userProfile(user) {
  if (!user || typeof user !== 'object') return {};
  if (user.profile && typeof user.profile === 'object') return user.profile;
  if (
    user.firstName != null ||
    user.lastName != null ||
    user.heightCm != null ||
    user.sex != null ||
    user.birthDate != null
  ) {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      heightCm: user.heightCm ?? null,
      sex: user.sex ?? null,
      birthDate: user.birthDate ?? null,
    };
  }
  return {};
}

/** Lowercase + strip accents/diacritics for accent-insensitive search. */
export function normalizeSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** First occurrence wins; identity via `exercise.id`. */
export function dedupeById(list) {
  const seen = new Set();
  return list.filter(exercise => {
    const id = String(exercise.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
