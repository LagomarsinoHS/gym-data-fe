import dashboardEn from './dashboard/en.js';
import dashboardEs from './dashboard/es.js';
import templatesEn from './templates/en.js';
import templatesEs from './templates/es.js';
import studentsEn from './students/en.js';
import studentsEs from './students/es.js';
import nutritionEn from './nutrition/en.js';
import nutritionEs from './nutrition/es.js';
import progressEn from './progress/en.js';
import progressEs from './progress/es.js';

/** Flat merge of coach feature dictionaries (same keys as legacy coach.js) */
export const coach = {
  en: {
    ...dashboardEn,
    ...templatesEn,
    ...studentsEn,
    ...nutritionEn,
    ...progressEn,
  },
  es: {
    ...dashboardEs,
    ...templatesEs,
    ...studentsEs,
    ...nutritionEs,
    ...progressEs,
  },
};
