"""Le moteur/adaptateur de la référence restent identiques hors versions.
Le comportement du seul fichier fonctionnel modifié est testé dans le navigateur.
"""
from pathlib import Path
import zipfile
import json
root = Path(__file__).resolve().parents[2]
with zipfile.ZipFile(root/'public/VRM-Orion-reference-5.319.0.xpi') as ancien, zipfile.ZipFile(root/'public/VRM-Orion.xpi') as nouveau:
    assert set(ancien.namelist()) == set(nouveau.namelist())
    version = json.loads(nouveau.read('manifest.json'))['version'].encode()
    modifies = {nom for nom in ancien.namelist() if ancien.read(nom).replace(b'5.319.0', version) != nouveau.read(nom)}
    assert modifies == {'popup.js'}, f'Changements hors fenêtre de connexion : {sorted(modifies)}'
    assert ancien.read('compat-orion.js') == nouveau.read('compat-orion.js')
    print('OK : seul popup.js change fonctionnellement ; moteur, adaptateur et ressources de la référence conservés hors numéros de version.')
