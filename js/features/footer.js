const FLEX_KEY = 'mister-l-flexes';

const TAGLINES = [
  'Hoy se entrena, mañana también.',
  'La proteína no se cuenta, se disfruta.',
  'El único mal press es el que no se hace.',
  'Sin dolor, solo memes.',
  'Descanso activo = mirar las repes del compañero.',
  'Haz sentadillas, tus jeans te lo agradecerán.',
  'Ego en la puerta y la barra en el rack.',
  'Hoy toca pierna, disculpe las molestias al caminar.',
  'No todos los héroes llevan capa, algunos llevan muñequeras.',
  'Si fuera fácil, lo haría tu suegra.',
  'Repitiendo repes y chistes malos.',
  'Pies en el suelo, mente en el PR.',
  'Hoy es un buen día para romper rutinas (y mitos).',
  'Hazlo por ti. Y por la selfie post-entreno.',
  'La constancia pesa más que la barra.',
];

const ROTATE_MS = 4000;

export function initFooter() {
  const emoji = document.getElementById('footer-emoji');
  const flexesEl = document.getElementById('footer-flexes');
  const taglineEl = document.getElementById('footer-tagline');
  if (!emoji || !flexesEl || !taglineEl) return;

  let flexes = Number(sessionStorage.getItem(FLEX_KEY)) || 0;
  renderFlexes(flexesEl, flexes);

  emoji.addEventListener('click', () => {
    flexes += 1;
    sessionStorage.setItem(FLEX_KEY, String(flexes));
    renderFlexes(flexesEl, flexes);
    emoji.classList.remove('is-pop');
    // reflow so the pop animation can replay
    void emoji.offsetWidth;
    emoji.classList.add('is-pop');
  });

  let i = Math.floor(Math.random() * TAGLINES.length);
  showTagline(taglineEl, TAGLINES[i]);

  setInterval(() => {
    i = (i + 1) % TAGLINES.length;
    taglineEl.classList.add('is-out');
    setTimeout(() => {
      showTagline(taglineEl, TAGLINES[i]);
      taglineEl.classList.remove('is-out');
    }, 220);
  }, ROTATE_MS);
}

function renderFlexes(el, n) {
  el.textContent = `flexes: ${n}`;
}

function showTagline(el, text) {
  el.textContent = text;
}
