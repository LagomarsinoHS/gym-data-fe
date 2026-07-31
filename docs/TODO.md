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
- [ ] Quitar desde catálogo (hoy solo “En tu plan”)
- [ ] Timer de descanso / checklist de pasos en sesión (nice-to-have)

## Coach

### Unir atleta
- Vincular atleta ↔ coach (`coachId` en el atleta).
- UI: botón **Agregar alumno** dentro de Mis alumnos (no nav aparte).
- Preferir email **exacto** o código de invitación. Evitar autocomplete parcial (seguridad / PII).

### Mis alumnos
- [x] Shell: toolbar (título + Agregar alumno) + empty state
- [x] Modal Agregar alumno (email exacto; API pendiente → mensaje “próximamente”)
- [ ] Lista en filas / acordeón (no cards)
- [ ] Al expandir: info + CTA agregar/editar entrenamiento
- [ ] Entrenamiento por bloques (Lun/Mié/Vie) o por sesiones (Sesión 1, 2…)
- [ ] Modal cableado a API de vínculo coach–atleta
