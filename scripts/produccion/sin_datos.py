#!/usr/bin/env python3
"""Comprueba que unos volcados .sql no traen DATOS (lo llama sin-datos.sh).

Recorre cada archivo con un lexer mínimo de SQL (comillas simples, comillas
dobles, dollar-quoting, comentarios) para mirar SÓLO las sentencias de nivel
superior: un INSERT dentro del cuerpo de una función no es un dato.

Falla (código 1) y nombra archivo:línea ante:
  * una sentencia INSERT, UPDATE, DELETE, MERGE o VALUES de nivel superior;
  * un COPY … FROM stdin con alguna fila antes de «\\.»;
  * un setval distinto de setval(…, 1, false) (delata cuántas filas hubo);
  * lo_create / lo_open / lowrite / lo_from_bytea (objetos grandes);
  * un archivo que no se puede leer, o un literal sin cerrar al final.

Excepción acotada: el historial de migraciones (por omisión, todo archivo que
se llame 04-migraciones.tsv). Ahí sólo se admite la cabecera «version<TAB>name»,
una línea «# …» de aviso y filas «14 dígitos<TAB>nombre-de-archivo»; cualquier
otra cosa (p. ej. la columna statements) es un fallo.
"""
import os
import re
import sys

PROHIBIDAS = re.compile(r"^(INSERT|UPDATE|DELETE|MERGE|VALUES)\b", re.I)
COPY_STDIN = re.compile(r"^COPY\b.*\bFROM\s+stdin\b", re.I | re.S)
SETVAL = re.compile(r"\bsetval\s*\(", re.I)
SETVAL_INOCUO = re.compile(r"setval\s*\(\s*'[^']*'\s*,\s*1\s*,\s*false\s*\)", re.I)
OBJ_GRANDE = re.compile(r"\b(lo_create|lo_open|lowrite|lo_from_bytea|lo_put)\s*\(", re.I)
DOLAR = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")
FILA_HISTORIAL = re.compile(r"^\d{1,20}\t[A-Za-z0-9_.\-]*$")


def sentencias(texto):
    """Genera (línea, sentencia de nivel superior, filas de COPY o None).

    Los cuerpos entre $…$ y los literales largos se resumen: lo que importa es
    cómo EMPIEZA la sentencia, no lo que lleva dentro una función."""
    i, n, linea = 0, len(texto), 1
    linea_inicio, buf = 1, []
    while i < n:
        c = texto[i]
        if c == "\n":
            linea += 1
        if c == "-" and texto.startswith("--", i):
            j = texto.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and texto.startswith("/*", i):
            j = texto.find("*/", i + 2)
            if j < 0:
                raise ValueError(f"comentario /* sin cerrar (línea {linea})")
            linea += texto.count("\n", i, j)
            i = j + 2
            continue
        if c in ("'", '"'):
            j = i + 1
            while True:
                j = texto.find(c, j)
                if j < 0:
                    raise ValueError(f"literal {c} sin cerrar (empieza en la línea {linea})")
                if texto.startswith(c * 2, j):
                    j += 2
                    continue
                break
            linea += texto.count("\n", i, j)
            buf.append(texto[i:j + 1] if j - i < 200 else c + c)
            i = j + 1
            continue
        if c == "$":
            m = DOLAR.match(texto, i)
            if m and not (i > 0 and (texto[i - 1].isalnum() or texto[i - 1] == "_")):
                tag = m.group(0)
                j = texto.find(tag, m.end())
                if j < 0:
                    raise ValueError(f"cadena {tag} sin cerrar (empieza en la línea {linea})")
                linea += texto.count("\n", i, j)
                buf.append(" $$ ")
                i = j + len(tag)
                continue
        if c == ";":
            sent = "".join(buf).strip()
            i += 1
            filas = None
            if COPY_STDIN.match(sent):
                # las filas van desde la línea siguiente hasta una línea «\.»
                j = texto.find("\n", i)
                j = n if j < 0 else j + 1
                filas, linea_datos = 0, linea + 1
                while j < n:
                    k = texto.find("\n", j)
                    k = n if k < 0 else k
                    fila = texto[j:k]
                    linea += 1
                    j = k + 1
                    if fila == "\\.":
                        break
                    filas += 1
                else:
                    raise ValueError(f"COPY FROM stdin sin «\\.» de cierre (línea {linea_inicio})")
                i = j
                linea += 1  # ya estamos al principio de la línea que sigue a «\.»
                yield linea_datos, sent, filas
            else:
                yield linea_inicio, sent, None
            buf = []
            linea_inicio = linea
            continue
        if c == "\\" and not "".join(buf).strip() and (i == 0 or texto[i - 1] == "\n"):
            # metacomando de psql (\restrict, \connect…): una línea entera, se ignora
            j = texto.find("\n", i)
            i = n if j < 0 else j
            continue
        if not buf and c.isspace():
            i += 1
            continue
        if not buf:
            linea_inicio = linea
        buf.append(c)
        i += 1
    resto = "".join(buf).strip()
    if resto:
        yield linea_inicio, resto, None


def revisar_sql(ruta):
    with open(ruta, encoding="utf-8", errors="replace") as f:
        texto = f.read()
    hallazgos = []
    try:
        for linea, sent, filas in sentencias(texto):
            cabeza = sent[:120].replace("\n", " ")
            if filas:
                hallazgos.append((linea, f"COPY con {filas} fila(s): {cabeza[:80]}"))
            if PROHIBIDAS.match(sent):
                hallazgos.append((linea, f"sentencia con datos: {cabeza}"))
            if SETVAL.search(sent) and not SETVAL_INOCUO.search(sent):
                hallazgos.append((linea, f"setval con valor: {cabeza}"))
            if OBJ_GRANDE.search(sent):
                hallazgos.append((linea, f"objeto grande: {cabeza}"))
    except ValueError as e:
        hallazgos.append((0, f"no se pudo analizar: {e}"))
    return hallazgos


def revisar_historial(ruta):
    hallazgos = []
    with open(ruta, encoding="utf-8", errors="replace") as f:
        for n, linea in enumerate(f, 1):
            linea = linea.rstrip("\n")
            if n == 1 and linea == "version\tname":
                continue
            if linea.startswith("# ") or FILA_HISTORIAL.match(linea):
                continue
            hallazgos.append((n, f"línea no admitida en el historial: {linea[:100]!r}"))
    return hallazgos


def main(args):
    historial = {"04-migraciones.tsv"}
    archivos = []
    it = iter(args)
    for a in it:
        if a == "--historial":
            historial.add(os.path.basename(next(it)))
        else:
            archivos.append(a)
    if not archivos:
        print("uso: sin-datos.sh [--historial NOMBRE] ARCHIVO…", file=sys.stderr)
        return 2
    total = 0
    for ruta in archivos:
        try:
            h = revisar_historial(ruta) if os.path.basename(ruta) in historial else revisar_sql(ruta)
        except OSError as e:
            h = [(0, f"no se pudo leer: {e}")]
        for linea, motivo in h:
            print(f"{ruta}:{linea}: {motivo}")
        total += len(h)
        if not h:
            print(f"ok  {ruta}")
    if total:
        print(f"\nFALLA: {total} hallazgo(s). Esta foto trae datos o no se pudo comprobar.", file=sys.stderr)
        return 1
    print("\nSin datos: ningún INSERT, COPY con filas, setval con valor ni objeto grande.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
