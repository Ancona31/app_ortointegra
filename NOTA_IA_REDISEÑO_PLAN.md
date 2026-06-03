# Rediseño del Modo IA — Nueva Nota Médica

> **Estado:** Planeación cerrada. Pendiente ejecución desde SF0. Última actualización: 2026-06-03.

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
- **Medicamentos (D1):** la tabla de terapéutica queda estructurada, FUERA del
  campo único. Se preserva el guardrail actual que prohíbe a Gemini mencionar
  fármacos en el plan.
- **CIE-10 (D2):** la IA propone código solo si lo halla con confianza; si no,
  registra el diagnóstico en texto sin código (mismo comportamiento que el
  campo manual sin selección de catálogo). Cero invención de códigos. El
  catálogo cat_cie10 queda para el modo manual futuro.
- **Revisión (D3):** la IA genera la nota; el médico la revisa, edita y decide
  si la guarda o la descarta en el panel inferior existente. La revisión debe
  permitir ver/corregir los diagnósticos y códigos extraídos, no solo la
  narrativa.
- **Entrevista:** si falta contexto crítico, la IA devuelve TODAS las preguntas
  en UNA sola tanda (no de a una). Si el texto viene completo, genera directo
  sin preguntar. Cada pregunta ofrece opciones + opción de texto libre.
- **Salida estructurada:** la IA devuelve JSON con narrativa (las 5 secciones,
  como hoy) + campos extraídos (motivo_consulta, exploracion_fisica,
  plan_tratamiento, diagnosticos[]) para poblar las columnas que hoy alimentan
  PDF, estadísticas y "último diagnóstico".
- **Modelo:** se mantiene Gemini (gemini-2.5-flash) por estar ya integrado con
  el pipeline de anonimización y la revisión regulatoria. No se cambia de
  proveedor en esta etapa. Nota: verificar migración de versión si aplica.
- **Backend stateless:** la conversación de la entrevista se mantiene en el
  cliente y se reenvía en cada llamada (mismo patrón que consulta-rapida). El
  servidor no almacena sesión.
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
      "diagnosticos": []
    }
  }
}
```
Notas: el responseSchema de Gemini no soporta uniones (oneOf); ambos campos
(preguntas y nota) van siempre presentes, status es el discriminador plano.
codigo_cie10 es opcional.

Mapeo a persistencia (tabla consultas): estructurado.* → columnas
homónimas; narrativa → notas_evolucion; preguntas[] no se persiste.
medicamentos, pronostico, proxima_cita siguen siendo entrada estructurada del
formulario, sin cambio.

## Plan de sub-fases
- **SF0 — Tipos + schema:** módulo neutro con tipos TS y responseSchema. Sin
  runtime.
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
  anonimización inline.
