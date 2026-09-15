'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, LifeBuoy, Loader2 } from 'lucide-react'
import { mutate } from 'swr'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'
import FirmaCaptura from '@/components/perfil/FirmaCaptura'
import ModalShell from '@/components/ui/ModalShell'
import { useToast } from '@/components/ui/Toast'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { canManageClinica } from '@/lib/permissions'
import { validarCedula, validarTelefono, formatearTelefono } from '@/lib/validaciones'
import { CLAVE_CONFIG } from '@/lib/configApp'
import { LOGO_ACCEPT, revisarLogo } from '@/lib/perfil/logoArchivo'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'
import type { EstadoPerfil } from '@/lib/perfil/gate'
import type { Consultorio } from '@/types'
import { clearProfileCache, type Role } from '@/hooks/useProfile'

/**
 * El gate de perfil — Bloque B5, tercera parte.
 *
 * ⚠️ ESTE MODAL ES BLOQUEANTE: sin ✕, sin Escape útil, sin omitir en los pasos
 * obligatorios. Quien lo monta debe hacerlo SOLO ante una LECTURA AFIRMATIVA
 * del gate, nunca por ausencia de evidencia — la distinción que `PrimerConsultorioModal`
 * aprendió a golpes antes de que este gate lo sustituyera (retirado en la cuarta
 * parte; el porqué, en `GateOnboarding.tsx`): «todavía no sé» y «sé que falta»
 * no son lo mismo, y un modal que escribe y encierra no puede confundirlos.
 * Un `fetch` de `/api/me/estado-perfil` que falla NO abre esto.
 *
 * Los pasos SALEN DEL GATE (`evaluarPerfil`, src/lib/perfil/gate.ts), no de una
 * lista fija: el invitado no ve el de clínica porque no puede crear ninguna, y
 * un médico dado de alta con el formulario viejo puede llegar a necesitar solo
 * el consultorio. Logo y firma no los exige el criterio: son omitibles y solo
 * se enseñan a quien no los tiene.
 *
 * El paso de CLÍNICA tiene DOS CARAS, y la que se enseña la decide
 * `gate.requiereSoporte` (o sea: si el médico es dueño o invitado).
 *   · DUEÑO → formulario. Desde que el registro se recortó a correo y
 *     contraseña, todo médico nuevo llega sin clínica y la crea aquí, con
 *     `POST /api/me/clinica`.
 *   · INVITADO → panel de soporte, sin formulario y sin «Continuar». No puede
 *     crear ninguna: ya pertenecía a una y se la borraron
 *     (`profiles_clinica_id_fkey` es ON DELETE SET NULL). Darle un formulario
 *     sería darle algo que tiene prohibido usar.
 */

type Paso = 'datos' | 'cedulas' | 'clinica' | 'consultorio' | 'logo' | 'firma'

const ETIQUETAS: Record<Paso, string> = {
  datos: 'Datos',
  cedulas: 'Cédulas',
  clinica: 'Clínica',
  consultorio: 'Consultorio',
  logo: 'Logo',
  firma: 'Firma',
}

/** Los únicos que llevan «Omitir por ahora». El resto los exige el criterio. */
const OMITIBLES: readonly Paso[] = ['logo', 'firma']

/** Solo los dos del ejercicio clínico. Spinus es para médicos: Mtro./Lic./Ing.
 *  sobran en el encabezado de una receta. */
const TITULOS = ['Dr.', 'Dra.']

/** Separador de especialidades. El MISMO que el registro, Mi Perfil y el alta
 *  de admin (`' · '`): con `', '` la segunda especialidad se perdía al abrir
 *  Mi Perfil, que parte por `' · '` y se encontraba una sola cadena. */
const SEP_ESPECIALIDAD = ' · '

interface Props {
  onComplete: () => void
  /** Lectura afirmativa del criterio único. Decide qué pasos hay. */
  gate: EstadoPerfil
  role: string
  esAdminDeClinica: boolean
  tieneFirma: boolean
  tieneLogo: boolean
}

function pasosPendientes(
  gate: EstadoPerfil, seraDueno: boolean, tieneLogo: boolean, tieneFirma: boolean,
): Paso[] {
  const pasos: Paso[] = []
  /* `datos_medico` monta los DOS pasos de perfil aunque falte un solo campo:
     el título es obligatorio desde este bloque y el gate no lo mira, así que
     afinar más aquí dejaría fuera a quien solo le falta eso. */
  if (gate.pendientes.includes('datos_medico')) pasos.push('datos', 'cedulas')
  if (gate.pendientes.includes('clinica')) pasos.push('clinica')
  if (gate.pendientes.includes('consultorio')) pasos.push('consultorio')
  if (seraDueno && !tieneLogo) pasos.push('logo')
  if (!tieneFirma) pasos.push('firma')
  return pasos
}

export default function OnboardingModal({
  onComplete, gate, role, esAdminDeClinica, tieneFirma, tieneLogo,
}: Props) {
  const toast = useToast()
  const { state } = useSubscriptionGate()
  /* ⚠️ ESTO NO ES «ES DUEÑO», ES «VA A SERLO», Y LA DIFERENCIA ES EL DEFECTO
     ENTERO. `pasos` se congela abajo en un `useState` con inicializador, y
     `esAdminDeClinica` llega leído ANTES de que este mismo modal cree la
     clínica: el médico que entra por Google trae el flag en `false` —el
     trigger de B5.6 no lo escribe, y hace bien: escribir `true` convertiría a
     cada invitado en dueño de la clínica ajena— y lo pone en `true`
     `POST /api/me/clinica` tres pasos más tarde. Preguntando por el presente,
     el paso del logo no se añadía nunca y el de Google recorría CINCO pasos
     donde el de correo recorre SEIS.

     `creaClinicaAqui` es la predicción, y es segura porque coincide
     exactamente con la cara del paso de clínica que SÍ tiene formulario
     (`esPanelSoporte` más abajo, y el bloque de render sin `requiereSoporte`):
     si el gate pide clínica y no manda a soporte, el médico verá el
     formulario, y si el POST falla `avanzar()` no le deja pasar, así que nunca
     llega al paso del logo sin ser ya dueño.
     El invitado sin clínica (`requiereSoporte`) queda fuera, que es lo
     correcto: no puede crear ninguna. La secretaria y el super_admin tampoco
     entran — están exentos y con el gate completo este modal ni se monta.

     ⚠️ NO LO CONVIERTAS EN REACTIVO (`useMemo` sobre `clinicaCreada`). Haría
     crecer la lista de 5 a 6 a mitad del recorrido, con el stepper contando
     «3 de 5» y luego «4 de 6», y a cambio de nada: el resultado es el mismo
     porque el único paso que puede cambiar el flag va SIEMPRE antes del logo. */
  const creaClinicaAqui = gate.pendientes.includes('clinica') && !gate.requiereSoporte
  const seraDueno =
    canManageClinica({ role: role as Role, es_admin_de_clinica: esAdminDeClinica }) || creaClinicaAqui

  const [pasos] = useState<Paso[]>(() => pasosPendientes(gate, seraDueno, tieneLogo, tieneFirma))
  const [indice, setIndice] = useState(0)
  const [guardando, setGuardando] = useState(false)

  // Paso 1: datos personales
  const [titulo, setTitulo] = useState('')
  const [nombres, setNombres] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [especialidades, setEspecialidades] = useState<string[]>([''])
  const [universidad, setUniversidad] = useState('')

  // Paso 2: cédulas
  const [cedulaProfesional, setCedulaProfesional] = useState('')
  const [cedulaEspecialidad, setCedulaEspecialidad] = useState('')
  const [errorCedula, setErrorCedula] = useState('')

  /* Paso clínica (solo el dueño). `clinicaCreada` juega el mismo papel que
     `consultorioCreado`: el POST no es idempotente, así que retroceder y
     avanzar otra vez crearía una segunda clínica — y la ruta, que solo admite
     la PRIMERA, respondería 409. */
  const [nombreClinica, setNombreClinica] = useState('')
  const [clinicaCreada, setClinicaCreada] = useState(false)

  // Paso consultorio (tabla `consultorios`, no las columnas viejas de profiles)
  const [nombreCons, setNombreCons] = useState('')
  const [nombreCorto, setNombreCorto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [timezone, setTimezone] = useState('')
  const [errorTelefono, setErrorTelefono] = useState('')

  /* ⚠️ EL PASO ATRÁS OBLIGA A RECORDAR LO QUE YA SE ESCRIBIÓ, y no todas las
     escrituras cuestan lo mismo si se repiten:
     · `/api/me/perfil-medico` es un PUT parcial — reescribir los mismos valores
       es inofensivo, así que datos y cédulas se pueden volver a guardar.
     · `POST /api/consultorios` NO es idempotente: volver a este paso y avanzar
       otra vez creaba un SEGUNDO consultorio. Por eso se guarda el id del que
       se creó y el paso pasa a enseñar su confirmación en vez del formulario.
       Editarlo es cosa de Mi Perfil → Mis consultorios, que es donde vive el
       PATCH; meter aquí un segundo camino de escritura sería peor. */
  const [consultorioCreado, setConsultorioCreado] = useState<string | null>(null)

  // Paso logo (solo dueño) y paso firma
  const [logoFile, setLogoFile] = useState<File | null>(null)
  /** El archivo que ya subió, por identidad. Evita reenviarlo al volver a pasar. */
  const [logoSubido, setLogoSubido] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)

  const paso = pasos[indice]

  // ── Guardado por paso ───────────────────────────────────────
  async function guardarDatos(): Promise<boolean> {
    if (!titulo) { toast.error('El título es obligatorio'); return false }
    if (!nombres.trim()) { toast.error('El nombre es obligatorio'); return false }
    if (!apellidoPaterno.trim()) { toast.error('El apellido paterno es obligatorio'); return false }
    const especialidad = especialidades.map(e => e.trim()).filter(Boolean).join(SEP_ESPECIALIDAD)
    if (!especialidad) { toast.error('La especialidad es obligatoria'); return false }

    return guardarPerfil({
      titulo,
      nombres: nombres.trim(),
      apellido_paterno: apellidoPaterno.trim(),
      apellido_materno: apellidoMaterno.trim() || null,
      especialidad,
      universidad: universidad.trim() || undefined,
    })
  }

  async function guardarCedulas(): Promise<boolean> {
    /* La cédula de ESPECIALIDAD dejó de ser obligatoria: un médico general no
       la tiene, y exigirla aquí —con el modal ya bloqueante— lo dejaba fuera
       de la app para siempre. El criterio único tampoco la pide. */
    if (!cedulaProfesional.trim()) { toast.error('La cédula profesional es obligatoria'); return false }
    const errPro = validarCedula(cedulaProfesional)
    const errEsp = cedulaEspecialidad.trim() ? validarCedula(cedulaEspecialidad) : null
    if (errPro || errEsp) { setErrorCedula(errPro || errEsp || ''); return false }
    setErrorCedula('')

    return guardarPerfil({
      cedula_profesional: cedulaProfesional.trim(),
      cedula_especialidad: cedulaEspecialidad.trim() || null,
    })
  }

  async function guardarPerfil(body: Record<string, unknown>): Promise<boolean> {
    setGuardando(true)
    try {
      const res = await fetch('/api/me/perfil-medico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('Error al guardar. Intenta de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  async function crearClinica(): Promise<boolean> {
    if (clinicaCreada) return true
    if (!nombreClinica.trim()) { toast.error('El nombre de la clínica es obligatorio'); return false }

    setGuardando(true)
    try {
      const res = await fetch('/api/me/clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreClinica.trim() }),
      })
      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        toast.error(datos.error ?? 'No se pudo crear la clínica. Inténtalo de nuevo.')
        return false
      }
      setClinicaCreada(true)
      /* ⚠️ ESTA LÍNEA NO ES PARA ESTE MODAL, ES PARA EL RESTO DE LA SESIÓN.
         El POST acaba de cambiar DOS columnas que `useProfile` tiene cacheadas
         y no vuelve a leer nunca —memoiza el perfil en una promesa a nivel de
         módulo (`useProfile.ts:37,59`) más una copia en `secureStorage`—:
         `clinica_id` y `es_admin_de_clinica`. Sin invalidar, `/billing` y
         `/admin/usuarios` —que comprueban `canManageClinica(profile)` al
         montarse y rebotan a `/dashboard` (`billing/page.tsx:54`,
         `admin/usuarios/page.tsx:41`)— expulsan al dueño recién estrenado de
         sus propias pantallas, y `billing` ni siquiera cargaría datos porque
         ve `clinica_id` nulo.

         ⚠️ ESTE DEFECTO NO NACIÓ CON B6 NI ES DE GOOGLE: afecta a LOS DOS
         caminos de alta y lleva vivo desde que el registro se recortó a correo
         y contraseña. Desde entonces ningún médico llega con clínica —el único
         INSERT en `clinicas` que hacía el registro se retiró—, así que todos
         la crean aquí y todos se quedan con el perfil cacheado en falso. Lo
         que B6 añadió fue el segundo síntoma, el del flag de dueño; el de
         `clinica_id` ya estaba.

         ⚠️ NO BASTA PARA EL SIDEBAR y no es un olvido: está montado en el
         layout de (app), así que su `useState` ya tiene el perfil viejo y
         vaciar la caché no lo repinta. Ése se arregla por su lado, leyendo la
         clave de SWR viva (`Sidebar.tsx`, junto a su `isAdmin`).

         ⚠️ RIESGO ASUMIDO, ANOTADO PARA QUIEN LO RETOME: `clearProfileCache`
         borra TAMBIÉN la copia cifrada, así que si la red se cae justo entre
         este POST y la siguiente lectura de perfil, `fetchProfile()` cae a la
         rama offline, no encuentra copia y memoiza `null` hasta recargar. La
         ventana es estrecha —el POST acaba de funcionar y el paso siguiente
         necesita red igual— y por eso se acepta. Si algún día hay que
         cerrarla, la alternativa es invalidar SOLO la promesa de módulo y
         conservar la copia cifrada; cuesta una función nueva en `useProfile`,
         y por eso no se dio por supuesta aquí. */
      clearProfileCache()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('No se pudo crear la clínica: revisa tu conexión e inténtalo de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  /** Crea el consultorio DE VERDAD, en la tabla `consultorios`. Lo que este
   *  paso escribía antes (`direccion_consultorio`, `telefono_consultorio` en
   *  profiles) son columnas viejas que no crean ninguno, así que el gate
   *  seguía viendo cero y el médico no salía nunca de aquí. */
  async function crearConsultorio(): Promise<boolean> {
    if (consultorioCreado) return true
    if (!nombreCons.trim()) { toast.error('El nombre del consultorio es obligatorio'); return false }
    if (!direccion.trim()) { toast.error('La dirección es obligatoria'); return false }
    if (!timezone) { toast.error('Selecciona la zona horaria'); return false }
    if (requiereNombreCorto && !nombreCorto.trim()) {
      toast.error('El nombre corto es obligatorio cuando el nombre pasa de 12 caracteres')
      return false
    }
    const errTel = validarTelefono(telefono)
    if (errTel) { setErrorTelefono(errTel); return false }
    setErrorTelefono('')

    setGuardando(true)
    try {
      const body: Record<string, unknown> = {
        nombre: nombreCons.trim(),
        direccion: direccion.trim(),
        timezone,
      }
      if (requiereNombreCorto) body.nombre_corto = nombreCorto.trim()
      if (telefono.trim()) body.telefono = telefono.trim()

      const res = await fetch('/api/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Error al crear el consultorio. Intenta de nuevo.')
        return false
      }
      const { consultorio } = await res.json() as { consultorio: Consultorio }
      setConsultorioCreado(consultorio?.id ?? null)
      // El agregado de configuración es la fuente de la lista para toda (app):
      // sin esto el sidebar y la agenda siguen creyendo que no hay ninguno.
      await mutate(CLAVE_CONFIG)
      return Boolean(consultorio)
    } catch {
      toast.error('Error de red. Verifica tu conexión.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  /* ⚠️ EL VEREDICTO SE PIDE AL ELEGIR EL ARCHIVO, NO AL SUBIRLO, y es el MISMO
     que aplicará el servidor (`revisarLogo`, compartido). Antes aquí solo se
     miraba el tamaño, y encima con un tope propio de 2 MB frente a los 500 KB
     de la ruta: el médico elegía un .heic o un logo de 1 MB, veía la vista
     previa, lo daba por bueno y se llevaba el rechazo dos pasos después.
     Nada de esto sustituye a la comprobación del servidor: ésta es comodidad,
     y el POST se puede hacer sin pasar por aquí. */
  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const veredicto = revisarLogo(file)
    if (!veredicto.ok) {
      toast.error(veredicto.error)
      // Sin esto, volver a elegir el MISMO archivo no dispara `change` y la
      // pantalla se queda muda.
      e.target.value = ''
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }, [toast])

  async function subirLogo(): Promise<boolean> {
    if (!logoFile || logoFile === logoSubido) return true
    setGuardando(true)
    try {
      const fd = new FormData()
      fd.append('logo', logoFile)
      const res = await fetch('/api/me/logo', { method: 'POST', body: fd })
      if (!res.ok) {
        /* El aviso lo escribe la RUTA, que es la única que sabe por qué
           rechazó —formato, tamaño, permisos—. Tirarlo y pintar un «Error al
           subir el logo.» dejaba al médico probando a ciegas. El genérico
           queda solo para cuando no venga nada (una caída que no llega a
           responder JSON). */
        const datos = await res.json().catch(() => ({}))
        toast.error(datos.error ?? 'No se pudo subir el logo. Inténtalo de nuevo.')
        return false
      }
      setLogoSubido(logoFile)
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('No se pudo subir el logo: revisa tu conexión e inténtalo de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  // ── Navegación ──────────────────────────────────────────────
  function siguiente() {
    if (indice >= pasos.length - 1) { onComplete(); return }
    setIndice(indice + 1)
  }

  /* ⚠️ ATRÁS NAVEGA, NO CIERRA. El modal sigue sin salida al exterior; lo que
     no puede es ser una calle de un solo sentido: quien se equivoca en el
     nombre y lo nota tres pasos después no tiene más remedio que dejarlo mal o
     cerrar sesión.
     VA EN EL PIE Y LOS CÍRCULOS DEL STEPPER NO SON PULSABLES, por dos razones:
     miden 24 px, muy por debajo del mínimo táctil del sistema (`--sp-tap`,
     44 px); y un stepper pulsable invita también a SALTAR HACIA ADELANTE, que
     aquí es justo lo que no puede pasar — cada paso escribe al avanzar y el
     siguiente puede depender de lo que el anterior dejó en la base (sin
     clínica no hay consultorio que crear). Un solo control, sin ambigüedad.
     El estado vive en este componente y no por paso, así que al volver los
     campos siguen con lo que el médico escribió. */
  function atras() {
    if (indice === 0) return
    setIndice(indice - 1)
  }

  async function avanzar() {
    let ok = true
    if (paso === 'datos') ok = await guardarDatos()
    else if (paso === 'cedulas') ok = await guardarCedulas()
    else if (paso === 'clinica') ok = await crearClinica()
    else if (paso === 'consultorio') ok = await crearConsultorio()
    else if (paso === 'logo') ok = await subirLogo()
    /* ⚠️ ESTA RAMA NO SUBE NADA, Y AHÍ ESTÁ LA DIFERENCIA CON LA DEL LOGO. El
       logo se queda en un `File` hasta que «Continuar» lo manda (`subirLogo`);
       la firma ya la mandó «Aceptar firma» dentro de `FirmaCaptura`, que es
       quien escribe `profiles.firma_url`. Lo que falta aquí no es una
       escritura: es ESPERARLA.
       `firmaUrl` solo se puebla en el callback de un POST ya resuelto
       (FirmaCaptura.tsx:230), así que exigirlo ORDENA las dos peticiones: el
       `mutate` de `onComplete` sale después del update y no antes. Sin esta
       rama, `ok` caía a `true` por omisión y el GET de estado-perfil —dos
       selects— le ganaba al POST —multipart, Storage, update, signed URL—; el
       aviso del sidebar seguía pidiendo una firma ya guardada y no se corregía
       solo, porque (app) no se remonta al navegar y `focusThrottleInterval`
       está en 300 s.
       ⚠️ NO DISTINGUE «subiendo» de «no capturó» de «falló el POST»: el único
       canal que sale de `FirmaCaptura` es `onFirmaCambiada`, así que los tres
       se ven igual desde aquí. Por eso el camino sin firma es «Omitir por
       ahora» y no éste. El `false` no llega a verse: el botón se deshabilita
       con el mismo predicado (`esperandoFirma`, abajo). */
    else if (paso === 'firma') ok = Boolean(firmaUrl)
    if (ok) siguiente()
  }

  /* Si la suscripción bloquea, este modal se calla. La salvaguarda viene de
     `PrimerConsultorioModal`, que la llevaba antes de retirarse: dos modales sin
     salida encima del mismo médico, y el de suscripción tapado por éste, es el
     encierro que el bloque existe para evitar. */
  if (state.isBlocked) return null
  // Defensivo: quien monta esto ya comprobó `!gate.completo`, así que la lista
  // nunca llega vacía. Si llegara, no hay nada que pedir y encerrar por nada
  // sería lo peor posible.
  if (pasos.length === 0) return null

  const requiereNombreCorto = nombreCons.trim().length > 12
  /* El invitado sin clínica: única cara del flujo que no se puede resolver
     desde aquí, así que no lleva «Continuar». */
  const esPanelSoporte = paso === 'clinica' && gate.requiereSoporte
  const esOmitible = OMITIBLES.includes(paso)
  const esUltimo = indice === pasos.length - 1
  /* El mismo predicado que la rama de firma de `avanzar()`, aquí como estado
     del botón. Va sin `guardando`: el paso de firma nunca lo toca —el
     `subiendo` de `FirmaCaptura` es interno y no sale de ahí—, que es
     justamente por lo que «Finalizar» se podía pulsar con el POST en vuelo. */
  const esperandoFirma = paso === 'firma' && !firmaUrl

  return (
    <ModalShell
      open={true}
      onClose={() => { /* bloqueante: no-op intencional */ }}
      hideClose
      title="Configura tu perfil"
      subtitle="Necesario para registrar pacientes y emitir documentos"
      maxWidth="max-w-lg"
      footer={
        /* ⚠️ «CONTINUAR» DESAPARECE EN EL PANEL DE SOPORTE, NO EN EL PASO DE
           CLÍNICA ENTERO. El dueño escribe el nombre y avanza; el invitado no
           tiene salida hacia adelante porque no hay nada que pueda escribir.
           El «Atrás» se pinta en los dos: el paso puede NO ser el primero (el
           gate los pide en orden: datos, clínica, consultorio) y sin pie el
           invitado se quedaba sin poder corregir lo anterior. */
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div>
            {indice > 0 && (
              <button
                onClick={atras}
                disabled={guardando}
                className="sp-btn sp-btn--secondary"
              >
                <ChevronLeft size={15} /> Atrás
              </button>
            )}
          </div>

          {!esPanelSoporte && (
            <div className="flex items-center gap-3">
              {esOmitible ? (
                <button
                  onClick={siguiente}
                  disabled={guardando}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Omitir por ahora
                </button>
              ) : (
                <span className="text-xs text-slate-400">Paso requerido</span>
              )}

              {/* ⚠️ `sp-btn--primary` Y NO UNA ARBITRARIA SOBRE LA VARIABLE DE
                  MARCA, QUE ERA LO QUE TENÍA Y NO SE VEÍA. Esa variable la
                  inyecta `ThemeProvider`, montado SOLO en
                  `(app)/layout.tsx:106`; en el launcher —que es donde vive este
                  modal— no existe, y una arbitraria de Tailwind sin fallback
                  con la variable sin definir no pinta nada: fondo transparente
                  y texto blanco sobre panel blanco. `--sp-primary` lleva el
                  fallback puesto a propósito «para rutas sin provider»
                  (spinus-tokens.css:11-13), así que se ve con provider y sin
                  él, y sigue la marca de la clínica cuando la hay. De paso el
                  deshabilitado deja de ser opacidad y pasa a color propio. */}
              <button
                onClick={avanzar}
                disabled={guardando || esperandoFirma}
                className="sp-btn sp-btn--primary"
              >
                {guardando ? (
                  <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                ) : esUltimo ? (
                  <><CheckCircle2 size={15} /> Finalizar</>
                ) : (
                  <>Continuar <ChevronRight size={15} /></>
                )}
              </button>
            </div>
          )}
        </div>
      }
    >
      {/* Stepper — INDICADOR, no navegación. Se mueve solo con «Atrás» y
          «Continuar» del pie; ver el porqué en `atras()`. */}
      <div className="flex items-center gap-1 px-5 pt-4">
        {pasos.map((p, i) => {
          const activo = i === indice
          const completado = i < indice
          return (
            <div key={p} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 ${activo ? 'flex-1' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  completado ? 'bg-emerald-500 text-white'
                    : activo ? 'bg-[var(--sp-primary)] text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {completado ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                {activo && <span className="text-xs font-medium text-slate-700">{ETIQUETAS[p]}</span>}
              </div>
              {i < pasos.length - 1 && (
                <div className={`h-px flex-1 ${completado ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
        {paso === 'datos' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">¿Cómo aparecerás en tus documentos médicos?</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <select value={titulo} onChange={e => setTitulo(e.target.value)} className="sp-input">
                  <option value="">— Elige —</option>
                  {TITULOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nombre(s) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={nombres} onChange={e => setNombres(e.target.value)}
                  placeholder="Ej: Juan" className="sp-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Apellido paterno <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={apellidoPaterno} onChange={e => setApellidoPaterno(e.target.value)}
                  placeholder="Ej: García" className="sp-input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Apellido materno</label>
                <input
                  type="text" value={apellidoMaterno} onChange={e => setApellidoMaterno(e.target.value)}
                  placeholder="Ej: López" className="sp-input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Especialidad <span className="text-red-500">*</span>
              </label>
              <EspecialidadSelector
                value={especialidades}
                onChange={setEspecialidades}
                selectClassName="sp-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Universidad / Institución <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text" value={universidad} onChange={e => setUniversidad(e.target.value)}
                placeholder="Ej: UNAM, IPN, UAG…" className="sp-input"
              />
            </div>
          </div>
        )}

        {paso === 'cedulas' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Tus cédulas aparecerán al pie de cada documento oficial.</p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cédula profesional <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={cedulaProfesional}
                onChange={e => { setCedulaProfesional(e.target.value); setErrorCedula('') }}
                placeholder="7 u 8 dígitos" className="sp-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cédula de especialidad <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text" value={cedulaEspecialidad}
                onChange={e => { setCedulaEspecialidad(e.target.value); setErrorCedula('') }}
                placeholder="7 u 8 dígitos" className="sp-input"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Déjala vacía si ejerces como médico general.
              </p>
            </div>
            {errorCedula && <p className="text-xs text-red-500">{errorCedula}</p>}
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              Las cédulas son datos que amparan legalmente tus documentos médicos bajo la NOM-004-SSA3-2012.
            </p>
          </div>
        )}

        {esPanelSoporte && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <LifeBuoy size={22} className="text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Tu cuenta no está asociada a ninguna clínica</p>
            <p className="text-sm text-slate-600">
              Los médicos invitados no pueden crear una clínica: quien administra la tuya
              debe volver a añadirte.
            </p>
            <p className="text-sm text-slate-600">
              Escríbenos y lo resolvemos contigo —no es algo que puedas arreglar desde aquí.
            </p>
            <a
              href="mailto:soporte@spinus.com.mx?subject=Cuenta sin clínica asignada"
              className="sp-btn sp-btn--primary no-underline"
            >
              Escribir a soporte
            </a>
          </div>
        )}

        {paso === 'clinica' && !gate.requiereSoporte && clinicaCreada && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{nombreClinica.trim()} ya está creada</p>
            <p className="text-sm text-slate-600">
              Volviste a este paso, pero la clínica ya existe y no hace falta crearla otra vez.
              Para cambiarle el nombre, entra a Mi Perfil.
            </p>
          </div>
        )}

        {paso === 'clinica' && !gate.requiereSoporte && !clinicaCreada && (
          <div className="space-y-4">
            {/* ⚠️ CLÍNICA Y CONSULTORIO NO SON LO MISMO, y el registro los
                confundía: su campo decía «nombre del consultorio» y lo que
                creaba era esto. Se explica aquí igual que el paso siguiente
                explica lo suyo. */}
            <p className="text-sm text-slate-600">
              Tu clínica es la cuenta: el contenedor de tus pacientes, tus documentos y,
              si algún día lo necesitas, tu equipo. El consultorio —el lugar físico donde
              atiendes— lo configuras en el paso siguiente.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nombre de la clínica <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombreClinica}
                onChange={e => setNombreClinica(e.target.value)}
                maxLength={120}
                placeholder="Ej: Clínica Ortointegra"
                className="sp-input"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Si trabajas por tu cuenta, pon tu nombre o el de tu práctica. Aparece en el
                encabezado de tus documentos y puedes cambiarlo luego en Mi Perfil.
              </p>
            </div>
          </div>
        )}

        {paso === 'consultorio' && consultorioCreado && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{nombreCons.trim()} ya está creado</p>
            <p className="text-sm text-slate-600">
              Volviste a este paso, pero el consultorio ya existe y no hace falta crearlo otra vez.
              Para cambiarle la dirección, el teléfono o la zona horaria, entra a
              Mi Perfil → Mis consultorios.
            </p>
          </div>
        )}

        {paso === 'consultorio' && !consultorioCreado && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              El consultorio es el lugar físico donde atiendes. Su dirección y su zona horaria
              mandan en tus documentos y en tu agenda.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nombre del consultorio <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={nombreCons} onChange={e => setNombreCons(e.target.value)}
                placeholder="Ej: Consultorio Centro" className="sp-input"
              />
            </div>
            {requiereNombreCorto && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nombre corto (máx. 12 caracteres) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={nombreCorto} onChange={e => setNombreCorto(e.target.value)}
                  maxLength={12} placeholder="Ej: Centro" className="sp-input"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se muestra en el sidebar y en agenda cuando el nombre completo es muy largo.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
                placeholder="Ej: Calle 60 #400, Mérida, Yucatán" className="sp-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="tel" value={telefono}
                onChange={e => { setTelefono(formatearTelefono(e.target.value)); setErrorTelefono('') }}
                placeholder="Ej: 999 123 4567" className="sp-input"
              />
              {errorTelefono && <p className="text-xs text-red-500 mt-1">{errorTelefono}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Zona horaria <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CHIPS_RAPIDOS.map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setTimezone(chip.value)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      timezone === chip.value
                        ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="sp-input">
                <option value="">— Selecciona tu zona —</option>
                {ZONAS_MEXICO.map(z => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {paso === 'logo' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">El logo de tu clínica aparece en el encabezado de todos los documentos.</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              {logoPreview ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo" className="h-20 mx-auto object-contain rounded-lg" />
                  <button
                    onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Quitar logo
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🏥</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Haz clic para subir el logo</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP o SVG · Máximo 500 KB</p>
                  <input type="file" accept={LOGO_ACCEPT} onChange={handleLogoChange} className="hidden" />
                </label>
              )}
            </div>
          </div>
        )}

        {paso === 'firma' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Tu firma autógrafa aparece sobre la línea de firma en todos tus documentos PDF.</p>
            <FirmaCaptura firmaActual={firmaUrl} onFirmaCambiada={url => setFirmaUrl(url)} />
            {!firmaUrl && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Si la omites, tus recetas y escritos saldrán <strong>sin firma</strong>: con la línea y tus
                datos, pero sin el trazo. Puedes capturarla más tarde en Mi Perfil.
                {' '}Para terminar <strong>con</strong> firma, pulsa «Aceptar firma» aquí arriba y espera a que
                confirme; para terminar <strong>sin</strong> ella, usa «Omitir por ahora».
              </p>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
