# Plan: Vincular coach ↔ atleta (invitación)

Flujo acordado: el coach invita por **email exacto** → el atleta **acepta o rechaza** → recién ahí se setea `coachId`.

Documento para ir tachando. Empezar por el **BE**; el FE puede avanzar en paralelo solo en shell/copy cuando el contrato exista.

---

## Resumen del flujo

```
Coach: Mis alumnos → Agregar alumno → email exacto
        ↓
POST invite → atleta.pendingCoachInvite = { coachId, coachName, invitedAt }
        ↓
Coach ve: “Invitación enviada” (no alumno aún)
        ↓
Atleta (GET /me): ve banner “Coach X te invita…”
        ↓
Accept → coachId = coach.id, invite = null
Reject → invite = null
```

---

## Modelo de datos

### Atleta (`User`)

| Campo | Tipo | Notas |
|-------|------|--------|
| `coachId` | `string \| null` | **Solo** cuando el vínculo está aceptado (ya existe) |
| `pendingCoachInvite` | objeto \| `null` | Nuevo |

```ts
pendingCoachInvite: {
  coachId: string;
  coachName: string;   // snapshot "Nombre Apellido" al momento de invitar
  invitedAt: Date;
} | null
```

### Reglas

- Un atleta → un coach (`coachId` único).
- Si ya tiene `coachId` → no aceptar otra invite (rechazar invite o error al invitar).
- Si ya tiene `pendingCoachInvite` de otro coach → **reemplazar** con la nueva (simple).
- Reinvitar al mismo atleta (misma invite pendiente del mismo coach) → idempotente (actualizar `invitedAt` / “ya enviada”).
- Solo se puede invitar usuarios con `role: 'athlete'`.
- Email **exacto** (case-insensitive trim). Sin autocomplete parcial.
- Error genérico si no existe / no es athlete: no filtrar PII de más.

### Respuesta `GET /users/me` (ampliar)

```json
{
  "coachId": null,
  "pendingCoachInvite": {
    "coachId": "...",
    "coachName": "Juan Pérez",
    "invitedAt": "2026-07-31T..."
  }
}
```

o `"pendingCoachInvite": null`.

Opcional en `/me` del coach: no hace falta listar invites enviadas en v1 (puede ir en el listado de alumnos).

---

# Parte A — Backend (orden sugerido)

## A1. Schema + tipos

- [ ] Agregar `pendingCoachInvite` al schema de `User` (default `null`).
- [ ] Tipar en DTO de `GET /users/me` (`MeResponseDto`).
- [ ] Migración / default: users existentes → `null` (sin backfill especial).

**Done cuando:** `/me` devuelve `pendingCoachInvite: null` sin romper clientes.

---

## A2. Coach: crear invitación

`POST /users/coach/invites`  
Auth: JWT · solo `role: coach | admin`

**Body:** `{ "email": "atleta@mail.com" }`

**Lógica:**
1. Normalizar email (trim + lowercase).
2. Buscar user por email.
3. Si no existe o `role !== 'athlete'` → `404` o `400` con mensaje genérico  
   ej. `"No encontramos un atleta con ese email"`.
4. Si `athlete.coachId` ya set → `409`  
   ej. `"Este atleta ya tiene un coach"`.
5. Si ya hay invite pendiente (cualquier coach) → `409`  
   ej. `"This athlete has a pending invitation"` (comportamiento actual del BE; no reemplaza).
6. Setear:
   ```ts
   pendingCoachInvite: {
     coachId: me.id,
     invitedAt: new Date(),
   }
   ```
7. **No** tocar `coachId`.

**Response:** `{ ok: true }`

**Errores:**
| Caso | Status |
|------|--------|
| No athlete / no es athlete | 404 |
| Ya tiene `coachId` | 409 |
| Ya tiene `pendingCoachInvite` | 409 |

**Done cuando:** Postman o FE: coach invita atleta → `{ ok: true }` y el atleta tiene `pendingCoachInvite` en DB.

---

## A3. Atleta: responder invitación

`POST /users/coach/invites/respond`  
Auth: JWT · `role: athlete`  
Body: `{ "action": "accept" | "reject" }`

**Lógica (accept):**
1. Si no hay `pendingCoachInvite` → `404` / `400`.
2. Si el `coachId` de la invite ya no es coach válido (opcional check) → limpiar invite + error.
3. `coachId = pendingCoachInvite.coachId`.
4. `pendingCoachInvite = null`.
5. Devolver user enriquecido (como `/me`) o `{ ok: true }` + el cliente refresca `/me`.

**Lógica (reject):**
1. Si no hay invite → idempotente OK o 404 suave.
2. `pendingCoachInvite = null`.
3. `coachId` intacto.

**Done cuando:** accept → atleta tiene `coachId` y invite null; reject limpia la invite sin vincular.

---

## A4. _(fusionado en A3)_

~`POST .../accept` y `.../reject`~ → un solo `POST .../respond` con `action`.

---

## A5. Coach: listar alumnos

`GET /users/coach/athletes`  
Auth: JWT · coach | admin

**Response (mínimo):**

```json
{
  "athletes": [
    { "id": "...", "name": "...", "lastName": "...", "email": "..." }
  ]
}
```

Query: users donde `coachId === me.id` y `role === 'athlete'`.

**Opcional v1.1 — invites pendientes enviadas:**

```json
{
  "athletes": [ ... ],
  "pendingInvites": [
    { "email": "...", "invitedAt": "..." }
  ]
}
```

(requiere guardar en el coach o buscar athletes con `pendingCoachInvite.coachId === me`).

**Done cuando:** coach con 1 alumno aceptado ve ese alumno en el listado.

---

## A6. (Opcional) Coach: cancelar invite pendiente

`DELETE /users/coach/invites/:athleteId` o body `{ email }`

Limpia `pendingCoachInvite` solo si `coachId` de la invite es `me`.

Útil para Mis alumnos → “Cancelar invitación”. Puede ir **después** del FE mínimo.

---

## A7. (Opcional) Atleta: desvincular coach

`DELETE /users/me/coach` o `POST /users/coach/unlink`

`coachId = null`. Producto aparte; no bloquea el MVP de invite.

---

## Checklist BE (orden de PR)

1. [x] A1 Schema + `/me` (si ya está en tu BE)
2. [x] A2 `POST .../invites`
3. [ ] A3 `POST .../invites/respond` (`action`: accept | reject)
4. [ ] A5 `GET .../athletes`
5. [ ] A6 cancel (opcional)
6. [ ] Actualizar `gym-data-be/TODO.md` + tabla de endpoints

### Endpoints — tabla final

| Método | Path | Rol | Efecto |
|--------|------|-----|--------|
| POST | `/users/coach/invites` | coach | Crea/actualiza invite en atleta |
| POST | `/users/coach/invites/respond` | athlete | Body `{ action }`: accept setea `coachId`; reject limpia invite |
| GET | `/users/coach/athletes` | coach | Lista alumnos vinculados |
| DELETE | `/users/coach/invites` (opc.) | coach | Cancela invite enviada |

---

# Parte B — Frontend (después / en paralelo con contrato)

## B1. Copy y estados del modal “Agregar alumno”

- [x] Al submit: llamar `POST /users/coach/invites`
- [x] Success → **“Invitación enviada”**
- [x] Errores: 404 no encontrado · 409 ya tiene coach / invite pendiente · genérico
- [x] Loading + disable botón mientras request

**Done cuando:** coach real envía invite y ve el mensaje OK.

---

## B2. Tipos / `GET /me`

- [ ] Tipar `pendingCoachInvite` en el user del front.
- [ ] Tras login / restore, el user trae la invite si existe.

---

## B3. Banner de invitación (atleta)

- [x] Si `pendingCoachInvite` y rol athlete → banner visible (main top):
  - Texto: **“{firstName} {lastName} te invita a ser su alumno”**
  - Botones: **Aceptar** / **Rechazar**
- [x] Accept / Reject → `POST .../respond` `{ action }` → refresh `/me` → banner desaparece.
- [x] Labels en `constants.js` (EN/ES).

**Done cuando:** atleta ve, acepta y queda vinculado; o rechaza y no queda rastro.

---

## B4. Mis alumnos — lista real

- [ ] `GET /users/coach/athletes` al entrar a la vista.
- [ ] Empty state solo si no hay alumnos **ni** (opc.) invites pendientes.
- [ ] Filas / acordeón (como TODO): nombre, email; expandir después para plan.
- [ ] Sección o badge **“Pendientes”** si implementamos listado de invites (A5 v1.1 o query por `pendingCoachInvite.coachId`).

**Done cuando:** alumno aceptado aparece en la lista del coach.

---

## B5. Plan del coach (atleta)

- [ ] Si `coachId` set → copy “ya tenés coach” (ya parcial).
- [ ] Más adelante: pintar `coachTrainingProgram` (fuera de este MVP de vínculo).

---

## B6. Docs

- [ ] Marcar ítems en `docs/TODO.md` (FE).
- [ ] Actualizar `docs/FRONTEND-CAPACIDADES.md` (nuevas llamadas + banner).
- [ ] Sync `docs/PLAN-PERFIL-ENTRENAMIENTO.md` si hace falta.
- [ ] Sync `gym-data-be/TODO.md`.

---

# Orden de trabajo recomendado (para vos)

| # | Dónde | Qué |
|---|--------|-----|
| 1 | BE | A1 schema + `/me` |
| 2 | BE | A2 POST invite |
| 3 | BE | A3 `POST .../respond` |
| 4 | FE | B1 modal coach “Invitación enviada” ✅ |
| 5 | FE | B3 banner atleta |
| 6 | BE | A5 list athletes |
| 7 | FE | B4 lista Mis alumnos |
| 8 | Opc. | A6 cancel invite + UI |

Así podés ir solo en back (1→3), probar con HTTP client, y después cablear el FE sin adivinar contratos.

---

## Fuera de alcance (este plan)

- Email transaccional real (SMTP) — la invite vive en `/me` al abrir la app.
- Autocomplete de emails.
- Múltiples coaches por atleta.
- Asignar plan / bloques (módulo coach plan, después del vínculo).
