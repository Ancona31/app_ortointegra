# Auditoría de navegación y layout — Spinus (rama feature/agenda-v2)

Solo lectura. Rutas relativas a la copia auditada
`/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/app`.
Fuera de alcance: calculadoras-clinicas, dicom, super-admin, páginas públicas.

Etiquetas: **[V]** verificado leyendo el código en esa línea · **[I]** inferido (razonado
a partir del código, sin ejecutar ni medir en dispositivo). Nada se ejecutó en navegador:
todo lo que dependa de cómo reporta iOS los insets en el Duo es [I].

---

## 0. Hallazgos que cambian el plan (leer primero)

1. **No existe ni un solo `env(safe-area-inset-left|right)` en el repositorio.** [V] La única
   mención es un comentario que lo aplaza: `src/app/(app)/layout.tsx:217-220` («EL HORIZONTAL
   NO LO LLEVA, Y ES DELIBERADO… el manifiesto fija `orientation: portrait-primary`»). El
   mismo argumento se repite en `src/components/ui/ModalShell.tsx:221-222`. El Duo cerrado
   (466×678) rompe la premisa: es vertical y aun así trae inset-right 84.
2. **El manifiesto fija `orientation: 'portrait-primary'`** (`src/app/manifest.json/route.ts:11`). [V]
   El modo abierto horizontal (951×669) contradice esa declaración. Si iOS la respeta o no
   en la app instalada es [I]: no lo sé y hay que comprobarlo en dispositivo.
3. **El umbral previsto de 900 px no existe en la app.** El corte «teléfono / escritorio» es
   `lg` = 1024 px en todas partes, y está escrito a mano en al menos 8 sitios (ver §4). A
   951 px la app actual está en modo móvil: cajón oculto + hamburguesa, y la agenda en modo
   «tableta». Una barra lateral a ≥900 px convive con contenido que cree estar en teléfono.
4. **Hay 4 mecanismos distintos de encabezado móvil** (más copias en esqueletos), cosidos
   entre sí con dos reglas `body:has(...)` y un relleno compensado a mano (ver §3).
5. **`OnboardingGuide` no está montado en ningún sitio.** [V] `grep` no encuentra ningún
   import ni `<OnboardingGuide`. La burbuja y la tarjeta flotantes (`right-6`, z 10002) son
   código muerto hoy; siguen vivos los atributos `data-onboard` que lo alimentaban.
6. **Trampa de `position: fixed`:** `animate-slide-up` crea bloque contenedor para todo
   `fixed` descendiente (documentado en `src/app/(app)/perfil/page.tsx:1295-1306`). La
   navegación solo funciona como hermana de `<main>` (como hoy el `Sidebar`) o en portal.
7. **Documentación desfasada:** CLAUDE.md lista «`ModalShell` sin focus trap» como deuda
   abierta; el código ya lo tiene (`ModalShell.tsx:155-177`). [V] No afecta al rediseño.

---

## 1. Contenedor común

### 1.1 Raíz — `src/app/layout.tsx`
- `viewport` exportado: `themeColor` claro/oscuro (58-61) y **`viewportFit: 'cover'`** (78), que
  es lo que enciende todos los `env()`. [V]
- `<html lang="es" className="h-full" suppressHydrationWarning>` (89). El comentario 83-88
  justifica la supresión diciendo que la clase `dark` «es el único atributo del documento
  que cambia»: un `data-borde-sistema` escrito antes de hidratar sería el segundo. [V]
- `<head>`: `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent` (94-100). [V]
- `<body className="min-h-full antialiased">` (102). Sin providers. [V]
- `body::before` (globals.css:946-954): franja `fixed` arriba, alto `env(safe-area-inset-top)`,
  fondo `--ag-navy`, z-index 45, `pointer-events: none`. Aplica a TODA la app, también a
  login y landing. Solo cubre el borde superior. [V]

### 1.2 Árbol de `src/app/(app)/layout.tsx` [V]
```
guarda de servidor: sesionServidor() → getUser(); sin usuario → /login (52-54)
                    super_admin → /super-admin/dashboard (102-104)
<ScriptTema/>                                   141  (script en línea, clase dark)
<SWRConfig>                                     142
 <AuthProvider perfilInicial>                   147
  <ToastProvider>                               148  (contenedor fixed propio)
   <ThemeProvider>                              149
    <SubscriptionGateProvider>                  150
     <ConsultorioActivoProvider>                151
      <MenuMovilProvider>                       156
        <OfflineAlert/>                         157  fixed inset-0 z-[9999] (solo sin red)
        <div empty:hidden pt-[env(top)]>        172
          <SuscripcionBanner desktopSidebarOffset/>  173  sticky top-0 z-40, lg:ml-64
        <div class="flex h-screen overflow-hidden">  175
          <Sidebar/>                            176  (fixed; no ocupa flujo)
          <main class="flex-1 lg:ml-64 overflow-y-auto">   177   ← ÚNICO SCROLL
            <div min-h-full pt/px/pb …>         221
              <ErrorBoundary><PageTransition>{children}   222-226
        <CommandPalette/>                       230  fixed z-[9998] al abrir
        <SessionGuard/>                         231  (no pinta)
        <GateOnboarding/>                       237  (ModalShell bloqueante)
```
- **Quién hace scroll:** `<main>` (177), no `body`. El padre es `h-screen overflow-hidden`
  (175) → usa `100vh`, no `dvh`. [V] Excepción conocida: con la suscripción bloqueada el
  banner (173) queda FUERA del `h-screen`, suma su alto y aparece un segundo scroll de
  documento; lo documenta el propio código en `agenda/AgendaCliente.tsx:1577-1586`. [V]
- **Fijo:** `Sidebar` (aside + botón flotante + velo), franja `body::before`, toasts,
  modales. **Pegajoso:** el banner de suscripción.
- **Relleno del contenido (221):** móvil `pt = 4rem + inset-top`, `px-4`, `pb = 1.5rem +
  inset-bottom`; `lg`: `pt = 2rem + inset-top`, `px-8`, `pb = 2rem + inset-bottom`. Los 64 px
  de arriba en móvil existen SOLO para dejar sitio al hamburguesa flotante (globals.css:2206-2209). [V]
- La agenda replica ese relleno a mano: `agenda-raiz h-[calc(100dvh-88px-…)] lg:h-[calc(100dvh-64px-…)]`
  (`AgendaCliente.tsx:1508`) y lo anula por CSS: `main > div:has(.agenda-fc) { padding: 0 }` +
  `.agenda-raiz { height: 100dvh }` por debajo de 1024 (globals.css:1509-1512). Cualquier cambio
  del relleno de 221 obliga a tocar esos números (aviso explícito en layout.tsx:178-206). [V]
- Los layouts anidados (`documentos`, `expediente`, `expediente/[id]`, `…/nueva-nota`,
  `…/documentos`, `pacientes/nuevo`) son solo guardas de servidor y devuelven `<>{children}</>`:
  **no añaden cromo**. [V]

### 1.3 `src/app/(launcher)/layout.tsx` [V]
`<ScriptTema/>` (20) → `ToastProvider` (21) → `TemaLauncherProvider` (22) →
`SubscriptionGateProvider` (23) → envoltorio `pt-[env(top)]` del banner (37-39) → `{children}` (40).
No monta `AuthProvider`, `ThemeProvider`, `ConsultorioActivoProvider`, `MenuMovilProvider`,
`Sidebar`, `CommandPalette`, `SessionGuard` ni `GateOnboarding`. Aquí el scroll es del `body`
(`min-h-screen`, `inicio/page.tsx:210`).

### 1.4 Dónde se aplican hoy los insets [V]
Solo `top` y `bottom`:

| Sitio | Línea | Inset |
|---|---|---|
| Franja `body::before` | globals.css:950 | top |
| Envoltorio del banner | (app)/layout.tsx:172 · (launcher)/layout.tsx:37 | top |
| Relleno de contenido | (app)/layout.tsx:221 | top + bottom |
| Botón `.menu-flotante` | Sidebar.tsx:563 | top |
| `<aside>` (solo < lg) | Sidebar.tsx:610 | top + bottom |
| Banda de la agenda | globals.css:2133 | top |
| Barra «Agendar» | globals.css:2436 | bottom |
| Cabecera móvil del dashboard | globals.css:2218 | top |
| Raíz de la agenda | AgendaCliente.tsx:1508 | top + bottom (restados) |
| `.ag-hoja` / burbuja | globals.css:6008, 6302 | bottom |
| ModalShell `fullscreenMobile` | ModalShell.tsx:248 | top + bottom |
| AppointmentModal | AppointmentModal.tsx:1082, 1825 | top / bottom |
| SheetFiltrosExpediente (pie) | SheetFiltrosExpediente.tsx:271 | bottom |
| Diálogo borrar paciente | expediente/[id]/page.tsx:233 | bottom (max-sm) |
| Barra de guardado de perfil | perfil/page.tsx:858, 1326 | bottom (max-sm) |
| Toasts | Toast.tsx:78 | bottom |
| `.sp-doc-actions` | spinus-tokens.css:1523 | bottom |
| Barra superior de /inicio | (launcher)/inicio/page.tsx:224 | top |

**Faltan:** left y right en todos. Tampoco hay inset alguno en: velos `fixed inset-0` de
modales no-fullscreen, `CommandPalette`, `ConsultaRapidaModal`, `OfflineAlert`, `AvisoGuardado`
(`bottom-[28px]` fijo, sin inset-bottom: `agenda/configuracion/AvisoGuardado.tsx:39`),
`.sp-firma-modo` (spinus-tokens.css:2593) y el cuerpo de /inicio.

---

## 2. `src/components/layout/Sidebar.tsx` (897 líneas)

### 2.1 Estructura [V]
Un fragmento con cuatro hermanos:
1. `<button class="menu-flotante lg:hidden fixed top-[1rem+inset] left-4 z-50">` (557-567). Sin
   `aria-label` ni `aria-expanded`. Alterna Menu/X.
2. Velo `lg:hidden fixed inset-0 bg-black/40 z-30`, solo abierto (570-572).
3. `<aside id="barra-lateral" data-plegada>`: `fixed inset-y-0 left-0 w-64 z-40 flex flex-col`,
   fondo `--ag-navy`, `transition-transform`, `-translate-x-full lg:translate-x-0` (602-614).
4. `<ConsultaRapidaModal>` para los 8 documentos, fuera del aside, z-[9998] (886-894).

Dentro del aside, de arriba abajo: cabecera con logo 56 px + nombre + subtítulo (616-647) →
`ConsultorioActivoSelector` (649) → `<nav class="flex-1 overflow-y-auto">` (652-784) → pie
(787-875).

### 2.2 Elementos del menú
Selección de menú: `profile?.role === 'secretaria' ? navSecretaria() : navDoctor(isAdmin)` (361-364).
Mientras el perfil no ha cargado se pinta el del médico. [V] `isAdmin` = `role==='medico' &&
es_admin_de_clinica` (334-336, `lib/permissions.ts`).

**Médico** (`navDoctor`, 156-201), en orden:

| # | Rótulo | Destino | Condición | Notas |
|---|---|---|---|---|
| 1 | Dashboard | `/dashboard` | todos | con precarga |
| 2 | Pacientes ▸ | grupo | todos | activo en `/expediente`, `/suplementacion` |
| 2a | Expediente | `/expediente` | | |
| 2b | Suplementación | `/suplementacion` | | |
| 3 | Agenda | `/agenda` | todos | con precarga |
| 4 | **Calculadoras** | `/calculadoras-clinicas` | todos | **a eliminar** (182) |
| 5 | Documentos ▸ | grupo | todos | 8 botones (no enlaces), 145-154 |
| 5a-h | Receta, Laboratorio, Imagenología, Suplementación, Internamiento, Escrito, Consentimiento, Honorarios | abre buscador de paciente → `/expediente/[id]/documentos?tipo=…`; con paciente abierto navega directo (351-359) | bloqueados si `subState.isBlocked` (741-745) |
| 6 | Administración ▸ | grupo | todos | |
| 6a | Estadísticas | `/estadisticas` | todos los médicos | |
| 6b | Usuarios de la clínica | `/admin/usuarios` | solo `isAdmin` | |
| 6c | Facturación | `/billing` | solo `isAdmin` | |
| — | divisor | | | |
| 7 | Mi perfil | `/perfil` | todos | sin precarga |
| 8 | Ayuda | `/ayuda` | todos | sin precarga |

**Secretaria** (`navSecretaria`, 203-216): Dashboard · Pacientes ▸ (Expediente, **Nuevo
paciente** `/pacientes/nuevo`, bloqueado si `isBlocked`, 49-53 y 757) · Agenda. Nada más.

No hay condición por plan: la única bandera comercial es `subState.isBlocked`, que no oculta
nada, intercepta el clic y abre el modal de bloqueo. [V]

**DICOM no aparece en el menú.** [V] Queda en: ruta `(app)/dicom`, `OnboardingGuide.tsx:141-149`
(muerto), `lib/subscription.ts:191` y comentario en `(app)/layout.tsx:82`; el visor DICOM
embebido de laboratorios (`components/labs/ModalPreviewDocumento.tsx:9,180`) es otra cosa.
Calculadoras aparece además en `hooks/useCalculadoraContextual.ts` y en `AgendaCliente.tsx`
(referencias fuera de la navegación, no auditadas a fondo).

Submenús: acordeón en línea (`ml-3 pl-3 border-l`, 724). Se auto-expande el grupo con hijo
activo en cada cambio de ruta y **cierra los demás** (367-375). Sin submenú flotante.

### 2.3 Resto de piezas [V]
- **Selector de consultorio** (`components/sidebar/ConsultorioActivoSelector.tsx`): solo
  `isDoctor`, solo con ≥2 consultorios; desplegable `absolute left-5 right-5 z-50` dentro del
  aside; confirma con `ModalShell`; guarda el id en `sessionStorage`
  (`contexts/ConsultorioActivoContext.tsx:7,58-62`). Oculto en barra plegada (`sb-etiqueta`).
- **Tarjeta «datos pendientes»** (`components/sidebar/AvisoPerfilSidebar.tsx`): solo
  `estadoPerfil.role === 'medico'` (827); firma, cédula de especialidad, logo; enlaza a
  `/perfil`; va en el pie, debajo de «Cerrar sesión»; colapsable; oculta en barra plegada.
- **Plegar/desplegar**: botón solo en `/agenda` y solo ≥ lg (790-798).
- **Modo oscuro** (799-803): `useTheme().toggle` → `localStorage.theme` + clase `dark` en `<html>`.
- **Cerrar sesión** (804-808 → `handleLogout` 423-488): registra el logout en
  `/api/auth/audit-login` con `await` (NOM-024), `signOut()`, limpia 4 cachés, marca la
  limpieza de `CLAVE_CONFIG` para el desmontaje (413-421), `router.push('/login')`.
  **Toda esa lógica vive dentro del componente Sidebar.**
- **Aviso de Privacidad** (871-874): `/privacidad`, `target=_blank`, `prefetch={false}`.
- Datos: `useProfile`, `useClinica`, `useSWR(CLAVE_ESTADO_PERFIL)` (comparte caché con
  `GateOnboarding`), `useTheme`, `useAuth`, `useToast`, `useSubscriptionGate`, `useMenuMovil`.

### 2.4 Móvil, anchos, z-index, colapso [V]
- Abierto/cerrado: booleano en `contexts/MenuMovilContext.tsx` (provider en layout:156). El
  propio contexto prohíbe añadirle más estado (26-29).
- Lo abren: `.menu-flotante` (`alternar`), la barra del dashboard (`abrir`) y la banda de la
  agenda (`abrir`). Lo cierran: velo, clic en cualquier enlace (`close()`), el propio botón
  flotante y el selector de consultorio. **No** hay Escape, gesto de deslizar, bloqueo de
  scroll, foco atrapado ni cierre automático por cambio de ruta.
- Ancho: 256 px (`w-64`); plegada 64 px (`4rem`) solo en `/agenda` ≥ 1024 (globals.css:2181-2190).
  Preferencia en `localStorage['spinus.barra.plegada']` (262-275).
- Apilamiento: velo 30 < aside 40 = banner 40 < franja `body::before` 45 < flotante 50 =
  modales 50.
- Dependencias del lado izquierdo, todas a mano: `left-0` y `-translate-x-full` (609-612),
  `left-4` (563), `lg:ml-64` en `<main>` (layout:177), `lg:ml-64 sb-banner-desplazado`
  (`billing/SuscripcionBanner.tsx:39`), `aside[data-plegada] ~ main { margin-left }` y
  `.sb-banner-desplazado { margin-left }` (globals.css:2188-2189), `lg:left-64` de la barra de
  guardado (`perfil/page.tsx:1323`), iconos `PanelLeftClose/Open` y chevrones.

---

## 3. Encabezados móviles: cuántos hay y quién usa cuál

**Cuatro mecanismos** en el área autenticada [V]:

| # | Mecanismo | Dónde vive | Cómo desplaza al flotante |
|---|---|---|---|
| A | Botón flotante `.menu-flotante` | Sidebar.tsx:557-567 | es el valor por defecto; el layout le reserva 64 px |
| B | Barra `.dash-barra-movil` (☰ + «Dashboard» + avatar), en flujo, `lg:hidden` | **3 copias**: dashboard/page.tsx:98-114, dashboard/AsistenteDashboard.tsx:62-77, ui/Skeleton.tsx:78-92 | `body:has(.dash-barra-movil) .menu-flotante{display:none}` (globals.css:2204) + recorte de `padding-top` (2216-2220) |
| C | `BandaMovil` de la agenda (`<header class="ag-banda-movil">`, navy, 2 filas) + barra inferior `BarraAgendarMovil` | agenda/BandaMovil.tsx:111-150; montada por JS si `innerWidth < 1024` (AgendaCliente.tsx:736, 1510, 2198) | `body:has(.ag-banda-movil) .menu-flotante{display:none}` (globals.css:2173) + página a `padding:0` (1509-1512) |
| D | Barra superior de `/inicio` (logo, insignia de plan, enlace a perfil) | (launcher)/inicio/page.tsx:224-263 | no hay menú ni Sidebar en ese grupo |

Añadidos: el esqueleto de la agenda dibuja su propia banda falsa con márgenes negativos
(`agenda/loading.tsx:56-72`) y **no** lleva la clase `.ag-banda-movil`, así que durante la
carga el flotante sigue encima [I]. El modo firma de consentimiento (`.sp-firma-modo`, z 55,
spinus-tokens.css:2593) tapa el flotante a propósito y trae cabecera propia de 56 px.

**Pantalla por pantalla (en alcance):**

| Ruta | Encabezado móvil | Sub-encabezado propio de la página |
|---|---|---|
| `/inicio` | D | — |
| `/dashboard` (médico, secretaria, carga) | B | saludo `<h1>` |
| `/agenda` | C (banda + barra inferior) | — |
| `/agenda/configuracion` | A | tira horizontal de secciones (`MenuConfiguracion.tsx:61`) |
| `/expediente` | A | `<h1>` (page.tsx:216) |
| `/expediente/[id]` | A | «Volver a pacientes» (`CabeceraPaciente.tsx:78-82`) |
| `/expediente/[id]/nueva-nota` | A | `Breadcrumbs` (único uso) + flecha atrás |
| `/expediente/[id]/consulta/[consultaId]` | A | flecha atrás + `<h1>` (185-188) |
| `/expediente/[id]/documentos` | A | flecha atrás + `<h1>` (166-169) |
| `/expediente/[id]/editar` | A | flecha atrás (132-136) |
| `/expediente/[id]/estado`, `/laboratorios` | A | (páginas de 17-20 líneas; no revisadas por dentro) |
| `/pacientes/nuevo` | A | flecha atrás (206-211) |
| `/documentos` | A | `<h1>` |
| `/suplementacion`, `/estadisticas`, `/perfil`, `/ayuda`, `/billing`, `/admin/usuarios` | A | `<h1>` |

Es decir: 3 pantallas con encabezado a medida (inicio, dashboard, agenda) y ~17 con el
botón flotante más un título o una flecha de vuelta sin patrón común.

---

## 4. Puntos de quiebre

### 4.1 El corte teléfono/escritorio es `lg` = 1024 px [V]
Escrito a mano en: `Sidebar.tsx:381` (`matchMedia('(min-width: 1024px)')`),
`AgendaCliente.tsx:239` (`ANCHO_MOVIL = 1024`), globals.css 1509, 1549, 2181, 2216, 5226
(`max-width: 1023px` / `min-width: 1024px`) y cada clase `lg:`. Segundo corte:
`ANCHO_TABLETA = 768` (`lib/agenda/vistasAgenda.ts:70`) y `md`/`max-md` para modales a pantalla
completa. No hay `tailwind.config`; Tailwind 4 con `@theme inline` (globals.css:20) y
breakpoints por defecto. [V]

### 4.2 Conteo de prefijos (ts/tsx en alcance; incluye apariciones en comentarios) [V]
Total 565 en 76 archivos: `lg` 288 · `sm` 105 · `max-md` 74 · `md` 58 · `max-sm` 19 · `xl` 13 ·
`max-lg` 4 · `2xl` 3 · `min-[380px]` 1.

| # | Archivo | Total | Desglose |
|---|---|---|---|
| 1 | components/agenda/AppointmentModal.tsx | 62 | max-md 59, md 3 |
| 2 | app/(app)/dashboard/page.tsx | 29 | lg 24, xl 4, min-[380px] 1 |
| 3 | app/(app)/expediente/[id]/nueva-nota/page.tsx | 28 | md 14, lg 9, max-md 5 |
| 4 | components/dashboard/TarjetaHoy.tsx | 27 | lg 27 |
| 5 | app/(app)/perfil/page.tsx | 26 | max-sm 14, lg 7, sm 5 |
| 6 | components/ui/Skeleton.tsx | 24 | lg 24 |
| 7 | components/expediente/FichaClinica.tsx | 22 | lg 21, max-lg 1 |
| 8 | app/(app)/dashboard/AsistenteDashboard.tsx | 22 | lg 20, xl 2 |
| 9 | components/ui/ModalShell.tsx | 21 | md 13, max-md 8 |
| 10 | components/expediente/CabeceraPaciente.tsx | 15 | lg 15 |
| 11 | components/perfil/PanelConsultorios.tsx | 14 | lg 8, sm 5, max-lg 1 |
| 12 | components/dashboard/ProximasCitas.tsx | 12 | xl 7, lg 5 |
| 13 | components/legal/AvisoPrivacidadContent.tsx | 10 | sm 10 |
| 14 | components/legal/TerminosContent.tsx | 10 | sm 10 |
| 15 | components/expediente/VisorNota.tsx | 10 | lg 10 |
| 16 | components/expediente/LineaTiempoClinica.tsx | 10 | lg 10 |
| 17 | app/(app)/layout.tsx | 9 | lg 9 |
| 18 | components/agenda/configuracion/MenuConfiguracion.tsx | 8 | lg 8 |
| 19 | app/(app)/billing/page.tsx | 8 | sm 8 |
| 20 | app/(app)/expediente/[id]/page.tsx | 8 | lg 5, sm 2, max-sm 1 |

### 4.3 Media queries [V]
**globals.css** (ancho/alto): `max-width:1023px` en 1509, 1549, 2216, 5226 · `min-width:1024px`
en 2181 · `max-width:1279px` en 1606, 2037 · `min-width:1280px` en 6605 · `min-height:861px`
y `1101px` en 3524-3525 (alto de franja de la rejilla) · `width < 40rem` en 7450 (landing).
Resto: `prefers-reduced-motion`, `hover`.
**spinus-tokens.css**: `max-width:768px` en 1169, 1232, 1243 · `min-width:1024px and
max-width:1150px` en 1250 (rejilla SOAP; el propio comentario dice que el rango sale de
restar el menú de 256) · `min-width:380px` en 2616, 2659 · `max-width:379px` en 2691, 2750.

### 4.4 Container queries: sí, pero no en el cascarón [V]
- `docform` y `docstudy` (spinus-tokens.css:1281, 1411, 1689; ~40 reglas): los formularios de
  documentos se adaptan al ancho de su contenedor.
- `ag-controles` (globals.css:2005, 2013) y `ag-tarjeta` (4061) en la agenda.
- `vf` en la verificación pública (fuera de alcance).
El layout, el Sidebar, el dashboard, el expediente y los modales dependen del ancho de la
VENTANA.

### 4.5 Qué pasaría hoy a 466, 669 y 951 px [I, derivado de los cortes verificados]

| Ancho | Cascarón | Agenda | Modales |
|---|---|---|---|
| 466 (cerrado) | móvil: cajón + hamburguesa; `sm:` NO aplica | teléfono: banda + listas + barra «Agendar» | `fullscreenMobile` y AppointmentModal a pantalla completa |
| 669 (abierto vertical) | móvil; `sm:` SÍ aplica (≥640), `md:` no | teléfono (< 768): listas | igual que 466 (< 768) |
| 951 (abierto horizontal) | **móvil** (< 1024): cajón oculto, sin barra lateral; `md:` sí, `lg:` no | **tableta** (768-1023): banda móvil + rejilla de 3 días | ventana centrada (≥ 768) |

Consecuencias directas para el plan:
- A 951 px, con barra lateral visible, la agenda seguiría montando `BandaMovil` con su ☰
  (decide `window.innerWidth`, no el ancho útil) y el dashboard seguiría pintando
  `.dash-barra-movil` (`lg:hidden`).
- Con 256 px de barra a 951 quedan 695 px de contenido; con riel de 64 a 466 quedan ~402.
  Las cuadrículas `lg:grid-cols-[1fr_300px]` del dashboard no se activan (bien), pero las
  reglas `sm:`/`md:` siguen midiendo la ventana completa.
- Además del ancho, los 669 px de ALTO en horizontal menos inset-bottom 34: la agenda decide
  la altura de franja con `min-height: 861px/1101px` (globals.css:3524-3525).

---

## 5. Elementos fijos, pegajosos y flotantes

| Elemento | Archivo:línea | Posición | z | ¿Choca con franja/riel a la derecha? |
|---|---|---|---|---|
| Franja del sistema `body::before` | globals.css:946 | fixed, arriba, ancho total | 45 | No (solo arriba). No hay equivalente lateral |
| `.menu-flotante` | Sidebar.tsx:563 | fixed top-left | 50 | No choca; es lo que el riel sustituiría |
| Velo del menú | Sidebar.tsx:571 | fixed inset-0 | 30 | — |
| `<aside>` | Sidebar.tsx:609 | fixed, izquierda, 256 | 40 | Lado contrario al previsto |
| SuscripcionBanner | billing/SuscripcionBanner.tsx:42 | sticky top-0, ancho total, `lg:ml-64` | 40 | **Sí**: su botón «Reactivar» va a la derecha desde `sm` (43) |
| Toasts | ui/Toast.tsx:78 | fixed abajo-derecha (`right-5`) | 9999 | **Sí, de lleno** |
| OnboardingGuide (burbuja y tarjeta 360 px) | ui/OnboardingGuide.tsx:562, 592 | fixed abajo-derecha (`right-6`) | 10002 | Chocaría, pero **no está montado** |
| OfflineAlert | ui/OfflineAlert.tsx:47 | fixed inset-0, centrado | 9999 | Parcial: centra sobre la ventana completa |
| CommandPalette | CommandPalette.tsx:251 | fixed inset-0, `pt-[15vh] px-4` | 9998 | Parcial (ídem) |
| ConsultaRapidaModal | launcher/ConsultaRapidaModal.tsx:243 | igual que el anterior | 9998 | Parcial |
| Barra de guardado de perfil | perfil/page.tsx:1323 | fixed `inset-x-0 bottom-0`, `lg:left-64` | 30 | **Sí**: a ancho total en `max-sm`; y el `left-64` asume menú izquierdo |
| AvisoGuardado (config. agenda) | agenda/configuracion/AvisoGuardado.tsx:39 | fixed `bottom-[28px] left-1/2` | 70 | Descentrado respecto al área útil; sin inset-bottom |
| `.ag-banda-movil` | globals.css:2106 | en flujo (flex) | — | **Sí**: ‹ Hoy › y campana van a la derecha |
| `.ag-barra-movil` («Agendar») | globals.css:2426 | en flujo, abajo | — | **Sí**: botón a ancho total |
| `.ag-capa` (popovers) | globals.css:5956 | fixed, posición por JS | 45 | **Probable**: se calcula con `window.innerWidth`/`visualViewport` (BurbujaAlta.tsx:116, HerramientasV2.tsx:75, TarjetaLectura.tsx:69, CapaBarra.tsx:27) |
| `.ag-hoja` (hoja inferior) | globals.css:5998 | fixed `inset-inline:0; bottom:0` | 45 | **Sí** |
| `.ag-capa-velo` | globals.css:6022 | fixed inset 0 | 44 | — |
| `.sp-doc-actions` | spinus-tokens.css:1510 | sticky bottom, dentro de `<main>` | 1 | No (hereda el ancho del contenedor) |
| `.sp-doc-menu` | spinus-tokens.css:1725 | fixed, por JS | 55 | Probable |
| `.sp-firma-modo` | spinus-tokens.css:2592 | fixed inset 0 | 55 | **Sí** |
| KebabAccionesPaciente | expediente/KebabAccionesPaciente.tsx:78 | fixed, anclado al botón | — | No (sigue a su ancla) |
| VisorNota cabecera | expediente/VisorNota.tsx:66 | sticky top-0 (interno) | 10 | No |
| Columna de nueva-nota | nueva-nota/page.tsx:1721 | `lg:sticky lg:top-6` | — | No |
| Aside de perfil | perfil/page.tsx:897 | `lg:sticky` | — | No |
| MenuConfiguracion | agenda/configuracion/MenuConfiguracion.tsx:61 | `lg:sticky` | — | No |
| `.ag-mespanel-cab` | globals.css:5547 | sticky interno | 2 | No |

No hay botones de acción flotantes (FAB) ni barra de pestañas inferior en la app. [V]

---

## 6. Modales y hojas

**`ModalShell`** (`components/ui/ModalShell.tsx`; 32 archivos lo importan):
- Portal a `body`; envoltorio `fixed inset-0 z-50` (`elevated` → z-[60]) `flex items-center
  justify-center p-4` (203). Panel `w-full max-w-lg max-h-[85vh] rounded-2xl` (248).
- `fullscreenMobile`: por debajo de `md` (768) `p-0`, `h-dvh`, sin radios, con relleno
  inset top+bottom en el PANEL (203, 248). **Un solo consumidor**: `nueva-nota/page.tsx:970`. [V]
- `spinusGeometry` work/decide/done/wait: anchos 724/620/600/560 desde `md`; `work` se ancla
  a `top:60px` con `max-h: calc(100vh-120px)` (46-51).
- Bloquea `document.body.style.overflow` (130-133), que no es el contenedor que hace scroll
  en `(app)` (es `<main>`) [I: sin efecto sobre el scroll real; el velo lo tapa].
- **Insets laterales: ninguno.** En la rama normal queda a 16 px del borde; a pantalla
  completa llega al borde físico.

**`AppointmentModal`** (`components/agenda/AppointmentModal.tsx:1027-1082`): portal, `fixed
inset-0 z-50 p-6 max-md:p-0`; el envoltorio sigue a `visualViewport` (`top`/`height` en línea)
para el teclado; panel `max-w-[560px] md:max-h-[92dvh] max-md:h-full max-md:rounded-none`;
inset-top en la cabecera (1082) e inset-bottom en el pie (1825). **Sin insets laterales.** Es
el archivo con más prefijos de la app (59 `max-md`).

**`SheetFiltrosExpediente`** (`components/expediente/SheetFiltrosExpediente.tsx:143-155`):
portal, `fixed inset-0 z-50 flex items-end justify-center`; panel `w-full max-w-lg rounded-t-2xl
max-h-[85vh]`; inset-bottom en el pie (271). Único uso: `expediente/page.tsx:457`. Sin
insets laterales: a 466 px ocupa todo el ancho.

**Modales hechos a mano, sin `ModalShell`** (todos `fixed inset-0 … p-4`, sin ningún inset) [V]:
`ui/QuickPatientModal.tsx:219` (z 70), `ui/OfflineAlert.tsx:47`, `agenda/ConfirmModal.tsx:25`
(60), `agenda/ModalBloqueo.tsx:180` (55), `agenda/HorarioModal.tsx:87` (50),
`agenda/ModalInvitacionCita.tsx:615` (60), `agenda/configuracion/ConfirmacionRestablecer.tsx:63`
(60), `agenda/configuracion/DialogoHorario.tsx:67` (60), `admin/usuarios/page.tsx:221, 316`,
`expediente/[id]/page.tsx:233`, `CommandPalette.tsx:251`, `launcher/ConsultaRapidaModal.tsx:243`.

Escala de z-index sin tokens: 30, 40, 45, 50, 55, 60, 70, 100, 9998, 9999, 10001, 10002.

---

## 7. Diferencias por rol

| | Médico | Médico admin (`es_admin_de_clinica`) | Secretaria |
|---|---|---|---|
| Llegada tras login | `/inicio` | `/inicio` | `/inicio` → redirigida a `/dashboard` (`inicio/layout.tsx:25`) |
| Menú | 8 entradas + 3 grupos | + Usuarios y Facturación | Dashboard, Pacientes (Expediente, Nuevo paciente), Agenda |
| Mi perfil / Ayuda en menú | sí | sí | **no** (`/perfil` expulsa a no-médicos: `perfil/page.tsx:396-399`) |
| Documentos, Calculadoras, Estadísticas | sí | sí | no (`/estadisticas` la expulsa: `estadisticas/page.tsx:60`) |
| Subtítulo del menú | especialidad | especialidad | «Asistente Médico/a» (Sidebar.tsx:642-644) |
| Selector de consultorio | con ≥2 consultorios | ídem | nunca (`isDoctor`) |
| Tarjeta «datos pendientes» | sí | sí | nunca (Sidebar.tsx:827) |
| Modo oscuro, cerrar sesión, privacidad | sí | sí | sí |
| Dashboard | `dashboard/page.tsx` | ídem | `AsistenteDashboard.tsx` |
| Ceja del dashboard | consultorio activo | ídem | nombre de la clínica (81) |
| Botones de cabecera | Nueva consulta, Nuevo documento (solo móvil), Nuevo paciente, Expedientes | ídem | Agendar cita, Nuevo paciente |
| Próximas citas | las suyas; Iniciar consulta, Expediente, Ligar | ídem | todas las de la clínica; solo «Ver cita» → `/agenda` |
| Banda inferior | Atendidos recientemente · Documentos recientes | ídem | Últimos pacientes · Hoy en consultorio |
| `/expediente/[id]` y descendientes | sí | sí | bloqueado en servidor (`expediente/[id]/layout.tsx:124`) |
| CommandPalette (Ctrl+K) | abre el expediente | ídem | siempre a la lista `/expediente` (191, 202, 239) |

`super_admin` no entra en `(app)`: se le redirige en `(app)/layout.tsx:102-104`.

---

## 8. `/inicio` frente a `/dashboard`

**`/inicio`** (`(launcher)/inicio/page.tsx`, grupo `(launcher)`) [V]
- Es el `start_url` de la PWA (`manifest.json/route.ts:8`) y el destino tras login para todos
  (`login/page.tsx:224, 343, 423, 486`; `login/layout.tsx:134`; `middleware.ts:366-367`;
  `auth/callback/page.tsx:29`). Solo médicos.
- Pantalla de arranque sin menú: fondo de partículas, saludo + frase del día, 3 tarjetas
  (Consulta rápida → `ConsultaRapidaModal`; Documento rápido → `/documentos`; Dashboard →
  `<a href="/dashboard">` con navegación dura), dos contadores (citas de hoy, consultas de la
  semana), insignia de plan o «Actualizar» → `/pricing`, icono a `/perfil`.
- No tiene cerrar sesión, ni conmutador de tema, ni acceso directo a agenda o expediente.
- Monta su propio `OnboardingModal` (194-203).

**`/dashboard`** (`(app)/dashboard/page.tsx`) [V]
- Panel de trabajo dentro del cascarón con menú: buscador, acciones, próximas citas, tarjeta
  «Hoy», atendidos y documentos recientes. Es el «Inicio» de las migas (`Breadcrumbs.tsx:36`).

**Duplicaciones** [V]:
- Saludo: `saludo()` definido tres veces (inicio:44, dashboard:32, AsistenteDashboard:14).
- Nueva consulta: el mismo `ConsultaRapidaModal` en los dos.
- Nuevo documento: `/inicio` todavía envía a la pantalla intermedia `/documentos`, que
  dashboard y menú ya abandonaron (dashboard/page.tsx:165-172; Sidebar.tsx:136-141).
- Citas de hoy: contador en `/inicio` y `TarjetaHoy` en dashboard.
- Gate de perfil: `OnboardingModal` en `/inicio` y `GateOnboarding` en `(app)` (layout:237).
- Banner de suscripción: en los dos layouts.

**No hay camino de vuelta a `/inicio` desde el menú.** [V] Los únicos enlaces son los de
error (`ErrorBoundary.tsx:73`, `global-error.tsx:74`) y el modo offline. `Sidebar.tsx:222`
conserva una rama muerta para `/inicio`. Para la secretaria `/inicio` no existe.

---

## 9. Qué habría que tocar, y riesgo según CLAUDE.md

Marco común: cualquiera de las tres tareas supera 3 archivos → **Protocolo 3** obliga a
detenerse y mostrar plan; **Protocolo 1** exige lista de archivos confirmada; **Protocolo 7**
pide `npm run build` (y `lint` si hay tipos) tras cada cambio.

### (a) Insets laterales en el contenedor

| Archivo | Qué | Riesgo |
|---|---|---|
| `src/app/(app)/layout.tsx:221` (y 172, 175-177) | `px-4`/`lg:px-8` no suman inset; el banner tampoco | **Alto.** El archivo contiene el guarda `getUser()` y el `select` de perfil del que depende el cobro (56-100). Tocar solo JSX es compatible con «Autoridad de sesión», pero es el archivo más delicado. El relleno está replicado en la agenda (178-206) |
| `src/app/globals.css:1509-1512, 2133, 2436` | en móvil la agenda anula el relleno del layout: banda y barra necesitan inset propio | Medio. Bloques con avisos de acoplamiento |
| `src/app/(app)/agenda/AgendaCliente.tsx:1508` | el `calc` de altura replica el relleno vertical | Medio (solo si cambia el vertical) |
| `src/components/layout/Sidebar.tsx:563, 610` | el aside y el botón solo llevan top/bottom | Medio |
| `src/app/(launcher)/layout.tsx:37` e `inicio/page.tsx:224, 278` | `px-6` sin inset | Bajo |
| `src/components/ui/ModalShell.tsx:203, 248` | velo `p-4` y rama `fullscreenMobile` | Medio: 32 consumidores |
| `src/components/agenda/AppointmentModal.tsx:1027, 1082, 1825` | pantalla completa < 768 | Medio: el propio archivo pide no rozar su geometría (1049-1054) |
| `SheetFiltrosExpediente.tsx:143`, `CommandPalette.tsx:251`, `launcher/ConsultaRapidaModal.tsx:243`, `ui/Toast.tsx:78`, `perfil/page.tsx:1323`, `agenda/configuracion/AvisoGuardado.tsx:39`, los 10 modales a mano de §6 | cada uno fija su posición contra la ventana | Bajo cada uno; **muchos archivos** |
| `src/app/globals.css:5956-6008` y `spinus-tokens.css:2592` | `.ag-capa`, `.ag-hoja`, `.sp-firma-modo` | Medio: las capas se posicionan por JS con `innerWidth` |
| `src/app/manifest.json/route.ts:11` | `portrait-primary` frente al modo horizontal | Bajo de código, alto de producto: afecta a todos los dispositivos |

Hacerlo modal por modal invita a una utilidad compartida: **Protocolo 4** prohíbe
abstracciones nuevas sin OK explícito (aunque aquí hay bastante más de 3 casos reales).

### (b) Navegación a la derecha según `data-borde-sistema`

| Archivo | Qué | Riesgo |
|---|---|---|
| Sonda JS (archivo nuevo, o ampliación de `components/layout/ScriptTema.tsx`) | escribir el atributo en `<html>` antes de pintar | **Alto por protocolo:** archivo nuevo (P1), posible hook/contexto (P4). `ScriptTema` es el precedente y se monta en `(app)/layout.tsx:141` y `(launcher)/layout.tsx:20`, no en la raíz |
| `src/app/layout.tsx:83-89` | el comentario del `suppressHydrationWarning` deja de ser cierto | Bajo, pero la raíz afecta a login y landing |
| `src/components/layout/Sidebar.tsx:557-614, 724, 790-798` | `left-0`, `-translate-x-full`, `left-4`, sangría de submenús, iconos de plegado; riel de iconos | **Alto.** 897 líneas; contiene `handleLogout` con el registro NOM-024 («NUNCA quites el audit log»), la limpieza de cachés al desmontar (413-421) y el razonamiento «dos hamburguesas frente a cero» (495-545). Un riel nuevo en archivo aparte duplicaría o movería esa lógica. Funciones nuevas ≤50 líneas (P3) |
| `src/app/(app)/layout.tsx:177` | `lg:ml-64` | Alto (mismo archivo delicado) |
| `src/components/billing/SuscripcionBanner.tsx:39` | `lg:ml-64 sb-banner-desplazado` | Bajo; lo comparte `(launcher)` |
| `src/app/globals.css:2181-2190` | reglas de barra plegada con `margin-left` y `aside ~ main` (depende del orden en el DOM) | Medio |
| `src/app/(app)/perfil/page.tsx:1323` | `lg:left-64` | Bajo |
| `Sidebar.tsx:381`, `AgendaCliente.tsx:239, 736-737`, `lib/agenda/vistasAgenda.ts:70`, globals.css 1509/1549/2181/2216/5226 | el corte 1024 escrito a mano frente al 900 previsto | **Alto.** La agenda exige que media query y estado de React crucen el umbral «en el mismo píxel» (globals.css:5224-5225). 288 usos de `lg:` |
| `src/contexts/MenuMovilContext.tsx` | con riel siempre visible el booleano cambia de sentido | Medio: el archivo prohíbe añadirle estado (26-29) |
| `src/app/globals.css:946-954` | franja del sistema solo arriba | Medio: z 45 encajado entre menú y modales |

No toca middleware ni guardas: sin riesgo de «Autoridad de sesión» mientras nadie mueva un
guarda de layout. Protocolo 6 (service workers) no aplica; la sonda no debe registrar nada.

### (c) Unificar los encabezados móviles

| Archivo | Qué | Riesgo |
|---|---|---|
| `src/components/layout/Sidebar.tsx:557-567` | botón flotante | Alto (ver arriba). Protocolo 2 antes de borrar: `.menu-flotante` es asidero de dos reglas CSS |
| `src/app/globals.css:2173, 2204, 2216-2220` | las dos reglas `body:has()` y el recorte de relleno | Medio: documentan por qué el fallo debe dejar dos menús y no cero |
| `src/app/(app)/layout.tsx:221` | los `4rem` de arriba existen solo para el flotante | Alto (archivo) + acoplado a la agenda |
| `dashboard/page.tsx:98-114`, `dashboard/AsistenteDashboard.tsx:62-77`, `components/ui/Skeleton.tsx:78-92` | tres copias de `.dash-barra-movil` | Bajo-medio: deben cambiar las tres a la vez (Skeleton.tsx:62-66) |
| `components/agenda/BandaMovil.tsx:114-116`, `AgendaCliente.tsx:599, 1510-1512`, `agenda/loading.tsx:56-72` | el ☰ de la banda y su esqueleto | Medio-alto: agenda v2 en curso, con e2e a 390 px (`e2e/agenda-j1-engrane.e2e.ts:127`) y un test que afirma clases de la banda (`lib/tests/herramientasV2.test.tsx:54`) |
| `(launcher)/inicio/page.tsx:224-263` (y `(launcher)/layout.tsx`) | `/inicio` no tiene navegación | Medio: decisión de producto (¿sigue existiendo el lanzador?); las reglas de «Landing pública» NO aplican a `/inicio` |
| Sub-encabezados (flechas atrás, `Breadcrumbs`, `<h1>`) en ~12 páginas | sin patrón común | Bajo cada uno; **muchos archivos** → plan obligatorio. Un componente «encabezado de página» común es una abstracción nueva: P4 pide OK explícito |

### Restricciones de CLAUDE.md que condicionan las tres
- **P3:** >200 líneas nuevas exige proponer antes una alternativa de <50.
- **P4:** nada de providers, contextos ni hooks reutilizables nuevos sin OK explícito.
- **P5:** el comportamiento real de `env(safe-area-inset-right)` en el Duo es una suposición
  hasta medirlo; cualquier propuesta basada en ello debe marcarse «ASUMIENDO QUE…».
- **Nombres de archivo:** nunca dos que difieran solo en mayúsculas (riesgo real si se crea un
  `Riel.tsx` junto a una utilidad `riel.ts`).
- **Seguridad:** el cierre de sesión con su registro de auditoría debe sobrevivir al traslado.
- **Una sesión = un objetivo:** (a), (b) y (c) son tres objetivos.

---

## 10. Lo que NO se verificó
- Ningún comportamiento en dispositivo o navegador (insets reales, orientación en PWA de iOS).
- Interior de `/expediente/[id]/estado`, `/laboratorios`, `/suplementacion`, `/ayuda`,
  `/billing`: solo se revisó su raíz y su cabecera.
- Componentes de documentos y de laboratorios por dentro (más allá de sus elementos fijos).
- Los e2e de Playwright solo se listaron; no se revisó cuáles dependen del lado del menú.
- Las referencias a calculadoras en `AgendaCliente.tsx` y `useCalculadoraContextual.ts`.
