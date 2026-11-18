# La planche « frise avant → après » (banc frise-transporteur) : le même colis (Vinted « en cours d'acheminement », le
# transporteur « livré au relais ») avant, puis après, dans les deux designs.
# usage : python3 -I _planche-frise.py <captures avant> <captures après> <sortie.png> <largeur 390|1512>
import sys, os
from PIL import Image, ImageDraw, ImageFont
av, ap, out, L = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
W, H = (390, 844) if L == '390' else (756, 475)
def police(t):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, t)
    return ImageFont.load_default()
f1, f2 = police(28), police(18)
CAPS = [(av, f'frise-eteint-{L}-clair.png', 'Avant · clair'), (ap, f'frise-eteint-{L}-clair.png', 'Après · design d’hier · clair'), (ap, f'frise-allume-{L}-clair.png', 'Après · nouveau design · clair'),
        (av, f'frise-eteint-{L}-sombre.png', 'Avant · sombre'), (ap, f'frise-eteint-{L}-sombre.png', 'Après · design d’hier · sombre'), (ap, f'frise-allume-{L}-sombre.png', 'Après · nouveau design · sombre')]
cols = 3; marge, tete, col = 32, 130, 24
board = Image.new('RGB', (marge * 2 + cols * W + (cols - 1) * col, tete + 2 * (H + 50) + 20), (238, 243, 248))
d = ImageDraw.Draw(board)
d.text((marge, 24), f'La frise d’une vente : le transporteur tranche — {L} px', font=f1, fill=(12, 29, 48))
d.text((marge, 66), 'Vinted dit « en cours d’acheminement », Chronopost dit « livré au relais » il y a 2 j : avant, la frise restait sur « En transit ».', font=f2, fill=(74, 91, 109))
for k, (dos, f, nom) in enumerate(CAPS):
    x = marge + (k % cols) * (W + col); y = tete + (k // cols) * (H + 50)
    p = os.path.join(dos, f)
    if os.path.exists(p): board.paste(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS), (x, y + 26))
    d.text((x, y), nom, font=f2, fill=(12, 29, 48))
board.save(out, optimize=True); print(out, board.size)
