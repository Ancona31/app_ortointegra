# Semilla de la agenda (solo Supabase local)

Datos **ficticios** para probar y medir `src/app/(app)/agenda/page.tsx` contra la
Supabase local de Docker.

```bash
npx tsx scripts/agenda-semilla.ts                # siembra; antes borra lo sembrado
npx tsx scripts/agenda-semilla.ts --volumen 30000 # siembra y añade 30000 citas a la clínica A
npx tsx scripts/agenda-semilla.ts --borrar       # quita todo lo sembrado
```

- **Candado:** aborta si `NEXT_PUBLIC_SUPABASE_URL` de `.env.local` no apunta a
  `127.0.0.1` o `localhost`. No llama a Google, Stripe ni Resend.
- `--volumen` usa `docker exec supabase_db_app_ortointegra psql` (necesita el
  stack local levantado). Lo demás va por la API, como la app.
- **Las citas se calculan desde HOY**, así que la siembra base sale distinta cada
  día. Si vuelves a sembrar el mismo día, sale igual.

## Usuarios

La contraseña es la misma para todos: `Semilla-Agenda-2026`. Es ficticia y solo vale en local.

| Correo | Rol | Clínica |
|---|---|---|
| `admin.a@semilla.spinus.test` | médico, administrador | Clínica Semilla A |
| `medico.a@semilla.spinus.test` | médico invitado | Clínica Semilla A |
| `secretaria.a@semilla.spinus.test` | secretaria | Clínica Semilla A |
| `admin.b@semilla.spinus.test` | médico, administrador | Clínica Semilla B |

## Qué siembra

**Clínica A.** Es VIP (`es_vip_grant`), con topes de 3 médicos y 2 secretarias.
Tiene `horario_consulta` de lunes a viernes de 08:00 a 18:00, sábado de 08:00 a
13:00 y domingo cerrado.
- Consultorios, todos en `America/Merida`: «Centro» y «Hosp Norte» del
  administrador, y «Rehab» de la invitada.
- 25 pacientes, «Paciente Prueba 01…25». Del 1 al 15 son del administrador y del
  16 al 25 de la invitada; del 21 al 25 los da de alta la secretaria.
- Unas 350 citas, de 4 semanas antes a 4 semanas después de la actual:
  - Aparecen los 5 estados. Las citas pasadas quedan atendidas, como inasistencia
    o canceladas; las futuras, agendadas, confirmadas o canceladas.
  - Duran entre 15 y 90 minutos.
  - Los dos médicos tienen citas a la vez a las 10:00, y hay una cita doble del
    mismo médico.
  - Hay citas en sábado, y otras fuera de horario: a las 07:00, a las 19:00, un
    sábado a las 13:30 y un domingo.
  - Hay eventos sin paciente con icono y color (uno sin ninguno de los dos), uno
    de todo el día y dos de varios días. Uno de ellos cruza de una semana a la
    siguiente.

**Clínica B.** Es free virgen, con 1 médico, 3 pacientes y unas 17 citas en las
mismas fechas. Sirve para comprobar el aislamiento.

## Cómo siembra

Sigue las rutas de la app:
- El registro, `POST /api/me/clinica` e invitar/aceptar invitación.
- `PUT /api/me/perfil-medico`, `POST /api/consultorios` y `POST /api/pacientes`
  (el RPC `crear_paciente_con_medico_v2`, que guarda el consentimiento).
- `POST /api/appointments`, y después el cambio de estado.

Perfil, consultorios, pacientes y citas se escriben con la sesión del propio
usuario (anon key), así que pasan por la RLS y por los gates. Las citas guardan
`gcal_sync_status='pending'`, igual que la app cuando no hay Google conectado.

Al final, el script entra con la contraseña de cada usuario y comprueba su
`profiles` y que no ve citas de otra clínica.

## Límites

- **No borra expediente clínico.** Si alguien escribió consultas, documentos o
  mediciones sobre estos pacientes, el borrado se detiene y avisa.
- **`audit_log` no se borra**, porque es inmutable por trigger. Cada siembra deja
  en él sus filas.
