import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Control de acceso — DETALLE clínico del paciente.
//
// Bloqueo server-side de TODO el subárbol /expediente/[id] para el rol
// 'secretaria'. La secretaria SÍ puede ver la LISTA (/expediente) — gestiona
// agenda y alta de pacientes — pero NO el expediente clínico del paciente:
// notas, diagnósticos, laboratorios, documentos, consultas, edición.
//
// Este guard cubre por composición todas las sub-rutas bajo [id]/ (page,
// estado, laboratorios, editar, consulta/[consultaId], documentos, nueva-nota),
// incluidas rutas futuras que se agreguen bajo [id]/. Los layouts de
// suscripción de sub-rutas (documentos/, nueva-nota/) siguen aplicándose por
// debajo de éste.
//
// CONVENCIÓN (mantener el guard fail-closed): todo lo CLÍNICO de un paciente va
// bajo /expediente/[id]/. Lo que cuelga directo de /expediente/ es nivel-LISTA
// (roster, seguro para secretaria). Una sub-ruta clínica nueva debe ir bajo
// [id]/ para heredar este bloqueo automáticamente.
//
// Nota de defensa en profundidad: la protección PRIMARIA de los datos clínicos
// es la RLS de las tablas (consultas/documentos/mediciones/addendums excluyen a
// la secretaria en lectura y escritura). Este guard es la capa de navegación:
// evita que la secretaria aterrice en una página de detalle vacía/rota y
// responde server-side a la URL directa.
export default async function ExpedienteDetalleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  /* ⚠️ `error` SE DESTRUCTURA A PROPÓSITO Y NO SE PUEDE VOLVER A TIRAR. Aquí
     estuvo `const { data: profile } = …` a secas, y con él la única rama era
     `if (profile?.role === 'secretaria')`: si la consulta FALLABA, `profile` era
     `null`, `profile?.role` daba `undefined`, la comparación era falsa y SE
     DEJABA PASAR AL EXPEDIENTE CLÍNICO. El guarda estaba orientado al lado
     permisivo — ante la duda, abría. Registrado como PERF-DT-2 en
     `DEUDA_TECNICA.md`; esto es su cierre. */
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  /* ⚠️ POR QUÉ BLOQUEAR CUANDO EL ROL NO CONSTA NO ES PARANOIA, que es lo que va
     a parecer al leerlo: un rol ausente NO puede ser un perfil a medias.
     `profiles.role` es `text NOT NULL DEFAULT 'medico'`
     (`supabase/baseline/02_tables.sql:406`) y la RLS deja a CUALQUIERA leer su
     propia fila (`profiles_select_own`, `07_rls_policies.sql:561`, más «Ver
     perfiles de la misma clinica»). O sea que en operación normal el rol consta
     SIEMPRE, para todo el mundo. Si no consta, lo que hay es un fallo —red, base
     caída un instante, la fila ilegible—, no un usuario legítimo con el perfil
     incompleto. Bloquearlo no deja fuera a nadie que debiera entrar.

     ⚠️ ESTO CAMBIA EL CAMINO DE FALLO, NO LA POLÍTICA. Sigue entrando exactamente
     quien entraba: el deny sobre `secretaria` de abajo se queda tal cual y NO se
     sustituye por una lista blanca de roles permitidos. Una lista blanca sería
     más explícita y a cambio dejaría fuera EN SILENCIO a cualquier rol que se
     añada al `CHECK` de la tabla en el futuro. Eso es otro problema, no éste.

     ⚠️ Y NO SE REDIRIGE, que fue la decisión difícil. Las dos salidas obvias
     mienten: `/login` afirma que la sesión se cayó cuando el `getUser()` de
     arriba acaba de pasar, e invita a reautenticarse contra un problema que no
     está en la sesión; `/expediente` es literalmente lo que recibe la secretaria,
     así que un médico legítimo vería su clic evaporarse sin explicación y lo
     repetiría. Devolver el panel bloquea de verdad —`children` no se renderiza
     nunca— y dice la verdad sobre lo que pasó.
     Tampoco se hace `throw` para que lo recoja un boundary: NO HAY UN SOLO
     `error.tsx` en `src/app` (comprobado), y el `ErrorBoundary` de
     `(app)/layout.tsx` probablemente lo atraparía, pero «probablemente» no es
     base para un guarda de acceso.

     ⚠️ LA INCONSISTENCIA CON EL RESTO DE LA APP ES DELIBERADA Y ESTÁ MEDIDA.
     Hay cuatro sitios más con este patrón que SIGUEN fallando abiertos y así se
     quedan: `(app)/layout.tsx:72` (super_admin), `(launcher)/inicio/layout.tsx:25`
     (PERF-DT-3), el FAIL_OPEN documentado de `lib/subscription.ts`, y los checks
     de cliente de `dashboard/` y `estadisticas/`. Ninguno custodia datos
     clínicos: fallan hacia sitios donde no hay nada que proteger. La regla del
     proyecto NO es «todos los guardas fallan igual», es «los guardas de datos
     clínicos fallan cerrados». No "alinees" éste con los otros cuatro. */
  if (error || !profile?.role) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-slate-700">
          No pudimos verificar tus permisos
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          Tu sesión sigue activa, pero no se pudo leer tu perfil en este momento.
          No abrimos el expediente sin confirmarlo. Vuelve a cargar la página en
          unos segundos.
        </p>
        {/* ⚠️ AQUÍ SÍ ES `<Link>`, Y ES LA DIFERENCIA CON `ErrorBoundary.tsx`,
            que usa un `<a>` a propósito. Allí lo que se ha roto es el ÁRBOL DE
            CLIENTE —contextos y cachés de SWR poisoned por un error que no se
            entiende—, así que hace falta tirarlo con una carga de documento
            entera. Aquí no se ha roto nada en el cliente: falló una consulta en
            el SERVIDOR y este panel es una página normal, servida sin
            incidencias. Una navegación de cliente vuelve a pedir el árbol al
            servidor igual, que es todo lo que se necesita.
            (Y el `<a>` además choca con `@next/next/no-html-link-for-pages`;
            saltárselo con un `eslint-disable` para copiar una justificación que
            no aplica sería el orden inverso del razonamiento.) */}
        <Link
          href="/expediente"
          className="text-sm text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
        >
          Volver a la lista de pacientes
        </Link>
      </div>
    )
  }

  if (profile.role === 'secretaria') redirect('/expediente')

  return <>{children}</>
}
