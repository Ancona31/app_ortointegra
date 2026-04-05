/**
 * Script de setup de Stripe — crea los productos y precios en tu cuenta.
 * Ejecutar UNA SOLA VEZ (en modo test primero, luego en modo live):
 *
 *   npx tsx scripts/stripe-setup.ts
 *
 * Al finalizar, copia los Price IDs al .env.local
 */

import Stripe from 'stripe'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

const PRODUCTOS = [
  {
    key: 'individual',
    nombre: 'OrthoIntegra Individual',
    descripcion: '1 médico · Pacientes ilimitados · Todas las funciones',
    precio_mensual: 64900, // centavos MXN
    precio_anual: 649000,
  },
  {
    key: 'basica',
    nombre: 'OrthoIntegra Clínica Básica',
    descripcion: '3 médicos + 1 secretaria · Pacientes ilimitados',
    precio_mensual: 199000,
    precio_anual: 1990000,
  },
  {
    key: 'pro',
    nombre: 'OrthoIntegra Clínica Pro',
    descripcion: '5 médicos + 2 secretarias · Estadísticas por médico · Soporte prioritario',
    precio_mensual: 320000,
    precio_anual: 3200000,
  },
  {
    key: 'premium',
    nombre: 'OrthoIntegra Clínica Premium',
    descripcion: '10 médicos + 2 secretarias · Onboarding · SLA <8h',
    precio_mensual: 480000,
    precio_anual: 4800000,
  },
]

async function main() {
  console.log('🚀 Creando productos y precios en Stripe...\n')
  const envLines: string[] = []

  for (const p of PRODUCTOS) {
    const producto = await stripe.products.create({
      name: p.nombre,
      description: p.descripcion,
    })
    console.log(`✅ Producto: ${producto.name} (${producto.id})`)

    const precioMensual = await stripe.prices.create({
      product: producto.id,
      currency: 'mxn',
      unit_amount: p.precio_mensual,
      recurring: { interval: 'month' },
      nickname: `${p.key} mensual`,
    })

    const precioAnual = await stripe.prices.create({
      product: producto.id,
      currency: 'mxn',
      unit_amount: p.precio_anual,
      recurring: { interval: 'year' },
      nickname: `${p.key} anual`,
    })

    console.log(`   Mensual: ${precioMensual.id}`)
    console.log(`   Anual:   ${precioAnual.id}\n`)

    const KEY = p.key.toUpperCase()
    envLines.push(`STRIPE_PRICE_${KEY}_MONTHLY=${precioMensual.id}`)
    envLines.push(`STRIPE_PRICE_${KEY}_ANNUAL=${precioAnual.id}`)
  }

  console.log('─'.repeat(60))
  console.log('📋 Agrega estas líneas a tu .env.local:\n')
  envLines.forEach(l => console.log(l))
  console.log('\n✅ Setup completado.')
}

main().catch(console.error)
