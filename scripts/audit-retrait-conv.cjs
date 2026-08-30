// ⚠️ CONTRÔLE PERMANENT — LE CODE DE RETRAIT VINTED GO VIENT DE LA CONVERSATION.
// Capture d'écran de Julien (27 août) : dans le fil Vinted, « Ton colis est
// arrivé ! Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent,
// 56000 Vannes, France. Scanne ton code de retrait ou saisis le code C65735
// pour le récupérer. » Aucun email transporteur ne porte ça.
//
// Ce script exécute le VRAI `retraitDeConversation()` du service worker dans un
// `vm`, sur :
//   · le message RÉELLEMENT relevé en base (Mondial Relay, adresse sans code) ;
//   · la forme de la capture d'écran (Vinted Go, adresse + code C65735) ;
//   · ce qui ne doit JAMAIS devenir un colis à retirer (un colis qui PART, un
//     fil côté vendeur, un texte sans adresse ni code).
// Et il vérifie que `codeRetrait` (src/App.jsx) accepte un code à lettre —
// c'est la règle de §5.37 qui l'aurait rejeté.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

const ctx = {
  console: { log() {}, warn() {}, error() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
  btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
  chrome: {
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
    downloads: { onCreated: { addListener() {} } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
    storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
  },
  fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } }),
};
ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });

const conv = (msgs, side = 'buyer', extra = {}) => ({ conversation: {
  id: 22488948907, conversation_url: 'https://www.vinted.fr/inbox/22488948907',
  transaction: Object.assign({ id: 19746253045, item_id: 8886625895, item_title: 'Adidas 37,5', current_user_side: side }, extra),
  messages: msgs,
} });
const act = (title, subtitle) => ({ entity_type: 'action_message', entity: { title, subtitle } });

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// 1. LE MESSAGE RÉELLEMENT EN BASE (Mondial Relay) : adresse, pas de code.
{
  const r = ctx.retraitDeConversation(conv([act('Ta commande est arrivée. ',
    'Ton colis a été livré dans le Point Relais MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE. Tu peux, dès maintenant, aller le récupérer.')]));
  dit(!!r && /MAISON DE LA PRESSE/.test(r.lieu) && /35260 CANCALE/.test(r.lieu) && r.code === '' && r.tx === '19746253045',
    'message réel en base → adresse du relais, aucun code inventé', r ? `${r.lieu} | code «${r.code}»` : 'null');
}
// 2. LA CAPTURE D'ÉCRAN VINTED GO : adresse + code à LETTRE.
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !',
    "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France. <a href=\"/x\">Scanne ton code de retrait</a> ou saisis le code C65735 pour le récupérer.")]));
  dit(!!r && r.code === 'C65735' && /Kusmi Tea/.test(r.lieu) && /56000 Vannes/.test(r.lieu),
    'Vinted Go → code C65735 + adresse, malgré le HTML', r ? `${r.lieu} | ${r.code}` : 'null');
}
// 3. UN COLIS QUI PART N'EST PAS UN COLIS À RETIRER.
{
  const r = ctx.retraitDeConversation(conv([act('Article à emballer et envoyer (avant le 03 sept. 10:00)',
    'Imprime le bordereau d\'envoi et colle-le sur l\'emballage. Dépose ensuite ton colis dans n\'importe quel <a href="/">point relais</a> Mondial Relay.')]));
  dit(r === null, 'un colis à EXPÉDIER ne devient jamais un colis à retirer', r ? JSON.stringify(r) : 'null');
}
// 4. CÔTÉ VENDEUR : « la commande est arrivée » veut dire que l'ACHETEUR l'a reçue.
{
  const r = ctx.retraitDeConversation(conv([act('Ta commande est arrivée. ',
    'Ton colis a été livré dans le Point Relais MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE.')], 'seller'));
  dit(r === null, 'fil côté VENDEUR → aucun colis à retirer', r ? JSON.stringify(r) : 'null');
}
// 5. NI ADRESSE NI CODE → on n'invente rien.
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !', 'Tu peux aller le récupérer.')]));
  dit(r === null, "ni adresse ni code → rien plutôt qu'une carte vide", r ? JSON.stringify(r) : 'null');
}
// 6. LE MOT « suivant » N'EST PAS UN CODE (le défaut de §5.37).
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !',
    "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes. Saisis le code suivant pour le récupérer.")]));
  dit(!!r && r.code === '', "« saisis le code suivant » ne fabrique aucun code", r ? `code «${r.code}»` : 'null');
}
// 7. LE DERNIER MESSAGE L'EMPORTE (un rappel réécrit l'ancien).
{
  const r = ctx.retraitDeConversation(conv([
    act('Ton colis est arrivé !', "Il t'attend à l'adresse suivante : Vieux Relais, 1 Rue A, 35000 Rennes. Saisis le code 111111 pour le récupérer."),
    act('Ton colis est arrivé !', "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes. Saisis le code C65735 pour le récupérer."),
  ]));
  dit(!!r && r.code === 'C65735' && /Kusmi/.test(r.lieu), 'un rappel plus récent remplace le précédent', r ? `${r.code}` : 'null');
}
// 8. L'APP AFFICHE BIEN UN CODE À LETTRE (règle `codeRetrait`).
{
  const app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const codeRetrait = \(v\) => \{[^\n]*\n?/);
  const ligne = m ? m[0] : '';
  const re = ligne.match(/\/\^([^/]+)\/\.test/);
  let ok = false;
  if (re) { const r = new RegExp('^' + re[1] + '$'); ok = r.test('C65735') && r.test('077831') && !r.test('suivant'); }
  dit(ok, 'src/App.jsx : `codeRetrait` accepte C65735, refuse « suivant »', ligne.trim().slice(0, 90));
}
// 9. LE LIEN DU QR EST CAPTÉ (« Scanne ton code de retrait » est un <a href>).
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !',
    "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes. <a href=\"https://www.vinted.fr/pickup/abc123\">Scanne ton code de retrait</a> ou saisis le code C65735 pour le récupérer.")]));
  dit(!!r && r.qr === 'https://www.vinted.fr/pickup/abc123', 'le lien du QR est capté', r ? (r.qr || '(aucun)') : 'null');
}
// 10. ⚠️ UN LIEN QUI NE MÈNE NULLE PART N'EST PAS UN LIEN.
//     Dans les messages réellement captés, la plupart des ancres valent href="/"
//     (Vinted les recâble côté client). Ouvrir la page d'accueil au lieu du QR
//     serait pire que de ne pas proposer de bouton.
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !',
    "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes. <a href=\"/\">Scanne ton code de retrait</a> ou saisis le code C65735 pour le récupérer.")]));
  dit(!!r && !r.qr, 'href="/" → aucun lien de QR proposé', r ? (r.qr || '(aucun)') : 'null');
}
// 11. UN LIEN RELATIF EST REMIS SUR VINTED.
{
  const r = ctx.retraitDeConversation(conv([act('Ton colis est arrivé !',
    "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent. <a href=\"/pickup/xyz\">Scanne ton code de retrait</a>")]));
  dit(!!r && r.qr === 'https://www.vinted.fr/pickup/xyz', 'lien relatif → URL complète', r ? (r.qr || '(aucun)') : 'null');
}
// 12. ⚠️ LE GESTE À FAIRE SUR PLACE DÉRIVE DE `retraitMode`, PAS D'UNE 2ᵉ RÈGLE.
//     Deux règles pour « comment on retire ici », c'est la garantie que l'écran
//     et la modale finissent par ne plus dire la même chose (§11, §28).
{
  const app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
  const i = app.indexOf('const methodeDuPoint');
  const corps = i < 0 ? '' : app.slice(i, i + 1200);
  dit(i > 0 && /retraitMode\(/.test(corps), '`methodeDuPoint` dérive de `retraitMode`', i < 0 ? 'fonction absente' : 'ok');
  // Et le lieu/geste ne sont plus répétés sur CHAQUE ligne de colis.
  dit(!/Donne ce code au comptoir 👉/.test(app), 'le geste n\'est plus répété sur chaque ligne de colis');
}
console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent');
process.exit(ko ? 1 : 0);
