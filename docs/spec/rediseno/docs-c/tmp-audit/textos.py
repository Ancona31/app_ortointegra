# Auditoría de textos: extrae los textos visibles de las vistas y de los guiones y busca cada uno en el código del clon.
import re, sys, os, subprocess, html
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(D, '..', '..', 'app', 'src')
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s): super().__init__(); s.skip = 0; s.out = []
    def handle_starttag(s, t, a):
        if t in ('style', 'script'): s.skip += 1
        a = dict(a)
        for k in ('placeholder',):
            if a.get(k): s.out.append(a[k])
    def handle_endtag(s, t):
        if t in ('style', 'script'): s.skip -= 1
    def handle_data(s, d):
        if not s.skip and d.strip(): s.out.append(d.strip())
res = {}
for f in sys.argv[1:]:
    t = open(f).read()
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    p = P(); p.feed(t)
    for x in p.out: res.setdefault(re.sub(r'\s+', ' ', x), set()).add(os.path.basename(f)[:7])
    for m in re.finditer(r"'([^'\\]*(?:\\.[^'\\]*)*)'", re.search(r'<script>(.*)</script>', t, re.S).group(1)):
        s = m.group(1)
        if re.search(r'[a-záéíóúñ]{3,} [a-záéíóúñ]', s, re.I) and '<' not in s and '{' not in s and 'PX' not in s and not s.startswith('.'):
            res.setdefault(s, set()).add('js')
for k in sorted(res):
    if re.fullmatch(r'[\d\s.,:$/%·×—–-]*', k): continue
    q = k.split('«')[0].strip() if '«' in k else k
    q = q[:60]
    r = subprocess.run(['grep', '-rlF', '--include=*.tsx', '--include=*.ts', q, APP], capture_output=True, text=True).stdout.split()
    print(('OK  ' if r else 'NO  ') + k + ('  [' + os.path.relpath(r[0], APP) + ']' if r else ''))
