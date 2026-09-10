'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { mutate as revalidar } from 'swr'
import { useProfile } from '@/hooks/useProfile'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, Upload, X, AlertTriangle, WifiOff } from 'lucide-react'
import { PerfilSkeleton } from '@/components/ui/Skeleton'
import { AvisoColumna } from '@/components/dashboard/piezasBanda2'
import PestanasPerfil, {
  esPestanaPerfilValida, PESTANA_PERFIL_POR_DEFECTO, type ClavePestanaPerfil,
} from '@/components/perfil/PestanasPerfil'
import TarjetaIdentidad from '@/components/perfil/TarjetaIdentidad'
import PanelConsultorios from '@/components/perfil/PanelConsultorios'
import PanelGoogleCalendar from '@/components/perfil/PanelGoogleCalendar'
import {
  CabeceraCard, MuestraColor, ResumenConsultorios, EstadoGoogleCalendar, VistaPreviaEncabezado,
} from '@/components/perfil/piezasDatos'
import ModalShell from '@/components/ui/ModalShell'
import Portal from '@/components/ui/Portal'
import { useToast } from '@/components/ui/Toast'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'
import { validarCedula } from '@/lib/validaciones'
import FirmaCaptura from '@/components/perfil/FirmaCaptura'
import { compressLogoImage } from '@/lib/compressImage'
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
  { nombre: 'Spinus® (defecto)', primario: '#1a3a5c', secundario: '#1e5fa8' },
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

/** La ceja y el título. Sale dos veces —pantalla y estado de error— y son
 *  cuatro líneas: se comparte para que no diverjan, no por ahorrar. */
/**
 * Etiqueta, control y —cuando lo hay— su error. Existe porque la pestaña tiene
 * ocho campos y los tres trozos tienen que ir SIEMPRE al mismo nivel: `.sp-label-field`,
 * `--sp-gap-label` de separación y el error en `--sp-danger`, que es el rol que
 * el sistema reserva para el asterisco de obligatorio y el aviso de campo.
 */
function Campo({ etiqueta, obligatorio, error, children }: {
  etiqueta: string
  obligatorio?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label className="sp-label-field mb-[var(--sp-gap-label)] block">
        {etiqueta}
        {obligatorio && <span className="text-[var(--sp-danger)]"> *</span>}
      </label>
      {children}
      {error && (
        <p className="mt-[var(--sp-1)] text-[length:var(--sp-fs-legal)] text-[var(--sp-danger)]">{error}</p>
      )}
    </div>
  )
}

function CabeceraPerfil() {
  return (
    <div className="mb-[var(--sp-gap-block)]">
      <p className="sp-label">Cuenta</p>
      <h1 className="sp-title-page mt-[var(--sp-gap-title-sub)]">Mi perfil</h1>
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

  if (loading || loadingProfile) return <PerfilSkeleton />

  /* «No pude» tiene pantalla propia, y no es el esqueleto. Reintentar vuelve a
     pedir los dos endpoints; el estado de Google va por su cuenta y tiene su
     propio botón de reintento dentro de su pestaña. */
  if (errorCarga) {
    return (
      <div className="max-w-[960px] mx-auto animate-slide-up">
        <CabeceraPerfil />
        <AvisoColumna
          icono={WifiOff}
          mensaje="No se pudieron cargar tus datos. Revisa tu conexión e inténtalo de nuevo."
          onReintentar={cargarDatos}
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

  const inputClass = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all"

  return (
    /* 960 px: el área útil real a 1280 de ventana —el viewport de referencia—
       una vez descontado el menú lateral y el relleno del layout. Es la misma
       medida del expediente rediseñado, no la del mockup (1180) ni la del
       dashboard (1044). */
    /* ⚠️ EL RELLENO INFERIOR LE HACE SITIO A LA BARRA, Y HACE FALTA EN LOS DOS
       ANCHOS: la barra está fuera del flujo (`fixed`) y flota sobre el
       contenido, así que sin esto taparía la última card al llegar al final.
       Los números son altos MEDIDOS de la barra más aire: 96 en escritorio (una
       fila de 72 más los 16 que la separan del borde) y 148 en móvil (140 con
       las dos líneas de mensaje y los botones de 48), y ahí encima el área
       segura, porque a sangre la barra llega al borde físico.
       Sólo cuando hay cambios: sin ellos la barra está fuera de pantalla y esto
       sería una franja en blanco. */
    <div className={`max-w-[960px] mx-auto animate-slide-up ${hayCambios ? 'pb-[96px] max-sm:pb-[calc(148px+env(safe-area-inset-bottom,0px))]' : ''}`}>

      <CabeceraPerfil />

      <PestanasPerfil activa={pestana} onCambiar={cambiarPestana} />

      <form id={ID_FORM} onSubmit={handleSubmit}>

        {/* ⚠️ `items-start` ES LO QUE HACE POSIBLE EL `sticky` DE LA COLUMNA.
            Sin él la celda se estira a la altura de la fila, la columna mide
            tanto como el cuerpo y no le queda recorrido por el que pegarse.

            ⚠️ 310 PX, Y ES UN SUELO MEDIDO, NO UN NÚMERO REDONDO. El anexo del
            spec dice 330; se bajó para dar ese ancho al cuerpo, y no se puede
            bajar más. Lo que lo fija es la fila de cédulas de la tarjeta de
            identidad, que necesita 257 px de interior con una fuente tipo Segoe
            UI (medido: «Céd. profesional» 118 + 18 de separación + «Céd.
            especialidad» 121) más los 42 de relleno y borde de la card: 299.
            Con 310 quedan 11 px de margen. A 290 las dos cédulas ya se parten
            en dos filas.
            El nombre del médico aguanta en dos líneas hasta 300; por debajo se
            va a tres.

            ⚠️ Y EL TOTAL DE 960 NO PUEDE CRECER: a 1280 de ventana el
            contenedor YA ocupa todo lo disponible (1280 − 256 del menú lateral
            − 64 del relleno de `(app)/layout.tsx` = 960). Todo lo que gane el
            cuerpo tiene que salir de esta columna, y esta columna no da más. */}
        {/* ⚠️ LA SEGUNDA COLUMNA SÓLO EXISTE EN DATOS. La tarjeta de identidad
            es el contexto de los datos que se editan al lado —el nombre, las
            cédulas, la firma y los colores que se están tocando—; en
            Consultorios y en Google Calendar no acompaña a nada, y en móvil,
            donde se apila encima, obligaba a pasarla de largo para llegar al
            contenido de esas dos pestañas.
            Al desaparecer la columna, la rejilla se queda en `grid-cols-1` y
            esas dos pestañas ocupan los 960 px enteros en vez de 628. */}
        <div className={`mt-[var(--sp-gap-band)] grid grid-cols-1 items-start gap-[var(--sp-5-5)] ${pestana === 'datos' ? 'lg:grid-cols-[310px_minmax(0,1fr)]' : ''}`}>

          {/* ── Región 2 · columna fija ── */}
          {pestana === 'datos' && (
          <aside className="lg:sticky lg:top-[var(--sp-6)]">
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
          <div className="min-w-0 flex flex-col gap-[var(--sp-gap-block)]">

            {pestana === 'datos' && (<>

              {/* ── §3.1 · Datos profesionales ──────────────────────────── */}
              <section className="sp-card flex flex-col gap-[var(--sp-4)]">
                <CabeceraCard
                  titulo="Datos profesionales"
                  apoyo="Aparecen en las recetas, solicitudes y documentos que emites."
                />

                {/* ── LOS CUATRO CAMPOS DEL NOMBRE VAN JUNTOS EN UNA FILA ──
                    Antes el apellido materno caía a la fila siguiente, al lado
                    de las cédulas: quedaba separado del nombre y agrupado con
                    datos que no son suyos, y era fácil dejarlo vacío sin caer
                    en que forma parte del nombre. Las cédulas bajan a su propia
                    fila, que es donde pertenecen.

                    REPARTO A 566 px (los 608 de la columna menos el relleno y
                    el borde de la card), medido con `<select>` real en cuatro
                    fuentes: 80 px para el título y tres columnas iguales de
                    149. Los 80 son el mínimo del desplegable —«Dra.» 31 px +
                    26 de relleno + 2 de borde + ~20 de la flecha nativa—, no un
                    número redondo; bajarlo recorta la flecha.

                    ⚠️ `items-end` NO ES ADORNO, ES LO QUE MANTIENE LOS CAMPOS
                    ALINEADOS. Las etiquetas van en mayúsculas y «APELLIDO
                    MATERNO» mide 131-144 px según la fuente del sistema, contra
                    149 de columna: el margen es de 5 px y `system-ui` no es la
                    misma fuente en Windows, macOS y Linux. Si una etiqueta
                    envuelve a dos líneas, `align-items: end` alinea los campos
                    por abajo y la fila se mantiene recta —comprobado forzando
                    el envolvimiento—. Sin esto, un equipo con la fuente un poco
                    más ancha vería un campo descolgado. */}
                <div className="grid grid-cols-2 items-end gap-[var(--sp-3)] sm:grid-cols-[80px_repeat(3,minmax(0,1fr))]">
                  <Campo etiqueta="Título">
                    <select
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      className="sp-input"
                    >
                      <option value="Dr.">Dr.</option>
                      <option value="Dra.">Dra.</option>
                    </select>
                  </Campo>
                  <Campo etiqueta="Nombre(s)" obligatorio>
                    <input
                      type="text"
                      value={form.nombres}
                      onChange={e => setForm({ ...form, nombres: e.target.value })}
                      placeholder="Ej: Juan Carlos"
                      className="sp-input"
                    />
                  </Campo>
                  <Campo etiqueta="Apellido paterno" obligatorio>
                    <input
                      type="text"
                      value={form.apellido_paterno}
                      onChange={e => setForm({ ...form, apellido_paterno: e.target.value })}
                      placeholder="Ej: García"
                      className="sp-input"
                    />
                  </Campo>
                  <Campo etiqueta="Apellido materno">
                    <input
                      type="text"
                      value={form.apellido_materno}
                      onChange={e => setForm({ ...form, apellido_materno: e.target.value })}
                      placeholder="Opcional"
                      className="sp-input"
                    />
                  </Campo>
                </div>

                {/* Las dos cédulas, en su propia fila. Sin `items-end`: aquí sí
                    hay mensajes de error, y van DEBAJO del campo, así que
                    alinear por abajo movería el campo del vecino en cuanto uno
                    de los dos fallara. */}
                <div className="grid grid-cols-2 gap-[var(--sp-3)]">
                  <Campo
                    etiqueta="Cédula profesional"
                    error={form.cedula_profesional ? validarCedula(form.cedula_profesional) : null}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.cedula_profesional}
                      onChange={e => setForm({ ...form, cedula_profesional: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      placeholder="Ej: 87654321"
                      className="sp-input"
                    />
                  </Campo>
                  <Campo
                    etiqueta="Cédula de especialidad"
                    error={form.cedula_especialidad ? validarCedula(form.cedula_especialidad) : null}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.cedula_especialidad}
                      onChange={e => setForm({ ...form, cedula_especialidad: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      placeholder="Ej: 3890214"
                      className="sp-input"
                    />
                  </Campo>
                </div>

                {/* ⚠️ SIGUEN LOS DOS DESPLEGABLES, NO LOS CHIPS DEL MOCKUP.
                    `EspecialidadSelector` lo comparten el onboarding y el alta
                    de usuarios de la clínica, así que convertirlo en chips los
                    cambiaría también a ellos. Se le pasa `selectClassName` para
                    que sus `select` vistan como el resto de campos: es su API,
                    no una modificación suya. */}
                <Campo etiqueta="Especialidad">
                  <EspecialidadSelector value={especialidades} onChange={setEspecialidades} selectClassName="sp-input" />
                </Campo>

                <Campo etiqueta="Universidad / Institución">
                  <input
                    type="text"
                    value={form.universidad}
                    onChange={e => setForm({ ...form, universidad: e.target.value })}
                    placeholder="Ej: Universidad Nacional Autónoma de México"
                    className="sp-input"
                  />
                </Campo>
              </section>

              {/* ── §3.2 · Nombre de la clínica ─────────────────────────── */}
              <section className="sp-card flex flex-col gap-[var(--sp-3)]">
                <CabeceraCard titulo="Nombre de la clínica" />

                {isAdmin ? (
                  <div>
                    <input
                      type="text"
                      value={nombreClinica}
                      onChange={e => setNombreClinica(e.target.value)}
                      maxLength={120}
                      aria-label="Nombre de la clínica"
                      placeholder="Ej: Clínica Ortointegra"
                      className="sp-input"
                    />
                    {nombreClinicaVacio && (
                      <p className="mt-[var(--sp-1)] text-[length:var(--sp-fs-legal)] text-[var(--sp-danger)]">
                        El nombre de la clínica no puede quedar vacío.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Al invitado se le enseña, pero no se le da un campo que su
                     rol no puede guardar: `/api/me/clinica` responde 403 a quien
                     no administra, así que un input editable sería una promesa
                     que el servidor rompe. */
                  <p className="truncate text-[length:var(--sp-fs-body)] text-[var(--sp-ink-700)]">
                    {nombreClinica || '—'}
                  </p>
                )}

                <p className="sp-hint">
                  Es el nombre de la clínica, distinto al de cada consultorio.
                  {!isAdmin && ' Sólo quien administra la clínica puede cambiarlo.'}
                </p>
              </section>

              {/* ── §3.3 · Firma y logo ─────────────────────────────────────
                  ⚠️ APILADO, NO EN DOS COLUMNAS COMO EL MOCKUP, Y LA APP MANDA.
                  El spec dibuja firma y logo lado a lado porque supone una firma
                  reducida a previsualización más dos botones. La real,
                  `FirmaCaptura`, es un flujo entero de captura —subir o dibujar,
                  lienzo, previsualización sobre claro y sobre oscuro— que no
                  entra en los ~296 px de media columna, y no se puede adaptar
                  porque lo comparte el onboarding. */}
              <section className="sp-card flex flex-col gap-[var(--sp-4)]">
                <CabeceraCard
                  titulo={isAdmin ? 'Firma y logo' : 'Firma'}
                  apoyo="Se aplican en tus documentos y PDFs."
                />

                <div className="flex flex-col gap-[var(--sp-2-5)]">
                  <p className="sp-label-field">Firma autógrafa</p>
                  <FirmaCaptura
                    firmaActual={firmaUrl}
                    onFirmaCambiada={url => setFirmaUrl(url)}
                  />
                  <p className="sp-hint">
                    La firma se guarda en cuanto la capturas: no depende del botón de guardar.
                  </p>
                </div>

                {isAdmin && (
                  <div
                    className="flex flex-col gap-[var(--sp-2-5)] pt-[var(--sp-4)]"
                    style={{ borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' }}
                  >
                    <p className="sp-label-field">Logo del consultorio</p>
                    <div className="flex items-center gap-[var(--sp-4)]">
                      <div
                        className="h-[86px] w-[86px] shrink-0 flex items-center justify-center overflow-hidden rounded-[var(--sp-r-card-inner)] bg-[var(--sp-surface-sunken)]"
                        style={logoMostrado
                          ? { border: 'var(--sp-bw-hair) solid var(--sp-line-card)' }
                          : { border: 'var(--sp-bw-dash) dashed var(--sp-line-dash)' }}
                      >
                        {logoMostrado
                          ? <img src={logoMostrado} alt="Logo del consultorio" className="max-h-[58px] max-w-[58px] object-contain" />
                          : <Upload size={18} className="text-[var(--sp-ink-150)]" />}
                      </div>

                      <div className="flex min-w-0 flex-col items-start gap-[var(--sp-2)]">
                        {/* ⚠️ `data-onboard` ES UN ANCLA DE `OnboardingGuide`, que
                            lo busca con `querySelector` (OnboardingGuide.tsx:255).
                            Vive dentro de la pestaña Datos, que es la de entrada y
                            la que borra `?tab` de la URL, así que un `/perfil` a
                            secas siempre lo monta. Con `?tab=` de otra pestaña el
                            consejo sale sin flecha —`HighlightArrow` no encuentra
                            el nodo y no pinta nada— y la flecha aparece sola al
                            abrir Datos, porque relee en cada frame. No lo muevas a
                            otra pestaña. */}
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          data-onboard="subir-logo"
                          className="sp-btn sp-btn--compact"
                        >
                          {logoMostrado ? 'Cambiar logo' : 'Subir logo'}
                        </button>

                        {/* ⚠️ SÓLO CUANDO HAY UN ARCHIVO ELEGIDO SIN GUARDAR, y
                            antes no era así. El botón decía «Quitar» también sobre
                            un logo ya guardado, y ahí no quitaba nada: sólo
                            limpiaba la previsualización local, porque no existe
                            endpoint que borre el logo de la clínica —el PUT de
                            `/api/me/clinica` no toca `logo_url`—. Al recargar
                            reaparecía. Enseñarlo únicamente sobre una selección
                            pendiente es lo único que hoy es verdad. Cuando exista
                            el borrado de verdad, ése es el momento de devolverlo
                            para el logo guardado. */}
                        {logoPreview && (
                          <button type="button" onClick={quitarLogo} className="sp-btn sp-btn--compact">
                            <X size={12} /> Descartar selección
                          </button>
                        )}

                        <p className="sp-hint">PNG, JPG, SVG · se optimiza a máx. 150 KB</p>
                      </div>
                    </div>
                    <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={onSelectLogo} className="hidden" />
                  </div>
                )}

                {isAdmin && (
                  <div
                    className="flex flex-col gap-[var(--sp-3-5)] pt-[var(--sp-4)]"
                    style={{ borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' }}
                  >
                    <div className="flex flex-col gap-[var(--sp-2-5)]">
                      <p className="sp-label-field">Paleta de colores</p>
                      <div className="grid grid-cols-2 gap-[var(--sp-2-5)] sm:grid-cols-3">
                        {PALETAS.map(pa => {
                          const activa = pa.primario === apariencia.color_primario
                            && pa.secundario === apariencia.color_secundario
                          return (
                            <button
                              key={pa.nombre}
                              type="button"
                              aria-pressed={activa}
                              onClick={() => setApariencia(a => ({ ...a, color_primario: pa.primario, color_secundario: pa.secundario }))}
                              className="flex items-center gap-[var(--sp-2)] rounded-[var(--sp-r-icon-md)] px-[13px] py-[11px] text-left transition-colors"
                              /* El borde de la activa es 1.5 px y el de las demás
                                 1: con `border-box` la diferencia se come relleno,
                                 no mueve la retícula. */
                              style={activa
                                ? { border: 'var(--sp-bw-accent) solid var(--sp-primary)', background: 'var(--sp-primary-bg-soft)' }
                                : { border: 'var(--sp-bw-hair) solid var(--sp-line-control)', background: 'var(--sp-surface)' }}
                            >
                              <span className="flex shrink-0 gap-[3px]">
                                <MuestraColor color={pa.primario} />
                                <MuestraColor color={pa.secundario} />
                              </span>
                              <span className="min-w-0 truncate text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-ink-700)]">
                                {pa.nombre}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-[var(--sp-3)]">
                      {([
                        { etiqueta: 'Color primario', clave: 'color_primario' as const },
                        { etiqueta: 'Color secundario', clave: 'color_secundario' as const },
                      ]).map(({ etiqueta, clave }) => (
                        <Campo key={clave} etiqueta={etiqueta}>
                          <div
                            className="flex min-h-[var(--sp-tap)] items-center gap-[var(--sp-2)] rounded-[var(--sp-r-field)] bg-[var(--sp-surface-sunken)] px-[13px]"
                            style={{ border: 'var(--sp-bw-hair) solid var(--sp-line-control)' }}
                          >
                            <input
                              type="color"
                              value={apariencia[clave]}
                              onChange={e => setApariencia(a => ({ ...a, [clave]: e.target.value }))}
                              aria-label={etiqueta}
                              className="h-[22px] w-[22px] shrink-0 cursor-pointer rounded-[var(--sp-r-checkbox)] border-0 bg-transparent p-0"
                            />
                            <span className="font-mono text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-600)]">
                              {apariencia[clave]}
                            </span>
                          </div>
                        </Campo>
                      ))}
                    </div>

                    <div>
                      <p className="sp-label-field mb-[var(--sp-gap-label)]">Vista previa del encabezado en PDFs</p>
                      <VistaPreviaEncabezado
                        nombre={componerNombreMedicoCompleto(form)}
                        especialidad={especialidades.filter(Boolean).join(' · ')}
                        cedulaProfesional={form.cedula_profesional}
                        cedulaEspecialidad={form.cedula_especialidad}
                        logoUrl={logoMostrado}
                        colorPrimario={apariencia.color_primario}
                        colorSecundario={apariencia.color_secundario}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* ── §3.4 · Mis consultorios (resumen) ───────────────────── */}
              <ResumenConsultorios consultorios={consultorios} cargando={loadingConsultorios} />

              {/* ── §3.5 · Estado de Google Calendar ────────────────────── */}
              <EstadoGoogleCalendar esAdmin={isAdmin} estado={gcalEstado} />

            </>)}

            {pestana === 'consultorios' && (<>

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

            </>)}

            {pestana === 'google' && (<>

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

            </>)}

          </div>
        </div>

      </form>

      {/* ── Región 6 · Barra de guardado ────────────────────────────────
          ⚠️ VA EN UN PORTAL, Y NO ES POR GUSTO: SIN ÉL, `position: fixed` NO
          SE FIJA A LA VENTANA. El contenedor de esta pantalla lleva
          `animate-slide-up`, que en `globals.css:866` es
          `animation: … both` MÁS `will-change: transform, opacity`. Cualquiera
          de las dos cosas basta para convertir ese div en BLOQUE CONTENEDOR de
          todo `position: fixed` que cuelgue debajo: la barra se anclaba al
          contenedor y se iba con el scroll, tapando lo que pasaba por debajo.
          Es la MISMA trampa que `globals.css:933-937` ya documenta para
          `.animate-page-enter`, que se arregló cambiando su `both` por
          `backwards`. Aquí no se toca la hoja compartida —`animate-slide-up` la
          usa media app— sino que la barra se saca del árbol.
          ⚠️ POR ESO EL BOTÓN LLEVA `form={ID_FORM}`: al portarse a `body` deja
          de ser descendiente del `<form>` y sin ese atributo el envío no
          dispara nada.

          ⚠️ LA ANIMACIÓN ES SÓLO `transform`. Entra deslizándose y sale igual,
          en los DOS anchos: ya no hay `hidden`, la barra vive siempre montada y
          se aparta con `translate-y-full`, que la saca entera de la ventana. Es
          lo que permite animar la salida —un `display:none` no se anima— y de
          paso no toca layout. `motion-reduce` la apaga.

          ⚠️ LOS 1024 px DEL ENVOLTORIO NO SON UN MÁXIMO CAPRICHOSO: son los 960
          del contenido MÁS el `lg:px-8` del layout, y con `lg:left-64`
          —los 256 del menú— hacen que la barra caiga exactamente sobre la
          columna de contenido a cualquier ancho de ventana. */}
      <Portal>
        <div
          aria-hidden={!hayCambios}
          className={`fixed inset-x-0 bottom-0 z-30 transition-transform duration-[var(--sp-dur-base)] ease-[var(--sp-ease-out)] motion-reduce:transition-none lg:left-64 ${hayCambios ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
        >
          <div className="mx-auto w-full max-w-[1024px] px-4 pb-[var(--sp-4)] max-sm:px-0 max-sm:pb-0 lg:px-8">
            <div className="flex items-center gap-[var(--sp-gap-item)] rounded-[var(--sp-r-card)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-5)] py-[var(--sp-3-5)] shadow-[var(--sp-shadow-raised)] max-sm:flex-col max-sm:items-stretch max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:px-[var(--sp-4)] max-sm:pb-[calc(var(--sp-3-5)+env(safe-area-inset-bottom,0px))]">

              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-700)]">
                  {hayCambios
                    ? `Tienes cambios sin guardar en ${listaSecciones}.`
                    : 'Sin cambios pendientes.'}
                </p>
                {/* La advertencia sólo aparece cuando «Descartar» está vivo, que es
                    cuando puede engañar. La firma se guarda al capturarla, así que
                    descartar no la deshace — decirlo aquí es más barato que el
                    soporte de quien creyó que sí. */}
                {hayCambios && (
                  <p className="sp-hint mt-[2px]">
                    La firma se guarda sola al capturarla: «Descartar» no la revierte.
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-[var(--sp-gap-item)] max-sm:grid max-sm:grid-cols-2">
                <button
                  type="button"
                  onClick={descartarCambios}
                  disabled={!puedeGuardar}
                  className="sp-btn sp-btn--secondary max-sm:min-h-[var(--sp-ctrl-h-mobile)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Descartar
                </button>
                {/* ⚠️ PRIMARIO CUANDO SE PUEDE PULSAR, SECUNDARIO CUANDO NO — y la
                    condición es `puedeGuardar`, NO `hayCambios`. Con `hayCambios` el
                    botón se quedaba en primario mientras guardaba, que es cuando
                    además está `disabled`, y ahí caía en `.sp-btn--primary:disabled`:
                    texto blanco sobre un gris azulado que no llega al 4.5:1. Atado a
                    `puedeGuardar`, el inhabilitado es SIEMPRE el secundario
                    —superficie neutra con tinta secundaria—, que es lo que el spec
                    pide para que siga leyéndose. */}
                <button
                  type="submit"
                  form={ID_FORM}
                  disabled={!puedeGuardar}
                  className={`sp-btn ${puedeGuardar ? 'sp-btn--primary' : 'sp-btn--secondary'} max-sm:min-h-[var(--sp-ctrl-h-mobile)] disabled:cursor-not-allowed`}
                >
                  {guardando || subiendoLogo
                    ? <><Loader2 size={15} className="animate-spin" /> {subiendoLogo ? 'Subiendo logo...' : 'Guardando...'}</>
                    : <><Save size={15} /> Guardar</>}
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
          desde Google, y para entonces el aviso ya tiene que estar puesto. */}
      <ModalShell
        open={confirmarRecrearGcal}
        onClose={() => setConfirmarRecrearGcal(false)}
        title="Recrear calendario"
        subtitle="Google Calendar"
        icon={<AlertTriangle size={18} className="text-red-600" />}
        iconBg="bg-red-50"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-3.5">
            <button
              type="button"
              onClick={() => setConfirmarRecrearGcal(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={recrearCalendarioGcal}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Sí, recrear
            </button>
          </div>
        }
      >
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-700">
            Se creará un calendario de Spinus nuevo en tu cuenta de Google.
          </p>
          <p className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
            SE BORRA EL CALENDARIO ACTUAL Y TODOS LOS EVENTOS QUE CONTENGA.
            Tus citas de Spinus NO se borran, pero las que ya existían dejarán de
            aparecer en Google: sólo se sincronizarán de aquí en adelante.
          </p>
          <p className="text-sm text-slate-700">¿Continuar?</p>
        </div>
      </ModalShell>
    </div>
  )
}
