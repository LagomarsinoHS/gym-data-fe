import overviewEn from './overview/en.js';
import overviewEs from './overview/es.js';
import usersEn from './users/en.js';
import usersEs from './users/es.js';

/** Flat merge of admin feature dictionaries (same keys as legacy admin.js) */
export const admin = {
  en: {
    ...overviewEn,
    ...usersEn,
  },
  es: {
    ...overviewEs,
    ...usersEs,
  },
};
