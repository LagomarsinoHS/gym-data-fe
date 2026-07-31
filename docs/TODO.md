# Gym Data FE — TODO

## Coach

### Unir atleta
- Vincular atleta ↔ coach (`coachId` en el atleta).
- UI: botón **Agregar alumno** dentro de Mis alumnos (no nav aparte).
- Preferir email **exacto** o código de invitación. Evitar autocomplete parcial (seguridad / PII).

### Mis alumnos
- [x] Shell: toolbar (título + Agregar alumno) + empty state
- [ ] Lista en filas / acordeón (no cards)
- [ ] Al expandir: info + CTA agregar/editar entrenamiento
- [ ] Entrenamiento por bloques (Lun/Mié/Vie) o por sesiones (Sesión 1, 2…)
- [ ] Modal Agregar alumno cableado a API (hoy: email exacto + mensaje “próximamente”)

## Atleta — pauta
- [x] Editar sets/reps/rest/notes desde el modal (lápiz junto a Quitar del plan)
