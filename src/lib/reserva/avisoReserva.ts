/**
 * avisoReserva.ts — el aviso de privacidad SIMPLIFICADO que acepta quien
 * reserva por enlace (agenda D9) y su casilla. SÓLO SERVIDOR para decidir si
 * se publica; el texto ya rellenado viaja a la página como prop.
 *
 * ⚠️ TEXTO LEGAL APROBADO PARA LA BETA (2026-12). `AVISO_PLANTILLA` y
 * `AVISO_CASILLA` son copia LITERAL de
 * `docs/spec/privacidad-2026-12/3-aviso-simplificado-reserva.txt` y
 * `3-casilla.txt`; `avisoReserva.test.ts` lo exige byte a byte. No se
 * redacta, no se resume y no se «mejora» aquí: un cambio sale de la revisión
 * legal, con versión nueva.
 *
 * DOBLE CIERRE, sigue en pie para un borrador futuro: si la plantilla llevara
 * la marca `PENDIENTE DE REVISIÓN LEGAL — no publicar`, la reserva no se
 * publica aunque alguien apruebe su huella en la base.
 *
 * CÓMO SE APRUEBA (lo hace Angel, nadie más):
 *   `npx tsx scripts/aviso-reserva-hash.ts` imprime versión, sha256 y el
 *   INSERT en `public.reserva_avisos`, que se pega en el SQL Editor.
 *   Cambiar una coma —del aviso O DE LA CASILLA— cambia la huella y vuelve a
 *   cerrar todos los enlaces hasta aprobar la versión nueva. La cita guarda la
 *   versión aceptada y la hora.
 *
 * LA HUELLA es de la PLANTILLA (con sus marcadores `{MEDICO}`…, no del texto
 * rellenado: una aprobación vale para todos los médicos) MÁS LA CASILLA:
 * sha256(plantilla + "\n\n" + casilla). La base no calcula nada: compara la
 * versión y la huella que le manda el servidor con la fila aprobada de
 * `reserva_avisos` (`reserva_contexto` y `reservar_por_enlace`,
 * `20261201140000`), así que meter la casilla no toca ninguna migración.
 */
import { createHash } from 'node:crypto'
import { supabaseEsRemota } from '@/lib/correo/transporte'

export const AVISO_VERSION = 'reserva-2026-12-v1'

/** La marca de un borrador. La plantilla vigente NO la lleva; ver «doble cierre» arriba. */
export const MARCA_PENDIENTE = 'PENDIENTE DE REVISIÓN LEGAL — no publicar'

export const AVISO_PLANTILLA = `Aviso de privacidad simplificado para reservar una cita en línea
Versión reserva-2026-12-v1

Responsable. {MEDICO}, con domicilio en {DIRECCION} ({CONSULTORIO}), es responsable de los datos personales que proporcionas al reservar tu cita. Spinus es la plataforma con la que el consultorio administra su agenda y trata tus datos por cuenta del consultorio.

Datos que tratamos. Tu nombre, tu teléfono y tu correo electrónico; la fecha, la hora, el consultorio y el tipo de cita que elijas; el historial de las citas que reservas en línea con este médico, incluidas las que se cancelan y aquellas a las que no asistes; y, convertidos en un código que no permite leerlos, la red desde la que te conectas y un identificador de tu navegador (una cookie técnica). No te pedimos datos de salud ni otros datos personales sensibles.

Para qué los usamos. Todo es necesario para la reserva en línea: agendar tu cita, administrarla y comunicarnos contigo sobre ella; verificar tu correo; aplicar las reglas de reserva del consultorio, con las que el sistema puede limitar de forma automática tus reservas en línea después de varias cancelaciones o inasistencias (si te ocurre, podrás agendar por teléfono y pedir al consultorio que revise tu caso); y proteger el servicio contra abusos. No usamos tus datos para publicidad.

Cómo limitar su uso y ejercer tus derechos. Para limitar el uso o la divulgación de tus datos, acceder a ellos, rectificarlos, cancelarlos, oponerte a su uso o revocar tu consentimiento, comunícate con el consultorio al {TELEFONO} o acude a {DIRECCION}. Si revocas tu consentimiento no podrás reservar en línea, pero podrás agendar por teléfono. La autoridad en materia de protección de datos personales es la Secretaría Anticorrupción y Buen Gobierno.

Aviso de privacidad integral. Consúltalo en {URL}`

/** Lo que dice la casilla. Nace desmarcada; sin marcarla no se reserva. Entra en la huella. */
export const AVISO_CASILLA =
  'Leí el aviso de privacidad y acepto que se traten mis datos para reservar mi cita, incluido conservar el historial de mis reservas, cancelaciones e inasistencias.'

/** sha256 (hex) de plantilla + "\n\n" + casilla: lo que aprueba `reserva_avisos.texto_sha256`. */
export function hashAviso(plantilla: string = AVISO_PLANTILLA, casilla: string = AVISO_CASILLA): string {
  return createHash('sha256').update(`${plantilla}\n\n${casilla}`, 'utf8').digest('hex')
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
    '{TELEFONO}': d.telefono, '{URL}': d.url,
  }
  return plantilla.replace(/\{(MEDICO|CONSULTORIO|DIRECCION|TELEFONO|URL)\}/g, m => valores[m] ?? m)
}

/** La página pública del aviso integral del consultorio de ESTE enlace (documento 2). */
export function rutaAvisoIntegral(codigo: string): string {
  return `/reservar/${codigo}/privacidad`
}

/** La misma, absoluta: lo que el aviso simplificado escribe en `{URL}`. */
export function urlAvisoIntegral(codigo: string, env: Entorno = process.env): string {
  const base = (env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx').trim().replace(/\/+$/, '')
  return `${base}${rutaAvisoIntegral(codigo)}`
}

/** El INSERT de aprobación que imprime el script. Literales ya validados por forma. */
export function sqlAprobacion(version: string = AVISO_VERSION, sha: string = hashAviso()): string {
  if (!/^[a-z0-9][a-z0-9.-]{2,40}$/.test(version) || !/^[0-9a-f]{64}$/.test(sha)) {
    throw new Error('sqlAprobacion: versión o hash con forma inválida')
  }
  return `INSERT INTO public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) VALUES ('${version}', '${sha}', true, now());`
}
