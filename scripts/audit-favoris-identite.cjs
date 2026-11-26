#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS : L'IDENTITÉ DU FAVORI (5.440.1, 23 nov., production)
//
//  Julien, 23 nov. 19:44, extension 5.440.0 : « Envoi interrompu · 0 envoyés · 1 sauté · 2 non envoyés », la ligne
//  « Pas envoyé · Conversation pas vérifiée — rien n'est parti », et au panneau « … pour plusieurs favoris de suite … puis
//  touche « » (coupé). MESURÉ dans la vraie base (lecture seule) : l'accusé du serveur `identite_non_confirmee`, étape
//  `conversation`, SANS cause ; le compteur `favori_lien_autre` ; et les notifications de favori de son compte portent
//  depuis le 23 nov. 09:05 un lien d'APPLICATION `vintedfr://messaging?item_id=N&user_id=N&portal=fr` — la 5.440 refusait
//  ce lien avant tout clic. On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) et la vraie file du serveur :
//   I1  le lien d'application aux DEUX identités du favori ⇒ la page ouvre la conversation, le message part ;
//   I2  le lien d'application d'une AUTRE personne / d'un AUTRE article / avec une clé de plus ⇒ rien ne part, cause nommée ;
//   C1  la nouvelle messagerie sans `data.items`, avec `data.escrow_order_id` (forme MESURÉE le 23 nov.) : la commande relue
//       (GET seulement) dont conversation, n°, acheteur, côté vendeur et article concordent ⇒ le message part ;
//   C2–C8 chaque désaccord (autre acheteur, autre article, autre conversation, autre n°, côté acheteur, sans articles,
//       forme d'article inconnue — sa FORME notée, jamais une valeur) ⇒ rien n'est tapé ;
//   R1  UN refus d'identité ⇒ ce favori n'est pas parti, la file CONTINUE, la phrase le nomme (jamais « plusieurs de suite ») ;
//   R2  trois de suite ⇒ pause, phrase ENTIÈRE terminée par « Reprendre » ; un nouvel envoi ou « Reprendre » repart de zéro ;
//   R3  le bilan dit « pas envoyé » (un mot par état).
//  `--bg <background.js>` : une autre copie ; `--mutation=nom` ; `--prouve`. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argBg = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : ''; })();
let BG = argBg ? path.resolve(argBg) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
let FILE = path.join(RACINE, 'api', '_lib', 'favoris-file.js');
const MUTATIONS = {
  // Le lien d'application n'est plus reconnu (la 5.440.0).
  'sans-lien-app': ['  const profond=lienBrut?lienFavoriProfond(lienBrut):null;', '  const profond=null;'],
  // Le lien d'application accepté sans comparer la personne.
  'lien-sans-personne': ['if(profond.itemId!==body.itemId||profond.userId!==body.recipientId)', 'if(profond.itemId!==body.itemId)'],
  // L'acheteur de la commande n'est plus comparé.
  'commande-sans-acheteur': ["if(!acheteur||!attendu||acheteur!==String(attendu.recipientId))return non('commande_autre_acheteur');", ''],
  // L'uuid de la conversation n'est plus comparé à celui de la commande.
  'commande-sans-conversation': ["if(typeof e.conversation_id!=='string'||e.conversation_id!==String(uuid))return non('commande_autre_conversation');", ''],
  // Le côté vendeur n'est plus exigé.
  'commande-sans-cote': ["if(String(e.current_user_side||'')!=='seller')return non('commande_pas_vendeur');", ''],
  // L'article n'est plus comparé.
  'commande-sans-article': ["if(lus[0].id!==String(attendu.itemId))return non('commande_autre_article');", ''],
  // Une forme d'article inconnue est acceptée (n'importe quel nombre trouvé).
  'commande-forme-libre': ["const inc=lus.find((x)=>!x.id);if(inc)return non('commande_article_forme',inc.forme);", "const inc=null;"],
  // La commande n'est plus relue : sans `data.items`, rien ne part (la 5.440.0).
  'sans-commande': ["let cmd=null;const idCmd=ln.ok?idCommandeConv(ln.json):'';", "let cmd=null;const idCmd='';"],
};
const MUT_FILE = {
  // Les refus d'un ancien envoi comptent encore « de suite » dans le nouveau (la 5.440.0).
  'compteur-garde': ["d.groupes[owner]={...g,refusLocaux:0,refusTexte:0,", "d.groupes[owner]={...g,"],
};
const argMut = (() => { const a = process.argv.find((x) => x.startsWith('--mutation=')); return a ? a.slice(11) : ''; })();
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of [...Object.keys(MUTATIONS), ...Object.keys(MUT_FILE)]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ [ICR]\d/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge : ' + String(r.stdout || r.stderr || '').split('\n').slice(-3).join(' ')}`);
    if (!rouge) rate++;
  }
  console.log(rate ? `\n❌ ${rate} mutation(s) pas rouge(s)` : '\n✅ toutes les mutations sont rouges');
  process.exit(rate ? 1 : 0);
}
if (argMut && MUT_FILE[argMut]) {
  const s0 = fs.readFileSync(FILE, 'utf8'), M = MUT_FILE[argMut];
  if (!s0.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  const dest = path.join(path.dirname(FILE), `.favoris-file-mut-${process.pid}.js`);
  fs.writeFileSync(dest, s0.split(M[0]).join(M[1])); FILE = dest;
  process.on('exit', () => { try { fs.unlinkSync(dest); } catch (_) {} });
} else if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  BG = path.join(os.tmpdir(), `bg-favoris-identite-${argMut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };

const UID = '111', JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', UUID = '01a1fdff-71a1-4c2b-9d3e-0123456789ab', CMD = '9001';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
// `o.lien` : le lien de la notification ; `o.nouvelle` : la conversation de la nouvelle messagerie (uuid) et sa commande.
function monter(o = {}) {
  const conv = { id: 301, opposite_user: { id: 201, login: 'pseudo_banc' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } } };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store: { __commeBleamDefaut: true },
    vinted: (e) => {
      if (e.methode === 'GET' && /\/inbox-notifications\/v1\/notifications$/.test(e.chemin)) return { status: 200, body: { notifications: [{ id: 'n-banc', entry_type: 20, ...(o.lien ? { link: o.lien } : {}) }] } };
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      // La nouvelle messagerie : l'ancienne relecture refusée, la nouvelle lue, puis LA commande.
      if (o.nouvelle && e.methode === 'GET' && /^\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 404, body: {} };
      if (o.nouvelle && e.methode === 'GET' && e.chemin === `/messaging/main/conversations/${UUID}`) return { status: 200, body: o.nouvelle.conv };
      if (o.nouvelle && e.methode === 'GET' && e.chemin === `/escrow-orders/api/v2/escrow-orders/${CMD}`) return o.nouvelle.cmd === null ? { status: 404, body: {} } : { status: 200, body: o.nouvelle.cmd };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' }, photos: [{ id: 1, is_suspicious: false }] } } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(op.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, message: 'Bonjour !', offre: { mode: 'pct', valeur: 10, arrondi: false } } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, op);
  };
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPage = {};
  f.gestes = [];
  // La page : la conversation de la nouvelle messagerie est montrée sur /inbox/{uuid} (aucune création : elle existait déjà).
  const bg = f.ctx.interfaceVinted;
  f.ctx.interfaceVinted = async (acc, geste, d, op) => {
    f.gestes.push({ geste, lien: d && d.lien });
    if (o.nouvelle && geste === 'favoriOuvrir') return { viaPage: true, interface: true, geste, status: 200, ok: true, json: null, sansRequete: true, vu: false, conv: '301', route: UUID, envoye: false };
    // 5.453 (`favorishumains`) : l'étape « taper » (le texte dans le champ, rien n'est envoyé) précède « Envoyer ».
    if (o.nouvelle && geste === 'message' && d && d.taper === true) return { viaPage: true, interface: true, geste, status: 200, ok: true, json: null, sansRequete: true, tape: true, vu: true, envoye: false };
    if (o.nouvelle && (geste === 'message' || geste === 'offre')) { f.gestes[f.gestes.length - 1].tape = true; return { viaPage: true, interface: true, geste, status: 200, ok: true, json: { code: 0 }, vu: true }; }
    return bg(acc, geste, d, op);
  };
  return f;
}
const ecrits = (f) => f.j.vinted.filter((v) => v.methode !== 'GET').length + f.gestes.filter((g) => g.tape).length;
const jouer = (f) => f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.stack || e) }));
const court = (r) => JSON.stringify(r && (r.json || r.erreur)).slice(0, 260);
// La conversation de la nouvelle messagerie MESURÉE le 23 nov. : `data.order_id`, `data.escrow_order_id` (textes), aucun `data.items`.
const convNouvelle = (x = {}) => ({ id: UUID, core_id_deprecated: 301, conversation_type: 'order', allow_reply: true, opposite_users: [{ id: x.opp || 201 }], data: { order_id: 'o-1', escrow_order_id: x.cmdConv || CMD }, messages: [] });
const commande = (x = {}) => ({ code: 0, escrow_order: Object.assign({ id: Number(CMD), items: [{ item_id: 101 }], buyer_id: 201, buyer: { id: 201 }, conversation_id: UUID, current_user_side: 'seller' }, x) });

(async () => {
  // ── I : le lien d'application de la cloche ───────────────────────────────────────────────────────────────────────────
  { const f = monter({ lien: 'vintedfr://messaging?item_id=101&user_id=201&portal=fr' }); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'envoye' && f.gestes.some((g) => g.geste === 'favoriOuvrir' && g.lien === ''), 'I1 lien d’application aux deux identités du favori ⇒ la page cherche la ligne par ces identités, le message part', court(r) + ' ' + JSON.stringify(f.gestes)); }
  for (const [nom, lien] of [['une autre personne', 'vintedfr://messaging?item_id=101&user_id=999&portal=fr'], ['un autre article', 'vintedfr://messaging?item_id=102&user_id=201&portal=fr'], ['une clé de plus', 'vintedfr://messaging?item_id=101&user_id=201&portal=fr&x=1'], ['une personne en double', 'vintedfr://messaging?item_id=101&user_id=201&user_id=999']]) {
    const f = monter({ lien }); const r = await jouer(f); const j = (r && r.json) || {};
    dit(j.resultat === 'refuse' && j.raison === 'identite_non_confirmee' && j.cause === 'lien_autre' && j.ecrits === 0 && ecrits(f) === 0 && !f.gestes.some((g) => g.geste === 'favoriOuvrir'), `I2 lien d’application avec ${nom} ⇒ rien n’est cliqué ni écrit, cause « lien_autre »`, court(r));
  }

  // ── C : la nouvelle messagerie sans `data.items` — l'identité par LA commande ─────────────────────────────────────────
  { const f = monter({ nouvelle: { conv: convNouvelle(), cmd: commande() } }); const r = await jouer(f);
    const lectures = f.j.vinted.map((v) => v.methode + ' ' + v.chemin);
    dit(r && r.json && r.json.resultat === 'envoye' && f.gestes.some((g) => g.tape), 'C1 conversation + commande concordantes (uuid, n°, acheteur, vendeur, article) ⇒ le message part', court(r) + ' ' + lectures.join(' | '));
    dit(lectures.includes(`GET /escrow-orders/api/v2/escrow-orders/${CMD}`) && f.j.vinted.every((v) => v.methode === 'GET'), 'C1 la commande est RELUE (GET), aucune écriture fabriquée par VRM', lectures.join(' | '));
    dit(f.j.diags.includes('favori_commande_ok'), 'C1 le diagnostic dit « commande ok »', f.j.diags.filter((d) => /commande/.test(d)).join()); }
  const casC = [
    ['C2', 'un autre acheteur', { conv: convNouvelle(), cmd: commande({ buyer_id: 999 }) }, 'commande_autre_acheteur'],
    ['C3', 'un autre article', { conv: convNouvelle(), cmd: commande({ items: [{ item_id: 102 }] }) }, 'commande_autre_article'],
    ['C4', 'une autre conversation', { conv: convNouvelle(), cmd: commande({ conversation_id: '99999999-71a1-4c2b-9d3e-0123456789ab' }) }, 'commande_autre_conversation'],
    ['C5', 'un autre n° de commande', { conv: convNouvelle({ cmdConv: '9002' }), cmd: commande() }, null],
    ['C6', 'le côté acheteur', { conv: convNouvelle(), cmd: commande({ current_user_side: 'buyer' }) }, 'commande_pas_vendeur'],
    ['C7', 'aucun article', { conv: convNouvelle(), cmd: commande({ items: [] }) }, 'commande_sans_article'],
    ['C8', 'une forme d’article inconnue', { conv: convNouvelle(), cmd: commande({ items: [{ produit: { ref: 101 } }] }) }, 'commande_article_forme'],
    ['C9', 'une personne en face qui n’est pas l’acheteur', { conv: convNouvelle({ opp: 777 }), cmd: commande() }, 'commande_autre_personne'],
    ['C10', 'deux articles', { conv: convNouvelle(), cmd: commande({ items: [{ item_id: 101 }, { item_id: 103 }] }) }, 'commande_plusieurs_articles'],
    ['C11', 'la commande illisible', { conv: convNouvelle(), cmd: null }, null],
  ];
  for (const [k, nom, nouvelle, diag] of casC) {
    const f = monter({ nouvelle }); const r = await jouer(f); const j = (r && r.json) || {};
    dit(j.resultat === 'refuse' && j.raison === 'identite_non_confirmee' && !f.gestes.some((g) => g.tape) && f.j.vinted.every((v) => v.methode === 'GET'), `${k} ${nom} ⇒ refusé, rien n’est tapé`, court(r) + ' ' + JSON.stringify(f.gestes));
    if (diag) dit(f.j.diags.includes('favori_commande_' + diag), `${k} le diagnostic nomme la cause (« ${diag} »)`, f.j.diags.filter((d) => /commande|forme/.test(d)).join());
  }
  { const f = monter({ nouvelle: { conv: convNouvelle(), cmd: commande({ items: [{ produit: { ref: 101 }, prix: 5 }] }) } }); await jouer(f);
    const forme = f.j.diags.find((d) => /^favori_forme_commande_commande_article_forme:/.test(d)) || '';
    dit(/produit:o/.test(forme) && /prix:n/.test(forme) && !/101|5\b/.test(forme.split(':').slice(1).join(':').replace(/[a-z_]+:[a-z]/g, '')), 'C8 la FORME de l’article inconnu est notée (clés et types), jamais une valeur', forme); }

  // ── R : la vraie file du serveur ─────────────────────────────────────────────────────────────────────────────────────
  const F = await import(pathToFileURL(FILE).href);
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  let now = Date.now(), d = null, n = 0;
  const maj = (x) => { if (x.data) d = x.data; return x.valeur; };
  const lancer = (lot, nb = 3) => maj(F.lancerFile(d, { owner: 'o', targets: Array.from({ length: nb }, (_, i) => ({ itemId: String(lot.length * 1000 + 101 + i), recipientId: String(lot.length * 1000 + 201 + i + n * 7), notificationId: lot + '-' + i, initiator: 'favourite' })), message: 'Bonjour', intervalleMinutes: 0, maintenant: now, lot }));
  const un = (brut) => {
    now += 60000; const jeton = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const res = maj(F.reserverFile(d, { owner: 'o', maintenant: now, jeton, suivi: 's' })); if (!res || !res.travail) return null;
    maj(F.consommerFile(d, { owner: 'o', jeton, maintenant: now })); maj(F.verifierReservation(d, { owner: 'o', jeton, maintenant: now }));
    const t = P.traduireResultatFavori(brut);
    return maj(F.terminerFile(d, { owner: 'o', jeton, resultat: t.resultat, raison: t.raison, maintenant: now + 1000, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, etape: t.etape || null, cause: t.cause || null }));
  };
  const idt = { ok: false, data: { resultat: 'refuse', raison: 'identite_non_confirmee', ecrits: 0, etape: 'conversation', cause: 'lien_autre' } };
  const el = { ok: false, data: { resultat: 'refuse', raison: 'element_introuvable', ecrits: 0, etape: 'conversation', cause: 'element_absent:cloche' } };
  const attente = (v) => (v.jobs || []).filter((j) => j.etat === 'attente').length;
  // Le cas de Julien : un ANCIEN envoi a laissé deux refus locaux (cloche introuvable, 5.438) ; un nouvel envoi, UN refus d'identité.
  lancer('ancien', 3); un(el); un(el);
  maj(F.annulerFile ? F.annulerFile(d, { owner: 'o', maintenant: now }) : { data: d });
  if (d.groupes.o.active) { d.groupes.o.active = false; for (const j of d.groupes.o.jobs) if (j.etat === 'attente') j.etat = 'annule'; }
  lancer('nouveau', 3);
  const v1 = un(idt);
  dit(v1 && v1.active === true && attente(v1) === 2, 'R1 UN refus d’identité (après un ancien envoi à 2 refus) ⇒ ce favori n’est pas parti, la file CONTINUE (2 en attente)', JSON.stringify(v1 && { a: v1.active, n: attente(v1), r: v1.raison }));
  dit(v1 && !/plusieurs|de suite/.test(v1.raison) && /article ou destinataire pas confirmé/.test(v1.raison) && v1.raisonCode === 'local_saute' && v1.raisonRefus === 'identite_non_confirmee', 'R1 la phrase nomme CE refus (« article ou destinataire pas confirmé »), jamais « plusieurs de suite » ; son code est rendu', JSON.stringify(v1 && { r: v1.raison, c: v1.raisonCode, x: v1.raisonRefus }));
  const v2 = un(idt), v3 = un(idt);
  dit(v3 && v3.active === false && v3.raisonCode === 'locaux_suite' && v3.raisonN === 3 && /^3 favoris de suite/.test(v3.raison) && /« Reprendre »\.$/.test(v3.raison), 'R2 trois de suite ⇒ pause ; la phrase dit « 3 favoris de suite » et finit ENTIÈRE par « Reprendre »', JSON.stringify(v3 && { a: v3.active, r: v3.raison, n: v3.raisonN }));
  void v2;
  const b = P.phraseBilanFavoris((v3 && v3.bilan) || null);
  dit(/3 pas envoyés : article ou destinataire pas confirmé/.test(b) && !/refusé/.test(b), 'R3 le bilan : « 3 pas envoyés : article ou destinataire pas confirmé » (un mot par état, plus « refusé »)', b);

  console.log(`\n${ko ? '❌' : '✅'} identité des favoris : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
