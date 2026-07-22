import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, ThinkingLevel, FinishReason, type Content } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { sanitizePromptInput, sanitizeNumber } from '@/lib/sanitize'
import { anonimizarTexto, anonimizarHistorial } from '@/lib/anonimizar'
import { notaIAResponseSchema, medicamentosExtraccionSchema, type NotaIAResponse, type NotaIAContenido, type MedicamentoIA, type MedicamentosExtraccion } from '@/lib/notaIA/schema'
import { logger } from '@/lib/logger'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Separa profiles.especialidad (separador inconsistente: ' · ' desde perfil/
// registro, ', ' desde onboarding) y reúne con ', '. Default si queda vacío.
const normalizarEspecialidades = (raw?: string | null): string => {
  const partes = (raw ?? '')
    .split(/\s*·\s*|\s*,\s*/)
    .map((parte) => parte.trim())
    .filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : 'Medicina General'
}

const buildSystemInstruction = (especialidades: string) => `Eres un asistente de documentación clínica para un médico especialista en ${especialidades}. Tu función es ayudar a redactar una nota médica profesional en formato SOAP, a partir de la información que el médico te proporciona. Adaptas terminología, maniobras semiológicas, escalas de valoración, estudios y enfoque clínico a ${especialidades}. Si el médico tiene varias especialidades, integras el enfoque de todas según lo que el caso requiera. Debes poder asistir desde un médico general hasta un subespecialista; adáptate a la especialidad indicada.

PRINCIPIO FUNDAMENTAL (INVIOLABLE): Operas en DOS momentos con reglas OPUESTAS:
1. DURANTE EL INTERROGATORIO: libertad total para razonar, opinar, sugerir diagnósticos, proponer maniobras, proponer estudios y señalar lo clínicamente relevante. Aquí eres un colega que ayuda a pensar.
2. EN LA NOTA FINAL: CERO opiniones, CERO sugerencias, CERO juicios tuyos. La nota contiene ÚNICAMENTE información que el médico proporcionó o confirmó en el interrogatorio. No agregas diagnósticos que el médico no estableció, ni hallazgos que no te confirmó, ni conductas que no autorizó.

Regla de oro: si un dato NO te consta porque el médico NO lo dio NI lo confirmó, NO puede aparecer en la nota final. Si quieres que algo aparezca en la nota, primero pregúntalo en el interrogatorio. Nunca inventes para rellenar.

CÓMO TRATAS LA INFORMACIÓN DEL MÉDICO: Tu trabajo NO es inventar contenido clínico, sino DESARROLLAR y DAR CONTEXTO PROFESIONAL a lo que el médico te da, distinguiendo por nivel de certeza:
- ALTA CERTEZA / BAJO RIESGO: hallazgos genéricos casi tautológicos del diagnóstico o cuadro, y la redacción clínica de lo que el médico ya mencionó. Esto lo desarrollas y afirmas directamente, con lenguaje médico de ${especialidades}.
- ESPECÍFICO / VARIABLE / CLÍNICAMENTE RELEVANTE: resultados concretos que cambian entre pacientes y tienen peso clínico o medicolegal. Esto NO lo afirmas por tu cuenta: lo PREGUNTAS en el interrogatorio. Solo aparece en la nota si el médico lo confirmó.

CRITERIO TRANSVERSAL (aplícalo a TU especialidad, sea cual sea): lo "específico que debes preguntar" son los hallazgos de exploración dirigida, maniobras o pruebas semiológicas con resultado, escalas de valoración, y hallazgos de gabinete/laboratorio que correspondan al diagnóstico y a ${especialidades}. Identifica qué evaluaría un especialista en ${especialidades} para ese cuadro y pregunta por esos hallazgos en lugar de afirmarlos. Ejemplos del PATRÓN (no lista cerrada):
- Ortopedia, lesión de manguito rotador: maniobras (Jobe, empty can), fuerza, arcos de movilidad, hallazgos de USG/RM.
- Cardiología, insuficiencia cardíaca: hallazgos auscultatorios, FEVI, datos de congestión, ECG/ecocardiograma.
- Infectología, proceso infeccioso: foco, fiebre cuantificada, respuesta inflamatoria, cultivos/laboratorios.
- Neurología, evento vascular: déficit focal, escala NIHSS, neuroimagen.
Aplica el mismo razonamiento a la especialidad y diagnóstico que tengas enfrente.

Cuanto más rico sea el contexto del médico, más completa será tu redacción y menos necesitarás preguntar.

LÓGICA DEL INTERROGATORIO. DECISIÓN ¿PREGUNTAR O GENERAR?: Evalúa si tienes contexto suficiente para una nota de CALIDAD (no solo válida). Mínimo para calidad: un diagnóstico (con lateralidad si aplica); motivo y cronología básica del padecimiento; hallazgos de exploración relevantes; saber si hay o no estudios (y sus resultados si los hay); un plan.
- Si FALTA información esencial: status "faltan_datos": generas preguntas, NO generas nota.
- Si tienes contexto suficiente: status "completa": generas la nota SOAP directo, sin preguntar.
No preguntes por preguntar. El interrogatorio llena vacíos reales, no interroga de rutina.

CÓMO FORMULAS LAS PREGUNTAS: solo lo mínimo indispensable para una nota de calidad; prioriza lo crítico (diagnóstico, exploración clave, estudios).
Cantidad (tope adaptativo): pocas (2-4) si el contexto es bueno; más si es pobre, hasta un MÁXIMO de 10 en el peor caso; nunca más de 10. Si requeriría más, pregunta lo más crítico primero; el resto el médico lo completa al revisar.
Organización en BLOQUES TEMÁTICOS: agrupa en MÁXIMO 3 bloques coherentes (ej. "Sobre el padecimiento", "Exploración física", "Estudios y antecedentes"). Usa los que el caso necesite, sin pasar de 3.
Cada pregunta: concreta y clínicamente precisa; ofrece opciones cuando sea posible (para elegir con un toque); permite SIEMPRE respuesta de texto libre.
Durante el interrogatorio SÍ puedes sugerir y opinar (proponer diagnósticos como opciones, preguntar hallazgos que sospechas). Esta libertad es SOLO del interrogatorio.

CASO ESPECIAL, FALTA EL DIAGNÓSTICO: la nota SIEMPRE lleva diagnóstico. Si el médico no lo dio: en el interrogatorio propón diagnósticos probables como opciones según el cuadro; el médico elige o escribe el suyo. NUNCA generes la nota con un diagnóstico que el médico no haya elegido o confirmado. Sin diagnóstico confirmado, sigues en interrogatorio.

FORMATO SOAP DE LA NOTA FINAL. Cuando generes la nota (status "completa"), redáctala en SOAP, en este orden, con SOLO información que el médico dio o confirmó. Sin opiniones, sin datos inventados.

[SUBJETIVO]
- Motivo de consulta: queja principal o síntoma cardinal.
- Padecimiento actual: historia cronológica, síntomas, tiempo de evolución y factores asociados, en tercera persona con lenguaje clínico ("Refiere cuadro de ... de X tiempo de evolución").
- Antecedentes: SOLO los relevantes para esta consulta (alergias, comorbilidades, cirugías previas, medicamentos que toma) y solo si el médico los dio.

[OBJETIVO]
- Signos vitales: solo si el médico los dio.
- Estado general: si el médico lo indicó.
- Exploración física: descripción sistemática y ordenada de la región/sistema, con hallazgos POSITIVOS y NEGATIVOS relevantes que el médico confirmó. Desarrolla con lenguaje clínico lo de alta certeza; incluye los hallazgos específicos solo si el médico los confirmó en el interrogatorio.
- Resultados de estudios: resumen breve de gabinete/laboratorio que el médico haya reportado. Si confirmó que no hay, no inventes ninguno.

[ANÁLISIS]
- Impresión diagnóstica: el diagnóstico que el médico estableció o confirmó, codificado en CIE-10 (ver formato abajo).
- Juicio clínico: breve correlación entre los hallazgos y el diagnóstico. Es REDACCIÓN del razonamiento que sustenta el diagnóstico YA establecido por el médico, NO una opinión diagnóstica tuya ni diagnósticos alternativos.

[PLAN]
- Tratamiento: los medicamentos y tratamientos que el médico INDICÓ, transcritos fielmente. Para cada medicamento que el médico haya especificado: nombre, dosis, vía, frecuencia y duración tal como el médico los dio (no inventes datos que el médico no escribió; si falta un dato, omítelo — por ejemplo, si el médico no dio la duración, NO la inventes: redacta el tratamiento sin ese dato). Incluye intervenciones, medidas físicas y cuidados generales que el médico haya indicado. NUNCA inventes ni sugieras tratamientos que el médico no indicó.
- Estudios solicitados: los que el médico haya indicado. Si el médico confirmó que no requiere estudios, escribe: "Por el momento no se requieren estudios adicionales."
- Educación al paciente: indicación general de que se explicó al paciente la naturaleza de su padecimiento y las medidas para evitar perpetuar o agravar el daño, adaptada al diagnóstico.
- Signos de alarma: los datos de alarma pertinentes al diagnóstico establecido, por los cuales el paciente debe buscar atención inmediata.
- Seguimiento: próxima cita o criterios de alta, según lo que el médico indicó.

CODIFICACIÓN CIE-10 (OBLIGATORIA): todo diagnóstico va codificado, con formato:
CÓDIGO — Descripción oficial - Complemento del médico
Ejemplo: "S53.0 — Luxación de la cabeza del radio - Codo de niñera IZQUIERDO"
- El código y la descripción oficial los aportas tú desde tu conocimiento del catálogo CIE-10.
- El complemento (precisiones, nombre común, contexto del médico) va tras el guion.
- LATERALIDAD OBLIGATORIA cuando el órgano/estructura es par (radio, cúbito, oído, riñón, ojo, extremidades, etc.): indica el lado (DERECHO/IZQUIERDO) en MAYÚSCULAS. Si aplica a un órgano par y el médico no especificó el lado, eso DEBISTE preguntarlo en el interrogatorio.
- Si NO encuentras un código CIE-10 con certeza, NO lo inventes: deja el diagnóstico en texto, sin código (solo descripción y complemento).

REGLAS DE CALIDAD: concisa y concreta (no extensa por extenderse, sin redundancias); cronológica (eventos en orden); clara (sin ambigüedades ni abreviaturas no universales). Si una sección del SOAP no tiene información dada o confirmada por el médico, omítela o indícalo de forma mínima, sin rellenar con contenido inventado.

EXTENSIÓN Y DENSIDAD (aplica EXCLUSIVAMENTE a la narrativa de la nota final, status "completa"; NO limita ni acorta las preguntas del interrogatorio en status "faltan_datos"):
- Presupuesto: la narrativa completa (las 4 secciones juntas) apunta a un MÁXIMO de ~3,000 caracteres. Los casos simples deben quedar muy por debajo. La extensión es proporcional a la complejidad del caso descrito por el médico, nunca al deseo de rellenar.
- Densidad no es omisión: a mayor contexto que el médico aporte, la nota es más completa en CONTENIDO clínico, no más larga en caracteres de relleno. Refuerza —sin repetir— la regla de presentación de que el formato organiza y no agrega longitud.
- Jerarquía de compresión (qué es intocable al densificar): NUNCA omitas ni adelgaces los hallazgos clínicos (padecimiento actual, exploración física, resultados de estudios), la impresión diagnóstica ni las indicaciones de tratamiento. Si necesitas recortar, hazlo en lo periférico: educación al paciente y signos de alarma en 1-2 líneas densas; seguimiento en 1 línea.
- Estilo telegráfico-clínico: prohibidas las fórmulas de relleno ("cabe mencionar", "es importante destacar", "se procede a", "de forma importante" y similares). Tras la primera mención completa del paciente ("Paciente masculino de X años…"), refiérete a él de forma directa, sin repetir el encuadre.
- Juicio clínico que INTEGRA, no re-narra: prohibido repetir la historia del padecimiento ya escrita en [SUBJETIVO]. El juicio es solo correlación clínico-estudios, razonamiento y decisión, en 3-5 líneas.
- Boilerplate directo: los negativos y frases estándar van en su forma mínima (ej. "No se requieren estudios adicionales."), sin expandirlos.

FORMATO DE RESPUESTA (JSON OBLIGATORIO): Respondes SIEMPRE con un único objeto JSON conforme al schema proporcionado, sin texto fuera del JSON. El objeto tiene tres campos: "status" ("faltan_datos" o "completa"), "bloques" (arreglo de bloques temáticos), y "nota" (objeto o null).

Cuando faltan datos: status "faltan_datos"; "bloques" es un arreglo de máximo 3 bloques, cada bloque con un "titulo" y su arreglo de "preguntas"; "nota" es null. Cada pregunta tiene: "id" (identificador corto y único), "pregunta" (texto claro y clínicamente preciso), "opciones" (arreglo de respuestas sugeridas para elegir; puede ir vacío si la pregunta es abierta), "permite_texto_libre" (casi siempre true).

Cuando tienes contexto suficiente: status "completa"; "bloques" es un arreglo vacío; "nota" contiene "narrativa" (el texto completo de la nota SOAP con las 4 secciones [SUBJETIVO], [OBJETIVO], [ANÁLISIS], [PLAN], incluyendo el tratamiento con medicamentos en el texto del [PLAN]) y "estructurado" con: "motivo_consulta" (conciso), "exploracion_fisica" (hallazgos), "plan_tratamiento" (plan no farmacológico e indicaciones, sin medicamentos), "diagnosticos" (arreglo de objetos con "codigo_cie10" si hay certeza y "descripcion" con formato "Descripción oficial - complemento LATERALIDAD").

COHERENCIA: el diagnóstico de la narrativa y el de "diagnosticos" deben ser el mismo.

PRESENTACIÓN DE LA NOTA (formato markdown — NUNCA altera el contenido):
El contenido clínico y las reglas de arriba SIEMPRE mandan. El formato es solo presentación: no agrega, omite ni reinterpreta información. Aplica markdown así:
- Encabezados de sección: escribe SIEMPRE las 4 secciones como **[SUBJETIVO]:**, **[OBJETIVO]:**, **[ANÁLISIS]:**, **[PLAN]:** (con dobles asteriscos y corchetes, exactamente así). No uses ## ni otro formato de encabezado.
- Etiquetas de campo en negrita: cada subcampo inicia con su etiqueta en negrita y dos puntos. Ej.: **Motivo de consulta:**, **Padecimiento actual:**, **Antecedentes relevantes:**, **Exploración física:**, **Estudios de gabinete:**, **Impresión diagnóstica:**, **Juicio clínico:**, **Diagnóstico diferencial:**, **Tratamiento farmacológico:**, **Medidas no farmacológicas:**, **Estudios solicitados:**, **Educación al paciente:**, **Signos de alarma:**, **Seguimiento:**. Cada sub-encabezado inicia SIEMPRE en su propia línea (precedido de un salto de línea): NUNCA lo continúes en la misma línea del texto anterior ni fusiones dos subcampos en una sola línea.
- Datos clave en negrita dentro del texto: diagnósticos con su código (ej. **M75.1 — Síndrome del manguito rotador DERECHO**), medicamentos con dosis (ej. **Celecoxib 200mg**), signos semiológicos relevantes (ej. **Neer positivo**, **Lasègue negativo**) y valores clave (ej. **4/5**, **90°**). Usa la negrita con criterio, solo en lo que el médico busca de un vistazo — nunca en frases enteras.
- Viñetas EXCLUSIVAMENTE con guion y espacio "- " (ej. "- Reposo relativo"). PROHIBIDO usar el asterisco "*" como marca de viñeta. Usa viñetas para listas de elementos discretos: impresión diagnóstica cuando hay varios diagnósticos, diagnósticos diferenciales (cada uno en su viñeta, con el nombre en negrita), pruebas semiológicas cuando son varias, y en el [PLAN]: tratamiento farmacológico (un fármaco por viñeta), medidas no farmacológicas, estudios solicitados y signos de alarma.
- Prosa (sin viñetas) para el padecimiento actual y el juicio clínico: son narrativa y razonamiento, se leen mejor corridos.
- Dentro del [PLAN], usa los subcampos en negrita como subencabezados para organizar el plan (tratamiento farmacológico, medidas, estudios, educación, signos de alarma, seguimiento).
- No uses emojis, ni bloques de código, ni tablas, ni colores. Solo negrita, viñetas y las etiquetas de sección. Mantén la nota concisa: el formato organiza, no agrega longitud.`

const MAX_INTENTOS = 3

// Umbral de longitud por campo: un valor desbocado delata un loop de repetición
// del modelo. Es la red determinista — un campo así NUNCA pasa como válido.
const LIMITES_CAMPO = {
  codigo_cie10: 20,
  descripcion: 400,
} as const

// Devuelve el nombre del campo desbocado, o null si todas las longitudes son sanas.
const validarLongitudes = (nota: NotaIAContenido): string | null => {
  for (const d of nota.estructurado.diagnosticos) {
    if ((d.codigo_cie10 ?? '').length > LIMITES_CAMPO.codigo_cie10) return 'diagnostico.codigo_cie10'
    if ((d.descripcion ?? '').length > LIMITES_CAMPO.descripcion) return 'diagnostico.descripcion'
  }
  return null
}

type EvalResult =
  | { ok: true; parsed: NotaIAResponse }
  | { ok: false; motivo: string }

// Clasifica la respuesta: defectuosa (truncada / vacía / JSON inválido / campo
// desbocado por loop) o válida con su JSON parseado.
const evaluarRespuesta = (
  finishReason: FinishReason | undefined,
  raw: string | undefined,
): EvalResult => {
  if (finishReason === FinishReason.MAX_TOKENS) return { ok: false, motivo: 'finishReason MAX_TOKENS' }
  if (!raw) return { ok: false, motivo: 'respuesta vacía' }
  let parsed: NotaIAResponse
  try {
    parsed = JSON.parse(raw) as NotaIAResponse
  } catch {
    return { ok: false, motivo: 'JSON inválido' }
  }
  if (parsed.nota) {
    const campo = validarLongitudes(parsed.nota)
    if (campo) return { ok: false, motivo: `campo desbocado: ${campo}` }
  }
  return { ok: true, parsed }
}

// Reintenta el MISMO turno (mismo historial + mensaje) hasta MAX_INTENTOS si la
// respuesta es defectuosa. Cada intento reconstruye el chat desde cero (no acumula
// turnos). Devuelve la nota válida, o null si todos los intentos fallaron.
const generarNotaConReintentos = async (
  systemInstruction: string,
  history: Content[],
  mensaje: string,
): Promise<NotaIAResponse | null> => {
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: notaIAResponseSchema,
        maxOutputTokens: 8192,
      },
      history,
    })
    const response = await chat.sendMessage({ message: mensaje })
    const resultado = evaluarRespuesta(response.candidates?.[0]?.finishReason, response.text)
    if (resultado.ok) {
      // warn (no info) a propósito: logger.info es dev-only; warn es visible en
      // producción. Telemetría sin PII, solo conteos de tokens del usageMetadata.
      logger.warn('NOTA-IA-USAGE', JSON.stringify({
        llamada: 'nota',
        intento,
        status: resultado.parsed.status,
        promptTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        thoughtsTokens: response.usageMetadata?.thoughtsTokenCount ?? null,
        totalTokens: response.usageMetadata?.totalTokenCount ?? null,
      }))
      return resultado.parsed
    }
  }
  return null
}

// ── Llamada 2: extracción de medicamentos desde la narrativa ──────────────────
// Prompt mínimo + schema chico + maxOutputTokens bajo. Determinista; si falla,
// devuelve [] (la llamada 1 ya es buena; el PLAN de la narrativa conserva los
// medicamentos por NOM-004). No lanza error.
const EXTRACCION_SYSTEM_INSTRUCTION = `Eres un extractor de datos clínicos. Recibes el texto de una nota médica en formato SOAP. Tu ÚNICA tarea es extraer el NOMBRE de cada medicamento indicado en la sección [PLAN] / tratamiento y devolverlo como JSON conforme al schema. REGLAS: extrae SOLO el nombre del fármaco (ej. Meloxicam, Metocarbamol); NO extraigas dosis, frecuencia ni duración. Extrae SOLO fármacos escritos explícitamente en el texto; NUNCA inventes ni completes fármacos que no aparezcan. Si el texto no menciona ningún medicamento, devuelve arreglo vacío. Responde ÚNICAMENTE con el objeto JSON.`

const MAX_INTENTOS_EXTRACCION = 2

// Red mínima: la extracción ahora devuelve SOLO el nombre (alta entropía, no hace
// loop). Un nombre desbocado (>80, el maxLength del schema) delataría un loop.
const medicamentoDesbocado = (meds: MedicamentoIA[]): boolean =>
  meds.some((m) => (m.nombre ?? '').length > 80)

const extraerMedicamentos = async (narrativa: string): Promise<MedicamentoIA[]> => {
  for (let intento = 1; intento <= MAX_INTENTOS_EXTRACCION; intento++) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: narrativa,
      config: {
        systemInstruction: EXTRACCION_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: medicamentosExtraccionSchema,
        maxOutputTokens: 512,
      },
    })
    const finishReason = response.candidates?.[0]?.finishReason
    const raw = response.text
    if (finishReason === FinishReason.MAX_TOKENS || !raw) continue
    let parsed: MedicamentosExtraccion
    try {
      parsed = JSON.parse(raw) as MedicamentosExtraccion
    } catch {
      continue
    }
    const meds = Array.isArray(parsed.medicamentos) ? parsed.medicamentos : []
    if (medicamentoDesbocado(meds)) continue
    // warn (no info) a propósito: logger.info es dev-only; warn es visible en
    // producción. Telemetría sin PII, solo conteos de tokens del usageMetadata.
    logger.warn('NOTA-IA-USAGE', JSON.stringify({
      llamada: 'extraccion',
      intento,
      promptTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      thoughtsTokens: response.usageMetadata?.thoughtsTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null,
    }))
    return meds
  }
  return []
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const limitError = await checkRateLimit(user.id, 'nota-medica')
    if (limitError) return limitError

    // Obtener especialidad del médico autenticado
    const { data: profile } = await supabase
      .from('profiles')
      .select('especialidad')
      .eq('id', user.id)
      .single()
    const especialidades = normalizarEspecialidades(profile?.especialidad)

    const body = await req.json()

    // ── Contrato NUEVO multi-turno ─────────────────────────────────────────
    // body: { paciente?, mensaje, historial? }
    // 'mensaje' = texto del turno actual; 'historial' = conversación previa.
    // Backend stateless: reconstruimos el chat en cada llamada.
    //
    // LFPDPPP Art. 9: datos de salud son sensibles y requieren minimización
    // al compartir con terceros (Google Gemini). Se preservan datos clínicos
    // (síntomas, signos, diagnósticos) pero se redactan nombres, IDs, contacto.

    // Validar mensaje (obligatorio, string no vacío tras sanitizar + anonimizar)
    const mensaje = anonimizarTexto(sanitizePromptInput(body.mensaje, 4000))
    if (!mensaje) {
      return NextResponse.json(
        { error: "El campo 'mensaje' es obligatorio." },
        { status: 400 }
      )
    }

    // Anonimizar historial ANTES de traducir al formato del SDK.
    // Defensa en profundidad: cada texto se re-anonimiza (los user-turns ya
    // venían sanitizados; los model-turns NO se re-sanitizan para no corromper
    // su JSON).
    const historialInput: { rol: 'user' | 'model'; texto: string }[] =
      Array.isArray(body.historial) ? body.historial : []
    const historialAnon = anonimizarHistorial(historialInput)
    const historialSDK: Content[] = historialAnon.map((m) => ({
      role: m.rol,
      parts: [{ text: m.texto }],
    }))

    // Encabezado demográfico SOLO en turno 1 (cuando viene 'paciente').
    let datosPaciente = ''
    if (body.paciente) {
      const edad  = sanitizeNumber(body.paciente.edad)
      const peso  = sanitizeNumber(body.paciente.peso)
      const talla = sanitizeNumber(body.paciente.talla)
      const sexo  = ['M', 'F'].includes(body.paciente.sexo)
        ? (body.paciente.sexo as 'M' | 'F')
        : null
      const antecedentes = anonimizarTexto(
        sanitizePromptInput(body.paciente.antecedentes, 500)
      )

      datosPaciente = `DATOS CLÍNICOS DEL PACIENTE:
- Edad: ${edad ? edad + ' años' : 'no especificada'}
- Sexo: ${sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'no especificado'}
- Peso: ${peso ? peso + ' kg' : 'no especificado'} | Talla: ${talla ? talla + ' cm' : 'no especificada'}
${antecedentes ? `- Antecedentes: ${antecedentes}` : ''}`
    }

    // Mensaje efectivo del turno: turno 1 = demográficos + mensaje; resto = solo mensaje.
    const mensajeEfectivo = datosPaciente
      ? `${datosPaciente}\n\n${mensaje}`
      : mensaje

    const systemInstruction = buildSystemInstruction(especialidades)

    const parsed = await generarNotaConReintentos(systemInstruction, historialSDK, mensajeEfectivo)
    if (!parsed) {
      return NextResponse.json(
        { error: 'La IA tuvo un problema al generar la nota. Intenta de nuevo.' },
        { status: 502 }
      )
    }

    // Llamada 2 (extracción de medicamentos) SOLO cuando la nota es final
    // ('completa'). En 'faltan_datos' (entrevista) cae directo al return de
    // abajo, sin extracción. La llamada 2 NO cuenta para el rate limit.
    if (parsed.status === 'completa' && parsed.nota) {
      let meds: MedicamentoIA[] = []
      try {
        meds = await extraerMedicamentos(parsed.nota.narrativa)
      } catch (errExtraccion) {
        // B5: la llamada 2 NUNCA tumba una nota buena. Ante cualquier fallo,
        // tabla vacía; el [PLAN] de la narrativa ya conserva los medicamentos.
        console.error('Extracción de medicamentos falló, tabla vacía:', errExtraccion)
      }
      parsed.nota.estructurado.medicamentos = meds
    }

    return NextResponse.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al generar la nota'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
