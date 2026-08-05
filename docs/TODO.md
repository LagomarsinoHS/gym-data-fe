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
- [x] Schema: `coachTrainingProgram` = sesiones (default `[]`)
- [x] Exponer en `GET /users/me` (atleta) y en athletes del coach
- [x] `PUT /users/coach/athletes/:athleteId/training-program`  
  Body = `{ coachTrainingProgram }` (sesiones + items **sin** `exercise` populado)  
  Auth: coach dueño del vínculo. Persist + respond con athlete **enriquecido**.
- [ ] (Opc. después) endpoints granulares / autosave; hoy delete sesión = local + PUT replace

### Frontend
- [x] Dirty state + botón **Guardar plan**
- [x] Cablear `PUT .../athletes/:id/training-program` (replace completo, sin `exercise`)
- [x] Busy / errores al guardar
- [x] Vista atleta **Plan del coach**: sesiones reales + empty “sin plan” vs “sin coach”

---

## Coach — Panel / invites / export

- [x] Panel V1 informativo (total + sin pauta) con loading sin placeholders
- [x] Colección `invites` + create / respond (BE)
- [x] `GET /users/me/pending-coach-invite` → `{ invite }` (banner atleta)
- [x] Export Excel binary (`POST .../training-program/export`)
- [x] Mis alumnos: ordenar sin/con pauta (client-side)
- [x] Panel: historial invites filtrable (`GET /users/coach/invites`)
- [x] Panel invites: al filtrar → vaciar lista → spinner → pintar data (sin dejar filas viejas)
- [x] Cupo coach: deshabilitar Invitar si `coachQuota.canInvite === false`; errores por `ApiErrorCode`
- [x] Accept invite con coach al límite: flash del mensaje localizado; pending canceladas en BE
- [ ] Export PDF
- [ ] Reordenar ejercicios / sesiones
- [ ] Duplicar sesión o copiar a otro atleta
- [ ] Plantillas reutilizables (`coach-templates`)
- [ ] (Opc.) UI upsell cuando el cupo está lleno (growth/pro)

---

## Cuenta — perfil / configuración

Menú de usuario en sidebar ya existe (iniciales + nombre corto + dropdown). Ítems deshabilitados por ahora.
Se cablean al clickear **Mi perfil** / **Configuración** en ese menú.

- [ ] **Mi perfil** — vista/edición de datos (nombre, email, …); habilitar ítem del menú
- [ ] **Configuración** — preferencias (tema/idioma sync a user, notificaciones, …); habilitar ítem del menú
- [ ] **Configuración → darse de baja** — opción en Configuración (no en Mi perfil) que llama al soft-delete BE (`deletedAt`); confirmar + cerrar sesión
- [ ] (BE) Endpoints de update de perfil / preferencias / deactivate si hacen falta más allá de `GET /users/me`

---

## Atleta — plan / UX
- [ ] Quitar del plan desde catálogo (hoy solo “En tu plan”)
- [ ] Confirmación más clara al agregar desde catálogo / recommend
- [ ] Timer de descanso / checklist de pasos en sesión (nice-to-have)
- [ ] GIF / media del modal más dominante
- [ ] Marcar series hechas en sesión

---

## Fotos de progreso (atleta sube · coach mira)

Acuerdo con BE: 2 fotos/mes (`front` + `back`), historial por `yearMonth` (`YYYY-MM`), storage en Cloudinary, URL (+ `publicId`) en `user.progressPhotos`.

### Flujo UI — coach (“Avances alumnos”)
1. Elegir alumno  
2. Ver **años** disponibles (derivados de `years[]`)  
3. Elegir año → ver **meses** con al menos 1 foto  
4. Elegir mes → renderizar `front` / `back` con las `url`

### Flujo UI — atleta
- Subir foto del mes actual (lado frente o espalda); si ya existe ese lado, reemplazar
- Ver su historial con la **misma** UI que el coach: `GET /users/:userId/progress-photos` pasando su propio id

### Frontend checklist
- [x] Componente/vista compartida de historial (años → meses → fotos) usable por coach y atleta
- [x] Vista coach **Avances**: botón en Mis alumnos → página dedicada
- [ ] Vista atleta: historial con su propio `userId`
- [x] Cablear `GET /users/:userId/progress-photos` (coach; `?year=` opcional en API)
- [x] Labels de mes localizados (`1 → Enero`, etc.) via Intl
- [x] Empty states: sin fotos / mes incompleto (solo front o solo back)
- [ ] Vista atleta: upload multipart (`file` + `side`) → `POST /users/me/progress-photos`
- [ ] Preview / feedback al subir (loading, error de tipo/tamaño)

> BE: POST / DELETE / GET progress-photos listos. Falta upload + vista historial del atleta en FE.
---

## Plataforma / nice-to-have
- [ ] Token en cookie httpOnly (opc.)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API (solo si cross-device) — ver también **Configuración**
- [ ] Favoritos separados del plan
- [ ] Deep link más corto
- [ ] Tracking de workouts / progreso (genérico; fotos de progreso tienen sección propia arriba)
