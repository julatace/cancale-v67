// ⚠️ §4.5 — SUPABASE TRONQUE UNE RÉPONSE À 1000 LIGNES SANS LE DIRE.
//
// Un balayage de famille (`id=like.…`) sur une famille NON BORNÉE — une ligne
// par ANNONCE, par BORDEREAU, par ÉTIQUETTE, tous comptes confondus — dépasse
// 1000 lignes chez un vendeur actif. Lu par `sbGet` (un seul appel, sans en-tête
// `Range`), il repart alors AMPUTÉ, en silence : des paires sans photo dans la
// file de publication, des bordereaux « manquants » re-générés. `sbGetTout`
// pagine (et rend `null` si une page échoue — une demi-liste a l'air d'une
// réponse). Les familles BORNÉES (une ligne par compte : `*_listings`, par
// mois : `*_releve_*`) n'ont pas besoin de pagination et ne sont pas visées.
//
// Ce contrôle est posé sur la RÈGLE, pas sur l'orthographe : on NEUTRALISE
// d'abord les commentaires (sinon le texte « sbGet tronquait » d'un commentaire
// de correctif déclencherait — le cri au loup du balayage des sondes), puis on
// cherche un `sbGet(` (jamais `sbGetTout(`) dont la requête balaie une de ces
// familles.
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..');
const fichier = path.join(racine, 'vinted-sync-extension', 'background.js');
let src = fs.readFileSync(fichier, 'utf8');

// Neutralise les commentaires en GARDANT les retours à la ligne (les numéros
// signalés restent ceux du fichier) : blocs /* … */ d'abord, puis // … en fin
// de ligne. On ne touche pas aux `//` d'une URL (`https://`) car on n'enlève que
// ce qui suit un `//` NON précédé de « : ».
src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const lignes = src.split('\n').map((l) => l.replace(/([^:])\/\/.*$/, '$1').replace(/^\s*\/\/.*$/, ''));

// Les familles NON BORNÉES qu'un vendeur actif fait dépasser 1000 lignes.
const FAMILLES_NON_BORNEES = [
  { motif: '_item_', quoi: 'une ligne par annonce (détail/photos), tous comptes' },
  { motif: '_label_', quoi: 'une ligne par bordereau capté' },
  { motif: 'email_bord_', quoi: 'une ligne par email de bordereau' },
];

let ko = 0;
const fautes = [];
lignes.forEach((l, i) => {
  if (!/\bsbGet\(/.test(l)) return;               // sbGetTout ne matche pas \bsbGet\(
  if (!/id=like\./.test(l)) return;               // seuls les BALAYAGES de famille (pas id=eq. d'une ligne)
  for (const f of FAMILLES_NON_BORNEES) {
    if (l.includes(f.motif)) { fautes.push({ n: i + 1, motif: f.motif, quoi: f.quoi, code: l.trim().slice(0, 120) }); }
  }
});

if (fautes.length) {
  ko = 1;
  console.log('❌ §4.5 — balayage de famille non bornée lu SANS pagination (sbGet au lieu de sbGetTout) :');
  for (const f of fautes) console.log(`   L${f.n}  famille « ${f.motif} » (${f.quoi})\n      ${f.code}`);
} else {
  console.log('✅ §4.5 — toute famille non bornée (_item_, _label_, email_bord_) balayée en id=like passe par sbGetTout (paginé).');
}

// Garde-fou de l'audit lui-même : il DOIT voir les appels sbGetTout attendus,
// sinon il « passe » sur un fichier où quelqu'un aurait tout renommé/supprimé
// (un contrôle qui ne peut rien trouver est pire qu'absent).
const nbTout = (src.match(/\bsbGetTout\(/g) || []).length;
if (nbTout < 3) { ko = 1; console.log(`❌ garde-fou : seulement ${nbTout} appel(s) sbGetTout trouvés — l'audit ne mesure peut-être rien.`); }

process.exit(ko);
