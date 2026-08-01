# Gym Data FE — TODO

## Atleta — pauta / plan

- [x] Editar sets / reps / rest / notes desde el modal (lápiz junto a Quitar del plan)
- [x] `PUT /users/training-program/:exerciseId` (JWT; sin `userId` en path)
- [x] Resumen en modal: chips emoji + valor; nota aparte con fade al guardar
- [x] Cards de Entrenamiento: RX vertical (línea + emoji/valor); nota clamp 2 líneas
- [x] Reps: solo dígitos + un `-` (máx. 2 por lado); envío `6` o `8 - 12`
- [x] Rest en segundos (input + display `Ns`)
- [x] Animaciones: form lápiz open/close; pop chips al guardar; flash card al cerrar; modal enter más notorio
- [x] Utils: `reps.js`, `url.js` (share/deep link), `dedupeById` en `helpers.js`

## Atleta — nav / producto

- [x] Nav por rol: athlete → Mi plan (Entrenamiento, Recomendar Pro, Plan del coach); Catálogo
- [x] Badge de rol en sidebar
- [x] Register: toggle Atleta / Entrenador → `role` en `POST /auth/register`
- [x] Recomendar entrenamiento (zona + equipo; gate `isPremium`)
- [ ] Vista “Plan del coach” con datos reales (`coachTrainingProgram` cuando el back lo exponga bien)
- [ ] Timer de descanso / checklist de pasos en sesión (nice-to-have)

## Coach

> Paso a paso BE → FE: [PLAN-COACH-INVITE.md](./PLAN-COACH-INVITE.md)

### Unir atleta
- Vincular atleta ↔ coach vía **invitación** (email exacto → atleta acepta/rechaza → `coachId`).
- UI: botón **Agregar alumno** dentro de Mis alumnos (no nav aparte).
- Preferir email **exacto**. Evitar autocomplete parcial (seguridad / PII).

### Mis alumnos
- [x] Shell: toolbar + empty state
- [x] Modal Agregar alumno → `POST /users/coach/invites` (“Invitación enviada” / errores 404·409)
- [x] Banner atleta: accept / reject invite (`POST .../invites/respond`)
- [x] Lista en filas / acordeón desde `GET /users/coach/athletes` (paginado de a 5 + Cargar más)
- [x] Al expandir: CTA Agregar sesión + modal nombre (shell local)
- [x] Sub-acordeón sesión: resumen + CTA editar / agregar ejercicios
- [x] Vista editor de sesión + catálogo en modo asignar (shell local)
- [ ] Persistir sesiones en BE (`coachTrainingProgram`: `{ id, name, order, items[] }`)
- [x] Editar pauta (sets/reps/rest/notes) de items de sesión (shell local en modal)
- [ ] Entrenamiento por sesiones cableado a API
- [ ] Export Excel: botón para descargar pautas de **todos** los alumnos o de **uno** solo

### Atleta — Plan del coach
- [ ] Export Excel de la pauta asignada por el coach (misma feature que en Mis alumnos)
