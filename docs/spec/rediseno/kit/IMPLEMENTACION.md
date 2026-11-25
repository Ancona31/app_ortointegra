# Reglas para los agentes que IMPLEMENTAN el rediseño en el repo

Repo: `/home/user/app_ortointegra`, rama `feature/rediseno-estetico` (creada desde `feature/agenda-v2` @ 951e31b3). S = /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
Responde en español.

## Antes de tocar nada, lee
1. `/home/user/app_ortointegra/CLAUDE.md` y `AGENTS.md` ENTEROS: sus protocolos son obligatorios. `AGENTS.md` exige leer la guía pertinente de `node_modules/next/dist/docs/` antes de escribir código de Next.
2. `S/entrega/PLAN.md` (el plan aprobado): §2 (estrategia) entera y la sección de TU bloque en §3; §6 riesgos; §7 arreglos incluidos y deuda que no se toca.
3. `S/entrega/kit/CALMA.md` (§1–§31) y `S/entrega/kit/BRIEF.md`: reglas de diseño y decisiones del dueño. `S/entrega/kit/base.css`: tokens.
4. Las maquetas de tu bloque en `S/entrega/…` (rutas en `S/entrega/ESTADO.md`): son la referencia del resultado. El skill `/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/app/.agents/skills/apple-design/SKILL.md` si existe; si no, `git show origin/main:.agents/skills/apple-design/SKILL.md`.

## Reglas duras
- SOLO estética: visual, layout, tipografía, iconografía, movimiento. Nada de backend, migraciones, RLS, rutas API, lógica de negocio. Ninguna función se pierde ni se añade (salvo lo aprobado en CALMA §23–§31).
- Tocas ÚNICAMENTE los archivos que el plan lista para tu bloque. Si necesitas otro, PARA y dilo en tu informe; no lo toques.
- No tocar jamás: `src/lib/anonimizar.ts`, llamadas de anonimización, validaciones de rol/autenticación, guardas de sesión (`middleware.ts`, layouts con `getUser()`), audit log, filtros de Sentry, Service Workers, `(offline)/*`, `supabase/`, migraciones.
- Sin dependencias nuevas. Sin `any`. Sin `as` para silenciar tipos. Funciones nuevas ≤ 50 líneas. Sin abstracciones fuera de las que el plan nombra.
- Textos: los de hoy, salvo la lista aprobada (CALMA §15, §20, §23, §28–§30; `S/entrega/ESTADO.md`). Cada texto que cambie va con su prueba (unitaria o e2e) actualizada EN EL MISMO COMMIT.
- No cambies nombres de clase, roles, `aria-*` ni `data-testid` que usen las pruebas (grep en `e2e/` y `src/**/*.test.*` antes de renombrar o quitar algo).
- Nunca insets fijos (84, 82, 59, 34): siempre `env(safe-area-inset-*)` / las variables `--it/--ir/--ib/--il`.
- Borrar un archivo o un bloque >50 líneas: antes `grep -rn` de sus usos y repórtalo; si hay usos vivos, no se borra.
- Errores de front que encuentres dentro de estas reglas: corrígelos y repórtalos. Problemas de funcionalidad/backend: NO los toques; anótalos para `DEUDA_TECNICA.md` en tu informe.

## Verificación obligatoria (tras CADA cambio lógico, antes de commitear)
- `npm run build` (Webpack; con `NODE_OPTIONS=--max-old-space-size=8192`). Si falla: no sigas; arréglalo o revierte.
- `npm run lint` si tocaste tipos o TSX. No aumentes el número de errores respecto a la línea base de B0.
- Pruebas unitarias afectadas (`npx vitest run <ruta>`), y la suite unitaria completa al cerrar el bloque.
- Al cerrar el bloque: capturas con Playwright en los cinco formatos (ext 466×678 con franja derecha 84 y abajo 34; tel 393×852 arriba 59 abajo 34; ih 951×669 derecha 84 abajo 34; iv 669×951 arriba 82; esc 1280×800), claro y oscuro, usando `Emulation.setSafeAreaInsetsOverride` (ver `S/tools/cap.js`), y compáralas mirándolas con Read contra la maqueta. Usuario de semilla local: `admin.a@semilla.spinus.test` / `Semilla-Agenda-2026` (datos ficticios; nunca datos reales).
- e2e que toquen lo que cambiaste, cuando el entorno (Supabase local) esté disponible; si no lo está, dilo explícitamente: «e2e NO corridas».

## Commits
- Un commit por cambio lógico, mensaje en español estilo del repo (`feat(rediseno): …`, `fix(...)`, `test(...)`, `docs(...)`), terminado con estas dos líneas:
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01SFKuRVLP8isEJabLWjMiuX
- NO hagas push ni PR: el push lo decide el orquestador. No cambies de rama ni reescribas historia. No uses `git add -A` a ciegas: añade solo tus archivos. Nunca commitees `.env*`.

## Informe final (formato fijo, honesto)
1. Qué hiciste (por commit: hash corto + una línea).
2. Archivos tocados (lista exacta) y si alguno estaba fuera de la lista del plan.
3. Verificación: resultado literal de build, lint (nº de errores vs línea base), unitarias (pasan/fallan), e2e (cuáles, o «no corridas» y por qué), capturas que MIRASTE.
4. Qué NO funcionó o quedó a medias. Qué supuestos hiciste («ASUMIENDO QUE…»).
5. Decisiones que tomaste sin preguntar.
6. Deuda técnica detectada (no tocada).
7. Qué sigue según el plan.
No digas que algo está verificado si no lo corriste o no lo miraste.
