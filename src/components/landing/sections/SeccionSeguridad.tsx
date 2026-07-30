'use client'

import type { ReactNode } from 'react'
import { Shield, Scale, Database, DatabaseBackup } from 'lucide-react'

interface Tarjeta {
  icon: ReactNode
  /** Fondo del contenedor del icono. Los semánticos (violeta, esmeralda) aquí
   *  decoran en vez de representar datos reales del producto — deuda de §3.1
   *  que barre F1.3 en toda la landing, no esta sección sola. */
  iconBg: string
  title: string
  desc: ReactNode
}

/* ⚠️ Cada claim de esta sección está verificado contra el producto. Antes de
   añadir o endurecer uno, releer §7·10. Lo que se eliminó y POR QUÉ:

   · "Ni siquiera nosotros podemos leer tus notas médicas" — FALSO: existe
     service_role y la IA corre server-side. Riesgo legal, y de gremio: Angel
     es competidor de su propio cliente.
   · "Información cifrada donde solo tú tienes la llave" — implica cifrado
     extremo a extremo con custodia exclusiva del médico. No es el caso.
   · "cumple automáticamente con la NOM-004" — el obligado por la norma es el
     médico, no el software. Spinus da la estructura; no absuelve a nadie.
   · "sincronización total en la nube en tiempo real" — el bug de sync de
     Google Calendar sigue abierto (§11). Mismo motivo por el que §7·9 lo
     prohíbe en Portabilidad.
   · "Tu consultorio nunca se detiene" / "Acceso total" / "Privacidad
     Absoluta" / "blindada" — absolutos sin respaldo. Había 12 en 65 líneas.
   · La bitácora NO se menciona: la verificación de §10 sobre qué accesos
     cubre hoy sigue abierta. Cuando se cierre, su lugar es la tarjeta 2. */
const tarjetas: Tarjeta[] = [
  {
    icon: <Scale className="w-6 h-6 text-[#1e5fa8]" />,
    iconBg: 'bg-blue-50',
    title: 'Conforme a la norma',
    desc: (
      <>
        La estructura del expediente y los formatos siguen la{' '}
        <strong className="text-slate-700">NOM-004</strong>, y el tratamiento de datos se rige por la{' '}
        <strong className="text-slate-700">LFPDPPP</strong> vigente.
      </>
    ),
  },
  {
    icon: <Database className="w-6 h-6 text-violet-600" />,
    iconBg: 'bg-violet-50',
    title: 'Tu información, separada',
    desc: 'Cada médico solo accede a sus pacientes, a nivel de base de datos.',
  },
  {
    icon: <DatabaseBackup className="w-6 h-6 text-emerald-600" />,
    iconBg: 'bg-emerald-50',
    title: 'Respaldo automático',
    desc: 'Tus expedientes se respaldan solos, todos los días. Si algo falla, la información sigue ahí.',
  },
]

/* ⚠️ NO REINTRODUCIR LA ESCALERA. §3.4·10 pide las 3 tarjetas escalonadas y
   §5.10 fija los offsets en 0/24/48px, pero la QA visual de F1.3·b1 lo
   descartó y la decisión es firme, no un pendiente. Aquí vivía
   `const ESCALERA = ['sm:mt-0','sm:mt-6','sm:mt-12']` aplicado con
   `items-start`. Falla por dos motivos:
     · Las 3 tarjetas tienen cuerpos de largo distinto, así que con
       `items-start` sus alturas también difieren. Offset desigual sobre
       altura desigual no dibuja una diagonal: dibuja un zigzag. Los tres
       títulos y los tres cuerpos acaban a alturas que no guardan relación
       entre sí y lee como error de maquetación, no como intención.
     · El `sm:mt-12` empujaba la tercera tarjeta fuera del ancho de
       contenido: su borde derecho se salía del contenedor.
   Si una tanda futura quiere recuperar el escalón, la condición previa es
   igualar las alturas de los cuerpos (o fijar altura de tarjeta), no
   reponer los `mt`. Registrado en DEUDA_TECNICA.md (LP-DT-20). */

/* Section: Seguridad
   El array no es adorno: F2.a necesita una lista iterable para el Stagger,
   porque §4.4 prohíbe envolver los hijos en wrappers extra (rompen el span
   del grid) y obliga a variantes padre→hijo sobre este map.

   Superficie BLANCA (§3.1), explícita. La fija el CTA: su lavado
   color-mix resuelve a ≈#f6f9fc, a un punto por canal de la franja #f5f8fc.
   Una Seguridad en franja se fundiría con el bloque siguiente en una sola
   banda. Por eso rompe la alternancia respecto a Historia y lo hace bien. */
export default function SeccionSeguridad() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* F1.3·c3 — `mb-12` (48). Ver SeccionFeatures.tsx. */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3.5 py-1 mb-6">
            <Shield className="w-3.5 h-3.5 text-[#1e5fa8]" />
            {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
            <span className="text-[12px] font-semibold text-[#1e5fa8] uppercase tracking-[0.12em] leading-none">Seguridad clínica</span>
          </div>
          {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
              1.10. Ver SeccionFeatures.tsx. */}
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
            Tu práctica,{' '}
            <span className="text-slate-400">protegida</span>
          </h2>
        </div>

        {/* `items-stretch` explícito (es el default de grid, pero aquí importa
            que se lea): las 3 tarjetas arrancan alineadas arriba y comparten
            altura, que es justo lo que la escalera rompía. Cambiarlo a
            `items-start` devuelve las alturas desiguales. */}
        <div className="grid sm:grid-cols-3 gap-6 items-stretch">
          {/* ⚠️ Estas tarjetas son las que MÁS pierden en b1: eran el último
              glass de la landing (bg-white/30 + backdrop-blur-md), es decir
              azulejos esmerilados, y pasan a blanco sobre una sección blanca
              — el relleno queda a 1.00:1 y solo las dibujan el filete y la
              sombra. Es deliberado: doctrina única de card de §3.1 (bg-white
              + border-[0.5px] #e6ebf2 + shadow-sm), la misma de las 5 del
              bento y las 3 de Portabilidad. Si la QA visual las considera
              insuficientes, la salida NO es devolver el blur: es rellenarlas
              de #f5f8fc invirtiendo card y sección. No abrir una segunda
              doctrina de card para esta sección sola.

              ⚠️ EL PADDING INTERIOR NO ENTRA EN ESA DOCTRINA (decisión de
              PM en c1). La doctrina única cubre fondo, borde y sombra —
              nada más. Que estas cards usen `p-8` (32) y las del bento
              `p-6` (24) NO es incoherencia pendiente de barrer: ambos
              están en la escala de §3.3 y responden a densidades de
              contenido distintas. No los unifiques.
              (Matiz: el `px-6 py-5` de los ítems de Portabilidad era otro
              caso. El 24 horizontal estaba en escala; el `py-5` = 20 no lo
              estaba, y c3 ya lo subió a `py-6` — por estar fuera de escala,
              no por divergir de estas dos.) */}
          {tarjetas.map((t) => (
            <div
              key={t.title}
              className="bg-white rounded-2xl border-[0.5px] border-[#e6ebf2] p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              {/* F1.3·c3 — `mb-6` (24), no mb-5: 20 no está en la escala. */}
              <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center mb-6`}>
                {t.icon}
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 mb-3">{t.title}</h3>
              {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx.
                  Estas 3 tarjetas tienen cuerpos de largo desigual y comparten
                  altura por `items-stretch` (ver la nota de la escalera arriba):
                  al subir de 14 a 17 crecen las tres a la vez, así que la
                  retícula no se descuadra — la más larga sigue mandando. */}
              <p className="text-[17px] text-slate-500 leading-[1.65]">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
