# BASE-2 · B2 — informe: por qué el lote de la purga y de la cola de empalmes no era un tope

> 2026-11-27 · stack local (PostgreSQL 17.6, la imagen de Supabase CLI 2.117.0). Todo lo de abajo está
> ejecutado; donde algo es una explicación y no una medición, lo dice.

## 1. El síntoma

Dos pruebas SQL de bloques ya aplicados fallaban **a veces** al correr la batería y pasaban al repetirlas:

- `ap2_reserva_purga_y_tope.sql`, caso 3: `con lote 1 la pasada dio (1,1,2,t)`. `reserva_purgar(1)` vació
  **2** correos de enlaces de un solo uso en vez de 1.
- `ap3_gcal_empalmes_pendientes.sql`, caso 6: `con límite 1 dio (2,0,t)`.
  `reserva_empalmes_pendientes_procesar(…, 1)` procesó **2** apuntes en vez de 1.

Las dos funciones (M4, `20261204120000`; M5, `20261205120000`; las dos en producción) eligen y escriben el
lote en UNA sentencia con esta forma:

```sql
DELETE/UPDATE … WHERE id IN (SELECT … ORDER BY … LIMIT n FOR UPDATE SKIP LOCKED)
```

## 2. Reproducción y plan capturado

Tras reiniciar el contenedor de la base (estadísticas a cero), `ap2` falló **40 de 40** veces seguidas. Con
`auto_explain` cargado en la sesión de la prueba (`log_analyze`, `log_nested_statements`; quitado después),
éste es el plan de la sentencia que falló, dentro de `reserva_purgar(1)`:

```
Update on reserva_enlaces e  (actual rows=0 loops=1)
  ->  Nested Loop Semi Join  (rows=1) (actual rows=2 loops=1)
        Join Filter: ("ANY_subquery".id = e.id)
        Rows Removed by Join Filter: 4
        ->  Seq Scan on reserva_enlaces e  (rows=1) (actual rows=7 loops=1)
        ->  Subquery Scan on "ANY_subquery"  (actual rows=1 loops=7)
              ->  Limit  (actual rows=1 loops=7)
                    ->  LockRows  (actual rows=1 loops=7)
                          ->  Sort  (actual rows=2 loops=7)
                                Sort Key: x.created_at
                                ->  Seq Scan on reserva_enlaces x  (actual rows=2 loops=1)
                                      Filter: ((correo IS NOT NULL) AND (clase = 'unico') AND (LEAST(…) < '…'))
```

Lo que se lee ahí:

- El planificador estimó **1 fila** en `reserva_enlaces` (había 7): con la tabla «diminuta» eligió **Nested
  Loop Semi Join** con la subconsulta en el lado interior.
- La subconsulta con `LIMIT 1` se ejecutó **7 veces** (`loops=7`), una por cada fila del lado exterior.
- La sentencia actualizó **2 filas** con `LIMIT 1`.

## 3. La causa

Con ese plan la subconsulta se **vuelve a ejecutar** por cada fila de la tabla. En cada ejecución, su nodo
`LockRows` no devuelve las filas que la propia sentencia ya modificó, así que el `LIMIT` entrega **otra** fila
(u otras n), que también casa y también se escribe. El `LIMIT` deja de ser un tope: cuántas de más depende
del orden en que se recorre la tabla frente al orden de la subconsulta (en el caso mínimo, 2 de 5; en el peor,
todas las candidatas).

> La frase «LockRows no devuelve las filas que la propia sentencia ya modificó» es mi explicación de lo
> observado (misma instantánea, `loops=7`, filas distintas en cada vuelta) y coincide con cómo trata Postgres
> una fila ya modificada por la sentencia en curso; **no la he ido a leer al código fuente de Postgres**. Lo
> medido es lo de arriba y lo del §4.

Por qué sólo a veces: el plan depende de las **estadísticas**. Sale cuando la tabla se estima diminuta
(`reltuples` 0 o 1) y tiene más filas de las estimadas: recién creada, recién vaciada, o tras un reinicio. Con
estadísticas al día y la tabla grande, el planificador elige «Hash Semi Join» o deduplica la subconsulta
primero, la ejecuta una sola vez y el tope se cumple.

## 4. Caso mínimo, determinista

Una tabla temporal analizada con 1 fila a la que luego se le añaden 4 (estadísticas desfasadas):

| forma | sentencia | filas escritas con `LIMIT 1` |
|---|---|---|
| vieja | `UPDATE … WHERE id IN (SELECT … LIMIT 1 FOR UPDATE SKIP LOCKED)` | **2** (plan: Nested Loop Semi Join, `loops=5`) |
| vieja | `DELETE … WHERE id IN (SELECT … LIMIT 1 FOR UPDATE SKIP LOCKED)` | **2** |
| nueva | `SELECT array_agg(id) INTO v_ids FROM (SELECT … LIMIT 1 FOR UPDATE SKIP LOCKED) s;` + `… WHERE id = ANY (v_ids)` | **1** |

Es la parte A de `supabase/pruebas-sql/b2_lotes_sin_reejecucion.sql`, que además **exige** que la forma vieja
siga dando el plan malo (si Postgres cambia de plan, la prueba lo dice en vez de pasar sin demostrar nada).

Lo que NO conseguí: forzar el plan malo sólo con ajustes del planificador (`enable_hashjoin`,
`enable_mergejoin`, `enable_hashagg`, `enable_material`, `enable_sort` apagados): con estadísticas al día
Postgres prefiere deduplicar la subconsulta. Hacen falta las estadísticas desfasadas.

## 5. Alcance en producción

- **Sólo se procesan MÁS filas que el lote en una pasada.** Nunca filas que no tocaban: el plazo de 30 días, la
  clínica y el resto de condiciones van dentro de la subconsulta y se cumplen en cada ejecución. No hay purga
  indebida ni pérdida.
- El coste: con ese plan la subconsulta (con su ordenación) se repite por cada fila de la tabla. En una tabla
  grande el planificador no lo elige; en una estimada diminuta, sí.
- M5: la cola `gcal_empalmes_pendientes` suele estar vacía o casi (la condición del plan malo), pero el tope
  sólo importa con más de 500 apuntes de una clínica; entonces `reserva_empalmes_registrar` podía recibir más
  de 500 citas de una vez.
- M4: lote de 5 000; importa con más de 5 000 filas por purgar de algo.
- Los conteos de sólo lectura lo enseñan en producción: `B2.4` (cuánto hay por purgar), `B2.5` (la cola),
  `B2.6` (filas estimadas de las cuatro tablas) y `B2.7` (pasadas de la purga que se llevaron más de 5 000).
  **No sé si en producción ha ocurrido alguna vez**: eso lo dice `B2.7`.

## 6. El arreglo (B2, `20261208130000`)

El lote se elige y se bloquea (mismo `ORDER BY`, `LIMIT` y `SKIP LOCKED`) en un `SELECT … INTO v_ids` que **no
modifica nada**, y la escritura va en otra sentencia, `WHERE id = ANY (v_ids)`. No depende del plan por
construcción: la sentencia que lleva el `LIMIT` no escribe (aunque se re-ejecutara devolvería las mismas filas)
y la que escribe no lleva `LIMIT`. Las filas siguen bloqueadas hasta el final de la transacción, como antes.

Se prefirió a la CTE `MATERIALIZED` (que también lo corrige: lo comprobé en el caso mínimo) porque no depende
de que nadie quite la palabra `MATERIALIZED` en un cambio futuro.

Comprobado con el cuerpo nuevo: `ap2` y `ap3` tres veces seguidas en verde en la misma base en la que el viejo
fallaba 40 de 40; `b2_lotes_sin_reejecucion.sql` en verde.

**Lo que la prueba garantiza frente al cuerpo viejo, y lo que no:** falla siempre con el cuerpo viejo por la
parte C (el cuerpo conserva un «IN (SELECT») y demuestra el mecanismo en la parte A. La parte B (las
funciones de verdad con lote 1) con el cuerpo viejo falla o no según las estadísticas de la base: en esta
base, con `ip_rate_limits` y la cola, pasaba.
