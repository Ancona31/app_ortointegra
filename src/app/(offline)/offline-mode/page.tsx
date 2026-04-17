'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  UserPlus, FileText, RefreshCw, Trash2, AlertTriangle, CheckCircle2, X,
  Loader2, WifiOff, Wifi, Pill, FlaskConical, ScanLine, ClipboardList,
  BedDouble, PenLine, ShieldCheck, Receipt,
} from 'lucide-react'
import { getOfflineIdentity } from '@/lib/offline/identity'
import { getDoctorProfile } from '@/lib/offline/doctorProfile'
import {
  addPatient, addDocument, getAllPatients, getAllDocuments,
  getVaultStats, clearSyncedRecords, clearAllVault,
} from '@/lib/offline/db'
import { toTitleCase, calcularEdad, fechaHoyISO, FECHA_MIN_NACIMIENTO } from '@/lib/patientUtils'
import { generateUUID } from '@/lib/offline/types'
import type { OfflineIdentity, TempPatient, TempDocument, SyncStatus, PendingMatch } from '@/lib/offline/types'
import type { DoctorProfile } from '@/lib/offline/doctorProfile'

type Tab = 'paciente' | 'nota' | 'documentos' | 'cola'

const STATUS_BADGE: Record<SyncStatus, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  synced: { label: 'Sincronizado', cls: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
}

// 8 formularios cargados dinámicamente — mismo layout que online
function FormLoader() {
  return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /><span className="text-sm">Cargando formulario...</span></div>
}
const RecetaForm             = dynamic(() => import('@/components/documentos/RecetaForm'), { ssr: false, loading: FormLoader })
const SolicitudLabForm       = dynamic(() => import('@/components/documentos/SolicitudLabForm'), { ssr: false, loading: FormLoader })
const SolicitudImagenForm    = dynamic(() => import('@/components/documentos/SolicitudImagenForm'), { ssr: false, loading: FormLoader })
const PlanSuplementacionForm = dynamic(() => import('@/components/documentos/PlanSuplementacionForm'), { ssr: false, loading: FormLoader })
const NotaHonorariosForm     = dynamic(() => import('@/components/documentos/NotaHonorariosForm'), { ssr: false, loading: FormLoader })
const EscritoMedicoForm      = dynamic(() => import('@/components/documentos/EscritoMedicoForm'), { ssr: false, loading: FormLoader })
const ConsentimientoForm     = dynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'), { ssr: false, loading: FormLoader })
const InternamientoForm      = dynamic(() => import('@/components/documentos/SolicitudInternamientoForm'), { ssr: false, loading: FormLoader })

const DOC_TYPES = [
  { key: 'receta',         label: 'Receta',            icon: Pill,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'lab',            label: 'Sol. Laboratorio',  icon: FlaskConical,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { key: 'imagen',         label: 'Sol. Imagen',       icon: ScanLine,      color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { key: 'suplementacion', label: 'Suplementación',    icon: ClipboardList, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'honorarios',     label: 'Honorarios',        icon: Receipt,       color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'escrito',        label: 'Escrito Médico',    icon: PenLine,       color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { key: 'consentimiento', label: 'Consentimiento',    icon: ShieldCheck,   color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { key: 'internamiento',  label: 'Internamiento',     icon: BedDouble,     color: 'text-rose-600 bg-rose-50 border-rose-200' },
] as const

type DocKey = typeof DOC_TYPES[number]['key']

export default function OfflineModePage() {
  const [identity, setIdentity] = useState<OfflineIdentity | null>(null)
  const [profile, setProfile] = useState<DoctorProfile | null>(null)
  const [tab, setTab] = useState<Tab>('paciente')
  const [isOnline, setIsOnline] = useState(true)
  const [stats, setStats] = useState({ patients: { pending: 0, synced: 0, error: 0 }, documents: { pending: 0, synced: 0, error: 0 } })

  // Patient form
  const [pNombre, setPNombre] = useState('')
  const [pApellidos, setPApellidos] = useState('')
  const [pFechaNac, setPFechaNac] = useState('')
  const [pSexo, setPSexo] = useState<'M' | 'F' | ''>('')
  const [pTelefono, setPTelefono] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pSaving, setPSaving] = useState(false)
  const [pSuccess, setPSuccess] = useState(false)

  // Note form — campos idénticos al modo online
  const [notaPatientId, setNotaPatientId] = useState('')
  const [notaForm, setNotaForm] = useState({
    motivo_consulta: '', exploracion_fisica: '', gabinete_laboratorios: '',
    diagnosticos: '', analisis: '', plan_tratamiento: '', pronostico: '',
  })
  const [notaSaving, setNotaSaving] = useState(false)
  const [notaSuccess, setNotaSuccess] = useState(false)

  function updateNota(key: string, val: string) {
    setNotaForm(prev => ({ ...prev, [key]: val }))
  }

  // Document form
  const [docType, setDocType] = useState<DocKey | null>(null)
  const [docPatientId, setDocPatientId] = useState('')

  // Queue
  const [patients, setPatients] = useState<TempPatient[]>([])
  const [documents, setDocuments] = useState<TempDocument[]>([])
  const [syncing, setSyncing] = useState(false)
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([])
  const [matchDecisions, setMatchDecisions] = useState<Map<string, 'link' | 'create'>>(new Map())
  const [syncSummary, setSyncSummary] = useState<string | null>(null)

  // Modales
  const [showReconnectModal, setShowReconnectModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveSyncing, setLeaveSyncing] = useState(false)
  const [privateBrowsing, setPrivateBrowsing] = useState(false)

  const refreshData = useCallback(async () => {
    const id = identity?.userId
    const [p, d, s] = await Promise.all([
      getAllPatients(id), getAllDocuments(id), getVaultStats(id),
    ])
    setPatients(p)
    setDocuments(d)
    setStats(s)
  }, [identity])

  useEffect(() => {
    setIdentity(getOfflineIdentity())
    setProfile(getDoctorProfile())
    setIsOnline(navigator.onLine)

    // Detectar Private Browsing — IndexedDB falla o tiene restricciones
    try {
      const testDb = indexedDB.open('__spinus_pb_test')
      testDb.onerror = () => setPrivateBrowsing(true)
      testDb.onsuccess = () => {
        testDb.result.close()
        indexedDB.deleteDatabase('__spinus_pb_test')
      }
    } catch {
      setPrivateBrowsing(true)
    }
    const on = () => {
      setIsOnline(true)
      // Modal 1: la red regresó mientras trabaja — preguntar si sincronizar
      setShowReconnectModal(true)
    }
    const off = () => {
      setIsOnline(false)
      setShowReconnectModal(false)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => { refreshData() }, [refreshData])

  const totalPending = stats.patients.pending + stats.documents.pending

  // ── Save patient ──
  async function handleSavePatient() {
    if (!pNombre.trim() || !pApellidos.trim() || !pFechaNac) return
    setPSaving(true)
    await addPatient({
      id: generateUUID(),
      nombre: toTitleCase(pNombre),
      apellidos: toTitleCase(pApellidos),
      fecha_nacimiento: pFechaNac,
      sexo: pSexo === '' ? null : pSexo,
      telefono: pTelefono.trim() || null,
      email: pEmail.trim() || null,
      created_at: new Date().toISOString(),
      medico_id: identity?.userId ?? 'anonymous',
      _syncStatus: 'pending',
    })
    setPNombre(''); setPApellidos(''); setPFechaNac(''); setPSexo(''); setPTelefono(''); setPEmail('')
    setPSuccess(true); setTimeout(() => setPSuccess(false), 2000)
    setPSaving(false); refreshData()
  }

  // ── Save note ──
  const notaTieneContenido = notaForm.motivo_consulta.trim() !== '' || notaForm.diagnosticos.trim() !== ''
  async function handleSaveNote() {
    if (!notaPatientId || !notaTieneContenido) return
    setNotaSaving(true)
    // Ensamblar nota en formato idéntico al online
    const partes = [
      `**[SUBJETIVO]:**\n${notaForm.motivo_consulta || 'Sin datos.'}`,
      `**[OBJETIVO]:**\n${notaForm.exploracion_fisica || 'Sin exploración física registrada.'}`,
      `**[AUXILIARES DIAGNÓSTICOS]:**\n${notaForm.gabinete_laboratorios || 'Pendientes.'}`,
      `**[DIAGNÓSTICO]:**\n${notaForm.diagnosticos || 'Pendiente.'}`,
      `**[ANÁLISIS]:**\n${notaForm.analisis || 'Pendiente.'}`,
      `**[PLAN]:**\n${notaForm.plan_tratamiento || 'Pendiente.'}`,
      ...(notaForm.pronostico.trim() ? [`**[PRONÓSTICO]:**\n${notaForm.pronostico}`] : []),
    ]
    await addDocument({
      id: generateUUID(),
      temp_patient_id: notaPatientId,
      tipo: 'nota_medica',
      contenido: {
        texto: partes.join('\n\n'),
        ...notaForm,
        fecha: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      medico_id: identity?.userId ?? 'anonymous',
      _syncStatus: 'pending',
    })
    setNotaForm({ motivo_consulta: '', exploracion_fisica: '', gabinete_laboratorios: '', diagnosticos: '', analisis: '', plan_tratamiento: '', pronostico: '' })
    setNotaSuccess(true); setTimeout(() => setNotaSuccess(false), 2000)
    setNotaSaving(false); refreshData()
  }

  // ── Sync (con confirmación de matches) ──
  async function handleSync(decisions?: Map<string, 'link' | 'create'>) {
    if (!isOnline) return
    setSyncing(true)
    setSyncSummary(null)
    try {
      const { syncOfflineVault } = await import('@/lib/offline/sync')
      const result = await syncOfflineVault(identity?.userId, decisions)

      // Si hay matches pendientes de decisión → mostrar UI de confirmación
      if (result.pendingMatches.length > 0) {
        setPendingMatches(result.pendingMatches)
        setMatchDecisions(new Map())
        setSyncing(false)
        return
      }

      // Sync completo → mostrar resumen
      setPendingMatches([])
      const parts: string[] = []
      if (result.patients.synced > 0) parts.push(`${result.patients.synced} paciente${result.patients.synced > 1 ? 's' : ''}`)
      if (result.patients.matched > 0) parts.push(`${result.patients.matched} vinculado${result.patients.matched > 1 ? 's' : ''} a existente${result.patients.matched > 1 ? 's' : ''}`)
      if (result.documents.synced > 0) parts.push(`${result.documents.synced} documento${result.documents.synced > 1 ? 's' : ''}`)
      if (result.patients.errors + result.documents.errors > 0) parts.push(`${result.patients.errors + result.documents.errors} error${(result.patients.errors + result.documents.errors) > 1 ? 'es' : ''}`)
      setSyncSummary(parts.length > 0 ? `Sincronizado: ${parts.join(' · ')}` : 'Sin cambios')

      await refreshData()
    } catch (err) { console.error('[OfflineMode] sync:', err) }
    finally { setSyncing(false) }
  }

  function setDecision(tempId: string, decision: 'link' | 'create') {
    setMatchDecisions(prev => {
      const next = new Map(prev)
      next.set(tempId, decision)
      return next
    })
  }

  async function confirmMatches() {
    // Todas las decisiones tomadas → re-ejecutar sync con las decisiones
    await handleSync(matchDecisions)
  }

  // ── Volver al sistema ──
  function handleLeaveClick() {
    if (!navigator.onLine) {
      // Sin red → no se puede salir
      return
    }
    if (totalPending > 0) {
      // Hay datos pendientes → Modal 2: preguntar si sincronizar
      setShowLeaveModal(true)
    } else {
      // Sin pendientes → salir directo
      window.location.href = '/inicio'
    }
  }

  async function handleLeaveSync() {
    setLeaveSyncing(true)
    try {
      await handleSync()
      // Si handleSync dejó pendingMatches, el modal de matches aparecerá
      // y el leaveModal se cierra para no estorbar
      setShowLeaveModal(false)
    } catch {
      // Error en sync — dejar que el usuario decida
    }
    setLeaveSyncing(false)
  }

  const selectedPatient = patients.find(p => p.id === docPatientId)
  const nombrePacienteDoc = selectedPatient ? `${selectedPatient.nombre} ${selectedPatient.apellidos}` : ''

  const inputCls = 'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

  // ── No identity ──
  if (identity === null) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Sesión no detectada</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Inicia sesión al menos una vez con conexión para usar el modo offline.
        </p>
        <a href="/login" className="inline-block text-sm font-medium text-amber-600 hover:text-amber-700 underline">
          Ir a iniciar sesión
        </a>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Perfil no disponible</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Abre cualquier formulario de documentos estando online para que tu perfil se sincronice automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Aviso de Private Browsing */}
      {privateBrowsing && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Navegación privada detectada</p>
            <p className="text-xs text-red-600 mt-1 leading-relaxed">
              Estás usando modo privado o incógnito. Los datos capturados offline pueden perderse al cerrar esta ventana. Para garantizar la persistencia, usa una ventana normal del navegador.
            </p>
          </div>
        </div>
      )}

      {/* Banner de estado */}
      <div className={`rounded-2xl p-4 flex items-center justify-between ${isOnline ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center gap-3">
          {isOnline ? <Wifi size={20} className="text-emerald-600" /> : <WifiOff size={20} className="text-amber-600" />}
          <div>
            <p className={`text-sm font-semibold ${isOnline ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isOnline ? 'Conexión detectada' : 'Sin conexión'}
            </p>
            <p className="text-xs text-slate-500">
              {totalPending > 0 ? `${totalPending} pendiente${totalPending > 1 ? 's' : ''}` : 'Sin pendientes'}
              {' · '}{profile.nombre}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOnline && totalPending > 0 && (
            <button onClick={() => handleSync()} disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
          <button
            onClick={handleLeaveClick}
            disabled={!isOnline && totalPending > 0}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {!isOnline ? 'Sin conexión' : 'Volver al sistema'}
          </button>
        </div>
      </div>

      {/* Resumen de sync */}
      {syncSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-emerald-700 font-medium">{syncSummary}</p>
          <button onClick={() => setSyncSummary(null)} className="text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
        </div>
      )}

      {/* Confirmación de matches — pacientes encontrados en el sistema */}
      {pendingMatches.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Pacientes encontrados en el sistema</h2>
          </div>
          <p className="text-xs text-slate-500">
            Los siguientes pacientes creados offline ya existen en Spinus. Confirma si deseas vincular los documentos al expediente existente o crear un paciente nuevo.
          </p>
          <div className="space-y-3">
            {pendingMatches.map(match => {
              const decision = matchDecisions.get(match.tempId)
              return (
                <div key={match.tempId} className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {match.tempNombre} {match.tempApellidos}
                    </p>
                    <p className="text-xs text-slate-400">
                      Fecha de nacimiento: {match.tempFechaNac}
                      {match.existingNumeroExpediente && ` · Expediente existente: #${match.existingNumeroExpediente}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDecision(match.tempId, 'link')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${
                        decision === 'link'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-200 text-slate-500 hover:border-emerald-300'
                      }`}
                    >
                      ✓ Es el mismo paciente
                    </button>
                    <button
                      onClick={() => setDecision(match.tempId, 'create')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${
                        decision === 'create'
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-200 text-slate-500 hover:border-blue-300'
                      }`}
                    >
                      ✗ Crear como nuevo
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            onClick={confirmMatches}
            disabled={matchDecisions.size < pendingMatches.length || syncing}
            className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? 'Procesando...' : `Confirmar y sincronizar (${matchDecisions.size}/${pendingMatches.length})`}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {([
          { key: 'paciente' as Tab, label: 'Paciente', icon: UserPlus },
          { key: 'nota' as Tab, label: 'Nota', icon: FileText },
          { key: 'documentos' as Tab, label: 'Documentos', icon: Pill },
          { key: 'cola' as Tab, label: `Cola (${totalPending})`, icon: RefreshCw },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Nuevo Paciente ── */}
      {tab === 'paciente' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">Registro de paciente</h2>
          {pSuccess && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-xs text-emerald-700 font-medium"><CheckCircle2 size={14} /> Guardado en búnker</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nombre(s) *</label><input value={pNombre} onChange={e => setPNombre(e.target.value)} placeholder="Juan Carlos" className={inputCls} /></div>
            <div><label className={labelCls}>Apellidos *</label><input value={pApellidos} onChange={e => setPApellidos(e.target.value)} placeholder="García López" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de nacimiento *</label>
              <input type="date" value={pFechaNac} onChange={e => setPFechaNac(e.target.value)} min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className={inputCls} />
              {pFechaNac && <p className="text-[11px] text-amber-600 mt-1 font-medium">{calcularEdad(pFechaNac).textoElegante}</p>}
            </div>
            <div><label className={labelCls}>Sexo</label>
              <select value={pSexo} onChange={e => setPSexo(e.target.value as 'M' | 'F' | '')} className={inputCls}>
                <option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Teléfono</label><input type="tel" value={pTelefono} onChange={e => setPTelefono(e.target.value)} placeholder="Opcional" className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="Opcional" className={inputCls} /></div>
          </div>
          <button onClick={handleSavePatient} disabled={pSaving || !pNombre.trim() || !pApellidos.trim() || !pFechaNac}
            className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {pSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {pSaving ? 'Guardando...' : 'Guardar en búnker'}
          </button>
        </div>
      )}

      {/* ── Tab: Nota médica manual — mismos campos que modo online ── */}
      {tab === 'nota' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">Nota médica manual</h2>
          <p className="text-xs text-slate-400">Se sincronizará como nota clínica cuando haya red.</p>
          {notaSuccess && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-xs text-emerald-700 font-medium"><CheckCircle2 size={14} /> Nota guardada en búnker</div>}
          {patients.length === 0 ? (
            <div className="text-center py-6 text-slate-400"><UserPlus size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">Primero registra un paciente</p></div>
          ) : (
            <>
              <div><label className={labelCls}>Paciente *</label>
                <select value={notaPatientId} onChange={e => setNotaPatientId(e.target.value)} className={inputCls}>
                  <option value="">— Seleccionar —</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Motivo de consulta / Subjetivo <span className="text-red-400">*</span></label>
                <textarea value={notaForm.motivo_consulta} onChange={e => updateNota('motivo_consulta', e.target.value)}
                  rows={3} placeholder="Paciente refiere cuadro de 3 días de evolución con dolor en región lumbar..."
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Exploración física / Objetivo</label>
                <textarea value={notaForm.exploracion_fisica} onChange={e => updateNota('exploracion_fisica', e.target.value)}
                  rows={3} placeholder="TA 120/80 mmHg, FC 72 lpm. Paciente consciente, orientado..."
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Auxiliares diagnósticos <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea value={notaForm.gabinete_laboratorios} onChange={e => updateNota('gabinete_laboratorios', e.target.value)}
                  rows={2} placeholder="RMN columna lumbar: hernia discal L4-L5..."
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Diagnóstico(s) <span className="text-red-400">*</span></label>
                <textarea value={notaForm.diagnosticos} onChange={e => updateNota('diagnosticos', e.target.value)}
                  rows={2} placeholder="M51.1 - Hernia discal lumbar (nivel L4-L5 derecha)"
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Análisis clínico <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea value={notaForm.analisis} onChange={e => updateNota('analisis', e.target.value)}
                  rows={2} placeholder="Correlación clínico-radiológica consistente con..."
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Plan de tratamiento <span className="text-red-400">*</span></label>
                <textarea value={notaForm.plan_tratamiento} onChange={e => updateNota('plan_tratamiento', e.target.value)}
                  rows={3} placeholder="Reposo relativo. Fisioterapia 2x/semana. Control en 4 semanas..."
                  className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className={labelCls}>Pronóstico <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea value={notaForm.pronostico} onChange={e => updateNota('pronostico', e.target.value)}
                  rows={2} placeholder="Reservado para la función..."
                  className={inputCls + ' resize-y'} />
              </div>
              <button onClick={handleSaveNote} disabled={notaSaving || !notaPatientId || !notaTieneContenido}
                className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {notaSaving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {notaSaving ? 'Guardando...' : 'Guardar nota en búnker'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Documentos (8 formularios reales) ── */}
      {tab === 'documentos' && (
        <div className="space-y-4">
          {patients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              <UserPlus size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Primero registra un paciente para crear documentos</p>
            </div>
          ) : !docType ? (
            <>
              {/* Selector de paciente */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <label className={labelCls}>Paciente para el documento</label>
                <select value={docPatientId} onChange={e => setDocPatientId(e.target.value)} className={inputCls}>
                  <option value="">— Seleccionar paciente —</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                </select>
              </div>
              {/* Grid de tipos */}
              {docPatientId && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DOC_TYPES.map(dt => {
                    const Icon = dt.icon
                    return (
                      <button key={dt.key} onClick={() => setDocType(dt.key)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${dt.color}`}>
                        <Icon size={24} />
                        <span className="text-xs font-semibold text-center">{dt.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Header con back + selector de otro tipo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setDocType(null)}
                    className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800 font-medium transition-colors">
                    ← Cambiar documento
                  </button>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-sm text-slate-500">{nombrePacienteDoc}</span>
                </div>
                <div className="flex gap-1">
                  {DOC_TYPES.map(dt => {
                    const Icon = dt.icon
                    const isActive = dt.key === docType
                    return (
                      <button key={dt.key} onClick={() => setDocType(dt.key)} title={dt.label}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isActive ? dt.color + ' ring-1 ring-current/20 shadow-sm' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}>
                        <Icon size={14} />
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Formulario real */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                {docType === 'receta' && <RecetaForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'lab' && <SolicitudLabForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'imagen' && <SolicitudImagenForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'honorarios' && <NotaHonorariosForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'escrito' && <EscritoMedicoForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'consentimiento' && <ConsentimientoForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
                {docType === 'internamiento' && <InternamientoForm pacienteInicial={nombrePacienteDoc} pacienteId={docPatientId} offlineMode onOfflineSave={() => { refreshData(); setDocType(null) }} />}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Cola ── */}
      {tab === 'cola' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Pacientes ({patients.length})</h3>
            </div>
            {patients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin pacientes en el búnker</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {patients.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.nombre} {p.apellidos}</p>
                      <p className="text-xs text-slate-400">{p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).textoElegante : ''}{p.sexo ? ` · ${p.sexo === 'M' ? 'M' : 'F'}` : ''}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[p._syncStatus].cls}`}>{STATUS_BADGE[p._syncStatus].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Documentos ({documents.length})</h3>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin documentos en el búnker</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map(d => {
                  const pat = patients.find(p => p.id === d.temp_patient_id)
                  return (
                    <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800 capitalize">{d.tipo.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-400">{pat ? `${pat.nombre} ${pat.apellidos}` : '—'}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[d._syncStatus].cls}`}>{STATUS_BADGE[d._syncStatus].label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {(patients.length > 0 || documents.length > 0) && (
            <div className="flex gap-2">
              {stats.patients.synced + stats.documents.synced > 0 && (
                <button onClick={async () => { await clearSyncedRecords(); refreshData() }}
                  className="flex-1 py-2.5 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} /> Limpiar sincronizados
                </button>
              )}
              <button onClick={async () => { await clearAllVault(); refreshData() }}
                className="flex-1 py-2.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={13} /> Vaciar búnker
              </button>
            </div>
          )}
        </div>
      )}
      {/* ── Modal 1: Reconexión espontánea ── */}
      {showReconnectModal && totalPending > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[modalEnter_0.22s_cubic-bezier(0.32,0.72,0,1)]">
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Wifi size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Red disponible</h2>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                Se detectó conexión a internet. Tienes {totalPending} registro{totalPending > 1 ? 's' : ''} pendiente{totalPending > 1 ? 's' : ''} de sincronizar.
              </p>
            </div>
            <div className="px-6 pb-6 space-y-2">
              <button
                onClick={() => { setShowReconnectModal(false); handleSync() }}
                disabled={syncing}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Sincronizar ahora
              </button>
              <button
                onClick={() => setShowReconnectModal(false)}
                className="w-full py-3 text-slate-500 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Seguir trabajando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Salir con pendientes ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[modalEnter_0.22s_cubic-bezier(0.32,0.72,0,1)]">
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <RefreshCw size={28} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Red disponible</h2>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                Tienes {totalPending} registro{totalPending > 1 ? 's' : ''} sin sincronizar. ¿Deseas sincronizar antes de salir?
              </p>
            </div>
            <div className="px-6 pb-6 space-y-2">
              <button
                onClick={handleLeaveSync}
                disabled={leaveSyncing}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {leaveSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {leaveSyncing ? 'Sincronizando...' : 'Sincronizar y salir'}
              </button>
              <button
                onClick={() => { setShowLeaveModal(false); window.location.href = '/inicio' }}
                className="w-full py-3 text-slate-500 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Salir sin sincronizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
