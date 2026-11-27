'use client'

import { Loader2, RefreshCw, LogIn, LogOut } from 'lucide-react'
import EstadoError from '@/components/ui/EstadoError'
import { IconoGoogleCalendar } from '@/components/ui/MarcaOrigen'

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
          chip={<span className="skeleton h-6 w-[104px] rounded-full" />}
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
        <EstadoError
          variante="tarjeta"
          mensaje="Google no respondió. Tu conexión sigue guardada; no hace falta que la rehagas."
          alReintentar={onReintentar}
        />
      </Card>
    )
  }

  const conectado = estado === 'conectado'

  return (
    <>
      <Card>
        <Cabecera
          apoyo={conectado
            ? 'Sincronización activa — las citas se crean automáticamente.'
            : 'Conecta una cuenta para sincronizar tus citas.'}
          chip={conectado
            ? <Chip tono="ok" texto="Conectado" />
            : <Chip tono="neutro" texto="Sin conectar" />}
        />

        <div className="flex flex-col">
          <FilaDato etiqueta="Calendario" valor={conectado ? nombreCalendario : null} />
          <FilaDato etiqueta="Cuenta de Google" valor={conectado ? cuentaEmail : null} />
          {/* La nota se conserva en los DOS estados, como pide el spec: es la
              que evita el soporte por confusión de cuentas. */}
          <p className="pt-1 text-[13px] leading-[18px] text-tinta2">
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
          <p role="alert" className="rounded-[12px] bg-mal-fondo px-4 py-3 text-[14px] leading-5 text-mal-tinta">
            {aviso}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {conectado ? (
            <>
              <button
                type="button"
                onClick={onRecrear}
                disabled={recreando || desconectando}
                className="k-b k-b-tonal"
              >
                {recreando ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <RefreshCw size={16} aria-hidden="true" />}
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
                className="k-b k-b-texto px-3 text-[14px] text-mal-tinta"
              >
                {desconectando ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <LogOut size={16} aria-hidden="true" />}
                Desconectar
              </button>
            </>
          ) : (
            /* Un solo botón. Ni «Recrear» ni «Desconectar» ni la nota de
               desconexión: no hay nada que recrear ni que desconectar. */
            <a href="/api/google/connect" className="k-b k-b-prim">
              <LogIn size={16} aria-hidden="true" /> Conectar
            </a>
          )}
        </div>
      </Card>

      {conectado && (
        <section>
          <p className="px-1 text-[13px] leading-[18px] text-tinta2">
            Al desconectar, las citas dejan de escribirse en Google. Las que ya se crearon se quedan
            en tu calendario.
          </p>
        </section>
      )}
    </>
  )
}

/* ── Piezas ──────────────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return <section className="k-tarjeta flex flex-col gap-4 esc:p-5">{children}</section>
}

function Cabecera({ apoyo, chip }: { apoyo: string; chip?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-sup2">
        <IconoGoogleCalendar size={22} />
      </span>
      <div className="min-w-0 flex-1 basis-[160px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="k-t-tarjeta">Google Calendar</h2>
          {chip}
        </div>
        <p className="k-t-sec mt-0.5">{apoyo}</p>
      </div>
    </div>
  )
}

/**
 * ⚠️ ES HERMANO DEL CHIP DE `piezasDatos.tsx`. LO QUE NO PUEDE DIVERGIR es la
 * regla: el invitado se resuelve antes de mirar el estado, y ahí no hay chip.
 * «Sin conectar» va en tinta SECUNDARIA, nunca en terciaria (contraste).
 */
function Chip({ tono, texto }: { tono: 'ok' | 'warn' | 'neutro'; texto: string }) {
  const clase = tono === 'ok' ? 'k-etq-ok' : tono === 'warn' ? 'k-etq-aviso' : 'bg-sup2 text-tinta2'
  return <span className={`k-etq ${clase}`}>{texto}</span>
}

/** Fila de dato. Sin valor pinta una raya larga, como pide el spec. */
function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-t border-linea py-2">
      <p className="text-[13px] leading-[18px] text-tinta2">{etiqueta}</p>
      <p className="min-w-0 truncate text-[15px] font-semibold leading-5 text-tinta">{valor || '—'}</p>
    </div>
  )
}

function Bloque({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-fondo px-4 py-3">
      <p className="text-[14px] leading-5 text-tinta">{children}</p>
    </div>
  )
}

function Fuerte({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-tinta">{children}</strong>
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
