import trainingEn from './training/en.js';
import trainingEs from './training/es.js';
import coachPlanEn from './coachPlan/en.js';
import coachPlanEs from './coachPlan/es.js';
import nutritionEn from './nutrition/en.js';
import nutritionEs from './nutrition/es.js';
import progressEn from './progress/en.js';
import progressEs from './progress/es.js';

/** Flat merge of athlete feature dictionaries (same keys as legacy athlete.js) */
export const athlete = {
  en: {
    ...trainingEn,
    ...coachPlanEn,
    ...nutritionEn,
    ...progressEn,
  },
  es: {
    ...trainingEs,
    ...coachPlanEs,
    ...nutritionEs,
    ...progressEs,
  },
};
