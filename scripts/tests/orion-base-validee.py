"""Le paquet Orion reste la base validée sur l'appareil de Julien (5.319.0),
plus SEULEMENT ce que la base commune de l'extension a changé depuis.

Histoire (docs/passation/2026-11-05-orion-base-validee.md) : Julien a confirmé
que l'archive 5.319.0 s'installe dans Orion ; la 5.322 y a appliqué la seule
demande (popup.js) « sans créer un moteur Orion séparé qui pourrait diverger des
prochaines versions ». La première version de ce contrôle comparait membre à
membre à la 5.319 et refusait tout changement hors popup.js : elle ne pouvait
plus passer dès la 5.323 (chaque version de l'extension change background.js,
vc.js…), alors que ces changements sont ceux de la base COMMUNE, publiés
partout. (8 nov., CI verte) La règle jugée est désormais :

  1. même jeu de membres que la référence installable (rien ajouté, rien retiré) ;
  2. l'adaptateur Orion (`compat-orion.js`) identique octet pour octet à la
     référence, et `orion-main.js` celui du dépôt ;
  3. le manifeste Orion identique à celui de la référence, numéro de version
     excepté (MV2, identifiant, permissions, hôtes, scripts de démarrage,
     ressources : la forme que Julien a vue s'installer) ;
  4. chaque autre membre est EXACTEMENT le fichier de `vinted-sync-extension/`
     (popup.html : plus la seule balise compat-orion) — aucun changement propre
     à Orion, et un paquet régénéré d'une extension périmée est refusé ;
  5. la version du paquet est celle du manifeste de l'extension.
"""
from pathlib import Path
import zipfile
import json
root = Path(__file__).resolve().parents[2]
ext = root / 'vinted-sync-extension'
adapt = root / 'scripts' / 'extension-orion'
with zipfile.ZipFile(root/'public/VRM-Orion-reference-5.319.0.xpi') as ancien, zipfile.ZipFile(root/'public/VRM-Orion.xpi') as nouveau:
    noms = set(nouveau.namelist())
    assert set(ancien.namelist()) == noms, f'Membres ajoutés ou retirés : {sorted(set(ancien.namelist()) ^ noms)}'
    version = json.loads(nouveau.read('manifest.json'))['version']
    attendue = json.loads((ext/'manifest.json').read_text('utf8'))['version']
    assert version == attendue, f'Paquet Orion {version} ≠ extension {attendue} : paquet à régénérer (node scripts/zip-extension.cjs)'
    assert ancien.read('compat-orion.js') == nouveau.read('compat-orion.js'), "L'adaptateur Orion a changé par rapport à la référence installable"
    assert nouveau.read('orion-main.js') == (adapt/'orion-main.js').read_bytes(), 'orion-main.js ne vient pas du dépôt'
    m_ancien = json.loads(ancien.read('manifest.json')); m_nouveau = json.loads(nouveau.read('manifest.json'))
    m_ancien.pop('version'); m_nouveau.pop('version')
    assert m_ancien == m_nouveau, 'Le manifeste Orion a changé de forme (permissions, hôtes, scripts, ressources) par rapport à la référence installable'
    propres = []
    for nom in sorted(noms - {'manifest.json', 'compat-orion.js', 'orion-main.js'}):
        if nom.endswith('/'):
            continue
        source = (ext/nom).read_bytes()
        if nom == 'popup.html':
            texte = source.decode('utf8')
            i = texte.lower().find('<script')
            source = (texte[:i] + '<script src="compat-orion.js"></script>\n' + texte[i:]).encode('utf8')
        if nouveau.read(nom) != source:
            propres.append(nom)
    assert not propres, f'Changements propres à Orion (hors base commune de l’extension) : {propres}'
    print(f'OK : paquet Orion {version} = base commune de l’extension ; adaptateur, manifeste (hors version) et membres de la référence 5.319.0 installable conservés.')
