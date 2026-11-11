'use client'

/**
 * src/hooks/useDialogoModal.ts
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.3, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 *
 * Lo usan los tres modales de la agenda —`HorarioModal`, `AppointmentModal` y
 * `ConfirmModal`—, que ahora viven cada uno en su propio archivo dentro de
 * `src/components/agenda/`; por eso el hook y sus dos ayudantes van en
 * `src/hooks/` y no dentro de ninguno de los tres.
 */

import { useCallback, useEffect, useRef, type KeyboardEvent as EventoTeclado } from 'react'

/* ═══ BLOQUE 9 · ACCESIBILIDAD DE LOS TRES MODALES DE ESTE ARCHIVO ═══════════
   Los modales de la agenda —horario, cita, confirmación— no usan `ModalShell`:
   montan su propio `<Portal>` porque su geometría (pantalla completa por debajo
   de `md`, seguimiento del `visualViewport`, áreas seguras) no cabe en aquel
   componente. Lo que sí les faltaba era todo lo demás: rol de diálogo, foco
   inicial, foco ATRAPADO, cierre con Escape y devolución del foco al cerrar.

   ⚠️ ES LA TERCERA COPIA DE ESTA LÓGICA. Las otras dos están en
   `components/ui/ModalShell.tsx` y en `components/agenda/ModalInvitacionCita.tsx`.
   SE SABE Y ES DELIBERADO: sacarla a `src/hooks/` sería una abstracción
   compartida nueva, y esa decisión no se toma de paso en un bloque de estados
   vacíos. Mientras haya tres copias, un arreglo del trapo se aplica a las tres.

   Aquí SÍ es un hook y en los otros dos archivos no, y la razón es aritmética:
   este archivo tiene TRES modales y aquéllos uno cada uno.

   ⚠️ NO BLOQUEA EL SCROLL DEL BODY, y `ModalShell` sí. Tampoco lo bloqueaba
   antes: la agenda vive dentro de una raíz en `dvh` que no scrollea, así que
   detrás del modal no hay nada que se mueva. Añadirlo aquí sería un cambio de
   comportamiento fuera del alcance de este bloque. */
const SELECTOR_FOCO_MODAL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* ⚠️ EL FILTRO DE VISIBILIDAD MIDE CAJA Y NO USA `offsetParent`: ése vale null
   bajo cualquier ancestro `position: fixed`, o sea bajo TODO panel de portal, y
   con él la lista salía vacía y el trapo no atrapaba nada. */
export function focusablesDelPanel(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELECTOR_FOCO_MODAL))
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0)
}

/**
 * Ata un panel de modal: foco inicial, trapo de Tab, Escape y devolución del
 * foco. Devuelve el `ref` que va en el panel y el manejador de teclado que hay
 * que ponerle en `onKeyDown`. LOS DOS, o no funciona nada.
 *
 * ⚠️⚠️ NI EL OYENTE NI EL FOCO PUEDEN COLGAR DE UN `useEffect` CON DEPS `[]`, Y
 * ÉSA FUE LA PRIMERA VERSIÓN, QUE NO FUNCIONABA. El motivo es `Portal`: su
 * primer render devuelve `null` —monta a sus hijos en el SEGUNDO, cuando su
 * propio efecto pone `mounted`— así que en el primer commit de este modal EL
 * PANEL NO EXISTE TODAVÍA EN EL DOM. Un efecto con deps `[]` corre exactamente
 * ahí, encuentra el ref en `null`, se va por el `return` y NO VUELVE A CORRER
 * NUNCA: ni oyente, ni foco, ni limpieza. Escape quedaba muerto en los cuatro
 * modales de la agenda.
 * Que el efecto de `Portal` corra ANTES que éste —los hijos primero— no salva
 * nada: `setMounted` agenda un render, no lo commitea de golpe, así que cuando
 * este efecto se ejecuta el DOM sigue sin el panel.
 *
 * Por eso las dos piezas son DECLARATIVAS y no imperativas:
 *   · el teclado va en un `onKeyDown` del panel, que React cablea sobre el
 *     elemento sin que a nadie le importe cuándo se montó;
 *   · el foco va en un CALLBACK REF, al que React llama con el nodo justo cuando
 *     lo monta, sea el commit que sea.
 * Sólo queda en un efecto la DEVOLUCIÓN del foco, que es lo único que ocurre al
 * desmontar y no necesita el nodo.
 *
 * ⚠️ SIGUE RESOLVIENDO EL ANIDAMIENTO SIN NINGÚN CONTADOR, y hay que saber por
 * qué para no romperlo: el modal de la cita y el de invitación se abren A LA VEZ
 * —`onInvitar` no cierra el de debajo— y viven en archivos distintos, así que el
 * `modalStack` de `ModalShell` no les serviría. Un `onKeyDown` de React propaga
 * por el ÁRBOL DE REACT y no por el DOM, y los dos modales son HERMANOS en ese
 * árbol (dos hijos de `AgendaPage`), no uno dentro del otro: una tecla pulsada
 * en el de arriba no pasa por el panel del de abajo. Con `document` sí pasaría.
 *
 * ⚠️ Y DA IGUAL QUIÉN SE QUEDE EL FOCO INICIAL. El evento burbujea desde
 * cualquier hijo hasta el panel, así que Escape cierra tanto si el foco está en
 * el panel como si el `autoFocus` del buscador de paciente se lo llevó a él.
 * Ésa es la propiedad que la versión con `addEventListener` también tenía, y por
 * eso el fallo NO era del foco: era que el oyente no llegó a existir. Si algún
 * día Escape vuelve a fallar, mira si el oyente existe antes de mirar el foco.
 *
 * ⚠️ `alCerrar` ENTRA POR REF Y NO POR DEPENDENCIA. Los tres llamadores le pasan
 * una flecha nueva en cada render; como dependencia, esto se recrearía en cada
 * tecleo dentro del formulario de la cita.
 */
export function useDialogoModal(alCerrar: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const focoPrevioRef = useRef<HTMLElement | null>(null)
  /* El ref se sincroniza en un EFECTO y no en el cuerpo: escribir `.current`
     durante el render es lo que prohíbe `react-hooks/refs`. Mismo patrón que
     `ModalShell` con su `onCloseRef`. */
  const alCerrarRef = useRef(alCerrar)
  useEffect(() => { alCerrarRef.current = alCerrar }, [alCerrar])

  /* ⚠️ `useCallback` CON DEPS `[]` NO ES DECORACIÓN AQUÍ, ES OBLIGATORIO. Un
     callback ref con identidad nueva en cada render hace que React lo llame con
     `null` y otra vez con el nodo EN CADA RENDER — o sea que el panel robaría el
     foco cada vez que se teclea una letra en el formulario. */
  const montarPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    /* ⚠️ SÓLO SE ENFOCA EL PANEL SI EL FOCO NO ESTÁ YA DENTRO, Y ESA GUARDA VALE
       UNA REGRESIÓN. El modal de la cita lleva `autoFocus` en el buscador de
       paciente, y en el alta ése es EL gesto: se abre y se teclea el nombre.
       React aplica el `autoFocus` de un hijo ANTES de atar el ref del padre —la
       fase de layout va de dentro hacia fuera—, así que un `focus()` a secas
       aquí se lo comía y el cursor salía del campo. No se notó mientras esto
       vivía en un efecto que nunca corría; en cuanto empezó a correr, sí.
       Que el foco caiga en un control de dentro NO estropea el anuncio: con
       `role="dialog"`, `aria-modal` y `aria-labelledby` puestos, un lector de
       pantalla nombra el diálogo al entrar en él. Y Escape sigue funcionando
       igual, porque la tecla burbujea desde el campo hasta este panel. */
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
  }, [])

  /* ⚠️ QUIÉN TENÍA EL FOCO SE APUNTA AQUÍ Y NO EN EL CALLBACK REF, y el orden es
     el motivo: este efecto corre en el PRIMER commit, cuando el `Portal` todavía
     no ha montado nada, así que `document.activeElement` sigue siendo el botón
     que abrió el modal. En el callback ref sería un commit más tarde y el
     `autoFocus` del buscador ya podría haberse llevado el foco — se apuntaría un
     campo de dentro del propio modal y al cerrar el foco no volvería a ninguna
     parte, porque ese campo ya no existe.
     La limpieza es lo único que hace: al cerrar, el foco vuelve a donde estaba.
     Sin esto se va al `<body>` y quien navega con teclado empieza otra vez desde
     arriba de la página. */
  useEffect(() => {
    focoPrevioRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { focoPrevioRef.current?.focus({ preventScroll: true }) }
  }, [])

  const alPulsarTecla = useCallback((e: EventoTeclado<HTMLDivElement>) => {
    if (e.key === 'Escape') { alCerrarRef.current(); return }
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focos = focusablesDelPanel(panel)
    /* Un panel sin nada enfocable —una confirmación de sólo texto— devuelve el
       foco a sí mismo en vez de dejarlo salir al documento de detrás. */
    if (focos.length === 0) { e.preventDefault(); panel.focus({ preventScroll: true }); return }
    const primero = focos[0]
    const ultimo  = focos[focos.length - 1]
    const activo  = document.activeElement
    /* La rama `!panel.contains(activo)` cubre el estado inicial, con el foco en
       el propio panel: sin ella el primer Tab se iba al documento. */
    if (e.shiftKey && (activo === primero || !panel.contains(activo))) {
      e.preventDefault(); ultimo.focus()
    } else if (!e.shiftKey && (activo === ultimo || !panel.contains(activo))) {
      e.preventDefault(); primero.focus()
    }
  }, [])

  return { montarPanel, alPulsarTecla }
}
