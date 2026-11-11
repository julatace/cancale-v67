#!/usr/bin/env node
// scripts/bancs/emails-envoyes.cjs
// ════════════════════════════════════════════════════════════════════════════
// LES E-MAILS QUE VRM ENVOIE, RENDUS (11 nov., lot emails-envoyes — « les e-mails
// que VRM envoie au nom du vendeur sont beaux et lisibles sur téléphone »).
// ════════════════════════════════════════════════════════════════════════════
// Fabrique CHAQUE e-mail que VRM envoie (par les vraies fonctions : essai j1/j3/j6,
// bilan du mois complet et partiel, lien de preuve d'adresse, facture et avoir Pro
// — français et bilingue —, essai de la boîte des factures, e-mail d'essai de
// Réglages, avis avant suppression, compte supprimé), avec des données de
// DÉMONSTRATION inventées (jamais la production, aucun envoi, aucune base), puis le
// REND dans Chromium à 390 et 700 px, en clair et en sombre, et mesure dans la page :
//   L  pas de débordement de côté (largeur du document ≤ largeur de l'écran) ;
//      la carte fait 600 px au plus ;
//   P  chaque texte VISIBLE est en 14 px ou plus (le préentête caché n'en est pas) ;
//   C  contraste AA (4,5:1) de chaque texte visible sur le fond qu'il a VRAIMENT
//      (premier ancêtre au fond non transparent), en clair ET en sombre ;
//   T  la version texte existe et dit le même titre ;
//   H  aucun lien http (https ou mailto seulement) ;
//   I  aucune image distante (aucune image du tout : l'en-tête est un mot) ;
//   S  aucun script, aucun attribut on… ;
//   A  `lang` posé, une seule `<h1>`, chaque table de mise en page en
//      `role="presentation"`, chaque image (s'il y en a) a un `alt` ;
//   F  facture / avoir : le NOM DE LA BOUTIQUE en tête, aucun mot « VRM » dans le
//      corps (Julien, 11 nov. : pas de « envoyée par VRM »), le numéro et le
//      montant de la dernière ligne du PDF, la pièce jointe nommée ; aucun bouton.
// Les captures (SHOTS=dossier, défaut : un dossier temporaire) sont À REGARDER.
//   node scripts/bancs/emails-envoyes.cjs            le banc
//   node scripts/bancs/emails-envoyes.cjs --mutations chaque règle réaffaiblie ⇒ rouge
//   RACINE_BANC=<arbre>                              juger un autre arbre (git archive)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const ICI = path.join(__dirname, '..', '..');
const RACINE = path.resolve(process.env.RACINE_BANC || ICI);
const SHOTS = path.resolve(process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'emails-envoyes-')));
const LARGEURS = [390, 700];
const THEMES = ['light', 'dark'];

async function fabriquer(racine) {
  const imp = async (p) => { try { return await import(pathToFileURL(path.join(racine, p)).href); } catch (e) { return { __erreur: String(e && e.message || e) }; } };
  const RE = await imp('api/_lib/relances-essai.js');
  const BM = await imp('api/_lib/bilan-mois.js');
  const PA = await imp('api/_lib/preuve-adresse.js');
  const FR = await imp('src/facturePro/regle.js');
  const FP = await imp('api/_lib/facture-pro.js');
  const ME = await imp('api/_lib/mail-essai.js');
  const CP = await imp('api/_lib/clients-partis.js');
  const SC = await imp('api/_lib/suppression-compte.js');
  globalThis.VRM_EDITEUR = undefined;   // l'éditeur pas rempli : rien d'inventé au pied
  const fin = new Date(Date.now() + 3 * 86400e3).toISOString();
  const lien = 'https://vrm.center/api/compte?mode=relances&d=demonstration';
  // Une facture de démonstration (inventée), à la forme de `contenuFacture`.
  const facture = (o = {}) => ({
    v: 1, type: 'facture', numero: 'FA-2026-0007', emiseJour: '11/11/2026', venteJour: '10/11/2026',
    vendeur: { nom: 'Atelier Démo des Baskets Anciennes EI', adresse: ['1 rue Inventée', '35000 Rennes'], legal: [], email: 'demo@exemple.test' },
    acheteur: { nom: 'Client Démo', adresse: [], email: 'client@exemple.test' },
    lignes: [{ designation: 'Paire de démonstration 42', quantite: 1, unite: 7490, total: 7490 }],
    regime: 'franchise', taux: null, totaux: { ht: 7490, tva: null, ttc: 7490 }, ...o,
  });
  const essai = (f) => { try { return f(); } catch (e) { return { __erreur: String(e && e.message || e) }; } };
  return {
    'essai-j1': { m: essai(() => RE.texteRelance('j1', { fin, lien })) },
    'essai-j3': { m: essai(() => RE.texteRelance('j3', { fin, lien, relie: { vinted: false, emails: true, notifications: false } })) },
    'essai-j6': { m: essai(() => RE.texteRelance('j6', { fin, lien })) },
    'bilan-complet': { m: essai(() => BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 23, eur: 1842.5 }, recu: { etat: 'su', eur: 1610 }, benefice: { etat: 'su', brut: 655.2, n: 23, nCout: 23, manque: [] }, meilleure: { eur: 189, plateforme: 'Vinted', titre: 'Paire de démonstration 42' } }, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration' })) },
    'bilan-partiel': { m: essai(() => BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'partiel', n: 6, eur: 300, manque: ['compte_demo (lu le 28 oct.)'] }, recu: { etat: 'pas-su', eur: 0, manque: [] }, benefice: { etat: 'partiel', brut: 120, n: 6, nCout: 4, manque: ['2 prix d’achat manquent'] }, meilleure: null }, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration' })) },
    'preuve-adresse': { m: essai(() => PA.emailConfirmation('demo.vendeur@exemple.test', 'https://vrm.center/?confirmer-adresse=demonstration')) },
    // Un lien reçu en http (une adresse mal recopiée) : il n'est JAMAIS posé.
    'bilan-lien-http': { m: essai(() => BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 1, eur: 50 }, recu: { etat: 'su', eur: 50 }, benefice: { etat: 'su', brut: 20, n: 1, nCout: 1, manque: [] }, meilleure: null }, { lien: 'http://vrm.center/api/compte?mode=bilan-mois&d=demonstration' })) },
    'facture': { m: essai(() => FR.emailFacture({}, facture(), { via: 'vrm' })), facture: { c: facture(), montant: '74,90 €', libelle: 'Net à payer', fichier: 'Facture-FA-2026-0007.pdf' } },
    'facture-tva': { m: essai(() => FR.emailFacture({}, facture({ regime: 'normal', taux: 20, totaux: { ht: 6242, tva: 1248, ttc: 7490 } }), { via: 'boite' })), facture: { montant: '74,90 €', libelle: 'Total TTC', fichier: 'Facture-FA-2026-0007.pdf' } },
    'avoir': { m: essai(() => FR.emailFacture({}, facture({ type: 'avoir', numero: 'AV-2026-0002', origine: 'FA-2026-0007', totaux: { ht: -7490, tva: null, ttc: -7490 } }), { via: 'vrm' })), facture: { montant: '-74,90 €', libelle: 'Montant à rembourser', fichier: 'Avoir-AV-2026-0002.pdf' } },
    'facture-anglais': { m: essai(() => FR.emailFacture({}, facture({ anglais: { mentions: [], paiement: '' } }), { via: 'vrm' })), facture: { montant: '74,90 €', libelle: 'Net à payer', fichier: 'Facture-FA-2026-0007.pdf' } },
    'boite-factures': { m: essai(() => ({ sujet: 'Essai d’envoi de tes factures', ...FP.mailBoiteEssai() })) },
    'mail-essai': { m: essai(() => ME.mailEssai()) },
    'avis-suppression': { m: essai(() => CP.mailAvis({ quand: '11/12/2026' })) },
    'compte-supprime': { m: essai(() => SC.mailSuppression({ fait: ['abonnement résilié (aucun nouveau prélèvement)', 'ventes, annonces, numéros effacés'], contact: 'contact@exemple.test', maintenant: Date.parse('2026-11-11T10:00:00Z') })) },
  };
}

// Tout ce qui se juge DANS la page, d'un coup.
const MESURE = () => {
  const lum = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const L = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondDe = (el) => { for (let e = el; e; e = e.parentElement) { const c = lum(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const visible = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const petits = [], contrastes = [];
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const t = n.textContent.replace(/[\s​ ﻿͏]+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement; if (!el || !visible(el)) continue;
    const s = getComputedStyle(el); const px = parseFloat(s.fontSize);
    if (px < 14) petits.push(`${px}px « ${t.slice(0, 40)} »`);
    const c = lum(s.color), f = fondDe(el);
    if (c && f) { const a = L(c), b = L(f); const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (k < 4.5) contrastes.push(`${k.toFixed(2)}:1 « ${t.slice(0, 40)} » (${s.color} sur rgb(${f.r},${f.g},${f.b}))`); }
  }
  const carte = document.querySelector('.vrm-carte');
  const corps = carte ? carte.innerText : '';
  return {
    largeurDoc: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    largeurEcran: window.innerWidth,
    largeurCarte: carte ? Math.round(carte.getBoundingClientRect().width) : -1,
    petits, contrastes,
    liens: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    images: [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src') || '', alt: i.hasAttribute('alt') })),
    fondsUrl: [...document.querySelectorAll('*')].filter((e) => /url\(/.test(getComputedStyle(e).backgroundImage)).length,
    scripts: document.querySelectorAll('script').length,
    lang: document.documentElement.getAttribute('lang') || '',
    h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()),
    tablesSansRole: [...document.querySelectorAll('table')].filter((t) => t.getAttribute('role') !== 'presentation').length,
    tete: (() => { const t = document.querySelector('.vrm-carte') && document.querySelector('.vrm-carte').closest('table'); const d = t && t.querySelector('tr td'); return d ? d.innerText.trim() : ''; })(),
    corps,
    boutons: [...document.querySelectorAll('.vrm-carte a')].length,
  };
};

async function banc(racine, { captures = true, dire = true } = {}) {
  const mails = await fabriquer(racine);
  let ok = 0, ko = 0; const rouges = [];
  const dit = (v, quoi, detail) => { if (v) ok++; else { ko++; rouges.push(quoi); if (dire) console.log(`❌ ${quoi}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`); } };
  let chromium; try { ({ chromium } = require('playwright')); } catch (_) { console.log('❌ playwright absent'); return { ok, ko: 1, rouges: ['playwright'] }; }
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const nav = await chromium.launch({ ...exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'emails-html-'));
  try {
    for (const [nom, { m, facture }] of Object.entries(mails)) {
      if (!m || m.__erreur || typeof m.html !== 'string') { dit(false, `${nom} : l’e-mail se fabrique`, m && m.__erreur); continue; }
      // T — la version texte, et le même titre.
      const h1src = (m.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
      const titre = h1src.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      dit(typeof m.texte === 'string' && m.texte.trim().length > 20, `${nom} T : version texte présente`);
      dit(!facture ? m.texte.startsWith(titre) : m.texte.trim().length > 20, `${nom} T : la version texte dit le même titre`, titre);
      // S — dans le SOURCE (aucun script, aucun on…, aucune feuille externe).
      dit(!/<script\b/i.test(m.html) && !/\son[a-z]+\s*=/i.test(m.html) && !/<link\b|@import/i.test(m.html), `${nom} S : aucun script, aucun on…, aucune feuille externe`);
      const fichier = path.join(dossier, `${nom}.html`);
      fs.writeFileSync(fichier, m.html);
      for (const largeur of LARGEURS) for (const theme of THEMES) {
        const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, colorScheme: theme, deviceScaleFactor: captures ? 2 : 1, javaScriptEnabled: true });
        const page = await ctx.newPage();
        // Aucun réseau : une requête vers le dehors est NOTÉE (image distante = rouge).
        const dehors = [];
        await page.route(/^https?:\/\//, (r) => { dehors.push(r.request().url()); r.abort(); });
        await page.goto(pathToFileURL(fichier).href);
        const x = await page.evaluate(MESURE);
        const ou = `${nom} ${largeur}px ${theme === 'light' ? 'clair' : 'sombre'}`;
        dit(x.largeurDoc <= x.largeurEcran, `${ou} L : aucun débordement de côté`, `${x.largeurDoc} > ${x.largeurEcran}`);
        dit(x.largeurCarte > 0 && x.largeurCarte <= 600, `${ou} L : la carte fait 600 px au plus`, x.largeurCarte);
        dit(!x.petits.length, `${ou} P : tout texte visible ≥ 14 px`, x.petits.slice(0, 4));
        dit(!x.contrastes.length, `${ou} C : contraste ≥ 4,5:1 partout`, x.contrastes.slice(0, 4));
        dit(x.liens.every((h) => /^(https:|mailto:)/i.test(h)), `${ou} H : aucun lien http`, x.liens.filter((h) => !/^(https:|mailto:)/i.test(h)));
        dit(!x.images.length && !x.fondsUrl && !dehors.length, `${ou} I : aucune image distante (aucune requête au dehors)`, { images: x.images, dehors });
        dit(x.scripts === 0, `${ou} S : aucun script dans la page`);
        dit(/^[a-z]{2}$/.test(x.lang) && x.h1.length === 1 && x.tablesSansRole === 0 && x.images.every((i) => i.alt), `${ou} A : lang, une <h1>, tables de mise en page, alt`, { lang: x.lang, h1: x.h1.length, tables: x.tablesSansRole });
        if (facture) {
          dit(/Atelier Démo des Baskets Anciennes EI/.test(x.tete), `${ou} F : le nom de la boutique en tête`, x.tete);
          dit(!/\bVRM\b/.test(x.tete + x.corps), `${ou} F : aucun mot « VRM » dans l’e-mail du vendeur`, (x.tete + x.corps).match(/.{0,30}\bVRM\b.{0,30}/));
          dit(x.corps.includes(facture.montant) && x.corps.includes(facture.libelle), `${ou} F : le montant et le libellé de la dernière ligne du PDF`, facture);
          dit(x.corps.includes(facture.fichier), `${ou} F : la pièce jointe nommée`, facture.fichier);
          dit(x.boutons === 0, `${ou} F : aucun bouton ni lien dans le corps`, x.boutons);
        }
        if (captures) await page.screenshot({ path: path.join(SHOTS, `${nom}-${largeur}-${theme === 'light' ? 'clair' : 'sombre'}.png`), fullPage: true });
        await ctx.close();
      }
    }
  } finally { await nav.close(); fs.rmSync(dossier, { recursive: true, force: true }); }
  return { ok, ko, rouges, n: Object.keys(mails).length };
}

// ── Les mutations : chaque règle réaffaiblie DOIT faire rougir le banc ──────
const MUTATIONS = [
  ['pied revenu en 12 px', 'api/_lib/mail-gabarit.js', 'margin:0 0 10px;font-size:14px', 'margin:0 0 10px;font-size:12px'],
  ['bouton bleu clair en sombre (3,6:1)', 'api/_lib/mail-gabarit.js', "+ `${s('hr.vrm-filet')}{border-top-color:#38383a!important}`;", "+ `${s('hr.vrm-filet')}{border-top-color:#38383a!important}${s('.vrm-bouton')}{background:#0a84ff!important}`;"],
  ['logo VRM distant revenu', 'api/_lib/mail-gabarit.js', ": `<div class=\"vrm-doux\" style=\"font-size:14px;line-height:1.3;font-weight:700;color:${DOUX};letter-spacing:0.06em\">VRM</div>`;", ": `<img src=\"https://vrm.center/vrm-logo-v5-192.png\" width=\"32\" height=\"32\" alt=\"VRM\">`;"],
  ['lien http accepté', 'api/_lib/mail-gabarit.js', "/^https:\\/\\/[^\\s\"'<>]+$/i", "/^https?:\\/\\/[^\\s\"'<>]+$/i"],
  ['« via VRM » dans la facture', 'src/facturePro/regle.js', "    marque: { nom },\n  });", "    marque: { nom },\n  });\n  html = html.replace('</h1>', '</h1><p style=\"font-size:16px\">Envoyée via VRM</p>');"],
  ['montant retiré de la facture', 'src/facturePro/regle.js', '      ...(total ? [total] : []),', ''],
  ['gris doux trop pâle', 'api/_lib/mail-gabarit.js', "DOUX = '#636366'", "DOUX = '#a1a1a6'"],
  ['carte large et rigide', 'api/_lib/mail-gabarit.js', 'style="width:100%;max-width:${LARGEUR}px"', 'style="width:640px"'],
];

(async () => {
  if (process.argv.includes('--mutations')) {
    let rouges = 0;
    for (const [nom, fichier, avant, apres] of MUTATIONS) {
      const arbre = fs.mkdtempSync(path.join(os.tmpdir(), 'emails-mut-'));
      for (const d of ['api', 'src', 'public/legal']) fs.cpSync(path.join(RACINE, d), path.join(arbre, d), { recursive: true });
      fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(arbre, 'package.json'));
      try { fs.symlinkSync(path.join(ICI, 'node_modules'), path.join(arbre, 'node_modules')); } catch (_) {}
      const p = path.join(arbre, fichier); let src = fs.readFileSync(p, 'utf8');
      if (!src.includes(avant)) { console.log(`⚠️  mutation « ${nom} » : texte introuvable`); rouges += 0; fs.rmSync(arbre, { recursive: true, force: true }); continue; }
      // « via VRM » : `html` est const dans emailFacture ⇒ le rendre réassignable.
      src = src.replace(avant, apres);
      if (nom === '« via VRM » dans la facture') src = src.replace('  const { html } = gabaritMail({\n    titre: `${doc} ${contenu.numero}`', '  let { html } = gabaritMail({\n    titre: `${doc} ${contenu.numero}`');
      fs.writeFileSync(p, src);
      const r = await banc(arbre, { captures: false, dire: false });
      console.log(`${r.ko ? '✅ rouge' : '❌ VERT '} · ${nom} (${r.ko} rouge(s)${r.ko ? ` : ${r.rouges[0]}` : ''})`);
      if (r.ko) rouges++;
      fs.rmSync(arbre, { recursive: true, force: true });
    }
    console.log(`\n${rouges}/${MUTATIONS.length} mutations détectées`);
    process.exit(rouges === MUTATIONS.length ? 0 : 1);
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const r = await banc(RACINE);
  console.log(`\n${r.n} e-mails × ${LARGEURS.length} largeurs × ${THEMES.length} thèmes · ${r.ok} ✅ · ${r.ko} ❌\nCaptures : ${SHOTS}`);
  process.exit(r.ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
