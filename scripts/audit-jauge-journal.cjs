// ════════════════════════════════════════════════════════════════════════════
//  LOT G (10 nov., extension 5.337) — LA JAUGE DU PLAFOND ET LE JOURNAL « CE QUE VRM A
//  FAIT » — node scripts/audit-jauge-journal.cjs [--src <background.js>] [--racine <arbre>] [--prouve]
//
//  Le VRAI background.js tourne dans un vm (scripts/_fond-vm.cjs : faux Vinted qui
//  compte, fausse base à état, `chrome.storage.local` à état). On exige :
//   A  COMPTEUR EXACT : k gestes réels (réponses, offre acceptée/refusée, baisse de prix)
//      ⇒ la ligne publiée `actions_compte_111_*`, lue par la règle de l'app
//      (src/jaugeActions.js `jaugeDuCompte`), dit EXACTEMENT ce que l'extension a compté
//      (`vrmActions`) ; un geste refusé par la garde (autre compte) n'ajoute rien ;
//      avec les heures d'un AUTRE Chrome du même compte, la jauge = la somme, et quand
//      la somme atteint 50 l'extension refuse et la jauge dit « plein » ;
//   B  « PAS SU » ≠ 0 : un compte sans aucune ligne ⇒ `null` ; une visite publie la
//      ligne même sans action (0/50) ; une seconde visite dans les 10 min ne réécrit pas ;
//   C  JOURNAL : chaque geste ACCEPTÉ par Vinted entre au journal (`journal_vrm_111_*`)
//      avec sa sorte, son n° de transaction, ses prix ; un refus de Vinted, une lecture,
//      un geste arrêté par la garde n'y entrent pas ;
//   D  RIEN DE PERSONNEL : ni texte de message, ni pseudo, ni login dans aucune ligne
//      publiée ; les clés des lignes et des entrées sont une liste blanche ; un champ
//      glissé dans `noterJournal` (texte, login, n° non numérique) ne passe pas ;
//   E  SERVEUR (api/_lib/securite-compte.js) : les gestes de l'extension deviennent des
//      événements avec leur preuve ; ceux qu'une autre ligne prouve déjà (favori,
//      republication, bordereau) n'entrent pas ; un geste du téléphone n'est pas compté
//      deux fois ; une ligne au nom forgé est ignorée ; aucun texte ne passe ;
//   F  RÈGLE DE L'APP : piège du LIKE (compte 1234 ≠ 123), heures de plus d'une heure ou
//      du futur écartées, somme de deux Chrome, « repart à » = la plus ancienne + 1 h,
//      ambre (geste) seulement à 45.
//  `--src` / `--racine` : la preuve sur le code d'AVANT (§6.1). `--prouve` : mutations.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const RACINE = path.resolve(arg('--racine') || path.join(__dirname, '..'));
const BG = arg('--src') ? path.resolve(arg('--src')) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = path.join(RACINE, 'src', 'jaugeActions.js');
const SERVEUR = path.join(RACINE, 'api', '_lib', 'securite-compte.js');

const UID = '111', ID = '91010001';
const S = { origin: 'https://vrm.center', url: 'https://vrm.center/' };
const PERSO = /camille|bonjour|merci|compte_banc|acheteuse/i;
const MODELE = () => JSON.stringify({ item: { id: Number(ID), title: 'Nike Air Max 1 blanche', description: 'Très bon état', price: { amount: '60.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }, { id: 502, orientation: 0 }] } });
const LU = (prix) => ({ item: { id: Number(ID), title: 'Nike Air Max 1 blanche', description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }, { id: 502 }] } });

function monter(src, { store = {}, lignes = {}, connecte = UID, refus = () => false } = {}) {
  const l = { [`coffre_${UID}_${ID}`]: { id: ID, photos: ['a', 'b'] }, vrm_vinted_modele: { [ID]: { corps: MODELE(), at: new Date().toISOString(), uid: UID } }, ...lignes };
  let prix = 60;
  const vinted = (e) => {
    if (refus(e)) return { status: 422, body: { message: 'refus' } };
    if (e.methode === 'GET' && e.chemin === `/api/v2/item_upload/items/${ID}`) return { status: 200, body: LU(prix) };
    if (e.methode === 'PUT' && e.chemin === `/api/v2/item_upload/items/${ID}`) { try { prix = Number(JSON.parse(e.corps).item.price.amount); } catch (_) {} return { status: 200, body: {} }; }
    if (e.methode === 'GET' && /^\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 200, body: { conversation: { id: 5, opposite_user: { login: 'acheteuse_camille' }, messages: [] } } };
    return { status: 200, body: { ok: true } };
  };
  return faireFond({ src, lignes: l, store, vinted, connecte, comptes: [{ vinted_user_id: UID, login: 'compte_banc', domain: 'www.vinted.fr', access_token: 'jeton' }] });
}
const repondre = (c, texte = 'Bonjour Camille, merci pour ton message') => ({ uid: UID, method: 'POST', endpoint: `/api/v2/conversations/${c}/replies`, body: { reply: { body: texte } } });
const accepter = (tx, oid) => ({ uid: UID, method: 'PUT', endpoint: `/api/v2/transactions/${tx}/offer_requests/${oid}/accept`, confirme: true });
const refuser = (tx, oid) => ({ uid: UID, method: 'PUT', endpoint: `/api/v2/transactions/${tx}/offer_requests/${oid}/reject` });
const lire = (c) => ({ uid: UID, method: 'GET', endpoint: `/api/v2/conversations/${c}` });
const lignesDe = (f, prefixe) => Object.keys(f.lignes).filter((k) => k.startsWith(prefixe)).map((k) => ({ id: k, ...f.lignes[k] }));
const actionsLocales = (f) => ((f.store.vrmActions || {})[UID] || []).filter((x) => Date.now() - x < 3600000).length;
const journal = (f) => { const l = lignesDe(f, `journal_vrm_${UID}_`); return l.length ? (l[0].e || []) : []; };

async function importer(fichier, src) {
  if (src == null) { if (!fs.existsSync(fichier)) return null; src = fs.readFileSync(fichier, 'utf8'); }
  // Une copie à côté de l'original : ses imports relatifs restent valables.
  const f = path.join(path.dirname(fichier), `.audit-jj-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } catch (e) { return { __erreur: String(e && e.message) }; } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function controles({ bgSrc, regleSrc, serveurSrc }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : String(d) });
  const R = await importer(REGLE, regleSrc);
  const V = await importer(SERVEUR, serveurSrc);
  const jauge = (rows, uid = UID, t = Date.now()) => (R && typeof R.jaugeDuCompte === 'function' ? R.jaugeDuCompte(rows, uid, t) : { absente: true });
  const ecrire = (f) => f.ctx && typeof f.ctx.executerPourApp === 'function';
  const appBG = fs.readFileSync(BG, 'utf8');
  const src = bgSrc != null ? (() => { const p = path.join(os.tmpdir(), `bg-jj-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(p, bgSrc); return p; })() : BG;
  try {
    // ── A. compteur exact ──
    { const f = monter(src);
      for (const c of [11, 12, 13]) await f.ctx.executerPourApp(repondre(c), S);
      await f.ctx.executerPourApp(accepter('70001', '801'), S);
      await f.ctx.executerPourApp(refuser('70002', '802'), S);
      await f.ctx.executerPourApp(lire(14), S);                                    // une lecture : rien compté
      let rb = null; try { rb = await f.ctx.executerCommande({ cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 54, prixAvant: 60, confirme: true }); } catch (e) { rb = { erreur: e.message }; }
      const rows = lignesDe(f, `actions_compte_${UID}_`).map((r) => ({ id: r.id, ts: r.ts, max: r.max, reserve: r.reserve }));
      const j = jauge(rows);
      dit(actionsLocales(f) === 6 && rb && rb.etape === 'fait', 'A1 3 réponses + 1 acceptée + 1 refusée + 1 baisse : l’extension a compté 6 actions (la lecture ne compte pas)', `compté=${actionsLocales(f)} baisse=${rb && (rb.etape || rb.code)}`);
      dit(j && j.n === 6 && j.max === 50 && j.pourApp === 45, 'A2 la jauge de l’app, lue sur la ligne PUBLIÉE, dit exactement 6/50 (45 pour l’app)', JSON.stringify(j));
      const f2 = monter(src, { connecte: '999' });
      await f2.ctx.executerPourApp(repondre(21), S);
      const j2 = jauge(lignesDe(f2, `actions_compte_${UID}_`).map((r) => ({ id: r.id, ts: r.ts })));
      dit(actionsLocales(f2) === 0 && f2.j.vinted.length === 0 && (j2 === null || j2.n === 0), 'A3 un geste arrêté par la garde (onglet sur un autre compte) n’ajoute rien', `compté=${actionsLocales(f2)} jauge=${JSON.stringify(j2)}`); }
    { const t = Date.now(), autre = 'bbbbbbbbbbbbbbbb';
      const f = monter(src, { lignes: { [`actions_compte_${UID}_${autre}`]: { uid: UID, nav: autre, ts: Array.from({ length: 47 }, (_, i) => t - 120000 - i * 1000) } } });
      for (const c of [31, 32, 33, 34]) await f.ctx.executerPourApp(repondre(c), S);
      const parties = f.j.vinted.filter((v) => /\/replies$/.test(v.chemin)).length;
      const rows = lignesDe(f, `actions_compte_${UID}_`).map((r) => ({ id: r.id, ts: r.ts, max: r.max, reserve: r.reserve }));
      const j = jauge(rows);
      dit(parties === 3, 'A4 47 actions faites par un AUTRE Chrome du compte : l’extension laisse partir 3 gestes, pas 4', `parties=${parties}`);
      dit(j && j.n === 50 && j.plein === true && j.repartA != null, 'A5 … et la jauge dit 50/50 « plein », avec l’heure où une place se libère', JSON.stringify(j)); }
    // ── B. pas su ≠ 0, visite ──
    { const f = monter(src);
      dit(jauge(lignesDe(f, 'actions_compte_').map((r) => ({ id: r.id, ts: r.ts }))) === null, 'B1 aucune ligne pour ce compte ⇒ « pas su » (null), jamais 0');
      const ok = typeof f.ctx.publierJaugeVisite === 'function' ? await f.ctx.publierJaugeVisite(UID) : false;
      const rows = lignesDe(f, `actions_compte_${UID}_`).map((r) => ({ id: r.id, ts: r.ts, max: r.max }));
      const j = jauge(rows);
      dit(ok === true && j && j.n === 0 && j.max === 50, 'B2 une visite publie la ligne du compte même sans action : 0/50', `${ok} ${JSON.stringify(j)}`);
      const n0 = f.j.posts.length;
      const ok2 = typeof f.ctx.publierJaugeVisite === 'function' ? await f.ctx.publierJaugeVisite(UID) : true;
      dit(ok2 === false && f.j.posts.length === n0, 'B3 une seconde visite dans les 10 min ne réécrit rien', `${ok2} posts+${f.j.posts.length - n0}`);
      const sansCom = (bgSrc != null ? bgSrc : appBG).replace(/\/\/.*$/gm, ''), iV = sansCom.indexOf('async function visiteVinted');
      dit(iV > 0 && /publierJaugeVisite\(uid\)/.test(sansCom.slice(iV, iV + 3000)), 'B4 la visite de Vinted appelle `publierJaugeVisite`'); }
    // ── C. journal ──
    { const f = monter(src, { refus: (e) => e.methode === 'POST' && /\/conversations\/66\/replies$/.test(e.chemin) });
      await f.ctx.executerPourApp(repondre(11), S);
      await f.ctx.executerPourApp(repondre(66), S);                                 // refusée par Vinted
      await f.ctx.executerPourApp(accepter('70001', '801'), S);
      await f.ctx.executerPourApp(Object.assign(accepter('70009', '809'), { confirme: false }), S);
      await f.ctx.executerPourApp(refuser('70002', '802'), S);
      await f.ctx.executerPourApp(lire(14), S);
      try { await f.ctx.executerCommande({ cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 54, prixAvant: 60, confirme: true }); } catch (_) {}
      const e = journal(f);
      const sortes = e.map((x) => x.s).join(',');
      dit(sortes === 'reponse,offre_acceptee,offre_refusee,baisse_prix', 'C1 le journal note les 4 gestes ACCEPTÉS, dans l’ordre (ni le refus de Vinted, ni la lecture, ni l’acceptation sans confirmation)', sortes);
      dit(e.find((x) => x.s === 'offre_acceptee' && x.x === '70001') && e.find((x) => x.s === 'offre_refusee' && x.x === '70002'), 'C2 chaque offre porte SON n° de transaction', JSON.stringify(e));
      const b = e.find((x) => x.s === 'baisse_prix');
      dit(b && b.a === ID && b.de === 60 && b.vers === 54, 'C3 la baisse porte son annonce et ses prix, ancien → RELU (60 → 54)', JSON.stringify(b));
      dit(e.every((x) => Number.isFinite(x.t) && Math.abs(Date.now() - x.t) < 60000), 'C4 chaque geste est daté'); }
    // ── D. rien de personnel ──
    { const f = monter(src);
      await f.ctx.executerPourApp(repondre(11), S);
      await f.ctx.executerPourApp(accepter('70001', '801'), S);
      if (typeof f.ctx.noterJournal === 'function') await f.ctx.noterJournal(UID, 'reponse', { a: '42', x: 'Camille', texte: 'Bonjour Camille', login: 'acheteuse_camille', auto: 'oui', p: 'beaucoup' });
      const pub = [...lignesDe(f, 'actions_compte_'), ...lignesDe(f, 'journal_vrm_')];
      dit(pub.length >= 2 && !pub.some((r) => PERSO.test(JSON.stringify(r))), 'D1 aucune ligne publiée ne porte un texte de message, un pseudo ou un login', pub.filter((r) => PERSO.test(JSON.stringify(r))).map((r) => r.id).join(',') || pub.length);
      const CLES_LIGNE_J = ['uid', 'nav', 'v', 'at', 'e'], CLES_LIGNE_A = ['uid', 'nav', 'ts', 'lec', 'at', 'max', 'reserve', 'maxLectures', 'v']   /* 5.362 (moyenne 33) : les lectures de l'heure, des horodatages */, CLES_E = ['t', 's', 'a', 'b', 'x', 'p', 'de', 'vers', 'auto'];
      const lj = lignesDe(f, 'journal_vrm_'), la = lignesDe(f, 'actions_compte_');
      dit(lj.length === 1 && lj.every((r) => Object.keys(r).every((k) => k === 'id' || CLES_LIGNE_J.includes(k))) && la.every((r) => Object.keys(r).every((k) => k === 'id' || CLES_LIGNE_A.includes(k))), 'D2 les lignes publiées n’ont que des clés de la liste blanche', JSON.stringify(lj.map((r) => Object.keys(r))) + JSON.stringify(la.map((r) => Object.keys(r))));
      const e = journal(f);
      dit(e.length === 3 && e.every((x) => Object.keys(x).every((k) => CLES_E.includes(k))) && !('x' in e[2]) && !('auto' in e[2]) && !('p' in e[2]) && e[2].a === '42', 'D3 un champ glissé dans `noterJournal` (texte, login, n° non numérique, « auto » non booléen) ne passe pas', JSON.stringify(e[2]));
      dit(!lignesDe(f, 'main').length && !Object.keys(f.lignes).some((k) => k === 'main'), 'D4 la ligne `main` n’est jamais écrite'); }
    // ── E. serveur ──
    if (!V || V.__erreur || typeof V.evenementsJournal !== 'function') dit(false, 'E0 module serveur lisible', V && V.__erreur);
    else {
      const NAV = 'aaaaaaaaaaaaaaaa', t = Date.parse('2026-11-10T14:00:00Z');
      const ext = [{ id: `journal_vrm_111_${NAV}`, e: [
        { t, s: 'offre_acceptee', a: '9001', x: '70001', p: 52, auto: true },
        { t: t + 1000, s: 'reponse', x: '70003', texte: 'Bonjour Camille' },
        { t: t + 2000, s: 'baisse_prix', a: '9001', de: 60, vers: 54 },
        { t: t + 3000, s: 'favori' }, { t: t + 4000, s: 'bordereau', x: '70004' }, { t: t + 5000, s: 'republiee', a: '9002' },
        { t: t + 6000, s: 'offre_refusee', x: '70005' },
        { t: t + 7000, s: 'inconnue' },
      ] }, { id: 'journal_vrm_111_pirate', e: [{ t, s: 'offre_acceptee', x: '1' }] }, { id: 'journal_vrm_x1_aaaaaaaaaaaaaaaa', e: [{ t, s: 'offre_acceptee', x: '2' }] }];
      const relais = [{ cmd: 'exec', etat: 'fait', finiLe: new Date(t + 6000 + 30000).toISOString(), uid: '111', methode: 'PUT', endpoint: '/api/v2/transactions/70005/offer_requests/9/reject' }];
      const ev = V.evenementsJournal({ extension: ext, relais });
      const types = ev.filter((x) => x.source === 'extension').map((x) => x.type).sort().join(',');
      dit(types === 'baisse_prix,message_envoye,offre_acceptee', 'E1 les gestes de l’extension deviennent des événements ; favori, bordereau, republication (déjà prouvés ailleurs), sorte inconnue, lignes au nom forgé : écartés', types);
      dit(ev.filter((x) => x.type === 'offre_refusee').length === 1 && ev.find((x) => x.type === 'offre_refusee').source === 'relais', 'E2 un geste du téléphone noté par sa commande ET par l’extension ne compte qu’une fois', JSON.stringify(ev.filter((x) => x.type === 'offre_refusee')));
      const a = ev.find((x) => x.type === 'offre_acceptee');
      dit(a && a.compte === '111' && a.cle.tx === '70001' && a.auto === true && a.preuve && a.prix && a.prix.p === 52, 'E3 compte tiré de l’identifiant de la ligne, n° de transaction, « automatiquement », sa preuve, son prix', JSON.stringify(a));
      dit(!PERSO.test(JSON.stringify(ev)), 'E4 aucun texte ne passe dans les événements');
      let lu = '';
      const j = await V.lireJournal({ userId: 'u-1', neutre: 'n', lireService: async () => [], lireVendeur: async (c) => { if (/journal_vrm_/.test(c)) { lu = c; return ext; } return []; } });
      const champs = ((/[?&]select=([^&]+)/.exec(lu) || [])[1] || '').split(',');
      dit(/select=id,e:data->e/.test(lu) && !champs.includes('data') && /owner=eq\.u-1/.test(lu) && j.evenements.some((x) => x.source === 'extension'), 'E5 `lireJournal` lit `journal_vrm_*` projeté (`e`), sous SON identifiant, jamais `select=data`', lu);
    }
    // ── F. règle de l'app ──
    if (!R || R.__erreur) dit(false, 'F0 la règle src/jaugeActions.js existe', R && R.__erreur);
    else {
      const t = Date.parse('2026-11-10T20:00:00Z');
      const n1 = 'aaaaaaaaaaaaaaaa', n2 = 'bbbbbbbbbbbbbbbb';
      const rows = [
        { id: `actions_compte_123_${n1}`, ts: [t - 50 * 60000, t - 10 * 60000, t - 61 * 60000, t + 5 * 60000] },
        { id: `actions_compte_123_${n2}`, ts: [t - 20 * 60000] },
        { id: `actions_compte_1234_${n1}`, ts: [t - 1000, t - 2000] },
        { id: 'actions_compte_123_court', ts: [t - 1000] },
      ];
      const j = R.jaugeDuCompte(rows, '123', t);
      dit(j && j.n === 3, 'F1 somme des deux Chrome du compte 123 ; ni le compte 1234 (piège du LIKE), ni une ligne au nom forgé, ni une heure de plus d’1 h ou du futur', JSON.stringify(j));
      dit(j && j.repartA === t - 50 * 60000 + 3600000, 'F2 « repart à » = la plus ancienne action de l’heure + 1 h', j && new Date(j.repartA).toISOString());
      dit(R.jaugeDuCompte(null, '123', t) === null && R.jaugeDuCompte([], '123', t) === null, 'F3 lecture ratée ou aucune ligne ⇒ null (« pas su »)');
      const plein = R.jaugeDuCompte([{ id: `actions_compte_9_${n1}`, ts: Array.from({ length: 45 }, (_, i) => t - i * 1000) }], '9', t);
      const presque = R.jaugeDuCompte([{ id: `actions_compte_9_${n1}`, ts: Array.from({ length: 44 }, (_, i) => t - i * 1000) }], '9', t);
      const tx = (x) => R.texteJauge(x);
      dit(tx(plein).ton === 'geste' && tx(presque).ton !== 'geste' && tx(null).valeur === '—' && /^45\/50 cette heure$/.test(tx(plein).valeur), 'F4 ambre seulement à 45 (VRM attend) ; « — » quand pas su ; « 45/50 cette heure »', JSON.stringify([tx(plein), tx(presque), tx(null)]));
      dit(/repart à \d{1,2} h \d{2}/.test(tx(presque).suite), 'F5 « repart à 21 h 40 » (heure de Paris)', tx(presque).suite);
    }
  } finally { if (src !== BG) try { fs.unlinkSync(src); } catch (_) {} }
  return res;
}

const MUTATIONS = {
  // extension
  journal_sans_liste_blanche: { f: 'bg', de: "  const e = { t: Number(t) || Date.now(), s: sorte };", vers: "  const e = { ...(extra || {}), t: Number(t) || Date.now(), s: sorte };" },
  journal_note_les_refus: { f: 'bg', de: "  if (r && r.ok && !permis.lecture) {", vers: "  if (r && !permis.lecture) {" },
  journal_jamais_note: { f: 'bg', de: "      l.push(e); l.sort((p, q) => p.t - q.t);", vers: "      l.sort((p, q) => p.t - q.t);" },
  visite_ne_publie_pas: { f: 'bg', de: "      await publierActions(String(uid), l);\n      g[uid] = t;", vers: "      g[uid] = t;" },
  visite_oublie_la_jauge: { f: 'bg', de: "    publierJaugeVisite(uid).catch(() => {});", vers: "" },
  visite_sans_frein: { f: 'bg', de: "      if (g[uid] && t - Number(g[uid]) < JAUGE_VISITE_MS) return false;", vers: "" },
  baisse_hors_journal: { f: 'bg', de: "  if (cmd === 'baisserPrixVinted') return 'baisse_prix';", vers: "" },
  // app
  jauge_un_seul_chrome: { f: 'regle', de: "  const miennes = rows.filter((r) => r && ligneDe(PREFIXE_ACTIONS, u, r.id));", vers: "  const miennes = rows.filter((r) => r && ligneDe(PREFIXE_ACTIONS, u, r.id)).slice(0, 1);" },
  jauge_piege_like: { f: 'regle', de: "new RegExp(`^${prefixe}${uid}_[0-9a-f]{16}$`)", vers: "new RegExp(`^${prefixe}${uid}`)" },
  jauge_pas_su_vaut_zero: { f: 'regle', de: "  if (!miennes.length) return null;", vers: "" },
  jauge_garde_les_vieilles: { f: 'regle', de: "maintenant - v < HEURE && ", vers: "" },
  ambre_trop_tot: { f: 'regle', de: "    plein: n >= plafond - res,", vers: "    plein: n >= 1," },
  // serveur
  serveur_favori_en_double: { f: 'serveur', de: "const SORTES_EXTENSION = { ", vers: "const SORTES_EXTENSION = { favori: 'favori', " },
  serveur_sans_dedoublon: { f: 'serveur', de: "    if (duTelephone.some(", vers: "    if (false && duTelephone.some(" },
  serveur_select_data: { f: 'serveur', de: "'app_data?id=like.journal_vrm_*&select=id,e:data->e&limit=200'", vers: "'app_data?id=like.journal_vrm_*&select=id,e:data->e,data&limit=200'" },
};

function afficher(res) { for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok ? '' : ' — ' + r.d}`); return res.filter((r) => !r.ok).length; }

(async () => {
  const base = { bgSrc: null, regleSrc: null, serveurSrc: null };
  const res = await controles(base);
  const ko = afficher(res);
  if (!process.argv.includes('--prouve')) { console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-jauge-journal : tout est vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log('\n❌ rouge avant les mutations'); process.exit(1); }
  console.log('\n── Mutations (chacune doit faire rougir au moins un contrôle)');
  const lus = { bg: fs.readFileSync(BG, 'utf8'), regle: fs.readFileSync(REGLE, 'utf8'), serveur: fs.readFileSync(SERVEUR, 'utf8') };
  let survivantes = 0;
  for (const [nom, m] of Object.entries(MUTATIONS)) {
    const s = lus[m.f];
    if (!s.includes(m.de)) { console.log(`❌ ${nom} : motif introuvable`); survivantes++; continue; }
    const muté = s.replace(m.de, m.vers);
    const r = await controles({ bgSrc: m.f === 'bg' ? muté : null, regleSrc: m.f === 'regle' ? muté : null, serveurSrc: m.f === 'serveur' ? muté : null });
    const rouges = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
    if (rouges.length) console.log(`✅ ${nom} ⇒ rouge (${rouges.join(', ')})`); else { console.log(`❌ ${nom} : aucun contrôle ne rougit`); survivantes++; }
  }
  // Sur origin/main : l'arbre d'avant (git archive), ce banc lancé DEPUIS cet arbre.
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-avant-'));
    cp.execSync(`git -C "${path.join(__dirname, '..')}" archive origin/main | tar -x -C "${dir}"`);
    fs.copyFileSync(__filename, path.join(dir, 'scripts', 'audit-jauge-journal.cjs'));
    let sortie = '';
    try { sortie = cp.execSync(`node "${path.join(dir, 'scripts', 'audit-jauge-journal.cjs')}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { sortie = String(e.stdout || ''); }
    const rouges = (sortie.match(/^❌ [A-F]\d/gm) || []).map((x) => x.slice(2));
    console.log(rouges.length ? `✅ origin/main ⇒ rouge (${rouges.join(', ')})` : '❌ origin/main : tout vert (le contrôle ne prouve rien)');
    if (!rouges.length) survivantes++;
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) { console.log('❌ origin/main : ' + e.message); survivantes++; }
  console.log(survivantes ? `\n❌ ${survivantes} preuve(s) manquante(s)` : '\n✅ chaque mutation rougit, origin/main rougit');
  process.exit(survivantes ? 1 : 0);
})();
