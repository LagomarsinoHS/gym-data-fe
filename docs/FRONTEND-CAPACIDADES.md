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
   - Inicia sesión, auth, tema, drawer mobile, students, avances, progress photos, athlete avances, coach panel, coach invite, recommend
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
  - **Mi perfil**: activo → vista `#profile-view`. Avatar clickeable → Ver/Subir foto. **Editar perfil** abre sección inline (nombre, apellido, contraseña) + Guardar → `PATCH /users/me`. **Darse de baja** modal email → `DELETE /users/me`. Al entrar, `refreshUser()`.
  - **Configuración**: visible pero `disabled` (tooltip “Próximamente”).
  - **Cerrar sesión**: activo (rojo).
  - Cierra con click afuera o Escape.

---

## 3. Roles, nav y vistas

| Rol | Nav |
|-----|-----|
| **Athlete** | Mi plan → Entrenamiento, Plan del coach, **Avances**, Recomendar (Pro) · Catálogo |
| **Coach / Admin** | Panel · Plantillas · Mis alumnos · **Avances** · Catálogo |

| Vista | Contenido |
|-------|-----------|
| `catalog` | Grid + filtros + search + WOD |
| `training` | Plan personal (`trainingProgram`) |
| `recommend` | Recomendar (solo si `subscription.plan === 'premium'`) |
| `coach-plan` | Plan del coach (`coachTrainingProgram`; empty sin coach / sin plan; columna centrada ~720px) |
| `athlete-avances` | Atleta: upload (mes actual o backfill) + historial timeline + comparar |
| `coach-panel` | Resumen informativo (`coach-panel-ui`): total alumnos + sin pauta + historial invites |
| `coach-templates` | Shell placeholder |
| `students` | Mis alumnos (`students-ui` + cupo `coachQuota.canInvite` + `coach-sessions-ui` + `students-download-ui` + store) |
| `avances` | Coach: lista de alumnos → abrir fotos de progreso |
| `progress-photos` | Coach: timeline + comparar fotos de un alumno (lightbox) |
| `session-editor` | Editor de una sesión del atleta (coach) |
| `profile` | Mi perfil (foto, editar inline, darse de baja; resto “Pronto”) |

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
- `GET /exercises/recommend?zone=&equipment=&locale=` (auth).
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
- **Invitar** se deshabilita si `GET /users/me` → `coachQuota.canInvite === false` (tooltip con mensaje de cuota). Al entrar a Mis alumnos se refresca `/me`.
- Modal email → `POST /users/coach/invites` (atleta puede no existir aún; pending 24h). Errores por `code` (`EMAIL_NOT_AN_ATHLETE`, `ATHLETE_HAS_PENDING_INVITE`, cuota). Dos acciones: **Enviar** o **Enviar + copiar WhatsApp**.
- Orden: client-side sobre alumnos **ya cargados** (incluye “Cargar más”); re-click de la opción activa quita el orden.
- Badge **Nuevo**: invites `accepted` con `respondedAt` ≤ 48h (vía `GET /users/coach/invites`); al abrir la fila se guarda como visto en `localStorage` y no vuelve a marcarse (ni al recargar / re-login).
- Descargar: toolbar **Todos · Excel** / **Todos · PDF**; por alumno ⏬ → Excel / PDF.
  - `POST /users/coach/training-program/export` binary (`athleteIds: []` = todos; `[id]` = uno) + `locale` + `format` (`xlsx` \| `pdf`).
  - Varios alumnos → ZIP. Layout: sesiones en un archivo, bloques por categoría, total de series.
- Loading spinner al primer fetch; empty / sin resultados sin flash raro.
- Lista → `GET /users/coach/athletes` (paginado 5 + Cargar más); cache en memoria.
- Acordeón alumno → info + plan; **Agregar sesión** (modal nombre, local).
- Sub-acordeón sesión → mini-cards (thumb, nombre, pauta) + Editar sesión.
- Vista `session-editor`: cards, Editar / ✕, Agregar ejercicios; modal confirmar quitar sesión.
- Catálogo en modo asignar: banner + “Agregar a la sesión” + lápiz pauta (local); guardar vuelve al editor.
- Sesiones en `athlete.coachTrainingProgram`; **Guardar plan** → `PUT /users/coach/athletes/:id/training-program` (replace; respuesta enriquecida).
- Fila alumno: botón **Avances** → `progress-photos` (return a Mis alumnos).

---

## 10. Avances / fotos de progreso

Historial y comparar viven en el módulo compartido `progress-history-ui.js` (coach + atleta).

### Coach
- Nav **Avances** (`avances-ui`): lista paginada de alumnos → abre `progress-photos`.
- Vista `progress-photos` (`progress-photos-ui`): back a Avances o Mis alumnos; card alumno (nombre, correo, peso actual — en comparar, chip compacto).
- Timeline cronológico (meses con foto/peso, más reciente arriba); cards usan thumb Cloudinary (`c_fit,w_480,h_640,q_auto,f_auto`); lightbox/descarga usan la URL original de Mongo.
- **Comparar**: elegir ≥2 meses → **2 meses** lado a lado con tabs Frente/Espalda; **3+** doble carrusel (wrap). Δ peso entre el más viejo y el más nuevo.
- `GET /users/:userId/progress-photos` → `{ currentWeightKg, years[] }` (un fetch; sin paginación de API).

### Atleta
- Nav **Avances** (`athlete-avances-ui`): header fijo (título + hint del mes seleccionado + peso actual); scroll del cuerpo.
- Upload: pickers `+` con preview, peso (20–400); debajo del peso, caption “Mes actual · cambiar” (o el mes elegido) abre month-picker para backfill.
- Guardar enabled solo con ≥1 foto + peso; `POST /users/me/progress-photos` multipart (`weightKg` + `front`/`back` + `yearMonth` opcional).
- Historial: mismo timeline + comparar que el coach (vía `progress-history-ui`).
- Re-subir el mismo mes **reemplaza** (upsert); no hay UI de delete (API DELETE existe).

### Lightbox compartido (`progress-photo-lightbox.js`)
- Click en foto → modal con **URL original** (calidad completa); **Descargar** fetch→blob → `FirstName_LastName_Front|Back[_YYYY-MM].ext`.
- En comparar: flechas / teclado recorren la galería del mismo lado (Frente↔Frente u Espalda↔Espalda).
- Thumbs FE: `js/utils/cloudinary.js` (`progressPhotoThumbUrl`) — solo en cards; Mongo/BE sin cambios.

---

## 11. Invite atleta (pending)

- Colección `invites` en BE; **no** vive en el documento User ni en `GET /users/me`.
- `GET /users/me/pending-coach-invite` → siempre `{ invite: null | { coachId, invitedAt, coach } }` (máx. 1 pendiente).
- FE (`coach-invite-ui.js`): carga junto a cada `/users/me` (`restoreSession` / `refreshUser` vía `onUserSynced`), y de nuevo al volver a la pestaña (`visibilitychange`). No re-fetch al navegar.
- Banner + dot en Plan del coach → accept / reject `POST /users/me/pending-coach-invite/respond`.
- Si accept falla por cupo del coach (`COACH_ATHLETE_QUOTA_FULL`): se oculta el copy/botones del invite y el banner muestra solo el mensaje localizado ~4s.
- Errores de invite/respond: preferir `err.code` → `mapApiError` / copy en `js/i18n/` (ES/EN).

---

## 12. Tema e idioma

| Preferencia | Key | Valores |
|-------------|-----|---------|
| Tema | `FLEX_THEME` | `light` \| `dark` |
| Idioma | `FLEX_LANG` | `es` (default) \| `en` |

- Toggle tema: emoji + clase `theme-animating` ~280ms.
- Toggle idioma: re-pinta chrome, filtros, grids, modal abierto.

---

## 13. API — mapa completo

| Método | Path | Auth | Cuándo |
|--------|------|------|--------|
| GET | `/exercises/labels` | No | Boot |
| GET | `/exercises?…` | No | Catálogo / filtros / search / páginas |
| GET | `/exercises/:id` | No | Modal, search numérico, deep link |
| GET | `/exercises/random` | No | WOD |
| GET | `/exercises/recommend?zone&equipment&locale` | Sí | Submit recommend |
| POST | `/auth/login` | No | Login |
| POST | `/auth/register` | No | Register |
| GET | `/users/me` | Sí | Sesión (user + programs + `subscription` + `coach` + `coachQuota` + `currentWeightKg`; **sin** invite ni `progressPhotos`) |
| GET | `/users/me/pending-coach-invite` | Sí | Atleta: `{ invite }` (null o pendiente) |
| POST | `/users/training-program` | Sí | Agregar al plan |
| PUT | `/users/training-program/remove` | Sí | Confirmar quitar |
| PUT | `/users/training-program/:exerciseId` | Sí | Guardar pauta |
| POST | `/users/me/progress-photos` | Sí | Atleta: upload avance (multipart weight + fotos + `yearMonth?`) |
| GET | `/users/:userId/progress-photos` | Sí | Atleta self o coach asignado: historial |
| POST | `/users/coach/invites` | Sí | Coach invita atleta por email |
| POST | `/users/me/pending-coach-invite/respond` | Sí | Atleta accept / reject |
| GET | `/users/coach/athletes` | Sí | Lista paginada Mis alumnos / stats Panel |
| GET | `/users/coach/invites` | Sí | Historial invites coach (`status` opcional) |
| PUT | `/users/coach/athletes/:athleteId/training-program` | Sí | Guardar plan (replace sesiones) |
| POST | `/users/coach/training-program/export` | Sí | Export Excel/PDF/zip (binary; body `format`) |

> BE también expone `DELETE /users/me/progress-photos` (sin UI FE aún).

---

## 14. Animaciones y microinteracciones

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

| Hint Avances pulse | Vista atleta Avances |

`prefers-reduced-motion: reduce` apaga o simplifica casi todo lo anterior.

---

## 15. Utils

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

## 16. Storage

| Key | Dónde | Contenido |
|-----|-------|-----------|
| `FLEX_TOKEN` | localStorage | JWT |
| `FLEX_THEME` | localStorage | light/dark |
| `FLEX_LANG` | localStorage | es/en |
| `mister-l-flexes` | sessionStorage | contador del 💪 del footer |

---

## 17. Mobile (≤768px)

- Topbar + hamburger; sidebar drawer off-canvas.
- Cierre: ✕, backdrop, item de nav, Escape, resize a desktop.
- Filtros colapsados; chips con scroll horizontal.
- Results bar arriba del main.
- Modal ejercicio = bottom sheet (~92dvh).
- Grid más denso (y otra vez a ≤480px).

---

## 18. Mapa de archivos

| Área | Archivos |
|------|----------|
| Entry / catálogo / modal / pauta | `js/main.js` |
| Sesión / vistas / roles | `js/features/session-ui.js` |
| Mi perfil | `js/features/profile-ui.js` |
| Auth UI | `js/features/auth-ui.js` |
| Entrenamiento | `js/features/training-ui.js` |
| Recommend | `js/features/recommend-ui.js` |
| Coach Panel | `js/features/coach-panel-ui.js` |
| Coach invite banner | `js/features/coach-invite-ui.js` |
| Students | `js/features/students-ui.js` |
| Students download | `js/features/students-download-ui.js` |
| Coach sessions / editor | `js/features/coach-sessions-ui.js` |
| Athletes store | `js/features/coach-athletes-store.js` |
| Avances coach (lista) | `js/features/avances-ui.js` |
| Progress photos coach | `js/features/progress-photos-ui.js` |
| Historial/comparar (shared) | `js/features/progress-history-ui.js` |
| Avances atleta | `js/features/athlete-avances-ui.js` |
| Lightbox + download | `js/features/progress-photo-lightbox.js` |
| Drawer | `js/features/nav-drawer.js` |
| Tema | `theme-boot.js`, `theme-ui.js` |
| Footer / eggs | `footer.js`, `easter-egg.js` |
| API | `js/api/request.js` (`postMultipart`, `err.code`), `auth.js`, `users.js`, `exercises.js`, `token.js` |
| Copy / i18n errors | `js/i18n/`, `js/utils/api-errors.js`, `js/utils/auth-errors.js` |
| Estilos | `public/css/base.css`, `app.css` |

---

## 19. Stubs / aún no cableado

- Plantillas (`coach-templates`) placeholder.
- Admin no se elige en register (solo DB); en nav se comporta como coach.
- Sin refresh token; si `/me` falla, sesión guest.
- Recommend exige `subscription.plan === 'premium'` del back (athletes).
- Coach tiers (`growth` / `pro`) e invite quotas: ver `coachQuota` en `/me`.
- Delete de progress photos: API lista, sin botón en FE.
- Pauta nutricional (coach → atleta): pendiente; ver [TODO.md](./TODO.md).

---

## Ver también

- [TODO.md](./TODO.md) — pendientes (FE + BE)
