'use client'

import { generateDocFileName, calcularEdad } from '@/lib/patientUtils'
import { useEffect, useRef, useState } from 'react'
import { Plus, AlertTriangle, Pill, ListChecks } from 'lucide-react'
import PieAccionesDocumento from '@/components/documentos/PieAccionesDocumento'
import { flushSync } from 'react-dom'
import QRCode from 'qrcode'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useProfile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { folioImpreso } from '@/lib/documentos/folio'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import type { MedicamentoDB } from '@/data/medicamentos'
import LineaMedicamento from '@/components/documentos/LineaMedicamento'
import MedicamentoReceta from '@/components/documentos/MedicamentoReceta'
import {
  conTexto, estaCompleto, faltasDe, sinPauta, textoAvisoPauta,
  type Falta, type MedicamentoConVia,
} from '@/components/documentos/recetaCompacta'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { escucharSalida } from '@/components/documentos/salidaPlegable'

const FECHA_MIN = '1900-01-01'

/**
 * Un medicamento NUEVO nace SIN vía (receta compacta, decisión del dueño): la
 * vía es obligatoria y se elige; antes nacía con «Oral» puesta y un
 * inyectable podía salir como oral sin que nadie lo decidiera. Las plantillas
 * y la precarga desde la nota NO pasan por aquí: traen la suya.
 */
const MED_VACIO: MedicamentoConVia = {
  nombre_comercial: '', presentacion: '', dosis: '',
  principio_activo: '', indicacion: '', via_administracion: '',
}

/**
 * Lo que acompaña a cada medicamento sin viajar al PDF ni al jsonb: su clave
 * estable de React (no el índice, para no perder el foco al quitar uno) y la
 * «dosis sugerida» del catálogo, que se ofrece como ficha insertable.
 */
type Pista = { clave: number; dosisSugerida: string }
let ultimaClave = 0
function pistaNueva(dosisSugerida = ''): Pista {
  ultimaClave += 1
  return { clave: ultimaClave, dosisSugerida }
}

/** Ids del DOM de cada campo de un medicamento, por su clave estable. */
type CampoMed = 'nombre' | 'principio' | 'via' | 'indicacion'
const CAMPO_DE_FALTA: Record<Falta, CampoMed> = { comercial: 'nombre', generico: 'principio', via: 'via' }
const ROTULO_FALTA: Record<Falta, string> = { comercial: 'Nombre comercial', generico: 'Genérico', via: 'Vía' }

/** El elemento enfocable de un campo; la vía es su botón con tabindex 0. */
function elementoDe(raiz: HTMLElement | null, clave: number, campo: CampoMed): HTMLElement | null {
  const sel = campo === 'via' ? `#receta-via-${clave} [tabindex="0"]` : `#receta-${campo}-${clave}`
  return raiz?.querySelector<HTMLElement>(sel) ?? null
}

/**
 * Lee un medicamento guardado en jsonb, campo a campo y desconfiando de todo:
 * el contenido pudo escribirse con otra versión del formulario.
 *
 * Una fila SIN la clave `via_administracion` llega ahora sin vía (antes se
 * rellenaba con «Oral»): la plantilla muestra lo que se guardó, y una vía que
 * nadie eligió no se inventa. Toda plantilla guardada por este formulario la
 * lleva, así que sólo afecta a filas hechas a mano o de otra versión; la vía
 * es obligatoria y el médico la elige antes de imprimir.
 */
function leerMedicamento(bruto: unknown): MedicamentoConVia | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const m: MedicamentoConVia = {
    nombre_comercial: texto(fila.nombre_comercial),
    presentacion: texto(fila.presentacion),
    dosis: texto(fila.dosis),
    principio_activo: texto(fila.principio_activo),
    indicacion: texto(fila.indicacion),
    via_administracion: texto(fila.via_administracion),
  }
  return conTexto(m) ? m : null
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que Laboratorio: los
 * campos que llegan prellenados de la ficha —paciente y diagnóstico— NO cuentan
 * como escritos hasta que se editan, porque llegaron solos. La fecha tampoco:
 * es dato de paciente y nunca entra en la plantilla.
 *
 * Los medicamentos SÍ cuentan aunque lleguen por `medicamentosIniciales`: no
 * son contexto del paciente sino el contenido del documento, y una receta que
 * llega con tres fármacos de la nota no es un formulario vacío.
 */
function isFormEmpty(
  medicamentos: MedicamentoConVia[], recomendaciones: string,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  return pacienteIntacto && dxIntacto && recomendaciones.trim() === '' && !medicamentos.some(conTexto)
}

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  medicamentosIniciales?: MedicamentoConVia[]
  offlineMode?: boolean
  onOfflineSave?: () => void
  /** Reporta al host si el formulario sigue vacío (guía 04 §6.1 y §6.2). */
  onVacioChange?: (vacio: boolean) => void
  /**
   * El modal de «documento generado» se cerró — o sea, el documento ya salió y
   * el médico terminó con él.
   *
   * ⚠️⚠️ ESTO ES LO ÚNICO QUE IMPIDE EDITAR UN DOCUMENTO YA EMITIDO, y quien
   * venga a quitarlo tiene que saberlo. El host responde deseleccionando el
   * tipo, y eso DESMONTA este formulario. Esa es toda la garantía: entre emitir
   * y desmontar no hay ventana editable —el modal tapa el formulario, atrapa el
   * foco (`ModalShell:153-176`) y bloquea el scroll—, así que cuando el
   * formulario vuelve a existir es uno nuevo y vacío.
   *
   * Aquí hubo una segunda red —una huella del contenido al emitir, comparada
   * con la de cada render, que devolvía el diálogo de descarte si el médico
   * seguía escribiendo— y se retiró: con el desmontaje no llegaba a dispararse
   * nunca. Si algún día el host deja de desmontar, ese caso se reabre y esa red
   * hay que reponerla.
   *
   * Existe para que el HOST pueda replegar su selector y volver a la rejilla de
   * los ocho tipos: el formulario no puede hacerlo solo porque no es dueño del
   * `value` del selector, y a estas alturas seguir enseñando la receta recién
   * emitida no ayuda a nadie.
   *
   * ⚠️ SE DISPARA AL CERRAR EL MODAL Y NO AL EMITIR, y la diferencia importa:
   * este mismo componente RENDERIZA ese modal, así que soltar la señal al
   * emitir haría que el host lo desmontara con el PDF todavía en pantalla.
   *
   * Opcional: el búnker y cualquier montaje sin selector lo omiten y no pasa
   * nada.
   */
  onCerrarTrasEmitir?: () => void
  /**
   * El panel de plantillas sustituye al formulario en su mismo espacio, y
   * mientras está abierto el selector de tipo del host se oculta (spec 02 §3.1):
   * elegir otro tipo desde ahí tiraría el formulario sobre el que el panel
   * opera.
   */
  onPanelPlantillasChange?: (abierto: boolean) => void
}

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, medicamentosIniciales, offlineMode, onOfflineSave, onVacioChange, onCerrarTrasEmitir, onPanelPlantillasChange }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // In offline mode, read doctor profile from localStorage (pre-fetched with Base64 assets)
  const offlineProfile = offlineMode ? (() => {
    try {
      const raw = localStorage.getItem('spinus_doctor_profile')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })() : null

  const medicoInfo = offlineMode && offlineProfile ? {
    ...onlineMedicoInfo,
    nombre: offlineProfile.nombre,
    especialidad: offlineProfile.especialidad,
    cedula_profesional: offlineProfile.cedula_profesional,
    cedula_especialidad: offlineProfile.cedula_especialidad,
    universidad: offlineProfile.universidad,
    direccion_consultorio: offlineProfile.direccion_consultorio,
    telefono_consultorio: offlineProfile.telefono_consultorio,
    color_primario: offlineProfile.color_primario,
    color_secundario: offlineProfile.color_secundario,
    logo_url: offlineProfile.logo_base64,
    firma_url: offlineProfile.firma_base64,
    clinica_nombre: offlineProfile.clinica_nombre,
  } : onlineMedicoInfo

  // Imprimir antes de que resuelva el perfil produce un PDF con el encabezado
  // vacío: sin nombre, sin cédulas, sin domicilio. Solo bloquea mientras carga;
  // si resuelve sin datos el botón se habilita igual.
  const perfilPendiente = cargandoPerfil && !medicoInfo
  const { isSuperAdmin } = useProfile()
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pacienteData, setPacienteData] = useState<{ edad?: number | null; sexo?: string } | null>(null)

  useEffect(() => {
    if (!pacienteId) return

    async function cargarDatosPaciente() {
      // Helper: aplicar datos (edad + sexo) al state desde cualquier fuente
      const aplicar = (fechaNac: string | null, sexo: string | null | undefined) => {
        const edad = fechaNac ? calcularEdad(fechaNac).anios : null
        setPacienteData({ edad, sexo: sexo ?? undefined })
      }

      try {
        const supabase = createClient()
        const res = await supabase
          .from('pacientes')
          .select('fecha_nacimiento, sexo')
          .eq('id', pacienteId)
          .single() as { data: { fecha_nacimiento: string | null; sexo: string | null } | null; error: unknown }

        if (res.data) {
          aplicar(res.data.fecha_nacimiento, res.data.sexo)
        }
      } catch {
        // Sin red — no hacer nada
      }
    }

    cargarDatosPaciente()
  }, [pacienteId])

  const medInicial: MedicamentoConVia[] = medicamentosIniciales && medicamentosIniciales.length > 0
    ? medicamentosIniciales
    : [{ ...MED_VACIO }]

  // `TZ_CLINICA` explícito, no el huso del dispositivo: este inicializador de
  // `useState` corre TAMBIÉN en la pasada de SSR, donde `tzDispositivo()`
  // devolvería UTC de Vercel y el cliente lo corregiría al hidratar — fecha
  // parpadeante en un formulario que emite un documento legal. Y la fecha del
  // documento es de la clínica de todos modos (LA REGLA, en `@/lib/dates`).
  const [fecha, setFecha] = useState(hoyEnTZ(TZ_CLINICA))
  const [medicamentos, setMedicamentos] = useState<MedicamentoConVia[]>(medInicial)
  const [pistas, setPistas] = useState<Pista[]>(() => medInicial.map(() => pistaNueva()))
  // Receta compacta: UN medicamento abierto a la vez (su clave), los demás
  // plegados a una línea. Nace abierto el primero.
  const [abierto, setAbierto] = useState<number | null>(() => pistas[0]?.clave ?? null)
  // Aviso suave de pauta (no bloquea): cuántos medicamentos y cuál abrir.
  const [avisoPauta, setAvisoPauta] = useState<{ n: number; clave: number } | null>(null)
  const [recomendaciones, setRecomendaciones] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [errorAbierto, setErrorAbierto] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  /* Lo que decide «¿está vacío?». La tupla se extiende sobre `isFormEmpty`, así
     que el compilador impide que diverja de su firma.
     ⚠️ SE LLAMA `paraVacio` Y NO `contenido`: `imprimir()` declara su propio
     `contenido` con lo que se manda a imprimir, y dos nombres iguales en dos
     ámbitos anidados es una trampa de lectura. */
  const paraVacio = [medicamentos, recomendaciones, paciente, pacienteInicial, diagnostico, diagnosticoInicial] as const
  const vacio = isFormEmpty(...paraVacio)

  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente. Aquí eso deja fuera paciente,
  // diagnóstico y fecha: los tres son suyos aunque los teclee el médico, y una
  // plantilla con la fecha congelada es un defecto.
  const plantillas = usePlantillasDocumento({
    tipo: 'receta',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, medicamentos: medicamentos.filter(conTexto), recomendaciones }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, campo a campo. Los
      // dos valores de repuesto NO son defensa de sobra: «Vaciar formulario»
      // aplica un contenido sin ninguna clave, así que es justo lo que repone
      // el estado inicial. El paciente y el diagnóstico no se tocan aquí, y por
      // eso sobreviven al vaciado.
      const guardados = Array.isArray(c.medicamentos)
        ? c.medicamentos.map(leerMedicamento).filter((m): m is MedicamentoConVia => m !== null)
        : []
      const filas = guardados.length > 0 ? guardados : [{ ...MED_VACIO }]
      setMedicamentos(filas)
      // Las pistas son del catálogo, no del jsonb: una plantilla aplicada no
      // trae sugerencia de posología.
      const nuevas = filas.map(() => pistaNueva())
      setPistas(nuevas)
      // Aplicada, todo plegado (se ve la receta entera); vaciada, el único
      // medicamento queda abierto para escribir.
      setAbierto(filas.length === 1 && !conTexto(filas[0]) ? nuevas[0].clave : null)
      setRecomendaciones(typeof c.recomendaciones === 'string' ? c.recomendaciones : '')
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  // ── Receta compacta: abrir, plegar, agregar y quitar ───────────────────
  const listaRef = useRef<HTMLDivElement>(null)
  const agregarRef = useRef<HTMLButtonElement>(null)
  const indiceDe = (clave: number): number => pistas.findIndex(p => p.clave === clave)

  /**
   * Enfoca un campo de un medicamento ya pintado y lo acerca al borde de
   * arriba, para que el teclado en pantalla no lo tape. En `tel`/`iv` el
   * encabezado fundido flota SOBRE el scroller: el margen es el relleno de
   * arriba del contenido (`.app-contenido`), que ya lo descuenta.
   */
  function enfocarCampo(clave: number, campo: CampoMed) {
    const contenido = formRef.current?.closest<HTMLElement>('.app-contenido')
    const margen = contenido ? parseFloat(getComputedStyle(contenido).paddingTop) || 24 : 24
    enfocarYAcercar(elementoDe(listaRef.current, clave, campo), Math.max(24, margen))
  }

  /** El abierto, si está totalmente vacío y no es el único: al plegarse se quita. */
  function vacioQueSobra(): number | null {
    if (abierto === null || medicamentos.length < 2) return null
    const i = indiceDe(abierto)
    return i >= 0 && !conTexto(medicamentos[i]) ? abierto : null
  }

  function quitarSinFoco(clave: number) {
    const i = indiceDe(clave)
    if (i < 0) return
    setMedicamentos(prev => prev.filter((_, idx) => idx !== i))
    setPistas(prev => prev.filter((_, idx) => idx !== i))
  }

  /** Abre un medicamento (plegando el que estuviera abierto) y enfoca un campo. */
  function abrirEn(clave: number, campo: CampoMed = 'nombre') {
    const sobra = vacioQueSobra()
    flushSync(() => {
      if (sobra !== null && sobra !== clave) quitarSinFoco(sobra)
      setAbierto(clave)
    })
    enfocarCampo(clave, campo)
  }

  /**
   * Pliega el abierto al tocar o enfocar FUERA de la lista (decisión del dueño).
   * Vacío y no único: se quita. Único y vacío: se queda abierto. Si el foco ya
   * volvió dentro de la lista (lo abrió otra acción), no hace nada.
   */
  function plegar() {
    if (abierto === null || listaRef.current?.contains(document.activeElement)) return
    const sobra = vacioQueSobra()
    if (sobra !== null) quitarSinFoco(sobra)
    else if (medicamentos.length === 1 && !conTexto(medicamentos[0])) return
    setAbierto(null)
  }
  const plegarRef = useRef(plegar)
  useEffect(() => { plegarRef.current = plegar })

  /* «Plegado al salir»: la escucha compartida (`salidaPlegable.ts`, con la
     causa del defecto del texto de una casilla). */
  useEffect(() => escucharSalida(el => !!(listaRef.current?.contains(el) || agregarRef.current?.contains(el)), () => plegarRef.current()), [])

  /** «Agregar medicamento» y Ctrl/⌘+Enter: pliega el actual, crea otro al final y va a su buscador. */
  function agregar() {
    const i = abierto === null ? -1 : indiceDe(abierto)
    if (abierto !== null && i >= 0 && !conTexto(medicamentos[i])) { enfocarCampo(abierto, 'nombre'); return }
    const p = pistaNueva()
    flushSync(() => {
      setMedicamentos(prev => [...prev, { ...MED_VACIO }])
      setPistas(prev => [...prev, p])
      setAbierto(p.clave)
    })
    enfocarCampo(p.clave, 'nombre')
  }

  /** Quitar: el foco va al vecino (el siguiente, o el anterior si era el último), abierto. */
  function quitar(clave: number) {
    const i = indiceDe(clave)
    if (i < 0 || medicamentos.length < 2) return
    const restantes = pistas.filter(p => p.clave !== clave)
    const vecino = restantes[Math.min(i, restantes.length - 1)].clave
    flushSync(() => { quitarSinFoco(clave); setAbierto(vecino) })
    enfocarCampo(vecino, 'nombre')
  }

  function cambiar(clave: number, campo: keyof MedicamentoConVia, val: string) {
    const i = indiceDe(clave)
    setMedicamentos(prev => prev.map((m, idx) => idx === i ? { ...m, [campo]: val } : m))
  }

  /**
   * Elegir del catálogo rellena comercial, presentación, genérico y vía (si la
   * fila la trae; si no, se conserva la que hubiera). El foco va a las
   * indicaciones, o a la vía si quedó vacía.
   */
  function elegirDelCatalogo(clave: number, fila: MedicamentoDB) {
    const i = indiceDe(clave)
    const via = fila.via ?? medicamentos[i]?.via_administracion ?? ''
    flushSync(() => {
      setMedicamentos(prev => prev.map((m, idx) => idx === i ? {
        ...m,
        nombre_comercial: fila.nombre_comercial,
        presentacion: fila.presentacion,
        principio_activo: fila.principio_activo,
        via_administracion: via,
      } : m))
      setPistas(prev => prev.map((p, idx) => idx === i ? { ...p, dosisSugerida: fila.dosis_sugerida } : p))
    })
    enfocarCampo(clave, via ? 'indicacion' : 'via')
  }

  // ── Validación (§3.8; receta compacta) ──────────────────────────
  // Un medicamento con algo escrito y a medias YA NO se descarta en silencio:
  // bloquea la impresión y se dice qué le falta (decisión del dueño). Los
  // obligatorios son los de siempre —comercial y genérico— más la vía. Sin
  // ningún medicamento escrito, se piden los dos de siempre en el primero.
  const hayDatos = medicamentos.some(conTexto)
  const faltasDeCadaUno: Falta[][] = medicamentos.map((m, i) =>
    hayDatos ? faltasDe(m) : (i === 0 ? ['comercial', 'generico'] : []))

  type Faltante = { clave: string; nombre: string; med?: { clave: number; campo: CampoMed } }
  const faltantes: Faltante[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'receta-paciente', nombre: 'Paciente' })
  faltasDeCadaUno.forEach((fs, i) => {
    const k = pistas[i].clave
    const deCual = medicamentos.length > 1 ? ` (medicamento ${i + 1})` : ''
    for (const f of fs) {
      const campo = CAMPO_DE_FALTA[f]
      faltantes.push({ clave: `${campo}-${k}`, nombre: ROTULO_FALTA[f] + deCual, med: { clave: k, campo } })
    }
  })

  function irA(f: Faltante) {
    if (f.med) { abrirEn(f.med.clave, f.med.campo); return }
    enfocarYAcercar(pacienteRef.current)
  }

  function imprimir() {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0])
      return
    }
    // Aviso suave (NO bloquea): indicaciones sin frecuencia o sin duración.
    const sin = medicamentos.flatMap((m, i) => estaCompleto(m) && sinPauta(m.indicacion) ? [pistas[i].clave] : [])
    if (sin.length > 0) { setAvisoPauta({ n: sin.length, clave: sin[0] }); return }
    void emitir()
  }

  /** «Revisar» del aviso: abre el primero sin pauta, en sus indicaciones. */
  function revisarPauta() {
    const clave = avisoPauta?.clave
    setAvisoPauta(null)
    // Tras devolver la capa el foco a su disparador, no antes.
    if (clave !== undefined) setTimeout(() => abrirEn(clave, 'indicacion'), 0)
  }

  /** Emite la receta: fila, PDF y entrega (sin cambios respecto a antes). */
  async function emitir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo — el usuario ve progreso en <50ms
    toast.info('Generando receta...')

    // 2 · Identidad — UUID puro, y SOLO para la idempotencia del índice único
    //     parcial de `documentos`.
    //
    //     ⚠ **AQUÍ VIVÍA EL `R-a3f9…` QUE LA RECETA IMPRIMÍA**, y con él la
    //     mitad del QR roto: se generaba en el navegador, se guardaba en
    //     `contenido.folio` y era lo que el código codificaba — pero `/r/[folio]`
    //     solo resuelve folios de la serie, así que ningún papel verificaba. El
    //     número que va al papel y al QR es ahora el `RX-…` que la base asigna
    //     al insertar; ver `folioImpreso()`.
    //
    //     Que la clave `folio` desaparezca de `contenido` NO es cosmético: es lo
    //     que permite que el botón de regenerar distinga una receta vieja —que
    //     la conserva y tiene que volver a imprimirla— de una nueva, que cae a
    //     la columna. Ver el `??` de `ModalDocumentos.tsx`. Si alguien la
    //     repone, las recetas nuevas empiezan a regenerarse con un número que su
    //     papel no lleva.
    const clientId = crypto.randomUUID()
    // Aquí ya no hay bloques a medias (`imprimir` los bloquea): el filtro sólo
    // deja fuera los totalmente vacíos. Mismo objeto de seis claves de siempre.
    const medsData = medicamentos.filter(estaCompleto)
    const contenido = {
      paciente,
      diagnostico,
      medicamentos: medsData,
      recomendaciones,
      fecha,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      medico_nombre: medicoInfo?.nombre || '',
      medico_especialidad: medicoInfo?.especialidad || '',
      medico_cedula_profesional: medicoInfo?.cedula_profesional || '',
      medico_cedula_especialidad: medicoInfo?.cedula_especialidad || '',
      clinica_nombre: medicoInfo?.clinica_nombre || '',
      color_primario: medicoInfo?.color_primario || '#1a3a5c',
      color_secundario: medicoInfo?.color_secundario || '#1e5fa8',
    }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folioSerie: string | null = null

    try {
      // ── 3 · LA FILA PRIMERO ───────────────────────────────────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—,
      //    como los otros seis, para que la fila exista antes de renderizar.
      //
      //    ⚠ **ESTE ORDEN ES AHORA UNA DEPENDENCIA DURA Y NO UNA MEJORA.** El
      //    folio de serie no existe hasta que la fila entra: lo pone un trigger
      //    BEFORE INSERT. Renderizar antes imprimiría el papel sin número y —lo
      //    que importa— el QR sin nada que codificar. Si alguien vuelve a poner
      //    el PDF por delante, la verificación se apaga en silencio.
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'receta',
          contenido,
          client_id: clientId,
          subido_por: user.id,
          // CON QUÉ CHASIS SALE EL PAPEL. La fila nace emitida, así que la
          // versión se fija aquí y a partir de este INSERT es inmutable
          // (`20260813_formato_version_inmutable.sql`). Tiene que ser el mismo
          // número que recibe `generarPdf` más abajo.
          formato_version: VERSION_DE_EMISION,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { data, error } = await supabase
          .from('documentos')
          .insert(insertPayload)
          .select('id, folio')
          .single()
        if (error) throw error
        filaId = data.id
        folioSerie = data.folio
        // La fila está en el expediente. Aunque el PDF falle después, la receta
        // es recuperable desde la lista con su botón de regenerar — y el QR ya
        // resuelve, porque lo que busca esa página es la fila, no el PDF.
        guardado = true
      }

      // ── 4 · El PDF, ya con el número que la base acaba de asignar ─────
      //
      //    EL QR SE COMPONE SOBRE `folioPapel`, QUE ES EL FOLIO DEVUELTO POR EL
      //    INSERT — nunca sobre uno anterior, porque antes del INSERT no hay
      //    ninguno. Los dos salen del mismo sitio a propósito: el código y el
      //    renglón impreso tienen que ser el mismo número o el papel vuelve a
      //    tener dos.
      //
      //    En el búnker offline no hay fila, así que no hay folio: el papel sale
      //    sin número Y SIN QR, igual que los otros seis salen sin número. Un QR
      //    sin folio que codificar solo puede llevar a «No pudimos verificar
      //    este documento», y un código muerto impreso en un papel es peor que
      //    ningún código.
      const folioPapel = folioImpreso('receta', folioSerie)
      const verificacionUrl = folioPapel !== undefined
        ? `${window.location.origin}/r/${folioPapel}`
        : null
      const [qrDataUrl, blogQrDataUrl] = await Promise.all([
        verificacionUrl !== null
          ? QRCode.toDataURL(verificacionUrl, {
              width: 96,
              margin: 1,
              color: { dark: '#1a3a5c', light: '#ffffff' },
            })
          : Promise.resolve(''),
        isSuperAdmin
          ? QRCode.toDataURL('https://dranconacolumna.com/articulos.html', {
              width: 64,
              margin: 1,
              color: { dark: medicoInfo?.color_primario || '#1a3a5c', light: '#ffffff' },
            })
          : Promise.resolve(''),
      ])

      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const doctorNombre = medicoInfo?.nombre || 'Médico'
      const doctorEspecialidad = medicoInfo?.especialidad || ''
      const cedProf = medicoInfo?.cedula_profesional || ''
      const cedEsp = medicoInfo?.cedula_especialidad || ''
      const direccion = medicoInfo?.direccion_consultorio || ''
      const telefono = medicoInfo?.telefono_consultorio || ''
      const logoUrl =
        medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
          ? medicoInfo.logo_url
          : `${window.location.origin}/logo.png`
      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const cs = medicoInfo?.color_secundario || '#1e5fa8'
      const edadPaciente = pacienteData?.edad
      const sexoPaciente =
        pacienteData?.sexo === 'M' ? 'Masculino' :
        pacienteData?.sexo === 'F' ? 'Femenino' :
        pacienteData?.sexo || ''

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'receta',
        pacienteId,
        medico: {
          nombre: doctorNombre,
          titulo: medicoInfo?.titulo ?? null,
          nombres: medicoInfo?.nombres ?? null,
          apellido_paterno: medicoInfo?.apellido_paterno ?? null,
          apellido_materno: medicoInfo?.apellido_materno ?? null,
          especialidad: doctorEspecialidad,
          cedula_profesional: cedProf,
          cedula_especialidad: cedEsp,
          // También aquí, y no solo dentro de `data`: el membrete de v2 la lee
          // del médico, como las cédulas, y `data.universidad` es la ranura que
          // v1 usa para el mismo dato. Las dos apuntan al mismo perfil.
          universidad: medicoInfo?.universidad ?? null,
          color_primario: cp,
          color_secundario: cs,
          direccion_consultorio: direccion,
          telefono_consultorio: telefono,
          firma_url: medicoInfo?.firma_url ?? null,
        },
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          edad: edadPaciente != null ? `${edadPaciente} años` : undefined,
          sexo: sexoPaciente || undefined,
          folio: folioPapel,
          medicamentos: medsData,
          recomendaciones: recomendaciones || undefined,
          qrDataUrl: qrDataUrl || undefined,
          blogQrDataUrl: blogQrDataUrl || undefined,
          universidad: medicoInfo?.universidad || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Receta'),
        consultorio: consultorioData,
        // El mismo número que acaba de escribirse en la fila. Ver `versionQueEmite`.
        formatoVersion: versionQueEmite(offlineMode),
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfBlob = blob

      // ── 5 · La ruta del archivo, sobre la fila que ya existe ──────────
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'receta',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Receta guardada en bunker offline')
        onOfflineSave?.()
      } else {
        if (storagePath && filaId && supabase) {
          // Este UPDATE no toca ni el estado ni el folio, así que el trigger lo
          // deja pasar. No es fatal si falla: la fila está y el PDF se entrega
          // igual; lo que se pierde es la descarga desde la lista, que el botón
          // de regenerar repone.
          const { error } = await supabase
            .from('documentos')
            .update({ pdf_url: storagePath })
            .eq('id', filaId)
          if (error) console.error('[RecetaForm] update pdf_url:', error.message)
        }
        // El folio del toast es el mismo que el del papel y el del QR: desde
        // este cambio la receta tiene UN número, y es el de la serie.
        toast.success(folioSerie ? `Receta guardada · ${folioSerie}` : 'Receta guardada')
      }
    } catch (err) {
      // Tres desenlaces, y el del medio es nuevo: con la fila escrita antes que
      // el PDF, un fallo de render deja una receta emitida y un folio consumido.
      let msg: string
      if (offlineMode) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar la receta, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `La receta quedó registrada${folioSerie ? ` con folio ${folioSerie}` : ''}, pero no se `
          + 'pudo generar el PDF. Búscala en la lista de documentos del paciente y recupérala desde ahí.'
      }
      setErrorGuardado(msg)
      setErrorAbierto(true)
      // eslint-disable-next-line no-console
      console.error('[RecetaForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) { setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId }) }
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Datos del paciente</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid" data-cols="3">
            <div className="sp-doc-field">
              <label htmlFor="receta-fecha" className="sp-label-field">Fecha</label>
              <input id="receta-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="receta-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="receta-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('receta-paciente') || undefined}
                className={`sp-input ${senalar('receta-paciente') ? 'sp-doc-invalid' : ''}`} />
              {pacienteInicial && <p className="sp-hint">De la ficha · editable</p>}
            </div>
            <div className="sp-doc-field">
              <label htmlFor="receta-diagnostico" className="sp-label-field">Diagnóstico</label>
              <input id="receta-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
                className="sp-input" />
              {diagnosticoInicial && <p className="sp-hint">Del diagnóstico de la consulta</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Receta compacta (decisión del dueño): un medicamento abierto, los
          demás plegados a una línea. «Agregar medicamento» vuelve a ser UNO,
          al final de la lista, con Ctrl/⌘+Enter desde el abierto. */}
      <section className="sp-card sp-doc-card sp-rx">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><Pill /></div>
          <h2 className="sp-label">Medicamentos</h2>
        </div>
        <div className="sp-doc-cardbody sp-rx-cuerpo">
          <div ref={listaRef} className="sp-rx-meds">
            {medicamentos.map((med, i) => {
              const k = pistas[i].clave
              const faltas = intentado ? faltasDeCadaUno[i] : []
              return k === abierto ? (
                <MedicamentoReceta key={k} numero={i + 1} clave={k} med={med}
                  dosisSugerida={pistas[i].dosisSugerida} faltas={faltas}
                  puedeQuitar={medicamentos.length > 1}
                  onCampo={(campo, val) => cambiar(k, campo, val)}
                  onElegir={fila => elegirDelCatalogo(k, fila)}
                  onQuitar={() => quitar(k)} onAgregar={agregar}
                  onEnfocar={campo => enfocarCampo(k, campo)} />
              ) : (
                <LineaMedicamento key={k} numero={i + 1} med={med} faltas={faltas}
                  onAbrir={() => abrirEn(k)} />
              )
            })}
          </div>
        </div>
        <div className="sp-rx-agregar">
          <button ref={agregarRef} type="button" onClick={agregar} className="k-b k-b-tonal sp-rx-agregar-b">
            <Plus aria-hidden="true" /> Agregar medicamento
            <span className="sp-rx-atajo" aria-hidden="true"><kbd>Ctrl</kbd><kbd>Enter</kbd></span>
          </button>
        </div>
      </section>

      {/* El selector de recomendaciones predeterminadas se eliminó entero, con
          sus nueve bloques y sus emoji (R-05): insertaba acumulando y no había
          forma de quitar un bloque. Lo que resolvía —repetir el mismo texto— lo
          cubren las plantillas, que además guardan los medicamentos. */}
      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Recomendaciones</h2>
        </div>
        <div className="sp-doc-cardbody">
          <label htmlFor="receta-recomendaciones" className="sr-only">Recomendaciones</label>
          <textarea id="receta-recomendaciones" value={recomendaciones}
            onChange={e => setRecomendaciones(e.target.value)}
            placeholder="Indicaciones generales, cuidados, datos de alarma…"
            className="sp-textarea" />
        </div>
      </section>

      {/* Un solo mensaje cuando falla el guardado (rediseño B9; CALMA §20): antes
          salía dos veces, en un aviso y en una banda. El texto se queda en
          `errorGuardado` mientras la alerta sale, para que no se vacíe a medias. */}
      <ModalShell
        open={errorAbierto && errorGuardado !== ''}
        onClose={() => setErrorAbierto(false)}
        variante="alerta"
        tono="destruir"
        elevated
        icon={<AlertTriangle aria-hidden="true" />}
        title="No se pudo guardar"
        footer={
          <button type="button" autoFocus data-principal onClick={() => setErrorAbierto(false)} className="k-b k-b-capa k-b-prim">
            Aceptar
          </button>
        }
      >
        <p>{errorGuardado}</p>
      </ModalShell>

      {/* Aviso suave de la pauta (decisión del dueño): NO bloquea. «Revisar»
          abre el primero sin frecuencia o sin duración; «Imprimir así» emite.
          Heurística en `sinPauta` (recetaCompacta.ts). */}
      <ModalShell
        open={avisoPauta !== null}
        onClose={() => setAvisoPauta(null)}
        variante="alerta"
        tono="avisar"
        elevated
        icon={<ListChecks aria-hidden="true" />}
        title="Revisa las indicaciones"
        footer={
          <>
            <button type="button" onClick={() => { setAvisoPauta(null); void emitir() }} className="k-b k-b-capa k-b-quieto">
              Imprimir así
            </button>
            <button type="button" autoFocus data-principal onClick={revisarPauta} className="k-b k-b-capa k-b-prim">
              Revisar
            </button>
          </>
        }
      >
        <p>{textoAvisoPauta(avisoPauta?.n ?? 1)}</p>
      </ModalShell>

      {!cargandoPerfil && !medicoInfo && (
        <p className="sp-banner sp-banner--warn">
          <AlertTriangle size={17} />
          <span style={{ flex: 1 }}>Completa tu perfil para que el documento salga con tu encabezado.</span>
          <Link href="/perfil" className="sp-link-alt">Ir a mi perfil</Link>
        </p>
      )}

      {intentado && faltantes.length > 0 && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>
            {faltantes.length === 1 ? 'Falta 1 campo' : `Faltan ${faltantes.length} campos`}:{' '}
            {faltantes.slice(0, 3).map((f, i) => (
              <span key={f.clave}>
                {i > 0 && ' · '}
                <button type="button" onClick={() => irA(f)}
                  className="sp-link-alt" style={{ color: 'var(--sp-warn-strong)' }}>
                  {f.nombre}
                </button>
              </span>
            ))}
            {faltantes.length > 3 && ` y ${faltantes.length - 3} más`}
          </span>
        </p>
      )}

      {/* «Guardar como plantilla» va aquí y no arriba: se guarda cuando el
          formulario YA está lleno, así que su sitio es junto al de imprimir. */}
      <PieAccionesDocumento
        botonGuardar={plantillas.botonGuardar}
        onImprimir={imprimir}
        imprimiendo={imprimiendo}
        perfilPendiente={perfilPendiente}
      />

      </div>

      {plantillas.panel}
      {plantillas.dialogos}

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        /* Cerrar el modal es el final del documento: se suelta la señal para
           que el host repliegue su selector. `setDocGenerado(null)` primero,
           para que el modal se desmonte por su cuenta y no de rebote al
           desmontarse este formulario entero. */
        onClose={() => { setDocGenerado(null); onCerrarTrasEmitir?.() }}
        blob={docGenerado?.blob ?? null}
        titulo="Receta generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}
