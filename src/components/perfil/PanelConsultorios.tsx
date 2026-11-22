'use client'

import { useState } from 'react'
import { MapPin, Plus, Star, Pencil, Trash2, Loader2, Info } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'
import { MAX_CONSULTORIOS, RotuloSeccion, AyudaSeccion } from '@/components/perfil/piezasDatos'

/**
 * Región 4 del spec: la pestaña Consultorios entera — lista en lectura,
 * edición y las reglas de borrado. Desde el rediseño (B10) la edición sale en
 * la capa «Editar consultorio» (`ModalShell`) en vez de abrirse en el renglón;
 * el formulario (`FilaEdicion`) y su lógica son los mismos.
 *
 * ⚠️ ESTA EDICIÓN SUSTITUYE A `EditConsultorioModal`, QUE QUEDA
 * HUÉRFANO. Su lógica de `nombre_corto` no se reinventó: está portada literal
 * más abajo, con los mismos cuatro casos. Si vuelves a montar aquel modal,
 * tendrás dos copias de esa regla divergiendo.
 */

/* La abreviatura UTC de una zona. Se mudó aquí desde `perfil/page.tsx`, que
   dejó de necesitarla al llevarse la lista a este archivo. Sigue habiendo otra
   copia en `piezasDatos.tsx` para el resumen de la pestaña Datos: con un tercer
   consumidor, el sitio de esta función pasa a ser `lib/consultorios/`. */
function offsetDeTimezone(tz: string): string {
  const zona = ZONAS_MEXICO.find(z => z.value === tz)
  if (!zona) return ''
  const match = zona.label.match(/UTC[+-]\d+/)
  return match ? match[0] : ''
}

export default function PanelConsultorios({
  consultorios, cargando, editandoId, onEditar, onAgregar, onActualizado,
  onMarcarDefault, onBorrar, puedeBorrar, motivoNoBorrar,
}: {
  consultorios: Consultorio[]
  cargando: boolean
  /** Qué renglón está en edición. Vive en la página porque el diálogo de
   *  borrado puede pedir «editar en lugar de borrar» y necesita abrirlo. */
  editandoId: string | null
  onEditar: (id: string | null) => void
  onAgregar: () => void
  onActualizado: (c: Consultorio) => void
  onMarcarDefault: (c: Consultorio) => void
  onBorrar: (c: Consultorio) => void
  /** Las DOS reglas de borrado viven en la página, que también las usa para
   *  decidir si abre el diálogo. Aquí sólo se consultan. */
  puedeBorrar: (c: Consultorio) => boolean
  motivoNoBorrar: (c: Consultorio) => string
}) {
  const total = consultorios.length
  const topeAlcanzado = total >= MAX_CONSULTORIOS
  const editando = consultorios.find(c => c.id === editandoId) ?? null
  /* El último consultorio en edición sigue pintado mientras la capa SALE
     (260 ms): sin esto se vaciaría antes de irse. Se ajusta durante el render,
     el patrón de React para seguir a una prop. */
  const [enCapa, setEnCapa] = useState<Consultorio | null>(editando)
  if (editando && editando !== enCapa) setEnCapa(editando)

  /* Rediseño B10 (maqueta `perfil`, pestaña Consultorios): rótulo de sección
     con «Agregar» tonal a la derecha, la lista en una tarjeta y las notas
     como ayuda debajo. La edición sale en una capa titulada «Editar
     consultorio» (CALMA §30.6), con el MISMO formulario de antes. */
  return (
    <section aria-labelledby="perfil-sec-mis-consultorios">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RotuloSeccion id="perfil-sec-mis-consultorios" icono={MapPin} titulo="Mis consultorios" />
        </div>
        {/* ⚠️ EL RÓTULO ES «Agregar» A SECAS Y EL COMPLETO VIVE EN `aria-label`:
            va pegado al título «Mis consultorios» y lleva el «+». Al llegar al
            tope (lo impone un trigger de base) se apaga. */}
        <button
          type="button"
          onClick={onAgregar}
          disabled={topeAlcanzado}
          aria-label="Agregar consultorio"
          className="k-b k-b-tonal mb-1.5 shrink-0"
        >
          <Plus size={18} aria-hidden="true" /> Agregar
        </button>
      </div>

      <div className="k-tarjeta py-1">
        {cargando ? (
          <div className="flex flex-col gap-2 py-2" aria-busy="true">
            <div className="skeleton h-[72px] rounded-[12px]" />
            <div className="skeleton h-[72px] rounded-[12px]" />
            <div className="skeleton h-[72px] rounded-[12px]" />
          </div>
        ) : total === 0 ? (
          /* No debería ocurrir —toda cuenta nace con uno— pero si el trigger
             fallara alguna vez, la salida no puede ser una lista vacía muda. */
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
            <MapPin size={20} aria-hidden="true" className="text-tinta2" />
            <p className="text-[14px] leading-5 text-tinta2">No tienes consultorios activos.</p>
            <button type="button" onClick={onAgregar} className="k-b k-b-tonal">
              <Plus size={18} aria-hidden="true" /> Agregar el primero
            </button>
          </div>
        ) : (
          <ul className="k-lista">
            {consultorios.map(c => (
              <li key={c.id}>
                <FilaLectura
                  consultorio={c}
                  onEditar={() => onEditar(c.id)}
                  onMarcarDefault={() => onMarcarDefault(c)}
                  onBorrar={() => onBorrar(c)}
                  puedeBorrar={puedeBorrar(c)}
                  motivoNoBorrar={motivoNoBorrar(c)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AyudaSeccion>
        {total} de {MAX_CONSULTORIOS} activos · el predeterminado es el que se abre al iniciar sesión.
      </AyudaSeccion>
      {/* El tope de 10 lo impone un trigger de base de datos; sin esta línea
          sólo se descubría con un 409 al intentar crear el número once. */}
      {topeAlcanzado && (
        <AyudaSeccion>
          Has llegado al máximo de {MAX_CONSULTORIOS} consultorios activos. Para crear otro, elimina uno antes.
        </AyudaSeccion>
      )}
      <AyudaSeccion>
        El consultorio predeterminado no se puede eliminar sin marcar otro antes. La zona horaria de cada
        consultorio es la que usan la agenda y los documentos que se emiten ahí.
      </AyudaSeccion>

      <ModalShell
        open={editando !== null}
        cierraConVelo={false}
        onClose={() => onEditar(null)}
        title="Editar consultorio"
        maxWidth="max-w-[520px]"
      >
        {enCapa && (
          <FilaEdicion
            key={enCapa.id}
            consultorio={enCapa}
            onCancelar={() => onEditar(null)}
            onGuardado={actualizado => { onActualizado(actualizado); onEditar(null) }}
          />
        )}
      </ModalShell>
    </section>
  )
}

/* ── Renglón en lectura ──────────────────────────────────────────────────── */

function FilaLectura({ consultorio: c, onEditar, onMarcarDefault, onBorrar, puedeBorrar, motivoNoBorrar }: {
  consultorio: Consultorio
  onEditar: () => void
  onMarcarDefault: () => void
  onBorrar: () => void
  puedeBorrar: boolean
  motivoNoBorrar: string
}) {
  const zona = offsetDeTimezone(c.timezone)

  /* Rediseño B10: el motivo por el que no se puede eliminar se ENSEÑA bajo la
     fila (antes sólo vivía en `title`, que en táctil no existe). */
  return (
    <div className="flex flex-col gap-2 py-3.5 esc:flex-row esc:flex-wrap esc:items-center esc:gap-x-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sup2 text-enlace">
          <MapPin size={18} />
        </span>
        {/* ⚠️ TRES LÍNEAS, Y LA TERCERA NO ES CAPRICHO: la zona horaria es el
            dato que gobierna la agenda y los documentos, y en una línea con la
            dirección sería lo primero en cortarse. La dirección envuelve a dos
            líneas, no trunca. */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="k-t-fila min-w-0 truncate">{c.nombre}</p>
            {c.es_default && <span className="k-etq k-etq-tonal shrink-0">Predeterminado</span>}
          </div>
          <p className="k-t-sec line-clamp-2">{c.direccion}</p>
          <p className="k-t-sec k-num truncate">{[c.telefono, zona].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 esc:justify-end">
        {/* En el predeterminado no se muestra: ya lo es. */}
        {!c.es_default && (
          <BotonAccion icono={Star} texto="Hacer predeterminado" onClick={onMarcarDefault} />
        )}
        <BotonAccion icono={Pencil} texto="Editar" onClick={onEditar} />
        <BotonAccion
          icono={Trash2}
          texto="Eliminar"
          onClick={onBorrar}
          disabled={!puedeBorrar}
          titulo={puedeBorrar ? 'Eliminar' : motivoNoBorrar}
          destructivo
        />
      </div>

      {!puedeBorrar && (
        <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-tinta2 esc:basis-full esc:pl-12">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> {motivoNoBorrar}
        </p>
      )}
    </div>
  )
}

/**
 * Acción de texto de la fila (CALMA §2, nivel 3): icono de 16 y texto en
 * `--enlace`; la destructiva en `--mal-tinta`. Área de toque del kit (`.k-b`,
 * 44 en táctil y 36 en `ih`/`esc`).
 * ⚠️ INHABILITADO POR COLOR, NO SÓLO POR OPACIDAD: el rojo apagado se leía
 * como rosa. Lleva `title` con el motivo y, debajo de la fila, el motivo a la
 * vista.
 */
function BotonAccion({ icono: Icono, texto, onClick, disabled, titulo, destructivo }: {
  icono: typeof Star
  texto: string
  onClick: () => void
  disabled?: boolean
  titulo?: string
  destructivo?: boolean
}) {
  const tinta = disabled ? 'text-tinta2' : destructivo ? 'text-mal-tinta' : 'text-enlace'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo ?? texto}
      aria-label={texto}
      className={`k-b k-b-texto gap-1.5 text-[14px] ${tinta}`}
    >
      <Icono size={15} aria-hidden="true" className="hidden esc:block" />
      {texto}
    </button>
  )
}

/* ── Renglón en edición ──────────────────────────────────────────────────── */

function FilaEdicion({ consultorio: c, onCancelar, onGuardado }: {
  consultorio: Consultorio
  onCancelar: () => void
  onGuardado: (actualizado: Consultorio) => void
}) {
  const [nombre, setNombre] = useState(c.nombre)
  const [nombreCorto, setNombreCorto] = useState(c.nombre_corto)
  const [direccion, setDireccion] = useState(c.direccion)
  const [telefono, setTelefono] = useState(c.telefono ?? '')
  const [timezone, setTimezone] = useState(c.timezone)
  const [guardando, setGuardando] = useState(false)
  /* El error va DENTRO del renglón y no en un toast: el spec pide que no se
     pierda lo capturado, y un toast invita a cerrar y volver a empezar. */
  const [error, setError] = useState<string | null>(null)

  /* ⚠️ EL NOMBRE CORTO ES EL QUINTO CAMPO Y NO SOBRA. El spec lista cuatro;
     sin éste, los consultorios de nombre largo —los únicos que lo tienen
     obligatorio— no se podrían editar en línea, que es justo donde más falta
     hace. La regla es de la base: obligatorio en cuanto el nombre pasa de 12. */
  const requiereNombreCorto = nombre.trim().length > 12
  const puedeGuardar =
    nombre.trim().length > 0 &&
    direccion.trim().length > 0 &&
    timezone.length > 0 &&
    (!requiereNombreCorto || nombreCorto.trim().length > 0) &&
    !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)

    try {
      // Solo viajan los campos que cambiaron de verdad.
      const body: Record<string, unknown> = {}
      const nombreTrim = nombre.trim()
      const nombreCortoTrim = nombreCorto.trim()
      const direccionTrim = direccion.trim()
      const telefonoTrim = telefono.trim()

      if (nombreTrim !== c.nombre) body.nombre = nombreTrim
      if (direccionTrim !== c.direccion) body.direccion = direccionTrim
      if (timezone !== c.timezone) body.timezone = timezone

      // Teléfono: si el médico lo borró, enviar null para limpiarlo.
      const telefonoOriginal = c.telefono ?? ''
      if (telefonoTrim !== telefonoOriginal) {
        body.telefono = telefonoTrim.length > 0 ? telefonoTrim : null
      }

      /* Lógica de `nombre_corto`, PORTADA LITERAL de `EditConsultorioModal`
         (que esta edición en línea deja huérfano). Sus cuatro casos:
         - nombre cambió y ahora cabe en 12 → null, y el servidor lo rederiva.
         - nombre cambió y no cabe → el que escribió el médico.
         - nombre igual pero corto cambió → el nuevo, o null si quedó vacío y
           el nombre cabe.
         - nada cambió → no se envía.
         No la simplifiques sin mirar el PATCH: el servidor distingue «no vino»
         de «vino null», y ahí está toda la diferencia. */
      const nombreCambio = nombreTrim !== c.nombre
      const nombreCortoCambio = nombreCortoTrim !== c.nombre_corto

      if (nombreCambio && nombreTrim.length <= 12) {
        body.nombre_corto = null
      } else if (nombreCambio && nombreTrim.length > 12) {
        body.nombre_corto = nombreCortoTrim
      } else if (!nombreCambio && nombreCortoCambio) {
        body.nombre_corto = (nombreCortoTrim.length === 0 && nombreTrim.length <= 12)
          ? null
          : nombreCortoTrim
      }

      if (Object.keys(body).length === 0) {
        onCancelar()
        return
      }

      const res = await fetch(`/api/consultorios/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo actualizar el consultorio.')
        setGuardando(false)
        return
      }

      const { consultorio: actualizado } = await res.json() as { consultorio: Consultorio }
      onGuardado(actualizado)
    } catch {
      setError('Error de red. Verifica tu conexión.')
      setGuardando(false)
    }
  }

  /* Rediseño B10: el formulario va en la capa «Editar consultorio» (maqueta
     `perfil`): filas «rótulo — campo» en una tarjeta `--sup2` y el pie con el
     secundario a la izquierda y el principal a la derecha (CALMA §23.1). */
  return (
    <div className="flex flex-col gap-4 px-6 pt-2 pb-5 ext:px-5">
      <div className="flex flex-col divide-y divide-linea rounded-[14px] bg-fondo px-4 py-1">
        <CampoLinea etiqueta="Nombre del consultorio" obligatorio htmlFor="cons-ed-nombre">
          <input id="cons-ed-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Consultorio Centro" className={CAMPO_LINEA} />
        </CampoLinea>

        {requiereNombreCorto && (
          <CampoLinea
            etiqueta="Nombre corto"
            obligatorio
            htmlFor="cons-ed-corto"
            ayuda="Máx. 12 caracteres. Es el que se ve en el menú y en la agenda."
          >
            <input id="cons-ed-corto" type="text" value={nombreCorto} onChange={e => setNombreCorto(e.target.value)}
              maxLength={12} placeholder="Ej: Centro" className={CAMPO_LINEA} />
          </CampoLinea>
        )}

        <CampoLinea etiqueta="Dirección" obligatorio htmlFor="cons-ed-direccion">
          <input id="cons-ed-direccion" type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
            placeholder="Ej: Calle 60 #400, Mérida, Yucatán" className={CAMPO_LINEA} />
        </CampoLinea>

        <CampoLinea etiqueta="Teléfono" htmlFor="cons-ed-telefono">
          <input id="cons-ed-telefono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
            placeholder="Ej: 999 123 4567" className={CAMPO_LINEA} />
        </CampoLinea>

        <CampoLinea etiqueta="Zona horaria" obligatorio htmlFor="cons-ed-zona">
          <div className="flex flex-col gap-1 py-1.5">
            <div className="flex flex-wrap gap-2">
              {CHIPS_RAPIDOS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={timezone === chip.value}
                  onClick={() => setTimezone(chip.value)}
                  className={`k-b h-9 rounded-full px-3 text-[13px] ${timezone === chip.value ? 'bg-tonal text-tonal-tinta outline-2 -outline-offset-2 outline-accion' : 'k-b-quieto'}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <select id="cons-ed-zona" value={timezone} onChange={e => setTimezone(e.target.value)} className={CAMPO_LINEA}>
              <option value="">— Selecciona tu zona —</option>
              {ZONAS_MEXICO.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
        </CampoLinea>
      </div>

      {error && <p role="alert" className="k-campo-error">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2 max-sm:grid max-sm:grid-cols-2">
        <button type="button" onClick={onCancelar} disabled={guardando} className="k-b k-b-quieto min-w-[104px]">
          Cancelar
        </button>
        {/* ⚠️ INHABILITADO = QUIETO, NO PRIMARIO APAGADO (contraste). */}
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          className={`k-b ${puedeGuardar ? 'k-b-prim' : 'k-b-quieto'} min-w-[104px]`}
        >
          {guardando ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Guardando…</> : 'Guardar consultorio'}
        </button>
      </div>
    </div>
  )
}

/** El control de una fila de la capa: sin caja, a 15 px, alto táctil de 44. */
const CAMPO_LINEA = 'block w-full min-h-11 border-0 bg-transparent p-0 text-[15px] leading-5 text-tinta placeholder:text-tinta3 outline-none focus:outline-none k-campo-sin-caja'

/** Etiqueta, control y ayuda de una fila: apilados en teléfono, en dos columnas desde 640. */
function CampoLinea({ etiqueta, obligatorio, ayuda, htmlFor, children }: {
  etiqueta: string
  obligatorio?: boolean
  ayuda?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="-mx-2 grid min-w-0 grid-cols-1 gap-0.5 rounded-[10px] px-2 pt-2.5 pb-1 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-enlace sm:grid-cols-[168px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:py-1">
      <label htmlFor={htmlFor} className="text-[13px] leading-[18px] text-tinta2 sm:pt-[13px]">
        {etiqueta}
        {obligatorio && <span className="text-mal-tinta"> *</span>}
      </label>
      <div className="min-w-0">
        {children}
        {ayuda && <p className="pb-2 text-[13px] leading-[18px] text-tinta2">{ayuda}</p>}
      </div>
    </div>
  )
}
