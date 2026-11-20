set -e
cd "$(dirname "$0")"
python3 tmp-le-gen.py && python3 ../kit/build.py . "Estadísticas, ayuda y suplementación" >/dev/null
{ printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html; } > tmp-ver.html
mkdir -p tmp-cap && cd ../../tools && node tmp-le-cap.js
