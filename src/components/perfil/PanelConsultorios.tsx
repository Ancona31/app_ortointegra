'use client'

import { useState } from 'react'
import { MapPin, Plus, Star, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'
import { MAX_CONSULTORIOS } from '@/components/perfil/piezasDatos'

/**
 * Región 4 del spec: la pestaña Consultorios entera — lista en lectura,
 * edición EN LÍNEA y las reglas de borrado.
 *
 * ⚠️ LA EDICIÓN EN LÍNEA SUSTITUYE A `EditConsultorioModal`, QUE QUEDA
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

  return (
    <>
      <section className="sp-card flex flex-col gap-[var(--sp-3)]">

        {/* ⚠️ `sm:flex-nowrap` ES LO QUE MANTIENE EL BOTÓN EN LA FILA DEL
            TÍTULO, y sin él no basta con `justify-between`. Medido: a los 566 px
            útiles de la card, el título más la línea de apoyo por su ancho
            MÁXIMO (352 px), no por lo que encogería, y con el botón al lado se pasaba, y
            `flex-wrap` responde bajando el botón a una fila propia — que es lo
            que se está corrigiendo.
            Sin envoltura, el bloque de texto encoge (`min-w-0`) y recibe 344 px:
            el título entra de sobra con sus 127 y la que pasa a dos líneas es la
            frase de apoyo, que es donde debe absorberse.
            ⚠️ POR DEBAJO DE `sm` SÍ ENVUELVE, Y ES DELIBERADO: en un móvil la
            card mide ~304 px y el botón solo ya son 210, así que forzar la misma
            fila dejaría 94 px para el título. Ahí baja, y está bien. */}
        <div className="flex flex-wrap items-start justify-between gap-[var(--sp-3)] sm:flex-nowrap">
          <div className="min-w-0">
            <h2 className="text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">Mis consultorios</h2>
            <p className="sp-hint mt-[var(--sp-gap-title-sub)]">
              {total} de {MAX_CONSULTORIOS} activos · el predeterminado es el que se abre al iniciar sesión.
            </p>
          </div>

          {/* ⚠️ INHABILITADO = SECUNDARIO, NO PRIMARIO APAGADO, igual que en la
              barra de guardado: `.sp-btn--primary:disabled` pinta blanco sobre
              un gris azulado que no llega al 4.5:1.

              ⚠️ EL RÓTULO ES «Agregar» A SECAS, Y EL COMPLETO VIVE EN
              `aria-label`. Con «Agregar consultorio» y el relleno de 26 px del
              primario el botón medía 220-252 px según la fuente: un 40 % del
              ancho de la card para una acción secundaria. Con el rótulo corto y
              el relleno del anexo (18 px) baja a 120-132. El sentido no se
              pierde: va pegado al título «Mis consultorios» y lleva el «+», y
              quien usa lector de pantalla sigue oyendo la frase entera.

              ⚠️ LA ALTURA NO BAJA, Y NO ES UN OLVIDO: `--sp-tap` son 44 px y el
              sistema los declara «ÁREA TÁCTIL MÍNIMA — nunca menor». No hay
              escalón por debajo que el sistema permita, así que todo el ahorro
              sale del ancho. */}
          <button
            type="button"
            onClick={onAgregar}
            disabled={topeAlcanzado}
            aria-label="Agregar consultorio"
            className={`sp-btn ${topeAlcanzado ? 'sp-btn--secondary' : 'sp-btn--primary'} shrink-0 px-[var(--sp-4-5)] disabled:cursor-not-allowed`}
          >
            <Plus size={16} /> Agregar
          </button>
        </div>

        {/* El tope de 10 lo impone un trigger de base de datos. Hasta ahora la
            interfaz no lo conocía y sólo se descubría con un 409 al intentar
            crear el número once. */}
        {topeAlcanzado && (
          <p className="sp-hint">
            Has llegado al máximo de {MAX_CONSULTORIOS} consultorios activos. Para crear otro, elimina uno antes.
          </p>
        )}

        {cargando ? (
          <div className="flex flex-col gap-[var(--sp-2)]">
            <div className="skeleton h-[76px] rounded-[var(--sp-r-field)]" />
            <div className="skeleton h-[76px] rounded-[var(--sp-r-field)]" />
            <div className="skeleton h-[76px] rounded-[var(--sp-r-field)]" />
          </div>
        ) : total === 0 ? (
          /* No debería ocurrir —toda cuenta nace con uno— pero si el trigger
             fallara alguna vez, la salida no puede ser una lista vacía muda. */
          <div
            className="flex flex-col items-center gap-[var(--sp-3)] rounded-[var(--sp-r-card-inner)] px-[var(--sp-5)] py-[var(--sp-7)]"
            style={{ border: 'var(--sp-bw-dash) dashed var(--sp-line-dash)' }}
          >
            <MapPin size={20} className="text-[var(--sp-ink-150)]" />
            <p className="sp-secondary text-center">No tienes consultorios activos.</p>
            <button type="button" onClick={onAgregar} className="sp-btn sp-btn--primary">
              <Plus size={16} /> Agregar el primero
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {consultorios.map((c, i) => (
              <div
                key={c.id}
                style={i > 0 ? { borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' } : undefined}
              >
                {editandoId === c.id ? (
                  <FilaEdicion
                    consultorio={c}
                    onCancelar={() => onEditar(null)}
                    onGuardado={actualizado => { onActualizado(actualizado); onEditar(null) }}
                  />
                ) : (
                  <FilaLectura
                    consultorio={c}
                    onEditar={() => onEditar(c.id)}
                    onMarcarDefault={() => onMarcarDefault(c)}
                    onBorrar={() => onBorrar(c)}
                    puedeBorrar={puedeBorrar(c)}
                    motivoNoBorrar={motivoNoBorrar(c)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sp-card">
        <p className="sp-hint">
          El consultorio predeterminado no se puede eliminar sin marcar otro antes. La zona horaria de cada
          consultorio es la que usan la agenda y los documentos que se emiten ahí.
        </p>
      </section>
    </>
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

  return (
    <div className="flex flex-col gap-[var(--sp-2-5)] py-[var(--sp-3-5)] lg:flex-row lg:items-center lg:gap-[var(--sp-4)]">
      <div className="flex min-w-0 flex-1 items-start gap-[var(--sp-3)]">
        <span className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--sp-r-icon-md)] bg-[var(--sp-primary-bg)] text-[var(--sp-primary-text)]">
          <MapPin size={17} />
        </span>

        {/* ⚠️ TRES LÍNEAS, Y LA TERCERA NO ES CAPRICHO. El spec mete dirección,
            teléfono y zona en UNA sola línea; medido, esa línea ocupa 470-534 px
            y aquí hay 410, así que se cortaría — y lo primero en caer
            sería la zona horaria, que es justo el dato que la nota al pie
            declara gobernante de la agenda y de los documentos. Separándola con
            el teléfono en una tercera línea corta (~130 px), esa línea nunca se
            queda sin sitio.

            ⚠️ Y LA DIRECCIÓN ENVUELVE A DOS LÍNEAS, NO TRUNCA. Mismo criterio
            que la especialidad de la tarjeta de identidad y que el nombre de la
            vista previa del PDF: aquí no hay ninguna anchura que garantice que
            una dirección real entre —a 410 px caben unos 60-65 caracteres y las
            de consultorio con torre, piso y número pasan de 110—, así que
            truncar era perder dato de forma sistemática. Dos líneas cubren hasta
            ~820 px de texto y cuestan ~16 px de alto por renglón. El tope sigue
            existiendo, pero ya no lo alcanza una dirección normal. */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[var(--sp-2)]">
            <p className="min-w-0 truncate text-[length:var(--sp-fs-body)] font-bold text-[var(--sp-ink-800)]">
              {c.nombre}
            </p>
            {c.es_default && (
              <span className="shrink-0 rounded-[var(--sp-r-pill)] bg-[var(--sp-primary-bg)] px-[8px] py-[3px] text-[length:var(--sp-fs-tile)] font-bold uppercase tracking-[var(--sp-ls-label-w)] text-[var(--sp-primary-ink)]">
                Predeterminado
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">{c.direccion}</p>
          <p className="truncate text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-400)]">
            {[c.telefono, zona].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--sp-1)] max-lg:justify-end">
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
    </div>
  )
}

/**
 * ⚠️ ICONO SOLO EN ESCRITORIO, ICONO Y TEXTO POR DEBAJO DE `lg`, Y ESTÁ MEDIDO.
 * El spec pide las tres acciones como texto. A los 586 px útiles de la card
 * en `lg` —el cuerpo mide 628—, «Hacer predeterminado · Editar · Eliminar»
 * ocupa 245-294 px según la fuente y deja 222-271 px para el nombre y los datos,
 * que necesitan 470-534: se truncaría más de la mitad de cada renglón. En icono
 * las tres caben en ~110 px y quedan ~410.
 * Por debajo de `lg` el cuerpo deja de ser una columna estrecha y sí hay sitio,
 * así que ahí sale el texto —y de paso el objetivo táctil sube a 44 px, como
 * pide el spec para móvil—.
 * El icono nunca va desnudo: lleva `aria-label` y `title` en los dos tamaños.
 *
 * ⚠️ INHABILITADO POR COLOR, NO POR OPACIDAD. El spec pide que el estado
 * inhabilitado siga siendo legible; `opacity-40` sobre el rojo de peligro lo
 * deja en un rosa que no se lee. `--sp-ink-400` da 4.4:1 sobre la superficie.
 */
function BotonAccion({ icono: Icono, texto, onClick, disabled, titulo, destructivo }: {
  icono: typeof Star
  texto: string
  onClick: () => void
  disabled?: boolean
  titulo?: string
  destructivo?: boolean
}) {
  const tinta = disabled
    ? 'var(--sp-ink-400)'
    : destructivo ? 'var(--sp-danger)' : 'var(--sp-ink-500)'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo ?? texto}
      aria-label={texto}
      className="inline-flex min-h-[var(--sp-tap)] items-center justify-center gap-[var(--sp-1-5)] whitespace-nowrap rounded-[var(--sp-r-btn-sm)] px-[10px] text-[length:var(--sp-fs-hint)] font-semibold transition-colors hover:bg-[var(--sp-surface-muted)] disabled:cursor-not-allowed disabled:hover:bg-transparent lg:h-[34px] lg:min-h-0 lg:w-[34px] lg:px-0"
      style={{ color: tinta }}
    >
      <Icono size={16} />
      <span className="lg:hidden">{texto}</span>
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

  return (
    <div
      className="my-[var(--sp-2)] flex flex-col gap-[var(--sp-3)] rounded-[var(--sp-r-card-inner)] bg-[var(--sp-surface-sunken)] px-[var(--sp-5)] py-[var(--sp-4)]"
      style={{ border: 'var(--sp-bw-accent) solid var(--sp-primary-border)' }}
    >
      <div className="grid gap-[var(--sp-2-5)] sm:grid-cols-2">
        <CampoLinea etiqueta="Nombre del consultorio" obligatorio className={requiereNombreCorto ? undefined : 'sm:col-span-2'}>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Consultorio Centro" className="sp-input" />
        </CampoLinea>

        {requiereNombreCorto && (
          <CampoLinea
            etiqueta="Nombre corto"
            obligatorio
            ayuda="Máx. 12 caracteres. Es el que se ve en el menú y en la agenda."
          >
            <input type="text" value={nombreCorto} onChange={e => setNombreCorto(e.target.value)}
              maxLength={12} placeholder="Ej: Centro" className="sp-input" />
          </CampoLinea>
        )}

        <CampoLinea etiqueta="Dirección" obligatorio>
          <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
            placeholder="Ej: Calle 60 #400, Mérida, Yucatán" className="sp-input" />
        </CampoLinea>

        <CampoLinea etiqueta="Teléfono">
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
            placeholder="Ej: 999 123 4567" className="sp-input" />
        </CampoLinea>

        <CampoLinea etiqueta="Zona horaria" obligatorio className="sm:col-span-2">
          <div className="flex flex-col gap-[var(--sp-2)]">
            <div className="flex flex-wrap gap-[var(--sp-2)]">
              {CHIPS_RAPIDOS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={timezone === chip.value}
                  onClick={() => setTimezone(chip.value)}
                  className="rounded-[var(--sp-r-pill)] px-[12px] py-[6px] text-[length:var(--sp-fs-hint)] font-semibold transition-colors"
                  style={timezone === chip.value
                    ? { background: 'var(--sp-primary)', color: 'var(--sp-on-primary)', border: 'var(--sp-bw-hair) solid var(--sp-primary)' }
                    : { background: 'var(--sp-surface)', color: 'var(--sp-ink-600)', border: 'var(--sp-bw-hair) solid var(--sp-line-chip)' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="sp-input">
              <option value="">— Selecciona tu zona —</option>
              {ZONAS_MEXICO.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
        </CampoLinea>
      </div>

      {error && (
        <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-danger)]">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--sp-gap-item)]">
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          className={`sp-btn ${puedeGuardar ? 'sp-btn--primary' : 'sp-btn--secondary'} disabled:cursor-not-allowed`}
        >
          {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Guardar consultorio'}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className="sp-btn sp-btn--secondary disabled:cursor-not-allowed">
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Etiqueta, control y ayuda para el renglón en edición. */
function CampoLinea({ etiqueta, obligatorio, ayuda, className, children }: {
  etiqueta: string
  obligatorio?: boolean
  ayuda?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <label className="sp-label-field mb-[var(--sp-gap-label)] block">
        {etiqueta}
        {obligatorio && <span className="text-[var(--sp-danger)]"> *</span>}
      </label>
      {children}
      {ayuda && <p className="sp-hint mt-[var(--sp-1)]">{ayuda}</p>}
    </div>
  )
}
