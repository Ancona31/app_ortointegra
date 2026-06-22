# NOMBRES_PLAN.md — Normalización de nombres de médicos en `profiles`

> Objetivo: el nombre del médico tiene UNA sola fuente de verdad — tres columnas estructuradas
> (`nombres`, `apellido_paterno`, `apellido_materno`) + `titulo`. La app arma lo que necesite
> (completo, corto, o primer nombre) directamente desde ellas, en el punto de render, vía las
> funciones de src/lib/nombreMedico.ts. La columna legacy `nombre` se ELIMINA al final (Fase 6).
> Sin dual-write, sin espejo, sin parseo permanente.

---

## Estado actual (al cierre de Fase 4)

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
- Secretarias: título quitado (titulo=NULL) y nombres estructurados poblados manualmente.

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
- Estado: 3.A ✅ aplicada (Mi Perfil edita los 3 campos + validación Zod/allowlist en el PUT
  api/me/perfil-medico; deja de escribir `nombre`). GAP CONOCIDO que cierra 3.C: OnboardingModal
  paso 1 sigue mandando `nombre` pegado al mismo PUT; tras 3.A ese `nombre` se descarta (no se
  persiste) y el PUT responde 200 — es comportamiento esperado, NO un bug. 3.C migra onboarding
  a los 3 campos.
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
