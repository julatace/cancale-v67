// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : ARGENT ET PRIX (14 nov., lot argent-prix — propositions 112 à 122)
//   112 retours ET litiges par modèle, deux taux    · 113 offres acceptées et PAYÉES
//   114 soldes : aucune remise sans son clic         · 115 lien comptable : la compta seule
//   116 révision du mois                             · 121 la même paire à deux prix (identité)
//   122 le prix à afficher : aller-retour prix ⇄ net au centime
// Il EXÉCUTE les vraies règles (src/*.js, api/_lib/comptable-lien.js, le vrai
// `baisserPrixVinted` de background.js dans un vm) sur des données INVENTÉES. Lecture seule.
// Lancer : node scripts/audit-argent-prix.cjs [--mutation=<nom>]   (une mutation ⇒ rouge exigé)
//   mutations : taux payee attente origine relu date whitelist expire signature double voulu
//               inverse arrondi revision ext clic
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ap-'));
const filtre = (s) => !/\.(png|jpe?g|webp|mp4|onnx|woff2?|zip)$/i.test(s);
fs.cpSync(path.join(R, 'src'), path.join(T, 'src'), { recursive: true, filter: filtre });
fs.cpSync(path.join(R, 'api'), path.join(T, 'api'), { recursive: true, filter: filtre });
fs.mkdirSync(path.join(T, 'ext'), { recursive: true });
fs.copyFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), path.join(T, 'ext', 'background.js'));
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  taux: ['src/litigesEcran.js', 'const tx_ = (n, d) => (d >= SEUIL_TAUX_RETOURS ?', 'const tx_ = (n, d) => (d >= 1 ?'],
  payee: ['src/tauxOffres.js', "else if (o === derniere && vendus.has(tx)) e = 'payee';", "else if (vendus.has(tx)) e = 'payee';"],
  attente: ['src/tauxOffres.js', "else if (o === derniere && maintenant - o.ts < attenteMs) e = 'attente';", ''],
  origine: ['src/soldes.js', '    if (avant) p.origine = avant.origine;     // le PREMIER prix d\'origine reste\n', ''],
  relu: ['src/soldes.js', "if (!l || !r || !r.accepte || r.etape !== 'fait' || l.id == null)", "if (!l || !r || !r.accepte || l.id == null)"],
  date: ['src/soldes.js', "s.fin <= auj)", "s.fin)"],
  whitelist: ['api/_lib/comptable-lien.js', "achats: liste(d.achats, (a) => ({ date:", "achats: liste(d.achats, (a) => ({ fournisseur: txt(a && a.fournisseur), date:"],
  expire: ['api/_lib/comptable-lien.js', "if (!Number.isFinite(exp) || exp <= maintenant) return { ok: false, raison: 'expire', exp };", "if (!Number.isFinite(exp)) return { ok: false, raison: 'expire', exp };"],
  signature: ['api/_lib/comptable-lien.js', "if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(sig))) return { ok: false, raison: 'signature' };", ''],
  double: ['src/ecartsPrix.js', "if (doubles.length) { nonJuges.push({ num: g.num, raison: 'deux', sites: doubles }); continue; }", ''],
  voulu: ['src/ecartsPrix.js', '(attendu ? voulus : ecarts).push(ligne);', 'ecarts.push(ligne);'],
  inverse: ['src/prixVoulu.js', '  while (netDe(P, taux) < net) P += 1;\n', ''],
  arrondi: ['src/prixVoulu.js', 'const arrondi = Math.ceil(P / 100) * 100;', 'const arrondi = Math.round(P / 100) * 100;'],
  revision: ['src/revisionMois.js', "if (l[0] === 'Vinted' && !String(l[9] || '')) manques.push('versement');", "if (!String(l[9] || '')) manques.push('versement');"],
  ext: ['ext/background.js', 'return Number.isInteger(avantC) && Number.isInteger(vouluC) && avantC > 0 && vouluC > avantC && o === vouluC && vouluC <= avantC * 10;', 'return Number.isInteger(avantC) && Number.isInteger(vouluC) && avantC > 0 && vouluC > avantC;'],
  clic: ['src/ArgentPrix.jsx', 'data-remise-lancer={aRemettre.length} disabled={!aRemettre.length || !!extRaison} onClick={lancer}', 'data-remise-lancer={aRemettre.length} disabled={!aRemettre.length || !!extRaison} onClick={lancer} ref={() => { lancer(); }}'],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('(mutation : ' + MUT + ')');
}
const imp = (rel) => import(pathToFileURL(path.join(T, rel)).href);
const lire = (rel) => fs.readFileSync(path.join(T, rel), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  // ── 112 ────────────────────────────────────────────────────────────────────
  console.log('── 112. Retours et litiges par modèle');
  {
    const L = await imp('src/litigesEcran.js');
    const ventes = [];
    const v = (tx, title, status, brand = 'Nike') => ventes.push({ transaction_id: tx, title, status, brand_title: brand, transaction_user_status: '' });
    for (let i = 0; i < 10; i++) v(1000 + i, 'Nike Dunk Low panda 42', i < 2 ? 'Retour initié' : i === 2 ? 'Transaction suspendue' : 'Commande finalisée');
    v(2000, 'Nike Air Max 90 blanche', 'Retour initié'); v(2001, 'Nike Air Max 90 blanche', 'Commande finalisée');
    const etats = (tx) => (String(tx).startsWith('100') && Number(tx) < 1002 ? { s: 440 } : null);
    const r = L.retoursParModele({ ventes, etats, emails: [] });
    const dunk = r.lignes.find((l) => /dunk/.test(l.cle));
    const am90 = r.lignes.find((l) => /air max 90/.test(l.cle));
    dit(dunk && dunk.ventes === 10 && dunk.retours === 2 && dunk.litiges === 1 && dunk.tauxRetour === 20 && dunk.tauxLitige === 10, '112.1 Dunk : 2 retours et 1 litige sur 10 ⇒ deux taux À PART (20 % · 10 %)', JSON.stringify(dunk));
    dit(am90 && am90.ventes === 2 && am90.tauxRetour === null && am90.tauxLitige === null, '112.2 moins de 3 ventes du modèle ⇒ taux « — » (les nombres restent)', JSON.stringify(am90));
    dit(r.couverture && r.couverture.ventes === 12, '112.3 la couverture : sur 12 ventes prouvées', JSON.stringify(r.couverture));
    const vide = L.retoursParModele({ ventes: null });
    dit(vide.etat === 'passu' && !vide.lignes.length, '112.4 ventes pas lues ⇒ « pas su », jamais 0 %');
  }

  // ── 113 ────────────────────────────────────────────────────────────────────
  console.log('── 113. Offres acceptées et payées');
  {
    const O = await imp('src/tauxOffres.js');
    const NOW = Date.UTC(2026, 10, 14, 12);
    const jour = 86400000;
    const offre = (id, st, ts) => ({ entity_type: 'offer_request_message', created_at_ts: new Date(ts).toISOString(), entity: { user_id: 9, offer_request_id: id, status: st } });
    const conv = (compte, tx, msgs) => ({ compte, side: 'seller', opp: 9, tx, messages: msgs });
    const convs = [
      conv('111', 'T1', [offre('a', 20, NOW - 10 * jour)]),                                  // acceptée, vendue ⇒ payée
      conv('111', 'T2', [offre('b', 20, NOW - 9 * jour)]),                                   // acceptée, pas de vente ⇒ non payée
      conv('111', 'T3', [offre('c', 20, NOW - 3600000)]),                                    // acceptée il y a 1 h ⇒ en attente
      conv('111', '', [offre('d', 20, NOW - 8 * jour)]),                                     // pas de transaction ⇒ pas su
      conv('111', 'T5', [offre('e', 20, NOW - 7 * jour), offre('f', 20, NOW - 6 * jour)]),   // deux acceptées, une vente ⇒ la dernière payée
      conv('111', 'T6', [offre('g', 30, NOW - 5 * jour)]),                                   // refusée
      conv('222', 'T7', [offre('h', 20, NOW - 5 * jour)]),
    ];
    // 50 conversations au MÊME titre d'annonce pour le compte 333 : seule l'identité (tx) compte.
    for (let i = 0; i < 50; i++) convs.push(conv('333', 'X' + i, [offre('x' + i, 20, NOW - 4 * jour)]));
    const ventes = [{ plateforme: 'Vinted', tx: 'T1', uid: '111' }, { plateforme: 'Vinted', tx: 'T5', uid: '111' }, { plateforme: 'Vinted', tx: 'T7', uid: '222' }, { plateforme: 'Vinted', tx: 'X7', uid: '333' }];
    const lectures = { 111: NOW, 222: NOW, 333: NOW };
    const S = O.tauxOffresComptes({ convs, ventes, lectures, de: NOW - 30 * jour, a: NOW + 1, maintenant: NOW });
    const c1 = S.comptes.find((c) => c.compte === '111'), c3 = S.comptes.find((c) => c.compte === '333');
    dit(c1 && c1.recues === 7 && c1.acceptees === 6, '113.1 compte 111 : 7 offres reçues, 6 acceptées', JSON.stringify(c1));
    dit(c1 && c1.payees === 2 && c1.nonPayees === 2 && c1.attente === 1 && c1.passu === 1, '113.2 payée = sa transaction est une vente (2) ; non payée (2 : sans vente + la 1re des deux acceptées) ; en attente < 48 h (1) ; sans transaction ⇒ pas su (1)', JSON.stringify(c1));
    dit(c1 && c1.tauxAcceptation === 85.7 && c1.tauxPaiement === 50, '113.3 taux : 85,7 % acceptées, 50 % payées (sur les seules jugées)', `${c1 && c1.tauxAcceptation} / ${c1 && c1.tauxPaiement}`);
    dit(c3 && c3.payees === 1 && c3.nonPayees === 49, '113.4 50 offres au même titre : UNE payée (celle dont la transaction est vendue), jamais par ressemblance', JSON.stringify(c3));
    const P = O.tauxOffresComptes({ convs, ventes: null, lectures, de: NOW - 30 * jour, a: NOW + 1, maintenant: NOW });
    const p1 = P.comptes.find((c) => c.compte === '111');
    dit(p1 && p1.payees === null && p1.tauxPaiement === null && p1.tauxAcceptation === 85.7, '113.5 ventes pas lues ⇒ « payées — », l’acceptation reste lue');
    const Q = O.tauxOffresComptes({ convs: null, ventes, lectures });
    dit(Q.etat === 'passu', '113.6 conversations pas lues ⇒ « pas su »');
    const partiel = O.tauxOffresComptes({ convs, ventes, lectures: { 111: NOW - 20 * jour }, de: NOW - 30 * jour, a: NOW + 1, maintenant: NOW });
    dit(partiel.comptes.find((c) => c.compte === '111').partiel === true, '113.7 période après la dernière lecture ⇒ « au moins »');
    const st = lire('src/ecrans/Stats.jsx');
    dit(/tx:data->payload->conversation->transaction->>id/.test(st) && !/select=data[,&]/.test(st.match(/OFFRES_STATS_CONV[^;]+;/)[0]), '113.8 la transaction est PROJETÉE avec les messages (§4.4 : jamais select=data)');
  }

  // ── 114 ────────────────────────────────────────────────────────────────────
  console.log('── 114. Soldes temporaires');
  {
    const S = await imp('src/soldes.js');
    const NOW = Date.UTC(2026, 10, 14, 10);
    const fin = '2026-11-20';
    const faites = [
      { ligne: { uid: '111', id: '9001', numero: '12', num: '12', titre: 'Dunk' }, r: { accepte: true, etape: 'fait', ancien: 60, prixVu: 54 } },
      { ligne: { uid: '111', id: '9002', num: '13' }, r: { accepte: true, etape: 'incertain', ancien: 50, prixVu: null } },
      { ligne: { uid: '111', id: '9003', num: '14' }, r: { accepte: false, code: 'plafond' } },
      { ligne: { uid: '111', id: '9004', num: '15' }, r: { accepte: true, etape: 'ecart', ancien: 40, prixVu: 40 } },
      { ligne: { uid: '111', id: '9005', num: '16' }, r: { accepte: true, etape: 'ecart', ancien: 45, prixVu: 42 } },   // Vinted montre un AUTRE prix : pas un solde sûr
    ];
    const a = S.enregistrerSolde(null, { fin, site: 'vinted', faites, maintenant: NOW, id: 's1' });
    dit(a.n === 1 && a.etat.soldes[0].paires[0].origine === 60 && a.etat.soldes[0].paires[0].solde === 54, '114.1 seules les baisses ACCEPTÉES ET RELUES entrent ; origine = le prix LU avant (60), solde = le prix relu (54)', JSON.stringify(a.etat.soldes[0] && a.etat.soldes[0].paires));
    const b = S.enregistrerSolde(a.etat, { fin: '2026-11-25', site: 'vinted', faites: [{ ligne: { uid: '111', id: '9001', num: '12' }, r: { accepte: true, etape: 'fait', ancien: 54, prixVu: 50 } }], maintenant: NOW + 1000, id: 's2' });
    const p2 = b.etat.soldes.find((s) => s.id === 's2').paires[0];
    dit(p2.origine === 60 && b.etat.soldes.find((s) => s.id === 's1').paires[0].etat === 'deplace', '114.2 une 2e baisse pendant le solde garde le PREMIER prix d’origine (60, pas 54) ; l’ancien solde ne la remettra pas deux fois', JSON.stringify(p2));
    dit(S.soldesARemettre(a.etat, NOW).length === 0 && S.soldesARemettre(a.etat, Date.UTC(2026, 10, 20, 9)).length === 1, '114.3 rien n’est proposé avant le jour de fin (heure de Paris) ; le jour venu, Ma journée PROPOSE');
    dit(!S.finValide('2026-11-14', NOW).ok && !S.finValide('2027-06-01', NOW).ok && S.finValide('2026-11-15', NOW).ok, '114.4 fin : demain au plus tôt, 90 jours au plus');
    const pa = a.etat.soldes[0].paires;
    const L1 = S.lignesRemise(pa, () => 54), L2 = S.lignesRemise(pa, () => 52), L3 = S.lignesRemise(pa, () => null), L4 = S.lignesRemise(pa, () => undefined), L5 = S.lignesRemise(pa, () => 60);
    dit(L1[0].action === 'remettre' && L1[0].de === 54 && L1[0].vers === 60 && L2[0].action === 'change' && L3[0].action === 'absente' && L4[0].action === 'passu' && L5[0].action === 'deja', '114.5 remise : 54 → 60 ; prix changé par lui ⇒ pas touché ; vendue ⇒ rien ; annonces pas lues ⇒ rien ne part ; déjà 60 ⇒ rien');
    const cmd = S.commandeRemise(L1[0]);
    dit(cmd && cmd.cmd === 'baisserPrixVinted' && cmd.remise === true && cmd.confirme === true && cmd.prixOrigine === 60 && cmd.prix === 60 && cmd.prixAvant === 54, '114.6 la commande porte remise + confirme + le prix d’origine (le chemin de baisse existant)', JSON.stringify(cmd));
    dit(S.commandeRemise(L2[0]) === null && S.commandeRemise(L3[0]) === null, '114.7 aucune commande pour une ligne qui ne se remet pas');
    const n = S.noterRemise(a.etat, 's1', new Map([['vinted|111|9001', 'fait']]));
    dit(n.soldes[0].paires[0].etat === 'remis' && S.soldesARemettre(n, Date.UTC(2026, 10, 21)).length === 0, '114.8 remis ⇒ plus reproposé');
    const n2 = S.noterRemise(a.etat, 's1', new Map([['vinted|111|9001', 'refus']]));
    dit(n2.soldes[0].paires[0].etat === 'baisse', '114.9 un refus ou un « pas relu » laisse la paire en solde (reproposée, jamais supposée remise)');
    // La remise ne part QUE d'un clic (statique : le code, commentaires retirés).
    const app = sansCommentaires(lire('src/App.jsx')), ap = sansCommentaires(lire('src/ArgentPrix.jsx'));
    const appels = (app.match(/commandeRemise\(/g) || []).length;
    const blocRemise = (app.match(/onRemettre=\{async \(l\) => \{[\s\S]*?commandeRemise\(l\)/) || [''])[0];
    dit(appels === 1 && blocRemise.length > 0, '114.10 dans l’app, `commandeRemise` n’est appelée qu’à UN endroit : le geste `onRemettre` de la feuille', `appels=${appels}`);
    const usagesLancer = (ap.match(/(?<![-\w])lancer\b/g) || []).length;
    dit(/onClick=\{lancer\}/.test(ap) && usagesLancer === 2 && !/useEffect\([^)]*lancer/.test(ap) && (ap.match(/onRemettre\(/g) || []).length === 1, '114.11 la feuille n’appelle `onRemettre` que dans `lancer`, et `lancer` n’est lié qu’au clic « Remettre N prix » (aucun effet, aucun minuteur)', `lancer×${usagesLancer}`);
    const jour = sansCommentaires(lire('src/App.jsx')).match(/soldesARemettre\(load\(CLE_SOLDES, null\)\)[\s\S]{0,400}/);
    dit(jour && /onOuvrir=\{\(\)=>\{ try \{ window\.dispatchEvent\(new CustomEvent\('vrm:remise-soldes'\)\)/.test(jour[0]) && !/commandeRemise|vmrCmd/.test(jour[0]), '114.12 Ma journée ne fait qu’OUVRIR la feuille (aucune commande)');
    dit(/'vrm_soldes',/.test(lire('src/App.jsx')), '114.13 les soldes sont synchronisés (SYNC_KEYS)');
    // L'extension : le VRAI `baisserPrixVinted` (vm) — une hausse sans remise est refusée.
    const { faireFond } = require('./_fond-vm.cjs');
    const ID = '91010001', UID = '111';
    const MODELE = JSON.stringify({ item: { id: Number(ID), title: 'Nike Dunk', description: 'Bon état', price: { amount: '54.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }] } });
    const LU = (prix) => ({ item: { id: Number(ID), title: 'Nike Dunk', description: 'Bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }] } });
    const monter = () => {
      let prix = 54;
      const lignes = { [`coffre_${UID}_${ID}`]: { id: ID, photos: ['a'] }, vrm_vinted_modele: { [ID]: { corps: MODELE, at: new Date().toISOString(), uid: UID } } };
      const vinted = (e) => {
        if (e.methode === 'GET' && e.chemin === `/api/v2/item_upload/items/${ID}`) return { status: 200, body: LU(prix) };
        if (e.methode === 'PUT' && e.chemin === `/api/v2/item_upload/items/${ID}`) { try { prix = Number(JSON.parse(e.corps).item.price.amount); } catch (_) {} return { status: 200, body: {} }; }
        return { status: 404, body: {} };
      };
      return faireFond({ src: path.join(T, 'ext', 'background.js'), lignes, store: {}, vinted, connecte: UID });
    };
    const essai = async (extra) => { const f = monter(); let r; try { r = await f.ctx.baisserPrixVinted({ cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 60, prixAvant: 54, confirme: true, ...extra }); } catch (e) { r = { erreur: String(e && e.message) }; } return { r, puts: f.j.vinted.filter((v) => v.methode === 'PUT').length }; };
    const e1 = await essai({});
    dit(e1.r.accepte === false && e1.r.code === 'pas-une-baisse' && e1.puts === 0, '114.14 extension : une HAUSSE sans `remise` ⇒ refusée, 0 PUT', JSON.stringify(e1.r));
    const e2 = await essai({ remise: true, prixOrigine: 70 });
    dit(e2.r.accepte === false && e2.puts === 0, '114.15 extension : `remise` vers un prix qui n’est pas l’origine mémorisée ⇒ refusée', JSON.stringify(e2.r));
    const e3 = await essai({ remise: true, prixOrigine: 60, confirme: false });
    dit(e3.r.accepte === false && e3.r.code === 'confirmation' && e3.puts === 0, '114.16 extension : sans SON clic (`confirme`) ⇒ refusée');
    const e4 = await essai({ remise: true, prixOrigine: 60 });
    dit(e4.r.accepte === true && e4.r.etape === 'fait' && e4.r.prixVu === 60 && e4.puts === 1, '114.17 extension : la remise à l’origine passe par le chemin de baisse (lu avant, UN PUT, RELU à 60)', JSON.stringify(e4.r));
    const e5 = await essai({ remise: true, prixOrigine: 600, prix: 600 });
    dit(e5.r.accepte === false && e5.puts === 0, '114.18 extension : jamais plus de 10 fois le prix actuel');
    const bg = lire('ext/background.js');
    dit((bg.match(/remisePermise\(msg,/g) || []).length - (bg.match(/function remisePermise\(msg,/g) || []).length === 3, '114.19 les trois chemins (Vinted, Leboncoin, Vestiaire) portent la même garde de remise');
  }

  // ── 115 ────────────────────────────────────────────────────────────────────
  console.log('── 115. Lien comptable');
  {
    const C = await imp('api/_lib/comptable-lien.js');
    const NEUTRE = '00000000-0000-0000-0000-000000000000';
    const VEND = '11111111-2222-3333-4444-555555555555';
    const base = 'https://base.test';
    const lignes = new Map();
    let panne = false;
    const fetchF = async (url, init = {}) => {
      if (panne) return { ok: false, status: 503, json: async () => null };
      const u = new URL(url);
      const owner = (u.searchParams.get('owner') || '').replace(/^eq\./, '');
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      const m = (init.method || 'GET').toUpperCase();
      if (m === 'POST') { for (const r of JSON.parse(init.body)) lignes.set(r.owner + '|' + r.id, r.data); return { ok: true, status: 201, json: async () => null }; }
      if (m === 'DELETE') { lignes.delete(owner + '|' + id); return { ok: true, status: 204, json: async () => null }; }
      const d = lignes.get(owner + '|' + id);
      if (!d) return { ok: true, status: 200, json: async () => [] };
      const sel = u.searchParams.get('select') || '';
      const out = {};
      for (const part of sel.split(',')) { const [alias, expr] = part.split(':'); const ch = expr.replace(/^data/, '').split(/->>|->/).filter(Boolean); let v = d; for (const k of ch) v = v == null ? undefined : v[k]; out[alias] = typeof v === 'object' && /->>/.test(expr) ? JSON.stringify(v) : v; }
      return { ok: true, status: 200, json: async () => [out] };
    };
    const NOW = Date.UTC(2026, 10, 14, 10);
    const D = { periode: '2026-10', libelle: 'octobre 2026', etabliLe: '14/11/2026', regime: 'micro', regimeTexte: 'Micro-entrepreneur', taux: 12.4,
      caParMois: [{ ym: '2026-10', mois: 'octobre 2026', n: 2, ca: 150, urssaf: 18.6, declare: true }], caDeclare: 150, partielCa: false, urssaf: 18.6, ligneLue: true,
      ventes: [{ id: 'v1', dateVente: '02/10/2026', dateVersement: '05/10/2026', plateforme: 'Vinted', compte: 'shop_julien_secret', num: '12', reference: '23052006117', titre: 'Nike Dunk', montant: 80, frais: null, note: '', acheteur: 'Marie Dupont', email: 'marie@exemple.test' }],
      nVentes: 1, totalVentes: 80, ventesCompletes: true, manqueVentes: [], sansMontantVentes: 0, aDater: [], nADater: 0,
      achats: [{ id: 'a1', date: '01/10/2026', plateforme: 'Vinted', fournisseur: 'vendeuse_privee_75', reference: '999', num: '12', titre: 'Nike Dunk', saisi: 40, lu: 42, sourceLue: 'reçu Vinted', note: '', facture: '', factureCle: 'x' }],
      nAchats: 1, sansCout: 0, coutSaisi: 40, manqueAchats: [], nonComptees: 0 };
    const deps = (o) => ({ base, cle: 'cle-service', env: { COMPTABLE_SECRET: 'secret-de-test' }, fetch: fetchF, maintenant: NOW, ...o });
    const user = { id: VEND };
    const cree = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'creer', jours: 30, vue: D } }));
    const url = cree.body && cree.body.url || '';
    const jeton = url.split('/c/')[1] || '';
    dit(cree.status === 200 && cree.body.actif && C.RE_JETON_COMPTABLE.test(jeton) && /^https:\/\/vrm\.center\/c\//.test(url), '115.1 créer ⇒ un lien `/c/<jeton>` signé', url);
    const lu = await C.traiterComptable(deps({ methode: 'GET', jeton, ua: 'Mozilla/5.0 Safari/605' }));
    const vue = lu.body && lu.body.vues && lu.body.vues[0];
    dit(lu.status === 200 && vue && vue.caDeclare === 150 && vue.ventes.length === 1 && vue.achats.length === 1, '115.2 le comptable lit la période (CA 150 €, 1 recette, 1 achat)', lu.status);
    const tout = JSON.stringify(lu.body);
    const INTERDITS = ['shop_julien_secret', 'Marie Dupont', 'marie@exemple.test', 'vendeuse_privee_75', '"compte"', '"fournisseur"', '"acheteur"', '"email"', '"factureCle"', '"id"', 'owner'];
    const fuites = INTERDITS.filter((x) => tout.includes(x));
    dit(fuites.length === 0, '115.3 la projection n’a QUE la compta : aucun pseudo, aucun acheteur, aucun fournisseur, aucun e-mail, aucun identifiant interne', fuites.join(', '));
    const CLES_OK = new Set(['periode', 'libelle', 'etabliLe', 'entreprise', 'regime', 'regimeTexte', 'taux', 'caParMois', 'caDeclare', 'partielCa', 'urssaf', 'ligneLue', 'ventes', 'nVentes', 'totalVentes', 'ventesCompletes', 'manqueVentes', 'sansMontantVentes', 'aDater', 'nADater', 'achats', 'nAchats', 'sansCout', 'coutSaisi', 'manqueAchats', 'nonComptees', 'publieLe']);
    dit(vue && Object.keys(vue).every((k) => CLES_OK.has(k)) && Object.keys(vue.ventes[0]).sort().join() === 'dateVente,dateVersement,frais,montant,note,num,plateforme,reference,titre', '115.4 liste BLANCHE : seules les colonnes de compta', vue && Object.keys(vue.ventes[0]).join());
    const acces = lignes.get(VEND + '|vrm_comptable_acces');
    dit(acces && acces.liste.length === 1 && acces.liste[0].nav === 'Safari' && !JSON.stringify(acces).match(/\d+\.\d+\.\d+\.\d+/), '115.5 chaque lecture est notée au journal (date, navigateur ; jamais une adresse IP)', JSON.stringify(acces));
    const [al, ex, sg] = jeton.split('.');
    const triche = `${al}.${(parseInt(ex, 36) + 365 * 86400000).toString(36)}.${sg}`;
    const t1 = await C.traiterComptable(deps({ methode: 'GET', jeton: triche }));
    dit(t1.status === 404 && C.verifierJetonComptable(triche, 'secret-de-test', NOW).raison === 'signature' && C.verifierJetonComptable(jeton, 'autre-secret', NOW).raison === 'signature', '115.6 expiration retouchée, ou autre clé ⇒ signature refusée, 404', t1.status);
    const t2 = await C.traiterComptable(deps({ methode: 'GET', jeton, maintenant: NOW + 31 * 86400000 }));
    dit(t2.status === 404 && t2.body.raison === 'expire', '115.7 lien expiré ⇒ 404', JSON.stringify(t2.body));
    const pub = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'publier', vue: { ...D, periode: '2026-09', libelle: 'septembre 2026' } } }));
    dit(pub.status === 200 && pub.body.periodes.length === 2, '115.8 publier une 2e période (sur SA session)', JSON.stringify(pub.body.periodes));
    const coupe = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'couper' } }));
    const t3 = await C.traiterComptable(deps({ methode: 'GET', jeton }));
    dit(coupe.status === 200 && !coupe.body.actif && t3.status === 404, '115.9 couper ⇒ le lien rend 404 (révoqué)', t3.status);
    const re = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'creer', jours: 7, vue: D } }));
    const j2 = (re.body.url || '').split('/c/')[1];
    const re2 = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'creer', jours: 7, vue: D } }));
    const t4 = await C.traiterComptable(deps({ methode: 'GET', jeton: j2 }));
    dit(re2.status === 200 && t4.status === 404, '115.10 un nouveau lien remplace l’ancien (l’ancien ⇒ 404)', t4.status);
    const sans = await C.traiterComptable(deps({ methode: 'POST', user: null, corps: { action: 'creer', jours: 7 } }));
    dit(sans.status === 401, '115.11 sans session : ni créer, ni publier, ni couper', sans.status);
    panne = true;
    const t5 = await C.traiterComptable(deps({ methode: 'GET', jeton: (re2.body.url || '').split('/c/')[1] }));
    panne = false;
    dit(t5.status === 503, '115.12 base injoignable ⇒ 503 (jamais une compta vide servie)', t5.status);
    const t6 = await C.traiterComptable(deps({ methode: 'POST', user, corps: { action: 'creer', jours: 1000, vue: D } }));
    dit(t6.status === 400, '115.13 durée hors liste ⇒ refusée', t6.status);
    const compte = lire('api/compte.js'), vercel = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8'));
    dit(/mode === 'comptable'/.test(compte) && (vercel.redirects || []).some((r) => /^\/c\//.test(r.source) && /comptable=/.test(r.destination)) && !fs.existsSync(path.join(R, 'api', 'comptable.js')), '115.14 dans api/compte.js (aucune fonction neuve) ; `/c/<jeton>` → `/?comptable=`');
    const ap = lire('src/ArgentPrix.jsx');
    dit(/const DUREES_J = \[7, 30, 90, 365\];/.test(ap) && C.DUREES_J.join() === '7,30,90,365', '115.15 les mêmes durées dans l’app et le serveur');
    const vc = sansCommentaires(lire('src/VueComptable.jsx'));
    dit(!/from '\.\/App\.jsx'/.test(vc) && !/method:\s*'POST'|localStorage|save\(/.test(vc) && /credentials: 'omit'/.test(vc), '115.16 la page du comptable : sans l’app, sans écriture, sans cookie');
  }

  // ── 116 ────────────────────────────────────────────────────────────────────
  console.log('── 116. Révision du mois');
  {
    const V = await imp('src/revisionMois.js');
    const t = (j) => new Date(2026, 9, j, 12).getTime();
    const rel = [
      ['Vinted', 'a', 'T1', t(2), 80, 40, 0, 'Dunk', '12', '2026-10-05'],     // complète
      ['Vinted', 'a', 'T2', t(3), 70, null, 0, 'Samba', '13', '2026-10-06'],   // prix d'achat
      ['Vinted', 'a', 'T3', t(4), 60, 30, 0, 'Gazelle', '14', ''],              // versement
      ['Leboncoin', '', 'lbc:1', t(5), 90, null, 0, 'AF1', '', '2026-10-05'],    // pas reliée + achat
      ['eBay', '', 'ebay:2', t(6), 55, 20, 3, 'NB 550', '15', ''],              // eBay sans [9] : PAS un manque de versement
      ['Vinted', 'a', 'T9', new Date(2026, 10, 2).getTime(), 50, null, 0, 'X', '', ''],   // novembre : pas dans octobre
    ];
    const r = V.revisionMois({ releve: rel, ym: '2026-10' });
    dit(r.etat === 'lu' && r.n === 5 && r.total === 3 && r.compte.achat === 2 && r.compte.versement === 1 && r.compte.relier === 1, '116.1 octobre : 5 ventes, 3 à compléter (2 prix d’achat, 1 versement Vinted, 1 pas reliée) ; novembre dehors', JSON.stringify(r.compte));
    const lbc = r.lignes.find((l) => l.id === 'lbc:1');
    dit(lbc && lbc.manques.join() === 'achat,relier' && lbc.porte === 'achat', '116.2 une vente, ses manques ensemble, la porte du premier');
    dit(V.revisionMois({ releve: null, ym: '2026-10' }).etat === 'passu' && V.revisionMois({ releve: undefined, ym: '2026-10' }).etat === 'encours', '116.3 relevé pas publié ⇒ « ouvre Ventes », jamais « rien à réviser »');
    const cp = lire('src/ecrans/Compta.jsx');
    dit(/portes=\{\{ achat: P\.prix, versement: P\.adater, relier:/.test(cp), '116.4 chaque ligne ouvre la saisie EXISTANTE (portes de « Mois bouclé »)');
  }

  // ── 121 ────────────────────────────────────────────────────────────────────
  console.log('── 121. La même paire à deux prix');
  {
    const E = await imp('src/ecartsPrix.js');
    // 50 paires au MÊME titre, chacune son N°, au même prix sur Vinted et Leboncoin ⇒ aucun écart.
    const g = [];
    for (let i = 1; i <= 50; i++) g.push({ num: String(i), sites: [{ site: 'vinted', id: 'v' + i, prix: i % 2 ? 80 : 95, titre: 'Nike Dunk Low panda 42' }, { site: 'leboncoin', id: 'l' + i, prix: i % 2 ? 80 : 95, titre: 'Nike Dunk Low panda 42' }] });
    const r = E.ecartsPrix(g);
    dit(r.compares === 50 && r.ecarts.length === 0, '121.1 50 paires au même titre (80 € et 95 € selon le N°) : aucun faux écart — la comparaison est PAR N°', `compares=${r.compares} ecarts=${r.ecarts.length}`);
    g.push({ num: '77', sites: [{ site: 'vinted', id: 'v77', prix: 80 }, { site: 'leboncoin', id: 'l77', prix: 95 }] });
    const r2 = E.ecartsPrix(g);
    dit(r2.ecarts.length === 1 && r2.ecarts[0].num === '77' && r2.ecarts[0].ecart === 15, '121.2 le N°77 à 80 € sur Vinted et 95 € sur Leboncoin : signalé, 15 € d’écart');
    const r3 = E.ecartsPrix([{ num: '5', sites: [{ site: 'vinted', id: 'a', prix: 80 }, { site: 'vinted', id: 'b', prix: 60 }, { site: 'leboncoin', id: 'c', prix: 80 }] }]);
    dit(r3.ecarts.length === 0 && r3.nonJuges.length === 1 && r3.nonJuges[0].raison === 'deux', '121.3 deux annonces du même site sous un N° : pas jugé (dit)');
    const reglage = (site, p) => (site === 'leboncoin' ? p + 15 : p);
    const r4 = E.ecartsPrix([{ num: '77', sites: [{ site: 'vinted', id: 'a', prix: 80 }, { site: 'leboncoin', id: 'c', prix: 95 }] }], { prixAttendu: reglage });
    dit(r4.ecarts.length === 0 && r4.voulus.length === 1, '121.4 l’écart de SON réglage (+15 € Leboncoin) est rangé à part, pas signalé');
    const r5 = E.ecartsPrix([{ num: '8', sites: [{ site: 'vinted', id: 'a', prix: 80 }, { site: 'ebay', id: 'e', prix: 90, devise: 'GBP' }] }]);
    dit(r5.ecarts.length === 0 && r5.nonJuges[0].raison === 'devise', '121.5 autre devise : pas comparée (jamais convertie)');
    const app = sansCommentaires(lire('src/App.jsx'));
    const hote = (app.match(/function HoteEcartsPrix[\s\S]*?\n\}/) || [''])[0];
    dit(/sitesPrixDe\(/.test(hote) && !/titre\s*===|normTitle|\.title\s*===/.test(hote) && !/vmrCmd|appelEbay|save\(/.test(hote), '121.6 l’écran relie par `sitesPrixDe` (identité), jamais par titre, et n’envoie ni n’écrit rien');
  }

  // ── 122 ────────────────────────────────────────────────────────────────────
  console.log('── 122. Le prix à afficher');
  {
    const P = await imp('src/prixVoulu.js');
    const TAUX = [0, 1, 999, 1290, 1500, 2000, 2550, 3333];
    let n = 0, faux = [];
    for (const t of TAUX) for (let net = 100; net <= 300000; net += (net < 2000 ? 1 : net < 20000 ? 37 : 997)) {
      n++;
      const prix = P.prixPourNet(net, t);
      const okMin = P.netDe(prix, t) >= net && (prix === net || P.netDe(prix - 1, t) < net);
      if (!okMin) { faux.push(`${t}‱ net=${net} prix=${prix}`); if (faux.length > 4) break; }
    }
    dit(n > 10000 && faux.length === 0, `122.1 aller-retour au centime : ${n} nets × taux — le prix trouvé laisse au moins le net, et un centime de moins ne le laisse plus`, faux.join(' | '));
    let fauxR = [];
    for (const t of TAUX) for (let net = 100; net <= 50000; net += 113) { const T2 = P.prixAAfficher(net, { Vinted: { etat: 'zero', taux: 0 }, Leboncoin: { etat: 'zero', taux: 0 }, eBay: { etat: 'taux', taux: t, n: 3 }, Vestiaire: { etat: 'pasLu', taux: null } }); const e = T2.sites.find((s) => s.site === 'eBay'); if (!(e.arrondi % 100 === 0 && e.arrondi >= e.prix && e.netArrondi >= net)) fauxR.push(`${t} ${net}`); }
    dit(fauxR.length === 0, '122.2 l’arrondi à l’euro est AU-DESSUS : le net à ce prix reste ≥ ce qu’il veut (et il est dit)', fauxR.slice(0, 3).join(' | '));
    const R = { commandeEbayEngagee: () => true, fraisVc: () => ({ lu: false }) };
    const cmd = (id, du, f) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: '2026-10-01T10:00:00Z', paymentSummary: { totalDueSeller: { value: String(du), currency: 'EUR' } }, totalMarketplaceFee: { value: String(f), currency: 'EUR' } });
    const tx = P.tauxDesSites({ releve: [], ebay: [cmd('1', 100, 12.9), cmd('2', 200, 25.8), { orderId: '3', orderPaymentStatus: 'PAID', creationDate: '2026-10-01T10:00:00Z', paymentSummary: { totalDueSeller: { value: '50', currency: 'EUR' } } }], vestiaire: null, R });
    dit(tx.eBay.etat === 'taux' && tx.eBay.taux === 1290 && tx.eBay.n === 2, '122.3 eBay : la règle de frais existante (`fraisParPlateforme`) — 12,9 % lus sur 2 commandes (la 3e sans frais lus n’entre pas)', JSON.stringify(tx.eBay));
    dit(tx.Vinted.taux === 0 && tx.Leboncoin.taux === 0 && tx.Vestiaire.etat === 'pasLu', '122.4 Vinted et Leboncoin : 0 (rien au vendeur) ; Vestiaire pas lu ⇒ « — », jamais un taux deviné');
    const t0 = P.tauxDesSites({ releve: [], ebay: null, vestiaire: null, R });
    dit(t0.eBay.etat === 'pasLu', '122.5 eBay pas lu ⇒ pas de prix');
    const src = sansCommentaires(lire('src/prixVoulu.js'));
    dit(/import \{ fraisParPlateforme \} from '\.\/fraisPlateformes\.js'/.test(lire('src/prixVoulu.js')) && !/0\.1[0-9]|0\.12|12\.9|0\.15/.test(src), '122.6 aucun taux écrit en dur : tout vient de la règle de frais (une seule règle par notion)');
    const ap = lire('src/ArgentPrix.jsx');
    dit(/port payé par l’acheteur/.test(lire('src/i18n/langues/fr/argentprix.js')) && /environEbay/.test(ap), '122.7 eBay : le port est payé par l’acheteur (§2.8), dit à côté du prix');
  }

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${ko ? '❌' : '✅'} audit-argent-prix : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
