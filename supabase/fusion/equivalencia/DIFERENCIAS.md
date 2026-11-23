# E0 · Equivalencia de las 44 migraciones originales y las 6 fundidas

**Veredicto vigente (3.ª vuelta, 2026-11-22, tras las correcciones CB de la auditoría ronda 1,
`965fff5e`): ACEPTADO.**

Hay **127 diferencias de estructura**. Todas están explicadas y son ACEPTABLES; no hay ninguna DUDOSA
ni NO ACEPTABLE.
- **Las 118 de la vuelta 2 siguen todas.** Cuatro cambian de valor, pero sólo en el texto de un
  COMMENT.
- **9 son nuevas:**
  - 3 columnas en `respaldos.consultorios_horario_20261119`;
  - 5 COMMENT;
  - 1 función, `proteger_reserva_contactos()`. Es la **única** función cuyo código cambia respecto de
    la vuelta 2. El cambio es **a propósito y cambia comportamiento**: cierra un hueco de aislamiento
    entre clínicas (A3).

No hay ninguna otra función con el cuerpo distinto del de la vuelta 2 [E].

Marcas: **[E]** = comprobado ejecutando; **[D]** = deducido (leyendo código o catálogo, sin ejecutar).

## 1. Método (el de las vueltas 1 y 2)

Cada base es un clon de `~/spinus-fusion/base-main` con el mismo `aplicar.sh` (psql como `postgres`,
`ON_ERROR_STOP`). Por la memoria del equipo trabajé con **un solo contenedor vivo a la vez**:
- extraje de cada base el catálogo (`comparar-estructura.sh --extraer`), los `prosrc`, un `pg_dump
  --schema-only` y las salidas de comportamiento a `~/spinus-fusion/ensayo-e0c/<base>/`;
- borré el contenedor antes de levantar el siguiente;
- comparé las fotos guardadas.

| Base | Contenido |
|---|---|
| **A** | las 44 del tag `fusion-originales` |
| **V2** | los 6 fundidos de la vuelta 2 (commit `c665999c`) |
| **B** | los 6 fundidos de hoy, sin `20261201180000`, aplicados de uno en uno con `invariante.sql` |
| C / D | como A / B, sobre un clon con `datos-previos.sql`; más `proteger-contactos.sql` |
| P | clon de la foto REAL de producción + las 9 de hoy (§6) |

**Aplicación [E].** Ningún `ERROR` en ninguna base.
- A: 44/44, con los 2 REVISAR de siempre de la rejilla de K1 («REVISAR es lo esperado»; su fila dice
  OK).
- V2 y B: 6/6, sin REVISAR, con 51 OK y 3 INFO.

## 2. Estructura [E]

| Comparación | Catálogo | `pg_dump` por objeto |
|---|---|---|
| A ↔ B | **127**. Con `--esperadas DIFERENCIAS.tsv`: 127 esperadas, 0 inesperadas, ninguna sin aparecer | 119 = 112 + 7 |
| V2 ↔ B | **13** | 11 (las 3 columnas son un solo objeto TABLE) |

Las 13 de V2 ↔ B son exactamente las que declaró el corrector. No hay ningún cambio de permisos,
disparadores, índices, restricciones, policies ni atributos de función:
- 3 columnas nuevas en el respaldo: `horario_antes` y `horario_copiado` (jsonb, NOT NULL) y
  `copiado_en` (timestamptz, NOT NULL, DEFAULT `now()`);
- 1 `md5_cuerpo`: `proteger_reserva_contactos`;
- 4 COMMENT de columna nuevos: `avisos_clinica.cita_id`, `gcal_movimientos_rechazados.cita_id` y
  `reserva_empalmes_google.cita_otra_id`/`cita_reserva_id`. Explican por qué no llevan FK (A9);
- 5 COMMENT cambiados:
  - `agenda_bloqueos`, `cita_proteger_bloqueo` y `reservar_por_enlace` añaden el «LÍMITE ACEPTADO» A7;
  - `reserva_contactos` describe la regla A3;
  - `respaldos.consultorios_horario_20261119` describe las columnas nuevas.

Diff por palabras en `salidas/vuelta3/comentarios-palabras-V2-B.txt`.

De esas 13, 4 caen sobre filas que ya estaban entre las 118 (los COMMENT de `agenda_bloqueos`,
`cita_proteger_bloqueo`, `reservar_por_enlace` y el respaldo), y 9 son diferencias nuevas frente a A.

**`cuerpos.py` V2 → B** [E]. Sólo sale `proteger_reserva_contactos()`, y en su código. Frente a A:
- 14 funciones son IDÉNTICAS sin comentarios;
- 19 cambian: las 17 del interruptor, el HINT y `proteger_reserva_contactos`.

**Inexactitud menor de texto** [E, catálogo]. No toca la estructura y no la arreglé. El COMMENT nuevo
de `gcal_movimientos_rechazados.cita_id` dice que «la policy no muestra la fila». Esa tabla no tiene
ninguna policy: tiene RLS activada y sólo `service_role` tiene SELECT. El efecto, que nadie de la
sesión la ve, es el mismo.

## 3. `proteger_reserva_contactos()`: el único cambio de comportamiento

md5 de `prosrc`: A = V2 = `e9937c88…` → B = `7049ecc7…` [E]. Sigue INVOKER, `search_path=''`, con el
mismo dueño y el mismo EXECUTE.

**El diff de código frente al original** (sin comentarios) es un bloque de cuatro líneas añadido en
la rama `INSERT`, antes de rellenar sellos y actores. Comprobado frente a A y frente a V2:

```sql
IF NOT EXISTS (SELECT 1 FROM public.profiles p
WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
RAISE EXCEPTION 'El médico del contacto no pertenece a la clínica' USING ERRCODE = '23514';
END IF;
```

La rama UPDATE y la exención de `postgres`/`supabase_admin` no cambian [E, diff].

**Comportamiento** [E]: corrí `proteger-contactos.sql` (nuevo, 23 pasos, ROLLBACK) en C y en D; diff
en `salidas/vuelta3/proteger-contactos-{A,B}.out`.

**Iguales en A y en B (17 pasos):**
- `reserva_contacto_marcar`, el único escritor de la app, con la sesión:
  - el administrador sobre su cita y sobre la de otro médico;
  - el desbloqueo por `ON CONFLICT`;
  - la secretaria;
  - el médico sobre su cita;
  - el médico sobre la cita de otro y el de otra clínica: 0, porque no la ven;
  - `reserva_contacto_estado`.
- INSERT directo: el administrador y la secretaria con un médico de su clínica, y el médico consigo
  mismo.
- `anon` y `service_role`: `42501 permission denied`.
- `postgres`: exento, inserta.
- UPDATE: el de identidad (`42501`) y el legítimo.
- Las filas finales y sus actores.

**Distintos (5 pasos, todos INSERT directo por PostgREST):**

| Paso | A (originales) | B (hoy) |
|---|---|---|
| 13 administrador de C1 con `medico_id` de otra clínica | **aceptado** (el hueco) | `23514` |
| 14 secretaria de C1 con `medico_id` de otra clínica | **aceptado** (el hueco) | `23514` |
| 15 administrador con `medico_id` de quien no es médico (la secretaria) | **aceptado** (el hueco) | `23514` |
| 16 médico no administrador con otro médico de su clínica | `42501` (RLS) | `23514` |
| 17 médico de otra clínica que inserta en C1 | `42501` (RLS) | `23514` |

- **13 a 15** son el cierre del hueco A3, que es lo que se buscaba.
- **16 y 17** ya se rechazaban; sólo cambia el SQLSTATE, porque el disparador BEFORE corre antes que
  el WITH CHECK de la RLS. La app no llega a ese camino: escribe por `reserva_contacto_marcar`, que da
  0 en esos casos en A y en B (pasos 06 y 07). [E, grep: en `src/` no hay ningún
  `.from('reserva_contactos')`; la ruta `api/agenda/reservas/contactos` usa las RPC.]

**Tampoco cambia lo demás** [E]:
- `comportamiento.sql` da A = V2 = B byte a byte. Ese guion no toca `reserva_contactos`.
- Pruebas SQL:
  - las que ejercen `reserva_contactos` (`d2`, `d3`, `seg1`, `j2`, `i2`, `h2`) pasan en A, V2 y B;
  - B tiene 48 y pasan 46. `cb_aislamiento_clinicas`, nueva, PASA. Fallan las dos esperadas:
    `m_saludo_recordatorio`, que pide la semilla (con `semilla-minima.sql` pasa en A, V2 y B), y
    `t_agenda_sin_truncate`, que es de `20261201180000` y no se aplicó.

Un **caso límite** que no probé [D]: el disparador exige `role = 'medico'`. Una cita cuyo `medico_id`
fuera un `super_admin` ya no podría bloquear su contacto. En la app el médico de una cita es siempre
un perfil `medico` (el administrador-médico también tiene `role = 'medico'`).

## 4. Datos previos [E]

`datos-extraer.sql` sobre C y D:
- consultorios, clínicas, citas, `audit_log` del backfill y conteos son **idénticos**;
- las 3 filas del respaldo son iguales **quitando las 3 claves nuevas**;
- en D, `horario_antes` es igual a `horario` (la primera copia) y `horario_copiado` es igual al
  `consultorios.horario` resultante, en las 3 filas.

Salidas en `salidas/vuelta3/datos-{C,D}.txt`.

## 5. Invariante entre archivos [E]

`herramientas/invariante.sh` aplicó B de uno en uno. Tras la base y tras cada uno de F1, F5a, F3, F2,
F4 y F5b, el invariante da **24/24**: crear, editar, mover y cancelar, con médico, secretaria y
`service_role`, con la v2 encendida y apagada (`salidas/vuelta3/invariante-tras-cada-archivo.txt`).
También da 24/24 sobre A, V2 y P completas.

## 6. Comprobación extra: la foto REAL de producción [E]

- **Clon** de `~/spinus-produccion-foto`: 0 errores y 14 diferencias, las 14 de `esperadas-clon.tsv`.
- **Aplicación** como `postgres`, en orden: `20261125170000`, `20261126120000`, los 6 fundidos y
  `20261201180000`. Las **9 entran limpias**: 0 `ERROR`, **0 REVISAR**, 63 OK y 10 INFO.
- **Invariante** después: 24/24.
- El registro de este clon se quedó fuera del repo (`~/spinus-fusion/ensayo-e0c/prod/`), porque
  refleja la estructura de producción.

## 7. `diferencias/CONJUNTO.tsv`

El corrector ya lo había puesto al día. Comprobado con B contra `ref-originales/05-catalogo.jsonl`,
usando `CONJUNTO.tsv` + `esperadas-clon.tsv`: **139 diferencias, 139 esperadas, 0 inesperadas** [E].

Toqué una sola cosa. La fila glob nueva `comentario function public.reservar_por_enlace(*)` (A7) nunca
se usaba, porque la tapaba la fila exacta de la misma función, que va antes. Fundí su razón en la fila
exacta y la quité. Las únicas «sin aparecer» son las de `esperadas-clon.tsv` (viaje foto → clon), como
en las vueltas 1 y 2.

## 8. Lo que no comprobé

- `gcal_aplicar_evento` con datos, `reserva-carrera.sh`, las e2e y PostgREST.
- Planes, candados y concurrencia.
- El historial de migraciones (apliqué con psql, no con la CLI).
- `cb_aislamiento_clinicas.sql` sobre A [D: debería fallar, que es su propósito; lo dice su cabecera].

## 9. Historia

- **Vuelta 1** (fundidos de `8f5ac083`). 96 diferencias, todas ACEPTABLES:
  - 52 COMMENT y 10 permisos;
  - 3 policies;
  - 31 funciones: 9 sólo cambiaban comentarios, 17 sólo la lectura del interruptor por
    `public.agenda_v2_encendida(x)` (equivalente: misma clínica, `clinica_id` UNIQUE, NOT NULL, sin
    `FOR UPDATE`, INVOKER, EXECUTE revisado), 1 el HINT, 1 era nueva y 3 se retiraron.

  El comportamiento salía igual byte a byte, y `reserva_enlaces_insert` retirada dejaba B más
  estricta. Salidas en `salidas/`.
- **Vuelta 2** (tras C1, C2 y C3; `c665999c`). 118 = 96 + 22, todas de la poda de comentarios:
  - 5 `md5_cuerpo` y 17 COMMENT;
  - 9 funciones con `prosrc` cambiado, todas sólo en comentarios: IDÉNTICO sin comentarios y 0 líneas
    de código en el diff crudo;
  - ninguna ventana rota entre archivos;
  - la foto real entraba limpia.

  Salidas en `salidas/vuelta2/`.

## Archivos

- `DIFERENCIAS.tsv`: las 127, en formato `--esperadas`; las de cada vuelta al final, en su bloque.
- Guiones con datos inventados: `comportamiento.sql`, `invariante.sql`, `proteger-contactos.sql`
  (nuevo), `datos-previos.sql`, `datos-extraer.sql`, `policy-sin-disparador.sql` y
  `semilla-minima.sql`.
- `herramientas/`.
- `salidas/`, `salidas/vuelta2/` y `salidas/vuelta3/`.
