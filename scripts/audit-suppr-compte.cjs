// ⚠️⚠️ SUPPRESSION CIBLÉE D'UN COMPTE — LE FILTRE QUI DÉCIDE CE QUI EST EFFACÉ.
//
// Julien, 3 octobre : « supprimer ce compte » devient une modale à cases
// (annonces / ventes / achats / messages / le compte), récupérable en
// reconnectant l'extension. C'est l'opération la plus DESTRUCTRICE de l'app :
// `familiesDeCompte(uid, id, scopes)` décide, ligne par ligne, si elle part.
//
// Deux dangers qu'on prouve ici :
//  1. LE GARDE DE PRÉFIXE EXACT. Le `_` de PostgREST `like` est un joker
//     1-caractère : `harvest_35_*` matcherait `harvest_352_*`. Si le filtre JS
//     ne borne pas sur le préfixe EXACT, supprimer les données du compte 35
//     effacerait AUSSI celles du 352 — une autre boutique. Irréversible sans
//     re-capture, et sur le MAUVAIS compte.
//  2. LE BON PÉRIMÈTRE PAR CASE. Décocher « ventes » ne doit pas emporter les
//     annonces, etc. Et une famille inconnue (diagnostic) ne part qu'avec
//     « tout le compte ».
//
// On extrait la VRAIE fonction d'App.jsx (pas une copie) et on la juge.

const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

// Extrait `const familiesDeCompte = (uid, id, scopes) => { … };` entièrement.
function extrait(nom) {
  const start = src.indexOf(`const ${nom} =`);
  if (start < 0) throw new Error(`${nom} introuvable`);
  // Fin : première ligne `};` au niveau 0 après le corps de la flèche.
  let i = src.indexOf('=>', start); i = src.indexOf('{', i);
  let prof = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return src.slice(start, j + 1); }
  }
  throw new Error(`fin de ${nom} introuvable`);
}

let familiesDeCompte;
try {
  // eslint-disable-next-line no-eval
  familiesDeCompte = eval('(' + extrait('familiesDeCompte').replace(/^const familiesDeCompte = /, '') + ')');
} catch (e) {
  console.log('❌ extraction de familiesDeCompte : ' + e.message);
  process.exit(1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const TOUT = { annonces: true, ventes: true, achats: true, messages: true, compte: true };
const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; console.log(`❌ ${nom} — a levé : ${e.message}`); } };

// ── 1. LE GARDE DE PRÉFIXE EXACT (le plus dangereux) ────────────────────────
essaie('garde de préfixe', () => {
  dit(familiesDeCompte('35', 'harvest_35_listings', TOUT) === true,
    'compte 35 : sa propre ligne part');
  dit(familiesDeCompte('35', 'harvest_352_listings', TOUT) === false,
    '⚠️ compte 35 n’emporte JAMAIS les lignes du 352 (joker _ de like)');
  dit(familiesDeCompte('35', 'harvest_352_orders_sold', TOUT) === false,
    'compte 35 n’emporte pas les ventes du 352');
  dit(familiesDeCompte('352', 'harvest_35_listings', TOUT) === false,
    'et réciproquement : 352 n’emporte pas le 35');
  dit(familiesDeCompte('35', 'coffre_352_1', TOUT) === false,
    'même garde sur le coffre');
});

// ── 2. LE BON PÉRIMÈTRE PAR CASE ────────────────────────────────────────────
const SEUL = (k) => ({ annonces: false, ventes: false, achats: false, messages: false, compte: false, [k]: true });
essaie('périmètre par case', () => {
  const u = '7';
  // Annonces
  dit(familiesDeCompte(u, 'harvest_7_listings', SEUL('annonces')) === true, 'annonces → listings');
  dit(familiesDeCompte(u, 'harvest_7_item_99', SEUL('annonces')) === true, 'annonces → item_*');
  dit(familiesDeCompte(u, 'coffre_7_42', SEUL('annonces')) === true, 'annonces → coffre');
  dit(familiesDeCompte(u, 'harvest_7_orders_sold', SEUL('annonces')) === false, 'annonces NE prend PAS les ventes');
  // Ventes (+ la compta en découle)
  dit(familiesDeCompte(u, 'harvest_7_orders_sold', SEUL('ventes')) === true, 'ventes → orders_sold');
  dit(familiesDeCompte(u, 'harvest_7_txn_123', SEUL('ventes')) === true, 'ventes → txn_*');
  dit(familiesDeCompte(u, 'harvest_7_label_latest', SEUL('ventes')) === true, 'ventes → bordereaux');
  dit(familiesDeCompte(u, 'harvest_7_billing', SEUL('ventes')) === true, 'ventes → porte-monnaie');
  dit(familiesDeCompte(u, 'harvest_7_orders_purchased', SEUL('ventes')) === false, 'ventes NE prend PAS les achats');
  // Achats
  dit(familiesDeCompte(u, 'harvest_7_orders_purchased', SEUL('achats')) === true, 'achats → orders_purchased');
  dit(familiesDeCompte(u, 'harvest_7_orders_sold', SEUL('achats')) === false, 'achats NE prend PAS les ventes');
  // Messages
  dit(familiesDeCompte(u, 'harvest_7_conv_8', SEUL('messages')) === true, 'messages → conv_*');
  dit(familiesDeCompte(u, 'harvest_7_listings', SEUL('messages')) === false, 'messages NE prend PAS les annonces');
  // Famille inconnue (diagnostic) : seulement avec « tout le compte »
  dit(familiesDeCompte(u, 'harvest_7_seen_urls', SEUL('annonces')) === false, 'seen_urls NE part PAS avec « annonces » seul');
  dit(familiesDeCompte(u, 'harvest_7_seen_urls', SEUL('compte')) === true, 'seen_urls part avec « le compte »');
});

// ── 3. RIEN DE COCHÉ ⇒ RIEN NE PART ─────────────────────────────────────────
essaie('rien coché', () => {
  const RIEN = { annonces: false, ventes: false, achats: false, messages: false, compte: false };
  dit(familiesDeCompte('7', 'harvest_7_listings', RIEN) === false, 'aucune case ⇒ aucune ligne (listings)');
  dit(familiesDeCompte('7', 'harvest_7_orders_sold', RIEN) === false, 'aucune case ⇒ aucune ligne (ventes)');
});

console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ suppression ciblée : le filtre efface le bon compte, et seulement lui');
process.exit(ko ? 1 : 0);
