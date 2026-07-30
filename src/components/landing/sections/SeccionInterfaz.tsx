'use client'

import { Calendar, Zap, MousePointerClick } from 'lucide-react'

/* Section: Interfaz intuitiva
   Superficie BLANCA (§3.1), explícita. Mismo motivo que en Expediente: el
   panel `#f8fafc` de la izquierda quedaría invertido sobre franja.

   ═══ ESCALERA DE RADIOS DE LA LANDING (F1.3·c2) ═══
   Esta nota vive aquí porque el panel de abajo es el único sitio donde los
   tres peldaños se ven anidados en el mismo bloque: contenedor 16 → fila 12
   → cuadro del número 8. Vale para las 12 secciones, no solo para esta.

   EL RADIO ESCALA CON EL TAMAÑO DEL ELEMENTO. No hay un valor único:

     8px  (`rounded-lg`)  — cuadros de icono de 32px (w-8): aquí abajo (×2),
                            SeccionExpediente.tsx
     12px (`rounded-xl`)  — CONTROLES (los 4 botones grandes del hero y el
                            CTA, los 3 del nav) y SUB-CARDS internas (las
                            filas del flujo de aquí abajo, las pestañas y
                            los renglones del mockup de Expediente).
                            También el cuadro de icono de 48px (w-12) de
                            SeccionSeguridad.tsx.
     16px (`rounded-2xl`) — SUPERFICIES: cards de Features, paneles de
                            mockup, bloques navy de IA y CTA, la franja de
                            Portabilidad, el marco del hero, la foto de
                            SeccionHistoria. También el cuadro de icono de
                            80px (w-20) de SeccionIA.

   ⚠️ ESTO NO ES UNA VIOLACIÓN PENDIENTE DE UNIFICAR — es la decisión de PM
   de c2, y el código ya la cumple entero. Un cuadro de 32px con radio 16
   se lee como una pastilla, no como un cuadro; el mismo 16 sobre una card
   de 400px apenas se percibe. Que dos elementos de tamaños distintos
   compartan número sería la incoherencia, no al revés. Si una auditoría
   futura reporta "tres radios distintos en cuadros de icono", la respuesta
   es esta nota: NO los unifiques.

   ⚠️ EL 16 DE UN CUADRO DE ICONO Y EL 16 DE UNA CARD COINCIDEN POR TAMAÑO,
   NO POR PARENTESCO. Si el cuadro de icono de SeccionIA dejara de ser de
   80px, su radio baja con él — no se queda en 16 "porque el contenedor
   navy también es 16".

   FUERA DE LA ESCALERA, y a propósito: `rounded-full` (las 5 pastillas de
   kicker, los 2 chips de IA, los 3 puntos del marco del hero, el avatar y
   la barra del timeline de Expediente), el `lg:rounded-r-none` del marco
   del hero (es el sangrado de §3.4·1, no un radio) y el `rounded-b-2xl`
   del sello de la card DICOM en SeccionFeatures.tsx. Ninguno es deuda. */
export default function SeccionInterfaz() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* F1.3·c3 — `lg:gap-24` (96). Ver SeccionExpediente.tsx. */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Left: visual */}
          <div className="order-2 lg:order-1">
            <div className="bg-[#f8fafc] rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Flujo de trabajo típico</p>
              {/* `tone`: gradación de UN solo azul, del más claro (#1e5fa8, paso 1)
                  al más profundo (#1a3a5c, paso 5) — refuerza el avance del flujo.
                  Los 5 pasos interpolan SOLO entre esos dos valores de §3.1 con
                  color-mix; inventar azules intermedios sería color fuera de
                  tabla (§12). Los 5 tonos pasan AA con texto blanco. */}
              {[
                { step: '1', label: 'Paciente llega', desc: 'La tarjeta "Próxima cita" te muestra quién sigue', tone: '#1e5fa8' },
                { step: '2', label: 'Abrir expediente', desc: 'Un clic desde la cita', tone: 'color-mix(in srgb, #1e5fa8 75%, #1a3a5c)' },
                { step: '3', label: 'Nota médica con IA', desc: 'Describe los hallazgos, la IA estructura la nota', tone: 'color-mix(in srgb, #1e5fa8 50%, #1a3a5c)' },
                { step: '4', label: 'Generar receta', desc: 'Selecciona medicamentos, sale membretada y con QR', tone: 'color-mix(in srgb, #1e5fa8 25%, #1a3a5c)' },
                { step: '5', label: 'Enviar al paciente', desc: 'Email automático con la receta adjunta', tone: '#1a3a5c' },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 bg-white rounded-xl border border-slate-200/60 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.tone }}>
                    <span className="text-[12px] font-bold text-white">{item.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 bg-emerald-50 rounded-full px-3.5 py-1 mb-6">
              <MousePointerClick className="w-3.5 h-3.5 text-emerald-600" />
              {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx.
                  NO confundir con el `text-[11px]` de :57 ("Flujo de trabajo
                  típico"): ese vive dentro del panel simulado y queda fuera
                  de F1.3 a propósito. Son dos kickers de este archivo con
                  tamaños distintos y está bien así. */}
              <span className="text-[12px] font-semibold text-emerald-600 uppercase tracking-[0.12em] leading-none">Interfaz intuitiva</span>
            </div>
            {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
                1.10. Ver SeccionFeatures.tsx. */}
            <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
              Si sabes usar tu celular,{' '}
              <br className="hidden sm:block" />
              <span className="text-slate-400">ya sabes usar Spinus</span>
            </h2>
            {/* F1.3·d3 — rol bajada: 19px · -0.01em · 1.55. Ver SeccionHero.tsx. */}
            <p className="mt-6 text-[19px] text-slate-500 max-w-lg tracking-[-0.01em] leading-[1.55]">
              Sin configuraciones, sin formatos rígidos, sin capacitación. Cada pantalla está diseñada para que el siguiente paso sea obvio — desde que llega el paciente hasta que se va con su receta.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: <MousePointerClick className="w-4 h-4 text-emerald-500" />, text: 'No necesitas capacitación para empezar' },
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'Búsqueda rápida — ⌘K / Ctrl+K' },
                { icon: <Calendar className="w-4 h-4 text-violet-500" />, text: 'Arrastra y suelta las citas en la agenda' },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  {/* `mt-0.5` = alineación óptica de 2px, no ritmo. Blindado
                      en c3 — ver SeccionExpediente.tsx. */}
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  {/* F1.3·d3 — rol cuerpo: 17px · 1.65. Ver SeccionFeatures.tsx.
                      ⚠️ NO confundir con el `text-[13px]` de :75, que es una
                      etiqueta del panel simulado y queda fuera de d3 por el
                      mismo criterio que excluyó su kicker en d1. */}
                  <p className="text-[17px] text-slate-600 leading-[1.65]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
