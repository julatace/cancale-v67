// scripts/audit-emails-verre.cjs
// ════════════════════════════════════════════════════════════════════════════
// AUDIT « TOUS LES E-MAILS EN VERRE DÉPOLI » (15 nov., Julien : « intègre les e-mails
// à l'agent design »). Il EXÉCUTE chaque gabarit — les e-mails que VRM envoie (essai
// j1/j3/j6, bilan du mois, preuve d'adresse, facture Pro, essai de la boîte des
// factures, e-mail d'essai, suppression prévue / faite, fin d'abonnement) et les six
// modèles de compte Supabase (supabase/templates/*.html, français ET anglais) — sur des
// données INVENTÉES, et juge sur le HTML produit :
//   F1 la forme commune d'api/_lib/mail-verre.js, TELLE QUELLE : la même feuille
//      (`styleVerre()`), le fond bleu uni + dégradé, la tête, le titre sur le bleu, la
//      carte, le pied — dans CHAQUE e-mail ;
//   F2 au plus UN plein d'encre de 48 px ;
//   F3 tableaux et styles EN LIGNE : aucune feuille ni police externe (`<link`,
//      `@import`, `url(` dans une feuille), aucun script, chaque `<td>`, `<p>`, `<a>`,
//      `<h1>` porte son `style=` ; largeur 600 (table fantôme d'Outlook comprise) ;
//   F4 images : seulement le logo HÉBERGÉ sur vrm.center (jamais en base64), et pas
//      sur la facture d'un vendeur (rien de VRM) ;
//   F5 poids < 100 Ko ;
//   F6 sombre : `prefers-color-scheme` ET `[data-ogsc]` ;
//   F7 Supabase : chaque variable attendue est là (`{{ .ConfirmationURL }}`,
//      `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .Email }}`, `{{ .NewEmail }}` au
//      changement d'adresse seulement), le code en GRAND et sélectionnable ;
//   F8 contrastes AA des couleurs de la forme (calculés sur les jetons) ;
//   F9 aucun violet, aucun montant écrit par la forme elle-même.
// `--prouve` : chaque règle doit rougir sur un e-mail abîmé exprès.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (h) => { const n = h.replace('#', ''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const C = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  const imp = (p) => import(pathToFileURL(path.join(RACINE, p)).href);
  const MV = await imp('api/_lib/mail-verre.js');
  const RE = await imp('api/_lib/relances-essai.js');
  const BM = await imp('api/_lib/bilan-mois.js');
  const PA = await imp('api/_lib/preuve-adresse.js');
  const FR = await imp('src/facturePro/regle.js');
  const FP = await imp('api/_lib/facture-pro.js');
  const ME = await imp('api/_lib/mail-essai.js');
  const SD = await imp('api/_lib/suppression-differee.js');
  const SC = await imp('api/_lib/suppression-compte.js');
  const CP = await imp('api/_lib/clients-partis.js');
  const { MODELES, LANGUES: LANGUES_MODELES, blocsLangues } = require('./modeles-email.cjs');
  globalThis.VRM_EDITEUR = undefined;
  const V = MV.VERRE, FEUILLE = MV.styleVerre();
  const fin = new Date(Date.now() + 3 * 86400e3).toISOString(), lien = 'https://vrm.center/api/compte?mode=relances&d=demonstration';
  const mails = {
    'essai j1': RE.texteRelance('j1', { fin, lien }).html,
    'essai j3': RE.texteRelance('j3', { fin, lien, relie: { vinted: false, emails: true, notifications: false } }).html,
    'essai j6': RE.texteRelance('j6', { fin, lien }).html,
    'bilan du mois': BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 3, eur: 120 }, recu: { etat: 'su', eur: 100 }, benefice: { etat: 'su', brut: 40, n: 3, nCout: 3, manque: [] }, meilleure: null }, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration' }).html,
    'preuve d’adresse': PA.emailConfirmation('demo@exemple.test', 'https://vrm.center/?confirmer-adresse=demonstration').html,
    'facture Pro': FR.emailFacture({}, { type: 'facture', numero: 'FA-2026-0001', vendeur: { nom: 'Boutique Démo' }, acheteur: { nom: 'Client Démo' }, lignes: [{ designation: 'Article de démonstration' }] }, { via: 'vrm' }).html,
    'essai de la boîte des factures': FP.mailBoiteEssai().html,
    'e-mail d’essai': ME.mailEssai().html,
    'suppression prévue': SD.mailDemande({ effaceLe: new Date(Date.now() + 30 * 86400e3).toISOString(), contact: 'contact@exemple.test' }).html,
    'suppression faite': SC.mailSuppression({ fait: ['tes ventes'], contact: 'contact@exemple.test' }).html,
    'fin d’abonnement': CP.mailAvis({ quand: '15 décembre 2026' }).html,
  };
  const supa = {};
  for (const m of MODELES) supa[m.id] = fs.readFileSync(path.join(RACINE, 'supabase', 'templates', `${m.id}.html`), 'utf8');
  // (17 nov.) Les cinq langues des modèles (scripts/modeles-email.cjs, `blocsLangues`).
  const blocs = (src) => blocsLangues(src);

  function regles(nom, html, { marque = false, modele = null, langue = 'fr' } = {}) {
    const f = [];
    const exige = (ok, quoi) => { if (!ok) f.push(`${nom} : ${quoi}`); };
    exige(html.includes(FEUILLE), 'F1 la feuille commune (styleVerre) n’y est pas telle quelle');
    exige(new RegExp(`data-vv="fond"[^>]*bgcolor="${V.bleu}"[^>]*background-color:${V.bleu};background-image:linear-gradient`).test(html), 'F1 fond bleu uni + dégradé absent');
    exige(['tete', 'titre', 'carte'].concat(marque ? [] : ['pied']).every((x) => html.includes(`data-vv="${x}"`)), 'F1 tête, titre, carte ou pied absent');
    exige(new RegExp(`data-vv="titre"[\\s\\S]{0,200}<h1[^>]*color:${V.surBleu}`).test(html), 'F1 le titre n’est pas en blanc sur le bleu');
    exige(new RegExp(`data-vv="carte"[^>]*bgcolor="${V.carte}"[^>]*border-radius:22px[^>]*box-shadow`).test(html), 'F1 la carte blanche arrondie à l’ombre douce manque');
    const pleins = (html.match(/<td[^>]*data-vv="plein"/g) || []).length;
    exige(pleins <= 1 && (!pleins || new RegExp(`data-vv="plein"[^>]*bgcolor="${V.plein}"`).test(html) && /line-height:48px/.test(html)), `F2 ${pleins} plein(s) — au plus un, d’encre, 48 px`);
    exige(!/<link\b|@import|<script\b/i.test(html) && !/<style>[^<]*url\(/i.test(html), 'F3 feuille, police ou script externe');
    const sansStyle = [...html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, "").matchAll(/<(td|p|a|h1)\b(?![^>]*\bstyle=)[^>]*>/g)].map((x) => x[0].slice(0, 60));
    exige(!sansStyle.length, `F3 sans style en ligne : ${sansStyle.slice(0, 3).join(' | ')}`);
    exige(/max-width:600px/.test(html) && /<!--\[if mso\]><table role="presentation" width="600"/.test(html), 'F3 largeur 600 (et table fantôme d’Outlook) absente');
    const imgs = [...html.matchAll(/<img\b[^>]*src="([^"]*)"/g)].map((x) => x[1]);
    exige(marque ? imgs.length === 0 : (imgs.length === 1 && imgs[0] === V.logo), `F4 images : ${JSON.stringify(imgs)}`);
    exige(!/src="data:|url\(data:/i.test(html), 'F4 image en base64');
    exige(Buffer.byteLength(html) < 100 * 1024, `F5 poids ${Math.round(Buffer.byteLength(html) / 1024)} Ko`);
    exige(/@media \(prefers-color-scheme:dark\)/.test(html) && /\[data-ogsc\] \.vv-encre/.test(html), 'F6 sombre (prefers-color-scheme + data-ogsc) absent');
    exige(!/#(?:7c3aed|8b5cf6|6d28d9|a855f7|9333ea|5b21b6)/i.test(html) && !/violet|purple/i.test(html), 'F9 violet');
    exige(new RegExp(`<html lang="${langue}"`).test(html), `lang « ${langue} »`);
    if (modele) {
      const att = ['{{ .Email }}'];
      if (modele.lien) att.push(modele.lien);
      if (modele.code) att.push('{{ .Token }}');
      if (modele.id === 'email_change') att.push('{{ .NewEmail }}');
      for (const a of att) exige(html.includes(a), `F7 variable ${a} absente`);
      exige(modele.id === 'email_change' || !html.includes('{{ .NewEmail }}'), 'F7 {{ .NewEmail }} hors du changement d’adresse');
      const vars = [...html.matchAll(/\{\{\s*\.([A-Za-z]+)/g)].map((x) => x[1]);
      exige(vars.every((x) => ['ConfirmationURL', 'Token', 'TokenHash', 'Email', 'NewEmail', 'Data', 'SiteURL', 'RedirectTo'].includes(x)), `F7 variable inconnue de Supabase : ${vars.join(',')}`);
      if (modele.code) exige(/data-vv="code"[^>]*font-size:3[0-9]px[^>]*user-select:all/.test(html), 'F7 le code n’est pas EN GRAND et sélectionnable');
    }
    return f;
  }
  const marques = new Set(['facture Pro']);
  const tout = (M, S) => {
    const f = [];
    for (const [nom, html] of Object.entries(M)) f.push(...regles(nom, html, { marque: marques.has(nom) }));
    for (const m of MODELES) {
      const b = blocs(S[m.id]);
      if (!b) { f.push(`supabase ${m.id} : blocs par langue introuvables`); continue; }
      for (const l of LANGUES_MODELES) f.push(...regles(`supabase ${m.id} ${l}`, b[l], { modele: m, langue: l }));
    }
    return f;
  };
  // F8 : les contrastes de la forme (jetons), jour et nuit.
  const N = V.nuit;
  const paires = [
    ['encre/carte', V.encre, V.carte, 4.5], ['gris/carte', V.gris, V.carte, 4.5], ['lien/carte', V.lien, V.carte, 4.5], ['encre/puits', V.encre, V.puits, 4.5], ['gris/puits', V.gris, V.puits, 4.5],
    ['mot/plein', V.pleinMot, V.plein, 4.5], ['titre/bleu uni', V.surBleu, V.bleu, 4.5], ['titre/haut du dégradé', V.surBleu, '#27272B', 4.5], ['pied/bleu uni', V.surBleu2, V.bleu, 4.5], ['pied/haut du dégradé', V.surBleu2, '#27272B', 4.5],
    ['nuit encre/carte', N.encre, N.carte, 4.5], ['nuit gris/carte', N.gris, N.carte, 4.5], ['nuit lien/carte', N.lien, N.carte, 4.5], ['nuit gris/puits', N.gris, N.puits, 4.5], ['nuit mot/plein', N.pleinMot, N.plein, 4.5], ['nuit pied/bleu', V.surBleu2, N.bleu, 4.5],
  ];
  const fautesC = paires.filter(([, a, b, s]) => C(a, b) < s).map(([n, a, b]) => `F8 ${n} ${C(a, b).toFixed(2)}:1 < 4,5`);

  let rouge = 0;
  const fautes = tout(mails, supa).concat(fautesC);
  for (const f of fautes) console.error('✗ ' + f);
  rouge += fautes.length;
  if (!fautes.length) console.log(`✓ ${Object.keys(mails).length} e-mails de VRM et ${MODELES.length} modèles Supabase (fr + en) : la forme commune « Verre dépoli », un plein d’encre, styles en ligne, 600 px, logo hébergé, < 100 Ko, sombre, variables Supabase, contrastes AA (${paires.map(([n, a, b]) => `${n} ${C(a, b).toFixed(1)}`).join(' · ')})`);

  if (process.argv.includes('--prouve')) {
    const muter = (fn) => { const M = Object.fromEntries(Object.entries(mails).map(([k, v]) => [k, fn(v, k)])); const S = Object.fromEntries(Object.entries(supa).map(([k, v]) => [k, fn(v, k)])); return tout(M, S).length; };
    const mutations = [
      ['F1 feuille commune changée', (h, k) => (k === 'bilan du mois' ? h.split('.vv-carte{').join('.vv-x{') : h)],
      ['F1 titre sur la carte (encre)', (h, k) => (k === 'magic_link' ? h.split(`color:${V.surBleu};word-break`).join(`color:${V.encre};word-break`) : h)],
      ['F2 deux pleins', (h, k) => (k === 'essai j1' ? h.replace(/(<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px">[\s\S]*?<\/table>)/, '$1$1') : h)],
      ['F3 feuille externe', (h, k) => (k === 'invite' ? h.replace('</head>', '<link rel="stylesheet" href="https://exemple.test/a.css"></head>') : h)],
      ['F3 style en ligne retiré', (h, k) => (k === 'e-mail d’essai' ? h.replace(/<p class="vv-encre" style="[^"]*"/, '<p class="vv-encre"') : h)],
      ['F4 logo en base64', (h, k) => (k === 'preuve d’adresse' ? h.split(`src="${V.logo}"`).join('src="data:image/png;base64,AAAA"') : h)],
      ['F4 logo VRM sur la facture d’un vendeur', (h, k) => (k === 'facture Pro' ? h.replace('<tr><td data-vv="tete"', `<tr><td><img src="${V.logo}" width="32" height="32" alt="" style="display:block"></td></tr><tr><td data-vv="tete"`) : h)],
      ['F5 trop lourd', (h, k) => (k === 'recovery' ? h.replace('</body>', `<p style="margin:0">${'x'.repeat(110 * 1024)}</p></body>`) : h)],
      ['F6 sombre retiré', (h, k) => (k === 'suppression faite' ? h.split('[data-ogsc] ').join('[data-x] ') : h)],
      ['F7 code retiré', (h, k) => (k === 'reauthentication' ? h.split('{{ .Token }}').join('') : h)],
      ['F7 variable inventée', (h, k) => (k === 'confirmation' ? h.split('{{ .Email }}').join('{{ .Courriel }}') : h)],
      ['F9 plein violet', (h, k) => (k === 'essai j3' ? h.split(`bgcolor="${V.plein}"`).join('bgcolor="#7C3AED"') : h)],
    ];
    for (const [nom, fn] of mutations) {
      const n = muter(fn);
      if (n) console.log(`✓ prouvé : « ${nom} » est vu (${n})`);
      else { console.error(`✗ « ${nom} » passe inaperçu`); rouge++; }
    }
  }
  if (rouge) { console.error(`${rouge} faute(s).`); process.exit(1); }
  console.log('OK : tous les e-mails sont en « Verre dépoli ».');
})().catch((e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
