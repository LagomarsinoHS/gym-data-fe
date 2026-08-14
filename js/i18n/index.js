import { common } from './common/index.js';
import { auth } from './auth/index.js';
import { athlete } from './athlete/index.js';
import { coach } from './coach/index.js';
import { profile } from './profile/index.js';
import { admin } from './admin/index.js';

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
