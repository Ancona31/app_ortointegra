'use client'

import { FolderOpen } from 'lucide-react'
import type { Documento } from '@/types'
import { metaDe } from '@/lib/documentos/familias'
import TipTapViewer from '@/components/documentos/TipTapViewer'

/**
 * El CUERPO de un documento, resuelto por familia.
 *
 * ⚠️ CINCO FAMILIAS PARA NUEVE FORMATOS COMPONIBLES, más un caso de cortesía.
 * No hay nueve ramas: hay cinco formas de leer un documento. Si añades un
 * formato, lo primero es decidir a qué familia entra — ver `familias.ts`.
 *
 * ⚠️ DENTRO NO HAY TARJETAS. Ni una. La jerarquía se construye con espacio y
 * tipografía, y como mucho con divisorias de 1 px; cada contenedor extra
 * convierte el documento en formulario, que es justo lo que el visor viene a
 * dejar de ser. El contenedor lo pone `VisorDocumento`.
 *
 * ⚠️ SIN FIRMA. El visor no dibuja espacio ni línea de firma en ningún formato:
 * eso es del impreso, donde alguien puede firmar de puño. Los bloques de firma
 * se presentan como DATOS de los firmantes.
 *
 * ⚠️ UN CAMPO VACÍO NO DEJA HUECO: DESAPARECE CON SU RÓTULO. Y en documentos NO
 * hay frases de relleno —eso es de la nota clínica—: una sección presente y
 * vacía no se pinta.
 */

/* ── Piezas comunes ─────────────────────────────────────────────────────── */

function Seccion({ titulo, numero, children }: {
  titulo: string
  numero?: number
  children: React.ReactNode
}) {
  return (
    <section className="mt-[var(--sp-7)] first:mt-0">
      <h3 className="flex items-baseline gap-[var(--sp-2)] text-[length:var(--sp-fs-label)] font-extrabold uppercase tracking-[var(--sp-ls-caps)] text-[var(--sp-ink-800)]">
        {/* El número es apoyo, no título: mismo tamaño, color terciario. */}
        {numero !== undefined && (
          <span className="tabular-nums font-extrabold text-[var(--sp-ink-350)]">{numero}.</span>
        )}
        {titulo}
      </h3>
      <div className="mt-[var(--sp-2)]">{children}</div>
    </section>
  )
}

function Par({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-[var(--sp-1-5)]">
      <span className="shrink-0 text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {rotulo}
      </span>
      <span className="min-w-0 text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-700)]">{children}</span>
    </span>
  )
}

/** Texto libre de una sección: respeta saltos de línea, nada más. */
function Texto({ children }: { children: string }) {
  return (
    <p className="whitespace-pre-line text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]">
      {children}
    </p>
  )
}

/** Pares en FLUJO, nunca como formulario ni como tabla de dos columnas. */
function Franja({ pares }: { pares: { rotulo: string; valor: string }[] }) {
  const vivos = pares.filter(p => p.valor.trim())
  if (vivos.length === 0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-[var(--sp-4)] gap-y-[var(--sp-1-5)] border-b border-[color:var(--sp-line-divider)] pb-[var(--sp-4)]">
      {vivos.map(p => <Par key={p.rotulo} rotulo={p.rotulo}>{p.valor}</Par>)}
    </div>
  )
}

/* ── Lecturas defensivas de `contenido` ─────────────────────────────────── */
/* `documentos.contenido` es jsonb y su tipo declarado lleva `[key: string]:
   unknown`: nada garantiza la forma de una fila de hace un año. Se lee con
   estos ayudantes en vez de con aserciones, para que un campo con la forma
   equivocada desaparezca en vez de tumbar el visor. */

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const filas = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null) : []
const textos = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(txt).filter(Boolean) : []

function importe(valor: unknown, divisa: string): string {
  const n = num(valor)
  if (n === null) return ''
  const codigo = divisa === 'USD' ? 'USD' : 'MXN'
  try {
    return n.toLocaleString('es-MX', { style: 'currency', currency: codigo })
  } catch {
    return String(n)
  }
}

/* ── Familia A · Solicitudes ────────────────────────────────────────────── */

function FamiliaSolicitudes({ c, esImagen }: { c: Record<string, unknown>; esImagen: boolean }) {
  const estudios = c.estudios
  const notas = txt(c.notas)

  return (
    <>
      <Franja pares={[
        { rotulo: 'Paciente', valor: txt(c.paciente) },
        { rotulo: 'Diagnóstico', valor: txt(c.diagnostico) },
      ]} />

      {esImagen ? (
        /* Cada estudio es un BLOQUE: el tipo como título y tres pares debajo.
           La marca de urgencia no se repite aquí — vive en la cabecera. */
        filas(estudios).length > 0 && (
          <Seccion titulo="Estudios">
            <div className="flex flex-col">
              {filas(estudios).map((e, i) => (
                <div
                  key={i}
                  className={`${i > 0 ? 'mt-[var(--sp-4)] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-4)]' : ''}`}
                >
                  <p className="text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">
                    {txt(e.tipo) || 'Estudio'}
                  </p>
                  <div className="mt-[var(--sp-1-5)] flex flex-wrap items-baseline gap-x-[var(--sp-4)] gap-y-[var(--sp-1)]">
                    {txt(e.region) && <Par rotulo="Región">{txt(e.region)}</Par>}
                    {txt(e.proyecciones) && <Par rotulo="Proyecciones">{txt(e.proyecciones)}</Par>}
                    {txt(e.indicacion) && <Par rotulo="Indicación">{txt(e.indicacion)}</Par>}
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )
      ) : (
        /* Laboratorio: los estudios son CADENAS sueltas, no objetos. Lista
           simple; se numera solo si pasa de diez, que es cuando contar ayuda. */
        textos(estudios).length > 0 && (
          <Seccion titulo="Estudios">
            <ul className="flex flex-col gap-[var(--sp-1-5)]">
              {textos(estudios).map((e, i, arr) => (
                <li key={i} className="flex gap-[var(--sp-2)] text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-snug)] text-[var(--sp-ink-700)]">
                  <span aria-hidden className="shrink-0 tabular-nums text-[var(--sp-ink-300)]">
                    {arr.length > 10 ? `${i + 1}.` : '·'}
                  </span>
                  <span className="min-w-0">{e}</span>
                </li>
              ))}
            </ul>
          </Seccion>
        )
      )}

      {notas && <Seccion titulo="Notas"><Texto>{notas}</Texto></Seccion>}
    </>
  )
}

/* ── Familia B · Listas con posología ───────────────────────────────────── */

function RenglonPosologia({ numero, principal, secundario, detalle }: {
  numero: number
  principal: string
  secundario: string
  detalle: string[]
}) {
  return (
    <li className="mt-[var(--sp-4)] flex gap-[var(--sp-2)] first:mt-0">
      {/* La numeración ayuda a contar quince medicamentos sin competir con el
          nombre: columna estrecha, color terciario, cifras tabulares. */}
      <span aria-hidden className="w-[18px] shrink-0 pt-[2px] text-[length:var(--sp-fs-legal)] font-bold tabular-nums text-[var(--sp-ink-300)]">
        {numero}
      </span>
      <div className="min-w-0">
        <p className="text-[length:var(--sp-fs-btn-sm)] font-bold leading-snug text-[var(--sp-ink-800)]">
          {principal}
          {secundario && <span className="ml-[var(--sp-1-5)] font-normal text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-500)]">{secundario}</span>}
        </p>
        {detalle.length > 0 && (
          <p className="mt-[2px] text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-snug)] text-[var(--sp-ink-600)]">
            {detalle.join(' · ')}
          </p>
        )}
      </div>
    </li>
  )
}

function FamiliaPosologia({ c, esReceta }: { c: Record<string, unknown>; esReceta: boolean }) {
  const items = filas(esReceta ? c.medicamentos : c.seleccionados)
  const peso = num(c.pesoKg)

  return (
    <>
      <Franja pares={[
        { rotulo: 'Paciente', valor: txt(c.paciente) },
        { rotulo: 'Diagnóstico', valor: txt(c.diagnostico) },
        /* Solo suplementación muestra el peso, y es dato de la franja. */
        { rotulo: 'Peso', valor: !esReceta && peso !== null ? `${peso} kg` : '' },
      ]} />

      {items.length > 0 && (
        <Seccion titulo={esReceta ? 'Medicamentos' : 'Suplementos'}>
          <ul>
            {items.map((m, i) => {
              if (esReceta) {
                /* ⚠️ LA INDICACIÓN ES LO ÚNICO IMPRESCINDIBLE DE UN RENGLÓN DE
                   RECETA. Un renglón sin nombre comercial se presenta CON LA
                   INDICACIÓN COMO PRIMERA LÍNEA, no con un hueco donde iría el
                   nombre. */
                const nombre = txt(m.nombre_comercial)
                const indicacion = txt(m.indicacion)
                return (
                  <RenglonPosologia
                    key={i}
                    numero={i + 1}
                    principal={nombre || indicacion || 'Medicamento'}
                    secundario={nombre ? txt(m.presentacion) : ''}
                    detalle={[
                      txt(m.principio_activo),
                      /* «Oral» es el valor por defecto del formato. */
                      `Vía ${txt(m.via_administracion) || 'Oral'}`,
                      nombre ? indicacion : '',
                    ].filter(Boolean)}
                  />
                )
              }
              return (
                <RenglonPosologia
                  key={i}
                  numero={i + 1}
                  principal={txt(m.nombre) || 'Suplemento'}
                  secundario={txt(m.dosis)}
                  detalle={[txt(m.marca), txt(m.justificacion), txt(m.frecuencia), txt(m.duracion), txt(m.notas)].filter(Boolean)}
                />
              )
            })}
          </ul>
        </Seccion>
      )}

      {esReceta
        ? txt(c.recomendaciones) && <Seccion titulo="Recomendaciones generales"><Texto>{txt(c.recomendaciones)}</Texto></Seccion>
        : (
          <>
            {txt(c.notas) && <Seccion titulo="Notas adicionales"><Texto>{txt(c.notas)}</Texto></Seccion>}
            {txt(c.seguimiento) && <Seccion titulo="Cita de control"><Texto>{txt(c.seguimiento)}</Texto></Seccion>}
          </>
        )}
    </>
  )
}

/* ── Familia C · Texto libre ────────────────────────────────────────────── */

function FamiliaTexto({ c }: { c: Record<string, unknown> }) {
  const doc = c.doc as { schema?: string } | undefined
  const esTipTap = doc?.schema === 'tiptap-doc-v1'
  const cuerpoHtml = txt(c.cuerpo)

  return (
    <>
      <Franja pares={[{ rotulo: 'Paciente', valor: txt(c.paciente) }]} />

      {/* El ASUNTO es subtítulo del documento —nivel de título de sección—, no
          un par rótulo/valor: es de lo que trata el escrito. */}
      {txt(c.asunto) && (
        <h3 className="mt-[var(--sp-6)] text-[length:var(--sp-fs-question)] font-bold leading-snug text-[var(--sp-ink-800)]">
          {txt(c.asunto)}
        </h3>
      )}

      {/* ⚠️ EL CUERPO PASA SIEMPRE POR `TipTapViewer`, TAMBIÉN EL HTML LEGACY, Y
          NO ES POR COMODIDAD: ese componente SANITIZA los dos caminos. Este
          contenido sale de `documentos.contenido`, o sea de la base, y pintarlo
          con un `dangerouslySetInnerHTML` propio sería meter HTML sin filtrar en
          el expediente. `doc` manda siempre que exista; `cuerpo` es la copia
          degradada de los escritos anteriores al editor. */}
      {esTipTap || cuerpoHtml ? (
        <TipTapViewer
          doc={esTipTap ? (doc as Parameters<typeof TipTapViewer>[0]['doc']) : undefined}
          cuerpo={esTipTap ? undefined : cuerpoHtml}
          className="tiptap-viewer mt-[var(--sp-4)] text-[length:var(--sp-fs-body)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]"
        />
      ) : (
        <p className="mt-[var(--sp-4)] text-[length:var(--sp-fs-body)] text-[var(--sp-ink-350)]">
          Este documento no tiene contenido.
        </p>
      )}

      {txt(c.tituloPie) && (
        <p className="mt-[var(--sp-5)] text-[length:var(--sp-fs-meta)] italic text-[var(--sp-ink-500)]">
          {txt(c.tituloPie)}
        </p>
      )}
    </>
  )
}

/* ── Familia D · Formularios largos ─────────────────────────────────────── */

/** Un firmante como DATO, nunca como espacio para firmar. */
function Firmante({ calidad, nombre, extra }: { calidad: string; nombre: string; extra?: string[] }) {
  if (!nombre) return null
  return (
    <div className="mt-[var(--sp-3)] first:mt-0">
      <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {calidad}
      </p>
      <p className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-800)]">{nombre}</p>
      {extra?.filter(Boolean).map((e, i) => (
        <p key={i} className="text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-500)]">{e}</p>
      ))}
    </div>
  )
}

function FamiliaFormulario({ tipo, c }: { tipo: string; c: Record<string, unknown> }) {
  if (tipo === 'solicitud_internamiento') {
    const secundarios = textos(c.diagnosticosSecundarios)
    const requerimientos = textos(c.requerimientos)
    const dias = num(c.diasEstimados)
    return (
      <>
        <Franja pares={[
          { rotulo: 'Paciente', valor: txt(c.paciente) },
          { rotulo: 'Fecha de ingreso', valor: txt(c.fechaIngreso) },
          { rotulo: 'Lugar', valor: txt(c.lugar) },
          { rotulo: 'Tipo', valor: txt(c.tipoInternamiento) },
          { rotulo: 'Días estimados', valor: dias !== null ? String(dias) : '' },
          { rotulo: 'ASA', valor: txt(c.asa).replace(/^ASA\s+/i, '') },
        ]} />

        {txt(c.diagnostico) && (
          <Seccion titulo="Diagnósticos">
            <p className="text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">{txt(c.diagnostico)}</p>
            {/* Cero secundarios → no hay lista. */}
            {secundarios.length > 0 && (
              <ul className="mt-[var(--sp-2)] flex flex-col gap-[var(--sp-1-5)]">
                {secundarios.map((d, i) => (
                  <li key={i} className="flex gap-[var(--sp-2)] text-[length:var(--sp-fs-body)] text-[var(--sp-ink-700)]">
                    <span aria-hidden className="shrink-0 text-[var(--sp-ink-300)]">·</span>{d}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        )}

        {txt(c.procedimiento) && <Seccion titulo="Procedimiento o cirugía"><Texto>{txt(c.procedimiento)}</Texto></Seccion>}
        {txt(c.justificacion) && <Seccion titulo="Justificación clínica"><Texto>{txt(c.justificacion)}</Texto></Seccion>}

        {(requerimientos.length > 0 || txt(c.requerimientosExtra)) && (
          <Seccion titulo="Requerimientos especiales">
            {requerimientos.length > 0 && (
              <ul className="flex flex-col gap-[var(--sp-1-5)]">
                {requerimientos.map((r, i) => (
                  <li key={i} className="flex gap-[var(--sp-2)] text-[length:var(--sp-fs-body)] text-[var(--sp-ink-700)]">
                    <span aria-hidden className="shrink-0 text-[var(--sp-ink-300)]">·</span>{r}
                  </li>
                ))}
              </ul>
            )}
            {txt(c.requerimientosExtra) && (
              <div className={requerimientos.length > 0 ? 'mt-[var(--sp-3)]' : ''}>
                <Texto>{txt(c.requerimientosExtra)}</Texto>
              </div>
            )}
          </Seccion>
        )}

        {txt(c.instruccionesPaciente) && <Seccion titulo="Instrucciones para el paciente"><Texto>{txt(c.instruccionesPaciente)}</Texto></Seccion>}
        {/* ⚠️ TEXTO, NO LISTA DE GRUPOS. El §4.4 del spec lo describe como una
            lista de grupos con nombre y renglones; la fila guarda UNA CADENA
            (`indicacionesPiso`, ver el adaptador v2). La app manda. */}
        {txt(c.indicacionesPiso) && <Seccion titulo="Indicaciones de ingreso a piso"><Texto>{txt(c.indicacionesPiso)}</Texto></Seccion>}
      </>
    )
  }

  /* Consentimiento y denegación comparten franja y firmantes; la denegación no
     lleva secciones —no informa, hace constar— y sí un motivo destacado. */
  const esDenegacion = tipo === 'denegacion_consentimiento'
  const secciones = (c.secciones ?? {}) as Record<string, unknown>
  const edad = num(c.edad)

  /* Los rótulos literales del cuerpo del consentimiento, en su orden. Se
     recorren las que TENGAN texto: una sección vacía no se pinta. */
  const CUERPO: readonly { clave: string; rotulo: string }[] = [
    { clave: 'preoperatorio', rotulo: 'Evaluación y decisión terapéutica' },
    { clave: 'descripcion', rotulo: 'Descripción del procedimiento' },
    { clave: 'beneficios', rotulo: 'Beneficios esperados' },
    { clave: 'riesgosComunes', rotulo: 'Riesgos comunes' },
    { clave: 'riesgosEspecificos', rotulo: 'Riesgos específicos' },
    { clave: 'alternativas', rotulo: 'Alternativas de tratamiento' },
    { clave: 'anestesia', rotulo: 'Anestesia' },
  ]
  const conTexto = CUERPO.filter(s => txt(secciones[s.clave]))

  const siNo = (v: unknown): string => (v === true ? 'Autoriza' : v === false ? 'No autoriza' : '')

  return (
    <>
      <Franja pares={[
        { rotulo: 'Paciente', valor: txt(c.paciente) },
        { rotulo: 'Edad', valor: edad !== null ? `${edad} años` : '' },
        { rotulo: 'Lugar', valor: txt(c.lugar) },
        { rotulo: 'Procedimiento', valor: txt(c.procedimiento) },
        { rotulo: 'Diagnóstico', valor: txt(c.diagnostico) },
      ]} />

      {esDenegacion
        ? txt(c.motivo) && <Seccion titulo="Motivo por el que el paciente no firma"><Texto>{txt(c.motivo)}</Texto></Seccion>
        : conTexto.map((s, i) => (
            /* Numeradas: es el único cuerpo del visor que las lleva. */
            <Seccion key={s.clave} titulo={s.rotulo} numero={i + 1}>
              <Texto>{txt(secciones[s.clave])}</Texto>
            </Seccion>
          ))}

      {!esDenegacion && (siNo(c.autorizaTransfusion) || siNo(c.autorizaFotos)) && (
        <Seccion titulo="Autorizaciones adicionales">
          {/* En positivo o negativo EXPLÍCITO, nunca una casilla vacía. */}
          <div className="flex flex-wrap items-baseline gap-x-[var(--sp-4)] gap-y-[var(--sp-1-5)]">
            {siNo(c.autorizaTransfusion) && <Par rotulo="Transfusión">{siNo(c.autorizaTransfusion)}</Par>}
            {siNo(c.autorizaFotos) && <Par rotulo="Fotografías">{siNo(c.autorizaFotos)}</Par>}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Otorgamiento">
        <Firmante calidad="Paciente" nombre={txt(c.paciente)} extra={[
          c.pacienteNoPuedeFirmar === true ? 'El paciente no puede firmar' : '',
        ]} />
        <Firmante calidad="Familiar o responsable" nombre={txt(c.familiar)} />
        {!esDenegacion && <Firmante calidad="Testigo" nombre={txt(c.testigo1)} />}
        {!esDenegacion && <Firmante calidad="Testigo" nombre={txt(c.testigo2)} />}
        {/* ⚠️ LAS FIRMAS NO VIVEN EN LA FILA. `firmas`, `selladoEn`, `huella` e
            `identificaciones` están en `firmas_documento` y en Storage, no en
            `contenido`. Por eso el visor enseña QUIÉN otorga y no si firmó: para
            afirmar lo segundo habría que consultar otra tabla, y este componente
            no consulta nada. */}
        <p className="mt-[var(--sp-3)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
          Las firmas y la huella del documento se registran al sellarlo; para verlas, descarga el PDF.
        </p>
      </Seccion>
    </>
  )
}

/* ── Familia E · Importes ───────────────────────────────────────────────── */

function FamiliaImportes({ c }: { c: Record<string, unknown> }) {
  const esCotizacion = c.tipo_doc === 'cotizacion'
  const divisa = txt(c.divisa) || 'MXN'
  const divisaLarga = divisa === 'USD' ? 'Dólares estadounidenses' : 'Pesos mexicanos'
  const lineas = filas(c.lineas)
  const subtotales = filas(c.subtotales)
  const aseguradora = (typeof c.aseguradora === 'object' && c.aseguradora !== null ? c.aseguradora : null) as Record<string, unknown> | null
  const anticipo = num(c.anticipo)
  const hayAnticipo = (anticipo ?? 0) > 0
  const vigencia = num(c.vigencia_dias)

  return (
    <>
      <Franja pares={[
        { rotulo: 'Paciente', valor: txt(c.paciente) },
        { rotulo: 'Divisa', valor: divisaLarga },
        { rotulo: 'Vigencia', valor: esCotizacion && vigencia !== null ? `${vigencia} días` : '' },
        { rotulo: 'Fecha límite', valor: esCotizacion ? txt(c.vigencia_hasta).slice(0, 10) : '' },
      ]} />

      {lineas.length > 0 && (
        <Seccion titulo="Conceptos">
          {/* La ÚNICA tabla del visor. Sin fondos alternos ni bordes verticales:
              en una tabla así la divisoria de 1 px es la única guía de fila. */}
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="pb-[var(--sp-2)] text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">Concepto</th>
                {esCotizacion && <th className="w-[150px] pb-[var(--sp-2)] text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">Origen</th>}
                <th className="w-[130px] pb-[var(--sp-2)] text-right text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">Precio</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} className="border-t border-[color:var(--sp-line-divider)]">
                  <td className="py-[var(--sp-3)] pr-[var(--sp-3)] text-[length:var(--sp-fs-body-sm)] font-semibold text-[var(--sp-ink-800)]">{txt(l.concepto)}</td>
                  {esCotizacion && <td className="py-[var(--sp-3)] pr-[var(--sp-3)] text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-600)]">{txt(l.origen)}</td>}
                  <td className="py-[var(--sp-3)] text-right text-[length:var(--sp-fs-body-sm)] font-semibold tabular-nums text-[var(--sp-ink-800)]">{importe(l.precio, divisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cierre de importes, alineado a la derecha bajo la tabla. */}
          <div className="mt-[var(--sp-4)] flex flex-col items-end gap-[var(--sp-1-5)]">
            <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
              {esCotizacion ? 'Total estimado' : 'Total'}
              <span className="ml-[var(--sp-2)] text-[length:var(--sp-fs-confirm)] font-extrabold tabular-nums normal-case tracking-normal text-[var(--sp-ink-900)]">
                {importe(c.monto, divisa)}
              </span>
            </p>
            {/* Sin anticipo no hay bloque, y sin bloque el saldo no tiene dónde
                colgarse. Los dos renglones van juntos o no va ninguno. */}
            {hayAnticipo && (
              <>
                <Par rotulo="Anticipo recibido">{importe(c.anticipo, divisa)}</Par>
                <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
                  Saldo pendiente
                  <span className="ml-[var(--sp-2)] text-[length:var(--sp-fs-confirm)] font-extrabold tabular-nums normal-case tracking-normal text-[var(--sp-ink-900)]">
                    {importe(c.saldo, divisa)}
                  </span>
                </p>
              </>
            )}
          </div>
        </Seccion>
      )}

      {txt(c.forma_pago) && (
        <Seccion titulo="Forma de pago">
          <Par rotulo="Método">{txt(c.forma_pago)}</Par>
        </Seccion>
      )}

      {/* Los subtotales por origen SOLO aparecen si hay más de un origen. */}
      {esCotizacion && subtotales.length > 1 && (
        <Seccion titulo="Origen de los conceptos">
          <div className="flex flex-col gap-[var(--sp-1-5)]">
            {subtotales.map((s, i) => (
              <Par key={i} rotulo={txt(s.origen)}>{importe(s.total, divisa)}</Par>
            ))}
          </div>
        </Seccion>
      )}

      {/* Bloque ausente por completo si no hay aseguradora. */}
      {esCotizacion && aseguradora && txt(aseguradora.nombre) && (
        <Seccion titulo="Aseguradora">
          <div className="flex flex-wrap items-baseline gap-x-[var(--sp-4)] gap-y-[var(--sp-1-5)]">
            <Par rotulo="Nombre">{txt(aseguradora.nombre)}</Par>
            {txt(aseguradora.poliza) && <Par rotulo="Póliza">{txt(aseguradora.poliza)}</Par>}
            {txt(aseguradora.cobertura) && <Par rotulo="Cobertura">{txt(aseguradora.cobertura)}</Par>}
          </div>
        </Seccion>
      )}

      {txt(c.notas) && <Seccion titulo="Notas y consideraciones"><Texto>{txt(c.notas)}</Texto></Seccion>}
    </>
  )
}

/* ── El caso que esta pestaña no compone ────────────────────────────────── */

/**
 * ⚠️ ESTA RAMA NO ES UN ERROR NI UN ESTADO VACÍO: ES EL CASO DECLARADO.
 *
 * «Resultado de laboratorio» y «Estudio de imagen» son ARCHIVOS SUBIDOS, y
 * «Informe clínico» es un formato heredado del que queda una fila en
 * producción. Los tres están fuera de esta pestaña por decisión del spec y el
 * carril no los lista — pero se puede llegar a ellos por un enlace directo
 * (`?documento=`), y ese camino no puede terminar en blanco ni en una excepción.
 *
 * Lo que se enseña es lo único honesto que se puede decir de ellos aquí: qué
 * son, el metadato que sí tienen, y DÓNDE viven de verdad. La descarga sigue
 * disponible desde la cabecera, que es lo que el usuario venía a hacer.
 */
function SinVisor({ doc, onIrAArchivos }: { doc: Documento; onIrAArchivos: () => void }) {
  const kb = doc['tamaño_bytes']
  const peso = typeof kb === 'number' && kb > 0
    ? kb > 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} MB` : `${Math.round(kb / 1024)} KB`
    : ''
  const esSubido = doc.tipo === 'resultado_laboratorio' || doc.tipo === 'estudio_imagen'

  return (
    <>
      <Franja pares={[
        { rotulo: 'Archivo', valor: txt(doc.nombre_original) },
        { rotulo: 'Formato', valor: txt(doc.mime_type) },
        { rotulo: 'Peso', valor: peso },
      ]} />

      <div className="mt-[var(--sp-6)] flex flex-col items-start gap-[var(--sp-2-5)] rounded-[var(--sp-r-card-inner)] border border-dashed border-[color:var(--sp-line-dash)] px-[var(--sp-4)] py-[var(--sp-5)]">
        <FolderOpen size={20} className="text-[var(--sp-ink-150)]" />
        <p className="text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-600)]">
          {esSubido
            ? 'Este es un archivo clínico subido, no un documento que la app componga. Se lee y se gestiona en la pestaña «Mediciones y archivos».'
            : 'Este formato ya no se emite y el visor no sabe componerlo. Se conserva íntegro y se puede descargar.'}
        </p>
        {esSubido && (
          <button
            type="button"
            onClick={onIrAArchivos}
            className="text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-primary)] hover:underline"
          >
            Ir a Mediciones y archivos
          </button>
        )}
      </div>
    </>
  )
}

/* ── Cierre ─────────────────────────────────────────────────────────────── */

function Cierre({ doc }: { doc: Documento }) {
  const c = (doc.contenido ?? {}) as Record<string, unknown>
  const meta = metaDe(doc.tipo)
  if (meta.familia === 'sin-visor') return null

  /* ⚠️ LOS DATOS DEL MÉDICO SON LOS CONGELADOS DEL DOCUMENTO, y por eso salen de
     `contenido` y no del perfil vivo: si el médico cambia de especialidad
     mañana, el documento de ayer sigue diciendo la de ayer. */
  const medico = (typeof c.medico === 'object' && c.medico !== null ? c.medico : {}) as Record<string, unknown>
  const cedulas = [
    txt(medico.cedula_profesional) && `Cédula Prof. ${txt(medico.cedula_profesional)}`,
    txt(medico.cedula_especialidad) && `Cédula Esp. ${txt(medico.cedula_especialidad)}`,
  ].filter(Boolean).join(' · ')

  const consultorio = (typeof c.consultorio === 'object' && c.consultorio !== null ? c.consultorio : {}) as Record<string, unknown>

  return (
    <div className="mt-[var(--sp-8)] max-w-[56%] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-3)]">
      <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {meta.rotuloFirma}
      </p>
      {txt(medico.nombre) && (
        <p className="mt-[var(--sp-1)] text-[length:var(--sp-fs-body-sm)] font-bold text-[var(--sp-ink-800)]">{txt(medico.nombre)}</p>
      )}
      {txt(medico.especialidad) && (
        <p className="text-[length:var(--sp-fs-meta)] text-[var(--sp-ink-500)]">{txt(medico.especialidad)}</p>
      )}
      {cedulas && <p className="text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">{cedulas}</p>}

      {/* Los documentos antiguos pueden no traer consultorio → no hay bloque. */}
      {txt(consultorio.nombre) && (
        <p className="mt-[var(--sp-2)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
          {[txt(consultorio.nombre), txt(consultorio.direccion), txt(consultorio.telefono)].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* ⚠️ EL VISOR NO DIBUJA EL QR. Un código en pantalla no se escanea a sí
          mismo: se nombra la verificación y se remite al PDF. */}
      {meta.prefijoFolio && (
        <p className="mt-[var(--sp-2)] text-[length:var(--sp-fs-legal)] uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
          Verificación · en el PDF
        </p>
      )}
    </div>
  )
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function CuerpoDocumento({ doc, onIrAArchivos }: {
  doc: Documento
  onIrAArchivos: () => void
}) {
  const c = (doc.contenido ?? {}) as Record<string, unknown>
  const familia = metaDe(doc.tipo).familia

  /* Un documento componible pero sin contenido: título, la franja que exista y
     una línea de ausencia. El visor NUNCA queda en blanco. */
  const vacio = familia !== 'sin-visor' && Object.keys(c).length === 0

  return (
    <>
      {vacio ? (
        <p className="text-[length:var(--sp-fs-body)] text-[var(--sp-ink-350)]">
          Este documento no conserva contenido que mostrar. Puedes descargar el archivo emitido.
        </p>
      ) : familia === 'solicitudes' ? (
        <FamiliaSolicitudes c={c} esImagen={doc.tipo === 'solicitud_imagen'} />
      ) : familia === 'posologia' ? (
        <FamiliaPosologia c={c} esReceta={doc.tipo === 'receta'} />
      ) : familia === 'texto' ? (
        <FamiliaTexto c={c} />
      ) : familia === 'formulario' ? (
        <FamiliaFormulario tipo={doc.tipo} c={c} />
      ) : familia === 'importes' ? (
        <FamiliaImportes c={c} />
      ) : (
        <SinVisor doc={doc} onIrAArchivos={onIrAArchivos} />
      )}

      <Cierre doc={doc} />
    </>
  )
}
