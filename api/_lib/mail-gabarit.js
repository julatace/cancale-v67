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
// ⚠️ Français seulement : VRM reste sur la France (§3, 28 oct.).

export const SITE = 'https://vrm.center';
export const LOGO = `${SITE}/vrm-logo-v5-192.png`;
// Réglages → Notifications (là où vivent le bilan du mois et les e-mails de l'essai).
export const LIEN_GERER = `${SITE}/?tab=settings&section=notifications`;

export const echapperHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Une URL ne se pose dans un lien que si elle est http(s) (jamais `javascript:`).
export const urlSure = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
// Un paragraphe : échappé, ses retours à la ligne gardés.
const majuscule = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const para = (t) => echapperHtml(t).replace(/\r?\n/g, '<br>');

const POLICE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ENCRE = '#1d1d1f', DOUX = '#6e6e73', FILET = '#e5e5ea', FOND = '#f5f5f7', CARTE = '#ffffff', BLEU = '#0071e3';

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
//             son nom en tête au lieu du logo VRM, et pas de mentions de VRM
// editeur   : (facultatif) l'objet VRM_EDITEUR (défaut : globalThis)
export function gabaritMail({ titre, preentete = '', paras = [], liste = [], chiffres = [], suite = [], bouton = null, apres = '', pied = null, facultatif = false, marque = null, editeur } = {}) {
  const urlBouton = bouton ? urlSure(bouton.url) : '';
  const lienPied = pied ? urlSure(pied.lien) : '';
  const mentions = marque ? [] : lignesEditeur(editeur === undefined ? globalThis.VRM_EDITEUR : editeur);
  const apercu = String(preentete || paras[0] || titre || '').replace(/\s+/g, ' ').trim().slice(0, 140);

  // ── Le texte brut : le même contenu, dans le même ordre ───────────────────
  const lignes = [titre, '', ...paras.flatMap((p) => [p, ''])];
  if (liste.length) lignes.push(...liste.map((x) => `· ${x}`), '');
  if (chiffres.length) lignes.push(...chiffres.map(([l, v, n]) => `${l} : ${v}${n ? ` (${n})` : ''}`), '');
  lignes.push(...suite.flatMap((x) => [x, '']));
  if (bouton && urlBouton) lignes.push(`${bouton.mot} : ${urlBouton}`, '');
  if (apres) lignes.push(apres, '');
  const piedTxt = [];
  if (pied) piedTxt.push(lienPied ? `${pied.texte} ${pied.motLien ? pied.motLien[0].toUpperCase() + pied.motLien.slice(1) : 'Lien'} : ${lienPied}` : pied.texte);
  if (facultatif) piedTxt.push(`Gérer mes e-mails : ${LIEN_GERER}`);
  if (mentions.length) piedTxt.push(mentions.join(' · '));
  if (piedTxt.length) lignes.push('—', ...piedTxt);
  const texte = lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // ── Le HTML ───────────────────────────────────────────────────────────────
  const p = (t, style = '') => `<p class="vrm-t" style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ENCRE};${style}">${para(t)}</p>`;
  const tete = marque
    ? `<div class="vrm-t" style="font-size:15px;font-weight:600;color:${ENCRE};letter-spacing:-0.01em">${echapperHtml(marque.nom || '')}</div>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
      + `<td style="vertical-align:middle"><img src="${LOGO}" width="32" height="32" alt="VRM" style="display:block;width:32px;height:32px;border:0;border-radius:8px;font:600 13px ${POLICE};color:${ENCRE}"></td>`
      + `<td class="vrm-t" style="vertical-align:middle;padding-left:10px;font-size:15px;font-weight:600;color:${ENCRE};letter-spacing:-0.01em">VRM</td>`
      + `</tr></table>`;
  const tableChiffres = chiffres.length
    ? `<table role="presentation" class="vrm-chiffres" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:4px 0 20px;border-collapse:separate;background:${FOND};border-radius:14px">`
      + chiffres.map(([l, v, n], i) => {
        const filet = i ? `border-top:1px solid ${FILET};` : '';
        // (8 nov., capture 390 px) La note passe SOUS le libellé et le chiffre, sur toute la
        // largeur : au téléphone, la colonne du montant ne l'écrase plus en trois lignes.
        const haut = n ? '13px 16px 2px' : '13px 16px';
        return `<tr><td class="vrm-filet" style="padding:${haut};${filet}vertical-align:top">`
          + `<div class="vrm-t" style="font-size:15px;line-height:1.35;color:${ENCRE}">${echapperHtml(l)}</div>`
          + `</td><td class="vrm-filet vrm-t" align="right" style="padding:${haut};${filet}text-align:right;vertical-align:top;white-space:nowrap;font-size:17px;line-height:1.35;font-weight:600;color:${ENCRE};font-variant-numeric:tabular-nums;font-feature-settings:'tnum'">${echapperHtml(v)}</td></tr>`
          + (n ? `<tr><td colspan="2" class="vrm-doux" style="padding:0 16px 13px;font-size:13px;line-height:1.4;color:${DOUX}">${echapperHtml(n)}</td></tr>` : '');
      }).join('')
      + `</table>`
    : '';
  // Le bouton « à toute épreuve » : une cellule colorée (Outlook) + le lien en bloc.
  const btn = bouton && urlBouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td class="vrm-bouton" align="center" bgcolor="${BLEU}" style="border-radius:12px;background:${BLEU}">`
      + `<a class="vrm-bouton" href="${echapperHtml(urlBouton)}" style="display:block;padding:0 24px;line-height:44px;min-height:44px;border-radius:12px;background:${BLEU};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;white-space:nowrap">${echapperHtml(bouton.mot)}</a>`
      + `</td></tr></table>`
    : '';
  const petit = (t) => `<p class="vrm-doux" style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${DOUX}">${t}</p>`;
  const lienDoux = (url, mot) => `<a href="${echapperHtml(url)}" class="vrm-doux" style="color:${DOUX};text-decoration:underline">${echapperHtml(mot)}</a>`;
  const blocsPied = [];
  if (bouton && urlBouton) blocsPied.push(petit(`Le bouton ne marche pas ? Copie cette adresse dans ton navigateur :<br><span style="word-break:break-all">${echapperHtml(urlBouton)}</span>`));
  if (pied) blocsPied.push(petit(`${echapperHtml(pied.texte)}${lienPied ? ` ${lienDoux(lienPied, majuscule(pied.motLien || 'lien'))}.` : ''}`));
  if (facultatif) blocsPied.push(petit(lienDoux(LIEN_GERER, 'Gérer mes e-mails')));
  if (mentions.length) blocsPied.push(petit(mentions.map(echapperHtml).join('<br>')));

  const style = `<style>`
    + `:root{color-scheme:light dark;supported-color-schemes:light dark}`
    + `@media (prefers-color-scheme:dark){`
    + `.vrm-fond{background:#000000!important}.vrm-carte{background:#1c1c1e!important}`
    + `.vrm-t{color:#f5f5f7!important}.vrm-doux{color:#98989d!important}`
    + `.vrm-filet{border-color:#38383a!important}.vrm-chiffres{background:#2c2c2e!important}`
    + `.vrm-bouton{background:#0a84ff!important}hr.vrm-filet{border-top-color:#38383a!important}}`
    + `@media (max-width:480px){.vrm-carte-td{padding:24px 20px!important}.vrm-h1{font-size:22px!important}}`
    + `</style>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">`
    + `<title>${echapperHtml(titre)}</title>${style}</head>`
    + `<body class="vrm-fond" style="margin:0;padding:0;background:${FOND};-webkit-text-size-adjust:100%;font-family:${POLICE}">`
    // Le préentête : caché, suivi de blancs pour que la boîte n'y colle pas le corps.
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${FOND}">${echapperHtml(apercu)}${'&#8199;&#65279;&#847; '.repeat(20)}</div>`
    + `<table role="presentation" class="vrm-fond" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FOND}" style="width:100%;background:${FOND}"><tr><td align="center" style="padding:28px 12px 36px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px">`
    + `<tr><td style="padding:0 8px 16px">${tete}</td></tr>`
    + `<tr><td class="vrm-carte vrm-carte-td" bgcolor="${CARTE}" style="background:${CARTE};border-radius:18px;padding:32px 28px;font-family:${POLICE}">`
    + `<h1 class="vrm-t vrm-h1" style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${ENCRE}">${echapperHtml(titre)}</h1>`
    + paras.map((t) => p(t)).join('')
    + (liste.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px">${liste.map((x) => `<tr><td class="vrm-t" valign="top" style="width:18px;padding:0 0 10px;font-size:16px;line-height:1.55;color:${BLEU}">•</td><td class="vrm-t" style="padding:0 0 10px;font-size:16px;line-height:1.55;color:${ENCRE}">${para(x)}</td></tr>`).join('')}</table>` : '')
    + tableChiffres
    + suite.map((t) => p(t)).join('')
    + btn
    + (apres ? p(apres, `font-size:14px;color:${DOUX}`).replace('class="vrm-t"', 'class="vrm-doux"') : '')
    + `</td></tr>`
    + (blocsPied.length
      ? `<tr><td style="padding:20px 8px 0;font-family:${POLICE}"><hr class="vrm-filet" style="border:0;border-top:1px solid ${FILET};margin:0 0 16px">${blocsPied.join('')}</td></tr>`
      : '')
    + `</table></td></tr></table></body></html>`;
  return { texte, html };
}

// L'ancien nom (api/_lib/gabarit-email.js, 5 nov.) : le même gabarit.
export const gabaritEmail = gabaritMail;
