'use client'

import Image from 'next/image'
import { Activity } from 'lucide-react'

/* Section: La Historia de Spinus */
export default function SeccionHistoria() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Foto del Dr. Ancona — §7·11 retira el badge de estetoscopio que
              flotaba sobre la esquina: adorno sin contenido sobre un retrato
              real. Pendiente (deuda, no bloqueante): foto en pasillo de
              hospital sin fondo IA, recorte hombros-arriba. */}
          <div className="flex justify-center">
            <Image
              src="/landing/dr-ancona.jpg"
              alt="Dr. Ángel M. Ancona Pérez — Fundador de Spinus"
              width={480}
              height={600}
              className="rounded-3xl shadow-xl object-cover w-full max-w-[420px]"
            />
          </div>

          {/* Narrativa */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3.5 py-1 mb-6">
              <Activity className="w-3.5 h-3.5 text-[#1e5fa8]" />
              {/* §7·11: "MI historia", nunca "nuestra" — no hay equipo. El
                  uppercase lo pone el CSS, como en los kickers hermanos. */}
              <span className="text-[11px] font-semibold text-[#1e5fa8] uppercase tracking-wider">Mi historia</span>
            </div>

            <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
              La Historia de{' '}
              <span className="bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent">
                Spinus
              </span>
            </h2>

            {/* ⚠️ ESTOS 4 PÁRRAFOS SIGUEN EN TERCERA PERSONA A PROPÓSITO.
                §7·11 exige PRIMERA persona ("un software hecho por un médico"
                → "lo hice yo"), pero convertirlos no es cambiar pronombres:
                es reescribir la narrativa entera, y ese texto lo escribe
                Angel (pendiente §9). c2 solo aplicó lo mecánico: badge,
                cierre del 4º párrafo, DICOM en la lista de módulos, grafía
                "Ángel" y cédulas. NO lo tomes por olvido ni lo redactes tú. */}
            <div className="mt-6 space-y-4 text-[15px] text-slate-600 leading-relaxed">
              <p>
                Todo empezó en un quirófano. Entre cirugías de columna, notas médicas escritas a mano y un software que tardaba más en cargar que la propia consulta, el <strong className="text-slate-800">Dr. Ángel Ancona</strong> se hizo una pregunta simple: <em className="text-[#1e5fa8]">&ldquo;¿Por qué la tecnología médica no funciona como la tecnología que usamos en nuestra vida diaria?&rdquo;</em>
              </p>
              <p>
                La respuesta no existía. Los sistemas de expedientes electrónicos estaban diseñados por ingenieros que nunca habían pisado un consultorio a las 7 de la mañana con 20 pacientes esperando. Eran lentos, complejos y pensados para cumplir regulaciones — no para ayudar al médico.
              </p>
              <p>
                Así nació <strong className="text-slate-800">Spinus</strong>. El nombre viene de la raíz latina <em>spina</em> — columna. Porque así como la columna vertebral es el eje que sostiene y conecta todo el cuerpo humano, Spinus es el eje tecnológico que sostiene y conecta toda tu práctica médica: expedientes, agenda, recetas, laboratorios, imagen DICOM e inteligencia artificial en un solo lugar.
              </p>
              <p>
                {/* §7·11: "y el de miles de colegas" implicaba una base de
                    usuarios que no existe. El producto está en beta. */}
                No es un software hecho por una empresa de tecnología que luego buscó médicos. Es un software hecho por un médico que aprendió tecnología para resolver su propio problema — uno que comparten miles de colegas.
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200/60">
              <p className="text-[17px] font-bold text-slate-900 tracking-tight">
                Dr. Ángel M. Ancona Pérez
              </p>
              <p className="text-[13px] text-[#1e5fa8] font-semibold mt-1">
                Fundador, Traumatólogo y Cirujano de Columna
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
