import os
from PIL import Image, ImageDraw, ImageFont
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'm'); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'M-planche.png')
F = '/usr/share/fonts/opentype/inter/'
ft = ImageFont.truetype(F + 'Inter-Bold.otf', 46); fl = ImageFont.truetype(F + 'Inter-Regular.otf', 23); fh = ImageFont.truetype(F + 'Inter-SemiBold.otf', 26); fs = ImageFont.truetype(F + 'Inter-Medium.otf', 20)
TITRE = 'Proposition M « Une main » — on lit en haut, on touche en bas'
SOUS = 'Page blanche autonome (docs/maquettes/m, rien de src/), données inventées. Fraunces + Instrument Sans, vert bouteille, papier, kraft.'
LIGNES = [
 '1. Le haut ne sert qu’à LIRE : un champ vert bouteille, le titre, un menu « Tous les comptes », LE chiffre en serif 72.',
 '2. Tout ce qu’on touche est au pouce : segmenté (2–3 valeurs), recherche EN BAS comme Safari + LE geste (le seul plein), onglets icône + libellé.',
 '3. Signature : l’étiquette KRAFT — le N° a la matière du carton où il est écrit ; les colis à retirer sont des étiquettes de colis qu’on fait défiler (code, QR envoyé).',
 '4. Une ligne se GLISSE (Imprimer, Republier), s’APPUIE longuement (menu de la paire) ou se TOUCHE (feuille à deux crans, la paire en grand).',
 '5. Journée = des groupes « à faire » avec compteur et geste (À imprimer · À retirer · À ranger · Prix à saisir), pas une carte décorative.',
]
CASSE = ('Ce que ça casse : toute la coque actuelle (fond bleu, verre, styles-vitrine, police Inter) serait remplacée ; deux polices à embarquer (Fraunces 121 Ko, Instrument Sans 30 Ko) ; '
 'les rangées de pastilles (plateformes, comptes, outils) deviennent un segmenté + un menu au titre ; Leboncoin/eBay/Vestiaire, Messages, Stock passent derrière le menu et la recherche ; '
 'la pastille « + » du centre disparaît ; les vraies photos Vinted ne sont pas cadrées sur fond uni (il faudrait un détourage) ; textes à repasser par tr().')
M, G, TW = 48, 24, 330; TH = int(TW * 1688 / 780); W = M * 2 + TW * 5 + G * 4; DW = (W - 2 * M - 2 * G) // 3; DH = int(DW * 950 / 1512)
im = Image.new('RGB', (W, 9000), (244, 242, 236)); d = ImageDraw.Draw(im); y = M
d.text((M, y), TITRE, font=ft, fill=(21, 20, 15)); y += 64
d.text((M, y), SOUS, font=fl, fill=(106, 104, 95)); y += 48
for l in LIGNES: d.text((M, y), l, font=fl, fill=(21, 20, 15)); y += 34
y += 14
import textwrap
for l in textwrap.wrap(CASSE, 150): d.text((M, y), l, font=fl, fill=(143, 82, 0)); y += 32
y += 30
def rang(titre, items, w, h, n=5):
    global y
    d.text((M, y), titre, font=fh, fill=(28, 58, 45)); y += 44; x = M
    for i, (f, nom) in enumerate(items):
        if i and i % n == 0: x = M; y += h + 36 + G
        p = os.path.join(D, f)
        if os.path.exists(p): im.paste(Image.open(p).convert('RGB').resize((w, h), Image.LANCZOS), (x, y + 30))
        d.text((x, y), nom, font=fs, fill=(106, 104, 95)); x += w + G
    y += h + 30 + G + 20
EC = [('journee', 'Journée'), ('ventes', 'Ventes'), ('achats', 'Achats (colis à retirer)'), ('annonces', 'Annonces'), ('argent', 'Argent')]
rang('M « Une main » — iPhone 390, clair', [(f'M-{e}-390-clair.png', n) for e, n in EC], TW, TH)
rang('Les gestes — glisser, appui long, la paire en feuille, le code au comptoir', [('M-ventes-glisse-390-clair.png', 'Glisser ⇒ Imprimer'), ('M-ventes-menu-390-clair.png', 'Appui long ⇒ menu de la paire'), ('M-ventes-fiche-390-clair.png', 'Toucher ⇒ la paire (cran moyen)'), ('M-achats-code-390-clair.png', 'Montrer le code (QR envoyé)'), ('M-achats-code-390-sombre.png', 'Le code, la nuit')], TW, TH)
rang('iPhone 390, sombre', [(f'M-{e}-390-sombre.png', n) for e, n in EC], TW, TH)
rang('Ordinateur 1512, clair — on lit à gauche (le chiffre en affiche), la liste au centre, le pouce sous la liste', [(f'M-{e}-1512-clair.png', n) for e, n in EC], DW, DH, 3)
im = im.crop((0, 0, W, y + M - 20)); im.save(OUT, optimize=True); print(OUT, im.size)
