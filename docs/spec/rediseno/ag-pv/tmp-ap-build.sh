#!/bin/sh
# Regenera las vistas del asistente, ensambla y deja tmp-ver.html
cd "$(dirname "$0")"
python3 tmp-ap-gen.py >/dev/null && python3 ../kit/build.py . "Agenda · Primera vez" && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html
