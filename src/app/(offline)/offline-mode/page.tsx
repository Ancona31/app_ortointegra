'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, FileText, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Loader2, WifiOff, Wifi } from 'lucide-react'
import { getOfflineIdentity } from '@/lib/offline/identity'
import {
  addPatient, addDocument, getAllPatients, getAllDocuments,
  getVaultStats, clearSyncedRecords, clearAllVault,
} from '@/lib/offline/db'
import { toTitleCase, calcularEdad, fechaHoyISO, FECHA_MIN_NACIMIENTO } from '@/lib/patientUtils'
import type { OfflineIdentity, TempPatient, TempDocument, SyncStatus } from '@/lib/offline/types'

type Tab = 'captura' | 'cola'
type FormMode = 'paciente' | 'documento'

const STATUS_BADGE: Record<SyncStatus, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  synced: { label: 'Sincronizado', cls: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
}

export default function OfflineModePage() {
  const [identity, setIdentity] = useState<OfflineIdentity | null>(null)
  const [tab, setTab] = useState<Tab>('captura')
  const [formMode, setFormMode] = useState<FormMode>('paciente')
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

  // Document form
  const [dPatientId, setDPatientId] = useState('')
  const [dTipo, setDTipo] = useState<'nota_medica' | 'receta' | 'solicitud_lab' | 'solicitud_imagen'>('nota_medica')
  const [dContenido, setDContenido] = useState('')
  const [dSaving, setDSaving] = useState(false)
  const [dSuccess, setDSuccess] = useState(false)

  // Queue
  const [patients, setPatients] = useState<TempPatient[]>([])
  const [documents, setDocuments] = useState<TempDocument[]>([])
  const [syncing, setSyncing] = useState(false)

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
    const id = getOfflineIdentity()
    setIdentity(id)
    setIsOnline(navigator.onLine)

    const onlineHandler = () => setIsOnline(true)
    const offlineHandler = () => setIsOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  useEffect(() => { refreshData() }, [refreshData])

  const totalPending = stats.patients.pending + stats.documents.pending

  // ── Save patient ──
  async function handleSavePatient() {
    if (!pNombre.trim() || !pApellidos.trim() || !pFechaNac) return
    setPSaving(true)
    const patient: TempPatient = {
      id: crypto.randomUUID(),
      nombre: toTitleCase(pNombre),
      apellidos: toTitleCase(pApellidos),
      fecha_nacimiento: pFechaNac,
      sexo: pSexo === '' ? null : pSexo,
      telefono: pTelefono.trim() || null,
      email: pEmail.trim() || null,
      created_at: new Date().toISOString(),
      medico_id: identity?.userId ?? 'anonymous',
      _syncStatus: 'pending',
    }
    await addPatient(patient)
    setPNombre(''); setPApellidos(''); setPFechaNac(''); setPSexo(''); setPTelefono(''); setPEmail('')
    setPSuccess(true)
    setTimeout(() => setPSuccess(false), 2000)
    setPSaving(false)
    refreshData()
  }

  // ── Save document ──
  async function handleSaveDocument() {
    if (!dPatientId || !dContenido.trim()) return
    setDSaving(true)
    const doc: TempDocument = {
      id: crypto.randomUUID(),
      temp_patient_id: dPatientId,
      tipo: dTipo,
      contenido: { texto: dContenido, fecha: new Date().toISOString() },
      created_at: new Date().toISOString(),
      medico_id: identity?.userId ?? 'anonymous',
      _syncStatus: 'pending',
    }
    await addDocument(doc)
    setDContenido('')
    setDSuccess(true)
    setTimeout(() => setDSuccess(false), 2000)
    setDSaving(false)
    refreshData()
  }

  // ── Sync ──
  async function handleSync() {
    if (!isOnline) return
    setSyncing(true)
    try {
      const { syncOfflineVault } = await import('@/lib/offline/sync')
      await syncOfflineVault(identity?.userId)
      await refreshData()
    } catch (err) {
      console.error('[OfflineMode] sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1'

  // ── No identity warning ──
  if (identity === null) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto flex items-center justify-center">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Sesión no detectada</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Para usar el modo offline, necesitas haber iniciado sesión al menos una vez con conexión a internet.
          Tus datos se identificarán con tu cuenta de Spinus.
        </p>
        <a href="/login" className="inline-block text-sm font-medium text-amber-600 hover:text-amber-700 underline">
          Ir a iniciar sesión
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Banner de estado */}
      <div className={`rounded-2xl p-4 flex items-center justify-between ${isOnline ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center gap-3">
          {isOnline ? <Wifi size={20} className="text-emerald-600" /> : <WifiOff size={20} className="text-amber-600" />}
          <div>
            <p className={`text-sm font-semibold ${isOnline ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isOnline ? 'Conexión detectada' : 'Sin conexión'}
            </p>
            <p className="text-xs text-slate-500">
              {totalPending > 0
                ? `${totalPending} registro${totalPending > 1 ? 's' : ''} pendiente${totalPending > 1 ? 's' : ''} de sincronizar`
                : 'Sin registros pendientes'}
              {' · '}{identity.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && totalPending > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
          {stats.patients.synced + stats.documents.synced > 0 && (
            <button
              onClick={async () => { await clearSyncedRecords(); refreshData() }}
              className="text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 transition-colors"
              title="Limpiar registros sincronizados"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab('captura')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'captura' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Capturar datos
        </button>
        <button
          onClick={() => setTab('cola')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'cola' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Cola ({totalPending})
        </button>
      </div>

      {/* Tab: Captura */}
      {tab === 'captura' && (
        <div className="space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setFormMode('paciente')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${formMode === 'paciente' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-500 hover:border-amber-300'}`}>
              <UserPlus size={16} /> Nuevo Paciente
            </button>
            <button onClick={() => setFormMode('documento')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${formMode === 'documento' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-500 hover:border-amber-300'}`}>
              <FileText size={16} /> Nota / Documento
            </button>
          </div>

          {/* Patient form */}
          {formMode === 'paciente' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm">Registro de paciente offline</h2>

              {pSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-xs text-emerald-700 font-medium">
                  <CheckCircle2 size={14} /> Paciente guardado en el búnker
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre(s) <span className="text-red-400">*</span></label>
                  <input value={pNombre} onChange={e => setPNombre(e.target.value)} placeholder="Juan Carlos" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Apellidos <span className="text-red-400">*</span></label>
                  <input value={pApellidos} onChange={e => setPApellidos(e.target.value)} placeholder="García López" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha de nacimiento <span className="text-red-400">*</span></label>
                  <input type="date" value={pFechaNac} onChange={e => setPFechaNac(e.target.value)} min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className={inputCls} />
                  {pFechaNac && <p className="text-[11px] text-amber-600 mt-1 font-medium">{calcularEdad(pFechaNac).textoElegante}</p>}
                </div>
                <div>
                  <label className={labelCls}>Sexo</label>
                  <select value={pSexo} onChange={e => setPSexo(e.target.value as 'M' | 'F' | '')} className={inputCls}>
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input type="tel" value={pTelefono} onChange={e => setPTelefono(e.target.value)} placeholder="Opcional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="Opcional" className={inputCls} />
                </div>
              </div>
              <button
                onClick={handleSavePatient}
                disabled={pSaving || !pNombre.trim() || !pApellidos.trim() || !pFechaNac}
                className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {pSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {pSaving ? 'Guardando...' : 'Guardar en búnker'}
              </button>
            </div>
          )}

          {/* Document form */}
          {formMode === 'documento' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm">Nota / Documento offline</h2>

              {dSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-xs text-emerald-700 font-medium">
                  <CheckCircle2 size={14} /> Documento guardado en el búnker
                </div>
              )}

              {patients.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <UserPlus size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Primero registra un paciente para crear documentos</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Paciente <span className="text-red-400">*</span></label>
                    <select value={dPatientId} onChange={e => setDPatientId(e.target.value)} className={inputCls}>
                      <option value="">— Seleccionar paciente —</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de documento</label>
                    <select value={dTipo} onChange={e => setDTipo(e.target.value as typeof dTipo)} className={inputCls}>
                      <option value="nota_medica">Nota médica</option>
                      <option value="receta">Receta</option>
                      <option value="solicitud_lab">Solicitud de laboratorio</option>
                      <option value="solicitud_imagen">Solicitud de imagen</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Contenido <span className="text-red-400">*</span></label>
                    <textarea value={dContenido} onChange={e => setDContenido(e.target.value)}
                      rows={6} placeholder="Escribe el contenido de la nota, receta o solicitud..."
                      className={inputCls + ' resize-y'} />
                  </div>
                  <button
                    onClick={handleSaveDocument}
                    disabled={dSaving || !dPatientId || !dContenido.trim()}
                    className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {dSaving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {dSaving ? 'Guardando...' : 'Guardar en búnker'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Cola */}
      {tab === 'cola' && (
        <div className="space-y-4">
          {/* Pacientes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
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
                      <p className="text-xs text-slate-400">
                        {p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).textoElegante : ''}
                        {p.sexo ? ` · ${p.sexo === 'M' ? 'Masculino' : 'Femenino'}` : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[p._syncStatus].cls}`}>
                      {STATUS_BADGE[p._syncStatus].label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documentos */}
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
                        <p className="text-xs text-slate-400">
                          {pat ? `${pat.nombre} ${pat.apellidos}` : 'Paciente no encontrado'}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[d._syncStatus].cls}`}>
                        {STATUS_BADGE[d._syncStatus].label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Clear vault */}
          {(patients.length > 0 || documents.length > 0) && (
            <button
              onClick={async () => { await clearAllVault(); refreshData() }}
              className="w-full py-2.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              Vaciar búnker completo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
