import overviewEn from './overview/en.js';
import overviewEs from './overview/es.js';
import editEn from './edit/en.js';
import editEs from './edit/es.js';
import coachEn from './coach/en.js';
import coachEs from './coach/es.js';
import avatarEn from './avatar/en.js';
import avatarEs from './avatar/es.js';
import deactivateEn from './deactivate/en.js';
import deactivateEs from './deactivate/es.js';

/** Flat merge of profile feature dictionaries (same keys as legacy profile.js) */
export const profile = {
  en: {
    ...overviewEn,
    ...editEn,
    ...coachEn,
    ...avatarEn,
    ...deactivateEn,
  },
  es: {
    ...overviewEs,
    ...editEs,
    ...coachEs,
    ...avatarEs,
    ...deactivateEs,
  },
};
