# Pendientes técnicos para publicar los documentos tal como quedaron

Rutas sobre la rama `origin/feature/integracion-rediseno-agenda`. Nada de esto se hizo: el repositorio no se tocó.

## Imprescindible para publicar

### Documento 1 — aviso de Spinus para usuarios

| Qué | Dónde |
|---|---|
| Sustituir el texto actual por el documento 1; subir versión a 3.0 y poner la fecha | `src/components/legal/AvisoPrivacidadContent.tsx` (constantes en `:30-31`) |
| Quitar «®» del título y metadatos de la página | `src/app/privacidad/page.tsx:5-7`, `src/app/privacy/page.tsx:5-7` |
| Corregir el enlace de la autoridad a `www.gob.mx/buengobierno` | `AvisoPrivacidadContent.tsx:906` (queda resuelto al sustituir el texto) |
| Recoger la aceptación del aviso y de los términos al registrarse (casilla o leyenda con enlaces). Hoy no existe | `src/app/register/page.tsx` |

### Documento 2 — aviso integral del consultorio

| Qué | Dónde |
|---|---|
| Crear la página pública que pinta el documento 2 con los datos del consultorio (por ejemplo `/reservar/[codigo]/privacidad`, y una dirección equivalente para pacientes ya dados de alta) y declararla pública | Ruta nueva; `src/middleware.ts:222` |
| Pasar la dirección de esa página al aviso simplificado: hoy va vacía | `src/app/reservar/[codigo]/page.tsx:122` (`url: ''`) |
| Marcador nuevo `{CORREO_PRIVACIDAD}`: campo de correo de contacto por consultorio o clínica. Si no se construye antes de publicar, quitar del documento 2, sección 10, las palabras «al correo {CORREO_PRIVACIDAD} o,» | Configuración de la clínica; función que rellene el documento 2 |
| No abrir enlaces de reserva de un consultorio sin dirección o sin teléfono: el aviso quedaría con huecos | `src/lib/reserva/puertaReserva.ts:36-41`; `telefonoDeContacto` en `:84-87` puede devolver nulo |
| Que la casilla del alta de paciente enlace al aviso del consultorio y no a `/privacidad` (que pasa a ser el de Spinus) | `src/app/(app)/pacientes/nuevo/page.tsx:521`, `src/components/ui/QuickPatientModal.tsx:366`, `src/components/launcher/ConsultaRapidaModal.tsx:497`, `src/components/CommandPalette.tsx:527` |
| Unificar el texto de esas cuatro casillas («Informé al paciente del aviso de privacidad del consultorio») y quitar «(LFPDPPP Art. 9)» | Mismas líneas; `ConsultaRapidaModal.tsx:498`, `CommandPalette.tsx:528` |
| Registrar la versión real del aviso en el alta: hoy se escribe el literal `v1.0-2026-04-08`. Requiere migración (pasa por `supabase/AUDITORIA-MIGRACIONES.md`) | `supabase/migrations/20260912190416_remote_schema.sql:1062` y `:1251`; `20260913_b5_perfil_completo_rls.sql:741` |

### Documento 3 — aviso simplificado y casilla

| Qué | Dónde |
|---|---|
| Sustituir `AVISO_PLANTILLA` por `3-aviso-simplificado-reserva.txt`, sin la marca de pendiente ni los `[VERIFICAR]`; `AVISO_VERSION = 'reserva-2026-12-v1'` | `src/lib/reserva/avisoReserva.ts:27-52` |
| Sustituir `AVISO_CASILLA` por `3-casilla.txt` | `avisoReserva.ts:55-56` |
| Quitar `{PLAZO}` y `PLAZO_PROPUESTO`: el texto nuevo no promete plazo | `avisoReserva.ts:32`, `:108`, `:110` |
| Cambiar la prueba que exige `[VERIFICAR` en la plantilla | `src/lib/tests/avisoReserva.test.ts:57` |
| Mostrar el aviso abierto, no dentro de un `<details>` cerrado | `src/app/reservar/[codigo]/FormularioDatos.tsx:56-59` |
| Incluir la casilla en la huella (por ejemplo, resumir aviso + casilla); hoy solo se resume la plantilla | `avisoReserva.ts:59-61`; `scripts/aviso-reserva-hash.ts` |
| Aprobar: correr `npx tsx scripts/aviso-reserva-hash.ts` y pegar el `INSERT` en el editor SQL | — |

### Documento 4 — acuerdo de encargo

| Qué | Dónde |
|---|---|
| Añadir la sección a los Términos y numerarla | `src/components/legal/TerminosContent.tsx` |
| Revisar que el resto de los Términos no la contradiga (hoy remiten al aviso para estos temas) | `TerminosContent.tsx:279`, `:305`, `:347`, `:602` |
| La aceptación de los Términos al registrarse (mismo pendiente del documento 1) | `src/app/register/page.tsx` |

### Marca

Quitar «®» de «Spinus» en todo el sitio: 42 apariciones en 25 archivos de `src/` (`git grep -n "Spinus®" -- src`), entre ellas `src/components/legal/LegalLayout.tsx:56`, `src/app/reservar/[codigo]/page.tsx:31` y `src/components/legal/AvisoPrivacidadContent.tsx:206`. Revisar también los PDF (`src/lib/pdf/`) y las plantillas de correo.

## Compromisos que hoy se cumplen a mano

Los textos los prometen porque la ley los exige; el sistema aún no los automatiza. Hay que tener un procedimiento escrito hasta que existan.

| Compromiso | Estado |
|---|---|
| Suprimir a solicitud los datos de una reserva (documento 2, §9) | No hay función; las tablas de la reserva no admiten `DELETE`. Solo aparece en pruebas SQL. Hoy sería una operación manual de Angel en la base |
| Suprimir o anonimizar por instrucción del consultorio en 30 días (documento 4, 12.3) | Existe anonimización por paciente (`src/app/api/admin/paciente/[id]/anonimizar/route.ts`); no hay operación por clínica |
| Avisar de cambios por correo (documentos 1 y 4) | Envío manual |
| Avisar de una vulneración en 72 horas (documento 4, 11) | Procedimiento por escribir |
| Remitir al consultorio las solicitudes de pacientes que lleguen a privacidad@spinus.com.mx | Manual |

## Mejora posterior

1. Purga automática de reservas, historial, verificaciones y contadores de intentos; con ella se podrá publicar un plazo de conservación concreto.
2. Baja individual de recordatorios (hoy el interruptor es por clínica: `src/lib/confirmacion/recordatorios.ts`).
3. Consentimiento de datos personales firmado por el paciente dentro del módulo de firma.
4. Campo «responsable» (nombre o razón social) y domicilio para notificaciones por clínica, para cuentas que sean persona moral.
5. Que el consultorio pueda ajustar los umbrales del límite de reservas (hoy solo el rol `postgres`: `20261201120000_agenda_f1_ajustes_tipos_horarios.sql:244-247`, `:707`).
6. No escribir el nombre del paciente en la bitácora inmutable al anonimizarlo: `src/app/api/admin/paciente/[id]/anonimizar/route.ts:84`.
7. Corregir el comentario que afirma que el título libre enviado a Google está declarado en el aviso: `src/components/agenda/AppointmentModal.tsx:1235-1240` (ahora sí lo está, en los documentos 2 y 4).
8. Actualizar las citas de artículos en comentarios de código: `src/lib/logger.ts:2`, `src/lib/secureStorage.ts:4`, `src/lib/sentryPiiFilter.ts:2` (hoy art. 18); `anonimizar/route.ts:9` (art. 24); `rectificar/route.ts:9` (art. 23).
9. Dejar una sola ruta para el aviso (`/privacidad`) y redirigir `/privacy`.
10. Retirar `@anthropic-ai/sdk` de `package.json` si no se usa: no encontré llamadas en `src/`, y por eso los documentos no nombran a Anthropic.
