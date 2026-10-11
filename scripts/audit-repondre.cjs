// ════════════════════════════════════════════════════════════════════════════
//  « Je veux également que tu puisses répondre à ma place aux messages Vinted »
//  — Julien, 18 septembre, puis, mis devant le risque : « Tout, elle répond à
//  tout ». C'est SA décision, elle n'est pas à re-négocier. Ce banc est là pour
//  que ce qui part en son nom soit juste.
//
//  ⚠️⚠️ CE QUE LA MESURE A DÉMENTI AVANT D'ÉCRIRE UNE LIGNE (19 septembre, sur
//  ses 32 conversations NON LUES) : **deux** sont des échanges où c'est LUI
//  l'acheteur — « Trainers are in post, thanks for buying », « juste pour vous
//  dire que j'envoie demain, le colis est prêt ». Or `api/ai` répond en VENDEUR
//  (« on te donne le message d'un ACHETEUR ») : sur ces deux-là elle aurait
//  envoyé, EN SON NOM, une réponse à côté de la plaque à quelqu'un qui lui
//  expédie un colis. « conversation non lue = acheteur qui demande » est une
//  RESSEMBLANCE (§5) et elle se trompait 2 fois sur 5.
//  ⇒ L'identité est l'ARTICLE : `transaction.item_id` ∈ ses annonces captées.
//
//  ⚠️ §4.10 : `node --check` ne voit rien de tout ça. On EXÉCUTE le vrai
//  `background.js` dans un `vm`, et on compte ce qui PART chez Vinted.
//  ⚠️ Et on vérifie L'AUTRE SENS : *ne rien envoyer du tout* passerait tous les
//  contrôles « rien ne part ». Le cas normal doit envoyer, et le noter.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const { metaVersData } = require('./bancs/_meta.cjs');
const racine = path.join(__dirname, '..');
// `--src chemin` : lancer l'audit sur une autre version de background.js (le code
// d'avant, ou une copie RÉAFFAIBLIE) — c'est comme ça qu'on prouve qu'il mord (§6.1).
const iSrc = process.argv.indexOf('--src');
const src = fs.readFileSync(iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); }
};
// ⚠️ HUITIÈME FOIS QU'UN AUDIT MEURT AU LIEU DE RAPPORTER : sur le code d'avant
//    une fonction peut ne pas exister. Ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '3171228253';
const MON_ITEM = '9944967551';        // une de SES annonces (mesurée)
const ITEM_DUN_AUTRE = '9789710639';  // l'annonce du vendeur QUI LUI expédie

// Une conversation captée, à la forme EXACTE de sa base (§6.3) :
// data.payload.conversation{ messages[{entity_type,entity{id,user_id,body}}],
// opposite_user{id,login}, transaction{item_id,...}, allow_reply, description }.
const convRow = ({ cid, msgId, body, itemId, allowReply = true, login = 'un_acheteur', desc = 'salomon XT-6 marron taille 43,5' }) => ({
  data: { uid: UID, payload: { conversation: {
    id: Number(cid), description: desc, allow_reply: allowReply,
    opposite_user: { id: 42, login },
    transaction: { id: 1, item_id: Number(itemId), status: 1 },
    messages: msgId == null ? [] : [{ entity_type: 'message', entity: { id: Number(msgId), user_id: 42, body } }],
  } } },
});

function faireCtx({ lignes = {}, ia = null, gardeStop = null } = {}) {
  const store = {};
  const journal = { replies: [], ecrits: [], ia: 0, gardeCalls: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)),
    clearTimeout, setInterval: () => 0, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: '5.77.0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: function (k, cb) {
          const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {}));
          const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c];
          if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out);
        },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      } },
    },
    fetch: async (url, opts = {}) => {
      const u = metaVersData(String(url));
      const rep = (body, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(u)) {
        // Une écriture Supabase : on la NOTE, c'est elle qui garde ce qui est parti.
        try { journal.ecrits.push(JSON.parse(opts.body || '[]')); } catch (_) {}
        return rep('[]', 201);
      }
      const m = /app_data\?id=(?:eq|like)\.([^&]+)/.exec(u);
      if (m) {
        const cle = decodeURIComponent(m[1]).replace(/\*$/, '');
        const exact = /id=eq\./.test(u);
        const sortie = [];
        for (const k of Object.keys(lignes)) {
          if (lignes[k] === undefined) continue;
          if (exact ? k === cle : (k === cle || k.startsWith(cle))) sortie.push(Object.assign({ id: k }, lignes[k]));
        }
        if (lignes.__ko && lignes.__ko.some((f) => u.includes(f))) return rep('<html>522</html>', 522);
        return rep(JSON.stringify(sortie));
      }
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  // Les portes du monde extérieur, remplacées pour COMPTER.
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'julatace3535', domain: 'fr' }];
  // ⚠️ On COMPTE les appels à `garde` : `garde`→`compterAction` consomme un
  //    créneau du budget 20/h à chaque appel. Un appel de `garde` sans envoi =
  //    un créneau de l'heure brûlé pour rien. Le correctif ne l'appelle plus
  //    qu'au moment d'un envoi réel.
  ctx.garde = async () => { journal.gardeCalls++; return gardeStop; };
  ctx.logActivity = async () => {};
  ctx.aiReply = async (message, article, price) => { journal.ia++; return ia ? ia(message, article, price) : { ok: true, intent: 'question', confidence: 90, suggestions: [{ tone: 'court', text: 'Oui, toujours dispo !' }] }; };
  ctx.vintedSend = async (acc, method, endpoint, body) => {
    journal.replies.push({ endpoint, body });
    return { ok: true, status: 200 };
  };
  ctx.__journal = journal; ctx.__store = store;
  return ctx;
}

// La lecture Supabase qui répond 522 sur CERTAINES lignes seulement : c'est le
// cas dangereux (lecture KO, écriture OK), pas la panne totale.
const base = (extra) => Object.assign({
  main: { vinted_repond_auto: true },
  [`harvest_${UID}_listings`]: { data: { payload: { items: [{ id: Number(MON_ITEM) }] } } },
  panel_msg_repondus: undefined,
}, extra);

const inbox = (convs) => ({ [`harvest_${UID}_inbox`]: { data: { payload: { conversations: convs } } } });
const nonLue = (cid, desc) => ({ id: Number(cid), unread: true, description: desc || 'salomon XT-6 marron taille 43,5', opposite_user: { id: 42, login: 'kaigylian' } });

(async () => {
  // ══ 1. LE CAS QUI COMPTE : une question d'acheteur sur SON annonce ═════════
  console.log('\n── Une question posée sur SON annonce : elle répond, et on peut le relire');
  await essaie('le cas normal', async () => {
    const ctx = faireCtx({ lignes: base(Object.assign(inbox([nonLue(500024320731)]), {
      [`harvest_${UID}_conv_500024320731`]: convRow({ cid: 500024320731, msgId: 69344957902, body: 'Je les paierai ce soir, pouvez-vous me les envoyer demain ?', itemId: MON_ITEM }),
    })) });
    const n = await ctx.repondreAuxMessages(UID);
    const j = ctx.__journal;
    dit(n === 1 && j.replies.length === 1, 'UNE réponse part', `rendu=${n} envois=${j.replies.length}`);
    dit(j.replies[0] && /\/conversations\/500024320731\/replies$/.test(j.replies[0].endpoint),
      'elle part dans la bonne conversation', j.replies[0] && j.replies[0].endpoint);
    // ⚠️ LA FORME RÉELLE, relevée sur les 9 réponses que Vinted envoie lui-même
    //    (`wreq_…_replies`, 30 sept.) : `reply` est un OBJET qui porte `body`.
    const rep0 = j.replies[0] && j.replies[0].body && j.replies[0].body.reply;
    dit(rep0 && typeof rep0 === 'object' && typeof rep0.body === 'string' && rep0.body.length > 0
      && Object.keys(j.replies[0].body).length === 1,
      'le corps a la forme que Vinted envoie lui-même (`reply.body`)', JSON.stringify(j.replies[0] && j.replies[0].body));
    // ⚠️ IL DOIT POUVOIR RELIRE CE QUI EST PARTI EN SON NOM.
    const ecrit = (j.ecrits[0] || [])[0] || {};
    const garde = ecrit.data || {};
    const envoi = Object.keys(garde).filter((k) => k !== 'bilan' && k !== 'demandes').map((k) => garde[k])[0];
    dit(ecrit.id === 'panel_msg_repondus' && envoi && envoi.texte && envoi.texte === (rep0 && rep0.body),
      'le texte exact est gardé pour qu’il le relise', JSON.stringify(envoi && envoi.texte));
    dit(envoi && String(envoi.login || '') !== '', 'et la personne est nommée', JSON.stringify(envoi && envoi.login));
  });

  // ══ 2. L'IDENTITÉ : il n'est pas toujours le vendeur ══════════════════════
  console.log('\n── Une conversation où c’est LUI qui achète : rien ne part');
  await essaie('le vendeur qui lui expédie', async () => {
    const ctx = faireCtx({ lignes: base(Object.assign(inbox([nonLue(24642334928, 'Trainers')]), {
      [`harvest_${UID}_conv_24642334928`]: convRow({ cid: 24642334928, msgId: 68405302810, body: 'Trainers are in post, thanks for buying', itemId: ITEM_DUN_AUTRE, login: 'nifeyo', desc: 'Trainers' }),
    })) });
    const n = await ctx.repondreAuxMessages(UID);
    const j = ctx.__journal;
    dit(n === 0 && j.replies.length === 0, 'aucune réponse à quelqu’un qui LUI vend', `envois=${j.replies.length}`);
    dit(j.ia === 0, 'et l’IA n’est même pas interrogée dessus', `appels IA=${j.ia}`);
    const b = (((j.ecrits[0] || [])[0] || {}).data || {}).bilan || {};
    dit(b.pasVendeur === 1, 'le bilan dit pourquoi elle s’est abstenue', JSON.stringify(b));
  });

  // ══ 3. CE QUE VINTED REFUSE, ET CE QU'ON N'A PAS LU ═══════════════════════
  console.log('\n── Les quatre autres causes de silence, comptées séparément');
  await essaie('les causes de silence', async () => {
    const ctx = faireCtx({ lignes: base(Object.assign(inbox([
      nonLue(1), nonLue(2), nonLue(3),
    ]), {
      // 1 : aucune conversation captée (17 des 32 chez lui)
      [`harvest_${UID}_conv_2`]: convRow({ cid: 2, msgId: null, body: '', itemId: MON_ITEM }),
      [`harvest_${UID}_conv_3`]: convRow({ cid: 3, msgId: 7, body: 'Bonjour, dispo ?', itemId: MON_ITEM, allowReply: false }),
    })) });
    const n = await ctx.repondreAuxMessages(UID);
    const j = ctx.__journal;
    dit(n === 0 && j.replies.length === 0, 'rien ne part', `envois=${j.replies.length}`);
    const b = (((j.ecrits[0] || [])[0] || {}).data || {}).bilan || {};
    dit(b.pasCaptee === 1, 'la conversation jamais captée est comptée à part', `pasCaptee=${b.pasCaptee}`);
    dit(b.sansMessage === 1, 'celle sans message de l’acheteur aussi', `sansMessage=${b.sansMessage}`);
    dit(b.replyRefuse === 1, 'et celle où Vinted refuse la réponse aussi', `replyRefuse=${b.replyRefuse}`);
    dit(b.nonLues === 3, 'le bilan porte le TOTAL, pas seulement ce qu’elle a traité', `nonLues=${b.nonLues}`);
  });

  // ══ 4. JAMAIS DEUX FOIS LE MÊME MESSAGE ═══════════════════════════════════
  console.log('\n── Jamais deux réponses au même message (l’identité est l’id du message)');
  await essaie('le doublon', async () => {
    const l = base(Object.assign(inbox([nonLue(500024320731)]), {
      [`harvest_${UID}_conv_500024320731`]: convRow({ cid: 500024320731, msgId: 69344957902, body: 'Dispo ?', itemId: MON_ITEM }),
      panel_msg_repondus: { data: { '500024320731:69344957902': { conv: '500024320731', texte: 'déjà dit', at: '2026-09-19T08:00:00Z' } } },
    }));
    const ctx = faireCtx({ lignes: l });
    const n = await ctx.repondreAuxMessages(UID);
    dit(n === 0 && ctx.__journal.replies.length === 0, 'la même conversation, le même message : rien ne repart', `envois=${ctx.__journal.replies.length}`);
    const b = (((ctx.__journal.ecrits[0] || [])[0] || {}).data || {}).bilan || {};
    dit(b.dejaRepondu === 1, 'et c’est dit', `dejaRepondu=${b.dejaRepondu}`);
    // L'AUTRE SENS : un NOUVEAU message dans la MÊME conversation doit repartir.
    const l2 = Object.assign({}, l, {
      [`harvest_${UID}_conv_500024320731`]: convRow({ cid: 500024320731, msgId: 69344999999, body: 'Alors, c’est possible ?', itemId: MON_ITEM }),
    });
    const ctx2 = faireCtx({ lignes: l2 });
    const n2 = await ctx2.repondreAuxMessages(UID);
    dit(n2 === 1, 'mais un NOUVEAU message de la même personne, oui', `envois=${ctx2.__journal.replies.length}`);
    const g = (((ctx2.__journal.ecrits[0] || [])[0] || {}).data || {});
    dit(g['500024320731:69344957902'] && g['500024320731:69344999999'],
      'et l’ancien envoi n’est pas effacé par le nouveau', JSON.stringify(Object.keys(g)));
  });

  // ══ 5. LE PLAFOND PAR VISITE ══════════════════════════════════════════════
  console.log('\n── Le plafond par visite : plus de 3, mais borné (répond à tout, étalé §3)');
  await essaie('le plafond', async () => {
    const max = Number((/const MSG_MAX_PAR_VISITE = (\d+)/.exec(src) || [])[1]);
    dit(max > 0, 'le plafond est lu dans le code, pas recopié dans le banc', `MSG_MAX_PAR_VISITE=${max}`);
    dit(max > 3, 'le plafond a bien été relevé au-dessus de 3 (sa demande « plus de 3 »)', `MSG_MAX_PAR_VISITE=${max}`);
    // On sert PLUS de conversations que le plafond, sinon le contrôle ne peut
    // pas mordre : il faut qu'il en reste à écarter (§6.1).
    const total = max + 4;
    const convs = [], rows = {};
    for (let i = 1; i <= total; i++) {
      convs.push(nonLue(1000 + i));
      rows[`harvest_${UID}_conv_${1000 + i}`] = convRow({ cid: 1000 + i, msgId: 500 + i, body: 'Bonjour, toujours dispo ?', itemId: MON_ITEM });
    }
    const ctx = faireCtx({ lignes: base(Object.assign(inbox(convs), rows)) });
    const n = await ctx.repondreAuxMessages(UID);
    dit(n === max && ctx.__journal.replies.length === max, `exactement ${max} réponses sur ${total} possibles (le reste attend la prochaine visite)`, `envois=${ctx.__journal.replies.length}`);
  });

  // ══ 5bis. LE BUDGET HORAIRE NE SE BRÛLE QUE POUR UN ENVOI RÉEL ════════════
  // La vraie protection anti-blocage est le plafond de 20 actions/heure
  // (`garde`→`compterAction`, qui pousse un créneau à chaque appel). Avant, on
  // appelait `garde` AVANT de savoir si l'IA répond : une conversation « pas
  // sûre » brûlait un créneau du budget sans rien envoyer. Invisible à 3/visite,
  // fatal en montant le plafond. On compte donc les appels à `garde` : il ne
  // doit y en avoir qu'AUTANT que d'envois réels.
  console.log('\n── Une conversation « pas sûre » ne brûle pas un créneau du budget horaire');
  await essaie('le budget horaire', async () => {
    const convs = [nonLue(2001), nonLue(2002), nonLue(2003)];
    const rows = {
      [`harvest_${UID}_conv_2001`]: convRow({ cid: 2001, msgId: 91, body: 'floue, je ne sais pas', itemId: MON_ITEM }),
      [`harvest_${UID}_conv_2002`]: convRow({ cid: 2002, msgId: 92, body: 'SURE dispo demain', itemId: MON_ITEM }),
      [`harvest_${UID}_conv_2003`]: convRow({ cid: 2003, msgId: 93, body: 'floue aussi', itemId: MON_ITEM }),
    };
    // L'IA n'est sûre que pour la conversation dont le message porte « SURE ».
    const ia = (message) => /SURE/.test(message)
      ? { ok: true, intent: 'question', confidence: 90, suggestions: [{ text: 'Oui, dispo !' }] }
      : { ok: true, intent: 'negociation', confidence: 30, suggestions: [{ text: 'Je ne sais pas trop.' }] };
    const ctx = faireCtx({ lignes: base(Object.assign(inbox(convs), rows)), ia });
    const n = await ctx.repondreAuxMessages(UID);
    const j = ctx.__journal;
    dit(n === 1 && j.replies.length === 1, 'une seule réponse part (une seule était sûre)', `envois=${j.replies.length}`);
    // ⚠️ §6.1 : sur le code d'avant `garde` était appelé AVANT l'IA, donc 3 fois
    //    (une par conversation examinée) — le budget de l'heure aurait perdu 2
    //    créneaux pour des conversations non répondues. Ici : 1 appel = 1 envoi.
    dit(j.gardeCalls === 1, 'le plafond horaire (`garde`) n\'est consommé que pour l\'envoi réel, pas pour les 2 « pas sûres »', `appels garde=${j.gardeCalls}`);
    dit(j.ia === 3, 'les trois conversations sont bien examinées par l\'IA', `appels IA=${j.ia}`);
  });

  // ══ 6. MIEUX VAUT UN BLANC QU'UN FAUX ═════════════════════════════════════
  console.log('\n── Si l’IA n’est pas sûre, on ne parle pas à sa place');
  await essaie('l’IA qui hésite', async () => {
    const l = base(Object.assign(inbox([nonLue(7)]), {
      [`harvest_${UID}_conv_7`]: convRow({ cid: 7, msgId: 77, body: 'Vous pouvez me les faire à 20 € port inclus, et c’est un cadeau ?', itemId: MON_ITEM }),
    }));
    const seuil = Number((/const MSG_MIN_CONFIANCE = (\d+)/.exec(src) || [])[1]);
    dit(seuil > 0, 'le seuil de confiance est lu dans le code', `MSG_MIN_CONFIANCE=${seuil}`);
    const hesite = faireCtx({ lignes: l, ia: () => ({ ok: true, intent: 'negociation', confidence: seuil - 1, suggestions: [{ text: 'Peut-être, je ne sais pas.' }] }) });
    dit((await hesite.repondreAuxMessages(UID)) === 0 && hesite.__journal.replies.length === 0,
      `sous ${seuil} de confiance, rien ne part`, `envois=${hesite.__journal.replies.length}`);
    const vide = faireCtx({ lignes: l, ia: () => ({ ok: true, confidence: 99, suggestions: [{ text: '   ' }] }) });
    dit((await vide.repondreAuxMessages(UID)) === 0 && vide.__journal.replies.length === 0,
      'une réponse vide ne part pas non plus', `envois=${vide.__journal.replies.length}`);
    const ko = faireCtx({ lignes: l, ia: () => ({ ok: false, reason: 'no-key' }) });
    dit((await ko.repondreAuxMessages(UID)) === 0 && ko.__journal.replies.length === 0,
      'l’IA injoignable ne fait pas envoyer une phrase au hasard', `envois=${ko.__journal.replies.length}`);
    // L'AUTRE SENS : au-dessus du seuil, ça part — sinon « ne rien envoyer » passerait tout.
    const sur = faireCtx({ lignes: l, ia: () => ({ ok: true, intent: 'negociation', confidence: seuil, suggestions: [{ text: 'Je peux faire 25 € port inclus !' }] }) });
    dit((await sur.repondreAuxMessages(UID)) === 1, `à ${seuil} pile, elle répond`, `envois=${sur.__journal.replies.length}`);
  });

  // ══ 7. ÉTEINT PAR DÉFAUT, ET « PAS SU » NE VAUT PAS « ALLUMÉ » ════════════
  console.log('\n── Le réglage : éteint par défaut, et une lecture ratée n’allume rien');
  await essaie('le réglage', async () => {
    const dedans = Object.assign(inbox([nonLue(500024320731)]), {
      [`harvest_${UID}_conv_500024320731`]: convRow({ cid: 500024320731, msgId: 69344957902, body: 'Dispo ?', itemId: MON_ITEM }),
    });
    const eteint = faireCtx({ lignes: Object.assign(base(dedans), { main: {} }) });
    dit((await eteint.repondreAuxMessages(UID)) === 0 && eteint.__journal.replies.length === 0,
      'réglage absent (jamais allumé) : rien ne part', `envois=${eteint.__journal.replies.length}`);
    const faux = faireCtx({ lignes: Object.assign(base(dedans), { main: { vinted_repond_auto: false } }) });
    dit((await faux.repondreAuxMessages(UID)) === 0, 'réglage à « non » : rien ne part');
    // Lecture KO sur la SEULE ligne du réglage, la base debout par ailleurs :
    // c'est le cas dangereux, pas la panne totale.
    const pasSu = faireCtx({ lignes: Object.assign(base(dedans), { __ko: ['id=eq.main'] }) });
    dit((await pasSu.repondreAuxMessages(UID)) === 0 && pasSu.__journal.replies.length === 0,
      'réglage NON LU : rien ne part (« pas su » ne vaut pas « oui »)', `envois=${pasSu.__journal.replies.length}`);
    // Et ses annonces non lues : sans elles on ne sait pas s'il VEND.
    const sansAnnonces = faireCtx({ lignes: Object.assign(base(dedans), { __ko: ['_listings'] }) });
    dit((await sansAnnonces.repondreAuxMessages(UID)) === 0 && sansAnnonces.__journal.replies.length === 0,
      'ses annonces non lues : on ne devine pas qu’il est le vendeur', `envois=${sansAnnonces.__journal.replies.length}`);
    // Et la liste de ce qui est DÉJÀ parti : sans elle on risquerait un doublon.
    const sansMemo = faireCtx({ lignes: Object.assign(base(dedans), { __ko: ['panel_msg_repondus'] }) });
    dit((await sansMemo.repondreAuxMessages(UID)) === 0 && sansMemo.__journal.replies.length === 0,
      'mémo des réponses non lu : on ne risque pas de répondre deux fois', `envois=${sansMemo.__journal.replies.length}`);
  });

  // ══ 8. LES GARDE-FOUS ANTI-BLOCAGE (§3) ═══════════════════════════════════
  console.log('\n── `garde` : le compte de l’onglet et le plafond horaire décident');
  await essaie('garde', async () => {
    const ctx = faireCtx({
      lignes: base(Object.assign(inbox([nonLue(500024320731)]), {
        [`harvest_${UID}_conv_500024320731`]: convRow({ cid: 500024320731, msgId: 69344957902, body: 'Dispo ?', itemId: MON_ITEM }),
      })),
      gardeStop: { ok: false, code: 'autre-compte' },
    });
    dit((await ctx.repondreAuxMessages(UID)) === 0 && ctx.__journal.replies.length === 0,
      'un autre compte dans l’onglet : rien ne part', `envois=${ctx.__journal.replies.length}`);
  });

  // ══ 9. LA FUITE DE L'IA : UNE QUESTION PAR MESSAGE, JAMAIS DEUX ══════════
  // Mesuré le 11 octobre (cout-vendeur/usage.md §4.2) : `repondreAuxMessages`
  // tourne à CHAQUE page Vinted chargée (~255 par jour chez Julien). Un message
  // où l'IA hésite n'était mémorisé nulle part : il repartait chez l'IA à
  // chaque page, tant qu'il restait non lu — ≈ 255 appels PAYÉS par jour pour
  // un seul message. On rejoue N passages en CHAÎNANT la ligne écrite par l'un
  // comme lecture du suivant (la base garde ce qu'on y écrit), et on COMPTE les
  // appels à l'IA.
  console.log('\n── La fuite de l’IA : un message où elle a hésité n’est demandé qu’UNE fois');
  const passages = async ({ lignes, ia, n, gardeStop = () => null }) => {
    let memo = lignes.panel_msg_repondus;
    let appelsIA = 0, envois = 0, ecrits = [], bilans = [];
    for (let i = 0; i < n; i++) {
      const ctx = faireCtx({ lignes: Object.assign({}, lignes, { panel_msg_repondus: memo }), ia, gardeStop: gardeStop(i) });
      envois += await ctx.repondreAuxMessages(UID);
      appelsIA += ctx.__journal.ia;
      const ligne = ((ctx.__journal.ecrits[0] || [])[0]) || null;
      if (ligne && ligne.id === 'panel_msg_repondus') { memo = { data: ligne.data }; ecrits.push(ligne.data); bilans.push(ligne.data.bilan || {}); }
    }
    return { appelsIA, envois, memo, ecrits, bilans };
  };
  const seuil9 = Number((/const MSG_MIN_CONFIANCE = (\d+)/.exec(src) || [])[1]) || 55;
  const uneConv = (body, msgId = 881) => base(Object.assign(inbox([nonLue(8801)]), {
    [`harvest_${UID}_conv_8801`]: convRow({ cid: 8801, msgId, body, itemId: MON_ITEM }),
  }));
  await essaie('l’hésitation mémorisée', async () => {
    const r = await passages({ lignes: uneConv('Vous me la faites à 20 € et vous me l’envoyez au Japon ?'), n: 10,
      ia: () => ({ ok: true, intent: 'negociation', confidence: seuil9 - 1, suggestions: [{ text: 'Peut-être.' }] }) });
    dit(r.appelsIA === 1, '10 pages Vinted chargées, un message où elle hésite : l’IA n’est appelée QU’UNE fois',
      `${r.appelsIA} appel(s) payé(s) sur 10 passages`);
    dit(r.envois === 0, 'et rien ne part (mieux vaut un blanc qu’un faux)', `envois=${r.envois}`);
    dit(r.bilans.length === 10 && r.bilans.every((b) => b.pasSure === 1),
      'chaque passage compte toujours ce message parmi « pas sûre » (le bilan de l’app ne change pas de sens)',
      JSON.stringify(r.bilans.map((b) => b.pasSure)));
    const d = (r.memo && r.memo.data && r.memo.data.demandes) || {};
    dit(d['8801:881'] && !d['8801:881'].texte, 'l’hésitation est rangée sous la clé du MESSAGE (conversation:message), sans texte à envoyer', JSON.stringify(d['8801:881']));
  });
  // ⚠️⚠️ REVUE DU 11 OCTOBRE : CE CONTRÔLE SERVAIT UNE FORME QUE LE SERVEUR NE
  //    REND JAMAIS (§6.3). `{ok:true, suggestions:[{text:'  '}]}` — or
  //    `api/ai.js` FILTRE une suggestion vide et répond `{ok:false, reason:'parse'}`,
  //    APRÈS avoir payé l'appel à Anthropic. L'extension prenait ça pour « IA
  //    injoignable » et redemandait à chaque page : la fuite n'était pas fermée.
  //    On sert donc la SORTIE RÉELLE de la vraie route (`api/ai.js` exécuté,
  //    Anthropic simulé), et on compte : chaque appel de l'extension est un appel
  //    facturé dès qu'Anthropic a répondu 2xx.
  const sortieServeur = async ({ anthropic = null, statut = 200, sansCle = false }) => {
    delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const ai = await import('file://' + path.join(racine, 'api', 'ai.js'));
    const avant = global.fetch; let factures = 0;
    global.fetch = async (url) => {
      if (/api\.anthropic\.com/.test(String(url))) {
        if (statut < 300) factures++;
        return new Response(JSON.stringify(anthropic), { status: statut, headers: { 'content-type': 'application/json' } });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const res = { code: null, corps: null };
    res.status = (n) => { res.code = n; return res; }; res.json = (o) => { res.corps = o; return res; };
    res.setHeader = () => {}; res.end = () => res;
    try {
      await ai.default({ method: 'POST', query: {}, headers: {},
        body: Object.assign({ mode: 'reply', message: 'Toujours dispo ?', article: 'salomon XT-6', price: 40 }, sansCle ? {} : { key: 'cle-banc' }) }, res);
    } finally { global.fetch = avant; }
    return { sortie: res.corps, factures };
  };
  const texteAnthropic = (text, stop = 'end_turn') => ({ content: [{ type: 'text', text }], stop_reason: stop });
  const formes = [
    ['la VRAIE réponse vide', texteAnthropic('{"intent":"question","confidence":90,"suggestions":[{"tone":"court","text":""}]}')],
    ['un JSON tronqué (max_tokens)', texteAnthropic('{"intent":"question","confidence":90,"suggestions":[{"tone":"court","text":"Oui, toujours dis', 'max_tokens')],
    ['un texte libre', texteAnthropic('Bien sûr ! Voici trois réponses possibles pour cet acheteur.')],
  ];
  for (const [nom, anthropic] of formes) {
    await essaie(`facturée et illisible : ${nom}`, async () => {
      const { sortie, factures } = await sortieServeur({ anthropic });
      dit(factures === 1 && sortie && sortie.ok === false && sortie.facture === true,
        `${nom} : le serveur a PAYÉ l’appel et le DIT (\`facture: true\`)`, JSON.stringify(sortie));
      const r = await passages({ lignes: uneConv('Toujours dispo ?'), n: 10, ia: () => sortie });
      dit(r.appelsIA === 1 && r.envois === 0, `${nom} : 10 pages Vinted, l’IA n’est payée qu’UNE fois et rien ne part`,
        `${r.appelsIA} appel(s) payé(s) sur 10 passages, envois=${r.envois}`);
      const d = (r.memo && r.memo.data && r.memo.data.demandes) || {};
      dit(d['8801:881'] && !d['8801:881'].texte && d['8801:881'].raison === 'illisible',
        `${nom} : rangé comme une réponse illisible, jamais redemandée`, JSON.stringify(d['8801:881']));
      const b = r.bilans[r.bilans.length - 1] || {};
      dit(b.iaKO === 1 && !b.pasSure && b.iaKOcauses && b.iaKOcauses.illisible === 1,
        `${nom} : l’app ne dira pas « elle n’était pas sûre » — c’est l’IA qui n’a rien rendu d’utilisable`, JSON.stringify({ pasSure: b.pasSure, iaKO: b.iaKO, causes: b.iaKOcauses }));
    });
  }
  // L'AUTRE SENS : ce qui n'est PAS facturé reste retenté (sinon une panne
  // d'Anthropic rendrait ce message muet pour toujours).
  await essaie('Anthropic surchargé (529)', async () => {
    const { sortie, factures } = await sortieServeur({ anthropic: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, statut: 529 });
    dit(factures === 0 && sortie && sortie.ok === false && !sortie.facture, 'Anthropic surchargé : rien de facturé, et le serveur ne dit pas le contraire', JSON.stringify(sortie));
    const r = await passages({ lignes: uneConv('Toujours dispo ?'), n: 3, ia: () => sortie });
    dit(r.appelsIA === 3, 'Anthropic surchargé : on RETENTE au passage suivant', `${r.appelsIA} appel(s) sur 3`);
    const b = r.bilans[r.bilans.length - 1] || {};
    dit(b.iaKO === 1 && !b.pasSure && b.iaKOcauses && b.iaKOcauses.injoignable === 1, 'et l’app dira que l’IA n’a pas répondu, pas qu’elle hésitait', JSON.stringify({ pasSure: b.pasSure, iaKO: b.iaKO, causes: b.iaKOcauses }));
  });
  await essaie('IA pas branchée (no-key)', async () => {
    const { sortie } = await sortieServeur({ sansCle: true });
    dit(sortie && sortie.reason === 'no-key' && !sortie.facture, 'sans clé : le serveur répond « no-key », rien de facturé', JSON.stringify(sortie));
    const r = await passages({ lignes: uneConv('Toujours dispo ?'), n: 2, ia: () => sortie });
    const b = r.bilans[r.bilans.length - 1] || {};
    dit(b.iaKO === 1 && !b.pasSure && b.iaKOcauses && b.iaKOcauses.pasBranchee === 1,
      'IA pas branchée : comptée à part (« pas branchée sur le serveur »), jamais « pas sûre »', JSON.stringify({ pasSure: b.pasSure, iaKO: b.iaKO, causes: b.iaKOcauses }));
  });
  await essaie('l’IA injoignable', async () => {
    const r = await passages({ lignes: uneConv('Dispo ?'), n: 3, ia: () => ({ ok: false, reason: 'network' }) });
    // L'AUTRE SENS : rien n'a été facturé, donc rien n'est mémorisé — sinon une
    // coupure de réseau rendrait ce message muet pour toujours.
    dit(r.appelsIA === 3, 'IA injoignable (rien de facturé) : on RETENTE au passage suivant', `${r.appelsIA} appel(s) sur 3`);
    const d = (r.memo && r.memo.data && r.memo.data.demandes) || {};
    dit(!d['8801:881'], 'et rien n’est mémorisé pour ce message', JSON.stringify(d));
  });
  await essaie('la réponse sûre bloquée par le plafond horaire', async () => {
    // Passage 1 : l'IA est sûre, mais `garde` refuse (plafond de 20/h atteint).
    // Passage 2 : `garde` accepte. La réponse doit partir SANS redemander l'IA.
    let n = 0;
    const r = await passages({ lignes: uneConv('Toujours dispo ?'), n: 3,
      gardeStop: (i) => (i === 0 ? { ok: false, code: 'plafond' } : null),
      ia: () => { n++; return { ok: true, intent: 'question', confidence: 90, suggestions: [{ text: 'Oui, toujours dispo, je poste demain !' }] }; } });
    dit(r.appelsIA === 1, 'une réponse sûre que le plafond horaire a retenue n’est PAS redemandée à l’IA', `${r.appelsIA} appel(s) sur 3 passages`);
    dit(r.envois === 1, 'elle part au passage suivant, une seule fois', `envois=${r.envois}`);
    const envoi = r.memo && r.memo.data && r.memo.data['8801:881'];
    dit(envoi && envoi.texte === 'Oui, toujours dispo, je poste demain !', 'c’est le texte obtenu la première fois qui part', JSON.stringify(envoi && envoi.texte));
    const d = (r.memo && r.memo.data && r.memo.data.demandes) || {};
    dit(!d['8801:881'], 'une fois partie, la réponse quitte la liste des questions (l’envoi la remplace)', JSON.stringify(Object.keys(d)));
  });
  await essaie('un nouveau message après une hésitation', async () => {
    const l1 = uneConv('Vous faites 20 € ?', 881);
    const r1 = await passages({ lignes: l1, n: 2, ia: () => ({ ok: true, confidence: seuil9 - 10, suggestions: [{ text: 'Hmm.' }] }) });
    // L'acheteur écrit à nouveau : AUTRE id de message ⇒ une nouvelle question.
    const l2 = Object.assign(uneConv('Et 25 € alors ?', 882), { panel_msg_repondus: r1.memo });
    let appels = 0;
    const ctx = faireCtx({ lignes: l2, ia: () => { appels++; return { ok: true, intent: 'negociation', confidence: 90, suggestions: [{ text: 'Je peux faire 25 € !' }] }; } });
    const env = await ctx.repondreAuxMessages(UID);
    dit(r1.appelsIA === 1 && appels === 1 && env === 1,
      'un NOUVEAU message de l’acheteur (autre id) est bien redemandé, et la réponse part', `1er message : ${r1.appelsIA} appel(s) · nouveau : ${appels} appel(s), ${env} envoi`);
  });
  await essaie('la liste des questions est bornée', async () => {
    const max = Number((/const MSG_DEMANDES_MAX = (\d+)/.exec(src) || [])[1]);
    dit(max > 0, 'la borne est lue dans le code', `MSG_DEMANDES_MAX=${max}`);
    const vieilles = {};
    for (let i = 0; i < (max || 300) + 25; i++) vieilles[`1:${i}`] = { at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), confiance: 10, raison: 'peu-sur' };
    const l = Object.assign(uneConv('Dispo ?'), { panel_msg_repondus: { data: { demandes: vieilles } } });
    const r = await passages({ lignes: l, n: 1, ia: () => ({ ok: true, confidence: 5, suggestions: [{ text: '?' }] }) });
    const d = (r.memo && r.memo.data && r.memo.data.demandes) || {};
    dit(Object.keys(d).length === max && d['8801:881'], `au plus ${max} questions gardées, la plus récente comprise (la ligne ne grossit pas sans fin)`, `${Object.keys(d).length} gardées`);
  });
  await essaie('le mémo non lu', async () => {
    const ctx = faireCtx({ lignes: Object.assign(uneConv('Dispo ?'), { __ko: ['panel_msg_repondus'] }) });
    await ctx.repondreAuxMessages(UID);
    dit(ctx.__journal.ia === 0, 'mémo illisible : l’IA n’est même pas appelée (on ne sait pas si on l’a déjà payée)', `appels IA=${ctx.__journal.ia}`);
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) au vert, ${ko} au rouge.`);
  process.exit(ko ? 1 : 0);
})();
