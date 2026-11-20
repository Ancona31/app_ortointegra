#!/bin/sh
S=/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
cd $S/entrega/dashboard-final && python3 tmp-gen.py >/dev/null && python3 $S/entrega/kit/build.py $S/entrega/dashboard-final "Dashboard" >/dev/null && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html && cd $S/tools && node tmp-dbu-cap.js
