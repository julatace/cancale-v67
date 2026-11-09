// ════════════════════════════════════════════════════════════════════════════
//  MONDIAL RELAY AU DÉPART — de l'e-mail à « À envoyer », EXÉCUTÉ (9 nov.)
//  Restes-ventes §3 : une vente Mondial Relay restait « à envoyer » après le
//  dépôt, faute d'identité sûre entre l'e-mail du bordereau et l'e-mail « entre
//  de bonnes mains » de Mondial Relay. Depuis le 9 nov., la route range le n°
//  Mondial Relay (8 chiffres après « N° de suivi ») écrit dans l'e-mail du
//  bordereau : la MÊME identité que l'e-mail de dépôt du transporteur.
//  Ici la chaîne entière, sans rien deviner :
//   1. la VRAIE route `api/email-inbound.js` reçoit l'e-mail du bordereau puis
//      l'e-mail de dépôt Mondial Relay (formes inventées — non mesurées sur la
//      vraie base, dit dans la passation) ; on garde les lignes qu'elle écrit ;
//   2. ces lignes sont servies au serveur comme il les LIT (`meta` = scalaires,
//      projection `REQ_PREUVES_EMAIL`, relecture `relireLigneMeta`/`avecSuiviDuSujet`)
//      et passées à la règle partagée `ventesPartiesParPreuve` (api/_lib/depart-vente.js,
//      la même pour l'app, le widget, les rappels).
//   D1 dépôt Mondial Relay du MÊME n° ⇒ la vente quitte « À envoyer » (« E-mail de dépôt Mondial Relay ») ;
//   D2 dépôt d'un AUTRE n° ⇒ elle reste ;
//   D3 bordereau sans n° lisible ⇒ elle reste (rien relié par titre ni date) ;
//   D4 deux ventes au même n° ⇒ ambigu, les deux restent ;
//   D5 50 ventes au même titre, une seule au n° déposé ⇒ une seule sort ;
//   D6 un e-mail « Ton bordereau d'envoi » seul (étiquette) ⇒ ne prouve rien.
//  `AUDIT_RACINE` : une autre copie de l'arbre (preuve sur le code d'avant).
//  `--prouve` : chaque mutation (n° Mondial Relay pas lu, ambiguïté oubliée,
//  dépôt d'un autre n° accepté, étiquette prise pour un dépôt) doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'n° Mondial Relay du bordereau pas lu': [['api/email-inbound.js', "  if (!data.suivi) { const mr = suiviMondialRelayDuTexte(all); if (mr) data.suivi = mr; }", '']],
  'n° partagé accepté': [['api/_lib/depart-vente.js', "  if (amb && (amb instanceof Set ? amb.has(k) : Array.isArray(amb) && amb.includes(k))) return null;\n", '']],
  'dépôt de n’importe quel n°': [['api/_lib/depart-vente.js', "  const pe = ctx.preuvesEmail instanceof Map ? ctx.preuvesEmail.get(k) : null;", "  const pe = ctx.preuvesEmail instanceof Map ? [...ctx.preuvesEmail.values()][0] : null;"]],
  'étiquette prise pour un dépôt': [['api/_lib/depart-vente.js', "  if (SUJET_ETIQUETTE.test(sujet) && !SUJET_DEPOT.test(sujet) && status === 'transit') return null;\n", '']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

const J = '11111111-1111-1111-1111-111111111111';
const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } };
const metaDe = (d) => { const m = {}; for (const [k, v] of Object.entries(d || {})) if (['string', 'number', 'boolean'].includes(typeof v) && JSON.stringify(v).length <= 600) m[k] = v; return m; };

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-mr';
  const base = new Map();
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') {
      try { JSON.parse(opts.body || '[]').forEach((x) => { if (x && x.id) base.set(x.id, x.data); }); } catch (_) {}
      return rep('', 201);
    }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([LIGNE_J]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    return rep([]);
  };
  const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?mr');
  const dv = await import('file://' + path.join(R, 'api', '_lib', 'depart-vente.js'));
  const sc = await import('file://' + path.join(R, 'api', '_lib', 'suivi-colis.js'));
  let n = 0;
  const envoyer = async (mail) => {
    n++;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-mr' }, body: { messageId: `<mr-${n}@banc>`, to: 'recu@vrm.center', html: '', attachments: [], sourceDate: '2026-11-05T09:00:00.000Z', ...mail } }, res);
    return res;
  };
  const pdf = (tx) => ({ filename: `Bordereau-Vinted-${tx}.pdf`, contentType: 'application/pdf', contentB64: Buffer.from('%PDF-1.4 banc').toString('base64') });
  const bordereau = (tx, corps) => envoyer({ from: "L'équipe Vinted <no-reply@vinted.fr>", subject: "Bordereau d'envoi pour Salomon XT-6 42", text: corps, attachments: [pdf(tx)] });
  const depotMR = (num) => envoyer({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: `Votre colis ${num} est entre de bonnes mains`, text: `Bonjour,\nVotre colis n° ${num} a bien été déposé dans notre Point Relais®.\nIl est maintenant en route vers son destinataire.\nMondial Relay`, sourceDate: '2026-11-06T15:00:00.000Z' });

  // La règle partagée, servie comme le SERVEUR lit la base (scalaires `meta`, projection REQ_PREUVES_EMAIL).
  const juger = (txs, ventesMs = {}) => {
    const bordsParTx = {};
    for (const tx of txs) { const d = base.get('email_bord_' + tx); if (d) { const m = metaDe(d); bordsParTx[tx] = { transaction: m.transaction, suivi: m.suivi, receivedAt: m.receivedAt }; } }
    const lignes = [...base.entries()].filter(([id]) => /^email_track_/.test(id)).map(([id, d]) => {
      const m = metaDe(d);
      if (!['transit', 'available', 'delivered', 'retour', 'info'].includes(m.status)) return null;
      return { id, s: m.status ?? null, r: m.receivedAt ?? null, ea: m.emailAt ?? null, su: m.suivi ?? null, sj: m.subject ?? null, se: m.sens ?? null, c: m.carrier ?? null };
    }).filter(Boolean).map((x) => sc.avecSuiviDuSujet(sc.relireLigneMeta(x)) || x);
    return dv.ventesPartiesParPreuve({ txs, bordsParTx, lignesEmail: lignes, departs: new Map(), ventesMs, entrants: new Set() });
  };
  const VENTE = Date.parse('2026-11-04T10:00:00Z');

  await essaie('D1', async () => {
    await bordereau('41000000001', "Ton bordereau d'envoi est prêt.\nN° de transaction : 41000000001\nN° de suivi : 60385202\nDépose ton colis dans un Point Relais Mondial Relay avant le 12/11/2026 23:59.");
    const b = base.get('email_bord_41000000001');
    dit(b && b.suivi === '60385202', 'D1 la route range le n° Mondial Relay de l’e-mail du bordereau', JSON.stringify(b && b.suivi));
    const avant = juger(['41000000001'], { 41000000001: VENTE });
    dit(!avant.has('41000000001'), 'D1 avant le dépôt : la vente attend son envoi');
    await depotMR('60385202');
    const lt = [...base.keys()].filter((k) => /^email_track_/.test(k));
    dit(lt.some((k) => /60385202/.test(k)), 'D1 l’e-mail de dépôt Mondial Relay est rangé sous SON n°', lt.join(','));
    const apres = juger(['41000000001'], { 41000000001: VENTE });
    const r = apres.get('41000000001');
    dit(r && r.type === 'email' && r.depot === true && /Mondial Relay/.test(r.phrase || ''), 'D1 dépôt du MÊME n° ⇒ la vente quitte « À envoyer » (« E-mail de dépôt Mondial Relay »)', JSON.stringify(r));
  });
  await essaie('D2', async () => {
    await bordereau('41000000002', "N° de transaction : 41000000002\nN° de suivi : 60385203\nPoint Relais Mondial Relay.");
    await depotMR('60385299');
    dit(!juger(['41000000002'], { 41000000002: VENTE }).has('41000000002'), 'D2 dépôt d’un AUTRE n° ⇒ la vente reste à envoyer');
  });
  await essaie('D3', async () => {
    await bordereau('41000000003', "N° de transaction : 41000000003\nDépose ton colis dans un Point Relais Mondial Relay.");
    const b = base.get('email_bord_41000000003');
    dit(b && !b.suivi, 'D3 bordereau sans n° lisible ⇒ aucun n° inventé', JSON.stringify(b && b.suivi));
    dit(!juger(['41000000003'], { 41000000003: VENTE }).has('41000000003'), 'D3 et la vente reste à envoyer (rien relié par titre, date ou transporteur)');
  });
  await essaie('D4', async () => {
    await bordereau('41000000004', "N° de transaction : 41000000004\nN° de suivi : 60385210\nMondial Relay.");
    await bordereau('41000000005', "N° de transaction : 41000000005\nN° de suivi : 60385210\nMondial Relay.");
    await depotMR('60385210');
    const p = juger(['41000000004', '41000000005'], { 41000000004: VENTE, 41000000005: VENTE });
    dit(!p.has('41000000004') && !p.has('41000000005'), 'D4 deux ventes au même n° ⇒ ambigu, les deux restent');
  });
  await essaie('D5', async () => {
    const txs = [];
    for (let i = 0; i < 50; i++) { const tx = String(42000000000 + i); txs.push(tx); await bordereau(tx, `N° de transaction : ${tx}\nN° de suivi : ${String(70000000 + i)}\nMondial Relay.`); }
    await depotMR('70000017');
    const p = juger(txs, Object.fromEntries(txs.map((t) => [t, VENTE])));
    dit(p.size === 1 && p.has('42000000017'), '50 ventes au même titre : seule celle dont le n° est déposé sort', JSON.stringify([...p.keys()]));
  });
  await essaie('D6', async () => {
    await bordereau('41000000006', "N° de transaction : 41000000006\nN° de suivi : 60385220\nMondial Relay.");
    await envoyer({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Ton étiquette d’envoi Mondial Relay 60385220', text: 'Ton étiquette 60385220 est prête : ton colis est en route dès que tu le déposes.', sourceDate: '2026-11-06T15:00:00.000Z' });
    dit(!juger(['41000000006'], { 41000000006: VENTE }).has('41000000006'), 'D6 un e-mail d’étiquette seul (« bordereau ») ne prouve aucun dépôt');
  });
  console.log(ko ? `\n❌ audit-depart-mondialrelay : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-depart-mondialrelay : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
