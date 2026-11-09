#!/usr/bin/env node
// scripts/mails-apercus.cjs
// ════════════════════════════════════════════════════════════════════════════
// LES APERÇUS DES E-MAILS DE VRM (8 nov.) — pour REGARDER chaque e-mail.
// ════════════════════════════════════════════════════════════════════════════
// Rend chaque e-mail que VRM envoie (essai j1/j3/j6, bilan du mois complet et
// partiel, lien de preuve d'adresse, facture Pro, essai de la boîte des
// factures, e-mail d'essai de Réglages) avec des données de DÉMONSTRATION
// inventées (jamais la production), écrit le HTML et le texte brut, puis prend
// une capture Playwright à 390 et 600 px, en clair et en sombre.
//   node scripts/mails-apercus.cjs [dossier]   (défaut : ./mails-vrm hors dépôt conseillé)
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'mails-vrm'));

(async () => {
  const imp = (p) => import(pathToFileURL(path.join(RACINE, p)).href);
  const RE = await imp('api/_lib/relances-essai.js');
  const BM = await imp('api/_lib/bilan-mois.js');
  const PA = await imp('api/_lib/preuve-adresse.js');
  const FR = await imp('src/facturePro/regle.js');
  const FP = await imp('api/_lib/facture-pro.js');
  const ME = await imp('api/_lib/mail-essai.js');
  globalThis.VRM_EDITEUR = undefined;      // l'éditeur pas rempli : rien d'inventé au pied

  const fin = new Date(Date.now() + 3 * 86400e3).toISOString();
  const lien = 'https://vrm.center/api/compte?mode=relances&d=demonstration';
  const mails = {
    'essai-j1': RE.texteRelance('j1', { fin, lien }),
    'essai-j3': RE.texteRelance('j3', { fin, lien, relie: { vinted: false, emails: true, notifications: false } }),
    'essai-j6': RE.texteRelance('j6', { fin, lien }),
    'bilan-complet': BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'su', n: 23, eur: 1842.5 }, recu: { etat: 'su', eur: 1610 }, benefice: { etat: 'su', brut: 655.2, n: 23, nCout: 23, manque: [] }, meilleure: { eur: 189, plateforme: 'Vinted', titre: 'Paire de démonstration 42' } }, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration' }),
    'bilan-partiel': BM.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'partiel', n: 6, eur: 300, manque: ['compte_demo (lu le 28 oct.)'] }, recu: { etat: 'pas-su', eur: 0, manque: [] }, benefice: { etat: 'partiel', brut: 120, n: 6, nCout: 4, manque: ['2 prix d’achat manquent'] }, meilleure: null }, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=demonstration' }),
    'preuve-adresse': PA.emailConfirmation('demo.vendeur@exemple.test', 'https://vrm.center/?confirmer-adresse=demonstration'),
    'facture-pro': (() => { const m = FR.emailFacture({}, { type: 'facture', numero: 'FA-2026-0001', vendeur: { nom: 'Boutique Démo' }, acheteur: { nom: 'Client Démo' }, lignes: [{ designation: 'Paire de démonstration' }] }, { via: 'vrm' }); return m; })(),
    'boite-factures': { sujet: 'Essai d’envoi de tes factures', ...FP.mailBoiteEssai() },
    'mail-essai': ME.mailEssai(),
  };
  fs.mkdirSync(SORTIE, { recursive: true });
  for (const [nom, m] of Object.entries(mails)) {
    fs.writeFileSync(path.join(SORTIE, `${nom}.html`), m.html);
    fs.writeFileSync(path.join(SORTIE, `${nom}.txt`), `Sujet : ${m.sujet}\n\n${m.texte}\n`);
  }
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('playwright absent : HTML écrits seulement'); return; }
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const nav = await chromium.launch({ ...exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  for (const [nom] of Object.entries(mails)) {
    for (const largeur of [390, 600]) for (const theme of ['light', 'dark']) {
      const page = await nav.newPage({ viewport: { width: largeur, height: 900 }, colorScheme: theme, deviceScaleFactor: 2 });
      // Le logo est servi depuis le dépôt (aucun réseau).
      await page.route('https://vrm.center/vrm-logo-v5-192.png', (r) => r.fulfill({ path: path.join(RACINE, 'public', 'vrm-logo-v5-192.png'), contentType: 'image/png' }));
      await page.goto(pathToFileURL(path.join(SORTIE, `${nom}.html`)).href);
      await page.screenshot({ path: path.join(SORTIE, `${nom}-${largeur}-${theme === 'light' ? 'clair' : 'sombre'}.png`), fullPage: true });
      await page.close();
    }
  }
  await nav.close();
  console.log(`${Object.keys(mails).length} e-mails · ${Object.keys(mails).length * 4} captures dans ${SORTIE}`);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
