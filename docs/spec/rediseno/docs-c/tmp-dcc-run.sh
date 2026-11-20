#!/bin/sh
# Regenera las vistas, ensambla y envuelve para verlas. Uso: sh tmp-dcc-run.sh
D=$(cd "$(dirname "$0")" && pwd)
python3 "$D/tmp-dcc-gen.py" && python3 "$D/../kit/build.py" "$D" "Documentos 3" >/dev/null && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat "$D/pagina.html") > "$D/tmp-ver.html"
