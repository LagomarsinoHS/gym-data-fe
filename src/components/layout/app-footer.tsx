import { useEffect, useState } from "react";

const FLEX_KEY = "mister-l-flexes";
const ROTATE_MS = 4000;

const TAGLINES = [
  "Hoy se entrena, mañana también.",
  "La proteína no se cuenta, se disfruta.",
  "El único mal press es el que no se hace.",
  "Sin dolor, solo memes.",
  "Descanso activo = mirar las repes del compañero.",
  "Haz sentadillas, tus jeans te lo agradecerán.",
  "Ego en la puerta y la barra en el rack.",
  "Hoy toca pierna, disculpe las molestias al caminar.",
  "No todos los héroes llevan capa, algunos llevan muñequeras.",
  "Si fuera fácil, lo haría tu suegra.",
  "Repitiendo repes y chistes malos.",
  "Pies en el suelo, mente en el PR.",
  "Hoy es un buen día para romper rutinas (y mitos).",
  "Hazlo por ti. Y por la selfie post-entreno.",
  "La constancia pesa más que la barra.",
];

function readFlexes() {
  const n = Number(sessionStorage.getItem(FLEX_KEY) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function AppFooter() {
  const [flexes, setFlexes] = useState(readFlexes);
  const [pop, setPop] = useState(false);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let fade = 0;
    const timer = window.setInterval(() => {
      setLeaving(true);
      fade = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % TAGLINES.length);
        setLeaving(false);
      }, 220);
    }, ROTATE_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fade);
    };
  }, []);

  return (
    <footer className="app-footer">
      <div className="app-footer-row">
        <span className="app-footer-text">
          Maintained by <strong className="app-footer-name">Mister L</strong>
        </span>
        <button
          type="button"
          className={`app-footer-emoji${pop ? " is-pop" : ""}`}
          id="footer-emoji"
          title="Flex!"
          aria-label="Add a flex"
          onClick={() => {
            const next = flexes + 1;
            setFlexes(next);
            sessionStorage.setItem(FLEX_KEY, String(next));
            setPop(false);
            window.requestAnimationFrame(() => setPop(true));
          }}
          onAnimationEnd={() => setPop(false)}
        >
          💪
        </button>
        <span className="app-footer-flexes" id="footer-flexes">
          flexes: {flexes}
        </span>
        <span className="app-footer-sep" aria-hidden="true">
          ·
        </span>
        <span className="app-footer-updated">Updated 2026</span>
      </div>
      <p className={`app-footer-tagline${leaving ? " is-out" : ""}`} id="footer-tagline">
        {TAGLINES[index]}
      </p>
    </footer>
  );
}
