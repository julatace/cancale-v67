#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « AVIS 2★ REÇU SUR shop_x » (11 nov., lot avis-negatif)
// ════════════════════════════════════════════════════════════════════════════
//  R  la RÈGLE (src/avisNegatif.js), exécutée : forme mesurée seulement (pas de
//     tableau ⇒ « pas su »), 1re lecture = ligne de base (rien ne sonne), seuls les
//     avis AVANT le 1er connu sont neufs, aucun connu dans la page ⇒ rien, seuil,
//     jamais deux fois, vente seulement par le n° de transaction PORTÉ par l'avis,
//     le texte d'un avis jamais dans une notification ;
//  S  la ROUTE (api/_lib/avis-negatif.js + api/push.js action `avis`), exécutée
//     contre une fausse base (projections servies, owner/id, comparer-et-échanger),
//     téléphones interceptés : lecture ratée ⇒ rien écrit ni envoyé ; base ⇒ rien ;
//     un 2★ ⇒ UNE notification au bon lien ; rejouée ⇒ rien ; seuil réglé ; famille
//     coupée ⇒ carte gardée, rien envoyé ; compte d'un autre ⇒ 403 ; jamais
//     `select=data` sur une moisson ;
//  E  l'EXTENSION (vrai background.js dans sa VM) : le n° de transaction gardé s'il
//     est en chiffres, rien d'autre ajouté ; après une écriture RÉUSSIE, UN appel
//     `{ action:'avis', uid }` ; écriture refusée ⇒ aucun appel ; aucune requête
//     Vinted de plus ;
//  A  l'APP : la carte est dans « À faire » (comptée), lue en projection, la
//     feuille dit « Lis l'avis sur Vinted » sans texte ; le service worker n'ouvre
//     en direct que le lien des avis Vinted ; réglage du seuil branché ;
//  M  MUTATIONS : chaque règle réaffaiblie ⇒ rouge.
//  Données inventées (le dépôt est public).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');

// ── R : la règle, une batterie qui rend le nombre d'échecs (rejouée sur les mutants) ──
function batterieRegle(M, noter) {
  let e = 0;
  const v = (c, l, d) => { if (!c) e++; if (noter) dit(c, l, d); };
  const page = (...l) => l.map(([id, rating, tx]) => ({ id: String(id), rating, feedback: 'Texte inventé n°' + id, ...(tx ? { transaction_id: tx } : {}) }));
  // Forme
  v(M.avisDeLaLigne(undefined) === null && M.avisDeLaLigne({ items: [] }) === null && M.avisDeLaLigne('x') === null, 'R1 pas de tableau ⇒ « pas su » (null), jamais « aucun avis »');
  v(Array.isArray(M.avisDeLaLigne([])) && M.avisDeLaLigne([]).length === 0, 'R2 un tableau vide ⇒ aucun avis ([])');
  v(M.avisDeLaLigne([{ foo: 1 }, { id: 'x y', rating: 2 }]) === null, 'R3 une page dont aucun avis n’a la forme mesurée ⇒ « pas su »');
  const lus = M.avisDeLaLigne(page([10, 2], [9, 5.5], [8, 0], [7, 4, '123'], [7, 1]).concat([{ id: '6', rating: 3, transaction_id: 'abc' }]));
  v(lus && lus.map((a) => a.id).join(',') === '10,7,6', 'R4 note entière 1…5 seulement, identifiant unique (doublon écarté)', JSON.stringify(lus));
  v(lus && lus[1].tx === '123' && lus[2].tx === '' && lus[0].tx === '', 'R5 n° de transaction : chiffres seulement, sinon vide');
  // Ligne de base
  const t0 = Date.parse('2026-11-11T09:00:00Z');
  const b = M.detecterAvisBas(null, M.avisDeLaLigne(page([5, 1], [4, 2], [3, 5])), 3, t0);
  v(b.etat === 'base' && !b.bas && b.compte.ids.join(',') === '5,4,3', 'R6 1re lecture d’un compte = ligne de base : rien ne sonne (même un 1★)', JSON.stringify(b));
  v(M.detecterAvisBas(b.compte, null, 3, t0).etat === 'passu', 'R7 lecture « pas su » ⇒ rien changé');
  // Neufs
  const n1 = M.detecterAvisBas(b.compte, M.avisDeLaLigne(page([7, 2, '9001'], [6, 4], [5, 1], [4, 2], [3, 5])), 3, t0 + 864e5);
  v(n1.etat === 'lu' && n1.neufs.map((a) => a.id).join(',') === '7,6' && n1.bas.map((a) => a.id).join(',') === '7', 'R8 neufs = avant le 1er connu ; ≤ 3★ seulement (le 4★ ne sonne pas)', JSON.stringify(n1));
  v(n1.compte.ids.slice(0, 2).join(',') === '7,6' && n1.compte.base === b.compte.base, 'R9 les neufs sont retenus, la base garde sa date');
  const n2 = M.detecterAvisBas(n1.compte, M.avisDeLaLigne(page([7, 2, '9001'], [6, 4], [5, 1])), 3, t0 + 2 * 864e5);
  v(n2.etat === 'lu' && n2.bas.length === 0, 'R10 la même page relue ⇒ rien (jamais deux fois)');
  const n3 = M.detecterAvisBas(n1.compte, M.avisDeLaLigne(page([7, 2], [99, 1], [6, 4])), 3, t0);
  v(n3.etat === 'lu' && n3.bas.length === 0, 'R11 un avis qui reparaît APRÈS un connu (page qui glisse) n’est pas neuf', JSON.stringify(n3));
  const n4 = M.detecterAvisBas(n1.compte, M.avisDeLaLigne(page([50, 1], [51, 1])), 3, t0);
  v(n4.etat === 'ordre' && !n4.bas && n4.compte.ids.includes('50'), 'R12 aucun avis connu dans la page ⇒ « pas su » : rien ne sonne, retenus', JSON.stringify(n4));
  const vide = M.detecterAvisBas({ base: new Date(t0).toISOString(), ids: [] }, M.avisDeLaLigne(page([1, 2])), 3, t0);
  v(vide.etat === 'lu' && vide.bas.length === 1, 'R13 un compte sans avis à la base : le premier 2★ sonne');
  v(M.detecterAvisBas(b.compte, M.avisDeLaLigne(page([8, 3], [5, 1])), 2, t0).bas.length === 0 && M.detecterAvisBas(b.compte, M.avisDeLaLigne(page([8, 3], [5, 1])), 3, t0).bas.length === 1, 'R14 seuil 2★ : un 3★ ne sonne pas ; seuil 3★ : il sonne');
  v(M.reglageSeuilAvis({}) === 3 && M.reglageSeuilAvis({ avisSeuil: 2 }) === 2 && M.reglageSeuilAvis({ avisSeuil: 5 }) === 3 && M.reglageSeuilAvis({ avisSeuil: '2' }) === 3, 'R15 seuil : 1…4 entier, sinon 3');
  // Alertes : jamais deux fois
  const a1 = M.ajouterAlertes([], '111', n1.bas, t0);
  const a2 = M.ajouterAlertes(a1.alertes, '111', n1.bas, t0 + 1000);
  v(a1.neuves.length === 1 && a2.neuves.length === 0 && a2.alertes.length === 1, 'R16 la même alerte ajoutée deux fois ⇒ une seule');
  v(!JSON.stringify(a1.alertes).includes('Texte inventé') && !JSON.stringify(M.normaliserMemoireAvis({ comptes: { 111: { base: 'x', ids: [] } }, alertes: [{ uid: '111', id: '7', note: 2, at: t0, feedback: 'Texte inventé', login: 'acheteur' }] })).match(/Texte|acheteur/), 'R17 la mémoire ne garde ni texte ni pseudo (liste blanche)');
  // Liens
  v(M.lienVenteAvis('9001') === '/?tab=ventes&site=vinted&cible=vente&tx=9001' && M.lienVenteAvis('') === '' && M.lienVenteAvis('Air Max 90') === '', 'R18 la vente : seulement par un n° de transaction');
  v(M.lienAvisVinted({ domaine: 'www.vinted.fr', pid: '42', uid: '111' }) === 'https://www.vinted.fr/member/42?tab=feedback' && M.lienAvisVinted({ domaine: 'evil.com', uid: '111' }) === 'https://www.vinted.fr/member/111?tab=feedback', 'R19 le profil des avis : l’id de profil, sinon le compte ; domaine Vinted seulement');
  v(M.RE_LIEN_AVIS.test(M.lienAvisVinted({ pid: '42' })) && !M.RE_LIEN_AVIS.test('https://evil.com/member/42?tab=feedback'), 'R20 la forme du lien externe est fermée');
  // Texte de la notification
  const t1 = M.texteAvisBas({ nom: 'shop_x', avis: [{ note: 2, id: '7', tx: '' }] });
  v(t1 && t1.title === 'Avis 2★ reçu sur shop_x' && /Vinted/.test(t1.body), 'R21 « Avis 2★ reçu sur shop_x »', JSON.stringify(t1));
  const t2 = M.texteAvisBas({ nom: 'shop_x', avis: [{ note: 2, id: '7', tx: '9001' }] });
  v(t2 && /vente/.test(t2.body), 'R22 avis prouvé (transaction) ⇒ le texte parle de la vente');
  v(M.texteAvisBas({ nom: '', avis: [] }) === null, 'R23 rien à dire ⇒ pas de notification');
  // La carte
  const memo = { alertes: a1.alertes };
  v(M.alertesAMontrer(memo, {}, ['111'], t0).length === 1 && M.alertesAMontrer(memo, M.marquerVus({}, ['111:7'], t0), ['111'], t0).length === 0, 'R24 « C’est vu » efface la carte');
  v(M.alertesAMontrer(memo, {}, ['222'], t0).length === 0 && M.alertesAMontrer(memo, {}, ['111'], t0 + 15 * 864e5).length === 0, 'R25 compte retiré ou plus de 14 jours ⇒ pas de carte');
  v(M.texteDeLAvis(page([7, 2]), '7') === 'Texte inventé n°7' && M.texteDeLAvis(page([8, 2]), '7') === null && M.texteDeLAvis(null, '7') === null, 'R26 le texte : retrouvé par SON identifiant, sinon rien');
  return e;
}

// ── La fausse base (forme app_data owner/id/data ; projections de chemins) ──
const J = '11111111-1111-4111-8111-111111111111', K = '22222222-2222-4222-8222-222222222222';
let base, comptesV, panne, requetes;
const kk = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const chemin = (d, ch) => { let x = d; for (const seg of ch) { if (x == null) return undefined; x = x[seg]; } return x; };
function projeter(sel, id, d) {
  if (!sel || sel === 'data') return { id, data: d };
  const o = {};
  for (const p of sel.split(',')) {
    if (p === 'id') { o.id = id; continue; }
    const m = /^(?:(\w+):)?data((?:->>?\w+)+)$/.exec(p);
    if (!m) throw new Error('projection inconnue : ' + p);
    const segs = m[2].split(/->>?/).filter(Boolean);
    const v = chemin(d, segs);
    o[m[1] || segs[segs.length - 1]] = /->>\w+$/.test(m[2]) && v != null ? String(v) : v;
  }
  return o;
}
const filtreId = (q) => {
  const f = q.get('id') || '';
  if (f.startsWith('eq.')) { const x = f.slice(3); return (id) => id === x; }
  if (f.startsWith('like.')) { const re = new RegExp('^' + f.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$'); return (id) => re.test(id); }
  if (f.startsWith('in.(')) { const s = new Set(f.slice(4, -1).split(',')); return (id) => s.has(id); }
  return () => true;
};
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  requetes.push({ methode, chemin: u.pathname, recherche: decodeURIComponent(u.search) });
  if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (u.pathname.endsWith('/rest/v1/vinted_accounts')) {
    if (panne.has('vinted_accounts')) return rep('<html>522</html>', 522);
    return rep((comptesV[owner] || []).map((a) => ({ vinted_user_id: a.vinted_user_id, login: a.login, domain: a.domain })));
  }
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '').replace(/^eq\./, '');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (!owner) return rep([]);
    const garde = filtreId(q);
    const out = [];
    for (const [cle, d] of base) {
      const [o2, i2] = cle.split('|');
      if (o2 !== owner || !garde(i2)) continue;
      if ([...panne].some((p) => i2 === p || (p.endsWith('*') && i2.startsWith(p.slice(0, -1))))) return rep('<html>522</html>', 522);
      const t = q.get('data->>type'); if (t && (!d || d.type !== t.replace(/^eq\./, ''))) continue;
      out.push(projeter(q.get('select'), i2, d));
    }
    if (panne.has(id)) return rep('<html>522</html>', 522);
    return rep(out);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (panne.has('ecrire:' + l.id)) return rep('<html>522</html>', 522);
      if (ignore && base.has(kk(l.owner, l.id))) continue;
      base.set(kk(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(out, 201);
  }
  if (methode === 'PATCH') {
    const c = kk(owner, id);
    if (!owner || !base.has(c)) return rep([]);
    if (panne.has('ecrire:' + id)) return rep('<html>522</html>', 522);
    const d = base.get(c);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    base.set(c, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};
const pushes = [];
const TEL = 'https://web.push.apple.com/iphone-banc-avis';
const feedbacks = (...l) => ({ type: 'feedbacks', uid: '111', capturedAt: '2026-11-11T08:00:00Z', payload: { user_feedbacks: l.map(([id, rating, tx]) => ({ id: String(id), rating, feedback: 'Commentaire inventé ' + id, ...(tx ? { transaction_id: tx } : {}) })), pagination: { total_entries: 40 } } });
function prepare({ prefs = null } = {}) {
  base = new Map(); panne = new Set(); requetes = []; pushes.length = 0;
  comptesV = { [J]: [{ vinted_user_id: '111', login: 'shop_x', domain: 'www.vinted.fr' }, { vinted_user_id: '333', login: 'retire_y', domain: 'www.vinted.fr' }], [K]: [{ vinted_user_id: '222', login: 'autre_k', domain: 'www.vinted.fr' }] };
  base.set(kk(J, 'push_subs'), { subs: [{ endpoint: TEL, keys: { p256dh: 'x', auth: 'y' } }] });
  base.set(kk(J, 'vrm_blocked_accounts'), { uids: ['333'] });
  base.set(kk(J, 'harvest_111_profile'), { type: 'profile', payload: { user: { id: 4242, login: 'shop_x' } } });
  if (prefs) base.set(kk(J, 'push_prefs'), prefs);
}
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

async function batterieServeur(cheminLib, noter) {
  let e = 0;
  const v = (c, l, d) => { if (!c) e++; if (noter) dit(c, l, d); };
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
  const A = await import('file://' + cheminLib + '?' + Math.random());
  const comme = (o, f) => { P.oublierPrefsVues(); return contexteVendeur.run({ owner: o }, f); };
  const memo = () => base.get(kk(J, 'vrm_avis_bas'));
  const t0 = Date.parse('2026-11-11T11:00:00Z');

  // Lecture ratée ⇒ rien écrit ni envoyé.
  prepare(); base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([5, 5], [4, 4]));
  panne.add('harvest_111_feedbacks');
  let r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(r.status === 503 && !memo() && pushes.length === 0, 'S1 lecture des avis ratée ⇒ 503, rien écrit, rien envoyé', JSON.stringify(r));
  // Base : rien ne sonne, même avec un 1★.
  prepare(); base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([5, 1], [4, 4]));
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(r.status === 200 && !r.envoye && memo() && memo().comptes['111'] && memo().comptes['111'].ids.join(',') === '5,4' && pushes.length === 0, 'S2 1re lecture = ligne de base, même un 1★ ne sonne pas', JSON.stringify(r));
  // Un 2★ neuf ⇒ UNE notification, au lien des avis Vinted (pas de transaction).
  base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([7, 2], [6, 5], [5, 1], [4, 4]));
  r = await comme(J, () => A.notifierAvisBas({ uid: '111', maintenant: t0 + 3600e3 }));
  const p = pushes.slice();
  v(r.status === 200 && r.envoye && p.length === 1, 'S3 un 2★ neuf ⇒ UNE notification', JSON.stringify(r) + ' ' + p.length);
  v(p[0] && p[0].title === 'Avis 2★ reçu sur shop_x', 'S4 « Avis 2★ reçu sur shop_x »', p[0] && p[0].title);
  v(p[0] && p[0].url === 'https://www.vinted.fr/member/4242?tab=feedback', 'S5 sans transaction : le profil des avis sur Vinted (id de profil)', p[0] && p[0].url);
  v(p[0] && !JSON.stringify(p[0]).includes('Commentaire inventé'), 'S6 le texte de l’avis n’est jamais dans la notification');
  const al = memo() && memo().alertes;
  v(al && al.length === 1 && al[0].id === '7' && al[0].notifie && !JSON.stringify(memo()).includes('Commentaire'), 'S7 l’alerte est réservée (notifie) et la mémoire ne garde aucun texte', JSON.stringify(memo()));
  // Rejouée (extension + cron) ⇒ rien.
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 + 7200e3 }));
  r = await comme(J, () => A.notifierAvisBas({ uid: '111', maintenant: t0 + 7300e3 }));
  v(pushes.length === 1 && memo().alertes.length === 1, 'S8 rejouée deux fois ⇒ toujours une seule notification', String(pushes.length));
  // Avis PROUVÉ (transaction) ⇒ la vente.
  base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([8, 1, '90010'], [7, 2], [6, 5]));
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 + 9000e3 }));
  v(pushes.length === 2 && pushes[1].url === '/?tab=ventes&site=vinted&cible=vente&tx=90010', 'S9 avis qui porte son n° de transaction ⇒ la vente dans VRM', pushes[1] && pushes[1].url);
  // Seuil réglé à 2 : un 3★ ne sonne pas.
  prepare({ prefs: { avisSeuil: 2 } });
  base.set(kk(J, 'vrm_avis_bas'), { comptes: { 111: { base: '2026-11-01T00:00:00Z', ids: ['5'] } }, alertes: [], rev: 3 });
  base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([9, 3], [5, 5]));
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(pushes.length === 0 && memo().alertes.length === 0 && memo().comptes['111'].ids[0] === '9', 'S10 seuil 2★ réglé : le 3★ est retenu, ne sonne pas', JSON.stringify(r));
  // Famille coupée ⇒ carte gardée, rien envoyé.
  prepare({ prefs: { familles: { avis: false } } });
  base.set(kk(J, 'vrm_avis_bas'), { comptes: { 111: { base: '2026-11-01T00:00:00Z', ids: ['5'] } }, alertes: [], rev: 3 });
  base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([9, 1], [5, 5]));
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(pushes.length === 0 && memo().alertes.length === 1 && !memo().alertes[0].notifie, 'S11 famille « Avis » coupée : rien ne sonne, la carte de Ma journée reste', JSON.stringify(r));
  // Compte retiré : rien. Compte d'un autre vendeur : 403.
  prepare();
  base.set(kk(J, 'vrm_avis_bas'), { comptes: { 333: { base: '2026-11-01T00:00:00Z', ids: ['5'] } }, alertes: [], rev: 1 });
  base.set(kk(J, 'harvest_333_feedbacks'), feedbacks([9, 1], [5, 5]));
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(pushes.length === 0, 'S12 un compte retiré (bloqué) ne sonne jamais');
  r = await comme(J, () => A.notifierAvisBas({ uid: '222', maintenant: t0 }));
  v(r.status === 403 && pushes.length === 0, 'S13 un compte d’un AUTRE vendeur ⇒ 403', JSON.stringify(r));
  // Écriture de la mémoire refusée ⇒ rien envoyé.
  prepare();
  base.set(kk(J, 'vrm_avis_bas'), { comptes: { 111: { base: '2026-11-01T00:00:00Z', ids: ['5'] } }, alertes: [], rev: 1 });
  base.set(kk(J, 'harvest_111_feedbacks'), feedbacks([9, 1], [5, 5]));
  panne.add('ecrire:vrm_avis_bas');
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(r.status === 503 && pushes.length === 0, 'S14 la mémoire pas écrite ⇒ rien envoyé (réserver avant d’envoyer)', JSON.stringify(r));
  // Forme inconnue ⇒ rien.
  prepare();
  base.set(kk(J, 'vrm_avis_bas'), { comptes: { 111: { base: '2026-11-01T00:00:00Z', ids: ['5'] } }, alertes: [], rev: 1 });
  base.set(kk(J, 'harvest_111_feedbacks'), { type: 'feedbacks', payload: { feedbacks: [{ id: '9', rating: 1 }] } });
  r = await comme(J, () => A.notifierAvisBas({ maintenant: t0 }));
  v(pushes.length === 0 && memo().comptes['111'].ids.join(',') === '5', 'S15 forme inconnue (pas de user_feedbacks) ⇒ rien ne sonne, rien changé');
  // Jamais select=data sur une moisson.
  v(!requetes.some((x) => /harvest_/.test(x.recherche) && /select=data(&|$)/.test(x.recherche)), 'S16 aucune lecture `select=data` d’une ligne de moisson');
  return e;
}

// ── E : l'extension (vrai background.js) ──
async function batterieExtension(src, noter) {
  let e = 0;
  const v = (c, l, d) => { if (!c) e++; if (noter) dit(c, l, d); };
  const { faireFond } = require('./_fond-vm.cjs');
  const monter = ({ ecritureKO = () => false } = {}) => {
    const f = faireFond({ src, ecritureKO, vrm: () => ({ status: 200, body: { ok: true } }) });
    const c = f.ctx;
    c.getStoredAccounts = async () => [{ vinted_user_id: '111', domain: 'www.vinted.fr' }];
    c.gardeLecture = async () => null;
    f.vintedReq = [];
    c.vintedGet = async (_acc, p) => { f.vintedReq.push(p); return { ok: true, status: 200, json: { user_feedbacks: [{ id: '7', rating: 2, feedback: 'Bof', transaction_id: 90010, user: { login: 'acheteur' } }, { id: '6', rating: 5, feedback: 'Top', transaction_id: 'abc' }], pagination: { total_entries: 2 } } }; };
    f.push = () => f.j.vrmApi.filter((x) => /\/api\/push$/.test(String(x.url).split('?')[0]));
    return f;
  };
  const att = () => new Promise((r) => setTimeout(r, 40));
  let f = monter();
  await f.ctx.capterAvis('111'); await att();
  const l = f.lignes['harvest_111_feedbacks'];
  const av = l && l.payload && l.payload.user_feedbacks;
  v(av && av[0].transaction_id === '90010' && av[1].transaction_id === undefined, 'E1 le n° de transaction gardé en chiffres seulement', JSON.stringify(av));
  v(av && !JSON.stringify(av).includes('acheteur'), 'E2 aucun pseudo ni personne rangé');
  const p = f.push();
  v(p.length === 1 && JSON.stringify(p[0].corps) === JSON.stringify({ action: 'avis', uid: '111' }) && p[0].headers && /^Bearer /.test(p[0].headers.Authorization || ''), 'E3 après l’écriture : UN appel { action:"avis", uid }, avec la session', JSON.stringify(p.map((x) => x.corps)));
  v(f.vintedReq.length === 1, 'E4 aucune requête Vinted de plus (une seule, celle des avis)', String(f.vintedReq.length));
  f = monter({ ecritureKO: (id) => /feedbacks/.test(String(id)) || true });
  await f.ctx.capterAvis('111'); await att();
  v(f.push().length === 0, 'E5 écriture refusée par la base ⇒ aucun appel', String(f.push().length));
  return e;
}

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  webpush.sendNotification = async (sub, body) => { pushes.push({ tel: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };
  const regle = path.join(R, 'src', 'avisNegatif.js');
  const lib = path.join(R, 'api', '_lib', 'avis-negatif.js');
  const bg = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(R, 'vinted-sync-extension', 'background.js'); })();

  await essaie('R', async () => {
    if (!fs.existsSync(regle)) { dit(false, 'R0 la règle src/avisNegatif.js existe'); return; }
    const M = await import('file://' + regle);
    batterieRegle(M, true);
  });
  await essaie('S', async () => {
    if (!fs.existsSync(lib)) { dit(false, 'S0 la route api/_lib/avis-negatif.js existe'); return; }
    await batterieServeur(lib, true);
    const push = lire('api/push.js');
    dit(/body\.action === 'avis'/.test(push) && /notifierAvisBas\(\{ uid:/.test(push), 'S17 /api/push sait l’action `avis` (l’extension)');
    dit(/await notifierAvisBas\(\)/.test(lire('api/ship-reminders.js')), 'S18 le cron du matin et du soir est le filet');
    const T = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
    dit(T.FAMILLE_DE.avis === 'avis' && T.FAMILLES.some((x) => x.id === 'avis' && x.def === true), 'S19 famille « Avis négatif reçu », allumée par défaut');
    const B = await import('file://' + path.join(R, 'api', '_lib', 'notif-belle.js'));
    dit(B.ICONE_FAMILLE.avis === 'star' && /\bstar:\s*</.test(lire('src/App.jsx')), 'S20 son icône existe (ICON_PATHS.star)');
  });
  await essaie('E', async () => { await batterieExtension(bg, true); });
  await essaie('A', async () => {
    const app = lire('src/App.jsx').replace(/\/\/[^\n]*/g, '');
    const j = lire('src/AvisNegatifJournee.jsx');
    dit((/\.\.\.\(avisBasListe\.length \? \[\{ el: carteAvisBas\(\) \}\] : \[\]\)/.test(app) || (/'avis-bas': avisBasListe\.length \? \[carteAvisBas\(\)\] : \[\],/.test(app) && /'avis-bas': avisBasListe\.length \? 1 : 0/.test(app))) && /\+ \(avisBasListe\.length \? 1 : 0\)/.test(app), 'A1 la carte est dans « À faire » et comptée parmi les gestes');
    dit(/select=a:data->alertes/.test(app) && /select=id,avis:data->payload->user_feedbacks/.test(app) && !/LIGNE_AVIS_BAS\}&select=data/.test(app), 'A2 lue en projection (alertes, avis, profil)');
    dit(/Lis l’avis sur Vinted\./.test(j) && /data-avis-texte-absent/.test(j), 'A3 sans texte rangé : « Lis l’avis sur Vinted. »');
    dit(/a\.vente \?/.test(j) && /lienVenteAvis\(a\.tx\)/.test(j), 'A4 « Voir la vente » seulement par le n° de transaction de l’avis');
    const sw = lire('public/sw.js');
    dit(/member\\\/\\d\{1,20\}\\\?tab=feedback\$\/\.test\(url\)\) \{ event\.waitUntil\(clients\.openWindow\(url\)\)/.test(sw), 'A5 le service worker n’ouvre en direct que le lien des avis Vinted');
    const reg = lire('src/ecrans/Reglages.jsx');
    dit(/data-np-avis-choix/.test(reg) && /suite\.avisSeuil = v/.test(reg) && /ids: \['comptes', 'avis'\]/.test(reg), 'A6 Paramètres → Notifications : la famille et le seuil (push_prefs.avisSeuil)');
  });

  // ── M : mutations ──
  await essaie('M', async () => {
    if (!fs.existsSync(regle)) { dit(false, 'M0 pas de règle à muter'); return; }
    const src = fs.readFileSync(regle, 'utf8');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-mut-'));
    const MUT = [
      ['la ligne de base sonne', 'if (!connu || !ms(connu.base)) return {', 'if (false) return {'],
      ['« aucun connu » sonne quand même', "if (i === -1) return avis.length ?", 'if (false) return avis.length ?'],
      ['seuil ignoré', 'bas: neufs.filter((a) => a.note <= s)', 'bas: neufs'],
      ['forme inconnue = aucun avis', 'if (!Array.isArray(liste)) return null;', 'if (!Array.isArray(liste)) return [];'],
      ['n° de transaction pris tel quel', "tx: RE_TX.test(t) ? t : ''", 'tx: t'],
      ['alerte ajoutée deux fois', 'if (x && !cles.has(cleAlerte(x)))', 'if (x)'],
      ['un avis qui reparaît compte comme neuf', 'neufs = avis.slice(0, i).filter((a) => !set.has(a.id));', 'neufs = avis.filter((a) => !set.has(a.id) || a.id === "99");'],
      ['vente devinée sans n°', "lienVenteAvis = (tx) => (RE_TX.test(String(tx || '')) ?", 'lienVenteAvis = (tx) => (true ?'],
      ['« vu » sans effet', '!v[cleAlerte(a)] &&', 'true &&'],
    ];
    for (const [nom, de, vers] of MUT) {
      if (!src.includes(de)) { dit(false, `M · « ${nom} » : motif introuvable`, de); continue; }
      const f = path.join(tmp, `m${MUT.indexOf([nom, de, vers])}-${Math.random().toString(36).slice(2)}.mjs`);
      fs.writeFileSync(f, src.replace(de, vers));
      const M = await import('file://' + f);
      let e; try { e = batterieRegle(M, false); } catch (_) { e = 1; }
      dit(e > 0, `M · « ${nom} » ⇒ rouge`, `${e} contrôle(s)`);
    }
    // Serveur : la garde du compte et la lecture ratée.
    const srcLib = fs.readFileSync(lib, 'utf8');
    const MUTS = [
      ['compte d’un autre accepté', "if (uid && !presents.has(String(uid))) return", 'if (false) return'],
      ['envoyé sans réserver', 'if (r === null) return { status: 503', 'if (false) return { status: 503'],
      ['lecture ratée ignorée', 'if (comptes === null || bloques === null || lignes === null) return', 'if (comptes === null || bloques === null) return'],
    ];
    for (const [nom, de, vers] of MUTS) {
      if (!srcLib.includes(de)) { dit(false, `M · « ${nom} » : motif introuvable`, de); continue; }
      const f = path.join(path.dirname(lib), `.mut-avis-${Math.random().toString(36).slice(2)}.js`);
      fs.writeFileSync(f, srcLib.replace(de, vers));
      let e;
      try { e = await batterieServeur(f, false); } catch (_) { e = 1; } finally { fs.rmSync(f, { force: true }); }
      dit(e > 0, `M · « ${nom} » ⇒ rouge`, `${e} contrôle(s)`);
    }
    // Extension : le signal même sur une écriture refusée.
    const srcBg = fs.readFileSync(bg, 'utf8');
    const de = "if (ok !== false) await signalerAvisLus(uid);";
    if (srcBg.includes(de)) {
      const f = path.join(tmp, 'bg-mut.js'); fs.writeFileSync(f, srcBg.replace(de, 'await signalerAvisLus(uid);'));
      let e; try { e = await batterieExtension(f, false); } catch (_) { e = 1; }
      dit(e > 0, 'M · « signal sur une écriture refusée » ⇒ rouge', `${e} contrôle(s)`);
    } else dit(false, 'M · signal : motif introuvable');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
