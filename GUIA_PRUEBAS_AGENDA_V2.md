# Guía de pruebas a mano — Agenda v2

Para Angel. Sirve para probar a mano, en tu computadora y con datos inventados,
todo lo que se hizo en la mejora de la agenda: bloques A, B, C, D, D11, E y F,
la tanda tras tus primeras pruebas a mano (§8-bis), la tanda de diseño,
duración y horarios (§8-ter), la tanda H (§8-quater), la tanda I (§8-quinquies)
y la tanda J (§8-sexies).
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

**Al día con las correcciones de seguridad (2026-11-12).** Ya están integradas
y probadas: sus pruebas son las de §9.2. La preparación (P1 a P11) se siguió
comando por comando sobre una base recién reiniciada, y los comandos de las
pruebas de seguridad que preguntan directo a la base se ejecutaron uno por uno
para comprobar que responden lo que aquí se dice.

**Al día con la tanda tras tus primeras pruebas a mano (2026-11-13).** Tus 16
puntos están hechos (§8-bis), salvo uno que te toca decidir (T2-2). Ya
decidiste: el bloqueo manual por teléfono se queda (SEG-A2) y «Compactar» al
abrir se queda apagado (F5). **Lee primero el aviso de §1.1 sobre tus datos
hechos a mano**: una corrida de pruebas automáticas o de la semilla los borra.

**Qué repetir tras la tanda del 2026-11-13.** Las nuevas, todas las de §8-bis
(T1-1 a T1-8, T2-1 a T2-7, T3-1 a T3-8). Y de las que ya tenías, éstas, porque
cambiaron o tocan algo que cambió:

- **Bloque B:** B1 (el engrane se llama distinto y la pantalla va en grupos),
  B2 («Plazos y recordatorios»), B3, B4, B6 (la rejilla ya pinta el horario
  propio), B7.
- **Bloque C:** C6 y C10 (un evento de Google ya se puede convertir en cita).
- **Bloque D:** D0 (otro subtítulo y la ficha por médico), D3 (otra nota), D9.
- **Bloque E:** E10 (WhatsApp sólo cuando aplica, con logo verde y el motivo
  si falla) y E11.
- **Bloque F:** F5 (ya decidido: apagado),
  F12 (la lista de Semana del teléfono llega a hoy también en fin de semana),
  F21 (la burbuja ya no se cierra al guardar), F22 (WhatsApp, «Convertir en
  cita» y la tarjeta al pasar el ratón), F24 (el buscador encuentra por nombre
  y apellido en cualquier orden), F27.
- **Seguridad:** SEG-A2 (ya decidido).
- **Apagado:** X1 (la búsqueda del formulario sale también apagada) y X2.

**Al día con la tanda de diseño, duración y horarios (2026-11-14).** Tus
puntos de ese día y tus cinco respuestas están hechos (§8-ter). La base pasa a
**29 migraciones**. Queda UNA decisión tuya: si la secretaria puede saber que una
cita atendida tiene nota clínica (G3-7).

**Qué repetir tras la tanda del 2026-11-14 (diseño, duración y horarios).**
Antes de nada, P5 a P8 (la base pasa a **29** migraciones). Después, en este
orden:

1. Las nuevas de §8-ter: G1-1 a G1-8, G2-1 a G2-9, G3-1 a G3-10 y G4-1 a G4-6
   (G3-7 al final: deja una nota real y obliga a P5).
2. **D0, D1, D2 y D3** (reservar por enlace): el consultorio es una tarjeta, el
   tipo sólo sale con más de uno (y sólo los del consultorio elegido) y tras
   elegir hora hay que pulsar «Continuar». Recién sembrado no hay tipos: antes,
   contesta la duración de la consulta (G2-1).
3. **D5, D12 y SEG-A5** (turnos): ahora en rejilla fija desde la apertura (G2-6).
4. **E1 a E4 y E7** (la página de confirmación y reagendar desde el enlace):
   mismos botones y mensajes, con el aspecto nuevo; «Volver» es un enlace
   centrado; el «Estás reagendando…» sale como aviso azul encima de los pasos.
5. **E8** (el recordatorio): dos botones; «No podré asistir» abre directo el
   «¿Seguro?». Y todas las que miran un correo (D4, E1, E5, E8): ahora empiezan
   con «Spinus».
6. **E10, T1-6, T1-7 y T1-8** (WhatsApp): el botón se llama «Enviar
   confirmación» («Enviar recordatorio» si está confirmada); tras agendar desde
   la burbuja, «Enviar confirmación» y «Por correo».
7. **F21 y F22** (burbuja y tarjeta): la tarjeta cambia por estado (G3-4, G3-5)
   y «Editar» es el engrane «Configuración de la cita»; «Reagendar cita» de una
   cancelada crea una cita nueva.
8. **T3-5 y T3-8** (al pasar el ratón): 0,5 s, no 1; la cita sube 3 px con
   sombra, no 1 px.
9. **B4, B5 y B6** (tipos y disponibilidad): la sección se llama «Duración y
   tipos de cita», la invitada crea, cambia y archiva los suyos, y no hay
   «Horario de la clínica» (cada consultorio dice su horario en una línea).
10. **T2-1, T2-2, T2-5 y T2-6** (configuración guiada y horario en la agenda):
    «Primeros pasos» en lugar de «Para empezar»; T2-2 ya no es una decisión
    pendiente (la invitada sí crea su duración); el gris y los avisos dicen
    «este consultorio»; con Tijuana activo la tarjeta de las 11:00 cae en
    blanco y no avisa.
11. **B7, F5 y F11** («Compactar»): con la v2 el botón se llama «Compactar la
    rejilla al horario de los consultorios» y usa el de los consultorios.
12. **X1, X2 y X5** (v2 apagada): todo como antes, el engrane abre «Horario de
    consulta» y las páginas públicas no existen.

**Al día con la tanda H (2026-11-15).** Tus 23 puntos están hechos (§8-quater).
Ya decidiste uno: AG-DT-63 se queda como está (el aviso a la secretaria de que
una cita atendida tiene nota). La base pasa a **32 migraciones**. Quedan TRES
decisiones tuyas (§6-bis de `mejora_agendaV2.md`, «Tanda H»): si mover una
atendida con nota se cierra también con la v2 apagada (H5-1); si el enlace de un
solo uso debe atender a quien no tiene correo, que hoy no puede (H1-5); y cómo
queda el horario de cada consultorio tras «Restablecer» (H2-7).

**Qué repetir tras la tanda H (2026-11-15).** Antes de nada, P5 a P8 (la base
pasa a **32** migraciones; el recordatorio viene apagado). Después, en este
orden:

1. Las nuevas de §8-quater: H1-1 a H1-5, H2-1 a H2-8, H3-1 a H3-4, H4-1 a
   H4-7 y H5-2. **H5-1 al final** (usa la nota real de G3-7 y obliga a P5).
2. **D1, D3 y D4** (reservar por enlace): el paso 1 se llama «Lugar» y la
   página siempre empieza ahí; «Volver» abajo en cada paso; el único también
   pide correo. Y **G1-1, G1-2, G1-5, G1-6, G1-7 y G1-8**: «Lugar», volver sin
   perder lo escrito y todo en claro aunque el teléfono esté en oscuro.
3. **B1, B2, B3, G2-1, G2-5, G2-6, T2-1, T2-2, T2-7 y T3-6** (configuración):
   ahora va en pestañas, con las fichas de los invitados plegadas y la casilla
   de la tarjeta en «Este dispositivo».
4. **E8, E9 y X6** (recordatorio): enciende antes el recordatorio; apagado no
   sale ninguno.
5. **E11, E5 y G5** («Por confirmar»): leyenda arriba, cada fila con lo que se
   puede mandar o «Marcar como confirmada», y el contador rojo de siempre.
6. **A10, F21 y G4-4** (huecos de Día): con duración de la consulta, el hueco
   es una fila de turnos y la burbuja propone esa duración.
7. **T1-3, T3-2, D11 y F21** (registro rápido): con teléfono, la leyenda y sin
   cerrarse con doble clic; «+ Añadir observaciones» en la burbuja.
8. **F12** (la lista de Semana del teléfono): el domingo abre al final.
9. **G3-6, G3-7 y SEG-A3** (atendida con nota): mismo resultado en pantalla.
10. **X1** (v2 apagada): nada de lo de arriba se ve.

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
8-bis. Tanda tras tus primeras pruebas a mano (2026-11-13)
8-ter. Tanda de diseño, duración y horarios (2026-11-14)
8-quater. Tanda H (2026-11-15)
8-quinquies. Tanda I (2026-11-17)
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

> ## ⚠️ TUS DATOS HECHOS A MANO SE BORRAN SI ALGUIEN SIEMBRA O CORRE LAS PRUEBAS AUTOMÁTICAS
>
> **La semilla (P6) y cualquier corrida de las pruebas automáticas
> (Playwright, `npx playwright test`, que siembra al empezar) BORRAN Y VUELVEN A
> CREAR enteras la Clínica Semilla A y la B.** Todo lo que hiciste a mano en
> ellas desaparece: tipos de cita (como tu «Cita Dr Ancona»), enlaces de
> reserva, citas, pacientes, contactos bloqueados, la conexión con el Google
> simulado y la v2 encendida. Pasa igual si las corre otra persona o un agente
> en esta computadora: la base es una sola.
>
> Desde el 2026-11-13 las pruebas automáticas, mientras corren, borran **sólo
> lo que ellas mismas crean**, y lo que ya había (por ejemplo un enlace fijo
> tuyo) lo apartan un momento y lo devuelven al terminar. Pero eso no te salva
> de la siembra del principio, y lo que crees a mano **mientras** corren sí
> puede borrarse.
>
> **Cómo no perder nada:**
> 1. **No pruebes a mano mientras alguien siembra o corre pruebas.** Antes de
>    empezar, pregunta si hay un agente o un programador trabajando con la base.
> 2. **Apunta lo que creas a mano** que quieras conservar (nombre y duración de
>    tus tipos de cita, a qué médico van tus enlaces) para rehacerlo en un
>    minuto.
> 3. **Después de una siembra o de una corrida de pruebas:** repite P7 si hizo
>    falta y P8, vuelve a crear «Consulta» (comando al principio del bloque D),
>    tus tipos y tus enlaces, y vuelve a arrancar el Google simulado si lo usas.
>
> Hoy no hay una clínica que la semilla no toque. Registrar una cuenta nueva en
> la app local **no** es buena salida: el registro todavía manda un correo de
> verdad (`DEUDA_TECNICA.md` AG-DT-16 y AG-DT-46).

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

Debe decir `2.117.0`. Puede añadir un aviso de que hay una versión más nueva
(«A new version of Supabase CLI is available…»): ignóralo, no actualices. Si la
primera línea respondió «No such file or directory», o `$SB --version` dice
«command not found», no la tienes instalada en ese sitio; usa esta otra línea,
que la descarga de internet la primera vez (tarda un poco):

```bash
SB="npx --yes supabase@2.117.0"
```

y vuelve a probar `$SB --version`: también debe decir `2.117.0`. (Las dos vías
se probaron al revisar esta guía; si ninguna responde `2.117.0`, detente y pide
ayuda.)

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

Tarda alrededor de medio minuto. Va diciendo «Applying migration …» por cada
archivo. El aviso `no files matched pattern: supabase/seed.sql` es normal. Al
final dice «Finished supabase db reset on branch main.»: ese «main» es una
etiqueta de la herramienta de Supabase, **no** la rama de git (tú sigues en
`feature/agenda-v2`). Puede recrear los contenedores con imágenes nuevas de
Docker; también es normal. Si en algún momento sale «ERROR», detente.

> ⚠️ Escribe siempre `--local`. Nunca `--linked` ni `--db-url`.

Comprueba cuántas migraciones quedaron:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select count(*), max(version) from supabase_migrations.schema_migrations"
```

Debe responder `45|20261123140000`: las 5 de `main` más las 40 de la agenda
(las 16 de los bloques A a F, las 4 de las correcciones de seguridad, las 4 de
la tanda de diseño, duración y horarios, las 3 de la tanda H, las 7 de la tanda
I, las 3 de la tanda J y las 3 de la tanda K).

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

> Si algún día corres las pruebas automáticas (Playwright), éstas apagan los
> interruptores de las dos clínicas de la semilla y vuelven a sembrar al
> empezar: **borran lo que hiciste a mano** (aviso de §1.1). Después repite P7
> si hizo falta y P8, y vuelve a crear el tipo «Consulta» (bloque D, «Antes de
> empezar») y tus enlaces.

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
  (`99900000NN`) y correo (`paciente.NN@semilla.spinus.test`). Y uno más del
  Dr. Admin, **«Hugo Interián Canché»** (9990000026, **sin citas**), para probar
  la búsqueda con acentos y en cualquier orden (T1-1).
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

> **Cambió el 2026-11-15 (tanda H):** con la v2 y una duración de la consulta clara, el hueco del panel de Día es una fila de turnos: se pulsa un turno, no el tramo, y la burbuja propone la duración de la consulta (H4-6, H4-7). Apagada, igual que antes.

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
> una tarjeta pequeña de lectura con botones (F22). Para editar, pulsa el
> engrane «Configuración de la cita» (arriba, junto a la ✕; en una cita «Por
> ligar» o un evento sin paciente sigue también «Editar»). Y **pulsar un hueco** abre una burbuja de alta
> rápida (F21); para el formulario completo, «Más opciones».

### B1. La pantalla de configuración

> **Cambió el 2026-11-15 (tanda H):** la pantalla va en **pestañas** (Primeros pasos, Horario y disponibilidad, Duración y tipos de cita, Enlaces de reserva, Plazos y recordatorios, Contactos bloqueados, Este dispositivo y, para el administrador, Restablecer): ya no hay grupos con rótulo; sólo se ve la sección de la pestaña elegida (H2-1). Los botones llevan borde y fondo sin pasar el ratón (H2-3).

**Qué hago:** pulso el engrane de la barra de la agenda (sólo el dibujo, sin
texto; al pasar el ratón dice «Configuración de la agenda»).

**Qué debo ver:** se abre «Configuración del calendario», con «‹ Agenda» para
volver. Arriba, mientras te falte algo para recibir reservas, la tarjeta «Para
empezar» (T2-1). Debajo, cuatro grupos con su rótulo:
- **Horario y disponibilidad:** «Horario de la clínica» y «Disponibilidad por
  consultorio»;
- **Citas:** «Tipos de cita»;
- **Reserva por enlace:** «Enlaces de reserva» (una ficha por médico), «Plazos
  y recordatorios» y «Contactos bloqueados»;
- **Preferencias de este dispositivo:** «Tarjeta de la cita», con la casilla
  «Abrir la tarjeta al pasar el ratón» (T3-6).

**Si falla, significa que…** el interruptor no se leyó (sigues viendo el
modal viejo «Horario de consulta») o la pantalla nueva no carga.

### B2. Los cuatro ajustes de la clínica

> **Cambió el 2026-11-15 (tanda H):** abre antes la pestaña «Plazos y recordatorios». Arriba está el interruptor «Recordatorio automático por correo», APAGADO de fábrica, y debajo de cada ajuste una línea que explica qué hace (H2-4).

**Qué hago:** en «Plazos y recordatorios» cambio «Recordatorio por
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

> **Cambió el 2026-11-15 (tanda H):** además, la Dra. Invitada y la secretaria ven el interruptor del recordatorio deshabilitado y no tienen la pestaña «Restablecer» (H2-5, H2-8).

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

> **Cambió el 2026-11-14:** la sección se llama «Duración y tipos de cita» y arriba pregunta «¿Cuánto dura tu consulta?» (G2-1); la Dra. Invitada también crea, cambia y archiva los SUYOS (G2-3, G2-9), nunca los de toda la clínica. La duración de la consulta de cada médico es un tipo «Consulta» suyo: si el Dr. Admin ya contestó la duración, su «Consulta» de 30 min aparece en la lista.

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

> **Cambió el 2026-11-14:** con la v2 la configuración ya no tiene «Horario de la clínica»: cada consultorio dice su horario en una línea (G2-8), y la agenda se dibuja con el horario de TODOS los consultorios a la vista, no sólo el activo (G4-2 a G4-4). «Usar horario propio» / «Usar el de la clínica» siguen.

**Qué hago:** como **Dra. Invitada**, en «Disponibilidad por consultorio», en
«Rehabilitación (ficticio)» pulso «Usar horario propio». Pongo el lunes de
08:00 a 12:00 y «Guardar horario». Después «Usar el de la clínica» para
dejarlo como estaba (o déjalo para comprobarlo en D13).

**Qué debo ver:** «Disponibilidad guardada», la fila dice «Horario propio» y
«08:00 – 12:00». Al volver: «Ahora usa el horario de la clínica», y la fila
dice sólo «Usa el horario de la clínica» (ya no repite las siete líneas).
**Cambió el 2026-11-13:** mientras tiene horario propio, la rejilla de la
agenda de la Dra. Invitada **pinta ese horario** (de 12:00 en adelante, el
lunes sale en gris) y los avisos de fuera de horario lo usan; detalle en T2-5.
Los turnos del enlace de reserva también lo usan.

**Si falla, significa que…** la disponibilidad por consultorio no se guarda.

### B7. El horario de la clínica no acepta horas al revés

**Qué hago:** como **Dr. Admin**, con la v2 **apagada** (P8 con `false`; desde
el 2026-11-14 la configuración con la v2 ya no tiene «Horario de la clínica»),
engrane de la agenda → «Horario de consulta». Pongo el cierre del lunes a las 07:00 (antes de la apertura). «Guardar
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
2. Pulso otra cita con paciente → engrane «Configuración de la cita». Busco la papelera.
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

El Google simulado no tiene pantalla: se maneja con comandos cortos. Hacen
falta **dos terminales**, las dos en `~/proyectos/app_ortointegra-agenda`.

> ⚠️ **Antes de nada, detén la app del puerto 3000** (Ctrl+C en su terminal).
> Mientras el Google simulado esté conectado, la app del 3000 (la de P11)
> intentaría hablar con el Google de verdad con llaves falsas. Para estas
> pruebas se usa sólo la app del puerto **3002**, que arranca el propio
> programa del Google simulado.

**Terminal 1 — el Google simulado y la app del 3002.** Un solo comando:

```bash
npx tsx scripts/google-falso-manual.ts
```

Primero dice «Google simulado en http://127.0.0.1:4555/ y órdenes en
http://127.0.0.1:4556 (Clínica Semilla A conectada).» y «Arrancando la app en
http://localhost:3002 (puede tardar un par de minutos)…». Cuando la app está
lista, dice «Lista: abre http://localhost:3002/agenda. Deja esta ventana
abierta; Ctrl+C para terminar.» y se queda corriendo.

Esto **conecta la Clínica Semilla A** a un Google de mentira (como si el Dr.
Admin hubiera conectado su cuenta) y levanta la app en el puerto 3002, la única
que habla con ese Google de mentira. No hay que copiar nada más ni cambiar
ninguna configuración.

Si en vez de eso dice:
- «el puerto 3002 ya está en uso…»: hay otra app en el 3002 (quizá de otra
  terminal). Ciérrala y repite.
- «No encontré la Clínica Semilla A o al Dr. Admin: siembra primero (P6).»:
  siembra (P6) y repite.
- «la app del 3002 no respondió…» o «…se cerró»: algo falló al arrancar la app;
  el detalle queda en el archivo `test-results/google-falso-manual-next.log`.
  Pide ayuda con ese archivo.

Abre **http://localhost:3002/agenda** (la sesión del 3000 vale aquí). La v2
tiene que estar encendida (P8). La primera vez que abras cada pantalla tarda
(se compila en el momento): puede tardar uno o dos minutos.

**Al terminar las pruebas de C y de D11, pulsa Ctrl+C en la terminal 1** y
espera a que diga «Listo: app del 3002 parada, conexión de prueba borrada y
base como estaba.» (unos segundos; puede salir debajo de la línea donde ya
puedes escribir, y es normal). Eso deshace todo lo del Google simulado: quita
la conexión de la Clínica A, borra los eventos que entraron desde Google y
suelta de él las citas de Spinus que se le mandaron. Lo que hiciste a mano en
la agenda (citas nuevas, cancelaciones) se queda, como en cualquier prueba, y
la bitácora de auditoría no se borra (la limpieza le deja sus renglones
normales). Si alguna vez se cierra de golpe (por ejemplo, si se apaga la
computadora), la próxima vez que lo arranques dice «Paré la app del 3002 que
dejó una sesión anterior cerrada de golpe.», quita la conexión vieja y sigue.
En ese caso puede quedarse en la agenda algún evento de Google ya cancelado;
desaparece la próxima vez que siembres (P6).

**Terminal 2 — las órdenes al Google simulado.** Aquí escribirás comandos
como éste:

```bash
curl -s 127.0.0.1:4556/lista
```

Muestra los eventos del Google simulado, uno por renglón: su código (por
ejemplo `falso3x` o `google5`), si está vivo (`confirmed`) o borrado
(`cancelled`), el título, la hora de Mérida y el principio de la descripción.
Si no hay ninguno, dice «(sin eventos)». Las demás órdenes (cambia las fechas
por las de tu semana, en formato AAAA-MM-DD, y el código por el que viste en
`/lista`):

| Para… | Comando | Responde |
|---|---|---|
| crear un evento «como en Google» | `curl -sG 127.0.0.1:4556/crear --data-urlencode "titulo=Junta en Google" -d dia=2026-11-19 -d hora=12:00 -d min=60` | `creado google5` (su código) |
| crear una serie que se repite | lo mismo con `-d veces=3` | `creado …` |
| crear con descripción | añade `--data-urlencode "descripcion=Notas de Google"` | `creado …` |
| mover un evento | `curl -sG 127.0.0.1:4556/mover -d id=falso3x -d dia=2026-11-19 -d hora=17:00 -d min=30` | `movido` |
| cambiar su título | `curl -sG 127.0.0.1:4556/titulo -d id=falso3x --data-urlencode "texto=Otro título"` | `título cambiado` |
| cambiar su descripción | `curl -sG 127.0.0.1:4556/descripcion -d id=falso3x --data-urlencode "texto=Otra nota"` | `descripción cambiada` |
| borrarlo | `curl -sG 127.0.0.1:4556/borrar -d id=falso3x` | `borrado (queda cancelado en Google)` |
| que Spinus vuelva a leer Google ya | `curl -s 127.0.0.1:4556/ya` y luego **recarga la agenda** (F5) | `listo: la próxima recarga de la agenda vuelve a leer Google` |
| Google caído (para G3) | `curl -s 127.0.0.1:4556/caido` | `Google CAÍDO (responde 503 al leer)` |
| Google lento (para G4) | `curl -sG 127.0.0.1:4556/lento -d ms=8000` | `Google LENTO (8000 ms al leer)` |
| Google normal otra vez | `curl -s 127.0.0.1:4556/normal` | `Google normal` |
| fingir cuándo fue la última lectura buena (para G1–G5) | `curl -sG 127.0.0.1:4556/ultima -d seg=120` | `última lectura buena de Google: hace 120 s` |
| ver la lista de órdenes | `curl -s 127.0.0.1:4556/ayuda` | la lista |

Si una orden responde `ERROR: …`, el texto dice qué faltó (por ejemplo «no hay
ningún evento «falso9x» (mira /lista)» o «faltan datos: dia=AAAA-MM-DD,
hora=HH:MM…»). Si `/ya` o `/ultima` responden «todavía no hay lectura de
Google: abre una vez http://localhost:3002/agenda y repite la orden», abre la
agenda del 3002 una vez y repite.

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

> **Resuelto el 2026-11-13.** Un evento creado en Google ya se puede
> **convertir en cita** desde su tarjeta («Convertir en cita»): pruebas T3-2 a
> T3-4 (§8-bis).

Si vas a seguir con el bloque D11 (§6), deja la terminal 1 corriendo. Si no:
Ctrl+C en la terminal 1 (espera el «Listo…») y vuelve a arrancar la app del
3000 (P11).

---

## 5. Bloque D — Reserva por enlace

**Antes de empezar:** app del **3000** (P11), v2 encendida (P8), aviso aprobado
(P7) y el tipo «Consulta» activo (B4). Mailpit abierto (§1.5).

Si no hiciste B4, o si volviste a sembrar después (sembrar borra los tipos de
cita), este comando crea «Consulta» (30 minutos, toda la clínica) sin pasar por
la pantalla; si ya existe, no hace nada:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -c "insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo) select id, 'Consulta', 30, true from public.clinicas c where c.nombre = 'Clínica Semilla A' and not exists (select 1 from public.tipos_cita t where t.clinica_id = c.id and t.nombre = 'Consulta' and t.activo);"
```

Responde `INSERT 0 1` (lo creó) o `INSERT 0 0` (ya estaba).

### D0. Crear el enlace fijo del Dr. Admin

> **Cambió el 2026-11-14:** sin duración de la consulta, el recuadro ámbar dice «Para que tu enlace abra, falta:» con la pregunta «¿Cuánto dura tu consulta?» ahí mismo (G2-2), no «Un tipo de cita». Cada enlace lleva una píldora (Activo / Sin usar / No abrirá / Sin horarios), G2-5.

**Qué hago:** como **Dr. Admin**, engrane → «Enlaces de reserva». En su bloque,
«Crear enlace fijo». Pulso «Copiar».

**Qué debo ver:** el subtítulo «Cada médico tiene los suyos. Quien tenga un
enlace puede agendar en un horario libre; sólo lo tiene a quien se lo mandes.»
y una ficha por médico, la tuya primero («Dr. Admin Semilla Uno (tú)»). Sin
enlace, la ficha dice «Aún no hay enlace fijo: se comparte una vez y sirve
siempre.». Si falta el tipo «Consulta», sale un recuadro ámbar «Para que el
enlace abra, falta: Un tipo de cita.» (T2-1). Al crear, «Enlace fijo creado» y una dirección del tipo
`http://localhost:3000/reservar/<22 letras y números>`. Al copiar, el botón
dice «Copiado». Si recargas, la dirección se esconde: «Mostrar enlace» la
vuelve a enseñar.

**Si falla, significa que…** no se pueden emitir enlaces. Si sale «La reserva
por enlace no está configurada en este servidor: no se pueden emitir
enlaces.», falta `RESERVA_SECRETO` en `.env.local`.

### D1. Reservar con el enlace fijo, eligiendo consultorio

> **Cambió el 2026-11-15 (tanda H):** los pasos se llaman **«Lugar»**, «Día y hora», «Tus datos» y «Listo»; la página siempre empieza en «Lugar»; «Volver» es un botón con borde abajo, junto al botón azul, en cada paso después del primero, y al volver no se pierde nada salvo la casilla del aviso (H1-1). Las páginas y los correos van siempre en claro (H1-3).

> **Cambió el 2026-11-14:** la página va por pasos («Qué y dónde», «Día y hora», «Tus datos», «Listo»): el consultorio es una tarjeta con su dirección (no un desplegable), «Tipo de cita» sólo sale con más de un tipo válido en ESE consultorio (G1-3), los horarios van por día en «Mañana» y «Tarde», y tras elegir hora hay que pulsar «Continuar». Los textos de los botones son los mismos (G1-1 a G1-5).

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

> **Cambió el 2026-11-15 (tanda H):** el enlace de un solo uso no pide código, pero **sí pide correo**: sin él no se puede reservar (H1-5).

**Qué hago:** como Dr. Admin, en «Enlaces de reserva», escribo en «Etiqueta
(opcional)» «Para Beto» y pulso «Emitir enlace de un solo uso». Copio la
dirección. En incógnito nueva reservo con «Beto Reserva Dos», 5512345602,
`beto2@prueba.test`. Después abro **otra vez** el mismo enlace.

**Qué debo ver:** la fila «Un solo uso · Para Beto» con «caduca el {fecha}» (7
días) y la nota «Uno de un solo uso vale 7 días y una sola reserva.». Al reservar, el botón dice
«Reservar cita» y **no pide código** al correo. La segunda vez: «Este enlace ya
no está disponible» con «Para agendar, comunícate con el consultorio:
{teléfono}.».

**Si falla, significa que…** un enlace de un solo uso sirve dos veces.

### D4. El código del correo

> **Cambió el 2026-11-15 (tanda H):** en «Revisa tu correo» hay «Volver» (H1-1).

**Qué hago:** con el enlace fijo, en incógnito nueva, llego al paso del código
con `caro3@prueba.test`. Escribo un código equivocado. Luego cinco
equivocados seguidos. Luego «Enviar otro código» y uso el nuevo.

**Qué debo ver:** con uno malo, «El código no es correcto.». Al quinto malo,
«Demasiados intentos con ese código. Pide otro.». Con el código nuevo de Mailpit
sí reserva. (Si te topas con «Demasiados intentos. Espera un rato y vuelve a
probar.», es el límite por hora: §1.6.)

**Si falla, significa que…** alguien podría adivinar el código probando.

### D5. Dos personas eligen el mismo horario

> **Cambió el 2026-11-14:** los turnos van en rejilla fija desde la apertura (G2-6), y quien llega segundo vuelve a «Día y hora» con «Ese horario se acaba de ocupar. Elige otro.» (G1-5).

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

> El texto no cambió con las correcciones de seguridad. Lo que cambió es **qué
> se mira**: «una cita activa» se decide por el **correo verificado**, no por
> el teléfono. Con el correo de Ana sale este mensaje; con el teléfono de Ana y
> otro correo, se reserva (lo comprueba SEG-A2).

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

> **Cambió el 2026-11-15 (tanda H):** el registro rápido trae «Teléfono celular o WhatsApp», vacío: no se precarga el teléfono de quien reservó (H3-3).

**Qué hago:** en otra cita «Por ligar» → «Editar» → «Iniciar consulta» →
«Registrar paciente nuevo». Intento «Crear y continuar» sin marcar el aviso.
Luego lo marco.

**Qué debo ver:** «Registrar paciente» con el nombre y el correo de quien
reservó ya puestos. Sin la casilla «Paciente informado del aviso de
privacidad»: «Debes marcar el consentimiento del aviso de privacidad.». Con
ella, se crea y se abre la nota (no la guardes).

**Si falla, significa que…** se crean pacientes sin consentimiento (prohibido).

### D12. Los horarios respetan la disponibilidad y los ajustes

> **Cambió el 2026-11-14:** los turnos salen de la apertura del consultorio con paso igual a la duración de la consulta; uno tocado en parte por otra cita no se ofrece (G2-6).

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

**Antes de empezar:** el Google simulado con su app del **3002** corriendo (C0,
terminal 1), v2 encendida, aviso aprobado, tipo «Consulta» y un enlace fijo del
Dr. Admin. El
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

Al terminar: Ctrl+C en la terminal 1 del Google simulado (espera el
«Listo…»), y arranca otra vez la app del 3000 (P11).

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

> **Cambió el 2026-11-14:** la página de confirmación lleva el marco de Spinus (G1-6): mismos botones y mensajes, con la fecha en grande; vale también para E3.

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

> **Cambió el 2026-11-14:** el «¿Seguro?» sale como aviso ámbar y «Volver» es un enlace centrado; «Sí, cancelar mi cita», en rojo (G1-6).

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

> **Cambió el 2026-11-14:** «Estás reagendando tu cita del …» sale como aviso azul encima de los pasos de la reserva.

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

> **Cambió el 2026-11-15 (tanda H):** el recordatorio viene **APAGADO de fábrica**: antes de disparar la tarea, enciéndelo (H2-5). Apagado no sale ninguno (H2-6).

> **Cambió el 2026-11-14:** el correo empieza con la franja «Spinus», se titula «Recordatorio de tu cita» y trae dos botones; «No podré asistir» abre directo el «¿Seguro?» (G1-7). El correo de confirmación que se manda desde la agenda (G3-1) es otro: se titula «Confirma tu cita» y no quita este recordatorio.

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

> **Cambió el 2026-11-15 (tanda H):** añade un caso: con el interruptor del recordatorio apagado (H2-6), tampoco sale.

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
(agendada). En la tarjeta (o en el engrane «Configuración de la cita»), pulso
«Enviar confirmación» (desde el 2026-11-14 se llama así; «Enviar recordatorio»
si la cita ya está confirmada; lleva el logo verde de WhatsApp).

**Qué debo ver:** se abre una pestaña de WhatsApp (`wa.me/5219990000005…`) con
el mensaje ya escrito: «Hola. Le escribimos del consultorio de Dr. Admin Semilla
Uno. Su cita es el {fecha} a las {hora} en {consultorio}. Para confirmar o
avisar que no podrá asistir: {enlace}». **No envíes nada**: cierra la pestaña.
El botón pasa a «Abierto en WhatsApp hh:mm». No va el nombre del paciente ni
nada clínico. **Desde el 2026-11-13** el botón sólo aparece cuando el mensaje
se puede mandar: no en una cita cancelada, atendida, de «no asistió», de todo el
día, que ya pasó o sin teléfono (T1-6); y si aun así falla, dice el motivo
(T1-7). Abrir la cita sin pulsar el botón no crea nada.

**Si falla, significa que…** el mensaje sale con datos de más o no se puede
mandar.

### E11. WhatsApp desde «Por confirmar»

> **Cambió el 2026-11-15 (tanda H):** «Sin teléfono» ya no existe. Arriba sale «Estos pacientes están pendientes de confirmar su cita. Envía un recordatorio.» y cada fila dice hora y consultorio y ofrece lo que se puede mandar: «WhatsApp», «Correo», o «Marcar como confirmada» si no hay ninguno (H4-1 a H4-3). La lista se actualiza sola (H4-4).

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

(Si no estás en la terminal de Ubuntu de Windows, sino en un Linux normal, usa
`xdg-open e2e/resultados/F/comparativa/index.html`. Esa carpeta no viaja con
git: sólo existe en la computadora donde se hicieron las capturas; si el
comando dice que no la encuentra, salta este paso.)

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

### F5. «Compactar» al abrir — APAGADO, decidido por ti

> **Cambió el 2026-11-14:** con la v2 el botón se llama «Compactar la rejilla al horario de los consultorios» y compacta al horario de los consultorios a la vista (G4-2); apagada, como siempre.

**Qué hago:** abro la agenda. Luego pulso «Compactar» a mano.

**Qué debo ver:** al abrir, «Compactar» está **apagado** y el domingo se ve.
Esta mejora quedó **apagada a propósito**: encendida costaba unos 20 ms más al
abrir y el presupuesto decía «no empeorar». **Lo decidiste el 2026-11-13: se
queda apagada** (`COMPACTAR_AL_ABRIR = false` en
`src/lib/agenda/ventanaRejilla.ts`). Al pulsarlo a mano: desaparece el domingo y aparece la
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

> **Cambió el 2026-11-15 (tanda H):** si ya no quedan citas de hoy en adelante esa semana (el domingo, por ejemplo), la lista abre **al final**, no en el lunes (H5-2).

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

**Qué hago:** abro una cita con paciente (con la v2, el engrane «Configuración de la cita» de su tarjeta).

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

> **Cambió el 2026-11-15 (tanda H):** (1) un hueco del panel de Día con duración clara es una fila de turnos y la burbuja propone la duración de la consulta (H4-6); (2) entre el horario y los botones aparece «+ Añadir observaciones» (H3-4); (3) «Registrar «…»» sale en verde y el registro rápido trae teléfono (H3-1, H3-3); (4) un doble clic en «Crear y continuar» ya no cierra la burbuja (H3-2).

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
2. «Se agendó correctamente» y, **desde el 2026-11-13, la burbuja no se
   cierra**: dice «Cita agendada» y ofrece «Enviar confirmación» (WhatsApp),
   «Por correo» (el correo de Spinus, G3-1), «Invitar por correo» (sólo con
   Google conectado), «Listo» y «Más opciones» (T1-8).
   «Listo» la cierra.
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
«Evento» de Google (si tienes alguno de C9). Desde el 2026-11-13, además, dejar
el ratón quieto sobre una cita abre su tarjeta sola (T3-5; 0,5 s desde el
2026-11-14).

> **Cambió el 2026-11-14:** los botones dependen del estado de la cita y ya no
> hay «Editar» en una cita con paciente (el engrane «Configuración de la cita»
> abre el formulario): ver G3-4 y G3-5. «Reagendar cita» de una cancelada o
> «no asistió» crea una cita NUEVA. Lo de abajo vale para la por ligar y el
> evento sin paciente, que conservan «Editar».

**Qué debo ver:** una tarjeta con el paciente, el estado, la hora, el médico, el
consultorio, el teléfono y la nota, y los botones «Iniciar consulta» (sólo el
médico de la cita), «Confirmar» (si está agendada), «Reagendar» (abre el
formulario con el foco en la fecha), «Cancelar cita» (pregunta antes), «Editar»
y «Enviar por WhatsApp» (sólo si la cita lo admite: T1-6). En un evento sin
paciente sólo «Editar» y «Eliminar evento»; si el evento nació en Google, también
«Convertir en cita» (T3-2). Lo de Google en sólo lectura no abre nada. Escape la cierra y el foco
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

## 8-bis. Tanda tras tus primeras pruebas a mano (2026-11-13)

Lo que se cambió por tus 16 puntos, en tres grupos: **T1** búsqueda, burbuja,
ventanas que no se salen de la pantalla y WhatsApp; **T2** la configuración
guiada; **T3** el engrane, convertir en cita, la tarjeta al pasar el ratón y la
elevación. Todo detrás del interruptor de la v2, **salvo T1-1** (la búsqueda del
formulario completo era un defecto y sale también con la v2 apagada).

**Antes de empezar:** v2 encendida en la Clínica A (P8), aviso aprobado (P7),
la app del 3000 (P11). Recién sembrado no hay tipos de cita ni enlaces (T2
empieza justo así). Cada prueba se comprobó con una prueba automática que hace
lo mismo (entre paréntesis, su archivo en `e2e/`).

### T1-1. Buscar un paciente por nombre y apellido, en cualquier orden (también con la v2 apagada)

**Qué hago:** pulso «Agendar» y en «Paciente» escribo «Hugo Interián». Luego
borro y pruebo «interian hugo», «HUGO» y «canche». Al final, «Hugo Prueba».

**Qué debo ver:** en los cuatro primeros casos aparece «Hugo Interián Canché»
(paciente de la semilla, del Dr. Admin, sin citas). Con «Hugo Prueba» no
aparece nadie, sólo «Registrar "Hugo Prueba"». Igual con la v2 apagada (P8 con
`false`). (`agenda-t1-busqueda`)

**Si falla, significa que…** la búsqueda sigue comparando el texto entero
contra el nombre o contra los apellidos, o no ignora los acentos.

### T1-2. Lo mismo en la burbuja

**Qué hago:** con la v2 encendida, clic en un hueco libre de la semana; en la
burbuja escribo «interian hugo».

**Qué debo ver:** «Hugo Interián Canché» en la lista; al elegirlo queda escrito
en el campo. (`agenda-t1-busqueda`)

**Si falla, significa que…** la burbuja no usa la búsqueda nueva.

### T1-3. Registrar un paciente nuevo desde la burbuja

> **Cambió el 2026-11-15 (tanda H):** el registro rápido trae «Teléfono celular o WhatsApp» y la leyenda «Sin teléfono ni correo no se podrán enviar confirmaciones ni recordatorios de cita.»; repítela también con doble clic en «Crear y continuar» (H3-2, H3-3).

**Qué hago:** en la burbuja escribo un nombre que no exista («Zoila Prueba
Nueva») y elijo «Registrar «Zoila Prueba Nueva»», al final de la lista. En la
ventana «Registrar paciente» pulso «Crear y continuar» SIN marcar el aviso de
privacidad; luego lo marco y pulso otra vez.

**Qué debo ver:** la primera vez, «Debes marcar el consentimiento del aviso de
privacidad.»; la segunda, la ventana se cierra y en la burbuja queda elegida
«Zoila Prueba Nueva», con el cursor en «Guardar». (`agenda-t1-burbuja`)

**Si falla, significa que…** la burbuja no ofrece crear paciente, o se saltó el
consentimiento (**grave: avísame**).

### T1-4. La burbuja al fondo de la pantalla

**Qué hago:** en Semana (o en la tableta, «3 días»), clic en la última franja
que se ve abajo; si avisa de fuera de horario, «Aceptar». En la burbuja escribo
«Prueba» para que salga la lista.

**Qué debo ver:** la burbuja se abre entera dentro de la pantalla (sube o se
pone al lado); al salir la lista sigue entera dentro, y si no cabe todo se puede
bajar DENTRO de la burbuja hasta «Guardar». En la tableta, al abrirse el
teclado, la burbuja sube a lo que queda visible. (`agenda-t1-capas`)

**Si falla, significa que…** la burbuja no se recoloca al crecer o no mira la
parte visible de la pantalla.

### T1-5. La tarjeta al fondo de la pantalla

**Qué hago:** en una ventana baja (o el portátil), clic en una cita de abajo del
todo; en el teléfono, toco una cita de la lista.

**Qué debo ver:** la tarjeta entera dentro de la pantalla (en el teléfono, la
hoja de abajo, sin cortarse). (`agenda-t1-capas`)

**Si falla, significa que…** la tarjeta no se acota a la ventana.

### T1-6. WhatsApp sólo cuando aplica

> **Cambió el 2026-11-14:** el botón se llama «Enviar confirmación» («Enviar recordatorio» si la cita está confirmada), y si falla el motivo sale debajo de las acciones.

**Qué hago:** abro una cita de la semana PASADA (agendada), una atendida, una
cancelada y una futura de un paciente con teléfono (p. ej. «Paciente Prueba
05» la semana que viene).

**Qué debo ver:** sólo en la futura aparece «Enviar por WhatsApp» (con el logo
verde). En las otras no hay botón. (`agenda-t1-burbuja`)

**Si falla, significa que…** la pantalla no usa la misma regla que el servidor.

### T1-7. Si aun así sale el error, dice por qué

**Qué hago:** abro la tarjeta de una cita futura con teléfono; en otra pestaña
la cancelo; vuelvo a la primera y pulso «Enviar por WhatsApp».

**Qué debo ver:** debajo del botón, «La cita está cancelada.» (o «La cita ya
pasó.» si pasó). No se abre WhatsApp. (`agenda-t1-burbuja`)

**Si falla, significa que…** el servidor no manda el motivo o el botón no lo lee.

### T1-8. Después de agendar desde la burbuja

> **Cambió el 2026-11-14:** «Cita agendada» ofrece «Enviar confirmación» (WhatsApp) y «Por correo» lado a lado, «Invitar por correo» a todo el ancho si hay Google, y «Más opciones» | «Guardar» abajo; debajo de la hora, la de la zona del consultorio si difiere (G3-1, G3-3, G3-10).

**Qué hago:** clic en un hueco, elijo «Paciente Prueba 05» y «Guardar».

**Qué debo ver:** la burbuja **no se cierra**: dice «Cita agendada»; debajo
«Enviar por WhatsApp» (logo verde) y, si la clínica tiene Google conectado
(Google simulado arrancado, C0), «Invitar por correo»; abajo «Listo» (azul,
con el cursor) y «Más opciones», del mismo ancho. «Listo» cierra; «Más
opciones» abre la edición de esa cita; «Invitar por correo» abre «Invitar por
correo» y cierra la burbuja. Sin Google conectado no sale «Invitar por correo».
La invitación **ya no se abre sola** encima de la burbuja (desde «Agendar», el
formulario completo, sí, como antes). (`agenda-t1-burbuja`)

**Si falla, significa que…** la burbuja no recibe la cita creada.

### T2-1. «Para empezar» y lo que falta para el enlace

> **Cambió el 2026-11-15 (tanda H):** la configuración va en pestañas; la ficha de la Dra. Invitada está plegada bajo «Enlaces de los demás médicos» (H2-1, H2-2).

> **Cambió el 2026-11-14:** ahora es «Primeros pasos», con barra y «N de 3 listos» (horario de cada consultorio, duración de la consulta, enlace), y ya no existe «Crear «Consulta», 30 min»: la duración se contesta con «¿Cuánto dura tu consulta?». Haz G2-1 y G2-2 en su lugar.

**Qué hago:** recién sembrado, como **Dr. Admin**, abro el engrane.

**Qué debo ver:** arriba, la tarjeta «Para empezar» con «1 de 3»: «Horario y
disponibilidad · Hecho», «Tipos de cita · Pendiente» y «Enlace de reserva ·
Pendiente», cada pendiente con su «Ir». En «Enlaces de reserva», en mi ficha
(«Dr. Admin Semilla Uno (tú)») y en la de la Dra. Invitada, un recuadro ámbar
«Para que el enlace abra, falta: Un tipo de cita.» con el botón «Crear
«Consulta», 30 min». Lo pulso: «Tipo de cita «Consulta» creado», los dos
recuadros desaparecen, el paso 2 pasa a «Hecho» y en «Tipos de cita» aparece
«Consulta 30 min · Toda la clínica». Pulso «Crear enlace fijo» en mi ficha: la
tarjeta «Para empezar» desaparece. Recargo: sigue sin salir.
(`agenda-configuracion-guiada`)

**Si falla, significa que…** la pantalla vuelve a dejar crear un enlace que no
abre sin decirlo, o la lista guía no se calcula de los datos.

### T2-2. La Dra. Invitada no puede crear el tipo — **te toca decidir**

> **Cambió el 2026-11-15 (tanda H):** la ficha de la Dra. Invitada está plegada: pulsa antes «Enlaces de los demás médicos» (H2-2).

> **Cambió el 2026-11-14:** **ya lo decidiste**: la invitada crea, cambia y archiva SUS tipos y su duración (G2-3, G2-9). Esta prueba ya no aplica.

**Qué hago:** sin tipos de cita (recién sembrado, o archívalos), entro como
**Dra. Invitada** y abro el engrane.

**Qué debo ver:** en su ficha, «Un tipo de cita.» y «Pídele a quien administra
la clínica que cree uno.» (sin botón). En «Para empezar», el paso 2 dice lo
mismo.

**Si falla, significa que…** se le ofrece algo que la base le va a rechazar.

> **Para que lo decidas.** Pediste que cada médico prepare su enlace. El médico
> invitado no puede crear tipos de cita: lo impide una regla de la base (sólo
> quien administra la clínica los crea). Cambiarla es tocar una regla de
> seguridad de la base y no se hizo. Si quieres que el invitado pueda crear sus
> propios tipos, pídelo como tarea aparte.

### T2-3. El enlace que no abrirá lo dice

**Qué hago:** como **Dr. Admin**, sin tipos, creo el enlace fijo de la Dra.
Invitada y lo copio. Lo abro en una ventana de incógnito. Luego creo
«Consulta» y, como Dra. Invitada, pongo su consultorio con horario propio y
todos los días cerrados. Recargo la configuración como Dr. Admin.

**Qué debo ver:** primero, bajo «Enlace fijo» de la Dra. Invitada, en ámbar:
«No abrirá: no hay un tipo de cita para este médico.»; en incógnito, «Este
enlace ya no está disponible» (el paciente no ve el motivo). Después: «Abrirá
sin horarios: ningún consultorio del médico tiene días abiertos.».
(`agenda-configuracion-guiada`)

**Si falla, significa que…** la pantalla y la página pública usan reglas
distintas.

### T2-4. Cada médico, su ficha

**Qué hago:** abro el engrane como Dr. Admin, como Dra. Invitada y como
secretaria.

**Qué debo ver:** el Dr. Admin, dos fichas (la suya primero, «(tú)»); la Dra.
Invitada, sólo la suya y sin nombre encima; la secretaria, las dos.
(`agenda-configuracion-guiada`)

**Si falla, significa que…** alguien ve o gestiona el enlace de otro médico sin
ser administrador ni secretaria.

### T2-5. La agenda pinta el horario propio del consultorio

> **Cambió el 2026-11-14:** lo sustituye G4: el gris y los avisos dicen «este consultorio atiende…», y con «Todos los médicos» el gris es la unión de los consultorios, no el de la clínica (G4-2 a G4-4).

**Qué hago:** como **Dra. Invitada**, pongo «Rehabilitación (ficticio)» con
horario propio, lunes de 08:00 a 12:00. Voy a la agenda. Intento agendar el
lunes a las 13:00.

**Qué debo ver:** el lunes, de 12:00 en adelante, en gris de fuera de horario;
al guardar a las 13:00, el aviso «Vas a agendar a las 13:00, y esta clínica
atiende de 08:00 a 12:00. ¿Es correcto?». Con la v2 apagada, el gris vuelve a
empezar a las 18:00 y no hay aviso a las 13:00. Como Dr. Admin con «Todos los
médicos», el gris es el de la clínica. (`agenda-configuracion-guiada`)

**Si falla, significa que…** la rejilla y el enlace vuelven a contradecirse.

### T2-6. Un médico con un consultorio en otra zona (qué se ve; sin cambio)

> **Cambió el 2026-11-14:** lo que aquí era «resto conocido» ya no ocurre: con Tijuana activo, el blanco es 11:00–13:00 de Mérida y la tarjeta de las 11:00 cae dentro, sin aviso al arrastrarla a su sitio (G4-5).

**Qué hago:** creo para el Dr. Admin un consultorio en Tijuana con horario
propio de 09:00 a 11:00 (en Mi perfil, zona «Baja California») y reservo por su
enlace el primer turno.

**Qué debo ver:** el enlace ofrece 09:00, 09:30, 10:00 y 10:30 (hora de
Tijuana). El comprobante y el recordatorio dicen «09:00» con «(zona horaria:
Baja California)»; la página de confirmación, «… 09:00 h (hora estándar del
Pacífico)». En la agenda, en una computadora de Mérida, la tarjeta sale a las
**11:00** con la etiqueta «09:00 hora Baja California». Si ese consultorio es
el activo, la banda gris dice que atiende de 09:00 a 11:00 **de Mérida**, así
que la tarjeta de las 11:00 cae fuera: **es un resto conocido, anotado en
`DEUDA_TECNICA.md` AG-DT-31**, no un fallo nuevo. (`husos-dos-consultorios`)

**Si falla, significa que…** el correo o la confirmación no usan la zona del
consultorio.

### T2-7. La pantalla, ordenada (escritorio y teléfono, claro y oscuro)

> **Cambió el 2026-11-15 (tanda H):** la pantalla va en pestañas: repítela recorriendo cada pestaña, en claro y oscuro (H2-1, H2-3).

**Qué hago:** abro la configuración en la computadora y en el teléfono (§1.7),
en claro y en oscuro.

**Qué debo ver:** cuatro grupos con su rótulo, las tarjetas del mismo ancho y
alineadas, los botones del mismo alto; en el teléfono el botón «Editar
horario» baja bajo el texto en vez de apretarlo; un consultorio con el horario
de la clínica dice «Usa el horario de la clínica» sin repetir el horario.
(`agenda-f-simetria`)

### T3-1. El engrane ya no dice «Horario»

**Qué hago:** con la v2 encendida, como Dr. Admin, en una pantalla ancha, paso
el ratón por el engrane de arriba a la derecha y lo pulso. Luego en el
teléfono.

**Qué debo ver:** sólo el dibujo del engrane, sin la palabra «Horario»; al
dejar el ratón encima, «Configuración de la agenda». Al pulsarlo llego a
«Configuración del calendario». En el teléfono, el mismo botón con el mismo
nombre. Con la v2 apagada, como antes: «Configurar horario de consulta» y el
formulario «Horario de consulta» (X2). (`agenda-configuracion`)

**Si falla, significa que…** el botón no se enteró de que la v2 está encendida.

### T3-2. Convertir en cita un evento que creé en Google

> **Cambió el 2026-11-15 (tanda H):** su registro rápido trae el teléfono (H3-3).

**Qué hago:** con el Google simulado arrancado (C0), creo en él un evento
«Junta con representante» para mañana a las 13:00 con la descripción «traer
muestras» (como en C6: `/crear … --data-urlencode "descripcion=traer
muestras"`). `/ya` y recargo la agenda del 3002. Pulso el evento.

**Qué debo ver:** la tarjeta ofrece «Editar», «Convertir en cita» y «Eliminar
evento». Pulso «Convertir en cita»: me pide «Paciente», «Consultorio» y (si
hay) «Tipo de cita»; también puedo registrar un paciente nuevo («Registrar
«…»» en la lista o «Registrar paciente nuevo»), que pide el aviso de
privacidad. Busco «Prueba 22», elijo «Paciente Prueba 22», dejo el consultorio
que propone y pulso «Convertir en cita». La agenda dice «Cambios guardados» y
la tarjeta ya es la cita de Paciente Prueba 22 (con «Cancelar cita», no
«Eliminar evento»). En `/lista`, el evento se llama ahora «Cita médica:
Paciente Prueba 22» y su descripción ya no dice «traer muestras» (eso se quedó
como nota en Spinus). (`agenda-convertir-google`, `agenda-google-dos-sentidos`)

**Si falla, significa que…** la conversión no llegó a la base, o a Google viajó
algo de más (las notas) o de menos (el nombre).

### T3-3. Google ya no le cambia el nombre a la cita convertida

**Qué hago:** después de T3-2, en el Google simulado cambio el título del
evento a «Otra cosa» (`/titulo`). `/ya` y recargo.

**Qué debo ver:** en Spinus la cita sigue siendo de Paciente Prueba 22, con su
nota «traer muestras»; en `/lista` el título vuelve a «Cita médica: Paciente
Prueba 22». (`agenda-google-dos-sentidos`)

**Si falla, significa que…** la regla de que el título de una cita con paciente
no se acepta desde Google no se aplica a las convertidas.

### T3-4. Sólo los eventos de Google se convierten

**Qué hago:** pulso «Cirugía programada» (un evento creado en Spinus).

**Qué debo ver:** su tarjeta ofrece «Editar» y «Eliminar evento», sin
«Convertir en cita». (`agenda-convertir-google`)

**Si falla, significa que…** se ofrece convertir lo que no pide el plan.

### T3-5. La tarjeta al dejar el ratón quieto

**Qué hago:** en una computadora con ratón, dejo el ratón quieto sobre una cita
medio segundo, sin pulsar (desde el 2026-11-14: 0,5 s, antes 1 s).

**Qué debo ver:** se abre su tarjeta junto a la cita. Si muevo el ratón dentro
de la cita antes del segundo, tarda otro segundo. Si quito el ratón, se cierra;
si lo llevo a la tarjeta, se queda. Si pulso la cita, se queda fija (ya no se
cierra al quitar el ratón; Escape o la ✕ la cierran). Si arrastro una cita o
estiro su borde, no sale ninguna tarjeta (y si había una, se cierra). Al
escribir en el buscador con la tarjeta abierta, el cursor no salta a la
tarjeta. (`agenda-f-tarjeta-al-pasar`)

**Si falla, significa que…** el tiempo, el cierre o la prioridad del clic no
quedaron como pediste.

### T3-6. Apagar la tarjeta al pasar el ratón

> **Cambió el 2026-11-15 (tanda H):** la casilla está en la pestaña «Este dispositivo» (H2-1).

**Qué hago:** en «Configuración del calendario» → «Preferencias de este
dispositivo» → «Tarjeta de la cita», desmarco «Abrir la tarjeta al pasar el
ratón». Vuelvo a la agenda y dejo el ratón quieto sobre una cita.

**Qué debo ver:** no se abre nada; al pulsar la cita, sí. En otro navegador o en
otra computadora sigue encendida (es de este dispositivo).
(`agenda-f-tarjeta-al-pasar`)

**Si falla, significa que…** la preferencia no se guarda o la agenda no la lee.

### T3-7. En el teléfono, sólo el toque

**Qué hago:** en el teléfono abro la agenda y toco una cita.

**Qué debo ver:** la hoja de la cita, como antes. Nada se abre solo.
(`agenda-f-tarjeta-al-pasar`)

### T3-8. Las citas suben un pelo al pasar el ratón

**Qué hago:** paso el ratón despacio por varias citas en Semana y en Mes.

**Qué debo ver:** cada una sube 3 px (desde el 2026-11-14; antes 1 px) con una
sombra suave y el borde un poco más marcado, sin rebote, y baja al salir; la
sombra aparece sin animarse. Nunca el recuadro negro del navegador (G3-9). Los bloques grises de Google de sólo lectura no suben. Con «Reducir
movimiento» del sistema activado, nada se mueve. Con la v2 apagada, nada se
mueve. (`agenda-f-pasar-raton`)

**Si falla, significa que…** la elevación se salió de lo pedido.

---

## 8-ter. Tanda de diseño, duración y horarios (2026-11-14)

Lo que se hizo con tu mensaje del 2026-11-14, en cuatro grupos: **G1** el
aspecto de las páginas públicas (reservar y confirmar) y de los correos; **G2**
la duración de la consulta, los turnos en rejilla fija y la configuración;
**G3** el correo de confirmación de Spinus, los botones de aviso y la tarjeta
por estados; **G4** los consultorios heredan el horario de la clínica y la
agenda se dibuja con el horario de cada consultorio. Todo detrás del
interruptor de la v2.

**Antes de empezar:** base con las **29** migraciones (P5), sembrada (P6),
aviso aprobado (P7), v2 encendida en la Clínica A (P8), la app del 3000 (P11).
Recién sembrado no hay tipos de cita ni enlaces. Cada prueba se comprobó con
una prueba automática que hace lo mismo (entre paréntesis, su archivo en
`e2e/`).

### G1 · Las páginas públicas y los correos

#### G1-1. La reserva por pasos, con la dirección siempre a la vista

> **Cambió el 2026-11-15 (tanda H):** la primera rayita dice **«Lugar»**, no «Qué y dónde» (H1).

**Qué hago:** como Dr. Admin, en la configuración contesto «¿Cuánto dura tu
consulta?» con 30 min y agrego un tipo «Primera vez» de 45 min; copio mi
enlace fijo y lo abro en el teléfono (o en el navegador muy estrecho, §1.7).

**Qué debo ver:** arriba, la banda azul oscuro con el logo de Spinus y mi
tarjeta (iniciales, nombre y especialidad). Debajo, cuatro rayitas: «Qué y
dónde», «Día y hora», «Tus datos», «Listo». En el primer paso, cada
consultorio es una tarjeta con su dirección entera («Calle Ficticia 1, Centro,
Mérida»), y abajo los dos tipos con su duración, sin ninguno marcado: «Elegir
día y hora» no se puede pulsar hasta elegir uno («Elige el tipo de cita para
continuar»). Al pulsarlo, arriba queda un resumen con el consultorio y su
dirección; sigue ahí en «Tus datos» y en la pantalla final.
(`reserva-g1-diseno`)

**Si falla, significa que…** el paciente podría ir al consultorio equivocado o
no sabe en qué paso va.

#### G1-2. Un solo tipo de cita: el bloque no aparece

> **Cambió el 2026-11-15 (tanda H):** con un solo consultorio la página **ya no empieza en «Día y hora»**: empieza en «Lugar» con él marcado y «Elegir día y hora» listo (H1-4).

**Qué hago:** archivo «Primera vez» y vuelvo a abrir el enlace.

**Qué debo ver:** en el primer paso ya no sale «Tipo de cita»; sólo los
consultorios. (Si además dejo un solo consultorio activo, la página empieza
directamente en «Elige día y hora», con el consultorio y su dirección en el
resumen.) (`reserva-g1-diseno`)

**Si falla, significa que…** el paciente tiene que «elegir» algo que no tiene
alternativa.

#### G1-3. Sólo los tipos del consultorio elegido (tu punto 5)

**Qué hago:** como Dr. Admin, con su duración de 30 min, en «Disponibilidad
por consultorio», fila «Hospital Norte (ficticio)», pulso «Otra duración en
este consultorio», elijo 45 min y guardo. Abro su enlace. Elijo «Consultorio
Centro (ficticio)» y luego «Hospital Norte (ficticio)».

**Qué debo ver:** en ningún momento salen dos «Consulta». Con sólo la duración
(sin tipos de más), no hay bloque «Tipo de cita» en ninguno de los dos, y al
pasar a «Día y hora» los turnos del Centro van de 30 en 30 y los del Norte de
45 en 45. Si agrego «Primera vez» y la vuelvo a abrir: en el Centro, «Consulta
· 30 min» y «Primera vez»; en el Norte, «Consulta · 45 min» y «Primera vez». Si
elijo la «Consulta» del Centro y cambio al Norte, no queda ninguna marcada; si
elijo «Primera vez», sigue marcada al cambiar. (`reserva-tipos-consultorio`)

**Si falla, significa que…** la página ofrece un tipo que no vale en ese
consultorio (y el paciente acabaría en un error).

#### G1-4. Día y hora: tira de fechas, mañana y tarde

**Qué hago:** en «Día y hora» miro la tira de siete días.

**Qué debo ver:** los días sin horario (el domingo, por ejemplo) se ven
apagados y no se pueden pulsar; los demás llevan un puntito verde. Al tocar un
día sólo salen sus horarios, separados en «Mañana» y «Tarde», en cuadros del
mismo tamaño. Las fechas dicen «Lunes, 16 de noviembre» con «de» en minúscula
(nunca «16 De Noviembre»). Abajo, lo elegido y «Continuar».
(`reserva-g1-diseno`)

**Si falla, significa que…** el paciente se pierde en una lista larga o elige
un día sin horario.

#### G1-5. Estados de la reserva

> **Cambió el 2026-11-15 (tanda H):** tras el aviso rojo del 409, al volver a «Tus datos» lo escrito sigue ahí (H1-2).

**Qué hago:** (a) abro el enlace con la red muy lenta (§1.7, «Slow 3G»); (b)
pruebo un enlace de un solo uso ya usado; (c) reservo el mismo horario desde
dos pestañas.

**Qué debo ver:** (a) mientras carga, la tira y los cuadros en gris que laten;
(b) «Este enlace ya no está disponible» con el teléfono y «Llamar al
consultorio»; (c) la segunda vuelve a «Día y hora» con el aviso rojo «Ese
horario se acaba de ocupar. Elige otro.» y la lista ya sin ese horario.
(`reserva-g1-diseno`)

**Si falla, significa que…** el paciente no sabe qué pasó o vuelve a intentar
un horario ocupado.

#### G1-6. La página de confirmación con el mismo aspecto

> **Cambió el 2026-11-15 (tanda H):** la confirmación sale en claro también con el teléfono en modo oscuro (H1-3).

**Qué hago:** abro el enlace de confirmación de un comprobante.

**Qué debo ver:** la misma banda azul con el logo y mi nombre (sin
especialidad). «Tu cita», el día en azul y la fecha en grande («16 de
noviembre · 08:00 h»), y un recuadro con Consultorio, Dirección completa y
Teléfono. «Confirmo mi asistencia» (azul) y «No podré asistir» (con borde). Al
pulsar «No podré asistir», un aviso ámbar «¿Seguro…?» y «Sí, cancelar mi
cita» en rojo, y «Volver» como enlace centrado. Tras confirmar, un aviso
verde; tras cancelar, uno rojo y «Elegir otro horario». (`reserva-g1-diseno`)

**Si falla, significa que…** el paciente duda de que la página sea del
consultorio, o cancela sin querer.

#### G1-7. Los correos con la marca

> **Cambió el 2026-11-15 (tanda H):** los correos piden ir en claro (H1-3); Gmail y Outlook del teléfono pueden oscurecerlos por su cuenta.

**Qué hago:** en Mailpit (§1.5) abro el código, el comprobante, un
recordatorio y una confirmación (G3-1), en ancho de teléfono y con las
imágenes bloqueadas.

**Qué debo ver:** los cuatro empiezan con la franja azul oscuro y «Spinus» en
blanco (texto, no imagen); un título claro, la fecha en grande, un recuadro con
médico, consultorio, dirección completa y teléfono, y botones anchos que se
pueden tocar con el dedo. El código va en grande. El recordatorio se titula
«Recordatorio de tu cita» y trae «Confirmo mi asistencia» y «No podré
asistir»; la confirmación se titula «Confirma tu cita» (o «Tu cita» si ya está
confirmada) y **no dice «Recordatorio»**. Nada cambia con las imágenes
bloqueadas. Ninguno dice el tipo de cita ni nada clínico.
(`reserva-g1-diseno`, `agenda-g3-correo`, `correosCita.test`)

**Si falla, significa que…** el correo parece sospechoso, no se lee bien en el
teléfono, o la confirmación de días antes habla de un recordatorio.

#### G1-8. Modo oscuro y movimiento reducido

> **Cambió el 2026-11-15 (tanda H):** con el teléfono en modo oscuro, la reserva y la confirmación se ven **en claro** (H1-3); el movimiento reducido no cambia.

**Qué hago:** pongo el teléfono en modo oscuro y abro el enlace; luego activo
«Reducir movimiento».

**Qué debo ver:** la reserva y la confirmación en oscuro, legibles. Al pasar de
paso, un fundido corto; con «Reducir movimiento», sin animación.
(`reserva-g1-diseno`)

**Si falla, significa que…** la página deslumbra de noche o marea a quien
pidió menos movimiento.

### G2 · Duración de la consulta, turnos y configuración

#### G2-1. Primeros pasos en orden, con avance

> **Cambió el 2026-11-15 (tanda H):** la configuración va en pestañas: al abrir está elegida «Primeros pasos · 2 pendientes» (H2-1).

**Qué hago:** recién sembrado, entro como Dr. Admin y abro «Configuración de
la agenda».

**Qué debo ver:** arriba «Primeros pasos» con una barra y «1 de 3 listos»: 1
Horario de cada consultorio (con palomita y los nombres de sus consultorios),
2 «Duración de la consulta» con «¿Cuánto dura tu consulta?» (30 min, 45 min,
1 hora, Otra), 3 «Enlace de reserva» con «Crear enlace». A la izquierda (en el
teléfono, arriba) el menú de secciones con «Primeros pasos · 2 pendientes». En
ningún sitio «Crear «Consulta», 30 min». (`agenda-configuracion-guiada`)

**Si falla, significa que…** el orden o el avance no salen de los datos.

#### G2-2. Crear el enlace sin haber contestado la duración

**Qué hago:** pulso «Crear enlace» del paso 3.

**Qué debo ver:** en la misma tarjeta «Para que tu enlace abra, falta:» con UNA
sola pregunta de duración; elijo 45 min y «Guardar y crear el enlace»: aviso
«Enlace fijo creado» y la tarjeta desaparece. (`agenda-configuracion-guiada`)

**Si falla, significa que…** crear el enlace vuelve a ser un callejón sin
salida.

#### G2-3. La invitada pone su duración

**Qué hago:** entro como medico.a (Dra. Invitada Semilla Dos), en el paso 2
elijo «1 hora» y «Guardar».

**Qué debo ver:** el paso queda hecho; en «Duración y tipos de cita»: «Tu
consulta dura 60 min, en todos tus consultorios», con «Cambiar duración».
(`agenda-configuracion-guiada`)

**Si falla, significa que…** la base no deja a la invitada crear lo suyo (o le
deja más).

#### G2-4. Otra duración sólo en un consultorio

**Qué hago:** como medico.a, con su duración general de 1 hora (G2-3), en
«Disponibilidad por consultorio», fila «Rehabilitación (ficticio)», pulso
«Otra duración en este consultorio», elijo «45 min» y Guardar.

**Qué debo ver:** «Aquí la consulta dura 45 min (en los demás, 60 min)», con
«Cambiar» y «Usar la general». (`agenda-configuracion-guiada`)

**Si falla, significa que…** la duración por consultorio no se guarda o se ve
en otro sitio.

#### G2-5. Cada enlace dice si funciona

> **Cambió el 2026-11-15 (tanda H):** la ficha de la Dra. Invitada está plegada: pulsa antes «Enlaces de los demás médicos (1)» (H2-2).

**Qué hago:** como Dr. Admin, creo un enlace fijo para la Dra. Invitada cuando
ella aún no tiene duración.

**Qué debo ver:** su fila con la píldora «No abrirá», «No abrirá: falta la
duración de la consulta del médico.» y «Completar»; al pulsarlo, la pregunta
«¿Cuánto dura su consulta?» ahí mismo. (`agenda-configuracion-guiada`)

**Si falla, significa que…** la clínica no se entera de que un enlace no abre.

#### G2-6. Turnos de 45 minutos desde la apertura

> **Cambió el 2026-11-15 (tanda H):** la ficha de la Dra. Invitada está plegada: pulsa antes «Enlaces de los demás médicos (1)» (H2-2).

**Qué hago:** con duración de 45 min y el consultorio de 9:00 a 13:00, abro el
enlace de reserva en un día libre.

**Qué debo ver:** 9:00, 9:45, 10:30, 11:15 y 12:00. Si creo una cita de 10:00
a 10:20 ese día, desaparece sólo 9:45 (no aparece un 10:20). (`agenda-g2-turnos`)

**Si falla, significa que…** los turnos se cuentan otra vez desde cada hueco.

#### G2-7. El clic en la agenda cae en el turno

**Qué hago:** como medico.a (duración 45 min; Rehabilitación de 9:00 a 17:00,
con horario propio), en Semana hago clic a las 10:00 de un día libre. Luego
arrastro una cita suya de las 13:00 una hora abajo.

**Qué debo ver:** la burbuja dice 09:45 (el turno más cercano: 9:00, 9:45,
10:30…); si escribo 10:00 a mano en «Inicio», se queda 10:00. La cita
arrastrada queda a las 14:15. Como Dr. Admin con «Todos los médicos»,
arrastrar esa misma cita de la Dra. Invitada también la deja a las 14:15 (la
rejilla de ELLA); un clic con «Todos» no se ajusta (no hay un consultorio
claro). Con la v2 apagada, todo como antes (10:00 y 14:00).
(`agenda-g2-turnos`)

**Si falla, significa que…** el ajuste no se aplica, o se aplica también a lo
escrito a mano.

#### G2-8. Ya no está el horario de la clínica

**Qué hago:** abro la configuración con la v2 encendida.

**Qué debo ver:** no hay «Horario de la clínica» ni «Editar horario»; cada
consultorio dice su horario en una línea («Lun–vie 08:00 – 18:00 · Sáb 08:00 –
13:00»). Con la v2 apagada, el engrane de la agenda abre el «Horario de
consulta» de siempre. (`agenda-configuracion`)

**Si falla, significa que…** volvió el acceso que pediste quitar.

#### G2-9. La invitada cambia su duración y archiva sus tipos

**Qué hago:** como medico.a, en «Duración y tipos de cita», pulso «Cambiar
duración», elijo 45 min y Guardar; luego «Archivar» en su «Consulta».

**Qué debo ver:** «Tu consulta dura 45 min» y después la fila «Archivado» con
«Reactivar»; ningún aviso de «pídele a quien administra». En la duración de su
consultorio, «Cambiar» y «Usar la general». No ve «Editar» en los tipos de toda
la clínica. (`agenda-configuracion-guiada`, `g2b_tipos_cita_update.sql`)

**Si falla, significa que…** la invitada sigue en sólo lectura o puede tocar lo
que no es suyo.

### G3 · Correo de confirmación, avisos y tarjeta

#### G3-1. Confirmación por correo sin Google

**Qué hago:** sin Google conectado, agendo desde la burbuja una cita futura de
«Paciente Prueba 13» (tiene correo). En «Cita agendada» pulso «Por correo».
Abro Mailpit.

**Qué debo ver:** un correo a `paciente.13@semilla.spinus.test` con asunto
«Confirma tu cita del …»: la franja «Spinus», el título «Confirma tu cita», día,
hora (con la zona), «Dr. Admin Semilla Uno», el consultorio con su dirección y
los botones «Confirmo mi asistencia» y «No podré asistir» (el enlace empieza
por `http://localhost:3000/confirmar/`). Nada del motivo, las notas ni el nombre
del paciente. En la burbuja, debajo de los botones: «Enviado por correo
hh:mm». (`agenda-g3-correo`, `agenda-t1-burbuja`)

**Si falla, significa que…** el correo propio de Spinus no sale sin Google o
lleva algo de más.

#### G3-2. No se manda dos veces

**Qué hago:** abro esa misma cita → engrane «Configuración de la cita» →
«Enviar confirmación por correo».

**Qué debo ver:** «Ya se envió por correo a las hh:mm.» y ningún correo nuevo
en Mailpit. Si la reagendo a otro día, sí puedo volver a mandarlo.
(`agenda-g3-correo`)

**Si falla, significa que…** el límite de envíos no está puesto.

#### G3-3. Con Google, el correo y la invitación

**Qué hago:** con Google (simulado, C0) conectado, agendo desde la burbuja.

**Qué debo ver:** «Enviar confirmación», «Por correo» e «Invitar por correo»
(esta última a todo el ancho). «Por correo» manda el correo de Spinus;
«Invitar por correo» abre la invitación de Google como antes.
(`agenda-t1-burbuja`)

**Si falla, significa que…** se perdió una de las dos formas de avisar.

#### G3-4. La tarjeta de una cita agendada

**Qué hago:** pulso una cita agendada futura de «Paciente Prueba 05».

**Qué debo ver:** arriba el nombre con la píldora «Agendada» en la misma línea,
el engrane y la ✕; debajo el día y la hora y la duración; Médico y Consultorio;
«Iniciar consulta» (azul, a todo el ancho); «Confirmar» y «Reagendar» lado a
lado, del mismo tamaño; «Enviar confirmación» con el logo de WhatsApp a todo
el ancho; una raya y «Cancelar cita» en rojo, al centro. No hay «Editar»: el
engrane abre el formulario. (`agenda-g3-tarjeta`)

**Si falla, significa que…** la tarjeta no sigue tu maqueta.

#### G3-5. Confirmada, atendida, cancelada, no asistió

**Qué hago:** pulso una cita confirmada, una atendida, una cancelada y una
«no asistió».

**Qué debo ver:** confirmada: «Reagendar» y «Enviar recordatorio» (en dos
líneas) lado a lado. Atendida: sólo «Ver expediente» (lleva al expediente; la
secretaria no lo ve). Cancelada y no asistió: sólo «Reagendar cita», que abre
**«Nueva cita»** con el paciente, el médico, el consultorio y la duración ya
puestos y el cursor en la fecha; al guardar aparece una cita nueva y la
cancelada (o la falta) sigue en la agenda tal cual. (`agenda-g3-tarjeta`)

**Si falla, significa que…** se está reabriendo la cita vieja y se pierde el
registro de la falta.

#### G3-6. Una atendida ya no se mueve

**Qué hago:** arrastro una cita atendida a otra hora.

**Qué debo ver:** vuelve a su sitio con el aviso «Una cita atendida ya
concluyó: no se puede cambiar de fecha ni de hora.» En el formulario puedo
cambiar sus notas, o su estado a «Agendada» si se marcó por error (sólo si no
tiene nota clínica, G3-7). (`agenda-g3-tarjeta`)

**Si falla, significa que…** el servidor acepta lo que la tarjeta ya no ofrece.

#### G3-7. Una atendida con nota no se desmarca

**Qué hago:** como Dr. Admin inicio la consulta de una cita de «Paciente
Prueba 05», guardo la nota, vuelvo a la agenda y, en el formulario de esa
cita, la pongo en «Agendada».

**Qué debo ver:** «Esta cita ya tiene una nota clínica: sigue como atendida y
no puede cambiar de estado.»; con la v2 apagada, lo mismo; tampoco se puede
eliminar. Una atendida SIN nota (marcada a mano) sí se puede corregir.
(`agenda-g3-tarjeta`)

> ⚠️ Esta prueba deja una **nota real** sobre un paciente de la semilla: la
> siguiente siembra (y la siguiente corrida de pruebas automáticas) se negará a
> borrarla. Hazla al final, y después P5.

**Si falla, significa que…** se puede desmarcar o borrar una cita cuya nota ya
es expediente.

#### G3-8. El formulario con los dos avisos

**Qué hago:** engrane de una cita agendada futura de un paciente con teléfono
y correo.

**Qué debo ver:** bajo «Avisar al paciente», «Enviar confirmación» (logo de
WhatsApp) y «Enviar confirmación por correo» (sobre). En una confirmada:
«Enviar recordatorio» y «Enviar recordatorio por correo».
(`agenda-g3-tarjeta`)

**Si falla, significa que…** falta uno de los dos avisos donde se edita la
cita.

#### G3-9. Sin el aviso negro al pasar el ratón

**Qué hago:** dejo el ratón quieto sobre varias citas (Semana y Mes).

**Qué debo ver:** a los 0,5 s se abre la tarjeta de Spinus; nunca el recuadro
negro del navegador con «Nombre · Agendada». Al pasar, la cita sube 3 px con
una sombra suave (la sombra aparece sin animarse). Con la v2 apagada, el
recuadro negro sigue como antes y nada sube. (`agenda-f-pasar-raton`,
`agenda-f-tarjeta-al-pasar`)

**Si falla, significa que…** volvió el aviso del navegador o el movimiento no
es el pedido.

#### G3-10. La hora del consultorio en otra zona

**Qué hago:** pulso una cita en un consultorio de otra zona (G4-5) y agendo una
desde la burbuja en ese consultorio.

**Qué debo ver:** en la tarjeta y en «Cita agendada», debajo de la hora,
«09:00–09:30 hora Baja California». (`agenda-g3-tarjeta`, `capasAgenda.test`)

**Si falla, significa que…** el personal confunde la hora del paciente con la
suya.

### G4 · La agenda con el horario de los consultorios

**Preparación de G4:** en la configuración, Consultorio Centro (Dr. Admin) de
lunes a viernes 08:00–12:00; Hospital Norte (Dr. Admin) de lunes a viernes
15:00–19:00; Rehabilitación (Dra. Invitada) de lunes a viernes 10:00–14:00 y
sábado 09:00–13:00. Ve a una semana sin citas (cinco o seis semanas adelante).

#### G4-1. Cada consultorio que no tenía horario propio arranca con el de la clínica

**Qué hago:** antes de aplicar la migración 23 (§13.2), apunto el horario de la
clínica. La aplico (en tu base local la aplica P5). Abro la configuración con la
v2 encendida.

**Qué debo ver:** cada consultorio que decía «Usa el horario de la clínica»
tiene ahora un horario propio igual al de la clínica; el que ya tenía uno
propio, el mismo de antes. La rejilla del SQL Editor sale toda en OK (y una
fila INFO con cuántos se copiaron). Si la vuelvo a pegar, sale igual y no
cambia nada. (`agenda-g4-herencia-horario`)

> En tu base local, **después de sembrar** los consultorios de la semilla
> vuelven a decir «Usa el horario de la clínica» (AG-DT-66): la semilla los crea
> así. Da lo mismo para la agenda.

**Si falla, significa que…** la copia pisó un horario elegido o no se hizo.

#### G4-2. «Todos los médicos»: de la apertura más temprana al cierre más tardío

**Qué hago:** como Dr. Admin, filtro «Todos los médicos» en Semana y miro el
lunes. Pulso «Compactar la rejilla al horario de los consultorios».

**Qué debo ver:** blanco de 08:00 a 14:00 y de 15:00 a 19:00, gris entre 14:00
y 15:00 y fuera de eso (ya no el 08:00–18:00 de la clínica). Con «Compactar»,
la rejilla va de 08:00 a 19:00, el sábado se queda (Rehabilitación abre) y el
domingo se oculta. (`agenda-g4-rejilla-consultorios`)

**Si falla, significa que…** la agenda sigue leyendo el horario de la clínica.

#### G4-3. Un médico concreto: sus consultorios

**Qué hago:** filtro a la Dra. Invitada. Pulso «Compactar».

**Qué debo ver:** blanco de 10:00 a 14:00 entre semana; con «Compactar», de
09:00 (por el sábado) a 14:00, con el sábado y sin el domingo. Como Dr. Admin
filtrado a sí mismo y SIN consultorio activo elegido: la unión de Centro y
Norte (blanco 08–12 y 15–19). (`agenda-g4-rejilla-consultorios`)

**Si falla, significa que…** la rejilla mezcla médicos o toma uno solo.

#### G4-4. El consultorio activo manda en el gris, los huecos y la hora de apertura

> **Cambió el 2026-11-15 (tanda H):** si el Dr. Admin tiene su duración de la consulta puesta, el hueco «15:00 – 19:00» sale partido en turnos (H4-6); el tramo es el mismo.

**Qué hago:** como Dr. Admin elijo «Hospital Norte» como consultorio activo en
el menú lateral. Abro la agenda; luego paso a Día en un lunes sin citas.

**Qué debo ver:** la rejilla abre mostrando las 15:00 arriba; blanco sólo de
15:00 a 19:00; en Día, el panel «Huecos disponibles» ofrece un solo hueco
«15:00 – 19:00». (`agenda-g4-rejilla-consultorios`)

**Si falla, significa que…** el consultorio activo no llega a la rejilla.

#### G4-5. Un consultorio en otra zona: gris y aviso en la hora del consultorio

**Qué hago:** en una computadora con la hora de Mérida, creo para el Dr. Admin
un consultorio en Tijuana (zona «Baja California») con horario propio
09:00–11:00 todos los días y lo elijo como activo. Agendo una cita de 09:00 a
09:30 hora de Tijuana (o reservo ese turno por su enlace). Arrastro la cita una
hora abajo; luego otra hora más.

**Qué debo ver:** la tarjeta a las 11:00 con «09:00 hora Baja California»;
blanco de 11:00 a 13:00 (hora de Mérida) y la cita DENTRO del blanco. Al
moverla una hora (10:00 de Tijuana) no sale aviso. Al moverla a las 11:00 de
Tijuana sale «Vas a moverlo a las 11:00 hora Baja California, y este
consultorio atiende de 09:00 a 11:00. ¿Es correcto?». Pulsar en la rejilla a
las 11:30 de Mérida para agendar no da aviso. (`agenda-g4-husos`,
`husos-dos-consultorios`)

**Si falla, significa que…** el gris o el aviso vuelven a medirse en la hora
de la computadora (avisos falsos).

#### G4-6. Con la v2 apagada, todo como antes

**Qué hago:** apago la v2 (P8 con `false`) y abro la agenda.

**Qué debo ver:** el gris es el de la clínica (08:00–18:00), los avisos dicen
«esta clínica atiende…», el botón se llama «Compactar la rejilla al horario de
la clínica» y el engrane abre «Horario de consulta». (`agenda-vistas`,
`agenda-configuracion-guiada`)

**Si falla, significa que…** lo nuevo se coló sin el interruptor.

---

## 8-quater. Tanda H (2026-11-15)

Lo que se hizo con tus 23 puntos del 2026-11-15, en cinco grupos: **H1** la
reserva por enlace y la confirmación (volver en cada paso, siempre en claro, el
paso «Lugar», y el correo); **H2** la configuración en pestañas, los botones,
el recordatorio apagado de fábrica y «Restablecer»; **H3** la burbuja de alta
(«Registrar» en verde, ya no se cierra tras registrar, teléfono y
observaciones); **H4** «Por confirmar» en vivo y los huecos de Día en turnos;
**H5** una atendida con nota protegida también en la base, y la lista de Semana
del teléfono el domingo. Tu punto 21 ya está: AG-DT-63 se queda como está.
Todo detrás del interruptor de la v2, salvo H5-1 (también con la v2 apagada).

**Antes de empezar:** base con las **32** migraciones (P5), sembrada (P6),
aviso aprobado (P7), v2 encendida en la Clínica A (P8), la app del 3000 (P11).
Cada prueba se comprobó con una prueba automática que hace lo mismo (entre
paréntesis o en `e2e/agenda-h*` y `e2e/reserva-h1`), recorrida sobre la
integración.

### H1 · La reserva por enlace y la confirmación

#### H1-1. «Volver» en cada paso, sin perder nada

**Qué hago:** abro el enlace fijo del Dr. Admin en incógnito, en el teléfono. Elijo «Consultorio
Centro (ficticio)» y «Elegir día y hora». Pulso «Volver». Vuelvo a «Elegir día y hora», elijo una
hora y «Continuar». Escribo nombre, teléfono y correo, y pulso «Volver». «Continuar» otra vez. Marco
la casilla, «Enviar código a mi correo», y en «Revisa tu correo» pulso «Volver».

**Qué debo ver:** en «Lugar» no hay «Volver». En «Día y hora», «Tus datos» y «Revisa tu correo» hay un
botón «Volver» con borde, abajo a la izquierda junto al botón azul, siempre a la vista. Cada vez que
vuelvo, lo que había elegido sigue igual: el consultorio, el tipo, el día y la hora marcados, y mi
nombre, teléfono y correo escritos. La casilla del aviso vuelve sin marcar (hay que aceptarlo otra
vez).

**Si falla, significa que…** el paciente tiene que volver a escribir todo por equivocarse de hora, o
no encuentra cómo regresar.

#### H1-2. Al volver, el horario ya lo tomó otro

**Qué hago:** en una pestaña llego a «Tus datos» con una hora elegida y escribo mis datos. En otra
pestaña (otro enlace de un solo uso) reservo esa misma hora. En la primera pulso «Volver».

**Qué debo ver:** arriba, en rojo, «Ese horario ya no está disponible. Elige otro.»; la hora ya no
sale en la lista y «Continuar» está gris. Elijo otra hora, «Continuar», y mis datos siguen escritos.

**Si falla, significa que…** el paciente llega a enviar un horario que ya no existe, o pierde lo que
escribió.

#### H1-3. Siempre en claro

**Qué hago:** pongo el teléfono (o la computadora) en modo oscuro y abro mi enlace de reserva y el
enlace de confirmación de un comprobante. Luego, ya dentro de Spinus con el modo oscuro de la app
encendido, abro mi enlace desde «Configuración de la agenda» en la misma pestaña. Abro el comprobante
en Mailpit con el sistema en oscuro.

**Qué debo ver:** las páginas de reserva y de confirmación, y el correo, siempre en claro: fondo gris
muy claro, tarjeta blanca, letras oscuras, la banda azul oscuro arriba. Los campos del formulario,
blancos. (En Gmail del teléfono en modo oscuro el correo puede verse oscurecido: eso lo hace Gmail.)

**Si falla, significa que…** el paciente ve la página distinta según su teléfono o según cómo dejó el
médico su app.

#### H1-4. «Lugar» con un solo consultorio

**Qué hago:** como Dra. Invitada (un solo consultorio, «Rehabilitación (ficticio)»), con un solo tipo
de cita, copio mi enlace y lo abro en incógnito. Sigo hasta «Listo».

**Qué debo ver:** la primera rayita dice «Lugar» y la página empieza ahí (no salta a «Día y hora»): la
tarjeta «Rehabilitación (ficticio)» con «Calle Ficticia 3, Mérida», ya marcada, sin bloque «Tipo de
cita», y «Elegir día y hora» listo. En «Día y hora», «Tus datos» y «Listo», el consultorio y su
dirección siguen en el resumen.

**Si falla, significa que…** el paciente no ve a dónde va antes de elegir la hora.

#### H1-5. El correo sigue siendo obligatorio

**Qué hago:** con el enlace fijo intento reservar sin correo; luego emito un enlace de un solo uso
(«Para Beto») e intento lo mismo.

**Qué debo ver:** en los dos, el campo «Correo electrónico» es obligatorio: sin él no se puede
enviar. El fijo manda un código al correo; el de un solo uso reserva directo («Reservar cita») pero
**también pide un correo**.

**Si falla, significa que…** se puede reservar por el enlace fijo sin verificar el correo (reservas
falsas).

### H2 · La configuración de la agenda

#### H2-1. La configuración abre en «Primeros pasos» y va por pestañas

**Qué hago:** recién sembrado, entro como Dr. Admin y abro el engrane «Configuración de la agenda». Pulso las pestañas
de la izquierda una por una; con el teclado, me pongo en una pestaña y uso las flechas, Inicio y Fin.

**Qué debo ver:** a la izquierda (en el teléfono, arriba, en una fila que se desliza de lado) las pestañas «Primeros
pasos · 2 pendientes», «Horario y disponibilidad», «Duración y tipos de cita», «Enlaces de reserva», «Plazos y
recordatorios», «Contactos bloqueados», «Este dispositivo» y «Restablecer». Abre en «Primeros pasos» y sólo se ve esa
sección; al pulsar otra, sólo se ve la otra. Las flechas pasan de una a otra; Inicio y Fin, a la primera y la última.
«Revisar» o «Abrir horario» dentro de un paso me llevan a la pestaña de horario. Cuando ya no falta nada, la pestaña
«Primeros pasos» desaparece y la pantalla abre en «Horario y disponibilidad».

**Si falla, significa que…** las pestañas no cambian de sección, abren en la equivocada o no se manejan con el teclado.

#### H2-2. Los enlaces de los médicos invitados, plegados

**Qué hago:** como Dr. Admin, pestaña «Enlaces de reserva». Pulso «Enlaces de los demás médicos (1)». Después entro como
secretaria y abro la misma pestaña.

**Qué debo ver:** primero «Dr. Admin Semilla Uno (tú)» con su enlace; debajo, cerrado, «Enlaces de los demás médicos
(1)». Al pulsarlo aparece la ficha de la Dra. Invitada Semilla Dos. La secretaria ve abierta la del Dr. Admin y
plegada la de la Dra. Invitada. La Dra. Invitada ve sólo la suya, sin apartado plegado.

**Si falla, significa que…** las fichas de los invitados vuelven a salir todas abiertas, o la del administrador no va
primero.

#### H2-3. Los botones se ven como botones sin pasar el ratón

**Qué hago:** recorro todas las pestañas sin pasar el ratón por encima, en modo claro y en modo oscuro, como Dr. Admin
y como Dra. Invitada.

**Qué debo ver:** cada botón («Revisar», «Usar horario propio», «Editar», «Archivar», «Mostrar enlace», «Revocar»,
«Copiar», «Desbloquear», «30 min / 45 min / 1 hora / Otra», «Ver qué falta», «Enlaces de los demás médicos»…) tiene
borde y fondo propios, distintos de la tarjeta, también en claro. Los enlaces dentro de una frase («Mi perfil») siguen
subrayados.

**Si falla, significa que…** algún botón vuelve a verse como texto suelto hasta pasar el ratón.

#### H2-4. «Plazos y recordatorios» explica cada ajuste

**Qué hago:** pestaña «Plazos y recordatorios».

**Qué debo ver:** arriba el interruptor «Recordatorio automático por correo», APAGADO, con «Si lo enciendes, se
enviará un correo a cada paciente con correo registrado, 24 horas antes de su cita. Apagado (como viene de fábrica),
no se envía ninguno.» y «No cambia los demás correos: el código y el comprobante de la reserva por enlace, y la
confirmación que se manda con su botón, salen siempre.». Debajo de cada ajuste, una línea: el recordatorio («El
recordatorio es un correo que Spinus manda al paciente antes de su cita; aquí eliges cuántas horas antes.»), la
anticipación, hasta cuándo se puede reservar y la vigencia del enlace de un solo uso.

**Si falla, significa que…** falta la explicación de algún ajuste o el interruptor no está.

#### H2-5. Encender el recordatorio

**Qué hago:** como Dr. Admin pulso el interruptor. Recargo. Después entro como Dra. Invitada y como secretaria.

**Qué debo ver:** aviso «Recordatorio automático encendido» y el interruptor encendido también tras recargar. La Dra.
Invitada y la secretaria lo ven, pero deshabilitado.

**Si falla, significa que…** no se guarda, o alguien que no administra la clínica lo puede cambiar.

#### H2-6. Con el recordatorio apagado no sale ningún recordatorio; los demás correos sí

**Qué hago:** con el interruptor APAGADO, repito E8 (cita de «Paciente Prueba 05» dentro de unas 3 horas y la tarea a
mano). Luego reservo con un enlace (D) y, desde la tarjeta de una cita, mando «Enviar confirmación» (G3-1). Por último
enciendo el interruptor y vuelvo a correr la tarea.

**Qué debo ver:** apagado, la tarea responde `{"ok":true}` y en Mailpit NO llega «Recordatorio: tu cita del…»; el
código de la reserva, el comprobante y «Confirma tu cita» sí llegan. Encendido, llega el recordatorio.

**Si falla, significa que…** la tarea manda recordatorios a una clínica que no los encendió, o el interruptor apagó
también los otros correos.

#### H2-7. Restablecer la configuración

**Qué hago:** como Dr. Admin, con la duración de la consulta contestada, un enlace fijo y el recordatorio encendido,
pestaña «Restablecer» → «Restablecer configuración de la agenda». En el diálogo escribo «restablecer» en minúsculas;
luego «RESTABLECER» y pulso «Restablecer». Después miro la agenda.

**Qué debo ver:** el diálogo dice qué se restablece, en rojo «Los enlaces que ya compartiste con pacientes dejarán de
funcionar.» y «Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.»; el botón sólo se activa
con «RESTABLECER» exacto. Al confirmar: aviso «Configuración de la agenda restablecida», la pantalla vuelve a
«Primeros pasos · 2 pendientes» con «1 de 3 listos» (la duración y el enlace pendientes; el horario, hecho); en «Plazos y
recordatorios», 24/2/60/7 y el recordatorio apagado; en «Enlaces de reserva», sin enlaces (el que tenías ya no abre:
«Este enlace ya no está disponible»); en «Duración y tipos de cita», los tipos archivados. Las citas de la agenda
siguen todas igual. En «Horario y disponibilidad», cada consultorio dice «Horario propio» con el horario de la clínica
(lunes a viernes de 08:00 a 18:00 y sábado de 08:00 a 13:00 en la semilla): es el horario con el que arranca todo
consultorio en la agenda nueva, copiado a cada uno. La agenda pinta ese horario, no todo gris. *(Cómo queda el horario
tras restablecer es una decisión tuya pendiente: §6-bis de `mejora_agendaV2.md`, «Integración de la tanda H».)*

**Si falla, significa que…** el reinicio no deja la configuración de fábrica, toca citas, o se puede hacer sin escribir
la palabra.

#### H2-8. Sólo el administrador restablece

**Qué hago:** entro como Dra. Invitada y como secretaria.

**Qué debo ver:** no tienen la pestaña «Restablecer».

**Si falla, significa que…** alguien que no administra la clínica podría borrar su configuración.

### H3 · La burbuja de alta

#### H3-1. «Registrar» en verde

**Qué hago:** Clínica Semilla A, v2 encendida, Semana. Clic en una franja vacía; en la burbuja
escribo «Zoila Prueba Verde». Repito en modo oscuro.

**Qué debo ver:** al final de la lista, «Registrar «Zoila Prueba Verde»» y «Crear paciente
nuevo y continuar» en verde (no en gris ni azul); al bajar a ella con la flecha, el fondo se
pone verde claro y el texto se sigue leyendo bien. En oscuro, verde claro sobre azul oscuro.
(`agenda-h3-burbuja`)

**Si falla, significa que…** el estilo de la opción no cargó.

#### H3-2. La burbuja sigue abierta tras registrar, aunque haga doble clic

**Qué hago:** clic en el miércoles a las 14:30; escribo «Zoila Doble Clic» y elijo «Registrar…».
Marco el aviso de privacidad y hago DOBLE CLIC en «Crear y continuar».

**Qué debo ver:** la ventana se cierra y la MISMA burbuja sigue abierta, con «Nueva cita · mié …,
14:30–…», «Zoila Doble Clic» elegida y el cursor en «Guardar». No aparece otra burbuja a otra
hora. Repito con «Registrar…» y doble clic en «Cancelar»: la burbuja sigue, con lo que escribí
y el cursor en el campo de paciente. (`agenda-h3-burbuja`)

**Si falla, significa que…** el segundo clic se coló a la rejilla. Si se cierra con UN solo
clic, avísame: es otra causa.

#### H3-3. Teléfono en el registro rápido

**Qué hago:** desde la burbuja, «Registrar «Zoila Con Teléfono»». Escribo «99912» en «Teléfono
celular o WhatsApp», marco el aviso y pulso «Crear y continuar»; luego lo corrijo a 9991234567.

**Qué debo ver:** debajo del correo y el teléfono, «Sin teléfono ni correo no se podrán enviar
confirmaciones ni recordatorios de cita.». Con «99912», «El teléfono debe tener 10 dígitos» y no
se crea. Al teclear 9991234567 se ve «999 123 4567»; se crea y en su ficha (Pacientes) aparece
ese teléfono. Sin teléfono ni correo también se crea. Con la v2 apagada (Clínica Semilla B), el
registro rápido desde «Agendar» NO tiene teléfono ni leyenda; tampoco el de Documentos.
(`agenda-h3-burbuja`)

**Si falla, significa que…** el teléfono no se manda o el interruptor no lo esconde.

#### H3-4. Observaciones en la burbuja

**Qué hago:** clic en una franja vacía; elijo «Paciente Prueba 21»; pulso «Añadir observaciones»
y escribo «Trae estudios previos»; Guardar. En otra franja, escribo observaciones y pulso «Más
opciones».

**Qué debo ver:** al abrir la burbuja sólo se ve el enlace discreto «+ Añadir observaciones»; al
pulsarlo, el campo con el cursor dentro. La cita guardada muestra la nota en su tarjeta
(«Nota: Trae estudios previos»). Con «Más opciones», el formulario completo trae el texto en
«Notas». Con Google conectado, el evento de Google NO lleva el texto. (`agenda-h3-burbuja`,
`agenda-google-dos-sentidos`)

**Si falla, significa que…** las observaciones no se guardan o (grave: avísame) viajan a Google.

### H4 · «Por confirmar» y los huecos de Día

#### H4-1. La lista de mañana y su leyenda

**Qué hago:** como Dr. Admin, en escritorio, con la v2 encendida, pulso «Por
confirmar (N)».

**Qué debo ver:** arriba, «Estos pacientes están pendientes de confirmar su
cita. Envía un recordatorio.». Debajo, sólo las citas agendadas de mañana (no
las confirmadas): el nombre, la hora y el consultorio («09:00 · Consultorio
Centro (ficticio)»). Si no hay ninguna, «No hay citas de mañana sin
confirmar.» y sin leyenda.

**Si falla, significa que…** la lista no enseña lo que pidió Angel o enseña
citas que no tocan.

#### H4-2. Los avisos según lo que tenga el paciente

**Qué hago:** creo cuatro pacientes de prueba: uno con teléfono y correo, uno
sólo con teléfono, uno sólo con correo y uno sin ninguno, y a cada uno una cita
mañana. Abro «Por confirmar».

**Qué debo ver:** el primero con «WhatsApp» y «Correo»; el segundo, sólo
«WhatsApp»; el tercero, sólo «Correo»; el cuarto dice «Sin teléfono válido ni
correo.» y ofrece «Marcar como confirmada». Pulso «Correo» del tercero: «Enviado
por correo hh:mm» y el correo «Confirma tu cita del…» llega a Mailpit
(127.0.0.1:54324), sin nada clínico.

**Si falla, significa que…** la fila ofrece un aviso que no se puede mandar,
o esconde uno que sí.

#### H4-3. Marcar como confirmada a mano, sin cerrar el menú

**Qué hago:** en el cuarto paciente de H4-2 pulso «Marcar como confirmada».

**Qué debo ver:** la fila desaparece al momento y el menú sigue abierto; sale
«Estado cambiado a «Confirmada»». Si busco la cita en la agenda, ya está
confirmada, y en la auditoría hay un cambio de estado a mi nombre.

**Si falla, significa que…** la confirmación a mano no pasa por el mismo
camino que «Confirmar» de la tarjeta.

#### H4-4. El paciente confirma o cancela y la fila sale sola

**Qué hago:** con «Por confirmar» abierto, mando el WhatsApp a «Prueba 21»
(si tiene cita mañana) y, en otra ventana sin sesión, abro el enlace que trae
el mensaje y pulso «Confirmo mi asistencia». Con otra cita, abro su enlace y
cancelo («Sí, cancelar mi cita»). Luego, desde la sesión de la secretaria,
cancelo otra cita de mañana; y agendo una cita nueva para mañana.

**Qué debo ver:** sin cerrar ni volver a abrir el menú: la confirmada y las
canceladas desaparecen de la lista en uno o dos segundos; la cancelada por el
paciente aparece en «Canceladas por el paciente (48 h)» y el botón lleva el
contador rojo; la cita nueva aparece en la lista.

**Si falla, significa que…** la lista no escucha el tiempo real de la agenda.

#### H4-5. El punto rojo con pendientes

**Qué hago:** abro la agenda con al menos una cita agendada para mañana y sin
cancelaciones del paciente en las últimas 48 h. Luego confirmo todas las de
mañana.

**Qué debo ver:** junto a «Por confirmar (N)», un punto rojo pequeño sin número.
Al no quedar ninguna, «Por confirmar (0)» sin punto. Con una cancelada por el
paciente, el contador rojo con su número, como antes.

**Si falla, significa que…** la alerta no avisa de los pendientes o se perdió
la de las cancelaciones.

#### H4-6. Los huecos de Día en turnos

**Qué hago:** como la Dra. Invitada (un solo consultorio, «Rehabilitación»),
pongo su duración de la consulta en 45 min (configuración, «Duración de la
consulta») y el horario de Rehabilitación de 09:00 a 13:00. Agendo una cita de
10:00 a 10:20 un día libre. Paso a «Día» en ese día.

**Qué debo ver:** en «Huecos disponibles», dos huecos: «09:00 – 10:00» con un
botón «09:00», y «10:20 – 13:00» con «10:30», «11:15» y «12:00». No hay
«09:45» (la cita de 10:00 lo toca). Pulso «11:15»: se abre la burbuja «Nueva
cita · …, 11:15–12:00» (los 45 min de la consulta, no una hora). Como Dr. Admin, con «Todos los médicos», la tarjeta de
huecos no sale (como siempre); y sin duración de la consulta, los huecos son
los de antes (un botón por tramo).

**Si falla, significa que…** el panel no usa la rejilla del enlace de reserva.

#### H4-7. Un hueco de menos de una hora también sale si cabe la consulta

**Qué hago:** sigo con H4-6 (la Dra. Invitada con consulta de 45 min, la cita
de 10:00 a 10:20) y agendo otra cita ese mismo día de 11:15 a 13:00. Vuelvo a
«Día» en ese día.

**Qué debo ver:** en «Huecos disponibles», «10:20 – 11:15» (55 min, menos de
una hora) con un botón «10:30»; al pulsarlo, la burbuja «Nueva cita · …,
10:30–11:15». Sin duración de la consulta (o con «Todos los médicos»), ese
tramo de 55 min no sale, como antes: el mínimo es una hora. Un tramo de 45 min
que no casa con los turnos (por ejemplo de 09:15 a 10:00, con turnos a las 9:00
y 9:45) sale con «No cabe un turno entero en este hueco.» y sin botón.

**Si falla, significa que…** el panel sigue pidiendo una hora libre aunque la
consulta dure menos.

### H5 · La atendida con nota y el domingo

#### H5-1. Una atendida con nota no se mueve ni cambia de estado, ni saltándose la pantalla

**Qué hago:** primero hago G3-7 (deja una cita atendida de «Paciente Prueba 05» con
su nota). Con la v2 encendida (P8), entro a la base como la **secretaria** (ella no
ve las notas, y aun así la base tiene que frenarla). Los comandos `entrar` y `pg` son los
de S2 (§9.1): si abriste otra terminal, pégalos antes:

```bash
entrar secretaria.a@semilla.spinus.test
```

Debe decir «Sesión lista: secretaria.a@semilla.spinus.test». Busco esa cita (este
comando sólo lee y guarda su código en `ID`):

```bash
ID=$(docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select a.id from public.appointments a join public.consultas n on n.appointment_id = a.id join public.clinicas c on c.id = a.clinica_id where c.nombre = 'Clínica Semilla A' and a.status = 'attended' limit 1"); echo "$ID"
```

Imprime un código largo. Intento devolverla a «Agendada» por fuera de la pantalla:

```bash
pg "appointments?id=eq.$ID" -X PATCH -d '{"status":"scheduled"}'
```

Y luego moverla una hora (el mismo comando, con otra hora de inicio):

```bash
pg "appointments?id=eq.$ID" -X PATCH -d "{\"start_time\":\"$(docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select to_char((start_time + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') from public.appointments where id = '$ID'")\"}"
```

Por último, apago la v2 (P8 al revés) y repito el primero (`"status":"scheduled"`) y
un borrado: `pg "appointments?id=eq.$ID" -X DELETE`.

**Qué debo ver:** los dos primeros se **rechazan** con `HTTP 403` y este texto:

```
"message":"Una cita atendida con nota clínica no cambia de estado ni de fecha u hora"
```

Con la v2 apagada, el cambio de estado igual (`HTTP 403`) y el borrado con
`"message":"Una cita atendida con nota clínica no se borra"`. Al final la cita
sigue «Atendida», a su hora, y en la agenda. (Con la v2 apagada, moverla sí se
puede, como en la pantalla.) Con una atendida SIN nota (marcada a mano), los
cambios de estado pasan (`HTTP 200`).

**Si falla, significa que…** alguien de la clínica puede desmarcar, mover o borrar
una cita cuya nota ya es expediente, saltándose la pantalla.

#### H5-2. El domingo, la lista de Semana abre al final y no en el lunes

**Qué hago:** un domingo (o cualquier día en que ya no queden citas en lo que resta
de la semana), a 390×844, pestaña «Semana».

**Qué debo ver:** la lista abre **al final** (las citas del último día con citas, el
sábado o el viernes), no en el lunes. Si la lista es corta y cabe entera, se ve
completa.

**Si falla, significa que…** el teléfono vuelve a abrir la semana por el lunes y hay
que desplazar hasta el final.

---

## 8-quinquies. Tanda I (2026-11-17)

Lo que se hizo con tus 22 puntos de la tanda I, en cinco grupos: **I1** los
defectos de la agenda (puntos 4 a 7: la cita no pasaba a «Atendida» al volver
de guardar la nota, lo que cambiaba mientras estabas en otra pantalla no
llegaba, y reabrir «Ir a una fecha» o la lupa tumbaba la pantalla); **I2** la
reserva con enlace de un solo uso sin correo, el candado sobre lo que eligió el
paciente («Reagendar») y los correos a nombre del médico; **I3** las reservas
por enlace en «Próximas citas», lo nuevo de Google entra «Por asignar» con
«¿No es una cita?», y el escudo del doble clic en el formulario completo y en
«Convertir en cita»; **I4** una atendida con nota que no se mueve ni con la v2
apagada, el horario «por revisar», la pregunta «¿Asistió el paciente?» y
«Reasignar» el hueco de una cancelada; **I5** la barra en una fila, el menú del
engrane, la campana con «Por confirmar» y «Avisos», y el correo a la clínica
por cada reserva. Todo detrás del interruptor de la v2, salvo los arreglos de
I1 (también con la v2 apagada) e I4-1 (se prueba con la v2 apagada).

**Antes de empezar:** base con las **39** migraciones (P5: las 32 de antes más
las 7 `20261121…` de la tanda I; la consulta de P5 debe responder
`39|20261121150000`), sembrada (P6), aviso aprobado (P7), v2 encendida en la
Clínica A (P8), la app del 3000 (P11). El Google simulado (C0) para I1-5,
I2-9, I3-2 a I3-4b, I5-7 e I-INT-1. **I1-1 al final**, como G3-7 y H5-1:
guarda una nota clínica real y después hay que hacer P5. Si al abrir la agenda
sale «¿Asistió el paciente?», es la ventana de I4-3: «Decidir después» y sigue
(I4-5).

### I1 · Defectos de la agenda (puntos 4 a 7)

#### I1-1. Terminar una consulta y volver a la agenda

> **Ojo:** crea una nota clínica real en la base local: después hay que recrear la
> base (P5) para volver a sembrar. Hazla al final.

**Qué hago:** como Dr. Admin, en la agenda pulso una cita de hoy o de esta
semana de «Paciente Prueba 19» (créala si no hay), «Iniciar consulta»,
«Prefiero escribirla yo», lleno la nota y «Guardar nota». Cierro el aviso y
pulso «Agenda» en el menú (sin F5).

**Qué debo ver:** la tarjeta ya dice «Atendida».

**Si falla, significa que…** la agenda pinta lo que tenía guardado de antes de
la consulta.

#### I1-2. Alguien reserva por el enlace mientras estoy en otra pantalla

**Qué hago:** como Dr. Admin abro la agenda, voy a «Configuración de la agenda»
y, en una ventana de incógnito, reservo con el enlace fijo («Ana Reserva Uno»).
Vuelvo a «Agenda» por el menú antes de 2 minutos.

**Qué debo ver:** la reserva ya está en la agenda, sin F5.

**Si falla, significa que…** el tiempo real se perdió al salir de la agenda.

#### I1-3. Alguien reserva por el enlace con la agenda abierta

**Qué hago:** igual que I1-2, pero con la agenda abierta en la semana de la
reserva.

**Qué debo ver:** la tarjeta aparece sola en pocos segundos.

**Si falla, significa que…** el tiempo real de la agenda no funciona.

#### I1-4. El paciente confirma, cancela o reagenda por el enlace del correo

**Qué hago:** con la agenda abierta (o en el tablero, y vuelvo antes de 2 min),
abro en incógnito el enlace del correo de una cita de «Paciente Prueba 18» y
pulso «Confirmar». Otra vez, «No podré asistir». Otra, «Reagendar» y elijo
otro horario.

**Qué debo ver:** la tarjeta pasa a «Confirmada» / «Cancelada»; al reagendar,
la vieja queda «Cancelada» y la nueva aparece «Agendada». Todo sin F5.

**Si falla, significa que…** la agenda no se entera de lo que hace el paciente.

#### I1-5. Un cambio de Google llega a la agenda abierta (Google simulado, C0)

**Qué hago:** con la agenda abierta en la semana siguiente, creo un evento en
el Google simulado y lanzo la sincronización desde otra ventana. Luego, en una
cita ligada, marco que el paciente acepta la invitación (E9 del plan: la
respuesta a la invitación de Google).

**Qué debo ver:** el evento aparece y la cita pasa a «Confirmada», sin F5.

**Si falla, significa que…** lo que entra de Google no llega por tiempo real.

#### I1-6. Reabrir «Ir a una fecha» y la lupa

**Qué hago:** pulso «Ir a una fecha» (desde I5 es la fecha de la barra; ya no
hay icono de calendario aparte, ver I5-2), Escape, y lo vuelvo a pulsar. Lo
mismo con la lupa, también en el teléfono.

**Qué debo ver:** se vuelve a abrir el cuadro. Nunca «Algo salió mal».

**Si falla, significa que…** el botón tumba la pantalla al reabrirse.

### I2 · Reserva sin correo, candado de lo elegido y correos a nombre del médico

#### I2-1. La reserva con enlace de un solo uso no pide correo

**Qué hago:** como Admin Semilla Uno, emito un enlace de un solo uso. Lo abro
en otro navegador, elijo consultorio, día y hora, y en «Tus datos» escribo
sólo nombre y teléfono. Acepto el aviso y pulso «Reservar cita».

**Qué debo ver:**
- el campo dice «Correo electrónico (opcional)»;
- no aparece «Enviar código a mi correo»;
- sale «Tu cita quedó agendada», sin la línea «Te enviamos el comprobante por
  correo.»;
- en la agenda está la cita por ligar.

**Si falla, significa que…** el único sigue exigiendo correo, o la página
ofrece un comprobante que nunca sale.

#### I2-2. El enlace fijo no cambió

**Qué hago:** abro el enlace fijo de Admin Semilla Uno y llego a «Tus datos».

**Qué debo ver:** «Correo electrónico» obligatorio y el botón «Enviar código a
mi correo». Sin el código no se reserva.

**Si falla, significa que…** el cambio del único alcanzó al fijo.

#### I2-3. Bloquear a alguien que reservó sin correo

**Qué hago:** en la tarjeta de la cita de I2-1 pulso «Bloquear contacto».
Emito otro único y reservo con el mismo teléfono.

**Qué debo ver:** la página no deja reservar y da el teléfono del consultorio.

**Si falla, significa que…** el bloqueo manual no corta a quien no dejó correo.

#### I2-4. El formulario no deja cambiar lo que eligió el paciente

**Qué hago:** con la agenda v2 encendida, abro «Configuración de la cita» de
una cita reservada por enlace que todavía no ocurre.

**Qué debo ver:**
- médico, consultorio, fecha y hora de inicio aparecen grises;
- encima hay una nota que dice que el paciente los eligió, con un botón
  «Reagendar»;
- la hora de fin sí cambia y se guarda; la cita empieza a la misma hora.

**Si falla, significa que…** se puede mover la cita sin avisar al paciente.

#### I2-5. Arrastrar una cita reservada por enlace

**Qué hago:** arrastro esa cita a otra hora. Después la estiro desde abajo y,
por último, desde arriba.

**Qué debo ver:**
- al arrastrarla, regresa a su lugar;
- sale el aviso «El consultorio, el día y la hora de una cita reservada por
  enlace sólo se cambian con «Reagendar», que avisa al paciente.»;
- estirarla desde abajo sí funciona; desde arriba sale el mismo aviso y no se
  mueve.

**Si falla, significa que…** el arrastre la mueve sin avisar.

#### I2-6. Reagendar con correo

**Qué hago:** en el formulario de una cita por enlace con correo pulso
«Reagendar», cambio la hora y pulso «Revisar cambio» y luego «Sí, reagendar y
avisar».

**Qué debo ver:**
- antes de confirmar, la pregunta «¿Reagendar la cita con estos datos?…»;
- después, «Listo: la cita se reagendó y le enviamos el correo con los datos
  nuevos.»;
- la cita se mueve en la agenda;
- en Mailpit, «Cambio en tu cita»: a nombre del médico, con la hora nueva, el
  enlace para confirmar o cancelar y «Enviado con Spinus» al pie.

**Si falla, significa que…** el paciente no se entera del cambio.

#### I2-7. Reagendar sin correo

**Qué hago:** lo mismo que I2-6, con la cita de I2-1.

**Qué debo ver:**
- antes de confirmar: «Esta cita no tiene correo: no se le avisará solo…»;
- al terminar: «La cita se reagendó. No tiene correo: avísale por WhatsApp.»,
  con el botón de WhatsApp.

**Si falla, significa que…** la clínica cree que avisó al paciente sin haberlo
hecho.

#### I2-8. Ligada a un paciente, sigue el candado

**Qué hago:**
1. Ligo la cita a un paciente.
2. En su tarjeta pulso «Reagendar».

**Qué debo ver:** se abre el formulario directamente en el panel «Reagendar»,
con los campos grises.

**Si falla, significa que…** ligar la cita la libera del candado.

#### I2-9. Google no mueve una cita reservada por enlace

**Qué hago:** con Google conectado (aquí, el simulado de C0), muevo en Google
el evento de una cita por enlace a otra hora y espero la sincronización.

**Qué debo ver:** en Spinus la cita sigue a su hora, y en Google el evento
vuelve a esa hora.

**Si falla, significa que…** un cambio en Google mueve al paciente sin
avisarle.

#### I2-10. Los correos llevan el nombre del médico

**Qué hago:** reservo con el fijo (código) y con un único con correo, y abro
los dos correos en Mailpit.

**Qué debo ver:**
- el remitente es «Dr. Admin Semilla Uno», con la misma dirección `noreply@…`;
- arriba, el nombre del médico y debajo «Consultorio Centro (ficticio)»;
- abajo, pequeño, «Enviado con Spinus».

**Si falla, significa que…** el paciente no reconoce de quién es el correo.

### I3 · «Por asignar» de Google y «Próximas citas»

#### I3-1. La reserva por enlace sale en «Próximas citas»

**Qué hago:** con la agenda v2 encendida en la Clínica Semilla A, reservo por
enlace con el nombre «Lucía Reserva» para hoy, más tarde. Como **Dr. Admin**
abro el Dashboard; luego entro como **Secretaria A** y abro el suyo. Después
apago la v2 y recargo.

**Qué debo ver:** en «Próximas citas» de los dos aparece «Lucía Reserva» con la
marca **POR LIGAR** y el botón «Agenda» / «Ver en la agenda», sin «Iniciar
consulta». Con la v2 apagada, ya no sale.

**Si falla, significa que…** las reservas sin paciente siguen fuera del
resumen, o se cuelan con la v2 apagada.

#### I3-2. Un evento nuevo de Google entra «Por asignar»

**Qué hago:** con el Google simulado (C0), creo «Revisión rodilla» para mañana
a las 13:00. `/ya` y recargo la agenda.

**Qué debo ver:**
- la tarjeta dice «Revisión rodilla» con la píldora **POR ASIGNAR**;
- al pulsarla, ofrece «Iniciar consulta», «Confirmar», «Reagendar», «Editar»,
  «¿No es una cita?» y «Cancelar cita», y no ofrece «Convertir en cita»;
- si el evento es para hoy, también sale en «Próximas citas» del Dashboard con
  su título y **POR ASIGNAR**.

**Si falla, significa que…** lo de Google sigue entrando como evento suelto.

#### I3-3. «¿No es una cita?» lo deja como evento, para siempre

**Qué hago:** en la tarjeta de I3-2 pulso «¿No es una cita?». Después, en el
Google simulado, le cambio el título a «Revisión rodilla (otra)» (`/titulo`),
`/ya` y recargo.

**Qué debo ver:**
- al momento, sin más pasos, la tarjeta pierde la píldora;
- al volver a abrirla ofrece «Convertir en cita» y ya no «¿No es una cita?»;
- en «Próximas citas» ya no sale;
- tras el cambio en Google, el título se actualiza y **no** vuelve a «Por
  asignar»;
- en la auditoría (§1.8) hay una fila `cita_no_es_cita`.

**Si falla, significa que…** el evento vuelve a pedir que se ligue o el cambio
no quedó registrado.

#### I3-4. «¿No es una cita?» desde «Próximas citas»

**Qué hago:** con otro evento de Google para hoy (por asignar), en el Dashboard
pulso «¿No es una cita?» en su fila.

**Qué debo ver:** la fila desaparece al instante y no vuelve al recargar; en la
agenda el evento ya no tiene la píldora.

**Si falla, significa que…** el botón de la fila no llega a la base.

#### I3-4b. «¿No es una cita?» desde el formulario

**Qué hago:** pulso un evento por asignar → engrane «Configuración de la cita»
→ en «Editar cita» pulso «¿No es una cita?».

**Qué debo ver:** el formulario se cierra al momento y, sin recargar, la
tarjeta ya no dice «POR ASIGNAR».

**Si falla, significa que…** el botón del formulario no llega a la base o la
agenda no se entera.

#### I3-5. Iniciar la consulta de un «Por asignar»

**Qué hago:** en un evento por asignar pulso «Editar», y en el formulario
«Iniciar consulta». Elijo «Paciente Prueba 22» (o registro uno nuevo).

**Qué debo ver:** se abre la consulta del paciente y la tarjeta ya es su cita.
En Google, el título pasa a «Cita médica: Paciente Prueba 22». Si no hay
consultorio elegido, el formulario dice «Elige el consultorio antes de iniciar
la consulta.».

**Si falla, significa que…** el «por asignar» no se liga al iniciar.

#### I3-6. Doble clic al registrar desde el formulario completo y desde «Convertir en cita»

**Qué hago:**
1. Pulso «Agendar», escribo «Zoila Doble Clic», elijo «Registrar…», marco el
   aviso y hago DOBLE CLIC en «Crear y continuar».
2. Repito desde un evento de Google ya marcado con «¿No es una cita?»:
   «Convertir en cita» → «Registrar paciente nuevo» → doble clic en «Crear y
   continuar».

**Qué debo ver:** el formulario (o «Convertir en cita») sigue abierto con Zoila
elegida. No se eligió solo ningún «Tipo de cita», no cambió la duración, no se
cerró y no se convirtió nada sin pulsarlo.

**Si falla, significa que…** el segundo clic se coló al formulario de debajo.

### I4 · Atendida, horario por revisar, asistencia y reasignar una cancelada

#### I4-1. Una atendida con nota no se mueve, ni con la agenda nueva apagada

**Qué hago:** con la agenda nueva APAGADA en la Clínica Semilla A (P8), hago
G3-7 (deja una cita atendida de «Paciente Prueba 05» con nota) y arrastro esa
cita a otra hora. Después arrastro una atendida SIN nota.

**Qué debo ver:** la de la nota vuelve a su sitio con «Esta cita ya tiene una
nota clínica: sigue como atendida y no se puede cambiar de fecha ni de hora.»
Una atendida SIN nota sí se mueve (como antes).

**Si falla, significa que…** la nota clínica (expediente) quedó colgando de una
cita en otra fecha.

#### I4-2. El horario que nadie confirmó sale «por revisar»

**Qué hago:** recién sembrado, como Dr. Admin abro «Configuración de la
agenda». En «Horario y disponibilidad» pulso «Confirmar horario» en los dos
consultorios. Luego hago H2-7 (Restablecer).

**Qué debo ver:**
- en «Primeros pasos», el paso 1 con un «!» y «· Por revisar», la línea «Viene
  del horario de la clínica: revísalo y confírmalo en cada consultorio.» y el
  botón «Revisar horario»; «0 de 3 listos»;
- en «Horario y disponibilidad», «Consultorio Centro» y «Hospital Norte» dicen
  «· Por revisar» con «Confirmar horario»;
- al pulsar «Confirmar horario» en los dos: aviso «Horario confirmado» y el
  paso 1 queda con palomita;
- tras Restablecer, el paso 1 vuelve a «por revisar».

**Si falla, significa que…** se da por bueno un horario que ninguna persona
eligió.

#### I4-3. ¿Asistió el paciente?

**Qué hago:** en la base, pongo una cita de «Paciente Prueba 21» del Dr. Admin
de hace tres días como «Agendada» (o espero a que pasen 48 h de una cita sin
atender). Abro la agenda como Dr. Admin. Pruebo cada botón. Repito como Dra.
Invitada, como secretaria y con la agenda nueva apagada.

**Qué debo ver:**
- una ventana «¿Asistió el paciente?» con esa cita (nombre, día y hora) y «Sí
  asistió» / «No asistió», y abajo «Decidir después»;
- ninguna cita de hace menos de 48 h; ninguna con nota;
- «Sí asistió» la deja atendida; «No asistió», no asistió (y, si vino de un
  enlace, cuenta para el candado);
- «Decidir después» cierra sin tocar nada, y la ventana vuelve a salir al
  recargar con las que queden;
- la Dra. Invitada sólo ve las suyas; la secretaria, las de la clínica;
- con la agenda nueva apagada no sale.

**Si falla, significa que…** el ciclo de la cita se queda abierto, o algo
cambia de estado solo.

#### I4-4. Reasignar el hueco de una cancelada

**Qué hago:** cancelo una cita de «Paciente Prueba 21»; en su tarjeta pulso
«Reasignar». Elijo «Paciente Prueba 22» y guardo. Recargo. Repito con
«Reagendar cita» de otra cancelada. Por último, con una tercera cancelada, no
hago nada.

**Qué debo ver:**
- la burbuja de alta en ESE día y hora, sin paciente;
- al guardar, la cancelada desaparece y en su lugar está la nueva; al recargar
  sigue sin verse;
- con «Reagendar cita» de una cancelada pasa lo mismo al guardar la nueva;
- si no hago nada, la cancelada se queda como está.

**Si falla, significa que…** el hueco sigue ocupado por una cancelada que ya se
sustituyó, o se perdió.

#### I4-5. La ventana de asistencia y otras pruebas

Si una prueba de la guía siembra una cita agendada de hace más de 48 h, al
abrir la agenda sale la ventana de asistencia: «Decidir después» y sigo.

### I5 · La barra, la campana y los avisos

#### I5-1. Una sola fila en escritorio

**Qué hago:** con la v2, abro la agenda en una ventana de 1280 px o más (menú
lateral abierto), en Semana.

**Qué debo ver:** en UNA fila: ‹ › «Hoy», la fecha (con una flechita),
Mes/Semana/Día, el médico, la lupa, la campana, el engrane y «Agendar». No
están el título «Agenda», el conteo de citas, «Compactar», el botón de atajos,
«Ir a una fecha» ni la fila de la leyenda bajo la rejilla.

**Si falla, significa que…** la regla de una fila de `globals.css` (bloque de
`.ag-fecha-boton`) no se aplica o algún control nuevo es más ancho de lo
medido.

#### I5-2. La fecha abre el calendario

**Qué hago:** pulso la fecha. Elijo un día del mes que viene. Vuelvo a abrirlo y
pulso Escape.

**Qué debo ver:** se abre «Elegir fecha»; al elegir, la agenda salta a ese día y
conserva la vista. Con Escape se cierra y el foco vuelve a la fecha.

**Si falla, significa que…** el botón no está cableado a `MiniMes` (o falta el
arreglo de I1 si la página se rompe al abrirlo).

#### I5-3. El menú del engrane

**Qué hago:** pulso el engrane. Recorro con las flechas, pulso Espacio sobre
«Compactar la rejilla» y sobre «Densidad», Escape. Repito y pulso «Leyenda de
estados», luego «Atajos de teclado», luego «Configuración de la agenda».

**Qué debo ver:**
- cinco opciones;
- «Compactar» y «Densidad» cambian «Encendido/Apagado» y «Normal/Compacta» sin
  cerrar el menú, y la rejilla cambia;
- Escape cierra y el foco vuelve al engrane;
- la leyenda abre su ventanita con los cinco estados; atajos abre la ayuda;
  configuración lleva a su pantalla.

**Si falla, significa que…** `MenuEngraneAgenda` perdió una opción o su
teclado.

#### I5-4. La campana y sus dos pestañas (escritorio y teléfono)

**Qué hago:** con citas de mañana sin confirmar, miro la campana; la pulso; paso
a «Avisos». Repito en el teléfono.

**Qué debo ver:** un punto rojo en la campana; la capa abre en «Por confirmar ·
N» con la leyenda y las filas; «Avisos · M» enseña los avisos sin revisar. En el
teléfono, igual, dentro de la pantalla.

**Si falla, significa que…** la campana no recibe la lista o las pestañas no
alternan.

#### I5-5. Botones alineados en «Por confirmar»

**Qué hago:** con pacientes que tienen sólo teléfono, sólo correo y los dos,
abro «Por confirmar». Mando WhatsApp y correo a uno.

**Qué debo ver:** el icono de WhatsApp y el del correo en la misma columna y del
mismo tamaño en todas las filas (si falta uno, hueco); debajo de la fila, una
sola línea «WhatsApp abierto 00:35 · Correo enviado 00:35».

**Si falla, significa que…** la rejilla `.ag-pc-fila` o `LineaEstado` cambió.

#### I5-6. Los avisos se quedan hasta revisarlos y llevan a su cita

**Qué hago:** con la agenda abierta, reservo por enlace desde otra ventana;
luego cancelo esa cita como paciente; luego reagendo con el mismo enlace.
Recargo. Pulso un aviso.

**Qué debo ver:**
- un aviso emergente breve, sin nombre, al reservar y al reagendar;
- en «Avisos», «… reservó por enlace», «Un paciente canceló…» y «… reagendó su
  cita»; siguen ahí al recargar;
- al pulsar uno, la capa se cierra y se abre la cita en su día; ese aviso ya no
  sale, los demás sí.

**Si falla, significa que…** un disparador de `avisos_clinica` no escribe, o el
PATCH de revisar no llega.

#### I5-7. Avisos de Google (Google simulado)

**Qué hago:** con Google conectado al simulado, creo en Google un evento por
venir y otro encima de una reserva por enlace; sincronizo; abro «Avisos».
Sincronizo otra vez. Creo también un evento PASADO.

**Qué debo ver:** «Evento nuevo de Google por asignar: …» y «La reserva de … se
empalma con un evento de Google»; uno por evento, aunque sincronice otra vez.
El evento PASADO no avisa.

**Si falla, significa que…** el WHEN de `trg_appointments_aviso_clinica` o el
de empalmes no dispara.

#### I5-8. Un aviso desde otra página

**Qué hago:** abro `/agenda?cita=<id de una cita>`.

**Qué debo ver:** la agenda abre esa cita en su día y la dirección queda en
`/agenda`.

**Si falla, significa que…** `useEnlaceACita` no corre o la RLS no deja ver la
cita (entonces sale «No se encontró esa cita.»).

#### I5-9. Correo a la clínica por cada reserva

**Qué hago:** en Configuración → «Plazos y recordatorios», miro «Avisar por
correo de cada reserva». Reservo por enlace. Lo enciendo y reservo otra vez.
Miro Mailpit (http://127.0.0.1:54324).

**Qué debo ver:** apagado de fábrica, con su línea de explicación; apagado no
llega nada; encendido, un correo «Reserva nueva: {nombre}, {fecha y hora}» a los
administradores, con médico y consultorio, sin teléfono, correo ni tipo de
cita.

**Si falla, significa que…** la opción no se guarda (503: falta la migración) o
`avisarReservaAClinica` no mira la columna.

#### I5-10. Apagada, la de siempre

**Qué hago:** apago la v2 y abro la agenda.

**Qué debo ver:** la barra de antes: título, conteo, «Compactar», engrane de
configuración, leyenda debajo; sin campana ni menú.

### Integración de la tanda I

#### I-INT-1. «¿No es una cita?» desde la campana

**Qué hago:** con un evento de Google por asignar (Google simulado, como en
I3-2), abro la campana → pestaña «Avisos». Pulso «¿No es una cita?» en el aviso
«Por asignar». Recargo.

**Qué debo ver:** el botón «¿No es una cita?» está al lado del aviso, no dentro
de él. Al pulsarlo, la cita queda como evento de Google y el aviso desaparece de
la lista; al recargar no vuelve.

**Si falla, significa que…** la campana no lleva el botón de I3, o pulsarlo no
revisa el aviso.

#### I-INT-2. Reserva con enlace único sin correo avisa a la clínica

**Qué hago:** con «Avisar por correo de cada reserva» encendido en la
configuración («Plazos y recordatorios», I5-9), reservo con un enlace de un solo
uso sin escribir correo (como en I2-1). Miro Mailpit (http://127.0.0.1:54324).

**Qué debo ver:** la clínica recibe el correo «Reserva nueva: …»; el paciente
no recibe comprobante.

**Si falla, significa que…** el aviso a la clínica cuelga del correo del
paciente, o se intenta un comprobante sin correo.

### Qué repetir tras la tanda I

Antes de nada, P5 a P8 (la base pasa a **39** migraciones). Después, las nuevas
de esta sección (I1-1 al final) y estas, que ya existían y cambian o hay que
repetir:

**Bloque A**
- **A3. Volver desde otra pantalla:** además, si mientras tanto cambió una cita
  (otra persona, el paciente por su enlace o mi propia nota), al volver ya se ve
  cambiada.
- **A5, A7 y B9** (editar, arrastrar y estirar): en una cita reservada por
  enlace que todavía no ocurre sólo cambia la duración (I2-4, I2-5); las demás
  citas, igual.
- **A12. Iniciar consulta desde la cita:** sin cambios; sigue sin guardarse la
  nota en esa prueba. El caso de guardarla es I1-1.
- **A14. Tiempo real entre dos personas:** repetir saliendo del Dr. Admin al
  tablero mientras la secretaria mueve el evento, y volviendo antes de 2
  minutos: ya está movido.

**Bloque C (Google)**
- **C3 y C10:** repetir; un evento de Google que bloquea un turno sigue
  bloqueándolo aunque esté por asignar.
- **C6. Un evento creado en Google entra a Spinus y se edita desde Spinus:**
  ahora se abre «Editar cita» (no «Editar evento»), porque lo nuevo de Google
  entra «Por asignar». El resto, igual.
- **Google sobre una cita por ligar** (D4 del plan, no la D4 «El código del
  correo» de esta guía): el título sigue entrando, pero la hora ya no; Google
  vuelve a la hora de Spinus (I2-9).

**Bloque D (reserva por enlace)**
- **D2. La reserva aparece «Por ligar» en la agenda:** repetir; la marca «Por
  ligar» de la tarjeta no cambia.
- **D6 y D7 (candado):** repetir con un «No asistió» respondido en la ventana
  de I4-3.

**Bloque D11 (Google antes de reservar)**
- **G1 a G5:** repetir; un evento de Google que bloquea un turno sigue
  bloqueándolo aunque esté por asignar.
- **G5. Un evento de Google que se empalma con una reserva avisa a la
  clínica:** el aviso está ahora en la pestaña «Avisos» de la campana.

**Bloque E y todos los correos**
- **E5. Aviso a la clínica cuando un paciente cancela:** la cancelación está en
  la pestaña «Avisos» de la campana.
- **E11. WhatsApp desde «Por confirmar»:** el botón es la campana (capa «Por
  confirmar y avisos»); «Abierto en WhatsApp» / «Enviado por correo» son ahora
  la línea única de la fila (I5-5).
- **Todas las de correos** (código D4, comprobante E1, recordatorio E8 y
  H2-5/H2-6, confirmación G3-1 a G3-3, los correos con la marca G1-7): el
  remitente y la cabecera son ahora del médico, y «Enviado con Spinus» va al
  pie (I2-10).

**Bloque F**
- **F1. Una sola barra arriba:** ya no hay conteo ni «Compactar» en la barra; la
  fecha es un botón; hay campana y engrane con menú (I5-1).
- **F3 (Densidad), F5 y F11 («Compactar»):** ahora desde el menú del engrane
  (I5-3).
- **F15. La banda azul del teléfono:** sin el conteo debajo de la fecha;
  campana arriba; sin «Compactar» ni configuración sueltos (van en el engrane).
- **F23. El minicalendario:** se abre pulsando la fecha, no un icono aparte; y
  ciérralo con Escape y vuelve a abrirlo: se abre otra vez, sin «Algo salió
  mal» (I1-6, I5-2).
- **F24. El buscador:** lo mismo con la lupa (Escape y reabrir), en escritorio y
  teléfono (I1-6).
- **F25. Atajos de teclado:** la ayuda se abre desde el engrane → «Atajos de
  teclado».

**§8-bis (tanda T)**
- **T3-1. El engrane ya no dice «Horario»:** «Configuración de la agenda» es
  ahora la primera opción del menú «Opciones de la agenda».
- **T3-2. Convertir en cita un evento que creé en Google:** un evento recién
  creado en Google ya no ofrece «Convertir en cita»; antes hay que pulsar «¿No
  es una cita?» y, después, sí (es el camino de vuelta). Lo demás, igual.
- **T3-3 y T3-4:** repetir, sin cambios esperados.

**§8-ter (tanda G)**
- **G2-1. Primeros pasos en orden:** el paso 1 sale «por revisar», «0 de 3
  listos» y «3 pendientes» hasta confirmar el horario (I4-2).
- **G3-5. Confirmada, atendida, cancelada, no asistió:** la cancelada ofrece
  «Reagendar cita» y «Reasignar»; la no asistida, sólo «Reagendar cita».
- **G3-6. Una atendida ya no se mueve:** con nota, el aviso es el de I4-1; sin
  nota, el de siempre.
- **G3-7. Una atendida con nota no se desmarca:** repetir; mover también está
  cerrado con la v2 apagada.
- **G4 («Compactar la rejilla al horario de los consultorios»):** ahora desde
  el menú del engrane.

**§8-quater (tanda H)**
- **H1-5. El correo sigue siendo obligatorio:** ahora sólo el fijo lo exige; el
  único lo marca «(opcional)» y reserva sin él (I2-1, I2-2).
- **H2-1. La configuración abre en «Primeros pasos»:** «Primeros pasos · 3
  pendientes», el paso 1 «por revisar» y «0 de 3 listos» hasta confirmar. En
  todas las H2, «Configuración de la agenda» es la primera opción del menú del
  engrane.
- **H2-7. Restablecer la configuración:** tras restablecer, «Primeros pasos · 3
  pendientes», «0 de 3 listos» y el horario «por revisar».
- **H3-2. La burbuja sigue abierta tras registrar:** repetir; el escudo se movió
  de archivo y su comportamiento no cambia.
- **H4-1 a H4-5 («Por confirmar»):** el botón es la campana (capa «Por
  confirmar y avisos»); las canceladas y los empalmes están en la pestaña
  «Avisos»; el contador rojo es el punto rojo; «Abierto en WhatsApp» / «Enviado
  por correo» son la línea única de la fila.
- **H5-1. Una atendida con nota no se mueve:** repetir; con la v2 apagada,
  moverla por la base **tampoco** se puede (antes esta prueba decía que sí).

**En cualquier prueba:** si siembra una cita agendada de hace más de 48 h, al
abrir la agenda sale «¿Asistió el paciente?»: «Decidir después» y sigue (I4-5).

---

## 8-sexies. Tanda J (2026-11-18)

Lo que se hizo con tus puntos de la tanda J, en cinco grupos: **J1** el menú del
engrane con interruptores, «Pop-up de eventos» en el engrane y la campana y el
engrane fuera del JavaScript de la agenda apagada (puntos 1, 2, 4, 18 y 19);
**J2** el enlace de un solo uso con el correo que pone la clínica y un tope de
intentos, y la anticipación de 2 horas (puntos 3 y 5); **J3** la ventana «Ligar e
iniciar consulta» desde «Próximas citas», la tarjeta y la campana, sin botones de
duración en una reserva y la duración real de cada cita (puntos 6, 7, 8 y 12);
**J4** lo que se mueve en Google de una cita reservada por enlace y lo de Google
sin morado (puntos 9, 10 y 11); **J5** la configuración nueva: la primera vez y
las cinco pestañas (sección F, puntos 13 a 17). Todo detrás del interruptor de
la v2.

**Antes de empezar:** base con las **42** migraciones (P5: las 39 de antes más
las 3 `20261122…` de la tanda J; la consulta de P5 debe responder
`42|20261122140000`), sembrada (P6), aviso aprobado (P7), v2 encendida en la
Clínica A (P8), la app del 3000 (P11). El Google simulado (C0) para J3-3 y J4-1 a
J4-4. Si al abrir la agenda sale «¿Asistió el paciente?», es la ventana de I4-3:
«Decidir después» y sigue (I4-5). **No guardes ninguna nota** en J3: se abren,
pero guardar una deja una nota real y obliga a P5.

### J1 · El menú del engrane y la carga de la agenda (puntos 1, 2, 4, 18 y 19)

#### J1-1. «Pop-up de eventos» en el engrane

**Qué hago:** como **Dr. Admin Semilla Uno**, en la agenda (escritorio) pulso el
engrane. Busco «Pop-up de eventos» y lo apago. Cierro el menú y dejo el ratón
quieto medio segundo sobre la cita de **Paciente Prueba 01**. Luego pulso la cita.

**Qué debo ver:** a la derecha de «Pop-up de eventos» hay un interruptor que pasa
de encendido (azul) a apagado (gris), y el menú no se cierra. Con él apagado, el
ratón quieto no abre nada; el clic sí abre la tarjeta. Si vuelvo a la agenda más
tarde, sigue apagado. En otro navegador sigue encendido, porque es una
preferencia de este dispositivo. La configuración de la agenda ya no tiene la
pestaña «Este dispositivo».

**Si falla, significa que…** la opción no guarda la preferencia, la tarjeta no la
lee, o la opción se quedó también en la configuración.

#### J1-2. Interruptores en el menú del engrane

**Qué hago:** en la vista Semana pulso el engrane. Miro cada opción. Con el
teclado, voy con las flechas hasta «Compactar la rejilla» y pulso Espacio; luego
lo mismo en «Densidad compacta» y en «Pop-up de eventos». Al final pulso Escape.

**Qué debo ver:** «Compactar la rejilla», «Densidad compacta» y «Pop-up de
eventos» llevan un interruptor a la derecha que dice cómo están. Con Espacio
cambian y la rejilla cambia con ellos, sin cerrar el menú. «Configuración de la
agenda», «Atajos de teclado» y «Leyenda de estados» son filas normales, sin
interruptor. Escape cierra el menú y el foco vuelve al engrane. En el teléfono
salen «Configuración de la agenda», «Compactar» (en las vistas que lo admiten),
«Pop-up de eventos» y «Leyenda de estados».

**Si falla, significa que…** el menú perdió el interruptor de una opción o el
teclado.

#### J1-3. Con la v2 apagada, la agenda no carga lo de la v2

**Qué hago:** con la v2 apagada en la Clínica Semilla B, entro como **Dr. Admin
Semilla Dos** y abro la agenda.

**Qué debo ver:** la agenda de siempre, sin campana ni engrane nuevo, y tan
rápida como antes de la tanda I.

**Si falla, significa que…** la campana o el menú del engrane volvieron a entrar
en el JavaScript de la página.

### J2 · El enlace de un solo uso y la anticipación (puntos 3 y 5)

#### J2-1. El enlace de un solo uso lleva el correo que escribo yo

**Qué hago:** como **Dr. Admin Semilla Uno**, en Agenda › engrane ›
«Configuración de la agenda» › pestaña «Tu enlace» (si sale «Paso 1 de 3»,
termina antes J5-1), en «Enlaces de una vez» pulso «Crear uno». Escribo en
«¿Para quién es?» `Beto` y en «Correo del paciente (opcional)»
`beto@prueba.test`, y pulso «Crear enlace de una vez». Copio la dirección. En una
ventana de incógnito la abro y reservo con «Beto Reserva», 5512345690.

**Qué debo ver:**
- debajo del campo del correo, la nota «El comprobante y los avisos de la cita
  irán sólo a este correo; sin él, no se manda ninguno.»;
- en «Tus datos» sólo hay «Nombre completo» y «Teléfono (10 dígitos)»: no se pide
  correo ni código;
- sale «Tu cita quedó agendada» SIN la línea «Te enviamos el comprobante por
  correo.»;
- en Mailpit (http://127.0.0.1:54324), el comprobante «Tu cita con…» llega a
  `beto@prueba.test`.

**Si falla, significa que…** el comprobante no va al correo que puso la clínica,
o la página pide un correo que no se usa.

#### J2-2. Sin correo de la clínica no sale ningún correo

**Qué hago:** creo otro enlace de una vez SIN correo y reservo con «Ceci
Reserva», 5512345691.

**Qué debo ver:** la cita queda agendada y en Mailpit no llega nada por esa
reserva. En la tarjeta de la cita no hay correo.

**Si falla, significa que…** un único sin correo escribe a alguien.

#### J2-3. Un enlace de un solo uso agotado no dice por qué

**Qué hago:**
1. Creo un enlace de una vez.
2. Abro la página y elijo un día y hora.
3. Antes de reservar, en otra pestaña con OTRO enlace de una vez, reservo ese
   mismo horario.
4. En la primera pestaña pulso «Reservar cita»: sale «Ese horario se acaba de
   ocupar. Elige otro.».
5. Repito el paso 4 hasta 5 veces, eligiendo siempre una hora que acabo de ocupar
   desde otro enlace.
6. Recargo la página del primer enlace.

**Qué debo ver:** al recargar, «Este enlace ya no está disponible» con el
teléfono del consultorio. No se menciona «intentos» ni «bloqueado».

**Si falla, significa que…** el enlace de un solo uso no tiene tope.

#### J2-4. Bloquear a alguien también gasta su enlace

**Qué hago:**
1. Bloqueo el contacto de la cita de J2-2 («Bloquear contacto»).
2. Creo un enlace de una vez nuevo y reservo con el teléfono de Ceci
   (5512345691): la página no deja reservar y da el teléfono del consultorio.
3. En ese MISMO enlace pruebo con otro teléfono, 5512345692.

**Qué debo ver:** con el segundo teléfono, «Este enlace ya no está disponible».

**Si falla, significa que…** con un solo enlace se puede probar qué teléfonos
bloqueó la clínica.

#### J2-5. La anticipación de 2 horas se cumple por las dos caras

**Qué hago:** con la anticipación de fábrica (2 h), abro el enlace fijo con un
consultorio que atienda ahora. Miro la primera hora que ofrece hoy. Si ese médico
tiene algo de todo el día hoy, uso otro día.

**Qué debo ver:**
- ninguna hora a menos de 2 h de ahora;
- la primera es la primera de la rejilla (desde la apertura, de duración en
  duración) que queda a 2 h o más;
- reservar esa hora funciona.

Si una hora que esperabas no sale, mira primero si el médico tiene ese rato
ocupado en CUALQUIERA de sus consultorios, o un evento de todo el día (en la
semilla, la «Guardia» del miércoles bloquea el miércoles entero).

**Si falla, significa que…** la página y la base no aplican la misma
anticipación.

### J3 · «Ligar e iniciar consulta» y la duración de las citas (puntos 6, 7, 8 y 12)

#### J3-1. «Ligar e iniciar consulta» en Próximas citas

**Qué hago:** reservo por enlace a nombre de «Lucía Reserva» para hoy, más tarde.
Como **Dr. Admin** abro el Dashboard y, en la fila de «Lucía Reserva», pulso
«Ligar e iniciar consulta» («Ligar» en pantallas angostas). Luego entro como
**Secretaria A** y abro su Dashboard.

**Qué debo ver:**
- una ventana pequeña «Ligar e iniciar consulta» con Nombre, Teléfono, Correo,
  Día y hora, y Consultorio de quien reservó. Nada de duración, tipo ni
  observaciones;
- al pulsar «Ligar e iniciar consulta», el buscador de pacientes ya escrito con
  «Lucía Reserva»;
- al elegir «Paciente Prueba 07», se abre su nota nueva. **No guardes la nota.**
  Al volver, la cita ya es de «Paciente Prueba 07»;
- la secretaria, en cambio, ve en esa fila «Ver en la agenda», sin «Ligar».

**Si falla, significa que…** desde el resumen no se puede convertir una reserva
en consulta, o la secretaria ve un botón que no le toca.

#### J3-2. La misma ventana desde la tarjeta, con paciente nuevo

**Qué hago:** en la agenda, pulso otra cita «Por ligar» y, en su tarjeta, «Ligar e
iniciar consulta» → «Ligar e iniciar consulta» → «Registrar paciente nuevo».
Intento «Crear y continuar» sin marcar el aviso; luego lo marco.

**Qué debo ver:**
- la tarjeta ya no ofrece «Iniciar consulta» en una cita por ligar. Lo que se
  abre es la ventana pequeña, no «Editar cita»;
- «Registrar paciente» viene con el nombre, los apellidos, el correo y el
  teléfono de quien reservó ya puestos;
- sin la casilla del aviso: «Debes marcar el consentimiento del aviso de
  privacidad.», y no se crea;
- con la casilla, se crea y se abre la nota (no la guardes).

**Si falla, significa que…** se crean pacientes sin consentimiento (prohibido), o
la tarjeta sigue llevando al formulario completo.

#### J3-3. Desde el aviso de la campana, y «¿No es una cita?» de Google

**Qué hago:** en la agenda, abro la campana → «Avisos» y pulso el aviso «…
reservó por enlace» de una cita que sigue por ligar. Cancelo. Con el Google
simulado (C0), creo «Valoración hombro» para mañana, `/ya`, y pulso su aviso
«por asignar». En la ventana, pulso «¿No es una cita?».

**Qué debo ver:**
- el aviso de la reserva abre la ventana pequeña con los datos de quien reservó;
- el de Google abre la misma ventana, con «¿No es una cita?»;
- al pulsar «¿No es una cita?», la ventana se cierra y el evento queda como
  evento, sin marca «Por asignar»;
- el aviso de una cancelación sigue llevando a la tarjeta de la cita, como antes.

**Si falla, significa que…** la campana no lleva a ligar, o lleva a ligar algo
que ya no se puede ligar.

#### J3-4. Doble clic en la ventana

**Qué hago:** en la ventana, hago DOBLE CLIC en «Ligar e iniciar consulta». Luego
pulso «Registrar paciente nuevo» y hago DOBLE CLIC en «Cancelar».

**Qué debo ver:** el doble clic deja el buscador abierto sin elegir ningún
paciente. Al cancelar el alta, la ventana sigue abierta: el segundo clic no la
cierra ni pulsa nada debajo.

**Si falla, significa que…** un doble clic liga a un paciente al azar o cierra la
ventana.

#### J3-5. Sin botones de duración en una reserva por enlace

**Qué hago:** en la agenda, abro una cita «Por ligar» → engrane «Configuración de
la cita». Después, «Agendar» una cita nueva.

**Qué debo ver:** en «Editar cita» de la reserva, la fila de botones «Duración»
(15 min … 2 horas) ya no está; «Hora de fin» sí, y se puede cambiar. En «Nueva
cita», los botones de duración siguen ahí.

**Si falla, significa que…** los botones invitan a cambiar la duración de una
cita que eligió el paciente.

#### J3-6. La duración es la del fin real, no la del tipo

**Qué hago:** como Dr. Admin, en la configuración › «Tu consulta» › «Agregar tipo
de cita», creo «Revisión corta» de 30 min. Agendo a «Paciente Prueba 07» con ese
tipo y, en «Hora de fin», pongo 50 minutos después del inicio. Guardo y abro su
tarjeta.

**Qué debo ver:** la tarjeta dice «50 min» (no 30). Al editar, la hora de fin es
la que puse. En el enlace de reserva de ese día, los turnos que tocan esos 50
minutos no se ofrecen.

**Si falla, significa que…** la agenda mide las citas con la duración del tipo y
no con la real.

### J4 · Google y las citas reservadas por enlace (puntos 9, 10 y 11)

#### J4-1. Mover en Google una cita reservada por enlace

**Qué hago:** con el Google simulado (C0), reservo una cita por el enlace de Dr.
Admin Semilla Uno para la semana que entra. En el Google simulado la muevo a otra
hora. Abro la agenda de Spinus.

**Qué debo ver:** en Spinus sigue a su hora. Al poco, en Google vuelve sola a su
hora. En la campana, pestaña «Avisos»: «Desde Google no se pueden mover las citas
reservadas por enlace. Para cambiarla, usa Reagendar: se le avisará al
paciente.»

**Si falla, significa que…** si en Spinus cambió la hora, el candado de la
reserva no funciona (grave); si Google no vuelve, el restablecimiento no se
repite; si no hay aviso, falta la migración 37.

#### J4-2. Un aviso por intento

**Qué hago:** con el aviso de J4-1 sin pulsar, cierro y abro la agenda dos veces.
Luego vuelvo a mover la cita en Google y abro la agenda.

**Qué debo ver:** un solo aviso de esa cita todo el tiempo; tras moverla otra
vez, el mismo aviso sube arriba («hace un momento»). Si lo habías pulsado antes,
aparece uno nuevo.

**Si falla, significa que…** dos avisos iguales tras abrir la agenda: la
deduplicación no funciona.

#### J4-3. Pulsar el aviso

**Qué hago:** pulso el aviso de J4-1.

**Qué debo ver:** la agenda va al día de la cita y abre su tarjeta con
«Reagendar» como botón grande de arriba, ya seleccionado (Enter lo pulsa). El
aviso deja de contar.

**Si falla, significa que…** si la tarjeta sale con «Iniciar consulta» arriba, no
llega el destacado.

#### J4-4. Lo de Google sin morado

**Qué hago:** en el Google simulado creo un evento suelto («Junta de hospital») y
uno que se repite dos días («Sesión académica»). Abro la agenda en Semana, Mes y
en el teléfono.

**Qué debo ver:** ninguno en morado: los dos con los colores de «Agendada». Los
dos llevan la «G» de colores. La tarjeta de «Junta de hospital» también la lleva
junto al nombre. En el engrane, «Leyenda de estados»: los cinco estados y «G · Se
agendó en Google», sin «GCal» ni morado.

**Si falla, significa que…** algo morado: la reasignación de colores no llega a
esa vista.

### J5 · La configuración nueva (sección F, puntos 13 a 17)

#### J5-1. La primera vez

**Qué hago:** recién sembrado (o tras «Empezar de nuevo», J5-6), entro como **Dr.
Admin Semilla Uno** a Agenda › engrane › «Configuración de la agenda».

**Qué debo ver:** «¿Cuándo das consulta?», «Paso 1 de 3», una tarjeta por
consultorio (Consultorio Centro, Hospital Norte) con «Igual que la clínica / Otro
horario». Elijo «Otro horario» en Hospital Norte, apago el sábado, «Continuar»;
45 min y la línea «En un día de 8:00 a 18:00 te caben 13 consultas…»,
«Continuar»; prendo el recordatorio, «Terminar». Veo «Tu agenda ya está lista»
con una dirección `…/reservar/…`, «Copiar enlace», «Mandar por WhatsApp» y el
resumen con «Cambiar».

**Si falla, significa que…** la primera vez no se guarda paso a paso o no crea el
enlace.

#### J5-2. Terminar después

**Qué hago:** en el paso 2 elijo 20 min y pulso «Terminar después». Vuelvo a la
configuración.

**Qué debo ver:** abre otra vez en el paso 2 con 20 min marcado (en este
navegador; en otro, en el primer paso pendiente).

**Si falla, significa que…** no recuerda en qué paso me quedé.

#### J5-3. Cambiar desde el resumen

**Qué hago:** en «Tu agenda ya está lista», «Cambiar» junto a «Cuánto dura tu
consulta».

**Qué debo ver:** el paso 2 con mi duración marcada.

**Si falla, significa que…** el resumen no lleva al paso.

#### J5-4. Las pestañas se guardan solas

**Qué hago:** ya terminada la primera vez, vuelvo a la configuración, pestaña
«Avisos», cambio «Pueden ver horarios de los próximos» a 90 y salgo del campo.
Luego escribo 400.

**Qué debo ver:** abajo, «Guardado»; al recargar sigue 90. Con 400 sale «de 1 a
365» y no se guarda.

**Si falla, significa que…** el autoguardado no llega al servidor o guarda
valores inválidos.

#### J5-5. Horario de la clínica

**Qué hago:** como Dr. Admin, «Cuándo das consulta» › abajo «Cambiar el horario
de la clínica», apago el sábado, «Guardar horario». Después entro como **Dra.
Invitada Semilla Dos** y como la secretaria.

**Qué debo ver:** «Guardado» y «Horario de la clínica: Lun a vie 8:00 – 18:00».
La invitada y la secretaria no ven «Cambiar el horario de la clínica»: dice «Lo
cambia quien administra la clínica.».

**Si falla, significa que…** alguien que no administra puede cambiar el horario
de todos.

#### J5-6. Empezar de nuevo

**Qué hago:** Dr. Admin, «Más opciones» › «Empezar de nuevo», escribo RESTABLECER,
«Restablecer».

**Qué debo ver:** la primera vez desde el paso 1; las citas siguen. La invitada y
la secretaria no ven «Empezar de nuevo».

**Si falla, significa que…** se puede reiniciar sin ser administrador o el
reinicio no vuelve a preguntar.

#### J5-7. Nada se pierde

**Qué hago:** Dra. Invitada, «Tu consulta» › «En cada consultorio» ›
Rehabilitación › «Otra duración en este consultorio» › 1 hora. Luego «Cuándo das
consulta» › «Cambiar horario» de Rehabilitación, cambio un día, «Guardar
horario». Si el recordatorio de la clínica tiene un número de horas que no está
entre 2, 12, 24 y 48 (por ejemplo 6, puesto con la configuración de antes), abro
«Avisos» y cambio otro plazo.

**Qué debo ver:** Rehabilitación sigue con 60 min y en su huso. «Avisos» enseña
«6 horas» y no lo cambia al guardar el otro plazo.

**Si falla, significa que…** la pantalla nueva pisa algo que la vieja respetaba.

#### J5-8. Apagada

**Qué hago:** con la v2 apagada en la clínica, abro `/agenda/configuracion`.

**Qué debo ver:** página de no encontrado; el engrane abre el horario de siempre.

**Si falla, significa que…** lo nuevo se ve sin el interruptor.

### Integración de la tanda J

#### J-INT-1. El correo del enlace de una vez, en la pantalla nueva

J2 (el correo) y J5 (la pantalla) se escribieron a la vez: el campo «Correo del
paciente (opcional)» lo puso la integración en «Crear uno». Es la prueba J2-1;
hazla también desde «Enlaces de los demás médicos» (abre la ficha de la Dra.
Invitada Semilla Dos y crea uno de una vez con correo): el comprobante llega a
ese correo.

**Si falla, significa que…** una de las dos maneras de crear el enlace no manda
el correo.

### Qué repetir tras la tanda J

Antes de nada, P5 a P8 (la base pasa a **42** migraciones). Después, las nuevas
de esta sección y estas, que ya existían y cambian o hay que repetir:

**Bloque B (configuración)**
- **B1. La pantalla de configuración:** ahora es la primera vez (J5-1) o cinco
  pestañas: «Tu enlace», «Cuándo das consulta», «Tu consulta», «Avisos» y «Más
  opciones» (la secretaria: «Enlaces», «Cuándo dan consulta», «Tipos de cita»,
  «Avisos», «Más opciones»). Ya no hay «Este dispositivo».
- **B2 y B3** (los ajustes de la clínica y quién los cambia): en «Avisos», sin
  botón «Guardar ajustes» (se guardan solos, J5-4); quien no administra lee
  «Lo cambia quien administra la clínica.».
- **B4. Crear y archivar tipos de cita:** «Tu consulta» › «Otros tipos de cita»;
  archivar se llama «Quitar» y los quitados están en «Quitados (N)» con
  «Reactivar».
- **B6. Disponibilidad por consultorio:** «Cuándo das consulta» › «Cambiar
  horario» (diálogo «Horario en …», «Igual que la clínica / Otro horario»).

**Bloque C (Google)**
- **C9. Series que se repiten:** siguen sin poder moverse desde Spinus; ahora se
  pintan con los colores de «Agendada» y la «G», no en morado (J4-4).

**Bloque D (reserva por enlace)**
- **D3. Enlace de un solo uso:** se crea en «Tu enlace» › «Enlaces de una vez» ›
  «Crear uno», con correo opcional; la página ya no pide correo y el comprobante
  sólo llega si la clínica lo puso (J2-1, J2-2).
- **D10 y D11** (ligar desde el formulario): sin cambios; es el segundo camino. La
  nota de D11 («no se precarga el teléfono») sigue siendo cierta en ese camino;
  en la ventana nueva sí se precarga (J3-2).

**Bloque E**
- **E1. El comprobante al reservar:** en el enlace de un solo uso va al correo
  que puso la clínica (J2-1).

**Bloque F**
- **F3 (Densidad), F5 y F11 («Compactar»):** desde el engrane, con interruptor;
  la densidad se llama «Densidad compacta».
- **F17. El formulario de alta:** los botones de duración siguen al dar de alta;
  al EDITAR una reserva por enlace ya no salen (J3-5).
- **F22. La tarjeta de lectura:** en una cita por ligar, la acción principal es
  «Ligar e iniciar consulta», no «Iniciar consulta».

**§8-bis (tanda T)**
- **T2-1, T2-3, T2-4 y T2-7** (lo que falta para el enlace, cada médico su
  ficha, la pantalla): el aviso «No abrirá…» va encima de «Tu enlace»; el enlace
  fijo es un interruptor Prendido/Apagado (apagar = revocar, con confirmación) y
  «Cambiar por uno nuevo»; las fichas de los demás médicos, en «Enlaces de los
  demás médicos (N)».
- **T3-1. El engrane ya no dice «Horario»:** repetir; sin cambios esperados.
- **T3-6. Apagar la tarjeta al pasar el ratón:** ahora es el engrane › «Pop-up de
  eventos» (J1-1).

**§8-ter (tanda G)**
- **G1-1. La reserva por pasos:** en el enlace de un solo uso, «Tus datos» ya no
  tiene correo.
- **G2-1, G2-2 y G2-5** (primeros pasos, crear el enlace sin duración, cada enlace
  dice si funciona): ahora es la primera vez (J5-1), que crea el enlace al
  terminar; lo que falta se avisa en «Tu enlace».
- **G2-3, G2-4 y G2-9** (la duración de la invitada, otra duración en un
  consultorio, archivar sus tipos): en «Tu consulta» y «En cada consultorio».
- **G2-8. Ya no está el horario de la clínica:** cambia: vuelve, en «Cuándo das
  consulta», sólo para quien administra (J5-5).

**§8-quater (tanda H)**
- **H1-5. El correo sigue siendo obligatorio:** en el fijo, sin cambios.
- **H2-1 a H2-4** (pestañas, invitados plegados, botones, «Plazos y
  recordatorios»): con las pestañas nuevas; «Plazos y recordatorios» es «Avisos».
- **H2-5 y H2-6** (el recordatorio): el interruptor está en «Avisos»
  («Recordarle su cita al paciente») y se guarda solo.
- **H2-7 y H2-8** (restablecer): es «Más opciones» › «Empezar de nuevo»; al
  terminar, la primera vez desde el paso 1 (J5-6).

**§8-quinquies (tanda I)**
- **I2-1. La reserva con enlace de un solo uso no pide correo:** el campo
  «Correo electrónico (opcional)» ya no existe; la sustituyen J2-1 y J2-2.
- **I2-2. El enlace fijo no cambió:** repetir.
- **I2-3. Bloquear a alguien que reservó sin correo:** repetir; ahora además
  gasta el enlace (J2-4).
- **I2-9. Google no mueve una cita reservada por enlace:** además sale el aviso
  de J4-1.
- **I3-1. La reserva por enlace en «Próximas citas»:** el Dr. Admin ve «Ligar» /
  «Ligar e iniciar consulta» en la fila por ligar; la secretaria sigue viendo
  «Ver en la agenda».
- **I3-2, I3-4 e I3-5** (por asignar de Google): la tarjeta y la fila de
  «Próximas citas» ofrecen «Ligar e iniciar consulta» (en la fila, «Ligar») en
  vez de «Iniciar consulta» o el cuadrito; «¿No es una cita?» sigue en la fila.
- **I4-2. El horario por revisar:** «Por revisar» y «Confirmar horario» están en
  la tarjeta del consultorio, en «Cuándo das consulta».
- **I5-1, I5-2 e I5-4:** repetir, sin cambios esperados: la campana y el engrane
  se cargan aparte, pero salen igual y a la vez.
- **I5-3. El menú del engrane:** interruptores en lugar de
  «Encendido/Apagado» y «Normal/Compacta»; «Densidad compacta»; una opción más,
  «Pop-up de eventos» (seis en escritorio con Semana o Día). La leyenda ya no
  dice «GCal».
- **I5-6. Los avisos llevan a su cita:** el de una reserva o un reagendo aún por
  ligar abre la ventana «Ligar e iniciar consulta» (J3-3).
- **I5-7. Avisos de Google:** hay un tipo más (J4-1).
- **I5-9 e I-INT-2** (correo a la clínica por cada reserva): el interruptor es
  «Avisarme cuando alguien aparte cita», en «Avisos».

**Apagado**
- **X1:** nada de lo de arriba se ve (J1-3, J5-8).

---

## 8-septies. Tanda K (2026-11-18)

Lo que se hizo con tus puntos de la tanda K, en cinco grupos. Todo lo que se ve
va detrás del interruptor de la v2 (las columnas nuevas de la base no cambian
nada con la v2 apagada):

- **K1:** el bloqueo de horario (puntos 1 a 7).
- **K2:** confirmar al abrir el correo, «Continuar mi reserva» y reenviar el
  código sin quedar bloqueado (puntos 8, 9 y 10).
- **K3:** la configuración: el horario de la clínica primero, su huso de
  fábrica, las pestañas del teléfono y apagar «Tu enlace» sin perderlo (puntos
  11 a 14).
- **K4:** la leyenda de la hora de tu ubicación y el gris de cada consultorio, y
  por qué el modal tardaba en irse (puntos 15, 16 y 22).
- **K5:** las marcas de procedencia y la burbuja nueva de la cita (puntos 17 a
  21).

**Antes de empezar:**

- La base con las **45** migraciones (P5: las 42 de antes más las 3
  `20261123…` de la tanda K). La consulta de P5 debe responder
  `45|20261123140000`.
- Sembrada (P6), con el aviso aprobado (P7) y la v2 encendida en la Clínica A
  (P8).
- La app del 3000 (P11).
- El Google simulado (C0) para K1 (Google) y K5-1/K5-8.
- Mailpit para K2.

Si al abrir la agenda sale «¿Asistió el paciente?», es la ventana de I4-3: pulsa
«Decidir después» y sigue (I4-5).

### K1 · El bloqueo de horario (puntos 1 a 7)

#### K1-1. Crear un bloqueo desde «Agendar»

**Qué hago:** con la v2 encendida, pulso «Agendar» y elijo «Bloqueo». Pongo un
día, de 15:00 a 17:00, con el motivo «Congreso», y guardo.

**Qué debo ver:**
- se cierra el modal;
- en la rejilla, una franja rayada de 15:00 a 17:00 con «Bloqueado · Congreso»;
- sale el aviso «Horario bloqueado».

**Si falla, significa que…** el alta del bloqueo o su pintado no funcionan.

#### K1-2. Agendar encima pregunta (burbuja, modal y arrastre)

**Qué hago:**
1. Pulso un hueco dentro de la franja, elijo un paciente y «Guardar».
2. Luego abro «Agendar» › «Cita» con una hora dentro de la franja y guardo.
3. Por último arrastro una cita a la franja.

**Qué debo ver:**
- las tres veces, «Este horario está bloqueado. ¿Agendar de todos modos?»;
- en la burbuja, «Cancelar» la deja abierta y «Aceptar» agenda;
- en el arrastre, «Cancelar» devuelve la cita a su sitio;
- un evento propio sin paciente («Comida») no pregunta.

**Si falla, significa que…** falta la pregunta en uno de los caminos.

#### K1-3. Editar y quitar desde el rótulo

**Qué hago:**
1. Pulso el rótulo «Bloqueado · Congreso», cambio el motivo y guardo.
2. Después pulso otra vez el rótulo › «Quitar bloqueo» › «Sí, quitar».

**Qué debo ver:**
- la franja cambia de texto;
- si había citas, el aviso «Hay N citas en este horario. Se quedan como
  están.», y las citas siguen igual;
- al quitarlo, la franja desaparece.

**Si falla, significa que…** la edición, el aviso del punto 5 o quitar no
funcionan.

#### K1-4. Días completos desde la burbuja

**Qué hago:** en una burbuja de alta pulso «Bloquear este horario» y marco «Días
completos».

**Qué debo ver:** una franja rayada en la banda de todo el día y en toda la
columna.

**Si falla, significa que…** el bloqueo de días no se pinta.

#### K1-5. El enlace de reserva respeta el bloqueo, y lo de todo el día ya no cierra el día

**Qué hago:**
1. En el enlace de reserva de ese médico voy al día bloqueado.
2. Luego creo un EVENTO de todo el día («Congreso») SIN bloqueo en otro día y
   abro ese día en el enlace.

**Qué debo ver:**
- en el día bloqueado, ningún turno dentro del periodo (todo el día si es de
  días completos);
- en el día del evento de todo el día, el día SÍ ofrece turnos;
- un evento o una cita CON hora siguen quitando su hora.

**Si falla, significa que…** la reserva no respeta el bloqueo, o lo de todo el
día volvió a cerrar el día.

#### K1-6. Google

**Qué hago:**
1. Con Google (simulado) conectado, creo un bloqueo con motivo.
2. Muevo ese evento en Google y borro allí otro bloqueo.
3. Abro la agenda.
4. Creo en Google un evento llamado «Bloqueado».

**Qué debo ver:**
- en el calendario de Spinus de Google, «Bloqueado — motivo», como ocupado;
- en Spinus, el primero se movió y el segundo desapareció;
- el evento «Bloqueado» creado en Google entra como evento de Google, igual que
  hoy, nunca como franja.

**Si falla, significa que…** el envío o la vuelta desde Google fallan, o un
evento de Google se convirtió en bloqueo.

#### K1-7. Permisos y apagada

**Qué hago:**
1. Como Dra. Invitada intento bloquear el horario de otro médico.
2. Luego apago la v2.

**Qué debo ver:**
- la invitada no puede: no elige médico y la API responde 403;
- con la v2 apagada no hay posición «Bloqueo» ni franja, y todo es como antes.

**Si falla, significa que…** el permiso es más amplio que el de agendar, o el
interruptor no aísla el cambio.

### K2 · Confirmar, continuar la reserva y reenviar el código (puntos 8, 9 y 10)

#### K2-1. «Confirmo mi asistencia» confirma al abrirlo

**Qué hago:**
1. Agendo una cita para mañana en el Consultorio Centro, con el correo
   `caro3@prueba.test`, y le mando la confirmación.
2. Con la agenda abierta en esa semana, abro el correo en Mailpit y pulso
   «Confirmo mi asistencia».

**Qué debo ver:**
- un momento «Confirmando tu asistencia…»;
- después, «Gracias. Tu asistencia quedó confirmada.», sin pulsar nada más;
- en la agenda, la cita confirmada sin recargar;
- en la auditoría, una sola `cita_editada` por `system` con `enlace_paciente`.

**Si falla, significa que…** hay que pulsar dos veces, o se confirma dos veces.

#### K2-2. Sin una persona, abrir no confirma

**Qué hago:** con JavaScript desactivado para el sitio, abro el «Confirmo» de
otra cita y luego pulso el botón.

**Qué debo ver:**
- al abrir, la cita sigue sin confirmar y está el botón de siempre;
- al pulsarlo, confirma.

**Si falla, significa que…** un programa que revisa correos podría confirmar por
el paciente.

**Ojo:** un revisor de correo que SÍ ejecute JavaScript confirmaría (riesgo
aceptado, pendiente de tu decisión, AG-DT-175).

#### K2-3. «No podré asistir» sigue en dos pasos

**Qué hago:** desde el correo de otra cita, pulso «No podré asistir».

**Qué debo ver:** el «¿Seguro…?» de siempre. Nada se cancela hasta «Sí, cancelar
mi cita».

**Si falla, significa que…** un clic en el correo cancela sin preguntar.

#### K2-4. «Continuar mi reserva» desde el correo del código

**Qué hago:**
1. Con el enlace fijo, en incógnito, elijo hora, escribo `dani4@prueba.test` y
   pido el código.
2. En Mailpit pulso «Continuar mi reserva».

**Qué debo ver:**
- el código visible en el correo y, debajo, el botón;
- la reserva abre en «Revisa tu correo» con el código ya escrito;
- en la barra no queda `#codigo=`;
- nada se reserva hasta «Verificar y reservar».

**Si falla, significa que…** el paciente tiene que copiar el código a mano, o
abrir el enlace reserva por él.

#### K2-5. Reenviar el código: cuenta atrás y sin castigo

**Qué hago:**
1. Borro los contadores (§1.6).
2. Llego al código con `eli5@prueba.test` y pulso enseguida «Enviar otro
   código».
3. Cuando se pueda, lo pulso y escribo el código del PRIMER correo.
4. Después escribo el del último.

**Qué debo ver:**
- «Enviar otro código en N s», bajando desde 30 y sin poder pulsarse;
- con el primero, «Ese código es de un correo anterior. Escribe el del correo
  más reciente.»;
- con el último, reserva.

**Si falla, significa que…** reenviar castiga como si el paciente se hubiera
equivocado.

#### K2-6. Recargar, atrás o volver no piden otro código

**Qué hago:**
1. Llego al código con `flor6@prueba.test`.
2. Recargo.
3. Pulso «Atrás» y «Adelante».
4. Pulso «Volver» y «Continuar».

**Qué debo ver:**
- siempre «Revisa tu correo» con lo elegido;
- en Mailpit, UN solo correo de código, y ese código sirve.

**Si falla, significa que…** el paciente pide códigos sin querer hasta quedar
bloqueado.

#### K2-7. Cuando hay que esperar, dice cuánto

**Qué hago:** con el código de K2-5 recién pedido, abro el mismo enlace en otra
pestaña y llego al código con el mismo correo.

**Qué debo ver:**
- «Espera N s para pedir otro código.» y la página pasa a escribir el código;
- no llega otro correo;
- pasado el límite de una hora: «Demasiados intentos. Podrás volver a probar en
  N min.».

**Si falla, significa que…** el paciente no sabe cuánto esperar.

### K3 · La configuración (puntos 11 a 14)

#### K3-11. El horario de la clínica, primero

**Qué hago:** como Dr. Admin, «Configuración de la agenda» › «Cuándo das
consulta». Luego lo mismo como Dra. Invitada y como secretaria.

**Qué debo ver:**
- como Dr. Admin, arriba de todo, la tarjeta «Horario de la clínica» con «Lun a
  vie · 8:00 – 18:00» y «Sáb · 8:00 – 13:00», y «Cambiar horario»;
- como Dra. Invitada y como secretaria, la misma tarjeta sin botón y con «Lo
  cambia quien administra la clínica.».

**Si falla, significa que…** el horario de la clínica volvió a quedar escondido,
o cualquiera puede cambiarlo.

#### K3-12. El primer paso es la clínica (sólo el administrador)

**Qué hago:**
1. Como Dr. Admin, «Más opciones» › «Empezar de nuevo» › RESTABLECER.
2. En «Horario de la clínica» apago el sábado, elijo «Quintana Roo» en el huso
   y pulso «Continuar».
3. Pulso «Atrás», luego «Terminar después», y vuelvo a la configuración.

**Qué debo ver:**
- «Paso 1 de 4», con el texto «Este horario se usará de fábrica en todos los
  consultorios que se creen…»;
- al continuar, «¿Cuándo das consulta?», «Paso 2 de 4»;
- «Atrás» vuelve con Quintana Roo elegido, y «Terminar después» vuelve a abrir
  ahí;
- en el resumen, «Horario de la clínica» con el huso y «Cambiar»;
- la Dra. Invitada, en su primera vez, empieza en «Paso 1 de 3», sin este paso.

**Si falla, significa que…** el paso no se guarda, o lo ve quien no debe.

#### K3-12b. El huso de fábrica

**Qué hago:** después de K3-12, en Perfil › «Agregar consultorio».

**Qué debo ver:**
- la zona ya en Quintana Roo;
- los consultorios que ya existían, con su huso de siempre.

**Si falla, significa que…** el huso no llega al alta, o pisó el de un
consultorio.

#### K3-13. Las pestañas en el teléfono

**Qué hago:** abro la configuración ya terminada a 390 y a 320 px, y luego en la
computadora.

**Qué debo ver:**
- a 390 y a 320 px, cinco iconos en una fila sin deslizar, y debajo el nombre
  de la elegida;
- en la computadora, las pestañas con texto y sin título debajo.

**Si falla, significa que…** las pestañas no caben, o un lector de pantalla no
sabe cuál es cuál.

#### K3-14. Apagar «Tu enlace» lo pausa

**Qué hago:**
1. Copio la dirección de «Tu enlace» y apago el interruptor.
2. La abro en incógnito.
3. Lo prendo y la abro otra vez.
4. Pulso «Cambiar por uno nuevo» › «Aceptar» y abro la vieja.

**Qué debo ver:**
- al apagar, sin pregunta: «Apagado: nadie puede apartar con él» y «Al
  prenderlo vuelve a servir la misma dirección…»;
- en incógnito, la página de no encontrado;
- al prenderlo, la MISMA dirección, y abre;
- tras cambiarlo, una dirección nueva, y la vieja ya no abre.

**Si falla, significa que…** apagar volvió a revocar, o un enlace pausado deja
apartar.

### K4 · La hora de tu ubicación y el gris de cada consultorio (puntos 15, 16 y 22)

#### K4-1. La leyenda de la hora de tu ubicación

**Qué hago:**
1. Como Dr. Admin, en Mi perfil cambio «Hospital Norte (ficticio)» a «Sonora —
   Hermosillo».
2. Abro la agenda con la computadora en hora de Mérida.
3. Cambio la zona del sistema a Hermosillo y la vuelvo a abrir.
4. Devuelvo «Hospital Norte» a Yucatán.

**Qué debo ver:**
- encima de la agenda, en gris y con un globito, «Mostrando el horario de tu
  ubicación actual (UTC−6, Mérida)»;
- en Hermosillo, «(UTC−7, Hermosillo)», y todo una hora antes;
- con los dos consultorios otra vez en Yucatán, ya no sale;
- en el teléfono se parte en dos renglones y se lee entera;
- con la v2 apagada, nunca.

**Si falla, significa que…** la agenda no avisa de que las horas son las de la
computadora, o avisa sin hacer falta.

#### K4-2. El gris es el de cada consultorio, en su hora

**Qué hago:**
1. Pongo «Hospital Norte» en Sonora con horario propio de 08:00 a 12:00 y
   «Consultorio Centro» (Yucatán) de 10:00 a 14:00.
2. Con la computadora en Mérida, elijo «Hosp Norte» como activo.
3. Paso a «Centro» y vuelvo, sin recargar.
4. Elijo «Todos los médicos».
5. Al terminar, lo devuelvo todo como estaba.

**Qué debo ver:**
- con «Hosp Norte», el blanco de 09:00 a 13:00; con «Centro», de 10:00 a 14:00,
  y cambia en el acto;
- con «Todos los médicos», de la apertura más temprana al cierre más tardío;
- un consultorio en Sonora SIN horario propio usa el de la clínica en hora de
  Sonora: 08:00–18:00 se ve de 09:00 a 19:00.

**Si falla, significa que…** el gris sale del horario de la clínica, o no
convierte la hora.

#### K4-3. Guardar ya no se queda esperando con la v2 apagada

**Qué hago:** con la v2 APAGADA (Clínica B), edito una cita y pulso «Guardar».
Luego lo mismo con la v2 encendida (Clínica A).

**Qué debo ver:**
- apagada, la ventana desaparece en el acto, como antes del proyecto;
- encendida, se desvanece en una fracción de segundo (la salida animada del
  bloque F);
- en las dos, la tarjeta cambia en el acto.

**Si falla, significa que…** la animación de la v2 se coló en la agenda
apagada. La integración K la puso detrás del interruptor (AG-DT-146).

### K5 · Las marcas de procedencia y la burbuja de la cita (puntos 17 a 21)

#### K5-1. Un solo icono para «sin expediente»

**Qué hago:** con la v2 encendida, abro en Semana una reserva por enlace sin
ligar y un evento «por asignar» de Google (C0). Luego el Mes y la lista del día
del teléfono.

**Qué debo ver:**
- ninguna dice «Por ligar» ni «Por asignar»: las dos llevan el mismo
  expediente tachado en rojo;
- la caja dice «… · Sin expediente» (y, si traía cancelaciones, «Al reservar
  traía N…»);
- con la v2 apagada, las píldoras de siempre.

**Si falla, significa que…** quedaron dos marcas para lo mismo, o la v2 apagada
cambió.

#### K5-2. El eslabón se queda después de ligar

**Qué hago:** ligo la reserva de K5-1 (J3) y vuelvo a la agenda.

**Qué debo ver:**
- el tachado desaparece;
- el eslabón se queda en la caja, en la burbuja («La apartó con tu enlace») y
  en «Próximas citas» («Por enlace»).

**Si falla, significa que…** se pierde de dónde vino la cita.

#### K5-3. La leyenda con las tres marcas

**Qué hago:** engrane › «Leyenda de estados», con la v2 encendida y luego
apagada.

**Qué debo ver:**
- encendida: «Bloqueo», la «G» de colores «Se agendó en Google», el eslabón «Se
  agendó por enlace» y el tachado «Sin expediente»;
- apagada: la de siempre.

**Si falla, significa que…** la leyenda no explica la rejilla.

#### K5-4. La burbuja de una agendada, como la maqueta

**Qué hago:** pulso una agendada futura de «Paciente Prueba 05», en escritorio y
en teléfono.

**Qué debo ver:**
- arriba, la píldora «Agendada», los tres puntos y la ✕, y el nombre grande;
- el bloque gris con la hora, la duración, el día y, con más de un médico, sus
  iniciales y su nombre;
- «Iniciar consulta» azul a todo el ancho;
- tres casillas: «Confirmar», «Reagendar» y «Editar»;
- abajo, «Cancelar cita» en rojo;
- sin engrane.

**Si falla, significa que…** la burbuja no sigue la maqueta.

#### K5-5. «Confirmar» abre tres opciones

**Qué hago:** pulso «Confirmar». Luego lo mismo en una cita sin teléfono y en
otra sin correo.

**Qué debo ver:**
- «Enviar por WhatsApp», «Enviar por correo» y «Marcar como confirmada»;
- sin teléfono no sale el WhatsApp, y sin correo no sale el correo;
- Escape cierra las opciones y deja la burbuja abierta.

**Si falla, significa que…** las opciones no siguen la regla de cada paciente.

#### K5-6. Los tres puntos

**Qué hago:** pulso los tres puntos de una agendada y luego los de una
confirmada.

**Qué debo ver:**
- en la agendada: «Observaciones», «Tipo de cita», «No asistió», y el
  consultorio y el teléfono como datos;
- en la confirmada, además, «Recordatorio por WhatsApp» y «Recordatorio por
  correo»; su «No asistió» va en las casillas;
- «No asistió» marca sin preguntar (pendiente de tu decisión, AG-DT-192);
- Escape devuelve el foco a los tres puntos.

**Si falla, significa que…** se perdió una acción de la tarjeta de antes.

#### K5-7. Cancelada y no asistió

**Qué hago:** pulso una cancelada y una «no asistió».

**Qué debo ver:**
- en la cancelada, «Esta cita se canceló. Su horario quedó libre.», «Darle otra
  cita» y «Reasignar el horario»;
- en la no asistió, «El paciente no llegó a esta cita.» y «Darle otra cita»;
- ninguna tiene «Cancelar cita».

**Si falla, significa que…** las puertas cambiaron.

#### K5-8. Sin expediente, Google y enlace en la burbuja

**Qué hago:** pulso una por asignar de Google, una reserva sin ligar y una ya
ligada.

**Qué debo ver:**
- en la de Google: «Llegó de Google Calendar» con la «G», el tachado, «Ligar
  expediente e iniciar» y, en el pie, «No es una cita» y «Cancelar cita»;
- en la reserva sin ligar: el eslabón y el tachado;
- en la ligada: el eslabón, sin el tachado.

**Si falla, significa que…** las marcas de la burbuja no son las de la rejilla.

### Integración de la tanda K

#### K-INT-1. «Reagendar» a un horario bloqueado pregunta

**Qué hago:**
1. Bloqueo de 18:00 a 19:00 el día de una cita reservada por enlace (la de
   I2-6).
2. Abro la cita › «Reagendar» y pongo 18:00 › «Revisar cambio».
3. Pulso «Corregir»; luego «Revisar cambio» otra vez y «Aceptar».

**Qué debo ver:**
- «Este horario está bloqueado. ¿Agendar de todos modos?»;
- «Corregir» vuelve a los datos;
- «Aceptar» lleva a «¿Reagendar la cita con estos datos?», y nada cambia hasta
  confirmar;
- a una hora sin bloqueo, la pregunta no sale.

**Si falla, significa que…** «Reagendar» se salta el bloqueo, que los demás
caminos sí preguntan.

#### K-INT-2. La burbuja nueva conserva lo de antes

**Qué hago:** en la burbuja nueva (K5) pruebo:
- «Reagendar» de una reserva con candado, que debe abrir el panel de I2-6 e
  I2-8;
- «Ligar expediente e iniciar», que abre la ventana de J3;
- «No es una cita» (I3-3);
- la burbuja que llega desde un aviso de la campana, con «Reagendar» destacado
  (J4-3);
- la pregunta de asistencia (I4-3);
- y una atendida con nota, que no se puede cambiar.

**Qué debo ver:** cada una se comporta como en su prueba original.

**Si falla, significa que…** la burbuja nueva perdió una puerta.

### Qué repetir tras la tanda K

Antes de nada, P5 a P8: la base pasa a **45** migraciones. Después, las nuevas
de esta sección, y éstas, que ya existían y cambian o hay que repetir.

**Bloque B y tanda J (configuración)**
- **J5-1 y J5-6:** para Dr. Admin, primero «Horario de la clínica» («Paso 1 de
  4»). «¿Cuándo das consulta?» pasa a «Paso 2 de 4», y el resumen tiene una
  fila más.
- **J5-2:** la duración es el «Paso 3 de 4».
- **J5-3:** una fila más en el resumen.
- **J5-5:** la tarjeta está arriba de todo y deja cambiar el huso.
- **J2-1:** «Paso 1 de 4» en lugar de «Paso 1 de 3».
- **T2-3 y las de «Tu enlace» de J5:** apagar ya no pide confirmación ni
  revoca, y prender devuelve la misma dirección (K3-14).
- **H2 «5»:** las pestañas del teléfono ya no se desplazan: caben (K3-13).

**Bloque D (reserva)**
- **D4:** tras «Enviar otro código», la cuenta atrás de 30 s. El código anterior
  dice «Ese código es de un correo anterior…» y no cuenta.
- **H1-1:** «Volver» y «Continuar» desde «Revisa tu correo» ya no piden otro
  código.
- **SEG-A5:** **cambia al revés.** Un evento de todo el día ya NO cierra el día
  en el enlace; lo cierra un bloqueo (K1-5).
- **SEG-A8:**
  - los pedidos 2 a 4 dentro de los 30 s dicen «Espera N s…» y no gastan el
    tope;
  - el límite por red y por navegador dice «Podrás volver a probar en N min.»;
  - la tabla gana la fila «Pedir otro código al mismo correo en ese enlace: 1
    cada 30 s».
- **§1.6:** el texto puede ser «Podrás volver a probar en N min.».
- **D2, D8, D10 y D11:** la cita «Por ligar» se reconoce por el expediente
  tachado y el eslabón.

**Bloque E**
- **E3, G3-1 e I1-4:** «Confirmo mi asistencia» del correo confirma al abrir.
- **E4:** repetirla; «No podré asistir» no cambia.
- **E10:** el WhatsApp está dentro de «Confirmar» (agendada) o en los tres
  puntos (confirmada).

**Bloque F, G, T e I (la tarjeta pasa a ser la burbuja de K5)**
- **F22, G3-2 e I2-4:** «Editar» (casilla) en vez del engrane «Configuración de
  la cita». Consultorio, teléfono y nota están en los tres puntos.
- **G3-4:** la sustituyen K5-4 y K5-5.
- **G3-5:**
  - confirmada: «Reagendar | Editar | No asistió»;
  - atendida: «Ver la consulta»;
  - cancelada: «Darle otra cita» y «Reasignar el horario»;
  - no asistió: «Darle otra cita».
- **T1-6 y T1-7:** «Enviar por WhatsApp» tras «Confirmar», o en los tres
  puntos.
- **I3-2 e I3-3:**
  - sin la píldora «POR ASIGNAR»: el tachado;
  - «No es una cita», sin signos, en el pie de la burbuja;
  - en Próximas, el formulario y la campana sigue «¿No es una cita?».
- **I4-4:** «Reasignar» pasa a «Reasignar el horario», y «Reagendar cita» a
  «Darle otra cita».
- **J3-2:** «Ligar expediente e iniciar» en la burbuja (la ventana se sigue
  llamando «Ligar e iniciar consulta»).
- **J4-4:** la «G» va en «Llegó de Google Calendar». La leyenda suma «Bloqueo»,
  el eslabón y el tachado.
- **G4-5 y T2-6** (consultorio en Tijuana): sale además la leyenda de la hora
  de tu ubicación (K4-1).
- **A5:** con la v2 apagada, la ventana se va en el acto (K4-3).

**Apagado**
- **X1 y X7:** nada de lo de arriba se ve, ni la franja ni la burbuja nueva, y
  la ventana se va sin animación.

---

## 8-octies. Tanda L (2026-11-19)

Lo que se hizo con tus puntos de la tanda L, en cinco grupos. Todo lo que se ve
va detrás del interruptor de la v2:

- **L1:** el bloqueo pasa a ser total, se edita pulsando en cualquier parte de
  la franja y se crea con el candado junto a la campana (puntos 5 a 8).
- **L2:** la burbuja de la cita: «No asistió» pregunta, «Eliminar cita» en las
  canceladas, el botón de la leyenda y la letra (puntos 2, 3, 9, 11 y 12).
- **L3:** la configuración: la letra de la reserva, «Solo el administrador…» y
  la secretaria con el diseño nuevo (puntos 12, 16 y 17).
- **L4:** confirmar con un gesto, el código fuera de Sentry, el nombre y el
  teléfono al volver a la reserva y el saludo del correo (puntos 1, 4, 10 y
  15).
- **L5:** el aviso cuando el paciente confirma, el número en la campana y Google
  con las reservas por enlace (puntos 13, 14 y 18).

**Antes de empezar:**

- La base con las **48** migraciones (P5: las 45 de antes más las 3
  `20261124…` de la tanda L). La consulta de P5 debe responder
  `48|20261124160000`.
- Sembrada (P6), con el aviso aprobado (P7) y la v2 encendida en la Clínica A
  (P8).
- La app del 3000 (P11).
- El Google simulado (C0) para L1-7 y L5-4.
- Mailpit para L4 y L5.

Si al abrir la agenda sale «¿Asistió el paciente?», es la ventana de I4-3: pulsa
«Decidir después» y sigue (I4-5).

### L1 · El bloqueo total (puntos 5 a 8)

#### L1-1. El candado, junto a la campana

**Qué hago:** con la v2 encendida, miro la barra de la agenda en computadora y
en el teléfono.

**Qué debo ver:**
- junto a la campana, a su derecha, un candado («Bloquear horario» al pasar el
  ratón);
- en el teléfono, igual, en la banda de arriba.

**Si falla, significa que…** falta el punto 8.

#### L1-2. Crear un bloqueo con el candado

**Qué hago:**
1. Pulso el candado, desmarco «Días completos», pongo un día de 15:00 a 17:00
   con el motivo «Congreso» y guardo.
2. Pulso un hueco libre y luego abro «Agendar».

**Qué debo ver:**
- al abrir el candado, el día de hoy con «Días completos» marcado; al
  desmarcarlo, 09:00–10:00;
- la franja rayada de 15:00 a 17:00 con «Bloqueado · Congreso»;
- la burbuja ya no tiene «Bloquear este horario» y «Agendar» ya no tiene la
  posición «Bloqueo».

**Si falla, significa que…** el alta desde el candado no funciona, o quedan las
entradas viejas.

#### L1-3. Pulsar en cualquier parte de la franja abre el bloqueo

**Qué hago:**
1. Pulso en la franja de L1-2, abajo (no en el rótulo).
2. Pulso una cita que esté encima de la franja.
3. Bloqueo un día completo con el candado y pulso esa columna.
4. En el teléfono, en Semana, toco la fila del bloqueo (en el lado derecho).

**Qué debo ver:**
- en 1, «Bloqueo de horario» con 15:00, 17:00, «Congreso» y «Quitar bloqueo», y
  ninguna burbuja;
- en 2, la tarjeta de esa cita, no el bloqueo;
- en 3, la edición con «Días completos» marcado y ese día;
- en 4, su edición con los datos.

**Si falla, significa que…** falta el punto 7, o el bloqueo se come los clics de
las citas.

**Ojo:** con «Todos los médicos», pulsar la franja de un médico abre SU bloqueo
aunque quieras agendar a otro; para eso está «Agendar» (pendiente de tu
decisión, §6-bis «Tanda L»).

#### L1-4. Dentro del bloqueo no se agenda (burbuja y formulario)

**Qué hago:**
1. En una burbuja fuera de la franja elijo paciente, cambio la hora a 15:30 y
   pulso «Guardar».
2. Abro «Agendar» con hora 16:00–16:30 ese día. Luego cambio a 13:00.

**Qué debo ver:**
- en los dos, en rojo bajo las horas, «Este horario está bloqueado. Quita el
  bloqueo para agendar aquí.»;
- no se agenda y no sale ninguna pregunta;
- en el formulario, «Guardar» apagado; con 13:00, encendido.

**Si falla, significa que…** se deja agendar dentro, o volvió la pregunta «¿…
de todos modos?».

#### L1-5. Dentro del bloqueo no se mueve (arrastre y «Reagendar»)

**Qué hago:**
1. Arrastro una cita a la franja y recargo.
2. En una cita reservada por enlace, «Reagendar» a una hora dentro de la
   franja.

**Qué debo ver:**
- la cita vuelve a su sitio con el mismo texto; al recargar sigue donde estaba;
- en «Reagendar», el texto en rojo, sin confirmación.

**Si falla, significa que…** el arrastre o «Reagendar» dejan meter la cita en el
bloqueo.

**Ojo:** «Reagendar» también se niega si sólo cambias el consultorio a la misma
hora dentro del bloqueo (pendiente de tu decisión, AG-DT-202).

#### L1-6. Lo que ya estaba dentro se puede editar

**Qué hago:** en una cita que ya estaba dentro de la franja antes de crear el
bloqueo, pulso «Editar» y cambio sólo las notas. Luego le cambio la hora a otra
dentro de la franja.

**Qué debo ver:**
- con las notas, se guarda;
- con la hora, sale el texto en rojo.

**Si falla, significa que…** lo que ya estaba dentro quedó atrapado, o se deja
mover.

#### L1-7. Google entra como hoy

**Qué hago:** con Google (simulado) conectado, muevo en Google un evento a la
hora bloqueada y abro la agenda.

**Qué debo ver:** el evento entra en Spinus como hoy, a esa hora.

**Si falla, significa que…** lo de Google quedó bloqueado, y no se puede
rechazar.

#### L1-8. Apagada

**Qué hago:** apago la v2.

**Qué debo ver:** sin candado ni franja; todo como antes.

**Si falla, significa que…** el interruptor no aísla el cambio.

### L2 · La burbuja de la cita (puntos 2, 3, 9, 11 y 12)

#### L2-1. «No asistió» pregunta antes

**Qué hago:**
1. Con la v2 encendida, en una cita CONFIRMADA pulso «No asistió» en las
   casillas de la burbuja y luego «Cancelar».
2. En una AGENDADA abro los tres puntos › «No asistió» y pulso «Aceptar».

**Qué debo ver:**
- las dos veces, «¿Marcar que {paciente} no asistió? La cita se queda en la
  agenda como «No asistió».», con «Cancelar» y «Aceptar»;
- con «Cancelar», la cita sigue confirmada;
- con «Aceptar», pasa a «No asistió»;
- la ventana «¿Asistió el paciente?» al abrir la agenda NO pregunta dos veces.

**Si falla, significa que…** «No asistió» volvió a ser de un toque (AG-DT-192).

#### L2-2. «Eliminar cita» quita una cancelada de la agenda, también en otra pantalla

**Qué hago:**
1. Abro la agenda en dos navegadores, el del Dr. Admin y el de la secretaria,
   en la misma semana.
2. En el del Dr. Admin pulso una cita CANCELADA, luego «Eliminar cita» y luego
   «Cancelar».
3. Repito y pulso «Aceptar».

**Qué debo ver:**
- la burbuja de la cancelada tiene «Darle otra cita», «Reasignar el horario» y,
  en el pie, «Eliminar cita»;
- el aviso dice «¿Eliminar la cita cancelada de {paciente}? Sale de la agenda y
  no se puede deshacer; queda guardada en el historial.»;
- con «Cancelar» no pasa nada;
- con «Aceptar», la cita desaparece en los DOS navegadores sin recargar, y al
  recargar sigue sin estar;
- el buscador por paciente ya no la encuentra;
- una cancelada por ligar (de enlace, sin expediente) no tiene «Eliminar cita».

**Si falla, significa que…** el cierre no llegó a la base, o el tiempo real no la
quitó.

#### L2-3. «Eliminar cita» no borra

**Qué hago:** tras L2-2, en el editor SQL local:

```sql
select status, cerrada_en, sustituida_por from appointments where id = '…';
select accion from audit_log where registro_id = '…' order by created_at;
```

**Qué debo ver:**
- la cita sigue: `cancelled`, con `cerrada_en` y con `sustituida_por` vacío;
- en `audit_log`, `cita_quitada_de_agenda` y `cita_editada`.

**Si falla, significa que…** se borró o no se auditó: grave.

#### L2-4. El botón de la leyenda (computadora)

**Qué hago:** con la v2 encendida, en computadora, pulso el botón (i) a la
izquierda de Mes/Semana/Día y luego Escape. Después, engrane › «Leyenda de
estados». Por último, lo mismo en el teléfono y en la Clínica B (v2 apagada).

**Qué debo ver:**
- la misma leyenda de K5-3, colgada del botón; con Escape se cierra y el foco
  vuelve al botón;
- en el engrane sigue la opción;
- en el teléfono y con la v2 apagada, no hay botón.

**Si falla, significa que…** el botón no sale, o abre otra leyenda.

#### L2-5. La letra de la burbuja

**Qué hago:** abro la burbuja de una cita, en el teléfono y en computadora, y al
lado abro `/reservar/{código}`.

**Qué debo ver:**
- el nombre a 18 px, la hora a 15 y el resto a 14, como los títulos, horas y
  textos de la reserva;
- la píldora del estado en seminegrita, como las píldoras de la reserva, y la
  ayuda de una cancelada («Esta cita se canceló…») como las notas al pie de la
  reserva;
- los botones del mismo tamaño que antes: ninguno más chico que un dedo (44
  px).

**Si falla, significa que…** la escala se desvió de la reserva.

### L3 · La configuración (puntos 12, 16 y 17)

#### L3-12. La letra de la configuración, como la de la reserva

**Qué hago:** abro un enlace de reserva en una pestaña y, en otra,
«Configuración de la agenda» como Dr. Admin, en el teléfono y en la
computadora. Recorro las cinco pestañas y, con la Dra. Invitada en su primera
vez, los pasos.

**Qué debo ver:**
- el título «Configuración de la agenda» del mismo tamaño que el título de la
  reserva, más chico que antes;
- textos, etiquetas y botones del mismo tamaño que los de la reserva: nada se
  ve más grande que allá;
- los botones y los interruptores igual de fáciles de tocar que antes.

**Si falla, significa que…** alguna parte volvió a los tamaños de las maquetas,
o un control quedó demasiado chico para el dedo.

#### L3-16. «Solo el administrador de la clínica puede cambiar estas opciones.»

**Qué hago:** como Dra. Invitada y como secretaria, «Configuración de la agenda»
› «Cuándo das/dan consulta» y «Avisos». Luego, como Dra. Invitada en su primera
vez, los pasos 1 y 3. Por último, lo mismo como Dr. Admin.

**Qué debo ver:**
- en la tarjeta «Horario de la clínica», una vez, «Solo el administrador de la
  clínica puede cambiar estas opciones.»;
- en «Avisos», la misma frase una sola vez, arriba, aunque haya tres bloques;
- en el paso 1, debajo de los consultorios, «El horario de la clínica es …» y la
  frase; en el paso 3, la frase;
- en ningún sitio «Lo cambia quien administra la clínica.» ni «Estos avisos los
  cambia quien administra la clínica.»;
- en «Tu consulta» / «Tipos de cita», ninguna frase;
- como Dr. Admin, la frase en ningún sitio.

**Si falla, significa que…** quien no administra no sabe por qué no puede
cambiar algo, o la frase sale donde no es cierta.

#### L3-17. La secretaria, con el diseño nuevo

**Qué hago:** como secretaria, «Configuración de la agenda». Recorro las cinco
pestañas, abro «Enlaces de los demás médicos» y, en el enlace de la Dra.
Invitada (si dice «No abrirá» por la duración), pulso «Completar». Luego lo
mismo como Dr. Admin.

**Qué debo ver:**
- las mismas cinco pestañas y la misma estética que el Dr. Admin: filas grises,
  «Mostrar enlace», «Regenerar» y «Revocar» (en rojo) con borde, campos y
  botones del mismo alto que los demás; ningún botón chiquito;
- como secretaria, en «Completar», «La duración de la consulta.» y «El médico la
  contesta en su configuración.», sin botones de duración;
- como Dr. Admin, «¿Cuánto dura su consulta?» con 30 min / 45 min / 1 hora /
  Otra, y al guardar el enlace deja de decir que le falta la duración.

**Si falla, significa que…** la secretaria volvió a la versión anterior, o se le
ofrece algo que al guardar falla.

### L4 · Confirmar, la reserva y el saludo (puntos 1, 4, 10 y 15)

#### L4-1. «Confirmo mi asistencia» espera a la persona

**Qué hago:** desde el correo «Confirma tu cita», pulso «Confirmo mi
asistencia». Cuando abre, toco o hago clic en la fecha o en el texto de la
tarjeta (no en un botón).

**Qué debo ver:**
- al abrir, la cita y el botón; **no** dice «confirmada»;
- tras el toque, «Gracias. Tu asistencia quedó confirmada.»;
- la agenda abierta lo ve sin recargar.

**Si falla, significa que…** vuelve a confirmar sola al abrir (AG-DT-175), o el
gesto no basta.

#### L4-2. Ir a «No podré asistir» no confirma

**Qué hago:**
1. Abro otro enlace «Confirmo mi asistencia» y pulso «No podré asistir» con el
   ratón (o con el dedo).
2. Repito con el teclado: Tab hasta «No podré asistir» y Enter.
3. Repito pulsando Espacio, flechas o F11 en la página.

**Qué debo ver:**
- en 1 y 2, el paso de cancelar; la cita sigue agendada, **sin** confirmar;
- en 3, nada se confirma.

**Si falla, significa que…** llegar a «No podré asistir» confirma por el camino.

#### L4-3. «Continuar mi reserva» conserva el nombre y el teléfono

**Qué hago:**
1. Reservo desde el enlace público hasta «Revisa tu correo».
2. En el correo del código pulso «Continuar mi reserva»: se abre otra pestaña
   con el código puesto. Pulso «Verificar y reservar».
3. Marco la casilla y pulso «Reservar cita».
4. Variante: en la pestaña nueva pulso «Volver» antes de verificar, marco la
   casilla y pulso «Enviar código a mi correo».
5. Variante: recargo dos veces en el paso del código y verifico.

**Qué debo ver:**
- en 2, «Tu correo ya está verificado. Completa tus datos para reservar.»,
  nombre, teléfono y correo **ya escritos** y la casilla del aviso sin marcar;
- en 3, «Tu cita quedó agendada», con mi nombre en la agenda y sin otro correo
  de código;
- en 4, nombre y teléfono ya escritos; vuelve al código **sin** mandar otro
  correo, y verificar ya reserva;
- en 5, el formulario con el nombre y el teléfono.

**Si falla, significa que…** el paciente tiene que volver a teclear sus datos, o
lo restaurado reserva sin su consentimiento.

**Ojo:** no reserva solo a propósito: hay que marcar la casilla y pulsar otra
vez (pendiente de tu decisión, AG-DT-220).

#### L4-4. El correo de confirmación saluda por el nombre

**Qué hago:**
1. Desde la agenda mando la confirmación por correo de una cita con paciente.
2. Lo mismo con una cita de reserva en línea sin paciente ligado.
3. Miro también un recordatorio y un aviso de cambio.

**Qué debo ver:**
- en 1, «Hola, <nombre>:» bajo «Confirma tu cita», sólo con el nombre del
  paciente, sin apellidos ni nada clínico; el asunto, sin nombre;
- en 2, el nombre tal como se tecleó al reservar;
- en 3, ningún saludo.

**Si falla, significa que…** el saludo falta, lleva de más o salió en otros
correos.

### L5 · La campana (puntos 13, 14 y 18)

#### L5-1. El paciente confirma desde su enlace

**Qué hago:** con la agenda abierta, agendo para mañana a un paciente de la
semilla que tenga correo y le mando la confirmación desde la campana («Por
confirmar», el botón del sobre). En otra ventana sin sesión abro el enlace del
correo (Mailpit) y pulso «Confirmo mi asistencia».

**Qué debo ver:**
- en uno o dos segundos, un emergente breve «Un paciente confirmó su cita del
  [día] a las [hora].», sin nombre;
- en la campana, la cita sale de «Por confirmar» y en «Avisos» aparece «[su
  nombre] confirmó su cita del [día] a las [hora]»;
- al pulsarlo se abre la cita.

**Si falla, significa que…** sin aviso en «Avisos», falta la migración de L5;
con aviso pero sin emergente ni cambio en vivo, la campana no recarga con el
tiempo real.

#### L5-2. Sólo uno, y el personal no avisa

**Qué hago:** vuelvo a abrir el enlace de L5-1, pulso otra vez y recargo la
agenda. Luego, a otra cita de mañana, le pulso yo «Confirmar» en su tarjeta.

**Qué debo ver:** un solo aviso de la cita de L5-1. La que confirmé yo no da
aviso ni emergente.

**Si falla, significa que…** con dos avisos, la deduplicación no funciona; con
aviso de la mía, el aviso no distingue al paciente del personal.

#### L5-3. La burbuja con el número

**Qué hago:** en escritorio y en el teléfono, miro la campana con citas de mañana
sin confirmar y algún aviso sin revisar. Abro la campana y comparo con las
pestañas. Marco los avisos como revisados. Confirmo todas las de mañana.

**Qué debo ver:**
- una burbuja roja con el número en blanco igual a «Por confirmar · n» +
  «Avisos · m» (con más de 9, «9+»);
- baja al revisar; sin pendientes, sin burbuja;
- con lector de pantalla, la campana dice «… 3 pendientes» (o «1 pendiente»).

**Si falla, significa que…** la burbuja no cuenta lo mismo que la campana.

#### L5-4. Google mueve una cita reservada por enlace

**Qué hago:** reservo por enlace para la semana que entra; en Google (simulado o
el de verdad) la muevo una hora; abro la agenda.

**Qué debo ver:**
- en Spinus sigue en su hora, en el mismo sitio de la rejilla;
- Google vuelve a su hora;
- en la campana, el aviso «Desde Google no se pueden mover…»; al pulsarlo, la
  tarjeta con «Reagendar» grande arriba y seleccionado.

**Si falla, significa que…** si en Spinus cambió la hora, el candado de la
reserva no funciona: grave.

### Integración de la tanda L

#### L-INT-1. «Eliminar cita» dentro de un bloqueo

**Qué hago:** con el candado, bloqueo una hora en la que haya una cita CANCELADA
con paciente. Pulso la cancelada › «Eliminar cita» › «Aceptar». Después pulso
otra cancelada fuera del bloqueo › «Reasignar el horario» y elijo una hora
dentro del bloqueo.

**Qué debo ver:**
- la cancelada sale de la agenda: el bloqueo no lo impide, porque cerrarla no la
  mueve;
- al reasignar dentro del bloqueo, no nace la cita nueva (sale el texto del
  bloqueo) y la cancelada sigue en la agenda, sin cerrar.

**Si falla, significa que…** el bloqueo y el cierre de L2 chocan en la base.

### Qué repetir tras la tanda L

Antes de nada, P5 a P8: la base pasa a **48** migraciones. Después, las nuevas
de esta sección, y éstas, que ya existían y cambian o hay que repetir.

**Tanda K (el bloqueo)**
- **K1-1:** el bloqueo ya no se crea desde «Agendar» › «Bloqueo», sino con el
  candado (L1-2).
- **K1-2:** **cambia.** Ya no sale «Este horario está bloqueado. ¿Agendar de
  todos modos?»: la burbuja y el formulario dicen el texto en rojo y no
  agendan, y el arrastre devuelve la cita (L1-4, L1-5). Un evento sin paciente
  tampoco entra.
- **K1-3:** la edición se abre pulsando cualquier parte de la franja, no sólo el
  rótulo (L1-3).
- **K1-4:** «Bloquear este horario» de la burbuja ya no existe: días completos
  con el candado.
- **K-INT-1:** **cambia.** «Reagendar» a un horario bloqueado no pregunta: dice
  el texto en rojo (L1-5).

**Bloque B y tandas H, J y K (configuración)**
- **K3-11 y J5-5:** la frase de quien no administra es ahora «Solo el
  administrador de la clínica puede cambiar estas opciones.».
- **B2 y B3** (quién cambia los ajustes): en «Avisos», la frase nueva en lugar
  de «Lo cambia quien administra la clínica.».
- **H2-2:** las fichas que ve la secretaria y las plegadas del Dr. Admin tienen
  el diseño nuevo.
- **H2-3:** los botones de las fichas de los demás médicos siguen con borde y
  fondo, ahora de 44 px y sobre una fila gris.
- **H2-5:** la Dra. Invitada y la secretaria ven el recordatorio deshabilitado
  y, arriba de los avisos, la frase nueva.
- **J5-1, J5-2, J5-3 y K3-13:** los mismos pasos y pestañas, con la letra más
  chica.

**Bloque D y E (reserva y confirmación)**
- **K2-1:** **cambia.** «Confirmo mi asistencia» ya no confirma solo al abrir;
  espera un toque en la página (L4-1).
- **K2-2:** repetir.
- **K2-4 y K2-6:** **cambian.** Tras verificar, «Tus datos» sale ya escrito y
  hay que marcar la casilla y pulsar «Reservar cita» (L4-3).
- **E3:** confirmar la asistencia ahora espera el toque y además avisa a la
  clínica en la campana (L4-1, L5-1).
- **G3-1, I1-4 y H1-1:** repetir.

**Tandas G, H, I, J y K (la burbuja y la campana)**
- **G3-5:** en la cancelada, además, «Eliminar cita» en el pie.
- **K5-7:** **ojo**, la cancelada suma «Eliminar cita» en el pie. El resto
  sigue igual, y sigue sin «Cancelar cita».
- **K5-4 y K5-6:** la burbuja con la letra nueva, y «No asistió» de los tres
  puntos pregunta antes (L2-1).
- **K5-3 e I5-3:** la leyenda del engrane, igual; en computadora, además, el
  botón (i) (L2-4).
- **I4-3:** la ventana de asistencia, sin confirmación nueva.
- **I4-4:** «Reasignar el horario» sigue cerrando con sustituta.
- **K4-3:** guardar con la v2 apagada, sin cambio.
- **H4-4:** al confirmar el paciente, además, el aviso en «Avisos».
- **H4-5 e I5-4:** el punto rojo «sin número» pasa a burbuja CON número (L5-3).
- **I5-6:** un tipo de aviso más, la confirmación del paciente.
- **J4-1 y J4-3:** repetir; los cubre también la e2e nueva del punto 18 (L5-4).

**Apagado**
- **X1 y X7:** nada de lo de arriba se ve: ni el candado, ni el botón (i), ni
  «Eliminar cita», ni el número de la campana.

---

## 8-nonies. Tanda M (2026-11-19)

Lo que se hizo con tus puntos de la tanda M, en cinco grupos. Lo de la agenda va detrás del
interruptor de la v2; los correos y la reserva son las páginas públicas de siempre:

- **M1:** la burbuja de la cita en computadora, con las medidas de la tanda J, y los tres puntos que
  abren el formulario (puntos 1 y 4).
- **M2:** la configuración más compacta en computadora y el aviso «Solo el médico administrador…»
  según quién entra (puntos 2 y 15).
- **M3:** la barra sin trozos, «Bloqueo» de vuelta en «Nueva cita» y el rayado sólo en el horario
  (puntos 3, 5 y 6).
- **M4:** «Tu correo ya está verificado» en verde, «Salir» al terminar la reserva, las pruebas sin
  depender del huso y sin borrar auditoría (puntos 7, 8, 16 y 17).
- **M5:** los correos de la agenda con las maquetas (puntos 9 a 14).
- **Integración:** la migración aparte que impide vaciar el `audit_log` (tu encargo), y tus
  decisiones del 2026-11-19: los avisos de la secretaria con texto propio en dos pestañas, el
  recordatorio y el aviso de cambio saludando por nombre, el pie del correo más oscuro (con una
  migración pequeña de la agenda, `20261125180000`), la barra y el plazo de cancelar como estaban.

**Antes de empezar:**

- **P5 (reiniciar la base) ya se puede hacer**: dijiste que `supabase db reset --local` crea una
  base de pruebas nueva y no es borrar auditoría. En esta integración **no se hizo** (el sistema de
  permisos de la sesión lo bloqueó), así que la base que dejé es la de la tanda L más dos migraciones.
  Si reinicias, P5 aplica las **50** y su consulta debe responder `50|20261125180000`.
- Si no reinicias, la base ya tiene las **50** (las 48 de la tanda L,
  `20261125170000_audit_log_sin_truncate.sql`, que no es de la agenda, y
  `20261125180000_agenda_m_saludo_recordatorio.sql`): la consulta de P5 responde lo mismo. Si a tu
  base le faltara alguna, aplícalas solas y en ese orden (no borran nada):

  ```bash
  docker exec -i supabase_db_app_ortointegra psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261125170000_audit_log_sin_truncate.sql
  docker exec -i supabase_db_app_ortointegra psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261125180000_agenda_m_saludo_recordatorio.sql
  ```

  Al final, una tabla con «OK» en las filas 1 a 5.
- Sembrada (P6), con el aviso aprobado (P7) y la v2 encendida en la Clínica A (P8). Sembrar no borra
  auditoría.
- La app del 3000 (P11) y Mailpit para M4 y M5.

Si al abrir la agenda sale «¿Asistió el paciente?», es la ventana de I4-3: pulsa «Decidir después» y
sigue (I4-5).

### M1 · La burbuja de la cita (puntos 1 y 4)

#### M1-1. La burbuja en computadora, del tamaño de antes

**Qué hago:** en computadora, a pantalla completa (1920 y también 1366), pulso una agendada de
«Paciente Prueba 05» y luego una confirmada.

**Qué debo ver:**
- el mismo diseño de K5: la franja de color, la píldora, el recuadro gris con la hora y el médico,
  y los iconos en las casillas;
- la burbuja más chica: más o menos del ancho de la columna de un día y medio, con el nombre
  pequeño (16 px) y la píldora más chica;
- en las casillas («Confirmar», «Reagendar», «Editar»), el icono **a la izquierda** del texto, no
  encima;
- la ✕ y los tres puntos más chicos que antes.

**Si falla, significa que…** la computadora volvió a la burbuja grande o el cambio alcanzó al
teléfono.

#### M1-2. En el teléfono, igual que antes

**Qué hago:** en el teléfono pulso la misma cita.

**Qué debo ver:**
- la hoja de abajo, como hasta ahora;
- el nombre grande, el icono de las casillas encima del texto y botones del tamaño de un dedo.

**Si falla, significa que…** el cambio de computadora se coló en el teléfono.

#### M1-3. La burbuja nunca se sale

**Qué hago:** en una ventana baja (por ejemplo 1366×650, o el navegador sin maximizar), pulso una
cita del lunes a las 7:00, otra del domingo a las 20:00 y otra del lunes a las 20:00, y en cada una
abro «Confirmar».

**Qué debo ver:** la burbuja entera dentro de la ventana, con su «Cancelar cita» a la vista o
alcanzable desplazando dentro de la burbuja.

**Si falla, significa que…** la colocación dejó de acotarse a la ventana.

#### M1-4. Los tres puntos abren el formulario

**Qué hago:** en una agendada pulso los tres puntos.

**Qué debo ver:**
- se cierra la burbuja y se abre «Editar cita» directamente, sin menú chico;
- ahí están las notas, el tipo de cita, el consultorio y, en el estado, «No asistió»;
- si elijo «No asistió» y pulso «Guardar», la cita queda como «No asistió».

**Si falla, significa que…** volvió el menú chico o el formulario no recibe la cita.

#### M1-5. Las observaciones en una línea

**Qué hago:**
1. A una agendada le escribo en «Notas» un texto largo y guardo.
2. Abro su burbuja y dejo el ratón sobre la línea.
3. Abro también una cita sin notas.

**Qué debo ver:**
- en la cita con notas, «Observaciones: …» en una sola línea, cortada con «…»;
- al dejar el ratón encima, el texto completo;
- en la cita sin notas, ninguna línea de observaciones.

**Si falla, significa que…** la línea crece y empuja las acciones, o aparece vacía.

#### M1-6. La confirmada sigue preguntando

**Qué hago:** en una confirmada pulso la casilla «No asistió» y luego «Cancelar».

**Qué debo ver:** la pregunta «¿Marcar que … no asistió?» y, después de «Cancelar», la cita sigue
confirmada.

**Si falla, significa que…** se perdió la confirmación de L2.

### M2 · La configuración (puntos 2 y 15)

#### M2-1. La configuración en la computadora, más compacta

**Qué hago:** entro como admin.a en una computadora, abro Agenda › Configuración y paso por las cinco
pestañas; luego hago lo mismo en el teléfono.

**Qué debo ver:**
- en la computadora, el título «Configuración de la agenda» del tamaño de los títulos de las tarjetas
  o poco más;
- los botones («Cambiar horario», «Otra duración», las duraciones 15/20/30…) más bajos y con letra más
  chica que antes, y las pestañas más bajas; nada se corta ni se encima;
- en el teléfono, todo exactamente como antes (botones grandes, fáciles de tocar).

**Si falla, significa que…** la escala de computadora no se aplicó, o se coló al teléfono.

#### M2-2. Lo que ve la secretaria y no puede cambiar

**Qué hago:** entro como secretaria.a (Clínica Semilla A) y abro Agenda › Configuración. Paso por
«Cuándo dan consulta», «Tipos de cita», «Avisos» y «Más opciones».

**Qué debo ver:**
- al principio de «Cuándo dan consulta», una caja azul claro con «Cada médico cambia el horario de
  sus consultorios.»; en «Tipos de cita», «Cada médico cambia sus tipos de cita.»; en «Avisos»,
  «Solo el médico administrador puede cambiar estas opciones.» (tu decisión del 2026-11-19);
- ningún botón para cambiar el horario de la clínica, los tipos ni los avisos;
- en «Más opciones», primero «Personas bloqueadas» (que sí puede usar, sin aviso encima) y después la
  caja azul sobre «Empezar de nuevo», que no es un botón;
- en «Enlaces», ninguna caja.

**Si falla, significa que…** el aviso no salió, salió dos veces, o salió encima de algo que ella sí
puede hacer.

#### M2-3. Lo que ve la médica invitada y no es suyo

**Qué hago:** entro como medico.a. Paso por «Cuándo das consulta», «Tu consulta», «Avisos» y «Más
opciones».

**Qué debo ver:**
- la caja azul dentro de la tarjeta «Horario de la clínica» (sus consultorios sí los puede cambiar, sin
  caja);
- en «Tu consulta», sus tipos y «Agregar tipo de cita» arriba; y sólo si la clínica tiene tipos «de
  toda la clínica», la caja y debajo esos tipos, sin botones (en la semilla no hay ninguno);
- la caja al inicio de «Avisos» y sobre «Empezar de nuevo».

**Si falla, significa que…** el aviso tapa algo suyo o deja sin aviso algo que no es suyo.

### M3 · La barra, «Bloqueo» y el rayado (puntos 3, 5 y 6)

#### M3-1. La barra en una fila o en dos filas limpias

**Qué hago:** con la barra lateral desplegada y «Dra. Invitada Semilla Dos» elegida en el filtro,
pongo la ventana a 1024, 1280, 1366, 1440 y 1480 de ancho (o uso pantallas de esos anchos), en
Semana y en Mes.

**Qué debo ver:**
- el nombre de la médica entero en el filtro, en todos los anchos;
- de 1024 a 1359, dos filas sin controles sueltos: arriba ‹ › Hoy, la fecha, (i) y las vistas;
  abajo, a la derecha, el filtro, buscar, la campana, el candado, el engrane y «Agendar»;
- desde 1360, una sola fila;
- a 1366, «Agendar» es un «+» (el lector de pantalla dice «Agendar»);
- en el Mes a 1366, una fila con «noviembre de 2026» entero.

**Si falla, significa que…** la barra vuelve a partirse en trozos o recorta el nombre.

Esta es la forma que decidiste (2026-11-19): dos filas ordenadas hasta 1359 y una desde 1360. Ya no
está pendiente.

#### M3-2. «Bloqueo» vuelve a «Nueva cita»

**Qué hago:** con la v2 encendida, pulso un hueco de la semana, abro «Nueva cita» y elijo la tercera
posición, «Bloqueo». Después, Cancelar. Luego apago la v2 en la Clínica A y repito.

**Qué debo ver:**
- se cierra «Nueva cita» y se abre «Bloquear horario» con ese día y esa hora, sin «Días completos»
  marcado;
- Cancelar no crea nada;
- con la v2 apagada, sólo «Cita» y «Evento».

**Si falla, significa que…** el alta perdió el acceso al bloqueo o lo abre con otra hora.

#### M3-3. El rayado sólo en el horario

**Qué hago:** con el candado, bloqueo un día entero que tenga horario (por ejemplo un miércoles);
pulso su parte gris (antes de abrir o después de cerrar). Después bloqueo de 12:00 a 18:30 un día
que cierra antes, y un domingo cerrado.

**Qué debo ver:**
- el de todo el día, rayado sólo dentro del horario; la parte gris, sin rayas;
- al pulsar la parte gris, «Bloqueo de horario», no la burbuja de una cita nueva;
- el de 12:00 a 18:30, rayado hasta el cierre;
- el domingo cerrado, rayado entero.

**Si falla, significa que…** el rayado ya no sigue al gris del horario, o la parte gris dejó de ser
del bloqueo.

### M4 · La reserva: el aviso verde y «Salir» (puntos 7 y 8)

#### M4-1. «Tu correo ya está verificado» sale en verde

**Qué hago:**
1. En incógnito, con el enlace fijo del Dr. Admin Semilla Uno, elijo hora, escribo mis datos y
   `gael7@prueba.test`, marco el aviso y pido el código.
2. En Mailpit abro el correo «Tu código para reservar» y pulso «Continuar mi reserva».
3. En la pestaña nueva pulso «Verificar y reservar».

**Qué debo ver:**
- arriba de la tarjeta, «Tu correo ya está verificado. Completa tus datos para reservar.» en VERDE y con
  una palomita delante;
- mi nombre y mi teléfono ya escritos, y la casilla del aviso sin marcar.

**Si falla, significa que…** el paciente cree que algo salió mal cuando todo va bien.

#### M4-2. Los errores siguen en rojo

**Qué hago:** repito M4-1 con `hugo8@prueba.test`, pero en la pestaña nueva, antes de pulsar
«Verificar y reservar», borro el código y escribo `000000`.

**Qué debo ver:** «El código no es correcto.» en ROJO, sin palomita.

**Si falla, significa que…** un error de verdad se ve como si todo estuviera bien.

#### M4-3. «Salir» cierra la pestaña o dice que ya se puede cerrar

**Qué hago:**
1. Termino una reserva hasta «Tu cita quedó agendada».
2. Pulso «Salir».

**Qué debo ver:**
- si la pestaña se abrió desde el correo de Mailpit, normalmente se cierra;
- si no se cierra, el botón cambia por «Ya puedes cerrar esta pestaña»;
- al recargar esa pestaña (si sigue abierta), la reserva empieza de cero en «Lugar».

**Si falla, significa que…** el paciente no sabe que ya terminó, o la pestaña guarda su reserva.

### M5 · Los correos (puntos 9 a 14)

**Antes de M5**: en la configuración de la agenda, deja encendidos la agenda v2 y el recordatorio.
Ten Mailpit abierto (ver 1.5). Usa la Clínica Semilla A con `admin.a@semilla.spinus.test`.

#### M5-1. El correo del código para reservar
- **Qué hago:** abro un enlace fijo de reserva de Dr. Admin Semilla Uno, elijo consultorio, día y hora, escribo
  un correo y pulso «Enviar código a mi correo». En Mailpit abro «Tu código para reservar: …».
- **Qué debo ver:**
  - Arriba, una franja azul oscuro con el consultorio en mayúsculas pequeñas y el nombre del médico.
  - «Tu código para reservar» y, en un recuadro, el código de 6 cifras grande y separado, con «Vence en 10
    minutos» debajo.
  - Un botón azul ancho «Continuar mi reserva» y, debajo, «¿Cerraste la página? Este botón te regresa a tu
    reserva.»
  - Tras una raya, «No compartas este código con nadie…».
  - Fuera de la tarjeta, «Enviado con Spinus».
  - En la lista de Mailpit, la vista previa dice «Tu código es 123456. Vence en 10 minutos.», sin espacios en
    el número.
  - Si copio el código del correo y lo pego, se pegan las 6 cifras juntas.
- **Si falla, significa que…** el correo no sigue la maqueta, o el código lleva espacios y no se copia entero.

#### M5-2. El comprobante dice «Cita agendada», no «confirmada»
- **Qué hago:** termino esa reserva con mi nombre completo. Abro «Tu cita con Dr. Admin Semilla Uno».
- **Qué debo ver:**
  - Una píldora azul clara «✓ Cita agendada» y luego «Hola, <mi nombre>:».
  - La fecha en un recuadro con raya azul a la izquierda: el día de la semana en azul, la fecha grande y la
    hora con «hora de Yucatán» al lado (u «hora del centro de México», según el consultorio).
  - Los detalles: Médico, Consultorio, Dirección (si el consultorio la tiene) y Paciente con mi nombre.
  - El botón «Confirmar o cancelar mi cita».
  - «Para tu consulta» con sus tres puntos.
  - Un recuadro «¿No puedes asistir? … Llámanos o escríbenos al 999 …».
  - En ningún sitio el tipo de cita ni mi teléfono.
- **Si falla, significa que…** el comprobante promete una confirmación que no ha ocurrido, o se cuela algo que
  no debe ir.

#### M5-3. El botón del comprobante sigue funcionando
- **Qué hago:** en ese comprobante pulso «Confirmar o cancelar mi cita».
- **Qué debo ver:** la página de mi cita, con las opciones de siempre (confirmar o «No podré asistir»).
- **Si falla, significa que…** se rompió el enlace del comprobante.

#### M5-4. La confirmación que mando desde la agenda
- **Qué hago:** como admin.a, en una cita futura de «Paciente Prueba 13» en el Hospital Norte (ficticio), mando
  el correo de confirmación. Lo abro en Mailpit («Confirma tu cita del …»).
- **Qué debo ver:**
  - La píldora «Pendiente de confirmar», «Hola, Paciente:» y la fecha con «hora de Yucatán».
  - Dos botones a todo lo ancho: uno azul, «Confirmo mi asistencia», y otro blanco con borde, «No podré
    asistir».
  - Debajo, «Puedes cancelar con este botón hasta 1 hora antes de tu cita. Después, llámanos al …» (sólo si el
    consultorio tiene teléfono).
  - Los detalles (Médico, Consultorio, Dirección, Teléfono, que se puede pulsar en el celular) y «¿No reconoces
    esta cita?…».
  - Ni las notas ni el motivo de la cita.
- **Si falla, significa que…** el correo no sigue la maqueta o se cuela algo clínico.

#### M5-5. Los dos botones de la confirmación
- **Qué hago:** en el correo de M5-4 pulso «Confirmo mi asistencia». En otra cita, pulso «No podré asistir».
- **Qué debo ver:** el primero confirma al abrir (como K2-1). El segundo pregunta «¿Seguro?» antes de cancelar
  (como K2-3).
- **Si falla, significa que…** los botones perdieron sus enlaces de siempre.

#### M5-6. Recordatorio, cita ya confirmada y aviso de cambio
- **Qué hago:** dejo que salga el recordatorio de una cita sin confirmar y el de una ya confirmada. Reagendo
  desde la agenda una cita que se reservó por enlace.
- **Qué debo ver:**
  - Las tres con el mismo aspecto, saludando por el nombre: «Hola, <nombre>:», con el nombre del
    paciente ligado o, si la cita sigue por ligar, el que tecleó quien reservó. «Hola:» sólo si no
    hay ninguno (tu decisión del 2026-11-19).
  - Al pie, «Enviado con Spinus» se lee más oscuro que antes (#52627a; 5,47:1 sobre el fondo).
  - El recordatorio sin confirmar: «Pendiente de confirmar» y los dos botones.
  - La ya confirmada: «✓ Cita confirmada» y sólo «No podré asistir».
  - El aviso de cambio: «Cita reagendada», «Tu cita cambió» y la fecha nueva.
- **Si falla, significa que…** algún correo quedó con el diseño viejo o con la píldora equivocada.

#### M5-7. Sin dirección ni teléfono, no quedan huecos
- **Qué hago:** en un consultorio sin dirección ni teléfono, reservo o mando la confirmación.
- **Qué debo ver:**
  - No hay filas «Dirección» ni «Teléfono».
  - No sale la frase «Después, llámanos al …», ni «Llámanos o escríbenos al …» en el comprobante.
  - Nada vacío ni «undefined».
- **Si falla, significa que…** el correo enseña filas vacías o frases a medias.

#### M5-8. El aviso a la clínica, con el mismo aspecto
- **Qué hago:** con «Avisar por correo de cada reserva» encendido, reservo por enlace. Abro en Mailpit el correo
  que llega a admin.a.
- **Qué debo ver:**
  - La misma franja azul con el consultorio y el médico, y la píldora «Reserva nueva».
  - La fecha con su zona y los detalles (Paciente, Médico, Consultorio).
  - Al pie, «Recibes este correo porque…».
  - Sin el teléfono ni el correo de quien reservó.
  - El remitente sigue siendo «Spinus».
- **Si falla, significa que…** el aviso a la clínica no usa el esqueleto común, o se cuela un dato de contacto.

#### M5-9. En el teléfono y en modo oscuro
- **Qué hago:** abro M5-2 y M5-4 en el correo del teléfono, también con el teléfono en modo oscuro.
- **Qué debo ver:**
  - La tarjeta ocupa el ancho, los botones son anchos y fáciles de pulsar, y no hay desplazamiento a los lados.
  - El correo se sigue viendo claro.
- **Si falla, significa que…** el correo no se adapta al teléfono, o el buzón lo oscurece.

### Integración de la tanda M

#### M-INT-1. El `audit_log` no se puede vaciar

**Qué hago:** en la terminal, desde la carpeta de la agenda, corro la prueba de la migración nueva
(no vacía nada: todo va en una transacción que se deshace):

```bash
docker exec -i supabase_db_app_ortointegra psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null < supabase/pruebas-sql/m_audit_log_sin_truncate.sql && echo VERDE
```

**Qué debo ver:** `VERDE`, sin ningún `ERROR`.

**Si falla, significa que…** alguno de los tres roles, o el propio `postgres`, podría vaciar la
auditoría (falta la migración `20261125170000` o se tocó).

#### M-INT-2. La burbuja y «Nueva cita» conviven

**Qué hago:** en computadora, pulso una agendada y luego sus tres puntos; cierro. Pulso un hueco y
elijo «Bloqueo» en «Nueva cita».

**Qué debo ver:** los tres puntos abren «Editar cita» (M1-4), sin menú chico; «Bloqueo» abre
«Bloquear horario» (M3-2). Ninguno de los dos abre el otro.

**Si falla, significa que…** el cambio de M1 en la burbuja y el de M3 en el alta se pisan.

#### M-INT-3. El nombre del recordatorio no sale de otra clínica

**Qué hago:** en la terminal, desde la carpeta de la agenda, corro la prueba de la migración del
saludo (todo va en una transacción que se deshace):

```bash
docker exec -i supabase_db_app_ortointegra psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null < supabase/pruebas-sql/m_saludo_recordatorio.sql && echo VERDE
```

**Qué debo ver:** `VERDE`, sin ningún `ERROR`.

**Si falla, significa que…** falta la migración `20261125180000`, o la función devuelve un nombre de
otra clínica, o la puede llamar alguien con sesión.

### Qué repetir tras la tanda M

Antes de nada, P5 (o, si no reinicias, sólo su consulta): la base debe responder
`50|20261125180000` (si no, aplica las dos migraciones solas, como dice el principio de esta
sección), y después P6 a P8. Luego, las nuevas de esta sección, y éstas, que ya existían y cambian o hay que
repetir.

**La burbuja (tandas F, G, K y L)**
- **K5-4:** repetir en computadora: la burbuja se ve más chica (M1-1). En el teléfono, igual.
- **K5-5:** repetir. «Confirmar» se abre igual, ahora con opciones de 48 px en computadora.
- **K5-6:** **cambia**, la sustituyen M1-4 y M1-5. Los tres puntos ya no abren menú: observaciones,
  tipo y consultorio están en el formulario; «No asistió» de la agendada se elige como estado en el
  formulario; los recordatorios de la confirmada, en «Avisar al paciente».
- **K5-7 y K5-8:** repetir en computadora, con las medidas nuevas.
- **L2-1:** **cambia** el paso 2. En la agendada, «No asistió» se hace desde los tres puntos (que
  abren el formulario): estado «No asistió» y «Guardar», sin pregunta. El paso 1 (la confirmada) no
  cambia.
- **L2-5:** **cambia.** La escala de la reserva (18/15/14 y 44 px) vale sólo para el teléfono; en
  computadora, M1-1.
- **G3-4 y G3-5:** repetir. «Editar» de la casilla y los tres puntos abren el mismo formulario.
- **F22, E10, T1-6 y T1-7:** repetir en computadora: tocan la burbuja y su posición.

**La configuración (tandas B, H, J, K y L)**
- **L3-16:** **cambia.** A la secretaria, al inicio de «Cuándo dan consulta» y no dentro de la
  tarjeta, en una caja azul, «Cada médico cambia el horario de sus consultorios.» (M2-2); en
  «Avisos» y en lo de la invitada, «Solo el médico administrador puede cambiar estas opciones.».
- **L3-12:** **cambia.** En computadora el título ya no crece a 20 y los controles miden 40, no 44
  (M2-1). En el teléfono, igual.
- **K3-11, J5-5, B2, B3 y H2-5:** el texto y la caja nuevos donde antes salía la frase de la tanda L.
- **El funnel de la Dra. Invitada** (J5-1 a J5-3, K3-13): en el paso de avisos la caja sale arriba,
  no al final.
- **«Más opciones» de la secretaria y de la invitada:** ahora ven «Empezar de nuevo» sin botón, con
  la caja encima (M2-2, M2-3).

**La barra, el bloqueo y el rayado (tandas F, I, K y L)**
- **K1-1:** **cambia otra vez.** El bloqueo se crea con el candado y también desde «Nueva cita» ›
  «Bloqueo» (M3-2).
- **K1-3 y L1-3:** repetir: la parte gris de un bloqueo de todo el día también abre su edición
  (M3-3).
- **L1-2:** el rayado de un bloqueo de todo el día, sólo en el horario (M3-3).
- **I5-1:** **cambia.** «Una sola fila» vale desde 1360 px; de 1024 a 1359 son dos filas limpias
  (M3-1).
- **F1 y L1-1** (la barra y el candado junto a la campana): repetir a 1024, 1280 y 1366 (M3-1).

**La reserva y los correos (bloques D y E, tandas G, I, K y L)**
- **L4-3:** **cambia.** El aviso del paso 4 sale en verde con palomita (M4-1).
- **K2-4 y K2-6:** repetir: el mismo aviso, en verde.
- **D4 y H1-1:** repetir: la pantalla final lleva «Salir» (M4-3), y el correo del código es el nuevo
  (M5-1).
- **G1-7:** **cambia.** La marca de arriba es la franja azul con el consultorio y el médico, el
  código ya no va en «letra de 32» y el pie es «Este es un mensaje automático… Enviado con Spinus».
- **E1, E3, E8, G3-1, I1-4, I2-10, I5-9, K2-1, K2-3 y L4-4:** repetir. Mismos pasos; sólo cambia el
  aspecto del correo (M5-2 a M5-8).
- **El recordatorio (E4) y el aviso de cambio (I2):** **cambia** el saludo: «Hola, <nombre>:» en vez
  de «Hola:» (M5-6, tu decisión del 2026-11-19).

**Apagado**
- **X1 y X7:** nada de M1 a M3 se ve: ni la burbuja nueva, ni «Bloqueo» en «Nueva cita», ni la barra
  en dos filas, ni el rayado recortado. Los correos (M5) y la reserva (M4) son los mismos con la v2
  apagada.

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

### 9.2 Correcciones de seguridad

Estas ocho pruebas comprueban las correcciones de seguridad que pediste
después de la revisión independiente. **Ya están hechas e integradas**: todas
deben salir como se describe. Las de SEG-A3, SEG-A4 y SEG-A7 se hacen con
comandos que preguntan directo a la base; están listos para copiar tal cual,
sin cambiar nada.

Usan los atajos `entrar` y `pg` de S2: si abriste una terminal nueva, cópialos
otra vez antes de empezar. Hazlas en el orden en que están, después de D1, D3
y D8 (necesitan a «Ana Reserva Uno» con su cita y a «Beto Reserva Dos»).

#### SEG-A1. El enlace no revela si un teléfono ya tiene cita

**Qué hago:** con el enlace fijo, en incógnito, lleno los datos con el
teléfono de «Ana Reserva Uno» (5512345601, que tiene cita activa) y un correo
nuevo (`otro1@prueba.test`), y pulso «Enviar código a mi correo» **sin
verificar**. Repito en otra ventana de incógnito con un teléfono limpio
(5599999999) y otro correo nuevo (`otro2@prueba.test`).

**Qué debo ver:** **exactamente la misma respuesta** en los dos casos: «Te
enviamos un código de 6 dígitos a {el correo}. Vence en 10 minutos.». En este
paso el teléfono ni siquiera viaja: sólo se manda el correo. Y aunque
siguieras y verificaras el código, el aviso de «ya tienes cita» («Para agendar,
comunícate con el consultorio: 9990000001.») sólo sale cuando **el correo
verificado** es el que ya tiene una cita activa (D6), nunca por el teléfono.

**Si falla, significa que…** cualquiera podría averiguar si un número de
teléfono tiene cita con ese médico.

#### SEG-A2. El candado decide por el correo verificado

**Qué hago:**
1. Con el teléfono de «Ana Reserva Uno» (5512345601) y un correo nuevo
   (`otro3@prueba.test`), reservo por el enlace fijo, verificando el código.
2. Con «Beto Reserva Dos» bloqueado a mano (D8: «Bloquear contacto»; si lo
   desbloqueaste al final de D8, vuelve a bloquearlo), intento
   reservar con el teléfono de Beto (5512345602) y un correo nuevo
   (`otro4@prueba.test`), verificando el código.

**Qué debo ver:**
1. **Sí reserva**: «Tu cita quedó agendada». El teléfono, por sí solo, ya no
   bloquea: «una cita activa» y las cancelaciones se cuentan por el correo
   verificado.
2. **No reserva**: el teléfono sí cuenta para un **bloqueo manual**. Después
   de escribir el código sale «Para agendar, comunícate con el consultorio:
   9990000001.» (el teléfono del consultorio que elegiste; Hosp Norte es
   9990000002). El código del correo sí se manda y se verifica: el bloqueo
   manual se mira al reservar.

> **Decidido por ti el 2026-11-13: se queda así** (AG-DT-28). Este caso 2 es
> la única forma que queda de saber algo de un teléfono desde el enlace: quien
> lo tenga puede averiguar si la clínica **bloqueó a mano** ese número (no si
> tiene cita ni historial). Lo limitan los topes de intentos (SEG-A8) y que en
> el enlace fijo hace falta un correo verificado propio. Se dejó así porque
> pediste que el bloqueo manual corte también por teléfono. La alternativa es
> que el bloqueo manual mire sólo el correo; entonces un bloqueado podría
> volver con otro correo.

**Si falla, significa que…** alguien con el mismo teléfono que un paciente
(familia, número reciclado) queda bloqueado sin razón, o un bloqueado a mano se
cuela cambiando de correo.

#### SEG-A3. Con la v2 encendida, nadie borra una cita con paciente, ni saltándose la pantalla

**Qué hago:** con la v2 encendida (P8), entro a la base como el Dr. Admin:

```bash
entrar admin.a@semilla.spinus.test
```

Debe decir «Sesión lista: admin.a@semilla.spinus.test». Ahora busco una cita
**con paciente** (este comando sólo lee y guarda su código en `ID`):

```bash
ID=$(docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select a.id from public.appointments a join public.clinicas c on c.id = a.clinica_id where c.nombre = 'Clínica Semilla A' and a.paciente_id is not null and a.status = 'scheduled' and a.start_time > now() order by a.start_time limit 1"); echo "$ID"
```

Imprime un código largo (letras, números y guiones). Intento borrarla por
fuera de la pantalla:

```bash
pg "appointments?id=eq.$ID" -X DELETE
```

Y compruebo que sigue ahí:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select count(*) from public.appointments where id = '$ID'"
```

Después hago lo mismo con una cita **por ligar** (la de «Ana Reserva Uno» o
cualquier reserva por enlace): primero la busco con este otro comando, y luego
repito, sin cambiarlos, el de borrar (`pg … -X DELETE`) y el de comprobar:

```bash
ID=$(docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select a.id from public.appointments a join public.clinicas c on c.id = a.clinica_id where c.nombre = 'Clínica Semilla A' and a.reserva_canal is not null and a.status = 'scheduled' order by a.start_time limit 1"); echo "$ID"
```

(Si no imprime nada, todavía no hay ninguna reserva por enlace: haz D1.)

**Qué debo ver:** el borrado se **rechaza**, con este texto exacto:

```
{"code":"42501","details":null,"hint":"Cancélala (status cancelled) en vez de borrarla","message":"Una cita con paciente o por ligar no se borra: se cancela"}
HTTP 403
```

y el comprobante responde `1`: la cita sigue ahí (y en la agenda). Lo mismo
con la por ligar. Un evento **sin paciente** sí se puede borrar así (responde
`HTTP 200` con el evento borrado), y con la v2 **apagada** el borrado es el de
siempre: una cita con paciente que nunca tuvo enlace ni correo de la v2 se
borra (`HTTP 200`).

**Si falla, significa que…** alguien de la clínica puede borrar citas con
paciente por fuera de la pantalla.

#### SEG-A4. Los datos de la reserva y del consentimiento no se cambian desde fuera

**Qué hago:** con la sesión del Dr. Admin (`entrar` de SEG-A3) y la cita **por
ligar** de SEG-A3 (el último `ID` que buscaste; si abriste otra terminal,
vuelve a buscarla con el segundo comando de búsqueda de SEG-A3), intento
cambiar quién reservó:

```bash
pg "appointments?id=eq.$ID" -X PATCH -d '{"reserva_nombre":"Nombre cambiado"}'
```

Cuándo aceptó el aviso de privacidad y qué versión:

```bash
pg "appointments?id=eq.$ID" -X PATCH -d '{"reserva_aceptado_en":"2020-01-01T00:00:00Z","reserva_aviso_version":"otra"}'
```

Y por último, borrar su teléfono y su correo de la reserva:

```bash
pg "appointments?id=eq.$ID&select=reserva_nombre,reserva_telefono,reserva_correo" -X PATCH -d '{"reserva_telefono":null,"reserva_correo":null}'
```

**Qué debo ver:**
- El primero se **rechaza**: `{"code":"42501","details":null,"hint":null,"message":"La columna reserva_nombre de la cita sólo la escribe el servidor"}` y `HTTP 403`.
- El segundo, igual, con `La columna reserva_aceptado_en de la cita sólo la
  escribe el servidor` y `HTTP 403`. La cita conserva su nombre de reserva y
  su consentimiento.
- El tercero **sí se permite**: `[{"reserva_nombre":"Ana Reserva Uno","reserva_telefono":null,"reserva_correo":null}]`
  y `HTTP 200`. Borrar el teléfono y el correo de la reserva es lo único que
  se deja hacer (por ejemplo, si la persona lo pide). Ojo: esa cita se queda
  sin teléfono ni correo en la agenda; si la necesitas para otra prueba, usa
  otra reserva.

Las columnas protegidas son las once que empiezan por `reserva_`: quién
reservó (`reserva_nombre`, `reserva_telefono`, `reserva_correo`), con qué
enlace (`reserva_canal`, `reserva_enlace_id`), el consentimiento
(`reserva_aceptado_en`, `reserva_aviso_version`), el historial que vio la
clínica (`reserva_historial_previo`), las veces que se reagendó
(`reserva_reagendados`) y las dos huellas para el candado (`reserva_tel_hmac`,
`reserva_correo_hmac`). Desde la sesión no se pueden poner al crear una cita
ni cambiar después; sólo vaciar el teléfono y el correo.

**Si falla, significa que…** se podría falsear quién reservó o cuándo aceptó el
aviso de privacidad.

#### SEG-A5. Un evento de todo el día bloquea esos días en el enlace, y en la agenda no

**Qué hago:** como Dr. Admin creo un evento de **todo el día** «Congreso del
Dr. Admin» para un martes de la semana siguiente. Abro su enlace de reserva y
miro ese martes. Después agendo dentro de la agenda una cita de «Paciente
Prueba 14» ese martes a las 09:00.

**Qué debo ver:** en el enlace, ese martes **no ofrece ningún horario** (los
demás días sí). En la agenda, la cita se guarda **sin ningún aviso** («Se agendó
correctamente»): dentro de la agenda un evento de todo el día no cuenta como
empalme, igual que antes de la corrección. Si cancelas el congreso, el martes
vuelve a ofrecer horarios en el enlace.

**Si falla, significa que…** los pacientes pueden reservar en días que el
médico tiene ocupados, o el personal queda bloqueado.

#### SEG-A6. Un enlace de un solo uso no le sirve a un contacto bloqueado a mano

**Qué hago:** con «Beto Reserva Dos» bloqueado a mano (D8; si no lo está,
«Bloquear contacto» en su cita), emito un enlace de un solo uso y, en incógnito, reservo con su teléfono (5512345602) y su correo
(`beto2@prueba.test`). Después lo desbloqueo («Desbloquear contacto») y vuelvo a
intentarlo **con el mismo enlace**.

**Qué debo ver:** la primera vez **no reserva**: «Para agendar, comunícate con
el consultorio: 9990000001.». El enlace de un solo uso se sigue saltando el
límite de una cita activa y el de cancelaciones, pero ya **no** el bloqueo
manual. El enlace **no se gasta**: tras desbloquear, el mismo enlace reserva
(«Tu cita quedó agendada»).

**Si falla, significa que…** alguien bloqueado a mano puede volver con un
enlace que se le mandó antes.

#### SEG-A7. El código del enlace lo pone siempre el servidor, y el nombre no ensucia Google

**Qué hago:**
1. Intento crear, directo en la base y con la sesión del Dr. Admin (`entrar`
   de SEG-A3), un enlace con un código elegido por mí (todo ceros). El comando
   busca solo la clínica y el médico:

```bash
pg "reserva_enlaces" -X POST -d "$(docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select json_build_object('clinica_id', c.id, 'medico_id', p.id, 'clase', 'unico', 'codigo_hash', repeat('0', 64), 'vigencia_dias', 7, 'caduca_en', '2030-01-01T00:00:00Z') from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test'")"
```

   Y compruebo que no quedó:

```bash
docker exec supabase_db_app_ortointegra psql -U postgres -Atc "select count(*) from public.reserva_enlaces where codigo_hash = repeat('0', 64)"
```

2. Con el enlace fijo (en el 3000; no hace falta el Google simulado), reservo
   con el nombre `Ana https://sitio-malo.test/promo`, verificando el código.
3. Pruebo a pegar en «Nombre completo» un texto muy largo (300 letras).

**Qué debo ver:**
1. La base **rechaza** el alta: `{"code":"42501","details":null,"hint":null,"message":"Los enlaces de reserva los emite el servidor"}`
   y `HTTP 403`; el comprobante responde `0`. Los enlaces sólo se crean desde
   la pantalla, y su código lo genera el servidor.
2. Después del código, la reserva **se rechaza** con «No se pudo completar.
   Intenta de nuevo.» y **no se crea ninguna cita** (ni, por tanto, nada en
   Google). La regla del nombre: hasta **80 caracteres**, sin direcciones web
   (nada con `://`, `www.` o un «punto y dos letras» pegados, como
   `sitio.com`) y sin caracteres invisibles ni saltos de línea. Ojo: por esa
   regla, **«Ma.Guadalupe» (sin espacio después del punto) también se
   rechaza**; «Ma. Guadalupe» pasa. Se aceptó así. Los números sí se aceptan.
3. La casilla no deja escribir más de 80 caracteres: el texto pegado se corta.

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
límites finales, después de las correcciones (no cambiaron los números):

| Acción | Límite |
|---|---|
| Ver horarios | 120 cada 10 min por red |
| Pedir código | 3 por correo, 10 por red y 5 por navegador, cada hora |
| Verificar código | 20 por red cada hora (y 5 intentos por código) |
| Reservar | 6 por red y 4 por navegador cada hora; 30 al día por enlace fijo |
| Confirmar o cancelar | 10 por enlace y 30 por red cada hora |

En el paso 1 el cuarto pedido ya no manda correo. En el 2, la quinta reserva no
pasa.

Lo que cambió con las correcciones es **cuándo** se cuentan: ahora el límite
por red y por navegador se mira **antes** de consultar la base, así que un
enlace inventado ya no la toca. Y hay un tope nuevo que no se ve en pantalla:
cada clínica lee Google a lo sumo 60 veces cada 10 minutos por culpa de las
reservas por enlace; pasado eso, se decide como cuando Google está caído (G3).
No hay páginas públicas nuevas.

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
- [ ] P1–P11. Base reiniciada (32 migraciones), sembrada, aviso aprobado, app en el 3000

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
- [ ] F5. «Compactar» al abrir (apagado, decidido)
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

**Tanda del 2026-11-13 (§8-bis)**
- [ ] T1-1. Buscar por nombre y apellido en cualquier orden (también apagada)
- [ ] T1-2. Lo mismo en la burbuja
- [ ] T1-3. Registrar un paciente desde la burbuja (con consentimiento)
- [ ] T1-4. La burbuja al fondo de la pantalla
- [ ] T1-5. La tarjeta al fondo de la pantalla
- [ ] T1-6. WhatsApp sólo cuando aplica
- [ ] T1-7. El error de WhatsApp dice por qué
- [ ] T1-8. Después de agendar desde la burbuja
- [ ] T2-1. «Para empezar» y lo que falta para el enlace
- [ ] T2-2. La Dra. Invitada no puede crear el tipo (**decidir**)
- [ ] T2-3. El enlace que no abrirá lo dice
- [ ] T2-4. Cada médico, su ficha
- [ ] T2-5. La agenda pinta el horario propio del consultorio
- [ ] T2-6. Consultorio en otra zona (qué se ve)
- [ ] T2-7. La configuración ordenada
- [ ] T3-1. El engrane sin «Horario»
- [ ] T3-2. Convertir en cita un evento de Google
- [ ] T3-3. Google no le cambia el nombre a la convertida
- [ ] T3-4. Sólo los eventos de Google se convierten
- [ ] T3-5. La tarjeta al dejar el ratón quieto
- [ ] T3-6. Apagar la tarjeta al pasar el ratón
- [ ] T3-7. En el teléfono, sólo el toque
- [ ] T3-8. Las citas suben un pelo

**Tanda del 2026-11-14 (§8-ter)**
- [ ] G1-1. La reserva por pasos, con la dirección a la vista
- [ ] G1-2. Un solo tipo: sin bloque «Tipo de cita»
- [ ] G1-3. Sólo los tipos del consultorio elegido
- [ ] G1-4. Tira de fechas, mañana y tarde
- [ ] G1-5. Estados de la reserva
- [ ] G1-6. La confirmación con el mismo aspecto
- [ ] G1-7. Los correos con la marca (la confirmación sin «Recordatorio»)
- [ ] G1-8. Modo oscuro y movimiento reducido
- [ ] G2-1. Primeros pasos en orden, con avance
- [ ] G2-2. Crear el enlace sin la duración
- [ ] G2-3. La invitada pone su duración
- [ ] G2-4. Otra duración en un consultorio
- [ ] G2-5. Cada enlace dice si funciona
- [ ] G2-6. Turnos de 45 min desde la apertura
- [ ] G2-7. El clic y el arrastre caen en el turno
- [ ] G2-8. Ya no está el horario de la clínica
- [ ] G2-9. La invitada cambia y archiva lo suyo
- [ ] G3-1. Confirmación por correo sin Google
- [ ] G3-2. No se manda dos veces
- [ ] G3-3. Con Google, el correo y la invitación
- [ ] G3-4. La tarjeta de una agendada
- [ ] G3-5. Confirmada, atendida, cancelada, no asistió
- [ ] G3-6. Una atendida ya no se mueve
- [ ] G3-7. Una atendida con nota no se desmarca (al final; deja una nota)
- [ ] G3-8. El formulario con los dos avisos
- [ ] G3-9. Sin el aviso negro; 0,5 s y 3 px
- [ ] G3-10. La hora del consultorio en otra zona
- [ ] G4-1. Los consultorios heredan el horario de la clínica
- [ ] G4-2. «Todos los médicos»: la unión de los consultorios
- [ ] G4-3. Un médico concreto: sus consultorios
- [ ] G4-4. El consultorio activo manda
- [ ] G4-5. Consultorio en otra zona: gris y aviso en su hora
- [ ] G4-6. Con la v2 apagada, todo como antes

**Tanda H (§8-quater)**
- [ ] H1-1. «Volver» en cada paso, sin perder nada
- [ ] H1-2. Al volver, el horario ya lo tomó otro
- [ ] H1-3. Siempre en claro
- [ ] H1-4. «Lugar» con un solo consultorio
- [ ] H1-5. El correo sigue siendo obligatorio
- [ ] H2-1. La configuración en pestañas
- [ ] H2-2. Los enlaces de los invitados, plegados
- [ ] H2-3. Los botones se ven como botones
- [ ] H2-4. «Plazos y recordatorios» explica cada ajuste
- [ ] H2-5. Encender el recordatorio
- [ ] H2-6. Recordatorio apagado: no sale; los demás correos sí
- [ ] H2-7. Restablecer la configuración
- [ ] H2-8. Sólo el administrador restablece
- [ ] H3-1. «Registrar» en verde
- [ ] H3-2. La burbuja sigue abierta tras registrar (doble clic)
- [ ] H3-3. Teléfono en el registro rápido
- [ ] H3-4. Observaciones en la burbuja
- [ ] H4-1. La lista de mañana y su leyenda
- [ ] H4-2. Los avisos según lo que tenga el paciente
- [ ] H4-3. Marcar como confirmada a mano
- [ ] H4-4. El paciente confirma o cancela y la fila sale sola
- [ ] H4-5. El punto rojo con pendientes
- [ ] H4-6. Los huecos de Día en turnos
- [ ] H4-7. Un hueco de menos de una hora, si cabe la consulta
- [ ] H5-1. Una atendida con nota no se mueve ni cambia de estado (al final; luego P5)
- [ ] H5-2. El domingo, la lista de Semana abre al final

**Tanda I (§8-quinquies)**
- [ ] I1-1. Terminar una consulta y volver: «Atendida» (al final; deja una nota, luego P5)
- [ ] I1-2. Reservan por el enlace mientras estoy en otra pantalla
- [ ] I1-3. Reservan por el enlace con la agenda abierta
- [ ] I1-4. El paciente confirma, cancela o reagenda por su enlace
- [ ] I1-5. Un cambio de Google llega a la agenda abierta
- [ ] I1-6. Reabrir «Ir a una fecha» y la lupa
- [ ] I2-1. El único no pide correo
- [ ] I2-2. El fijo no cambió
- [ ] I2-3. Bloquear a quien reservó sin correo
- [ ] I2-4. El formulario no deja cambiar lo que eligió el paciente
- [ ] I2-5. Arrastrar una cita reservada por enlace
- [ ] I2-6. Reagendar con correo
- [ ] I2-7. Reagendar sin correo
- [ ] I2-8. Ligada a un paciente, sigue el candado
- [ ] I2-9. Google no mueve una cita reservada por enlace
- [ ] I2-10. Los correos llevan el nombre del médico
- [ ] I3-1. La reserva por enlace en «Próximas citas»
- [ ] I3-2. Un evento nuevo de Google entra «Por asignar»
- [ ] I3-3. «¿No es una cita?» lo deja como evento, para siempre
- [ ] I3-4. «¿No es una cita?» desde «Próximas citas»
- [ ] I3-4b. «¿No es una cita?» desde el formulario
- [ ] I3-5. Iniciar la consulta de un «Por asignar»
- [ ] I3-6. Doble clic al registrar (formulario completo y «Convertir en cita»)
- [ ] I4-1. Una atendida con nota no se mueve, ni con la v2 apagada
- [ ] I4-2. El horario sin confirmar sale «por revisar»
- [ ] I4-3. ¿Asistió el paciente?
- [ ] I4-4. Reasignar el hueco de una cancelada
- [ ] I5-1. Una sola fila en escritorio
- [ ] I5-2. La fecha abre el calendario
- [ ] I5-3. El menú del engrane
- [ ] I5-4. La campana y sus dos pestañas
- [ ] I5-5. Botones alineados en «Por confirmar»
- [ ] I5-6. Los avisos se quedan hasta revisarlos y llevan a su cita
- [ ] I5-7. Avisos de Google
- [ ] I5-8. Un aviso desde otra página
- [ ] I5-9. Correo a la clínica por cada reserva
- [ ] I5-10. Apagada, la barra de siempre
- [ ] I-INT-1. «¿No es una cita?» desde la campana
- [ ] I-INT-2. Único sin correo avisa a la clínica
- [ ] J1-1. «Pop-up de eventos» en el engrane
- [ ] J1-2. Interruptores en el menú del engrane
- [ ] J1-3. Con la v2 apagada, la agenda no carga lo de la v2
- [ ] J2-1. El enlace de un solo uso lleva el correo que escribo yo
- [ ] J2-2. Sin correo de la clínica no sale ningún correo
- [ ] J2-3. Un enlace de un solo uso agotado no dice por qué
- [ ] J2-4. Bloquear a alguien también gasta su enlace
- [ ] J2-5. La anticipación de 2 horas por las dos caras
- [ ] J3-1. «Ligar e iniciar consulta» en Próximas citas (sin guardar la nota)
- [ ] J3-2. La ventana desde la tarjeta, con paciente nuevo (sin guardar la nota)
- [ ] J3-3. Desde la campana, y «¿No es una cita?» de Google
- [ ] J3-4. Doble clic en la ventana
- [ ] J3-5. Sin botones de duración en una reserva por enlace
- [ ] J3-6. La duración es la del fin real
- [ ] J4-1. Mover en Google una cita reservada por enlace
- [ ] J4-2. Un aviso por intento
- [ ] J4-3. Pulsar el aviso: «Reagendar» destacado
- [ ] J4-4. Lo de Google sin morado
- [ ] J5-1. La primera vez
- [ ] J5-2. Terminar después
- [ ] J5-3. Cambiar desde el resumen
- [ ] J5-4. Las pestañas se guardan solas
- [ ] J5-5. Horario de la clínica
- [ ] J5-6. Empezar de nuevo
- [ ] J5-7. Nada se pierde
- [ ] J5-8. Apagada
- [ ] J-INT-1. El correo del enlace de una vez, también desde otro médico

**Tanda K**
- [ ] K1-1. Crear un bloqueo desde «Agendar»
- [ ] K1-2. Agendar encima pregunta
- [ ] K1-3. Editar y quitar desde el rótulo
- [ ] K1-4. Días completos desde la burbuja
- [ ] K1-5. El enlace respeta el bloqueo; lo de todo el día ya no cierra
- [ ] K1-6. Google
- [ ] K1-7. Permisos y apagada
- [ ] K2-1. Confirmar al abrir
- [ ] K2-2. Sin una persona no confirma
- [ ] K2-3. «No podré asistir» en dos pasos
- [ ] K2-4. «Continuar mi reserva»
- [ ] K2-5. Reenviar sin castigo
- [ ] K2-6. Recargar no pide otro código
- [ ] K2-7. Dice cuánto esperar
- [ ] K3-11. El horario de la clínica, primero
- [ ] K3-12. El paso de la clínica
- [ ] K3-12b. El huso de fábrica
- [ ] K3-13. Las pestañas en el teléfono
- [ ] K3-14. Apagar «Tu enlace» lo pausa
- [ ] K4-1. La leyenda de tu ubicación
- [ ] K4-2. El gris de cada consultorio
- [ ] K4-3. Guardar sin esperar con la v2 apagada
- [ ] K5-1. Un solo icono «sin expediente»
- [ ] K5-2. El eslabón se queda
- [ ] K5-3. La leyenda con las marcas
- [ ] K5-4. La burbuja de una agendada
- [ ] K5-5. «Confirmar» con tres opciones
- [ ] K5-6. Los tres puntos
- [ ] K5-7. Cancelada y no asistió
- [ ] K5-8. Google y enlace en la burbuja
- [ ] K-INT-1. «Reagendar» a un horario bloqueado
- [ ] K-INT-2. La burbuja conserva lo de antes

**Tanda L**
- [ ] L1-1. El candado, junto a la campana
- [ ] L1-2. Crear un bloqueo con el candado
- [ ] L1-3. Cualquier parte de la franja abre el bloqueo
- [ ] L1-4. Dentro no se agenda (burbuja y formulario)
- [ ] L1-5. Dentro no se mueve (arrastre y «Reagendar»)
- [ ] L1-6. Lo que ya estaba dentro se edita
- [ ] L1-7. Google entra como hoy
- [ ] L1-8. Apagada
- [ ] L2-1. «No asistió» pregunta
- [ ] L2-2. «Eliminar cita», también en otra pantalla
- [ ] L2-3. «Eliminar cita» no borra
- [ ] L2-4. El botón de la leyenda
- [ ] L2-5. La letra de la burbuja
- [ ] L3-12. La letra de la configuración
- [ ] L3-16. «Solo el administrador…»
- [ ] L3-17. La secretaria con el diseño nuevo
- [ ] L4-1. Confirmar espera a la persona
- [ ] L4-2. «No podré asistir» no confirma
- [ ] L4-3. «Continuar mi reserva» con nombre y teléfono
- [ ] L4-4. El saludo del correo de confirmación
- [ ] L5-1. El paciente confirma: aviso
- [ ] L5-2. Sólo uno, y el personal no avisa
- [ ] L5-3. La burbuja con el número
- [ ] L5-4. Google no mueve una reserva por enlace
- [ ] L-INT-1. «Eliminar cita» dentro de un bloqueo

**Tanda M**
- [ ] M1-1. La burbuja en computadora, del tamaño de antes
- [ ] M1-2. En el teléfono, igual que antes
- [ ] M1-3. La burbuja nunca se sale
- [ ] M1-4. Los tres puntos abren el formulario
- [ ] M1-5. Las observaciones en una línea
- [ ] M1-6. La confirmada sigue preguntando
- [ ] M2-1. La configuración en la computadora, más compacta
- [ ] M2-2. Lo que ve la secretaria
- [ ] M2-3. Lo que ve la médica invitada
- [ ] M3-1. La barra en una fila o en dos filas limpias
- [ ] M3-2. «Bloqueo» en «Nueva cita»
- [ ] M3-3. El rayado sólo en el horario
- [ ] M4-1. «Tu correo ya está verificado» en verde
- [ ] M4-2. Los errores siguen en rojo
- [ ] M4-3. «Salir»
- [ ] M5-1. El correo del código
- [ ] M5-2. El comprobante dice «Cita agendada»
- [ ] M5-3. El botón del comprobante
- [ ] M5-4. La confirmación desde la agenda
- [ ] M5-5. Los dos botones de la confirmación
- [ ] M5-6. Recordatorio, ya confirmada y cambio
- [ ] M5-7. Sin dirección ni teléfono
- [ ] M5-8. El aviso a la clínica
- [ ] M5-9. En el teléfono y en modo oscuro
- [ ] M-INT-1. El `audit_log` no se puede vaciar
- [ ] M-INT-2. La burbuja y «Nueva cita» conviven
- [ ] M-INT-3. El nombre del recordatorio no sale de otra clínica

**Seguridad**
- [ ] S1. La Clínica B no ve la A
- [ ] S2. Lo mismo, directo a la base
- [ ] S3. La invitada sólo ve lo suyo, directo
- [ ] S4. Enlaces públicos con la v2 apagada
- [ ] SEG-A1. El enlace no revela teléfonos
- [ ] SEG-A2. Candado por correo verificado (el bloqueo manual por teléfono se queda, decidido)
- [ ] SEG-A3. Nadie borra citas con paciente
- [ ] SEG-A4. Datos de reserva y consentimiento intocables
- [ ] SEG-A5. Todo el día bloquea el enlace (en la agenda, sin aviso)
- [ ] SEG-A6. Un solo uso no salta el bloqueo manual
- [ ] SEG-A7. Código del servidor y nombre limpio
- [ ] SEG-A8. Límites de intentos

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
   cosa que **tienes que pedirle a quien programe (o a Claude) al fusionar las
   dos ramas**: cambiar la lista de funciones de la prueba
   `p1_permisos_funciones.sql` (su «caso 3»). Esa prueba tiene escrita a mano
   la lista de las funciones de la base que no pueden usar todos los roles; hoy
   tiene 10 y, con la agenda, son **50** (tras la tanda K; la tanda H añadió 3,
   la I, 1, la J, 2 y la K, 3; la L, ninguna). La lista completa, lista para pegar, está en
   `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`, §13.5. **No es un hueco de
   seguridad**: si no se cambia, esa prueba sale en rojo, nada más. Se probó
   en tu computadora con las dos ramas juntas: con la lista nueva, todas las
   pruebas pasan.

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
| 17 | `20261117120000_agenda_seg_borrado_cita.sql` | Corrección de seguridad: con la v2 encendida, la base no deja borrar una cita con paciente o por ligar, aunque alguien se salte la pantalla (SEG-A3) |
| 18 | `20261117121000_agenda_seg_columnas_reserva.sql` | Corrección de seguridad: los datos de quien reservó y de su consentimiento sólo los escribe el servidor (SEG-A4) |
| 19 | `20261117122000_agenda_seg_emision_enlaces.sql` | Corrección de seguridad: los enlaces de reserva sólo los crea el servidor, con un código que nadie elige a mano (SEG-A7) |
| 20 | `20261117130000_agenda_seg1_candado_correo.sql` | Corrección de seguridad: el candado decide por el correo verificado, el bloqueo manual corta también el enlace de un solo uso y un evento de todo el día ocupa ese día en el enlace (SEG-A1, A2, A5, A6) |
| 21 | `20261119120000_agenda_g2_duracion_consulta.sql` | La duración de la consulta de cada médico (y otra distinta en un consultorio), el médico crea SUS tipos de cita, y la reserva recibe de qué consultorio es cada tipo (G2) |
| 22 | `20261119121000_agenda_g2_tipos_cita_update.sql` | El médico cambia y archiva SUS tipos de cita y su duración, sin pasárselos a otro (G2-9) |
| 23 | `20261119130000_agenda_g4_herencia_horario_consultorios.sql` | Cada consultorio sin horario propio copia UNA vez el horario de la clínica, con respaldo de lo de antes (G4-1). **Después de B5 (la 4)** |
| 24 | `20261119140000_agenda_g3_correo_confirmacion.sql` | El correo de confirmación de Spinus queda registrado como los demás correos de cita (G3-1, G3-2). Mejor en la misma sesión que la 14 |
| 25 | `20261120120000_agenda_h2_recordatorio_interruptor.sql` | El interruptor del recordatorio por correo, APAGADO de fábrica para todas las clínicas, y la lista de la tarea que lo respeta (H2-5, H2-6). **Desde que se aplique, ninguna clínica recibe recordatorios hasta que su administrador lo encienda** |
| 26 | `20261120121000_agenda_h2_restablecer_configuracion.sql` | «Restablecer configuración de la agenda», sólo para el administrador (H2-7). Después de la 25 |
| 27 | `20261120130000_agenda_h5_atendida_con_nota.sql` | Una cita atendida con nota clínica no cambia de estado ni se borra, y con la v2 no se mueve, ni saltándose la pantalla (H5-1). Actúa también con la v2 apagada |
| 28 | `20261121120000_agenda_i2_unico_sin_correo.sql` | El enlace de un solo uso admite reservar sin correo (I2-1). **Antes del código** |
| 29 | `20261121121000_agenda_i2_candado_eleccion.sql` | Una cita por enlace que no ha pasado no se mueve ni cambia de médico salvo con «Reagendar» (I2-4 a I2-9). **Antes del código** |
| 30 | `20261121130000_agenda_i3_por_asignar_google.sql` | Lo que entra de Google sale «Por asignar» y «¿No es una cita?» lo deja como evento (I3-2, I3-3). **Antes del código** |
| 31 | `20261121140000_agenda_i4_atendida_no_se_mueve.sql` | La atendida con nota tampoco se mueve con la v2 apagada (I4-1). Después de la 27 |
| 32 | `20261121141000_agenda_i4_horario_revisado.sql` | El horario de cada consultorio, «por revisar» hasta que alguien lo confirma (I4-2). **Todos los consultorios existentes quedan «por revisar»**. Después de la 26 |
| 33 | `20261121142000_agenda_i4_cancelada_cerrada.sql` | La cancelada que se sustituye queda cerrada, no borrada (I4-4) |
| 34 | `20261121150000_agenda_i5_avisos_clinica.sql` | Los avisos de la clínica en la campana y el correo a la clínica por cada reserva, APAGADO de fábrica (I5-6 a I5-9). **Después de la 30** (su pre-vuelo lo exige) |
| 35 | `20261122120000_agenda_j2_unico_tope_correo.sql` | El enlace de un solo uso lleva el correo que pone la clínica y se agota a los 5 intentos o al primer «bloqueado» (J2-1 a J2-4). **Antes del código** |
| 36 | `20261122120100_agenda_j2_unico_carrera_client_id.sql` | Dos reservas a la vez con el mismo envío no deshacen el conteo de intentos. **Después de la 35** (su pre-vuelo lo exige) |
| 37 | `20261122140000_agenda_j4_aviso_google_reserva.sql` | El aviso «Desde Google no se pueden mover las citas reservadas por enlace» (J4-1 a J4-3). **Después de la 34** |
| 38 | `20261123120000_agenda_k1_bloqueos.sql` | El bloqueo de horario: su tabla, y que la reserva por enlace no ofrezca un horario bloqueado; lo de todo el día deja de cerrar el día (K1-1 a K1-7). **Antes de la 40** |
| 39 | `20261123130000_agenda_k2_espera_codigo.sql` | Reenviar el código: los 30 s por enlace, cuánto falta cuando hay que esperar, y el código de un correo anterior no cuenta como equivocado (K2-5 a K2-7) |
| 40 | `20261123140000_agenda_k3_huso_clinica_pausa_enlace.sql` | El huso de fábrica de la clínica y apagar «Tu enlace» sin perderlo (K3-12, K3-14). **Después de la 38** (si no, se detiene sin hacer nada) |
| 41 | `20261124120000_agenda_l1_bloqueo_total.sql` | El bloqueo es total: con la v2, la base no deja agendar ni mover nada dentro de un bloqueo, aunque alguien se salte la pantalla; lo de Google y las reservas por enlace entran como hoy (L1-4 a L1-7). **Después de la 38** |
| 42 | `20261124130000_agenda_l2_eliminar_cancelada.sql` | «Eliminar cita» quita una cancelada de la agenda sin borrarla: queda cerrada y en la auditoría (L2-2, L2-3). **Después de la 33** |
| 43 | `20261124160000_agenda_l5_aviso_confirmacion_paciente.sql` | El aviso en la campana cuando el paciente confirma desde su enlace (L5-1, L5-2). **Después de la 37** |

**Aparte, no es de la agenda:** `20261125170000_audit_log_sin_truncate.sql` (tanda M, tu encargo): quita TRUNCATE sobre `audit_log` a `anon`, `authenticated` y `service_role` y añade un disparador que lo impide. **Se aplica sola y puede ir antes que la 1**: sólo depende de lo que producción ya tiene. Al final, una tabla con «OK» en las filas 1 a 5 (M-INT-1).

Son **43**. Las tres de la tanda L (41 a 43) van al final y en ese orden; no dependen entre sí. **Nunca vuelvas a correr la 37 después de la 43** (se detiene sin hacer nada: no reconoce los avisos que añade la 43). Antes de la tanda L eran 40. Las tres de la tanda K (38 a 40) van al final y en ese orden: **la 38 antes que la 40, siempre** (la 40 sin la 38 se detiene; la 38 después de la 40, también). Antes de la tanda K eran 37. Las tres de la tanda J (35 a 37) van al final y en ese orden; **nunca vuelvas a correr la 35 después de la 36** (se detiene sin hacer nada: no reconoce lo que dejó la 36). Antes de la tanda J eran 34. Las siete de la tanda I (28 a 34) van al final y en ese orden. Antes de la tanda I eran 27: Las tres de la tanda H (25 a 27) van al final y en ese orden. Las cuatro de la tanda del 2026-11-14 (21 a 24) van al final y en ese orden; las 17 a 20 van en este orden aunque se escribieron
después: las 17 y 18 añaden reglas a la tabla de citas, la 19 reemplaza
la protección de los enlaces que puso la 8, y la 20 reemplaza tres funciones de
las 9 y 10. Por eso, una vez más: **nunca vuelvas a correr la 8, la 9 ni la 10
después de éstas** (desharías las correcciones). Lo mismo con la tanda del 2026-11-14: la 21
reemplaza `reserva_contexto` (de la 10) y la 24 `cita_correo_tomar` (de la 14):
**nunca vuelvas a correr la 10 ni la 14 después de ellas**.

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
2. **Las 43 migraciones**, una por una, en el orden de 13.2.
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
