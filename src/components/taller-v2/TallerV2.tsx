/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Taller de componentes del chasis de documentos v2. Herramienta interna de
 * desarrollo: renderiza un PDF real con los componentes de `src/lib/pdf/v2/` que
 * ya existan, para poder validarlos uno por uno antes de que exista el formato
 * que los consume.
 *
 * Vive bajo `/super-admin/dashboard/`, cuyo layout ya exige sesión con
 * `role = 'super_admin'` en el servidor. No añade ni relaja ninguna validación.
 *
 * NO toca v1, ni los formularios, ni el flujo del médico. NO lee ni escribe base
 * de datos ni Storage: el médico es ficticio y está aquí abajo. El único trabajo
 * asíncrono es generar el blob del PDF en memoria.
 *
 * Cuando la Fase 1 cierre: borrar `src/components/taller-v2/` y
 * `src/app/super-admin/dashboard/taller-v2/`. El chasis no depende de nada de
 * aquí.
 */
'use client'

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import {
  ACENTO_BASE_POR_DEFECTO,
  CAJA,
  ZONA_SEGURA,
  contrasteSobreBlanco,
  leerHex,
  resolverAcento,
} from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Médico de prueba del taller. Persona INVENTADA y cédulas inventadas: este
 * archivo no toca la base y nunca debe traer datos de un médico real.
 *
 * El logo apunta a un asset del propio repo para no depender de la red. Es
 * cuadrado a propósito: metido en la caja de 33 × 19 pt del panel se ve que cabe
 * sin recortarse y sin deformarse, que es la regla 1 de 2.A.
 */
const MEDICO_FICTICIO: MedicoFicticio = {
  nombre: 'Dra. Elena Marín Solís',
  iniciales: 'EM',
  especialidad: 'Ortopedia y Traumatología',
  cedulaProfesional: '7000001',
  cedulaEspecialidad: '8000002',
  universidad: 'Universidad Nacional Autónoma de México',
  domicilio: 'Av. Ficticia 100, Consultorio 3, Col. Ejemplo, 06700 CDMX',
  telefono: '55 0000 0000',
  logo: '/icon-192.png',
}

/** Acentos con los que vale la pena mirar el chasis. */
const ACENTOS_DE_PRUEBA: ReadonlyArray<{ nombre: string; hex: string }> = [
  { nombre: 'Azul por defecto', hex: ACENTO_BASE_POR_DEFECTO },
  { nombre: 'Mostaza saturado', hex: '#D6A429' },
  { nombre: 'Verde', hex: '#2E7D4F' },
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Negro', hex: '#000000' },
]

/**
 * Especialidad larga para comprobar la regla 3 de 2.B: no se abrevia, rompe a
 * dos líneas. Es una cadena real de las que se ven en cédulas de especialidad.
 */
const ESPECIALIDAD_LARGA =
  'Ortopedia y Traumatología · Cirugía Articular y Reconstructiva de Cadera y Rodilla'

/** Espera antes de regenerar, para no lanzar un PDF por cada tick del picker. */
const ESPERA_MS = 220

/**
 * Qué PDF se está mirando. La hoja de chasis y los formatos son documentos
 * distintos y no pueden convivir en el mismo: el chasis va con guías y en
 * posición absoluta, y un formato va sin guías y en flujo.
 */
type Vista =
  | 'chasis'
  | 'laboratorio'
  | 'imagenologia'
  | 'receta'
  | 'suplementacion'
  | 'honorarios'
  | 'internamiento'
  | 'consentimiento'
  | 'escrito'

/**
 * EL SELECTOR — EL CHASIS Y LOS OCHO FORMATOS DE LA SECCIÓN II.
 *
 * Una entrada por vista, construida o no. **Las pendientes se listan igual**, en
 * gris y sin poder pulsarse, y eso es deliberado: el selector es el índice del paso
 * 4 y un índice que solo enseña lo hecho no dice cuánto falta. Cada una se enciende
 * al construir su formato, y lo único que hay que tocar es su `vista`.
 *
 * El `codigo` y el `nombre` van separados porque el botón los compone en dos
 * renglones. En uno solo, `4.7 · Consentimiento` no cabe en media columna del panel
 * de 320 pt y se corta — que es el defecto que esta tabla arregla.
 *
 * ⚠ **SON NUEVE Y NO DIEZ.** La Sección II declara ocho formatos —II.1 a II.8— y con
 * el chasis son nueve. **Ya no falta ninguno**: las nueve entradas están construidas y
 * ninguna se pinta en gris. Si el décimo es una vista que no está en la Sección II —una
 * hoja de vista previa, o el chasis partido en dos—, dime cuál y entra aquí sin tocar
 * nada más: la retícula envuelve.
 */
interface EntradaSelector {
  /** `null` mientras el formato no exista: la entrada se pinta y no se pulsa. */
  readonly vista: Vista | null
  readonly codigo: string
  readonly nombre: string
}

const VISTAS: readonly EntradaSelector[] = [
  { vista: 'chasis', codigo: 'I.2', nombre: 'Chasis' },
  { vista: 'laboratorio', codigo: '4.1', nombre: 'Laboratorio' },
  { vista: 'imagenologia', codigo: '4.2', nombre: 'Imagenología' },
  { vista: 'receta', codigo: '4.3', nombre: 'Receta' },
  { vista: 'suplementacion', codigo: '4.4', nombre: 'Suplementación' },
  { vista: 'honorarios', codigo: '4.5', nombre: 'Honorarios' },
  { vista: 'internamiento', codigo: '4.6', nombre: 'Internamiento' },
  { vista: 'consentimiento', codigo: '4.7', nombre: 'Consentimiento' },
  { vista: 'escrito', codigo: '4.8', nombre: 'Escrito médico' },
]

/**
 * LOS CASOS DE CADA FORMATO. Los cuatro formatos construidos declaran los mismos
 * tres, y el `lleno` es el único que desborda: es el que enseña la hoja de
 * continuación, que es lo que 2.N añadió al chasis.
 *
 * En Suplementación el `mínimo` hace además de segunda mitad de su verificación
 * visible: va SIN PESO, y con él desaparecen la celda `BASE DEL CÁLCULO` del riel y el
 * rótulo `Dosis calculada para NN kg` de la cabecera (II.4 §6).
 *
 * El chasis no tiene casos —es una hoja de muestras, no un documento—, así que su
 * selector no aparece.
 */
interface EntradaCaso {
  readonly caso: string
  readonly etiqueta: string
  readonly nota: string
}

const CASOS: readonly EntradaCaso[] = [
  { caso: 'completo', etiqueta: 'Completo', nota: 'Todos los estados de la entrada' },
  { caso: 'minimo', etiqueta: 'Mínimo', nota: 'Lo justo, sin bloques de cierre' },
  { caso: 'lleno', etiqueta: 'Lleno', nota: 'Desborda: enseña la hoja 2' },
]

/**
 * LOS CASOS DE HONORARIOS NO SON LOS TRES DE ARRIBA, y no es una comodidad del taller:
 * ese formato tiene DOS documentos —cotización y recibo— con trece diferencias medidas
 * entre ellos, así que su eje no es cuánto contenido trae sino cuál de los dos se emite.
 * El tercero es un recibo de un concepto **sin paciente**, que es lo único que enseña la
 * línea de escritura del riel.
 *
 * El `lleno` de los otros cuatro lo hace aquí el recibo, que con sus 14 conceptos
 * desborda y enseña la hoja de continuación con el eco del total.
 */
const CASOS_HONORARIOS: readonly EntradaCaso[] = [
  { caso: 'cotizacion', etiqueta: 'Cotización', nota: 'Aseguradora, origen, subtotales y QR' },
  { caso: 'recibo', etiqueta: 'Recibo', nota: '14 conceptos: desborda y enseña la hoja 2' },
  { caso: 'minimo', etiqueta: 'Mínimo', nota: 'Un concepto y el paciente vacío' },
]

/**
 * LOS DE INTERNAMIENTO TAMPOCO SON LOS TRES DE ARRIBA, y por una razón distinta: **su
 * reparto en hojas es estructural, no por capacidad**. Un caso `lleno` no enseñaría nada —
 * la sección 2 abre en su propia hoja con una indicación o con veinte—, así que el tercero
 * es la verificación visible de II.6 §6: indicaciones con dos renglones de prosa delante,
 * que tienen que salir en minúsculas y sin raya.
 */
const CASOS_INTERNAMIENTO: readonly EntradaCaso[] = [
  { caso: 'completo', etiqueta: 'Completo', nota: 'Las tres hojas, con badge y sección 2' },
  { caso: 'minimo', etiqueta: 'Mínimo', nota: 'Sin sección 2: colapsa la hoja 3' },
  { caso: 'prosa', etiqueta: 'Prosa', nota: 'II.6 §6: prosa suelta antes de los bloques' },
]

/**
 * LOS DE CONSENTIMIENTO tampoco son los tres de arriba, y por una tercera razón: sus ramas
 * no son de cantidad sino de CASO CLÍNICO. Lo que cambia entre ellos es si hay fotografías
 * —de eso depende que exista la hoja de anexo— y si el paciente puede firmar por sí mismo.
 */
const CASOS_CONSENTIMIENTO: readonly EntradaCaso[] = [
  { caso: 'completo', etiqueta: 'Completo', nota: 'Cinco firmantes, tres niveles y anexo' },
  { caso: 'sinFotos', etiqueta: 'Sin fotos', nota: 'La hoja de anexo NO aparece' },
  { caso: 'sustitucion', etiqueta: 'Sustitución', nota: 'Sin nivel 2: Testigos pasa a 2' },
  { caso: 'sinSellar', etiqueta: 'Sin sellar', nota: 'Sin sellos: nada que sellar' },
]

/**
 * LOS DE ESCRITO MÉDICO SON CUATRO Y NO TRES, y su eje no es el contenido sino el TÍTULO:
 * es el único formato cuyo título lo escribe el médico, así que lo que hay que ver es qué
 * pasa cuando crece —hasta tres renglones— y cuando no está.
 */
const CASOS_ESCRITO: readonly EntradaCaso[] = [
  { caso: 'corto', etiqueta: 'Corto', nota: 'Un renglón: la fecha se alinea con él' },
  { caso: 'medio', etiqueta: 'Medio', nota: 'Un renglón, cadena más larga' },
  { caso: 'largo', etiqueta: 'Largo', nota: 'Tres renglones: la fecha va con la primera' },
  { caso: 'sin', etiqueta: 'Sin título', nota: 'Hueco de 20 pt, no cero, y con filete' },
]

/** Qué casos ofrece cada vista. Las que no aparecen usan los tres de `CASOS`. */
function casosDe(vista: Vista): readonly EntradaCaso[] {
  if (vista === 'honorarios') return CASOS_HONORARIOS
  if (vista === 'internamiento') return CASOS_INTERNAMIENTO
  if (vista === 'consentimiento') return CASOS_CONSENTIMIENTO
  if (vista === 'escrito') return CASOS_ESCRITO
  return CASOS
}

type Estado =
  | { fase: 'generando' }
  | { fase: 'listo'; url: string }
  | { fase: 'error'; mensaje: string }

function contraste(hex: string): string {
  const rgb = leerHex(hex)
  return rgb === null ? '—' : `${contrasteSobreBlanco(rgb).toFixed(2)} : 1`
}

export default function TallerV2(): ReactElement {
  const [vista, setVista] = useState<Vista>('chasis')
  const [caso, setCaso] = useState<string>('completo')
  const [acentoHex, setAcentoHex] = useState<string>(ACENTO_BASE_POR_DEFECTO)
  const [logo, setLogo] = useState<string>(MEDICO_FICTICIO.logo)
  const [nombreLogo, setNombreLogo] = useState<string>('icon-192.png · 1:1')
  const [especialidadLarga, setEspecialidadLarga] = useState<boolean>(false)
  const [estado, setEstado] = useState<Estado>({ fase: 'generando' })

  const acento = resolverAcento(acentoHex)
  /** Qué casos ofrece la vista que se está mirando. Ver `casosDe`. */
  const casos = casosDe(vista)

  /**
   * Cambiar de vista **reinicia el caso al primero de la nueva**: los de Honorarios no
   * son los de los otros cuatro, así que un `completo` heredado dejaría el selector
   * marcando un botón que no existe y el PDF cayendo al caso por defecto sin decirlo.
   */
  function elegirVista(nueva: Vista): void {
    setVista(nueva)
    setCaso(casosDe(nueva)[0].caso)
  }

  /**
   * Carga un logo del disco como data URL. No sube nada a ninguna parte: se
   * queda en memoria de esta pestaña. Sirve para comprobar la regla 1 de 2.A con
   * logos cuadrados, apaisados y verticales de verdad.
   */
  function elegirLogo(archivo: File | undefined): void {
    if (archivo === undefined) return
    const lector = new FileReader()
    lector.onload = () => {
      if (typeof lector.result === 'string') {
        setLogo(lector.result)
        setNombreLogo(archivo.name)
      }
    }
    lector.readAsDataURL(archivo)
  }

  useEffect(() => {
    let cancelado = false
    let urlCreada: string | null = null

    const temporizador = setTimeout(() => {
      setEstado({ fase: 'generando' })
      void (async () => {
        try {
          const medico = {
            ...MEDICO_FICTICIO,
            logo,
            especialidad: especialidadLarga
              ? ESPECIALIDAD_LARGA
              : MEDICO_FICTICIO.especialidad,
          }
          // Los módulos se importan a demanda, como ya hacía el del chasis:
          // arrastran @react-pdf/renderer entero —y el de Receta además `qrcode`— y
          // no tienen por qué entrar en el bundle de la barra lateral.
          const generar =
            vista === 'laboratorio'
              ? (await import('./HojaLaboratorio')).generarPdfLaboratorio
              : vista === 'imagenologia'
                ? (await import('./HojaImagenologia')).generarPdfImagenologia
                : vista === 'receta'
                  ? (await import('./HojaReceta')).generarPdfReceta
                  : vista === 'suplementacion'
                    ? (await import('./HojaSuplementacion')).generarPdfSuplementacion
                    : vista === 'honorarios'
                      ? (await import('./HojaHonorarios')).generarPdfHonorarios
                      : vista === 'internamiento'
                        ? (await import('./HojaInternamiento')).generarPdfInternamiento
                        : vista === 'consentimiento'
                        ? (await import('./HojaConsentimiento')).generarPdfConsentimiento
                        : // La hoja de chasis no tiene casos: se le pasa el argumento y lo
                      // ignora, que es más barato que ramificar la llamada.
                      (await import('./HojaTaller')).generarPdfTaller
          const blob = await generar(medico, acentoHex, caso)
          if (cancelado) return
          urlCreada = URL.createObjectURL(blob)
          setEstado({ fase: 'listo', url: urlCreada })
        } catch (err) {
          if (cancelado) return
          setEstado({
            fase: 'error',
            mensaje: err instanceof Error ? err.message : 'Error desconocido',
          })
        }
      })()
    }, ESPERA_MS)

    return () => {
      cancelado = true
      clearTimeout(temporizador)
      if (urlCreada !== null) URL.revokeObjectURL(urlCreada)
    }
  }, [acentoHex, logo, especialidadLarga, vista, caso])

  const derivados: ReadonlyArray<{
    token: string
    hex: string
    contraste: string | null
  }> = [
    { token: 'acento.base', hex: acento.base, contraste: null },
    { token: 'acento.tinta', hex: acento.tinta, contraste: contraste(acento.tinta) },
    { token: 'acento.banda', hex: acento.banda, contraste: contraste(acento.banda) },
    { token: 'acento.velo', hex: acento.velo, contraste: null },
  ]

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Taller de componentes · documentos v2</h1>
        <p className="mt-1 text-xs text-amber-400/80">
          Herramienta interna temporal. Se borra al cerrar la Fase 1. No toca la base
          de datos ni el renderer v1.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-800 p-6 text-sm">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Qué se está mirando
            </h2>
            {/*
              RETÍCULA DE DOS COLUMNAS QUE ENVUELVE, no una fila.

              Con una fila el cuarto botón ya salía medio tapado y el quinto no
              entraba; con `grid-cols-2` el selector crece hacia abajo y el panel, que
              ya es `overflow-y-auto`, se encarga del resto. El código y el nombre van
              en dos renglones para que ninguna etiqueta se corte: en una sola línea,
              `4.7 · Consentimiento` no cabe en media columna de 320 pt.
            */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {VISTAS.map((v) => {
                const activa = v.vista !== null && vista === v.vista
                const pendiente = v.vista === null
                return (
                  <button
                    key={v.codigo}
                    type="button"
                    disabled={pendiente}
                    onClick={() => v.vista !== null && elegirVista(v.vista)}
                    title={pendiente ? 'Todavía no construido' : undefined}
                    className={`rounded border px-2.5 py-1.5 text-left text-xs ${
                      activa
                        ? 'border-slate-500 bg-slate-800 text-slate-100'
                        : pendiente
                          ? 'cursor-not-allowed border-dashed border-slate-800 text-slate-600'
                          : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="block font-mono text-[10px] leading-4 opacity-70">
                      {v.codigo}
                    </span>
                    <span className="block leading-4">{v.nombre}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Las entradas en gris son los formatos que faltan por construir. El
              formato va SIN guías: un documento tiene que verse como un documento.
            </p>

            {vista === 'chasis' ? null : (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Caso
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {casos.map((c) => (
                    <button
                      key={c.caso}
                      type="button"
                      onClick={() => setCaso(c.caso)}
                      title={c.nota}
                      className={`rounded border px-2 py-1.5 text-xs ${
                        caso === c.caso
                          ? 'border-slate-500 bg-slate-800 text-slate-100'
                          : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      {c.etiqueta}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  <strong className="text-slate-400">
                    Cada caso es un documento entero, no una hoja de un documento
                    común.
                  </strong>{' '}
                  Es lo que ocurre en emisión real —un documento es un formato— y
                  componer varios en uno produce un resultado que en producción no
                  existe. El caso <em>lleno</em> desborda: es el que enseña la hoja de
                  continuación con su membrete, su folio y el nombre del paciente.
                </p>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Acento del médico
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={acentoHex}
                onChange={(e) => setAcentoHex(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border border-slate-700 bg-transparent"
                aria-label="Color de acento"
              />
              <input
                type="text"
                value={acentoHex}
                onChange={(e) => setAcentoHex(e.target.value)}
                spellCheck={false}
                className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                aria-label="Acento en hexadecimal"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACENTOS_DE_PRUEBA.map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  onClick={() => setAcentoHex(a.hex)}
                  title={`${a.nombre} · ${a.hex}`}
                  className="h-7 w-7 rounded-full border border-slate-600"
                  style={{ backgroundColor: a.hex }}
                  aria-label={a.nombre}
                />
              ))}
            </div>
            {!acento.valido && (
              <p className="mt-3 rounded bg-slate-900 p-2 text-xs text-amber-400">
                Hex inválido: el chasis cae a tinta negra con el acento desactivado.
                El documento se emite igual.
              </p>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Derivación (I.1.8)
            </h2>
            <ul className="mt-3 space-y-2">
              {derivados.map((d) => (
                <li key={d.token} className="flex items-center gap-3">
                  <span
                    className="h-6 w-6 shrink-0 rounded border border-slate-600"
                    style={{ backgroundColor: d.hex }}
                  />
                  <span className="font-mono text-xs">
                    <span className="text-slate-400">{d.token}</span> {d.hex}
                    {d.contraste !== null && (
                      <span className="text-slate-500"> · {d.contraste}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              El contraste es sobre papel blanco. <code>acento.tinta</code> nunca baja
              de 4.5 y <code>acento.banda</code> nunca de 7, sea cual sea el acento.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Logo del panel
            </h2>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => elegirLogo(e.target.files?.[0])}
              className="mt-3 w-full text-xs text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
            />
            <p className="mt-2 font-mono text-xs text-slate-500">{nombreLogo}</p>
            <p className="mt-2 text-xs text-slate-500">
              Pruébalo con uno cuadrado, uno apaisado y uno vertical: los tres deben
              llenar el círculo, ninguno debe salir estirado. Solo PNG o JPG
              (I.3.8). No se sube a ninguna parte: se queda en esta pestaña.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Especialidad
            </h2>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={especialidadLarga}
                onChange={(e) => setEspecialidadLarga(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Especialidad larga. Debe romper a dos líneas y no abreviarse ni
                cortarse (regla 3 de 2.B).
              </span>
            </label>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Médico ficticio
            </h2>
            <dl className="mt-3 space-y-1 text-xs text-slate-400">
              <div>{MEDICO_FICTICIO.nombre}</div>
              <div>{MEDICO_FICTICIO.especialidad}</div>
              <div>
                Céd. Prof. {MEDICO_FICTICIO.cedulaProfesional} · Céd. Esp.{' '}
                {MEDICO_FICTICIO.cedulaEspecialidad}
              </div>
              <div>{MEDICO_FICTICIO.universidad}</div>
              <div>{MEDICO_FICTICIO.domicilio}</div>
              <div>{MEDICO_FICTICIO.telefono}</div>
              <div>
                Monograma: <span className="font-mono">{MEDICO_FICTICIO.iniciales}</span>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Inventado. Hoy 2.A solo consume el logo y las iniciales; el resto lo
              consumirá 2.B · Membrete.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Guías del PDF
            </h2>
            {/* Los dos hex replican el `GUIA` de HojaTaller.tsx: es la muestra de
                color de la leyenda. Se borran juntos con el taller. */}
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              <li>
                <span className="mr-2 inline-block h-2 w-4 border-y border-dashed border-[#E8C9C9]" />
                Zona segura · {ZONA_SEGURA} pt por lado
              </li>
              <li>
                Caja de texto · {CAJA.ancho} × {CAJA.alto} pt
                <span className="ml-2 inline-block h-2 w-4 border border-[#C6D6E6]" />
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Andamiaje del taller, no tokens del chasis. Sus posiciones sí salen de
              los tokens: son la comprobación de que los componentes se alinean donde
              deben. <strong className="text-slate-400">Solo en la hoja de chasis:</strong>{' '}
              un formato no lleva ninguna línea de encuadre.
            </p>
          </section>
        </aside>

        <main className="min-w-0 flex-1 bg-slate-900">
          {estado.fase === 'generando' && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Generando PDF…
            </div>
          )}
          {estado.fase === 'error' && (
            <div className="flex h-full items-center justify-center p-8">
              <pre className="max-w-lg whitespace-pre-wrap rounded border border-red-900 bg-red-950/40 p-4 text-xs text-red-300">
                {estado.mensaje}
              </pre>
            </div>
          )}
          {estado.fase === 'listo' && (
            <iframe
              src={estado.url}
              title="PDF del taller"
              className="h-full w-full border-0"
            />
          )}
        </main>
      </div>
    </div>
  )
}
