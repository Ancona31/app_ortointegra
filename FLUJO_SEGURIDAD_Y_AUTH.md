# Flujo de seguridad y auth — documento de traspaso

**Fecha:** 2026-09-11 · **Rama:** `main`

Este documento describe **el plan y el flujo de trabajo** del proyecto de
seguridad. **El repositorio es público:** aquí no se registra ningún hallazgo,
ningún archivo señalado, ninguna línea de código ni mecanismo alguno. Todo eso
vive fuera de git, en local. Quien retome el trabajo arranca leyendo este
archivo y luego abre los reportes locales; no necesita el historial de ningún
chat.

**Regla de escritura para este archivo:** si una frase permitiría a un tercero
acotar dónde mirar, no va. Ante la duda, se queda fuera.

---

## 1 · Situación

El 2026-09-11 se corrió una auditoría de seguridad con `claude-security` sobre
**246 archivos**.

**Resultado:**

| Concepto | Cantidad |
|---|---|
| Hallazgos verificados por panel de tres votos | **30** |
| — de severidad alta | 4 |
| — de severidad media | 26 |
| Candidatos que nunca llegaron a verificarse | 21 |
| Rondas que terminaron sin votos | 6 |

**Coste:** ~18 M de tokens repartidos en **tres intentos**. La causa es
estructural, no accidental: el esfuerzo medio topa en 12 componentes, y 246
archivos lo saturaron. Los dos primeros intentos murieron antes de cerrar el
panel y el tercero llegó con los 21 candidatos sin verificar.

**Dónde viven los reportes — NO están en git:**

- `~/spinus-seguridad-privado/` (máquina Linux):
  - `SECURITY_AUDITORIA_COMPLETA.md` — corrida completa.
  - `SECURITY_HALLAZGOS_20260911.md` — hallazgos verificados.
  - `MAPA_AUDITORIA.md` — división en lotes.
  - `CLAUDE-SECURITY-<timestamp>/` — artefactos crudos de la corrida.
- Copia adicional en el escritorio de la misma máquina.

Existen copias de los mismos archivos en la raíz del repo, **ignoradas por
git** (ver §5). Que aparezcan al hacer `ls` no significa que estén versionadas.

---

## 2 · La estrategia nueva de auditoría

**Alcance pequeño + esfuerzo alto, en lotes que terminen dentro de una sola
ventana de sesión.** Lo importante no es la consigna sino la justificación
técnica, porque es lo que se olvida entre sesiones:

- **Topes de paralelismo:** `low`/`medium` topan en **12 componentes**;
  `high`/`max` en **24**. Un alcance de 246 archivos revienta cualquiera de los
  dos.
- **Investigadores por celda:** `medium` asigna **1**; `high` asigna **2**.
- **Barridos de relleno:** 0 en `low`, 1 en `medium`, 2 en `high`/`max`.
- **Acotar NO baja la calidad.** Con alcance limitado el proceso se condensa a
  un solo investigador, pero **mantiene el mismo estándar de verificación**.
  El panel es el que da la confianza, y el panel no se toca.
- **El panel es el multiplicador de coste:** cada candidato × 3 verificadores,
  y cada verificador relee el contexto. El gasto escala con el número de
  candidatos, no con el de archivos.
- **Un escaneo que muere y se reanuda REPITE el panel entero.** De aquí sale el
  mayor ahorro de todo el plan: que el lote quepa en una ventana. Es la razón
  principal del cambio de estrategia, por encima de cualquier otra.
- **Modelo:** investigadores y verificadores heredan el modelo de la sesión.
  **Decisión de Angel: se mantiene Opus 5.** No se degrada a un modelo menor
  para abaratar; el ahorro viene del alcance, no de la capacidad.
- **Contexto inyectado:** existe `.claude/claude-security-guidance.md` (8 KB, ya
  escrito) que da a los investigadores el contexto del producto y evita que cada
  uno lo redescubra desde cero.
  **⚠️ `.claude/` está en `.gitignore`: ese archivo NO viaja entre máquinas.**
  Al cambiar de equipo hay que copiarlo a mano o la calidad de la corrida cae
  sin aviso.

**División en lotes:** `MAPA_AUDITORIA.md` (fuera de git, en local) —
**21 lotes, 652 archivos, sin solapamientos**. Es el plan de cobertura
completo; los 246 archivos de la corrida vieja son un subconjunto.

---

## 3 · Orden de trabajo acordado

### a) L1 — auditoría acotada del módulo de auth

27 archivos, esfuerzo **alto**. Cumple dos funciones: auditar auth y **medir el
coste real de un lote**, que es el dato que falta para planear los 20 restantes.

**⚠️ Añadir a esa corrida una pregunta explícita de veredicto**, además del
escaneo normal:

> ¿El módulo de autenticación, como está hoy, cumple los estándares de la
> industria para un SaaS? ¿Se puede reparar lo existente para soportar
> autenticación de dos factores e integración con Google, correctamente acoplado
> a Supabase, o conviene rehacerlo desde cero?

La respuesta decide si lo siguiente es reparar o reescribir. No se empieza a
tocar auth antes de tenerla.

### b) Montar entorno local

Docker + CLI de Supabase + esquema clonado.

**⚠️ ESQUEMA SÍ, DATOS DE PRODUCCIÓN NO.** Son expedientes clínicos reales;
copiarlos al disco local es un problema de LFPDPPP, no una incomodidad. Se
usan datos de prueba inventados.

### c) L2 — `supabase/` y las policies

Requiere (b): hace falta una base donde ejecutar. **Es el punto ciego mayor del
proyecto:** las 70 migraciones se auditaron una a una antes de aplicarse, pero
**nunca juntas**. Lo que ninguna revisión individual pudo ver es la interacción
del conjunto.

### d) Resto de lotes por prioridad

Según `MAPA_AUDITORIA.md`, con el coste real ya medido en (a).

### Pendiente de decidir

Los **42 archivos que usan el cliente de servicio** atraviesan **nueve lotes**.
Está sin decidir si merecen una corrida transversal propia en lugar de quedar
repartidos. Argumento a favor: el criterio de revisión es el mismo para los 42 y
se pierde al fragmentarlos. Argumento en contra: duplica cobertura y coste.

---

## 4 · Ramas

| Rama | Papel |
|---|---|
| `main` | Estable. |
| `feature/auth-a` | Módulo de auth. Contiene `AUTH_PLAN_DEFINITIVO.md` y la migración del limitador. Aquí van los hallazgos de auth, Google OAuth y 2FA. |
| `fix/seguridad-auditoria` | El resto de hallazgos y los reportes de los lotes. |

**Estado verificado el 2026-09-11:**

- `feature/auth-a` existe **solo en `origin`**, no hay copia local, y está
  **desfasada: `main` le lleva 328 commits y ella a `main` 7**. Antes de
  trabajar en L1 hay que traerla y poner `main` dentro; auditar sobre el árbol
  viejo daría un veredicto sobre código que ya no es el que corre.
- `fix/seguridad-auditoria` está **idéntica a `main`** (0 commits de
  diferencia en ambos sentidos). Está lista para recibir trabajo.

---

## 5 · Reglas de higiene

- **Los documentos de análisis de seguridad NO se suben.** Están en
  `.gitignore`, verificado: `SECURITY_*.md` (línea 81), `CLAUDE-SECURITY-*/`
  (82), `MAPA_AUDITORIA.md` (83), `.claude/` (47). Ningún archivo de seguridad
  figura hoy en `git ls-files`.
- **Antes de crear cualquier documento de seguridad nuevo, comprobar que el
  nombre cae dentro de esos patrones.** Un nombre fuera de patrón lo publica sin
  aviso, y en un repo público el borrado posterior no deshace nada.
- **Los reportes existen solo en la máquina Linux.** Hay dos copias, pero en el
  mismo disco: eso no es respaldo. **Falta respaldo externo** — un fallo de
  disco borra los 30 hallazgos y los 18 M de tokens que costaron. Pendiente
  abierto.

---

## 6 · Contexto de calendario

- **NOM-024 sigue siendo bloqueante del lanzamiento** y lleva días sin avanzar.
- El proyecto de seguridad son **21 lotes**. A ritmo de un lote por sesión, es
  un calendario propio, no un trámite que se intercale.
- **Decisión pendiente, y es la que ordena todo lo demás: qué es
  pre-lanzamiento y qué no.** Los 21 lotes no caben antes de lanzar, y NOM-024
  no se mueve solo. Mientras esa decisión no se tome, ambos frentes compiten por
  las mismas sesiones y ninguno avanza a fondo.

---

## Arranque rápido de la próxima sesión

1. Leer este archivo entero.
2. Abrir `~/spinus-seguridad-privado/` y leer `MAPA_AUDITORIA.md` (lotes) y
   `SECURITY_HALLAZGOS_20260911.md` (los 30 verificados).
3. Confirmar que `.claude/claude-security-guidance.md` está presente en esta
   máquina (§2).
4. Traer `feature/auth-a` y ponerle `main` dentro (§4).
5. Correr L1 con esfuerzo alto y la pregunta de veredicto de §3a.
6. Anotar el coste real del lote: es el dato que planea los otros 20.
