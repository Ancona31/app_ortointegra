# Montaje de capturas para revisar: python3 tmp-mont.py salida.png esc.png ... (escala 0.5 si son anchas)
import sys
from PIL import Image
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f) for f in fs]
k = 0.5 if ims[0].width > 900 else 1
ims = [i.resize((int(i.width*k), int(i.height*k))) for i in ims]
cols = 2 if k < 1 else min(4, len(ims))
rows = (len(ims)+cols-1)//cols
W = max(i.width for i in ims); Hh = max(i.height for i in ims)
o = Image.new('RGB', (cols*W+(cols-1)*8, rows*Hh+(rows-1)*8), 'white')
for n, i in enumerate(ims): o.paste(i, ((n%cols)*(W+8), (n//cols)*(Hh+8)))
o.save(out)
