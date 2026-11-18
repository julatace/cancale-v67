// api/_lib/mail-gabarit.js
// ════════════════════════════════════════════════════════════════════════════
// LE GABARIT DE TOUS LES E-MAILS QUE VRM ENVOIE LUI-MÊME (8 nov., Julien :
// « fais des beaux mails à envoyer »). Il remplace api/_lib/gabarit-email.js
// (5 nov.) : même contrat d'appel, une forme plus soignée.
// ════════════════════════════════════════════════════════════════════════════
// UNE forme, la même pour chaque e-mail (essai j1/j3/j6, bilan du mois, lien de
// preuve d'adresse, e-mail d'essai de Réglages, facture Pro) :
//   0. un préentête caché (la ligne grise sous le sujet dans la boîte) ;
//   1. le logo VRM (ou le NOM du vendeur pour sa facture), jamais un lien ;
//   2. un TITRE qui dit ce que c'est ;
//   3. une ou deux phrases ; une liste ; un tableau de chiffres alignés ;
//   4. UN bouton bleu (44 px de haut) — un seul lien d'action dans le corps ;
//   5. sous un filet (`<hr`), en petit : le lien en clair si le bouton ne
//      marche pas, pourquoi on reçoit ce message, « ne plus recevoir », et
//      « Gérer mes e-mails » (Réglages → Notifications) pour un e-mail
//      FACULTATIF ; puis l'identité de l'éditeur SI elle est remplie dans
//      public/legal/editeur.js (sinon rien : jamais une mention inventée).
// Le texte brut est fabriqué du MÊME contenu, dans le même ordre (multipart).
//
// ⚠️ Compatible clients mail : tableaux, styles EN LIGNE, largeur 520, aucune
//    image obligatoire (le logo a un texte de remplacement « VRM »). Le mode
//    sombre est toléré : `color-scheme` + une feuille `prefers-color-scheme`
//    (Apple Mail, iOS, Outlook macOS) ; ailleurs, le clair en ligne s'applique.
// ⚠️ TOUT est échappé (titre, paragraphes, chiffres, liens) : un pseudo ou un
//    titre d'article ne peut jamais écrire du HTML. Une URL qui n'est pas
//    http(s) n'est jamais posée dans un lien (rendu : rien).
// ⚠️ Aucune donnée inventée : le gabarit ne porte que ce qu'on lui donne.
// ⚠️ (17 nov.) Cinq langues : celle du compte qui reçoit (api/_lib/mail-textes.js) ;
//    le français reste la référence (§3 « International », 11 nov.).
// (11 nov., lot emails-envoyes — « les e-mails que VRM envoie au nom du vendeur
// sont beaux et lisibles sur téléphone ») La forme est reprise ainsi :
//   · largeur 600 au plus (une table « fantôme » fixe la largeur sous Outlook,
//     qui ignore `max-width`) ; à 390 px la carte occupe tout l'écran ;
//   · AUCUNE image distante : l'en-tête est un MOT (« VRM » en petit pour ses
//     propres e-mails, le NOM DE LA BOUTIQUE pour une facture / un avoir) —
//     plus de logo chargé depuis vrm.center (bloqué par défaut chez la plupart
//     des boîtes, il laissait un carré vide) ; Julien (11 nov.) ne veut pas de
//     « envoyée par VRM » dans la facture : `marque` n'écrit RIEN de VRM ;
//   · texte ≥ 14 px partout (16 px le corps, 14 px les notes et le pied) ;
//   · contrastes AA en clair ET en sombre : le bouton reste #0071e3 sous un mot
//     blanc (4,7:1 — le #0a84ff du sombre ne donnait que 3,6:1) ; le gris doux
//     est #636366 en clair (5,6:1 sur blanc), #aeaeb2 en sombre ;
//   · sombre : `prefers-color-scheme` (Apple Mail, iOS, Outlook macOS) ET les
//     attributs que pose Outlook.com (`[data-ogsc]`/`[data-ogsb]`) ; Gmail
//     inverse lui-même — les couleurs choisies restent lisibles inversées ;
//   · `lang` du document (fr ; « fr » aussi pour une facture bilingue, dont le
//     français reste le texte de référence), `role="presentation"` sur chaque
//     table de mise en page, un `<h1>` unique ;
//   · seulement des liens https (une adresse http n'est jamais posée).
// (15 nov., « Verre dépoli », Julien : « J'aime la 9 ») LA FORME vient d'api/_lib/mail-verre.js,
// la même que les modèles de compte Supabase (scripts/modeles-email.cjs) : fond bleu profond
// (couleur unie + dégradé en image de fond), logo HÉBERGÉ sur vrm.center + le mot « VRM »
// (une image bloquée ne laisse que le mot), TITRE en blanc sur le bleu, carte blanche
// arrondie (le texte à l'encre), UN plein d'encre de 48 px, le pied en clair sur le bleu.
// Ce qui précède sur la largeur, l'échappement, le sombre et les liens reste vrai ; le
// bouton n'est plus bleu (#0071e3) mais d'encre (mot blanc 16,9:1), le gris est #3F5468.
// 

import { VERRE, teteVerre, boutonVerre, enveloppeVerre } from './mail-verre.js';
import { tm, langueMail } from './mail-textes.js';

export const SITE = 'https://vrm.center';
// Réglages → Notifications (là où vivent le bilan du mois et les e-mails de l'essai).
export const LIEN_GERER = `${SITE}/?tab=settings&section=notifications`;

export const echapperHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Une URL ne se pose dans un lien que si elle est http(s) (jamais `javascript:`).
// (11 nov.) https SEULEMENT : un lien http part en clair et se fait réécrire en route.
export const urlSure = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
// Un paragraphe : échappé, ses retours à la ligne gardés.
const majuscule = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const para = (t) => echapperHtml(t).replace(/\r?\n/g, '<br>');

// La largeur de la carte (600 au plus) : la même pour la table fantôme d'Outlook.
export const LARGEUR = 600;

// L'identité de l'éditeur pour le pied : lue dans `globalThis.VRM_EDITEUR`
// (posé par public/legal/editeur.js, que `lireMentions()` charge côté serveur).
// Seulement des champs REMPLIS ; rien de rempli ⇒ aucune ligne.
export function lignesEditeur(E = globalThis.VRM_EDITEUR) {
  if (!E || typeof E !== 'object') return [];
  const v = (k) => (typeof E[k] === 'string' && E[k].trim() ? E[k].trim() : '');
  const nom = v('nom');
  if (!nom) return [];                                    // sans nom, une adresse seule ne dit rien
  return [[nom, v('forme')].filter(Boolean).join(' · '), v('adresse'), v('siret') ? `SIRET ${v('siret')}` : ''].filter(Boolean);
}

// titre     : la ligne qui dit ce que c'est
// preentete : (facultatif) la ligne d'aperçu de la boîte ; défaut = 1re phrase
// paras     : phrases courtes, dans l'ordre (un « \n » devient un retour à la ligne)
// liste     : (facultatif) une ligne par chose
// chiffres  : (facultatif) [[libellé, valeur, note?]] — valeurs alignées
//             (tabular-nums) ; « — » pour un chiffre pas su
// suite     : (facultatif) phrases après la liste et les chiffres
// bouton    : { mot, url } — LE lien d'action (un seul)
// apres     : (facultatif) une phrase en petit sous le bouton
// pied      : { texte, lien?, motLien? } — pourquoi ce message, « ne plus recevoir »
// facultatif: true ⇒ « Gérer mes e-mails » (Réglages → Notifications) au pied
// marque    : (facultatif) { nom } — l'e-mail est celui d'un VENDEUR (sa facture) :
//             le NOM DE SA BOUTIQUE en tête au lieu du mot « VRM », et rien de VRM
//             (ni mot, ni mentions de l'éditeur, ni « via VRM » : Julien, 11 nov.)
// langue    : (facultatif) la langue du destinataire (fr, en, es, it, de — défaut « fr ») :
//             l'attribut `lang` ET les mots du gabarit lui-même (secours du bouton,
//             « Gérer mes e-mails », signature) — api/_lib/mail-textes.js
// (17 nov., « Améliore les emails aussi ») Le pied dit QUI envoie : « Envoyé par VRM, ton
// outil de revente · vrm.center » (jamais sur la facture d'un vendeur : `marque`), puis
// pourquoi on le reçoit. Le bouton est « à toute épreuve » sous Outlook (VML, mail-verre.js).
// editeur   : (facultatif) l'objet VRM_EDITEUR (défaut : globalThis)
export function gabaritMail({ titre, preentete = '', paras = [], liste = [], chiffres = [], suite = [], bouton = null, apres = '', pied = null, facultatif = false, marque = null, editeur, langue = 'fr' } = {}) {
  const urlBouton = bouton ? urlSure(bouton.url) : '';
  const lienPied = pied ? urlSure(pied.lien) : '';
  const mentions = marque ? [] : lignesEditeur(editeur === undefined ? globalThis.VRM_EDITEUR : editeur);
  const apercu = String(preentete || paras[0] || titre || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const lang = langueMail(langue);
  const signature = marque ? '' : tm(lang, 'g.signature');

  // ── Le texte brut : le même contenu, dans le même ordre ───────────────────
  const lignes = [titre, '', ...paras.flatMap((p) => [p, ''])];
  if (liste.length) lignes.push(...liste.map((x) => `· ${x}`), '');
  if (chiffres.length) lignes.push(...chiffres.map(([l, v, n]) => `${l}${lang === 'fr' ? ' :' : ':'} ${v}${n ? ` (${n})` : ''}`), '');
  lignes.push(...suite.flatMap((x) => [x, '']));
  if (bouton && urlBouton) lignes.push(`${bouton.mot}${lang === 'fr' ? ' :' : ':'} ${urlBouton}`, '');
  if (apres) lignes.push(apres, '');
  const piedTxt = [];
  const deuxPoints = lang === 'fr' ? ' :' : ':';
  if (pied) piedTxt.push(lienPied ? `${pied.texte} ${pied.motLien ? pied.motLien[0].toUpperCase() + pied.motLien.slice(1) : tm(lang, 'g.lien')}${deuxPoints} ${lienPied}` : pied.texte);
  if (facultatif) piedTxt.push(`${tm(lang, 'g.gerer')}${deuxPoints} ${LIEN_GERER}`);
  if (signature) piedTxt.push(signature);
  if (mentions.length) piedTxt.push(mentions.join(' · '));
  if (piedTxt.length) lignes.push('—', ...piedTxt);
  const texte = lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // ── Le HTML : la forme « Verre dépoli » commune (api/_lib/mail-verre.js) ───────
  // (15 nov., Julien : « J'aime la 9 ») Le fond bleu profond, le logo et le TITRE en blanc
  // sur le bleu, la carte blanche (texte à l'encre), UN plein d'encre, le pied en clair.
  const V = VERRE, P = V.police;
  const p = (t, style = '') => `<p class="vv-encre" style="margin:0 0 16px;font-family:${P};font-size:16px;line-height:1.55;color:${V.encre};${style}">${para(t)}</p>`;
  // En tête : le logo et « VRM » ; pour la facture d'un vendeur, le NOM de sa boutique
  // (rien de VRM : Julien, 11 nov.). Un nom long se coupe.
  const tete = teteVerre({ titreHtml: echapperHtml(titre), marqueHtml: marque ? echapperHtml(marque.nom || '') : '' });
  const tableChiffres = chiffres.length
    ? `<table role="presentation" class="vv-puits" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:4px 0 20px;border-collapse:separate;background-color:${V.puits};border-radius:16px">`
      + chiffres.map(([l, v, n], i) => {
        const filet = i ? `border-top:1px solid ${V.filet};` : '';
        // (8 nov., capture 390 px) La note passe SOUS le libellé et le chiffre, sur toute la
        // largeur : au téléphone, la colonne du montant ne l'écrase plus en trois lignes.
        const haut = n ? '13px 16px 2px' : '13px 16px';
        return `<tr><td class="vv-filet" style="padding:${haut};${filet}vertical-align:top">`
          + `<div class="vv-encre" style="font-family:${P};font-size:15px;line-height:1.35;color:${V.encre}">${echapperHtml(l)}</div>`
          + `</td><td class="vv-filet vv-encre" align="right" style="padding:${haut};${filet}text-align:right;vertical-align:top;white-space:nowrap;font-family:${P};font-size:17px;line-height:1.35;font-weight:600;color:${V.encre};font-variant-numeric:tabular-nums;font-feature-settings:'tnum'">${echapperHtml(v)}</td></tr>`
          + (n ? `<tr><td colspan="2" class="vv-gris" style="padding:0 16px 13px;font-family:${P};font-size:14px;line-height:1.4;color:${V.gris}">${echapperHtml(n)}</td></tr>` : '');
      }).join('')
      + `</table>`
    : '';
  const btn = bouton && urlBouton ? boutonVerre({ urlHtml: echapperHtml(urlBouton), motHtml: echapperHtml(bouton.mot) }) : '';
  // Le pied, en clair sur le bleu (hors de la carte) ; ses liens en blanc souligné.
  const petit = (t) => `<p class="vv-pied" style="margin:0 0 10px;font-family:${P};font-size:13px;line-height:1.55;color:${V.surBleu2}">${t}</p>`;
  const lienDoux = (url, mot) => `<a href="${echapperHtml(url)}" style="color:${V.surBleu};text-decoration:underline">${echapperHtml(mot)}</a>`;
  const blocsPied = [];
  if (bouton && urlBouton) blocsPied.push(petit(`${echapperHtml(tm(lang, 'g.secours'))}<br><span style="word-break:break-all;color:${V.surBleu}">${echapperHtml(urlBouton)}</span>`));
  if (pied) blocsPied.push(petit(`${echapperHtml(pied.texte)}${lienPied ? ` ${lienDoux(lienPied, majuscule(pied.motLien || 'lien'))}.` : ''}`));
  if (facultatif) blocsPied.push(petit(lienDoux(LIEN_GERER, tm(lang, 'g.gerer'))));
  if (signature) blocsPied.push(petit(`${echapperHtml(signature.replace(/ · vrm\.center$/, ''))} · ${lienDoux(SITE, 'vrm.center')}`));
  if (mentions.length) blocsPied.push(petit(mentions.map(echapperHtml).join('<br>')));

  const corps = paras.map((t) => p(t)).join('')
    + (liste.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px">${liste.map((x) => `<tr><td class="vv-gris" valign="top" style="width:18px;padding:0 0 10px;font-family:${P};font-size:16px;line-height:1.55;color:${V.gris}">•</td><td class="vv-encre" style="padding:0 0 10px;font-family:${P};font-size:16px;line-height:1.55;color:${V.encre}">${para(x)}</td></tr>`).join('')}</table>` : '')
    + tableChiffres
    + suite.map((t) => p(t)).join('')
    + btn
    + (apres ? p(apres, `font-size:14px;color:${V.gris}`).replace('class="vv-encre"', 'class="vv-gris"') : '');
  // (Un e-mail sans rien dans la carte garde sa carte : le titre seul dit ce que c'est.)
  const html = enveloppeVerre({ lang, titreDoc: echapperHtml(titre), apercuHtml: echapperHtml(apercu), teteHtml: tete, corpsHtml: corps, piedHtml: blocsPied.join('') });
  return { texte, html };
}

// L'ancien nom (api/_lib/gabarit-email.js, 5 nov.) : le même gabarit.
export const gabaritEmail = gabaritMail;
