"""Vérifie le garde sur des copies jetables : aucune archive livrée n'est modifiée."""
from pathlib import Path
import json, shutil, subprocess, sys, tempfile, zipfile
root = Path(__file__).resolve().parents[2]
def essai(modifier=None):
    with tempfile.TemporaryDirectory(prefix='vrm-garde-orion-') as dossier:
        d=Path(dossier); (d/'scripts/tests').mkdir(parents=True); (d/'scripts/extension-orion').mkdir(); (d/'public').mkdir()
        shutil.copytree(root/'vinted-sync-extension', d/'vinted-sync-extension')
        for nom in ['VRM-Orion.xpi','VRM-Orion-reference-5.319.0.xpi']: shutil.copy2(root/'public'/nom,d/'public'/nom)
        shutil.copy2(root/'scripts/extension-orion/orion-main.js',d/'scripts/extension-orion/orion-main.js')
        shutil.copy2(root/'scripts/tests/orion-base-validee.py',d/'scripts/tests/orion-base-validee.py')
        if modifier:
            z=d/'public/VRM-Orion.xpi'
            with zipfile.ZipFile(z) as f: fichiers={n:f.read(n) for n in f.namelist()}
            modifier(fichiers)
            with zipfile.ZipFile(z,'w') as f:
                for n,octets in fichiers.items(): f.writestr(n,octets)
        return subprocess.run([sys.executable,str(d/'scripts/tests/orion-base-validee.py')],capture_output=True,text=True)
def manifeste(f,cle,valeur):
    m=json.loads(f['manifest.json']);m[cle]=valeur;f['manifest.json']=json.dumps(m).encode()
def elargir_oauth(f):
    m=json.loads(f['manifest.json'])
    for c in m['content_scripts']:
        if 'oauth-retour.js' in c['js']:c['matches']=['https://*/*']
    f['manifest.json']=json.dumps(m).encode()
assert essai().returncode==0,'La livraison actuelle doit être reconnue'
cas={
 'fichier inattendu':lambda f:f.update({'inattendu.js':b'inattendu'}),
 'fichier retiré':lambda f:f.pop('popup.js'),
 'retour OAuth corrompu':lambda f:f.update({'oauth-retour.js':b'alteration'}),
 'hôtes OAuth élargis':elargir_oauth,
 'permission élargie':lambda f:manifeste(f,'permissions',['<all_urls>']),
 'adaptateur modifié':lambda f:f.update({'compat-orion.js':b'alteration'}),
 'version périmée':lambda f:manifeste(f,'version','0.0.1'),
 'base commune modifiée':lambda f:f.update({'background.js':b'alteration'}),
}
for nom,modifier in cas.items():
    r=essai(modifier);assert r.returncode!=0,nom+' accepté à tort';print('REFUS confirmé : '+nom)
print('9 contrôles du garde Orion réussis, archives de production intactes.')
