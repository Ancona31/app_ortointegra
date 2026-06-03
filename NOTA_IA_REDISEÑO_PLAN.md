# Rediseño del Modo IA — Nueva Nota Médica

> **Estado:** SF0 y SF0.5 cerradas. App migrada a @google/genai (SDK viejo
> eliminado, IA muerta de consulta-rapida borrada). Pendiente ejecutar SF1
> (modelo 3.5 + JSON + medicamentos). Última actualización: 2026-06-03.

## Objetivo
Reducir la fricción del modo IA de la Nueva Nota Médica: reemplazar el
formulario de múltiples campos por una entrada de texto único, donde la IA
estructura la información, pregunta cuando falta contexto, y devuelve tanto la
nota narrativa como los campos estructurados para persistencia.

## Alcance y NO-alcance
- EN ALCANCE: rediseño del flujo del modo IA (entrada, generación, entrevista,
  persistencia estructurada).
- FUERA DE ALCANCE (etapa posterior): el modo manual se reemplazará por uno
  nuevo e independiente. El manual actual queda sentenciado; NO se protege su
  código durante esta etapa.
- FUERA DE ALCANCE (fase posterior): refinamiento clínico del prompt (NOM-004,
  estilo, contramedidas de error de la IA). Esta etapa solo construye el
  andamiaje estructural (que la IA emita JSON).

## Decisiones cerradas
- **Entrada única:** un solo textarea obligatorio reemplaza los campos
  narrativos del modo IA (motivo, exploración, gabinete, plan). NO puede ir
  vacío para generar.
- **Medicamentos (D1 — actualizada):** la IA extrae a la tabla estructurada
  de Terapéutica los medicamentos que el médico haya escrito en el texto de
  entrada (transcripción literal, NO invención). Si el médico no menciona
  medicamentos, la IA los omite. Soporta múltiples medicamentos (array). La
  IA NO infiere via_administracion: se mantiene el default 'Oral' y el médico
  ajusta excepciones. Queda DEROGADO el guardrail anterior que prohibía a la
  IA mencionar cualquier fármaco; el motivo original (la IA prescribía sin
  que el médico lo pidiera) queda igualmente cubierto, porque la IA solo
  transcribe lo que el médico ya escribió, nunca inventa prescripciones.
- **CIE-10 (D2):** la IA propone código solo si lo halla con confianza; si no,
  registra el diagnóstico en texto sin código (mismo comportamiento que el
  campo manual sin selección de catálogo). Cero invención de códigos. El
  catálogo cat_cie10 queda para el modo manual futuro.
- **Revisión (D3):** la IA genera la nota; el médico la revisa, edita y decide
  si la guarda o la descarta en el panel inferior existente. La revisión debe
  permitir ver/corregir los diagnósticos y códigos extraídos, no solo la
  narrativa.
  La confirmación de los medicamentos extraídos en el panel de revisión es
  OBLIGATORIA (no opcional), porque alimentan una receta real. Si la IA no
  está segura de un campo de un medicamento, debe dejarlo vacío para que el
  médico lo complete, nunca cruzar datos entre medicamentos ni inventar.
- **Entrevista:** si falta contexto crítico, la IA devuelve TODAS las preguntas
  en UNA sola tanda (no de a una). Si el texto viene completo, genera directo
  sin preguntar. Cada pregunta ofrece opciones + opción de texto libre.
- **Salida estructurada:** la IA devuelve JSON con narrativa (las 5 secciones,
  como hoy) + campos extraídos (motivo_consulta, exploracion_fisica,
  plan_tratamiento, diagnosticos[]) para poblar las columnas que hoy alimentan
  PDF, estadísticas y "último diagnóstico".
- **Modelo (actualizada):** se actualiza de gemini-2.5-flash a Gemini 3.5
  Flash, sujeto a verificación de acceso vía API y compatibilidad con
  responseSchema. Motivo: es el modelo que ofrece la velocidad y calidad
  objetivo (referencia: experiencia en la app web de Gemini). Si la
  verificación falla, se permanece en 2.5-flash y se reevalúa.
- **Razonamiento del modelo:** nivel medio/bajo, NO apagado. Objetivo: criterio
  clínico encendido (que la IA entienda el contexto, p. ej. implicaciones de
  comorbilidades) pero sin verborrea y con respuesta rápida (objetivo: pocos
  segundos).
- **Backend stateless:** la conversación de la entrevista se mantiene en el
  cliente y se reenvía en cada llamada (patrón stateless; el cliente mantiene
  el historial). El servidor no almacena sesión.
- **startChat desde el inicio:** el backend usa startChat + JSON desde la
  primera sub-fase (historial vacío en one-shot) para no reescribir la llamada
  dos veces.

## Contrato de datos (salida JSON de la IA)
```json
{
  "status": "completa | faltan_datos",
  "preguntas": [ { "id": "...", "pregunta": "...", "opciones": [], "permite_texto_libre": true } ],
  "nota": {
    "narrativa": "...",
    "estructurado": {
      "motivo_consulta": "...",
      "exploracion_fisica": "...",
      "plan_tratamiento": "...",
      "diagnosticos": [],
      "medicamentos": [
        { "nombre": "...", "dosis": "...", "frecuencia": "...", "duracion": "..." }
      ]
    }
  }
}
```
Notas: el responseSchema de Gemini no soporta uniones (oneOf); ambos campos
(preguntas y nota) van siempre presentes, status es el discriminador plano.
codigo_cie10 es opcional. nota.estructurado ahora incluye medicamentos[] (cada
uno { nombre, dosis, frecuencia, duracion }); via_administracion NO la genera
la IA (default 'Oral' en persistencia, ver Mapeo).

Mapeo a persistencia (tabla consultas): estructurado.* → columnas
homónimas; narrativa → notas_evolucion; preguntas[] no se persiste.
estructurado.medicamentos[] → columna medicamentos (jsonb) de la tabla
consultas, que pre-carga la receta. (Antes el plan decía que medicamentos era
entrada estructurada del formulario sin cambio; ahora la IA también puede
poblarlos. El médico confirma/edita antes de guardar.) pronostico y
proxima_cita siguen siendo entrada estructurada del formulario, sin cambio.

## Plan de sub-fases
- **SF0 — Tipos + schema:** módulo neutro con tipos TS y responseSchema. Sin
  runtime.
  - REQUIERE AMPLIACIÓN: el schema original no incluía medicamentos. Se
    añadirá el array medicamentos[] a NotaEstructurada y al responseSchema
    antes de SF1.
- **SF0.5 — Migración de SDK + limpieza (COMPLETADA):** se migró el único
  consumidor de IA vivo (/api/nota-medica) y el schema de SF0 del SDK EOL
  @google/generative-ai al nuevo @google/genai (pineado exacto 2.4.0). Se
  borró la IA muerta de consulta-rapida (ruta API + widget huérfano) y se
  limpiaron referencias inertes (rateLimit, sentryPiiFilter, SEGURIDAD.md).
  La migración fue swap puro: misma calidad de nota verificada por smoke
  test, sin cambio de modelo (seguía 2.5-flash) ni de formato. Desbloquea el
  uso de thinkingConfig nativo en SF1.
  - Nota: el modelo NO se cambió en SF0.5 (sigue 2.5-flash). El cambio a 3.5
    + JSON + medicamentos es SF1.
- **SF1 — Backend startChat + JSON:** /api/nota-medica migra a startChat con
  responseMimeType JSON + responseSchema, one-shot (historial vacío). Frontend
  mapea narrativa para no romper el preview; estructurado aún sin usar.
- **SF2 — Textarea único + persistencia estructurada:** reemplazar campos
  narrativos IA por un solo textarea; cablear estructurado → columnas en el
  guardado. (Fusionadas para no dejar un estado intermedio con columnas
  vacías.)
- **SF3 — Entrevista multi-turno:** historial en cliente, preguntas en una
  tanda, reenvío hasta status completa; anonimización inline por turno.
- **SF4 — Limpieza:** retirar estado/campos muertos; evaluar borrado de
  anonimizarHistorial si queda sin uso.

Cadena de dependencias: SF0 → SF1 → SF2 → SF3 → SF4.

## Bloqueantes de PUSH (no de desarrollo)
- Deuda de SF1: la IA extrae campos estructurados que no se consumen hasta SF2.
  Aceptable en local; SF1→SF2 deben ir seguidas, sin pushear a medias.
- Rate limit de entrevista: el límite actual es 20 llamadas/24h por usuario;
  una entrevista consume ≥2. Decidir el número final antes de producción.
- El estado del modo manual durante el desarrollo IA no importa en local; antes
  de pushear se decide si se oculta o se mantiene.

## Notas técnicas registradas (para fases futuras)
- El campo `analisis` se envía hoy a Gemini pero solo se edita en modo manual;
  en IA se manda vacío.
- gabinete_laboratorios y analisis no tienen columna propia en consultas; viven
  solo dentro de la narrativa.
- paciente (nombre), analisis, pronostico, proxima_cita se envían a
  /api/nota-medica pero el backend los ignora hoy.
- El nombre del paciente nunca llega a Gemini (se descarta server-side).
- consulta-rapida es el patrón de referencia para startChat + historial +
  anonimización inline. ⚠️ Eliminada en SF0.5: el patrón startChat ya NO se
  toma de consulta-rapida (borrada), sino de la documentación oficial de
  @google/genai (ai.chats.create) directamente.
- ✅ RESUELTA (SF0.5): el SDK @google/generative-ai estaba EOL y debía
  migrarse. Migración completada a @google/genai (pineado exacto 2.4.0); el
  SDK viejo fue desinstalado del árbol de dependencias.
- El parsing de medicamentos desde texto libre es el punto de mayor riesgo de
  error (cruce de datos entre varios medicamentos, campos mal asignados). La
  confirmación humana en el panel de revisión es la mitigación. El refinamiento
  del prompt para parsing robusto es de la fase de prompt posterior.
- DEUDA (no resuelta): la tabla de rate limits de IA en SEGURIDAD.md puede
  tener otra fila obsoleta (/api/labs-extract) cuya ruta ya no existe.
  Pendiente de revisión, fuera del alcance de este proyecto.
- DEUDA (no resuelta): quedan 22 vulnerabilidades de npm audit (16 moderate,
  6 high) preexistentes en el árbol de dependencias, ajenas a la migración.
  Pendiente revisar con npm audit (sin fix --force) como tarea aparte.
