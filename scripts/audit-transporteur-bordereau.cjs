// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR DE L'E-MAIL DU BORDEREAU — la route EXÉCUTÉE (9 nov.)
//  Colis → « Envoyés » : une vente Vinted prend le transporteur NOMMÉ dans l'e-mail
//  « Bordereau d'envoi » de SA transaction (un seul nom, sinon rien), et un n°
//  Mondial Relay de 8 chiffres écrit après « N° de suivi ». La VRAIE route
//  `api/email-inbound.js` est exécutée (données inventées, forme réelle : pièce
//  « Bordereau-Vinted-{tx}.pdf ») ; on lit la ligne `email_bord_{tx}` qu'elle écrit.
//  §4.10 : une fonction serverless n'est vérifiée que si on l'EXÉCUTE.
// ════════════════════════════════════════════════════════════════════════════
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';   // (7 nov.) sans elle, les routes serveur répondent 503 (api/_lib/cle-service.js)
const path = require('path');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };

const J = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } };

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-journal';
  const ecrites = [];
  let etat = {};
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') {
      if (etat.ecritureKO) return rep('<html>503</html>', 503);
      try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push({ id: x.id, owner: x.owner || '', data: x.data })); } catch (_) {}
      return rep('', 201);
    }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([LIGNE_J]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    return rep([]);
  };
  const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?journal');
  let n = 0;
  const envoyer = async (mail, e = {}) => {
    etat = e; ecrites.length = 0; n++;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-journal' }, body: { messageId: `<journal-${n}@banc>`, to: 'recu@vrm.center', html: '', attachments: [], ...mail } }, res);
    const suivi = ecrites.find((x) => x.id.startsWith('email_reception_'));
    const texte = ecrites.find((x) => x.id.startsWith('email_texte_'));
    return { code: res.code, corps: res.corps, suivi, texte, ecrites: ecrites.slice() };
  };
  const pdf = (tx) => ({ filename: `Bordereau-Vinted-${tx}.pdf`, contentType: 'application/pdf', contentB64: Buffer.from('%PDF-1.4 banc').toString('base64') });
  const bord = async (tx, text) => { const o = await envoyer({ from: "L'équipe Vinted <no-reply@vinted.fr>", subject: "Bordereau d'envoi pour Salomon XT-6 42", text, attachments: [pdf(tx)] }); return (o.ecrites.find((x) => x.id === 'email_bord_' + tx) || {}).data || null; };
  await essaie('Mondial Relay', async () => {
    const d = await bord('31000000001', "Ton bordereau d'envoi est prêt.\nN° de transaction : 31000000001\nN° de suivi : 12345678\nDépose ton colis dans un point Mondial Relay avant le 12/11/2026 23:59 pour éviter l'annulation.");
    dit(d && d.transporteur === 'mondialrelay', 'un e-mail qui nomme Mondial Relay ⇒ transporteur « mondialrelay » rangé', JSON.stringify(d && d.transporteur));
    dit(d && d.suivi === '12345678', 'le n° Mondial Relay (8 chiffres après « N° de suivi ») est rangé', JSON.stringify(d && d.suivi));
  });
  await essaie('Chronopost', async () => {
    const d = await bord('31000000002', "N° de transaction : 31000000002\nN° de suivi : XW123456789TS\nDépose ton colis dans un relais Chronopost.");
    dit(d && d.transporteur === 'chronopost' && d.suivi === 'XW123456789TS', 'Chronopost nommé, n° propre gardé', JSON.stringify(d && [d.transporteur, d.suivi]));
  });
  await essaie('deux noms', async () => {
    const d = await bord('31000000003', "N° de transaction : 31000000003\nTu peux déposer ton colis chez Mondial Relay ou Chronopost.");
    dit(d && d.transporteur === '', 'deux transporteurs nommés ⇒ rien (jamais choisi)', JSON.stringify(d && d.transporteur));
  });
  await essaie('aucun nom', async () => {
    const d = await bord('31000000004', "N° de transaction : 31000000004\nL’équipe Vinted : ton bordereau est prêt, rends-toi au point relais.");
    dit(d && d.transporteur === '' && d.suivi === '', 'aucun transporteur nommé ⇒ rien, et aucun n° inventé', JSON.stringify(d && [d.transporteur, d.suivi]));
  });
  await essaie('pièce', async () => {
    const o = await envoyer({ from: 'no-reply@vinted.fr', subject: "Bordereau d'envoi pour Nike", text: 'N° de transaction : 31000000005', attachments: [{ ...pdf('31000000005'), filename: 'Bordereau-Vinted-31000000005-chronopost.pdf' }] });
    const d = (o.ecrites.find((x) => x.id === 'email_bord_31000000005') || {}).data || null;
    dit(d && d.transporteur === '', 'le NOM de la pièce jointe ne nomme jamais le transporteur (seul le texte compte)', JSON.stringify(d && d.transporteur));
  });
  console.log(ko ? `\n❌ audit-transporteur-bordereau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-transporteur-bordereau : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
