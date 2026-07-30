/**
 * Easter eggs unlocked by typing these codes in the search box.
 * Edit messages here — main.js only checks the key and renders.
 */
const EASTER_EGGS = {
  '999999': {
    kicker: 'Exercise #0000',
    title: 'Descanso Absoluto',
    lead: 'Este ID está reservado por el Comité Internacional de No Hacer Nada. La base de datos lo confirma: hoy no hay PR.',
    steps: [
      'Cerrar la app (o fingir que seguís buscando).',
      'Beber agua. O café. No somos la policía.',
      'Decirle a tu yo del gym que vuelva mañana… tal vez.',
    ],
    meta: ['Categoría: supervivencia', 'Equipamiento: sofá', 'Músculo objetivo: ninguno'],
    foot: 'Si llegaste acá, ya cumpliste el workout más difícil: aceptar el rest day.',
  },

  '991650806': {
    kicker: 'Access code #91650806',
    title: 'Modo Creador Desbloqueado',
    lead: 'Esto fue creado por la persona más genial y hermosa del planeta entero. No es opinion: es un hecho indexado, cacheado y con CORS abierto al universo.',
    steps: [
      'Cada endpoint existe porque alguien brilló más fuerte que el sol del gym.',
      'Si la app carga rápido, es talento. Si falla, es el Wi-Fi (obvio).',
      'Este mensaje se auto-firma con estilo, cafeína y cero humildad innecesaria.',
    ],
    meta: ['Rol: leyenda', 'Status: inalcanzable', 'PR personal: existir'],
    foot: 'Si estás leyendo esto, ya formas parte del fan club oficial. Bienvenido. Trae snacks.',
  },
  '962583602': {
    kicker: 'Code: 962583602 · Destinataria: Deyanira',
    title: 'Alerta de Oruga Arrugada',
    lead: 'Dayanira: te estamos esperando. La mutación de oruga arrugada a mariposa con peos ya tiene fecha… falta que aparezcas.',
    steps: [
      'Baja del sofá. El sofá ya mandó un ticket de soporte.',
      'Una sentadilla cuenta. Dos son progreso. Cero es muerta de floja.',
      'Cuando salgan las alitas (y los peos), avisa. Queremos aplaudir. De lejos.',
    ],
    meta: ['Estado: crisálida pendiente', 'Motivación: vergüenza sana', 'Meta: mariposa operativa'],
    foot: 'Con cariño del staff: menos arruga, más aleteo. Te queremos igual… pero más si te mueves.',
  },

  '987976626-disabled': {
    kicker: 'Code: 987976626 · Para: Peque',
    title: 'Misión Dominadas 🏋️',
    lead: 'Peque: fin de año se acerca y las dominadas no se van a hacer solas. Tu puedes. El rack ya tiene tu nombre (mentalmente).',
    steps: [
      'Arranca con asistidas si hace falta. El ego no suma reps; la constancia sí.',
      'Suma espalda y agarre: poco a poco, sin drama.',
      'A fin de año: celebrar la dominada. O tres. O el PR que diga tu orgullo.',
    ],
    meta: [
      'Filtra por: Categoría → Espalda',
      'Equipamiento → Peso corporal',
      'Músculo → Dorsales',
    ],
    foot: 'Tip: en los chips de la izquierda, Espalda + Peso corporal + Dorsales. Ahí está el camino a la barra.',
  },

  '984799375': {
    theme: 'roast',
    kicker: '⚠ ALERTA GRASIENTA · Code #984799375',
    title: 'Protocolo: Gordo de Mierda',
    lead: 'Escucha bien, manteca ambulante: las tetas te rebotan más que la pelota en un partido de kids. El espejo del locker room pidió un aumento por estrés. Grasiento, aceitoso, obra maestra del colesterol con patas.',
    steps: [
      'Baja del sillón, gordo. Ese cojín ya tiene tu DNA incrustado en capas geológicas.',
      'Cardio. Aunque sea caminar hasta la cocina sin que tiemble el piso del vecino.',
      'Las mancuernas no muerden. Tú sí sudas aceite. Diferencia clave.',
      'Meta: que te dejen de confundir con un saco de papas en el mercado.',
    ],
    meta: [
      'Estado: peligro bioquímico',
      'IMC: error 413 Payload Too Large',
      'Músculo objetivo: vergüenza',
      'Equipamiento: voluntad (agotada)',
    ],
    foot: 'Con odio: menos grasa, más reps. O seguí así… y cobramos peaje por tu sombra.',
  },
};

export function isEasterEggQuery(q) {
  return Object.prototype.hasOwnProperty.call(EASTER_EGGS, String(q).trim());
}

export function getEasterEgg(q) {
  return EASTER_EGGS[String(q).trim()] ?? null;
}

/** Renders the matching easter-egg panel into the main grid. */
export function renderEasterEgg(container, egg) {
  container.innerHTML = '';
  if (!egg) return;

  const panel = document.createElement('div');
  panel.className = egg.theme ? `easter-egg easter-egg--${egg.theme}` : 'easter-egg';

  const steps = (egg.steps || [])
    .map(s => `<li>${s}</li>`)
    .join('');
  const meta = (egg.meta || [])
    .map(m => `<span>${m}</span>`)
    .join('');

  panel.innerHTML = `
    <p class="easter-egg-kicker">${egg.kicker}</p>
    <h2 class="easter-egg-title">${egg.title}</h2>
    <p class="easter-egg-lead">${egg.lead}</p>
    <ol class="easter-egg-steps">${steps}</ol>
    <div class="easter-egg-meta">${meta}</div>
    <p class="easter-egg-foot">${egg.foot}</p>
  `;

  container.appendChild(panel);
}
