# Gym Data FE — TODO

Solo pendientes. Lo ya hecho: [FRONTEND-CAPACIDADES.md](./FRONTEND-CAPACIDADES.md).

---

## Prioridad

1. **Nutrición** — pauta alimenticia coach → atleta
2. **Onboarding coach** — wizard primer login
3. **PDF brand** — export con marca del coach
4. **Cuenta** — Configuración + dejar coach / acciones de perfil
5. **Coach polish** — duplicar sesión; upsell de cupo (opc.)

---

## Nutrición — pauta alimenticia (coach → atleta)

Mismo patrón que plan del coach: coach escribe, atleta lee.

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
