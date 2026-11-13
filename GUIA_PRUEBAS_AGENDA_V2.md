# Guía de pruebas a mano — Agenda v2

Para Angel. Sirve para probar a mano, en tu computadora y con datos inventados,
todo lo que se hizo en la mejora de la agenda: bloques A, B, C, D, D11, E y F.
No hace falta leer código. Todo pasa en tu máquina: la base de datos, los
correos (que no salen a internet) y un Google de mentira. Nada toca producción.

**Cómo leer cada prueba.** Cada una tiene un número (por ejemplo «B3») y tres
partes:

- **Qué hago:** los pasos, en orden.
- **Qué debo ver:** el resultado correcto. Los textos entre «comillas» son los
  que salen en pantalla, letra por letra.
- **Si falla, significa que…:** qué está roto si no ves eso.

Al final está la lista de casillas para ir marcando (§11), lo que no se puede
probar en tu computadora (§12) y el anexo para el día de producción (§13).

**Cómo leer los comandos.** Cada recuadro gris es un comando. Cópialo entero,
pégalo en la terminal de Ubuntu y pulsa Enter. Debajo de cada uno se dice qué
hace y qué debe responder. Están pensados para la terminal normal de Ubuntu
(bash). Todos se escriben desde la carpeta de la agenda; si abres una terminal
nueva, empieza siempre con:

```bash
cd ~/proyectos/app_ortointegra-agenda
```

> **La regla de oro.** Lo que se siembra son datos de mentira y se borran solos
> la próxima vez que siembres. **No guardes notas clínicas** sobre los
> pacientes de prueba: las notas son imborrables por diseño y, si guardas una,
> volver a sembrar se detiene. Si te pasa, se arregla con el paso P5 (reiniciar
> la base desde cero) y repitiendo P6 a P8.

---

## Índice

1. Preparación
2. Bloque A — Velocidad y orden (que todo lo de antes siga igual)
3. Bloque B — Cimientos (tipos de cita, disponibilidad, empalmes, cancelar)
4. Bloque C — Google en los dos sentidos
5. Bloque D — Reserva por enlace
6. Bloque D11 — Google antes de reservar
7. Bloque E — Recordatorios y confirmación
8. Bloque F — Interfaz, movimiento y orden visual
9. Seguridad
10. Con el interruptor APAGADO
11. Lista de casillas
12. Lo que no se puede probar en local
13. Anexo — El día de producción

---

## 1. Preparación

### 1.1 Qué necesitas tener

- La terminal de Ubuntu (WSL) abierta.
- Docker Desktop corriendo en Windows.
- Chrome.
- Nadie más usando la base local: ni la otra carpeta del proyecto ni otro
  agente. La base es una sola para las dos carpetas; reiniciarla les borra todo
  a los demás.

### 1.2 Paso a paso, desde cero

**P1. Entrar en la carpeta y comprobar la rama.**

```bash
cd ~/proyectos/app_ortointegra-agenda
```

```bash
git branch --show-current
```

Debe responder `feature/agenda-v2`. Si dice otra cosa, detente: estás en otra
rama.

**P2. Preparar la herramienta de Supabase que sí funciona.** La versión
anotada en `CLAUDE.md` (2.95.4) no sabe leer el archivo de configuración de
esta carpeta y se detiene con un error de `local_smtp`. La que funciona es la
**2.117.0**. Esta línea la busca y la guarda en el atajo `SB`. **Repítela en
cada terminal nueva**, porque el atajo se pierde al cerrarla.

```bash
SB=$(ls ~/.local/share/fnm/node-versions/*/installation/lib/node_modules/supabase/node_modules/@supabase/cli-linux-x64/bin/supabase | head -1)
```

```bash
$SB --version
```

Debe decir `2.117.0`. Puede añadir un aviso de que hay una versión más nueva:
ignóralo, no actualices. Si en vez de eso sale «No such file», no la tienes
instalada en ese sitio; en ese caso usa `SB="npx supabase@2.117.0"` y vuelve a
probar `$SB --version` (esta segunda vía no se probó al escribir la guía: si
tampoco responde `2.117.0`, detente y pide ayuda).

**P3. Comprobar que todo apunta a tu computadora y no a producción.**

```bash
grep -c '^NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' .env.local
```

Debe responder `1`. Si responde `0`, **detente**: la app apuntaría a otra base.

```bash
ls supabase/.temp/project-ref
```

Debe responder «No such file or directory». Si muestra el archivo, la carpeta
está enlazada a un proyecto remoto: detente y pregunta.

**P4. Levantar la base local** (si ya está arriba, no pasa nada).

```bash
docker ps --format '{{.Names}}' | grep -c app_ortointegra
```

Si responde un número mayor que 0, ya está arriba: salta a P5. Si responde `0`:

```bash
$SB start
```

Tarda un par de minutos la primera vez. Al final imprime una lista de
direcciones (API, Studio, Mailpit…). Puede mostrar llaves: no las copies a
ningún lado.

**P5. Reiniciar la base desde cero y aplicar las migraciones.** Esto **borra
toda la base local** y la vuelve a construir con las migraciones de esta rama,
en orden.

```bash
$SB db reset --local
```

Tarda alrededor de un minuto. El aviso `no files matched pattern:
supabase/seed.sql` es normal. Al final debe decir que terminó sin errores. Puede
recrear los contenedores con imágenes nuevas de Docker; también es normal.

> ⚠️ Escribe siempre `--local`. Nunca `--linked` ni `--db-url`.

Comprueba cuántas migraciones quedaron:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select count(*), max(version) from supabase_migrations.schema_migrations"
```

Debe responder `21|20261116120000` (las 5 de `main` más las 16 de la agenda).
<!-- PENDIENTE-SEG: si las correcciones de seguridad añaden migraciones, el número y la última versión cambian aquí. -->

> Este reinicio deja fuera las tres migraciones `20261014…` de la otra rama
> (`feature/limites-ajustables`). Para probar la agenda no hacen falta. Si
> luego vuelves a trabajar en esa rama, su base ya no las tendrá: pídele a
> quien programe que las vuelva a aplicar.

**P6. Sembrar los datos de prueba.**

```bash
npx tsx scripts/agenda-semilla.ts
```

Tarda unos segundos. Al final imprime cuántos pacientes y citas hay en cada
clínica (unas 350 citas en A y 17 en B) y la lista de usuarios. Si dice
«CANDADO: … no es local», detente: está apuntando fuera de tu computadora.

> **Las citas se calculan desde HOY.** Siembra el mismo día que vas a probar.
> Si pruebas al día siguiente, vuelve a sembrar (y repite P7 y P8, porque
> sembrar los borra).

**P7. Aprobar el aviso de privacidad de la reserva, sólo en tu base local.** El
enlace de reserva no abre si el aviso no está aprobado. El texto real sigue
**pendiente de revisión legal**; esto lo aprueba sólo en tu computadora para
poder probar. Primero se calcula la huella del texto:

```bash
SHA=$(npx tsx scripts/aviso-reserva-hash.ts | awk '/^sha256:/{print $2}'); echo "$SHA"
```

Debe imprimir un renglón de 64 letras y números. (El propio programa avisa que
el texto lleva la marca de pendiente; es correcto.) Después se aprueba:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('reserva-2026-11-v1', '$SHA', true, now()) on conflict (version) do update set texto_sha256 = excluded.texto_sha256, aprobado = true, aprobado_en = now();"
```

Debe responder `INSERT 0 1`. Esta aprobación sobrevive a las siembras; sólo se
pierde con P5.

**P8. Encender o apagar la agenda v2 en la Clínica Semilla A.** Nace
**apagada**. Sólo el usuario `postgres` de la base puede cambiarla (no hay botón
en la app, a propósito). Para **encenderla**:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) select id, true from public.clinicas where nombre = 'Clínica Semilla A' on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;"
```

Para **apagarla**, el mismo comando con `false`:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) select id, false from public.clinicas where nombre = 'Clínica Semilla A' on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;"
```

Los dos deben responder `INSERT 0 1`. Después **recarga la página** de la
agenda. Para saber cómo está ahora:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select c.nombre, coalesce(a.agenda_v2_encendida, false) from public.clinicas c left join public.agenda_ajustes a on a.clinica_id = c.id where c.nombre like 'Clínica Semilla%' order by 1"
```

Responde algo como `Clínica Semilla A|t` (encendida) y `Clínica Semilla B|f`
(apagada).

> Si algún día corres las pruebas automáticas (Playwright), éstas apagan todos
> los interruptores y vuelven a sembrar al empezar. Después repite P7 si hizo
> falta y P8.

**P9. Instalar dependencias (sólo si es la primera vez en esta carpeta).**

```bash
ls node_modules >/dev/null 2>&1 && echo "ya están" || npm ci
```

Si dice «ya están», sigue. Si instala, tarda unos minutos.

**P10. Construir la app.**

```bash
npm run build
```

Tarda unos minutos. Debe terminar sin «Failed to compile» y con una tabla de
rutas.

**P11. Arrancar la app en el puerto 3000.**

```bash
npx next start -p 3000
```

Debe decir «Ready» y quedarse corriendo. **Deja esta terminal abierta**; para
detener la app, pulsa Ctrl+C en ella. Abre Chrome en
**http://localhost:3000/login**.

> **Por qué 3000 y no 3001.** Los enlaces que van dentro de los correos
> (confirmar la cita, el recordatorio, WhatsApp) se arman con la dirección
> `http://localhost:3000`, que quedó fija al construir (P10). Las pruebas
> automáticas usan el 3001, pero para probar a mano el 3000 hace que los
> enlaces de los correos funcionen tal cual.

### 1.3 Las cuentas de prueba

La contraseña es la misma para todas: **`Semilla-Agenda-2026`**. Es inventada y
sólo vale en tu computadora.

| Usuario (correo) | Quién es | Rol | Clínica |
|---|---|---|---|
| `admin.a@semilla.spinus.test` | Dr. Admin Semilla Uno (Ortopedia) | médico **administrador** | Clínica Semilla A (VIP) |
| `medico.a@semilla.spinus.test` | Dra. Invitada Semilla Dos (Rehabilitación) | médico **invitado** | Clínica Semilla A |
| `secretaria.a@semilla.spinus.test` | Secretaria Semilla Tres | **secretaria** | Clínica Semilla A |
| `admin.b@semilla.spinus.test` | Dr. Otro Semilla Cuatro | médico administrador | **Clínica Semilla B** (la otra clínica) |

En la pantalla de entrada: «Correo electrónico», «Contraseña» y el botón
«Iniciar sesión».

**Para tener dos personas a la vez** (por ejemplo, el administrador y la
secretaria): usa una ventana normal de Chrome y otra de incógnito
(Ctrl+Mayús+N), o dos perfiles de Chrome. Para hacer de **paciente** que
reserva, usa siempre una ventana de incógnito sin sesión.

### 1.4 Lo que hay sembrado (para saber qué buscar)

«Semana actual» es la semana que la agenda abre hoy (de lunes a domingo).

**Clínica Semilla A.** Horario de la clínica: lunes a viernes de 08:00 a 18:00,
sábado de 08:00 a 13:00, domingo cerrado.

- **Consultorios:** «Centro» y «Hosp Norte» son del Dr. Admin; «Rehab» es de la
  Dra. Invitada. Teléfonos: Centro 9990000001, Hosp Norte 9990000002, Rehab sin
  teléfono.
- **Pacientes:** «Paciente Prueba 01» a «Paciente Prueba 25». Del 01 al 15 son
  del Dr. Admin; del 16 al 25, de la Dra. Invitada. Cada uno tiene teléfono
  (`99900000NN`) y correo (`paciente.NN@semilla.spinus.test`).
- **Citas:** unas 350, de 4 semanas antes a 4 semanas después. Hay de los cinco
  estados. El Dr. Admin tiene **una cita todos los días hábiles a las 10:00**
  en Centro; los martes y jueves la Dra. Invitada también tiene a las 10:00.
- **Eventos sin paciente**, en la semana actual salvo que se diga otra cosa:

| Evento | De quién | Cuándo |
|---|---|---|
| «Junta de servicio» | Dr. Admin | todos los lunes, 14:00–15:00 |
| «Cirugía programada» | Dr. Admin | miércoles, 07:00–10:00 |
| «Guardia» | Dr. Admin | miércoles, **todo el día** |
| «Comida» | Dra. Invitada | jueves, 13:00–14:00 |
| «Congreso de rehabilitación» | Dra. Invitada | **todo el día**, de jueves a martes de la semana siguiente |
| «Pendiente administrativo» | Dr. Admin | viernes, 13:30–14:00 (sin icono ni color) |
| «Sesión docente» | Dr. Admin | viernes de la **semana siguiente**, 12:00 |
| «Bloqueo de agenda» | Dr. Admin | martes de la **semana anterior**, 11:00 |
| «Videollamada con proveedor» | Dra. Invitada | miércoles **dentro de dos semanas**, 18:00 |

- **Fuera de horario, a propósito:** una cita el martes a las 19:00, otra el
  sábado a las 13:30, otra el viernes de la semana anterior a las 07:00 y otra
  de la Dra. Invitada el domingo de la semana siguiente.

**Clínica Semilla B.** Un médico (Dr. Otro Semilla Cuatro), 3 pacientes
(«Paciente Prueba B1» a «B3»), una cita diaria a las 10:00, «Junta clínica B» el
miércoles a las 13:00 y «Día de la clínica B» (todo el día) el miércoles.

**Lo que NO se siembra** y hay que crear a mano cuando toque: tipos de cita,
enlaces de reserva y la conexión con Google.

### 1.5 Ver los correos capturados (Mailpit)

Ningún correo sale a internet. Todos llegan a un buzón de prueba en
**http://127.0.0.1:54324**. Ábrelo en otra pestaña. Ahí verás el código para
reservar, el comprobante y el recordatorio. Si llegan muchos, usa el buscador de
arriba con el correo del destinatario.

### 1.6 Volver a dejar los límites de intentos en cero (sólo local)

La reserva pública limita cuántas veces se puede intentar por hora (ver
SEG-A8). Al probar mucho seguido, tú mismo vas a chocar con esos límites: verás
«Demasiados intentos. Espera un rato y vuelve a probar.». En tu base local se
borran así:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "delete from public.ip_rate_limits where ruta like 'reserva:%';"
```

Responde `DELETE` y un número. Además, abre una ventana de incógnito **nueva**
(la anterior guarda una marca del «dispositivo»). **Esto es sólo para tu base
local; nunca en producción.**

### 1.7 Teléfono y tableta en tu computadora

Chrome puede imitar el tamaño de un teléfono:

1. Pulsa la tecla F12 (se abren las herramientas de desarrollo).
2. Pulsa el icono del teléfono y la tableta, arriba a la izquierda de ese panel
   (o Ctrl+Mayús+M).
3. Arriba, en «Dimensions», elige «Responsive» y escribe el tamaño:
   - **teléfono: 390 × 844**;
   - **tableta: 820 × 1180**.
4. Recarga la página (F5).

Para probar gestos con el dedo, el modo de dispositivo ya imita el toque: el
cursor se vuelve un círculo. **Esto no sustituye al aparato real**: la
velocidad, el dedo de verdad y el teclado del teléfono sólo se ven en un
teléfono y una tableta reales (§12).

### 1.8 La auditoría (para las pruebas que la piden)

Cada alta, cambio, cancelación o borrado de una cita deja un renglón en la
bitácora (`audit_log`). Este comando, que sólo lee, muestra los últimos 20:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "select a.created_at at time zone 'America/Merida' as cuando, a.accion, coalesce(u.email, a.user_id) as quien, ap.title as cita, a.descripcion from public.audit_log a left join auth.users u on u.id::text = a.user_id left join public.appointments ap on ap.id = a.registro_id where a.tabla = 'appointments' order by a.created_at desc limit 20;"
```

Columnas: cuándo, qué pasó (`cita_alta`, `cita_editada`, `cita_cancelada`,
`cita_reactivada`, `cita_eliminada`, `cita_reservada_enlace`…), quién (el correo,
o `system` si lo hizo el sistema o un paciente por enlace), la cita y el
detalle. El detalle **sólo dice los nombres de los campos que cambiaron, nunca
sus valores**: si ves ahí un nombre de paciente, una nota o una hora escrita,
es un defecto. (La columna «cita» sí enseña el título actual de la cita: lo
añade el propio comando para que sepas cuál es.) Para ver la auditoría de la
configuración:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "select a.created_at at time zone 'America/Merida' as cuando, a.tabla, a.accion, coalesce(u.email, a.user_id) as quien from public.audit_log a left join auth.users u on u.id::text = a.user_id where a.tabla in ('agenda_ajustes','tipos_cita','consultorios','clinicas') order by a.created_at desc limit 20;"
```

Y para ver lo que deja Google y la reserva por enlace (conflictos, cambios
rechazados, empalmes):

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "select created_at at time zone 'America/Merida' as cuando, accion, tabla, user_id, descripcion from public.audit_log where accion like 'gcal%' or accion like 'reserva%' or accion like 'cita_ligada' order by created_at desc limit 20;"
```

---

## 2. Bloque A — Velocidad y orden

Lo que se hizo: la agenda abre más rápido y cambia de semana al instante, sin
cambiar nada de cómo se usa. Estas pruebas van **con la v2 APAGADA** (P8 con
`false`): es la agenda tal como la conoce hoy cualquier clínica. Entra como
**Dr. Admin** (`admin.a@…`) salvo que se diga otra cosa.

### A1. Abrir la agenda

**Qué hago:** entro y pulso «Agenda» en el menú de la izquierda.

**Qué debo ver:** en menos de un segundo, la semana actual con sus citas
pintadas, en vista «Semana». No se queda en blanco esperando. Si hay algo de
Google (hoy no hay conexión), llega después, sin frenar las citas.

**Si falla, significa que…** la carga rápida (bloque A1) no funciona o hay un
error al leer las citas. Si sale «No se pudo cargar la agenda.» con
«Reintentar», la app no llega a la base.

### A2. Cambiar de semana

**Qué hago:** pulso › (semana siguiente), luego «Hoy», luego ‹ (semana
anterior), y otra vez › y ‹ varias veces.

**Qué debo ver:** en la semana siguiente aparece «Sesión docente» (viernes) y
no «Cirugía programada». En la anterior aparece «Bloqueo de agenda» (martes).
«Hoy» vuelve a la semana actual. **Las semanas ya vistas, y las vecinas,
aparecen al instante**, sin rejilla vacía ni barra de carga.

**Si falla, significa que…** la memoria de semanas o la precarga de la semana
anterior y siguiente no funciona (lentitud), o se traen citas de la semana
equivocada.

### A3. Volver desde otra pantalla

**Qué hago:** en la agenda, me paro en la semana siguiente. Voy a otra pantalla
del menú (por ejemplo, el tablero de inicio) y vuelvo a «Agenda».

**Qué debo ver:** la agenda se pinta al instante con lo último que vi y se
actualiza por detrás sin parpadear.

**Si falla, significa que…** la memoria de lo ya cargado se pierde al salir.

### A4. Agendar una cita con paciente

**Qué hago:** pulso «Agendar». Se abre «Nueva cita». En «Buscar paciente por
nombre o apellido...» escribo «Prueba 05» y elijo «Paciente Prueba 05». Pongo
la fecha del **jueves** de esta semana, inicio 15:20 y una duración de «30 min».
Pulso «Guardar».

**Qué debo ver:** el aviso «Se agendó correctamente» y **una sola** tarjeta
«Paciente Prueba 05» el jueves a las 15:20. Si abro la agenda en otra ventana,
también se ve una sola.

**Si falla, significa que…** el alta está rota o se duplica la cita.

### A5. Editar una cita

**Qué hago:** pulso la cita de A4. Se abre «Editar cita». Elijo el estado
«Confirmada» y pulso «Guardar».

**Qué debo ver:** «Cambios guardados». La tarjeta cambia al color de
confirmada.

**Si falla, significa que…** la edición está rota.

### A6. Agendar un evento sin paciente y borrarlo

**Qué hago:** «Agendar», pestaña «Evento» (el título cambia a «Nuevo evento»).
En el título escribo «Junta de prueba». Elijo un icono y un color. Jueves,
16:30. «Guardar». Después pulso el evento y, en «Editar evento», la papelera
«Eliminar evento».

**Qué debo ver:** al guardar, la tarjeta con ese icono y ese color. Al borrar,
«Se eliminó de la agenda» y la tarjeta desaparece.

**Si falla, significa que…** los eventos sin paciente dejaron de funcionar
(deben quedarse, es decisión tuya).

### A7. Arrastrar y estirar

**Qué hago:**
1. Arrastro «Pendiente administrativo» (viernes 13:30) una hora hacia abajo.
2. Estiro su borde de abajo media hora.
3. Con el filtro en «Todos los médicos», arrastro «Comida» (jueves 13:00) hasta
   las 18:00. Sale un aviso: pulso «Cancelar». Lo repito y pulso «Aceptar».

**Qué debo ver:**
1. «Se movió en la agenda»; queda a las 14:30.
2. Queda de 14:30 a 15:30.
3. El aviso dice «Vas a moverlo a las 18:00, y esta clínica atiende de 08:00 a
   18:00. ¿Es correcto?». Con «Cancelar» la cita vuelve a 13:00–14:00 sola. Con
   «Aceptar» queda en 18:00–19:00. En ningún caso aparece una tarjeta repetida.

**Si falla, significa que…** el arrastre, el aviso de fuera de horario o el
«deshacer» del arrastre se rompieron (o volvió el defecto de la cita duplicada
al arrastrar).

### A8. Eventos de todo el día y de varios días

**Qué hago:** «Agendar», «Evento», título «Día de prueba», enciendo el
interruptor «Todo el día», fecha del miércoles, «Guardar». Filtro en «Todos los
médicos».

**Qué debo ver:** «Se agendó correctamente» y el evento en la franja de arriba
(la de todo el día) del miércoles, junto a «Guardia». «Congreso de
rehabilitación» cruza de jueves al final de la semana y sigue en la semana
siguiente. Con «Todo el día» encendido, la pestaña «Cita» queda deshabilitada:
una cita con paciente no es de todo el día.

**Si falla, significa que…** el cálculo de la medianoche de los eventos de
todo el día se rompió.

### A9. Filtro de médico

**Qué hago:** en el desplegable de médico elijo «Dra. Invitada Semilla Dos»,
luego «Dr. Admin Semilla Uno», luego «Todos los médicos». Después cambio a
«Mes». Por último, filtro por un médico en una semana sin citas suyas (por
ejemplo, avanzando varias semanas con la Dra. Invitada).

**Qué debo ver:** con la Dra. Invitada desaparece «Cirugía programada»; con el
Dr. Admin vuelve. En «Mes» la opción dice «Todos los médicos — el mes se ve por
médico» y no se puede elegir. En una semana vacía sale «Ningún evento de …» con
el botón «Ver todos los médicos», que deja el filtro en «Todos».

**Si falla, significa que…** el filtro dejó de filtrar, o «Ver todos los
médicos» sigue filtrando (era un defecto viejo que se arregló).

### A10. Las tres vistas

**Qué hago:** pulso «Mes», «Día» y «Semana». En «Día» voy al miércoles con ‹ ›.

**Qué debo ver:** la agenda abre en «Semana». En «Día» hay un panel a la derecha
con «Resumen del día» y «Huecos disponibles»; pulsar un hueco abre «Nueva cita»
con esa hora. En «Mes», los días con sus citas.

**Si falla, significa que…** alguna vista o el panel del día se rompió.

### A11. Enlace directo para agendar a un paciente

**Qué hago:** consigo el código interno de un paciente con este comando (sólo
lee):

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "select pa.id, pa.nombre || ' ' || pa.apellidos as paciente from public.pacientes pa join public.clinicas c on c.id = pa.clinica_id where c.nombre = 'Clínica Semilla A' order by pa.apellidos limit 5;"
```

Copio el código largo de «Paciente Prueba 01» y abro
`http://localhost:3000/agenda?cita=nueva&paciente=<código>`. Después pruebo con
`http://localhost:3000/agenda?cita=nueva&paciente=00000000-0000-0000-0000-000000000000`.

**Qué debo ver:** con el código bueno se abre «Nueva cita» con «Paciente Prueba
01» ya puesto (y la hora de ahora). Con el inventado: «No se encontró ese
paciente. Abre la cita y elígelo a mano.».

**Si falla, significa que…** el enlace que usa el expediente para «agendar
cita» se rompió.

### A12. Iniciar consulta desde la cita

**Qué hago:** pulso una cita futura de «Paciente Prueba 01» y, en «Editar
cita», pulso «Iniciar consulta».

**Qué debo ver:** se abre la pantalla de nota nueva del expediente de ese
paciente. **No guardes la nota** (ver la regla de oro). Vuelve con el botón de
atrás.

**Si falla, significa que…** el puente agenda → nota se rompió.

### A13. La secretaria agenda para un médico

**Qué hago:** entro como **secretaria** (`secretaria.a@…`). Abro la agenda.
«Agendar», «Evento», título «Evento de la secretaria», jueves 16:05.

**Qué debo ver:** al abrir, el filtro está en «Todos los médicos» y ve
«Cirugía programada» y «Comida». En el formulario, «Guardar» está
deshabilitado y «Médico *» lleva asterisco hasta que elijo «Dr. Admin Semilla
Uno»; entonces se llena solo «Consultorio *» y puedo guardar: «Se agendó
correctamente».

**Si falla, significa que…** la secretaria perdió la vista de toda la clínica
o el alta para otro médico.

### A14. Tiempo real entre dos personas

**Qué hago:** ventana normal con el **Dr. Admin** en la agenda (semana actual);
ventana de incógnito con la **secretaria**. La secretaria crea un evento el
jueves a las 16:00 para el Dr. Admin. Luego la secretaria lo mueve media hora.

**Qué debo ver:** en la ventana del Dr. Admin el evento aparece solo, sin
recargar, y después se mueve solo. Nunca se duplica.

**Si falla, significa que…** el aviso en tiempo real entre pantallas se rompió.

### A15. La médica invitada sólo ve lo suyo

**Qué hago:** entro como **Dra. Invitada** (`medico.a@…`) y abro la agenda.

**Qué debo ver:** no hay desplegable de médico. No ve «Cirugía programada» ni
«Junta de servicio» (son del Dr. Admin). Sí ve «Comida» y sus citas de las
10:00 de martes y jueves.

**Si falla, significa que…** un médico invitado ve citas de otro médico
(grave; repórtalo).

### A16. Que lo de antes siga funcionando en el teléfono

**Qué hago:** pongo el tamaño de teléfono (§1.7) y recargo.

**Qué debo ver:** «Semana» y «Día» son **listas** (sin rejilla de horas). En
«Mes» hay un panel abajo, «Citas del día seleccionado», que abre en HOY. Abajo,
el botón «Agendar» abre «Nueva cita». El filtro «Filtrar por médico» funciona.
(El detalle visual del teléfono está en F27.)

**Si falla, significa que…** la vista de teléfono se rompió.

---

## 3. Bloque B — Cimientos

**Antes de empezar:** enciende la v2 en la Clínica A (P8 con `true`) y recarga.
Entra como **Dr. Admin**.

> Con la v2 encendida, **pulsar una cita** ya no abre directo la edición: abre
> una tarjeta pequeña de lectura con botones (F22). Para editar, pulsa
> «Editar» en esa tarjeta. Y **pulsar un hueco** abre una burbuja de alta
> rápida (F21); para el formulario completo, «Más opciones».

### B1. La pantalla de configuración

**Qué hago:** pulso el engrane de la barra de la agenda (al pasar el ratón dice
«Configurar horario de consulta»).

**Qué debo ver:** se abre «Configuración del calendario», con «‹ Agenda» para
volver y estas secciones: «Horario de la clínica», «Reserva por enlace y
recordatorios», «Disponibilidad por consultorio», «Tipos de cita», «Enlaces de
reserva» y «Contactos bloqueados».

**Si falla, significa que…** el interruptor no se leyó (sigues viendo el
modal viejo «Horario de consulta») o la pantalla nueva no carga.

### B2. Los cuatro ajustes de la clínica

**Qué hago:** en «Reserva por enlace y recordatorios» cambio «Recordatorio por
correo» a 12 y «Anticipación mínima para reservar por enlace» a 14. Pulso
«Guardar ajustes». Recargo la página. Después pruebo valores malos, uno a la
vez: 73 en el recordatorio, el campo vacío, y 2.5. Al final dejo los valores de
fábrica: **24, 2, 60 y 7**, y guardo.

**Qué debo ver:**
- Los cuatro campos, cada uno con su rango debajo («De X a Y.»):

| Ajuste | Unidad | Rango | De fábrica |
|---|---|---|---|
| «Recordatorio por correo» | horas antes de la cita | 1 a 72 | 24 |
| «Anticipación mínima para reservar por enlace» | horas | 0 a 72 | 2 |
| «Hasta cuándo se puede reservar» | días adelante | 1 a 365 | 60 |
| «Vigencia del enlace de un solo uso» | días | 1 a 30 | 7 |

- Al guardar: «Ajustes guardados». Al recargar, siguen en 12 y 14.
- Con 73: «Recordatorio por correo: de 1 a 72 horas antes de la cita». Vacío:
  «…: escribe un número». Con 2.5: «…: tiene que ser un número entero». No se
  guarda nada malo.
- La nota «Valen hacia adelante: un enlace de un solo uso ya emitido conserva
  la vigencia con la que nació.».

**Si falla, significa que…** los ajustes no se guardan, o el servidor acepta
valores fuera de rango (debe rechazarlos aunque la pantalla se equivoque).

### B3. Sólo el administrador cambia la configuración

**Qué hago:** entro como **secretaria** y abro el engrane. Luego como **Dra.
Invitada**.

**Qué debo ver:** las dos ven la pantalla con el aviso «El horario de la
clínica, los ajustes y los tipos de cita los cambia quien administra la
clínica; aquí los ves en solo lectura.». Los ajustes salen grises y no hay
«Guardar ajustes», ni «Editar horario», ni «Crear tipo». La secretaria no tiene
botones en «Disponibilidad». La Dra. Invitada sí puede editar la disponibilidad
de **su** consultorio («Rehabilitación (ficticio)»), y en «Enlaces de reserva»
sólo ve los suyos.

**Si falla, significa que…** alguien que no administra puede cambiar la
configuración de la clínica.

### B4. Crear y archivar tipos de cita

**Qué hago:** como **Dr. Admin**, en «Tipos de cita» → «Nuevo tipo de cita»:
1. Nombre «Consulta», Duración 30, Para «Toda la clínica». «Crear tipo».
2. Nombre «Revisión», Duración 20, «Toda la clínica». «Crear tipo».
3. Nombre «Infiltración», Duración 40, Para «Dr. Admin Semilla Uno». «Crear tipo».
4. Intento crear otra «Consulta», y otra con duración 7.
5. Archivo «Revisión» con «Archivar». Luego «Reactivar».

**Qué debo ver:** «Tipo de cita creado» y la fila «Consulta 30 min · Toda la
clínica». La segunda «Consulta» da «Ya hay un tipo de cita activo con ese
nombre»; la duración 7 se rechaza (de 5 a 600 minutos, en múltiplos de 5). Al
archivar: «Tipo de cita archivado» y la etiqueta «Archivado». Como Dra.
Invitada, «Infiltración» no le aparece.

> **Deja «Consulta» activa**: la reserva por enlace (bloque D) la necesita.

**Si falla, significa que…** los tipos no se guardan, o un médico ve tipos
personales de otro.

### B5. El tipo de cita en el formulario

**Qué hago:** «Agendar» (formulario completo). Cita con «Paciente Prueba 06»,
viernes, inicio 13:20. En «Tipo de cita» elijo «Infiltración». Guardo. Después
la edito y cambio a «Revisión» (si la reactivaste). Por último, en «Evento», miro
si sale «Tipo de cita».

**Qué debo ver:** el grupo «Tipo de cita» arranca en «Sin tipo». Al elegir
«Infiltración» (40 min) el fin pasa solo a 14:00; al cambiar a «Revisión», a
13:40. Puedo retocar el fin a mano. La tarjeta **no** muestra el nombre del
tipo (se queda con sus dos líneas). En un evento sin paciente no hay «Tipo de
cita».

**Si falla, significa que…** el tipo no fija la duración, o se coló en los
eventos.

### B6. Disponibilidad por consultorio

**Qué hago:** como **Dra. Invitada**, en «Disponibilidad por consultorio», en
«Rehabilitación (ficticio)» pulso «Usar horario propio». Pongo el lunes de
08:00 a 12:00 y «Guardar horario». Después «Usar el de la clínica» para
dejarlo como estaba (o déjalo para comprobarlo en D13).

**Qué debo ver:** «Disponibilidad guardada», la fila dice «Horario propio» y
«08:00 – 12:00». Al volver: «Ahora usa el horario de la clínica». La rejilla de
la agenda **sigue pintando el horario de la clínica** (es lo acordado); el
horario propio lo usan los turnos del enlace de reserva.

**Si falla, significa que…** la disponibilidad por consultorio no se guarda.

### B7. El horario de la clínica no acepta horas al revés

**Qué hago:** como **Dr. Admin**, «Horario de la clínica» → «Editar horario».
Pongo el cierre del lunes a las 07:00 (antes de la apertura). «Guardar
horario».

**Qué debo ver:** el error «Lunes: la hora de cierre tiene que ir después de
la de apertura» y el formulario sigue abierto. «Cancelar» para salir sin
cambios.

**Si falla, significa que…** se pueden guardar horarios imposibles (antes se
podía).

### B8. Aviso de empalme al agendar

**Qué hago:** con «Más opciones» (formulario completo): cita de «Paciente
Prueba 07» el viernes de 15:05 a 15:30. Guardo. Otra cita de «Paciente Prueba
08» el viernes de 15:10 a 15:40, mismo médico. Guardo. En el aviso pulso
«Cancelar». Vuelvo a guardar y pulso «Aceptar».

**Qué debo ver:** el aviso dice «Se empalma con «Paciente Prueba 07»
(15:05–15:30). ¿Guardar de todos modos?». Con «Cancelar» el formulario sigue
abierto, sin guardar. Con «Aceptar»: «Se agendó correctamente» y las dos citas
lado a lado. **No bloquea**: avisa y tú decides.

**Si falla, significa que…** no se detectan los empalmes, o bloquean en vez de
avisar.

### B9. Empalme al arrastrar y al estirar

**Qué hago:** creo «Paciente Prueba 09» el viernes a las 16:05 (30 min); si
al crearla ya avisa de un empalme con una cita sembrada, «Aceptar».
Arrastro esa cita una hora hacia arriba, encima de la de Prueba 07. «Cancelar».
Repito y «Aceptar». Después estiro el borde de abajo de otra cita hasta que
toque una vecina.

**Qué debo ver:** el mismo aviso «Se empalma con…». Con «Cancelar» la cita
vuelve a las 16:05 sin guardar; con «Aceptar» se queda arriba.

**Si falla, significa que…** el arrastre se salta la alerta de empalme.

### B10. Qué cuenta y qué no como empalme

**Qué hago:**
1. Agendo encima de una cita que esté «Cancelada» o «No asistió» (marca una
   antes desde su edición).
2. Agendo una cita de «Paciente Prueba 16» el martes de 18:20 a 18:40, y luego
   otra de «Paciente Prueba 17» de 18:25 a 18:45 con el mismo médico (Dra.
   Invitada).
3. Agendo encima de una cita de **otra semana** sin haberla abierto antes
   (por ejemplo, tres semanas adelante, a las 10:00, donde el Dr. Admin tiene
   cita fija) escribiendo la fecha a mano en el formulario.
4. Edito una cita empalmada y sólo cambio sus «Instrucciones,
   observaciones...».
5. Agendo a la misma hora que otra cita, **pero de otro médico**.

**Qué debo ver:**
1. Sin aviso: las canceladas y las inasistencias no ocupan el horario.
2. Primero «Vas a agendar a las 18:25, y esta clínica atiende de 08:00 a 18:00.
   ¿Es correcto?» → «Aceptar»; después el aviso de empalme. Son dos avisos
   seguidos.
3. Sale el aviso igual, aunque esa cita no estuviera en pantalla.
4. Sin aviso (no cambió la hora).
5. Sin aviso: el empalme es del mismo médico.

**Si falla, significa que…** las reglas del empalme no son las acordadas.

### B11. Cancelar en vez de borrar

**Qué hago:**
1. Pulso una cita con paciente; en la tarjeta, «Cancelar cita». Acepto.
2. Pulso otra cita con paciente → «Editar». Busco la papelera.
3. En «Editar cita» de otra, pulso la X junto al nombre del paciente.
4. Pulso un evento sin paciente → «Eliminar evento».

**Qué debo ver:**
1. Pregunta «¿Cancelar la cita de Paciente Prueba NN? El horario queda libre y
   la cita se queda en la agenda como cancelada.». Al aceptar, «Se canceló la
   cita» y la tarjeta **sigue en la agenda**, con el color de cancelada.
2. En la edición **no hay** «Eliminar cita»: hay un botón «Cancelar cita»
   (calendario con una X). Al pulsarlo: «Se canceló la cita».
3. La X dice «Quitar paciente y cancelar la cita» y avisa: «Una cita con
   paciente no se elimina: quitar al paciente CANCELA la cita. Seguirá en la
   agenda como cancelada…». Al reabrir una cancelada ya no hay ni «Cancelar
   cita» ni la X.
4. El evento sin paciente sí se borra: pregunta «¿Eliminar el evento «…»? No se
   puede deshacer.» y luego «Se eliminó de la agenda».

**Si falla, significa que…** con la v2 encendida todavía se pueden borrar
citas con paciente (no debe poder nadie; ver también SEG-A3).

### B12. La auditoría de las citas

**Qué hago:** después de B4 a B11, corro los dos comandos de auditoría de
§1.8.

**Qué debo ver:** renglones `cita_alta` (altas), `cita_editada` (cambios y
arrastres), `cita_cancelada` (B11) y `cita_eliminada` (sólo el evento sin
paciente), con tu correo en «quien». En la configuración: `UPDATE` de
`agenda_ajustes` (B2), `INSERT`/`UPDATE` de `tipos_cita` (B4), de `consultorios`
(B6) y `horario_clinica_editado` de `clinicas` si guardaste un horario bueno.
En el detalle, sólo nombres de campos.

**Si falla, significa que…** hay cambios sin rastro (va contra la regla de
`CLAUDE.md`), o el rastro guarda datos del paciente.

---

## 4. Bloque C — Google en los dos sentidos

Lo que se hizo: lo que cambias en el calendario «Spinus» de Google vuelve a
Spinus. Aquí se prueba con un **Google de mentira** que corre en tu
computadora; la prueba con tu cuenta real es aparte (§12).

### C0. Preparar el Google simulado

El Google simulado no tiene pantalla: se maneja con comandos cortos. Necesitas
**tres terminales**, todas en `~/proyectos/app_ortointegra-agenda`.

> ⚠️ **Antes de nada, detén la app del puerto 3000** (Ctrl+C en su terminal).
> Mientras el Google simulado esté conectado, la app del 3000 (la de P11)
> intentaría hablar con el Google de verdad con llaves falsas. Para estas
> pruebas se usa sólo el puerto **3002**.

**Terminal 1 — el Google simulado.** Primero se escribe un pequeño programa de
control (sólo hay que hacerlo una vez; queda en una carpeta que git ignora).
Copia **todo** el bloque, desde `cat` hasta la última `EOF`, y pégalo de una
vez:

```bash
cat > e2e/resultados/google-falso-manual.ts <<'EOF'
// Google simulado para pruebas A MANO. Sólo local. Lo escribió la guía de pruebas.
import { config } from 'dotenv'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { arrancarGoogleFalso, CALENDARIO } from '../google-falso/servidor'
import { encrypt } from '../../src/lib/encrypt'

config({ path: '.env.local', quiet: true })
const CLINICA = 'Clínica Semilla A'

function sql(q: string, v: Record<string, string> = {}): string {
  const vars = Object.entries(v).flatMap(([k, x]) => ['-v', `${k}=${x}`])
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-X', '-tAq',
    '-v', 'ON_ERROR_STOP=1', '-v', `clinica=${CLINICA}`, ...vars, '-f', '-'], { input: q, encoding: 'utf8' }).trim()
}

const BORRAR_CONEXION = `
delete from private.google_conexiones_secretos s using public.clinica_conexiones_google g, public.clinicas c
 where s.conexion_id = g.id and g.clinica_id = c.id and c.nombre = :'clinica';
delete from public.gcal_sync_estado e using public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';
delete from public.clinica_conexiones_google g using public.clinicas c where g.clinica_id = c.id and c.nombre = :'clinica';`

function puntas(dia: string, hora: string, min: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora) || !(min > 0)) throw new Error('dia=AAAA-MM-DD, hora=HH:MM, min>0')
  const ini = new Date(`${dia}T${hora}:00-06:00`) // hora de Mérida
  return { start: { dateTime: ini.toISOString() }, end: { dateTime: new Date(ini.getTime() + min * 60_000).toISOString() } }
}
const merida = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Merida' }) : '-'

async function main(): Promise<void> {
  const g = await arrancarGoogleFalso(4555)
  sql(`delete from public.reserva_empalmes_google r using public.clinicas c where r.clinica_id = c.id and c.nombre = :'clinica';` + BORRAR_CONEXION)
  const hecha = sql(`with x as (
      insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado, google_account_email)
      select c.id, u.id, 'clinica', :'cal', 'activa', 'falso@google-falso.test'
        from public.clinicas c, auth.users u where c.nombre = :'clinica' and u.email = 'admin.a@semilla.spinus.test'
      returning id)
    insert into private.google_conexiones_secretos (conexion_id, access_token, refresh_token, expires_at)
    select x.id, :'a', :'r', :'e'::bigint from x returning conexion_id;`,
  { cal: CALENDARIO, a: encrypt('token-falso-de-acceso'), r: encrypt('token-falso-de-refresco'), e: String(Date.now() + 10 * 365 * 86_400_000) })
  if (!hecha) throw new Error('no se pudo conectar la Clínica Semilla A (¿sembraste?)')

  createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1')
    const p = (k: string) => u.searchParams.get(k) ?? ''
    let salida = ''
    try {
      switch (u.pathname) {
        case '/lista':
          salida = [...g.eventos.values()].map((e) => `${e.id} | ${e.status} | ${e.summary ?? ''} | ${merida(e.start?.dateTime ?? e.start?.date)} → ${merida(e.end?.dateTime ?? e.end?.date)}${e.recurrence ? ' | serie' : ''} | descripción: ${(e.description ?? '').replace(/\s+/g, ' ').slice(0, 80)}`).join('\n') || '(sin eventos)'
          break
        case '/crear': {
          const veces = Number(p('veces') || '0')
          const e = g.crear({ summary: p('titulo'), description: p('descripcion') || undefined, ...puntas(p('dia'), p('hora'), Number(p('min') || '60')), ...(veces > 1 ? { recurrence: [`RRULE:FREQ=DAILY;COUNT=${veces}`] } : {}) })
          salida = `creado ${e.id}`
          break
        }
        case '/mover': g.modificar(p('id'), puntas(p('dia'), p('hora'), Number(p('min') || '60'))); salida = 'movido'; break
        case '/titulo': g.modificar(p('id'), { summary: p('texto') }); salida = 'título cambiado'; break
        case '/descripcion': g.modificar(p('id'), { description: p('texto') }); salida = 'descripción cambiada'; break
        case '/borrar': g.borrar(p('id')); salida = 'borrado (cancelado en Google)'; break
        case '/caido': g.lista = { demoraMs: 0, falla: 503 }; salida = 'Google CAÍDO'; break
        case '/lento': g.lista = { demoraMs: Number(p('ms') || '8000'), falla: null }; salida = `Google LENTO (${g.lista.demoraMs} ms)`; break
        case '/normal': g.lista = { demoraMs: 0, falla: null }; salida = 'Google normal'; break
        case '/ya':
          sql(`update public.gcal_sync_estado e set ultima_ok = now() - interval '5 minutes' from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';`)
          salida = 'listo: la próxima recarga de la agenda vuelve a leer Google'
          break
        case '/ultima':
          sql(`update public.gcal_sync_estado e set ultima_ok = now() - make_interval(secs => :'s'::int), errores_seguidos = 0, ultimo_error = null, candado = null, candado_hasta = null from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';`, { s: String(Number(p('seg') || '0')) })
          salida = `última lectura buena de Google: hace ${p('seg')} s`
          break
        default: salida = 'órdenes: /lista /crear /mover /titulo /descripcion /borrar /caido /lento /normal /ya /ultima'
      }
    } catch (err) { salida = `ERROR: ${err instanceof Error ? err.message : String(err)}` }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(salida + '\n')
  }).listen(4556, '127.0.0.1')

  const cerrar = (): void => { try { sql(BORRAR_CONEXION) } catch { /* nada */ } console.log('\nConexión de prueba borrada. Adiós.'); process.exit(0) }
  process.on('SIGINT', cerrar); process.on('SIGTERM', cerrar)
  console.log(`Google simulado en ${g.url} — órdenes en http://127.0.0.1:4556 — Ctrl+C para terminar y desconectar.`)
}
main().catch((e: unknown) => { console.error(e); process.exit(1) })
EOF
```

No responde nada (sólo crea el archivo). Después, en la misma terminal:

```bash
npx tsx e2e/resultados/google-falso-manual.ts
```

Debe decir «Google simulado en http://127.0.0.1:4555/ — órdenes en
http://127.0.0.1:4556 — Ctrl+C para terminar y desconectar.» y quedarse
corriendo. Esto **conecta la Clínica Semilla A** a ese Google de mentira (como
si el Dr. Admin hubiera conectado su cuenta). Cuando acabes las pruebas de C y
de D11, pulsa **Ctrl+C** aquí: borra la conexión de prueba.

**Terminal 2 — la app, en modo de prueba con Google simulado (puerto 3002).**

```bash
NODE_ENV=development GCAL_FALSO_URL=http://127.0.0.1:4555/ GOOGLE_CLIENT_ID=cliente-falso GOOGLE_CLIENT_SECRET=secreto-falso NEXT_PUBLIC_APP_URL=http://localhost:3002 NEXT_TELEMETRY_DISABLED=1 npx next dev --webpack -p 3002
```

Debe decir «Ready». Esta app sólo habla con el Google simulado por cuatro
cerrojos a la vez: modo de prueba, dirección local del simulado, base local y
llaves falsas. **Copia el comando entero, sin cambiar nada.** La primera vez
que abras cada pantalla tarda (se compila en el momento): puede tardar uno o
dos minutos.

Abre **http://localhost:3002/agenda** (la sesión del 3000 vale aquí). La v2
tiene que estar encendida (P8).

**Terminal 3 — las órdenes al Google simulado.** Aquí escribirás comandos
como éstos:

```bash
curl -s 127.0.0.1:4556/lista
```

Muestra los eventos del Google simulado, uno por renglón: su código (por
ejemplo `falso3x` o `google5`), si está vivo (`confirmed`) o borrado
(`cancelled`), el título, la hora de Mérida y el principio de la descripción.
Las demás órdenes (cambia las fechas por las de tu semana; usa el formato
AAAA-MM-DD):

| Para… | Comando |
|---|---|
| crear un evento «como en Google» | `curl -sG 127.0.0.1:4556/crear --data-urlencode "titulo=Junta en Google" -d dia=2026-11-19 -d hora=12:00 -d min=60` |
| crear una serie que se repite | lo mismo con `-d veces=3` |
| mover un evento | `curl -sG 127.0.0.1:4556/mover -d id=falso3x -d dia=2026-11-19 -d hora=17:00 -d min=30` |
| cambiar su título | `curl -sG 127.0.0.1:4556/titulo -d id=falso3x --data-urlencode "texto=Otro título"` |
| borrarlo | `curl -sG 127.0.0.1:4556/borrar -d id=falso3x` |
| que Spinus vuelva a leer Google ya | `curl -s 127.0.0.1:4556/ya` y luego **recarga la agenda** (F5) |

**Cómo «vuelve» un cambio a Spinus.** La agenda lee Google al abrirse (y al
volver a la pestaña después de 2 minutos), como mucho una vez por minuto. Así
que, después de cada cambio en Google: `curl -s 127.0.0.1:4556/ya` y recarga la
agenda. En producción además lo hace la tarea programada cada 10 minutos.

> **Para saber la fecha AAAA-MM-DD** de un día: la ves en la propia agenda
> (vista Día) o con `date -d 'next thursday' +%F` en la terminal.

### C1. Una cita nueva llega a Google sin las observaciones

**Qué hago:** en la agenda del 3002 (Dr. Admin) creo con «Más opciones» una
cita de «Paciente Prueba 10» el jueves a las 17:00 (30 min) con observaciones
«NOTA PRIVADA». Espero unos segundos y corro `curl -s 127.0.0.1:4556/lista`.

**Qué debo ver:** un evento «Cita médica: Paciente Prueba 10» a esa hora. En su
descripción **no** aparece «NOTA PRIVADA».

**Si falla, significa que…** la ida a Google se rompió o, peor, las
observaciones salen de Spinus (prohibido).

### C2. Mover en Google y verlo en Spinus

**Qué hago:** con el código del evento de C1, lo muevo a las 19:00 (`/mover`
con `hora=19:00`). Luego `/ya` y recargo la agenda.

**Qué debo ver:** la cita de «Paciente Prueba 10» ahora está a las 19:00 en
Spinus.

**Si falla, significa que…** los cambios hechos en Google no vuelven.

### C3. Editar en Google un evento sin paciente

**Qué hago:** en Spinus creo un evento sin paciente «Junta para Google», jueves
17:30. En `/lista` busco su código; le cambio el título a «Junta movida desde
Google» (`/titulo`). `/ya` y recargo.

**Qué debo ver:** el evento en Spinus se llama ahora «Junta movida desde
Google».

**Si falla, significa que…** los títulos de eventos sin paciente no vuelven
(sí deben volver).

### C4. El título de una cita con paciente NO se acepta desde Google

**Qué hago:** al evento de C1 («Cita médica: Paciente Prueba 10») le cambio el
título en Google a «Otro nombre». `/ya`, recargo la agenda. Luego `/lista`.

**Qué debo ver:** en Spinus la cita sigue siendo de «Paciente Prueba 10». En
`/lista`, el título volvió solo a «Cita médica: Paciente Prueba 10» (Spinus lo
restablece).

**Si falla, significa que…** alguien podría cambiar desde Google el nombre de
un paciente en Spinus.

### C5. Borrar en Google cancela, no borra

**Qué hago:** creo en Spinus una cita de «Paciente Prueba 11» el jueves 17:45.
En `/lista` busco su evento y lo borro (`/borrar`). `/ya` y recargo.

**Qué debo ver:** la cita sigue en Spinus, en estado **cancelada**. No
desaparece.

**Si falla, significa que…** un borrado en Google borra datos de Spinus.

### C6. Un evento creado en Google entra a Spinus y se edita desde Spinus

**Qué hago:** creo en Google «Comida con proveedor» el jueves a las 20:00 con
descripción «Notas de Google» (`/crear … --data-urlencode "descripcion=Notas
de Google"`). `/ya`, recargo. Lo pulso → «Editar». Le cambio la hora a las
20:30 y guardo. `/lista`.

**Qué debo ver:** en Spinus aparece **una sola** tarjeta «Comida con
proveedor», con «Notas de Google» en sus observaciones, y se abre «Editar
evento». Tras guardar, en `/lista` el evento está a las 20:30.

**Si falla, significa que…** lo creado en Google no entra como fila de Spinus
o sale duplicado.

### C7. Conflicto: gana el último cambio

**Qué hago:** a la cita de C1 la muevo en Google a las 16:00 (`/mover`). **Sin
recargar** la agenda, la abro en Spinus y le cambio la hora a las 15:00, y
guardo. Espero unos segundos, `/ya`, recargo y `/lista`. Después corro la
auditoría (§1.8).

**Qué debo ver:** gana el último cambio, que fue el de Spinus: la cita queda a
las 15:00 en Spinus y en Google. En la auditoría hay un renglón
`gcal_conflicto_cita`.

**Si falla, significa que…** un cambio pisa a otro sin dejar rastro, o gana
el más viejo.

### C8. Lo que NO debe volver: citas atendidas

**Qué hago:** a una cita de «Paciente Prueba 12» creada en el 3002 la marco
«Atendida» (en «Editar cita»). En Google la muevo una hora y media
(`/mover`). `/ya`, recargo, `/lista`.

**Qué debo ver:** en Spinus la cita no se mueve. En Google vuelve sola a su
hora. En la auditoría queda `gcal_cambio_rechazado`. Lo mismo vale para «No
asistió» y «Cancelada».

**Si falla, significa que…** se puede alterar desde Google una cita ya
cerrada.

### C9. Lo que NO debe volver: series que se repiten

**Qué hago:** creo en Google una serie: `/crear` con `titulo=Serie en Google`,
el jueves a las 21:00 y `-d veces=2`. `/ya`, recargo. La pulso.

**Qué debo ver:** se ve en la agenda en el jueves y el viernes con la etiqueta
«Evento» (sólo lectura), y pulsarla no abre nada. No se convierte en filas de
Spinus.

**Si falla, significa que…** se importan las citas recurrentes (decidiste que
no).

### C10. Con la v2 apagada, no se lee Google de vuelta

**Qué hago:** apago la v2 (P8 con `false`). Muevo algo en Google, `/ya`,
recargo. Después la vuelvo a encender.

**Qué debo ver:** con la v2 apagada, el cambio no vuelve a Spinus.

**Si falla, significa que…** el interruptor no protege esta función.

> **Hallazgo al preparar esta guía (para que lo decidas).** El plan decía que un
> evento creado en Google se podía **convertir en cita** ligándolo a un
> paciente. En la pantalla no encontré cómo: un evento importado se edita como
> evento y no deja ponerle paciente. Queda anotado en §12.

Cuando termines C y D11: Ctrl+C en la terminal 1 (desconecta) y en la terminal
2, y vuelve a arrancar la app del 3000 (P11).

---

## 5. Bloque D — Reserva por enlace

**Antes de empezar:** app del **3000** (P11), v2 encendida (P8), aviso aprobado
(P7) y el tipo «Consulta» activo (B4). Mailpit abierto (§1.5).

### D0. Crear el enlace fijo del Dr. Admin

**Qué hago:** como **Dr. Admin**, engrane → «Enlaces de reserva». En su bloque,
«Crear enlace fijo». Pulso «Copiar».

**Qué debo ver:** el subtítulo «Quien tenga un enlace puede agendar en un
horario libre. No son públicos: sólo los tiene a quien se los mandes.». Al
crear, «Enlace fijo creado» y una dirección del tipo
`http://localhost:3000/reservar/<22 letras y números>`. Al copiar, el botón
dice «Copiado». Si recargas, la dirección se esconde: «Mostrar enlace» la
vuelve a enseñar.

**Si falla, significa que…** no se pueden emitir enlaces. Si sale «La reserva
por enlace no está configurada en este servidor: no se pueden emitir
enlaces.», falta `RESERVA_SECRETO` en `.env.local`.

### D1. Reservar con el enlace fijo, eligiendo consultorio

**Qué hago:** abro el enlace en una ventana de **incógnito** (soy el paciente).
1. En «Consultorio» elijo «Consultorio Centro (ficticio)».
2. En «Tipo de cita», «Consulta (30 min)».
3. Elijo un horario de la semana siguiente (botón «Semana siguiente» si hace
   falta).
4. Lleno «Nombre completo» («Ana Reserva Uno»), «Teléfono (10 dígitos)»
   (5512345601) y «Correo electrónico» (`ana1@prueba.test`). Abro «Aviso de
   privacidad», lo leo y marco la casilla.
5. «Enviar código a mi correo».
6. En Mailpit abro «Tu código para reservar: NNNNNN» y escribo esos 6 números en
   «Código». «Verificar y reservar».

**Qué debo ver:**
- Arriba, «Reservar cita con Dr. Admin Semilla Uno» y su especialidad.
- Como el Dr. Admin tiene dos consultorios, puedo elegir; cada opción dice
  nombre y dirección.
- Los horarios salen por día («lunes 16 de noviembre») en botones de hora. **No
  aparecen** horarios ocupados, ni los de las próximas 2 horas, ni más allá de
  60 días, ni fuera de horario. Mientras un consultorio no tenga «horario
  propio» (B6), usa el de la clínica: de lunes a viernes de 08:00 a 18:00 y
  sábado de 08:00 a 13:00.
- El botón de los datos está gris hasta marcar la casilla.
- «Te enviamos un código de 6 dígitos a ana1@prueba.test. Vence en 10
  minutos.».
- Al final: «Tu cita quedó agendada», con la fecha, la hora, el médico, el
  consultorio y su dirección, y «Te enviamos el comprobante por correo…». No
  dice el tipo de cita.
- En ninguna parte de la página sale el nombre de la clínica.

**Si falla, significa que…** el flujo público está roto. Si la página dice que
no existe, revisa P7 y P8.

### D2. La reserva aparece «Por ligar» en la agenda

**Qué hago:** como **Dr. Admin**, voy en la agenda al día que reservé. Pulso la
cita y luego «Editar».

**Qué debo ver:** la tarjeta dice «Ana Reserva Uno» con la píldora «Por
ligar» (al pasar el ratón: «Por ligar: reservada por enlace, aún sin
paciente»). En «Editar cita», en vez del paciente, el bloque «Reservó por
enlace» con nombre, teléfono y correo, el historial («Sin cancelaciones ni
inasistencias recientes con este médico») y «Se liga a un paciente al iniciar
la consulta.». **No se crea ningún paciente nuevo** en la lista de pacientes.

**Si falla, significa que…** la reserva crea expedientes basura o no se
distingue en la agenda.

### D3. Enlace de un solo uso

**Qué hago:** como Dr. Admin, en «Enlaces de reserva», escribo en «Etiqueta
(opcional)» «Para Beto» y pulso «Emitir enlace de un solo uso». Copio la
dirección. En incógnito nueva reservo con «Beto Reserva Dos», 5512345602,
`beto2@prueba.test`. Después abro **otra vez** el mismo enlace.

**Qué debo ver:** la fila «Un solo uso · Para Beto» con «caduca el {fecha}» (7
días) y la nota «Vale 7 días y una sola reserva.». Al reservar, el botón dice
«Reservar cita» y **no pide código** al correo. La segunda vez: «Este enlace ya
no está disponible» con «Para agendar, comunícate con el consultorio:
{teléfono}.».

**Si falla, significa que…** un enlace de un solo uso sirve dos veces.

### D4. El código del correo

**Qué hago:** con el enlace fijo, en incógnito nueva, llego al paso del código
con `caro3@prueba.test`. Escribo un código equivocado. Luego cinco
equivocados seguidos. Luego «Enviar otro código» y uso el nuevo.

**Qué debo ver:** con uno malo, «El código no es correcto.». Al quinto malo,
«Demasiados intentos con ese código. Pide otro.». Con el código nuevo de Mailpit
sí reserva. (Si te topas con «Demasiados intentos. Espera un rato y vuelve a
probar.», es el límite por hora: §1.6.)

**Si falla, significa que…** alguien podría adivinar el código probando.

### D5. Dos personas eligen el mismo horario

**Qué hago:** abro el enlace fijo en **dos navegadores distintos** (Chrome
incógnito y, por ejemplo, Edge o Firefox en privado). En los dos elijo el mismo
horario libre y lleno datos distintos (`dani4@prueba.test` y
`eli5@prueba.test`). Llego al código en los dos. Pulso «Verificar y reservar»
primero en uno y enseguida en el otro.

**Qué debo ver:** el primero reserva. El segundo: «Ese horario se acaba de
ocupar. Elige otro.» y vuelve a la lista de horarios, donde ese ya no aparece.
En la agenda hay **una sola** cita en ese horario.

**Si falla, significa que…** dos personas pueden quedarse con el mismo turno.

> La prueba de «exactamente al mismo milisegundo» la hace un programa:
> `bash scripts/reserva-carrera.sh` (sólo local; crea y borra sus propios
> datos). Debe terminar en verde.

### D6. Candado: una cita activa por persona

**Qué hago:** con el enlace fijo, incógnito nueva, intento reservar otra vez
con `ana1@prueba.test` (que ya tiene la cita de D1), verificando el código.

**Qué debo ver:** no reserva: «Para agendar, comunícate con el consultorio:
{teléfono}.» (el del consultorio: Centro es 9990000001 y Hosp Norte
9990000002).

**Si falla, significa que…** una persona puede acaparar varios turnos.
<!-- PENDIENTE-SEG: tras la corrección A2 el candado decide por el correo verificado; confirmar que este texto no cambia. -->

### D7. Candado: tres cancelaciones cierran el autoservicio

**Qué hago:**
1. Con `fer6@prueba.test` y el teléfono 5512345606 reservo por el enlace fijo.
2. Como Dr. Admin cancelo esa cita («Cancelar cita»).
3. Repito 1 y 2 **dos veces más** (tres cancelaciones). Entre una y otra, si
   sale «Demasiados intentos…», aplico §1.6.
4. Intento reservar una cuarta vez con `fer6@prueba.test` y el mismo teléfono.
5. Como Dr. Admin, engrane → «Contactos bloqueados»: «Desbloquear». Vuelvo a
   intentar el paso 4.

**Qué debo ver:**
- En el paso 4: «Para agendar, comunícate con el consultorio: {teléfono}.». La
  persona no sabe si es por bloqueo o por otra cosa.
- En «Contactos bloqueados» aparece con «3 cancelaciones · se levanta solo el
  {fecha}» (unos 60 días después).
- Tras «Desbloquear» («Contacto desbloqueado») ya puede reservar.
- Las inasistencias («No asistió») cuentan igual que las cancelaciones.

**Si falla, significa que…** el candado contra quien agenda y cancela no
funciona, o no se puede levantar a mano.

### D8. Bloqueo manual de un contacto

**Qué hago:** como Dr. Admin, abro la cita «Por ligar» de «Beto Reserva Dos»
(D3) → «Editar» → «Bloquear contacto». Con el enlace fijo intento reservar con
`beto2@prueba.test` y su teléfono. Después «Desbloquear contacto» (en el modal
o en la lista).

**Qué debo ver:** en el modal, en rojo, «Bloqueado a mano para reservar por el
enlace». En la lista, «Bloqueado a mano». La reserva no pasa (mismo mensaje con
el teléfono). Al desbloquear, sí pasa.

**Si falla, significa que…** el bloqueo manual no funciona.

### D9. Regenerar y revocar el enlace fijo

**Qué hago:** como Dr. Admin, en el enlace fijo pulso «Regenerar» y acepto.
Abro el enlace **viejo**. Después, en un enlace de un solo uso sin usar, pulso
«Revocar» y lo abro.

**Qué debo ver:** la confirmación «Se emite un enlace fijo nuevo y el anterior
deja de funcionar…». «Enlace fijo regenerado». El enlace viejo da la página de
«no encontrado» («This page could not be found»). Revocar avisa «El enlace
dejará de funcionar para siempre…», «Enlace revocado», y ese enlace tampoco
abre. Las citas ya reservadas con ellos siguen igual.

**Si falla, significa que…** un enlace filtrado no se puede apagar.

> Desde aquí, usa el **enlace fijo nuevo** en las pruebas que siguen.

### D10. Ligar la cita a un paciente existente al iniciar la consulta

**Qué hago:** como Dr. Admin, abro la cita «Por ligar» de «Ana Reserva Uno» →
«Editar» → «Iniciar consulta». En el panel busco «Prueba 03» y elijo
«Paciente Prueba 03».

**Qué debo ver:** el panel «Ligar a un paciente»: «Reservó Ana Reserva Uno
(5512345601 · ana1@prueba.test). Elige su expediente o regístralo; después se
abre la nota de la consulta.», con el buscador ya escrito con «Ana». Al elegir,
se abre la nota nueva de «Paciente Prueba 03». **No guardes la nota.** Al
volver, la cita ya no dice «Por ligar»: es de «Paciente Prueba 03». La
secretaria no ve ese botón; sólo el médico de la cita.

**Si falla, significa que…** no se puede convertir la reserva en consulta.

### D11. Ligar creando un paciente nuevo

**Qué hago:** en otra cita «Por ligar» → «Editar» → «Iniciar consulta» →
«Registrar paciente nuevo». Intento «Crear y continuar» sin marcar el aviso.
Luego lo marco.

**Qué debo ver:** «Registrar paciente» con el nombre y el correo de quien
reservó ya puestos. Sin la casilla «Paciente informado del aviso de
privacidad»: «Debes marcar el consentimiento del aviso de privacidad.». Con
ella, se crea y se abre la nota (no la guardes).

**Si falla, significa que…** se crean pacientes sin consentimiento (prohibido).

### D12. Los horarios respetan la disponibilidad y los ajustes

**Qué hago:** como Dra. Invitada, crea su enlace fijo y pon a «Rehabilitación
(ficticio)» un horario propio con el lunes de 08:00 a 12:00 (B6). Abre su
enlace en incógnito. Luego, como Dr. Admin, cambia «Anticipación mínima» a 24 y
«Hasta cuándo se puede reservar» a 7, guarda y abre el enlace del Dr. Admin.
Al final, deja los valores de fábrica (2 y 60).

**Qué debo ver:** la Dra. Invitada sólo tiene un consultorio, así que no se
pregunta cuál. Los lunes sólo ofrecen horarios hasta antes de las 12:00. El
Dr. Admin: nada en las próximas 24 horas y nada más allá de 7 días.

**Si falla, significa que…** los turnos no salen del servidor con los ajustes
de la clínica.

### D13. La página pública no enseña datos internos

**Qué hago:** en la página del enlace, Ctrl+U (ver el código de la página) y
Ctrl+F buscando «Semilla A», «clinica_id» y el correo `admin.a`.

**Qué debo ver:** nada de eso aparece. Sólo el nombre del médico, su
especialidad y los consultorios.

**Si falla, significa que…** el enlace revela datos de la clínica.

---

## 6. Bloque D11 — Google antes de reservar

Lo que se hizo: antes de ofrecer y de confirmar un horario por enlace, Spinus
lee Google, para no ofrecer un turno que ya se ocupó allá. Si Google tarda o
está caído, sólo se reserva si la última lectura buena tiene menos de 30
minutos.

**Antes de empezar:** el Google simulado y la app del **3002** (C0), v2
encendida, aviso aprobado, tipo «Consulta» y un enlace fijo del Dr. Admin. El
enlace se abre en `http://localhost:3002/reservar/<código>` (cambia 3000 por
3002 en la dirección). Abre una vez la agenda en el 3002 para que exista el
estado de sincronización.

### G1. Al ver horarios, se lee Google si hace más de un minuto

**Qué hago:** en la página del enlace miro un horario libre de la semana
siguiente (por ejemplo, martes a las 11:00). Creo en Google un evento justo
ahí: `/crear` con `titulo=Ocupado en Google`, ese día, `hora=11:00`,
`min=60`. Luego:
1. `curl -sG 127.0.0.1:4556/ultima -d seg=10` y recargo la página del enlace.
2. `curl -sG 127.0.0.1:4556/ultima -d seg=120` y recargo otra vez.

**Qué debo ver:** en el paso 1 el horario de las 11:00 todavía se ofrece (la
última lectura fue hace 10 s; no se vuelve a leer). En el paso 2 desaparece. La
página nunca menciona Google.

**Si falla, significa que…** el enlace no se entera de lo que hay en Google.

### G2. Al reservar, se lee Google siempre

**Qué hago:** en la página del enlace dejo a la vista un horario libre (por
ejemplo, miércoles 12:00 de la semana siguiente). Creo en Google un evento ahí.
`curl -sG 127.0.0.1:4556/ultima -d seg=1` (para que la página no lo vea antes).
Elijo ese horario y termino la reserva.

**Qué debo ver:** al confirmar, «Ese horario se acaba de ocupar. Elige otro.».

**Si falla, significa que…** se puede reservar encima de algo que ya está en
Google.

### G3. Google caído

**Qué hago:** `curl -s 127.0.0.1:4556/caido`. Luego:
1. `curl -sG 127.0.0.1:4556/ultima -d seg=600` (hace 10 min) y reservo un
   horario libre.
2. `curl -sG 127.0.0.1:4556/ultima -d seg=2400` (hace 40 min) e intento
   reservar otro, y también recargar la lista de horarios.
3. `curl -s 127.0.0.1:4556/normal`.

**Qué debo ver:** en el paso 1 la reserva pasa. En el paso 2 sale «Por ahora no
se puede reservar en línea. Para agendar, comunícate con el consultorio:
{teléfono}.», sin decir nada de Google.

**Si falla, significa que…** con Google caído se reserva a ciegas, o se bloquea
la reserva aunque lo de Google sea reciente.

### G4. Google lento

**Qué hago:** `curl -sG 127.0.0.1:4556/lento -d ms=8000`. Repito los pasos 1 y
2 de G3 (10 min y 40 min) contando los segundos que tarda la respuesta. Al
final, `/normal`.

**Qué debo ver:** la respuesta llega en unos 4 segundos, no en 8: con 10 min
reserva; con 40 min, el mismo mensaje de G3.

**Si falla, significa que…** un Google lento cuelga la página pública.

### G5. Un evento de Google que se empalma con una reserva avisa a la clínica

**Qué hago:** reservo por el enlace (3002) un horario de la semana siguiente.
Después creo en Google un evento encima de esa hora. `curl -sG
127.0.0.1:4556/ultima -d seg=120` y, como Dr. Admin, recargo la agenda del
3002 (en escritorio). Abro «Por confirmar». Recargo otra vez.

**Qué debo ver:** un aviso emergente «Un evento de Google se empalma con una
cita reservada por enlace el {fecha} a las {hora}.» (si se detectó hace menos
de 2 minutos). El botón «Por confirmar (N)» lleva un contador rojo. Dentro, la
sección «Reservas por enlace empalmadas con Google», con «… · se empalma con un
evento de Google». Al recargar, no se repite el aviso. En la auditoría (§1.8,
cambiando el filtro o mirando todo) hay un `reserva_empalme_google`.

**Si falla, significa que…** la clínica no se entera de un choque entre una
reserva y su Google.

Al terminar: Ctrl+C en las terminales 1 y 2, y arranca otra vez la app del 3000
(P11).

---

## 7. Bloque E — Recordatorios y confirmación

**Antes de empezar:** app del **3000**, v2 encendida, Mailpit abierto. Los
enlaces de los correos ya apuntan al 3000.

### E1. El comprobante al reservar

**Qué hago:** reservo por el enlace fijo con «Gina Reserva Siete»,
`gina7@prueba.test`, un horario de pasado mañana. En Mailpit abro el correo
«Tu cita con Dr. Admin Semilla Uno».

**Qué debo ver:** «Tu cita quedó agendada para el {día y hora}.», «Con: …»,
«En: {consultorio}, {dirección}.», «Teléfono del consultorio: …» y «Para
confirmar tu asistencia o avisar que no podrás ir, usa este enlace:» con el
enlace «Confirmar o cancelar mi cita». **No lleva** el tipo de cita, ni el
nombre de la clínica, ni notas, ni el teléfono de Gina. Las citas que agenda
el personal **no** mandan comprobante.

**Si falla, significa que…** el comprobante no sale o lleva datos de más.

### E2. Abrir el enlace no cambia nada

**Qué hago:** pulso el enlace del correo de E1. Miro la página y la cierro sin
pulsar nada. Como Dr. Admin miro esa cita en la agenda.

**Qué debo ver:** la página «Tu cita» con fecha, hora, «Con: …», «En: …»,
«Teléfono del consultorio: …» y «Tu cita está agendada.». La cita en la agenda
**sigue agendada**. (Esto importa porque los filtros de correo y la vista previa
de WhatsApp abren los enlaces solos.)

**Si falla, significa que…** un programa que sólo mire el enlace podría
confirmar o cancelar citas.

### E3. Confirmar la asistencia

**Qué hago:** en la página pulso «Confirmo mi asistencia». Recargo la página.

**Qué debo ver:** «Gracias. Tu asistencia quedó confirmada.». Recargar no lo
repite. En la agenda la cita pasa a **confirmada** (círculo relleno ● delante
de la hora). En la auditoría, `cita_editada` hecha por `system` con
`enlace_paciente`.

**Si falla, significa que…** el paciente no puede confirmar.

### E4. «No podré asistir», en dos pasos, y el horario se libera

**Qué hago:** con la agenda del Dr. Admin abierta en escritorio en esa semana,
en otra ventana abro el enlace del correo y pulso «No podré asistir». Luego
«Sí, cancelar mi cita». Abro el enlace de reserva y miro ese horario.

**Qué debo ver:** primero «¿Seguro que no podrás asistir? Se cancelará tu cita
y se liberará tu horario.» con «Sí, cancelar mi cita» y «Volver». Después «Tu
cita quedó cancelada y el horario se liberó.» y la oferta «¿Quieres otra fecha?
Puedes elegir un horario libre con el enlace de reserva del consultorio.» con
«Elegir otro horario». Ese horario vuelve a ofrecerse en el enlace. Aunque ya
estuviera confirmada (E3), se puede cancelar.

**Si falla, significa que…** el paciente no puede avisar, o el turno no se
libera.

### E5. Aviso a la clínica cuando un paciente cancela

**Qué hago:** lo miro en la agenda del Dr. Admin justo después de E4.

**Qué debo ver:** un aviso emergente «Un paciente canceló su cita del {fecha}
a las {hora}.», **sin el nombre**. El botón «Por confirmar (N)» con un contador
rojo; dentro, «Canceladas por el paciente (48 h)» con esa cita. Si es el
personal quien cancela, no hay aviso. (El panel «Por confirmar» sólo está en
escritorio.)

**Si falla, significa que…** la clínica no se entera a tiempo de un horario
que se liberó.

### E6. Cancelar sólo hasta una hora antes

**Qué hago:** (hazlo en horario de consulta, entre semana antes de las 17:00).
Como Dr. Admin pongo «Anticipación mínima para reservar por
enlace» en 0 y guardo. Reservo por el enlace el primer horario libre de hoy que
empiece **dentro de menos de una hora**. Abro el enlace de su comprobante.
Después dejo la anticipación otra vez en 2.

**Qué debo ver:** no aparece «No podré asistir». En su lugar: «Ya no es posible
cancelar desde el enlace; comunícate al {teléfono del consultorio}.». «Confirmo mi asistencia»
sí funciona.

**Si falla, significa que…** el paciente puede cancelar a última hora por el
enlace (decidiste que no).

### E7. Reagendar, con un tope de dos veces

**Qué hago:** desde la página cancelada de E4 pulso «Elegir otro horario».
Reservo otro horario (pide el código del correo). En el nuevo comprobante,
cancelo y vuelvo a «Elegir otro horario» y reservo (segunda vez). En el tercer
comprobante, cancelo otra vez. (Si salta «Demasiados intentos…», §1.6.)

**Qué debo ver:** la página de reserva dice «Estás reagendando tu cita del
{fecha}.». Cada reagendado llega con su comprobante y su propio enlace. Al
volver al enlace viejo: «Ya elegiste otro horario para esta cita.». Tras dos
reagendados ya no se ofrece «Elegir otro horario»: «Para agendar otra cita,
comunícate al {teléfono del consultorio}.». La cita nueva sale «Por ligar».
Como cada cancelación por enlace cuenta para el candado, al final Gina queda
además bloqueada (tres cancelaciones): desbloquéala en «Contactos
bloqueados».

**Si falla, significa que…** se puede reagendar sin fin.

### E8. El recordatorio por correo

**Qué hago:**
1. Como Dr. Admin agendo una cita de «Paciente Prueba 05» **hoy, dentro de
   unas 3 horas** (si ya es tarde, mañana temprano, siempre dentro de las
   próximas 24 horas).
2. En la terminal disparo a mano la tarea de recordatorios (en producción la
   corre Vercel cada 15 minutos). Este comando lee la clave `CRON_SECRET` de tu
   `.env.local` **sin mostrarla** en pantalla:

```bash
( set -a; . <(grep '^CRON_SECRET=' .env.local); set +a; printf 'Authorization: Bearer %s\n' "$CRON_SECRET" | curl -sS -i -H @- http://localhost:3000/api/cron/recordatorios; echo )
```

3. Lo vuelvo a correr.
4. Pruebo sin la clave:

```bash
curl -sS -i http://localhost:3000/api/cron/recordatorios; echo
```

**Qué debo ver:**
- En los pasos 2 y 3, la respuesta empieza con `HTTP/1.1 200` y termina en
  `{"ok":true}`. En el paso 4, `HTTP/1.1 401` sin nada más.
- En Mailpit, un correo a `paciente.05@semilla.spinus.test`: «Recordatorio: tu
  cita del {día}», con «Tienes una cita el … a las … (zona horaria: …) con
  Dr. Admin Semilla Uno en …», el enlace «Confirmar o avisar que no podré
  asistir», «Puedes avisar que no asistirás desde ese enlace hasta 1 hora antes
  de tu cita…» y «Si no reconoces esta cita, ignora este correo.». Nada clínico.
- **Un solo** recordatorio por cita, aunque corras la tarea dos veces.
- Llegarán también recordatorios de otras citas sembradas de las próximas 24
  horas (todos los pacientes de prueba tienen correo). Es normal.

**Si falla, significa que…** el recordatorio no sale, sale repetido, o la
tarea se puede disparar sin la clave.

### E9. Cuándo NO sale el recordatorio

**Qué hago:** agendo (personal) una cita de «Paciente Prueba 06» para dentro
de 30 horas, otra de «Paciente Prueba 07» dentro de 5 horas y la cancelo, y un
evento sin paciente dentro de 4 horas. Corro la tarea (E8, paso 2). Luego bajo
«Recordatorio por correo» a 2 horas y la corro otra vez. Después, una reserva
por enlace (E1) para dentro de 6 horas y corro la tarea.

**Qué debo ver:** nada para la de 30 horas (fuera de la ventana de 24), ni para
la cancelada, ni para el evento. Con 2 horas, sólo citas de las próximas 2
horas. La reserva por enlace que ya recibió su comprobante **no** recibe además
recordatorio para la misma hora. Deja el ajuste en 24 al final.

**Si falla, significa que…** se mandan correos que no tocan.

### E10. WhatsApp manual desde la cita

**Qué hago:** como Dr. Admin, pulso una cita futura de «Paciente Prueba 05»
(agendada). En la tarjeta (o en «Editar»), pulso «Enviar por WhatsApp».

**Qué debo ver:** se abre una pestaña de WhatsApp (`wa.me/5219990000005…`) con
el mensaje ya escrito: «Hola. Le escribimos del consultorio de Dr. Admin Semilla
Uno. Su cita es el {fecha} a las {hora} en {consultorio}. Para confirmar o
avisar que no podrá asistir: {enlace}». **No envíes nada**: cierra la pestaña.
El botón pasa a «Abierto en WhatsApp hh:mm». No va el nombre del paciente ni
nada clínico. En una cita cancelada o atendida no aparece el botón. Abrir la
cita sin pulsar el botón no crea nada.

**Si falla, significa que…** el mensaje sale con datos de más o no se puede
mandar.

### E11. WhatsApp desde «Por confirmar»

**Qué hago:** en escritorio pulso «Por confirmar (N)».

**Qué debo ver:** «Citas de mañana por confirmar» con las citas agendadas de
mañana (las confirmadas no salen), cada una con su botón «WhatsApp» (o «Sin
teléfono»). Si no hay, «No hay citas de mañana sin confirmar.».

**Si falla, significa que…** la lista de pendientes de mañana no funciona.

### E12. Enlaces inventados o apagados

**Qué hago:** abro `http://localhost:3000/confirmar/AAAAAAAAAAAAAAAAAAAAAA` (22
letras A). Después apago la v2 (P8, `false`), abro el enlace de confirmación de
E3 y la vuelvo a encender.

**Qué debo ver:** las dos veces, la página de «no encontrado».

**Si falla, significa que…** los enlaces responden cuando no deben.

---

## 8. Bloque F — Interfaz, movimiento y orden visual

Las **18 mejoras visuales** (F1 a F18) y las animaciones (F19, F20) salen
**sin** el interruptor: se ven igual con la v2 apagada o encendida. La
burbuja, la tarjeta, el minicalendario, el buscador, los atajos y el deslizar
(F21 a F26) sólo con la v2 **encendida**.

Para comparar **antes y después** sin levantar nada, abre la página
`e2e/resultados/F/comparativa/index.html` con este comando (la abre en tu
navegador de Windows):

```bash
explorer.exe "$(wslpath -w e2e/resultados/F/comparativa/index.html)"
```

Pone lado a lado las capturas de antes, de después y de después con la v2, a
los cuatro tamaños, más los videos.

Para ventanas de escritorio usa el modo de dispositivo (§1.7) con
**1440 × 900** y **1280 × 720**, salvo que se diga otra cosa.

### F1. Una sola barra arriba

**Qué hago:** vista Semana a 1440×900 y a 1280×720. Luego a 1180 de ancho.

**Qué debo ver:** en una sola fila: ‹ › «Hoy», la fecha, el conteo, Mes/Semana/
Día, «Compactar», el filtro, el engrane y «Agendar». La leyenda de colores ya
no está arriba: va al pie de la agenda. A 1180, los controles bajan a una
segunda fila, sin cortarse.

**Si falla, significa que…** se pierde altura útil para la rejilla.

### F2. Plegar el menú lateral

**Qué hago:** en la agenda, al pie del menú, «Plegar menú». Recargo. Voy a otra
pantalla y vuelvo.

**Qué debo ver:** el menú queda en iconos (unos 64 px) y la agenda se ensancha
pareja. El botón pasa a «Desplegar menú». Al recargar sigue plegado. Fuera de la
agenda, el menú siempre va desplegado.

**Si falla, significa que…** el menú plegable no funciona o deja espacio
muerto.

### F3. Densidad compacta

**Qué hago:** pulso el botón de filas («Densidad compacta»; al pasar el ratón:
«Densidad compacta: 48 px por hora»). Recargo.

**Qué debo ver:** el botón queda marcado, las horas se aprietan y a 1440×900 se
ve la jornada de 08:00 a 18:00 sin desplazar. Se conserva al recargar. Sólo
existe en Semana y Día de escritorio.

**Si falla, significa que…** no se puede ver la jornada completa.

### F4. Más datos en la vista Día

**Qué hago:** vista Día a 1440×900.

**Qué debo ver:** cada cita enseña también el teléfono y el consultorio corto
(«Centro»). En Semana no. En el panel de la derecha, al final, «Calendario del
mes» (sólo con la v2: F23).

**Si falla, significa que…** el ancho de la vista Día sigue desaprovechado.

### F5. «Compactar» al abrir — APAGADO, pendiente de tu decisión

**Qué hago:** abro la agenda. Luego pulso «Compactar» a mano.

**Qué debo ver:** al abrir, «Compactar» está **apagado** y el domingo se ve.
Esta mejora quedó **apagada a propósito**: encendida costaba unos 20 ms más al
abrir y el presupuesto decía «no empeorar». Encenderla es cambiar una sola
línea (`COMPACTAR_AL_ABRIR` en `src/lib/agenda/ventanaRejilla.ts`); **decide
tú** si la quieres. Al pulsarlo a mano: desaparece el domingo y aparece la
banda «Vista compacta: …». Al cambiar de semana, la rejilla no salta.

**Si falla, significa que…** (si al abrir ya viene encendido) alguien cambió
esa línea sin tu decisión.

### F6. El mes sin semanas vacías

**Qué hago:** vista Mes en escritorio, en varios meses.

**Qué debo ver:** 4 o 5 filas según el mes, sin una semana entera vacía de
relleno, y filas que miden según lo que traen. (En el teléfono el mes sigue de 6
semanas, a propósito.)

**Si falla, significa que…** se desperdicia alto en Mes.

### F7. Citas simultáneas legibles

**Qué hago:** filtro «Todos los médicos», un martes a las 10:00 (los dos
médicos tienen cita).

**Qué debo ver:** las dos citas miden lo mismo, una junto a otra. Cuando no
cabe el nombre completo se lee «Paciente P.» (nombre e inicial del apellido),
nunca sólo una letra.

**Si falla, significa que…** los nombres siguen ilegibles con varios médicos.

### F8. Sin la palabra del estado en la tarjeta

**Qué hago:** miro varias citas en Semana; paso el ratón por una.

**Qué debo ver:** ya no dice «agendada» ni «atendida» bajo el nombre. Delante
de la hora hay un signo: **○** agendada, **●** confirmada, **✓** atendida,
**—** no asistió, **✕** cancelada. Al pasar el ratón: «Nombre · Estado».

**Si falla, significa que…** el estado depende sólo del color (malo para quien
no distingue colores).

### F9. Iniciales del médico sólo con «Todos»

**Qué hago:** filtro por un médico; luego «Todos los médicos».

**Qué debo ver:** con un médico, las tarjetas no llevan la etiqueta con las
iniciales del médico; con «Todos», sí.

**Si falla, significa que…** sobra información repetida en cada tarjeta.

### F10. El botón «Hoy»

**Qué hago:** en escritorio, en la semana actual y en otra. En el teléfono,
avanzo con «Periodo siguiente» y pulso «Hoy».

**Qué debo ver:** en escritorio «Hoy» ya no parece apagado (tiene borde y color
normales). En el teléfono hay un «Hoy» nuevo arriba que regresa a hoy.

**Si falla, significa que…** «Hoy» sigue pareciendo deshabilitado.

### F11. «Compactar» no corta citas

**Qué hago:** enciendo «Compactar» en Semana.

**Qué debo ver:** las tarjetas de arriba se ven enteras. (Se investigó: no era
un defecto, el desajuste era de 1 píxel.)

**Si falla, significa que…** quedan citas cortadas.

### F12. La lista de Semana del teléfono abre en hoy

**Qué hago:** a 390×844, pestaña «Semana».

**Qué debo ver:** arriba queda el día de hoy (o el siguiente día con citas), no
el lunes.

**Si falla, significa que…** hay que desplazar para encontrar hoy.

### F13. El Mes del teléfono abre en hoy y se leen los puntos

**Qué hago:** a 390×844, pestaña «Mes».

**Qué debo ver:** el panel «Citas del día seleccionado» abre en hoy («… · hoy»),
no en el día 1. Los puntitos de citas en la celda de hoy se distinguen sobre el
azul. (Era un defecto; está arreglado.)

**Si falla, significa que…** volvió el defecto.

### F14. La lista de Día del teléfono en dos renglones

**Qué hago:** a 390×844, pestaña «Día».

**Qué debo ver:** cada cita en dos renglones: el nombre arriba; la duración y
el motivo abajo, con la píldora del estado a la derecha. Caben bastantes más
citas por pantalla que antes.

**Si falla, significa que…** las citas siguen ocupando 4 o 5 renglones.

### F15. La banda azul del teléfono más baja

**Qué hago:** a 390×844 y a 360 de ancho.

**Qué debo ver:** dos filas: arriba ☰, la fecha con el conteo debajo, ‹ «Hoy»
›; abajo Mes/Semana/Día, el filtro, «Compactar» y el engrane. Nada se parte ni
se encima a 360.

**Si falla, significa que…** la banda vuelve a comerse un cuarto de pantalla.

### F16. Tableta

**Qué hago:** a 820×1180. (Ver F28.)

**Qué debo ver:** una rejilla de 3 días en vez de la lista del teléfono.

**Si falla, significa que…** la tableta muestra media pantalla vacía.

### F17. El formulario de alta más cómodo

**Qué hago:** a 1280×720 pulso «Agendar».

**Qué debo ver:** el formulario es más ancho; los seis botones de duración van
en una sola fila (en el teléfono, dos filas de tres); «Guardar» se ve sin
desplazar.

**Si falla, significa que…** hay que desplazar para guardar.

### F18. El formulario de edición ordenado

**Qué hago:** abro una cita con paciente («Editar» desde la tarjeta con la v2).

**Qué debo ver:** los cinco estados en una sola fila, iguales, con el punto
encima de la palabra. «Iniciar consulta» con fondo azul suave y la misma altura
que «Guardar».

**Si falla, significa que…** la acción principal sigue pesando menos que
«Guardar».

### F19. Animaciones de entrada y salida

**Qué hago y qué debo ver**, momento por momento (todo es corto: entre una
décima y un cuarto de segundo):

| Hago | Debo ver |
|---|---|
| Abro la agenda | La vista entera aparece una vez. **Ninguna tarjeta entra por separado** |
| Cambio de semana, día o mes | Un fundido breve de la rejilla, sin parpadeo a blanco |
| Cambio de vista (Mes ↔ Semana ↔ Día) | La vista nueva sube unos píxeles con fundido |
| Creo una cita | Sólo esa tarjeta aparece subiendo levemente |
| Otra persona crea una cita (A14) | Entra y hace **un** destello de anillo azul por dentro del borde |
| Borro un evento | Se desvanece y luego se va (no desaparece de golpe) |
| Otra persona mueve una cita en el mismo día | Se desliza a su hora nueva |
| Arrastro y el aviso me hace «Cancelar» | La cita regresa deslizándose |
| Abro y cierro el formulario | Sube con fundido y el fondo se oscurece; al cerrar baja y se desvanece |
| Burbuja y tarjeta (v2) | Crecen desde donde pulsé y se recogen hacia ahí |
| Aparece o se va un aviso (por ejemplo la banda de «Compactar») | Entra y sale con fundido; la rejilla salta una sola vez |
| Paso el ratón por una tarjeta | No crece ni hace sombra |

**Si falla, significa que…** alguna animación brinca, parpadea o tarda.
Nada debe durar más de un cuarto de segundo.

> Se sabe y está aceptado: el formulario del horario y el de la invitación de
> Google conservan la animación vieja de toda la app; cancelar una cita cambia
> su color de golpe (no hay salida, porque la cita se queda).

### F20. Con «reducir movimiento»

**Qué hago:** pulso la tecla F12 → menú ⋮ del panel → «More tools» → «Rendering» → en
«Emulate CSS media feature prefers-reduced-motion» elijo «reduce». Repito F19.

**Qué debo ver:** todo aparece y desaparece al instante, sin deslizamientos.
Todo sigue funcionando.

**Si falla, significa que…** quien tiene activada esa opción por mareo sigue
viendo movimiento.

### F21. La burbuja de alta rápida (v2)

**Qué hago:** con la v2 encendida, como Dr. Admin, en Semana:
1. Clic en un hueco libre del jueves a las 16:00.
2. Escribo «Prueba 13», la elijo y «Guardar».
3. Arrastro sobre la rejilla de 11:00 a 12:30 de otro día libre.
4. «Más opciones».
5. Clic en una celda del Mes; y en un hueco del panel de Día.
6. Escape y clic fuera.

**Qué debo ver:**
1. Una burbuja pequeña junto al punto: «Nueva cita · jue {día}, 16:00–…», con
   «Paciente» ya enfocado, «Inicio», «Fin», «Guardar» y «Más opciones».
2. «Se agendó correctamente».
3. La burbuja respeta la duración arrastrada (11:00–12:30).
4. Se abre el formulario completo con el paciente, la hora de fin y el médico ya
   puestos.
5. Desde el Mes abre con las horas en blanco.
6. Se cierra.

Mensajes si falta algo: «Elige un paciente.», «Escribe la hora de inicio y de
fin.», «La hora de fin tiene que ser posterior a la de inicio.». Con «Todos los
médicos» pide «Médico». Los avisos de fuera de horario y de empalme siguen
saliendo. **No** abren la burbuja: la franja de todo el día, «Agendar» y el
enlace directo (van al formulario completo).

**Si falla, significa que…** la alta rápida no funciona. Si un clic justo al
abrir la agenda abre el formulario de siempre, es aceptado (la burbuja carga un
instante después).

### F22. La tarjeta de lectura (v2)

**Qué hago:** pulso una cita agendada de «Paciente Prueba 01». Pruebo cada
botón en citas distintas. Luego pulso un evento sin paciente y un evento
«Evento» de Google (si tienes alguno de C9).

**Qué debo ver:** una tarjeta con el paciente, el estado, la hora, el médico, el
consultorio, el teléfono y la nota, y los botones «Iniciar consulta» (sólo el
médico de la cita), «Confirmar» (si está agendada), «Reagendar» (abre el
formulario con el foco en la fecha), «Cancelar cita» (pregunta antes), «Editar»
y «Enviar por WhatsApp». En un evento sin paciente sólo «Editar» y «Eliminar
evento». Lo de Google en sólo lectura no abre nada. Escape la cierra y el foco
vuelve a la cita. En el teléfono sale como una hoja desde abajo.

**Si falla, significa que…** se abre la edición directa o falta alguna acción.

### F23. El minicalendario (v2, escritorio)

**Qué hago:** pulso el icono de calendario junto a la fecha («Ir a una fecha»).
Me muevo con las flechas, Re Pág / Av Pág, y Enter. Luego, en vista Día, miro
el panel de la derecha.

**Qué debo ver:** el cuadro «Elegir fecha» con el mes, «Mes anterior», «Mes
siguiente» y L M X J V S D. Enter lleva a ese día sin cambiar de vista; Escape
cierra. En Día, al final del panel, «Calendario del mes». En el teléfono no
hay minicalendario (a propósito).

**Si falla, significa que…** no se puede saltar rápido a una fecha.

### F24. El buscador (v2)

**Qué hago:** pulso la lupa («Buscar citas de un paciente») o la tecla `/`.
Escribo «Prueba 02», elijo el paciente y luego una cita.

**Qué debo ver:** primero la lista de pacientes (y citas «Por ligar»); al elegir
uno, sus citas de hace 30 días a dentro de un año (máximo 20), con «← Nombre»
para volver. Al elegir una cita, la agenda va a ese día en vista Día y abre su
tarjeta (si el filtro la escondía, lo cambia). Escape limpia y, otra vez,
cierra. Como Dra. Invitada, buscar un paciente del Dr. Admin no le enseña sus
citas.

**Si falla, significa que…** el buscador no encuentra o enseña citas ajenas.

### F25. Atajos de teclado (v2, escritorio)

**Qué hago:** con el foco en la agenda (sin escribir en ningún campo) pulso:

| Tecla | Debe… |
|---|---|
| `t` | ir a hoy |
| `j` o `n` | periodo siguiente |
| `k` o `p` | periodo anterior |
| `d` / `s` / `m` | vista Día / Semana / Mes |
| `c` | abrir «Agendar» |
| `/` | abrir el buscador |
| `?` | abrir la ayuda de atajos |

Después, en la ayuda («Atajos de teclado»), apago «Usar atajos de una tecla» y
recargo. Pulso `m`.

**Qué debo ver:** cada tecla hace lo suyo; con Ctrl, Alt o escribiendo en un
campo no hacen nada. Apagados, `m` ya no hace nada; se vuelven a encender desde
el botón «Atajos de teclado» junto a la lupa.

**Si falla, significa que…** los atajos interfieren al escribir o no se pueden
apagar.

### F26. Deslizar para cambiar de día en el teléfono (v2)

**Qué hago:** a 390×844, en las listas de «Día» y «Semana», arrastro con el
ratón (que hace de dedo) hacia la izquierda y hacia la derecha; luego un
arrastre corto.

**Qué debo ver:** a la izquierda, el periodo siguiente; a la derecha, el
anterior. Un arrastre corto vuelve a su sitio. En «Mes» no se desliza.

**Si falla, significa que…** el gesto no funciona o se dispara solo al
desplazar la lista hacia abajo.

### F27. El teléfono completo

**Qué hago:** a 390×844, con la v2 apagada y luego encendida.

**Qué debo ver:** la banda de F15, la lista de Semana en hoy (F12), la de Día
en dos renglones (F14), el Mes con su panel en hoy (F13), «Agendar» abajo. Con
la v2: la lupa en la banda (el filtro se angosta, lo aceptaste así), la tarjeta
como hoja inferior (F22) y deslizar (F26). No hay panel «Por confirmar» en el
teléfono (sólo escritorio).

**Si falla, significa que…** algo del teléfono se rompió.

### F28. La tableta completa

**Qué hago:** a 820×1180.

**Qué debo ver:** la banda azul con la pestaña «3 días»; una rejilla de tres
columnas, y «Periodo siguiente» avanza tres días. «Día» es rejilla de una
columna, con la leyenda. «Mes» es como el del teléfono. Si los tres días están
vacíos: «Sin citas en estos tres días». Para arrastrar una cita, mantener
pulsado un segundo.

**Si falla, significa que…** la tableta se ve como teléfono estirado.

---

## 9. Seguridad

### 9.1 Aislamiento entre clínicas y entre médicos

#### S1. La Clínica B no ve nada de la A

**Qué hago:** con la v2 de la Clínica A encendida, entro como **Dr. Otro**
(`admin.b@…`). Abro la agenda y reviso esta semana, la anterior y la
siguiente.

**Qué debo ver:** sólo lo suyo: «Junta clínica B», «Día de la clínica B» y sus
citas de las 10:00 con «Paciente Prueba B1…B3». Nunca «Paciente Prueba 05»,
«Cirugía programada» ni «Junta de servicio». Su agenda sigue en v2 apagada
(el interruptor es por clínica).

**Si falla, significa que…** una clínica ve datos de otra. **Grave**: detén
las pruebas y repórtalo.

#### S2. Lo mismo, preguntando directo a la base

Este bloque de comandos entra a la base **como si fueras ese usuario** (con su
contraseña de prueba), sin pasar por la pantalla. Así se comprueba que la
barrera está en la base y no sólo en la pantalla. Cópialo una vez por terminal:
define dos atajos, `entrar` y `pg`.

```bash
entrar() { ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"'); TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"Semilla-Agenda-2026\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).access_token||"")}catch{console.log("")}})'); [ -n "$TOKEN" ] && echo "Sesión lista: $1" || echo "No se pudo entrar como $1"; }
pg() { curl -s -w '\nHTTP %{http_code}\n' "http://127.0.0.1:54321/rest/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Prefer: return=representation" "${@:2}"; }
```

No responde nada. (No muestra ninguna llave; la llave pública local de la base
se lee de tu `.env.local` y se queda en la terminal.) Ahora:

```bash
entrar admin.b@semilla.spinus.test
```

Debe decir «Sesión lista: admin.b@semilla.spinus.test».

```bash
pg "appointments?select=title&title=eq.Cirug%C3%ADa%20programada"
```

```bash
pg "reserva_enlaces?select=id"
```

**Qué debo ver:** el primero responde `[]` (no ve la cirugía de A) y `HTTP
200`; el segundo, `[]` (no ve los enlaces de A; hazlo después de D0, cuando A
ya tiene enlaces). Como comparación, `entrar admin.a@semilla.spinus.test` y
los mismos dos comandos sí devuelven filas.

**Si falla, significa que…** la base deja ver datos de otra clínica.

#### S3. La médica invitada sólo ve lo suyo, también directo

**Qué hago:**

```bash
entrar medico.a@semilla.spinus.test
```

```bash
pg "appointments?select=title&title=eq.Cirug%C3%ADa%20programada"
```

Y en la pantalla: como Dra. Invitada, en «Enlaces de reserva» y en el buscador
(F24).

**Qué debo ver:** `[]`. En la pantalla, sólo sus enlaces y sus citas.

**Si falla, significa que…** un médico invitado ve la agenda de otro.

#### S4. Los enlaces públicos no cruzan clínicas

**Qué hago:** con la v2 de la Clínica A apagada (P8 `false`), abro el enlace
fijo y el enlace de confirmación de E3. Vuelvo a encenderla.

**Qué debo ver:** los dos dan «no encontrado», igual que un enlace inventado.
Nunca un mensaje que diga si el enlace existe.

**Si falla, significa que…** los enlaces funcionan con la función apagada o
dejan adivinar cuáles existen.

### 9.2 Correcciones de seguridad (parte A)

> ### ⚠️ SE AJUSTARÁ AL TERMINAR LAS CORRECCIONES
>
> Estas ocho pruebas describen cómo **debe** comportarse la app **después** de
> las correcciones que se están programando ahora. Hasta que estén terminadas,
> varias **fallarán a propósito** (y alguna, como SEG-A3, hace justo el daño
> que se quiere impedir). **No las corras hasta que te digan que las
> correcciones están listas.** Los textos exactos de algunos mensajes todavía
> no están decididos; están marcados para completarlos.

Usan los atajos `entrar` y `pg` de S2.

#### SEG-A1. El enlace no revela si un teléfono ya tiene cita

**Qué hago:** con el enlace fijo, en incógnito, lleno los datos con el
teléfono de «Ana Reserva Uno» (5512345601, que tiene cita activa) y un correo
nuevo (`otro1@prueba.test`), y pulso «Enviar código a mi correo» **sin
verificar**. Repito en otra ventana de incógnito con un teléfono limpio
(5599999999) y otro correo nuevo (`otro2@prueba.test`).

**Qué debo ver:** **exactamente la misma respuesta** en los dos casos (pide el
código). Nada distingue al teléfono que ya tiene cita.
<!-- PENDIENTE-SEG: texto exacto de la respuesta común, y si el aviso de «ya tienes cita» se muestra sólo tras verificar el correo. -->

**Si falla, significa que…** cualquiera podría averiguar si un número de
teléfono tiene cita con ese médico.

#### SEG-A2. El candado decide por el correo verificado

**Qué hago:**
1. Con el teléfono de «Ana Reserva Uno» (5512345601) y un correo nuevo
   verificado (`otro3@prueba.test`), reservo por el enlace fijo.
2. Bloqueo a mano el contacto de «Beto Reserva Dos» (D8). Intento reservar con
   el teléfono de Beto y un correo nuevo verificado (`otro4@prueba.test`).

**Qué debo ver:**
1. **Sí reserva**: el teléfono, por sí solo, ya no bloquea (el candado de «una
   cita activa» y el de cancelaciones van por el correo verificado).
2. **No reserva**: el teléfono sí cuenta para un **bloqueo manual**. Mensaje:
   «Para agendar, comunícate con el consultorio: {teléfono}.».
<!-- PENDIENTE-SEG: confirmar el mensaje del caso 2 y si el bloqueo manual por teléfono se aplica antes o después de verificar el correo. -->

**Si falla, significa que…** alguien con el mismo teléfono que un paciente
(familia, número reciclado) queda bloqueado sin razón, o un bloqueado a mano se
cuela cambiando de correo.

#### SEG-A3. Con la v2 encendida, nadie borra una cita con paciente, ni saltándose la pantalla

> ⚠️ **Antes de las correcciones este comando SÍ borra la cita.** Córrelo sólo
> cuando te confirmen que la corrección está aplicada.

**Qué hago:** con la v2 encendida, busco una cita con paciente y otra por
ligar:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "select a.id, a.title, (a.paciente_id is not null) as con_paciente, a.reserva_canal from public.appointments a join public.clinicas c on c.id = a.clinica_id where c.nombre = 'Clínica Semilla A' and a.status = 'scheduled' and a.start_time > now() and (a.paciente_id is not null or a.reserva_canal is not null) order by a.reserva_canal nulls last, a.start_time limit 4;"
```

Copio el `id` de una con paciente y lo pongo en lugar de `<ID>`:

```bash
entrar admin.a@semilla.spinus.test
```

```bash
pg "appointments?id=eq.<ID>" -X DELETE
```

Repito con el `id` de una por ligar (con `reserva_canal`).

**Qué debo ver:** la base lo rechaza (un error, no `[]` con la cita dentro) y la
cita **sigue** en la agenda. Con la v2 apagada, el borrado de hoy no cambia.
<!-- PENDIENTE-SEG: código de error y texto que devuelve la base (y el HTTP). -->

**Si falla, significa que…** alguien de la clínica puede borrar citas con
paciente por fuera de la pantalla (hoy pasa: es lo que se corrige).

#### SEG-A4. Los datos de la reserva y del consentimiento no se cambian desde fuera

**Qué hago:** con el `id` de una cita por ligar (consulta de SEG-A3) y la sesión
del Dr. Admin:

```bash
pg "appointments?id=eq.<ID>" -X PATCH -d '{"reserva_nombre":"Nombre cambiado"}'
```

```bash
pg "appointments?id=eq.<ID>" -X PATCH -d '{"reserva_aceptado_en":"2020-01-01T00:00:00Z","reserva_aviso_version":"otra"}'
```

```bash
pg "appointments?id=eq.<ID>" -X PATCH -d '{"reserva_telefono":null,"reserva_correo":null}'
```

**Qué debo ver:** los dos primeros se **rechazan** (error) y la cita conserva su
nombre de reserva y su consentimiento. El tercero **sí se permite**: borrar el
teléfono y el correo de la reserva es lo único que se deja hacer (por ejemplo,
si el paciente lo pide).
<!-- PENDIENTE-SEG: código de error de los dos primeros; lista final de columnas protegidas (¿reserva_canal, reserva_enlace_id, *_hmac, reserva_historial_previo, reserva_reagendados?). -->

**Si falla, significa que…** se podría falsear quién reservó o cuándo aceptó el
aviso de privacidad.

#### SEG-A5. Un evento de todo el día bloquea esos días en el enlace, y en la agenda sólo avisa

**Qué hago:** como Dr. Admin creo un evento de **todo el día** «Congreso del
Dr. Admin» para un martes de la semana siguiente. Abro su enlace de reserva y
miro ese martes. Después agendo dentro de la agenda una cita de «Paciente
Prueba 14» ese martes a las 09:00.

**Qué debo ver:** en el enlace, ese martes **no ofrece ningún horario**. En la
agenda, al guardar la cita sale un **aviso** que menciona el evento de todo el
día, y con «Aceptar» se guarda (no bloquea al personal).
<!-- PENDIENTE-SEG: texto exacto del aviso dentro de la agenda para el evento de todo el día. -->

**Si falla, significa que…** los pacientes pueden reservar en días que el
médico tiene ocupados, o el personal queda bloqueado.

#### SEG-A6. Un enlace de un solo uso no le sirve a un contacto bloqueado a mano

**Qué hago:** con «Beto Reserva Dos» bloqueado a mano (D8), emito un enlace de
un solo uso y reservo con su teléfono y su correo.

**Qué debo ver:** **no reserva**. El enlace de un solo uso se sigue saltando el
límite de una cita activa y el de cancelaciones, pero ya **no** el bloqueo
manual. El enlace no se gasta.
<!-- PENDIENTE-SEG: mensaje exacto que ve la persona y si el enlace queda sin gastar. -->

**Si falla, significa que…** alguien bloqueado a mano puede volver con un
enlace que se le mandó antes.

#### SEG-A7. El código del enlace lo pone siempre el servidor, y el nombre no ensucia Google

**Qué hago:**
1. Intento crear un enlace con un código elegido por mí, directo en la base
   (con la sesión del Dr. Admin). Primero, los datos que hacen falta:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select c.id || ' ' || p.id from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test';"
```

   Responde dos códigos separados por un espacio: el primero es la clínica y el
   segundo el médico. Ponlos en lugar de `<CLINICA>` y `<MEDICO>`:

```bash
pg "reserva_enlaces" -X POST -d '{"clinica_id":"<CLINICA>","medico_id":"<MEDICO>","clase":"unico","codigo_hash":"0000000000000000000000000000000000000000000000000000000000000000","vigencia_dias":7,"caduca_en":"2030-01-01T00:00:00Z"}'
```

2. Con el Google simulado (C0) y el enlace en el 3002, reservo con el nombre
   `Ana https://sitio-malo.test/promo` seguido de un texto muy largo (pega 300
   letras). Después `curl -s 127.0.0.1:4556/lista`.

**Qué debo ver:**
1. La base **rechaza** el alta: los enlaces sólo se crean desde la pantalla, y
   su código lo genera el servidor.
2. En `/lista`, el título del evento es «Cita médica: …» **sin** la dirección
   web y sin el texto larguísimo.
<!-- PENDIENTE-SEG: código de error del alta directa; regla exacta de limpieza del nombre (¿se quita el enlace, se rechaza la reserva con un mensaje?, largo máximo). -->

**Si falla, significa que…** alguien podría fabricar enlaces con códigos
conocidos, o usar el calendario del médico para mandar enlaces sospechosos a
los invitados.

#### SEG-A8. Límites de intentos en las páginas públicas

**Qué hago:** primero borro los contadores (§1.6). Con el enlace fijo:
1. En incógnito, pido el código **4 veces** para el mismo correo
   (`limite@prueba.test`), con «Enviar otro código».
2. Desde la misma ventana, intento **5 reservas** seguidas (con enlaces de un
   solo uso distintos).
3. En la página de confirmación de una cita, pulso los botones más de 10 veces.

**Qué debo ver:** cuando se pasa el límite, «Demasiados intentos. Espera un rato
y vuelve a probar.» (o, en la confirmación, el mismo texto en la página). Los
límites de hoy son:

| Acción | Límite |
|---|---|
| Ver horarios | 120 cada 10 min por red |
| Pedir código | 3 por correo, 10 por red y 5 por navegador, cada hora |
| Verificar código | 20 por red cada hora (y 5 intentos por código) |
| Reservar | 6 por red y 4 por navegador cada hora; 30 al día por enlace fijo |
| Confirmar o cancelar | 10 por enlace y 30 por red cada hora |

En el paso 1 el cuarto pedido ya no manda correo. En el 2, la quinta reserva no
pasa.
<!-- PENDIENTE-SEG: números finales tras las correcciones (la tabla puede cambiar) y si hay rutas públicas nuevas con límite. -->

**Si falla, significa que…** alguien podría inundar el buzón de un paciente o
llenar la agenda con reservas falsas.

Al terminar, borra los contadores otra vez (§1.6).

---

## 10. Con el interruptor APAGADO: debe verse igual que hoy

Apaga la v2 (P8 con `false`) y recarga. Entra como Dr. Admin y luego como
secretaria. **Todo esto debe verse exactamente como antes de la mejora** (salvo
lo visual del bloque F, que sale para todos):

### X1. Pulsar y agendar como siempre

**Qué hago:** pulso una cita, pulso un hueco, pulso «Agendar».

**Qué debo ver:** la cita abre directo «Editar cita» (sin tarjeta). El hueco
abre «Nueva cita» (sin burbuja). No hay lupa, ni «Ir a una fecha», ni «Atajos
de teclado», ni «Por confirmar». Las teclas `m`, `/` o `?` no hacen nada.

**Si falla, significa que…** las funciones nuevas se escapan del interruptor.

### X2. El engrane abre el horario de siempre

**Qué hago:** como Dr. Admin, pulso el engrane. Como secretaria, lo busco. Abro
`http://localhost:3000/agenda/configuracion`.

**Qué debo ver:** el engrane abre el formulario «Horario de consulta» de
siempre, sólo para el administrador; la secretaria no lo ve. La dirección de
configuración da «This page could not be found».

**Si falla, significa que…** la pantalla nueva se ve con la función apagada.

### X3. Borrar funciona como hoy

**Qué hago:** en «Editar cita» de una cita con paciente que nunca tuvo enlace
ni correo, pulso la papelera «Eliminar cita». En otra, la X del paciente.

**Qué debo ver:** la papelera la borra **sin preguntar**: «Se eliminó de la
agenda». La X dice «Quitar paciente y eliminar la cita» y pregunta «Quitar al
paciente elimina la CITA COMPLETA…». Si la cita ya tuvo enlace o correo de la
v2, en vez de borrarse dice que hay que cancelarla (es a propósito: guarda su
historial).

**Si falla, significa que…** el comportamiento de hoy cambió.

### X4. Sin tipos de cita ni aviso de empalme

**Qué hago:** agendo una cita encima de otra del mismo médico.

**Qué debo ver:** el formulario no tiene «Tipo de cita» y no sale «Se empalma
con…».

**Si falla, significa que…** lo de B se escapa del interruptor.

### X5. Las páginas públicas no existen

**Qué hago:** abro el enlace fijo, un enlace de confirmación y
`http://localhost:3000/reservar/AAAAAAAAAAAAAAAAAAAAAA`.

**Qué debo ver:** las tres dan «no encontrado».

**Si falla, significa que…** las reservas abren con la función apagada.

### X6. La tarea de recordatorios no hace nada

**Qué hago:** corro la tarea (E8, paso 2).

**Qué debo ver:** `{"ok":true}` y **ningún** correo nuevo en Mailpit.

**Si falla, significa que…** se mandan correos con la función apagada.

### X7. La Clínica B, siempre apagada

**Qué hago:** con la v2 de A **encendida**, entro como Dr. Otro (`admin.b`).

**Qué debo ver:** su agenda es la de siempre (X1 a X4), porque su interruptor
sigue apagado.

**Si falla, significa que…** el interruptor no es por clínica.

---

## 11. Lista de casillas

Marca cada una al pasarla. Si una falla, anota el número y qué viste.

**Preparación**
- [ ] P1–P11. Base reiniciada (21 migraciones), sembrada, aviso aprobado, app en el 3000

**Bloque A (v2 apagada)**
- [ ] A1. Abrir la agenda
- [ ] A2. Cambiar de semana
- [ ] A3. Volver desde otra pantalla
- [ ] A4. Agendar una cita con paciente
- [ ] A5. Editar una cita
- [ ] A6. Evento sin paciente y borrarlo
- [ ] A7. Arrastrar y estirar
- [ ] A8. Todo el día y varios días
- [ ] A9. Filtro de médico
- [ ] A10. Las tres vistas
- [ ] A11. Enlace directo para agendar
- [ ] A12. Iniciar consulta
- [ ] A13. La secretaria agenda
- [ ] A14. Tiempo real
- [ ] A15. La médica invitada sólo ve lo suyo
- [ ] A16. El teléfono como antes

**Bloque B (v2 encendida)**
- [ ] B1. Pantalla de configuración
- [ ] B2. Los cuatro ajustes
- [ ] B3. Sólo el administrador cambia la configuración
- [ ] B4. Tipos de cita
- [ ] B5. El tipo en el formulario
- [ ] B6. Disponibilidad por consultorio
- [ ] B7. Horario sin horas al revés
- [ ] B8. Empalme al agendar
- [ ] B9. Empalme al arrastrar y estirar
- [ ] B10. Qué cuenta como empalme
- [ ] B11. Cancelar en vez de borrar
- [ ] B12. Auditoría

**Bloque C (Google simulado, 3002)**
- [ ] C0. Google simulado y app del 3002 en marcha
- [ ] C1. Cita nueva a Google sin observaciones
- [ ] C2. Mover en Google
- [ ] C3. Editar en Google un evento sin paciente
- [ ] C4. Título de cita con paciente restablecido
- [ ] C5. Borrar en Google cancela
- [ ] C6. Evento creado en Google entra y se edita
- [ ] C7. Conflicto: gana el último
- [ ] C8. Citas atendidas no vuelven
- [ ] C9. Series no vuelven
- [ ] C10. Apagado no lee Google

**Bloque D**
- [ ] D0. Crear el enlace fijo
- [ ] D1. Reservar con el enlace fijo
- [ ] D2. «Por ligar» en la agenda
- [ ] D3. Enlace de un solo uso
- [ ] D4. El código del correo
- [ ] D5. Dos personas al mismo horario
- [ ] D6. Una cita activa por persona
- [ ] D7. Tres cancelaciones cierran el autoservicio
- [ ] D8. Bloqueo manual
- [ ] D9. Regenerar y revocar
- [ ] D10. Ligar a un paciente existente
- [ ] D11. Ligar creando un paciente nuevo
- [ ] D12. Horarios con disponibilidad y ajustes
- [ ] D13. Sin datos internos en la página

**Bloque D11 (Google simulado, 3002)**
- [ ] G1. Al ver horarios se lee Google
- [ ] G2. Al reservar se lee Google siempre
- [ ] G3. Google caído
- [ ] G4. Google lento
- [ ] G5. Aviso de empalme con Google

**Bloque E**
- [ ] E1. Comprobante
- [ ] E2. Abrir el enlace no cambia nada
- [ ] E3. Confirmar
- [ ] E4. «No podré asistir» y horario libre
- [ ] E5. Aviso a la clínica
- [ ] E6. Hasta una hora antes
- [ ] E7. Reagendar con tope de dos
- [ ] E8. Recordatorio
- [ ] E9. Cuándo no sale el recordatorio
- [ ] E10. WhatsApp desde la cita
- [ ] E11. WhatsApp desde «Por confirmar»
- [ ] E12. Enlaces inventados o apagados

**Bloque F**
- [ ] F1. Una sola barra
- [ ] F2. Plegar el menú
- [ ] F3. Densidad compacta
- [ ] F4. Más datos en Día
- [ ] F5. «Compactar» al abrir (apagado; **decidir**)
- [ ] F6. Mes sin semanas vacías
- [ ] F7. Citas simultáneas legibles
- [ ] F8. Sin la palabra del estado
- [ ] F9. Iniciales sólo con «Todos»
- [ ] F10. Botón «Hoy»
- [ ] F11. «Compactar» no corta citas
- [ ] F12. Semana del teléfono en hoy
- [ ] F13. Mes del teléfono en hoy
- [ ] F14. Día del teléfono en dos renglones
- [ ] F15. Banda del teléfono más baja
- [ ] F16. Tableta con tres días
- [ ] F17. Formulario de alta
- [ ] F18. Formulario de edición
- [ ] F19. Animaciones de entrada y salida
- [ ] F20. Reducir movimiento
- [ ] F21. Burbuja de alta rápida
- [ ] F22. Tarjeta de lectura
- [ ] F23. Minicalendario
- [ ] F24. Buscador
- [ ] F25. Atajos
- [ ] F26. Deslizar en el teléfono
- [ ] F27. El teléfono completo
- [ ] F28. La tableta completa

**Seguridad**
- [ ] S1. La Clínica B no ve la A
- [ ] S2. Lo mismo, directo a la base
- [ ] S3. La invitada sólo ve lo suyo, directo
- [ ] S4. Enlaces públicos con la v2 apagada
- [ ] SEG-A1. El enlace no revela teléfonos *(tras las correcciones)*
- [ ] SEG-A2. Candado por correo verificado *(tras las correcciones)*
- [ ] SEG-A3. Nadie borra citas con paciente *(tras las correcciones)*
- [ ] SEG-A4. Datos de reserva y consentimiento intocables *(tras las correcciones)*
- [ ] SEG-A5. Todo el día bloquea el enlace *(tras las correcciones)*
- [ ] SEG-A6. Un solo uso no salta el bloqueo manual *(tras las correcciones)*
- [ ] SEG-A7. Código del servidor y nombre limpio en Google *(tras las correcciones)*
- [ ] SEG-A8. Límites de intentos *(tras las correcciones)*

**Con el interruptor apagado**
- [ ] X1. Pulsar y agendar como siempre
- [ ] X2. El engrane de siempre
- [ ] X3. Borrar como hoy
- [ ] X4. Sin tipos ni empalme
- [ ] X5. Páginas públicas inexistentes
- [ ] X6. Recordatorios sin correo
- [ ] X7. La Clínica B, apagada

---

## 12. Lo que no se puede probar en local, y cómo probarlo después

| Qué | Por qué no aquí | Cómo y cuándo |
|---|---|---|
| **Google con tu cuenta real**: ida y vuelta (C), Google antes de reservar (D11) y respuestas a la invitación (RSVP) | Aquí sólo hay un Google simulado | En producción, con la v2 encendida **en una sola clínica de prueba**, conecta tu cuenta y repite C1–C9 y G1–G5 desde el calendario «Spinus» de tu Google (en la web o el teléfono). Antes de encender, revisa la auditoría: aparecerán muchos renglones a nombre de `system`. La respuesta a la invitación se enciende con `AGENDA_RSVP_GOOGLE=encendido` sólo después de comprobar que llega |
| **Convertir en cita un evento creado en Google** | No encontré el camino en la pantalla (ver la nota en C10) | Decide si hace falta; si sí, pídelo como tarea aparte |
| **Teléfono y tableta reales** | El modo de dispositivo de Chrome no mide velocidad real, ni el dedo, ni el teclado | Con la v2 encendida en tu clínica de prueba, abre la agenda en tu teléfono y en una tableta y repite F12–F15, F21–F28. Fíjate en la fluidez al cambiar de semana y al deslizar |
| **Lectores de pantalla** | No se probó con uno real | Si te interesa: VoiceOver en iPhone o TalkBack en Android sobre la burbuja y la tarjeta |
| **Tareas programadas de Vercel** (Google cada 10 min, recordatorios cada 15) | Vercel no se toca en local | Se activan solas al desplegar a producción. Sin `CRON_SECRET` responden 401 y no hacen nada. Tras desplegar, mira en Vercel → Cron Jobs que corren y en los logs que no hay errores |
| **Correo real** (Resend): comprobante, recordatorio, código | Aquí todo va a Mailpit | Con `EMAIL_TRANSPORT=resend` en Vercel, reserva tú mismo con tu correo en la clínica de prueba. Revisa que no llegue a spam. Antes, comprueba el límite de envíos por segundo de tu cuenta de Resend |
| **Textos legales** | Están **PENDIENTES DE REVISIÓN**: el aviso de privacidad de la reserva (legal) y los textos del comprobante, el recordatorio, la página de confirmación, las respuestas del enlace y el mensaje de WhatsApp | Revísalos contra la LFPDPPP vigente (2025). El aviso: quita la marca, sube la versión y aprueba su huella con `npx tsx scripts/aviso-reserva-hash.ts`. Mientras lleve la marca, el enlace de reserva no abre en producción |
| **Consentimiento de los pacientes que ya existen** para recibir recordatorios y WhatsApp | Es una pregunta legal | Decide si el consentimiento que firmaron lo cubre |
| **Plazo para guardar el historial del candado** (propuesto 12 meses; hoy no se borra solo) | Decisión legal | Decídelo junto con el aviso |
| **Volumen real** | Se midió con unas 350 citas (y 30 000 en una prueba) | Con las ~154 de producción debería ir instantáneo; obsérvalo los primeros días |
| **«Compactar» al abrir (F5) con una clínica real** | Se midió con datos inventados que tienen citas fuera de horario cada semana | Si decides encenderlo, obsérvalo en tu clínica |

---

## 13. Anexo — El día de producción

> Esto es para cuando todo lo anterior esté aprobado. Nada de aquí se hace en
> local. **Las migraciones se aplican antes que el código.**

### 13.1 Antes de empezar

1. En el SQL Editor de Supabase de producción:

   ```sql
   select version();
   ```

   Debe decir PostgreSQL **14 o más** (las migraciones usan una instrucción que
   no existe antes).

2. Comprueba que producción ya tiene las 5 migraciones de `main`
   (`20260912190416_remote_schema`, `20260913_b5_perfil_completo_rls`,
   `20260914_b56_trigger_aprovisionamiento`,
   `20260919230000_auth_02_reasentar_grants_rate_limit`,
   `20260919_consultorios_07_default_exclude`).

3. **Si se fusiona también `feature/limites-ajustables`:** sus tres migraciones
   `20261014…` van **antes** que las de la agenda (por su fecha). Y hay una
   cosa que **tienes que pedirle a quien programe (o a Claude) antes de
   fusionar las dos ramas**: actualizar la lista de funciones de la prueba
   `p1_permisos_funciones.sql` (su «caso 3») añadiendo las 30 funciones nuevas
   de la agenda. No es un hueco de seguridad: es una prueba que tiene escrita a
   mano una lista y, si no se actualiza, sale en rojo.

4. Cada migración se revisa antes con `supabase/AUDITORIA-MIGRACIONES.md` (ya
   están auditadas una por una y en conjunto en
   `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`).

### 13.2 Las migraciones, en este orden

> ### ⚠️ UNA POR UNA, Y LEYENDO SU RESULTADO
>
> - Pega **un archivo completo** en el SQL Editor, ejecútalo y **lee la tabla
>   que sale al final** (columnas `n`, `comprobacion`, `valor`, `esperado`,
>   `estado`). Todas las filas deben decir **OK** (o INFO). Si alguna dice
>   **REVISAR**, o sale un error, **detente**: no pases a la siguiente.
> - **Nunca vuelvas a ejecutar por separado una migración antigua.** Varias
>   reemplazan funciones de otras anteriores (por ejemplo, la auditoría de citas
>   se reescribe en B0, C2 y E1). Volver a correr una vieja después de una nueva
>   deshace la nueva.
> - Después de cada una, cambia su renglón `-- ESTADO · PRODUCCIÓN` por
>   «APLICADA Y VERIFICADA EN PRODUCCIÓN», con la fecha y la consulta con la que
>   lo comprobaste (`AUDITORIA-MIGRACIONES.md` §7), y haz commit.

| # | Archivo | Qué hace, en llano |
|---|---|---|
| 1 | `20261111120000_agenda_a18_indices_rango.sql` | Dos índices para que la agenda encuentre rápido las citas de una semana |
| 2 | `20261112120000_agenda_b0_auditoria_citas.sql` | Bitácora de cada alta, cambio, cancelación y borrado de citas (sólo nombres de campos, nunca valores) |
| 3 | `20261112130000_agenda_b1_ajustes_interruptor.sql` | Tabla de ajustes por clínica (los cuatro ajustes, los números del candado y el **interruptor**, que nace apagado) |
| 4 | `20261112140000_agenda_b5_horario_propio.sql` | Permite que cada consultorio tenga su propio horario de disponibilidad |
| 5 | `20261112150000_agenda_b6_tipos_cita.sql` | Tipos de cita con duración, y su marca en cada cita |
| 6 | `20261113120000_agenda_c1_gcal_sync_estado.sql` | Estado de la lectura de Google por clínica, el turno para no leer dos veces a la vez y la puerta que comprueba que la clínica tiene acceso |
| 7 | `20261113130000_agenda_c2_gcal_aplicar.sql` | Aplicar en Spinus lo que cambió en Google e importar lo creado allá, con sus reglas (títulos, citas cerradas) |
| 8 | `20261114120000_agenda_d1_enlaces_reserva.sql` | El aviso de privacidad aprobado, los enlaces de reserva y los datos de quien reserva en la cita |
| 9 | `20261114130000_agenda_d2_candado_reserva.sql` | El candado: historial de cancelaciones e inasistencias y contactos bloqueados |
| 10 | `20261114140000_agenda_d3_reservar.sql` | Códigos al correo y la reserva en sí, con la garantía de que dos personas no se quedan el mismo turno |
| 11 | `20261114150000_agenda_d4_gcal_por_ligar.sql` | Que Google no cambie el nombre de una cita «por ligar» |
| 12 | `20261115120000_agenda_e1_confirmacion_enlace.sql` | Enlace de confirmación de cada cita y la respuesta del paciente |
| 13 | `20261115130000_agenda_e6_reagendar.sql` | Reagendar desde «no podré asistir», con tope de dos |
| 14 | `20261115140000_agenda_e4_correos_cita.sql` | Registro de correos enviados (comprobante y recordatorio) para no mandar dos veces |
| 15 | `20261115160000_agenda_e9_rsvp_google.sql` | Confirmar la cita cuando el paciente acepta la invitación de Google (queda apagado por variable) |
| 16 | `20261116120000_agenda_d11_sync_antes_de_reservar.sql` | Cuándo fue la última lectura buena de Google y el registro de reservas que se empalman con Google |

<!-- PENDIENTE-SEG: migraciones de las correcciones -->

### 13.3 Variables en Vercel (Production)

Sólo los nombres y para qué sirven; los valores los generas tú.

| Variable | Valor | Para qué |
|---|---|---|
| `RESERVA_SECRETO` | 64 letras y números al azar (por ejemplo, con `openssl rand -hex 32`) | De ella salen todos los códigos de los enlaces de reserva y de confirmación. **Una vez puesta, no la cambies**: cambiarla invalida todos los enlaces ya enviados y el historial del candado. Sin ella, la reserva por enlace no funciona |
| `EMAIL_TRANSPORT` | `resend` | Que los correos de la agenda (código, comprobante, recordatorio) salgan por Resend. Sin ella no sale ninguno. Usa la `RESEND_API_KEY` que ya existe |
| `CRON_SECRET` | 64 letras y números al azar | La llave de las dos tareas programadas. Sin ella, las tareas responden 401 y no hacen nada |
| `AGENDA_RSVP_GOOGLE` | `encendido` | **Sólo después** de comprobar con tu cuenta real que la respuesta a la invitación de Google llega. Mientras no esté, queda apagado |
| `NEXT_PUBLIC_APP_URL` | `https://www.spinus.com.mx` (ya debería estar) | Con ella se arman los enlaces que van en los correos y en WhatsApp |

**Nunca en Vercel:** `RESERVA_AVISO_BORRADOR_LOCAL`, `GCAL_FALSO_URL` ni
`MAILPIT_URL` (son sólo para tu computadora).

### 13.4 El orden recomendado

1. `select version()` y lo de 13.1.
2. **Las 16 migraciones**, una por una, en el orden de 13.2.
3. Las variables de 13.3 (menos `AGENDA_RSVP_GOOGLE`).
4. `git merge` local de la rama sobre `main` y `git push` (despliega el código).
   Si despliegas el código antes que las migraciones no se rompe nada, pero
   cada visita deja un aviso en el registro de Vercel.
5. Las dos tareas de `vercel.json` (Google cada 10 minutos y recordatorios cada
   15) **se activan solas** con ese despliegue.
6. Tras la revisión legal: aprobar el aviso de privacidad de la reserva (quitar
   la marca, subir versión, `npx tsx scripts/aviso-reserva-hash.ts` y pegar el
   INSERT que imprime en el SQL Editor).
7. Encender la v2 **en una sola clínica primero**, pegando en el SQL Editor el
   texto que va entre comillas en P8 (desde `insert` hasta el `;`), con el
   nombre de esa clínica en vez de 'Clínica Semilla A', y probar ahí con tu
   cuenta de Google real (§12).
8. Cuando todo esté bien, encenderla en las demás.
