import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const swPath = join(process.cwd(), 'public', 'sw.js')
  const sw = readFileSync(swPath, 'utf-8')

  return new NextResponse(sw, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  })
}
