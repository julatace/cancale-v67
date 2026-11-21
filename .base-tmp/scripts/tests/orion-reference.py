"""Contrôle des anciennes archives livrées intactes, sans reconditionnement."""
from pathlib import Path
import hashlib
import json
import zipfile
root = Path(__file__).resolve().parents[2]
ref = json.loads((root / 'scripts/orion-reference-5.319.0.json').read_text())
for fichier in ref['fichiers']:
    chemin = root / 'public' / fichier['fichier']
    assert hashlib.sha256(chemin.read_bytes()).hexdigest() == fichier['sha256'], fichier['fichier']
    with zipfile.ZipFile(chemin) as z:
        assert z.testzip() is None
        prefixe = 'VRM-Orion/' if '-dossier' in fichier['fichier'] else ''
        assert json.loads(z.read(prefixe + 'manifest.json'))['version'] == '5.319.0'
assert (root/'public/VRM-Orion-reference-5.319.0.xpi').read_bytes() == (root/'public/VRM-Orion-reference-5.319.0.zip').read_bytes()
print('OK : trois anciennes archives 5.319.0 intactes, empreintes SHA-256 et intégrité vérifiées ; pas de promesse de correction ni d’installation sur appareil.')
