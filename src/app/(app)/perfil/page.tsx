'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, Palette, Upload, X, CalendarDays, CheckCircle2, LogIn, LogOut, PenLine, Plus, Pencil, Trash2, Star, MapPin, RefreshCw, AlertTriangle } from 'lucide-react'
import { PerfilSkeleton } from '@/components/ui/Skeleton'
import ModalShell from '@/components/ui/ModalShell'
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
import EditConsultorioModal from '@/components/consultorios/EditConsultorioModal'
import DeleteConsultorioModal from '@/components/consultorios/DeleteConsultorioModal'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest px-5 pt-4 pb-1">{children}</p>
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
  const gcalError = useSearchParams().get('gcal_error')
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
    color_primario: '#1a3a5c', color_secundario: '#1e5fa8', logo_url: null,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)
  // null = todavía verificando.
  const [gcalEstado, setGcalEstado] = useState<EstadoGcal | null>(null)
  const [desconectandoGcal, setDesconectandoGcal] = useState(false)
  // A qué calendario de Google se está sincronizando. null = conectado pero
  // todavía sin calendario, o el médico lo borró desde Google.
  const [gcalNombre, setGcalNombre] = useState<string | null>(null)
  const [recreandoGcal, setRecreandoGcal] = useState(false)
  const [confirmarRecrearGcal, setConfirmarRecrearGcal] = useState(false)

  // F3-5b: Mis consultorios
  const { consultorios, mutate: mutateConsultorios, isLoading: loadingConsultorios } = useConsultorios()
  const [showAdd, setShowAdd] = useState(false)
  const [editingConsultorio, setEditingConsultorio] = useState<Consultorio | null>(null)
  const [deletingConsultorio, setDeletingConsultorio] = useState<Consultorio | null>(null)

  const isAdmin = canManageClinica(profile)

  // F3-5b: helpers para sección "Mis consultorios"
  const offsetDeTimezone = (tz: string): string => {
    const zona = ZONAS_MEXICO.find(z => z.value === tz)
    if (!zona) return ''
    const match = zona.label.match(/UTC[+-]\d+/)
    return match ? match[0] : ''
  }

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

  const handleEditarEnLugar = () => {
    const target = deletingConsultorio
    if (!target) return
    setDeletingConsultorio(null)
    setEditingConsultorio(target)
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
      })
      // La red del navegador tampoco es accionable por el médico.
      .catch(() => setGcalEstado('error_google'))
  }, [])

  useEffect(() => {
    cargarEstadoGcal()

    Promise.all([
      fetch('/api/me/perfil-medico').then(r => r.json()),
      fetch('/api/me/clinica').then(r => r.json()),
    ]).then(([perfilData, clinicaData]) => {
      if (perfilData.medico) {
        const espRaw = perfilData.medico.especialidad || ''
        const espArray = espRaw ? espRaw.split(' · ').filter(Boolean) : ['']
        setEspecialidades(espArray.length > 0 ? espArray : [''])
        setForm({
          titulo: perfilData.medico.titulo || 'Dr.',
          nombres: perfilData.medico.nombres || '',
          apellido_paterno: perfilData.medico.apellido_paterno || '',
          apellido_materno: perfilData.medico.apellido_materno || '',
          especialidad: espRaw,
          cedula_profesional: perfilData.medico.cedula_profesional || '',
          cedula_especialidad: perfilData.medico.cedula_especialidad || '',
          universidad: perfilData.medico.universidad || '',
        })
        setFirmaUrl(perfilData.medico.firma_url ?? null)
      }
      if (clinicaData.clinica) {
        setApariencia({
          color_primario: clinicaData.clinica.color_primario || '#1a3a5c',
          color_secundario: clinicaData.clinica.color_secundario || '#1e5fa8',
          logo_url: clinicaData.clinica.logo_url || null,
        })
      }
      setLoading(false)
    })
  }, [cargarEstadoGcal])

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
    setGuardando(true)

    // `direccion_consultorio` y `telefono_consultorio` NO viajan en este payload: F3-5b movió
    // esos datos a `consultorios` y quitó sus inputs de esta pantalla. El PUT itera `key in body`
    // (api/me/perfil-medico/route.ts), así que omitirlos conserva intacto el valor histórico de
    // profiles — del que aún dependen los PDFs como fallback (PdfHeader.tsx, PdfBarras.tsx,
    // pdf/v2/adaptadores/comun.tsx). No los reintroduzcas aquí.
    const r1 = await fetch('/api/me/perfil-medico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, especialidad: especialidades.filter(Boolean).join(' · ') }),
    })

    if (isAdmin) {
      await fetch('/api/me/clinica', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color_primario: apariencia.color_primario,
          color_secundario: apariencia.color_secundario,
        }),
      })

      if (logoFile) {
        setSubiendoLogo(true)
        const fd = new FormData()
        fd.append('logo', logoFile)
        const r = await fetch('/api/me/logo', { method: 'POST', body: fd })
        const d = await r.json()
        setSubiendoLogo(false)
        if (!r.ok) {
          toast.error(d.error || 'Error al subir el logo')
          setGuardando(false)
          return
        }
        setApariencia(a => ({ ...a, logo_url: d.url }))
        setLogoFile(null)
        setLogoPreview(null)
      }
    }

    setGuardando(false)
    if (!r1.ok) {
      const d = await r1.json()
      toast.error(d.error || 'Error al guardar')
    } else {
      toast.success('Cambios guardados correctamente')
      // Sincronizar perfil para el módulo Offline-Mode
      fetch('/api/me/perfil-medico').then(r => r.json()).then(d => {
        if (d.medico) syncDoctorProfile(d.medico).catch(() => {})
      }).catch(() => {})
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

  const logoMostrado = logoPreview || apariencia.logo_url

  const inputClass = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all"

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-slide-up">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Cuenta</p>
        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Mi perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Datos profesionales */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <SectionHeader>Datos profesionales</SectionHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Título</label>
              <select value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className={inputClass}>
                <option value="Dr.">Dr.</option>
                <option value="Dra.">Dra.</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Nombre(s) <span className="text-red-400">*</span></label>
              <input type="text" value={form.nombres}
                onChange={e => setForm({ ...form, nombres: e.target.value })}
                placeholder="Ej: Juan Carlos" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Apellido paterno <span className="text-red-400">*</span></label>
                <input type="text" value={form.apellido_paterno}
                  onChange={e => setForm({ ...form, apellido_paterno: e.target.value })}
                  placeholder="Ej: García" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Apellido materno</label>
                <input type="text" value={form.apellido_materno}
                  onChange={e => setForm({ ...form, apellido_materno: e.target.value })}
                  placeholder="Opcional" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Especialidad</label>
              <EspecialidadSelector value={especialidades} onChange={setEspecialidades} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Cédula profesional</label>
                <input type="text" inputMode="numeric" value={form.cedula_profesional}
                  onChange={e => setForm({ ...form, cedula_profesional: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="Ej: 87654321" className={inputClass} />
                {form.cedula_profesional && validarCedula(form.cedula_profesional) && (
                  <p className="text-[10px] text-red-500 mt-1">{validarCedula(form.cedula_profesional)}</p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Cédula de especialidad</label>
                <input type="text" inputMode="numeric" value={form.cedula_especialidad}
                  onChange={e => setForm({ ...form, cedula_especialidad: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="Ej: 3890214" className={inputClass} />
                {form.cedula_especialidad && validarCedula(form.cedula_especialidad) && (
                  <p className="text-[10px] text-red-500 mt-1">{validarCedula(form.cedula_especialidad)}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Universidad / Institución</label>
              <input type="text" value={form.universidad}
                onChange={e => setForm({ ...form, universidad: e.target.value })}
                placeholder="Ej: Universidad Nacional Autónoma de México" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Mis consultorios */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-1 flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-2">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Mis consultorios</p>
              <span className="text-[10px] text-[#86868b]">Hasta 10 activos</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--cp)] bg-[var(--cp)]/10 hover:bg-[var(--cp)]/15 transition-colors"
            >
              <Plus size={12} />
              Agregar
            </button>
          </div>

          <div className="px-5 pb-5 pt-2">
            {loadingConsultorios ? (
              <div className="space-y-2">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : consultorios.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No tienes consultorios activos. Agrega tu primer consultorio.
              </p>
            ) : (
              <div className="space-y-2">
                {consultorios.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 px-3 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--cp)]/10 text-[var(--cp)]">
                      <MapPin size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{c.nombre}</p>
                        {c.es_default && (
                          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--cp)]/10 text-[var(--cp)]">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 min-w-0">
                        <span className="truncate">{c.direccion}</span>
                        {c.telefono && (
                          <>
                            <span className="text-slate-300 shrink-0">·</span>
                            <span className="shrink-0">{c.telefono}</span>
                          </>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 mt-0.5">{offsetDeTimezone(c.timezone)}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!c.es_default && (
                        <button
                          type="button"
                          onClick={() => handleMarcarDefault(c)}
                          title="Marcar como predeterminado"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-[var(--cp)] hover:bg-[var(--cp)]/10 transition-colors"
                        >
                          <Star size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingConsultorio(c)}
                        title="Editar"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClickBorrar(c)}
                        disabled={!puedeIniciarBorrado(c)}
                        title={tooltipBorrar(c)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Firma autógrafa */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-1 flex items-center gap-2">
            <PenLine size={13} className="text-[#86868b]" />
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Firma autógrafa</p>
            <span className="text-[10px] text-[#86868b]">Aparece en todos los documentos y PDFs</span>
          </div>
          <div className="px-5 pb-5">
            <FirmaCaptura
              firmaActual={firmaUrl}
              onFirmaCambiada={url => setFirmaUrl(url)}
            />
          </div>
        </div>

        {/* Apariencia — solo admin */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-1 flex items-center gap-2">
              <Palette size={13} className="text-[#86868b]" />
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Apariencia</p>
              <span className="text-[10px] text-[#86868b]">Se aplica en documentos y PDFs</span>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {/* Logo */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Logo del consultorio</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                    {logoMostrado
                      ? <img src={logoMostrado} alt="Logo" className="w-full h-full object-contain p-1" />
                      : <Upload size={18} className="text-slate-300" />
                    }
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      data-onboard="subir-logo"
                      className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      {logoMostrado ? 'Cambiar logo' : 'Subir logo'}
                    </button>
                    {logoMostrado && (
                      <button type="button" onClick={quitarLogo}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors flex items-center gap-1"
                        style={{ color: '#EF5350', borderColor: '#fecaca' }}>
                        <X size={11} /> Quitar
                      </button>
                    )}
                    <p className="text-[10px] text-[#86868b]">PNG, JPG, SVG · se optimiza a máx. 150 KB</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={onSelectLogo} className="hidden" />
              </div>

              {/* Paletas */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Paleta de colores</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PALETAS.map(p => (
                    <button key={p.nombre} type="button"
                      onClick={() => setApariencia(a => ({ ...a, color_primario: p.primario, color_secundario: p.secundario }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition-colors
                        ${apariencia.color_primario === p.primario && apariencia.color_secundario === p.secundario
                          ? 'border-[#1e5fa8] bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex gap-1 flex-shrink-0">
                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.primario }} />
                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.secundario }} />
                      </div>
                      <span className="text-[#3d3d3f] truncate">{p.nombre}</span>
                    </button>
                  ))}
                </div>

                {/* Colores custom */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Color primario', key: 'color_primario' as const },
                    { label: 'Color secundario', key: 'color_secundario' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[10px] text-[#86868b] block mb-1.5">{label}</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                        <input type="color" value={apariencia[key]}
                          onChange={e => setApariencia(a => ({ ...a, [key]: e.target.value }))}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-[#3d3d3f]">{apariencia[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Vista previa del encabezado en PDFs</label>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <div style={{ background: `linear-gradient(135deg, ${apariencia.color_primario}, ${apariencia.color_secundario})` }}
                    className="p-4 flex items-center gap-3">
                    {logoMostrado && (
                      <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <img src={logoMostrado} alt="Logo" className="w-8 h-8 object-contain" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-bold text-sm">{componerNombreMedicoCompleto({ titulo: form.titulo, nombres: form.nombres, apellido_paterno: form.apellido_paterno, apellido_materno: form.apellido_materno }) || 'Médico'}</p>
                      <p className="text-white/70 text-xs">{form.especialidad || 'Especialidad'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integraciones */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <SectionHeader>Integraciones</SectionHeader>
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={15} className="text-[#1e5fa8]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1d1d1f]">Google Calendar</p>
                  <p className="text-[11px] text-[#86868b]">
                    {/* EL INVITADO SE RESUELVE ANTES DE MIRAR `gcalEstado`, y el orden
                        no es cosmético. `/api/google/calendar` le contesta 403, el 403
                        no trae campo `estado`, y el `d.estado ?? 'error_google'` de
                        `cargarEstadoGcal` lo deja en el casillero de error. Ahí leía
                        «Google no respondió. Tu conexión sigue guardada», dos frases
                        falsas para él: Google contestó —contestó que no—, y conexión
                        suya no hay ninguna. No se le enseña estado porque no hay
                        ninguno que él pueda consultar. */}
                    {!isAdmin
                      ? 'La gestiona quien administra la clínica: es una para todo el equipo, así que tus citas se sincronizan sin que tengas que conectar nada.'
                      : gcalEstado === null
                        ? 'Verificando...'
                        : gcalEstado === 'conectado'
                          ? 'Sincronización activa — las citas se crean automáticamente'
                          : gcalEstado === 'error_google'
                            // Ojo: NO decir "no conectado". Aquí hay token; lo que
                            // no hubo es respuesta de Google.
                            ? 'Google no respondió. Tu conexión sigue guardada; no hace falta que la rehagas.'
                            : 'Conecta para sincronizar citas con tu calendario personal'}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                {/* Al invitado no se le ofrece NADA: ni "Conectar" —§12.3: la conexión
                    es una por clínica y la hace quien la administra—, ni "Reintentar",
                    que le anunciaría un fallo que no ha ocurrido. */}
                {!isAdmin ? null : gcalEstado === null ? (
                  <Loader2 size={14} className="animate-spin text-[#86868b]" />
                ) : gcalEstado === 'error_google' ? (
                  // Sin "Conectar" ni "Desconectar": no se sabe en qué estado
                  // quedó nada del lado de Google, y reconectar no arregla un
                  // fallo suyo. Lo único accionable es volver a preguntar.
                  <button
                    type="button"
                    onClick={() => { setGcalEstado(null); cargarEstadoGcal() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors"
                  >
                    <RefreshCw size={12} /> Reintentar
                  </button>
                ) : gcalEstado === 'conectado' ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 size={13} /> Conectado
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirmarRecrearGcal(true)}
                        disabled={recreandoGcal || desconectandoGcal}
                        className="flex items-center gap-1 text-[11px] text-[#86868b] hover:text-[#1e5fa8] transition-colors disabled:opacity-40"
                      >
                        {recreandoGcal ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Recrear calendario
                      </button>
                    )}
                    {/* Desconectar borra la conexión de la CLÍNICA ENTERA, así
                        que va detrás del mismo gate que "Recrear calendario".
                        El servidor lo gatea también: esto es la interfaz
                        acompañando a la regla, no la regla. */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={desconectarGcal}
                        disabled={desconectandoGcal || recreandoGcal}
                        className="flex items-center gap-1 text-[11px] text-[#86868b] hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {desconectandoGcal ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                        Desconectar
                      </button>
                    )}
                  </div>
                ) : isAdmin && (
                  /* El mismo gate que "Recrear calendario" y "Desconectar". Era el
                     único control de esta tarjeta que no lo llevaba: lo que lo ocultaba
                     al invitado era que su 403 aterrizaba en 'error_google', o sea una
                     coincidencia. Redundante con el `!isAdmin` de arriba A PROPÓSITO:
                     sin él, reordenar las ramas vuelve a exponer el botón en silencio. */
                  <a
                    href="/api/google/connect"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] rounded-xl transition-colors"
                  >
                    <LogIn size={12} /> Conectar
                  </a>
                )}
              </div>
            </div>
            {/* A qué calendario se sincroniza. Quitarlo de la lista de Google
                es indetectable desde aquí (`calendarList.get` pide un permiso
                sensible que no pedimos), así que el aviso es la prevención. */}
            {gcalEstado === 'conectado' && (
              <p className="mt-3 text-[11px] leading-relaxed text-[#86868b] bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                {gcalNombre ? (
                  <>
                    Tus citas se sincronizan al calendario <strong className="text-[#1d1d1f]">{gcalNombre}</strong> de
                    tu cuenta de Google. No lo borres <strong>ni lo quites de tu lista de calendarios</strong>: si
                    desaparece de tu lista, Spinus sigue escribiendo en él y tú dejas de verlo. Si ya te pasó, usa
                    &quot;Recrear calendario&quot;.
                  </>
                ) : (
                  <>Todavía no hay un calendario de Spinus en tu cuenta de Google. Se creará solo la próxima vez que abras la agenda.</>
                )}
              </p>
            )}

            {gcalAviso && (
              <p className="mt-3 text-[11px] leading-relaxed text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {gcalAviso}
              </p>
            )}
          </div>
        </div>

        <button type="submit" disabled={guardando || subiendoLogo}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e5fa8] text-white rounded-2xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 shadow-sm">
          {guardando || subiendoLogo
            ? <><Loader2 size={15} className="animate-spin" /> {subiendoLogo ? 'Subiendo logo...' : 'Guardando...'}</>
            : <><Save size={15} /> Guardar cambios</>}
        </button>

      </form>

      {/* Modales F3-5b */}
      <AddConsultorioModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={handleConsultorioCreado}
      />

      {editingConsultorio && (
        <EditConsultorioModal
          open={true}
          onClose={() => setEditingConsultorio(null)}
          consultorio={editingConsultorio}
          onSuccess={handleConsultorioActualizado}
        />
      )}

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
