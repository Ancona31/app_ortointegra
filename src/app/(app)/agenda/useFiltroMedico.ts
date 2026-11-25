'use client'

/**
 * src/app/(app)/agenda/useFiltroMedico.ts
 *
 * El filtro de médico de la agenda: la elección del usuario, la semilla por
 * rol mientras no haya elegido nada, el espejo síncrono que necesita
 * `cambiarVista` y la imposición/reversión del médico al entrar y salir de
 * Mes. Sin efectos. Movido tal cual desde `AgendaCliente.tsx` (A2.5.4,
 * movimiento puro, con sus comentarios); sólo cambiaron los parámetros, el
 * retorno y que `profile`/`medicos`/etc. llegan por parámetro en vez de la
 * clausura del componente.
 */

import { useRef, useState } from 'react'
import type { Profile } from '@/hooks/useProfile'
import type { MedicoConfig } from '@/lib/configApp'

interface Params {
  profile: Profile | null
  cargandoPerfil: boolean
  isSecretaria: boolean
  defaultMedicoId: string
  medicos: readonly MedicoConfig[]
  isSingleDoctor: boolean
}

export function useFiltroMedico({
  profile, cargandoPerfil, isSecretaria, defaultMedicoId, medicos, isSingleDoctor,
}: Params) {
  /* ⚠️ ESTE ESTADO YA NO ES «EL FILTRO»: ES LO QUE EL USUARIO HA ELEGIDO A MANO,
     y `null` significa «todavía no ha elegido nada». El filtro que de verdad
     manda es `filtroEfectivo`, unas líneas más abajo.

     Por qué hizo falta partirlo en dos. La agenda abre ahora con el médico que
     le toca al rol, y el rol llega TARDE: `useProfile` arranca en null y
     resuelve en una promesa, mientras que la traída inicial de FullCalendar sale
     en su efecto de montaje —efecto de hijo, o sea ANTES que el del padre—. Con
     un solo estado sólo había dos salidas, y las dos malas: sembrar en un efecto
     y pagar una traída de «todos los médicos» antes de corregirla (la traída
     cara, justo la que este cambio viene a evitar, y un parpadeo de la agenda
     entera), o sembrar en el `useState` inicial, donde el perfil todavía no
     existe.

     Con dos piezas no hay siembra que hacer: la elección del usuario, cuando la
     hay, TAPA a la semilla; mientras no la haya, manda la semilla. Y `null` no
     es lo mismo que `''` — `''` es una elección legítima («Todos los médicos») y
     tiene que ganarle a la semilla, que es exactamente lo que hace `??`. Con un
     `||` en su lugar, elegir «Todos» rebotaría a la semilla y el desplegable no
     obedecería. */
  const [filtroMedico, setFiltroMedico] = useState<string | null>(null)

  /* ⚠️⚠️ EL ESPEJO SÍNCRONO DEL FILTRO, Y EXISTE POR UNA RAZÓN DE ORDEN QUE NO SE
     VE LEYENDO EL RENDER. `null` = nadie ha escrito todavía; manda `filtroEfectivo`.

     `cambiarVista` llama a `api.changeView(...)`, que es SÍNCRONO: FullCalendar
     pide las citas EN ESA MISMA LÍNEA, y lo hace a través de
     `appointmentSourceRef.current`, que todavía apunta al closure del render
     anterior. O sea que un `setFiltroMedico(x)` puesto justo antes NO llega a
     tiempo: la petición sale con el filtro VIEJO.

     Eso, en el paso a Mes, es exactamente la petición que este bloque viene a
     eliminar —seis semanas por TODOS los médicos, la que se come el techo de mil
     filas—, seguida de una segunda ya corregida. Dos peticiones y la cara igual
     pagada.

     Con el espejo, las dos fuentes leen ESTO antes que su closure, así que la
     traída síncrona sale ya con el médico correcto y no hay traída cara.

     ⚠️ `''` ES UN VALOR ESCRITO, NO «vacío». Significa «todos los médicos» y
     tiene que ganarle al closure igual que un id — es lo que hace que la vuelta a
     «Todos» al salir de Mes también sea síncrona. Por eso el centinela de «nadie
     ha escrito» es `null` y la lectura es `?? filtroEfectivo`, nunca `||`.

     ⚠️ NO TOCA LA IDENTIDAD DE NINGUNA FUENTE. Es un ref: no entra en las deps de
     `appointmentSource`/`gcalSource`, que siguen dependiendo de `filtroEfectivo`,
     ni en las de `stableAppointmentSource`, `stableGcalSource` o
     `eventSourcesStable`, que siguen como estaban. */
  const filtroSincronoRef = useRef<string | null>(null)

  /* El médico que PUSIMOS NOSOTROS al entrar en Mes, o `null` si el filtro de
     ahora lo eligió una persona. Es lo único que distingue una imposición del
     sistema de una decisión del usuario, y de esa distinción vive la vuelta a
     «Todos» al salir de Mes: se deshace lo que impusimos, nunca lo que se eligió.

     Un REF y no estado: no pinta nada. Quien pinta es `filtroMedico`. */
  const medicoForzadoRef = useRef<string | null>(null)

  /* ── CON QUÉ MÉDICO ABRE LA AGENDA ────────────────────────────────────────
     Médico y administrador abren en SU agenda; la secretaria, en todas. En los
     tres casos el desplegable sigue entero: esto decide con qué se abre, no qué
     se puede elegir después.

     ⚠️ REUTILIZA `defaultMedicoId` Y NO LO DUPLICA. Ese `useMemo` ya contestaba
     esta misma pregunta para el modal —«¿de quién es esto por defecto?»— y para
     un `role: 'medico'` devuelve `profile.id` sin depender de que `medicos` haya
     llegado, que es lo que hace que la semilla del caso principal esté lista en
     cuanto lo está el perfil. La ÚNICA excepción es la secretaria: allí
     `defaultMedicoId` vale `''` para obligar a elegir en el modal, salvo en una
     clínica de un solo médico, donde devuelve a ése — y para el FILTRO eso sería
     abrir con un filtro puesto a quien su trabajo pide ver todo. De ahí la rama.

     ⚠️ `null` MIENTRAS SE CARGA EL PERFIL, Y NO `''`. No es un tecnicismo: es lo
     que impide que salga una traída de «todos los médicos» antes de saber el
     rol. Quien lo aprovecha es el gate de las dos fuentes; ver
     `filtroDecididoRef`. Si alguien pone aquí `''` de arranque «para simplificar»,
     vuelve la traída cara en cada apertura y este bloque entero deja de servir.

     Por qué NO es un efecto que llame a `setFiltroMedico`: un efecto corre
     DESPUÉS del primer commit, o sea después de que FullCalendar ya haya pedido.
     Derivarlo en render es lo que deja la primera petición ya correcta. */
  const semillaFiltro = cargandoPerfil ? null : (isSecretaria ? '' : defaultMedicoId)

  /* El filtro que manda, y el que leen TODOS los consumidores: la elección del
     usuario si la hay, y si no la semilla. `null` = todavía no se sabe. */
  const filtroEfectivo = filtroMedico ?? semillaFiltro

  /* Escribe el filtro POR LOS DOS CAMINOS a la vez, y todos los que lo cambian
     pasan por aquí: los dos desplegables y el paso a Mes.

       · el estado, que es quien manda en el render siguiente y quien pinta;
       · el espejo, que es lo único que puede leer un `changeView` síncrono;
       · la marca de forzado, que decide si esto se deshace al salir de Mes.

     ⚠️ `forzado` NO ES UN DETALLE: es la diferencia entre una imposición nuestra
     y una elección de la persona. Cualquier escritura hecha a mano lo pone en
     `false` y con eso el médico deja de ser reversible, que es justo lo que pide
     D3 —«si el usuario eligió a alguien, se respeta»—. */
  function aplicarFiltro(id: string, forzado: boolean) {
    setFiltroMedico(id)
    filtroSincronoRef.current = id
    medicoForzadoRef.current = forzado ? id : null
  }

  /* A quién se selecciona al entrar en Mes sin nadie puesto: al propio usuario si
     es médico, y si no al primero de la lista.

     ⚠️ NO REUTILIZA `defaultMedicoId`, y no por descuido: aquél devuelve `''` para
     la secretaria a propósito —para obligarla a elegir en el MODAL—, y `''` es
     precisamente el valor que aquí no puede salir. Son dos preguntas distintas
     con la misma forma.

     ⚠️ EL `find` NO SOBRA. Un médico cuyo id no esté en la lista de la clínica
     dejaría el desplegable enseñando un valor que no es ninguna de sus opciones,
     y el `<select>` caería a la primera. Ante la duda, el primero de la lista. */
  function medicoQueForzar(): string | null {
    if (profile?.role === 'medico' && profile.id && medicos.some(m => m.id === profile.id)) {
      return profile.id
    }
    return medicos[0]?.id ?? null
  }

  /* Mes con «Todos» no existe: mil filas entre seis semanas son 24 citas al día
     para la clínica entera, y un médico con jornada llena hace 16. Con dos
     médicos activos el mes ya llega al techo, y lo que se recorta son las últimas
     semanas, que se ven LIBRES. La protección contra el truncado sigue puesta —no
     se relaja—, pero contener no es lo mismo que evitar.

     ⚠️ `isSingleDoctor` APAGA LA REGLA ENTERA, y es la misma condición que decide
     si el desplegable existe: donde no hay desplegable no hay restricción. Ahí
     `''` no significa «todos», significa «el único», las filas son las de un solo
     médico y el techo no se acerca. De paso cubre la clínica sin médicos, donde
     forzar no tendría a quién y dejaría el mes en blanco. */
  function forzarMedicoParaElMes() {
    if (isSingleDoctor) return
    if (filtroEfectivo !== '') return
    const elegido = medicoQueForzar()
    if (elegido) aplicarFiltro(elegido, true)
  }

  /* La vuelta. Sólo deshace lo que impusimos: si el filtro de ahora ya no es el
     que forzamos —porque la persona eligió otro en el desplegable—, no se toca.
     `aplicarFiltro(..., false)` limpia la marca de camino. */
  function revertirMedicoForzado() {
    const forzado = medicoForzadoRef.current
    if (forzado === null) return
    if (filtroEfectivo !== forzado) { medicoForzadoRef.current = null; return }
    aplicarFiltro('', false)
  }

  return {
    filtroEfectivo,
    filtroSincronoRef,
    aplicarFiltro,
    forzarMedicoParaElMes,
    revertirMedicoForzado,
  }
}
