# ExerciseDB — Frontend

Frontend estático para explorar una librería de **~1.324 ejercicios** de fitness (catálogo desde la API/BD): filtros, búsqueda, infinite scroll, detalle con GIF e instrucciones bilingües (ES/EN).

Con sesión: **Mi plan** → vista **Mi entrenamiento** con el `trainingProgram` del usuario.

Consume la API desplegada en Render (o tu backend local).

**API producción:** [https://gym-data-8d3l.onrender.com](https://gym-data-8d3l.onrender.com)

---

## Features

- Catálogo paginado con **infinite scroll** (datos vía API)
- Filtros por **categoría**, **equipamiento** y **músculo objetivo**
- Búsqueda por texto y por **ID** (`GET /exercises/:id`)
- Modal de detalle: meta, músculos, instrucciones ES/EN, compartir enlace
- Botón **WOD** → ejercicio random (`GET /exercises/random`)
- Auth (login / registro) + roles atleta / coach
- **Mi entrenamiento** (agregar / quitar / pauta) y **Plan del coach** (sesiones)
- Coach: **Panel** (métricas), **Mis alumnos** (invitar, ordenar, editar plan, export Excel)
- Banner de invite pendiente (atleta) vía `GET /users/me/pending-coach-invite`
- UI bilingüe (Español / English)
- Media local (`public/images`, `public/videos`)

---

## Stack

- HTML + CSS + **JavaScript ES modules** (sin bundler)
- Fetch API
- Sirve con cualquier static server (Live Server, `npx serve`, etc.)

---

## Estructura

```
gym-data-fe/
├── index.html              # App principal
├── js/
│   ├── main.js             # Catálogo, modal, plan
│   ├── constants.js
│   ├── api/                # request, auth, users, exercises, token
│   ├── features/           # auth, session, training, students, panel, invite…
│   └── utils/              # assets, cards, helpers, labels
├── public/
│   ├── css/                # base.css, app.css
│   ├── images/
│   └── videos/
└── docs/
    ├── FRONTEND-CAPACIDADES.md   # qué hace el FE hoy
    └── TODO.md                   # pendientes
```

---

## Cómo correrlo

1. Cloná el repo.
2. Abrí la carpeta con un servidor estático (necesario por ES modules):

```bash
npx serve .
# o Live Server en VS Code / Cursor apuntando a index.html
```

3. Abrí la URL que te muestre (ej. `http://localhost:3000` del static server — **no confundir** con el puerto de la API).

### API local vs producción

En `js/api/request.js` (base URL):

| Dónde abrís el front        | API usada                                      |
|----------------------------|-------------------------------------------------|
| `localhost` / `127.0.0.1`  | `http://localhost:3000`                         |
| Otro host (deploy, etc.)   | `https://gym-data-8d3l.onrender.com`            |

Para desarrollar contra tu API local, levantá el backend en el puerto **3000** y abrí el front también en localhost.

> **CORS:** el backend debe permitir el origen del front. En producción, incluí el dominio donde alojes este FE.

---

## Endpoints que usa el front

| Método | Path | Uso |
|--------|------|-----|
| `GET` | `/exercises?page=&limit=&category=&equipment=&target=` | Lista paginada + filtros |
| `GET` | `/exercises/:id` | Detalle / búsqueda por id |
| `GET` | `/exercises/random` | Botón WOD |
| `GET` | `/exercises/labels` | Chips de filtros |
| `GET` | `/exercises/recommend?zone=&equipment=` | Recomendar (Pro) |
| `POST` | `/auth/login` · `/auth/register` | Sesión |
| `GET` | `/users/me` | Perfil + `trainingProgram` + `coachTrainingProgram` |
| `GET` | `/users/me/pending-coach-invite` | Invite pendiente atleta `{ invite }` |
| `POST` | `/users/training-program` | Agregar ejercicios al plan |
| `PUT` | `/users/training-program/remove` | Quitar un ejercicio |
| `PUT` | `/users/training-program/:exerciseId` | Editar pauta |
| `POST` | `/users/coach/invites` | Coach invita por email |
| `POST` | `/users/coach/invites/respond` | Atleta accept / reject |
| `GET` | `/users/coach/athletes` | Mis alumnos / stats Panel |
| `PUT` | `/users/coach/athletes/:id/training-program` | Guardar plan coach |
| `POST` | `/users/coach/training-program/export` | Export Excel / zip (binary) |

Respuesta típica de listado:

```json
{
  "data": [ /* ejercicios */ ],
  "total": 1324,
  "page": 1,
  "limit": 50,
  "pages": 27
}
```

Los campos `image` y `gif_url` vienen como paths relativos (`images/...`, `videos/...`). El front los resuelve bajo `public/` con `assetUrl()`.

> En el backend, registrá `/exercises/random` y `/exercises/labels` **antes** de `/exercises/:id`.

---

## Notas

- Sin build step: editás y refrescás.
- Render puede “dormir” el servicio gratis; el primer request tras inactividad puede tardar unos segundos.
- Capacidades actuales: [`docs/FRONTEND-CAPACIDADES.md`](docs/FRONTEND-CAPACIDADES.md).
- Pendientes: [`docs/TODO.md`](docs/TODO.md).
- Maintained by **Mister L** 💪

---

## Licencia / datos

Los datos y media de ejercicios dependen de la fuente original del dataset y de tu API. Este repo es el **frontend** de exploración.
