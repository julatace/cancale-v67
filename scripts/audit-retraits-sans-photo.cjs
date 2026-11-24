#!/usr/bin/env node
// AUDIT (23 nov., bugs-totale §3.4) — un colis à retirer SANS PHOTO se dessine (src/natif/RetraitsPoints.jsx).
// `Contenu` dessinait la place de la photo par `<Icon name="box">` sans recevoir `Icon` : « Icon is not defined », l'écran
// Achats/Colis tombait sur le garde-fou dès qu'un colis à retirer n'avait pas de photo. Ce contrôle EXÉCUTE le vrai composant
// (esbuild → CommonJS, renderToStaticMarkup) avec un point inventé : un colis avec photo, un sans photo. Données inventées.
// `--mutation` : retirer `Icon` des paramètres de `Contenu` ⇒ ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(__dirname, '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const MUTATIONS = {
  'contenu-sans-icon': ['src/natif/RetraitsPoints.jsx', 'function Contenu({ x, c, rg, photo, aides, prix, neuf, Icon })', 'function Contenu({ x, c, rg, photo, aides, prix, neuf })'],
  'contenu-icon-pas-passe': ['src/natif/RetraitsPoints.jsx', 'prix={prix} neuf={neuf} Icon={Icon}/>', 'prix={prix} neuf={neuf}/>'],
};
if (process.argv.includes('--mutation')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rsp-'));
    fs.cpSync(path.join(R, 'src'), path.join(t, 'src'), { recursive: true });
    fs.symlinkSync(NM, path.join(t, 'node_modules'));
    const s = fs.readFileSync(path.join(t, f), 'utf8');
    if (!s.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable`); continue; }
    fs.writeFileSync(path.join(t, f), s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const tombe = r.status !== 0; if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? 'rouge' : 'VERTE'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} non attrapée(s)`); process.exit(ok === n ? 0 : 1);
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rsp-'));
  const src = (f) => JSON.stringify(path.join(R, 'src', f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import frApp from ${src('i18n/langues/fr.js')};
import { ajouterSourceApp } from ${src('i18n/index.js')};
ajouterSourceApp(frApp);
export { RetraitsPoints } from ${src('natif/RetraitsPoints.jsx')};
export const rendre = (el) => renderToStaticMarkup(el);
export { React };
`);
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx', '.css': 'empty' }, nodePaths: [NM], logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' } });
  const M = require(path.join(dir, 'sortie.cjs'));
  const { React } = M;
  const Icon = ({ name }) => React.createElement('i', { 'data-icone': name });
  const Photo = (s) => React.createElement('img', { src: s, 'data-photo': '' });
  const aides = { titre: (x) => x.titre || '', qrSrc: () => null, enGrand: () => null, prixDe: () => '', nomTransporteur: () => '', horairesDe: () => null };
  const colis = (id, photo) => ({ id, cle: id, code: '123456', titre: 'Paire inventée ' + id, num: '', jours: 3, ...(photo ? { photo } : {}) });
  const point = { cle: 'p1', numero: 'p1', nom: 'Relais inventé', adresse: '1 rue Inventée, 00000 Nulle-Part', arrives: [colis('a', 'https://exemple.invalid/a.jpg'), colis('b', null)] };
  let html = '', err = '';
  try { html = M.rendre(React.createElement(M.RetraitsPoints, { points: [point], aides, Photo, Icon })); } catch (e) { err = String(e && e.message || e); }
  dit(!err, 'un point avec un colis SANS photo se dessine sans erreur', err);
  dit(/data-rp-photo="0"[^>]*>(?:<[^>]+>)*?<i data-icone="box"/.test(html) || (html.includes('data-rp-photo="0"') && html.includes('data-icone="box"')), 'le colis sans photo a sa place réservée (icône « box »)');
  dit(html.includes('data-rp-photo="1"') && html.includes('data-photo=""'), 'le colis avec photo garde SA photo');
  dit((html.match(/data-rp-titre=""/g) || []).length >= 2, 'les deux colis sont montrés (aucun caché)', String((html.match(/data-rp-titre=""/g) || []).length));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout vert'); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
