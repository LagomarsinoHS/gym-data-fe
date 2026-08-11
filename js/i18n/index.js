import { common } from './common.js';
import { auth } from './auth.js';
import { athlete } from './athlete.js';
import { coach } from './coach.js';
import { profile } from './profile.js';
import { admin } from './admin.js';

/** Flat dictionaries — `ui(key)` and data-ui keep working unchanged */
export const UI_LABELS = {
  en: {
    ...common.en,
    ...auth.en,
    ...athlete.en,
    ...coach.en,
    ...profile.en,
    ...admin.en,
  },
  es: {
    ...common.es,
    ...auth.es,
    ...athlete.es,
    ...coach.es,
    ...profile.es,
    ...admin.es,
  },
};

export { VALUE_LABELS_ES } from './value-labels-es.js';
