from PIL import Image, ImageDraw, ImageFont
import os
D='onglets/o/'
F='/usr/share/fonts/opentype/inter/'
f=lambda w,s: ImageFont.truetype(F+('Inter-'+w+'.otf'),s)
W=3400
TEL=['journee','annonces','fiche-annonce','ventes-glisse','achats','fiche-colis','argent']
NOMS={'journee':'Ma journée — à faire groupé','annonces':'Annonces — la galerie','fiche-annonce':'Fiche — feuille moyenne','ventes-glisse':'Ventes — ligne glissée','achats':'Achats — cartes de retrait','fiche-colis':'Code — feuille grande','argent':'Argent — le mois'}
tw=(W-80-6*24)//7; th=int(tw*844/390)
lignes=["1. Ce sont des chaussures : la photo fait l’identité — grille de 3 (6 à l’ordinateur) bord à bord, détourée sur fond de studio ; une annonce sans photo garde sa case (silhouette au trait).",
"2. La signature : l’étiquette du N° (encoche + œillet), accrochée à chaque photo, en grand sur la fiche, et jusqu’au logo ; rouge seulement quand deux paires portent le même N° (ici le 87).",
"3. Une vraie app iOS : grand titre + menu du compte, recherche intégrée, contrôle segmenté, listes groupées (vignette 60, 17/15, chevron, séparateurs inset), onglets icône + libellé (un seul jeu d’icônes au trait).",
"4. Les gestes au pouce : glisser une vente (Parti · Imprimer), la fiche en feuille à détentes (photo en haut, deux boutons en bas), les codes de retrait en cartes à faire défiler (lieu, date, QR, code en grand).",
"5. Trois tailles par écran (34 · 17 · 15), un seul bouton plein (bleu Apple, rare), ambre seulement pour un geste à faire, zéro phrase d’explication (le « ? ») ; chiffres de synthèse sur Argent seulement."]
casse="Ce que ça casse : toute la coque actuelle (fond bleu, verre, disque +, styles-vitrine) est remplacée par le système iOS ; Ma journée perd sa carte héros et ses chiffres (passés sur Argent) ; Messages, Stock, Leboncoin/eBay/Vestiaire et Paramètres ne sont pas maquettés (onglet « Plus » ou barre latérale à prévoir) ; les vraies photos Vinted ne sont pas détourées (fond de studio à obtenir ou à recadrer) ; appui long (menu contextuel) pas encore dessiné ; textes à passer par tr() si retenue."
H=150+len(lignes)*38+90+ (60+th+40)*2 + 60+ (950*((W-80-24)//2)//1512)*2+24+120
img=Image.new("RGB",(W,7000),'#FFFFFF'); d=ImageDraw.Draw(img)
y=40
d.text((40,y),'Proposition O « Galerie » — la photo de la paire fait l’app, l’étiquette du N° la signe',font=f('Bold',48),fill='#000'); y+=70
d.text((40,y),'Page blanche autonome (docs/maquettes/o, rien de src/), données inventées, sneakers dessinées (pas de photos réelles). iPhone 390 clair et sombre, ordinateur 1512.',font=f('Regular',26),fill='#6C6C70'); y+=56
for l in lignes: d.text((40,y),l,font=f('Regular',26),fill='#111'); y+=38
y+=8
import textwrap
for l in textwrap.wrap(casse,175): d.text((40,y),l,font=f('Medium',26),fill='#B35C00'); y+=36
y+=20
for th_ in ['clair','sombre']:
    d.text((40,y),'iPhone 390 · '+th_,font=f('Bold',34),fill='#0071E3'); y+=52
    x=40
    for n in TEL:
        p=D+n+'-390-'+th_+'.png'
        im=Image.open(p).convert('RGB').resize((tw,th),Image.LANCZOS)
        d.text((x,y),NOMS[n],font=f('Medium',22),fill='#333')
        img.paste(im,(x,y+34)); d.rectangle([x,y+34,x+tw-1,y+34+th-1],outline='#D1D1D6')
        x+=tw+24
    y+=34+th+40
d.text((40,y),'Ordinateur 1512 · clair',font=f('Bold',34),fill='#0071E3'); y+=52
dw=(W-80-24)//2; dh=950*dw//1512
DESK=[('o-journee','Ma journée'),('o-annonces-fiche','Annonces + fiche en inspecteur (N° 87 en double : le seul rouge)'),('o-achats','Achats — cartes de retrait'),('o-argent','Argent')]
for k,(n,t) in enumerate(DESK):
    x=40+(k%2)*(dw+24); yy=y+(k//2)*(dh+60)
    d.text((x,yy),t,font=f('Medium',22),fill='#333')
    im=Image.open(D+n+'-1512-clair.png').convert('RGB').resize((dw,dh),Image.LANCZOS)
    img.paste(im,(x,yy+34)); d.rectangle([x,yy+34,x+dw-1,yy+34+dh-1],outline='#D1D1D6')
y+=2*(dh+60)
img=img.crop((0,0,W,y+20))
img.save('onglets/O-planche.png',optimize=True)
print(img.size, os.path.getsize('onglets/O-planche.png'))
