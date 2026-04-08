import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const limitError = await checkRateLimit(user.id, 'labs-extract')
    if (limitError) return limitError

    const formData = await req.formData()
    const file = formData.get('pdf') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    if (file.type !== 'application/pdf')
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: 'El PDF no debe superar 20 MB' }, { status: 400 })

    // Crear el registro del job primero para obtener el ID
    const { data: job, error: jobError } = await supabase
      .from('pdf_jobs')
      .insert({ user_id: user.id, status: 'pending', file_path: '' })
      .select('id')
      .single()

    if (jobError || !job)
      return NextResponse.json({ error: 'No se pudo iniciar el procesamiento' }, { status: 500 })

    // Subir PDF a Storage en carpeta del usuario
    const filePath = `${user.id}/${job.id}.pdf`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('labs-pdfs')
      .upload(filePath, bytes, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      await supabase.from('pdf_jobs').delete().eq('id', job.id)
      return NextResponse.json({ error: 'No se pudo subir el archivo: ' + uploadError.message }, { status: 500 })
    }

    // Actualizar job con la ruta del archivo
    await supabase.from('pdf_jobs').update({ file_path: filePath }).eq('id', job.id)

    return NextResponse.json({ jobId: job.id })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
