"""Archives réelles construites depuis des sources 0600/0700, sans compte réel."""
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(os.environ.get('VRM_PAQUET_ROOT', Path(__file__).resolve().parents[2]))
with tempfile.TemporaryDirectory(prefix='vrm-paquet-portable-') as tmp:
    root = Path(tmp)
    for chemin in ['vinted-sync-extension', 'scripts/extension-orion', 'scripts/extension-firefox']:
        shutil.copytree(ROOT / chemin, root / chemin)
    shutil.copy2(ROOT / 'scripts/zip-extension.cjs', root / 'scripts/zip-extension.cjs')
    (root / 'public').mkdir()
    shutil.copy2(ROOT / 'public/VRM-Orion-installation.txt', root / 'public/VRM-Orion-installation.txt')
    for chemin in (root / 'vinted-sync-extension').rglob('*'):
        chemin.chmod(0o700 if chemin.is_dir() else 0o600)
    (root / 'vinted-sync-extension').chmod(0o700)
    subprocess.run(['node', str(root / 'scripts/zip-extension.cjs'), '--firefox', str(root / 'firefox.zip'), '--safari', str(root / 'safari.zip'), '--store', str(root / 'store.zip')], check=True, capture_output=True)
    fichiers = list((root / 'public').glob('*.zip')) + [root / 'public/VRM-Orion.xpi', root / 'firefox.zip', root / 'safari.zip', root / 'store.zip']
    total = 0
    for fichier in fichiers:
        with zipfile.ZipFile(fichier) as archive:
            assert archive.testzip() is None, fichier.name
            assert len(archive.namelist()) == len(set(archive.namelist())), 'Entrées en double'
            for entree in archive.infolist():
                attendu = 0o755 if entree.is_dir() else 0o644
                lu = stat.S_IMODE(entree.external_attr >> 16)
                assert lu == attendu, f'{fichier.name} / {entree.filename}: {oct(lu)} au lieu de {oct(attendu)}'
                assert not entree.flag_bits & 1, 'Archive chiffrée'
                assert not Path(entree.filename).is_absolute() and '..' not in Path(entree.filename).parts
                total += 1
            manifestes = [n for n in archive.namelist() if n.endswith('manifest.json')]
            assert len(manifestes) == 1
            manifeste = json.loads(archive.read(manifestes[0]))
            assert manifeste['version'] == json.loads((root / 'vinted-sync-extension/manifest.json').read_text())['version']
            if 'Orion' in fichier.name:
                assert manifeste['manifest_version'] == 2
                assert manifestes == (['VRM-Orion/manifest.json'] if 'dossier' in fichier.name else ['manifest.json'])
    assert (root / 'public/VRM-Orion.xpi').read_bytes() == (root / 'public/VRM-Orion.zip').read_bytes()
    print(f'OK : {len(fichiers)} archives, {total} entrées contrôlées ; droits 644/755 malgré des sources 600/700. Aucune installation iOS réelle certifiée.')
