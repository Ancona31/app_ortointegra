import {
  Heart, Droplet, Wind, Activity, Brain, Pill, TestTube, Bone, Baby, Siren,
  Scissors, Settings, Apple, User, MessageCircle, Bug, Dna, Flame, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { EspecialidadSlug } from './types'

export type Especialidad = {
  slug: EspecialidadSlug
  nombre: string
  icon: LucideIcon
  color: string
}

export const ESPECIALIDADES: Especialidad[] = [
  { slug: 'cardiologia',              nombre: 'Cardiología',              icon: Heart,          color: '#ef4444' },
  { slug: 'nefrologia',               nombre: 'Nefrología',               icon: Droplet,        color: '#3b82f6' },
  { slug: 'neumologia',               nombre: 'Neumología',               icon: Wind,           color: '#06b6d4' },
  { slug: 'terapia-intensiva',        nombre: 'Terapia Intensiva',        icon: Activity,       color: '#dc2626' },
  { slug: 'neurologia',               nombre: 'Neurología',               icon: Brain,          color: '#8b5cf6' },
  { slug: 'gastroenterologia',        nombre: 'Gastroenterología',        icon: Pill,           color: '#f59e0b' },
  { slug: 'hematologia',              nombre: 'Hematología',              icon: TestTube,       color: '#be123c' },
  { slug: 'ortopedia-traumatologia',  nombre: 'Ortopedia y Traumatología',icon: Bone,           color: '#64748b' },
  { slug: 'pediatria',                nombre: 'Pediatría',                icon: Baby,           color: '#ec4899' },
  { slug: 'urgencias-emergencias',    nombre: 'Urgencias y Emergencias',  icon: Siren,          color: '#f97316' },
  { slug: 'cirugia-anestesia',        nombre: 'Cirugía y Anestesia',      icon: Scissors,       color: '#0ea5e9' },
  { slug: 'endocrinologia',           nombre: 'Endocrinología',           icon: Settings,       color: '#a855f7' },
  { slug: 'nutricion-metabolismo',    nombre: 'Nutrición y Metabolismo',  icon: Apple,          color: '#22c55e' },
  { slug: 'obstetricia-ginecologia',  nombre: 'Obstetricia y Ginecología',icon: User,           color: '#d946ef' },
  { slug: 'psiquiatria',              nombre: 'Psiquiatría',              icon: MessageCircle,  color: '#6366f1' },
  { slug: 'infectologia',             nombre: 'Infectología',             icon: Bug,            color: '#84cc16' },
  { slug: 'oncologia',                nombre: 'Oncología',                icon: Dna,            color: '#7c3aed' },
  { slug: 'reumatologia',             nombre: 'Reumatología',             icon: Flame,          color: '#e11d48' },
  { slug: 'dermatologia',             nombre: 'Dermatología',             icon: Sparkles,       color: '#fb923c' },
]

export function getEspecialidad(slug: EspecialidadSlug): Especialidad {
  const esp = ESPECIALIDADES.find(e => e.slug === slug)
  if (!esp) throw new Error(`Especialidad no encontrada: ${slug}`)
  return esp
}
