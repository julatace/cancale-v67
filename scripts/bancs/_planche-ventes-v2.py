# La planche de Ventes, nouveau design (banc design-v2-ventes) : À envoyer clair et sombre, la rangée imprimée, En route.
# usage : python3 -I _planche-ventes-v2.py <dossier des captures> <sortie.png>
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
W, H = 390, 844
def police(t):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, t)
    return ImageFont.load_default()
f1, f2 = police(30), police(20)
CAPS = [('ventes-390-clair.png', 'À envoyer · clair'), ('ventes-390-sombre.png', 'À envoyer · sombre'), ('ventes-fait-390-clair.png', 'Imprimée : la rangée part'),
        ('ventes-route-390-sombre.png', 'En route · sombre'), ('ventes-outils-390-clair.png', '« ⋯ » : les gestes d’hier')]
marge, tete, col = 32, 150, 24
board = Image.new('RGB', (marge * 2 + len(CAPS) * W + (len(CAPS) - 1) * col, tete + H + 60), (238, 243, 248))
d = ImageDraw.Draw(board)
d.text((marge, 28), 'Ventes · nouveau design (essai) — 390 px, base inventée (30 colis à envoyer, 18 en route)', font=f1, fill=(12, 29, 48))
d.text((marge, 76), 'Titre + « Imprimer N » + cloche sur une ligne · un segmenté · « 30 colis à envoyer » et l’écart nommé · recherche, scanner dedans · groupes par échéance · rangées A.', font=f2, fill=(74, 91, 109))
x = marge
for f, nom in CAPS:
    p = os.path.join(src, f)
    if os.path.exists(p):
        board.paste(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS), (x, tete))
    d.text((x, tete - 34), nom, font=f2, fill=(12, 29, 48))
    x += W + col
board.save(out, optimize=True)
print(out, board.size)
