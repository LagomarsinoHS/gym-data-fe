/**
 * Shared exercise-card helpers (catalog + training).
 */
import { assetUrl } from './assets.js';
import { exerciseName, label } from './labels.js';

/**
 * Fill thumb, gif dataset, name, category/equipment tags on a card root.
 * @param {HTMLElement} card
 * @param {object} exercise Exercise from catalog / trainingProgram
 * @param {{ nameSelector?: string }} [opts]
 */
export function fillCardMedia(card, exercise, { nameSelector = '.card-name' } = {}) {
  const name = exerciseName(exercise);

  const thumb = card.querySelector('.card-thumb');
  if (thumb) {
    thumb.src = assetUrl(exercise.image);
    thumb.alt = name;
  }

  const gif = card.querySelector('.card-gif');
  if (gif) {
    if (exercise.gif_url) gif.dataset.src = assetUrl(exercise.gif_url);
    else delete gif.dataset.src;
  }

  const nameEl = card.querySelector(nameSelector);
  if (nameEl) nameEl.textContent = name;

  const cat = card.querySelector('.tag-cat');
  if (cat) cat.textContent = label(exercise.category);

  const equip = card.querySelector('.tag-equip');
  if (equip) equip.textContent = label(exercise.equipment);

  return name;
}

/** Lazy-load card GIF once on hover. */
export function primeCardGif(card) {
  const gif = card?.querySelector('.card-gif');
  if (!gif?.dataset.src) return;
  if (gif.getAttribute('src')) return;
  gif.src = gif.dataset.src;
}

/**
 * Delegated hover (gif) + click (open) for a card grid.
 * @param {HTMLElement|null} grid
 * @param {{ cardSelector: string, onOpen: (id: string) => void }} opts
 */
export function wireCardGrid(grid, { cardSelector, onOpen }) {
  if (!grid) return;

  grid.addEventListener('mouseover', e => {
    const card = e.target.closest(cardSelector);
    if (card) primeCardGif(card);
  });

  grid.addEventListener('click', e => {
    const card = e.target.closest(cardSelector);
    if (card?.dataset.id) onOpen?.(card.dataset.id);
  });
}
