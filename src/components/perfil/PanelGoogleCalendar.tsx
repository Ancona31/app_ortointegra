'use client'

import { Loader2, RefreshCw, LogIn, LogOut, WifiOff } from 'lucide-react'
import { AvisoColumna } from '@/components/dashboard/piezasBanda2'
import { GoogleGIcon } from '@/components/perfil/piezasDatos'

/**
 * Región 5 del spec: la pestaña Google Calendar.
 *
 * ⚠️ SON CUATRO CAMINOS, NO DOS, Y EL ORDEN EN QUE SE RESUELVEN ES LA MITAD DEL
 * TRABAJO. El spec sólo contempla «conectado» y «sin conectar». La app tiene dos
 * más, y los dos existen porque en su día se corrigió un fallo real:
 *
 *   1. MÉDICO INVITADO — se resuelve ANTES de mirar el estado. `/api/google/*`
 *      está entero tras `canManageClinica`, así que a él le contestan 403; ese
 *      403 no trae campo `estado` y el `?? 'error_google'` de quien llama lo
 *      deja en el casillero de fallo. Leído de ahí se le anunciaba «Google no
 *      respondió, tu conexión sigue guardada»: dos frases falsas para él
 *      —Google contestó, contestó que no, y conexión suya no hay ninguna—.
 *   2. FALLO DE GOOGLE (`error_google`) — hay token y lo que falló fue el
 *      tercero. NO es «sin conectar»: ofrecerle «Conectar» sería mandarle a
 *      rehacer algo que no está roto. Lo único accionable es volver a preguntar.
 *   3. SIN CONECTAR (`sin_token`) — el único donde «Conectar» significa algo.
 *   4. CONECTADO.
 *
 * ⚠️ NO LO REDUZCAS A DOS ESTADOS. Es exactamente la regresión que estas ramas
 * evitan. Y si reordenas, el invitado tiene que seguir saliendo el primero.
 */

type EstadoGcal = 'conectado' | 'sin_token' | 'error_google'

export default function PanelGoogleCalendar({
  esAdmin, estado, nombreCalendario, cuentaEmail, aviso, nombreParaGoogle,
  recreando, desconectando, onReintentar, onRecrear, onDesconectar,
}: {
  esAdmin: boolean
  /** null = todavía verificando. */
  estado: EstadoGcal | null
  nombreCalendario: string | null
  /** null = identidad desconocida, NUNCA «sin cuenta». */
  cuentaEmail: string | null
  /** El texto del `?gcal_error=` con el que se volvió aquí, si lo hubo. */
  aviso: string | null
  /** Cómo se llamará el calendario: «Spinus - » y esto. */
  nombreParaGoogle: string
  recreando: boolean
  desconectando: boolean
  onReintentar: () => void
  onRecrear: () => void
  onDesconectar: () => void
}) {
  /* ⚠️ EL INVITADO, PRIMERO. Ver la cabecera del archivo: mirar `estado` antes
     que el rol es lo que producía el mensaje falso. */
  if (!esAdmin) {
    return (
      <Card>
        <Cabecera apoyo="La conexión es una por clínica y da servicio a todo el equipo." />
        <Bloque>
          La gestiona quien administra la clínica: es una para todo el equipo, así que tus citas se
          sincronizan sin que tengas que conectar nada.
        </Bloque>
      </Card>
    )
  }

  /* Carga: sólo el chip en esqueleto. El resto NO se pinta hasta conocer el
     estado, para no enseñar acciones equivocadas medio segundo. */
  if (estado === null) {
    return (
      <Card>
        <Cabecera
          apoyo="Comprobando la conexión…"
          chip={<span className="skeleton h-[28px] w-[112px] rounded-[var(--sp-r-pill)]" />}
        />
      </Card>
    )
  }

  if (estado === 'error_google') {
    return (
      <Card>
        <Cabecera
          apoyo="No se pudo comprobar la conexión."
          chip={<Chip tono="warn" texto="Sin respuesta" />}
        />
        <AvisoColumna
          icono={WifiOff}
          mensaje="Google no respondió. Tu conexión sigue guardada; no hace falta que la rehagas."
          onReintentar={onReintentar}
        />
      </Card>
    )
  }

  const conectado = estado === 'conectado'

  return (
    <>
      <Card protagonista={conectado}>
        <Cabecera
          apoyo={conectado
            ? 'Sincronización activa — las citas se crean automáticamente.'
            : 'Conecta una cuenta para sincronizar tus citas.'}
          chip={conectado
            ? <Chip tono="ok" texto="Conectado" />
            : <Chip tono="neutro" texto="Sin conectar" />}
        />

        <div className="flex flex-col gap-[var(--sp-2-5)]">
          <FilaDato etiqueta="Calendario" valor={conectado ? nombreCalendario : null} />
          <FilaDato etiqueta="Cuenta de Google" valor={conectado ? cuentaEmail : null} />
          {/* La nota se conserva en los DOS estados, como pide el spec: es la
              que evita el soporte por confusión de cuentas. */}
          <p className="sp-hint">
            Puede ser una cuenta distinta a la que usas para entrar en Spinus.
          </p>
        </div>

        {conectado ? (
          /* ⚠️ TEXTO ÍNTEGRO, NO SE REESCRIBE NI SE ABREVIA (spec §8, fila 8).
             Quitar el calendario de la lista de Google es indetectable desde
             aquí —`calendarList.get` pide un permiso sensible que no pedimos—,
             así que este aviso ES la prevención. */
          <Bloque>
            {nombreCalendario ? (
              <>
                Tus citas se sincronizan al calendario <Fuerte>{nombreCalendario}</Fuerte> de{' '}
                <CuentaGoogle email={cuentaEmail} />. No lo borres{' '}
                <strong>ni lo quites de tu lista de calendarios</strong>: si desaparece de tu lista,
                Spinus sigue escribiendo en él y tú dejas de verlo. Si ya te pasó, usa
                &quot;Recrear calendario&quot;.
              </>
            ) : (
              <>
                Todavía no hay un calendario de Spinus en <CuentaGoogle email={cuentaEmail} />. Se
                creará solo la próxima vez que abras la agenda.
              </>
            )}
          </Bloque>
        ) : (
          <Bloque>
            Al conectar una cuenta de Google, Spinus creará en ella un calendario propio llamado{' '}
            <Fuerte>{nombreParaGoogle ? `Spinus - ${nombreParaGoogle}` : 'Spinus'}</Fuerte> y escribirá
            ahí tus citas automáticamente. Puede ser una cuenta distinta a la que usas para entrar
            en Spinus.
          </Bloque>
        )}

        {/* El aviso del redirect va DENTRO de la card y sin tocar los botones:
            el spec pide conservar «Conectar» cuando la conexión falló. */}
        {aviso && (
          <p
            className="rounded-[var(--sp-r-note)] px-[var(--sp-4)] py-[var(--sp-3)] text-[length:var(--sp-fs-hint)] leading-[var(--sp-lh-body)] text-[var(--sp-danger-ink)]"
            style={{ background: 'var(--sp-danger-bg)', border: 'var(--sp-bw-hair) solid var(--sp-danger-border)' }}
          >
            {aviso}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-[var(--sp-gap-item)] max-sm:flex-col max-sm:items-stretch">
          {conectado ? (
            <>
              <button
                type="button"
                onClick={onRecrear}
                disabled={recreando || desconectando}
                className="sp-btn sp-btn--secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {recreando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Recrear calendario
              </button>

              {/* Desconectar borra la conexión de la CLÍNICA ENTERA. Va de
                  contorno con el color de error: destructiva, pero no compite
                  con un primario. El servidor la gatea también; esto es la
                  interfaz acompañando a la regla, no la regla. */}
              <button
                type="button"
                onClick={onDesconectar}
                disabled={desconectando || recreando}
                className="sp-btn disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: 'transparent',
                  color: 'var(--sp-danger)',
                  border: 'var(--sp-bw-hair) solid var(--sp-danger-border)',
                  fontSize: 'var(--sp-fs-btn-sm)',
                  fontWeight: 'var(--sp-fw-semi)',
                  padding: '13px 24px',
                }}
              >
                {desconectando ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Desconectar
              </button>
            </>
          ) : (
            /* Un solo botón. Ni «Recrear» ni «Desconectar» ni la nota de
               desconexión: no hay nada que recrear ni que desconectar. */
            <a href="/api/google/connect" className="sp-btn sp-btn--primary max-sm:justify-center">
              <LogIn size={16} /> Conectar
            </a>
          )}
        </div>
      </Card>

      {conectado && (
        <section className="sp-card">
          <p className="sp-hint">
            Al desconectar, las citas dejan de escribirse en Google. Las que ya se crearon se quedan
            en tu calendario.
          </p>
        </section>
      )}
    </>
  )
}

/* ── Piezas ──────────────────────────────────────────────────────────────── */

function Card({ children, protagonista }: { children: React.ReactNode; protagonista?: boolean }) {
  return (
    <section className={`${protagonista ? 'sp-card sp-card--hero' : 'sp-card'} flex flex-col gap-[var(--sp-4-5)]`}>
      {children}
    </section>
  )
}

function Cabecera({ apoyo, chip }: { apoyo: string; chip?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[var(--sp-3)]">
      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--sp-r-icon-lg)] bg-[var(--sp-surface-muted)]">
        <GoogleGIcon size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[length:var(--sp-fs-modal)] font-bold text-[var(--sp-ink-800)]">Google Calendar</h2>
        <p className="sp-hint mt-[var(--sp-gap-title-sub)]">{apoyo}</p>
      </div>
      {chip && <div className="shrink-0">{chip}</div>}
    </div>
  )
}

/**
 * ⚠️ ES HERMANO DEL CHIP DE `piezasDatos.tsx`, NO EL MISMO. Aquél es el vistazo
 * compacto de la pestaña Datos (relleno 5×12, punto 7 px); éste es el de la card
 * protagonista y el anexo del spec le da otra medida (6×13, punto 8, texto 13).
 * Se duplican a propósito, como manda el proyecto con dos consumidores. LO QUE
 * NO PUEDE DIVERGIR es la regla de arriba: el invitado se resuelve antes de
 * mirar el estado, y ahí no hay chip que enseñar. Si tocas uno, mira el otro.
 *
 * «Sin conectar» va en tinta SECUNDARIA sobre superficie neutra, nunca en
 * terciaria: sobre ese gris no llega al contraste mínimo (spec §5).
 */
function Chip({ tono, texto }: { tono: 'ok' | 'warn' | 'neutro'; texto: string }) {
  const pinta = tono === 'ok'
    ? { fondo: 'var(--sp-success-bg)', tinta: 'var(--sp-success)', punto: 'var(--sp-success-dot)' }
    : tono === 'warn'
      ? { fondo: 'var(--sp-warn-bg)', tinta: 'var(--sp-warn)', punto: 'var(--sp-warn-dot)' }
      : { fondo: 'var(--sp-surface-muted)', tinta: 'var(--sp-ink-500)', punto: 'var(--sp-ink-350)' }

  return (
    <span
      className="inline-flex items-center gap-[var(--sp-2)] whitespace-nowrap rounded-[var(--sp-r-pill)] px-[13px] py-[6px] text-[length:var(--sp-fs-meta)] font-bold"
      style={{ background: pinta.fondo, color: pinta.tinta }}
    >
      <span className="h-[8px] w-[8px] rounded-[var(--sp-r-pill)]" style={{ background: pinta.punto }} />
      {texto}
    </span>
  )
}

/** Fila de dato. Sin valor pinta una raya larga, como pide el spec. */
function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-[var(--sp-4)] gap-y-[var(--sp-1)] pt-[var(--sp-2-5)]"
      style={{ borderTop: 'var(--sp-bw-hair) solid var(--sp-line-divider)' }}
    >
      <p className="text-[length:var(--sp-fs-label-sm)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
        {etiqueta}
      </p>
      <p className="min-w-0 truncate text-[length:var(--sp-fs-body-sm)] font-semibold text-[var(--sp-ink-700)]">
        {valor || '—'}
      </p>
    </div>
  )
}

function Bloque({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--sp-r-card-inner)] bg-[var(--sp-surface-muted)] px-[var(--sp-4-5)] py-[var(--sp-4)]">
      <p className="text-[length:var(--sp-fs-meta)] leading-[var(--sp-lh-note)] text-[var(--sp-ink-700)]">
        {children}
      </p>
    </div>
  )
}

function Fuerte({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-[var(--sp-ink-800)]">{children}</strong>
}

/**
 * Cómo se nombra la cuenta. Con correo se nombra; sin él se dice «tu cuenta de
 * Google», que es exactamente lo que la nota decía antes de que este dato
 * existiera. `null` es identidad DESCONOCIDA —conexiones anteriores a los
 * scopes `openid`/`email`—, nunca «sin cuenta»: no se inventa ningún «cuenta
 * desconocida».
 */
function CuentaGoogle({ email }: { email: string | null }) {
  return email
    ? <>la cuenta de Google <Fuerte>{email}</Fuerte></>
    : <>tu cuenta de Google</>
}
