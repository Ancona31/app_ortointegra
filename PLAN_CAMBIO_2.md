# PLAN DE EJECUCIÓN — CAMBIO 2: BUNKER COMO VITE ESTÁTICO

**Fecha de planeación:** 18 de abril 2026
**Estado al momento de este plan:** Cambio 1 completado y validado en producción. SW del búnker sobrevive navegación en app online.
**Objetivo del Cambio 2:** Convertir `/offline-mode` de ruta Next.js a aplicación Vite independiente servida desde `/public/bunker/`.

---

## 🎯 OBJETIVO FINAL

Tener una mini-aplicación de "búnker offline" completamente aislada del código de la app online, que:

- Viva en `/public/bunker/` como HTML+JS+CSS estáticos
- Funcione sin conexión a internet
- Permita al médico: ver/crear pacientes, escribir notas SOAP, generar recetas, producir PDFs
- Sincronice datos hacia Supabase cuando vuelva la conexión
- No comparta código con la app Next.js (aislamiento total)
- Tenga su propio Service Worker con scope `/bunker/`

---

## 🚦 DECISIONES ARQUITECTÓNICAS PREVIAS

Antes de tocar código, tienes que contestarte estas 3 preguntas. **NO inicies la Fase A sin tenerlas resueltas.**

### Decisión 1 — Stack del búnker

| Opción | Bundle size | Complejidad | Reuso de código Spinus |
|---|---|---|---|
| **Vite + React 19** | ~140 KB gzip | Baja | Alto (reutilizas componentes tal cual) |
| **Vite + Preact** | ~50 KB gzip | Media (algunos ajustes) | Medio (Preact es casi compatible) |
| **Vite + Vanilla JS** | ~20 KB gzip | Alta (reescribir UI) | Bajo (reescribes todo) |

**Recomendación:** Vite + React 19. Tu app online usa React 19, así que puedes copiar componentes casi sin modificarlos. El costo de bundle (~140 KB gzip) es aceptable para un búnker que se instala una vez.

**Qué pasa si eliges otra:** Preact te ahorra KB pero vas a pelear con algunos paquetes. Vanilla es puristamente ligero pero te obliga a reescribir la UI desde cero.

**Tu decisión:** _____________________________________________

---

### Decisión 2 — Scope del MVP del búnker

Tienes dos caminos:

**Scope MÍNIMO (recomendado para MVP):**
- Ver lista de pacientes ya sincronizados (read-only desde caché local)
- Crear paciente nuevo offline
- Escribir nota médica SOAP offline
- Generar receta offline
- Ver estos datos al volver online y confirmar sincronización

**Scope COMPLETO (tentador pero peligroso):**
- Todo lo anterior +
- Notas de honorarios
- Solicitudes de laboratorio
- Solicitudes de gabinete
- Edición de pacientes existentes
- Visor DICOM offline (esto es mucho trabajo solo)

**Recomendación fuerte:** Scope MÍNIMO. Lanza el búnker con las 4 capacidades básicas, valida que funcionan en producción con un médico real (tú), y luego agregas. Intentar el scope completo desde el día 1 es la receta para fallar otra vez.

**Tu decisión:** _____________________________________________

---

### Decisión 3 — Estrategia de datos offline

**Opción 1: IndexedDB vacía al entrar al búnker**
El médico entra al búnker sin datos previos. Solo puede crear registros nuevos. Al sincronizar, esos registros nuevos se suben a Supabase.
- **Ventaja:** simple, sin riesgo de datos obsoletos
- **Desventaja:** el médico no puede ver historias clínicas previas en modo offline

**Opción 2: IndexedDB pre-cargada con pacientes de las últimas 2 semanas**
Cuando el médico activa el modo offline (con red), la app descarga los pacientes recientes a IndexedDB. Al entrar al búnker (sin red), puede ver esos datos.
- **Ventaja:** médico puede consultar expedientes recientes sin red
- **Desventaja:** más complejo, datos pueden quedar obsoletos, requiere definir qué "reciente" significa

**Recomendación:** Arranca con Opción 1 para el MVP. Es lo mínimo viable. Opción 2 es una mejora que puedes agregar en una iteración posterior si los médicos la piden.

**Tu decisión:** _____________________________________________

---

## 📋 FASES DE EJECUCIÓN

Cada fase es **una sesión de Claude Code separada**. No intentes hacer 2 fases en una sesión. Entre fases, haz commit y descansa.

### FASE A — Scaffold del proyecto Vite

**Duración estimada:** 45 minutos
**Objetivo atómico:** Tener `bunker-app/` funcionando con Vite, que compile a `public/bunker/`, y que Vercel lo sirva.

**Pre-requisitos:**
- Decisión 1 tomada (stack)
- Commit del Cambio 1 ya en main

**Tareas:**
1. Crear carpeta `bunker-app/` en la raíz del repo
2. Inicializar Vite dentro: `npm create vite@latest bunker-app -- --template react-ts` (ajustar según Decisión 1)
3. Configurar `vite.config.ts`:
   - `base: '/bunker/'`
   - `build.outDir: '../public/bunker'`
   - `build.emptyOutDir: true`
4. Crear `index.html` con un "Hola Búnker" placeholder
5. Correr `npm run build` en `bunker-app/`
6. Verificar que se generan archivos en `public/bunker/`
7. Agregar `public/bunker/` al `.gitignore` del repo principal? **(decisión a tomar: sí o no)**
8. Commit del scaffold
9. Deploy a Vercel y verificar que `https://spinus.com.mx/bunker/` sirve el "Hola Búnker"

**Criterio de éxito:**
- Navegador carga `https://spinus.com.mx/bunker/` y muestra el placeholder
- El build del repo principal (`npm run build` en raíz) sigue funcionando sin romper

**Prompt inicial para Claude Code:**
```
Objetivo de la sesión (atómico):
Crear scaffold del búnker offline como aplicación Vite independiente.

Stack elegido: [PEGA TU DECISIÓN 1 AQUÍ]

Contexto:
Esta es la Fase A del Cambio 2 documentado en PLAN_CAMBIO_2.md.
El búnker es una app separada que va a vivir en bunker-app/ y compilar su output
a public/bunker/. No comparte código con la app Next.js principal.

Archivos permitidos:
- bunker-app/ (carpeta nueva, toda)
- .gitignore (si requiere ajustes)
NO TOCAR: src/, public/ (excepto public/bunker/ como output)

Tareas en orden:
1. Crear bunker-app/ con Vite (template según stack elegido)
2. Configurar vite.config.ts con base: '/bunker/' y outDir: '../public/bunker'
3. Crear un index.html placeholder que diga "Búnker offline — scaffold v0"
4. Correr npm run build dentro de bunker-app/
5. Verificar que public/bunker/ contiene los archivos compilados
6. Reportar tamaño del bundle
7. Sugerir el comando de git commit (sin ejecutarlo)

Espera mi OK en cada paso que requiera decisión.
```

---

### FASE B — Componentes mínimos

**Duración estimada:** 2 horas, posiblemente 2 sesiones
**Objetivo atómico:** Tener formularios básicos (paciente, nota SOAP, receta) dentro del búnker.

**Pre-requisitos:**
- Fase A completada y desplegada
- Decisión 2 tomada (scope MVP)

**Tareas:**
1. Identificar componentes del repo principal que sirven como referencia
2. Copiar/adaptar `PatientForm` al búnker
3. Copiar/adaptar formulario SOAP al búnker
4. Copiar/adaptar formulario de receta al búnker
5. Estilos: decidir si reimplementas Tailwind o usas CSS plano
6. Validar que los formularios renderizan correctamente

**Criterio de éxito:**
- Navegar a `/bunker/` muestra una pantalla con acceso a los 3 formularios
- Los formularios renderizan sin errores de consola

**Notas importantes:**
- NO importes código de `src/` directamente. El búnker es aislado. Copia los archivos.
- Evita traer dependencias pesadas como `@react-pdf/renderer` en esta fase.

---

### FASE C — Service Worker con Workbox

**Duración estimada:** 45 minutos
**Objetivo atómico:** SW con scope `/bunker/` que precachea todos los assets del búnker.

**Tareas:**
1. Instalar Workbox: `npm install -D vite-plugin-pwa workbox-window` en `bunker-app/`
2. Configurar `vite-plugin-pwa` en `vite.config.ts`:
   - `registerType: 'autoUpdate'`
   - `strategies: 'injectManifest'` (para control total)
   - `scope: '/bunker/'`
3. Escribir `sw.ts` custom con `precacheAndRoute(self.__WB_MANIFEST)`
4. Registrar el SW desde el entry point del búnker
5. Verificar en DevTools que el SW se registra con scope correcto
6. Verificar que el precache incluye todos los chunks

**Criterio de éxito:**
- DevTools muestra SW registrado con scope `/bunker/`
- Al recargar `/bunker/` con red offline, la página sigue cargando desde cache

**Nota:** Eliminar el SW antiguo (`public/spinus-bunker-sw.js`) y el registro desde `/offline-setup/page.tsx`. Esos ya no aplican.

---

### FASE D — IndexedDB

**Duración estimada:** 1 hora
**Objetivo atómico:** CRUD básico en IndexedDB para pacientes, notas, recetas.

**Tareas:**
1. Instalar `idb` (wrapper ligero para IndexedDB): `npm install idb`
2. Diseñar schema del vault: stores `patients`, `notes`, `prescriptions`, `_meta`
3. Crear funciones: `createPatient`, `getPatients`, `createNote`, etc.
4. Conectar formularios de Fase B a estas funciones
5. Agregar lista de "registros pendientes de sincronizar"

**Criterio de éxito:**
- Crear un paciente en el búnker, cerrar pestaña, reabrir, el paciente sigue ahí
- Crear nota y receta asociadas al paciente
- Ver lista de todos los registros pendientes

---

### FASE E — PDF rendering offline

**Duración estimada:** 1 hora
**Decisión crítica antes de empezar:** ¿`@react-pdf/renderer` o `window.print()`?

**Opción 1: `@react-pdf/renderer`**
- Pros: control total, PDFs idénticos a los online
- Contras: pesa ~300 KB, necesitas portar los templates de PDF

**Opción 2: `window.print()` con CSS de impresión**
- Pros: peso cero, rápido
- Contras: el usuario decide si guarda como PDF o imprime, menos control

**Recomendación:** Opción 2 para MVP. Funciona, es rápido, y si los médicos lo odian lo cambiamos.

---

### FASE F — Detección de red + UX

**Duración estimada:** 45 minutos

**Tareas:**
1. Implementar `navigator.onLine` + event listeners
2. Indicador visual de estado (verde online, rojo offline)
3. Banner de "Trabajando offline — [N] registros pendientes de sincronizar"
4. Botón "Sincronizar ahora" (desactivado si offline)

---

### FASE G — Sync-Bridge hacia Supabase

**Duración estimada:** 2 horas, probablemente 2 sesiones
**Objetivo atómico:** Cuando hay red, los registros del búnker se suben a Supabase.

**Tareas:**
1. Cliente Supabase dentro del búnker (con las mismas claves que la app principal)
2. Función `syncPending()` que:
   - Itera registros pendientes
   - Los sube a Supabase
   - Si tienen clientId UUID, chequea deduplicación
   - Marca como sincronizados en IndexedDB
3. UUID v4 generado localmente para cada registro (idempotencia)
4. Manejo de errores: 4xx → marcar como DLQ, 5xx → reintentar
5. Respetar timestamps originales (fecha en que se creó offline, no fecha de subida)
6. UI de confirmación: "Sincronización exitosa — X registros subidos"

**Criterio de éxito:**
- Crear 3 pacientes offline, conectarse a red, sincronizar
- Verificar en Supabase que los 3 pacientes aparecen con las fechas offline correctas
- Crear el mismo paciente dos veces (simular red intermitente), verificar que no se duplica

---

### FASE H — Integración con app online

**Duración estimada:** 30 minutos

**Tareas:**
1. Botón "Modo Offline" en la página de login que navega a `/bunker/` (`<a href="/bunker/">`)
2. Eliminar ruta `/offline-mode` (antigua Next.js page)
3. Eliminar ruta `/offline-setup` (antigua Next.js page)
4. Eliminar archivo `public/spinus-bunker-sw.js` (el SW antiguo)
5. Actualizar `CLAUDE.md` sección "Estado actual" con la nueva realidad

**Criterio de éxito:**
- El link desde login lleva al búnker
- No quedan rutas `/offline-*` en Next.js
- App online y búnker conviven sin interferirse

---

### TESTING FINAL EN PRODUCCIÓN

**Duración estimada:** 1 hora

**Checklist de validación (hazlo en ventana incógnito):**

- [ ] Login normal → clic en "Modo Offline" → carga `/bunker/`
- [ ] DevTools → Application → SW del búnker con scope `/bunker/`, activated
- [ ] Crear paciente offline → aparece en lista
- [ ] Crear nota SOAP → aparece asociada al paciente
- [ ] Crear receta → genera PDF descargable
- [ ] DevTools → Network → throttle Offline
- [ ] Refresh `/bunker/` → sigue cargando (desde cache)
- [ ] Crear nuevo paciente estando offline → aparece en lista
- [ ] Reactivar red → banner cambia a "online"
- [ ] Clic en "Sincronizar ahora" → registros suben a Supabase
- [ ] Verificar en Supabase dashboard que los registros están ahí con timestamps correctos
- [ ] Navegar a app online (fuera de `/bunker/`) → verificar que el SW del búnker sigue activo
- [ ] Cerrar navegador → reabrir después de 24h → verificar que el búnker sigue funcionando

---

## 🧠 REGLAS DE LA MANIOBRA

1. **Una fase = una sesión de Claude Code.** No combines.
2. **Commit al final de cada fase.** Con mensaje descriptivo.
3. **Testing después de cada fase.** No acumules cambios sin probar.
4. **Si una fase requiere más de 2 sesiones, revisa el plan.** Probablemente el scope está mal.
5. **Si algo se siente raro, DETENTE.** Es mejor perder 1 hora planeando que 3 días corrigiendo.
6. **Cada sesión empieza con `CLAUDE.md` leído y confirmado.** Sin excepciones.

---

## 📞 CUÁNDO ACUDIR AL ARQUITECTO (Claude en chat web)

Acude a este chat si:
- Necesitas tomar una decisión arquitectónica no contemplada aquí
- Una fase lleva más del doble del tiempo estimado
- Encontraste un bug que no sabes de dónde viene
- Claude Code empieza a salirse de scope
- Vas a empezar una fase nueva y quieres revisar el prompt inicial

NO acudas al chat para:
- Preguntas de sintaxis de React/JS (pregúntale a Claude Code directo)
- Debugging de un componente específico
- Copiar/pegar código

---

## 📌 ESTADO ACTUAL (al 18 abril 2026)

**Completado:**
- ✅ Cambio 1: kill-switch del layout eliminado
- ✅ Deploy a producción validado
- ✅ SW del búnker sobrevive navegación en app online
- ✅ `CLAUDE.md` con protocolos nuevos

**Pendiente:**
- ⏳ Decisiones arquitectónicas previas (Decisión 1, 2, 3)
- ⏳ Fases A hasta H del Cambio 2
- ⏳ Testing final en producción

**Próxima acción sugerida:**
Contestar las 3 Decisiones Arquitectónicas Previas antes de iniciar la Fase A.
