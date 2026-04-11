import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const manifestPath = join(process.cwd(), 'public', 'manifest.json')
  const manifest = readFileSync(manifestPath, 'utf-8')

  return new NextResponse(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
