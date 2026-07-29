# Plan: Perfil de entrenamiento (“Mi plan”)

Documento vivo para implementar de a poco. Hoy el botón **DB Setup** del sidebar es un placeholder técnico; a futuro se convierte en la entrada al **login / perfil del alumno**, con los ejercicios que le asignó un profesor.

El catálogo global (~1.324 ejercicios) **no se reemplaza**: sigue siendo la librería. Lo nuevo es una capa de **asignaciones por usuario**.

---

## Visión

| Hoy | Mañana |
|-----|--------|
| Catálogo público de ejercicios | Igual |
| Botón → `setup.html` (docs de DB) | Botón → **Mi plan** / login |
| Sin usuarios | Cada alumno ve su plan personalizado |
| — | El profe asigna ejercicios desde el catálogo |

Flujo objetivo:

```
[Sidebar: Mi plan]
        ↓
   ¿hay sesión? ── no → Login
        ↓ sí
   Perfil de entrenamiento
   + lista de ejercicios asignados por el profe
```

---

## Principio de diseño

- **No duplicar** ejercicios en el perfil.
- Guardar solo la **referencia** (`exerciseId`) al catálogo + la pauta (series, reps, notas, etc.).
- Así se reutilizan GIF, músculos, instrucciones ES/EN y el resto de la data que ya existe.

Dos mundos en la app:

1. **Catálogo** — lo actual (`GET /exercises`, filtros, WOD, etc.)
2. **Perfil / plan** — privado, por usuario autenticado

---

## Modelo de datos

Colecciones / tablas sugeridas (ajustar nombres al stack del backend):

### `users`

| Campo | Notas |
|-------|--------|
| `id` | PK |
| `email` | único, login |
| `name` | display |
| `role` | `"athlete"` \| `"coach"` (o `"admin"`) |
| `createdAt` | |

### `programs` (plan del alumno)

| Campo | Notas |
|-------|--------|
| `id` | PK |
| `athleteId` | → `users` |
| `coachId` | → `users` (quién lo armó) |
| `title` | ej. “Bloque fuerza — mes 1” |
| `notes` | mensaje / indicaciones del profe |
| `active` | boolean (un plan activo por alumno al MVP) |
| `updatedAt` | |

### `program_exercises`

| Campo | Notas |
|-------|--------|
| `id` | PK |
| `programId` | → `programs` |
| `exerciseId` | → catálogo existente (mismo id que `/exercises/:id`) |
| `order` | orden en la lista |
| `sets` | opcional |
| `reps` | opcional (string o number; a veces “8-12”) |
| `rest` | opcional (segundos o texto) |
| `notes` | nota por ejercicio |
| `day` / `week` | opcional (si después agrupamos por día) |

**Mongo (alternativa al inicio):** un documento `programs` con un array embebido de ejercicios asignados. Cuando crezca, normalizar a `program_exercises`.

---

## Auth

Opciones razonables (de más simple a más “producto”):

| Opción | Cuándo usarla |
|--------|----------------|
| Email + password / JWT | MVP clásico con tu API en Render |
| Magic link / OTP por email | Sin passwords |
| Google OAuth | Si el público ya usa Google |
| Código + PIN | Solo prototipo entre amigos (poco seguro) |

**Recomendación MVP:** login email + **JWT** en header `Authorization: Bearer …`.

Front (Vercel) + API (Render): JWT evita pelear con cookies cross-site. Guardar el token en `localStorage` o `sessionStorage` al principio; migrar a httpOnly cookie más adelante si hace falta.

---

## API (backend)

Encima de lo que ya existe. El catálogo público **no cambia**.

### Auth / sesión

| Método | Path | Uso |
|--------|------|-----|
| `POST` | `/auth/login` | Credenciales → token |
| `POST` | `/auth/register` | Opcional al inicio |
| `GET` | `/me` | Usuario actual (requiere token) |

### Plan del alumno

| Método | Path | Uso |
|--------|------|-----|
| `GET` | `/me/program` | Plan activo + ejercicios (populate desde catálogo) |
| `GET` | `/me/program/exercises` | Alternativa: solo la lista plana |

### Coach / admin (fase posterior)

| Método | Path | Uso |
|--------|------|-----|
| `POST` | `/programs` | Crear plan para un athlete |
| `PATCH` | `/programs/:id` | Notas, título, active |
| `POST` | `/programs/:id/exercises` | Asignar ejercicio |
| `PATCH` | `/programs/:id/exercises/:itemId` | sets/reps/orden |
| `DELETE` | `/programs/:id/exercises/:itemId` | Quitar del plan |

**Respuesta ejemplo** `GET /me/program`:

```json
{
  "id": "prog_1",
  "title": "Bloque fuerza — mes 1",
  "notes": "3 días esta semana. Sin ego en el press.",
  "coach": { "name": "Profe X" },
  "exercises": [
    {
      "assignmentId": "ae_1",
      "order": 1,
      "sets": 3,
      "reps": "8-10",
      "rest": 90,
      "notes": "Controlar la bajada",
      "exercise": {
        "id": "0001",
        "name": "...",
        "category": "...",
        "image": "images/...",
        "gif_url": "videos/..."
      }
    }
  ]
}
```

CORS: permitir el origen del front en Vercel y enviar/recibir el header `Authorization`.

---

## Frontend (este repo)

### UI

1. Renombrar / reactivar el CTA del sidebar: **Mi plan** (hoy: DB Setup `is-disabled`).
2. Sin sesión → pantalla o modal de **login**.
3. Con sesión → **perfil de entrenamiento**:
   - Nombre del alumno
   - Título / notas del profe
   - Lista de ejercicios asignados (mismas cards / modal que el catálogo, más sets/reps/notas)
4. El catálogo en home **sigue igual**; el plan es vista aparte (o filtro “Solo mi plan” más adelante).

### Archivos previstos (orientativo)

```
js/
├── api/
│   ├── exercises.js      # ya existe
│   ├── auth.js           # login, me, token helpers
│   └── programs.js       # GET /me/program
├── features/
│   ├── profile.js        # render del perfil / plan
│   └── auth-ui.js        # login form, logout
profile.html              # opcional; o panel dentro de index.html
```

### `setup.html`

No borrar de golpe: es documentación de DB. Mover a otra ruta, dejarlo solo en local, o sacarlo del CTA del sidebar. El botón de producción apunta a **Mi plan**, no a setup.

---

## Fases de implementación

Hacer **una fase a la vez**. No mezclar auth + UI + panel coach en el mismo PR.

### Fase 0 — Preparación (front, sin backend real)

- [ ] Definir copy del botón: “Mi plan” / icono
- [ ] Quitar `is-disabled` cuando haya algo que mostrar (aunque sea mock)
- [ ] Decidir: ¿`profile.html` o panel en `index.html`?

### Fase 1 — Contrato de datos + mock

- [ ] Acordar schema (`users`, `programs`, `program_exercises`)
- [ ] Seed / mock de un plan de ejemplo
- [ ] Endpoint (o JSON estático) que devuelva la forma de `GET /me/program`
- [ ] Front: pantalla de perfil leyendo ese mock **sin login**

### Fase 2 — UI del perfil

- [ ] Layout del perfil (header + notas del profe + lista)
- [ ] Reusar cards / modal del catálogo para cada `exercise`
- [ ] Mostrar sets / reps / rest / notes de la asignación
- [ ] Empty state: “Todavía no tenés ejercicios asignados”

### Fase 3 — Auth real

- [ ] `POST /auth/login` + JWT en la API
- [ ] `js/api/auth.js` + guardar token
- [ ] Proteger `GET /me` y `GET /me/program`
- [ ] Redirect a login si 401
- [ ] Logout en el UI

### Fase 4 — Backend de verdad + assignaciones

- [ ] Colecciones en la BD de producción
- [ ] Populate `exerciseId` → documento del catálogo
- [ ] Al menos un athlete + un program seedados a mano (script o Compass/SQL)

### Fase 5 — Herramientas del profe

- [ ] Endpoints CRUD de program exercises
- [ ] UI admin mínima **o** script/CLI para asignar (válido al inicio)
- [ ] Después: panel coach en la web

### Fase 6 — Pulido

- [ ] “Solo mi plan” como filtro en el grid (opcional)
- [ ] Recordar sesión, errores de red, loading states
- [ ] i18n ES/EN en textos del perfil
- [ ] Revisar CORS y Deployment Protection si aplica

---

## Decisiones abiertas

Anotar acá cuando se resuelvan:

| Tema | Opciones | Decisión |
|------|----------|----------|
| BD | Mongo vs SQL (la del backend actual) | _pendiente_ |
| Auth | JWT email vs OAuth vs OTP | _pendiente_ |
| Vista perfil | `profile.html` vs panel en `index` | _pendiente_ |
| Roles | solo athlete al inicio vs coach en UI | _pendiente_ |
| Un plan activo vs historial de programas | MVP: uno activo | sugerido |

---

## Fuera de alcance (por ahora)

- Pagos / suscripciones
- Tracking de series completadas / historial de workouts
- Chat profe–alumno
- App nativa
- Reemplazar el catálogo público

Se pueden sumar después sin romper este modelo (`exerciseId` + asignaciones).

---

## Relación con el repo actual

- Front: [README.md](../README.md) (o raíz del repo)
- API producción (catálogo): `https://gym-data-8d3l.onrender.com`
- Deploy front: Vercel (`outputDirectory: "."` en `vercel.json`)

Este plan vive en el front como guía de producto; la mayor parte del trabajo de **Fases 1, 3, 4 y 5** ocurre en el **backend**. El front consume y presenta.

---

## Próximo paso sugerido

Cuando retomen: **Fase 1** — fijar el schema según la BD real del backend y exponer un `GET /me/program` mockeado (aunque sea hardcodeado) para poder armar la UI del perfil sin esperar auth completo.
