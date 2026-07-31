# Plan: Perfil de entrenamiento (“Mi plan”)

Documento vivo para implementar de a poco.

El catálogo global (~1.324 ejercicios) **no se reemplaza**: es la librería pública, servida por la API (`GET /exercises…`). Encima hay una capa de **asignaciones por usuario** (`trainingProgram` en `/users/me`).

> **Nota histórica:** el CTA del sidebar era un placeholder “DB Setup” hacia `setup.html`. Eso ya no existe: el botón es **Mi plan**, y la página de setup de DB se eliminó del front (el catálogo vive en la BD detrás de la API).

---

## Visión de hoy

Cada usuario, al entrar a su cuenta, ve **su plan personalizado** (“Mi entrenamiento”): los ejercicios que tiene asignados (hoy puede armarlos él desde el catálogo; a futuro también los que le asigne un profesor), con pauta opcional (series / reps / rest / notes).

La nav depende del **rol** (`athlete` | `coach` | `admin`):

| Rol | Nav típica |
|-----|------------|
| Atleta | Mi plan → Entrenamiento, Recomendar (Pro), Plan del coach · Catálogo |
| Coach / Admin | Mis alumnos · Catálogo |

| Público | Autenticado |
|---------|-------------|
| Explora el **catálogo** (API) | Misma librería + **su** `trainingProgram` |
| CTA **Mi plan** → login / registro | Vistas según rol + Catálogo |
| — | Nombre + badge de rol + Salir; plan privado por user |

Flujo atleta:

```
[Sidebar: Mi plan / Entrenamiento]
        ↓
   ¿hay sesión? ── no → modal login / registro
        ↓ sí
   GET /users/me → trainingProgram[]
   Vista “Mi entrenamiento” (filtros locales sobre el plan)
   Modal: agregar / quitar / editar pauta (lápiz)
   Catálogo sigue disponible como librería
```

---

## Principio de diseño

- **No duplicar** ejercicios: solo `exerciseId` (+ pauta opcional).
- Populate del ejercicio desde el catálogo (`image`, `gif_url`, `name`, etc.).
- Mundos en la UI:
  1. **Catálogo** — `GET /exercises` (paginado, filtros, WOD)
  2. **Mi entrenamiento** — plan privado del user autenticado
  3. **Recomendar** — `GET /exercises/recommend` (gate `isPremium`)
  4. **Mis alumnos** (coach) — shell; API de vínculo pendiente
- Preferencias de UI (tema / idioma): **local** (`localStorage`), no en el user de la API (por ahora).

---

## Modelo (como quedó)

### Usuario (`GET /users/me`)

| Campo | Notas |
|-------|--------|
| `id` | UUID del user |
| `email` | login |
| `name` / `lastName` | display (sidebar) |
| `role` | `athlete` \| `coach` \| `admin` |
| `isPremium` | gate de Recomendar |
| `coachId` | opcional (atleta vinculado a un coach) |
| `trainingProgram[]` | plan self-serve |
| `coachTrainingProgram[]` | plan asignado por coach (futuro UI) |

### Ítem de `trainingProgram`

| Campo | Notas |
|-------|--------|
| `exerciseId` | id del catálogo (`"0001"`, …) |
| `exercise` | populate (id, name, image, gif_url, category, equipment, …) |
| `order` | opcional |
| `sets` | number opcional |
| `reps` | string (`"6"` o `"8 - 12"`) |
| `rest` | number en **segundos** |
| `notes` | string opcional |

Un ítem puede ser solo `{ exerciseId }` → UI muestra “Sin pauta asignada”.

---

## Auth (hecho)

| Método | Path | Uso |
|--------|------|-----|
| `POST` | `/auth/login` | → `{ accessToken, user }` |
| `POST` | `/auth/register` | body incluye `role: athlete \| coach` |
| `GET` | `/users/me` | Bearer → user + planes enriquecidos |

- Token en `localStorage` (`FLEX_TOKEN`).
- Client: `Authorization: Bearer …` cuando `{ auth: true }`.

---

## API de plan (hecho)

User id viene del **JWT** (no va en el path).

| Método | Path | Body | Uso |
|--------|------|------|-----|
| `POST` | `/users/training-program` | `{ exerciseIds: string[] }` | Agrega solo ids **nuevos** (al inicio; skip duplicados) |
| `PUT` | `/users/training-program/remove` | `{ exerciseId: string }` | Quita un ejercicio |
| `PUT` | `/users/training-program/:exerciseId` | `{ sets?, reps?, rest?, notes? }` | Edita pauta de un ítem |

Responden con el user enriquecido (el front hace `setUser` sin otro `/me` obligatorio).

---

## Frontend — hecho

### Sesión / navegación

- [x] CTA **Mi plan** → login si no hay sesión (ya no hay “DB Setup”)
- [x] Nav por **rol** + badge (Atleta / Entrenador / Admin)
- [x] Register: toggle Atleta / Entrenador
- [x] Nombre + **Salir**; restaurar sesión al boot con `/users/me`

### Mi entrenamiento

- [x] Vista propia (`#training-view`) con cards distintas al catálogo
- [x] RX: emoji + valor en columna con línea izquierda; nota clamp 2 líneas
- [x] Filtros + search **en memoria** sobre el plan
- [x] Empty state + CTA a catálogo
- [x] Hover GIF + modal de detalle
- [x] Flash de card tras guardar pauta y cerrar modal

### Pauta (self-serve)

- [x] Lápiz junto a Quitar del plan → form sets / reps / rest / notes
- [x] Resumen chips + nota; animación open/close del form; pop al guardar
- [x] Validación reps (`js/utils/reps.js`: `cleanReps` / `formatReps`)

### Modal

- [x] Copiar enlace (`?exercise=`) + deep link (`js/utils/url.js`)
- [x] Agregar / quitar del plan + undo corto
- [x] Enter modal notorio (fade + scale/slide; sheet en mobile)

### Recomendar / Coach shell

- [x] Módulo Recomendar (zona + equipo; Pro)
- [x] Mis alumnos: toolbar + empty state + modal email (API pendiente)

### Catálogo / tema / chrome

- [x] Idioma default ES; tema claro/oscuro persistido
- [x] Filtros, loading, cards, shimmer, etc. (ver historial de commits)

### Código relevante

```
js/api/auth.js, token.js, users.js, client.js, exercises.js
js/features/auth-ui.js, session-ui.js, training-ui.js, theme-ui.js
js/features/recommend-ui.js, students-ui.js, nav-drawer.js, footer.js
js/utils/reps.js, url.js, cards.js, helpers.js, labels.js, prefs.js
js/main.js
public/css/base.css, app.css
docs/TODO.md
```

---

## Checklist — pendiente

### Producto / UX del plan

- [ ] Mostrar plan del coach (`coachTrainingProgram`) en UI atleta
- [ ] Agrupar por día / semana o sesiones
- [ ] Quitar desde catálogo (hoy solo “En tu plan”)
- [ ] Confirmación más clara al agregar desde catálogo / recommend

### Modal / sesión de gym

- [ ] Checklist interactiva de pasos
- [ ] GIF / media del modal más dominante
- [ ] Timer de descanso usando `rest`
- [ ] Marcar series hechas en sesión

### Coach / admin

- [ ] API + UI: vincular atleta (email exacto / invite)
- [ ] Lista alumnos (acordeón) + detalle / editar plan asignado
- [ ] Plan por bloques o sesiones

### Auth / plataforma

- [ ] Migrar token a cookie httpOnly (opcional)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API — solo si hace falta cross-device

### Nice-to-have

- [ ] Favoritos separados del plan
- [ ] Deep link más corto (`#0001` canonical)
- [ ] Tracking de workouts / progreso
- [x] Persistir idioma preferido (`FLEX_LANG`; default ES)

---

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Vista perfil | Panel en `index.html` (no `profile.html`) |
| Plan en API | Embebido en `/users/me` como `trainingProgram` |
| Auth MVP | Email + password + JWT en `localStorage` |
| Roles | `athlete` / `coach` en register; `admin` solo DB |
| Agregar al plan | `POST /users/training-program` con **solo ids nuevos** |
| Quitar | `PUT .../remove` con `exerciseId` |
| Editar pauta | `PUT .../training-program/:exerciseId` |
| Rest | Segundos en BD y UI |
| Reps | String: número simple o rango `A - B` |
| Undo quitar | Optimista en front; API al confirmar |
| Setup DB en el FE | Eliminado |
| Tema / lang | Preferencias locales |
| Deploy | `main` = prod (Vercel); `develop` = preview |

---

## Fuera de alcance (por ahora)

- Pagos / suscripciones
- Chat profe–alumno
- App nativa
- Reemplazar el catálogo público
- Guardar hojas CSS en la API

---

## Relación con el repo

- Front: [README.md](../README.md)
- FE TODO: [TODO.md](./TODO.md)
- Inventario de capacidades: [FRONTEND-CAPACIDADES.md](./FRONTEND-CAPACIDADES.md)
- API: `https://gym-data-8d3l.onrender.com` (prod) / `localhost:3000`
- Deploy front: Vercel
  - **`main`** → link estable (compartir)
  - **`develop`** → preview (laburar); merge a `main` cuando esté listo

---

## Próximo paso sugerido

1. **Coach:** cablear Unir atleta (API email exacto / invite) + lista de alumnos.  
2. O **Plan del coach** visible para el atleta.  
3. O polish de sesión (timer `rest` / checklist de pasos).
