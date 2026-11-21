import os,shutil,re,sys
S='/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad'
D='/home/user/app_ortointegra/docs/spec/rediseno'
assert D.endswith('docs/spec/rediseno')
EXT={'.md','.html','.py','.css','.js','.sh','.json'}
SKIPD=re.compile(r'^(tmp-cap.*|tmp-pub|tmp-cal|tmp-cita|tmp-int|tmp-v\d+|__pycache__|pub-.*|tanda4|tanda\d+|calma-.*|consulta|dashboard|lanzador.*|nota.*|pacientes.*)$')
SKIPF=re.compile(r'(\.bak|\.v\d+\.|\.v\d+$|^pagina\.html$|^tmp-ver\.html$|\.log$)')
KEEP={'dashboard-final','final-lista','final-form','final-expediente','final-nota','final-consulta','docs-a','docs-b','docs-c','perfil','admin','lectura','capas-a','capas-b','cromo','agenda-base','ag-semana','ag-mes','ag-burbuja','ag-form','ag-ligado','ag-herr','ag-config','ag-pv','kit','doc-color'}
if os.path.isdir(D): shutil.rmtree(D)
os.makedirs(D)
n=0;tam=0
shutil.copy(f"{S}/entrega/ESTADO.md",D); shutil.copy(f"{S}/entrega/PLAN.md",D)
for carpeta in sorted(KEEP):
    src=f'{S}/entrega/{carpeta}'
    if not os.path.isdir(src): print('falta',carpeta); continue
    for r,ds,fs in os.walk(src):
        ds[:]=[d for d in ds if not SKIPD.match(d)]
        for f in fs:
            if os.path.splitext(f)[1] not in EXT or SKIPF.search(f): continue
            p=os.path.join(r,f)
            if os.path.getsize(p)>30e6: print('grande, fuera',p); continue
            q=os.path.join(D,os.path.relpath(p,f'{S}/entrega'))
            os.makedirs(os.path.dirname(q),exist_ok=True);shutil.copy(p,q);n+=1;tam+=os.path.getsize(p)
os.makedirs(f'{D}/informes');os.makedirs(f'{D}/tools')
for f in os.listdir(f'{S}/informes'):
    if f.endswith('.md'): shutil.copy(f'{S}/informes/{f}',f'{D}/informes/');n+=1
for f in ['chk-botones.js','rev.js','respaldo.py']: shutil.copy(f'{S}/tools/{f}',f'{D}/tools/');n+=1
print('archivos',n,'MB',round(tam/1e6,1))
