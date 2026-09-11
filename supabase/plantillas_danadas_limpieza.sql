-- ============================================================================
-- PLANTILLAS DAÑADAS · identificar y borrar
--
-- NO ES UNA MIGRACIÓN Y NO SE APLICA SOLA. Son dos consultas sueltas para el
-- SQL Editor. La 1 no cambia nada: córrela, LEE LA SALIDA, y solo entonces
-- corre la 2.
--
-- QUÉ ES UNA PLANTILLA DAÑADA. Una fila cuyo `contenido` equivale al de un
-- formulario VACÍO de su tipo: aplicarla no aporta nada. Existen porque
-- «Guardar como plantilla» se gateaba con «¿hay algo escrito en el formulario?»
-- en vez de «¿hay algo escrito que la plantilla vaya a guardar?». El médico
-- llenaba campos NO plantillables —los testigos y el familiar del
-- consentimiento, el bloque de seguro de honorarios—, el botón se encendía, y
-- la fila iba a la base vacía mientras el toast decía «Plantilla guardada».
--
-- «EQUIVALE AL VACÍO» ES DISTINTO POR TIPO, y por eso esto no es un
-- `WHERE contenido = '{}'`:
--   · El consentimiento vacío NO es un objeto vacío: es `lugar` y
--     `procedimiento` en blanco con las SIETE secciones en su valor por
--     defecto —cinco traen texto legal precargado, dos nacen vacías—.
--   · El internamiento vacío trae las instrucciones al paciente precargadas.
--   · Honorarios vacío trae tipo «honorarios», divisa MXN, forma de pago
--     «Efectivo» y vigencia 30 días.
--
-- EL `_v` NO CUENTA COMO CONTENIDO: es la versión del formato, la escribe el
-- hook siempre, y una fila cuyo único campo es `_v` está vacía por definición.
-- Todo lo de abajo lo ignora. Una clave AUSENTE se trata como su valor vacío,
-- que es lo que hace el formulario al aplicar: las plantillas guardadas antes
-- de cada cambio de formato no traen las claves nuevas (un consentimiento
-- anterior a este pase no lleva `testigo1` ni `testigo2`, y puede llevar un
-- `imprimirDenegacion` muerto, que se ignora igual que lo ignora el código).
--
-- LOS TEXTOS POR DEFECTO están copiados LITERALES del código de hoy
-- (`ConsentimientoInformadoForm.tsx` y `SolicitudInternamientoForm.tsx`). Si
-- alguno cambia más adelante, esta consulta deja de reconocer las filas viejas:
-- es una limpieza de una vez, no una vista permanente.
--
-- ALCANCE. Sin filtro de `user_id`: barre las de TODOS los médicos. Para ir
-- médico a médico, descomenta la línea marcada — EN LAS DOS CONSULTAS, o la 2
-- borrará más de lo que la 1 te enseñó.
--
-- POR QUÉ NO HAY CASTS NI `jsonb_array_length` AQUÍ. Un `->>'urgente'` que
-- resultara no ser booleano, o un `->'estudios'` que no fuera un array,
-- abortarían la consulta entera en vez de marcar esa fila. Todo se compara con
-- igualdad de `jsonb`, que no lanza con ningún valor. Lo peor que puede pasar
-- con una fila rara es que se considere CON contenido, o sea que no se borre.
-- ============================================================================


-- ── CONSULTA 1 · IDENTIFICAR ─────────────────────────────────────────────────
-- No cambia nada. Una fila por plantilla dañada, con el motivo.
-- Si devuelve 0 filas, no hay nada que borrar y la consulta 2 no se corre.

WITH danadas AS (
  SELECT
    p.id,
    p.tipo,
    p.nombre,
    p.created_at,
    p.updated_at,
    -- QUÉ LLEVA la plantilla. Un elemento por campo plantillable con algo
    -- dentro. Array vacío = plantilla vacía: esa es la definición entera, y de
    -- paso es la columna que explica el veredicto.
    ARRAY_REMOVE(ARRAY[

      -- ── receta ──
      CASE WHEN p.tipo = 'receta'
            AND COALESCE(p.contenido->'medicamentos', '[]'::jsonb) <> '[]'::jsonb
           THEN 'medicamentos' END,
      CASE WHEN p.tipo = 'receta'
            AND btrim(COALESCE(p.contenido->>'recomendaciones', '')) <> ''
           THEN 'recomendaciones' END,

      -- ── solicitud_lab ──
      CASE WHEN p.tipo = 'solicitud_lab'
            AND COALESCE(p.contenido->'estudios', '[]'::jsonb) <> '[]'::jsonb
           THEN 'estudios' END,
      CASE WHEN p.tipo = 'solicitud_lab'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,

      -- ── solicitud_imagen ──
      CASE WHEN p.tipo = 'solicitud_imagen'
            AND COALESCE(p.contenido->'estudios', '[]'::jsonb) <> '[]'::jsonb
           THEN 'estudios' END,
      CASE WHEN p.tipo = 'solicitud_imagen'
            AND COALESCE(p.contenido->'urgente', 'false'::jsonb) <> 'false'::jsonb
           THEN 'urgente' END,

      -- ── plan_suplementacion ──
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND COALESCE(p.contenido->'seleccionados', '[]'::jsonb) <> '[]'::jsonb
           THEN 'seleccionados' END,
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND btrim(COALESCE(p.contenido->>'seguimiento', '')) <> ''
           THEN 'seguimiento' END,

      -- ── solicitud_internamiento ──
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'tipoInternamiento', '')) <> ''
           THEN 'tipoInternamiento' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'diasEstimados', '')) <> ''
           THEN 'diasEstimados' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'asa', '')) <> ''
           THEN 'asa' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'lugar', '')) <> ''
           THEN 'lugar' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'procedimiento', '')) <> ''
           THEN 'procedimiento' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'urgente', 'false'::jsonb) <> 'false'::jsonb
           THEN 'urgente' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'requerimientos', '[]'::jsonb) <> '[]'::jsonb
           THEN 'requerimientos' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'requerimientosExtra', '')) <> ''
           THEN 'requerimientosExtra' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'justificacion', '')) <> ''
           THEN 'justificacion' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'gruposPiso', '[]'::jsonb) <> '[]'::jsonb
           THEN 'gruposPiso' END,
      -- Precargadas: solo cuentan si difieren del texto de fábrica.
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->>'instruccionesPaciente', $instr$• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.$instr$) <> $instr$• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.$instr$
           THEN 'instruccionesPaciente' END,

      -- ── escrito_medico ──
      CASE WHEN p.tipo = 'escrito_medico'
            AND btrim(COALESCE(p.contenido->>'asunto', '')) <> ''
           THEN 'asunto' END,
      CASE WHEN p.tipo = 'escrito_medico'
            AND btrim(COALESCE(p.contenido->>'piePropio', '')) <> ''
           THEN 'piePropio' END,
      -- Nace ENGANCHADO al pie del perfil: desengancharlo es una decisión, y
      -- por tanto contenido.
      CASE WHEN p.tipo = 'escrito_medico'
            AND COALESCE(p.contenido->'pieEnganchado', 'true'::jsonb) <> 'true'::jsonb
           THEN 'pieEnganchado' END,
      -- El cuerpo es un documento de ProseMirror. Lleva algo si aparece un solo
      -- nodo de texto, y un nodo de texto es lo único que trae la clave "text":
      -- el documento vacío es un párrafo sin hijos, y el hook guarda `null`
      -- mientras TipTap no ha montado. Se mira sobre el JSON serializado en vez
      -- de recorrer el árbol porque la profundidad del nodo es arbitraria.
      CASE WHEN p.tipo = 'escrito_medico'
            AND COALESCE(p.contenido->>'doc', '') LIKE '%"text"%'
           THEN 'doc' END,

      -- ── nota_honorarios ──
      -- OJO: aquí «vacío» incluye las cuatro preferencias con valor de fábrica.
      -- Una plantilla de COTIZACIÓN sin líneas NO se considera dañada: el tipo
      -- viaja en el contenido a propósito —una cotización lo es entera, con su
      -- vigencia— y cambiarlo es una decisión del médico. Lo mismo con divisa,
      -- forma de pago y vigencia.
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->'lineas', '[]'::jsonb) <> '[]'::jsonb
           THEN 'lineas' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'tipo_doc', 'honorarios') <> 'honorarios'
           THEN 'tipo_doc' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'divisa', 'MXN') <> 'MXN'
           THEN 'divisa' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'forma_pago', 'Efectivo') <> 'Efectivo'
           THEN 'forma_pago' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->'vigencia_dias', '30'::jsonb) <> '30'::jsonb
           THEN 'vigencia_dias' END,

      -- ── consentimiento_informado ──
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'lugar', '')) <> ''
           THEN 'lugar' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'procedimiento', '')) <> ''
           THEN 'procedimiento' END,
      -- Los testigos entran en la plantilla desde este mismo pase: las filas
      -- anteriores no traen las claves, y el COALESCE las cuenta como vacías.
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'testigo1', '')) <> ''
           THEN 'testigo1' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'testigo2', '')) <> ''
           THEN 'testigo2' END,
      -- Las SIETE secciones, cada una contra SU valor por defecto. Las dos que
      -- nacen vacías —descripcion y riesgosEspecificos— cuentan si traen algo.
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'preoperatorio', $sec$Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.$sec$) <> $sec$Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.$sec$
           THEN 'seccion.preoperatorio' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'beneficios', $sec$El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.$sec$) <> $sec$El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.$sec$
           THEN 'seccion.beneficios' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'anestesia', $sec$La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.$sec$) <> $sec$La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.$sec$
           THEN 'seccion.anestesia' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->'secciones'->>'descripcion', '')) <> ''
           THEN 'seccion.descripcion' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'riesgosComunes', $sec$Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.

Cuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.$sec$) <> $sec$Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.

Cuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.$sec$
           THEN 'seccion.riesgosComunes' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->'secciones'->>'riesgosEspecificos', '')) <> ''
           THEN 'seccion.riesgosEspecificos' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'alternativas', $sec$Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.$sec$) <> $sec$Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.$sec$
           THEN 'seccion.alternativas' END,

      -- ── RED DE SEGURIDAD ──
      -- Un tipo que esta consulta no cubra sale marcado, y por tanto NUNCA se
      -- borra. Si el CHECK de la tabla crece y esto no, el fallo es no borrar.
      CASE WHEN p.tipo NOT IN (
             'receta', 'solicitud_lab', 'solicitud_imagen', 'plan_suplementacion',
             'solicitud_internamiento', 'escrito_medico', 'consentimiento_informado',
             'nota_honorarios')
           THEN 'tipo-no-cubierto-por-esta-consulta' END

    ]::text[], NULL::text) AS lleva
  FROM public.plantillas_documento p
  -- WHERE p.user_id = '<uuid-del-medico>'::uuid   -- ← acotar a UN médico
)
SELECT
  d.tipo,
  d.nombre,
  d.created_at AS creada,
  d.updated_at AS ultima_escritura,
  CASE
    -- El `- '_v'` solo es legal sobre un objeto, y por eso va detrás del
    -- jsonb_typeof: un contenido que no lo fuera abortaría la consulta entera.
    WHEN jsonb_typeof(p.contenido) = 'object' AND (p.contenido - '_v') = '{}'::jsonb
      THEN 'contenido vacío: no tiene ninguna clave aparte de _v'
    ELSE 'equivale al formulario vacío de su tipo: ningún campo plantillable '
      || 'lleva nada, y los precargados siguen en su texto por defecto'
  END AS motivo,
  d.id
FROM danadas d
JOIN public.plantillas_documento p ON p.id = d.id
WHERE cardinality(d.lleva) = 0
ORDER BY d.tipo, d.nombre;


-- ── CONSULTA 2 · BORRAR ──────────────────────────────────────────────────────
-- Solo después de leer la salida de la 1. Acotada EXACTAMENTE a lo que la 1
-- devuelve: mismo CTE, mismo `cardinality(lleva) = 0`. Si acotaste la 1 por
-- `user_id`, descomenta aquí la misma línea.
--
-- El RETURNING deja constancia de qué se llevó por delante. Para ensayarlo sin
-- consecuencias: envuélvelo en BEGIN; … ROLLBACK; y compara el recuento con el
-- de la consulta 1.

WITH danadas AS (
  SELECT
    p.id,
    p.tipo,
    p.nombre,
    p.created_at,
    p.updated_at,
    -- QUÉ LLEVA la plantilla. Un elemento por campo plantillable con algo
    -- dentro. Array vacío = plantilla vacía: esa es la definición entera, y de
    -- paso es la columna que explica el veredicto.
    ARRAY_REMOVE(ARRAY[

      -- ── receta ──
      CASE WHEN p.tipo = 'receta'
            AND COALESCE(p.contenido->'medicamentos', '[]'::jsonb) <> '[]'::jsonb
           THEN 'medicamentos' END,
      CASE WHEN p.tipo = 'receta'
            AND btrim(COALESCE(p.contenido->>'recomendaciones', '')) <> ''
           THEN 'recomendaciones' END,

      -- ── solicitud_lab ──
      CASE WHEN p.tipo = 'solicitud_lab'
            AND COALESCE(p.contenido->'estudios', '[]'::jsonb) <> '[]'::jsonb
           THEN 'estudios' END,
      CASE WHEN p.tipo = 'solicitud_lab'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,

      -- ── solicitud_imagen ──
      CASE WHEN p.tipo = 'solicitud_imagen'
            AND COALESCE(p.contenido->'estudios', '[]'::jsonb) <> '[]'::jsonb
           THEN 'estudios' END,
      CASE WHEN p.tipo = 'solicitud_imagen'
            AND COALESCE(p.contenido->'urgente', 'false'::jsonb) <> 'false'::jsonb
           THEN 'urgente' END,

      -- ── plan_suplementacion ──
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND COALESCE(p.contenido->'seleccionados', '[]'::jsonb) <> '[]'::jsonb
           THEN 'seleccionados' END,
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,
      CASE WHEN p.tipo = 'plan_suplementacion'
            AND btrim(COALESCE(p.contenido->>'seguimiento', '')) <> ''
           THEN 'seguimiento' END,

      -- ── solicitud_internamiento ──
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'tipoInternamiento', '')) <> ''
           THEN 'tipoInternamiento' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'diasEstimados', '')) <> ''
           THEN 'diasEstimados' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'asa', '')) <> ''
           THEN 'asa' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'lugar', '')) <> ''
           THEN 'lugar' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'procedimiento', '')) <> ''
           THEN 'procedimiento' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'urgente', 'false'::jsonb) <> 'false'::jsonb
           THEN 'urgente' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'requerimientos', '[]'::jsonb) <> '[]'::jsonb
           THEN 'requerimientos' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'requerimientosExtra', '')) <> ''
           THEN 'requerimientosExtra' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND btrim(COALESCE(p.contenido->>'justificacion', '')) <> ''
           THEN 'justificacion' END,
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->'gruposPiso', '[]'::jsonb) <> '[]'::jsonb
           THEN 'gruposPiso' END,
      -- Precargadas: solo cuentan si difieren del texto de fábrica.
      CASE WHEN p.tipo = 'solicitud_internamiento'
            AND COALESCE(p.contenido->>'instruccionesPaciente', $instr$• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.$instr$) <> $instr$• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.$instr$
           THEN 'instruccionesPaciente' END,

      -- ── escrito_medico ──
      CASE WHEN p.tipo = 'escrito_medico'
            AND btrim(COALESCE(p.contenido->>'asunto', '')) <> ''
           THEN 'asunto' END,
      CASE WHEN p.tipo = 'escrito_medico'
            AND btrim(COALESCE(p.contenido->>'piePropio', '')) <> ''
           THEN 'piePropio' END,
      -- Nace ENGANCHADO al pie del perfil: desengancharlo es una decisión, y
      -- por tanto contenido.
      CASE WHEN p.tipo = 'escrito_medico'
            AND COALESCE(p.contenido->'pieEnganchado', 'true'::jsonb) <> 'true'::jsonb
           THEN 'pieEnganchado' END,
      -- El cuerpo es un documento de ProseMirror. Lleva algo si aparece un solo
      -- nodo de texto, y un nodo de texto es lo único que trae la clave "text":
      -- el documento vacío es un párrafo sin hijos, y el hook guarda `null`
      -- mientras TipTap no ha montado. Se mira sobre el JSON serializado en vez
      -- de recorrer el árbol porque la profundidad del nodo es arbitraria.
      CASE WHEN p.tipo = 'escrito_medico'
            AND COALESCE(p.contenido->>'doc', '') LIKE '%"text"%'
           THEN 'doc' END,

      -- ── nota_honorarios ──
      -- OJO: aquí «vacío» incluye las cuatro preferencias con valor de fábrica.
      -- Una plantilla de COTIZACIÓN sin líneas NO se considera dañada: el tipo
      -- viaja en el contenido a propósito —una cotización lo es entera, con su
      -- vigencia— y cambiarlo es una decisión del médico. Lo mismo con divisa,
      -- forma de pago y vigencia.
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->'lineas', '[]'::jsonb) <> '[]'::jsonb
           THEN 'lineas' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND btrim(COALESCE(p.contenido->>'notas', '')) <> ''
           THEN 'notas' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'tipo_doc', 'honorarios') <> 'honorarios'
           THEN 'tipo_doc' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'divisa', 'MXN') <> 'MXN'
           THEN 'divisa' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->>'forma_pago', 'Efectivo') <> 'Efectivo'
           THEN 'forma_pago' END,
      CASE WHEN p.tipo = 'nota_honorarios'
            AND COALESCE(p.contenido->'vigencia_dias', '30'::jsonb) <> '30'::jsonb
           THEN 'vigencia_dias' END,

      -- ── consentimiento_informado ──
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'lugar', '')) <> ''
           THEN 'lugar' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'procedimiento', '')) <> ''
           THEN 'procedimiento' END,
      -- Los testigos entran en la plantilla desde este mismo pase: las filas
      -- anteriores no traen las claves, y el COALESCE las cuenta como vacías.
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'testigo1', '')) <> ''
           THEN 'testigo1' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->>'testigo2', '')) <> ''
           THEN 'testigo2' END,
      -- Las SIETE secciones, cada una contra SU valor por defecto. Las dos que
      -- nacen vacías —descripcion y riesgosEspecificos— cuentan si traen algo.
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'preoperatorio', $sec$Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.$sec$) <> $sec$Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.$sec$
           THEN 'seccion.preoperatorio' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'beneficios', $sec$El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.$sec$) <> $sec$El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.$sec$
           THEN 'seccion.beneficios' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'anestesia', $sec$La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.$sec$) <> $sec$La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.$sec$
           THEN 'seccion.anestesia' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->'secciones'->>'descripcion', '')) <> ''
           THEN 'seccion.descripcion' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'riesgosComunes', $sec$Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.

Cuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.$sec$) <> $sec$Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.

Cuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.$sec$
           THEN 'seccion.riesgosComunes' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND btrim(COALESCE(p.contenido->'secciones'->>'riesgosEspecificos', '')) <> ''
           THEN 'seccion.riesgosEspecificos' END,
      CASE WHEN p.tipo = 'consentimiento_informado'
            AND COALESCE(p.contenido->'secciones'->>'alternativas', $sec$Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.$sec$) <> $sec$Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.$sec$
           THEN 'seccion.alternativas' END,

      -- ── RED DE SEGURIDAD ──
      -- Un tipo que esta consulta no cubra sale marcado, y por tanto NUNCA se
      -- borra. Si el CHECK de la tabla crece y esto no, el fallo es no borrar.
      CASE WHEN p.tipo NOT IN (
             'receta', 'solicitud_lab', 'solicitud_imagen', 'plan_suplementacion',
             'solicitud_internamiento', 'escrito_medico', 'consentimiento_informado',
             'nota_honorarios')
           THEN 'tipo-no-cubierto-por-esta-consulta' END

    ]::text[], NULL::text) AS lleva
  FROM public.plantillas_documento p
  -- WHERE p.user_id = '<uuid-del-medico>'::uuid   -- ← acotar a UN médico
)
DELETE FROM public.plantillas_documento p
USING danadas d
WHERE p.id = d.id
  AND cardinality(d.lleva) = 0
RETURNING p.id, p.tipo, p.nombre, p.created_at;
