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
- Auth (login / registro) + roles atleta / coach / admin
- Menú de cuenta en sidebar: iniciales/foto, nombre corto, rol; dropdown (Mi perfil activo; Configuración “Próximamente”; Cerrar sesión)
- **Mi entrenamiento**, **Plan del coach**, **Avances** (upload / backfill + timeline + comparar + analizar IA)
- Coach: **Panel**, **Plantillas**, **Mis alumnos** (ordenar, badge Nuevo, export Excel/PDF), **Avances**
- Admin: **Overview** + **Usuarios** (stats, grant/revoke, soft-delete)
- Banner de invite pendiente (atleta) vía `GET /users/me/pending-coach-invite`
- Planes: athlete `free`/`premium`; coach `free`/`growth`/`pro` + `coachQuota` en `/me`
- UI bilingüe (Español / English)
- Media local (`public/images`, `public/videos`); fotos de progreso/perfil vía Cloudinary

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
│   ├── constants.js        # constantes no-i18n (ej. EQUIP_INITIAL)
│   ├── i18n/               # copy EN/ES por dominio (common, auth, athlete, coach)
│   ├── api/                # request, auth, users, exercises, token, coach-templates, admin
│   ├── features/           # auth, session, training, students, panel, invite, templates, avances, profile, admin…
│   └── utils/              # assets, cards, helpers, labels, dates, api-errors
├── public/
│   ├── css/                # base.css, app.css
│   ├── images/
│   └── videos/
├── PRODUCT.md              # visión de producto
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

En `js/api/request.js` (`resolveApiBase`):

| Dónde abrís el front | API usada |
|----------------------|-----------|
| `localhost` / `127.0.0.1` | `http://localhost:3000` |
| Preview develop en Vercel (`steelpulse-git-develop-…`) | `https://gym-data-dev-aunw.onrender.com` |
| Otro host (prod) | `https://gym-data-8d3l.onrender.com` |

Para desarrollar contra tu API local, levantá el backend en el puerto **3000** y abrí el front también en localhost.

> **CORS:** el backend debe permitir el origen del front. En producción, incluí el dominio donde alojes este FE.

---

## Endpoints que usa el front

Catálogo completo y shapes: BE [`docs/API-ENDPOINTS.md`](../gym-data-be/docs/API-ENDPOINTS.md) (si clonás ambos repos) o Swagger del API. Resumen:

| Método | Path | Uso |
|--------|------|-----|
| `GET` | `/exercises?…` · `/:id` · `/random` · `/labels` · `/recommend` | Catálogo / WOD / recommend IA |
| `POST` | `/auth/login` · `/auth/register` | Sesión |
| `GET`/`PATCH`/`DELETE` | `/users/me` | Perfil / editar / baja |
| `POST` | `/users/me/profile-photo` | Foto de perfil (multipart) |
| `GET`/`POST` | `/users/me/pending-coach-invite` · `…/respond` | Invite atleta |
| `POST`/`PUT` | `/users/training-program` · `…/remove` · `…/:exerciseId` | Plan personal |
| `POST` | `/users/me/progress-photos` | Upload avance (multipart) |
| `GET`/`POST` | `/users/:userId/progress-photos` · `…/analyze` | Historial / analizar IA |
| `GET`/`POST` | `/users/coach/athletes` · `/invites` · export · training-program | Coach roster / invites / export |
| `GET`/`POST`/`PUT` | `/coach/templates` · `…/apply` | Plantillas |
| `GET`/`DELETE`/`POST` | `/admin/stats` · `/users` · subscriptions grant/revoke | Admin |

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
- Producto: [`PRODUCT.md`](PRODUCT.md).
- Pendientes: [`docs/TODO.md`](docs/TODO.md).
- Maintained by **Mister L** 💪

---

## Licencia / datos

Los datos y media de ejercicios dependen de la fuente original del dataset y de tu API. Este repo es el **frontend** de exploración.
