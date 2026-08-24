#!/usr/bin/env node
/**
 * RIEN DE PERSONNEL, RIEN DE SECRET, DANS LE CODE SOURCE
 *
 * ⚠️ Le dépôt est PUBLIC. Ce contrôle a été écrit après avoir trouvé, en clair
 * dans le code : la CLÉ PRIVÉE des notifications push (n'importe qui pouvait
 * envoyer une notification sur les téléphones du vendeur), l'email personnel du
 * vendeur, le nom + l'email + l'adresse postale d'une VRAIE CLIENTE, et la
 * raison sociale + le SIRET du vendeur comme valeur par défaut (donc pré-remplis
 * sur les factures de n'importe quel nouvel utilisateur).
 *
 * ⚠️ Ce qu'il ne prétend PAS faire : cacher l'URL Supabase et la clé « anon ».
 * Elles sont forcément livrées au navigateur — une application web ne cache rien
 * à celui qui l'ouvre. Ce qui les rend inoffensives, c'est RLS (voir SECURITE.md).
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

const DOSSIERS = ['src', 'api', 'public', 'vinted-sync-extension'];
const fichiers = [];
(function marche(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) marche(p);
    else if (/\.(js|jsx|ts|tsx|html|json|css)$/.test(e.name)) fichiers.push(p);
  }
})(R) || null;
const CIBLES = fichiers.filter(f => DOSSIERS.some(d => f.startsWith(path.join(R, d))));

// Chaque règle : [nom, motif, pourquoi c'est interdit]
const REGLES = [
  ['aucune clé privée VAPID', /VAPID_PRIVATE(_KEY)?\s*=\s*process\.env\.[A-Z_]+\s*\|\|\s*['"][A-Za-z0-9_-]{20,}['"]/,
    'une clé privée en repli dans le code = tout le monde peut notifier les téléphones du vendeur'],
  ['aucun email personnel', /[a-z0-9._%+-]+@(gmail|icloud|outlook|hotmail|yahoo|orange|free|laposte|wanadoo)\.[a-z]{2,}/i,
    'donnée personnelle publiée dans un dépôt ouvert'],
  ['aucun SIRET en dur', /\bsiret\s*:\s*['"]\d{9,}['"]/i,
    "l'identité d'entreprise ne doit pas être une valeur par défaut : un nouveau vendeur la trouverait sur ses factures"],
  ['aucune adresse postale en dur', /['"]\d{1,4}\s+(rue|avenue|boulevard|impasse|chemin|place)\s+[^'"]{4,}['"]/i,
    'donnée personnelle (vendeur ou client) dans le code'],
  ['aucune clé Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/,
    'une clé de facturation ne vit jamais dans un dépôt'],
];

for (const [nom, motif, pourquoi] of REGLES) {
  const trouves = [];
  for (const f of CIBLES) {
    const txt = fs.readFileSync(f, 'utf8');
    const lignes = txt.split('\n');
    for (let i = 0; i < lignes.length; i++) {
      // On ignore les lignes de commentaire : elles servent justement à
      // expliquer ce qui a été retiré, et ne sont pas des valeurs actives.
      const l = lignes[i];
      if (/^\s*(\/\/|\*|#)/.test(l)) continue;
      if (motif.test(l)) trouves.push(path.relative(R, f) + ':' + (i + 1));
    }
  }
  trouves.length ? nok(nom, pourquoi + ' → ' + trouves.slice(0, 4).join(', ')) : ok(nom);
}

// Le fichier d'exemple existe et ne porte AUCUNE valeur
const ex = path.join(R, '.env.example');
if (!fs.existsSync(ex)) nok('.env.example documente les variables', 'fichier absent');
else {
  const t = fs.readFileSync(ex, 'utf8');
  /VAPID_PRIVATE_KEY=\s*$/m.test(t)
    ? ok('.env.example documente les variables, sans aucune valeur')
    : nok('.env.example ne porte aucune valeur', 'une variable y est renseignée');
}

// `.env` est bien ignoré par git
const gi = fs.readFileSync(path.join(R, '.gitignore'), 'utf8');
/^\.env$/m.test(gi) ? ok('`.env` est ignoré par git') : nok('`.env` est ignoré par git', 'absent du .gitignore');

console.log(ko ? `\n${ko} fuite(s) dans le code source.` : '\nAucun secret ni donnée personnelle dans le code source.');
process.exit(ko ? 1 : 0);
