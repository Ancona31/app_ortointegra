'use client'

import type { ReactNode } from 'react'
import { Calendar, FileText, Brain, Pill, MonitorCheck } from 'lucide-react'

interface Feature {
  icon: ReactNode
  title: string
  desc: string
  /** Borde de la card (§3.1: 0.5px). #1e5fa8 marca la card DICOM. */
  border: string
  /** Columnas que ocupa en la retícula de 3. Ausente = 1. */
  span?: 2
  /** Reserva la zona de medio a sangre. F2.b inserta ahí el video DICOM
   *  con scrub por scroll + contador n/N (§5.3). Vacía por ahora. */
  media?: boolean
}

/* El orden del array ES el orden de la retícula (§3.4: bento asimétrico):
   fila 1 → DICOM (2 col) · Expedientes
   fila 2 → Recetas · Documentación con IA · Agenda
   DICOM arriba-izquierda no es estético: la cascada diagonal de F2.a nace
   de esa card (§5.3). No reordenar sin releer esa ficha. */
const features: Feature[] = [
  {
    icon: <MonitorCheck className="w-6 h-6 text-[#1e5fa8]" />,
    title: 'Visor DICOM',
    desc: 'Abre el estudio completo desde el disco, sin instalar nada y sin costo extra. Guarda en el expediente los cortes que importan — hasta 100 por paciente.',
    border: 'border-[#1e5fa8]',
    span: 2,
    media: true,
  },
  {
    icon: <FileText className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Expedientes electrónicos',
    desc: 'Toda la historia clínica de tu paciente a un clic. Sin papel, sin búsquedas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Pill className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Recetas con QR',
    desc: 'Membretadas, con QR verificable. Envíalas por correo o entrégalas impresas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Brain className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Documentación con IA',
    desc: 'Describe los hallazgos y la IA estructura la nota. Tú validas y firmas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Calendar className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Agenda',
    desc: 'Arrastra, suelta y listo. Sincronizada con Google Calendar.',
    border: 'border-[#e6ebf2]',
  },
]

/* Features — grid bento
   Sin padding-top: los 128px de aire de §3.3 los aporta ahora el pb-32 de
   SeccionProblema.tsx, la sección inmediatamente anterior (antes venía del
   hero, antes de que la franja se insertara en medio). La cadena completa:
     Hero (pb-24, SeccionHero.tsx) → [96px] → Franja (sin pt … pb-32)
     → [128px] → Features (sin pt)
   Las dos costuras son exactas y ASIMÉTRICAS (96 arriba, 128 abajo),
   iguales en todos los breakpoints. No añadir pt aquí.

   El 128 de esta costura subió desde 96 en el QA visual de b2: con esta
   sección y la franja ambas en blanco, el corte cromático desapareció y
   96px quedaban por debajo del umbral en que el h2 de aquí se lee como
   párrafo nuevo en vez de sección nueva. El motivo completo está en el
   contrato de SeccionProblema.tsx, que es donde vive el padding — si
   cambias uno, actualiza los dos comentarios: son el mismo contrato
   escrito en dos archivos.

   ⚠️ OJO AL DESNIVEL QUE INTRODUJO c1. El `pb` de ESTA sección sí sigue
   el régimen general (`pb-16 sm:pb-24 lg:pb-32` → 64/96/128, costura de
   128/192/256 contra SeccionIA), pero el aire de ARRIBA sigue siendo el
   128 plano que dona la franja. En lg esta sección abre con 128 y cierra
   con 256: el doble. Es consecuencia directa de mantener el contrato
   literal (opción (a) de la auditoría de c1) y está aceptado, no es un
   descuido. La causa de fondo —el padding donado— es LP-DT-19, que sigue
   abierta: su condición de cierre es que esta sección tome su propio pt
   y la franja suelte el pb-32. Si alguna tanda la ejecuta, el pt que
   tome debe ser `pt-16 sm:pt-24 lg:pt-32` como todas, NO un pt-32 plano,
   o el desnivel se congela en el código en vez de resolverse.

   F1.3·b2 · `bg-white` explícito: NO es redundante. Sin él esta sección
   heredaba el `--background: #f8fafc` del body (globals.css:25,135), no
   blanco — quedaba medio tono por debajo de sus hermanas blancas
   (Interfaz, Expediente, Seguridad), que sí lo declaran. La alternancia
   blanco/#f5f8fc es un sistema y debe leerse en el código, no depender de
   un default global que vive fuera de la landing. */
export default function SeccionFeatures() {
  return (
    <section className="bg-white pb-16 sm:pb-24 lg:pb-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        {/* F1.3·c3 — `mb-12` (48), no mb-14: 56 no está en la escala. Mismo
            cambio en los encabezados de Portabilidad y Seguridad, que son el
            mismo elemento (bloque de titular → retícula). */}
        <div className="max-w-2xl mb-12">
          {/* ═══ ROL TITULAR DE SECCIÓN (F1.3·d2) ═══
              text-[clamp(30px,4vw,46px)] · tracking -0.03em · leading 1.10
              (§3.2). Vale para los OCHO titulares de sección de la landing:
              este, SeccionExpediente, SeccionInterfaz, SeccionHistoria,
              SeccionPortabilidad, SeccionSeguridad, SeccionIA y SeccionCTA.

              Este archivo es la referencia porque es el primer <h2> real en
              orden de lectura y porque ya estaba en el valor de destino antes
              de d2 — los otros siete se movieron hacia aquí, no al revés.

              Venían de dos escalones distintos: seis a `28/38px` con
              `tracking-tight` (-0.025em) y `leading-[1.15]`, y dos —los dos
              bloques navy, IA y CTA— a `24/30px`. Ese segundo grupo era el
              problema real: un titular de sección a 30px no compite con un
              H1 de 56 y la jerarquía se aplanaba justo en las dos secciones
              que más peso narrativo cargan. Ahora los ocho entran por el
              mismo clamp y la diferencia entre secciones la hace el contexto
              (ancho de columna, color de superficie), no el tamaño.

              El clamp sustituye al par `28px sm:38px`: entre 750px y 1150px
              de viewport el tamaño ya no salta en el breakpoint, interpola.
              Por debajo de 750 se queda en 30 (era 28: +2px en móvil) y por
              encima de 1150 tope en 46 (era 38: +8px en escritorio).

              ⚠️ NO es el único texto grande de la landing. El H1 del hero
              (`SeccionHero.tsx`) tiene su propio régimen —clamp(40,7vw,72),
              -0.04em, 1.02— y es DELIBERADAMENTE más apretado en tracking y
              en leading: a 72px el interletraje y el interlineado que un
              titular de 46 necesita para respirar se ven sueltos. No unifiques
              los dos roles en uno.

              ⚠️ `SeccionProblema.tsx:87` es un <p>, no un <h2>, y hace de
              titular de esa sección. Ya está en estos tres valores. Que sea
              <p> es decisión semántica de esa sección, no un olvido — no lo
              conviertas en <h2> ni lo saques de este régimen. */}
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
            Lo que resuelve desde el primer día
          </h2>
          {/* F1.3·d3 — rol bajada: 19px · -0.01em · 1.55. Ver SeccionHero.tsx
              (incluida la advertencia de NO aplicar esto con selector). */}
          <p className="mt-3 text-[19px] text-slate-500 tracking-[-0.01em] leading-[1.55]">Cada herramienta resuelve un problema real de tu día a día.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={`flex flex-col bg-white rounded-2xl border-[0.5px] ${f.border} ${f.span === 2 ? 'sm:col-span-2' : ''} shadow-sm hover:shadow-[0_4px_20px_rgba(30,95,168,0.10)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-default`}
            >
              <div className="p-6">
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
                {/* ═══ ROL CUERPO (F1.3·d3) ═══
                    17px · tracking normal · leading 1.65 (§3.2). Es el texto
                    corrido de la landing: SEIS sitios — este, SeccionExpediente,
                    SeccionInterfaz, SeccionPortabilidad, SeccionSeguridad y los
                    cuatro párrafos de SeccionHistoria (que lo heredan del div
                    contenedor, no párrafo a párrafo).

                    Venían de 13, 14 y 15px: tres tamaños distintos para el
                    mismo rol, que es justo lo que d3 cierra. 17 es el mínimo
                    cómodo para leer un párrafo entero, y 1.65 es más abierto
                    que el 1.55 de la bajada a propósito — a menor tamaño, más
                    interlínea. Sustituye a `leading-relaxed` (1.625), que
                    quedaba cerca pero no era un valor del sistema.

                    ⚠️ TRACKING NORMAL SIGNIFICA AUSENCIA DE CLASE, no
                    `tracking-normal`. Nada en la cadena de ancestros toca el
                    letter-spacing de la landing (verificado: computed =
                    "normal" en los seis sitios), así que la clase no haría
                    nada. A 17px no hay apelmazamiento que compensar — el
                    tracking negativo es cosa de titulares. No se lo pongas.

                    ⚠️ Este rol NO se aplica con selector. La advertencia
                    completa, con la medición del scroll horizontal que
                    provoca, está en SeccionHero.tsx junto al rol bajada. */}
                <p className="mt-2 text-[17px] text-slate-500 leading-[1.65]">{f.desc}</p>
              </div>
              {f.media ? <div className="mt-auto overflow-hidden rounded-b-2xl" /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
