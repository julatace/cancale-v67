# Résout les conflits de fusion de CLAUDE.md (garde les lignes datées des deux côtés du §9)
# et de docs/passation/historique-divers.md (union), puis ramène CLAUDE.md sous 59 000 octets
# en déplaçant TELLES QUELLES les plus vieilles lignes du §9. Usage : python3 scripts/fusion-docs.py
# Toujours vérifier ensuite : git grep -nE "^(<<<<<<<|>>>>>>>)( |$)" -- .
import re,sys,os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # racine du dépôt
pat=re.compile(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n',re.S)
def union(m):
  a,b=m.group(1),m.group(2); out=a
  for l in b.splitlines(True):
    if l.strip() and l not in a: out+=l
  return out
def claude(m):
  a,b=m.group(1),m.group(2); out=a
  for l in b.splitlines(True):
    if re.match(r'- \*\*\d+ (oct|nov|déc)', l) and l not in a: out+=l
  return out
for p,f in [('CLAUDE.md',claude),('docs/passation/historique-divers.md',union)]:
  if os.path.exists(p):
    s=open(p).read(); s=pat.sub(f,s); open(p,'w').write(s)
# section 3 / 8 tables may conflict too: handled by claude() keeping HEAD + new 8 nov lines only
s=open('CLAUDE.md').read();h='docs/passation/historique-divers.md'
while len(s.encode())>=59000:
  i=s.index('## 9. État actuel'); j=s.index('Une ligne par chantier ou décision',i)
  lines=[l for l in s[i:j].split('\n') if l.startswith('- **')]
  last=lines[-1]; s=s.replace(last+'\n','',1); open(h,'a').write(last+'\n'); print('moved',last[:50])
open('CLAUDE.md','w').write(s)
print('CLAUDE', len(s.encode()), 'conflits restants', s.count('<<<<<<<'))
