#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES NOTIFICATIONS DISENT UN FAIT, UNE FOIS (3 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (3 nov.) : « elles disent "arrivé au point relais" alors que le message
// disait qu'il VA arriver — il n'est pas du tout arrivé ». Mesuré sur sa base
// (journal des e-mails + clés `push_dedup`, 14 jours, lecture seule) :
//   · « Où vous livrer en cas de point indisponible ? » (Mondial Relay, 2 nov.)
//     ⇒ clé `relais-79566801-sans` : « 📍 Colis arrivé au point de retrait » ;
//   · « Confirmation de commande Mondial Relay » (31 oct.) ⇒ `relais-20423324-sans` ;
//   · « Action requise : le colis semble avoir été perdu » (2 nov.) ⇒
//     `retire-email_track_autre_op6i9s` : « ✅ Colis livré » ;
//   · « Ton colis arrive aujourd'hui ! #… » ⇒ `track-…` : « 🚚 Colis en transit ».
// Ce banc EXÉCUTE la vraie route `api/email-inbound.js` (§4.10) contre une
// fausse base (forme app_data owner/id/data, comparer-et-échanger sur rev), sur
// des e-mails FABRIQUÉS de chaque forme mesurée (valeurs inventées), et capture
// ce qui part vers les téléphones (web-push intercepté).
//   A  annonce / condition / futur / question ⇒ RIEN ne sonne « arrivé »
//   B  constat ⇒ UNE notification, texte exact « 📍 … t'attend », bon endroit
//   C  une fois par objet (même n°, même code, rappel, rejeu, voie Vinted + transporteur)
//   D  perdu ≠ livré ; retiré / en transit ne sonnent plus
//   F  famille coupée ⇒ rien ; catégories retirées ⇒ rien même allumées avant
//   V  deux vendeurs : chacun ses appareils, ses clés
'use strict';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';   // (7 nov.) sans elle, les routes serveur répondent 503 (api/_lib/cle-service.js)
const path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };
const J = '11111111-1111-4111-8111-111111111111';
const K = '22222222-2222-4222-8222-222222222222';
const ADR = 'achats-banc_7q@icloud.com';
const ADR_K = 'autre-vendeur_9z@icloud.com';

// ── La fausse base ─────────────────────────────────────────────────────────
let base = new Map();
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  const id = (q.get('id') || '').replace(/^eq\./, '');
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (id === 'vrm_email_owners') return rep([{ owner: J, data: { adresses: { [ADR]: { owner: J } } } }, { owner: K, data: { adresses: { [ADR_K]: { owner: K } } } }]);
    if (/vrm_email_preuve_/.test(u.search)) {
      const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js'));
      return rep([{ id: idPreuve(J, ADR), owner: J, adresse: ADR, etat: 'prouvee' }, { id: idPreuve(K, ADR_K), owner: K, adresse: ADR_K, etat: 'prouvee' }]);
    }
    if (!id || !owner) return rep([]);
    const d = base.get(k(owner, id));
    return rep(d === undefined ? [] : [{ id, data: d }]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (ignore && base.has(k(l.owner, l.id))) continue;
      base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(ignore || /return=representation/.test(((o.headers || {}).Prefer) || '') ? out : '', 201);
  }
  if (methode === 'PATCH') {
    const kk = k(owner, id);
    if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(kk, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

// ── Les téléphones ─────────────────────────────────────────────────────────
const pushes = [];
const TEL_J = 'https://web.push.apple.com/iphone-julien', TEL_K = 'https://web.push.apple.com/iphone-autre';
const prepare = (prefsJ, prefsK) => {
  base = new Map(); pushes.length = 0;
  base.set(k(J, 'push_subs'), { subs: [{ endpoint: TEL_J, keys: { p256dh: 'x', auth: 'y' } }] });
  base.set(k(K, 'push_subs'), { subs: [{ endpoint: TEL_K, keys: { p256dh: 'x', auth: 'y' } }] });
  if (prefsJ) base.set(k(J, 'push_prefs'), prefsJ);
  if (prefsK) base.set(k(K, 'push_prefs'), prefsK);
};

// ── Les e-mails fabriqués (formes mesurées le 3 nov., valeurs inventées) ────
let n = 0;
const FROM_MR = 'Mondial Relay via Vinted <shipping_at_relay_vinted_com_banc@icloud.com> (shipping@relay.vinted.com.banc)';
const FROM_MR_DIRECT = 'Mondial Relay - Service Client <noreply@mondialrelay.fr>';
const FROM_VG = 'Vinted Go <no-reply_at_vinted_com_banc@icloud.com> (no-reply@vinted.com.banc)';
const FROM_V = '"L\'équipe Vinted" <no-reply_at_vinted_fr_banc@icloud.com> (no-reply@vinted.fr.banc)';
const mail = (from, subject, text, to = ADR) => ({ messageId: `<notif-${++n}@banc>`, from, to, subject, text, html: '', attachments: [], source: 'gmail-v2', sourceDate: new Date(Date.UTC(2026, 10, 3, 8, 0, n)).toISOString() });
const MR_DISPO = (suivi, code) => mail(FROM_MR, `Votre colis ${suivi} est disponible 📦`,
  `Bonjour,\n\nBonne nouvelle, votre colis n° ${suivi} est disponible dans votre Point Relais®.\n\nPoint Relais®\n\nTABAC DU QUAI\n\n12 RUE DES MOUETTES\n\n99990 PORTVILLE\n\nCode de retrait : ${code}\n\nRETRAIT JUSQU'AU 12/11\n`);
const MR_RAPPEL = (suivi, code) => mail(FROM_MR, 'Le temps file : votre colis vous attend avec impatience ⏳',
  `Bonjour,\n\nVotre colis n° ${suivi} vous attend toujours.\n\nCode de retrait : ${code}\n\nPassé ce délai, il sera retourné à l'expéditeur.\n`);
const MR_INDISPO = (suivi) => mail(FROM_MR, 'Où vous livrer en cas de point indisponible ?',
  `Bonjour,\n\nAu cas où le point de retrait que vous avez choisi pour votre colis n° ${suivi}  serait indisponible, nous vous invitons à sélectionner un point de retrait de substitution.\n\nChoisissez un autre point de retrait alternatif avant ce soir\n\nChoisir un point de retrait alternatif\n\nSi vous ne faites rien, pas de souci : on s’en occupe pour vous !\n\nEn cas d'indisponibilité du point de retrait initial, votre colis sera livré dans le point le plus proche.\n\nAvec 19 000 points de proximité partout en France, déposer ou récupérer vos colis à pied ou à vélo devient un jeu d’enfant\n`);
const MR_COMMANDE = (suivi) => mail(FROM_MR_DIRECT, 'Confirmation de commande Mondial Relay',
  `Bonjour,\n\nMerci pour votre commande n° ${suivi}.\n\nDès que votre colis sera disponible dans votre Point Relais, vous recevrez un e-mail avec votre code de retrait.\n\nVous pouvez suivre votre colis chez vous recevrez un e-mail à chaque étape.\n`);
const VG_AUJOURDHUI = (suivi) => mail(FROM_VG, `Ton colis arrive aujourd'hui ! #${suivi}`,
  `Bonne nouvelle !\n\nTon colis arrive aujourd'hui à la consigne Vinted Go.\n\nTu recevras ton code dès qu'il sera disponible.\n`);
const VG_LIBERE = (suivi, code) => mail(FROM_VG, `Libère de la place dans la consigne : récupère ton colis sans attendre ! #${suivi}`,
  `Ton colis t'attend toujours.\n\nSaisis le code suivant : ${code}\n\nAdresse\n\nConsigne Vinted Go\n\nLaverie Banc\n\n3 Rue du Phare\n\n99990 Portville\n`);
const V_PERDU = (art) => mail(FROM_V, `Action requise : le colis semble avoir été perdu — ${art}`,
  `Bonjour,\n\nLe transporteur indique que ton colis a été livré, mais il semble avoir été perdu. Réponds-nous dans la conversation.\n`);
const MR_RETIRE = (suivi) => mail(FROM_MR, 'Votre colis a été retiré', `Bonjour,\n\nVotre colis n° ${suivi} a bien été retiré le 03/11.\n`);
const MR_ROUTE = (suivi) => mail(FROM_MR, 'Votre colis est entre de bonnes mains 📦', `Bonjour,\n\nVotre colis n° ${suivi} sera livré dans votre Point Relais.\n`);
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const CONV = (i) => `0a1b2c3d-1111-7222-8333-${String(i).padStart(12, '0')}`;
const lienConv = (c) => `https://links.vinted.com/t/${b64(`https://www.vinted.fr/inbox/${c}?l=email|inv_0|SIGBANC=`)}`;
const V_COMMANDE = (titre, phrase, conv) => mail(FROM_V, `Commande mise à jour pour ${titre}`, `Bonjour,\n\n${phrase}\n\nAller sur la conversation\n<${lienConv(conv)}>\n`);

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-notifs';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-audit';   // (7 nov.) sans elle la route répond 503 (api/_lib/cle-service.js)
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  webpush.sendNotification = async (sub, body) => { pushes.push({ tel: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?notifs');
  const libPush = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const oublis = () => { try { libPush.oublierPrefsVues(); } catch (_) {} try { route.oublierMemoEnAttente(); } catch (_) {} };
  const recoit = async (m) => { oublis(); const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-notifs' }, body: JSON.parse(JSON.stringify(m)) }, res); return res; };
  const resume = () => pushes.map((p) => `${p.title} | ${p.body}`).join(' ‖ ') || 'aucune';
  const arrive = (p) => /arriv|disponible|t'attend|à retirer|livr/i.test(`${p.title}`);

  await essaie('A — une annonce n’est pas une arrivée', async () => {
    prepare();
    await recoit(MR_INDISPO('79566801'));
    dit(pushes.length === 0, 'A1 « Où vous livrer en cas de point indisponible ? » (MR, 2 nov.) : rien ne sonne', resume());
    const l1 = base.get(k(J, 'email_track_mondialrelay_79566801')) || {};
    dit(l1.status !== 'available', 'A1b et la ligne n’est pas « à retirer » (« indisponible » n’est pas « disponible »)', l1.status);
    prepare();
    await recoit(MR_COMMANDE('20423324'));
    dit(pushes.length === 0, 'A2 « Confirmation de commande » (« dès que votre colis sera disponible… ») : rien ne sonne', resume());
    prepare();
    await recoit(VG_AUJOURDHUI('467648387488'));
    dit(pushes.length === 0, 'A3 « Ton colis arrive aujourd’hui ! » : rien ne sonne (ni « arrivé », ni « en transit »)', resume());
    prepare();
    await recoit(MR_ROUTE('84000001'));
    dit(pushes.length === 0, 'A4 « sera livré dans votre Point Relais » : rien', resume());
    prepare();
    await recoit(V_COMMANDE('Nike Shox', "Ta commande est en cours d'acheminement ! La livraison est estimée au 5 nov. - 7 nov.", CONV(1)));
    dit(pushes.length === 0, 'A5 « Commande mise à jour … en cours d’acheminement » : rien', resume());
  });

  await essaie('B — un constat, une notification au bon texte', async () => {
    prepare();
    await recoit(MR_DISPO('84603328', '454602'));
    const p = pushes[0] || {};
    dit(pushes.length === 1, 'B1 « Votre colis … est disponible » : UNE notification', resume());
    dit(p.title === "📍 Ton colis Mondial Relay t'attend", 'B2 titre exact « 📍 Ton colis Mondial Relay t’attend »', p.title);
    dit(p.body === "Tabac du Quai, Portville · code 454602 · jusqu'au 12/11", 'B3 corps exact « Tabac du Quai, Portville · code 454602 · jusqu’au 12/11 »', p.body);
    dit(p.url === '/?tab=cat_bord&cible=retrait&suivi=84603328', 'B4 le toucher ouvre Colis → À retirer, SUR ce colis', p.url);
    dit(p.tel === TEL_J, 'B5 sur le téléphone du vendeur de l’adresse de réception', p.tel);
    prepare();
    await recoit(VG_LIBERE('1UW1T3JAAW7UK', 'N58590'));
    const q = pushes[0] || {};
    dit(pushes.length === 1 && q.title === "📍 Ton colis Vinted Go t'attend" && /^Consigne Laverie Banc|Laverie Banc/.test(q.body) && /code N58590/.test(q.body), 'B6 Vinted Go « Libère de la place … récupère ton colis » : « 📍 … t’attend », la consigne et le code', resume());
    prepare();
    await recoit(V_COMMANDE('Nike Shox', "Ta commande t'attend ici : Laverie Banc - Portville, 3 Rue du Phare, 99990 Portville. Utilise le code K48213 pour la retirer.", CONV(2)));
    const r = pushes[0] || {};
    dit(pushes.length === 1 && r.title === "📍 Nike Shox t'attend" && /code K48213/.test(r.body), 'B7 Vinted « t’attend ici … Utilise le code » : « 📍 Nike Shox t’attend · … · code K48213 »', resume());
  });

  await essaie('C — une seule fois par objet', async () => {
    prepare();
    await recoit(MR_DISPO('84603328', '454602'));
    await recoit(MR_DISPO('84603328', '454602'));
    await recoit(MR_RAPPEL('84603328', '454602'));
    dit(pushes.length === 1, 'C1 même n° : e-mail rejoué puis rappel « vous attend » : UNE notification', resume());
    prepare();
    await recoit(VG_AUJOURDHUI('467648387488'));
    await recoit(VG_LIBERE('467648387488', 'M52093'));
    dit(pushes.length === 1 && /t'attend/.test(pushes[0].title), 'C2 « arrive aujourd’hui » PUIS « récupère ton colis » : une seule, l’arrivée', resume());
    prepare();
    await recoit(V_COMMANDE('Nike Shox', "Ta commande t'attend ici : Laverie Banc - Portville, 3 Rue du Phare, 99990 Portville. Utilise le code M52093 pour la retirer.", CONV(3)));
    await recoit(VG_LIBERE('467648387488', 'M52093'));
    dit(pushes.length === 1, 'C3 e-mail Vinted (code) PUIS e-mail Vinted Go (même code) : UNE notification (le code est l’identité commune)', resume());
    prepare();
    await recoit(V_COMMANDE('Nike Shox', "Ton achat t'attend au point relais TABAC DU QUAI, 12 RUE DES MOUETTES, 99990 PORTVILLE", CONV(4)));
    const ligne = [...base.keys()].some((x) => x === k(J, `email_track_autre_conv-${CONV(4)}`));
    await recoit(MR_DISPO('84569077', '981384'));
    dit(ligne && pushes.length === 1 && /code 981384/.test(pushes[0].body || ''), 'C4 « t’attend au point relais » (sans code, rangé à retirer) PUIS l’e-mail du transporteur avec le code : UNE notification, celle qui porte le code', resume());
    prepare();
    await recoit(MR_DISPO('84603328', '454602'));
    await recoit(MR_DISPO('84569077', '981384'));
    dit(pushes.length === 2, 'C5 deux colis différents : deux notifications', resume());
    // Un « disponible » GARDÉ d'un e-mail précédent (rangé sans sonner : rejeu en lot)
    // n'est pas constaté par un « en route » arrivé ensuite : rien.
    prepare();
    base.set(k(J, 'email_track_mondialrelay_84000077'), { type: 'suivi', carrier: 'mondialrelay', suivi: '84000077', status: 'available', statusLabel: 'Arrivé au point de retrait', code: '777111', lieu: 'TABAC DU QUAI, 12 RUE DES MOUETTES, 99990 PORTVILLE', subject: 'Votre colis 84000077 est disponible 📦', emailAt: '2026-11-03T09:00:00.000Z', receivedAt: '2026-11-03T09:00:00.000Z' });
    await recoit(MR_ROUTE('84000077'));
    dit(pushes.length === 0 && (base.get(k(J, 'email_track_mondialrelay_84000077')) || {}).status === 'available', 'C6 un « en route » après un « disponible » rangé : la ligne reste à retirer, mais rien ne sonne « t’attend » (l’e-mail ne le constate pas)', resume());
  });

  await essaie('D — perdu, retiré, en transit', async () => {
    prepare();
    await recoit(V_PERDU('Nike air Max 1'));
    dit(pushes.length === 1 && pushes[0].title === '⚠️ Colis peut-être perdu · Nike air Max 1' && !pushes.some((p) => /livr|retir|✅/i.test(p.title)), 'D1 « le colis semble avoir été perdu » : « ⚠️ Colis peut-être perdu · Nike air Max 1 », jamais « livré »', resume());
    const lp = [...base.entries()].find(([x]) => x.startsWith(J + '|email_track_autre_'));
    dit(lp && lp[1].status !== 'delivered', 'D2 et la ligne n’est pas « livré / retiré »', lp && lp[1].status);
    await recoit(V_PERDU('Nike air Max 1'));
    dit(pushes.length === 1, 'D3 le même e-mail rejoué : rien de plus', resume());
    prepare({ suivi: true, achat: true, favori: true });
    await recoit(MR_RETIRE('84603328'));
    await recoit(MR_ROUTE('84603329'));
    dit(pushes.length === 0, 'D4 « retiré » et « en route » : rien, même avec l’ancien réglage « suivi » allumé', resume());
  });

  await essaie('F — familles', async () => {
    prepare({ colis: true, familles: { arrives: false } });
    await recoit(MR_DISPO('84603328', '454602'));
    dit(pushes.length === 0, 'F1 famille « Colis arrivés » coupée : rien (même si l’ancienne catégorie « colis » est allumée)', resume());
    prepare({ familles: { arrives: true, messages: false } });
    await recoit(V_PERDU('Nike air Max 1'));
    await recoit(MR_DISPO('84603328', '454602'));
    dit(pushes.length === 1 && arrive(pushes[0]), 'F2 « Messages » coupée : la demande « perdu » se tait, l’arrivée sonne', resume());
    const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
    dit(['suivi', 'achat', 'favori'].every((c) => T.decisionNotif({ [c]: true, familles: {} }, c) === false), 'F3 « suivi », « achat », « favori » retirées : jamais, même allumées avant');
    dit(T.decisionNotif({ message: false }, 'message') === false && T.decisionNotif({}, 'message') === true && T.decisionNotif({ familles: { messages: true }, message: false }, 'message') === true, 'F4 sans famille posée, l’ancien réglage décide ; la famille posée l’emporte');
    const fams = new Set(Object.values(T.FAMILLE_DE));
    // (5 nov.) Sept types : la double vente a le sien, « Compta » devient « Rappels » (héritage de l’ancien réglage).
    dit(['ventes', 'offres', 'messages', 'poster', 'arrives', 'doublevente', 'rappels', 'comptes'].every((f) => fams.has(f)) && T.FAMILLES.length === 8, 'F5 huit types : Ventes, Offres, Messages, Colis à poster, Codes de retrait, Double vente, Rappels, Nouveau compte relié');
    dit(T.decisionNotif({ familles: { ventes: false } }, 'doublevente') === false && T.decisionNotif({ familles: { ventes: false, doublevente: true } }, 'doublevente') === true && T.decisionNotif({ familles: { compta: false } }, 'urssaf') === false && T.decisionNotif({ familles: { poster: false } }, 'soir') === false, 'F6 un type neuf hérite de l’ancien réglage tant qu’il n’est pas posé');
  });

  await essaie('V — deux vendeurs', async () => {
    prepare();
    await recoit(MR_DISPO('84603328', '454602'));
    const m = MR_DISPO('84603328', '454602'); m.to = ADR_K;
    await recoit(m);
    dit(pushes.length === 2 && pushes.filter((p) => p.tel === TEL_J).length === 1 && pushes.filter((p) => p.tel === TEL_K).length === 1, 'V1 le même e-mail reçu par deux vendeurs : une notification chacun, sur SON téléphone (clés de dédoublonnage séparées)', pushes.map((p) => p.tel).join(' · '));
    prepare(null, { familles: { arrives: false } });
    const m2 = MR_DISPO('84603328', '454602'); m2.to = ADR_K;
    await recoit(m2);
    await recoit(MR_DISPO('84603328', '454602'));
    dit(pushes.length === 1 && pushes[0].tel === TEL_J, 'V2 l’autre vendeur a coupé « Colis arrivés » : lui rien, Julien la sienne', pushes.map((p) => p.tel).join(' · '));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
