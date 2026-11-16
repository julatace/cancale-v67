#!/usr/bin/env node
// Audit des modèles d'e-mails de compte (8 nov.).
//  1. supabase/templates/* sont ceux que fabrique scripts/modeles-email.cjs ;
//  2. chaque modèle : FR par défaut, EN seulement si .Data.langue == "en",
//     bon lien (récupération = /recuperation.html#token_hash…&type=recovery,
//     les autres = {{ .ConfirmationURL }}, réauthentification = {{ .Token }}),
//     (15 nov.) la forme commune « Verre dépoli » (api/_lib/mail-verre.js), plein d’encre 48 px,
//     largeur 600, logo hébergé, < 100 Ko, aucune feuille externe, pas de violet,
//     lien en clair de secours, pied « Tu reçois cet e-mail parce que… » ;
//  3. si `go` est là : rendu par le VRAI moteur de modèles de Go (html/template
//     et text/template), pour fr / en / langue absente / données absentes.
//  --prouve : chaque règle doit rougir sur un modèle abîmé exprès.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { MODELES, fichiers, DOSSIER, LIEN_RECUPERATION } = require('./modeles-email.cjs');
// (15 nov., « Verre dépoli ») la forme commune de TOUS les e-mails : chaque modèle doit la porter telle quelle.
const { VERRE, styleVerre } = require('../api/_lib/mail-verre.js');

const RACINE = path.join(__dirname, '..');

function regles(id, src) {
  const m = MODELES.find((x) => x.id === id);
  const fautes = [];
  const exige = (ok, quoi) => { if (!ok) fautes.push(`${id} : ${quoi}`); };
  exige(src.startsWith('{{- $en := eq (printf "%v" .Data.langue) "en" -}}'), 'la langue n’est pas lue en tête (.Data.langue)');
  // (15 nov.) Un document entier par langue : `{{ if $en }}` <doc en> `{{ else }}` <doc fr> `{{ end }}` (en fin de fichier).
  const i = src.indexOf('\n{{ if $en }}\n'), j = src.indexOf('\n{{ else }}\n', i), k = src.lastIndexOf('\n{{ end }}');
  exige(i > 0 && j > i && k > j, 'pas de bloc anglais / français');
  const en = src.slice(i, j), fr = src.slice(j, k);
  exige(fr.includes(m.fr.titre) && en.includes(m.en.titre), 'titres FR/EN absents ou inversés');
  exige(!fr.includes(m.en.titre) && !en.includes(m.fr.titre), 'langues mélangées');
  for (const [nom, bloc] of [['fr', fr], ['en', en]]) {
    if (m.code) exige(bloc.includes('{{ .Token }}') && /data-vv="code"[^>]*font-size:3[0-9]px[^>]*user-select:all/.test(bloc), `${nom} : le code {{ .Token }} manque (en GRAND, copiable)`);
    if (m.lien) {
      const hrefs = [...bloc.matchAll(/href="([^"]+)"/g)].map((x) => x[1]).filter((h) => h !== 'https://vrm.center');
      exige(hrefs.length === 2 && hrefs.every((h) => h === m.lien), `${nom} : bouton et lien de secours doivent pointer sur ${m.lien}`);
      exige(new RegExp(`data-vv="plein"[^>]*bgcolor="${VERRE.plein}"`).test(bloc) && /line-height:48px/.test(bloc) && (bloc.match(/data-vv="plein"/g) || []).length === 1, `${nom} : UN plein d’encre de 48 px absent`);
      exige(bloc.includes(nom === 'fr' ? 'Copie ce lien' : 'Copy this link'), `${nom} : lien en clair de secours absent`);
    }
    exige(bloc.includes(nom === 'fr' ? 'Tu reçois cet e-mail parce qu' : 'You’re receiving this email because'), `${nom} : pied « parce que » absent`);
    exige(/max-width:600px/.test(bloc) && /<!--\[if mso\]><table role="presentation" width="600"/.test(bloc), `${nom} : largeur 600 absente`);
    // La forme commune (api/_lib/mail-verre.js) : la même feuille, le fond bleu uni + dégradé, le logo hébergé,
    // le titre sur le bleu, la carte, le pied — rien d’autre ne peut la remplacer.
    exige(bloc.includes(styleVerre()), `${nom} : la feuille commune (styleVerre) n’y est pas telle quelle`);
    exige(new RegExp(`data-vv="fond"[^>]*bgcolor="${VERRE.bleu}"[^>]*background-image:linear-gradient`).test(bloc) && ['tete', 'titre', 'carte', 'pied'].every((x) => bloc.includes(`data-vv="${x}"`)), `${nom} : la forme commune (fond bleu, tête, titre, carte, pied) manque`);
    exige(bloc.includes(`src="${VERRE.logo}"`) && !/src="data:/.test(bloc), `${nom} : logo hébergé sur vrm.center absent (ou en base64)`);
    exige(new RegExp(`<html lang="${nom}"`).test(bloc), `${nom} : lang du document`);
  }
  if (id === 'recovery') exige(m.lien === LIEN_RECUPERATION && src.includes('https://vrm.center/recuperation.html#token_hash={{ .TokenHash }}&amp;type=recovery'), 'le lien de récupération n’a plus la forme qui marche');
  else if (m.lien) exige(src.includes('{{ .ConfirmationURL }}') && !src.includes('TokenHash'), 'le lien n’est pas {{ .ConfirmationURL }}');
  if (id === 'magic_link') exige(!!(m.code && m.lien), 'le lien de connexion doit porter le code {{ .Token }} ET le bouton (extension 5.330)');
  exige(!/<link\b|@import|<script\b/i.test(src), 'feuille ou script externe');
  exige(!/#(?:7c3aed|8b5cf6|6d28d9|a855f7|9333ea|5b21b6)/i.test(src) && !/violet|purple/i.test(src), 'violet (refusé)');
  exige(Buffer.byteLength(src) < 100 * 1024, `poids ${Math.round(Buffer.byteLength(src) / 1024)} Ko (≥ 100 Ko)`);
  return fautes;
}

function audit(sources) {
  const fautes = [];
  for (const m of MODELES) fautes.push(...regles(m.id, sources[m.id]));
  return fautes;
}

const lireSources = (dossier) => Object.fromEntries(MODELES.map((m) => [m.id, fs.readFileSync(path.join(dossier, `${m.id}.html`), 'utf8')]));

let rouge = 0;
// 1. fabriqués par le générateur
for (const [p, c] of Object.entries(fichiers())) {
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c) { console.error('✗ à refabriquer : ' + path.relative(RACINE, p)); rouge++; }
}
// 2. règles
const sources = lireSources(DOSSIER);
const fautes = audit(sources);
for (const f of fautes) console.error('✗ ' + f);
rouge += fautes.length;
if (!fautes.length) console.log(`✓ ${MODELES.length} modèles : FR par défaut, EN si langue "en", bons liens, la forme commune « Verre dépoli » (fond bleu, carte, plein d’encre 48 px, code en grand), 600 px, < 100 Ko, pas de violet`);

// 3. le vrai moteur de Go
let go = null;
try { go = execFileSync('go', ['version'], { encoding: 'utf8' }).trim(); } catch (_) { go = null; }
if (go) {
  const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-modeles-'));
  try {
    execFileSync('go', ['run', path.join(__dirname, 'outils', 'modeles-email-rendu.go'), DOSSIER, sortie], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const sujets = JSON.parse(fs.readFileSync(path.join(sortie, 'sujets-rendus.json'), 'utf8'));
    for (const m of MODELES) {
      const lire = (c) => fs.readFileSync(path.join(sortie, `${m.id}.${c}.html`), 'utf8');
      const fr = lire('fr'), en = lire('en');
      const ok = fr.includes('lang="fr"') && en.includes('lang="en"') && fr.includes(m.fr.titre.replace(/’/g, '’')) && !fr.includes(m.en.titre)
        && ['sans-langue', 'sans-donnees', 'sans-cle'].every((c) => lire(c) === fr)
        && !/\{\{|\}\}/.test(fr + en)
        && (!m.code || (fr.includes('482913') && en.includes('482913')))
        && (!m.lien ? true : m.id === 'recovery' ? fr.includes('recuperation.html#token_hash=0123456789abcdef') : fr.includes('lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/verify'))
        && sujets[m.id].fr === m.sujet.fr && sujets[m.id].en === m.sujet.en && sujets[m.id]['sans-cle'] === m.sujet.fr;
      if (!ok) { console.error(`✗ ${m.id} : le rendu Go ne donne pas FR par défaut / EN si "en" / sujet par langue`); rouge++; }
    }
    if (!rouge) console.log(`✓ rendu par ${go} (html/template et text/template) : fr, en, langue absente, données absentes ; sujets par langue`);
  } catch (e) { console.error('✗ rendu Go en erreur : ' + String(e.stderr || e.message).trim()); rouge++; }
  finally { fs.rmSync(sortie, { recursive: true, force: true }); }
} else console.log('· go absent de ce conteneur : rendu Go non joué (les règles 1-2 restent jugées)');

// --prouve : chaque mutation doit être vue.
if (process.argv.includes('--prouve')) {
  const mutations = [
    ['récupération vers l’ancienne forme', (s) => ({ ...s, recovery: s.recovery.split(LIEN_RECUPERATION).join('{{ .ConfirmationURL }}') })],
    ['anglais par défaut', (s) => ({ ...s, confirmation: s.confirmation.replace('"en" -}}', '"fr" -}}').replace('{{ if $en }}', '{{ if not $en }}') })],
    ['bouton violet', (s) => ({ ...s, magic_link: s.magic_link.split(VERRE.plein).join('#7C3AED') })],
    ['forme commune retirée (fond)', (s) => ({ ...s, recovery: s.recovery.split('data-vv="fond"').join('data-x="fond"') })],
    ['feuille commune changée', (s) => ({ ...s, invite: s.invite.split('.vv-carte{').join('.vv-autre{') })],
    ['feuille externe', (s) => ({ ...s, invite: s.invite.replace('</head>', '<link rel="stylesheet" href="https://exemple.test/a.css"></head>') })],
    ['code absent', (s) => ({ ...s, reauthentication: s.reauthentication.split('{{ .Token }}').join('') })],
    ['code de connexion absent', (s) => ({ ...s, magic_link: s.magic_link.split('{{ .Token }}').join('') })],
    ['pied retiré', (s) => ({ ...s, email_change: s.email_change.split('Tu reçois cet e-mail parce qu').join('') })],
  ];
  for (const [nom, f] of mutations) {
    const n = audit(f(sources)).length;
    if (n) console.log(`✓ prouvé : « ${nom} » est vu (${n} faute${n > 1 ? 's' : ''})`);
    else { console.error(`✗ « ${nom} » passe inaperçu`); rouge++; }
  }
}
if (rouge) { console.error(`${rouge} faute(s).`); process.exit(1); }
console.log('OK : modèles d’e-mails de compte.');
