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
- Auth (login / registro) + **Mi entrenamiento** (agregar / quitar del plan)
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
│   ├── api/                # client, auth, users, exercises, token
│   ├── features/           # auth-ui, session-ui, training-ui, …
│   └── utils/              # assets, cards, helpers, labels
├── public/
│   ├── css/                # base.css, app.css
│   ├── images/
│   └── videos/
└── docs/
    └── PLAN-PERFIL-ENTRENAMIENTO.md
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

En `js/api/client.js` (base URL):

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
| `POST` | `/auth/login` · `/auth/register` | Sesión |
| `GET` | `/users/me` | Perfil + `trainingProgram` |
| `PUT` | `/users/:id/training-program` | Reemplazar ids del plan |
| `PUT` | `/users/:id/training-program/remove` | Quitar un ejercicio |

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
- Plan de producto (perfil / coach / pauta): ver [`docs/PLAN-PERFIL-ENTRENAMIENTO.md`](docs/PLAN-PERFIL-ENTRENAMIENTO.md).
- Maintained by **Mister L** 💪

---

## Licencia / datos

Los datos y media de ejercicios dependen de la fuente original del dataset y de tu API. Este repo es el **frontend** de exploración.
