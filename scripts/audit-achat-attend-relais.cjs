#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « COMMANDE MISE À JOUR » : L'ACHAT QUI T'ATTEND AU POINT RELAIS (3 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE route `api/email-inbound.js` (§4.10) contre une fausse base
// (forme réelle app_data owner/id/data), sur des e-mails FABRIQUÉS de la forme
// reçue par Julien le 3 nov. (texte avec liens de suivi `links.vinted.com/t/<b64>`
// vers `/inbox/<uuid>`, HTML en quoted-printable dans un MIME brut). Valeurs
// inventées (relais, rue, titres, conversations).
//   A  les 3 tournures (t'attend · t'attend ici + code · livré dans le Point
//      Relais) ⇒ une ligne de colis « à retirer », lieu lu, arrivée = date de
//      l'e-mail, échéance inconnue, code seulement s'il est écrit ;
//   I  identité = la conversation du lien : 50 achats au même titre ⇒ seule la
//      commande à CETTE conversation est reliée, jamais une par le titre ;
//      sans lien ⇒ ligne comptée, reliée à rien ; deux conversations ⇒ aucune ;
//   U  le même colis (deux e-mails Vinted ; e-mail Vinted + transporteur de la
//      même commande) = UNE ligne ; sans identité au même CP ⇒ « à vérifier » ;
//   N  les autres tournures de la famille restent « sans action » ;
//   E  lecture / écriture ratée ⇒ 503, rien d'écrit ;
//   R  relecture des e-mails déjà gardés (`email_inconnu_*`, corps coupé à
//      2 000) : même ligne que le serveur, idempotente, lecture ratée ⇒ rien.
'use strict';
const path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };
const J = '11111111-1111-4111-8111-111111111111';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const ADR = 'achats-banc_7q@icloud.com';
// ── La fausse base ─────────────────────────────────────────────────────────
let base = new Map();
let etat = {};
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
    if (id === 'vrm_email_owners') return rep([{ owner: J, data: { adresses: { [ADR]: { owner: J } } } }]);
    if (String(q.get('id') || '').startsWith('like.vrm_email_preuve_') || /vrm_email_preuve_/.test(u.search)) {
      const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js'));
      return rep([{ id: idPreuve(J, ADR), owner: J, adresse: ADR, etat: 'prouvee' }]);
    }
    if (etat.lectureKO && id === etat.lectureKO) return rep('<html>522</html>', 522);
    if (!id || !owner) return rep([]);
    const d = base.get(k(owner, id));
    return rep(d === undefined ? [] : [{ id, data: d }]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    if (etat.ecritureKO && lignes.some((l) => String(l.id).startsWith(etat.ecritureKO))) return rep('<html>503</html>', 503);
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (ignore && base.has(k(l.owner, l.id))) continue;
      base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(ignore ? out : '', 201);
  }
  if (methode === 'PATCH') {
    const kk = k(owner, id);
    if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    if (etat.ecritureKO && id.startsWith(etat.ecritureKO)) return rep('<html>503</html>', 503);
    base.set(kk, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};

const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
// ── Les e-mails fabriqués (forme du 3 nov., valeurs inventées) ──────────────
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const CONV = (n) => `0a1b2c3d-1111-7222-8333-${String(n).padStart(12, '0')}`;
const lienConv = (c) => `https://links.vinted.com/t/${b64(`https://www.vinted.fr/inbox/${c}?l=email.body.new_msg.view&login=true&source=email&t=in|inv_00000000-0000-4000-8000-000000000000|SIGNATUREBANC00000000000000000000000000000=`)}`;
const lienAccueil = `https://links.vinted.com/t/${b64('https://www.vinted.fr|inv_00000000-0000-4000-8000-000000000000|SIGBANC0000000000000000000000000000000=')}`;
const lienInsta = `https://links.vinted.com/e/t/${b64('https://www.instagram.com/vinted|inv_00000000-0000-4000-8000-000000000000|SIGBANC2=')}`;
const PHRASES = {
  attend: "Ton achat t'attend au point relais TABAC DU QUAI, 12 RUE DES MOUETTES, \n99990 PORTVILLE",
  ici: "Ta commande t'attend ici : Laverie Banc - Portville, 3 Rue du Phare, 99990 \nPortville. Utilise le code K48213 pour la retirer.",
  livre: "Ton colis a été livré dans le Point Relais TABAC DU QUAI, 12 RUE DES \nMOUETTES, 99990 PORTVILLE. Tu peux, dès maintenant, aller le récupérer.",
  route: "Ta commande est en cours d'acheminement ! La livraison est estimée au 5 \nnov. - 7 nov.",
};
const TEXTE = ({ forme = 'attend', conv = CONV(1), sansLien = false, deux = false } = {}) => ` E-mail Vinted \n<${lienAccueil}> \n  \nBonjour, \n\n${PHRASES[forme]}\n\nAller sur la conversation \n${sansLien ? '' : `<${lienConv(conv)}>`}${deux ? `\n<${lienConv(CONV(999))}>` : ''}\n  \n[image: Instagram] \n<${lienInsta}> \nCet e-mail t'a été envoyé par Vinted, UAB, Švitrigailos g. 13, LT-03228, \nVilnius, Lituanie \n`;
const HTML = (o = {}) => `<html><head><style>.x{color:#000!important}</style></head><body><table><tr><td><a href="${lienAccueil}"><img alt="E-mail Vinted"></a></td></tr><tr><td><p>Bonjour,</p><p>${PHRASES[o.forme || 'attend'].replace(/\n/g, '')}</p><p><a href="${lienConv(o.conv || CONV(1))}">Aller sur la conversation</a></p></td></tr><tr><td><a href="${lienInsta}">Instagram</a> Cet e-mail t&#39;a été envoyé par Vinted, UAB</td></tr></table></body></html>`;
const FROM = `"L'équipe Vinted" <no-reply_at_vinted_fr_banc000_abc@icloud.com>`;
let n = 0;
const json = (o = {}) => ({ messageId: o.mid || `<arr-${++n}@banc>`, from: FROM, to: ADR, subject: `Commande mise à jour pour ${o.titre || 'Baskets Banc 42'}`, text: TEXTE(o), html: '', attachments: [], source: 'gmail-v2', sourceDate: o.sourceDate || '2026-11-03T08:17:00.000Z' });
const qp = (s) => Buffer.from(s, 'utf8').toString('binary').split('').map((c) => { const b = c.charCodeAt(0); return (b > 126 || c === '=') ? '=' + b.toString(16).toUpperCase().padStart(2, '0') : c; }).join('').replace(/(.{70})/g, '$1=\r\n');
const mime = (o = {}) => [`From: ${FROM}`, `To: ${ADR}`, `Subject: =?UTF-8?Q?Commande_mise_=C3=A0_jour_pour_${(o.titre || 'Baskets Banc 42').replace(/ /g, '_')}?=`, `Message-ID: <arr-mime-${++n}@banc>`, 'Date: Tue, 3 Nov 2026 09:17:00 +0100', 'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="b1"', '', '--b1', 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: quoted-printable', '', qp(HTML(o)), '--b1--', ''].join('\r\n');

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-arr';
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?arr');
  let lib = {}, relu = {};
  try { lib = await import(path.join(R, 'api/_lib/achat-arrive-relais.js')); } catch (_) {}
  try { relu = await import(path.join(R, 'src/arriveesRelues.js')); } catch (_) {}
  const envoyer = async (body, e = {}) => { etat = e; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-arr' }, body }, res); return res; };
  const pistes = () => [...base.keys()].filter((x) => x.startsWith(J + '|email_track_')).map((x) => ({ id: x.split('|')[1], d: base.get(x) }));

  await essaie('A — les trois tournures', async () => {
    base = new Map();
    const r = await envoyer(json());
    const p = pistes();
    dit(r.code === 200 && r.corps && r.corps.type === 'suivi', 'A1 « t’attend au point relais » : classé colis (plus « sans action »), 200', JSON.stringify(r.corps).slice(0, 200));
    dit(p.length === 1 && p[0].id === `email_track_autre_conv-${CONV(1)}`, 'A2 UNE ligne, clé = la conversation du lien (jamais le titre)', p.map((x) => x.id).join(','));
    const d = p[0] && p[0].d || {};
    dit(d.status === 'available' && d.lieu === 'TABAC DU QUAI, 12 RUE DES MOUETTES, 99990 PORTVILLE', 'A3 à retirer, lieu lu en entier (nom, rue, CP ville — ligne coupée recollée)', JSON.stringify({ s: d.status, l: d.lieu }));
    dit(d.arriveLe === '2026-11-03T08:17:00.000Z' && !d.limite && !d.code, 'A4 arrivée = date de l’e-mail ; échéance inconnue ; code « pas encore reçu »', JSON.stringify({ a: d.arriveLe, l: d.limite, c: d.code }));
    dit(d.artTitle === 'Baskets Banc 42' && d.conv === CONV(1) && d.source === 'vinted-commande' && !d.suivi, 'A5 le titre est un LIBELLÉ (artTitle), la conversation l’identité, aucun n° de suivi inventé', JSON.stringify({ t: d.artTitle, c: d.conv, s: d.suivi }));
    const rec = [...base.entries()].find(([x]) => x.startsWith(J + '|email_reception_'));
    dit(rec && rec[1].etat !== 'erreur' && rec[1].type === 'suivi' && rec[1].resume && rec[1].resume.t === 'suivi' && rec[1].resume.lieu, 'A6 « ce que VRM en a fait » : colis (sans n° de suivi ⇒ journal « à vérifier », lieu dit)', JSON.stringify(rec && rec[1].resume));
    base = new Map();
    await envoyer(json({ forme: 'ici', conv: CONV(2) }));
    const d2 = (pistes()[0] || {}).d || {};
    dit(d2.code === 'K48213' && d2.consigne === true && d2.lieu === 'Laverie Banc - Portville, 3 Rue du Phare, 99990 Portville', 'A7 « t’attend ici » : code lu (K48213), consigne, lieu sans la phrase du code', JSON.stringify({ c: d2.code, l: d2.lieu }));
    base = new Map();
    await envoyer({ raw: mime({ conv: CONV(3) }) });
    const p3 = pistes();
    dit(p3.length === 1 && p3[0].id === `email_track_autre_conv-${CONV(3)}` && /99990 PORTVILLE/.test(p3[0].d.lieu || ''), 'A8 MIME brut, HTML quoted-printable (lien coupé par =\\r\\n) : même identité, même lieu', p3.map((x) => x.id + ' ' + x.d.lieu).join(','));
  });

  await essaie('U — un colis, une ligne (deux e-mails Vinted)', async () => {
    base = new Map();
    await envoyer(json({ sourceDate: '2026-10-30T10:00:00.000Z' }));
    await envoyer(json({ forme: 'livre', sourceDate: '2026-10-31T10:00:00.000Z' }));
    await envoyer(json({ sourceDate: '2026-10-30T10:00:00.000Z' }));   // rejeu
    const p = pistes();
    dit(p.length === 1, 'U1 « t’attend » puis « livré dans le Point Relais » (même conversation) + rejeu : UNE ligne', p.map((x) => x.id).join(','));
    dit(p[0] && p[0].d.arriveLe === '2026-10-30T10:00:00.000Z', 'U2 la PREMIÈRE arrivée reste l’arrivée', p[0] && p[0].d.arriveLe);
    base.set(k(J, p[0].id), { ...p[0].d, status: 'delivered', statusLabel: 'Livré / retiré' });
    await envoyer(json({ sourceDate: '2026-10-31T12:00:00.000Z' }));
    dit(base.get(k(J, p[0].id)).status === 'delivered', 'U3 un colis retiré n’est jamais redescendu « à retirer »');
  });

  await essaie('I — identité', async () => {
    base = new Map();
    await envoyer(json({ sansLien: true }));
    const p = pistes();
    dit(p.length === 1 && /^email_track_autre_arr-/.test(p[0].id) && p[0].d.conv === '' && p[0].d.status === 'available', 'I1 sans lien : le colis est COMPTÉ (ligne à retirer), relié à rien', p.map((x) => x.id).join(','));
    base = new Map();
    await envoyer(json({ deux: true }));
    const q = pistes();
    dit(q.length === 1 && q[0].d.conv === '', 'I2 deux conversations dans l’e-mail : aucune choisie', q[0] && q[0].d.conv);
    // 50 achats AU MÊME TITRE ; un seul porte la conversation.
    const achats = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 7000 + i, title: 'Baskets Banc 42', conversation_id: CONV(100 + i) }));
    const a = lib.achatParConversation && lib.achatParConversation(CONV(117), achats);
    dit(a && a.transaction_id === 7017, 'I3 50 achats au même titre : seule la commande de CETTE conversation', JSON.stringify(a));
    dit(lib.achatParConversation && lib.achatParConversation('', achats) === null && lib.achatParConversation(CONV(5), achats) === null, 'I4 sans conversation (ou inconnue) : personne — jamais par le titre');
    dit(lib.achatParConversation && lib.achatParConversation(CONV(5), [{ transaction_id: 1, title: 'Baskets Banc 42', conversation_id: CONV(6) }]) === null, 'I6 un SEUL achat au même titre mais d’une autre conversation : pas relié');
    dit(lib.achatParConversation && lib.achatParConversation(CONV(117), [...achats, { transaction_id: 9999, conversation_id: CONV(117) }]) === null, 'I5 deux commandes à la même conversation : personne');
  });

  await essaie('U — e-mail Vinted + e-mail transporteur', async () => {
    const R1 = lib.regrouperArrivees;
    const vinted = { source: 'vinted-commande', conv: CONV(1), lieu: 'TABAC DU QUAI, 12 RUE DES MOUETTES, 99990 PORTVILLE', artTitle: 'Baskets Banc 42', status: 'available' };
    const transp = { suivi: '12345678', code: '482913', lieu: 'TABAC DU QUAI, 12 RUE DES MOUETTES, 99990 PORTVILLE', status: 'available' };
    const cmd = { transaction_id: 7017 };
    const r = R1 ? R1([vinted, transp], { commandeDe: () => cmd, score: (t) => (t.code ? 4 : 0), fusion: (m, s) => ({ ...s, ...m }) }) : null;
    dit(r && r.liste.length === 1 && r.liste[0].code === '482913' && r.liste[0].artTitle === 'Baskets Banc 42' && !r.doutes.length, 'U4 même commande des deux côtés : UN colis (code du transporteur, libellé de Vinted)', JSON.stringify(r && r.liste));
    const r2 = R1 ? R1([vinted, transp], { commandeDe: () => null }) : null;
    dit(r2 && r2.liste.length === 1 && r2.liste[0] === transp && r2.doutes.length === 1 && r2.doutes[0] === vinted, 'U5 sans identité au même code postal : le transporteur compté, Vinted « à vérifier » (jamais deux fois, jamais caché)', JSON.stringify(r2 && { l: r2.liste.length, d: r2.doutes.length }));
    const r3 = R1 ? R1([vinted, { ...transp, lieu: 'RELAIS, 1 RUE X, 11110 AILLEURS' }], { commandeDe: () => null }) : null;
    dit(r3 && r3.liste.length === 2 && !r3.doutes.length, 'U6 sans identité dans une AUTRE ville : deux colis', JSON.stringify(r3 && r3.liste.length));
    const huit = Array.from({ length: 8 }, (_, i) => ({ ...vinted, conv: CONV(i + 1), artTitle: 'Baskets Banc 42' }));
    const r4 = R1 ? R1(huit, { commandeDe: () => null }) : null;
    dit(r4 && r4.liste.length === 8, 'U7 8 achats au même relais et au MÊME titre, sans transporteur : 8 colis (jamais fusionnés par le titre)', JSON.stringify(r4 && r4.liste.length));
  });

  await essaie('N — les autres tournures', async () => {
    base = new Map();
    const r = await envoyer(json({ forme: 'route' }));
    dit(r.corps && r.corps.type === 'connu-sans-action' && pistes().length === 0, 'N1 « en cours d’acheminement » : toujours sans action, aucun colis', JSON.stringify(r.corps).slice(0, 120));
  });

  await essaie('E — écritures sûres', async () => {
    base = new Map();
    const r = await envoyer(json(), { lectureKO: `email_track_autre_conv-${CONV(1)}` });
    dit(r.code === 503 && pistes().length === 0, 'E1 lecture de la ligne ratée : 503, rien d’écrit', String(r.code));
    base = new Map();
    const r2 = await envoyer(json(), { ecritureKO: 'email_track_' });
    dit(r2.code === 503 && pistes().length === 0, 'E2 écriture ratée : 503 (le service rejoue)', String(r2.code));
  });

  await essaie('R — relecture des e-mails déjà gardés', async () => {
    if (!relu.arriveesRelues) { dit(false, 'R relecture introuvable'); return; }
    // La forme gardée : le JSON reçu, coupé à 2 000 caractères.
    const garde = (o) => ({ id: 'email_inconnu_' + (++n), subject: `Commande mise à jour pour ${o.titre || 'Baskets Banc 42'}`, receivedAt: o.sourceDate || '2026-11-03T08:17:05.000Z', brut: JSON.stringify(json(o)).slice(0, 2000) });
    const rows = [garde({ conv: CONV(11) }), garde({ conv: CONV(12), titre: 'Baskets Banc 42' }), garde({ conv: CONV(11), forme: 'livre', sourceDate: '2026-11-04T08:00:00.000Z' }), garde({ forme: 'route', conv: CONV(13) })];
    let q = '';
    const out = await relu.arriveesRelues([], async (x) => { q = x; return rows; }, Date.parse('2026-11-03T12:00:00Z'));
    dit(/email_inconnu_/.test(q) && /select=id,subject/.test(q) && !/select=data(&|$)/.test(q), 'R1 lecture en projection (jamais select=data)', q.slice(0, 120));
    dit(out.length === 2 && out.every((t) => t.status === 'available' && /99990 PORTVILLE/.test(t.lieu)), 'R2 2 colis relus (deux achats au même titre restent deux ; « en route » écarté)', JSON.stringify(out.map((t) => t.cleLigne)));
    const c11 = out.find((t) => t.conv === CONV(11));
    dit(c11 && c11.arriveLe === '2026-11-03T08:17:00.000Z', 'R3 deux e-mails du même colis : une ligne, la première arrivée', c11 && c11.arriveLe);
    // Même ligne que le serveur.
    base = new Map(); await envoyer(json({ conv: CONV(12) }));
    const srv = base.get(k(J, `email_track_autre_conv-${CONV(12)}`));
    const rel = out.find((t) => t.conv === CONV(12));
    dit(srv && rel && srv.cleLigne === rel.cleLigne && srv.lieu === rel.lieu && srv.arriveLe === rel.arriveLe && srv.artTitle === rel.artTitle, 'R4 la relecture rend la MÊME ligne que le serveur', JSON.stringify({ s: srv && srv.cleLigne, r: rel && rel.cleLigne }));
    const out2 = await relu.arriveesRelues([srv], async () => rows, Date.parse('2026-11-03T12:00:00Z'));
    dit(out2.length === 2 && out2.filter((t) => t.conv === CONV(12)).length === 1, 'R5 déjà rangée par le serveur : pas de doublon (idempotent)', String(out2.length));
    const out3 = await relu.arriveesRelues([srv], async () => { throw new Error('522'); });
    dit(out3.length === 1 && out3[0] === srv, 'R6 lecture ratée : la liste telle quelle');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
