# Plan: Perfil de entrenamiento (“Mi plan”)

Documento vivo para implementar de a poco.

El catálogo global (~1.324 ejercicios) **no se reemplaza**: es la librería pública, servida por la API (`GET /exercises…`). Encima hay una capa de **asignaciones por usuario** (`trainingProgram` en `/users/me`).

> **Nota histórica:** el CTA del sidebar era un placeholder “DB Setup” hacia `setup.html`. Eso ya no existe: el botón es **Mi plan**, y la página de setup de DB se eliminó del front (el catálogo vive en la BD detrás de la API).

---

## Visión de hoy

Cada usuario, al entrar a su cuenta, ve **su plan personalizado** (“Mi entrenamiento”): los ejercicios que tiene asignados (hoy puede armarlos él desde el catálogo; a futuro también los que le asigne un profesor), con pauta opcional (series / reps / rest / notes).

| Público | Autenticado |
|---------|-------------|
| Explora el **catálogo** (API) | Misma librería + **su** `trainingProgram` |
| CTA **Mi plan** → login / registro | Nav **Mi entrenamiento** \| **Catálogo** |
| — | Nombre + Salir; plan privado por user |

Flujo:

```
[Sidebar: Mi plan]
        ↓
   ¿hay sesión? ── no → modal login / registro
        ↓ sí
   GET /users/me → trainingProgram[]
   Vista “Mi entrenamiento” (filtros locales sobre el plan)
   Catálogo sigue disponible como librería
```

---

## Principio de diseño

- **No duplicar** ejercicios: solo `exerciseId` (+ pauta opcional).
- Populate del ejercicio desde el catálogo (`image`, `gif_url`, `name`, etc.).
- Dos mundos en la UI:
  1. **Catálogo** — `GET /exercises` (paginado, filtros, WOD) desde la BD vía API
  2. **Mi entrenamiento** — plan privado del user autenticado
- Preferencias de UI (tema / idioma): **local** (`localStorage`), no en el user de la API (por ahora).

---

## Modelo (como quedó)

### Usuario (`GET /users/me`)

| Campo | Notas |
|-------|--------|
| `id` | UUID del user |
| `email` | login |
| `firstName` / `lastName` | display |
| `role` | `athlete` (set por el back al registrar) |
| `coachId` | opcional |
| `trainingProgram[]` | plan embebido |

### Ítem de `trainingProgram`

| Campo | Notas |
|-------|--------|
| `exerciseId` | id del catálogo (`"0001"`, …) |
| `exercise` | populate (id, name, image, gif_url, category, equipment, …) |
| `order` | opcional |
| `sets` / `reps` / `rest` / `notes` | opcionales (pauta) |

Un ítem puede ser solo `{ exerciseId }` → UI muestra “Sin pauta asignada”.

---

## Auth (hecho)

| Método | Path | Uso |
|--------|------|-----|
| `POST` | `/auth/login` | → `{ accessToken, user }` |
| `POST` | `/auth/register` | → `{ accessToken, user }` (sin `role` desde el front) |
| `GET` | `/users/me` | Bearer → user + `trainingProgram` |

- Token en `localStorage` (`FLEX_TOKEN`).
- Client: `Authorization: Bearer …` cuando `{ auth: true }`.

---

## API de plan (hecho)

| Método | Path | Body | Uso |
|--------|------|------|-----|
| `PUT` | `/users/:userId/training-program` | `{ exerciseIds: string[] }` | Reemplaza la lista de ids del plan |
| `PUT` | `/users/:userId/training-program/remove` | `{ exerciseId: string }` | Quita un ejercicio |

Ambos responden con el user actualizado (el front hace `setUser` sin otro `/me`).

---

## Frontend — hecho

### Sesión / navegación

- [x] CTA **Mi plan** → login si no hay sesión (ya no hay “DB Setup”)
- [x] Con sesión: nav **Mi entrenamiento** | **Catálogo** (estado activo claro)
- [x] Nombre (`firstName` + `lastName`) + **Salir**
- [x] Restaurar sesión al boot con `/users/me`

### Mi entrenamiento

- [x] Vista propia (`#training-view`) con cards distintas al catálogo
- [x] Mostrar sets / reps / rest / notes (o “Sin pauta asignada”)
- [x] Filtros + search **en memoria** sobre el plan (sin llamar `/exercises`)
- [x] Search sin tildes (`normalizeSearch`)
- [x] Empty state si no hay ejercicios
- [x] Hover GIF + modal de detalle (mismo que catálogo)
- [x] Scroll del contenido bajo el header fijo (catálogo y plan)

### Modal

- [x] Copiar enlace (`?exercise=0001`) + deep link al abrir
- [x] **Agregar a mi plan** (logueado) / “Iniciá sesión para guardar”
- [x] En catálogo: estado **En tu plan** si ya está
- [x] En Mi entrenamiento: **Quitar del plan** + undo (~1.5s) con barra; el `remove` al back se confirma al terminar / cerrar
- [x] Entrada/salida animada (overlay fade + panel scale/slide; sheet en mobile ≤768px)

### Catálogo / boot UX

- [x] Idioma por defecto **español** (`lang=es`, chrome ES en HTML)
- [x] Filtros ocultos hasta `GET /exercises/labels` → luego reveal en cascade
- [x] Loading centrado en el grid; contador de ejercicios vacío hasta el primer response
- [x] Empty state real cuando la API responde `[]` (filtros sin match) — no spinner eterno
- [x] Cards: título reserva 2 líneas (tags alineados); tags cat filled / equip outline distintivos
- [x] Thumb: shimmer mientras carga + fade-in al estar lista (`js/utils/cards.js`)
- [x] Stagger al pintar cards; pop al activar chip; focus activo en search

### Tema claro / oscuro

- [x] Toggle **☀️/🌙 Tema** junto al lang (barra superior)
- [x] Tokens en `base.css` (`html[data-theme="light|dark"]`)
- [x] Persistencia `localStorage` (`FLEX_THEME`); boot temprano en `js/theme-boot.js` (sin flash)
- [x] Transición suave solo al togglear (clase `theme-animating`)
- [x] Contraste dark revisado (labels, chips, tags de cards)

### Código relevante

```
js/api/auth.js, token.js, users.js, client.js
js/features/auth-ui.js, session-ui.js, training-ui.js, theme-ui.js
js/theme-boot.js      # tema antes del paint
js/utils/cards.js, helpers.js (normalizeSearch)
js/main.js            # catálogo + modal + plan CTAs
public/css/base.css, app.css
```

---

## Checklist — pendiente

### Producto / UX del plan

- [ ] Editar pauta (sets / reps / rest / notes) desde el front (atleta o solo coach)
- [ ] Mostrar título / notas del programa o del coach en la vista (si el back los expone)
- [ ] Agrupar por día / semana (`day` / `week`)
- [ ] Quitar desde catálogo (hoy solo “En tu plan” disabled)
- [ ] Confirmación o feedback más claro al agregar desde catálogo

### Modal / entrenamiento

- [ ] Checklist interactiva de pasos de instrucciones (marcar mientras entrenás)
- [ ] GIF / media del modal más dominante (sin franjas vacías)
- [ ] Timer de descanso usando `rest` del assignment
- [ ] Marcar series hechas en sesión (local o persistido)

### Coach / admin

- [ ] Endpoints CRUD de asignación con pauta (sets/reps/orden) — no solo lista de ids
- [ ] UI coach para armar planes a athletes
- [ ] Seed / flujo: coach asigna → athlete ve pauta

### Auth / plataforma

- [ ] Migrar token a cookie httpOnly (opcional)
- [ ] Roles en UI (`coach` vs `athlete`)
- [ ] Historial de programas (hoy: un plan activo embebido)
- [ ] Sync tema/idioma al user en API (`user.config`) — solo si hace falta cross-device

### Nice-to-have

- [ ] Favoritos separados del plan (si hace falta distinto a “agregar al plan”)
- [ ] Deep link más corto (`#0001` unificado como canonical)
- [ ] Tracking de workouts / progreso
- [ ] Persistir idioma preferido en `localStorage` (hoy default ES; toggle en sesión)

---

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Vista perfil | Panel en `index.html` (no `profile.html`) |
| Plan en API | Embebido en `/users/me` como `trainingProgram` |
| Auth MVP | Email + password + JWT en `localStorage` |
| Nombres | `firstName` / `lastName` |
| Agregar al plan | `PUT .../training-program` con `exerciseIds[]` completo |
| Quitar | `PUT .../training-program/remove` con `exerciseId` |
| Undo quitar | Optimista en front; API remove al confirmar (timer / cerrar) |
| Setup DB en el FE | Eliminado (`setup.html` / `setup/`); catálogo solo vía API |
| Tema / lang | Preferencias locales; no CSS ni config en BD |
| Idioma default | Español |
| Deploy | `main` = prod (Vercel Production); `develop` = preview de trabajo |

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
- API: `https://gym-data-8d3l.onrender.com` (prod) / `localhost:3000`
- Deploy front: Vercel
  - **`main`** → link estable (compartir)
  - **`develop`** → preview (laburar); merge a `main` cuando esté listo (`git merge develop --no-edit`)

---

## Próximo paso sugerido

1. **Editar pauta** (sets/reps/rest) en ítems del plan — requiere contrato back (PATCH de un ítem o body más rico).  
2. O **checklist de pasos** en el modal (solo front).  
3. O arrancar **UI coach** si el producto es “profe asigna”.
