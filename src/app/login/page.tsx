'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, AlertTriangle, AlertCircle } from 'lucide-react'

/* ═══ /login — rediseñada para ser coherente con la landing pública ════════
   El sistema visual completo está en SPINUS_LANDING_MAESTRO.md. Lo que esta
   pantalla toma de él, y de dónde:

   · COLOR — solo tokens `--lp-*` (globals.css). NUNCA `--sp-*` ni hex
     literales: los `--sp-*` se redefinen bajo `html.dark` y `ThemeProvider`
     deja esa clase colgada en <html> al salir de (app), así que un médico
     que cierra sesión desde el tema oscuro vería esta pantalla invertida.
     La inmunidad al dark es la razón de existir del prefijo `--lp-*`.
     ⚠️ TRAMPA DE NOMBRES: `--lp-navy` (#1a3a5c) es el navy y `--lp-accent`
     (#1e5fa8) el azul brillante. Está invertido respecto a lo intuitivo en
     los tokens del producto (`--cp` es el navy, `--cs` el brillante, y
     `--sp-primary` apunta a `--cs`). Verifica el token, no deduzcas.
   · TIPOGRAFÍA — roles de §3.2: kicker 12px/+0.12em/1.0 (labels y pastilla),
     bajada 19px/−0.01em (el H1), cuerpo 17px/1.65 (inputs), caption 13px/1.45
     (microcopy y legales), y 15px para etiqueta de botón, que es el valor que
     usan los CTA de la landing (`SeccionCTA.tsx:185`).
   · ESPACIADO — escala única de §3.3: 8·12·16·24·32·48. Nada fuera de ella.
   · RADIOS — §3.1: cards 16px (`rounded-2xl`), botones y campos 12px
     (`rounded-xl`).
   · SUPERFICIES PLANAS — §3.1 elimina el glassmorphism. Esta pantalla venía
     con `bg-white/30 backdrop-blur-md` en la tarjeta y `bg-white/50
     backdrop-blur-md` en el aro del logo: los dos fuera. El fondo lo pone el
     layout (`--lp-wash`), no un canvas.

   ⚠️ EL ARO DEL LOGO DESAPARECIÓ, Y NO ES UN OLVIDO. Era un círculo de 96px
   con relleno translúcido, sombra y borde blanco, y existía para despegar el
   logo del canvas animado del `NeuralBackground`. Sobre superficie plana no
   despega nada de nada: es cromo sin trabajo. Con él se fue el `onError` que
   escondía la <img> — cuyo efecto real era dejar el aro VACÍO en pantalla, o
   sea convertir un fallo de asset en un adorno inexplicable.

   ⚠️ EL ANILLO DE FOCO NO SE DECLARA AQUÍ Y ESO ES CORRECTO. Lo sirve la
   regla única de globals.css, cuyo selector es `.font-lp :where(a, button,
   input, …):focus-visible` — descendientes de `.font-lp`, y esa clase la pone
   `src/app/login/layout.tsx` en el envoltorio. Por eso ningún control de este
   archivo lleva `focus:outline-none`: se lo comería.

   ⚠️ FUERA DE SCOPE EN ESTA TANDA, NO TOCAR SIN PLAN PROPIO: el blindaje
   offline del `useEffect`, el rate-limit, el `signOut` previo, el
   `window.location.href` final y el audit fire-and-forget de NOM-024. Lo
   único que se operó de la lógica son los cinco defectos listados abajo. */

/* Clase de error DISCRIMINADA — sustituye a `error.includes('expiró')`.
   Ese `includes` decidía si mostrar el enlace de recuperación mirando dentro
   de una cadena de UI: bastaba reescribir el copy (o traducirlo, o cambiar el
   acento) para que el enlace desapareciera sin que fallara nada. Ahora el
   dato es el `kind` y el texto es solo texto. */
type ErrorLogin =
  | { kind: 'enlace-expirado'; mensaje: string }
  | { kind: 'limite-intentos'; mensaje: string }
  | { kind: 'credenciales'; mensaje: string }

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorLogin | null>(null)
  const [sesionActiva, setSesionActiva] = useState<string | null>(null)

  /* `useId` en vez de ids fijos: asocia cada <label> con su control por
     `htmlFor`/`id` sin inventar cadenas que podrían chocar con otro id del
     documento. Antes los dos <label> no apuntaban a nada — un lector de
     pantalla anunciaba los campos sin nombre y el clic en la etiqueta no
     enfocaba el input. */
  const idEmail = useId()
  const idPassword = useId()

  /* ═══ CERROJO SÍNCRONO DE DOBLE ENVÍO ═════════════════════════════════════
     SEGUNDA capa, NO sustituto del `disabled={loading}` del botón. Las dos son
     necesarias porque protegen ventanas distintas:
     · `disabled={loading}` es un guard de RENDER. Cierra la ventana larga —
       desde que la petición sale hasta que llega la respuesta— pero no existe
       hasta que React vuelve a pintar.
     · Este `ref` es un guard SÍNCRONO. Cierra la rendija que el otro no puede:
       la que va desde el primer clic hasta ese repintado, cuando `disabled`
       todavía no está en el DOM. Un `useState` no sirve aquí — su escritura no
       es visible dentro del mismo tick.

     ⚠️ POR QUÉ ESTO NO ES UNA MICRO-OPTIMIZACIÓN, y conviene tenerlo escrito
     antes de que alguien lo revise a la baja: el limitador de intentos inserta
     una fila por CADA intento RECIBIDO, antes de saber si la contraseña es
     correcta (`lib/rateLimit.ts:88`, invocado desde la llamada de :130 de este
     archivo, mientras `signInWithPassword` no corre hasta :161). Un login
     EXITOSO no descuenta nada: los únicos DELETE de `ip_rate_limits` son la
     limpieza de filas ya vencidas (`rateLimit.ts:91-97`). El umbral es de 5
     por email en ventana deslizante de 15 minutos
     (`api/auth/rate-limit/route.ts:19`, corte en `rateLimit.ts:84`) y el
     producto NO expone ninguna vía de desbloqueo: solo esperar.
     Consecuencia aritmética de una ejecución duplicada: el presupuesto real
     baja de 5 envíos a 2, así que un médico que falla la contraseña dos veces
     y acierta a la tercera se queda bloqueado 15 minutos CON la contraseña
     correcta. Por eso el cerrojo va aquí y no en una capa de UI. */
  const submitLockRef = useRef(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('otp_expired')) {
      setError({
        kind: 'enlace-expirado',
        mensaje: 'El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.',
      })
    }

    // Sprint 3 Hotfix — Blindaje offline del login:
    // Si ya hay sesión local válida (cliente tiene tokens en localStorage),
    // redirect automático a /inicio sin pedir credenciales. Esto cubre el
    // caso en que el proxy server-side empuja al médico a /login en gray
    // zone mientras la sesión del cliente sigue intacta.
    const supabase = createClient()
    supabase.auth.getSession()
      .then(({ data: { session } }: { data: { session: { user: { email: string | null } } | null } }) => {
        if (session?.user?.email) {
          // Sesión válida local → volver a la app sin pedir credenciales
          router.push('/inicio')
          return
        }
        // Sin sesión local → flujo normal de login, detectar sesión residual
        return supabase.auth.getUser().then((res: { data: { user: { email: string } | null } }) => {
          if (res.data.user?.email) {
            setSesionActiva(res.data.user.email)
          }
        })
      })
      .catch(() => {
        // silent — si getSession/getUser fallan (SDK offline strict),
        // permitir el form de login normal
      })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    /* ⚠️ ESTO VA ANTES DE CUALQUIER setState, await o fetch, Y EL ORDEN ES LA
       FUNCIÓN ENTERA DEL CERROJO. La rendija que cierra es la que existe antes
       del primer `await`: dos clics en el mismo tick entran los dos al handler
       porque React todavía no ha repintado el botón con `disabled`. Si esta
       comprobación se mueve una sola línea más abajo —por ejemplo debajo de
       `setLoading(true)`— deja de servir para nada, porque `setLoading` no es
       síncrono y ambos clics seguirían pasando. Ver el bloque de
       `submitLockRef` arriba para el coste real de que pasen los dos. */
    if (submitLockRef.current) return
    submitLockRef.current = true

    /* El camino de ÉXITO no libera el cerrojo, y es deliberado: ver el
       `finally` del final. Se marca con esta bandera y no con un `return`
       dentro del `try`, porque un `return` NO se salta el `finally` — se
       ejecutaría igual y reabriría el botón justo en el hueco que queremos
       tapar. */
    let navegando = false

    try {
      setLoading(true)
      setError(null)

      // Sprint 3 Hotfix — Rate-limit offline-aware:
      // Si el browser reporta sin red, saltar el rate-limit completamente
      // (no hay ataques remotos sin red). Además wrap en try/catch como
      // safety net — el Service Worker NO intercepta POSTs (solo cachea
      // GETs), entonces offline real el fetch falla con TypeError. Sin
      // este wrap, el spinner del login quedaba eterno.
      const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false

      if (!isBrowserOffline) {
        try {
          const rlRes = await fetch('/api/auth/rate-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login_email', email }),
          })
          if (rlRes.status === 429) {
            const rlData: { error?: string } = await rlRes.json()
            setLoading(false)
            setError({
              kind: 'limite-intentos',
              mensaje: rlData.error ?? 'Demasiados intentos. Espera 15 minutos.',
            })
            /* Este `return` sale del handler pero NO se salta el `finally`:
               el cerrojo se libera igual, que es lo correcto — el usuario
               tiene que poder reintentar cuando pase la ventana. */
            return
          }
        } catch {
          // Red cayó durante el rate-limit check → procedemos sin rate-limit.
          // Si el signInWithPassword también falla por red, mostrará su
          // propio error abajo.
        }
      }

      const supabase = createClient()

      // Cerrar sesión activa antes de iniciar con otra cuenta.
      // clearMirror no se llama aquí — el backstop de startMirrorEngine
      // detecta cambio de mirrorUserId y limpia automáticamente al login
      // del nuevo usuario. La limpieza completa está en signOut() del AuthContext.
      if (sesionActiva) {
        await supabase.auth.signOut()
      }

      const { error: err } = await supabase.auth.signInWithPassword({ email, password })

      /* ⚠️ EL `setLoading(false)` VIVE DENTRO DE LA RAMA DE ERROR, NO ENCIMA DEL
         `if`. Antes se ejecutaba ANTES de decidir la rama, así que en el camino
         feliz el botón quedaba habilitado durante todo el hueco entre la
         respuesta de Supabase y la navegación de `window.location.href` — que no
         es instantánea: hay dos `fetch` de audit y una carga de documento de por
         medio. Un segundo clic en ese hueco disparaba un segundo
         `signInWithPassword`. En el camino de éxito `loading` NO se baja nunca a
         propósito: la página se está yendo, y rehabilitar el botón solo sirve
         para permitir el doble envío que este cambio cierra. */
      if (err) {
        setLoading(false)
        setError({
          kind: 'credenciales',
          mensaje: 'Credenciales incorrectas. Verifica tu correo y contraseña.',
        })
        // NOM-024: registrar intento fallido de login
        fetch('/api/auth/audit-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login_fallido', email }),
        }).catch(() => {})
      } else {
        sessionStorage.setItem('spinus_active', '1')
        // Solicitar persistencia de storage inmediatamente tras el gesto del login.
        // El click del botón cuenta como 'user activation' en Chromium/Firefox,
        // maximizando la probabilidad de 'granted' sin prompt intrusivo.
        // NOM-024: registrar login exitoso
        fetch('/api/auth/audit-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login_exitoso' }),
        }).catch(() => {})
        /* Se marca ANTES de la navegación: `window.location.href` no detiene la
           ejecución de esta función, así que el `finally` corre igualmente unas
           microtareas después, mientras el documento todavía está vivo. */
        navegando = true
        window.location.href = '/inicio'
      }
    } finally {
      /* ⚠️ EL CAMINO DE ÉXITO ES LA ÚNICA SALIDA QUE NO LIBERA EL CERROJO, Y NO
         ES UN OLVIDO. Tras `window.location.href` el documento se va, pero la
         navegación NO es instantánea: quedan dos `fetch` de audit en vuelo y la
         carga del documento nuevo. Si el cerrojo se liberara ahí, el botón
         volvería a aceptar clics durante ese hueco y reintroduciríamos el
         mismo doble envío que este cambio existe para matar — el gemelo exacto
         del defecto que ya se corrigió moviendo `setLoading(false)` dentro de
         la rama de error.
         Todas las demás salidas SÍ liberan, y por eso esto es seguro: el 429
         con su `return`, la rama de credenciales, y cualquier excepción que
         escape de `signInWithPassword`, `signOut` o `createClient`. El
         `finally` las cubre todas sin tener que enumerarlas, incluidas las
         salidas que alguien añada en el futuro. */
      if (!navegando) submitLockRef.current = false
    }
  }

  function handleVolverDashboard() {
    router.push('/inicio')
  }

  /* ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA, no sustituida.
     Centrar protege sólo mientras el contenido CABE: en cuanto desborda
     —formulario largo, teclado abierto, tipografía grande— el contenedor crece
     y la tarjeta se alinea arriba. Con `viewport-fit=cover` ese borde es el
     FÍSICO, y la franja navy de `globals.css` (`body::before`) es OPACA y mide
     lo que la muesca (47-59 px), así que se comía la cabecera.
     El `py-12` se parte en `pt` + `pb` A PROPÓSITO: dejar `py-12` y añadir un
     `pt-*` detrás haría que el ganador lo decidiera el orden de la hoja
     generada, no el del atributo. Los 48 px de diseño se conservan, y median
     casi lo mismo que la franja: sin esto la tarjeta la rozaba.
     En escritorio y en una pestaña normal el `env()` vale 0 y esto queda
     exactamente como estaba. */
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-12">
      <div className="w-full max-w-sm">

        {/* ═══ ENCABEZADO ═══
            El logo es el LCP de esta pantalla: es lo único con peso que se
            pinta sobre el pliegue, así que lleva `priority` para que Next
            emita su `<link rel="preload">` y no espere al descubrimiento del
            parser. `sizes` va acotado al tamaño realmente pintado —no a un
            `100vw` genérico— para que el srcset no sirva una variante de
            1200px a un hueco de 66.
            66×64 y no 64×64: el asset es 800×777, así que a 64 de alto le
            corresponden 65.9 de ancho. La medida de la escala de §3.3 es el
            ALTO (64); el ancho lo dicta la proporción, no una decisión de
            espaciado.
            `alt="Spinus"` — sin símbolo de marca registrada, y sin "Logo Dr.
            Ancona", que era el alt anterior y nombraba a una persona en vez
            de a la marca. */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-spinus.png"
            alt="Spinus"
            width={66}
            height={64}
            sizes="66px"
            priority
          />
          {/* Rol bajada (§3.2): 19px · −0.01em. El H1 nombra la TAREA, no la
              marca — de eso ya se encarga el logo de arriba, y un <h1> de
              texto repitiendo "Spinus" duplicaba el nombre accesible.
              ⚠️ Aquí murió el primero de los dos símbolos de marca registrada
              de este archivo (el H1 decía "Spinus" con él). §7·Global: la
              marca está EN TRÁMITE ante IMPI (exp. 3594483, sin registro
              concedido) y usarlo sin registro concedido es infracción.
              El glifo NO se escribe en este comentario a propósito: LP-DT-15
              inventaría los pendientes con `grep -rn` sobre el símbolo, y una
              mención en prosa dejaría este archivo contado como si le quedara
              deuda. */}
          <h1 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-[var(--lp-ink-900)]">
            {sesionActiva ? 'Cambiar de cuenta' : 'Inicia sesión'}
          </h1>
          {/* Rol caption (13px · 1.45). Antes iba en `text-slate-400`
              (#94a3b8, 2.85:1 sobre este fondo): por debajo de AA. */}
          <p className="mt-2 text-[13px] leading-[1.45] text-[var(--lp-ink-500)]">
            Gestión clínica inteligente para el especialista moderno
          </p>
        </div>

        {/* ═══ AVISO DE SESIÓN ACTIVA ═══
            Tokens de aviso de globals.css. El icono va en `--lp-warn-strong`
            (decorativo, `aria-hidden`) y TODO el texto en `--lp-warn`, que es
            el que mide 4.68:1 sobre `--lp-warn-bg`. El `-strong` NO se usa
            como texto en ningún sitio: sobre ese mismo fondo da 2.97:1. */}
        {sesionActiva && (
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-[var(--lp-warn-border)] bg-[var(--lp-warn-bg)] p-4 text-[13px] leading-[1.45] text-[var(--lp-warn)]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--lp-warn-strong)]" aria-hidden="true" />
            <div>
              <p className="font-semibold">Sesión activa</p>
              <p className="mt-2">
                Tienes una sesión abierta como <strong className="font-semibold">{sesionActiva}</strong>.
                Al iniciar sesión con otra cuenta, se cerrará la sesión actual.
              </p>
              <button
                type="button"
                onClick={handleVolverDashboard}
                className="mt-2 font-semibold underline underline-offset-2 transition-opacity duration-[var(--sp-dur-micro)] hover:opacity-80"
              >
                Volver al dashboard →
              </button>
            </div>
          </div>
        )}

        {/* ═══ TARJETA ═══ superficie plana, radio de card (16px). */}
        <div className="mt-8 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface)] p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              {/* Rol kicker (§3.2): 12px · +0.12em · 1.0. */}
              <label
                htmlFor={idEmail}
                className="block text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-ink-500)]"
              >
                Correo electrónico
              </label>
              {/* `autoComplete="username"` y no `"email"`: en un formulario de
                  acceso, el identificador de cuenta es el token `username`
                  aunque el control sea `type="email"`. Es lo que hace que los
                  gestores de contraseñas emparejen este campo con el de
                  contraseña de abajo y ofrezcan la credencial guardada. Antes
                  no había ningún `autoComplete` y el autorrelleno era una
                  lotería del heurístico del navegador.
                  Borde `--lp-border-control` (3.35:1) y no `--lp-border`
                  (1.20:1): en un campo blanco sobre tarjeta blanca el borde es
                  lo ÚNICO que dibuja el límite del control, y WCAG 1.4.11 le
                  exige 3:1. El razonamiento completo está en globals.css.
                  Sin `focus:outline-none`: el anillo lo pone la regla global. */}
              <input
                id={idEmail}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder="correo@ejemplo.com"
                required
                className="mt-2 w-full rounded-xl border border-[var(--lp-border-control)] bg-[var(--lp-surface)] px-4 py-3 text-[17px] leading-[1.65] text-[var(--lp-ink-900)] placeholder:text-[var(--lp-ink-500)] transition-colors duration-[var(--sp-dur-micro)] focus:border-[var(--lp-accent)]"
              />
            </div>

            <div>
              <label
                htmlFor={idPassword}
                className="block text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-ink-500)]"
              >
                Contraseña
              </label>
              <div className="relative mt-2">
                <input
                  id={idPassword}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-[var(--lp-border-control)] bg-[var(--lp-surface)] px-4 py-3 pr-12 text-[17px] leading-[1.65] text-[var(--lp-ink-900)] placeholder:text-[var(--lp-ink-500)] transition-colors duration-[var(--sp-dur-micro)] focus:border-[var(--lp-accent)]"
                />
                {/* El botón-ojo no tenía nombre accesible NINGUNO: su único
                    contenido era un <svg> de lucide, que se anuncia como
                    "botón" y nada más. `aria-label` lo nombra y `aria-pressed`
                    comunica el estado —contraseña visible o no—, que es
                    información que hasta ahora solo existía como forma del
                    icono. El `aria-controls` dice sobre qué campo actúa.
                    El icono va `aria-hidden`: ya lo describe la etiqueta.
                    El `-translate-y-1/2` es centrado estático, no animación. */}
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPass}
                  aria-controls={idPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--lp-ink-500)] transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-ink-900)]"
                >
                  {showPass
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* ═══ ERROR ═══
                `role="alert"` + `aria-live="assertive"`: el bloque se inserta
                en el DOM cuando ya hay algo que decir, y sin esto un lector de
                pantalla no anunciaba nada — el usuario pulsaba "Iniciar
                sesión", el foco seguía en el botón y el mensaje aparecía en
                silencio a 200px de distancia. Los dos atributos van juntos a
                propósito aunque `role="alert"` ya implique live-assertive:
                explicitar la región es lo que hace que el comportamiento no
                dependa de la tabla de mapeo del lector.
                El enlace de recuperación cuelga del `kind`, no del texto. */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 rounded-xl border border-[var(--lp-danger-border)] bg-[var(--lp-danger-bg)] p-4 text-[13px] leading-[1.45] text-[var(--lp-danger-ink)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-[var(--lp-danger)]" aria-hidden="true" />
                <div>
                  <p>{error.mensaje}</p>
                  {error.kind === 'enlace-expirado' && (
                    <Link
                      href="/forgot-password"
                      className="mt-2 inline-block font-semibold underline underline-offset-2 transition-opacity duration-[var(--sp-dur-micro)] hover:opacity-80"
                    >
                      Solicitar nuevo enlace →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* ═══ PRIMARIO ═══
                Movimiento en registro Linear (§4.1, "tejido"): respuesta
                inmediata, `--sp-dur-micro`, solo `transform` y color. Es el
                mismo gesto que los CTA de la landing —`hover:-translate-y-0.5`
                + `active:scale-[0.97]`— para que el botón se sienta igual en
                las dos superficies. Ningún escenario, ninguna entrada animada:
                una pantalla de tarea no gana nada haciéndose esperar.
                ⚠️ SIN `disabled:opacity-*`. Es el mismo error que la orden
                proscribe en el botón de Google: bajar la opacidad de un relleno
                `--lp-accent` deja el texto blanco por debajo de 2.5:1 justo
                cuando dice algo que importa ("Iniciando sesión…"). El estado
                ya lo comunican el spinner y la etiqueta; `pointer-events-none`
                basta para que no se pueda pulsar. */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--lp-accent)] px-4 py-4 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-inverse)] transition-all duration-[var(--sp-dur-micro)] hover:bg-[var(--lp-navy)] hover:-translate-y-0.5 active:scale-[0.97] disabled:pointer-events-none"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Iniciando sesión…</>
                : sesionActiva ? 'Cambiar de cuenta' : 'Iniciar sesión'}
            </button>

            {/* Separador. El `h-px` es grosor de filete, no espaciado. */}
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-[var(--lp-border)]" aria-hidden="true" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-ink-500)]">o</span>
              <span className="h-px flex-1 bg-[var(--lp-border)]" aria-hidden="true" />
            </div>

            {/* ═══ GOOGLE — DESHABILITADO, SOLO TEXTO ═══
                ⚠️ SIN LOGO DE GOOGLE Y SIN LA "G", A PROPÓSITO. La integración
                NO EXISTE: no hay proveedor OAuth de Google configurado en este
                flujo. Un botón con la marca y el tratamiento oficial afirma una
                capacidad que el producto no tiene, que es exactamente lo que
                §2·1 prohíbe del lado del demo. La pastilla "Próximamente" es lo
                que convierte la afirmación falsa en una promesa declarada.
                ⚠️ PROHIBIDO `opacity-40` (ni ningún otro apagado global) para
                "verse deshabilitado". Sobre `--lp-surface-sunken` deja el texto
                en 1.76:1, ilegible: el usuario no puede leer QUÉ es lo que no
                puede usar. Lo deshabilitado se comunica con el estado del
                control (`disabled` + `aria-disabled`), el relleno hundido y el
                cursor — nunca borrando el texto. Va a OPACIDAD PLENA.
                Borde `--lp-border` (1.20:1) y no `--lp-border-control`: WCAG
                1.4.11 exime expresamente a los componentes inactivos, y aquí el
                borde bajo es además la señal de que el control no está vivo.
                La pastilla usa el tratamiento de kicker (12px, +0.12em, 1.0). */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-[var(--lp-border)] bg-[var(--lp-surface-sunken)] px-4 py-4 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--lp-ink-700)]"
            >
              Continuar con Google
              <span className="rounded-full bg-[var(--lp-accent-bg)] px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--lp-accent)]">
                Próximamente
              </span>
            </button>

            {/* Rol caption. Los dos enlaces suben a `--lp-ink-500` (5.44:1):
                venían en `text-slate-400`, por debajo de AA. */}
            <div className="space-y-2 pt-2 text-center text-[13px] leading-[1.45] text-[var(--lp-ink-500)]">
              <Link
                href="/forgot-password"
                className="block transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-accent)]"
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <p>
                ¿No tienes cuenta?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-[var(--lp-accent)] transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-navy)]"
                >
                  Regístrate gratis
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* ═══ LEGAL ═══
            ⚠️ Aquí murió el segundo símbolo de marca registrada del archivo
            —el aviso decía "© 2026 Spinus" con él— (§7·Global, IMPI 3594483).
            El enlace apunta a `/privacy` y ya no a `/privacidad`: es la ruta
            que usa el footer de la landing (`SeccionFooter.tsx:91`) y las dos
            renderizan el MISMO componente (`AvisoPrivacidadContent`), así que
            el cambio no puede dar 404. Que existan dos rutas para un solo
            aviso es deuda propia y no se resuelve aquí.
            `rel="noopener noreferrer"` es obligatorio con `target="_blank"` y
            faltaba: sin `noopener`, la pestaña abierta recibe `window.opener`
            y puede reescribir la URL de la pestaña de origen — que es la del
            login. */}
        <p className="mt-8 text-center text-[13px] leading-[1.45] text-[var(--lp-ink-500)]">
          © 2026 Spinus · Todos los derechos reservados
          <br />
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-[var(--sp-dur-micro)] hover:text-[var(--lp-accent)]"
          >
            Aviso de privacidad
          </Link>
        </p>
      </div>
    </main>
  )
}
