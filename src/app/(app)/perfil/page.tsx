'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { mutate as revalidar } from 'swr'
import { useProfile } from '@/hooks/useProfile'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2, Save, Upload, X, AlertTriangle, Check, UserCircle, Building2, PenLine,
  Settings, Moon, ShieldCheck, ExternalLink, LogOut,
} from 'lucide-react'
import { useCierreSesion } from '@/components/layout/Sidebar'
import Link from 'next/link'
import { useTheme } from '@/components/layout/ThemeProvider'
import { PerfilSkeleton } from '@/components/ui/Skeleton'
import EstadoError from '@/components/ui/EstadoError'
import PestanasPerfil, {
  esPestanaPerfilValida, PESTANA_PERFIL_POR_DEFECTO, type ClavePestanaPerfil,
} from '@/components/perfil/PestanasPerfil'
import TarjetaIdentidad from '@/components/perfil/TarjetaIdentidad'
import PanelConsultorios from '@/components/perfil/PanelConsultorios'
import PanelGoogleCalendar from '@/components/perfil/PanelGoogleCalendar'
import {
  RotuloSeccion, AyudaSeccion, MuestraColor, ResumenConsultorios, EstadoGoogleCalendar, VistaPreviaEncabezado,
} from '@/components/perfil/piezasDatos'
import ModalShell from '@/components/ui/ModalShell'
import Portal from '@/components/ui/Portal'
import { useToast } from '@/components/ui/Toast'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'
import { validarCedula } from '@/lib/validaciones'
import FirmaCaptura from '@/components/perfil/FirmaCaptura'
import { compressLogoImage } from '@/lib/compressImage'
import { CLAVE_ESTADO_PERFIL } from '@/lib/perfil/claves'
import { revisarLogo } from '@/lib/perfil/logoArchivo'
import { syncDoctorProfile } from '@/lib/offline/doctorProfile'
import { canManageClinica, isMedico } from '@/lib/permissions'
import { useConsultorios } from '@/hooks/useConsultorios'
import { Consultorio } from '@/types'
import AddConsultorioModal from '@/components/consultorios/AddConsultorioModal'
import DeleteConsultorioModal from '@/components/consultorios/DeleteConsultorioModal'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { CLAVE_CONFIG } from '@/lib/configApp'

type FormData = {
  titulo: string
  nombres: string
  apellido_paterno: string
  apellido_materno: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  universidad: string
}

type Apariencia = {
  color_primario: string
  color_secundario: string
  logo_url: string | null
}

/**
 * Espejo de `EstadoGoogle` en `src/lib/gcal.ts`. Se repite en vez de
 * importarse porque ese módulo arrastra `googleapis` y esta página es cliente.
 *
 *   'sin_token'    accionable: enseñar "Conectar".
 *   'error_google' NO accionable: hay token y Google falló. Enseñar "Conectar"
 *                  aquí manda al médico a reconectar algo que no está roto.
 */
type EstadoGcal = 'conectado' | 'sin_token' | 'error_google'

const PALETAS = [
  { nombre: 'Spinus (defecto)', primario: '#1a3a5c', secundario: '#1e5fa8' },
  { nombre: 'Verde médico',          primario: '#134e4a', secundario: '#0d9488' },
  { nombre: 'Morado',                primario: '#3b0764', secundario: '#7c3aed' },
  { nombre: 'Rojo burdeos',          primario: '#7f1d1d', secundario: '#dc2626' },
  { nombre: 'Café cálido',           primario: '#451a03', secundario: '#b45309' },
  { nombre: 'Pizarra oscuro',        primario: '#0f172a', secundario: '#475569' },
]

/**
 * Los colores con los que se pinta el perfil mientras no haya otros. Salen de
 * la PRIMERA paleta y no de dos literales repetidos: antes el par '#1a3a5c' /
 * '#1e5fa8' estaba escrito cuatro veces en este archivo, y cambiar la paleta
 * por defecto obligaba a acertar en las cuatro.
 * ⚠️ NO ES EL DEFAULT DE LA BASE NI EL DEL PDF. `clinicas` los declara igual
 * (baseline/02_tables.sql:152) pero `PdfStyles.tsx:93` cae a otro primario
 * (#004A99). Son tres defaults distintos; unificarlos es trabajo aparte.
 */
const COLOR_DEFECTO = { primario: PALETAS[0].primario, secundario: PALETAS[0].secundario }

/**
 * Lo que el formulario tenía cuando se cargó o cuando se guardó por última vez.
 * Es contra esto —y no contra un `useState` de banderas— como la barra de
 * guardado decide si hay cambios: una bandera se olvida de bajar cuando el
 * médico deshace a mano lo que acababa de escribir.
 */
type Instantanea = { form: FormData; especialidades: string[]; nombreClinica: string; apariencia: Apariencia }

/** La huella de lo que VIAJA en el PUT, que es lo único cuyo cambio cuenta. */
function huellaDatos(f: FormData, esp: string[]): string {
  return JSON.stringify([
    f.titulo, f.nombres, f.apellido_paterno, f.apellido_materno,
    f.cedula_profesional, f.cedula_especialidad, f.universidad,
    esp.filter(Boolean).join(' · '),
  ])
}

/**
 * El `<form>` de la pantalla. La barra de guardado se saca del árbol con un
 * portal (ver su comentario), así que su botón de enviar ya no es descendiente
 * del formulario y lo alcanza por `form={ID_FORM}`, que es lo que HTML tiene
 * para exactamente esto.
 */
const ID_FORM = 'perfil-form'

/**
 * Una fila «rótulo — campo» de una tarjeta (rediseño B10, maqueta `perfil`):
 * en teléfono y Duo cerrado el rótulo va ENCIMA del valor; desde 640 px, a la
 * izquierda en una columna de 168. El campo no lleva caja: es la fila entera
 * la que se marca con el contorno de foco (`focus-within`). El error, debajo,
 * en `--mal-tinta`. El `htmlFor` ata el rótulo a su control (antes no lo
 * estaba: el lector de pantalla no lo nombraba).
 */
function Campo({ etiqueta, obligatorio, error, htmlFor, children }: {
  etiqueta: string
  obligatorio?: boolean
  error?: string | null
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="-mx-2 grid min-w-0 grid-cols-1 gap-0.5 rounded-[10px] px-2 pt-2.5 pb-1 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-enlace sm:grid-cols-[168px_minmax(0,1fr)] sm:items-start sm:gap-4 sm:py-1">
      <label htmlFor={htmlFor} className="text-[13px] leading-[18px] text-tinta2 sm:pt-[13px]">
        {etiqueta}
        {obligatorio && <span className="text-mal-tinta"> *</span>}
      </label>
      <div className="min-w-0">
        {children}
        {error && <p className="k-campo-error pb-2">{error}</p>}
      </div>
    </div>
  )
}

/** El control dentro de una fila: sin caja, a 15 px, alto táctil de 44.
 *  ⚠️ `k-campo-sin-caja` (sistema.css) gana a la regla `html.dark input`
 *  (`!important`, ThemeProvider) que en oscuro le ponía la caja `--sup2`. */
const CAMPO_FILA = 'block w-full min-h-11 border-0 bg-transparent p-0 text-[15px] leading-5 text-tinta placeholder:text-tinta3 outline-none focus:outline-none k-campo-sin-caja'

/** Una tarjeta de filas separadas por la línea fina del kit. */
const TARJETA_FILAS = 'k-tarjeta flex flex-col divide-y divide-linea py-1'

/** La ceja y el título. Sale dos veces —pantalla y estado de error—. */
function CabeceraPerfil() {
  return (
    <div className="mb-4">
      <p className="k-t-rotulo">Cuenta</p>
      <h1 className="k-t-pantalla mt-0.5">Mi perfil</h1>
    </div>
  )
}

/**
 * Qué se le dice al médico por cada `?gcal_error=` con el que puede volver aquí.
 *
 * Las claves son los literales que producen `/api/google/connect` (el gate de
 * rol) y `/api/google/callback` (el consentimiento y los cinco errores con
 * nombre del alta). Un literal sin entrada aquí no pinta nada, así que si se
 * añade un redirect nuevo hay que añadirlo también en este mapa.
 */
const AVISOS_GCAL: Record<string, string> = {
  permiso_calendario:
    'No se pudo conectar: en la pantalla de Google quedó sin marcar el permiso para crear y '
    + 'administrar su propio calendario. Spinus guarda tus citas en un calendario aparte que él '
    + 'mismo crea, así que sin ese permiso no puede sincronizar nada. Vuelve a intentarlo y deja '
    + 'la casilla marcada.',
  solo_admin:
    'Sólo quien administra la clínica puede conectar Google Calendar. La conexión es una por '
    + 'clínica y da servicio a todo el equipo, así que no hace falta que la conectes tú: pídeselo '
    + 'a quien administre la clínica y tus citas se sincronizarán igual.',
  clinica_ya_conectada:
    'Esta clínica ya tiene otra cuenta de Google conectada. Sólo puede haber una, así que para '
    + 'usar ésta hay que desconectar primero la anterior desde esta misma página.',
  rol_no_promovido:
    'Esta cuenta de Google ya estaba enlazada a Spinus de otra forma y reconectar no la convierte '
    + 'en la cuenta de la clínica. Desconéctala primero y vuelve a conectarla.',
  cuenta_ya_vinculada:
    'Esa cuenta de Google ya está enlazada a otro usuario de Spinus. Una misma cuenta no puede dar '
    + 'servicio a dos, porque las citas de ambos acabarían mezcladas en el mismo calendario. Tienes '
    + 'dos salidas: conectar aquí una cuenta de Google distinta, o entrar con el usuario que la '
    + 'tiene enlazada, desconectarla desde su perfil y volver a intentarlo.',
  alta_fallida:
    'No se pudo guardar la conexión con Google. No ha quedado nada a medias: vuelve a intentarlo, '
    + 'y si se repite, avísanos.',
}

export default function PerfilPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  // Los caminos de conexión redirigen aquí con ?gcal_error=... Sin una entrada
  // en este mapa el redirect es un callejón sin salida: el médico vuelve al
  // perfil, no ve nada y no sabe qué pasó.
  const searchParams = useSearchParams()
  const gcalError = searchParams.get('gcal_error')
  const gcalAviso = gcalError ? AVISOS_GCAL[gcalError] ?? null : null
  const toast = useToast()
  const { dark, toggle } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    titulo: '', nombres: '', apellido_paterno: '', apellido_materno: '',
    especialidad: '', cedula_profesional: '',
    cedula_especialidad: '', universidad: '',
  })
  const [especialidades, setEspecialidades] = useState<string[]>([''])
  const [apariencia, setApariencia] = useState<Apariencia>({
    color_primario: COLOR_DEFECTO.primario, color_secundario: COLOR_DEFECTO.secundario, logo_url: null,
  })
  /* El nombre LEGAL de la clínica (`clinicas.nombre`), no `nombre_display`:
     las diecisiete clínicas tienen ese último en nulo, así que cada
     `nombre_display ?? nombre` del repositorio resuelve a éste y editarlo se ve
     en toda la app —recetas, hoja frontal, títulos de evento de Google—. */
  const [nombreClinica, setNombreClinica] = useState('')
  /* K3 (punto 12): el huso de la clínica, con el que sale propuesto el de un consultorio nuevo. */
  const [husoClinica, setHusoClinica] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  /* Distinto de `loading`: «no pude» no es «todavía no». Sin este estado, un
     fetch caído dejaba la pantalla en esqueleto para siempre, sin mensaje y
     sin manera de reintentar — el `.then` que apagaba `loading` no tenía
     `.catch` detrás. */
  const [errorCarga, setErrorCarga] = useState(false)
  const [base, setBase] = useState<Instantanea | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)
  // null = todavía verificando.
  const [gcalEstado, setGcalEstado] = useState<EstadoGcal | null>(null)
  const [desconectandoGcal, setDesconectandoGcal] = useState(false)
  // A qué calendario de Google se está sincronizando. null = conectado pero
  // todavía sin calendario, o el médico lo borró desde Google.
  const [gcalNombre, setGcalNombre] = useState<string | null>(null)
  /**
   * A qué CUENTA de Google está atado ese calendario. Lo trae el GET de
   * `/api/google/calendar`, que está entero tras `canManageClinica`, así que
   * este correo no baja a quien no administra.
   *
   * null = identidad desconocida, NUNCA «sin cuenta»: las conexiones anteriores
   * a los scopes `openid`/`email` lo tienen vacío hasta que su dueño reconecte
   * (plan §12.17). Con null la tarjeta dice «tu cuenta de Google», como decía
   * antes de existir este campo; no se inventa ningún «cuenta desconocida».
   *
   * DECISIÓN TOMADA, no un descuido: es la cuenta PERSONAL de quien conectó, y
   * en una clínica con dos administradores el segundo ve el correo del primero.
   * Se acepta a propósito — saber a qué cuenta está atado el calendario de la
   * clínica vale más que ocultarlo, porque es lo que explica dónde aparecen las
   * citas y a quién hay que pedirle que reconecte.
   */
  const [gcalCuenta, setGcalCuenta] = useState<string | null>(null)
  const [recreandoGcal, setRecreandoGcal] = useState(false)
  const [confirmarRecrearGcal, setConfirmarRecrearGcal] = useState(false)

  // F3-5b: Mis consultorios
  const { consultorios, mutate: mutateConsultorios, isLoading: loadingConsultorios } = useConsultorios()
  const [showAdd, setShowAdd] = useState(false)
  /* ⚠️ UN ID, NO UN CONSULTORIO, Y YA NO ABRE NINGÚN MODAL. La edición pasó a
     ser EN LÍNEA (`PanelConsultorios`), así que lo único que hay que recordar
     es qué renglón está abierto. Guardar el objeto entero, como hacía el modal,
     dejaría una copia congelada del consultorio que se desincroniza en cuanto
     la lista se revalida. Vive aquí y no dentro del panel porque el diálogo de
     borrado ofrece «editar en lugar de borrar» y necesita abrirlo. */
  const [editandoConsultorioId, setEditandoConsultorioId] = useState<string | null>(null)
  const [deletingConsultorio, setDeletingConsultorio] = useState<Consultorio | null>(null)

  const isAdmin = canManageClinica(profile)

  /* ── La pestaña activa, que vive en la URL ────────────────────────────────
     Mismo mecanismo que el expediente: se lee de `?tab=`, se reescribe con
     `history.replaceState` —`router.replace` pediría el árbol RSC de la ruta
     entera en cada toque de pestaña, y aquí no hay nada que volver a pedir al
     servidor— y no añade entrada de historial, así que «atrás» sigue saliendo
     del perfil en vez de recorrer las pestañas visitadas.
     ⚠️ SE REESCRIBE LA URL ENTERA, NO SE CONSTRUYE DE CERO: `/perfil` recibe
     también `?gcal_error=` desde los seis redirects de Google, y construirla
     de cero se lo comería. Un `?tab=` que no exista cae a Datos. */
  const tabDeUrl = searchParams.get('tab')

  /* ⚠️ VOLVER DE GOOGLE ABRE SU PESTAÑA, Y NO SE HACE TOCANDO LOS ENDPOINTS.
     Los seis caminos de conexión redirigen a `/perfil?gcal_error=…` sin decir
     nada de pestañas; aterrizar en Datos dejaría el aviso en una pestaña que no
     habla de Google. Se resuelve aquí moviendo la PESTAÑA POR DEFECTO, que es
     lo que se usa cuando la URL no trae `?tab=`.
     ⚠️ Y POR ESO `cambiarPestana` COMPARA CONTRA ESTE DEFECTO Y NO CONTRA LA
     CONSTANTE: borra `?tab=` sólo cuando el destino ya es el defecto vigente.
     Con la constante, pulsar «Datos» tras un error borraría `?tab=` y el
     `gcal_error` volvería a mandar a Google — la pestaña quedaría atrapada. */
  const pestanaPorDefecto: ClavePestanaPerfil = gcalError ? 'google' : PESTANA_PERFIL_POR_DEFECTO

  const pestana: ClavePestanaPerfil = esPestanaPerfilValida(tabDeUrl)
    ? tabDeUrl
    : pestanaPorDefecto

  const cambiarPestana = useCallback((clave: ClavePestanaPerfil) => {
    const url = new URL(window.location.href)
    if (clave === pestanaPorDefecto) url.searchParams.delete('tab')
    else url.searchParams.set('tab', clave)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [pestanaPorDefecto])

  /* ── LAS DOS REGLAS DE BORRADO ─────────────────────────────────────────
     El spec sólo nombra una (el predeterminado). La app tiene dos, con dos
     avisos distintos, y las dos se conservan: no se puede borrar el ÚNICO
     consultorio, ni el PREDETERMINADO mientras haya otros. El servidor las
     repite con 409 (`api/consultorios/[id]/route.ts`); esto es la interfaz
     acompañando a la regla, no la regla.
     Viven aquí, y no en `PanelConsultorios`, porque `handleClickBorrar` también
     las consulta para decidir si abre el diálogo. El panel las recibe. */
  const puedeIniciarBorrado = (c: Consultorio): boolean => {
    if (consultorios.length === 1) return false
    if (c.es_default && consultorios.length > 1) return false
    return true
  }

  const tooltipBorrar = (c: Consultorio): string => {
    if (consultorios.length === 1) {
      return 'No puedes borrar tu único consultorio. Crea otro primero.'
    }
    if (c.es_default && consultorios.length > 1) {
      return 'Marca otro consultorio como predeterminado antes de borrar este.'
    }
    return 'Borrar consultorio'
  }

  const handleClickBorrar = (c: Consultorio) => {
    if (!puedeIniciarBorrado(c)) return
    setDeletingConsultorio(c)
  }

  const handleConsultorioCreado = (creado: Consultorio) => {
    mutateConsultorios(
      (cur) => ({ consultorios: [...(cur?.consultorios ?? []), creado] }),
      { revalidate: false }
    )
  }

  const handleConsultorioActualizado = (actualizado: Consultorio) => {
    mutateConsultorios(
      (cur) => ({
        consultorios: (cur?.consultorios ?? []).map(c =>
          c.id === actualizado.id ? actualizado : c
        )
      }),
      { revalidate: false }
    )
  }

  const handleMarcarDefault = async (consultorio: Consultorio) => {
    if (consultorio.es_default) return
    try {
      const res = await fetch(`/api/consultorios/${consultorio.id}/marcar-default`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'No se pudo marcar como predeterminado.')
        return
      }
      mutateConsultorios(
        (cur) => ({
          consultorios: (cur?.consultorios ?? []).map(c => ({
            ...c,
            es_default: c.id === consultorio.id,
          }))
        }),
        { revalidate: false }
      )
      toast.success('Consultorio predeterminado actualizado.')
    } catch {
      toast.error('Error de red. Verifica tu conexión.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingConsultorio) return
    const res = await fetch(`/api/consultorios/${deletingConsultorio.id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'No se pudo borrar el consultorio.')
      throw new Error('Delete failed')
    }
    mutateConsultorios(
      (cur) => ({
        consultorios: (cur?.consultorios ?? []).filter(c => c.id !== deletingConsultorio.id)
      }),
      { revalidate: false }
    )
    toast.success('Consultorio borrado.')
    setDeletingConsultorio(null)
  }

  /* El diálogo de borrado ofrece corregir en vez de borrar. Antes abría el
     modal de edición; ahora abre el renglón en línea, que es el mismo
     formulario sin cambiar de contexto. */
  const handleEditarEnLugar = () => {
    const target = deletingConsultorio
    if (!target) return
    setDeletingConsultorio(null)
    setEditandoConsultorioId(target.id)
  }

  useEffect(() => {
    if (!loadingProfile && profile && !isMedico(profile)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  // `/api/google/calendar` en vez de `/api/google/events`: responde lo mismo
  // sobre la conexión, trae además el nombre del calendario, y no arrastra
  // el listado de eventos del mes ni la consulta de disponibilidad.
  // No pone `gcalEstado` en null al entrar: al montar ya vale null, y hacerlo
  // aquí sería un setState síncrono dentro del efecto. El botón de reintentar
  // se encarga de volver al spinner por su cuenta.
  const cargarEstadoGcal = useCallback(() => {
    fetch('/api/google/calendar').then(r => r.json())
      .then(d => {
        // Sin `estado` reconocible, tratarlo como fallo y NO como "conecta":
        // equivocarse hacia "conecta" es lo que se está arreglando.
        setGcalEstado(d.estado ?? 'error_google')
        setGcalNombre(d.calendarName ?? null)
        // El 403 del invitado no trae `cuentaEmail`, igual que no trae `estado`:
        // cae en null y la tarjeta no enseña correo ninguno.
        setGcalCuenta(d.cuentaEmail ?? null)
      })
      // La red del navegador tampoco es accionable por el médico.
      .catch(() => setGcalEstado('error_google'))
  }, [])

  /**
   * Los dos datos de la pantalla: el perfil del médico y la marca de su clínica.
   *
   * ⚠️ EL `.catch` NO ES DECORATIVO. Antes esto era un `.then` suelto y
   * `setLoading(false)` vivía DENTRO de él: si cualquiera de los dos `fetch`
   * rechazaba —red caída, 500—, `loading` se quedaba en `true` y la pantalla
   * enseñaba el esqueleto indefinidamente, sin mensaje y sin reintento. Ahora
   * el fallo tiene su propio estado y su propio camino de vuelta.
   */
  const cargarDatos = useCallback(() => {
    setErrorCarga(false)
    setLoading(true)

    Promise.all([
      fetch('/api/me/perfil-medico').then(r => r.json()),
      fetch('/api/me/clinica').then(r => r.json()),
    ]).then(([perfilData, clinicaData]) => {
      /* Se componen aparte para poder guardarlos TAMBIÉN como instantánea: la
         barra de guardado compara contra esto, así que tiene que ser
         exactamente lo mismo que se pinta y no una segunda lectura. */
      let formCargado: FormData = {
        titulo: 'Dr.', nombres: '', apellido_paterno: '', apellido_materno: '',
        especialidad: '', cedula_profesional: '', cedula_especialidad: '', universidad: '',
      }
      let espCargadas: string[] = ['']
      let nombreCargado = ''
      let aparienciaCargada: Apariencia = {
        color_primario: COLOR_DEFECTO.primario,
        color_secundario: COLOR_DEFECTO.secundario,
        logo_url: null,
      }

      if (perfilData.medico) {
        const espRaw = perfilData.medico.especialidad || ''
        const espArray = espRaw ? espRaw.split(' · ').filter(Boolean) : ['']
        espCargadas = espArray.length > 0 ? espArray : ['']
        formCargado = {
          titulo: perfilData.medico.titulo || 'Dr.',
          nombres: perfilData.medico.nombres || '',
          apellido_paterno: perfilData.medico.apellido_paterno || '',
          apellido_materno: perfilData.medico.apellido_materno || '',
          especialidad: espRaw,
          cedula_profesional: perfilData.medico.cedula_profesional || '',
          cedula_especialidad: perfilData.medico.cedula_especialidad || '',
          universidad: perfilData.medico.universidad || '',
        }
        setFirmaUrl(perfilData.medico.firma_url ?? null)
      }
      if (clinicaData.clinica) {
        nombreCargado = clinicaData.clinica.nombre ?? ''
        setHusoClinica(typeof clinicaData.clinica.timezone === 'string' ? clinicaData.clinica.timezone : null)
        aparienciaCargada = {
          color_primario: clinicaData.clinica.color_primario || COLOR_DEFECTO.primario,
          color_secundario: clinicaData.clinica.color_secundario || COLOR_DEFECTO.secundario,
          logo_url: clinicaData.clinica.logo_url || null,
        }
      }

      setForm(formCargado)
      setEspecialidades(espCargadas)
      setNombreClinica(nombreCargado)
      setApariencia(aparienciaCargada)
      setBase({
        form: formCargado,
        especialidades: espCargadas,
        nombreClinica: nombreCargado,
        apariencia: aparienciaCargada,
      })
      setLoading(false)
    }).catch(() => {
      setErrorCarga(true)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    cargarEstadoGcal()
    cargarDatos()
  }, [cargarEstadoGcal, cargarDatos])

  async function onSelectLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressLogoImage(file)
      /* ⚠️ SE JUZGA EL COMPRIMIDO, NO EL ELEGIDO, y es deliberado: `compressed`
         es EL archivo que viaja en el submit, así que es el que el servidor va
         a juzgar —con este mismo `revisarLogo`—. Mirar el original rechazaría
         fotos de 4 MB que la compresión deja en 90 KB y que hoy se aceptan sin
         problema; aquí no se cambia qué se acepta, solo cuándo se entera el
         médico. El nombre sobrevive a la compresión (`compressImage.ts:63`),
         así que la extensión que ve esto es la que verá la ruta. */
      const veredicto = revisarLogo(compressed)
      if (!veredicto.ok) {
        toast.error(veredicto.error)
        // Para que volver a elegir el mismo archivo siga disparando `change`.
        e.target.value = ''
        return
      }
      setLogoFile(compressed)
      setLogoPreview(URL.createObjectURL(compressed))
    } catch {
      toast.error('No se pudo procesar la imagen. Intenta con otro archivo.')
    }
  }

  function quitarLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  /* ── QUÉ GOBIERNA LA BARRA DE GUARDADO, Y QUÉ NO ────────────────────────
     Cubre lo que viaja en el submit: datos profesionales y apariencia
     (colores y logo).

     ⚠️ LA FIRMA NO ESTÁ AQUÍ, Y NO ES UN OLVIDO. `FirmaCaptura` sube y borra
     contra `/api/me/firma` en el acto, con su propio toast, y lo comparte con
     el onboarding — así que no se puede meter bajo esta barra sin cambiarlo
     para los dos sitios. Consecuencia que el texto de la barra TIENE que
     admitir: «Descartar» no revierte la firma. Si algún día la firma pasa a
     guardarse con el resto, quita también esa advertencia.

     ⚠️ EL LOGO SÍ ESTÁ, aunque el encargo lo daba por instantáneo: hoy no lo
     es. Seleccionar un archivo sólo lo deja en memoria (`logoFile`) y la
     subida ocurre dentro del submit, así que pertenece a la barra y
     «Descartar» sí lo revierte — todavía no se ha subido nada. */
  const seccionesSucias = useMemo(() => {
    if (!base) return []
    const sucias: string[] = []
    if (huellaDatos(base.form, base.especialidades) !== huellaDatos(form, especialidades)) {
      sucias.push('Datos profesionales')
    }
    /* El nombre de la clínica y la apariencia sólo los edita quien administra,
       así que para el resto ni se miran: al invitado se le pinta el nombre en
       lectura y no tiene controles de color ni de logo, o sea que no puede
       haberlos cambiado. */
    if (isAdmin && base.nombreClinica !== nombreClinica) {
      sucias.push('Nombre de la clínica')
    }
    if (isAdmin && (
      base.apariencia.color_primario !== apariencia.color_primario
      || base.apariencia.color_secundario !== apariencia.color_secundario
      || logoFile !== null
    )) {
      sucias.push('Apariencia')
    }
    return sucias
  }, [base, form, especialidades, nombreClinica, apariencia, logoFile, isAdmin])

  const hayCambios = seccionesSucias.length > 0
  /* Pulsable de verdad: hay algo que guardar Y no hay un guardado en curso. Es
     lo que decide el aspecto del botón, para que «inhabilitado» y «secundario»
     sean siempre el mismo estado. */
  const puedeGuardar = hayCambios && !guardando && !subiendoLogo

  /* «A, B y C», no «A y B y C». Hasta el bloque 2 las secciones eran dos y el
     `join(' y ')` bastaba; con el nombre de la clínica ya son tres. */
  const listaSecciones = seccionesSucias.length > 1
    ? `${seccionesSucias.slice(0, -1).join(', ')} y ${seccionesSucias[seccionesSucias.length - 1]}`
    : seccionesSucias[0]

  function descartarCambios() {
    if (!base) return
    setForm(base.form)
    setEspecialidades(base.especialidades)
    setNombreClinica(base.nombreClinica)
    setApariencia(base.apariencia)
    quitarLogo()
  }

  /* El vacío se ataja en el cliente para que el error salga bajo el campo y no
     como un toast después del viaje; la regla que MANDA es el `min(1)` de
     `/api/me/clinica`, porque `clinicas.nombre` es NOT NULL y es el nombre al
     que cae toda la app. */
  const nombreClinicaVacio = isAdmin && nombreClinica.trim().length === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errCed = validarCedula(form.cedula_profesional)
    const errCedEsp = validarCedula(form.cedula_especialidad)
    if (errCed || errCedEsp) {
      toast.error(errCed || errCedEsp || 'Revisa los campos')
      return
    }
    if (!form.nombres.trim() || !form.apellido_paterno.trim()) {
      toast.error('El nombre y el apellido paterno son obligatorios')
      return
    }
    if (nombreClinicaVacio) {
      toast.error('El nombre de la clínica no puede quedar vacío')
      return
    }
    setGuardando(true)

    /* ── ESTE GUARDADO SON HASTA TRES ESCRITURAS INDEPENDIENTES, Y SE INFORMA
       DE CADA UNA ─────────────────────────────────────────────────────────
       Perfil, clínica (nombre + colores) y logo van a tres endpoints
       distintos, sin transacción que los una: la de en medio puede fallar con
       las otras dos hechas. No se puede volver atrás —no hay endpoint que
       deshaga— así que lo que sí se puede es NO MENTIR sobre el resultado.

       Antes esto hacía tres cosas mal a la vez: la respuesta del PUT de la
       clínica se tiraba sin mirar (un 403 pasaba en silencio), un fallo del
       logo salía por `return` temprano dejando el perfil YA ESCRITO sin
       decirlo, y el error del perfil se comprobaba al final, después de todo.

       Ahora cada escritura anota si salió, el aviso final dice exactamente qué
       quedó guardado y qué no, y la instantánea se actualiza SÓLO en las
       partes que salieron — así la barra sigue marcando como pendiente
       justamente lo que falló, y reintentar guarda sólo eso. */
    const fallos: string[] = []
    let intentos = 0

    // `direccion_consultorio` y `telefono_consultorio` NO viajan en este payload: F3-5b movió
    // esos datos a `consultorios` y quitó sus inputs de esta pantalla. El PUT itera `key in body`
    // (api/me/perfil-medico/route.ts), así que omitirlos conserva intacto el valor histórico de
    // profiles — del que aún dependen los PDFs como fallback (PdfHeader.tsx, PdfBarras.tsx,
    // pdf/v2/adaptadores/comun.tsx). No los reintroduzcas aquí.
    intentos++
    const rPerfil = await fetch('/api/me/perfil-medico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, especialidad: especialidades.filter(Boolean).join(' · ') }),
    })
    const okPerfil = rPerfil.ok
    if (!okPerfil) fallos.push('tus datos profesionales')

    /* La url que quedará vigente tras este guardado. Hace falta aparte porque
       `setApariencia` es asíncrono y la instantánea de abajo se compone en
       este mismo tick: leer `apariencia.logo_url` daría la anterior. */
    let logoUrlGuardado = apariencia.logo_url
    let okClinica = true
    let okLogo = true

    if (isAdmin) {
      /* Nombre y colores viajan juntos porque son la misma fila y el mismo
         endpoint; si falla, fallan los dos, y así se dice. */
      intentos++
      const rClinica = await fetch('/api/me/clinica', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreClinica.trim(),
          color_primario: apariencia.color_primario,
          color_secundario: apariencia.color_secundario,
        }),
      })
      okClinica = rClinica.ok
      if (!okClinica) fallos.push('el nombre de la clínica y los colores')

      if (logoFile) {
        intentos++
        setSubiendoLogo(true)
        const fd = new FormData()
        fd.append('logo', logoFile)
        const r = await fetch('/api/me/logo', { method: 'POST', body: fd })
        const d = await r.json().catch(() => ({}))
        setSubiendoLogo(false)
        okLogo = r.ok
        if (okLogo) {
          logoUrlGuardado = d.url
          setApariencia(a => ({ ...a, logo_url: d.url }))
          /* Sólo se limpia si SUBIÓ. Si falló, el archivo elegido sigue en
             memoria: la barra lo seguirá contando como cambio pendiente y
             volver a guardar reintenta la subida sin tener que elegirlo otra
             vez. */
          setLogoFile(null)
          setLogoPreview(null)
        } else {
          fallos.push(d.error ? `el logo (${d.error})` : 'el logo')
        }
      }
    }

    setGuardando(false)

    /* La instantánea avanza POR PARTES: lo que se guardó deja de estar sucio y
       lo que falló sigue estándolo. */
    setBase(prev => prev ? {
      form: okPerfil ? form : prev.form,
      especialidades: okPerfil ? especialidades : prev.especialidades,
      nombreClinica: okClinica ? nombreClinica.trim() : prev.nombreClinica,
      apariencia: {
        color_primario: okClinica ? apariencia.color_primario : prev.apariencia.color_primario,
        color_secundario: okClinica ? apariencia.color_secundario : prev.apariencia.color_secundario,
        logo_url: logoUrlGuardado,
      },
    } : prev)

    /* El nombre trimado tiene que verse en el campo: si el médico dejó espacios
       al final, se guardó sin ellos y la barra los contaría como cambio. */
    if (okClinica) setNombreClinica(n => n.trim())

    if (okPerfil) {
      // Sincronizar perfil para el módulo Offline-Mode
      fetch('/api/me/perfil-medico').then(r => r.json()).then(d => {
        if (d.medico) syncDoctorProfile(d.medico).catch(() => {})
      }).catch(() => {})
    }

    if (okClinica || okLogo) {
      /* ⚠️ SIN ESTO, EL RESTO DE LA APP SE QUEDA CON LOS COLORES VIEJOS HASTA
         CINCO MINUTOS. `ThemeProvider` inyecta `--cp`/`--cs` desde `useClinica`,
         que lee el agregado `/api/me/config` con `dedupingInterval` de 300 s
         (lib/configApp.ts) y `focusThrottleInterval` de 300 s en el `SWRConfig`
         de `(app)`. Este PUT escribe en `clinicas` pero no toca esa caché, así
         que el médico cambiaba su paleta y veía el menú lateral del color
         anterior. Invalidar la clave hace que se repinte al instante — y cubre
         también el logo y el nombre, que viajan en el mismo agregado. */
      revalidar(CLAVE_CONFIG)
    }

    /* ⚠️ Y SIN ESTO, EL AVISO DE PERFIL INCOMPLETO DEL SIDEBAR SE QUEDA RANCIO.
       Lo que ese aviso evalúa —firma, cédula de especialidad y logo— se edita
       TODO en esta pantalla, así que guardar aquí tiene que refrescarlo en el
       acto; si no, el médico guarda, ve el aviso de guardado y sigue leyendo
       «Sin cédula de especialidad» hasta la siguiente revalidación.
       ⚠️ `okPerfil` CUENTA AUNQUE SE HAYA TOCADO SOLO LA ESPECIALIDAD: la
       exención de medicina general la decide `especialidad`, así que cambiarla
       cambia lo que el aviso pide aunque la cédula no se toque.
       La firma NO entra aquí — se guarda sola al capturarla, y revalida desde
       su propio `onFirmaCambiada`. */
    if (okPerfil || okLogo) {
      revalidar(CLAVE_ESTADO_PERFIL)
    }

    if (fallos.length === 0) {
      toast.success('Cambios guardados correctamente')
    } else if (fallos.length === intentos) {
      toast.error(`No se pudo guardar ${fallos.join(' ni ')}.`)
    } else {
      /* El caso que antes no se contaba: parte sí y parte no. Decir sólo «error
         al guardar» empujaba al médico a repetirlo todo sin saber qué había
         quedado escrito. */
      toast.error(`Se guardó parte de los cambios. NO se pudo guardar ${fallos.join(' ni ')}; lo demás sí quedó guardado.`)
    }
  }

  async function desconectarGcal() {
    setDesconectandoGcal(true)
    try {
      // MIRAR LA RESPUESTA NO ES OPCIONAL. Esto ponía 'sin_token' pasara lo que
      // pasara: con el DELETE ya gateado, quien no administra recibiría un 403
      // y la interfaz le diría "desconectado" sin estarlo (H5). El botón de
      // abajo ya no se le enseña, pero la mentira seguiría estando a un fetch
      // de distancia.
      const res = await fetch('/api/google/disconnect', { method: 'DELETE' })
      if (!res.ok) {
        toast.error(res.status === 403
          ? 'Sólo quien administra la clínica puede desconectar Google.'
          : 'No se pudo desconectar Google. Inténtalo de nuevo.')
        return
      }
      setGcalEstado('sin_token')
      setGcalNombre(null)
    } catch {
      toast.error('No se pudo desconectar Google. Inténtalo de nuevo.')
    } finally {
      setDesconectandoGcal(false)
    }
  }

  async function recrearCalendarioGcal() {
    setConfirmarRecrearGcal(false)
    setRecreandoGcal(true)
    try {
      const res = await fetch('/api/google/calendar', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.message || 'No se pudo recrear el calendario')
      } else {
        setGcalNombre(d.calendarName ?? null)
        toast.success('Calendario recreado en tu cuenta de Google')
      }
    } catch {
      toast.error('No se pudo recrear el calendario')
    }
    setRecreandoGcal(false)
  }

  /* El engrane «Ajustes» de la barra enlaza a `#perfil-sec-ajustes`. El
     navegador no puede desplazarse a la sección mientras se pinta el esqueleto:
     se hace al terminar de cargar, una vez por ancla. */
  useEffect(() => {
    if (loading || loadingProfile) return
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [loading, loadingProfile])

  if (loading || loadingProfile) return <PerfilSkeleton />

  /* «No pude» tiene pantalla propia, y no es el esqueleto. Reintentar vuelve a
     pedir los dos endpoints; el estado de Google va por su cuenta y tiene su
     propio botón de reintento dentro de su pestaña. */
  if (errorCarga) {
    return (
      <div className="mx-auto max-w-[960px]">
        <CabeceraPerfil />
        <EstadoError
          mensaje="No se pudieron cargar tus datos. Revisa tu conexión e inténtalo de nuevo."
          alReintentar={cargarDatos}
        />
      </div>
    )
  }

  const logoMostrado = logoPreview || apariencia.logo_url

  /* Cómo se llama la combinación activa. `null` cuando los dos colores no
     coinciden con ninguna paleta —el médico los eligió a mano en los dos
     selectores—, y entonces la tarjeta dice «Colores a medida» en vez de
     inventar un nombre. */
  const nombrePaleta = PALETAS.find(
    pa => pa.primario === apariencia.color_primario && pa.secundario === apariencia.color_secundario,
  )?.nombre ?? null

  /* Cómo se llamará el calendario en Google. `gcal.ts` compone el nombre con
     `titulo + nombres + apellido_paterno` y NADA MÁS —selecciona sólo esas tres
     columnas—, así que aquí se repite igual: incluir el apellido materno diría
     al médico un nombre que Google no va a usar. */
  const nombreParaGoogle = componerNombreMedicoCompleto({
    titulo: form.titulo,
    nombres: form.nombres,
    apellido_paterno: form.apellido_paterno,
  }).trim()

  const errorCedula = form.cedula_profesional ? validarCedula(form.cedula_profesional) : null
  const errorCedulaEsp = form.cedula_especialidad ? validarCedula(form.cedula_especialidad) : null

  return (
    /* 960 px: la columna de la maqueta (640 de formulario + 264 de la tarjeta
       de identidad en `esc`, más el hueco), centrada en el área de contenido
       (CALMA §14). */
    /* ⚠️ EL RELLENO INFERIOR LE HACE SITIO A LA BARRA, Y HACE FALTA EN TODOS
       LOS FORMATOS: la barra está fuera del flujo (`fixed`) y flota sobre el
       contenido, así que sin esto taparía la última tarjeta al llegar al final.
       Los números son altos MEDIDOS de la barra más aire: 96 en ancho y 148 en
       teléfono (dos líneas de mensaje y botones de 44), más el área segura.
       Sólo cuando hay cambios: sin ellos la barra está fuera de pantalla y esto
       sería una franja en blanco. */
    <div className={`mx-auto max-w-[960px] ${hayCambios ? 'pb-[96px] max-sm:pb-[calc(148px+env(safe-area-inset-bottom,0px))]' : ''}`}>

      <CabeceraPerfil />

      <PestanasPerfil activa={pestana} onCambiar={cambiarPestana} />

      <form id={ID_FORM} onSubmit={handleSubmit}>

        {/* ⚠️ `items-start` ES LO QUE HACE POSIBLE EL `sticky` DE LA COLUMNA DE
            IDENTIDAD en `esc`: sin él la celda se estira a la altura de la fila
            y no le queda recorrido por el que pegarse.
            ⚠️ LA SEGUNDA COLUMNA SÓLO EXISTE EN DATOS. La tarjeta de identidad
            es el contexto de lo que se edita al lado; en Consultorios y en
            Google Calendar no acompaña a nada. En `esc` va a la DERECHA (264,
            maqueta `perfil`); en el resto, arriba, antes de las secciones. */}
        <div className={`mt-5 grid grid-cols-1 items-start gap-6 ${pestana === 'datos' ? 'esc:grid-cols-[minmax(0,1fr)_264px]' : ''}`}>

          {pestana === 'datos' && (
          <aside className="esc:sticky esc:top-6 esc:order-2">
            <TarjetaIdentidad
              nombre={componerNombreMedicoCompleto(form)}
              especialidad={especialidades.filter(Boolean).join(' · ')}
              cedulaProfesional={form.cedula_profesional}
              cedulaEspecialidad={form.cedula_especialidad}
              logoUrl={logoMostrado}
              firmaUrl={firmaUrl}
              colorPrimario={apariencia.color_primario}
              colorSecundario={apariencia.color_secundario}
              nombrePaleta={nombrePaleta}
            />
          </aside>
          )}

          {/* ── Cuerpo de la pestaña activa ── */}
          <div className="flex min-w-0 flex-col gap-7">

            {pestana === 'datos' && (<>

              {/* ── §3.1 · Datos profesionales ──────────────────────────── */}
              <section aria-labelledby="perfil-sec-datos">
                <RotuloSeccion id="perfil-sec-datos" icono={UserCircle} titulo="Datos profesionales" />
                <div className={TARJETA_FILAS}>
                  <Campo etiqueta="Título" htmlFor="perfil-titulo">
                    <select
                      id="perfil-titulo"
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      className={CAMPO_FILA}
                    >
                      <option value="Dr.">Dr.</option>
                      <option value="Dra.">Dra.</option>
                    </select>
                  </Campo>
                  <Campo etiqueta="Nombre(s)" obligatorio htmlFor="perfil-nombres">
                    <input
                      id="perfil-nombres"
                      type="text"
                      value={form.nombres}
                      onChange={e => setForm({ ...form, nombres: e.target.value })}
                      placeholder="Ej: Juan Carlos"
                      className={CAMPO_FILA}
                    />
                  </Campo>
                  <Campo etiqueta="Apellido paterno" obligatorio htmlFor="perfil-paterno">
                    <input
                      id="perfil-paterno"
                      type="text"
                      value={form.apellido_paterno}
                      onChange={e => setForm({ ...form, apellido_paterno: e.target.value })}
                      placeholder="Ej: García"
                      className={CAMPO_FILA}
                    />
                  </Campo>
                  <Campo etiqueta="Apellido materno" htmlFor="perfil-materno">
                    <input
                      id="perfil-materno"
                      type="text"
                      value={form.apellido_materno}
                      onChange={e => setForm({ ...form, apellido_materno: e.target.value })}
                      placeholder="Opcional"
                      className={CAMPO_FILA}
                    />
                  </Campo>
                  <Campo etiqueta="Cédula profesional" error={errorCedula} htmlFor="perfil-cedula">
                    <input
                      id="perfil-cedula"
                      type="text"
                      inputMode="numeric"
                      value={form.cedula_profesional}
                      onChange={e => setForm({ ...form, cedula_profesional: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      placeholder="Ej: 87654321"
                      aria-invalid={errorCedula ? true : undefined}
                      className={`${CAMPO_FILA} k-num`}
                    />
                  </Campo>
                  <Campo etiqueta="Cédula de especialidad" error={errorCedulaEsp} htmlFor="perfil-cedula-esp">
                    <input
                      id="perfil-cedula-esp"
                      type="text"
                      inputMode="numeric"
                      value={form.cedula_especialidad}
                      onChange={e => setForm({ ...form, cedula_especialidad: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      placeholder="Ej: 3890214"
                      aria-invalid={errorCedulaEsp ? true : undefined}
                      className={`${CAMPO_FILA} k-num`}
                    />
                  </Campo>
                  {/* ⚠️ SIGUEN LOS DOS DESPLEGABLES, NO CHIPS. `EspecialidadSelector`
                      lo comparten el onboarding y el alta de usuarios; se le pasa
                      `selectClassName` (su API) y su «Agregar especialidad» se
                      viste desde aquí con un selector de descendiente, sin tocarlo. */}
                  <Campo etiqueta="Especialidad">
                    <div className="pb-1.5 [&>div>button]:min-h-11 [&>div>button]:gap-1.5 [&>div>button]:text-[14px] [&>div>button]:font-semibold [&>div>button]:text-enlace">
                      <EspecialidadSelector value={especialidades} onChange={setEspecialidades} selectClassName={CAMPO_FILA} />
                    </div>
                  </Campo>
                  <Campo etiqueta="Universidad / Institución" htmlFor="perfil-universidad">
                    <input
                      id="perfil-universidad"
                      type="text"
                      value={form.universidad}
                      onChange={e => setForm({ ...form, universidad: e.target.value })}
                      placeholder="Ej: Universidad Nacional Autónoma de México"
                      className={CAMPO_FILA}
                    />
                  </Campo>
                </div>
                <AyudaSeccion>Aparecen en las recetas, solicitudes y documentos que emites.</AyudaSeccion>
              </section>

              {/* ── §3.2 · Nombre de la clínica ─────────────────────────── */}
              <section aria-labelledby="perfil-sec-clinica">
                <RotuloSeccion id="perfil-sec-clinica" icono={Building2} titulo="Nombre de la clínica" />
                <div className={TARJETA_FILAS}>
                  {isAdmin ? (
                    <Campo
                      etiqueta="Nombre de la clínica"
                      htmlFor="perfil-clinica"
                      error={nombreClinicaVacio ? 'El nombre de la clínica no puede quedar vacío.' : null}
                    >
                      <input
                        id="perfil-clinica"
                        type="text"
                        value={nombreClinica}
                        onChange={e => setNombreClinica(e.target.value)}
                        maxLength={120}
                        placeholder="Ej: Clínica Ortointegra"
                        aria-invalid={nombreClinicaVacio || undefined}
                        className={CAMPO_FILA}
                      />
                    </Campo>
                  ) : (
                    /* Al invitado se le enseña, pero no se le da un campo que su
                       rol no puede guardar: `/api/me/clinica` responde 403 a quien
                       no administra, así que un input editable sería una promesa
                       que el servidor rompe. */
                    <Campo etiqueta="Nombre de la clínica">
                      <p className="flex min-h-11 items-center truncate text-[15px] text-tinta">{nombreClinica || '—'}</p>
                    </Campo>
                  )}
                </div>
                <AyudaSeccion>
                  Es el nombre de la clínica, distinto al de cada consultorio.
                  {!isAdmin && ' Sólo quien administra la clínica puede cambiarlo.'}
                </AyudaSeccion>
              </section>

              {/* ── §3.3 · Firma y logo ─────────────────────────────────────
                  ⚠️ APILADO: `FirmaCaptura` es un flujo entero de captura (subir o
                  dibujar, lienzo, previsualización sobre claro y oscuro) que
                  comparte el onboarding; no entra en media columna. */}
              <section aria-labelledby="perfil-sec-firma">
                <RotuloSeccion id="perfil-sec-firma" icono={PenLine} titulo={isAdmin ? 'Firma y logo' : 'Firma'} />
                <div className="k-tarjeta flex flex-col esc:p-5">
                  <div className="flex flex-col gap-3">
                    <p className="k-t-fila">Firma autógrafa</p>
                    {/* La revalidación va AQUÍ y no dentro de `FirmaCaptura`
                        porque ese componente lo comparte el onboarding, y allí
                        invalidar esta clave a media captura haría que el gate
                        recalculara y desmontara el modal antes de tiempo. */}
                    <FirmaCaptura
                      firmaActual={firmaUrl}
                      onFirmaCambiada={url => { setFirmaUrl(url); revalidar(CLAVE_ESTADO_PERFIL) }}
                    />
                    <p className="text-[13px] leading-[18px] text-tinta2">
                      La firma se guarda en cuanto la capturas: no depende del botón de guardar.
                    </p>
                  </div>

                  {isAdmin && (
                    <SeccionLogo
                      logoMostrado={logoMostrado}
                      hayPendiente={Boolean(logoPreview)}
                      onElegir={() => fileRef.current?.click()}
                      onDescartar={quitarLogo}
                    />
                  )}
                  {isAdmin && (
                    <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={onSelectLogo} className="hidden" />
                  )}

                  {isAdmin && (
                    <SeccionPaleta
                      apariencia={apariencia}
                      onCambiar={(primario, secundario) => setApariencia(a => ({ ...a, color_primario: primario, color_secundario: secundario }))}
                      onCambiarUno={(clave, valor) => setApariencia(a => ({ ...a, [clave]: valor }))}
                      vistaPrevia={
                        <VistaPreviaEncabezado
                          nombre={componerNombreMedicoCompleto(form)}
                          especialidad={especialidades.filter(Boolean).join(' · ')}
                          cedulaProfesional={form.cedula_profesional}
                          cedulaEspecialidad={form.cedula_especialidad}
                          logoUrl={logoMostrado}
                          colorPrimario={apariencia.color_primario}
                          colorSecundario={apariencia.color_secundario}
                        />
                      }
                    />
                  )}
                </div>
                <AyudaSeccion>Se aplican en tus documentos y PDFs.</AyudaSeccion>
              </section>

              {/* ── §3.4 · Mis consultorios (resumen) ───────────────────── */}
              <ResumenConsultorios consultorios={consultorios} cargando={loadingConsultorios} />

              {/* ── §3.5 · Estado de Google Calendar ────────────────────── */}
              <EstadoGoogleCalendar esAdmin={isAdmin} estado={gcalEstado} />

            </>)}

            {pestana === 'consultorios' && (
              <PanelConsultorios
                consultorios={consultorios}
                cargando={loadingConsultorios}
                editandoId={editandoConsultorioId}
                onEditar={setEditandoConsultorioId}
                onAgregar={() => setShowAdd(true)}
                onActualizado={handleConsultorioActualizado}
                onMarcarDefault={handleMarcarDefault}
                onBorrar={handleClickBorrar}
                puedeBorrar={puedeIniciarBorrado}
                motivoNoBorrar={tooltipBorrar}
              />
            )}

            {pestana === 'google' && (
              <PanelGoogleCalendar
                esAdmin={isAdmin}
                estado={gcalEstado}
                nombreCalendario={gcalNombre}
                cuentaEmail={gcalCuenta}
                aviso={gcalAviso}
                nombreParaGoogle={nombreParaGoogle}
                recreando={recreandoGcal}
                desconectando={desconectandoGcal}
                onReintentar={() => { setGcalEstado(null); cargarEstadoGcal() }}
                onRecrear={() => setConfirmarRecrearGcal(true)}
                onDesconectar={desconectarGcal}
              />
            )}

            <GrupoAjustes dark={dark} alternarTema={toggle} />

          </div>
        </div>

      </form>

      {/* ── Región 6 · Barra de guardado ────────────────────────────────
          ⚠️ VA EN UN PORTAL, Y NO ES POR GUSTO: un ancestro con `transform`,
          `will-change` o una animación con relleno se convierte en BLOQUE
          CONTENEDOR de todo `position: fixed` que cuelgue debajo, y la barra se
          iría con el scroll. Fuera del árbol se fija a la ventana pase lo que
          pase arriba.
          ⚠️ POR ESO EL BOTÓN LLEVA `form={ID_FORM}`: al portarse a `body` deja
          de ser descendiente del `<form>` y sin ese atributo el envío no
          dispara nada.

          ⚠️ LA ANIMACIÓN ES SÓLO `transform`. Entra deslizándose y sale igual:
          la barra vive siempre montada y se aparta con `translate-y-full`.
          `motion-reduce` la apaga.

          ⚠️ LOS BORDES SON `--cromo-izq` / `--cromo-der` (`globals.css`, los
          márgenes de <main>), NO UN `lg:left-64`: hay riel en `ext` y barra a
          la derecha en `ih`, y con `inset-x-0` el «Guardar» quedaba debajo de
          ellos y de la franja, sin poder tocarse. En `ext`/`ih` NADA fijo toca
          el borde del lado de la franja salvo el cromo navy (regla del Duo
          real). Abajo suma la franja del sistema (`--ib`). */}
      <Portal>
        <div
          aria-hidden={!hayCambios}
          className={`fixed bottom-0 left-[var(--cromo-izq)] right-[var(--cromo-der)] z-30 transition-transform duration-[var(--dur-entra)] ease-[var(--resorte-entra)] motion-reduce:transition-none ${hayCambios ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
        >
          <div className="mx-auto w-full max-w-[1024px] px-4 pb-[calc(16px+var(--ib))] max-sm:px-0 max-sm:pb-0 lg:px-8">
            <div className="flex items-center gap-4 rounded-[var(--r-tarjeta)] bg-sup px-5 py-3 shadow-[var(--sombra-capa)] max-sm:flex-col max-sm:items-stretch max-sm:gap-3 max-sm:rounded-none max-sm:px-4 max-sm:pb-[calc(12px+env(safe-area-inset-bottom,0px))]">

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-5 text-tinta">
                  {hayCambios
                    ? `Tienes cambios sin guardar en ${listaSecciones}.`
                    : 'Sin cambios pendientes.'}
                </p>
                {/* La advertencia sólo aparece cuando «Descartar» está vivo, que es
                    cuando puede engañar. La firma se guarda al capturarla, así que
                    descartar no la deshace. */}
                {hayCambios && (
                  <p className="mt-0.5 text-[13px] leading-[18px] text-tinta2">
                    La firma se guarda sola al capturarla: «Descartar» no la revierte.
                  </p>
                )}
              </div>

              {/* Secundario a la izquierda y principal a la DERECHA (CALMA §23.1);
                  en teléfono, los dos a medias del ancho. */}
              <div className="flex shrink-0 items-center gap-2 max-sm:grid max-sm:grid-cols-2">
                <button
                  type="button"
                  onClick={descartarCambios}
                  disabled={!puedeGuardar}
                  className="k-b k-b-quieto min-w-[104px]"
                >
                  Descartar
                </button>
                {/* ⚠️ PRIMARIO CUANDO SE PUEDE PULSAR, QUIETO CUANDO NO — y la
                    condición es `puedeGuardar`, NO `hayCambios`: mientras guarda
                    está `disabled`, y un primario apagado (blanco sobre azul
                    gris) no llega al 4.5:1. */}
                <button
                  type="submit"
                  form={ID_FORM}
                  disabled={!puedeGuardar}
                  className={`k-b ${puedeGuardar ? 'k-b-prim' : 'k-b-quieto'} min-w-[104px]`}
                >
                  {guardando || subiendoLogo
                    ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> {subiendoLogo ? 'Subiendo logo...' : 'Guardando...'}</>
                    : <><Save size={16} aria-hidden="true" /> Guardar</>}
                </button>
              </div>

            </div>
          </div>
        </div>
      </Portal>

      {/* Modales F3-5b */}
      <AddConsultorioModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={handleConsultorioCreado}
        husoDeFabrica={husoClinica}
      />

      {deletingConsultorio && (
        <DeleteConsultorioModal
          open={true}
          onClose={() => setDeletingConsultorio(null)}
          consultorio={deletingConsultorio}
          onEditarEnLugar={handleEditarEnLugar}
          onConfirmDelete={handleConfirmDelete}
        />
      )}

      {/* La advertencia dice "se borran los eventos" y no "se borra el espejo"
          a propósito: hoy los eventos del calendario de Spinus son sólo reflejo
          de las citas, pero eso deja de ser cierto en cuanto se pueda agendar
          desde Google, y para entonces el aviso ya tiene que estar puesto.
          Rediseño B10: alerta destructiva del catálogo (CALMA §13), con los
          rótulos de hoy («Cancelar», «Sí, recrear») lado a lado. */}
      <ModalShell
        open={confirmarRecrearGcal}
        onClose={() => setConfirmarRecrearGcal(false)}
        title="Recrear calendario"
        subtitle="Google Calendar"
        icon={<AlertTriangle aria-hidden="true" />}
        variante="alerta"
        tono="destruir"
        footer={
          <>
            <button type="button" autoFocus onClick={() => setConfirmarRecrearGcal(false)} className="k-b k-b-capa k-b-quieto">
              Cancelar
            </button>
            <button type="button" data-principal onClick={recrearCalendarioGcal} className="k-b k-b-capa k-b-mal">
              Sí, recrear
            </button>
          </>
        }
      >
        <p>Se creará un calendario de Spinus nuevo en tu cuenta de Google.</p>
        <p className="font-semibold text-mal-tinta">
          SE BORRA EL CALENDARIO ACTUAL Y TODOS LOS EVENTOS QUE CONTENGA.
          Tus citas de Spinus NO se borran, pero las que ya existían dejarán de
          aparecer en Google: sólo se sincronizarán de aquí en adelante.
        </p>
        <p>¿Continuar?</p>
      </ModalShell>
    </div>
  )
}

/* ── Piezas de la pestaña Datos (sólo presentación; el estado vive arriba) ── */

/** Logo de la clínica, dentro de la tarjeta de firma (sólo quien administra). */
function SeccionLogo({ logoMostrado, hayPendiente, onElegir, onDescartar }: {
  logoMostrado: string | null
  hayPendiente: boolean
  onElegir: () => void
  onDescartar: () => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-linea pt-4">
      <p className="k-t-fila">Logo del consultorio</p>
      <div className="flex items-center gap-4">
        <div
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-tinta3"
          style={logoMostrado ? { borderStyle: 'solid', borderColor: 'var(--linea)' } : undefined}
        >
          {logoMostrado
            ? <img src={logoMostrado} alt="Logo del consultorio" className="max-h-[56px] max-w-[56px] object-contain" />
            : <Upload size={18} aria-hidden="true" className="text-tinta2" />}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠️ `data-onboard` ES UN ANCLA DE `OnboardingGuide`, que lo busca
                con `querySelector`. Vive en la pestaña Datos (la de entrada). No
                lo muevas a otra pestaña. */}
            <button type="button" onClick={onElegir} data-onboard="subir-logo" className="k-b k-b-tonal">
              {logoMostrado ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {/* ⚠️ SÓLO CON UN ARCHIVO ELEGIDO SIN GUARDAR: no existe endpoint que
                borre el logo guardado, así que «quitar» sobre él mentiría. */}
            {hayPendiente && (
              <button type="button" onClick={onDescartar} className="k-b k-b-texto">
                <X size={16} aria-hidden="true" /> Descartar selección
              </button>
            )}
          </div>
          <p className="text-[13px] leading-[18px] text-tinta2">PNG, JPG, SVG · se optimiza a máx. 150 KB</p>
        </div>
      </div>
    </div>
  )
}

type ClaveColor = 'color_primario' | 'color_secundario'

/** Paleta, los dos colores libres y la vista previa del encabezado del PDF. */
function SeccionPaleta({ apariencia, onCambiar, onCambiarUno, vistaPrevia }: {
  apariencia: Apariencia
  onCambiar: (primario: string, secundario: string) => void
  onCambiarUno: (clave: ClaveColor, valor: string) => void
  vistaPrevia: React.ReactNode
}) {
  const colores: { etiqueta: string; clave: ClaveColor }[] = [
    { etiqueta: 'Color primario', clave: 'color_primario' },
    { etiqueta: 'Color secundario', clave: 'color_secundario' },
  ]
  return (
    <div className="mt-4 flex flex-col border-t border-linea pt-4">
      <p className="k-t-fila mb-3">Paleta de colores</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PALETAS.map(pa => (
          <BotonPaleta
            key={pa.nombre}
            paleta={pa}
            activa={pa.primario === apariencia.color_primario && pa.secundario === apariencia.color_secundario}
            onElegir={() => onCambiar(pa.primario, pa.secundario)}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col divide-y divide-linea">
        {colores.map(({ etiqueta, clave }) => (
          <Campo key={clave} etiqueta={etiqueta} htmlFor={`perfil-${clave}`}>
            <div className="flex min-h-11 items-center gap-2.5">
              <input
                id={`perfil-${clave}`}
                type="color"
                value={apariencia[clave]}
                onChange={e => onCambiarUno(clave, e.target.value)}
                className="h-6 w-6 shrink-0 cursor-pointer rounded-[7px] border-0 bg-transparent p-0"
              />
              <span className="font-mono text-[14px] text-tinta2">{apariencia[clave]}</span>
            </div>
          </Campo>
        ))}
        <Campo etiqueta="Vista previa del encabezado en PDFs">
          <div className="pt-1 pb-2 sm:pt-2.5">{vistaPrevia}</div>
        </Campo>
      </div>
    </div>
  )
}

/** Una de las seis paletas: los dos colores encimados y su nombre. */
function BotonPaleta({ paleta, activa, onElegir }: {
  paleta: { nombre: string; primario: string; secundario: string }
  activa: boolean
  onElegir: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onElegir}
      className={`k-pulsable relative flex min-h-[52px] items-center gap-2.5 rounded-[12px] py-2 pr-6 pl-3 text-left ${activa ? 'bg-sup outline-2 -outline-offset-2 outline-accion' : 'bg-sup2'}`}
    >
      <span className="flex shrink-0 items-center">
        <MuestraColor color={paleta.primario} />
        <MuestraColor color={paleta.secundario} encima />
      </span>
      <span className="min-w-0 text-[14px] font-semibold leading-[18px] text-tinta">{paleta.nombre}</span>
      {activa && <Check size={14} aria-hidden="true" className="absolute top-1.5 right-1.5 text-accion" />}
    </button>
  )
}

/**
 * Grupo «Ajustes» de Mi perfil (CALMA §23.11, aprobado; maqueta `perfil`):
 * las mismas filas que el menú de ajustes del pie de la barra, con las mismas
 * funciones de siempre (`useTheme` y el enlace al aviso).
 *
 * «Cerrar sesión» usa el MISMO manejador que la barra (`useCierreSesion`,
 * exportado de `layout/Sidebar.tsx`): audita con `await`, limpia cachés y vacía
 * la de configuración al desmontarse. No copies esa lógica aquí. Sin
 * confirmación (CALMA §29.14); gira y no admite un segundo toque mientras audita.
 *
 * ⚠️ El enlace al aviso lleva `prefetch={false}` y `rel="noopener noreferrer"`
 * por lo mismo que su gemelo de la barra: pestaña nueva, sin `window.opener`.
 */
function GrupoAjustes({ dark, alternarTema }: { dark: boolean; alternarTema: () => void }) {
  const { handleLogout, cerrando } = useCierreSesion()
  return (
    <section aria-labelledby="perfil-sec-ajustes">
      <RotuloSeccion id="perfil-sec-ajustes" icono={Settings} titulo="Ajustes" />
      <div className="k-tarjeta k-lista py-1">
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          onClick={alternarTema}
          className="flex min-h-12 w-full items-center gap-3 text-left text-[15px] text-tinta"
        >
          <Moon size={20} aria-hidden="true" className="shrink-0 text-enlace" />
          <span className="flex-1">Modo oscuro</span>
          <span aria-hidden="true" className={`relative h-[30px] w-[50px] shrink-0 rounded-full ${dark ? 'bg-accion' : 'bg-tinta3'}`}>
            <span className={`absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-[#fff] shadow-sm transition-transform duration-200 motion-reduce:transition-none ${dark ? 'translate-x-5' : ''}`} />
          </span>
        </button>
        <Link
          href="/privacidad"
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="flex min-h-12 items-center gap-3 text-[15px] text-tinta"
        >
          <ShieldCheck size={20} aria-hidden="true" className="shrink-0 text-enlace" />
          <span className="flex-1">Aviso de Privacidad</span>
          <ExternalLink size={16} aria-hidden="true" className="shrink-0 text-tinta2" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={cerrando}
          aria-busy={cerrando}
          className="flex min-h-12 w-full items-center gap-3 text-left text-[15px] text-mal-tinta disabled:opacity-60"
        >
          {cerrando
            ? <Loader2 size={20} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none" />
            : <LogOut size={20} aria-hidden="true" className="shrink-0" />}
          <span className="flex-1">Cerrar sesión</span>
        </button>
      </div>
    </section>
  )
}
