-- =============================================================================
-- 20260624_nombres_04_drop_columna_nombre.sql
--
-- Fase 6 (cierre) del proyecto de normalización de nombres (NOMBRES_PLAN.md).
--
-- Elimina la columna legacy public.profiles.nombre. El nombre del médico pasa
-- a tener UNA sola fuente de verdad: las 4 columnas estructuradas
-- (titulo + nombres + apellido_paterno + apellido_materno), compuestas en el
-- punto de render vía src/lib/nombreMedico.ts.
--
-- Precondición satisfecha (CERO lecturas/escrituras de profiles.nombre):
--   - CÓDIGO: Fases 5.A/5.B/5.C migraron todos los lectores; grep-cero
--     confirmado. Ningún .from('profiles').select(...nombre...) ni display de
--     profile.nombre (los aparentes restos —offline DoctorProfile, u.nombre
--     compuesto en super-admin— son valores compuestos/localStorage, no la
--     columna). El tipo Profile.nombre se quitó en 5.C.
--   - DB: Fase 5.D barrió vistas, funciones/triggers, RLS, columnas generadas,
--     constraints e índices. Dependientes encontrados y resueltos:
--     audit_log_view (dropeada, nombres_02) y sa_top_medicos (recreada para
--     componer desde estructura, nombres_03). Verificación final pg_depend
--     sobre profiles.nombre (deptype <> 'i') = CERO filas. Publicación
--     realtime verificada sin referencia a la columna.
--
-- Decisión auditada: SIN respaldo. El dato con valor ya está migrado (mejor
-- estructurado) a las 4 columnas; lo único exclusivo del `nombre` legacy era
-- basura (cuentas de prueba / registros viejos de clínicas huérfanas ya
-- borradas). profiles.nombre es el nombre del médico (usuario), NO contenido
-- del expediente: la identificación del médico tratante exigida por
-- NOM-004/NOM-024 se cumple vía las columnas estructuradas + PDFs persistidos +
-- audit_log. Bajo LFPDPPP, un respaldo redundante sería deuda y superficie de
-- exposición de datos personales sin obligación de retención.
--
-- ESTADO: ya aplicada en producción (DROP envuelto en transacción, columna
-- verificada inexistente; smoke test de 6 pruebas OK). Versionada
-- retroactivamente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles DROP COLUMN nombre;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Recrea la columna VACÍA (nullable, sin default), compatible con su estructura
-- original en el baseline. NO recupera datos: es suficiente porque ningún
-- consumidor lee la columna. Bloque comentado para evitar ejecución silenciosa.
--
-- ALTER TABLE public.profiles ADD COLUMN nombre text;
