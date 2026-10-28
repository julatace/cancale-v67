#!/usr/bin/env python3
"""Construit les téléchargements Gmail depuis une source unique, sans secret."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import argparse
import io

root = Path(__file__).resolve().parent.parent
source = (root / 'scripts/gmail-forwarder.gs').read_bytes()
guide = (root / 'docs/exploitation/reception-gmail.md').read_bytes()
buffer = io.BytesIO()
with ZipFile(buffer, 'w', compression=ZIP_DEFLATED) as archive:
    for name, content in [('Code.gs', source), ('Lire-moi.md', guide)]:
        info = ZipInfo('VRM-reception-Gmail/' + name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
outputs = {
    root / 'public/VRM-gmail-forwarder.gs': source,
    root / 'public/VRM-reception-Gmail.zip': buffer.getvalue(),
}
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
for path, content in outputs.items():
    if args.check:
        if not path.exists() or path.read_bytes() != content:
            raise SystemExit(f'Téléchargement périmé : {path.name}. Relancer python3 scripts/pack-reception-gmail.py')
    else:
        path.write_bytes(content)
print('Gmail : source, téléchargement et archive identiques.')
