"""Parte archivos SQL en sentencias de NIVEL SUPERIOR (respeta '…', "…", $tag$…$tag$,
-- y /* */) y clasifica las que no son DDL de un objeto. Uso:
python3 -I sentencias.py SALIDA.tsv archivo1.sql archivo2.sql …
Columnas: archivo, línea, clase, primera línea normalizada (300 car.), texto normalizado completo."""
import sys, re

def sentencias(s):
    i, n, ini, linea, ini_linea = 0, len(s), 0, 1, 1
    out = []
    buf_tiene = False
    while i < n:
        c = s[i]
        if c == '\n':
            linea += 1
        if s.startswith('--', i):
            j = s.find('\n', i); j = n if j < 0 else j
            i = j; continue
        if s.startswith('/*', i):
            j = s.find('*/', i + 2); j = n if j < 0 else j + 2
            linea += s.count('\n', i, j); i = j; continue
        if not buf_tiene and not c.isspace():
            buf_tiene = True; ini = i; ini_linea = linea
        if c in ("'", '"'):
            j = i + 1
            while j < n:
                if s[j] == c and j + 1 < n and s[j + 1] == c:
                    j += 2; continue
                if s[j] == c: break
                j += 1
            linea += s.count('\n', i, j + 1); i = j + 1; continue
        m = re.match(r'\$[A-Za-z_0-9]*\$', s[i:i + 64]) if c == '$' else None
        if m and not re.match(r'\$\d', s[i:i+2]):
            tag = m.group(0); j = s.find(tag, i + len(tag)); j = n if j < 0 else j + len(tag)
            linea += s.count('\n', i, j); i = j; continue
        if c == ';':
            out.append((ini_linea, s[ini:i]))
            buf_tiene = False; i += 1; continue
        if c == '\\' and (i == 0 or s[i-1] == '\n') and not buf_tiene:
            pass
        i += 1
    if buf_tiene and s[ini:].strip():
        out.append((ini_linea, s[ini:]))
    return out

def sin_coment(t):
    t = re.sub(r'--[^\n]*', '', t)
    return re.sub(r'\s+', ' ', t).strip()

def clase(t):
    u = sin_coment(t).upper()
    reglas = [
        (r'^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\b', 'transaccion'),
        (r'^SET (LOCAL )?(LOCK_TIMEOUT|STATEMENT_TIMEOUT|IDLE_IN_TRANSACTION)', 'set_timeout'),
        (r'^(SET|RESET)\b', 'SET'),
        (r'^(INSERT|UPDATE|DELETE|MERGE|COPY|TRUNCATE)\b', 'DATOS'),
        (r'^NOTIFY\b|PG_NOTIFY', 'NOTIFY'),
        (r'^ALTER PUBLICATION\b', 'ALTER_PUBLICATION'),
        (r'^ALTER DEFAULT PRIVILEGES\b', 'DEFAULT_PRIVILEGES'),
        (r'^COMMENT ON\b', 'COMMENT'),
        (r'^ALTER TABLE .* (ENABLE|DISABLE|FORCE|NO FORCE) ROW LEVEL SECURITY', 'RLS'),
        (r'^ALTER .* OWNER TO\b', 'OWNER'),
        (r'^CREATE EXTENSION\b', 'EXTENSION'),
        (r'^(GRANT|REVOKE)\b.* ON (SCHEMA|SEQUENCE|ALL SEQUENCES|ALL TABLES|ALL FUNCTIONS|ALL ROUTINES|DATABASE|LARGE OBJECT|TYPE|DOMAIN)\b', 'GRANT_ESQUEMA_SECUENCIA'),
        (r'^(GRANT|REVOKE)\b', 'GRANT_OBJETO'),
        (r'^DO\b', 'DO'),
        (r'^(SELECT|WITH|TABLE|VALUES)\b', 'SELECT'),
        (r'^(CREATE|ALTER|DROP)\b', 'DDL'),
        (r'^\\', 'PSQL'),
    ]
    for r, k in reglas:
        if re.search(r, u, re.S):
            if k == 'DO':
                cuerpo = u
                marcas = [m for m in ('INSERT INTO', 'UPDATE ', 'DELETE FROM', 'EXECUTE', 'GRANT ', 'REVOKE ', 'ALTER ', 'COMMENT ON', 'NOTIFY', 'CREATE ', 'DROP ') if m in cuerpo]
                return 'DO[' + ','.join(m.strip() for m in marcas) + ']' if marcas else 'DO[sólo_lee]'
            if k == 'SELECT' and ('PG_NOTIFY' in u or 'SET_CONFIG' in u or 'SETVAL' in u):
                return 'SELECT_EFECTO'
            return k
    return 'OTRA'

salida = sys.argv[1]
with open(salida, 'w', encoding='utf-8') as f:
    f.write('archivo\tlinea\tclase\tinicio\ttexto\n')
    for ruta in sys.argv[2:]:
        s = open(ruta, encoding='utf-8').read()
        for ln, t in sentencias(s):
            k = clase(t)
            if k in ('DDL', 'transaccion', 'set_timeout', 'SELECT', 'GRANT_OBJETO', 'DO[sólo_lee]'):
                continue
            norm = sin_coment(t)
            f.write(f"{ruta.rsplit('/',1)[-1]}\t{ln}\t{k}\t{norm[:300]}\t{norm}\n")
print('ok')
