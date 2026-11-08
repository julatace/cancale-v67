#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════════
#  LES ICÔNES v5 (8 nov. 2026, « beauté », point 6) — python3 scripts/export-icones-v5.py
#  Le mot VRM en blanc (le dessin de toujours : public/vrm-wordmark-v3.png, ses
#  lettres jamais déformées) posé sur LA CARTE SOMBRE de l'app (DESIGN.md, la
#  signature : un bleu nuit en dégradé radial, #1F3A5F vers #1D1D1F) — au lieu du
#  gris-bleu #21343e d'avant, qui n'était plus aucune couleur de l'app. Aucun violet.
#  Des NOMS NEUFS (-v5) : une icône publiée ne change jamais de contenu (les
#  téléphones la gardent en cache sous son nom).
#    · vrm-icon-v5-192/512 : « any » (le mot à 76 % de la largeur) ;
#    · vrm-maskable-v5-512 : « maskable » (le mot à 58 % : dans le cercle sûr de 80 %) ;
#    · vrm-apple-touch-icon-v5 (180, sans transparence : iOS arrondit lui-même) ;
#    · vrm-logo-v5-96/192 : le logo dans l'app ; vrm-boot-v5-144 : l'écran de démarrage.
# ════════════════════════════════════════════════════════════════════════════
import os
from PIL import Image, ImageChops

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUB = os.path.join(RACINE, 'public')
HAUT = (0x2A, 0x4E, 0x7E)   # le halo, un cran plus clair que #1F3A5F pour qu'il se lise en petit
BAS = (0x1D, 0x1D, 0x1F)


def fond(taille):
    # Dégradé radial : clair en haut à gauche (35 % / 25 %), sombre aux bords.
    g = Image.radial_gradient('L').resize((taille * 2, taille * 2), Image.BICUBIC)  # 0 au centre, 255 au bord
    cx, cy = int(taille * 0.35), int(taille * 0.25)
    g = g.crop((taille - cx, taille - cy, taille - cx + taille, taille - cy + taille))
    g = g.point(lambda v: min(255, int(v * 1.25)))
    a = Image.new('RGB', (taille, taille), HAUT)
    b = Image.new('RGB', (taille, taille), BAS)
    return Image.composite(b, a, g)


def mot_blanc():
    m = Image.open(os.path.join(PUB, 'vrm-wordmark-v3.png')).convert('RGBA')
    alpha = m.getchannel('A')
    bbox = alpha.getbbox()
    alpha = alpha.crop(bbox)
    blanc = Image.new('RGBA', alpha.size, (255, 255, 255, 255))
    blanc.putalpha(alpha)
    return blanc


def icone(taille, largeur, nom):
    f = fond(taille).convert('RGBA')
    m = mot_blanc()
    w = int(round(taille * largeur))
    h = int(round(m.size[1] * w / m.size[0]))
    m = m.resize((w, h), Image.LANCZOS)
    f.alpha_composite(m, ((taille - w) // 2, (taille - h) // 2))
    f.convert('RGB').save(os.path.join(PUB, nom), optimize=True)
    return nom


if __name__ == '__main__':
    faits = [
        icone(192, 0.76, 'vrm-icon-v5-192.png'),
        icone(512, 0.76, 'vrm-icon-v5-512.png'),
        icone(512, 0.58, 'vrm-maskable-v5-512.png'),
        icone(180, 0.76, 'vrm-apple-touch-icon-v5.png'),
        icone(96, 0.80, 'vrm-logo-v5-96.png'),
        icone(192, 0.80, 'vrm-logo-v5-192.png'),
        icone(144, 0.78, 'vrm-boot-v5-144.png'),
    ]
    for n in faits:
        print(n, os.path.getsize(os.path.join(PUB, n)), 'octets')
