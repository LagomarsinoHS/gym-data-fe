# ExerciseDB — Frontend

> **V estable — 2026-08-13.** Marcá commits/tags con esta fecha para identificar el snapshot estable del FE (cleanup + nutrición/avances/admin polish). Detalle: [`docs/FRONTEND-CAPACIDADES.md`](docs/FRONTEND-CAPACIDADES.md).

Frontend estático para explorar una librería de **~1.324 ejercicios** de fitness (catálogo desde la API/BD): filtros, búsqueda, infinite scroll, detalle con GIF e instrucciones bilingües (ES/EN).

Con sesión: **Mi plan** (entrenamiento, plan del coach, nutrición, avances), flujos de coach y admin.

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
- Menú de cuenta en sidebar: iniciales/foto, nombre corto, rol; dropdown (Mi perfil; Cerrar sesión)
- Atleta: **Mi entrenamiento**, **Plan del coach**, **Nutrición** (pautas), **Avances** (upload / backfill + timeline + comparar)
- Coach: **Panel**, **Plantillas**, **Mis alumnos**, **Nutrición** (perfil + pauta list/read/archive), **Avances**
- Admin: **Overview** + **Usuarios** (acordeón detalle, grant/revoke, soft-delete)
- Banner de invite pendiente (atleta) vía `GET /users/me/pending-coach-invite`
- Planes: athlete `free`/`premium`; coach `free`/`growth`/`pro` + `coachQuota` en `/me`
- UI bilingüe (Español / English)
- Media de ejercicios vía paths relativos (`images/…`, `videos/…` desde la API); fotos de progreso/perfil vía Cloudinary

---

## Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4**
- React Router
- Fetch API

Migración en curso: shell, login/registro, `GET /users/me` y **catálogo** (filtros, search, WOD, grid, modal) ya corren en React. El resto de vistas se porta después. El snapshot vanilla queda en `legacy.html` + `js/` + `public/css/`.

---

## Estructura

```
gym-data-fe/
├── src/                    # App React (Vite)
│   ├── api/                # request, token, auth, users
│   ├── components/         # layout, gates
│   ├── context/            # auth, theme, i18n
│   ├── pages/              # catálogo (placeholder), login, coming soon
│   └── styles.css          # tokens + Tailwind
├── index.html              # entrada Vite
├── legacy.html             # snapshot de la app vanilla
├── js/                     # frontend anterior (referencia hasta terminar de portar)
├── public/css/             # CSS anterior
├── PRODUCT.md
└── docs/
```

---

## Cómo correrlo

Hace falta [Node.js](https://nodejs.org/) y **npm**.

```bash
npm i
npm run dev
```

Queda en [http://localhost:8080](http://localhost:8080). Si el puerto está ocupado, Vite usa el siguiente.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo |
| `npm run build` | build de producción |
| `npm run preview` | previsualizar el build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

La API base se puede fijar con `VITE_API_BASE` (ver `.env.example`). Si no está, se elige por hostname:

### API local vs producción

En `src/api/request.ts` (`resolveApiBase`):

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
| `GET`/`PUT` | `/users/coach/athletes/:id/nutrition` | Perfil nutricional (coach) |
| `GET`/`POST` | `/users/coach/athletes` · `/invites` · export · training-program | Coach roster / invites / export |
| `POST`/`GET`/`PUT`/`PATCH`/`DELETE` | `/nutrition-plans` · `…/:id` · `…/archive` | Pautas alimenticias |
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

- Render puede “dormir” el servicio gratis; el primer request tras inactividad puede tardar unos segundos.
- Capacidades actuales: [`docs/FRONTEND-CAPACIDADES.md`](docs/FRONTEND-CAPACIDADES.md).
- Producto: [`PRODUCT.md`](PRODUCT.md).
- Pendientes: [`docs/TODO.md`](docs/TODO.md).
- Maintained by **Mister L** 💪

---

## Licencia / datos

Los datos y media de ejercicios dependen de la fuente original del dataset y de tu API. Este repo es el **frontend** de exploración.
