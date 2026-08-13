/**
 * Shared read-only meal-plan markup (athlete + coach Nutrición).
 */
import { getLang, ui } from '../utils/labels.js';

export function sortNutritionPlans(list) {
  return [...list].sort((a, b) => {
    const aArchived = a?.status === 'archived' ? 1 : 0;
    const bArchived = b?.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    return String(b?.validFrom || '').localeCompare(String(a?.validFrom || ''));
  });
}

export function createMacrosRow(targets = {}) {
  const row = el('div', 'athlete-nutrition-macros');
  const items = [
    ['kcal', formatKcal(targets.calories), 'kcal'],
    ['protein', formatNumber(targets.proteinG), ui('athleteNutritionProteinShort')],
    ['carbs', formatNumber(targets.carbsG), ui('athleteNutritionCarbsShort')],
    ['fat', formatNumber(targets.fatG), ui('athleteNutritionFatShort')],
  ];
  for (const [kind, value, unit] of items) {
    const chip = el('span', `athlete-nutrition-macro is-${kind}`);
    const icon = el('span', `athlete-nutrition-macro-icon is-${kind}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'kcal' ? '🔥' : unit;
    chip.append(icon, el('strong', '', value), document.createTextNode(` ${unit}`));
    row.append(chip);
  }
  return row;
}

export function createPlanBody(plan, { includeTargets = true, includeTitle = false } = {}) {
  const wrap = el('div', 'athlete-nutrition-plan-content');
  const title = String(plan?.title || '').trim();
  if (includeTitle && title) wrap.append(el('h4', 'athlete-nutrition-plan-title', title));
  if (includeTargets) wrap.append(createMacrosRow(plan?.targets));

  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  if (!meals.length) {
    wrap.append(el('h4', 'athlete-nutrition-subtitle', ui('athleteNutritionMeals')));
    wrap.append(el('p', 'athlete-nutrition-muted', ui('athleteNutritionNoMeals')));
  } else {
    wrap.append(createMealsTimeline(meals));
  }

  const notes = String(plan?.generalNotes || '').trim();
  if (notes) {
    wrap.append(el('h4', 'athlete-nutrition-subtitle', ui('athleteNutritionNotes')));
    wrap.append(el('p', 'athlete-nutrition-notes', notes));
  }
  return wrap;
}

export function createMealsTimeline(meals) {
  const timeline = el('div', 'athlete-nutrition-timeline');
  const rail = el('div', 'athlete-nutrition-timeline-rail');
  rail.setAttribute('aria-hidden', 'true');
  rail.append(
    el('span', 'athlete-nutrition-timeline-cap is-sun', '☀️'),
    el('span', 'athlete-nutrition-timeline-line'),
    el('span', 'athlete-nutrition-timeline-cap is-moon', '🌙'),
  );
  timeline.append(rail);

  const list = el('div', 'athlete-nutrition-timeline-list');
  meals.forEach((meal, index) => {
    list.append(createMeal(meal, { index, total: meals.length }));
  });
  timeline.append(list);
  return timeline;
}

export function personName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || '—';
}

export function formatMonthYear(value) {
  const date = parsePlanDate(value);
  if (!date) return '—';
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatShortDate(value) {
  const date = parsePlanDate(value);
  if (!date) return '—';
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatKcal(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat(getLang() === 'en' ? 'en-US' : 'es-CL', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null && text !== '') node.textContent = text;
  return node;
}

function createMeal(meal, { index = 0, total = 1 } = {}) {
  const row = el('article', 'athlete-nutrition-timeline-item');

  const dot = el('span', 'athlete-nutrition-timeline-dot');
  dot.setAttribute('aria-hidden', 'true');
  row.append(dot);

  const time = String(meal?.time || '').trim();
  row.append(el('span', 'athlete-nutrition-meal-time', time || '—'));

  const card = el('div', 'athlete-nutrition-meal');
  const main = el('div', 'athlete-nutrition-meal-main');
  const icon = el('span', 'athlete-nutrition-meal-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = mealIcon(index, total);
  main.append(
    icon,
    el('h5', 'athlete-nutrition-meal-name', String(meal?.name || '').trim() || '—'),
  );

  const foods = Array.isArray(meal?.foods) ? meal.foods : [];
  if (foods.length) {
    const foodLine = foods
      .map((food) => {
        const name = String(food?.name || '').trim() || '—';
        const qty = formatNumber(food?.quantity);
        const unit = String(food?.unit || '').trim();
        return unit ? `${qty} ${unit} ${name}` : `${qty} ${name}`;
      })
      .join(' • ');
    main.append(el('p', 'athlete-nutrition-meal-foods', foodLine));
  }

  card.append(main);
  const mealNotes = String(meal?.notes || '').trim();
  const notesEl = el('p', 'athlete-nutrition-meal-notes', mealNotes);
  if (!mealNotes) notesEl.setAttribute('aria-hidden', 'true');
  card.append(notesEl);
  row.append(card);
  return row;
}

function mealIcon(index, total) {
  if (total <= 1) return '☀️';
  if (index === 0) return '🌅';
  if (index === total - 1) return '🌙';
  if (index === 1) return '☀️';
  return '🥗';
}

function parsePlanDate(value) {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10);
}
