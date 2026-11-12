/**
 * avisoReserva.ts — el aviso de privacidad que acepta quien reserva por enlace
 * (agenda D9). SÓLO SERVIDOR para decidir si se publica; el texto ya
 * rellenado viaja a la página como prop.
 *
 * ⚠️ ESTE TEXTO ES UN BORRADOR SIN REVISIÓN LEGAL. Lleva la marca
 * `PENDIENTE DE REVISIÓN LEGAL — no publicar` y, mientras la lleve, la reserva
 * NO SE PUBLICA aunque alguien apruebe su hash en la base (doble cierre).
 * Los `[VERIFICAR: …]` son preguntas para la revisión, no texto para el
 * público: se quitan al aprobarlo, junto con la marca.
 *
 * CÓMO SE APRUEBA (lo hace Angel, nadie más):
 *   1. Revisar y corregir AVISO_PLANTILLA contra la LFPDPPP vigente (DOF
 *      20/03/2025, reformada 14/11/2025) y su reglamento cuando exista; quitar
 *      la marca y los `[VERIFICAR]`; subir AVISO_VERSION.
 *   2. `npx tsx scripts/aviso-reserva-hash.ts` imprime versión, sha256 y el
 *      INSERT en `public.reserva_avisos`, que se pega en el SQL Editor.
 *   Cambiar una coma cambia el hash y vuelve a cerrar todos los enlaces hasta
 *   aprobar la versión nueva. La cita guarda la versión aceptada y la hora.
 *
 * El hash es de la PLANTILLA (con sus marcadores `{MEDICO}`…), no del texto
 * rellenado: una aprobación vale para todos los médicos.
 */
import { createHash } from 'node:crypto'
import { supabaseEsRemota } from '@/lib/correo/transporte'

export const AVISO_VERSION = 'reserva-2026-11-v1'

export const MARCA_PENDIENTE = 'PENDIENTE DE REVISIÓN LEGAL — no publicar'

/** Plazo de conservación PROPUESTO del historial (lista A, 23). Lo fija Angel. */
export const PLAZO_PROPUESTO = '12 meses'

export const AVISO_PLANTILLA = `${MARCA_PENDIENTE} · versión ${AVISO_VERSION}

Aviso de privacidad para reservar una cita en línea

Quién es responsable. {MEDICO} ({CONSULTORIO}, {DIRECCION}) es responsable de los datos que nos das al reservar. Spinus es la plataforma con la que el consultorio administra su agenda y trata tus datos por cuenta y bajo instrucciones del consultorio. [VERIFICAR: que esta descripción del responsable y de quien trata los datos por su cuenta corresponda a las figuras de la LFPDPPP vigente (DOF 20/03/2025, reformada 14/11/2025) y a los contratos entre Spinus y las clínicas; si el responsable es el médico, la clínica o los dos.]

Qué datos pedimos. Tu nombre, tu teléfono y tu correo electrónico, y la fecha, la hora, el consultorio y el tipo de cita que elijas. [VERIFICAR: si agendar con un médico de cierta especialidad y el tipo de cita revelan el estado de salud y son, por tanto, datos personales sensibles; si lo son, qué forma de consentimiento exige la ley vigente y si una casilla electrónica basta.]

Para qué los usamos.
1. Agendar tu cita y administrarla.
2. Enviarte por correo el código para verificar tu dirección y el comprobante de tu cita.
3. Aplicar las reglas de reserva en línea del consultorio. Conservamos el historial de las citas que reservas en línea con este médico, incluidas las que se cancelan (las canceles tú o el consultorio) y aquellas a las que no asistes, asociado a tu teléfono y a tu correo. Con ese historial el sistema puede limitar tus reservas en línea, por ejemplo después de varias cancelaciones o inasistencias; en ese caso podrás agendar llamando al consultorio. El historial se guarda seudonimizado (tu teléfono y tu correo se sustituyen por un código que no permite leerlos) y se conserva durante {PLAZO}. [VERIFICAR: el plazo de conservación (HOY NO HAY PURGA AUTOMÁTICA de reserva_incidencias ni de reserva_contactos: el plazo no se cumple solo hasta que se construya); si la seudonimización basta; y si conservar el historial de cancelaciones para limitar reservas es una finalidad que requiere consentimiento propio o puede ir en este.]
4. Proteger el servicio contra abusos. Registramos, de forma seudonimizada, la red desde la que te conectas y un identificador técnico de tu navegador (una cookie) para limitar el número de intentos. [VERIFICAR: qué obliga a informar la ley vigente sobre cookies y otras tecnologías de rastreo, y si esta cookie técnica necesita consentimiento.]

Con quién se comparten. No vendemos tus datos ni los compartimos con terceros para sus propios fines. Para prestar el servicio intervienen proveedores que los tratan por cuenta del consultorio: el alojamiento y la base de datos de la plataforma, y el servicio de envío de correo. Si el consultorio tiene conectado su calendario de Google, tu nombre y la hora de la cita aparecen en ese calendario; nunca tu teléfono, tu correo ni tus notas. [VERIFICAR: si estas comunicaciones son remisiones o transferencias en los términos de la ley vigente; si algún proveedor está fuera de México; qué debe informarse de cada uno y si hay que nombrarlos.]

Tus derechos. Puedes pedir el acceso, la rectificación o la cancelación de tus datos, oponerte a su uso o revocar este consentimiento, comunicándote con el consultorio al {TELEFONO}. Si lo revocas quizá no puedas reservar en línea, pero siempre podrás agendar por teléfono. Si consideras que tus datos no se trataron conforme a la ley, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno, autoridad en materia de protección de datos personales. [VERIFICAR: los medios, plazos y requisitos que la ley vigente exige para ejercer estos derechos; cómo debe mencionarse a la autoridad. No citar artículos sin verificarlos contra el texto vigente.]

Aviso integral. {URL} [VERIFICAR: /privacidad está escrito para los usuarios de Spinus (médicos); falta un aviso integral que cubra a quien reserva, o confirmar que el del consultorio lo cubre, y poner aquí su dirección.]`

/** Lo que dice la casilla. Nace desmarcada; sin marcarla no se reserva. */
export const AVISO_CASILLA =
  'Leí este aviso y acepto que se traten mis datos para reservar mi cita, incluido conservar el historial de mis reservas, cancelaciones e inasistencias asociado a mi teléfono y a mi correo.'

/** sha256 (hex) de la plantilla: lo que aprueba `reserva_avisos.texto_sha256`. */
export function hashAviso(plantilla: string = AVISO_PLANTILLA): string {
  return createHash('sha256').update(plantilla, 'utf8').digest('hex')
}

type Entorno = Readonly<Record<string, string | undefined>>

/**
 * ¿La URL de Supabase es, a ciencia cierta, la del Docker local? Sólo
 * `http(s)://127.0.0.1`, `localhost` o `[::1]`. Ausente o mal escrita: NO (la
 * duda aquí cuenta como producción; es lo contrario de `supabaseEsRemota`,
 * que ante la duda calla un correo).
 */
function supabaseEsLocal(url: string | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
  } catch {
    return false
  }
}

/**
 * ¿Se puede publicar? Falso mientras la plantilla lleve la marca de
 * pendiente. ÚNICA excepción, para las e2e: `RESERVA_AVISO_BORRADOR_LOCAL=1`
 * con la base LOCAL (loopback a ciencia cierta, y no remota) y fuera de
 * Vercel. Aun así la reserva exige el hash aprobado en `reserva_avisos`: esto
 * quita un cierre de los dos, nunca el de la base, y en producción no existe.
 */
export function avisoPublicable(env: Entorno = process.env, plantilla: string = AVISO_PLANTILLA): boolean {
  if (!plantilla.includes(MARCA_PENDIENTE)) return true
  return env.RESERVA_AVISO_BORRADOR_LOCAL === '1'
    && env.VERCEL !== '1'
    && supabaseEsLocal(env.NEXT_PUBLIC_SUPABASE_URL)
    && !supabaseEsRemota(env.NEXT_PUBLIC_SUPABASE_URL)
}

export interface DatosAviso {
  medico: string
  consultorio: string
  direccion: string
  telefono: string
  url: string
}

/** El texto que ve la persona, con los marcadores rellenados. */
export function textoAviso(d: DatosAviso, plantilla: string = AVISO_PLANTILLA): string {
  const valores: Record<string, string> = {
    '{MEDICO}': d.medico, '{CONSULTORIO}': d.consultorio, '{DIRECCION}': d.direccion,
    '{TELEFONO}': d.telefono, '{PLAZO}': PLAZO_PROPUESTO, '{URL}': d.url,
  }
  return plantilla.replace(/\{(MEDICO|CONSULTORIO|DIRECCION|TELEFONO|PLAZO|URL)\}/g, m => valores[m] ?? m)
}

/** El INSERT de aprobación que imprime el script. Literales ya validados por forma. */
export function sqlAprobacion(version: string = AVISO_VERSION, sha: string = hashAviso()): string {
  if (!/^[a-z0-9][a-z0-9.-]{2,40}$/.test(version) || !/^[0-9a-f]{64}$/.test(sha)) {
    throw new Error('sqlAprobacion: versión o hash con forma inválida')
  }
  return `INSERT INTO public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) VALUES ('${version}', '${sha}', true, now());`
}
