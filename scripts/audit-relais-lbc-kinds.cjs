// ⚠️ CONTRÔLE PERMANENT — CE QUE LE CAPTEUR LEBONCOIN ENVOIE, LE RELAIS LE TRANSPORTE (31 oct.)
//
// `lbc-inject.js` (monde MAIN) poste ses captures à `lbc-relay.js`, qui les
// relaie au service worker KIND PAR KIND (c'est une frontière de sécurité : la
// page ne dicte pas l'action, chaque champ est borné). Le dossier le notait :
// « son relais énumère, complet aujourd'hui, mais c'est la même fragilité » —
// celle de `content.js` (5.80, les `reponses` mortes entre deux fichiers qui
// avaient tous les deux raison) et du pont (5.160, `id`/`etat` jamais arrivés).
// Un kind ajouté côté capteur et oublié côté relais meurt EN SILENCE.
//
// Ce contrôle EXÉCUTE le vrai relais dans un vm (faux window + faux chrome),
// lui poste un message de CHAQUE kind que le capteur sait envoyer (lu dans
// son code : `post({ kind: 'x' … })`, `posterDonneeMoi('x' …)`), et exige que
// chacun ressorte vers le fond. `--mutation=oubli` retire un kind du relais.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const INJ = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc-inject.js'), 'utf8');
let REL = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc-relay.js'), 'utf8');
if (MUT === 'oubli') REL = REL.replace("else if (d.kind === 'lbcstatsannonce'", "else if (d.kind === 'lbcstatsannonceX'");
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Les kinds que le capteur ENVOIE, lus dans son code (hors les signaux internes
// au relais : 'pret', 'actif' passent par CANCALE_LBC_CAPTEUR, pas CANCALE_LBC).
const kinds = new Set();
for (const m of INJ.matchAll(/post\(\{\s*kind\s*:\s*'([a-z]+)'/g)) kinds.add(m[1]);
for (const m of INJ.matchAll(/posterDonneeMoi\('([a-z]+)'/g)) kinds.add(m[1]);
// `lbcpauseresultat` répond à un ORDRE du fond (il ne part pas vers le fond par
// sendMessage : le relais rend la réponse à l'ordre en attente) — jugé à part.
const REPONSE = 'lbcpauseresultat';
dit(kinds.size >= 10, 'les kinds envoyés par le capteur sont lus dans son code', [...kinds].sort().join(', '));

// Un message plausible, à la forme que le capteur envoie (les gardes du relais
// exigent ces champs).
const exemple = {
  lbcraw: { url: 'https://api.leboncoin.fr/x', body: '{}' },
  lbcvente: { url: 'https://api.leboncoin.fr/x', body: '{}', __vrmSequence: 7 },
  lbccatalogue: { url: 'u', body: '{}' },
  lbcenvoi: { url: 'u', methode: 'POST', cles: ['a'] },
  lbcpaths: { paths: ['GET a → 200 [json]'] },
  lbcschema: { endpoint: 'e', cles: ['a'] },
  lbcmsgcompteur: { userId: 'abc', unread: 2 },
  lbclistecomplete: { owner: 'o', ids: ['1'], total: 1 },
  lbcretraitvu: { quoi: 'supprime', ids: ['1'], statut: 200 },
  lbcstatsannonce: { id: '1234567', favoris: 1, messages: 0, vues: 3 },
  lbccomptes: { comptes: [{ id: '1', name: 'x', pro: false }] },
  lbcsessionprivee: { url: 'u', preuve: { a: 1 } },
  lbcblocage: { famille: 'transactions', raison: 'taille' },
};

let ecoute = null; const envois = [];
const ctx = {
  console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, TextEncoder, JSON,
  crypto: { randomUUID: () => 'j' }, location: { href: 'https://www.leboncoin.fr/mes-annonces' },
  window: null,
  chrome: { runtime: { id: 'ext', lastError: null, sendMessage: (m, cb) => { envois.push(m); if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener() {} } } },
};
ctx.window = { addEventListener: (t, f) => { if (t === 'message') ecoute = f; }, postMessage() {}, top: null };
ctx.window.top = ctx.window; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
try { vm.runInContext(REL, ctx, { filename: 'lbc-relay.js' }); } catch (e) { dit(false, 'le relais se charge', e.message); }
dit(typeof ecoute === 'function', 'le relais écoute les messages de la page');

(async () => {
  for (const k of [...kinds].sort()) {
    if (k === REPONSE) continue;
    if (!exemple[k]) { dit(false, `kind « ${k} » : un exemple de message existe dans ce contrôle`, 'ajoute-le à `exemple` (et vérifie que le relais le transporte)'); continue; }
    const avant = envois.length;
    try { ecoute({ source: ctx.window, data: { __tag: 'CANCALE_LBC', kind: k, ...exemple[k] } }); } catch (e) { dit(false, `kind « ${k} »`, e.message); continue; }
    await new Promise((r) => setTimeout(r, 5));
    const parti = envois.slice(avant);
    dit(parti.length > 0 && parti.every((m) => m && m.from === 'cancale-lbc'), `kind « ${k} » envoyé par le capteur ⇒ relayé au fond`,
      parti.length ? parti.map((m) => m.action).join(',') : 'MORT dans le relais — le fond ne le reçoit jamais');
  }
  // Et l'autre sens : la page ne dicte pas l'action (un kind inconnu ne part pas).
  const avant = envois.length;
  ecoute({ source: ctx.window, data: { __tag: 'CANCALE_LBC', kind: 'inventeparlapage', action: 'lbcPublier' } });
  await new Promise((r) => setTimeout(r, 5));
  dit(envois.length === avant, 'un kind inconnu de la page ne part pas au fond', envois.slice(avant).map((m) => m.action).join(','));
  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nChaque capture du capteur Leboncoin arrive au fond.');
  process.exit(ko ? 1 : 0);
})();
