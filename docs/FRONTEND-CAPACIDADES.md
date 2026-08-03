# Inventario del frontend — qué hace hoy

Documento de referencia de **todo** lo que el FE hace actualmente (llamadas, vistas, animaciones, stubs).  
App: vanilla ES modules (`index.html` + `js/main.js`). Sin framework.

API: `localhost:3000` en local · `https://gym-data-8d3l.onrender.com` en prod.

---

## 1. Boot / arranque

1. **`js/theme-boot.js`** (en `<head>`) — lee `FLEX_THEME` y pone `html[data-theme]` antes del paint (sin flash).
2. Carga CSS: `base.css` (tokens) → `app.css` (UI).
3. **`init()` en `main.js`:**
   - Sincroniza labels `[data-ui]` según idioma guardado
   - `GET /exercises/labels` → chips de filtros
   - Inicia sesión, auth, tema, drawer mobile, students, coach panel, coach invite, recommend
   - Revela filtros (animación cascade)
   - En mobile: colapsa filtros + mueve results bar arriba
   - `restoreSession()` → si hay token, `GET /users/me` (+ `onUserSynced` → pending invite)
   - Primera página del catálogo
   - Wire de eventos (search, chips, cards, modal, WOD, infinite scroll…)
   - Footer (taglines + contador de flexes)
   - Deep link: si la URL trae `?exercise=` o `#id` → abre el modal

Si el boot falla → mensaje de error en el contador de resultados.

---

## 2. Auth

| Acción | Qué pasa |
|--------|----------|
| Login | `POST /auth/login` → guarda `FLEX_TOKEN` → `GET /users/me` → (atleta) pending invite → vista según rol |
| Register | Form extra: nombre, apellido, rol Atleta/Entrenador → `POST /auth/register` (mismo flujo de token) |
| Logout | Menú cuenta → **Cerrar sesión** → borra token, user=null, vista catálogo, limpia recommend / cache alumnos / pending invite |
| Restaurar sesión | Al boot / post-login: Bearer + `/users/me`; si falla → guest |

- Overlay auth: backdrop / Escape cierran; errores mapeados (401, 409, etc.).
- Password min 6; autocomplete distinto login vs register.
- **Menú de cuenta** (`session-ui.js` / `#sidebar-user`): avatar con iniciales, nombre corto (`Humberto L`), badge de rol, chevron → dropdown.
  - **Mi perfil** y **Configuración**: visibles pero `disabled` (tooltip “Próximamente”).
  - **Cerrar sesión**: activo (rojo).
  - Cierra con click afuera o Escape.

---

## 3. Roles, nav y vistas

| Rol | Nav |
|-----|-----|
| **Athlete** | Mi plan → Entrenamiento, Recomendar (Pro), Plan del coach · Catálogo |
| **Coach / Admin** | Panel · Plantillas · Mis alumnos · Catálogo |

| Vista | Contenido |
|-------|-----------|
| `catalog` | Grid + filtros + search + WOD |
| `training` | Plan personal (`trainingProgram`) |
| `recommend` | Recomendar (solo si `subscription.plan === 'premium'`) |
| `coach-plan` | Plan del coach (`coachTrainingProgram` por sesiones; empty sin coach / sin plan) |
| `coach-panel` | Resumen informativo (`coach-panel-ui`): total alumnos + sin pauta + historial invites |
| `coach-templates` | Shell placeholder |
| `students` | Mis alumnos (`students-ui` + `coach-sessions-ui` + `students-download-ui` + store) |
| `session-editor` | Editor de una sesión del atleta (coach) |

- Post-login: coach/admin → `coach-panel`; athlete → `training`.
- Recomendar: nav locked + tooltip si no es Pro.
- Identidad en sidebar: menú de cuenta (iniciales + rol); ver Auth.
---

## 4. Catálogo

### Llamadas
- `GET /exercises?page&limit=12&category&equipment&target&search`
- Filtros **en servidor** (máx. 1 valor por dimensión).
- Infinite scroll: `IntersectionObserver` + spinner; dedupe por `id`.

### Filtros (sidebar)
- Accordions: categoría, equipo, músculo (labels de API).
- Equipo/target: muestran 5 y “N restantes” expande.
- Un chip activo por grupo; al elegir chip se limpia el search.
- Badges activos en results bar + “Limpiar todo”.

### Search (debounce 500ms)
- **Entrenamiento:** solo en memoria (nombre, id, notas, labels).
- **Catálogo:**
  - Código easter egg exacto → panel custom (sin API)
  - Solo dígitos → `GET /exercises/:id` (una card)
  - Texto → `GET /exercises?search=…` (reset página)

### WOD
- Botón → `GET /exercises/random` → abre modal.

### Easter eggs (search)
Códigos en `easter-egg.js` (rest day, creador, mensajes, roast con CSS especial).

### Cards catálogo
- Thumb lazy + shimmer hasta listo; hover carga GIF.
- Click → modal.
- Stagger `card-enter` al pintar; hover `translateY(-3px)`.

---

## 5. Mi entrenamiento

- Fuente: `user.trainingProgram` (ejercicio enriquecido + pauta).
- Filtros/search **locales** (mismos chips del sidebar + search).
- Empty: plan vacío (CTA a catálogo) o “sin resultados” por filtros.
- **Card:**
  - Tags categoría / equipo
  - RX vertical: línea + `🏋️ sets` / `🔁 reps` / `⏱️ rests`
  - Sin pauta → “Sin pauta asignada”
  - Nota clamp 2 líneas (`title` = texto completo)
- Tras guardar pauta y cerrar modal → flash `.is-updated` en esa card.

---

## 6. Modal de ejercicio

### Abrir
- Click card, WOD o deep link.
- Overlay `.open`, `overflow: hidden`, sync `?exercise=` en la URL.
- Pinta cache ya; refresca con `GET /exercises/:id`.
- Si el modal ya estaba abierto con otro id → fade `is-swap`.
- Enter notorio: panel sube + scale (sheet en mobile).

### Contenido
- Título, GIF, meta chips (parte del cuerpo / equipo / objetivo).
- Músculos primario / secundario.
- Instrucciones (tabs EN/ES si hay ambos).
- Copiar enlace → clipboard + feedback “Copiado” ~1.4s.

### Plan (CTA)
| Estado | Botón |
|--------|--------|
| Guest | “Inicia sesión para guardar” → auth |
| No está | “Agregar a mi plan” → `POST /users/training-program` |
| En plan (catálogo) | “En tu plan” disabled |
| En plan (entrenamiento) | “Quitar del plan” → undo ~1s (barra fill) → luego `PUT .../remove` |

- Cerrar durante undo **confirma** el remove.
- Fallo al agregar: mensaje breve y resync.

### Pauta (lápiz)
- Visible si el ejercicio está en el plan.
- Abre form (series, reps, rest seg, notas) con transición altura/opacity.
- Reps: `cleanReps` en vivo; al guardar `formatReps` → `6` o `8 - 12`.
- `PUT /users/training-program/:exerciseId` (solo campos llenos).
- Al guardar: cierra form → resumen con **pop** de chips + fade de nota + flash del box.
- Cards del plan se refrescan; al cerrar modal, flash de la card tocada.

### Cerrar
- ✕, backdrop, Escape.
- Limpia `?exercise=`, form RX instantáneo, GIF tras transición.

---

## 7. Recomendar (Pro)

- Modal: zona (select) + 1–2 equipos (chips).
- `GET /exercises/recommend?zone=&equipment=` (auth).
- Resultados: toolbar + “Generar otro”; cards con rol opcional; click → modal ejercicio.
- Logout limpia el plan recomendado en memoria.

---

## 8. Coach — Panel

- Vista informativa (`coach-panel-ui.js`): **Total de alumnos** y **Alumnos sin pauta**.
- Data stats: pagina `GET /users/coach/athletes` hasta completar; “sin pauta” = sin sesiones con `items`.
- Loading (opción B): spinner + stats ocultas hasta tener números (sin placeholders `—`).
- **Invitaciones:** historial filtrable (`GET /users/coach/invites?status=&page=&limit=`).
  - Filtros: Todas / Pendientes / Aceptadas / Rechazadas / Canceladas.
  - Al cambiar filtro (`replace`): vacía lista + empty + “Cargar más” → spinner → pinta resultados (sin dejar filas viejas debajo del spinner).
  - Un filtro nuevo puede interrumpir una carga en curso (`invitesSeq`); “Cargar más” espera a que termine.
  - Filas: nombre (si existe), email, status, fechas; “Cargar más” si hay más páginas.
- Sin click-through en las stats: actuar en Mis alumnos.

---

## 9. Mis alumnos (coach)

- Toolbar: buscar (debounce 500ms), **Ordenar** (menú: sin/con pauta primero), **Descargar**, Invitar alumno.
- Orden: client-side sobre alumnos **ya cargados** (incluye “Cargar más”); re-click de la opción activa quita el orden.
- Badge **Nuevo**: invites `accepted` con `respondedAt` ≤ 48h (vía `GET /users/coach/invites`); al abrir la fila se guarda como visto en `localStorage` y no vuelve a marcarse (ni al recargar / re-login).
- Descargar: menú toolbar “Descargar todos”; por alumno ⏬ → Excel (activo) / PDF (pronto).
  - `POST /users/coach/training-program/export` binary (`athleteIds: []` = todos; `[id]` = uno) + `locale`.
- Loading spinner al primer fetch; empty / sin resultados sin flash raro.
- Modal email exacto → `POST /users/coach/invites` (Bearer); “Invitación enviada”.
- Lista → `GET /users/coach/athletes` (paginado 5 + Cargar más); cache en memoria.
- Acordeón alumno → info + plan; **Agregar sesión** (modal nombre, local).
- Sub-acordeón sesión → mini-cards (thumb, nombre, pauta) + Editar sesión.
- Vista `session-editor`: cards, Editar / ✕, Agregar ejercicios; modal confirmar quitar sesión.
- Catálogo en modo asignar: banner + “Agregar a la sesión” + lápiz pauta (local); guardar vuelve al editor.
- Sesiones en `athlete.coachTrainingProgram`; **Guardar plan** → `PUT /users/coach/athletes/:id/training-program` (replace; respuesta enriquecida).

---

## 10. Invite atleta (pending)

- Colección `invites` en BE; **no** vive en el documento User ni en `GET /users/me`.
- `GET /users/me/pending-coach-invite` → siempre `{ invite: null | { coachId, invitedAt, coach } }` (máx. 1 pendiente).
- FE (`coach-invite-ui.js`): carga junto a cada `/users/me` (`restoreSession` / `refreshUser` vía `onUserSynced`), y de nuevo al volver a la pestaña (`visibilitychange`). No re-fetch al navegar.
- Banner + dot en Plan del coach → accept / reject `POST /users/me/pending-coach-invite/respond`.

---

## 11. Tema e idioma

| Preferencia | Key | Valores |
|-------------|-----|---------|
| Tema | `FLEX_THEME` | `light` \| `dark` |
| Idioma | `FLEX_LANG` | `es` (default) \| `en` |

- Toggle tema: emoji + clase `theme-animating` ~280ms.
- Toggle idioma: re-pinta chrome, filtros, grids, modal abierto.

---

## 12. API — mapa completo

| Método | Path | Auth | Cuándo |
|--------|------|------|--------|
| GET | `/exercises/labels` | No | Boot |
| GET | `/exercises?…` | No | Catálogo / filtros / search / páginas |
| GET | `/exercises/:id` | No | Modal, search numérico, deep link |
| GET | `/exercises/random` | No | WOD |
| GET | `/exercises/recommend?zone&equipment` | Sí | Submit recommend |
| POST | `/auth/login` | No | Login |
| POST | `/auth/register` | No | Register |
| GET | `/users/me` | Sí | Sesión (user + programs enriquecidos; **sin** invite) |
| GET | `/users/me/pending-coach-invite` | Sí | Atleta: `{ invite }` (null o pendiente) |
| POST | `/users/training-program` | Sí | Agregar al plan |
| PUT | `/users/training-program/remove` | Sí | Confirmar quitar |
| PUT | `/users/training-program/:exerciseId` | Sí | Guardar pauta |
| POST | `/users/coach/invites` | Sí | Coach invita atleta por email |
| POST | `/users/me/pending-coach-invite/respond` | Sí | Atleta accept / reject |
| GET | `/users/coach/athletes` | Sí | Lista paginada Mis alumnos / stats Panel |
| GET | `/users/coach/invites` | Sí | Historial invites coach (`status` opcional) |
| PUT | `/users/coach/athletes/:athleteId/training-program` | Sí | Guardar plan (replace sesiones) |
| POST | `/users/coach/training-program/export` | Sí | Export Excel/zip (binary) |

---

## 13. Animaciones y microinteracciones

| Qué | Cuándo |
|-----|--------|
| Reveal filtros (stagger) | Boot |
| Chip pop | Seleccionar filtro |
| Search pop | Focus en search |
| Card enter (stagger) | Pintar cards catálogo |
| Media shimmer → fade | Carga de thumb |
| Thumb ↔ GIF | Hover card |
| Card hover lift | Mouse over |
| Spinner | Cargando más páginas |
| Easter egg enter / roast pulse | Códigos en search |
| Modal overlay + panel enter | Abrir ejercicio |
| Modal `is-swap` | Cambiar ejercicio con modal abierto |
| Share `is-copied` | Copiar link |
| Undo fill bar (1s) | Quitar del plan |
| Plan btn busy | Agregar al plan |
| Form RX open/close | Lápiz |
| Chips RX pop + summary flash | Guardar pauta |
| Nota RX fade-in | Guardar con nota |
| Training card flash | Tras guardar pauta / cerrar modal |
| Footer shine / sweep / flex pulse | Siempre |
| Footer emoji pop + contador | Click 💪 |
| Tagline rotate | Cada ~4s |
| Nav drawer slide + backdrop | Mobile menú |
| Auth / recommend overlay | Abrir esos modales |

`prefers-reduced-motion: reduce` apaga o simplifica casi todo lo anterior.

---

## 14. Utils

| Archivo | Rol |
|---------|-----|
| `helpers.js` | `debounce`, `normalizeSearch`, `dedupeById` |
| `prefs.js` | tema / idioma en localStorage |
| `url.js` | share URL, leer/sync deep link |
| `cards.js` | media, GIF hover, click delegado |
| `labels.js` | `ui`, `label`, `exerciseName`, lang |
| `reps.js` | `cleanReps`, `formatReps` |
| `assets.js` | `assetUrl` para media |
| `auth-errors.js` | mensajes de error de auth |
| `dates.js` | `formatDate` via `Intl.DateTimeFormat` (es: 2026-agosto-02 · en: August 2, 2026) |

---

## 15. Storage

| Key | Dónde | Contenido |
|-----|-------|-----------|
| `FLEX_TOKEN` | localStorage | JWT |
| `FLEX_THEME` | localStorage | light/dark |
| `FLEX_LANG` | localStorage | es/en |
| `mister-l-flexes` | sessionStorage | contador del 💪 del footer |

---

## 16. Mobile (≤768px)

- Topbar + hamburger; sidebar drawer off-canvas.
- Cierre: ✕, backdrop, item de nav, Escape, resize a desktop.
- Filtros colapsados; chips con scroll horizontal.
- Results bar arriba del main.
- Modal ejercicio = bottom sheet (~92dvh).
- Grid más denso (y otra vez a ≤480px).

---

## 17. Mapa de archivos

| Área | Archivos |
|------|----------|
| Entry / catálogo / modal / pauta | `js/main.js` |
| Sesión / vistas / roles | `js/features/session-ui.js` |
| Auth UI | `js/features/auth-ui.js` |
| Entrenamiento | `js/features/training-ui.js` |
| Recommend | `js/features/recommend-ui.js` |
| Coach Panel | `js/features/coach-panel-ui.js` |
| Coach invite banner | `js/features/coach-invite-ui.js` |
| Students | `js/features/students-ui.js` |
| Students download | `js/features/students-download-ui.js` |
| Coach sessions / editor | `js/features/coach-sessions-ui.js` |
| Athletes store | `js/features/coach-athletes-store.js` |
| Drawer | `js/features/nav-drawer.js` |
| Tema | `theme-boot.js`, `theme-ui.js` |
| Footer / eggs | `footer.js`, `easter-egg.js` |
| API | `js/api/request.js`, `auth.js`, `users.js`, `exercises.js`, `token.js` |
| Copy | `js/constants.js` |
| Estilos | `public/css/base.css`, `app.css` |

---

## 18. Stubs / aún no cableado

- Plantillas (`coach-templates`) placeholder.
- Export PDF (UI disabled “Pronto”).
- Admin no se elige en register (solo DB); en nav se comporta como coach.
- Sin refresh token; si `/me` falla, sesión guest.
- Recommend exige `subscription.plan === 'premium'` del back.

---

## Ver también

- [TODO.md](./TODO.md) — pendientes (FE + BE)
