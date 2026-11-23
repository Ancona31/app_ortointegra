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
- **Dónde se ensaya (desde 2026-11-22; sustituye a «no hay base de staging, no
  existe el ensayo previo»).** Hay dos sitios, y una migración pasa por los dos
  antes de producción:
  - el **stack local de Supabase en Docker**, con la CLI 2.117.0
    (`supabase db reset --local` aplica todo `supabase/migrations/` desde
    cero);
  - desde esta fase, un **clon de la ESTRUCTURA de producción, sin datos** (la
    «foto»), sobre el que se aplica el conjunto antes de producción.

  El clon no tiene datos: lo que dependa de filas reales (dimensiones 7, 8 y 9)
  se responde con las consultas de conteo de sólo lectura que corre Angel en
  producción, no con el ensayo.
- **Cómo se aplica.** Hasta 2026-11 se pegaba el archivo completo en el **SQL
  Editor de Supabase**, y las dimensiones 2, 5, 6 y 18 se escribieron para ese
  método: siguen valiendo para todo lo que se pegue ahí y para los archivos ya
  aplicados así. Desde esta fase lo aplica **Angel con la CLI, en su terminal**
  (`CLAUDE.md`, «🗃️ Base de datos»). Cómo envuelve la CLI cada archivo en una
  transacción y qué muestra de su salida no se da por sabido: se comprueba en
  el ensayo y en su documentación (dimensión 13).
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

   **Reversa escrita y ensayada (añadido 2026-11-22).** Además de los datos,
   la migración tiene que traer el **script que la deshace** (los `DROP`,
   `ALTER` y restauraciones de cuerpos anteriores, en orden inverso), y ese
   script se **corre en el ensayo** (sección 2): aplicar, deshacer y volver a
   aplicar sobre el clon. Una reversa que sólo se leyó no cuenta: se escribe
   para el día en que algo falla en producción, que es el peor día para
   descubrir que no corre.

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

15. **Alcance de los roles, EN LAS DOS DIRECCIONES.** Cuando la migración toca
    policies, triggers de columna, helpers `SECURITY DEFINER` o cualquier cosa
    de la que dependa un permiso, no basta con comprobar lo que un rol **deja
    de poder**. Hay que hacer **dos preguntas por cada rol afectado**:

    - **¿Qué gana?** — ¿puede ahora algo que antes no podía y que nadie decidió?
    - **¿Qué pierde?** — ¿ha dejado de poder algo que hace todos los días?

    **Una restricción de más es tan defecto como una de menos**, y es la que
    nadie reporta como fallo de seguridad: se reporta como «la app no me deja
    confirmar». Si la migración no toca permisos, dilo explícitamente —«el
    alcance de los roles no cambia en ninguna de las dos direcciones»— en vez de
    callarlo, que se lee igual que no haberlo mirado.

    > **Por qué está al final y no en su sitio lógico, junto a la 10 y la 11:**
    > esta lista crece por el final (ver sección 6), no se reordena.

    > **De dónde nació.** De la Rama 1, que aplicó esta regla y la citó por
    > número **antes de que existiera**: seis referencias a «la dimensión 15» y a
    > «las 15 dimensiones» apuntando a una lista de catorce —cinco en
    > `PLAN-RAMA1-CONEXION-CLINICA.md` y una en `DEUDA_TECNICA.md:3071`—. La
    > regla se estuvo cumpliendo y el número no señalaba nada. Lo encontró una
    > auditoría externa el 2026-08-21. Queda escrito porque el fallo no fue la
    > regla —era buena— sino **citar por número algo que no se comprobó que
    > existiera**.

16. **Convenios que ninguna restricción puede imponer.** Cuando una migración
    añade una columna cuyo significado depende de un convenio que el esquema NO
    puede validar —una bandera que obliga a una forma de los datos vecinos, un
    formato acordado, un fin exclusivo—, hay que preguntar tres cosas, porque
    ningún CHECK las va a preguntar por ti: (a) qué lectores ya asumen un
    convenio distinto, uno por uno y citando el renglón; (b) dónde queda escrito
    el convenio para quien llegue dentro de un año —el `COMMENT ON COLUMN` es el
    único texto que viaja con la base, así que el convenio va ahí y no sólo en la
    cabecera del `.sql`—; y (c) cómo se manifiesta el incumplimiento. Si la
    respuesta a (c) es «se pinta casi bien» o «no falla», el convenio necesita
    más comprobación externa, no menos. Es distinta de la dimensión 9: aquélla
    pregunta si los valores que escribe ESTA migración son verdaderos; ésta, si
    los que escribirá el código MAÑANA podrán ser falsos sin que nada lo note.

17. **Los OTROS caminos a la misma tabla, y lo que la documentación da por
    muerto.** Cuando una migración añade una comprobación a un camino de
    escritura —una policy, un RPC—, la pregunta no es «¿está bien puesta ahí?»
    sino **«¿por dónde más se llega a esa tabla con ese privilegio?»**. Hay que
    enumerarlos desde el catálogo, no desde la memoria:

    ```sql
    -- funciones que escriben en la tabla saltándose la RLS, y quién las llama
    SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner), p.prosecdef, p.proacl
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prosecdef
       AND p.prosrc ILIKE '%insert into%<tabla>%';
    ```

    Un `SECURITY DEFINER` propiedad de un rol con `BYPASSRLS` **no evalúa
    ninguna policy**: si además tiene `GRANT EXECUTE` a `anon` o
    `authenticated`, está publicado en PostgREST y es una puerta del mismo
    tamaño que la que la migración acaba de cerrar. Poner el gate en un camino
    y dejar el gemelo abierto no es medio arreglo: es ninguno, porque el
    atacante usa el que está abierto.

    Y el corolario, que es el que muerde: **lo que un plan o un documento da
    por eliminado se comprueba en `pg_proc` / `pg_policy` / `pg_class`, nunca
    leyendo el plan.** Un ✅ en un `.md` es la intención de quien lo escribió,
    no un hecho de la base. *Nació aquí:* el gate de perfil de B5 dejaba
    intacto `crear_paciente_con_medico(jsonb,uuid)` —el RPC v1, `SECURITY
    DEFINER` de `postgres`, con EXECUTE para `authenticated`—, que
    `ETAPA5_PLAN.md:1338` daba por borrado con un ✅ mientras el dump de
    producción del día anterior lo listaba vivo en la línea 953.

18. **El canal del veredicto sólo transporta UN resultado.** La dimensión 5
    obliga a terminar con un `SELECT` que se vea en la rejilla; ésta dice qué
    pasa cuando pones más de uno. El SQL Editor de Supabase habla con
    postgres-meta, y `dist/lib/db.js` resuelve el resultado así:

    ```js
    if (Array.isArray(res)) {
      res = res.reverse().find((x) => x.rows.length !== 0) ?? { rows: [] }
    }
    ```

    Es decir: de todo el script llega a la rejilla **un único conjunto de
    resultados, el del último statement que devuelva filas**. Los demás se
    tiran en silencio. Una migración que termine con tres `SELECT` —uno de
    policies, uno del RPC, uno de censo— cumple la dimensión 5 sobre el papel y
    **enseña sólo el tercero**; el autor cree haber publicado el veredicto y el
    operador no lo ve nunca. La regla práctica: **un solo `SELECT` final**, con
    todo lo que haya que comprobar dentro (un `UNION ALL` con una columna
    `estado` que diga OK o REVISAR por renglón), y nada detrás de él. Si algo
    tiene que consultarse aparte —un censo previo, por ejemplo—, no va al final
    del archivo: va al pre-vuelo, que es donde puede además abortar
    (dimensión 4).

> **Dimensiones 19 a 25: añadidas el 2026-11-22 por orden de Angel**, en la
> fase de dejar la agenda v2 lista para producción. La de «reversa» que pidió
> no tiene número propio: se solapaba con la 7 y la amplió.

19. **Recursión de RLS.** Ninguna policy sobre una tabla consulta esa misma
    tabla, ni directamente ni a través de una función `SECURITY INVOKER` o de
    una vista que la lea. Postgres no lo valida al hacer `CREATE POLICY`: truena
    en tiempo de ejecución, con `infinite recursion detected in policy`, en la
    primera escritura real. *Nació aquí:* el incidente del 2026-05-04
    (`CLAUDE.md`, «Incidentes resueltos»): un `count(*)` de `pacientes` dentro
    del `WITH CHECK` de una policy de `pacientes` dejó a los médicos sin poder
    crear pacientes un día entero. Lo que haga falta saber de la misma tabla va
    en una columna declarativa de la tabla padre (`clinicas`).

20. **Permisos de fábrica.** Supabase concede por omisión privilegios a `anon`,
    `authenticated` y `service_role` sobre los objetos nuevos de `public`
    (tablas, secuencias, funciones). Por cada objeto que la migración cree, hay
    que listar desde el catálogo qué recibió cada uno de los tres
    (`relacl`/`proacl`, `has_table_privilege`, `has_function_privilege`) y
    quitar en el mismo archivo lo que sobre, **TRUNCATE incluido**: TRUNCATE no
    pasa por la RLS ni por los disparadores de fila. Que la RLS esté activa no
    contesta esta pregunta: la RLS filtra filas, no quita privilegios. Es
    distinta de la 10 (qué datos de otra clínica quedan alcanzables) y de la 11
    (quién es dueño): ésta es qué puede hacer cada rol con el objeto.

21. **Rendimiento.** Costo de cada disparador por cada fila escrita (las
    consultas que hace dentro, y si se dispara en columnas que no le importan),
    y de cada policy por cada fila leída (subconsultas y funciones que se
    evalúan fila a fila). Para cada consulta nueva —en policies, funciones y
    disparadores— qué índice usa; si no lo hay, decirlo. Hoy los volúmenes son
    pequeños y nada se nota; por eso se pregunta en el papel y no en el
    reloj (sección 2: el archivo puede replayearse sobre bases mucho mayores).
    Es distinta de la 6, que mira bloqueos, no costo.

22. **El conjunto.** Cuando se aplican varias migraciones juntas, auditarlas
    también como conjunto: el orden entre ellas (qué exige que otra haya
    corrido antes, y qué aborta si el orden se invierte) y las **funciones que
    una crea y otra reescribe** —con `CREATE OR REPLACE`, la última gana
    entera: lo que la primera añadió y la segunda no copió desaparece sin
    error—. Por cada función tocada por más de una migración del conjunto, el
    cuerpo final se compara con lo que cada una pretendía dejar. Una migración
    que pasa sola no prueba que el conjunto pase.

23. **Una prueba automática por migración.** Cada migración trae al menos una
    prueba que se corre sola (`supabase/pruebas-sql/` o la batería del
    proyecto) y que falla si la migración no está o se deshace. Sin ella, la
    siguiente migración que la reescriba (dimensión 22) la rompe sin que nadie
    se entere. La auditoría dice cuál es esa prueba y si se corrió en el ensayo.

24. **Toda función `SECURITY DEFINER` fija su `search_path` y no es ejecutable
    por PUBLIC.** Sin `SET search_path` en la propia función, quien la llama
    puede anteponer un esquema suyo y hacer que resuelva nombres a objetos que
    él controla, con los privilegios del dueño. Y en Postgres una función nace
    con `EXECUTE` para PUBLIC salvo que los privilegios por omisión digan otra
    cosa (`ALTER DEFAULT PRIVILEGES`; no se supone en ninguno de los dos
    sentidos): si PUBLIC la puede ejecutar, se revoca (`REVOKE EXECUTE … FROM
    PUBLIC`) y se concede sólo a los roles que la llaman. Comprobar en `pg_proc`
    (`proconfig`, `proacl`), no en el texto del archivo. Complementa a la 17,
    que pregunta por dónde más se llega a la tabla; ésta, si la puerta misma
    está bien cerrada.

25. **Quien audita no es quien escribió, y lo corregido se vuelve a auditar.**
    La auditoría la hace alguien (persona o agente) que no escribió la
    migración, y se dice quién fue. Si el auditor corrige el archivo, el
    archivo corregido es una migración nueva para esta lista: lo audita otro,
    entero, no sólo el renglón cambiado. Quien escribe tiende a leer lo que
    quiso poner, y quien corrige, a dar por buena su propia corrección.

> **Dimensiones 26 a 28: añadidas el 2026-11-22 por orden de Angel** («entran
> al documento de auditoría las tres dimensiones que nombraste»). Son tres de
> las diez que se habían propuesto en auditorías anteriores y no se habían
> añadido (AG-DT-254, AG-DT-143 y `AUDITORIA-CONJUNTO-AGENDA-V2.md` §9.7). Las
> otras siete siguen sin añadir, a la espera de Angel.

26. **El otorgante del privilegio.** Un `REVOKE` sólo quita lo que concedió el
    rol que lo ejecuta (o un rol del que es miembro). Un privilegio concedido
    por otro otorgante —`supabase_admin`, o los privilegios por omisión de otro
    dueño— **sobrevive al `REVOKE` sin ningún error ni aviso**: la sentencia
    «funciona» y el privilegio sigue ahí. Qué mirar: por cada privilegio que la
    migración dice quitar, quién lo concedió. Cómo se comprueba: en el catálogo,
    `aclexplode(relacl)` (o `proacl`) con su columna `grantor`, o
    `information_schema.role_table_grants.grantor`, antes de aplicar; y después,
    no leyendo el ACL sino preguntando el privilegio efectivo
    (`has_table_privilege(rol, tabla, 'TRUNCATE')`, que cuenta también PUBLIC y
    la pertenencia a roles) o intentando la acción como ese rol en una prueba.
    *Ejemplos del proyecto:* el post-vuelo de
    `20261125170000_audit_log_sin_truncate.sql` aborta antes del `COMMIT` si un
    rol conserva TRUNCATE «por ejemplo, concedido por otro otorgante», y el
    pre-vuelo de `20261126120000_public_sin_truncate.sql` aborta con el nombre de
    la tabla cuando el TRUNCATE lo concedió alguien distinto del dueño
    (`a.grantor <> c.relowner`). En la foto de producción, los privilegios por
    omisión de `supabase_admin` en `public` conceden ALL a `anon`,
    `authenticated` y `service_role`: una tabla de `public` creada por
    `supabase_admin` traería privilegios que un `REVOKE` hecho como `postgres` no
    alcanza. Es distinta de la 20 (qué recibió cada rol): ésta pregunta si lo
    que se quita se puede quitar desde quien aplica.

27. **Contadores dentro de una transacción que puede fallar.** Un contador
    (intentos, cupos, topes) que se incrementa en la misma transacción que
    después lanza una excepción **se deshace con ella**: el `ROLLBACK` borra el
    conteo y el tope no cuenta nunca. Qué mirar: en cada función que cuenta, qué
    se comprueba o se escribe DESPUÉS del incremento, y si quien llama puede
    provocar ahí una excepción (un `unique_violation`, un CHECK, un
    `RAISE`). Lo que vaya después del contador no puede lanzar nada provocable
    por quien llama: se comprueba antes, o la sentencia que puede chocar va en
    su propio bloque `BEGIN … EXCEPTION … END` (un subbloque de plpgsql, que
    deshace sólo lo suyo) y devuelve un resultado en vez de propagar el error.
    Comprobar antes no basta si otra transacción puede adelantarse entre la
    comprobación y la escritura (un `EXISTS` no ve lo que otra transacción aún
    no confirmó). Cómo se comprueba: una prueba que provoque la excepción y mire
    que el contador subió, y una carrera de dos sesiones. *Ejemplo del
    proyecto:* el tope de 5 intentos del enlace de un solo uso
    (`reserva_enlaces.intentos` y `agotado_en`, en `reservar_por_enlace`,
    `20261201140000`): `client_id_en_uso` se comprueba antes del contador, y el
    INSERT de la cita va en su propio `BEGIN … EXCEPTION WHEN unique_violation`
    para que una carrera no deshaga el conteo (escenario 5 de
    `reserva-carrera.sh`; nació del hallazgo H1 de la antigua `20261122120000` y
    de la carrera que cerró `20261122120100`, hoy fundidas en F3; AG-DT-143).

28. **Pre-vuelos acotados.** Un pre-vuelo aborta sólo por lo que de verdad
    afecta a lo que la migración crea o supone, y su mensaje dice qué encontró y
    qué hacer. Ni tan laxo que deje pasar una suposición falsa, ni tan amplio
    que aborte por algo ajeno: un pre-vuelo que se dispara por algo que no
    importa enseña a quien aplica a saltárselo, y entonces deja de proteger.
    Qué mirar: por cada condición del pre-vuelo, sobre qué universo se evalúa
    (¿la tabla entera, o las filas que la sentencia va a tocar?; ¿cualquier
    índice de la tabla, o los que la migración crea?) y si una diferencia que no
    cambia el comportamiento (espacios, fines de línea) lo hace abortar. Un
    pre-vuelo que anticipa que «el disparador X abortaría» se acota al `WHERE`
    de la sentencia, no a la tabla entera (propuesta del auditor de
    `20261119130000`, `AUDITORIA-CONJUNTO-AGENDA-V2.md` §9.7). Cómo se
    comprueba: correr el pre-vuelo sobre la foto de producción y sobre una base
    con algo ajeno sembrado a propósito, y ver que sólo aborta en el segundo
    caso cuando debe. *Ejemplos del proyecto:*
    - **Huellas por md5 de `prosrc` (2026-11-22, comprobado contra la foto de
      producción, `supabase/produccion/DERIVA.md`):** en producción 32 de las 47
      funciones de `public` tienen el cuerpo con `\r\n`, idénticas al repo
      salvo los fines de línea. Los pre-vuelos con md5 exacto abortaban: el de
      `20261125170000` sobre `prevent_audit_modification()` y el de F5a
      (`20261201130000`) sobre `clinica_no_suspendida()` y
      `clinica_tiene_acceso()`. La huella se compara normalizando **sólo** los
      fines de línea, `md5(replace(prosrc, E'\r\n', E'\n'))` (como ya hace la
      rejilla de F2, `20261201150000`); normalizar más (todo espacio, `\s+`)
      aceptaría cambios que no son sólo de fines de línea, y eso hay que
      decidirlo a propósito, no por comodidad.
    - **Índices inválidos:** el pre-vuelo de F5b (`20261201170000`) aborta sólo
      si uno de SUS tres índices existe y está INVALID, y dice qué hacer
      («DROP INDEX y volver a correr»). Abortar por cualquier índice inválido de
      la tabla haría fallar la migración por un resto ajeno de un
      `CREATE INDEX CONCURRENTLY` de otro, sin relación con lo que ella crea.

---

## 4-bis. Cambio de privilegios por omisión (`20261126120000`)

> **PENDIENTE DE JUICIO DEL AUDITOR GLOBAL.** Por orden de Angel («el cambio de
> privilegios por omisión de P se queda, en sección aparte, y que lo juzgue el
> auditor»), esta sección sólo describe el cambio y lo que podría romper; no da
> veredicto. Quien audite `20261126120000_public_sin_truncate.sql` decide si se
> queda, se acota o se quita, y lo anota aquí.

**Qué hace, exactamente** (paso 3 de la migración, línea 260):

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated, service_role;
```

- **Rol:** sólo los objetos que cree `postgres` (`FOR ROLE postgres`). El
  pre-vuelo exige que quien aplica sea miembro de `postgres`.
- **Esquema:** sólo `public` (`IN SCHEMA public`).
- **Objetos:** sólo `TABLES` (según la documentación de Postgres, `TABLES`
  incluye vistas y tablas foráneas). No toca los privilegios por omisión
  de secuencias ni de funciones, ni ningún otro privilegio de tablas (SELECT,
  INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, MAINTAIN siguen como están).
- **Efecto:** toda tabla que `postgres` cree en `public` DESPUÉS de aplicarla
  nace sin TRUNCATE para esos tres roles. En la foto de producción los
  privilegios por omisión de `postgres` en `public` son `GRANT ALL ON TABLES` a
  `anon`, `authenticated` y `service_role` (por esquema); tras el cambio son ALL
  menos TRUNCATE. No cambia ninguna tabla que ya exista: eso lo hace el paso 2
  (REVOKE dinámico sobre el catálogo).
- **Sobre las migraciones posteriores:** las de la agenda que revocan TRUNCATE
  tabla a tabla pasan a hacer un REVOKE sin efecto (lo dice la cabecera; no lo
  comprobé). El post-vuelo exige que el ACL por omisión de `postgres` en
  `public` ya no dé TRUNCATE a los tres, y la rejilla enseña como INFO los de
  `postgres` (fila 6) y los de `supabase_admin` (fila 7).

**Lo que no cubre:**

- **Tablas creadas por otro rol.** Los privilegios por omisión de
  `supabase_admin` en `public` (en la foto: `GRANT ALL ON TABLES` a los tres
  roles) no cambian: `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` exige
  ser miembro de ese rol, y la cabecera dice que `postgres` no lo es en
  Supabase. Una tabla de `public` creada por `supabase_admin` (la plataforma,
  una extensión) o por cualquier otro rol nacería con TRUNCATE para los tres.
  Lo mismo vale para la dimensión 26: ese TRUNCATE lo concedería otro
  otorgante. La cabecera dice que, al volver a correr la migración, el
  pre-vuelo abortaría nombrando esa tabla.
- **Privilegios por omisión globales** (sin `IN SCHEMA`). Un `REVOKE` por
  esquema no quita lo que concede una entrada global (documentación de
  `ALTER DEFAULT PRIVILEGES`: las de esquema se suman a las globales). En
  `03-esquema-completo.sql` de la foto no aparece ninguna entrada sin
  `IN SCHEMA`; que la foto incluya las globales no lo comprobé. El post-vuelo
  sólo mira la entrada de `public` (`defaclnamespace = 'public'`).

**Qué podría romper (a juzgar por el auditor; nada de esto se probó):**

- Código o herramientas que hagan `TRUNCATE` con `anon`, `authenticated` o
  `service_role` sobre una tabla nueva de `public`. La cabecera dice que en el
  repo no hay ninguno (grep de `truncate` en `src`, `scripts`, `e2e` y
  `supabase`, 2026-11-22), y que `spinus-consola`, si lo hiciera con
  `service_role`, fallaría.
- Herramientas de Supabase que esperen TRUNCATE en tablas de `public` con esos
  roles (por ejemplo, un «vaciar tabla» del panel, o una herramienta que se
  conecte como `service_role`). No sé qué rol usa cada una: no lo verifiqué.
- Un `supabase db reset` o una semilla que vacíen con TRUNCATE como uno de esos
  roles. La cabecera dice que la semilla y las e2e limpian con DELETE.
- Para volver atrás, la reversa
  (`supabase/reversas/20261126120000_public_sin_truncate_reversa.sql`, línea 64)
  devuelve también el privilegio por omisión (`GRANT TRUNCATE ON TABLES`).

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

---

## 7. Después de aplicar

> **«Aplicada», en esta sección y en todo el proyecto, quiere decir aplicada en
> PRODUCCIÓN** (aclarado el 2026-11-22). Correr en el stack local o en el clon de
> estructura (sección 2) no la convierte en aplicada: una migración que sólo
> corrió ahí todavía se puede reescribir, fundir con otras o retirar, y las
> reglas de abajo sobre la región editable no le aplican. Por eso las
> migraciones de la agenda v2, que sólo corrieron en local, se funden en la
> fase de dejarla lista para producción. Desde que corre en producción, todo lo
> de esta sección vale entero.

El último paso de aplicar una migración es **actualizar su línea `-- ESTADO:` con
la fecha real, y commitearla**. Un archivo cuya cabecera diga «PENDIENTE DE
APLICAR» estando aplicado es una trampa para el siguiente lector, y ya ha
mordido: ver `20260813_formato_version_inmutable.sql:13-15`, que documenta el
caso y no lo arregló, porque quien abre el archivo viejo no está leyendo el
nuevo.

La razón de que el rótulo envejezca no es descuido, es un cambio de flujo:
hasta julio el archivo se commiteaba **después** de aplicar y el rótulo nacía
cierto; desde agosto se commitea **antes**, y nada vuelve a mirarlo. Por eso el
remedio tiene que ser un paso del ritual y no una buena intención.

No basta con mover el rótulo de sitio: **el texto nuevo dice «APLICADA Y
VERIFICADA EN PRODUCCIÓN», con la fecha y con la comprobación concreta que se
usó** —el `SELECT` sobre `pg_proc`, `pg_policies` o `information_schema` que
confirma que el objeto existe de verdad—. «Aplicada» a secas es la palabra de
quien pegó el archivo; lo que la convierte en un hecho consultable es la consulta
que la respalda, y dejarla escrita en la cabecera ahorra volver a inventarla cada
vez que alguien dude. Conecta con la dimensión 5: el veredicto en la rejilla dice
que la ejecución terminó, la comprobación posterior dice que el objeto quedó.

**Una migración no está terminada hasta que su cabecera es cierta.** No lo está
por haber corrido en verde. Mientras el rótulo mienta, queda trabajo abierto.

*Precedente:* el 2026-08-19 se encontró `20260818_gcal_puente_secretos.sql`
declarando «PENDIENTE DE APLICAR» con sus tres funciones ya vivas en producción.
El daño no es cosmético: una cabecera así invita a reaplicar una migración
aplicada, que es exactamente el escenario que la dimensión 3 obliga a separar
entre no-op inofensivo y aborto ruidoso.

**La región editable de una migración ya aplicada es el bloque de comentarios
anterior a la primera sentencia ejecutable, y sólo para anotar.** De la primera
sentencia hacia abajo no se cambia nada nunca, ni siquiera un comentario suelto
entre sentencias. Es comprobable de un vistazo: el diff de una migración
aplicada no puede tocar ninguna línea igual o posterior a su primera línea
no-comentario.

Dos consecuencias que conviene tener presentes:

- **Se anota, no se enmienda.** Si lo que hay que corregir es una afirmación
  falsa, el texto falso se queda donde está y encima se añade una línea que dice
  que es falso y a dónde ir. Reescribirlo para que diga la verdad borra la
  evidencia de qué se creía cuando aquello corrió, que suele ser la causa raíz.
- **Un `COMMENT ON` no es un comentario.** Es una sentencia, y su literal es
  parte de lo que se ejecutó: se corrige con una migración posterior que lo
  reescriba en la base, nunca editando el archivo aplicado.

Esto no contradice el forward-only de `CLAUDE.md`: esa regla dice que los
archivos originales **se conservan** y que los reverts son migraciones con
timestamp posterior. Habla de cómo se deshace un cambio de esquema, no de los
bytes del archivo. Anotar conserva; reescribir, no.

**Excepción, y una sola:** blindar un archivo aplicado para el replay (añadirle
`IF NOT EXISTS` y demás) sí toca sentencias, y a veces hace falta porque el
archivo tiene dos deberes que chocan —ser lo que corrió y poder volver a correr
sobre una base recién creada desde `baseline/`—. Precedente: commit `d257ec8`
sobre `20260720_apnp_ant_no_patologicos.sql`. Cuando ocurra, va en **su propio
commit**, con el motivo escrito en la cabecera, y **nunca mezclado con una
anotación**: mezclarlos es exactamente cómo se borra la frontera de arriba.
