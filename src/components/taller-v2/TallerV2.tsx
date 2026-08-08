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
type Vista = 'chasis' | 'laboratorio'

const VISTAS: ReadonlyArray<{ vista: Vista; etiqueta: string }> = [
  { vista: 'chasis', etiqueta: 'Chasis · I.2' },
  { vista: 'laboratorio', etiqueta: '4.1 · Laboratorio' },
]

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
  const [acentoHex, setAcentoHex] = useState<string>(ACENTO_BASE_POR_DEFECTO)
  const [logo, setLogo] = useState<string>(MEDICO_FICTICIO.logo)
  const [nombreLogo, setNombreLogo] = useState<string>('icon-192.png · 1:1')
  const [especialidadLarga, setEspecialidadLarga] = useState<boolean>(false)
  const [estado, setEstado] = useState<Estado>({ fase: 'generando' })

  const acento = resolverAcento(acentoHex)

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
          // Los dos módulos se importan a demanda, como ya hacía el del chasis:
          // arrastran @react-pdf/renderer entero y no tienen por qué entrar en el
          // bundle de la barra lateral.
          const generar =
            vista === 'laboratorio'
              ? (await import('./HojaLaboratorio')).generarPdfLaboratorio
              : (await import('./HojaTaller')).generarPdfTaller
          const blob = await generar(medico, acentoHex)
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
  }, [acentoHex, logo, especialidadLarga, vista])

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
            <div className="mt-3 flex gap-2">
              {VISTAS.map((v) => (
                <button
                  key={v.vista}
                  type="button"
                  onClick={() => setVista(v.vista)}
                  className={`rounded border px-3 py-1.5 text-xs ${
                    vista === v.vista
                      ? 'border-slate-500 bg-slate-800 text-slate-100'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {v.etiqueta}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              El formato va SIN guías: un documento tiene que verse como un
              documento. Trae dos casos —uno completo y uno mínimo—, cada uno en su
              propia hoja.
            </p>
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
