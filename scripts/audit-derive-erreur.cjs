// ════════════════════════════════════════════════════════════════════════════
//  « UN SITE A CHANGÉ LE FORMAT DE SA RÉPONSE messages » — FAUSSE ALERTE
//  (20 octobre). Mesuré chez Julien : `forme_inconnue_champ_conversation` ×250,
//  échantillon `cles=[code,message,message_code]` — le corps d'une RÉPONSE
//  D'ERREUR de Vinted, jugé comme une conversation par les extensions < 5.193.
//  L'extension ne le fait plus, mais l'échantillon reste dans
//  `panel_diag_capture.rates` et Réglages → État des connexions l'affichait
//  encore 7 jours. On EXÉCUTE la règle de l'app (extraite d'App.jsx) et on
//  vérifie qu'elle est bien branchée sur l'alerte.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = require('./_source-app.cjs')(path.join(__dirname, '..', 'src', 'App.jsx'));
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };

const m1 = /const CLES_ERREUR_VINTED = [^\n]+\n/.exec(SRC);
const m2 = /function estCorpsErreurVinted\(cles\) \{[\s\S]*?\n\}\n/.exec(SRC);
if (!m1 || !m2) { dit(false, 'la règle « corps d\'erreur de Vinted » existe dans l\'app'); }
else {
  const ctx = {}; vm.createContext(ctx); vm.runInContext(m1[0] + m2[0] + 'this.f = estCorpsErreurVinted;', ctx);
  const f = ctx.f;
  dit(f(['code', 'message', 'message_code']) === true, 'l\'échantillon mesuré chez Julien (code, message, message_code) est un refus, pas une dérive');
  dit(f(['code', 'message', 'message_code', 'errors', 'payload']) === true, 'avec errors/payload aussi');
  dit(f(['id', 'transaction', 'messages_count', 'code']) === false, 'une vraie conversation sans `messages` reste une dérive (l\'alerte garde son sens)');
  dit(f(['code', 'message']) === false, 'sans `message_code`, on ne présume pas d\'un refus');
  dit(f([]) === false && f(undefined) === false, 'pas de clés : pas de jugement');
}
// Branchée là où l'alerte se calcule (pas seulement déclarée).
const bloc = /const recents = Object\.keys\(rates\)[\s\S]{0,900}?setDrift\(recents\)/.exec(SRC);
dit(!!bloc && /estCorpsErreurVinted\(x\.cles\)/.test(bloc[0]), 'l\'alerte « un site a changé le format » écarte ces échantillons');

console.log(`\n${ko ? '❌ ' + ko + ' rouge(s)' : '✅ tout vert'} · ${ok} contrôle(s)`);
process.exit(ko ? 1 : 0);
