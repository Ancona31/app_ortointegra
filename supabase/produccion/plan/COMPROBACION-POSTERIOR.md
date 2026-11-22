# Comprobación posterior — que producción quedó IDÉNTICA al ensayo

> Paso 5 de `PLAN-DE-APLICACION.md`. Escrito y ensayado el 2026-11-22 (agente L)
> con clones locales; los comandos son los que se corrieron, cambiando sólo las
> rutas. Ninguno escribe en producción: la única conexión es la de
> `foto-produccion.sh`, que sólo lee.

Carpetas (todas fuera del repo, 700):

| Carpeta | Qué hay | Cuándo nace |
|---|---|---|
| `~/spinus-produccion-foto/` | la foto del ensayo general (y los registros de `aplicar.sh` en `aplicacion-<fecha>/`) | antes del día |
| `~/spinus-produccion-foto-antes/` | la foto «antes» de producción, tomada el día | paso 2 del plan |
| `~/spinus-produccion-ensayo/` | el ensayo general sobre el clon de esa foto: `clon-antes.jsonl`, `clon-despues.jsonl`, `difs-antes-despues.tsv`, `referencia.claves` | §0, antes del día |
| `~/spinus-produccion-foto-despues/` | la foto «después» de producción | §1, el día |

---

## 0. Antes del día: el ensayo general sobre el clon de la foto real

Fija las dos referencias contra las que se compara producción. Se hace una vez,
con la foto que se vaya a usar el día (si se toma otra, se repite).

```bash
# el clon (Postgres aparte, 127.0.0.1:54330, sin datos)
ESPERADAS=scripts/produccion/esperadas-clon.tsv \
  bash scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto spinus-ensayo-prod 54330
# contraseña LOCAL del clon (no es la de producción; el clon no tiene datos)
docker exec -i spinus-ensayo-prod psql -X -q -U supabase_admin -d postgres -c "ALTER ROLE postgres PASSWORD 'postgres'"

mkdir -p ~/spinus-produccion-ensayo && chmod 700 ~/spinus-produccion-ensayo
scripts/produccion/comparar-estructura.sh --extraer contenedor:spinus-ensayo-prod > ~/spinus-produccion-ensayo/clon-antes.jsonl

# las 8, con el MISMO script del día, en modo ensayo (contraseña: postgres)
APL_HOST=127.0.0.1 APL_PUERTO=54330 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
  APL_DESTINO=$HOME/spinus-produccion-ensayo/aplicacion bash supabase/produccion/plan/aplicar.sh aplicar

scripts/produccion/comparar-estructura.sh --extraer contenedor:spinus-ensayo-prod > ~/spinus-produccion-ensayo/clon-despues.jsonl
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas antes,despues \
  --tsv ~/spinus-produccion-ensayo/difs-antes-despues.tsv \
  ~/spinus-produccion-ensayo/clon-antes.jsonl ~/spinus-produccion-ensayo/clon-despues.jsonl
cut -f1-5 ~/spinus-produccion-ensayo/difs-antes-despues.tsv | sort > ~/spinus-produccion-ensayo/referencia.claves
docker rm -f spinus-ensayo-prod
```

- El primer comando tiene que acabar en `0 inesperadas` (si salen otras, se
  miran y se añaden a `esperadas-clon.tsv` con su razón, como dice el README de
  `scripts/produccion/`).
- `aplicar.sh` tiene que acabar en `Las 8 aplicadas y registradas.` y sus
  rejillas tienen que parecerse a `rejillas-del-ensayo.txt` (mismas filas OK).
- El comparador dice `N diferencias` (`exit 1`, normal: no se le dan esperadas).
  En el ensayo sobre `base-main`: **952** (`Resumen: 2567 objetos en antes, 3430
  en despues; 952 diferencias`), con estas claves:
  `diferencias-antes-despues.base-main.tsv` de esta carpeta. Con la foto real el
  número puede cambiar (p. ej. si producción tiene otras tablas con TRUNCATE):
  **la referencia del día es `referencia.claves`, no el archivo de base-main.**
- Lo que el clon no ensaya: datos. El backfill de F1 y su pre-vuelo del
  predeterminado sólo se ejercitan con datos (se probaron con datos sintéticos);
  en el clon vacío pasan por construcción.

Comprobado así [C]: las claves de un ensayo hecho de esta forma y las de la
comparación foto «antes» ↔ foto «después» coinciden **exactamente** (`diff`
vacío).

---

## 1. El día: la foto «después»

Después de que `aplicar.sh aplicar` termine en verde:

```bash
FOTO_DESTINO=$HOME/spinus-produccion-foto-despues bash scripts/produccion/foto-produccion.sh
```

Pide la contraseña (como la foto «antes»). Tiene que acabar en `Foto completa en
…` y en `Sin datos: ningún INSERT, COPY con filas, setval con valor ni objeto
grande.`

## 2. (a) Antes ↔ después: cambió exactamente el conjunto

```bash
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas antes,despues \
  --tsv ~/spinus-produccion-foto-despues/difs-antes-despues.tsv \
  ~/spinus-produccion-foto-antes/05-catalogo.jsonl ~/spinus-produccion-foto-despues/05-catalogo.jsonl
cut -f1-5 ~/spinus-produccion-foto-despues/difs-antes-despues.tsv | sort \
  | diff ~/spinus-produccion-ensayo/referencia.claves - && echo "IGUAL QUE EL ENSAYO"
```

- El comparador saldrá con `exit 1` y `N diferencias`: es lo esperado, son los
  objetos del conjunto. N tiene que ser el del ensayo general.
- **El `diff` tiene que salir vacío y escribir `IGUAL QUE EL ENSAYO`.** Una línea
  `<` es algo que el ensayo cambió y producción no; una `>`, algo que cambió en
  producción y no en el ensayo (otra persona, otra migración, la app creando
  algo). Cualquiera de las dos: no se despliega y se investiga.
- Las claves comparan qué objeto y qué campo; los valores (cuerpos, ACL) los
  compara el paso (b).

## 3. (b) Producción después ↔ ensayo después: cero diferencias

```bash
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas produccion,ensayo \
  --esperadas scripts/produccion/esperadas-clon.tsv \
  ~/spinus-produccion-foto-despues/05-catalogo.jsonl ~/spinus-produccion-ensayo/clon-despues.jsonl
echo "salida: $?"
```

- Tiene que acabar en `0 inesperadas` y `salida: 0`.
- La lista de esperadas es **la misma** que dejó limpio el clon de la foto
  «antes» (`scripts/produccion/esperadas-clon.tsv`, más lo que se le haya añadido
  en el §0). Son diferencias foto ↔ clon (los `ALTER DATABASE … SET`, los USAGE
  de `graphql`, los CHECK con AND anidados), no del conjunto. No se añade ninguna
  nueva el día: una diferencia que el ensayo no tuvo es un hallazgo.
- En el ensayo local (dos clones, sin las diferencias de foto ↔ clon):
  `Resumen: 3430 objetos en prod-despues, 3430 en ensayo; 0 diferencias (0
  esperadas, 0 inesperadas).` El comparador avisa de las esperadas que no
  aparecieron; en producción sí aparecerán.

## 4. El historial

```bash
bash supabase/produccion/plan/aplicar.sh estado
```

Tiene que listar, en este orden, exactamente estas 13 versiones (más las que
hubiera que registrar por la rama B/C del plan §1.4, que son estas mismas cinco
primeras), y las 8 como «ya registrada»:

```
20260912190416
20260913
20260914
20260919
20260919230000
20261125170000
20261126120000
20261201120000
20261201130000
20261201140000
20261201150000
20261201160000
20261201170000
```

Y `head -3 ~/spinus-produccion-foto-despues/04-migraciones.tsv` / `tail -8` de
ese archivo enseñan lo mismo con su nombre (`audit_log_sin_truncate`, …,
`agenda_f5b_protecciones_cita`).

Las cuentas de `estado`: citas, consultorios y clínicas, las mismas que en el
paso 3 del plan (más lo que la app haya creado entretanto); `audit_log`, igual
o mayor: como mínimo + el número de consultorios (backfill de F1).

## 5. Las rejillas

En `~/spinus-produccion-foto/aplicacion-<fecha>/` queda un `*.salida.txt` por
archivo. Ninguna fila `REVISAR`:

```bash
grep -l 'REVISAR *$' ~/spinus-produccion-foto/aplicacion-*/2026*.salida.txt || echo "ninguna REVISAR"
```

Y cada una con las filas de `rejillas-del-ensayo.txt` (los números de las INFO
son los de producción; se anotan en el plan §10.4).

## 6. Humo con la v2 APAGADA (dos minutos, Angel, con su cuenta)

La app de siempre tiene que seguir igual. Sin datos de pacientes reales en
ningún registro: sólo se anotan «sí/no» y cuentas. Se hace **después del
despliegue del código** (paso 6) y, si se quiere, también antes (código viejo).

Antes de empezar, una marca de tiempo (sólo lee):

```bash
read -rs PGPASSWORD; export PGPASSWORD
docker run --rm -e PGPASSWORD public.ecr.aws/supabase/postgres:17.6.1.167 psql -X -At \
  "host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.qpnegmmpneseirfyplbf dbname=postgres sslmode=require" \
  -c "select clock_timestamp()"
```

1. **Entrar y `/inicio`**: entra con su cuenta, ve su inicio. Cerrar sesión y
   volver a entrar (sin bucles de recarga).
2. **Agenda**: abre en la vista de siempre, con las citas de la semana. **No**
   aparecen el engrane de configuración v2, la campana ni el candado (con la v2
   apagada no se cargan).
3. **Un evento sin paciente** («Prueba aplicación», en un hueco libre de la
   semana siguiente): crearlo, arrastrarlo a otra hora y borrarlo. Todo funciona
   como siempre.
4. **Un expediente** de un paciente de prueba (o la cuenta demo): abre, se ven
   sus consultas y documentos.
5. **Búsqueda de pacientes en «Agendar»** (código nuevo; usa `imatch` de
   PostgREST): escribir dos palabras de un paciente de prueba; lo encuentra y la
   consola del navegador no tiene un 400.
6. **Tareas de Vercel**: Schedules → Cron Jobs → View Logs de `google-sync` y
   `recordatorios`: la primera invocación tras el despliegue responde 2xx, no 401.
7. **La auditoría de citas está viva** (lo único nuevo con la v2 apagada): con la
   marca de arriba,

   ```sql
   select tabla, accion, count(*) from public.audit_log
   where tabla = 'appointments' and created_at >= '<marca>' group by 1, 2;
   ```

   (misma forma de `docker run … -c "…"`): salen las filas del alta, el
   movimiento y el borrado del punto 3. Sólo cuentas.
8. **Nadie tiene la v2 encendida**:

   ```sql
   select count(*) filter (where agenda_v2_encendida), count(*) from public.agenda_ajustes;
   ```

   → `0|0` (la tabla nace vacía; sin fila cuenta como apagado).

`unset PGPASSWORD` al terminar.

Si algo de esto falla: no se enciende nada; se apunta qué (sin datos de
pacientes) y se decide entre arreglar o revertir (`PLAN-DE-APLICACION.md` §7).

---

## 7. Al terminar

- `~/spinus-produccion-foto-despues/` y `~/spinus-produccion-ensayo/` se quedan
  (estructura, sin datos) hasta cerrar la fase; luego se borran.
- El respaldo cifrado del paso 1b del plan: `shred -u` a los 7 días si nada lo
  necesitó.
- La línea `-- ESTADO · PRODUCCIÓN` de los 8 archivos, con la fecha y la
  comprobación (las de los pasos 2–5 de aquí), en un commit
  (`AUDITORIA-MIGRACIONES.md` §7).
