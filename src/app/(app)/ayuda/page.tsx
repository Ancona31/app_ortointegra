'use client'

import { useId, useState, type ReactNode } from 'react'
import {
  ChevronDown, Calendar, FilePlus2, Mail, Pill, UserPlus, MonitorCheck,
  RotateCcw, ExternalLink, type LucideIcon,
} from 'lucide-react'

/* ── FAQ ──
   ⚠️ ESTA FAQ Y LA PÚBLICA (`components/landing/faq-contenido.ts`) HABLAN DEL
   MISMO PRODUCTO. No son la misma lista —esta es operativa, para quien ya
   entró; aquella responde objeciones de compra— pero cuando dicen lo mismo
   tienen que decirlo igual. El 2026-07-31 se corrigieron aquí seis
   divergencias, tres de ellas claims que §7·10 del maestro prohíbe
   explícitamente y que estaban vivos en producción:

     · "Cumplimos con la NOM-004-SSA3 y la LFPDPPP" — el obligado por esas
       normas es el MÉDICO, no el software. Ninguna plataforma puede cumplir
       la NOM-004 por su usuario, y decirlo en la app es exactamente el claim
       que la landing tiene prohibido.
     · "RLS para que cada médico solo vea sus datos" — FALSO para el médico
       administrador de clínica, que ve los expedientes de todo su equipo
       (`20260524_etapa5e_bd1_policies_pacientes.sql:52-63`). Mismo error que
       se corrigió en `SeccionSeguridad.tsx` en esta tanda.
     · "se cifra con AES-256-GCM en tránsito y en reposo" — inflado. El
       AES-256-GCM que el aviso de privacidad respalda es el de los TOKENS
       OAuth de Google (`AvisoPrivacidadContent.tsx:365`); el reposo de la
       base es "a nivel de proveedor" (`:363`). No inventes el algoritmo de
       otro.
     · "se sincronizan bidireccional … y viceversa" — el bug de sync de Google
       Calendar sigue abierto (§11 del maestro). Es el mismo motivo por el que
       §7·9 prohíbe "en tiempo real" en la landing.
     · "Spinus®" — la marca está EN TRÁMITE ante IMPI (exp. 3594483), sin
       registro concedido: usar ® es infracción (§7·Global).
     · "No necesitas instalar nada" — chocaba con lo que la landing dice en
       Portabilidad. Ojo con el matiz: tampoco se promete lo contrario, porque
       la instalación PWA en iOS real sigue SIN verificar (§10). Lo que se
       afirma es lo único comprobado: que no hay que bajar nada de una tienda. */
const faqs = [
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. La información viaja cifrada con TLS y la base de datos está cifrada en reposo a nivel de proveedor. Row Level Security (RLS) los separa dentro de la propia base: cada médico ve solo a sus pacientes y, en cuentas de clínica, el administrador ve los expedientes de todo su equipo. La estructura del expediente sigue la NOM-004-SSA3 y el tratamiento de datos se rige por la LFPDPPP vigente; el obligado por esas normas eres tú, y Spinus te da la estructura para cumplirlas.',
  },
  {
    q: '¿Cómo conecto Google Calendar?',
    a: 'Ve a Agenda y haz clic en el botón "Conectar Google Calendar". Se abrirá una ventana de Google donde autorizas el acceso. Una vez conectado, tus citas se sincronizan con tu calendario de Google.',
  },
  {
    q: '¿Puedo usar Spinus desde mi celular?',
    a: 'Sí. La app se adapta a cualquier pantalla y funciona en cualquier navegador — solo abre spinus.com.mx desde tu celular o tablet. No necesitas descargar nada de una tienda de apps.',
  },
  {
    q: '¿Cómo cambio de plan?',
    a: 'Ve a Mi perfil → Facturación → "Gestionar suscripción". Desde ahí puedes subir o bajar de plan, actualizar tu método de pago o cancelar.',
  },
  {
    q: '¿Qué pasa si cancelo mi suscripción?',
    /* Antes decía "algunas funciones premium se desactivan", que describe mal
       lo que pasa: no se apaga ninguna función, se bloquea la CREACIÓN. Las
       policies de gate son todas `FOR INSERT` y los SELECT/UPDATE no están
       gateados, así que lo existente se sigue consultando y editando. Es
       literalmente lo que dice el banner (`SuscripcionBanner.tsx:50-51`) y la
       pregunta 1 de la FAQ pública. */
    a: 'Tu cuenta pasa al plan gratuito al final del periodo pagado. Conservas el acceso: puedes consultar, editar y descargar todo lo que ya tienes. Lo que se bloquea es crear pacientes, consultas y documentos nuevos.',
  },
  {
    q: '¿La IA reemplaza mi criterio médico?',
    a: 'No. La inteligencia artificial es una herramienta de apoyo. Genera borradores de notas y analiza laboratorios, pero tú siempre validas, editas y firmas. El juicio clínico final es tuyo.',
  },
  {
    q: '¿Cómo verifico una receta con QR?',
    a: 'Cada receta generada incluye un código QR único. Al escanearlo, se abre una página pública que muestra los datos de la receta para que la farmacia o el paciente puedan verificar su autenticidad.',
  },
  {
    // El rótulo público del rol es "asistente médico" (LP-DT-23). El valor del
    // enum en BD sigue siendo `secretaria` y no se toca: es interno.
    q: '¿Puedo agregar asistentes médicos a mi cuenta?',
    /* "Ven la lista de pacientes" es exacto y hay que conservarlo: la policy
       `pacientes_select_activos` incluye el rol `secretaria`, así que el
       asistente SÍ ve la ficha de todos los pacientes de la clínica. Lo que
       no ve son consultas ni documentos (`consultas_select` solo admite
       `medico_id = auth.uid() OR soy_admin_de_clinica()`).
       ⚠️ La FAQ pública lo resume como "ve la lista de pacientes y la agenda,
       nunca las notas ni los documentos". Si alguien acorta esta respuesta a
       "solo la agenda", las dos dejan de coincidir Y la corta es la falsa. */
    a: 'Sí. Desde Administración → Usuarios puedes crear cuentas con rol "Asistente Médico/a". Ven la lista de pacientes y la agenda —crean, mueven y cancelan citas—, pero no acceden a notas clínicas ni a documentos médicos.',
  },
]

/* ── Guías rápidas ──
   Iconos de un solo color (`--enlace`) y sin cuadro de fondo (CALMA §1). */
const guides: { icon: LucideIcon; title: string; steps: string[] }[] = [
  {
    icon: UserPlus,
    title: 'Registrar un paciente',
    steps: ['Ve a Pacientes → Nuevo paciente', 'Llena nombre, teléfono y datos básicos', 'Haz clic en "Guardar" — el expediente se crea automáticamente'],
  },
  {
    icon: FilePlus2,
    title: 'Crear una nota médica con IA',
    steps: ['Abre el expediente del paciente → "Nueva nota"', 'Llena motivo de consulta y exploración física', 'Haz clic en "Generar con IA" — revisa, edita y guarda', 'Se desbloquean los documentos: receta, laboratorio, imagen, etc.'],
  },
  {
    icon: Pill,
    title: 'Generar una receta',
    steps: ['Desde la nota médica guardada, haz clic en el icono de Receta', 'Agrega medicamentos con el buscador inteligente', 'Haz clic en "Imprimir Receta" — se genera el PDF con QR'],
  },
  {
    icon: Calendar,
    title: 'Agendar una cita',
    steps: ['Ve a Agenda → haz clic en el horario deseado', 'Selecciona el paciente y tipo de consulta', 'Guarda — la cita aparece en tu Google Calendar automáticamente'],
  },
  {
    icon: MonitorCheck,
    title: 'Ver estudios DICOM',
    steps: ['Abre el expediente del paciente → pestaña "Imagen"', 'Arrastra tu archivo DICOM o haz clic para subirlo', 'El visor se abre directamente en el navegador — sin software externo'],
  },
  {
    icon: Mail,
    title: 'Enviar documentos por email',
    steps: ['Genera cualquier documento (receta, solicitud, nota)', 'En la vista del documento, haz clic en "Enviar por email"', 'El paciente recibe el PDF adjunto en su correo'],
  },
]

/* ── Atajos de teclado ── */
const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: 'Búsqueda global de pacientes' },
  { keys: ['Esc'], desc: 'Cerrar modal, menú o panel abierto' },
  { keys: ['↑', '↓'], desc: 'Navegar resultados de búsqueda' },
  { keys: ['Enter'], desc: 'Abrir paciente seleccionado o confirmar acción' },
]

/* Acordeón: la respuesta se muestra u oculta con `hidden` y, al abrirse, entra
   con una transición de `translate`/`opacity` desde `@starting-style` (la
   variante `starting:`). Antes animaba `max-height` (0 ↔ 300 px), que provoca
   relayout en cada fotograma y cortaba a 300 px cualquier respuesta más larga.
   Con movimiento reducido, sólo fundido. */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <li className="border-linea [&+&]:border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl py-2.5 text-left text-[15px] leading-[22px] font-semibold text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-enlace"
      >
        <span>{q}</span>
        <ChevronDown size={18} aria-hidden="true" className={`flex-none text-tinta3 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={id}
        hidden={!open}
        className="pr-[30px] pb-4 transition-[translate,opacity] duration-[var(--dur-entra)] ease-[var(--resorte-entra)] [--recorrido:-6px] motion-reduce:[--recorrido:0px] starting:translate-y-[var(--recorrido)] starting:opacity-0"
      >
        <p className="text-justify text-[15px] leading-[22px] text-tinta2 hyphens-auto">{a}</p>
      </div>
    </li>
  )
}

function Seccion({ titulo, className = '', children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <h2 className="k-t-tarjeta">{titulo}</h2>
      {children}
    </section>
  )
}

function GuiasRapidas() {
  return (
    <div className="grid grid-cols-1 gap-3 ih:grid-cols-2 ih:gap-3.5 iv:grid-cols-2 iv:gap-3.5 esc:grid-cols-2 esc:gap-3.5">
      {guides.map((g) => (
        <div key={g.title} className="k-tarjeta flex flex-col gap-3.5">
          <h3 className="flex items-center gap-2.5 text-[17px] leading-[22px] font-bold text-tinta">
            <g.icon size={20} aria-hidden="true" className="flex-none text-enlace" />
            {g.title}
          </h3>
          <ol className="flex flex-col gap-2.5">
            {g.steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 text-[15px] leading-[22px] text-tinta">
                <span aria-hidden="true" className="k-num -mt-px h-6 w-6 rounded-full bg-tonal text-center text-[13px] leading-6 font-bold text-tonal-tinta">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function AtajosTeclado() {
  return (
    <ul className="k-tarjeta px-4 py-1">
      {shortcuts.map((s) => (
        <li key={s.desc} className="flex min-h-[52px] items-center justify-between gap-3 border-linea py-2.5 text-[15px] leading-[22px] text-tinta [&+&]:border-t">
          <span>{s.desc}</span>
          <span className="flex flex-none gap-1.5">
            {s.keys.map((k) => (
              <kbd key={k} className="h-7 min-w-7 rounded-lg bg-sup2 px-2 text-center font-sans text-[12px] leading-7 font-semibold text-tinta">
                {k}
              </kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

const SELLOS = [
  { label: 'Cifrado AES-256-GCM', desc: 'Datos cifrados en tránsito y en reposo' },
  { label: 'NOM-004-SSA3', desc: 'Expediente clínico conforme a normativa' },
  { label: 'LFPDPPP', desc: 'Protección de datos personales' },
]

function SeguridadPrivacidad() {
  return (
    <div className="k-tarjeta flex flex-col px-4 pt-1.5 pb-1">
      <ul className="ih:grid ih:grid-cols-3 ih:gap-4">
        {SELLOS.map((item) => (
          <li key={item.label} className="flex flex-col border-linea py-2.5 [&+&]:border-t ih:[&+&]:border-t-0">
            <span className="text-[15px] leading-[22px] font-semibold text-tinta">{item.label}</span>
            <span className="text-[13px] leading-[18px] text-tinta2">{item.desc}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-linea py-0.5 text-[13px] leading-[18px] text-tinta2">
        Para más detalles, consulta nuestro{' '}
        <a href="/privacy" target="_blank" className="inline-flex min-h-11 items-center gap-1 font-semibold whitespace-nowrap text-enlace hover:underline ih:min-h-9 esc:min-h-9">
          Aviso de Privacidad
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </p>
    </div>
  )
}

function Soporte() {
  return (
    <section className="k-tarjeta flex flex-col items-start gap-1 px-4 pt-[18px] pb-4 ih:flex-row ih:items-center ih:justify-between ih:gap-5 ih:px-5 iv:flex-row iv:items-center iv:justify-between iv:gap-5 iv:px-5 esc:flex-row esc:items-center esc:justify-between esc:gap-5 esc:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="k-t-tarjeta">¿No encontraste lo que buscabas?</h2>
        <p className="text-[15px] leading-[22px] text-tinta2">
          Escríbenos y te responderemos lo antes posible.
        </p>
      </div>
      <a href="mailto:soporte@spinus.com.mx?subject=Soporte Spinus" className="k-b k-b-prim mt-3 ih:mt-0 iv:mt-0 esc:mt-0">
        <Mail size={18} aria-hidden="true" />
        Contactar soporte
      </a>
    </section>
  )
}

/* Composición (maqueta `lectura`, vista 2): una columna en todos los formatos
   salvo `esc`, donde van la columna de lectura de 680 (guías, preguntas,
   soporte) y la de apoyo de 296 (tutorial, atajos, seguridad), fija al
   desplazar. La columna de apoyo es `contents` fuera de `esc`: sus piezas se
   ordenan con las demás con `order`, en el orden de siempre. */
export default function AyudaPage() {
  return (
    <div lang="es" className="mx-auto w-full max-w-[1000px] pb-16 iv:max-w-[600px]">
      <div className="mb-5 ih:mb-6 iv:mb-6 esc:mb-6">
        <h1 className="k-t-pantalla">Centro de ayuda</h1>
        {/* Sin ® — §7·Global: marca en trámite ante IMPI (exp. 3594483). */}
        <p className="k-t-sec mt-0.5">Todo lo que necesitas para sacarle el máximo a Spinus</p>
      </div>

      <div className="flex flex-col gap-6 esc:grid esc:grid-cols-[minmax(0,680px)_296px] esc:items-start">
        <Seccion titulo="Guías rápidas" className="order-1 esc:col-start-1 esc:row-start-1">
          <GuiasRapidas />
        </Seccion>

        <div className="contents esc:sticky esc:top-0 esc:col-start-2 esc:row-span-3 esc:row-start-1 esc:mt-[34px] esc:flex esc:flex-col esc:gap-5">
          {/* Reiniciar onboarding */}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('spinus_onboarding')
              window.location.reload()
            }}
            className="k-b k-b-tonal order-2 h-auto min-h-11 justify-start py-2 text-left whitespace-normal ih:self-start iv:self-start esc:min-h-9"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Volver a ver el tutorial paso a paso
          </button>

          <Seccion titulo="Atajos de teclado" className="order-3">
            <AtajosTeclado />
          </Seccion>

          <Seccion titulo="Seguridad y privacidad" className="order-5">
            <SeguridadPrivacidad />
          </Seccion>
        </div>

        <Seccion titulo="Preguntas frecuentes" className="order-4 esc:col-start-1 esc:row-start-2">
          <ul className="k-tarjeta px-4 py-1">
            {faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </ul>
        </Seccion>

        <div className="order-6 esc:col-start-1 esc:row-start-3">
          <Soporte />
        </div>
      </div>
    </div>
  )
}
