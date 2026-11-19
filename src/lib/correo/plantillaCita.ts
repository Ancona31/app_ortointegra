/**
 * plantillaCita.ts — EL esqueleto compartido de todos los correos de la agenda
 * (código para reservar, comprobante, confirmación, recordatorio, aviso de
 * cambio y aviso a la clínica). Pura: recibe las partes en texto llano y
 * devuelve el HTML y el texto plano, armados de los MISMOS bloques y en el
 * mismo orden, así que las dos versiones no pueden divergir.
 *
 * Tanda M (M5, puntos 9 a 14 de Angel): la estructura, los textos y los tamaños
 * son los de las maquetas `docs/spec/correo-cita-paciente.html`,
 * `correo-confirmar-cita.html` y `correo-codigo-reserva.html`: encabezado azul
 * con el consultorio y el médico, píldora de estado, bloque grande de fecha y
 * hora con su zona («hora de Yucatán»), tabla de detalles y pie «Enviado con
 * Spinus». Cada correo elige qué bloques lleva y en qué orden (`BloqueCorreo`).
 * Es una abstracción con seis consumidores reales (Protocolo 4): los seis
 * correos de la agenda.
 *
 * Cómo está hecho, y por qué:
 *   · TABLAS Y ESTILOS EN LÍNEA. Gmail, Outlook y el correo del teléfono
 *     descartan `<style>`, las variables CSS, flex y grid.
 *   · LOS COLORES SON HEX (un correo no puede leer variables) y son los VALORES
 *     de los tokens de la app con la marca de fábrica, NO los de la maqueta
 *     (ver `C`). Ojo a la REGLA 4 de CLAUDE.md: el acento y el botón son `--cs`
 *     (#1e5fa8, el azul brillante); la cabecera es `--ag-navy` (#163250). No
 *     cambies un hex sin cambiar su token.
 *   · SIN IMÁGENES: la marca es texto y color, se lee con las imágenes
 *     bloqueadas.
 *   · BOTONES «A PRUEBA DE BALAS»: celda con fondo y enlace con relleno, a todo
 *     el ancho.
 *   · TODO VALOR VA ESCAPADO AQUÍ (`escapeHtml`): quien llama pasa texto llano.
 *     Las URL, además, sólo si son `http(s)://` sin espacios ni comillas
 *     (`urlSegura`); el `tel:` sólo lleva los 10 dígitos de un número de México.
 *   · ⚠️ NADA CLÍNICO: no hay sitio para título de cita, tipo, notas, motivo ni
 *     especialidad. No se lo añadas. El nombre del paciente sí puede ir.
 *   · ⚠️ DETERMINISTA: nada de «ahora». Resend exige el MISMO cuerpo con la
 *     misma llave de idempotencia (recordatorio, comprobante, confirmación).
 *   · ⚠️ SIEMPRE EN CLARO (tanda H, punto 2): `color-scheme` y
 *     `supported-color-schemes` en `light` y NINGÚN `prefers-color-scheme`.
 *     Algunos buzones oscurecen por su cuenta (Gmail y Outlook de móvil); por
 *     eso cada superficie lleva su fondo explícito.
 *   · Una fila o una frase que depende de un dato ausente (dirección,
 *     teléfono, médico…) desaparece ENTERA, en el HTML y en el texto.
 */
import { escapeHtml } from '@/lib/htmlEscape'
import { normalizarTelefonoMx } from '@/lib/reserva/contacto'
import { formatearTelefono } from '@/lib/validaciones'

/**
 * Los colores: el valor de fábrica de cada token de `globals.css` (entre
 * paréntesis, el de la maqueta que sustituye).
 */
const C = {
  fondo: '#eef1f5', //       --ag-bg-app            (maqueta #edf0f5)
  tarjeta: '#ffffff', //     --ag-surface
  borde: '#e7ecf3', //       --ag-border-card       (maqueta #e6ebf3)
  hundido: '#f7f9fb', //     --ag-surface-sunken
  navy: '#163250', //        --ag-navy              (maqueta #1c3551)
  navyTinta: '#96a3b0', //   --ag-navy-ink, blanco al 55 % sobre el navy (maqueta #9fb6d3)
  marca: '#1e5fa8', //       --cs / --azul-medio    (maqueta #2b63a6)
  pildora: '#e8f4fd', //     --azul-suave           (maqueta #e8f1fa)
  tinta: '#15243e', //       --ag-ink               (maqueta #1a2438)
  texto: '#27364f', //       --ag-text              (maqueta #3d4759)
  suave: '#52627a', //       --ag-ink-600           (maqueta #5b667a)
  tenue: '#7c8aa0', //       --ag-muted             (maqueta #7a8597)
  bordeBoton: '#76849a', //  --ag-control-border    (maqueta #cfd8e4)
} as const
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace"
const TABLA = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'

/** De quién es el correo: el médico (grande) y, encima, el consultorio. Sin médico, «Spinus». */
export interface MarcaCorreo { medico: string; consultorio?: string | null }
export interface BotonCorreo { texto: string; url: string; secundario?: boolean }
/** «Después, llámanos al» + el teléfono. Sin teléfono, la frase entera desaparece. */
export interface FraseTelefono { frase: string; telefono: string | null }
/** La fecha grande: «Viernes», «20 de noviembre», «08:00 h» y la zona («hora de Yucatán»). */
export interface FechaCorreo { dia: string; fecha: string; hora: string; zona: string | null }
type Arriba = 24 | 28

export type BloqueCorreo =
  | { tipo: 'entrada'; pildora?: { texto: string; hecho?: boolean }; encabezado: string; parrafos?: string[] }
  | { tipo: 'fecha'; fecha: FechaCorreo }
  | { tipo: 'codigo'; codigo: string; vigencia: string }
  /** `antes`: una frase sobre los botones. `enTexto`: lo que lleva el texto plano EN LUGAR de frase, botones y nota. */
  | { tipo: 'botones'; arriba?: Arriba; antes?: string; botones: BotonCorreo[]; nota?: string[]; llamada?: FraseTelefono; enTexto?: string[] }
  | { tipo: 'datos'; arriba?: Arriba; raya?: boolean; filas: { etiqueta: string; valor: string | null; telefono?: boolean }[] }
  | { tipo: 'lista'; titulo: string; puntos: string[] }
  | { tipo: 'recuadro'; fuerte: string; texto: string; llamada?: FraseTelefono }
  | { tipo: 'aviso'; arriba?: Arriba; raya?: boolean; lineas: string[] }

export interface CorreoArmado {
  /** Texto oculto que el buzón enseña junto al asunto. */
  preencabezado: string
  /** El `<title>` del documento. */
  titulo: string
  marca: MarcaCorreo
  bloques: BloqueCorreo[]
}

/** Sólo `http(s)://` y sin espacios ni comillas: lo único que entra a un `href`. */
export function urlSegura(url: string | null | undefined): string | null {
  return url && /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null
}

/** Recortado y con los espacios y saltos juntados: un salto dentro de una dirección no fabrica renglones en el texto. */
const limpio = (v: string | null | undefined): string => v?.replace(/\s+/g, ' ').trim() ?? ''

/** Un teléfono para leerlo y, si es de México, para pulsarlo: «999 000 0001» y `tel:9990000001`. */
function telefonoLegible(crudo: string): { texto: string; tel: string | null } {
  const diez = normalizarTelefonoMx(crudo)
  return diez ? { texto: formatearTelefono(diez), tel: diez } : { texto: crudo.trim(), tel: null }
}

function telefonoHtml(crudo: string, estilo: string): string {
  const t = telefonoLegible(crudo)
  return t.tel ? `<a href="tel:${t.tel}" style="${estilo}text-decoration:none">${escapeHtml(t.texto)}</a>` : escapeHtml(t.texto)
}

/** «Después, llámanos al 999 000 0001.»; '' sin teléfono. */
function llamadaHtml(l: FraseTelefono | undefined): string {
  if (!l || !limpio(l.telefono)) return ''
  return `${escapeHtml(l.frase)} ${telefonoHtml(limpio(l.telefono), `color:${C.marca};font-weight:700;`)}.`
}
function llamadaTexto(l: FraseTelefono | undefined): string {
  return l && limpio(l.telefono) ? `${l.frase} ${telefonoLegible(limpio(l.telefono)).texto}.` : ''
}

/** Celda de un bloque: 40 px a los lados, como la maqueta. */
const fila = (arriba: number, abajo: number, html: string): string =>
  `<tr><td style="padding:${arriba}px 40px ${abajo}px 40px">${html}</td></tr>`

function cabecera(m: MarcaCorreo): string {
  const consultorio = limpio(m.consultorio)
  const sub = consultorio
    ? `<p style="margin:0;font-size:13px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${C.navyTinta};font-weight:600">${escapeHtml(consultorio)}</p>`
    : ''
  return `<tr><td bgcolor="${C.navy}" style="background-color:${C.navy};padding:28px 40px 26px 40px">${sub}`
    + `<p style="margin:${consultorio ? '6px' : '0'} 0 0 0;font-size:22px;line-height:28px;color:#ffffff;font-weight:700">`
    + `${escapeHtml(limpio(m.medico) || 'Spinus')}</p></td></tr>`
}

function entradaHtml(b: Extract<BloqueCorreo, { tipo: 'entrada' }>): string {
  const pildora = b.pildora
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.pildora}" style="background-color:${C.pildora};`
      + `border-radius:999px;padding:6px 14px;font-size:13px;line-height:18px;font-weight:700;color:${C.marca}">`
      + `${b.pildora.hecho ? '&#10003;&nbsp; ' : ''}${escapeHtml(b.pildora.texto)}</td></tr></table>`
    : ''
  const h1 = `<h1 style="margin:${pildora ? '20px' : '0'} 0 0 0;font-size:24px;line-height:32px;font-weight:700;color:${C.tinta}">${escapeHtml(b.encabezado)}</h1>`
  const ps = (b.parrafos ?? []).map(t => `<p style="margin:10px 0 0 0;font-size:16px;line-height:25px;color:${C.texto}">${escapeHtml(t)}</p>`).join('')
  return fila(36, pildora ? 8 : 0, pildora + h1 + ps)
}

function fechaHtml(f: FechaCorreo): string {
  const zona = f.zona ? ` <span style="font-size:13px;line-height:20px;font-weight:400;color:${C.suave}">&nbsp;${escapeHtml(f.zona)}</span>` : ''
  return fila(24, 0, `<table ${TABLA} bgcolor="${C.hundido}" style="background-color:${C.hundido};border:1px solid ${C.borde};`
    + `border-left:4px solid ${C.marca};border-radius:10px;border-collapse:separate"><tr><td style="padding:22px 24px">`
    + `<p style="margin:0;font-size:14px;line-height:20px;font-weight:700;color:${C.marca};text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(f.dia)}</p>`
    + `<p style="margin:4px 0 0 0;font-size:28px;line-height:34px;font-weight:800;color:${C.tinta}">${escapeHtml(f.fecha)}</p>`
    + `<p style="margin:2px 0 0 0;font-size:20px;line-height:28px;font-weight:600;color:${C.tinta}">${escapeHtml(f.hora)}${zona}</p>`
    + '</td></tr></table>')
}

/** El código SIN espacios (el espaciado lo da el CSS), para que se copie entero. */
function codigoHtml(codigo: string, vigencia: string): string {
  return fila(24, 0, `<table ${TABLA} bgcolor="${C.hundido}" style="background-color:${C.hundido};border:1px solid ${C.borde};border-radius:12px;border-collapse:separate">`
    + `<tr><td align="center" style="padding:26px 16px 10px 16px;font-family:${MONO};font-size:40px;line-height:46px;font-weight:700;letter-spacing:12px;color:${C.tinta}">`
    + `<span style="padding-left:12px">${escapeHtml(codigo)}</span></td></tr>`
    + `<tr><td align="center" style="padding:0 16px 22px 16px;font-size:14px;line-height:20px;color:${C.marca};font-weight:600">Vence en ${escapeHtml(vigencia)}</td></tr></table>`)
}

/** Un botón ancho «a prueba de balas»; con una URL que no es http(s), no sale. */
function botonHtml(b: BotonCorreo): string {
  const url = urlSegura(b.url)
  if (!url) return ''
  const [fondo, borde, tinta, relleno, letra] = b.secundario
    ? ['#ffffff', `border:1px solid ${C.bordeBoton};`, C.tinta, '15px 24px', 'font-size:16px;line-height:22px;font-weight:600']
    : [C.marca, '', '#ffffff', '16px 24px', 'font-size:17px;line-height:22px;font-weight:700']
  return `<tr><td align="center" bgcolor="${fondo}" style="background-color:${fondo};${borde}border-radius:10px">`
    + `<a href="${escapeHtml(url)}" target="_blank" style="display:block;padding:${relleno};${letra};color:${tinta};text-decoration:none;border-radius:10px">`
    + `${escapeHtml(b.texto)}</a></td></tr>`
}

function botonesHtml(b: Extract<BloqueCorreo, { tipo: 'botones' }>): string {
  const antes = b.antes ? `<p style="margin:0 0 14px 0;font-size:15px;line-height:23px;color:${C.texto}">${escapeHtml(b.antes)}</p>` : ''
  const botones = b.botones.map(botonHtml).filter(Boolean)
  const tabla = botones.length
    ? `<table ${TABLA}>${botones.join('<tr><td style="height:12px;font-size:0;line-height:0">&nbsp;</td></tr>')}</table>`
    : ''
  const lineas = [...(b.nota ?? []).map(escapeHtml), llamadaHtml(b.llamada)].filter(Boolean)
  const nota = lineas.length && tabla
    ? `<p style="margin:${b.arriba === 24 ? 12 : 14}px 0 0 0;font-size:14px;line-height:21px;color:${C.suave};text-align:center">${lineas.join('<br>')}</p>`
    : ''
  return antes || tabla ? fila(b.arriba ?? 28, 0, antes + tabla + nota) : ''
}

function datosHtml(b: Extract<BloqueCorreo, { tipo: 'datos' }>): string {
  const filas = b.filas.filter(f => limpio(f.valor))
  if (!filas.length) return ''
  const celda = 'padding:12px 0;font-size:15px;line-height:22px;'
  const html = filas.map((f, i) => {
    const raya = (b.raya && i === 0 ? `border-top:1px solid ${C.borde};` : '') + (i < filas.length - 1 ? `border-bottom:1px solid ${C.borde};` : '')
    const valor = f.telefono ? telefonoHtml(limpio(f.valor), `color:${C.marca};`) : escapeHtml(limpio(f.valor))
    return `<tr><td width="34%" valign="top" style="${celda}${raya}color:${C.suave};vertical-align:top">${escapeHtml(f.etiqueta)}</td>`
      + `<td style="${celda}${raya}color:${C.tinta};font-weight:600">${valor}</td></tr>`
  }).join('')
  return fila(b.arriba ?? 24, 0, `<table ${TABLA}>${html}</table>`)
}

function listaHtml(b: Extract<BloqueCorreo, { tipo: 'lista' }>): string {
  const puntos = b.puntos.map(t => `<tr><td width="22" valign="top" style="font-size:15px;line-height:24px;color:${C.marca};vertical-align:top;font-weight:700">&bull;</td>`
    + `<td style="font-size:15px;line-height:24px;color:${C.texto};padding-bottom:6px">${escapeHtml(t)}</td></tr>`).join('')
  return fila(28, 0, `<p style="margin:0 0 10px 0;font-size:16px;line-height:22px;font-weight:700;color:${C.tinta}">${escapeHtml(b.titulo)}</p><table ${TABLA}>${puntos}</table>`)
}

function recuadroHtml(b: Extract<BloqueCorreo, { tipo: 'recuadro' }>): string {
  const llamada = llamadaHtml(b.llamada)
  return fila(24, 0, `<table ${TABLA} bgcolor="${C.hundido}" style="background-color:${C.hundido};border-radius:10px"><tr>`
    + `<td style="padding:16px 20px;font-size:14px;line-height:22px;color:${C.texto}"><strong style="color:${C.tinta}">${escapeHtml(b.fuerte)}</strong> `
    + `${escapeHtml(b.texto)}${llamada ? ` ${llamada}` : ''}</td></tr></table>`)
}

function avisoHtml(b: Extract<BloqueCorreo, { tipo: 'aviso' }>): string {
  const lineas = b.lineas.map(escapeHtml).join('<br>')
  return b.raya
    ? fila(b.arriba ?? 28, 0, `<table ${TABLA} style="border-top:1px solid ${C.borde}"><tr><td style="padding-top:18px;font-size:13px;line-height:20px;color:${C.tenue}">${lineas}</td></tr></table>`)
    : fila(b.arriba ?? 24, 0, `<p style="margin:0;font-size:13px;line-height:20px;color:${C.tenue}">${lineas}</p>`)
}

function bloqueHtml(b: BloqueCorreo): string {
  switch (b.tipo) {
    case 'entrada': return entradaHtml(b)
    case 'fecha': return fechaHtml(b.fecha)
    case 'codigo': return codigoHtml(b.codigo, b.vigencia)
    case 'botones': return botonesHtml(b)
    case 'datos': return datosHtml(b)
    case 'lista': return listaHtml(b)
    case 'recuadro': return recuadroHtml(b)
    case 'aviso': return avisoHtml(b)
  }
}

const PIE_AUTOMATICO = 'Este es un mensaje automático; por favor no respondas a este correo.'

/** El HTML completo: documento, vista previa oculta, tarjeta de 600 px como máximo y pie fuera de ella. */
export function htmlCorreoCita(c: CorreoArmado): string {
  const tarjeta = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tarjeta}" style="width:100%;max-width:600px;`
    + `background-color:${C.tarjeta};border:1px solid ${C.borde};border-radius:14px;border-collapse:separate;overflow:hidden;font-family:${FUENTE}">`
    + cabecera(c.marca) + c.bloques.map(bloqueHtml).join('')
    + '<tr><td style="height:36px;font-size:0;line-height:0">&nbsp;</td></tr></table>'
  const pie = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FUENTE}">`
    // Integración M (decisión de Angel): el pie, con --ag-ink-600 y no --ag-muted. Sobre el fondo de la página
    // (#eef1f5), --ag-muted daba 3,09:1; --ag-ink-600, 5,47:1 (AA pide 4,5:1 para letra de 12 px).
    + `<tr><td align="center" style="padding:20px 24px 0 24px;font-size:12px;line-height:18px;color:${C.suave}">`
    + `${PIE_AUTOMATICO}<br>Enviado con <strong style="color:${C.navy}">Spinus</strong></td></tr></table>`
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">'
    + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
    + '<style>:root{color-scheme:light;supported-color-schemes:light}</style>'
    + `<title>${escapeHtml(c.titulo)}</title></head>`
    + `<body style="margin:0;padding:0;background-color:${C.fondo};color-scheme:light">`
    + `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.fondo};opacity:0">${escapeHtml(c.preencabezado)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fondo}" style="background-color:${C.fondo}">`
    + `<tr><td align="center" style="padding:32px 16px">${tarjeta}${pie}</td></tr></table></body></html>`
}

/**
 * `enTexto` sustituye la frase, los botones y la nota; la frase del teléfono sale siempre que haya teléfono.
 * Como en el HTML: si había botones y ninguno tiene URL segura, sólo queda la frase de antes.
 */
function botonesTexto(b: Extract<BloqueCorreo, { tipo: 'botones' }>): string {
  if (b.botones.length && !b.botones.some(x => urlSegura(x.url))) return b.antes ?? ''
  const propio = b.enTexto ?? [
    ...(b.antes ? [b.antes] : []),
    ...b.botones.flatMap(x => { const u = urlSegura(x.url); return u ? [`${x.texto}: ${u}`] : [] }),
    ...(b.nota ?? []),
  ]
  return [...propio, llamadaTexto(b.llamada)].filter(Boolean).join('\n')
}

function bloqueTexto(b: BloqueCorreo): string {
  switch (b.tipo) {
    case 'entrada': return [b.pildora?.texto, b.encabezado, ...(b.parrafos ?? [])].filter(Boolean).join('\n\n')
    case 'fecha': return `Fecha: ${b.fecha.dia.toLocaleLowerCase('es-MX')} ${b.fecha.fecha} a las ${b.fecha.hora}${b.fecha.zona ? `, ${b.fecha.zona}` : ''}.`
    case 'codigo': return `Tu código es ${b.codigo}.\nVence en ${b.vigencia}.`
    case 'botones': return botonesTexto(b)
    case 'datos': return b.filas.filter(f => limpio(f.valor))
      .map(f => `${f.etiqueta}: ${f.telefono ? telefonoLegible(limpio(f.valor)).texto : limpio(f.valor)}`).join('\n')
    case 'lista': return [`${b.titulo}:`, ...b.puntos.map(t => `- ${t}`)].join('\n')
    case 'recuadro': return [b.fuerte, b.texto, llamadaTexto(b.llamada)].filter(Boolean).join(' ')
    case 'aviso': return b.lineas.join('\n')
  }
}

/**
 * El texto plano, de los mismos bloques y en el mismo orden que el HTML; al
 * final el pie con «Enviado con Spinus». Arriba, el médico (sin él, «Spinus») y
 * su consultorio: en el texto el médico va primero, como desde la tanda I
 * (punto 21: el correo se presenta a nombre del médico; lo leen las e2e).
 */
export function textoCorreoCita(c: CorreoArmado): string {
  const consultorio = limpio(c.marca.consultorio)
  const encabezado = [limpio(c.marca.medico) || 'Spinus', ...(consultorio ? [consultorio] : [])].join('\n')
  const cuerpo = c.bloques.map(bloqueTexto).filter(Boolean)
  return [encabezado, ...cuerpo, `${PIE_AUTOMATICO}\nEnviado con Spinus`].join('\n\n')
}

/**
 * La zona de la hora, como la dice la maqueta: «hora de Yucatán». El nombre del
 * estado o de la región para los husos de México de `ZONAS_MEXICO`
 * (`src/lib/consultorios/zonas-mexico.ts`; una prueba exige que estén todos).
 * Una zona que no está ahí (un IANA de fuera de México) sale como hasta hoy:
 * «zona horaria: <IANA>».
 */
const HORA_DE_ZONA: Record<string, string> = {
  'America/Tijuana': 'hora de Baja California',
  'America/Mazatlan': 'hora del Pacífico',
  'America/Hermosillo': 'hora de Sonora',
  'America/Mexico_City': 'hora del centro de México',
  'America/Merida': 'hora de Yucatán',
  'America/Monterrey': 'hora de Nuevo León, Coahuila y Tamaulipas',
  'America/Matamoros': 'hora de Tamaulipas',
  'America/Chihuahua': 'hora de Chihuahua',
  'America/Ojinaga': 'hora de Chihuahua',
  'America/Ciudad_Juarez': 'hora de Chihuahua',
  'America/Bahia_Banderas': 'hora de Bahía de Banderas',
  'America/Cancun': 'hora de Quintana Roo',
}

export function horaDeZona(zona: string): string {
  return HORA_DE_ZONA[zona] ?? `zona horaria: ${zona}`
}

/** Una zona IANA válida, o la de la clínica por omisión (`America/Mexico_City`). */
export function zonaValida(zona: string | null | undefined): string {
  if (!zona) return 'America/Mexico_City'
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona })
    return zona
  } catch {
    return 'America/Mexico_City'
  }
}

/**
 * La fecha de la cita en la zona dada: el bloque grande («Viernes», «20 de
 * noviembre», «08:00 h», «hora de Yucatán») y la fecha completa de la vista
 * previa («viernes 20 de noviembre de 2026»).
 */
export function fechaDeCorreo(inicio: string, zona: string): FechaCorreo & { completa: string } {
  const instante = new Date(inicio)
  const parte = (o: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('es-MX', { ...o, timeZone: zona }).format(instante)
  const dia = parte({ weekday: 'long' })
  const fecha = parte({ day: 'numeric', month: 'long' })
  const hora = `${parte({ hour: '2-digit', minute: '2-digit', hour12: false })} h`
  return {
    dia: dia.charAt(0).toLocaleUpperCase('es-MX') + dia.slice(1), fecha, hora, zona: horaDeZona(zona),
    completa: `${dia} ${fecha} de ${parte({ year: 'numeric' })}`,
  }
}
