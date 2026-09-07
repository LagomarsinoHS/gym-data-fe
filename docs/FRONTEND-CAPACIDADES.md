# Inventario del frontend — qué hace hoy

> **2026-09-07.** Inventario del FE **React/Vite**. Pendiente de producto: editor create/edit de pauta (stub intencional).

Documento de referencia de **todo** lo que el FE hace actualmente (llamadas, vistas, animaciones, stubs).  
App: React 19 + TypeScript + Vite (`index.html` → `src/main.tsx`). CSS original en `public/css/`.

API: `localhost:3000` en local · develop Vercel → `gym-data-dev-aunw.onrender.com` · prod → `gym-data-8d3l.onrender.com`.

---

## 1. Boot / arranque

1. **`index.html` `<head>`** — lee `steelPulse.theme` y pone `html[data-theme]` antes del paint (sin flash).
2. Carga CSS vía `src/styles.css`: `base.css` (tokens) → `app.css` (UI) → `nutrition.css` → `progress.css` (+ Tailwind preflight).
3. **`src/main.tsx` + providers** (`AuthProvider`, `I18nProvider`, `ThemeProvider`, `CatalogProvider`):
   - Restaura sesión: token `steelPulse.token` → `GET /users/me` (+ pending invite)
   - Catálogo: `GET /exercises/labels` + primera página al entrar a `/`
   - Deep link: `?exercise=` o `#id` abre el modal
   - Footer (taglines + contador de flexes)

Si el catálogo falla → empty/error en el grid.

---

## 2. Auth

| Acción | Qué pasa |
|--------|----------|
| Login | `POST /auth/login` → guarda `steelPulse.token` → `GET /users/me` → (atleta) pending invite → vista según rol |
| Register | Form extra: nombre, apellido, rol Atleta/Entrenador → `POST /auth/register` (mismo flujo de token) |
| Logout | Menú cuenta → **Cerrar sesión** → borra token, user=null, vista catálogo, limpia recommend / cache alumnos / pending invite |
| Restaurar sesión | Al boot / post-login: Bearer + `/users/me`; si falla → guest |

- Overlay auth (`src/components/auth/auth-modal.tsx`): backdrop / Escape cierran; errores mapeados (401, 409, etc.).
- Password min 4 (perfil / cambio); autocomplete distinto login vs register.
- Tras login/register: si hay `location.state.next` interno seguro (`RoleGate` y `/perfil` lo mandan), va ahí; si no, `homePathFor` (atleta → `/entrenamiento`, coach → `/panel`, admin → `/admin`). Login desde el sidebar / `/login` sin `next` → home del rol.
- **Menú de cuenta** (`src/components/layout/user-menu.tsx`): avatar con iniciales, nombre corto, badge de rol, chevron → dropdown.
  - **Mi perfil** (`src/pages/profile-page.tsx`): header split (identidad + información personal) con **Editar** in-place → `PATCH /users/me`. Labels del grid siempre visibles; faltantes → “—”. Avatar → Ver/Subir foto. Card **Mi coach** (atleta): **Dejar coach** → `DELETE /users/me/coach`. **Darse de baja** → `DELETE /users/me`. Al entrar, `refreshUser()`.
  - **Configuración**: visible pero `disabled` (tooltip “Próximamente”).
  - **Cerrar sesión**: activo (rojo).
  - Cierra con click afuera o Escape.

---

## 3. Roles, nav y vistas

| Rol | Nav |
|-----|-----|
| **Athlete** | Mi plan → Entrenamiento, Plan del coach, **Nutrición**, **Avances**, Recomendar (Pro) · Catálogo |
| **Coach** | Panel · Plantillas · Mis alumnos · **Nutrición** · **Avances** · Catálogo |
| **Admin** | Overview · Usuarios |

| Vista | Contenido |
|-------|-----------|
| `catalog` | Grid + filtros + search + WOD |
| `training` | Plan personal (`trainingProgram`) |
| `recommend` | Recomendar (solo si `subscription.plan === 'premium'`) |
| `coach-plan` | Plan del coach (`coachTrainingProgram`; empty sin coach / sin plan; columna centrada ~720px) |
| `nutrition` | Coach: picker alumno + tabs **Perfil** \| **Pauta** (list/read/archive; create/edit pendiente) |
| `athlete-nutrition` | Atleta: pautas propias (`GET /nutrition-plans`; empty si no hay pauta; soft-delete archivadas) |
| `athlete-avances` | Atleta: upload (mes actual o backfill) + historial timeline + comparar |
| `coach-panel` | Resumen (`src/pages/coach-panel-page.tsx`): total alumnos + sin pauta + historial invites |
| `coach-templates` | Biblioteca (`src/pages/coach-templates-page.tsx` + `src/api/coach-templates.ts`): crear (`POST /coach/templates`), editar/guardar (`PUT`), aplicar 1..N ↔ 1..N (`POST /coach/templates/apply`). Toast (~3s) al aplicar; **Usar plantilla** desde Mis alumnos |
| `students` | Mis alumnos (`src/pages/students-page.tsx` + cupo `coachQuota.canInvite` + `src/lib/students-cache.ts`); carga data antes de pintar |
| `avances` | Coach: picker (`src/components/coach/athlete-picker.tsx`) → fotos de progreso |
| `progress-photos` | Coach: timeline + comparar fotos de un alumno (lightbox) |
| `session-editor` | Editor de una sesión del atleta (coach; drag para reordenar ejercicios) |
| `profile` | Mi perfil (header split, editar in-place, foto, dejar coach, darse de baja; grid de info personal siempre muestra labels con “—” si falta dato; resto “Pronto”) |
| `admin-overview` | Stats (`GET /admin/stats`) |
| `admin-users` | Listado + acordeón detalle (Cuenta / Suscripción / Rol·Plan / Coach + gestión); grant/revoke + soft-delete |

- Post-login: `state.next` si es path interno; si no, coach → `/panel`; admin → `/admin`; athlete → `/entrenamiento`.
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
Códigos en `src/lib/easter-eggs.ts` (rest day, creador, mensajes, roast con CSS especial).

### Cards catálogo
- Thumb lazy + shimmer hasta `is-media-ready` (`onLoad`); hover carga GIF.
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
- Atleta en catálogo: siempre “Agregar a mi plan” (plan personal plano). “Agregar a la sesión” solo en modo asignar del coach.

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

- Vista informativa (`src/pages/coach-panel-page.tsx`): **Total de alumnos** y **Alumnos sin pauta**.
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
- Al entrar: fetch alumnos **antes** de mostrar la lista (evita flash vacío).
- Lista → `GET /users/coach/athletes` (paginado 5 + Cargar más); cache en memoria.
- Acordeón alumno → info + plan; al expandir: **Objetivo** en pill verde a la derecha de Nombre (si el atleta tiene `goal`).
- **Agregar sesión** (modal nombre, local).
- Sub-acordeón sesión → mini-cards (thumb, nombre, pauta) + Editar sesión.
- **Reordenar**: drag & drop de la card completa.
  - Sesiones en Mis alumnos: click abre/cierra; arrastrar reordena y **autosave** (`PUT` replace).
  - Ejercicios en `session-editor`: arrastrar la card; Editar / ✕ siguen activos.
  - Tip contextual (localStorage `steelPulse.featureHints`, `src/lib/session-editor.ts`): burbuja “Arrastra para reordenar” la primera vez que hay ≥2 sesiones/ejercicios; se cierra con “Entendido” o al reordenar.
  - Si el persist falla: mensaje `athletePlanSaveFail` / `coachTemplatesSaveFail`; el reorder vuelve atrás; crear/borrar sesión no cierra el modal.
- Vista `session-editor` (`src/pages/session-editor-page.tsx`): cards, Editar / ✕, Agregar ejercicios; modal confirmar quitar sesión.
- Catálogo en modo asignar: banner + “Agregar a la sesión” + lápiz pauta (local); guardar vuelve al editor.
- Sesiones en `athlete.coachTrainingProgram`; autosave → `PUT /users/coach/athletes/:id/training-program` (replace).
- **Usar plantilla**: desde el plan del alumno → modal multi-select de plantillas con ejercicios que el alumno aún no tiene → `POST /coach/templates/apply` (`templateIds` + `athleteIds: [id]`) en un solo request; sync local con `sessions` del response.
- Fila alumno: botón **Avances** → `progress-photos` (return a Mis alumnos).

---

## 9b. Plantillas (coach)

Vista `coach-templates` (`src/pages/coach-templates-page.tsx`, API `src/api/coach-templates.ts`).

- Lista / crear / editar ejercicios / guardar → `GET|POST|PUT /coach/templates`.
- **Aplicar a alumno** (desde una plantilla): modal multi-select de alumnos que aún no la tienen → `POST /coach/templates/apply` (`templateIds: [id]`, `athleteIds`).
- Éxito → toast fijo inferior (~3s, botón ✕) con título + detalle; errores inline en status.
- Response apply: `{ applied, skipped, failedAthletes, failedTemplates, sessions }` (pares y sesiones enriquecidas).

---

## 9c. Nutrición (atleta)

Vista `athlete-nutrition` (`src/pages/nutrition-page.tsx`, API `src/api/nutrition-plans.ts`).

- Nav **Nutrición** bajo Mi plan (`/nutricion`; coach usa `/coach/nutricion`).
- `GET /nutrition-plans`: **Pauta actual** (card resumen + Ver detalle) y **Pautas anteriores** (acordeón mes · kcal · coach).
- Detalle de comidas: timeline vertical (☀️ → puntos → 🌙); cada comida muestra hora, nombre, alimentos en línea y nota fija a la derecha.
- Orden de `meals`: el array tal cual viene del API (sin sort en atleta). Convención: la UI coach ordenará por `time` al guardar.
- Archivadas: hover esquina derecha → ✕ → confirm → `DELETE /nutrition-plans/:id` (soft `deletedAt`).
- Empty si no hay pauta (sigue visible tras dejar coach; soft-delete solo quita del listado del atleta).
- Render compartido con coach: `src/components/nutrition/nutrition-plan-list.tsx`.

---

## 9d. Nutrición (coach)

Vista `nutrition` (`src/pages/coach-nutrition-page.tsx` + `coach-nutrition-profile.tsx` + `coach-nutrition-plans.tsx` + `nutrition-plan-list.tsx`).

- Lista de alumnos vía **`src/components/coach/athlete-picker.tsx`** (mismo patrón que Avances) → workspace con card de contexto.
- Tabs **Perfil** | **Pauta** (toggle tipo idioma, a la derecha de “Volver a alumnos”; `User.nutrition` vs `nutritionPlans`).
- **Volver a alumnos**: oculta workspace, muestra picker y re-renderiza la lista (no deja el picker vacío).
- **Perfil**: formulario (actividad / hábitos / prefs / restricciones) en `src/components/nutrition/coach-nutrition-profile.tsx`.
- **Pauta**: `GET /nutrition-plans?athleteId=` → pauta actual + anteriores (shared `nutrition-plan-list.tsx`); **Archivar** → `PATCH .../archive`.
- **Crear pauta**: stub del editor (próxima: form + prefill desde perfil + sort por `time` al guardar).

---

## 9e. Admin — Usuarios

Vista `admin-users` (`src/pages/admin-users-page.tsx`).

- Toolbar: search (debounce), filtros rol / plan / sort / “por vencer”, load more.
- Fila → acordeón **sin animación de altura** (evita jump de scroll); `scrollbar-gutter: stable` en la vista.
- Panel expandido (~1100px): header + **Dar de baja**; 4 cards — **Cuenta**, **Suscripción** (barra de progreso si hay fechas), **Rol/Plan** (título de rol + badge de plan), **Coach**; abajo **Datos personales** (~2/3) + **Gestión de suscripción** (~1/3: grant/revoke).
- Facts de cuenta/suscripción: label arriba, valor abajo.
- Soft-delete + grant/revoke con confirm overlay.

---

## 10. Avances / fotos de progreso

Historial y comparar viven en `src/components/progress/progress-history.tsx` (coach + atleta).

### Coach
- Nav **Avances** (`src/pages/coach-avances-page.tsx` + `athlete-picker.tsx`): lista paginada de alumnos → abre el historial.
- Vista detalles: back a Avances o Mis alumnos (`returnTo`); card alumno (nombre, correo, peso actual — en comparar, chip compacto).
- Timeline cronológico (meses con foto/peso, más reciente arriba); cards usan thumb Cloudinary (`c_fit,w_480,h_640,q_auto,f_auto`); lightbox/descarga usan la URL original de Mongo.
- **Comparar**: elegir ≥2 meses → **2 meses** lado a lado con tabs Frente/Espalda; **3+** doble carrusel (wrap). Métricas: Δ peso entre el más viejo y el más nuevo + **estatura** del perfil (`profile.heightCm`) si está cargada (coach y atleta; si no hay altura, no se muestra).
- Con **2 meses**: botón **Analizar progreso** (Growth/Pro) → `POST` análisis IA; loading + resumen en UI.
- `GET /users/:userId/progress-photos` → `{ currentWeightKg, years[] }` (un fetch; sin paginación de API).

### Atleta
- Nav **Avances** (`src/pages/avances-page.tsx`): header fijo (título + hint del mes seleccionado + peso actual); scroll del cuerpo.
- Upload: pickers `+` con preview, peso (20–400); debajo del peso, caption “Mes actual · cambiar” (o el mes elegido) abre month-picker para backfill.
- Guardar enabled solo con ≥1 foto + peso; `POST /users/me/progress-photos` multipart (`weightKg` + `front`/`back` + `yearMonth` opcional).
- Historial: mismo timeline + comparar que el coach (vía `progress-history.tsx`).
- Re-subir el mismo mes **reemplaza** (upsert); no hay UI de delete (API DELETE existe).

### Lightbox compartido (`src/components/progress/progress-photo-lightbox.tsx`)
- Click en foto → modal con **URL original** (calidad completa); **Descargar** fetch→blob → `FirstName_LastName_Front|Back[_YYYY-MM].ext`.
- En comparar: flechas / teclado recorren la galería del mismo lado (Frente↔Frente u Espalda↔Espalda).
- Thumbs FE: `src/lib/cloudinary.ts` (`progressPhotoThumbUrl`) — solo en cards; Mongo/BE sin cambios.

---

## 11. Invite atleta (pending)

- Colección `invites` en BE; **no** vive en el documento User ni en `GET /users/me`.
- `GET /users/me/pending-coach-invite` → siempre `{ invite: null | { coachId, invitedAt, coach } }` (máx. 1 pendiente).
- FE (`src/context/auth-context.tsx` + `coach-invite-banner.tsx`): carga junto a `/users/me` (boot / login / `refreshUser`), y de nuevo al volver a la pestaña (`visibilitychange`, atleta). No re-fetch al navegar.
- Banner + dot en Plan del coach → accept / reject `POST /users/me/pending-coach-invite/respond`.
- Si accept falla por cupo del coach (`COACH_ATHLETE_QUOTA_FULL` / `CoachAthleteQuotaFull`): se oculta el copy/botones y el banner muestra solo el mensaje ~4s.
- Errores de invite/respond: `err.code` → `inviteErrorKey` en `src/lib/coach-athletes.ts` + copy en `src/i18n/`.

---

## 12. Tema e idioma

| Preferencia | Key | Valores |
|-------------|-----|---------|
| Tema | `steelPulse.theme` | `light` \| `dark` |
| Idioma | `steelPulse.lang` | `es` (default) \| `en` |

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
| GET | `/users/me` | Sí | Sesión (user + programs + `subscription` + `coach` + `coachQuota` + `currentWeightKg` + `profile` + `goal`; **sin** invite ni `progressPhotos`) |
| PATCH | `/users/me` | Sí | Editar perfil (`profile` / `goal` / password) |
| POST | `/users/me/profile-photo` | Sí | Subir foto de perfil |
| DELETE | `/users/me` | Sí | Soft-delete cuenta |
| DELETE | `/users/me/coach` | Sí | Atleta: dejar coach (`coachId = null`) |
| GET | `/users/me/pending-coach-invite` | Sí | Atleta: `{ invite }` (null o pendiente) |
| POST | `/users/training-program` | Sí | Agregar al plan |
| PUT | `/users/training-program/remove` | Sí | Confirmar quitar |
| PUT | `/users/training-program/:exerciseId` | Sí | Guardar pauta |
| POST | `/users/me/progress-photos` | Sí | Atleta: upload avance (multipart weight + fotos + `yearMonth?`) |
| GET | `/users/:userId/progress-photos` | Sí | Atleta self o coach asignado: historial |
| POST | `/users/:userId/progress-photos/analyze` | Sí | Coach: analizar 2 meses (IA) |
| POST | `/users/coach/invites` | Sí | Coach invita atleta por email |
| POST | `/users/me/pending-coach-invite/respond` | Sí | Atleta accept / reject |
| GET | `/users/coach/athletes` | Sí | Lista paginada Mis alumnos / stats Panel |
| GET | `/users/coach/invites` | Sí | Historial invites coach (`status` opcional) |
| PUT | `/users/coach/athletes/:athleteId/training-program` | Sí | Guardar plan (replace sesiones) |
| POST | `/users/coach/training-program/export` | Sí | Export Excel/PDF/zip (binary; body `format`) |
| GET | `/coach/templates` | Sí | Lista plantillas del coach (enriquecidas) |
| POST | `/coach/templates` | Sí | Crear plantilla (id server-owned) |
| PUT | `/coach/templates` | Sí | Reemplazar biblioteca de plantillas |
| POST | `/coach/templates/apply` | Sí | Aplicar 1..N plantillas a 1..N alumnos (`templateIds` + `athleteIds`) |
| POST | `/nutrition-plans` | Sí | Coach: crear pauta para atleta asignado |
| GET | `/nutrition-plans` | Sí | Atleta: las suyas; coach: las que creó para `athleteId` |
| GET | `/nutrition-plans/:planId` | Sí | Atleta self o coach creador asignado |
| PUT | `/nutrition-plans/:planId` | Sí | Coach: editar pauta activa propia |
| PATCH | `/nutrition-plans/:planId/archive` | Sí | Coach: archivar pauta propia |
| DELETE | `/nutrition-plans/:planId` | Sí | Atleta: soft-delete pauta archivada propia |
| GET | `/admin/stats` | Sí | Admin overview |
| GET | `/admin/users` | Sí | Admin users (paginado + filtros) |
| DELETE | `/admin/users/:userId` | Sí | Soft-delete usuario (admin) |
| POST | `/admin/subscriptions/grant` · `/revoke` | Sí | Grant / revoke plan |

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
| Plantillas apply toast | Tras aplicar plantilla a alumnos (~3s / ✕) |

`prefers-reduced-motion: reduce` apaga o simplifica casi todo lo anterior.

---

## 15. Utils (`src/lib/`)

| Archivo | Rol |
|---------|-----|
| `prefs.ts` | tema / idioma (`steelPulse.theme` / `steelPulse.lang`) |
| `session-editor.ts` | tips one-shot (`steelPulse.featureHints`) + paths del editor |
| `url.ts` | share URL, deep link, `safeInternalPath` / post-login |
| `labels.ts` | `exerciseName`, `valueLabel` |
| `user-display.ts` | nombre, iniciales, labels de rol |
| `year-month.ts` | parse / format `YYYY-MM` |
| `reps.ts` | `cleanReps`, `formatReps` |
| `assets.ts` | `assetUrl` para media |
| `cloudinary.ts` | thumbs de progress photos |
| `auth-errors.ts` | mensajes de error de auth |
| `coach-athletes.ts` | invite errors, goal/sex, “nuevo” alumno |
| `capabilities.ts` | roles, `homePathFor`, `postLoginPath` |
| `training-sessions.ts` | serialize / match items |
| `students-cache.ts` | roster Mis alumnos en memoria |
| `nutrition-plans.ts` | sort / helpers de pautas |
| `easter-eggs.ts` | códigos del search |
| `progress-lightbox.ts` | filename de descarga |

---

## 16. Storage

| Key | Dónde | Contenido |
|-----|-------|-----------|
| `steelPulse.token` | localStorage | JWT |
| `steelPulse.theme` | localStorage | light/dark |
| `steelPulse.lang` | localStorage | es/en |
| `steelPulse.featureHints` | localStorage | tips vistos |
| `steelPulse.seenNewAthletes` | localStorage | alumnos “Nuevo” ya vistos |
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
| Entry / rutas | `src/main.tsx`, `src/App.tsx` |
| Shell / drawer / footer | `src/components/layout/*` |
| Auth / sesión | `src/context/auth-context.tsx`, `src/components/auth/auth-modal.tsx` |
| Catálogo / modal / filtros | `src/context/catalog-context.tsx`, `src/components/catalog/*` |
| Easter eggs | `src/lib/easter-eggs.ts`, `src/components/catalog/easter-egg-panel.tsx` |
| Entrenamiento | `src/pages/training-page.tsx` |
| Plan del coach | `src/pages/coach-plan-page.tsx`, `src/components/sessions/session-list.tsx` |
| Recommend | `src/pages/recommend-page.tsx` |
| Nutrición atleta | `src/pages/nutrition-page.tsx`, `src/components/nutrition/nutrition-plan-list.tsx` |
| Nutrición coach | `src/pages/coach-nutrition-page.tsx`, `coach-nutrition-profile.tsx`, `coach-nutrition-plans.tsx` |
| Avances atleta | `src/pages/avances-page.tsx` |
| Avances coach | `src/pages/coach-avances-page.tsx` |
| Historial / comparar / lightbox | `src/components/progress/*` |
| Coach panel | `src/pages/coach-panel-page.tsx` |
| Plantillas | `src/pages/coach-templates-page.tsx` |
| Mis alumnos | `src/pages/students-page.tsx` |
| Session editor | `src/pages/session-editor-page.tsx` |
| Perfil | `src/pages/profile-page.tsx` |
| Admin | `src/pages/admin-overview-page.tsx`, `admin-users-page.tsx` |
| Invite banner | `src/components/layout/coach-invite-banner.tsx` |
| API | `src/api/*` |
| Copy | `src/i18n/es.ts`, `en.ts` |
| Estilos | `public/css/base.css`, `app.css`, `nutrition.css`, `progress.css` |

---

## 19. Stubs / aún no cableado

- Admin no se elige en register (solo DB); nav propia Overview + Usuarios.
- Sin refresh token; si `/me` falla, sesión guest.
- Recommend exige plan pago válido del back (athletes premium).
- Coach tiers (`growth` / `pro`) e invite quotas: ver `coachQuota` en `/me`.
- Delete de progress photos: **descartado en BE** (re-subir el mes reemplaza); sin UI.
- Pauta nutricional coach **create/edit**: stub; list/read/archive shipped (V estable 2026-08-13). Ver [TODO.md](./TODO.md).
- Configuración (menú): deshabilitada (“Próximamente”).

---

## Ver también

- [TODO.md](./TODO.md) — pendientes (FE + BE)
