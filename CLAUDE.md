@AGENTS.md

# Reglas del proyecto Spinus®

## Reglas de seguridad — NO NEGOCIABLES

- NUNCA modifiques `src/lib/anonimizar.ts` ni quites las llamadas de anonimización en las rutas de IA
- NUNCA cambies `ON DELETE RESTRICT` a `CASCADE` en ninguna foreign key
- NUNCA quites las validaciones de roles o autenticación en endpoints de API
- NUNCA guardes datos de pacientes en localStorage sin usar `secureStorage`
- NUNCA envíes datos identificables de pacientes a APIs externas (Gemini, Anthropic, Google Calendar, Sentry)
- NUNCA permitas editar o eliminar notas clínicas ya guardadas — son inmutables
- NUNCA quites los filtros PII de Sentry
- NUNCA quites el audit log de ninguna acción
- NUNCA pases HTML sin sanitizar a Puppeteer
- Si necesitas modificar alguno de estos archivos, explícame qué vas a cambiar y por qué ANTES de hacerlo

## Buenas prácticas de TypeScript

- NUNCA uses `any`. Usa tipos explícitos, generics, `unknown` o `Record<string, unknown>` según corresponda
- Siempre define interfaces o types para props de componentes, respuestas de API y datos de la DB
- Usa tipos estrictos de Supabase generados con `supabase gen types` para las queries
- Prefiere `as const` sobre enums cuando sea posible
- Usa discriminated unions para manejar estados (loading, error, success)
- Toda función pública debe tener tipos de retorno explícitos
- Usa Zod para validación de inputs en API routes y formularios
- Nunca uses type assertions (`as`) para silenciar errores — corrige el tipo real
- Usa Optional chaining (`?.`) y nullish coalescing (`??`) en lugar de checks manuales
- Prefiere `satisfies` sobre `as` para validar tipos sin perder inferencia

## Estilo de código

- Componentes React: functional components con hooks, nunca class components
- Nombra archivos de componentes en PascalCase, utilidades en camelCase
- Un componente por archivo
- Extrae lógica compleja a custom hooks en `src/hooks/`
- Extrae utilidades reutilizables a `src/lib/`
- Server actions y API routes validan inputs en el servidor, nunca confíes solo en el frontend
- Maneja errores con try/catch en toda llamada async, nunca dejes promesas sin catch
- Usa el logger de `src/lib/logger.ts` en lugar de `console.log`
- Imports absolutos con `@/` en lugar de rutas relativas largas

## Estructura del proyecto

- `src/app/` — páginas y API routes (App Router)
- `src/components/` — componentes React reutilizables
- `src/hooks/` — custom hooks
- `src/lib/` — utilidades, tipos, configuraciones
- Las migraciones SQL van en archivos separados con prefijo `supabase_migration_`

## Antes de cada cambio

- Corre `npm run build` después de cada modificación para verificar que compila
- Si un cambio toca más de 5 archivos, explícame el plan antes de ejecutar
- Haz commits atómicos: un cambio lógico por commit con mensajes descriptivos en español
- Si necesitas instalar una dependencia nueva, dime cuál y por qué antes de instalarla

## Base de datos

- NUNCA ejecutes migraciones SQL directamente. Genera el archivo SQL y yo lo ejecuto manualmente en Supabase
- NUNCA hagas DELETE de datos en producción
- Toda tabla nueva con datos de pacientes DEBE tener RLS activado
- Toda foreign key a pacientes DEBE ser `ON DELETE RESTRICT`
- Todo cambio en datos sensibles DEBE registrarse en `audit_log`

## Cumplimiento normativo mexicano

- Esta app maneja datos de salud regulados por la NOM-004-SSA3-2012 y NOM-024-SSA3-2012
- Los datos de salud son datos personales sensibles bajo la LFPDPPP
- Las notas clínicas son inmutables — correcciones se hacen vía addendum
- Los expedientes nunca se borran — se usa soft delete con retención mínima de 5 años
- Todo acceso a expedientes debe quedar registrado en `audit_log`
- El consentimiento de privacidad es obligatorio antes de crear un paciente
