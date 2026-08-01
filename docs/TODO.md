# Gym Data FE — TODO

Pendientes (FE + BE necesario). Lo ya hecho vive en [FRONTEND-CAPACIDADES.md](./FRONTEND-CAPACIDADES.md).

---

## Prioridad — sesiones coach (`coachTrainingProgram`)

Modelo acordado (FE shell ya lo usa en memoria):

```ts
coachTrainingProgram: {
  id: string;
  name: string;      // "Lunes", "Sesión 1"…
  order: number;
  items: {
    exerciseId: string;
    exercise?: Exercise;
    order?: number;
    sets?: number;
    reps?: string;   // "6" | "8 - 12"
    rest?: number;   // segundos
    notes?: string;
  }[];
}[]
```

### Backend
- [ ] Schema: `coachTrainingProgram` = sesiones (default `[]`); migrar lista plana vieja si existe
- [ ] Exponer en `GET /users/me` (atleta) y en athletes del coach si hace falta
- [x] `PUT /users/coach/athletes/:athleteId/training-program`  
  Body = `{ coachTrainingProgram }` (sesiones + items **sin** `exercise` populado)  
  Auth: coach dueño del vínculo. Persist + respond con athlete **enriquecido**.
- [ ] (Opc. después) endpoints granulares / autosave; hoy delete sesión = local + PUT replace

### Frontend
- [x] Dirty state + botón **Guardar plan**
- [x] Cablear `PUT .../athletes/:id/training-program` (replace completo, sin `exercise`)
- [ ] Confirmar carga de `coachTrainingProgram` al listar atleta (API ya enriquece; revisar merge local)
- [x] Busy / errores al guardar
- [ ] Vista atleta **Plan del coach**: pintar sesiones reales (empty “sin plan” vs “sin coach”)

---

## Coach — resto
- [ ] Export Excel: todos / uno / pauta vista atleta (UI shell ya existe)
- [ ] Badge / sección invites **pendientes** en Mis alumnos (opc.)
- [ ] Reordenar ejercicios / sesiones
- [ ] Duplicar sesión o copiar a otro atleta
- [ ] Plantillas reutilizables (`coach-templates`)

---

## Atleta — plan / UX
- [ ] Quitar del plan desde catálogo (hoy solo “En tu plan”)
- [ ] Confirmación más clara al agregar desde catálogo / recommend
- [ ] Timer de descanso / checklist de pasos en sesión (nice-to-have)
- [ ] GIF / media del modal más dominante
- [ ] Marcar series hechas en sesión

---

## Plataforma / nice-to-have
- [ ] Token en cookie httpOnly (opc.)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API (solo si cross-device)
- [ ] Favoritos separados del plan
- [ ] Deep link más corto
- [ ] Tracking de workouts / progreso
