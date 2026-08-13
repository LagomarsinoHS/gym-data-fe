# Gym Data FE — TODO

Solo pendientes. Lo ya hecho: [FRONTEND-CAPACIDADES.md](./FRONTEND-CAPACIDADES.md).

---

## Prioridad

1. **Nutrición** — pauta alimenticia coach → atleta
2. **Onboarding coach** — wizard primer login
3. **PDF brand** — export con marca del coach
4. **Cuenta** — Configuración (dejar coach ya hecho)
5. **Coach polish** — duplicar sesión; upsell de cupo (opc.)

---

## Nutrición — pauta alimenticia (coach → atleta)

Mismo patrón que plan del coach: coach escribe, atleta lee.
Pautas = texto estructurado (`nutritionPlans`); historial vía `active` / `archived` (sin archivo PDF por ahora).

### Dos capas (no mezclar)

| | **Perfil nutricional** (`User.nutrition`) | **Pauta alimenticia** (`nutritionPlans`) |
|---|---|---|
| Qué es | Contexto del atleta: hábitos, preferencias, restricciones, **cuántas comidas quiere** y horarios preferidos | Prescripción: macros + qué comer en cada comida/hora |
| Quién escribe | Coach (vista Nutrición actual) | Coach (UI pendiente) |
| Quién lee | Solo coach (no va en `/me`) | Atleta (self) + coach creador asignado |
| Persistencia | 1 doc embebido por atleta (upsert) | Historial `active` / `archived` (+ soft-delete atleta) |

Separarlos está bien: el perfil **informa** la pauta; la pauta **manda** lo que ve el atleta.

### Dónde vive la UI coach (V1)

- Mismo módulo **Nutrición** (mismo picker de alumno).
- Dos bloques/secciones en esa vista (no un solo formulario):
  1. **Perfil** — lo que ya existe (hábitos / preferencias / comidas deseadas).
  2. **Pauta** — crear / editar activa / archivar / listar anteriores (como el atleta, pero editable).
- Entry opcional desde Mis alumnos → “Nutrición” (ya navega ahí).

### Relación perfil ↔ pauta (V1)

- El número/horarios de comidas del **perfil** son **sugerencia al crear** la pauta (prefills: N slots con `name` + `time` del perfil).
- **No** se exige que `plan.meals.length === profile.meals.length`. El coach puede sumar/quitar comidas en la pauta.
- Lo que ve el atleta es **solo la pauta** (timeline), no el perfil.
- Al guardar pauta: ordenar `meals` por `time` (HH:mm); sin hora → al final.

### Roadmap

**V1 (siguiente)**
- [x] UI coach de pauta en Nutrición (sección aparte del perfil: tabs Perfil | Pauta)
- [x] Listado / detalle / archivar (misma lectura que atleta)
- [ ] Create/edit: editor + prefill comidas desde `User.nutrition.meals` si existen; macros/targets manuales
- [ ] Al guardar: ordenar `meals` por `time`
- [x] Vista atleta (ya hecha)

**V2 (después)**
- [ ] Calcular targets sugeridos (kcal / P / C / G) desde perfil + antropometría + objetivo (`goal`, actividad, peso, altura, edad/sexo)
- [ ] Coach puede aceptar o editar esos números antes de guardar
- [ ] (Opc.) repartir macros por comida; (opc.) PDF/imagen adjunto

### Producto / Backend / Frontend (checklist)

### Producto
- [x] Formato pauta estructurada + historial active/archived
- [x] Decisión: perfil ≠ pauta; misma nav Nutrición, secciones separadas
- [x] Vista coach pauta — list/read/archive (+ stub crear)
- [ ] Vista coach pauta — create/edit (V1)
- [x] Vista atleta

### Backend
- [x] CRUD `nutrition-plans` (+ soft-delete archivadas atleta)
- [ ] (V2) endpoint o helper de targets sugeridos — no hace falta hasta V2
- [ ] Storage archivo — solo si sumamos PDF/imagen

### Frontend
- [x] UI coach pauta — tabs Perfil | Pauta; list/read/archive (`coach-nutrition-plan-ui.js`)
- [ ] UI coach pauta — create/edit (prefill desde perfil; sort por `time` al guardar)
- [x] UI atleta (`athlete-nutrition`)
- Shared render: `nutrition-plan-render.js`
---

## Onboarding coach (“invitar alumno en 2 minutos”)

Objetivo: del registro a “ya tengo un alumno y sé dónde armar su plan” en ~2 minutos.

- [ ] Primer login coach: checklist o wizard corto (3 pasos): 1) Invitar alumno · 2) Esperar/aceptar · 3) Abrir sesión / armar plan
- [ ] (Opc.) Deep link con token (`?invite=`)
- [ ] (Opc.) Demo / alumno de prueba sin register real

---

## PDF brand (export con marca del coach)

Hoy el PDF sale con estilo ExerciseDB / genérico. Que se sienta “del coach” (o del estudio).

- [ ] Cabecera: nombre del coach (y opcional del estudio), fecha de exportación, nombre del atleta
- [ ] Logo / foto de perfil del coach (si tiene `profilePhoto`; logo dedicado más adelante)
- [ ] Colores de acento (fijo del brand vs verde default ExerciseDB)
- [ ] Pie: “Preparado por {Coach} · ExerciseDB” (o sin ExerciseDB en planes pagos)
- [ ] (BE) Pasar brand al `PdfService` (coach, logo URL, atleta, fecha); Excel puede sumar cabecera después
- [ ] (Opc. Growth/Pro) reducir branding ExerciseDB como perk de plan pago

---

## Cuenta — perfil / configuración

**Configuración** sigue deshabilitada (“Próximamente”).

- [x] **Dejar coach** — card Mi coach + modal + `DELETE /users/me/coach` (no es baja de cuenta; nutrición se mantiene)
- [ ] **Mi perfil → acciones** — notificaciones, privacidad, billing, export, etc.
- [ ] **Configuración** — preferencias (tema/idioma sync a user, notificaciones, …); habilitar ítem del menú

---

## Coach — polish

- [ ] Duplicar sesión o copiar a otro atleta
- [ ] (Opc.) endpoints granulares / autosave (hoy delete sesión = local + PUT replace)
- [ ] (Opc.) UI upsell cuando el cupo está lleno (growth/pro)

---

## Admin — siguientes

Overview + Usuarios ya están. Siguiente:

- [ ] Cola dedicada: paid activos / por expirar / expirados (hoy solo checkbox “por vencer” en Usuarios)
- [ ] (Opc.) filtro / lista de soft-deleted
- [ ] (Opc.) audit log: quién cambió qué y cuándo
- [ ] (Opc.) mostrar nombre del coach (cuando el BE lo exponga)
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

## Plataforma / nice-to-have

- [ ] Token en cookie httpOnly (opc.)
- [ ] Historial de programas
- [ ] Sync tema/idioma al user en API (solo si cross-device) — ver **Configuración**
- [ ] Favoritos separados del plan
- [ ] Deep link más corto
- [ ] Tracking de workouts / progreso (genérico; fotos de progreso ya están)
