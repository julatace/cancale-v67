# La planche de comparaison des trois dessins de la rangée d'Annonces (banc design-v2-annonces).
# usage : python3 -I _planche-abc.py <dossier des captures> <sortie.png>
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
NOMS = {'A': 'A « Liste nette »', 'B': 'B « Carte photo »', 'C': 'C « Fiche compacte »'}
W, H = 390, 844
def police(t):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, t)
    return ImageFont.load_default()
f1, f2 = police(30), police(20)
marge, tete, col = 32, 150, 24
board = Image.new('RGB', (marge * 2 + 6 * W + 5 * col, tete + H + 60), (238, 243, 248))
d = ImageDraw.Draw(board)
d.text((marge, 28), 'Annonces · trois dessins de la rangée (nouveau design) — 390 px, 1 000 annonces, pires cas en tête', font=f1, fill=(12, 29, 48))
d.text((marge, 76), 'Pires cas : titre très long, N°B188, pas de photo (cintre), manteau et manuels (pas de taille). Glisser à gauche : Relier · Plus. B : appui long = fiche.', font=f2, fill=(74, 91, 109))
x = marge
for v in 'ABC':
    for th in ('clair', 'sombre'):
        p = os.path.join(src, f'annonces-{v}-390-{th}.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
            board.paste(im, (x, tete))
        d.text((x, tete - 34), f'{NOMS[v]} · {th}', font=f2, fill=(12, 29, 48))
        x += W + col
board.save(out, optimize=True)
print(out, board.size)
