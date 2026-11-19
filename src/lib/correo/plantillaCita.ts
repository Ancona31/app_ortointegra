/**
 * plantillaCita.ts — EL armado compartido de los correos de cita de la agenda
 * (tanda G1, punto 4): código para reservar, comprobante, recordatorio y
 * cualquier correo de cita nuevo (p. ej. el de confirmación propio de Spinus).
 * Tanda I, punto 21: con `marca`, a nombre del médico (cabecera con su nombre
 * y el consultorio; «Enviado con Spinus» pequeño al pie). Misma estética.
 * Pura: recibe las partes en texto llano y devuelve el HTML y el texto plano.
 *
 * Cómo está hecho, y por qué:
 *   · TABLAS Y ESTILOS EN LÍNEA. Gmail, Outlook y el correo del teléfono
 *     descartan `<style>`, las variables CSS, flex y grid. Por eso los colores
 *     van en hex: son los VALORES de los tokens `--ag-*` de globals.css con la
 *     marca de fábrica (un correo no puede leer variables). No los cambies sin
 *     cambiar el token, y ojo a la REGLA 4: el botón es `--cs` (#1e5fa8, el
 *     azul brillante), la cabecera es `--ag-navy` (#163250).
 *   · SIN IMÁGENES. La marca es texto y color: se lee igual con las imágenes
 *     bloqueadas, que es lo normal en muchos correos del teléfono.
 *   · BOTONES «A PRUEBA DE BALAS»: una celda con fondo (`bgcolor` y
 *     `background`) y un enlace con relleno dentro, a todo el ancho: se pulsan
 *     con el dedo y no dependen de CSS moderno.
 *   · TODO VALOR VA ESCAPADO AQUÍ (`escapeHtml`): quien llama pasa texto llano.
 *     Las URL, además, sólo si son `http(s)://` sin espacios ni comillas; otra
 *     cosa no se pinta (`urlSegura`).
 *   · ⚠️ NADA CLÍNICO: esta plantilla no tiene sitio para título de cita, tipo,
 *     notas, motivo ni especialidad. No se lo añadas.
 *   · ⚠️ DETERMINISTA: nada de «ahora». Resend exige el MISMO cuerpo con la
 *     misma llave de idempotencia (recordatorio y comprobante).
 *   · ⚠️ SIEMPRE EN CLARO (tanda H, punto 2 de Angel): `color-scheme` y
 *     `supported-color-schemes` en `light` (metas, `:root` y `body`) y NINGÚN
 *     `@media (prefers-color-scheme: dark)`. LÍMITE CONOCIDO: algunos buzones
 *     oscurecen por su cuenta sin preguntar (Gmail de Android y de iOS, Outlook
 *     de escritorio y de móvil invierten o atenúan los colores en su modo
 *     oscuro). Eso no se puede impedir desde el HTML; las metas sólo lo evitan
 *     donde se respetan (Apple Mail, el correo de iOS). Por eso la marca y los
 *     botones llevan su color de fondo explícito y el texto encima contrasta en
 *     las dos lecturas.
 */
import { escapeHtml } from '@/lib/htmlEscape'

/** Los colores (ver la cabecera: valores de fábrica de los tokens `--ag-*`). */
const C = {
  navy: '#163250', boton: '#1e5fa8', tinta: '#15243e', texto: '#27364f', suave: '#52627a',
  fondo: '#eef1f5', tarjeta: '#ffffff', hundido: '#f7f9fb', borde: '#e7ecf3',
} as const
const FUENTE = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export interface BotonCorreo { texto: string; url: string; secundario?: boolean }

/**
 * Tanda I, punto 21 de Angel: de QUIÉN es el correo. La cabecera lleva el
 * nombre del médico y, debajo, el consultorio, para que el paciente lo
 * reconozca; «Enviado con Spinus» queda pequeño al pie. Sin marca (o con el
 * médico vacío), la cabecera de siempre: «Spinus».
 */
export interface MarcaCorreo { medico: string; consultorio?: string | null }

export interface PartesCorreo {
  /** Texto oculto que el buzón enseña junto al asunto. */
  preencabezado: string
  /** Lo que pasó, en una línea («Tu cita quedó agendada»). */
  titulo: string
  /** Tanda L (punto 15): «Hola, Ana:», justo bajo el título, en texto llano (se escapa aquí). Sólo el nombre; nada clínico. */
  saludo?: string
  /** La fecha grande: «Viernes» y «13 de noviembre · 10:45 h». */
  fecha?: { dia: string; resto: string; zona?: string | null }
  /** El código de 6 dígitos, en grande. */
  codigo?: string
  /** Párrafos en texto llano. */
  parrafos?: string[]
  /** La frase que presenta los botones; va justo antes de ellos. */
  invitacion?: string
  /** Pares «etiqueta: valor» (médico, consultorio, dirección, teléfono). Los vacíos no salen. */
  datos?: { etiqueta: string; valor: string | null }[]
  botones?: BotonCorreo[]
  /** Letra pequeña al final. */
  pie?: string[]
  /** Tanda I, punto 21: médico y consultorio en la cabecera (ver `MarcaCorreo`). */
  marca?: MarcaCorreo
}

/** Sólo `http(s)://` y sin espacios ni comillas: lo único que entra a un `href`. */
export function urlSegura(url: string | null | undefined): string | null {
  return url && /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null
}

const p = (estilo: string, html: string): string => `<p style="margin:0 0 12px;${estilo}">${html}</p>`

/** El médico y el consultorio de la marca, recortados; `null` si no hay médico (va «Spinus»). */
function deQuien(marca: MarcaCorreo | undefined): { medico: string; consultorio: string | null } | null {
  const medico = marca?.medico.trim() ?? ''
  return medico ? { medico, consultorio: marca?.consultorio?.trim() || null } : null
}

/**
 * La marca, en texto y color, en blanco sobre el navy: el nombre del médico y,
 * debajo, el consultorio (tanda I, punto 21); sin médico, «Spinus». Sin
 * imagen: con las imágenes bloqueadas (lo normal en muchos buzones) un símbolo
 * saldría como un cuadro roto, y el nombre ya dice de quién es el correo.
 */
function cabecera(marca: MarcaCorreo | undefined): string {
  const quien = deQuien(marca)
  const sub = quien?.consultorio
    ? `<span style="display:block;margin-top:4px;font:500 14px ${FUENTE};color:${C.borde}">${escapeHtml(quien.consultorio)}</span>`
    : ''
  return `<tr><td bgcolor="${C.navy}" style="background:${C.navy};padding:18px 24px;border-radius:12px 12px 0 0">`
    + `<span style="display:block;font:800 19px ${FUENTE};color:#ffffff;letter-spacing:.01em">${escapeHtml(quien?.medico ?? 'Spinus')}</span>`
    + `${sub}</td></tr>`
}

/** «Enviado con Spinus», pequeño y fuera de la tarjeta; sólo cuando la cabecera es del médico. */
function piePlataforma(marca: MarcaCorreo | undefined): string {
  return deQuien(marca)
    ? `<tr><td align="center" style="padding:12px 8px 0;font:400 11px ${FUENTE};color:${C.suave}">Enviado con Spinus</td></tr>`
    : ''
}

function bloqueFecha(f: NonNullable<PartesCorreo['fecha']>): string {
  return `<p style="margin:0 0 16px;font:800 24px/1.25 ${FUENTE};color:${C.tinta}">`
    + `<span style="display:block;font:600 14px ${FUENTE};color:${C.boton}">${escapeHtml(f.dia)}</span>${escapeHtml(f.resto)}`
    + (f.zona ? `<span style="display:block;font:500 13px ${FUENTE};color:${C.suave};margin-top:4px">${escapeHtml(f.zona)}</span>` : '')
    + '</p>'
}

function bloqueCodigo(codigo: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>`
    + `<td align="center" bgcolor="${C.hundido}" style="background:${C.hundido};border:1px solid ${C.borde};border-radius:12px;padding:14px 0;`
    + `font:800 32px ${FUENTE};letter-spacing:8px;color:${C.tinta}">${escapeHtml(codigo)}</td></tr></table>`
}

function tablaDatos(datos: NonNullable<PartesCorreo['datos']>): string {
  const filas = datos.filter(d => d.valor?.trim()).map(d =>
    `<tr><td valign="top" style="padding:6px 12px 6px 0;font:400 14px ${FUENTE};color:${C.suave};white-space:nowrap">${escapeHtml(d.etiqueta)}</td>`
    + `<td valign="top" style="padding:6px 0;font:600 14px/1.4 ${FUENTE};color:${C.tinta}">${escapeHtml(d.valor ?? '')}</td></tr>`).join('')
  if (!filas) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.hundido}" `
    + `style="background:${C.hundido};border:1px solid ${C.borde};border-radius:12px;margin:0 0 16px">`
    + `<tr><td style="padding:8px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table></td></tr></table>`
}

/** Un botón ancho «a prueba de balas»; con una URL que no es http(s), no sale. */
function boton(b: BotonCorreo): string {
  const url = urlSegura(b.url)
  if (!url) return ''
  const fondo = b.secundario ? '#ffffff' : C.boton
  const tinta = b.secundario ? C.tinta : '#ffffff'
  const borde = b.secundario ? C.borde : C.boton
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>`
    + `<td align="center" bgcolor="${fondo}" style="background:${fondo};border:1px solid ${borde};border-radius:12px">`
    + `<a href="${escapeHtml(url)}" target="_blank" style="display:block;padding:15px 18px;font:700 16px ${FUENTE};color:${tinta};`
    + `text-decoration:none;border-radius:12px">${escapeHtml(b.texto)}</a></td></tr></table>`
}

function cuerpo(x: PartesCorreo): string {
  return [
    `<h1 style="margin:0 0 14px;font:700 20px/1.3 ${FUENTE};color:${C.tinta}">${escapeHtml(x.titulo)}</h1>`,
    x.saludo ? p(`font:400 15px/1.5 ${FUENTE};color:${C.texto}`, escapeHtml(x.saludo)) : '',
    x.fecha ? bloqueFecha(x.fecha) : '',
    x.codigo ? bloqueCodigo(x.codigo) : '',
    ...(x.parrafos ?? []).map(t => p(`font:400 15px/1.5 ${FUENTE};color:${C.texto}`, escapeHtml(t))),
    x.datos ? tablaDatos(x.datos) : '',
    x.invitacion ? p(`font:400 15px/1.5 ${FUENTE};color:${C.texto}`, escapeHtml(x.invitacion)) : '',
    ...(x.botones ?? []).map(boton),
    ...(x.pie ?? []).map(t => p(`font:400 13px/1.5 ${FUENTE};color:${C.suave}`, escapeHtml(t))),
  ].join('')
}

/** El HTML completo: documento, preencabezado oculto, cabecera de marca y tarjeta de 560 px como máximo. */
export function htmlCorreoCita(x: PartesCorreo): string {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
    + '<style>:root{color-scheme:light;supported-color-schemes:light}</style>'
    + `<title>${escapeHtml(x.titulo)}</title></head>`
    + `<body style="margin:0;padding:0;background:${C.fondo};color-scheme:light">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(x.preencabezado)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.fondo}" style="background:${C.fondo}"><tr><td align="center" style="padding:16px 12px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">${cabecera(x.marca)}`
    + `<tr><td bgcolor="${C.tarjeta}" style="background:${C.tarjeta};padding:24px;border:1px solid ${C.borde};border-top:0;border-radius:0 0 12px 12px">`
    + `${cuerpo(x)}</td></tr>${piePlataforma(x.marca)}</table></td></tr></table></body></html>`
}

/**
 * El texto plano: la marca (el médico y su consultorio; sin médico,
 * «Spinus»), el título, el saludo si lo hay y, debajo, los `renglones` que quien llama ya tenía
 * (así el texto de antes no cambia) o, sin ellos, lo mismo que el HTML en el
 * mismo orden, con cada botón seguido de su URL completa. Con médico, cierra
 * «Enviado con Spinus» (tanda I, punto 21).
 */
export function textoCorreoCita(x: PartesCorreo, renglones?: string[]): string {
  const datos = (x.datos ?? []).filter(d => d.valor?.trim()).map(d => `${d.etiqueta}: ${d.valor}`)
  const botones = (x.botones ?? []).flatMap(b => { const u = urlSegura(b.url); return u ? [`${b.texto}: ${u}`] : [] })
  const cuerpoTexto = renglones ?? [
    ...(x.fecha ? [`${x.fecha.dia}, ${x.fecha.resto}${x.fecha.zona ? ` ${x.fecha.zona}` : ''}`] : []),
    ...(x.codigo ? [x.codigo] : []),
    ...(x.parrafos ?? []),
    ...(datos.length ? [datos.join('\n')] : []),
    ...(x.invitacion ? [x.invitacion] : []),
    ...botones,
    ...(x.pie ?? []),
  ]
  const quien = deQuien(x.marca)
  const encabezado = quien ? [quien.medico, ...(quien.consultorio ? [quien.consultorio] : [])].join('\n') : 'Spinus'
  return [encabezado, x.titulo, ...(x.saludo ? [x.saludo] : []), ...cuerpoTexto, ...(quien ? ['Enviado con Spinus'] : [])].join('\n\n')
}

/**
 * «Viernes» y «13 de noviembre · 10:45 h» en la zona dada (sólo la primera
 * letra en mayúscula). Sin el año, como la maqueta: la fecha grande cabe en un
 * renglón del teléfono, y el año ya va en el texto de cada correo.
 */
export function fechaDeCorreo(inicio: string, zona: string): { dia: string; resto: string } {
  const instante = new Date(inicio)
  const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: zona }).format(instante)
  const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: zona }).format(instante)
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(instante)
  return { dia: dia.charAt(0).toLocaleUpperCase('es-MX') + dia.slice(1), resto: `${fecha} · ${hora} h` }
}
