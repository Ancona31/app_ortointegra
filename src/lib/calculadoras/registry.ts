import type { Calculadora, EspecialidadSlug } from './types'
import { imc } from './formulas/nutricion-metabolismo/imc'
import { cockcroftGault } from './formulas/nefrologia/cockcroft-gault'
import { ckdEpi2021 } from './formulas/nefrologia/ckd-epi-2021'
import { mdrd } from './formulas/nefrologia/mdrd'
import { parkland } from './formulas/urgencias-emergencias/parkland'
import { bsaDubois } from './formulas/nutricion-metabolismo/bsa-dubois'
import { qtc } from './formulas/cardiologia/qtc'
import { gradienteAa } from './formulas/neumologia/gradiente-aa'
import { brechaAnionica } from './formulas/nefrologia/brecha-anionica'
import { indiceChoque } from './formulas/cardiologia/indice-choque'
import { homaIr } from './formulas/endocrinologia/homa-ir'

export const CALCULADORAS_REGISTRY: Calculadora[] = [
  imc as Calculadora,
  cockcroftGault as Calculadora,
  ckdEpi2021 as Calculadora,
  mdrd as Calculadora,
  parkland as Calculadora,
  bsaDubois as Calculadora,
  qtc as Calculadora,
  gradienteAa as Calculadora,
  brechaAnionica as Calculadora,
  indiceChoque as Calculadora,
  homaIr as Calculadora,
]

export function getCalculadoraBySlug(slug: string): Calculadora | undefined {
  return CALCULADORAS_REGISTRY.find(c => c.slug === slug)
}

export function getCalculadorasByEspecialidad(especialidad: EspecialidadSlug): Calculadora[] {
  return CALCULADORAS_REGISTRY.filter(c => c.especialidad === especialidad)
}

export function getAllSlugs(): string[] {
  return CALCULADORAS_REGISTRY.map(c => c.slug)
}
