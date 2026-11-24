#!/usr/bin/env node
// ── audit-partage-aidant — LE STOCK EN LECTURE SEULE POUR UN AIDANT (16 novembre) ─────────
// Mission 7 de la file (validée par Julien). EXÉCUTE la vraie route (api/_lib/aidant-lien.js
// `traiterAidant`, la même que /api/compte?mode=aidant) contre une base EN MÉMOIRE à la forme de
// PostgREST (projections `select=a:data->>x`, upsert `on_conflict`, DELETE), et la règle du
// navigateur (src/aidantStock.js). Il exige :
//   · un lien = un jeton long, aléatoire, signé ; 24 h par défaut, 7 jours au choix ;
//   · EXPIRÉ ⇒ 410 ; RÉVOQUÉ ⇒ 410 (et l'index retiré) ; retouché ou inconnu ⇒ 404 ;
//   · la réponse ne porte AUCUN champ interdit (prix d'achat, montant, pseudo, adresse,
//     acheteur, compte) : liste blanche côté serveur, à l'écriture ET à la lecture ;
//   · la route publique n'ÉCRIT rien (ni POST accepté, ni journal) ; débit limité AVANT
//     toute lecture de base ; base injoignable ⇒ 503, jamais un stock vide ;
//   · cloisonnement : un vendeur ne voit ni ne coupe le lien d'un autre ;
//   · projection minimale : jamais `select=data`.
//   node scripts/audit-partage-aidant.cjs [--mutation=NOM | --prouve]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const L = 'api/_lib/aidant-lien.js', S = 'src/aidantStock.js', C = 'api/compte.js';
const MUTATIONS = {
  'sans-expiration': [L, "  if (!Number.isFinite(exp) || exp <= maintenant) return { ok: false, raison: 'expire', exp };", "  if (!Number.isFinite(exp)) return { ok: false, raison: 'expire', exp };"],
  'expire-404': [L, "    if (!v0.ok && v0.raison === 'expire') return { status: 410, body: { erreur: 'lien', raison: 'expire' } };", ''],
  'sans-signature': [L, "  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(sig))) return { ok: false, raison: 'signature' };", ''],
  'revocation-index-seul': [L, "    const present = ligne && Array.isArray(ligne.l) && ligne.l.some((x) => x && memeJeton(x.jeton, deps.jeton));", '    const present = !!ligne;'],
  'couper-sans-liste': [L, "    if (!(await ecrire(liens, vueRangee))) return erreurBase;\n    await retirerIndexJeton(", "    await retirerIndexJeton("],
  'prix-servi': [L, "    items.push({ num, lieu: txt(it.lieu, 120), titre: txt(it.titre, 90), photo });", "    items.push({ num, lieu: txt(it.lieu, 120), titre: txt(it.titre, 90), photo, prix: it.prix, buyPrice: it.buyPrice });"],
  'tout-servi': [L, "    const vue = vueAidant(ligne.v) || { items: [] };\n    return { status: 200,", "    const vue = ligne.v || { items: [] };\n    return { status: 200,"],
  'photo-libre': [L, "    const photo = typeof it.photo === 'string' && RE_PHOTO.test(it.photo) ? it.photo : '';", "    const photo = typeof it.photo === 'string' ? it.photo : '';"],
  'public-post': [L, "    if (methode !== 'GET') return { status: 405, body: { erreur: 'GET seulement' } };\n    if (deps.debit", "    if (deps.debit"],
  'sans-debit': [L, "    if (deps.debit && deps.debit(String(deps.jeton).slice(0, 32)) === false) return { status: 429, body: { erreur: 'trop-vite' } };\n", ''],
  'base-vide': [L, "    if (ligne === undefined) return { status: 503, body: { erreur: 'base' } };\n    const present", "    const present"],
  'couper-autre': [L, "    const cible = valides.find((x) => idLien(x.jeton) === id);", "    const cible = valides.find((x) => idLien(x.jeton) === id) || (id ? { jeton: '' } : null);"],
  'duree-libre': [L, "      if (!DUREES_H.includes(heures)) return { status: 400, body: { erreur: 'duree' } };", ''],
  'stock-ambigu': [S, '    const f = fs.length === 1 ? fs[0] : null;', '    const f = fs[0] || null;'],
  'compte-sans-debit': [C, "  const debit = (cleJeton) => prendreDebit('aidant', 'ip:' + ip).ok && prendreDebit('aidant', 'j:' + cleJeton).ok;", '  const debit = () => true;'],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' a levé : ' + e.message); } };
  // Les sources (mutées) dans un dossier neuf, à la même place relative (api/_lib, src).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-aidant-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.cpSync(path.join(RACINE, 'api', '_lib'), path.join(dir, 'api', '_lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const src = { [L]: fs.readFileSync(path.join(RACINE, L), 'utf8'), [S]: fs.readFileSync(path.join(RACINE, S), 'utf8'), [C]: fs.readFileSync(path.join(RACINE, C), 'utf8') };
  if (mut) { const [f, a, b] = MUTATIONS[mut] || []; if (!f) { console.log('mutation inconnue'); process.exit(2); } if (!src[f].includes(a)) { console.log('❌ ancre introuvable : ' + mut); process.exit(1); } src[f] = src[f].replace(a, b); }
  fs.writeFileSync(path.join(dir, L), src[L]); fs.writeFileSync(path.join(dir, S), src[S]);
  const A = await import(pathToFileURL(path.join(dir, L)).href);
  const ST = await import(pathToFileURL(path.join(dir, S)).href);
  const DB = await import(pathToFileURL(path.join(dir, 'api/_lib/debit-vendeur.js')).href);

  // ── La base en mémoire (forme PostgREST) ──
  const NEUTRE = '00000000-0000-0000-0000-000000000000';
  const lignes = new Map();   // `${owner}|${id}` → data
  const journal = { lectures: [], ecritures: 0, panne: false, appels: 0, panneSur: '', deleteRefuse: false };
  const lirePath = (data, p) => { let v = data; for (const seg of p.split(/->>|->/)) v = v == null ? null : v[seg]; return v; };
  const fetch = async (url, opt = {}) => {
    journal.appels++;
    if (journal.panne) return { ok: false, status: 500, json: async () => ({}) };
    const u = new URL(url);
    const owner = (u.searchParams.get('owner') || '').replace(/^eq\./, '');
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    const m = (opt.method || 'GET').toUpperCase();
    if (journal.panneSur && id === journal.panneSur) return { ok: false, status: 500, json: async () => ({}) };
    if (m === 'DELETE' && journal.deleteRefuse) return { ok: false, status: 500, json: async () => ({}) };
    if (m === 'GET') {
      const sel = u.searchParams.get('select') || '';
      journal.lectures.push(sel);
      const d = lignes.get(`${owner}|${id}`);
      if (!d) return { ok: true, status: 200, json: async () => [] };
      const out = {};
      for (const part of sel.split(',')) { const [alias, chemin] = part.split(':'); const v = lirePath(d, chemin.replace(/^data(->>|->)/, '')); out[alias] = /->>/.test(chemin) && v != null && typeof v !== 'object' ? String(v) : v; }
      return { ok: true, status: 200, json: async () => [out] };
    }
    journal.ecritures++;
    if (m === 'POST') { for (const r of JSON.parse(opt.body)) lignes.set(`${r.owner}|${r.id}`, JSON.parse(JSON.stringify(r.data))); return { ok: true, status: 201, json: async () => [] }; }
    if (m === 'DELETE') { lignes.delete(`${owner}|${id}`); return { ok: true, status: 204, json: async () => [] }; }
    return { ok: false, status: 405 };
  };
  const T0 = Date.parse('2026-11-16T10:00:00Z'), H = 3600e3;
  const env = { AIDANT_SECRET: 'secret-de-banc-invente' };
  const base = { base: 'https://base.invalide', cle: 'cle-service-inventee', env, fetch, origine: 'https://vrm.center' };
  const UA = '11111111-1111-4111-8111-111111111111', UB = '22222222-2222-4222-8222-222222222222';
  const vendeur = (user, methode, corps, maintenant = T0) => A.traiterAidant({ ...base, methode, user: { id: user }, corps, maintenant });
  const aidant = (jeton, maintenant = T0, extra = {}) => A.traiterAidant({ ...base, methode: 'GET', jeton, maintenant, ...extra });
  // Une vue INVENTÉE qui porte aussi des champs INTERDITS (le serveur doit les retirer).
  const INTERDITS = { prix: 129, buyPrice: 55, montant: 77.5, pseudo: 'acheteuse_inventee', adresse: '12 rue Inventee', acheteur: 'Jeanne Inventee', compte: 'shop_invente', email: 'x@invente.test' };
  const vue = { items: [
    { num: '124', lieu: 'Garage · Étagère B · case 3', titre: 'Jordan 1 Mid Chicago 42', photo: 'https://images1.vinted.net/t/a/f800/1.jpeg', ...INTERDITS },
    { num: 'B12', lieu: 'Bureau · Carton 4', titre: 'Asics Gel', photo: 'javascript:alert(1)', ...INTERDITS },
  ], ...INTERDITS };
  const urlJeton = (r) => (r.body.liens[0] && r.body.liens[0].url ? r.body.liens[0].url.split('/a/')[1] : '');

  let jA = '';
  await essaie('créer et lire', async () => {
    const r = await vendeur(UA, 'POST', { action: 'creer', vue });
    jA = urlJeton(r);
    dit(r.status === 200 && r.body.liens.length === 1 && A.RE_JETON_AIDANT.test(jA) && jA.split('.')[0].length >= 32 && r.body.liens[0].heures === 24, 'créer : un lien, jeton long aléatoire signé, 24 h par défaut', r.body);
    dit(Math.abs(r.body.liens[0].exp - (T0 + 24 * H)) < 1000, '… qui expire dans 24 h', r.body.liens[0].exp);
    const stocke = JSON.stringify(lignes.get(`${UA}|vrm_aidant`).vue);
    dit(!Object.values(INTERDITS).some((x) => stocke.includes(String(x))), 'à l’écriture, la liste blanche retire prix, montant, pseudo, adresse, acheteur, compte', stocke.slice(0, 200));
    const avant = journal.ecritures;
    const g = await aidant(jA, T0 + H);
    const corps = JSON.stringify(g.body);
    dit(g.status === 200 && g.body.vue.items.length === 2 && g.body.vue.items[0].num === '124' && g.body.vue.items[0].lieu === 'Garage · Étagère B · case 3', 'l’aidant lit le stock : N°, lieu', g.body);
    dit(g.body.vue.items.every((it) => Object.keys(it).sort().join() === 'lieu,num,photo,titre'), 'chaque ligne : num, lieu, titre, photo — RIEN d’autre', g.body.vue.items.map((it) => Object.keys(it)));
    dit(!Object.values(INTERDITS).some((x) => corps.includes(String(x))), 'aucun champ interdit dans la réponse (prix, montant, pseudo, adresse, acheteur, compte, e-mail)', corps.slice(0, 200));
    dit(g.body.vue.items[1].photo === '' && g.body.vue.items[0].photo.startsWith('https://images1.vinted.net/'), 'photo : une adresse d’image https seulement (javascript: retiré)');
    dit(journal.ecritures === avant, 'la lecture publique n’écrit RIEN (pas même un journal)', journal.ecritures - avant);
    const p = await A.traiterAidant({ ...base, methode: 'POST', jeton: jA, corps: { action: 'couper' }, maintenant: T0 });
    dit(p.status === 405 && journal.ecritures === avant, 'par le lien, aucune écriture possible (POST ⇒ 405)', p.status);
  });

  await essaie('expiration', async () => {
    const g = await aidant(jA, T0 + 25 * H);
    dit(g.status === 410 && g.body.raison === 'expire', 'après 24 h : 410 (expiré), vérifié CÔTÉ SERVEUR', g);
    const r7 = await vendeur(UA, 'POST', { action: 'creer', heures: 168, vue });
    const j7 = r7.body.liens.find((l) => l.heures === 168);
    const t7 = j7.url.split('/a/')[1];
    dit((await aidant(t7, T0 + 6 * 24 * H)).status === 200 && (await aidant(t7, T0 + 8 * 24 * H)).status === 410, '7 jours au choix : lisible à 6 j, 410 à 8 j');
    dit((await vendeur(UA, 'POST', { action: 'creer', heures: 720, vue })).status === 400, 'une autre durée (30 j) est refusée');
    const [al, exp, s] = jA.split('.');
    const retouche = `${al}.${(parseInt(exp, 36) + 365 * 24 * H).toString(36)}.${s}`;
    dit((await aidant(retouche, T0 + 25 * H)).status === 404, 'une expiration retouchée (signature fausse) ⇒ 404');
    dit((await aidant('x'.repeat(40), T0)).status === 404, 'un jeton inventé ⇒ 404');
  });

  await essaie('révocation et cloisonnement', async () => {
    const r = await vendeur(UA, 'GET', null, T0 + H);
    dit(r.status === 200 && r.body.liens.length === 2 && r.body.liens.every((l) => !String(l.id).includes('.') && l.id.length === 16), 'Paramètres : la liste des liens actifs (un identifiant court, jamais le jeton)', r.body.liens);
    const idA = r.body.liens.find((l) => l.heures === 24).id;
    // Un AUTRE vendeur ne voit ni ne coupe ce lien.
    const rb = await vendeur(UB, 'GET', null, T0 + H);
    dit(rb.status === 200 && rb.body.liens.length === 0, 'un autre vendeur ne voit pas ces liens');
    const cb = await vendeur(UB, 'POST', { action: 'couper', id: idA }, T0 + H);
    dit(cb.status === 404 && (await aidant(jA, T0 + 2 * H)).status === 200, '… ni ne les coupe (404), le lien marche toujours', cb);
    // L'index ne s'efface pas (base capricieuse) : le lien est révoqué QUAND MÊME (la liste du vendeur fait foi).
    journal.deleteRefuse = true;
    const c = await vendeur(UA, 'POST', { action: 'couper', id: idA }, T0 + 2 * H);
    journal.deleteRefuse = false;
    dit(c.status === 200 && c.body.liens.length === 1, 'révoquer : le lien sort de la liste');
    const g = await aidant(jA, T0 + 2 * H);
    dit(g.status === 410 && g.body.raison === 'revoque', 'révoqué ⇒ 410, tout de suite', g);
    dit(g.status === 410, '… même si l’index n’a pas pu être retiré : la liste du vendeur fait foi');
  });

  await essaie('débit, panne, projection', async () => {
    const n0 = journal.appels;
    const t = await aidant('y'.repeat(40), T0, { debit: () => false });
    dit(t.status === 429 && journal.appels === n0, 'débit dépassé ⇒ 429 AVANT toute lecture de base', { s: t.status, appels: journal.appels - n0 });
    DB._viderDebits();
    let refus = 0; for (let i = 0; i < 25; i++) if (!DB.prendreDebit('aidant', 'ip:198.51.100.7', { maintenant: T0 }).ok) refus++;
    dit(refus === 5, 'la règle de débit de la route : 20 par minute et par adresse (le 21e refusé)', refus);
    const r = await vendeur(UA, 'GET', null, T0 + 3 * H);
    const jok = (await vendeur(UA, 'POST', { action: 'creer', vue }, T0 + 3 * H)).body.liens[0].url.split('/a/')[1];
    journal.panne = true;
    const p = await aidant(jok, T0 + 3 * H);
    journal.panne = false;
    dit(p.status === 503, 'base injoignable ⇒ 503, jamais un stock vide', p);
    journal.panneSur = 'vrm_aidant';
    const p2 = await aidant(jok, T0 + 3 * H);
    journal.panneSur = '';
    dit(p2.status === 503, '… même quand seul le stock du vendeur n’a pas répondu (l’index, lui, a répondu)', p2);
    // Une ligne ancienne ou abîmée qui porterait des champs interdits : la liste blanche s'applique AUSSI à la lecture.
    const d = lignes.get(`${UA}|vrm_aidant`);
    lignes.set(`${UA}|vrm_aidant`, { ...d, vue: { items: [{ num: '9', lieu: 'Cave', titre: 'X', photo: '', ...INTERDITS }], ...INTERDITS } });
    const g = await aidant(jok, T0 + 3 * H);
    lignes.set(`${UA}|vrm_aidant`, d);
    dit(g.status === 200 && !Object.values(INTERDITS).some((x) => JSON.stringify(g.body).includes(String(x))), 'la liste blanche s’applique AUSSI à la lecture (une ligne qui porterait un prix ne le sert pas)', g.body);
    dit(r.status === 200 && journal.lectures.every((s) => s && !/(^|,)(\w+:)?data(,|$)/.test(s)), 'projection minimale : jamais `select=data`', journal.lectures.filter((s) => /(^|,)(\w+:)?data(,|$)/.test(s)));
  });

  await essaie('le stock publié par le navigateur', async () => {
    const fiches = { a1: { numero: '124', title: 'Jordan 1', photo: { url: 'https://images1.vinted.net/t/x.jpeg' }, buyPrice: '55', price: '129', accountId: '9' }, a2: { numero: '7', title: 'Puma A' }, a3: { numero: '007', title: 'Puma B' } };
    const v = ST.vueDuStock([{ numero: '124', lieu: 'Étagère B · case 3' }, { numero: '7', lieu: 'Carton 1' }, { numero: '124', lieu: 'Étagère B · case 3' }], fiches);
    dit(v.items.length === 2 && v.items.find((x) => x.num === '124').titre === 'Jordan 1' && v.items.find((x) => x.num === '124').photo === 'https://images1.vinted.net/t/x.jpeg', 'une ligne par N° rangé, son titre et sa photo par IDENTITÉ de N°', v);
    dit(v.items.find((x) => x.num === '7').titre === '' , 'deux fiches au même N° (7 = 007) : ni titre ni photo (mieux vaut un blanc qu’un faux)', v.items);
    dit(!/55|129|"9"/.test(JSON.stringify(v)), 'le navigateur ne publie ni prix ni compte');
  });

  await essaie('branchement', async () => {
    const c = src[C];
    dit(/if \(mode === 'aidant'\) return \(m === 'GET' \|\| m === 'POST'\) \? aidant\(req, res\)/.test(c) && /prendreDebit\('aidant', 'ip:' \+ ip\)\.ok && prendreDebit\('aidant', 'j:' \+ cleJeton\)\.ok/.test(c), '/api/compte?mode=aidant : la route, débit par adresse ET par jeton (aucune fonction api/ neuve)');
    const v = fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8');
    dit(/"source": "\/a\/:jeton\(\[A-Za-z0-9_\.-\]\{40,80\}\)",\s*"destination": "\/\?aidant=:jeton"/.test(v), 'vercel.json : /a/<jeton> ⇒ la page de l’aidant');
  });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(ko ? `\n❌ partage aidant : ${ko} rouge(s)` : '\n✅ partage aidant : tout est vert');
  process.exit(ko ? 1 : 0);
})();
