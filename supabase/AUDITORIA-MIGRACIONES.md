# Auditoría de migraciones — prompt fijo

Este archivo es el prompt que se usa para auditar **toda** migración antes de
aplicarla. Existe para que las preguntas no dependan de que alguien las recuerde
ese día. Se pega completo (secciones 1 a 6) junto con el archivo `.sql` a
auditar.

---

## 1. El encargo

Actúa como **auditor de bases de datos** sobre una migración que **todavía no se
ha aplicado** y que va destinada a **producción**.

Tu trabajo es **encontrar lo que falle**, no aprobarla. No busques confirmar que
está bien: busca el renglón que rompe, el caso que no se contempló, la
afirmación del autor que no se sostiene.

Reglas del encargo:

- Si algo está bien, **dilo en una línea y sigue**. No lo elogies ni lo expliques
  de más.
- **No rediseñes la funcionalidad.** Si crees que el objetivo de la migración
  está mal planteado, dilo en una frase al final y no más. Lo que se audita es
  si esta migración, tal como está, hace lo que dice sin romper nada.
- Si no puedes calificar una dimensión con la información que tienes, **dilo
  explícitamente** en vez de asumir. «No puedo evaluar X porque no me diste Y»
  es una respuesta válida y útil.

---

## 2. Contexto del proyecto (fijo)

Esto no cambia entre auditorías, por eso vive aquí en vez de repetirse cada vez:

- **Postgres gestionado por Supabase.**
- **RLS activa en todas las tablas.** Cualquier objeto nuevo nace expuesto a
  PostgREST salvo que se diga lo contrario.
- **No hay base de staging.** No existe el ensayo previo: lo que se pega es lo
  que corre en producción, a la primera.
- **Se aplica a mano**, pegando el archivo completo en el **SQL Editor de
  Supabase**. Esto tiene consecuencias concretas (ver dimensiones 2, 5 y 6).
- **El volumen actual de datos es pequeño**, pero el archivo queda como
  **artefacto de registro** en `supabase/migrations/` y puede **replayearse**
  sobre bases con muchos más datos —o sobre una base recién creada desde
  `supabase/baseline/`—. Auditar sólo contra el tamaño de hoy es insuficiente.
- **`public.appointments` y `public.pacientes` guardan datos clínicos.** Perder
  renglones ahí es inaceptable: no hay «se vuelve a capturar». Los expedientes,
  además, tienen retención legal mínima de 5 años y nunca se borran de verdad
  (soft delete).

---

## 3. Esquema afectado

> **Quien pide la auditoría pega aquí el DDL de las tablas afectadas y las
> policies relevantes** (salida de `\d+ tabla`, o el fragmento correspondiente de
> `supabase/baseline/`, más las policies de `07_rls_policies.sql` o de
> migraciones posteriores que las hayan cambiado).

```sql
-- pegar aquí: CREATE TABLE / índices / constraints / triggers / policies
```

**Sin esto la auditoría no puede calificar nada.** Si esta sección viene vacía o
incompleta, **no adivines el esquema**: di qué falta y detente. Un veredicto
emitido sobre un esquema imaginado es peor que ningún veredicto, porque se lee
igual de seguro.

---

## 4. Dimensiones a revisar

Recórrelas todas, en orden. Esta lista crece con cada auditoría (ver sección 6).

1. **¿Corre?** Sintaxis. Orden de dependencias dentro del archivo (no se
   referencia lo que aún no existe). Uso correcto de catálogos (`pg_class`,
   `pg_policies`, `information_schema`, …) y de funciones —firma, tipos de
   argumento, valor de retorno—. Sentencias que fallarían contra el **esquema
   real** de la sección 3: columnas que no existen, tipos que no coinciden,
   nombres de constraint inventados.

2. **Atomicidad.** Qué queda a medias si truena en la sentencia N. **Ojo:** el
   protocolo de consulta simple ya envuelve un script multi-sentencia en una
   transacción implícita, así que un `BEGIN` explícito puede ser **peor** que no
   ponerlo (deja la transacción abierta o choca con el envoltorio). Verifica cuál
   de los dos casos aplica antes de recomendar cualquiera.

3. **Idempotencia y replay.** Dos preguntas distintas: (a) correr el archivo dos
   veces seguidas, (b) correrlo sobre una base recién creada desde el baseline.
   Y dentro de (a), **distingue dos casos que se ven iguales**:
   - «ya está hecho y repetirlo es inofensivo» → debe ser un **no-op
     silencioso** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, guarda previa).
   - «ya está hecho y repetirlo destruye datos» → debe **abortar con
     excepción**, ruidosamente.

   Confundirlos rompe el historial de migraciones o borra producción. Un
   `DROP ... IF EXISTS` que se traga el segundo caso es exactamente este error.

4. **Orden de las comprobaciones.** Toda verificación cuyo fallo haga peligroso
   el cambio tiene que **abortar antes** del cambio, no avisar después. Un aviso
   posterior a un cambio irreversible no sirve de nada: informa de un desastre
   ya consumado. Revisa que los pre-vuelos estén realmente **antes** y que
   **aborten** (`RAISE EXCEPTION`), no que sólo informen.

5. **Visibilidad del resultado.** El SQL Editor de Supabase **no muestra de
   forma fiable** `RAISE NOTICE` ni `RAISE WARNING`. Una migración cuyo veredicto
   viaje sólo por ahí **se lee igual haya funcionado o no**: el operador ve una
   ejecución en verde y nada más. Toda migración debe terminar con un `SELECT`
   que devuelva su resultado **en la rejilla**, con lo que haga falta para
   distinguir éxito de fracaso silencioso.

   > **Constancia histórica:** todas las migraciones aplicadas antes de agosto de
   > 2026 traían pre-vuelo y post-vuelo por `RAISE NOTICE` y **nunca se vio ni
   > una línea de salida**. No hay que re-auditarlas —su resultado se verificó
   > por otro camino—, pero queda escrito aquí para que a nadie se le ocurra
   > volver a los notices como canal de veredicto.

6. **Bloqueos.** Qué lock toma cada sentencia (`ACCESS EXCLUSIVE`, `SHARE ROW
   EXCLUSIVE`, …), cuáles bloquean lecturas y cuáles escrituras, y cuáles serían
   un problema con millones de renglones aunque hoy sean instantáneas. Considera
   también el método de aplicación: hay sentencias que **no pueden ir dentro de
   una transacción** (`CREATE INDEX CONCURRENTLY`, `ALTER TYPE ... ADD VALUE` en
   versiones viejas, `VACUUM`), y eso choca con la dimensión 2.

7. **Destructividad y recuperación.** Qué datos se pierden —incluidos los que se
   pierden «de lado»: un `DROP COLUMN`, un `TRUNCATE`, un `UPDATE` sin `WHERE`
   suficientemente estrecho, un cambio de tipo con truncamiento—. Si se
   recuperan, cómo. Y sobre todo: **qué habría que hacer antes** (respaldo,
   tabla espejo, `CREATE TABLE ... AS SELECT`) para poder revertir. Si la
   respuesta es «no se puede revertir», eso es un hallazgo, no un detalle.

8. **Validación de constraints contra datos existentes.** Todo `NOT NULL`,
   `CHECK`, `UNIQUE` o `FOREIGN KEY` nuevo se valida contra lo que ya hay. ¿Hay
   filas que lo violan hoy? ¿La migración las detecta antes, las corrige, o
   simplemente truena a media aplicación dejando el resto sin aplicar? Considera
   `NOT VALID` + `VALIDATE CONSTRAINT` cuando el volumen lo justifique.

9. **Corrección semántica de los valores escritos.** No sólo si la sentencia
   corre, sino si el valor que escribe **significa** lo correcto. Un backfill que
   pone un estado por defecto plausible pero falso es un bug que ninguna
   verificación sintáctica atrapa. *Aquí ya se coló una vez un estado que
   mentía.* Pregunta explícitamente: para cada fila afectada, ¿el valor nuevo es
   verdadero respecto del mundo real, o sólo es válido respecto del `CHECK`?

10. **Aislamiento entre clínicas.** ¿El cambio expone datos o metadatos de una
    clínica a otra que antes no exponía? Cubre:
    - **RLS**: policies nuevas o modificadas que no filtren por `clinica_id`;
      funciones `SECURITY DEFINER` que consulten sin ese filtro.
    - **Índices y constraints únicos** que deberían llevar `clinica_id` en la
      llave y no lo llevan (un `UNIQUE(folio)` global filtra la existencia de
      folios ajenos vía error de conflicto).
    - **Cualquier objeto nuevo alcanzable por PostgREST**: tablas, vistas,
      funciones RPC. Las vistas **no heredan** la RLS de sus tablas base salvo
      que se declaren con `security_invoker`.

    Esto conecta con el pendiente prioritario de `CLAUDE.md` sobre
    `createAdminClient()`.

11. **Permisos y propiedad.** ¿El rol que aplica la migración es dueño de lo que
    va a alterar? Publicaciones, extensiones, objetos del esquema `auth` o
    `storage`, y tablas creadas por el propio Supabase tienen dueños que no son
    el rol del SQL Editor. Un fallo de propiedad **después** de un pre-vuelo en
    verde es justo lo que un pre-vuelo existe para adelantar: si la migración
    toca algo así, debe comprobar la propiedad antes de intentar el cambio.

12. **Ventana de despliegue.** Entre que se aplica la migración y que se
    despliega el código —o al revés— hay una ventana con las dos versiones
    conviviendo. ¿Qué rompe el **código viejo corriendo contra el esquema ya
    migrado** (columna que desapareció, `NOT NULL` nuevo que sus INSERT no
    llenan)? ¿Y el **código nuevo contra el esquema viejo**, si el orden se
    invierte? Di explícitamente cuál de los dos órdenes es el seguro.

13. **Verificar las afirmaciones del autor contra la fuente.** Si la migración se
    justifica en cómo se comporta una librería, un servicio o Postgres mismo
    («Realtime requiere X», «el cliente reintenta Y», «este lock no bloquea
    lecturas»), **no lo aceptes de palabra**: lee el código en `node_modules/`,
    la documentación oficial, o el manual de Postgres, y **cita de dónde sale**.
    Si no puedes verificarlo, marca la afirmación como no verificada en vez de
    darla por buena.

14. **Cualquier otra cosa** que un DBA marcaría y que no esté en esta lista.

---

## 5. Formato de respuesta

**a) Hallazgos**, ordenados de **más grave a más leve**. Cada uno con:

- **Qué está mal** (una o dos frases, concreto).
- **El escenario en que muerde**: datos o estado de partida → sentencia que
  falla o valor incorrecto que queda. Si no puedes describir el escenario, el
  hallazgo probablemente no es real.
- **Qué tan seguro estás** de que es real: confirmado / probable / sospecha.

**b) El archivo corregido completo**, listo para pegar. No fragmentos ni
«cambia la línea 40»: el archivo entero.

**c) «Lo que parecía sospechoso y está bien»**, con la razón de por qué está
bien. Esta sección **vale tanto como los hallazgos**: evita que la siguiente
persona vuelva a levantar la misma falsa alarma y «arregle» algo que era
correcto.

Y cierra con esto presente durante toda la auditoría:

> **No asumas que quien escribió esto tenía razón en nada.** Ni en el objetivo,
> ni en los comentarios del archivo, ni en el nombre de las columnas, ni en que
> el pre-vuelo comprueba lo que dice comprobar.

---

## 6. Antes de terminar

Si encontraste una **clase** de problema que no estaba en la lista de dimensiones
de la sección 4, **agrégala al final de esa lista, en este mismo archivo**, antes
de terminar, con una frase que explique **qué buscar** y **por qué**.

La lista tiene que mejorar con cada auditoría.
