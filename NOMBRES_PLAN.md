# NOMBRES_PLAN.md — Normalización de nombres de médicos en `profiles`

> Objetivo: el nombre del médico tiene UNA sola fuente de verdad — tres columnas estructuradas
> (`nombres`, `apellido_paterno`, `apellido_materno`) + `titulo`. La app arma lo que necesite
> (nombre completo, o título + primer apellido) directamente desde ellas, en el punto de render.
> La columna legacy `nombre` se ELIMINA al final. Sin dual-write, sin espejo, sin parseo
> permanente, sin columnas duplicadas.

---

## Modelo objetivo (cómo debe quedar)

- Fuente de verdad = 3 columnas estructuradas en `profiles`: `nombres`, `apellido_paterno`,
  `apellido_materno` (nullable) + `titulo` (ya existe).
- El médico captura esos campos por separado al registrarse y en su perfil. Nunca se guarda un
  nombre pegado.
- La app arma al vuelo, en el punto de render, según necesidad:
  - Nombre completo (recetas, PDFs, documentos legales): titulo + nombres + apellido_paterno + apellido_materno.
  - Nombre corto (lista de médicos, chips, agenda): titulo + apellido_paterno.
  - Orden de médicos: por apellido_paterno.
- `nombre` legacy NO sobrevive: solo se mantiene como fallback de lectura DURANTE la transición,
  y se DROPEA en la última fase. No se sincroniza, no es fuente de verdad.

NO HAY dual-write, NO HAY espejo a `nombre`, NO HAY helper que parsee un string pegado.

---

## Orden de ejecución (re-secuenciado — lecturas antes que captura)

Fase 1 (esquema) ✅ → Fase 2 (migrar datos) → Fase 4 (migrar lecturas) → Fase 3 (captura/formularios)
→ Fase 5 (endpoint+orden) → Fase 6 (DROP nombre)

Razón del orden: migrar las lecturas a campos estructurados ANTES de abrir los formularios nuevos
permite que el registro nuevo capture campos separados y funcione de inmediato, SIN necesidad de
escribir `nombre` (sin espejo). Precondición dura: la Fase 2 debe estar 100% completa y verificada
(los 15 médicos con sus 3 campos poblados) ANTES de activar las lecturas nuevas en Fase 4, para que
ningún médico salga con nombre vacío.

---

## Por qué hay transición (y no se borra `nombre` el día 1)

Hoy las recetas, PDFs legales (NOM-004) y la agenda LEEN `profiles.nombre` ya compuesto. Si se
dropea antes de migrar quién lo lee, se rompe producción. Por eso: agregar columnas → migrar el
dato viejo → migrar las lecturas → migrar la captura → dropear `nombre`. Es para no romper.

---

## Decisiones congeladas

1. Solo se normaliza `profiles`. La tabla `pacientes` NO se toca.
2. Esquema: `titulo` (existe) + `nombres`, `apellido_paterno`, `apellido_materno` (materno nullable).
3. `nombre` legacy se elimina al final del proyecto (Fase 6 = parte del objetivo, no opcional).
4. La captura (registro/onboarding/perfil/alta-admin) escribe los 3 campos separados. No escribe
   un nombre pegado.
5. `apellido_materno` siempre nullable (extranjeros, apellido único, compuestos).

---

## Estado actual (hechos verificados)

- Fase 1 APLICADA: `profiles` ya tiene `nombres`, `apellido_paterno`, `apellido_materno` (text
  NULLABLE) y `nombre_confirmado` (boolean NOT NULL DEFAULT false). 19 filas: 15 role='medico',
  3 secretaria, 1 super_admin. Las 4 columnas nuevas vacías.
- Trigger `proteger_columnas_sensibles_profiles` (BEFORE UPDATE) protege solo role/clinica_id/
  es_admin_de_clinica. Las columnas de nombre NO están protegidas → editables por el médico.
- RLS `profiles_update`: el médico edita su propia fila a nivel fila (sin restricción por columna).
- El nombre se compone hoy en 4 sitios que leen `nombre`: `api/me/perfil-medico/route.ts:38`,
  `api/consultas/route.ts:123` (snapshot), `api/consultas/[id]/addendum/route.ts:80` (snapshot),
  `api/email/enviar-documento/route.ts:108`. Los PDFs leen `nombre` ya compuesto.
- Captura actual escribe `nombre`: `api/auth/registro`, `OnboardingModal`, `api/admin/crear-usuario`.
- `.order('nombre')` en `api/clinica/medicos/route.ts:22` y `AsistenteDashboard.tsx:63-64`.
- Snapshots NOM-004 (`consultas.medico_nombre`, `addendums.medico_nombre`, recetas) son
  inmutables y NO se re-derivan ni se tocan nunca.

---

## Fases

### Fase 1 — Esquema aditivo — ✅ HECHA
Columnas agregadas y verificadas. (`nombre_confirmado` queda disponible para marcar filas con
datos confiables; útil mientras `nombre` siga vivo.)

### Fase 2 — Migración de datos existentes (la migración real, no "sugerencia")
- Pasar los 15 médicos actuales de `nombre` → las 3 columnas estructuradas, UNA vez.
- UPDATEs explícitos por id, con valores ya resueltos y revisados a mano (no parser genérico en prod).
- Casos sucios (Dr. Prueba, Orto, "JUAREZALVARADO" pegado, inicial "M.") se resuelven a mano en el
  mismo set; no se fuerza heurística.
- `nombre`/`titulo` legacy NO se tocan (siguen alimentando los PDFs hasta Fase 4).
- Marcar `nombre_confirmado = true` en las filas migradas con dato bueno.
- ESTA FASE DEBE QUEDAR COMPLETA Y VERIFICADA ANTES DE LA FASE 4.

### Fase 4 — Migrar puntos de lectura a campos estructurados
- Los 4 sitios de composición + PDFs + agenda + recetas dejan de leer `nombre` y arman desde los
  3 campos: completo = titulo + nombres + apellido_paterno + apellido_materno; corto = titulo + apellido_paterno.
- Snapshots NOM-004 ya escritos NO se tocan (valor jurídico). Los snapshots NUEVOS se componen
  desde los campos estructurados.
- CUIDADO: los PDFs legales requieren el nombre completo correcto; verificar caso por caso con
  smoke test (generar receta de prueba y confirmar el nombre).

### Fase 3 — Captura nativa en los 3 campos (formularios)
- Registro, onboarding y alta-admin (panel del médico admin) dejan de capturar un nombre pegado y
  capturan `nombres` / `apellido_paterno` / `apellido_materno` por separado.
- "Mi Perfil" agrega edición de esos 3 campos (hoy no edita el nombre), para corregir casos mal
  capturados (p. ej. "Juárez Alvarado" pegado).
- Validación: `nombres` + `apellido_paterno` obligatorios; `apellido_materno` opcional.
- Validación server-side con allowlist explícita de columnas en el PUT `api/me/perfil-medico`
  (hoy escribe directo sin validar) y en los endpoints de alta.
- SIN espejo a `nombre`: como las lecturas (Fase 4) ya consumen los campos estructurados, la
  captura nueva NO necesita escribir `nombre`.

### Fase 5 — Endpoint `/api/clinica/medicos` + orden
- SELECT pasa a traer los 3 campos. `.order('nombre')` → `.order('apellido_paterno')`.
- Actualizar consumidores (QuickPatientModal, pacientes/nuevo, agenda).

### Fase 6 — DROP de `nombre` (cierre del objetivo, NO opcional)
- Precondición dura: CERO puntos de lectura/escritura dependiendo de `nombre`, todos los médicos
  con los 3 campos poblados.
- `ALTER TABLE profiles DROP COLUMN nombre`. Queda una sola fuente de verdad.

---

## Fuera de alcance
- Normalización de nombres en `pacientes`.

---

## Protocolos

### Producción — regla rectora
Base de datos en PRODUCCIÓN. No se aplica nada que pueda romperla. Ante duda no resuelta → NO-GO.

### Gate de auditoría obligatorio (todo script SQL o código nuevo)
1. Propuesta (Claude Code, read-only). 2. Auditoría de riesgos de ruptura. 3. Corrección.
4. Re-auditoría. 5. Aplicación solo con visto bueno. La auditoría de DB la corre Angel con
queries de lectura en el SQL Editor (Claude Code no usa CLI).

### Mitigación y rollback obligatorios (todo script SQL)
Cada script trae su mitigación (cuándo parar, qué revisar) y su rollback exacto validado de
antemano. Si no es razonablemente reversible, se rediseña o no se aplica.

### Protocolo D-T6 (ejecución)
Una query a la vez en SQL Editor (NUNCA CLI). Angel ejecuta, valida con Claude antes de la
siguiente, para y mitiga ante lo inesperado, smoke test tras cada cambio, luego valida en la app.

### División de ejecución
- Claude Code: investiga (read-only), propone scripts/diffs, audita, da mitigación y rollback.
  NUNCA ejecuta SQL, NUNCA git, NUNCA build/lint/tsc.
- Angel: corre build/lint/tsc en consola, ejecuta SQL en el editor una a una, hace git manual.

### Tracking de deuda
Transversal → DEUDA_TECNICA.md. Acotada a un sub-paso → "Fuera de alcance" de este plan.
