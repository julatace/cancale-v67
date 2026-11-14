// ════════════════════════════════════════════════════════════════════════════
//  Une base INVENTÉE au volume de Julien pour Messages, E-mails et Stock (14 nov.) :
//  1 000 conversations (3 comptes Vinted, pseudos longs), 1 000 e-mails (servis par
//  la vraie forme de `/api/email-rattacher?mode=journal`, 50 par page), 1 000 paires
//  en ligne numérotées (le Stock les lit dans le dressing complet du premier compte).
//  Aucune donnée réelle : prénoms, pseudos, modèles et montants sont fabriqués.
//  Utilisée par refonte-messages-stock.cjs (et pour les captures avant/après).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const P = require('./design-passe.cjs');

const PRENOMS = ['lea', 'thomas', 'ines', 'hugo', 'chloe', 'lucas', 'manon', 'nathan', 'camille', 'jules', 'sarah', 'louis', 'emma', 'adam', 'zoe', 'gabriel', 'jade', 'raphael', 'lina', 'arthur'];
const SUFFIXES = ['_sneakers', '.martin92', '_vintage_paris', '1307', '_shop', '.dubois', '_kicks_collector_officiel', '75', '-dressing', '_lyon69'];
const MARQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'];
const MOD = ['Samba OG', 'Spezial', 'Air Max 1', 'XT-6', 'Gazelle', '550', 'Gel-1130', 'Old Skool', 'Dunk Low Panda', 'Campus 00s'];
const MOTS = [
  'Bonjour, est-elle toujours disponible ?', 'Elle taille normalement ?', 'Je vous propose 45 € livraison comprise', 'Merci beaucoup, bien reçue !',
  'Possible d’avoir une photo de la semelle ?', 'Vous faites un lot avec la paire grise ?', 'C’est bon pour moi, je paie ce soir', 'Est-ce que la boîte est fournie ?',
  'Super, merci pour l’envoi rapide 🙏', 'Il y a des traces sur le côté gauche ?', 'Je peux passer la récupérer à Paris 11 ?', 'Dernier prix ?',
];
const NOW = Date.now(), J = 86400000;
const pseudo = (i) => PRENOMS[i % PRENOMS.length] + SUFFIXES[(i * 7) % SUFFIXES.length] + (i >= 200 ? String(i % 97) : '');

// ── 1 000 paires en ligne (premier compte), 1 000 conversations (trois comptes) ──
function baseVolume() {
  const b = P.base();
  const num = b.main[0].data.vinted_annonce_numeros;
  const a0 = b.accounts[0]; const uid0 = a0.vinted_user_id;
  const lst = b.rows.find((r) => r.id === `harvest_${uid0}_listings`);
  const items = [];
  for (let i = 0; i < 1000; i++) {
    const id = 7600000000 + i;
    const t = NOW - (i % 220 + 1) * J;
    items.push({ id, title: `${MARQ[i % 6]} ${MOD[i % 10]} taille ${36 + (i % 10)}`, brand_title: MARQ[i % 6], size_title: String(36 + (i % 10)), status: 'Très bon état',
      price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: i % 5, view_count: 10 + (i % 40),
      created_at_ts: new Date(t).toISOString(), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor(t / 1000) } } });
    num[id] = { numero: String(1200 + i), num: String(1200 + i), accountId: String(uid0), numberedAt: new Date(t).toISOString(), title: items[i].title, photo: items[i].photo.url };
  }
  lst.data.payload.items = items; lst.data.nItems = items.length; lst.data.payload.pagination = { total_entries: items.length };
  const enl = b.rows.find((r) => r.id === `harvest_${uid0}_enligne`);
  if (enl) { enl.data.n = items.length; enl.data.ids = items.map((x) => x.id); enl.data.items = items.map((x) => ({ id: x.id, title: x.title })); }
  b.main[0].data.vinted_used_nums = Object.values(num).map((x) => Number(x.numero || x.num));
  // Conversations : on remplace celles de la base (boîte + fils) par 1 000, réparties sur les comptes.
  b.rows = b.rows.filter((r) => !/_inbox$|_conv_\d+$/.test(r.id));
  const parCompte = b.accounts.map(() => []);
  let c = 51000000000;
  for (let i = 0; i < 1000; i++) {
    const k = i % b.accounts.length, a = b.accounts[k], uid = a.vinted_user_id;
    const it = items[(i * 13) % items.length];
    const id = c++; const at = new Date(NOW - (i * 47 + 3) * 60000).toISOString();
    const corps = MOTS[i % MOTS.length]; const deMoi = i % 4 === 1;
    const offre = i % 9 === 4;
    parCompte[k].push({ id, unread: i < 18 && !deMoi, updated_at: at, opposite_user: { id: 900000 + i, login: pseudo(i), photo: null }, item_count: 1, description: corps, is_deletion_restricted: false });
    const msgs = [
      { id: id * 10, entity_type: 'message', created_at_ts: new Date(Date.parse(at) - 3600000).toISOString(), entity: { body: 'Bonjour ! Elle est encore dispo ?', user_id: 900000 + i } },
      { id: id * 10 + 1, entity_type: 'message', created_at_ts: new Date(Date.parse(at) - 1800000).toISOString(), entity: { body: 'Bonjour, oui toujours disponible 🙂', user_id: Number(uid) } },
    ];
    if (offre) msgs.push({ id: id * 10 + 2, entity_type: 'offer_request_message', created_at_ts: at, entity: { title: 'Offre', price: { amount: '48.0', currency_code: 'EUR' }, status: 10, user_id: 900000 + i } });
    else msgs.push({ id: id * 10 + 2, entity_type: 'message', created_at_ts: at, entity: { body: corps, user_id: deMoi ? Number(uid) : 900000 + i } });
    b.rows.push({ id: `harvest_${uid}_conv_${id}`, data: { capturedAt: at, payload: { conversation: { id, opposite_user: { id: 900000 + i, login: pseudo(i) }, current_user_side: 'seller',
      transaction: { id: 61000000000 + i, item_id: it.id, status: 1, item_title: it.title, item_photo: { url: it.photo.url } }, allow_reply: true, messages: msgs } } } });
  }
  b.accounts.forEach((a, k) => b.rows.push({ id: `harvest_${a.vinted_user_id}_inbox`, data: { capturedAt: new Date(NOW - 60000).toISOString(), payload: { conversations: parCompte[k], pagination: { current_page: 1, total_pages: 1 } } } }));
  return b;
}

// ── 1 000 e-mails, dans la forme de la route (`/api/email-rattacher?mode=journal`) ──
const idMail = (i) => 'email_reception_' + String(i).padStart(5, '0') + 'e'.repeat(56);
const SORTES = [
  (i) => ({ type: 'suivi', subject: `Votre colis ${4180000 + i} est disponible`, from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: String(4180000 + i), st: 'available', code: String(300000 + (i * 7919) % 699999), lieu: 'Relais Tabac du Port', lim: '19/11/2026' } }),
  (i) => ({ type: 'bordereau', subject: `Bordereau d'envoi pour ${MARQ[i % 6]} ${MOD[i % 10]}`, from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: String(62000000000 + i), n: String(1200 + (i % 1000)), pdf: 1, a: `${MARQ[i % 6]} ${MOD[i % 10]}` }, pj: 1 }),
  (i) => ({ type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: `${MARQ[i % 6]} ${MOD[i % 10]}`, px: String(40 + i % 60), n: String(1200 + (i % 1000)) } }),
  (i) => ({ type: 'offre', subject: `Nouvelle offre sur ${MOD[i % 10]}`, from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'offre', mt: String(30 + i % 40) } }),
  (i) => ({ type: 'suivi', subject: `Votre colis CH${500000 + i} est en route`, from: 'Chronopost <suivi@chronopost.fr>', resume: { v: 1, t: 'suivi', s: 'CH' + (500000 + i), st: 'transit' } }),
  (i) => ({ type: 'achat', subject: `Ton reçu pour la commande « ${MARQ[i % 6]} ${MOD[(i + 3) % 10]} »`, from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: String(63000000000 + i), a: `${MARQ[i % 6]} ${MOD[(i + 3) % 10]}`, px: '45,00', pdf: 1 }, pj: 1 }),
  (i) => ({ type: 'connu-sans-action', subject: 'Les nouveautés de la semaine', from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' } }),
];
const ADRESSES = [{ adresse: 'boutique.un@exemple.test', nom: 'atelier_sneakers_paris' }, { adresse: 'boutique.deux@exemple.test', nom: 'second_compte_vintage' }, { adresse: 'boutique.trois@exemple.test', nom: 'troisieme_dressing_lyon69' }];
const EMAILS = Array.from({ length: 1000 }, (_, i) => {
  const s = SORTES[i % SORTES.length](i); const ad = ADRESSES[i % 3];
  return { id: idMail(i), at: new Date(NOW - (i * 37 + 5) * 60000).toISOString(), etat: 'integre', pj: 0, ...s, adresses: [ad.adresse], compte: { id: String(i % 3 + 1), nom: ad.nom }, compteAmbigu: false, sourceDate: null, lu: i >= 14 };
});
const RUB = (e) => (e.type === 'suivi' && e.resume && e.resume.code ? 'codes' : ['vente', 'finalisation', 'vente-vestiaire'].includes(e.type) ? 'ventes' : e.type === 'achat' ? 'achats' : ['suivi', 'bordereau'].includes(e.type) ? 'colis' : e.type === 'offre' ? 'offres' : 'autres');
const dansRub = (e, r) => !r || (r === 'colis' ? ['colis', 'codes'].includes(RUB(e)) : RUB(e) === r);
const compteurs = (l) => { const pr = { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 }; l.forEach((e) => { const r = RUB(e); pr[r]++; if (r === 'codes') pr.colis++; }); return { sur: l.length, plus: false, integre: l.length, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: pr }; };
// La route : `api(url)` du banc design-passe (une réponse JSON, ou rien).
function apiVolume(u) {
  const url = new URL(u);
  if (url.pathname !== '/api/email-rattacher') return null;
  const q = Object.fromEntries(url.searchParams.entries());
  if (q.mode === 'reception') return { ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false };
  if (q.mode !== 'journal') return null;
  if (q.lire) { const e = EMAILS.find((x) => x.id === q.lire); return { ok: true, id: q.lire, email: e ? { ...e, receivedAt: e.at, pieces: e.pj ? [{ n: 'Bordereau-Vinted.pdf', t: 'application/pdf', o: 48211 }] : [], texte: `Bonjour,\n\n${e.subject}.\n\nÀ bientôt sur Vinted.`, texteCoupe: false } : null }; }
  let l = EMAILS.filter((e) => dansRub(e, q.boite || ''));
  if (q.adresse) l = l.filter((e) => e.adresses.includes(q.adresse));
  if (q.cherche) { const c = q.cherche.toLowerCase(); l = l.filter((e) => (e.subject + ' ' + JSON.stringify(e.resume || {})).toLowerCase().includes(c)); }
  if (q.nonlus) l = l.filter((e) => !e.lu);
  const p = Number(q.page || 0), n = Number(q.parPage || 50);
  return { ok: true, page: p, parPage: n, suite: l.length > (p + 1) * n, emails: l.slice(p * n, p * n + n), compteurs: { ...compteurs(l), ...(q.adresse ? { adresse: q.adresse } : {}) }, adresses: ADRESSES };
}

module.exports = { baseVolume, apiVolume, EMAILS, base: baseVolume, api: apiVolume };
