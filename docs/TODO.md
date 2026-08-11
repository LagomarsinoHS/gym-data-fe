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
- [x] Export PDF (`format: pdf` on same export endpoint; UI toolbar + por alumno)
- [x] Mis alumnos: ordenar sin/con pauta (client-side)
- [x] Mis alumnos: pill **Objetivo** al expandir la ficha (derecha de Nombre)
- [x] Panel: historial invites filtrable (`GET /users/coach/invites`)
- [x] Panel invites: al filtrar → vaciar lista → spinner → pintar data (sin dejar filas viejas)
- [x] Cupo coach: deshabilitar Invitar si `coachQuota.canInvite === false`; errores por `ApiErrorCode`
- [x] Accept invite con coach al límite: flash del mensaje localizado; pending canceladas en BE
- [x] Reordenar ejercicios / sesiones (drag & drop de la card; click abre/cierra sesión; sin flash de re-render)
- [x] Hint contextual primera vez (localStorage `steelPulse.featureHints`; tip en plan + editor; se oculta al dismiss o al reordenar)
- [x] Comparar avances: mostrar estatura del perfil junto al cambio de peso (si está cargada)
- [ ] Duplicar sesión o copiar a otro atleta
- [x] Plantillas reutilizables (`coachTemplates` en User del coach) — biblioteca (list/create/edit/save + apply)
- [x] Aplicar plantilla → alumno (Plantillas / Mis alumnos: un solo `POST /coach/templates/apply` con `templateIds` + `athleteIds`)
- [x] Aplicar plantilla desde Mis alumnos / plan del atleta (“Usar plantilla”)
- [x] Toast de éxito al aplicar desde Plantillas (~3s, cerrable con ✕)
- [ ] (Opc.) UI upsell cuando el cupo está lleno (growth/pro)

### PDF brand (export con marca del coach)

Hoy el PDF sale con estilo ExerciseDB / genérico. **PDF brand** = que el archivo se sienta “del coach” (o del estudio) cuando se lo manda al alumno o lo imprime.

- [ ] Cabecera del PDF: nombre del coach (y opcional del estudio), fecha de exportación, nombre del atleta
- [ ] Logo / foto de perfil del coach en el PDF (si tiene `profilePhoto`; subida dedicada de logo más adelante)
- [ ] Colores de acento configurables (o al menos usar acento fijo del brand del coach vs verde default de ExerciseDB)
- [ ] Pie de página: “Preparado por {Coach} · ExerciseDB” (o sin ExerciseDB en planes pagos)
- [ ] (BE) Pasar datos de brand al `PdfService` (coach first/last, logo URL, atleta, fecha); Excel puede sumar la misma cabecera después
- [ ] (Opc. Growth/Pro) quitar o reducir branding ExerciseDB en el PDF como perk de plan pago

---

## Cuenta — perfil / configuración

Menú de usuario en sidebar (iniciales o foto + nombre corto + dropdown).
**Mi perfil** habilitado. **Configuración** sigue deshabilitada (tooltip “Próximamente”).

- [x] **Mi perfil** — lectura (`/users/me`) + acciones “Pronto”; ítem de menú habilitado
- [x] **Mi perfil → editar perfil** — panel derecho del header en modo formulario (nombre/apellido + body stats + goal + contraseña) → `PATCH /users/me`; cierra al guardar OK
- [x] **Mi perfil → datos corporales opcionales** — estatura, sexo, fecha nac., objetivo en editar perfil + info personal del header; register sigue básico
- [x] **Mi perfil → header split** — identidad (foto/badges/coach) + información personal + metrics peso/estatura
- [x] **Mi perfil → grid info personal** — labels siempre visibles; valor “—” si el dato falta
- [x] **Mi perfil → darse de baja** — modal pide email → `DELETE /users/me` → cierra sesión (soft-delete; **no** limpia vínculo coach en BD — ver BE TODO)
- [x] **Mi perfil → foto de perfil** — click en avatar → Ver foto / Subir foto (`POST /users/me/profile-photo`); Cloudinary `gym-app/profiles/{userId}/profilePhoto`
- [ ] **Mi perfil → acciones** — cablear: notificaciones, privacidad, **dejar coach** (unlink ≠ baja de cuenta), billing, export, etc.
- [ ] **Configuración** — preferencias (tema/idioma sync a user, notificaciones, …); habilitar ítem del menú
- [x] ~~**Configuración → darse de baja**~~ — hecho en Mi perfil (`DELETE /users/me`)
- [x] ~~(BE) update perfil / deactivate~~ — `PATCH /users/me` + `DELETE /users/me` + `POST /users/me/profile-photo`

---

## Admin panel

Entrada de nav solo si `role === 'admin'` (Overview + Usuarios; sin catálogo/coach UX).  
BE: `GET /admin/stats`, `GET /admin/users`, `DELETE /admin/users/:userId`, grant/revoke por email.

### Orden de entrega
1. **Overview** ← hecho  
2. **Usuarios** ← hecho  
3. Suscripciones / ops  
4. Coaches / sistema (después)

### 1. Overview (primera)
- [x] Vista `admin-overview`: salud del producto de un vistazo
- [x] Contadores: usuarios totales, athletes, coaches, admins
- [x] Suscripciones: free vs paid (`premium` / `growth` / `pro`); por vencer (< 7 días)
- [x] Usuarios nuevos últimos 7/30 días
- [x] Atajo a Usuarios (cuando exista la vista)
- [x] (BE) `GET /admin/stats` — agregados slim para pintar el overview
- [x] Gate: nav/item Admin solo con `role === 'admin'`

### 2. Usuarios
- [x] Lista paginada + buscador (email / nombre)
- [x] Filtros: rol, plan, por vencer _(soft-deleted queda para después)_
- [x] Fila acordeón denso (cards): cuenta, suscripción, rol/plan, coach, datos de perfil
- [x] Barra de suscripción: tiempo restante inicio→vence (verde→amarillo→rojo); vacío sin período; “Empieza en X días” si aún no inició
- [x] Acciones: grant / revoke subscription (reusar endpoints admin actuales; default 5 días en UI)
- [x] Acción: soft-delete con confirmación (modal)
- [x] (BE) `GET /admin/users` paginado + search/filters
- [x] (BE) delete admin de usuario (soft-delete; distinto de `DELETE /users/me`)

### 3. Suscripciones / billing ops
- [ ] Cola / filtro: paid activos, por expirar, expirados
- [x] Grant/revoke rápido desde fila
- [ ] (Opc.) audit log: quién cambió qué y cuándo
- [ ] (Opc.) mostrar nombre del coach (cuando el BE lo exponga)

### 4. Coaches / sistema (más adelante)
- [ ] Coaches: cuota, invites pendientes, “llenos”; ajustar límites si el BE lo permite
- [ ] Sistema: flags / version / cleanup soft-delete (solo si hay ops recurrentes)
- [ ] (Opc.) restore / anular soft-delete desde UI

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
- Timeline cronológico + **Comparar** (≥2 meses): 2 → lado a lado (tabs Frente/Espalda); 3+ → carruseles; métricas Δ peso + estatura de perfil (si hay)
- Card alumno: nombre, correo, peso actual (chip compacto en modo comparar)
- Lightbox + flechas en galería de comparar + **Descargar** → `FirstName_LastName_Front.jpg`

### Flujo UI — atleta
- Nav **Avances** bajo Mi plan → vista `athlete-avances`
- Formulario: frente / espalda (picker `+` + preview), peso; caption debajo del peso (“Mes actual · cambiar” o el mes elegido) abre month-picker para backfill
- Guardar deshabilitado hasta ≥1 foto + peso válido
- `POST /users/me/progress-photos` multipart (`weightKg` + `front`/`back` + `yearMonth` opcional); upsert del mes elegido (default = UTC actual)
- Historial: mismo timeline + comparar que coach (`progress-history-ui`)
- Lightbox + descargar → `FirstName_LastName_Back.jpg` (el propio atleta)

### Frontend checklist
- [x] Timeline historial (coach + atleta)
- [x] Comparar 2 (lado a lado) y 3+ (carrusel) — coach + atleta
- [x] Vista coach **Avances** + `progress-photos` (Mis alumnos / nav Avances)
- [x] Vista atleta upload + historial (`athlete-avances-ui`)
- [x] Módulo compartido `progress-history-ui.js`
- [x] `GET /users/:userId/progress-photos` + `uploadProgressPhotos` (multipart, `yearMonth?`)
- [x] Labels de mes localizados via Intl
- [x] Empty: Sin datos / mes incompleto (solo un lado)
- [x] Preview al elegir archivo; Guardar gated; caption mes + month-picker (backfill)
- [x] Lightbox compartido + descarga + nav de galería en comparar
- [x] Comparar: estatura del perfil junto al Δ de peso (si hay `profile.heightCm`)
- [x] **Analizar progreso** (IA): comparación de 2 meses → resumen vía API

> BE: POST (`yearMonth?`) / DELETE / GET + weight listos. FE: upload + backfill + timeline/comparar + Analizar progreso listos; DELETE sin UI.
---

## Nutrición — pauta alimenticia (coach → atleta)

Vista nueva para que el coach cargue una **pauta nutricional** al alumno y el atleta la consulte (mismo patrón que plan del coach: coach escribe, atleta lee).

### Producto
- [ ] Definir qué se sube (texto estructurado, PDF/imagen, o ambos) y si es 1 pauta por atleta o historial por fechas
- [ ] Vista coach: subir / editar / reemplazar pauta del alumno (desde Mis alumnos o nav dedicada)
- [ ] Vista atleta: ver pauta asignada (nav bajo Mi plan, vacío si no hay coach o no hay pauta)

### Backend
- [ ] Campo / recurso de pauta nutricional por atleta (authz: coach asignado escribe; atleta self o coach lee)
- [ ] Endpoints create/update + get; storage si hay archivo (Cloudinary u otro)

### Frontend
- [ ] UI coach (upload / editor + guardar)
- [ ] UI atleta (solo lectura + empty states: sin coach / sin pauta)

---

## Onboarding coach (“invitar alumno en 2 minutos”)

Hoy un coach nuevo aterriza en Panel / Mis alumnos sin un camino guiado. Para vender hace falta que el **primer valor** se sienta en minutos, no explorando el menú.

Objetivo UX: del registro a “ya tengo un alumno vinculado y veo dónde armar su plan” en ~2 minutos.

### Invite pre-registro (email único, atleta puede no existir aún)

- [x] (BE) Invite sin `athleteId` obligatorio mientras pending-pre-register; clave email + índices únicos pending
- [x] (BE) Al `register` athlete: vincular invites pending por email
- [x] (BE) Borrado automático de `pending` > 24h (TTL parcial Mongo + cleanup oportunista)
- [x] (FE) Modal invite: copy claro + botón **Copiar mensaje WhatsApp**
- [x] (FE) Historial: “esperando registro” vs “esperando aceptación”
- [x] (FE) Empty Mis alumnos: texto alineado al nuevo flujo

### Wizard / empty states
- [ ] Primer login coach: checklist o wizard corto (3 pasos): 1) Invitar alumno · 2) Esperar/aceptar · 3) Abrir sesión / armar plan
- [ ] Empty state de Mis alumnos más accionable (CTA grande “Invitar con email” + 1 línea de qué pasa después)
- [ ] Copy del invite: el atleta entiende que es de *su* coach (nombre en el banner, no solo genérico)
- [ ] (Opc. después) Deep link con token (`?invite=`)
- [ ] (Opc.) Demo / alumno de prueba sin register real

---

## Plataforma / nice-to-have
- [ ] Token en cookie httpOnly (opc.)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API (solo si cross-device) — ver también **Configuración**
- [ ] Favoritos separados del plan
- [ ] Deep link más corto
- [ ] Tracking de workouts / progreso (genérico; fotos de progreso tienen sección propia arriba)
