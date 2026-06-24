# NOMBRES_PLAN.md — Normalización de nombres de médicos en `profiles`

> Objetivo: el nombre del médico tiene UNA sola fuente de verdad — tres columnas estructuradas
> (`nombres`, `apellido_paterno`, `apellido_materno`) + `titulo`. La app arma lo que necesite
> (completo, corto, o primer nombre) directamente desde ellas, en el punto de render, vía las
> funciones de src/lib/nombreMedico.ts. La columna legacy `nombre` se ELIMINA al final (Fase 6).
> Sin dual-write, sin espejo, sin parseo permanente.

---

## Estado actual — PROYECTO COMPLETO (Fase 1 → 6)

- Fase 1 ✅ esquema aditivo aplicado y verificado.
- Fase 2 ✅ datos migrados: 13 médicos + 3 secretarias poblados, nombre_confirmado=true. Cuentas
  basura (Dr. Prueba, Orto) quedan en NULL deliberadamente.
- Fase 4 ✅ COMPLETA (lecturas migradas a campos estructurados):
  - 4.A ✅ funciones componerNombreMedicoCompleto / componerNombreMedicoCorto + tipo CamposNombre
    (src/lib/nombreMedico.ts); MedicoInfo y PdfMedicoData con campos estructurados;
    api/me/perfil-medico compone desde estructura.
  - 4.B ✅ los 5 PDFs + 8 forms + ModalDocumentos componen desde estructura. Offline NO migrado
    (se acepta "Médico" en PDFs offline; la feature offline se eliminará).
  - 4.C ✅ snapshots consultas.medico_nombre y addendums.medico_nombre componen desde estructura
    (solo documentos nuevos; los viejos no se tocan). RecetaForm:255 ya correcto desde 4.A.
  - 4.D ✅ displays migrados con mapa de formato por display (ver abajo). Interface Profile
    extendida con los 3 campos estructurados.
- Fase 3 ✅ COMPLETA (captura migrada a campos estructurados):
  - 3.A ✅ Mi Perfil edita los 3 campos + validación Zod/allowlist en el PUT api/me/perfil-medico.
  - 3.B ✅ alta-admin y registro capturan 3 campos; regla secretaria-sin-título (titulo NULL
    explícito anula el DEFAULT 'Dr.'); nombre_confirmado condicional (secretaria true, médico
    invitado false); GET admin/usuarios compone el nombre. Validado: secretaria→titulo NULL,
    médico invitado→nombre_confirmado=false. Registro nuevo NO probado en vivo (se validará al
    pushear; el código es simétrico a crear-usuario, ya validado).
  - 3.C ✅ OnboardingModal captura 3 campos (cierra el gap de 3.A); fix de estado-perfil
    (completitud lee `nombres`, no `nombre` legacy → corrige banner/modal que nunca desaparecían).
    Validado en local: onboarding guarda 3 campos + nombre_confirmado=true; banner desaparece.
- Secretarias: título quitado (titulo=NULL) y nombres estructurados poblados manualmente.
- Fase 5 ✅ COMPLETA (últimos lectores migrados + auditoría DB):
  - 5.A ✅ /api/clinica/medicos + agenda (dropdowns COMPLETO, iniciales chip vía
    componerInicialesMedico) + join appointments. Commit f4ca00b.
  - 5.B ✅ email/enviar-documento compone nombre + order por apellido_paterno en
    AsistenteDashboard + limpieza de 3 SELECTs inertes. Commit eb86fe0.
  - 5.C ✅ super-admin (5 endpoints: metricas, clinicas, dashboard/usuarios, audit,
    clinicas/[id]) + Stripe checkout componen desde estructura + quita Profile.nombre del tipo.
    Quita pre-filtro .ilike('nombre') de usuarios (corrige bug de búsqueda por email). Commit
    de6268e. Grep-cero confirmado: ningún código lee profiles.nombre.
  - 5.D ✅ Auditoría DB: DROP de la vista huérfana audit_log_view + recreación de sa_top_medicos
    componiendo desde estructura. RLS/columnas generadas/constraints/índices: sin dependencias.
    pg_depend y publicación realtime sobre profiles.nombre: cero.
- Fase 6 ✅ COMPLETA: DROP COLUMN nombre ejecutado en prod (sin respaldo, decisión auditada).
  Smoke test en vivo (6 pruebas) pasa. Migraciones versionadas (nombres_01..04) + baseline
  sincronizado (02_tables sin nombre, 05_functions con sa_top_medicos nuevo, 08_view sin
  audit_log_view, README actualizado).
- RESULTADO: el nombre del médico tiene UNA sola fuente de verdad (titulo + nombres +
  apellido_paterno + apellido_materno), compuesta en el punto de render vía
  src/lib/nombreMedico.ts. La columna legacy `nombre` ya no existe. Sin dual-write, sin espejo,
  sin parseo permanente. OBJETIVO CUMPLIDO.

## Mapa de formato por display (decidido en 4.D)
- Dashboard saludo: PRIMER NOMBRE.
- Dashboard médico en próxima cita: CORTO (titulo + apellido_paterno).
- AsistenteDashboard dropdown + cita: COMPLETO.
- Sidebar: COMPLETO.
- Mi Perfil preview de PDF: COMPLETO (+ fallback 'Médico', replica PdfHeader).
- Launcher /inicio: PRIMER NOMBRE.
- REGLA GENERAL para dropdowns de selección de médico: COMPLETO (por riesgo de apellidos
  repetidos en la clínica — la secretaria debe poder distinguir médicos homónimos).

---

## Decisiones congeladas

1. Solo se normaliza `profiles`. La tabla `pacientes` NO se toca.
2. Esquema: `titulo` + `nombres`, `apellido_paterno`, `apellido_materno` (materno nullable).
3. `nombre` legacy se elimina al final (Fase 6, no opcional).
4. La captura escribe los 3 campos separados. No escribe un nombre pegado.
5. `apellido_materno` siempre nullable.
6. Secretarias (y no-médicos) NO llevan título. La captura (Fase 3) no debe asignarles título.

---

## Orden de ejecución (re-secuenciado)
Fase 1 ✅ → Fase 2 ✅ → Fase 4 ✅ → **Fase 3 (siguiente)** → Fase 5 → Fase 6.
Razón: migrar lecturas (4) antes de captura (3) permite que la captura nueva funcione de inmediato
sin escribir `nombre`. Precondición cumplida: los médicos tienen sus 3 campos poblados.

Control operacional: no se dan de alta médicos nuevos hasta completar Fase 3 (evita snapshots con
nombre vacío en la ventana 4→3). El owner controla las altas (solo betatesters, ninguno nuevo
previsto).

---

## Fase 3 — Captura nativa en los 3 campos (SIGUIENTE)
- Estado: ✅ COMPLETA (3.A + 3.B + 3.C). Gap de onboarding CERRADO en 3.C.
- Registro, onboarding y alta-admin (panel del médico admin) capturan nombres / apellido_paterno /
  apellido_materno por separado. Dejan de escribir un nombre pegado.
- "Mi Perfil" agrega edición de esos 3 campos (hoy no edita el nombre).
- Validación: nombres + apellido_paterno obligatorios; apellido_materno opcional.
- Validación server-side con allowlist explícita de columnas en el PUT api/me/perfil-medico (hoy
  escribe directo sin validar) y en los endpoints de alta.
- SECRETARIAS / NO-MÉDICOS SIN TÍTULO: el alta de una secretaria no debe asignar título (titulo
  NULL o no capturado). Resolver en los formularios de captura.
- SIN espejo a `nombre`: como las lecturas (Fase 4) ya consumen estructura, la captura NO escribe
  `nombre`.
- Follow-up del preview de perfil: cuando el form edite los campos de nombre, el preview (:568)
  debe usar form.* en vez de profile.* para reaccionar en vivo mientras se escribe.

## Fase 5 — Endpoints + orden + agenda
- /api/clinica/medicos: SELECT pasa a traer los campos estructurados; .order('nombre') →
  .order('apellido_paterno'). Actualizar consumidores.
- Migrar displays diferidos de 4.D (dependen de los endpoints compartidos):
  - Agenda: dropdowns de médico (COMPLETO) e iniciales de chip (componer desde nombres[0]+
    apellido_paterno[0], NO slice(0,2) del string corto).
  - QuickPatientModal, pacientes/nuevo: dropdowns de médico en COMPLETO.
- AsistenteDashboard:55 .order('nombre') → migrar a apellido_paterno aquí.
- api/email/enviar-documento:108 (lee profile.nombre en vivo) → migrar a composición estructurada.
- Joins vivos de appointments que aún seleccionen profiles.nombre → migrar.

## Fase 6 — DROP de `nombre` (cierre, NO opcional)
- Precondición: CERO lecturas/escrituras de `nombre` en la app; todos los médicos con 3 campos.
- Pendientes conocidos a cerrar antes del DROP: stripe/checkout:60 (fallback profile.nombre),
  cualquier SELECT que aún incluya `nombre` (inerte pero presente).
- `ALTER TABLE profiles DROP COLUMN nombre`. Una sola fuente de verdad.

---

## Pendientes descubiertos (fuera del proyecto de nombres)
- Redundancia registro↔onboarding: el registro y el onboarding piden ambos título+nombre+
  especialidad. Es rediseño de flujo de alta (decisión de producto), NO parte de la
  normalización de nombres. Analizar aparte.
- Login con Google (OAuth): planeado; cambia cómo se capturan los nombres en el alta (no pasa
  por el formulario). Interactúa con esta normalización pero es proyecto separado.
- Cuentas creadas por el registro VIEJO (desplegado) tienen `nombre` legacy poblado; se
  resolverán al pushear el código nuevo. Verificar antes de Fase 6 que no queden escritores de
  `nombre` activos en producción.
- PUSH PENDIENTE: ~13 commits locales sin pushear (push diferido). origin/main sigue en 5316cf7.
  Nada de este proyecto está desplegado aún.
- Dato sucio: la cuenta de superadmin tiene apellido con guión literal "-" (sale "Dr. Superadmin
  -" en el ranking de Uso). Cosmético, limpiar cuando convenga.
- Cuentas de prueba creadas por registro VIEJO desplegado dejaban clínicas huérfanas; se
  limpiaron 4 en esta sesión. El flujo de borrado de cuentas no elimina la fila de clinicas —
  revisar si hay un endpoint de borrado o si es manual.
- Smoke test de super-admin (5.C) en vivo: validado en esta sesión junto al smoke test post-DROP.

## Fuera de alcance
- Normalización de nombres en `pacientes`.
- Migración del modo offline (la feature se eliminará).

---

## Protocolos

### Producción — regla rectora
Base de datos en PRODUCCIÓN. No se aplica nada que pueda romperla. Ante duda no resuelta → NO-GO.

### Gate de auditoría obligatorio (todo script SQL o código nuevo)
1. Propuesta (Claude Code, read-only). 2. Auditoría de riesgos. 3. Corrección. 4. Re-auditoría.
5. Aplicación solo con visto bueno. Decisiones de diseño no triviales → consulta de arquitectura
primero. La auditoría de DB la corre Angel con queries de lectura en el SQL Editor.

### Mitigación y rollback obligatorios (todo script SQL)
Cada script trae mitigación y rollback exacto validado de antemano.

### Protocolo D-T6 (ejecución)
Una query a la vez en SQL Editor (NUNCA CLI). Angel ejecuta, valida con Claude antes de la
siguiente, smoke test tras cada cambio, luego valida en la app.

### División de ejecución
- Claude Code: investiga (read-only), propone diffs/scripts, audita. NUNCA git/build/lint/tsc/SQL.
- Angel: corre build/lint/tsc, ejecuta SQL, hace git manual. Push diferido: TODO se pushea al
  terminar todas las fases (se acumulan commits en local).

### Tracking de deuda
Transversal → DEUDA_TECNICA.md. Acotada a un sub-paso → "Fuera de alcance" de este plan.
