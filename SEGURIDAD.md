# Documento de Seguridad — OrthoIntegra
**Sistema de Gestión de Expedientes Clínicos**
**Versión:** 1.0
**Fecha:** 1 de abril de 2026
**Elaborado por:** Dr. Angel M. Ancona Pérez

---

## 1. Descripción General del Sistema

**OrthoIntegra** es una aplicación web de gestión de expedientes clínicos desarrollada para uso médico especializado en Cirugía de Columna Vertebral, Traumatología y Ortopedia. La aplicación gestiona:

- Expedientes clínicos de pacientes
- Consultas, diagnósticos y planes de tratamiento
- Documentos médicos (recetas, solicitudes de laboratorio/imagen, informes clínicos)
- Resultados de laboratorio con análisis por inteligencia artificial
- Agenda médica integrada con Google Calendar

**URL de producción:** `https://www.ortointegra.com`
**Infraestructura:** Vercel (frontend/API) + Supabase (base de datos PostgreSQL)

---

## 2. Marco Normativo de Referencia

Las medidas de seguridad implementadas se alinean con los siguientes estándares:

| Norma | Descripción |
|---|---|
| **NOM-024-SSA3-2012** | Sistema de información de registro electrónico para la salud (México) |
| **NOM-004-SSA3-2012** | Del expediente clínico |
| **OWASP Top 10** | Vulnerabilidades más críticas en aplicaciones web |
| **Principio de mínimo privilegio** | Cada usuario y proceso accede solo a lo estrictamente necesario |

---

## 3. Autenticación y Control de Acceso

### 3.1 Autenticación de Usuarios

- **Proveedor:** Supabase Auth (basado en PostgreSQL + JWT)
- **Sesiones:** Cookies HTTP-only con flag `Secure` y `SameSite=Lax`; la sesión se destruye al cerrar el navegador
- **Tokens JWT:** Firmados y verificados en cada solicitud al servidor
- **Contraseñas:** Almacenadas con hash bcrypt por Supabase Auth (nunca en texto plano)
- **Validación de registro:** Email con formato válido, contraseña mínimo 8 caracteres

### 3.2 Autenticación Multifactor (MFA)

- **TOTP habilitado** (Time-based One-Time Password) para todas las cuentas
- Compatible con Google Authenticator, Authy y aplicaciones similares
- Configurado en Supabase Authentication → Multi-Factor

### 3.3 Roles y Permisos

El sistema implementa un modelo de control de acceso basado en roles (RBAC) con 4 niveles:

| Rol | Descripción | Acceso |
|---|---|---|
| `super_admin` | Administrador del sistema | Acceso total a todas las clínicas |
| `admin` | Administrador de clínica | Gestión de usuarios de su clínica |
| `medico` | Médico tratante | Expedientes de su clínica |
| `secretaria` | Personal administrativo | Acceso limitado según configuración |

Los roles se verifican **tanto en el servidor (API)** como en la **base de datos (RLS)**, eliminando cualquier posibilidad de escalación de privilegios desde el cliente.

### 3.4 Límites de Licencia

Cada clínica tiene configurados límites de `max_medicos` y `max_secretarias` validados en el servidor antes de crear nuevos usuarios.

---

## 4. Seguridad de la Base de Datos

### 4.1 Row Level Security (RLS)

PostgreSQL Row Level Security está habilitado en **todas las tablas que contienen datos clínicos**, garantizando que un usuario autenticado solo pueda acceder a los registros de su propia clínica:

| Tabla | RLS | Política |
|---|---|---|
| `pacientes` | ✅ Habilitado | Solo registros con `clinica_id` del usuario |
| `consultas` | ✅ Habilitado | Solo consultas de pacientes de su clínica |
| `documentos` | ✅ Habilitado | Solo documentos de pacientes de su clínica |
| `laboratorios` | ✅ Habilitado | Solo laboratorios de pacientes de su clínica |
| `profiles` | ✅ Habilitado | Cada usuario solo ve/edita su propio perfil |
| `google_tokens` | ✅ Habilitado | Cada usuario solo accede a sus propios tokens |
| `rate_limits` | ✅ Habilitado | Cada usuario solo ve sus propios registros |
| `ip_rate_limits` | ✅ Habilitado | Solo accesible por service role (backend) |
| `audit_log` | ✅ Habilitado | Solo admin y super_admin pueden consultarlo |

Las políticas se implementan mediante la función `public.get_clinica_id()` que resuelve la clínica del usuario autenticado directamente en la base de datos.

### 4.2 Separación de Clientes de Supabase

La aplicación utiliza dos clientes distintos:

- **`createClient()`** — Cliente con sesión del usuario, sujeto a RLS
- **`createAdminClient()`** — Service role, solo en el servidor para operaciones administrativas controladas. La clave de service role **nunca se expone al cliente**

---

## 5. Seguridad de la API

### 5.1 Verificación de Autenticación

Cada endpoint de la API verifica la sesión del usuario mediante `supabase.auth.getUser()` antes de procesar cualquier solicitud. Las respuestas no autorizadas devuelven HTTP 401.

### 5.2 Validación de Entradas

- **Parámetros de búsqueda:** El parámetro `?q=` en búsquedas de medicamentos se sanitiza con expresión regular, permitiendo únicamente caracteres alfanuméricos, espacios y guiones. Esto previene inyección de operadores PostgREST.
- **Creación de usuarios:** Validación de formato de email (regex RFC-5322), longitud mínima de contraseña (8 caracteres) y lista blanca de roles válidos.
- **Inputs de IA:** Los textos enviados a modelos de inteligencia artificial se sanitizan para prevenir *prompt injection*, eliminando caracteres de control e instrucciones maliciosas.

### 5.3 Rate Limiting

El sistema implementa dos capas de rate limiting:

**Por usuario autenticado** (endpoints de IA):

| Endpoint | Límite |
|---|---|
| `/api/labs-extract` | 15 solicitudes / 24 horas |
| `/api/nota-medica` | 20 solicitudes / 24 horas |
| `/api/consulta-rapida` | 50 solicitudes / 24 horas |

**Por IP** (endpoint público):

| Endpoint | Límite |
|---|---|
| `/api/r/[folio]` (verificación pública de recetas) | 30 solicitudes / hora |

Los conteos se persisten en Supabase para ser efectivos en entornos serverless con múltiples instancias.

### 5.4 Protección CSRF

- El flujo OAuth de Google implementa verificación de parámetro `state` (anti-CSRF), almacenado en cookie HTTP-only y comparado al retorno del callback.

---

## 6. Cifrado y Protección de Datos Sensibles

### 6.1 Tokens OAuth de Google Calendar

Los tokens de acceso y actualización de Google Calendar se cifran con **AES-256-GCM** antes de almacenarse en la base de datos:

- **Algoritmo:** AES-256-GCM (autenticado, previene manipulación)
- **IV:** 12 bytes aleatorios por cada cifrado (nunca se reutiliza)
- **Clave:** 256 bits almacenada como variable de entorno (`GOOGLE_TOKEN_SECRET`), nunca en el código fuente ni en la base de datos
- **Formato de almacenamiento:** `iv:authTag:ciphertext` (todo en hexadecimal)

Esto garantiza que incluso con acceso directo a la base de datos, los tokens son ilegibles sin la clave de cifrado.

### 6.2 Variables de Entorno

Todas las credenciales sensibles (claves de API, secrets, service role key) se gestionan exclusivamente como variables de entorno:
- En desarrollo: archivo `.env.local` (excluido de control de versiones por `.gitignore`)
- En producción: Variables de entorno cifradas de Vercel

---

## 7. Trazabilidad y Auditoría

### 7.1 Audit Log Automático (Triggers de Base de Datos)

Se implementaron triggers en PostgreSQL que registran automáticamente **todas las mutaciones** (INSERT, UPDATE, DELETE) sobre las tablas clínicas:

| Tabla auditada | Operaciones registradas |
|---|---|
| `pacientes` | Creación, modificación, eliminación de pacientes |
| `consultas` | Creación, modificación, eliminación de consultas |
| `documentos` | Creación, modificación, eliminación de documentos médicos |
| `laboratorios` | Creación, modificación, eliminación de laboratorios |

Cada registro en `audit_log` contiene:
- `user_id` — Identificador del usuario que realizó la acción
- `accion` — Tipo de operación (INSERT / UPDATE / DELETE / acción personalizada)
- `tabla` — Tabla afectada
- `registro_id` — ID del registro modificado
- `ip` — Dirección IP del cliente (cuando disponible desde la API)
- `descripcion` — Contexto adicional (ej. nombre del archivo PDF generado)
- `created_at` — Timestamp de la operación

### 7.2 Log Explícito en Operaciones Sensibles

Adicionalmente, las siguientes operaciones de la API registran entradas explícitas en el audit log con IP del cliente:

- **Generación de documentos PDF** (`/api/generar-pdf`) — registra qué documento fue generado, por quién y desde qué IP

### 7.3 Acceso al Audit Log

Solo los roles `admin` y `super_admin` pueden consultar el audit log. El log es de solo lectura para todos los usuarios autenticados (incluyendo admins) — únicamente el service role del backend puede escribir en él.

---

## 8. Seguridad en la Generación de Documentos PDF

- La generación de PDFs mediante Puppeteer (Chrome headless) requiere sesión autenticada
- Se registra en el audit log cada generación de documento
- Los documentos médicos con código QR de verificación utilizan folios únicos (UUID) que solo son válidos para recetas emitidas por el sistema

---

## 9. Seguridad en Comunicaciones

- **HTTPS obligatorio** en producción (gestionado por Vercel + certificado TLS automático)
- **HSTS** habilitado por Vercel en el dominio `ortointegra.com`
- Las cookies de sesión tienen los flags `Secure` (solo HTTPS) y `HttpOnly` (no accesibles desde JavaScript)

---

## 10. Infraestructura y Disponibilidad

| Componente | Proveedor | Región |
|---|---|---|
| Frontend y API | Vercel (Edge Network) | Global CDN |
| Base de datos | Supabase (PostgreSQL 15) | AWS us-east-1 |
| Almacenamiento | Supabase Storage | AWS us-east-1 |

- **Backups automáticos** de la base de datos: gestionados por Supabase (retención según plan)
- **Actualizaciones de seguridad** del sistema operativo y dependencias de infraestructura: responsabilidad de Vercel y Supabase

---

## 11. Gestión de Vulnerabilidades

- Las dependencias del proyecto se mantienen actualizadas
- Se sigue la guía OWASP Top 10 en el desarrollo
- No se almacenan contraseñas en texto plano en ningún componente del sistema
- Se aplica el principio de mínimo privilegio en todos los accesos a datos

---

## 12. Resumen de Controles Implementados

| Control | Estado |
|---|---|
| Autenticación con JWT y sesiones seguras | ✅ |
| Autenticación multifactor (TOTP/MFA) | ✅ |
| Control de acceso basado en roles (RBAC) | ✅ |
| Row Level Security en todas las tablas clínicas | ✅ |
| Cifrado de tokens OAuth (AES-256-GCM) | ✅ |
| Rate limiting por usuario y por IP | ✅ |
| Sanitización de entradas y prevención de inyección | ✅ |
| Protección CSRF en flujos OAuth | ✅ |
| Audit trail automático con triggers de base de datos | ✅ |
| HTTPS y cookies seguras en producción | ✅ |
| Credenciales en variables de entorno cifradas | ✅ |
| Separación de privilegios (client vs service role) | ✅ |

---

*Documento generado el 1 de abril de 2026. Para consultas técnicas sobre este documento, contactar al responsable del sistema.*
