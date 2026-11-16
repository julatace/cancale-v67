#!/usr/bin/env node
// scripts/bancs/factures-mieux.cjs
// ════════════════════════════════════════════════════════════════════════════
// L'E-MAIL D'UNE FACTURE, RENDU (16 nov., lot factures-mieux — Julien, capture Gmail
// sombre : l'anglais puis le français empilés, dans un cadre bleu épais).
// Fabrique l'e-mail par la VRAIE fonction (`emailFacture`), données inventées, et le
// REND dans Chromium à 390 et 700 px, en clair, en sombre (Apple Mail / iOS :
// prefers-color-scheme) et en sombre « Outlook.com » (attribut data-ogsc posé sur le
// corps), puis mesure dans la page :
//   L aucun débordement de côté, la colonne fait 600 px au plus ;
//   P chaque texte visible ≥ 14 px ;
//   C contraste ≥ 4,5:1 de chaque texte sur son vrai fond ;
//   U UNE langue : aucun mot fixe de l'autre langue ;
//   F le nom de la boutique en tête, aucun mot VRM, le montant et le n° au récapitulatif,
//     la pièce jointe nommée, aucun bouton ; aucune image, aucune requête au dehors ;
//   B aucun fond bleu (le cadre de la forme « Verre dépoli » n'est pas celui d'une facture).
// Les captures (SHOTS=dossier) sont À REGARDER.
//   node scripts/bancs/factures-mieux.cjs
//   RACINE_BANC=<arbre>   juger un autre arbre (git archive)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..', '..');
const RACINE = path.resolve(process.env.RACINE_BANC || ICI);
const SHOTS = path.resolve(process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'factures-mieux-')));

const MESURE = () => {
  const lum = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const L = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondDe = (el) => { for (let e = el; e; e = e.parentElement) { const c = lum(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const visible = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const petits = [], contrastes = [], bleus = [];
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const t = n.textContent.replace(/[\s​ ﻿͏ ]+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement; if (!el || !visible(el)) continue;
    const s = getComputedStyle(el); const px = parseFloat(s.fontSize);
    if (px < 14) petits.push(`${px}px « ${t.slice(0, 40)} »`);
    const c = lum(s.color), f = fondDe(el);
    if (c && f) { const a = L(c), b = L(f); const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (k < 4.5) contrastes.push(`${k.toFixed(2)}:1 « ${t.slice(0, 30)} »`); if (f.b > f.r + 60 && f.b > 100) bleus.push(t.slice(0, 30)); }
  }
  const col = document.querySelector('[data-fm="corps"]');
  return {
    largeurDoc: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), largeurEcran: window.innerWidth,
    largeurCol: col ? Math.round(col.getBoundingClientRect().width) : -1,
    petits, contrastes, bleus,
    images: document.querySelectorAll('img').length,
    liens: [...document.querySelectorAll('[data-fm="corps"] a')].length,
    tete: (document.querySelector('[data-fm="tete"]') || {}).innerText || '',
    corps: col ? col.innerText : '', tout: document.body.innerText,
    lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length,
  };
};

(async () => {
  const imp = (p) => import(pathToFileURL(path.join(RACINE, p)).href);
  let regle;
  try { regle = await imp('src/facturePro/regle.js'); } catch (e) { console.log('❌ regle.js', e.message); process.exit(1); }
  const CFG = { nom: 'Atelier Démo des Baskets Anciennes', forme: 'EI', adresse: '1 rue Inventée', codePostal: '35000', ville: 'Rennes', siret: '73282932000074', email: 'demo@exemple.test', tva_regime: 'franchise', prefixe: 'FA', couleur: '#1d1d1f' };
  const V = { acheteur: { nom: 'Client Démo', adresse: '3 Voorbeeldstraat\n1011 AB Amsterdam\nPays-Bas', email: 'client@exemple.test' }, designation: 'Paire de démonstration 42 très longue désignation pour voir le retour à la ligne', centimes: 7490, venteLe: '2026-11-16T14:20:00Z', reference: '24000000001', plateforme: 'Vinted' };
  const O = { numero: 'FA-2026-0007', emiseLe: Date.parse('2026-11-16T15:01:00Z') };
  const avoir = (c) => ({ ...c, type: 'avoir', numero: 'AV-2026-0002', origine: c.numero, totaux: { ht: -c.totaux.ht, tva: c.totaux.tva == null ? null : -c.totaux.tva, ttc: -c.totaux.ttc }, lignes: c.lignes.map((l) => ({ ...l, unite: -l.unite, total: -l.total })) });
  let mails;
  try {
    const fr = regle.contenuFacture(CFG, V, O), en = regle.contenuFacture(CFG, V, { ...O, langue: 'en' });
    const tva = regle.contenuFacture({ ...CFG, forme: 'SASU', capital: '1000', rcs: 'RCS Rennes 732 829 320', tva: 'FR44732829320', tva_regime: 'normal', tva_taux: 20 }, V, O);
    mails = {
      'facture-fr': { m: regle.emailFacture(CFG, fr, { via: 'vrm', pieces: ['Facture-FA-2026-0007.pdf', 'Formulaire-retour.pdf'] }), langue: 'fr', montant: '74,90', fichier: 'Facture-FA-2026-0007.pdf' },
      'facture-en': { m: regle.emailFacture(CFG, en, { via: 'vrm' }), langue: 'en', montant: '74,90', fichier: 'Facture-FA-2026-0007.pdf' },
      'facture-tva': { m: regle.emailFacture(CFG, tva, { via: 'boite' }), langue: 'fr', montant: '74,90', fichier: 'Facture-FA-2026-0007.pdf' },
      'avoir-fr': { m: regle.emailFacture(CFG, avoir(fr), { via: 'vrm' }), langue: 'fr', montant: '-74,90', fichier: 'Avoir-AV-2026-0002.pdf' },
    };
  } catch (e) { console.log('❌ fabrication', e.message); process.exit(1); }
  const FR_MOTS = /Bonjour|Vous trouverez|N° de facture|Pièce jointe|Net à payer/;
  const EN_MOTS = /\bHello\b|Please find|Invoice number|Attachment|Amount due/;
  let ok = 0, ko = 0;
  const dit = (v, quoi, d) => { if (v) ok++; else { ko++; console.log(`❌ ${quoi}${d !== undefined ? ` — ${JSON.stringify(d).slice(0, 240)}` : ''}`); } };
  const { chromium } = require(path.join(ICI, 'node_modules/playwright'));
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const nav = await chromium.launch({ ...exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-html-'));
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const [nom, { m, langue, montant, fichier }] of Object.entries(mails)) {
      dit(typeof m.texte === 'string' && m.texte.length > 40, `${nom} : texte brut alternatif présent`);
      dit(!/data-vv=|#174C88|linear-gradient/i.test(m.html), `${nom} B : aucun cadre bleu dans le source`);
      const fichierHtml = path.join(dossier, `${nom}.html`); fs.writeFileSync(fichierHtml, m.html);
      for (const largeur of [390, 700]) for (const theme of ['clair', 'sombre', 'outlook']) {
        const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, colorScheme: theme === 'sombre' ? 'dark' : 'light', deviceScaleFactor: 2, locale: 'fr-FR' });
        const page = await ctx.newPage(); const dehors = [];
        await page.route(/^https?:\/\//, (r) => { dehors.push(r.request().url()); r.abort(); });
        await page.goto(pathToFileURL(fichierHtml).href);
        if (theme === 'outlook') await page.evaluate(() => document.body.setAttribute('data-ogsc', ''));
        const x = await page.evaluate(MESURE);
        const ou = `${nom} ${largeur}px ${theme}`;
        dit(x.largeurDoc <= x.largeurEcran && x.largeurCol > 0 && x.largeurCol <= 600, `${ou} L : pas de débordement, colonne ≤ 600 px`, [x.largeurDoc, x.largeurCol]);
        dit(!x.petits.length, `${ou} P : texte ≥ 14 px`, x.petits.slice(0, 3));
        dit(!x.contrastes.length, `${ou} C : contraste ≥ 4,5:1`, x.contrastes.slice(0, 3));
        dit(!x.bleus.length, `${ou} B : aucun texte sur fond bleu`, x.bleus.slice(0, 3));
        dit(x.lang === langue && !(langue === 'fr' ? EN_MOTS : FR_MOTS).test(x.tout), `${ou} U : une seule langue (${langue})`, (x.tout.match(langue === 'fr' ? EN_MOTS : FR_MOTS) || [])[0]);
        dit(/Atelier Démo des Baskets Anciennes EI/.test(x.tete) && !/\bVRM\b/.test(x.tout), `${ou} F : la boutique en tête, aucun mot VRM`, x.tete);
        dit(x.corps.includes(montant) && x.corps.includes(fichier) && /(FA|AV)-2026-000\d/.test(x.corps), `${ou} F : montant, n° et pièce jointe au récapitulatif`);
        dit(!x.images && !dehors.length && !x.liens && x.h1 === 1, `${ou} F : aucune image, aucune requête, aucun bouton, une <h1>`, { images: x.images, dehors, liens: x.liens });
        await page.screenshot({ path: path.join(SHOTS, `${nom}-${largeur}-${theme}.png`), fullPage: true });
        await ctx.close();
      }
    }
  } finally { await nav.close(); fs.rmSync(dossier, { recursive: true, force: true }); }
  console.log(`\n${Object.keys(mails).length} e-mails × 2 largeurs × 3 rendus · ${ok} ✅ · ${ko} ❌\nCaptures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
