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

Acuerdo con BE: 2 fotos/mes (`front` + `back`) + `weightKg`, historial por `yearMonth` (`YYYY-MM`), storage Cloudinary, URL en `user.progressPhotos`; `currentWeightKg` denormalizado.

### Flujo UI — coach
- Nav **Avances** (lista de alumnos) o botón Avances en Mis alumnos → vista `progress-photos`
- Timeline cronológico + **Comparar** (≥2 meses): 2 → lado a lado (tabs Frente/Espalda); 3+ → carruseles
- Card alumno: nombre, correo, peso actual (chip compacto en modo comparar)
- Lightbox + flechas en galería de comparar + **Descargar** → `FirstName_LastName_Front.jpg`

### Flujo UI — atleta
- Nav **Avances** bajo Mi plan → vista `athlete-avances`
- Formulario mes actual: frente / espalda (picker `+` + preview), peso; Guardar deshabilitado hasta ≥1 foto + peso válido
- `POST /users/me/progress-photos` multipart (`weightKg` + `front`/`back`); reemplaza el mes UTC actual
- Historial: mismo timeline + comparar que coach (`progress-history-ui`)
- Lightbox + descargar → `FirstName_LastName_Back.jpg` (el propio atleta)

### Frontend checklist
- [x] Timeline historial (coach + atleta)
- [x] Comparar 2 (lado a lado) y 3+ (carrusel) — coach + atleta
- [x] Vista coach **Avances** + `progress-photos` (Mis alumnos / nav Avances)
- [x] Vista atleta upload + historial (`athlete-avances-ui`)
- [x] Módulo compartido `progress-history-ui.js`
- [x] `GET /users/:userId/progress-photos` + `uploadProgressPhotos` (multipart)
- [x] Labels de mes localizados via Intl
- [x] Empty: Sin datos / mes incompleto (solo un lado)
- [x] Preview al elegir archivo; Guardar gated; hint “mes actual”
- [x] Lightbox compartido + descarga + nav de galería en comparar
- [ ] (Opc.) UI atleta/coach para `DELETE /users/me/progress-photos` (API ya existe; hoy se reemplaza al volver a guardar)

> BE: POST / DELETE / GET + weight listos. FE: upload + timeline/comparar coach/atleta listos; DELETE sin UI.
---

## Plataforma / nice-to-have
- [ ] Token en cookie httpOnly (opc.)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API (solo si cross-device) — ver también **Configuración**
- [ ] Favoritos separados del plan
- [ ] Deep link más corto
- [ ] Tracking de workouts / progreso (genérico; fotos de progreso tienen sección propia arriba)
