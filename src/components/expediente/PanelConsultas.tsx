'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Stethoscope } from 'lucide-react'
import type { Paciente, Consulta, MedicoInfo } from '@/types'
import { buildNotaRenderData, type AddendumInput } from '@/lib/notaRenderData'
import { generarPdf } from '@/lib/mobileShare'
import { generateDocFileName } from '@/lib/patientUtils'
import { useProfile } from '@/hooks/useProfile'
import { useAuditAccess } from '@/hooks/useAudit'
import EstadoVacio from '@/components/ui/EstadoVacio'
import EstadoError from '@/components/ui/EstadoError'
import CarrilConsultas from './CarrilConsultas'
import VisorNota from './VisorNota'

/**
 * La pestaña Consultas: carril de navegación + visor de nota. Sin modales.
 *
 * ⚠️ NO CONSULTA LAS CONSULTAS: las recibe por prop, ya acotadas a 50 por el
 * expediente, igual que la línea de tiempo del Resumen. Lo que sí pide, y sólo
 * para la nota que está abierta, son sus notas aclaratorias y el perfil vivo
 * del médico —la firma y los colores no tienen snapshot en `consultas`—.
 *
 * ⚠️ EL ESTADO EXPANDIDO/COLAPSADO DEL CARRIL VIVE EN `sessionStorage`, no en
 * la URL ni en la base: el §4 pide recordarlo «durante la sesión». En la URL
 * ensuciaría los enlaces a una nota concreta, que es lo que sí interesa poder
 * compartir.
 *
 * ⚠️ LA NOTA ABIERTA NO ES ESTADO DE ESTE COMPONENTE: SALE DE LA URL. Llega
 * como `consultaSolicitadaId` —lo que el expediente leyó de `?consulta=`— y se
 * devuelve por `onSeleccionarConsulta`, que es quien la reescribe. Tenerla
 * además en un `useState` daría dos fuentes que sincronizar, y la url ganaría
 * a destiempo al volver de otra pestaña. Derivada, el enlace de «Leer nota»
 * del Resumen, la recarga y el carril acaban todos en el mismo sitio.
 */

const CLAVE_CARRIL = 'spinus:carril-consultas'

type Addendum = {
  id: string
  contenido: string
  medico_nombre: string
  medico_id?: string | null
  created_at: string
}

function VisorCargando() {
  return (
    <div className="k-tarjeta" aria-busy="true">
      <div className="mx-auto w-full max-w-[620px]">
        <div className="skeleton h-[22px] w-2/3 rounded-[8px]" />
        <div className="mt-5 flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-[56px] rounded-[8px]" />)}
        </div>
      </div>
    </div>
  )
}

export default function PanelConsultas({
  paciente, consultas, totalConsultas, cargandoActividad, errorActividad, onReintentarActividad,
  consultaSolicitadaId, onSeleccionarConsulta,
}: {
  paciente: Paciente
  consultas: Consulta[]
  totalConsultas: number | undefined
  cargandoActividad: boolean
  errorActividad: boolean
  onReintentarActividad: () => void
  /** Lo que venga en `?consulta=`. Sin validar: puede no existir. */
  consultaSolicitadaId: string | null
  /** Escribe la nota elegida en la url. */
  onSeleccionarConsulta: (consultaId: string) => void
}) {
  const { profile } = useProfile()

  const [expandido, setExpandido] = useState(false)

  const [addendums, setAddendums] = useState<Addendum[]>([])
  const [medicoVivo, setMedicoVivo] = useState<MedicoInfo | null>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const peticionAddendums = useRef(0)

  /* El carril recuerda su estado durante la sesión. Se lee en un efecto y no en
     el inicializador del `useState`: `sessionStorage` no existe en el servidor y
     leerlo durante el render desemparejaría la hidratación. */
  useEffect(() => {
    try {
      setExpandido(sessionStorage.getItem(CLAVE_CARRIL) === '1')
    } catch { /* almacenamiento bloqueado → arranca colapsado */ }
  }, [])

  const alternarCarril = useCallback(() => {
    setExpandido(prev => {
      try { sessionStorage.setItem(CLAVE_CARRIL, prev ? '0' : '1') } catch { /* da igual */ }
      return !prev
    })
  }, [])

  /* La nota pedida por la url si corresponde a alguna de las cargadas; si no
     —id inventado, nota de otro paciente, o consulta más allá del tope de 50—
     la más reciente, que es la primera: `consultas` llega ordenada
     descendente. Caer en silencio es deliberado: un enlace viejo abre el
     expediente igual, no una pantalla de error. */
  const consulta = useMemo(() => {
    if (consultas.length === 0) return null
    return consultas.find(c => c.id === consultaSolicitadaId) ?? consultas[0]
  }, [consultas, consultaSolicitadaId])

  const seleccionada = consulta?.id ?? null

  /* ⚠️ NOM-024: LEER EL CUERPO DE UNA NOTA ES UN ACCESO Y SE REGISTRA. Este
     panel es un SEGUNDO camino de lectura hacia el mismo dato que
     `/expediente/[id]/consulta/[consultaId]`, que sí lo registra con esta misma
     llamada. Aquella ruta sigue intacta; lo que faltaba era esto, así que
     navegar por el carril leía notas sin dejar rastro.
     Va sobre la nota SELECCIONADA, no sobre la lista: el carril enseña
     encabezados, y lo que se audita es el cuerpo que se despliega al lado.
     `useAuditAccess` guarda la última clave registrada, no un booleano, así que
     cambiar de nota dentro del panel produce una entrada nueva —una por nota,
     igual que la ruta— y a la vez no duplica si se vuelve a la misma.
     `?? undefined` porque el hook ignora el id ausente; sin notas no hay acceso
     que registrar. */
  useAuditAccess('consultas', seleccionada ?? undefined)

  /* Perfil vivo, UNA vez para toda la pestaña: la firma y los colores del PDF
     no tienen snapshot en `consultas` y se resuelven contra el perfil actual.
     Best-effort — sin red, la nota se lee igual con los datos congelados. */
  useEffect(() => {
    let cancelado = false
    fetch('/api/me/perfil-medico')
      .then(r => r.json())
      .then(d => { if (!cancelado && d?.medico) setMedicoVivo(d.medico) })
      .catch(() => { /* la nota se lee sin datos vivos */ })
    return () => { cancelado = true }
  }, [])

  /* Las aclaratorias son de la nota abierta, así que se piden al cambiar de
     nota. El contador de petición evita que una respuesta lenta de la nota
     anterior pinte sus aclaratorias sobre la nueva. */
  useEffect(() => {
    if (!seleccionada) { setAddendums([]); return }
    const mia = ++peticionAddendums.current
    setAddendums([])
    setPdfBlob(null)
    fetch(`/api/consultas/${seleccionada}/addendum`)
      .then(r => r.json())
      .then(d => { if (mia === peticionAddendums.current) setAddendums(d.addendums ?? []) })
      .catch(() => { if (mia === peticionAddendums.current) setAddendums([]) })
  }, [seleccionada])

  const data = useMemo(() => {
    if (!consulta) return null
    return buildNotaRenderData({
      origen: 'consulta',
      consulta,
      paciente,
      addendums: addendums as AddendumInput[],
      medicoVivo,
    })
  }, [consulta, paciente, addendums, medicoVivo])

  const pdfUrl = useMemo(() => (pdfBlob ? URL.createObjectURL(pdfBlob) : null), [pdfBlob])
  useEffect(() => {
    if (!pdfUrl) return
    // 60 s de gracia: si ya se abrió, el visor tiene su copia interna.
    return () => { setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000) }
  }, [pdfUrl])

  async function imprimir() {
    if (!data || !consulta || imprimiendo) return
    setImprimiendo(true)
    try {
      const { blob } = await generarPdf({
        tipo: 'nota_evolucion',
        medico: null,
        // Mismos parámetros que la página completa: el PDF de una nota NO se
        // persiste en Storage (de ahí que no lleve `pacienteId`) y no se abre
        // solo (`entregar: false`) — lo abre el enlace que sustituye al botón.
        data: { ...data },
        logoUrl: data.medico.logoUrl || undefined,
        filename: generateDocFileName(data.paciente.nombreCompleto, 'Nota-Evolucion'),
        entregar: false,
      })
      setPdfBlob(blob)
    } catch {
      /* Sin PDF el botón vuelve a «Imprimir»: se puede reintentar. */
    } finally {
      setImprimiendo(false)
    }
  }

  /* Sólo el firmante puede aclarar su nota — ni un administrador puede aclarar
     la de otro—, y las notas antiguas sin autor identificable no lo admiten
     nunca. Para todos los demás la acción simplemente no existe. */
  const puedeAclarar = !!consulta?.medico_id && !!profile?.id && consulta.medico_id === profile.id

  if (errorActividad) {
    return <EstadoError variante="tarjeta" className="k-tarjeta" mensaje="No se pudieron cargar las consultas." alReintentar={onReintentarActividad} />
  }

  if (cargandoActividad) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="skeleton hidden h-[220px] w-[44px] shrink-0 rounded-[var(--r-tarjeta-ancha)] lg:block" />
        <div className="min-w-0 flex-1"><VisorCargando /></div>
      </div>
    )
  }

  if (consultas.length === 0) {
    /* Acción tonal: el relleno de la pantalla es «Nueva consulta» de la cabecera. */
    return (
      <EstadoVacio
        icono={Stethoscope}
        titulo="La nota de cada consulta aparecerá aquí en cuanto cierres la primera."
        accion={{ etiqueta: 'Iniciar primera consulta', href: `/expediente/${paciente.id}/nueva-nota` }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <CarrilConsultas
        consultas={consultas}
        total={totalConsultas}
        activaId={seleccionada}
        onSelect={onSeleccionarConsulta}
        expandido={expandido}
        onToggleExpandido={alternarCarril}
      />

      <div className="min-w-0 flex-1">
        {data && consulta ? (
          <VisorNota
            data={data}
            imprimiendo={imprimiendo}
            pdfUrl={pdfUrl}
            onImprimir={imprimir}
            hrefNotaCompleta={`/expediente/${paciente.id}/consulta/${consulta.id}`}
            puedeAclarar={puedeAclarar}
          />
        ) : (
          <VisorCargando />
        )}
      </div>
    </div>
  )
}
