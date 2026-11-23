// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES DEUX GESTES AUTOMATIQUES DÉCIDÉS PAR JULIEN (19 nov., « 1 oui, 3 oui », 5.409)
//  1. La BAISSE PAR RÈGLE (`vinted_baisse_regle`, éteinte par défaut) : l'extension range une
//     baisse dans la file des baisses en attente, exécutée par `baisserPrixVinted` (compte de
//     l'onglet, prix lu avant / relu après, 45/h, sécurité, discrétion). Plancher : le prix mini,
//     sinon l'achat + 10 %, sinon AUCUNE baisse.
//  2. VENDUE AILLEURS ⇒ MASQUÉE sur Vinted (`vinted_masquer_ailleurs`) : seulement sur une vente
//     PROUVÉE ailleurs, geste appris (`PUT /api/v2/items/{id}/is_hidden`), jamais une suppression ;
//     vente annulée ⇒ démasquée (seulement ce que VRM a masqué, seulement sur une liste complète).
//  Le VRAI `background.js` dans un vm (scripts/_fond-vm.cjs), une base à état, un faux Vinted.
//    node scripts/audit-regles-auto.cjs            les contrôles
//    node scripts/audit-regles-auto.cjs --prouve   + chaque mutation doit rougir, + le code d'origin/main (§6.1)
//    node scripts/audit-regles-auto.cjs --recopie  recopie le bloc <regles-auto-regle> de src/reglesAuto.js dans l'extension
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const F_APP = path.join(RACINE, 'src', 'reglesAuto.js');
const BLOC_RE = /\/\/ <regles-auto-regle>[^\n]*\n([\s\S]*?)\/\/ <\/regles-auto-regle>/;

if (process.argv.includes('--recopie')) {
  const app = fs.readFileSync(F_APP, 'utf8'), bg = fs.readFileSync(BG, 'utf8');
  const m = BLOC_RE.exec(app);
  if (!m || !BLOC_RE.test(bg)) { console.error('bloc <regles-auto-regle> introuvable'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(BLOC_RE, () => '// <regles-auto-regle> — COPIE de src/reglesAuto.js (scripts/audit-regles-auto.cjs --recopie). Ne pas modifier ici.\n' + m[1] + '// </regles-auto-regle>'));
  console.log('bloc <regles-auto-regle> recopié dans background.js');
  process.exit(0);
}
const { faireFond } = require('./_fond-vm.cjs');
const H = 3600000, J = 864e5;
const MOI = '0b0b0b0b-0000-4000-8000-00000000000a';
const UID = '111', UID2 = '222';
const A1 = '91020001', A2 = '91020002', A3 = '91020003';
const iso = (t) => new Date(t).toISOString();

async function chargerApp(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regles-auto-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'r.js'), texte);
    return await import(pathToFileURL(path.join(dir, 'r.js')).href);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

const corpsAnnonce = (id, prix) => ({ item: { id: Number(id), title: 'Nike P-6000', description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }] } });
const lueAnnonce = (id, prix) => ({ item: { id: Number(id), title: 'Nike P-6000', description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }] } });
const item = (id, prix, o = {}) => Object.assign({ id: Number(id), title: 'x', price: { amount: String(prix), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor((Date.now() - 20 * J) / 1000) }, o);
const SECU = { plateformes: { vinted: { repos: { actif: false } } } };   // le banc n'est pas soumis à l'heure de la nuit

// Le fond, une base, un Vinted. `main` : les clés de la ligne main ; `items` : le dressing de UID.
function monter({ src, main = {}, items = [], dressingAge = 10 * 60000, appris = true, connecte = UID, store = {}, rep = {}, modeles = [A1, A2, A3], registre = null } = {}) {
  const st = store;
  st.vrmSession = { access_token: 'jeton.vrm.banc', refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' };
  st.vrmCloisonne = true;
  const lignes = {
    main: Object.assign({ vrm_securite_comptes: SECU }, main),
    [`harvest_${UID}_listings`]: { capturedAt: iso(Date.now() - dressingAge), payload: { items } },
    vrm_vinted_modele: Object.fromEntries(modeles.map((id) => [id, { corps: JSON.stringify(corpsAnnonce(id, 59)), at: iso(Date.now()), uid: UID }])),
  };
  for (const id of [A1, A2, A3]) lignes[`coffre_${UID}_${id}`] = { id, photos: ['a'] };
  if (appris) lignes[`harvest_${UID2}_wreq_api_v2_items_id_is_hidden`] = { uid: UID2, method: 'PUT', path: '/api/v2/items/10432215694/is_hidden', body: '{"is_hidden":true}', capturedAt: iso(Date.now() - 5 * J) };
  if (registre) lignes.vinted_masquees_vrm = { items: registre };
  const prix = Object.fromEntries(items.map((x) => [String(x.id), Number(x.price.amount)]));
  const caches = {};
  const vinted = (e) => {
    const m = /^\/api\/v2\/item_upload\/items\/(\d+)$/.exec(e.chemin);
    if (m) {
      if (prix[m[1]] === undefined) return { status: 404, body: {} };
      if (e.methode === 'GET') return { status: 200, body: lueAnnonce(m[1], prix[m[1]]) };
      if (e.methode === 'PUT') { try { prix[m[1]] = Number(JSON.parse(e.corps).item.price.amount); } catch (_) {} return { status: 200, body: {} }; }
    }
    const h = /^\/api\/v2\/items\/(\d+)\/is_hidden$/.exec(e.chemin);
    if (h && e.methode === 'PUT') {
      let v = null; try { v = JSON.parse(e.corps).is_hidden; } catch (_) {}
      caches[h[1]] = v;
      if (rep.masquer === 'refus') return { status: 403, body: { message: 'non' } };
      if (rep.masquer === 'muet') return { status: 200, body: { code: 0 } };
      return { status: 200, body: { item: { id: Number(h[1]), is_hidden: v } } };
    }
    return { status: 404, body: {} };
  };
  const comptes = [{ vinted_user_id: UID, login: 'compte_un', domain: 'www.vinted.fr', access_token: 'j1' }, { vinted_user_id: UID2, login: 'compte_deux', domain: 'www.vinted.fr', access_token: 'j2' }];
  const f = faireFond({ src, lignes, store: st, vinted, connecte, comptes });
  f.ctx.activeAccountId = async () => connecte;
  f.ctx.activeUidForDomain = async () => connecte;
  // Les lignes `cmd_prix_*` : une table à état qui garde le PROPRIÉTAIRE (la vraie base l'a ; le fond commun non).
  const table = {};
  const orig = f.ctx.fetch;
  const repJ = (status, body) => ({ ok: status >= 200 && status < 400, status, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) });
  f.ctx.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const meth = (opts.method || 'GET').toUpperCase();
    if (/\/rest\/v1\/app_data/.test(u) && meth === 'POST') {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      const cmds = (Array.isArray(rows) ? rows : []).filter((r) => r && /^cmd_prix_/.test(String(r.id)));
      if (cmds.length) { for (const r of cmds) table[r.id] = { id: r.id, owner: r.owner, data: JSON.parse(JSON.stringify(r.data)) }; return repJ(201, ''); }
    }
    if (/\/rest\/v1\/app_data\?/.test(u) && /cmd_prix_/.test(u)) {
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.cmd_prix_/.test(u);
      if (meth === 'GET') {
        let rows = like ? Object.values(table) : (eq && table[eq[1]] ? [table[eq[1]]] : []);
        if (/meta->>etat=eq\.attente/.test(u)) rows = rows.filter((r) => r.data.etat === 'attente');
        rows.sort((a, b) => a.id.localeCompare(b.id));
        const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
        return repJ(200, rows.map((r) => {
          if (/^id,owner,data$/.test(sel)) return { id: r.id, owner: r.owner, data: JSON.parse(JSON.stringify(r.data)) };
          const o = {};
          for (const ch of sel.split(',')) { const mm = /^(?:(\w+):)?(?:meta->>|data->>)?(\w+)$/.exec(ch); if (!mm) continue; const k = mm[2]; o[mm[1] || k] = k === 'id' ? r.id : (r.data[k] == null ? null : String(r.data[k])); }
          return o;
        }));
      }
      if (meth === 'PATCH') {
        const own = (/[?&]owner=eq\.([^&]+)/.exec(u) || [])[1], cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1];
        const r = eq && table[eq[1]];
        let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
        if (!r || (own && r.owner !== own) || (cond && r.data.etat !== cond)) return repJ(200, []);
        r.data = corps.data; return repJ(200, [{ id: r.id }]);
      }
    }
    return orig(url, opts);
  };
  return Object.assign(f, { table, prix, caches, lignes });
}
const regle = (o = {}) => ({ v: 1, comptes: { [UID]: Object.assign({ actif: true, pct: 5, jours: 14 }, o) } });
const fiche = (num, o = {}) => Object.assign({ numero: num, accountId: UID }, o);
const deposees = (f) => Object.values(f.table).filter((r) => r.data.source === 'regle');
const masqueurs = (f) => f.j.vinted.filter((v) => /\/is_hidden$/.test(v.chemin));
const tickR = async (f) => (typeof f.ctx.regleBaisseTick === 'function' ? f.ctx.regleBaisseTick('banc') : { absent: true });
const tickM = async (f) => (typeof f.ctx.masquerAilleursTick === 'function' ? f.ctx.masquerAilleursTick('banc') : { absent: true });
const liste = (items, o = {}) => Object.assign({ v: 1, at: Date.now() - 60000, complet: true, items }, o);

async function controles({ bg, appTexte }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  const essaie = async (m, fn) => { try { await fn(); } catch (e) { dit(false, m + ' — a levé', String(e && e.message).slice(0, 200)); } };
  const src = bg;
  // ══ P : LA RÈGLE (le bloc, des deux côtés) ══
  let P = null;
  try { P = await chargerApp(appTexte != null ? appTexte : fs.readFileSync(F_APP, 'utf8')); } catch (e) { dit(false, 'P0 src/reglesAuto.js se charge', e.message); }
  { const a = BLOC_RE.exec(appTexte != null ? appTexte : (fs.existsSync(F_APP) ? fs.readFileSync(F_APP, 'utf8') : '')), b = BLOC_RE.exec(fs.readFileSync(bg, 'utf8'));
    dit(!!a && !!b && a[1] === b[1], 'P1 le bloc <regles-auto-regle> est le MÊME dans l’app et l’extension'); }
  if (P && P.baisseDue) {
    const t = Date.now(), r = { pct: 5, jours: 14 };
    dit(P.regleBaisseDe(null, UID) === null && P.regleBaisseDe({ comptes: { [UID]: { pct: 5, jours: 14 } } }, UID) === null && P.regleDuCompte(null, UID).actif === false, 'P2 éteinte par défaut : sans `actif: true` posé par lui, aucune règle');
    const pl = P.plancherBaisse(fiche('1', { min: '50' }), {}), pa = P.plancherBaisse(fiche('1', { buyPrice: '40' }), {}), pn = P.plancherBaisse(fiche('7'), { 7: '30' }), p0 = P.plancherBaisse(fiche('1'), {});
    dit(pl && pl.c === 5000 && pa && pa.c === 4400 && pn && pn.c === 3300 && p0 === null, 'P3 plancher : le prix mini, sinon l’achat + 10 % (fiche ou N°), sinon AUCUN', { pl, pa, pn, p0 });
    const d1 = P.baisseDue({ prixC: 5900, depuis: t - 20 * J, regle: r, plancher: { c: 5000 }, maintenant: t });
    const d2 = P.baisseDue({ prixC: 5900, depuis: t - 20 * J, regle: { pct: 15, jours: 14 }, plancher: { c: 5500 }, maintenant: t });
    const d3 = P.baisseDue({ prixC: 5500, depuis: t - 20 * J, regle: r, plancher: { c: 5500 }, maintenant: t });
    const d4 = P.baisseDue({ prixC: 5900, depuis: t - 3 * J, regle: r, plancher: { c: 5000 }, maintenant: t });
    const d5 = P.baisseDue({ prixC: 5900, depuis: t - 20 * J, regle: r, plancher: null, maintenant: t });
    dit(d1.vouluC === 5600 && d2.vouluC === 5500 && d3.non === 'au-plancher' && d4.non === 'trop-tot' && d5.non === 'sans-plancher', 'P4 −5 % de 59 € ⇒ 56 € ; jamais sous le plancher (remonté à 55 €) ; au plancher, trop tôt, sans plancher ⇒ rien', { d1, d2, d3, d4, d5 });
    let viole = 0;
    for (let i = 0; i < 400; i++) { const prixC = 200 + Math.floor(Math.random() * 30000), pc = 100 + Math.floor(Math.random() * 30000), pct = 3 + Math.floor(Math.random() * 28); const d = P.baisseDue({ prixC, depuis: 1, regle: { pct, jours: 3 }, plancher: { c: pc }, maintenant: t }); if (d.vouluC != null && (d.vouluC < pc || d.vouluC >= prixC)) viole++; }
    dit(viole === 0, 'P5 400 tirages : une baisse n’est JAMAIS sous le plancher ni une hausse', viole);
    const dr = { capturedAt: iso(t - 60000), items: [item(A1, 59), item(A2, 80, { is_hidden: true }), item(A3, 70)] };
    const plan = P.masquerAFaire({ liste: liste([{ id: A1, uid: UID }, { id: A3, uid: UID2 }]), dressing: dr, registre: { [A2]: { uid: UID, etat: 'masquee' } }, uid: UID, maintenant: t });
    dit(plan.masquer.join() === A1 && plan.demasquer.join() === A2, 'P6 masquer : seulement la liste (vente prouvée), de CE compte ; démasquer : ce que VRM a masqué, absent d’une liste complète', plan);
    const plan2 = P.masquerAFaire({ liste: liste([], { complet: false }), dressing: dr, registre: { [A2]: { uid: UID, etat: 'masquee' } }, uid: UID, maintenant: t });
    const plan3 = P.masquerAFaire({ liste: liste([], {}), dressing: dr, registre: {}, uid: UID, maintenant: t });
    const plan4 = P.masquerAFaire({ liste: liste([{ id: A1, uid: UID }], { at: t - 50 * H }), dressing: dr, registre: {}, uid: UID, maintenant: t });
    dit(!plan2.demasquer.length && !plan3.demasquer.length && !plan4.masquer.length, 'P7 liste incomplète ⇒ rien démasqué ; masquée par LUI (pas au registre) ⇒ jamais démasquée ; liste périmée (48 h) ⇒ rien', { plan2, plan3, plan4 });
    dit(P.masquerAppris([{ m: 'PUT', p: '/api/v2/items/123456/is_hidden', b: '{"is_hidden":false}' }]) && !P.masquerAppris([{ m: 'POST', p: '/api/v2/items/123456/delete', b: '' }]) && !P.masquerAppris([]), 'P8 le geste « masquer » n’est appris que sur SON geste `PUT …/is_hidden` (jamais une suppression)');
    if (P.listeMasquerAilleurs) {
      const calc = { lignes: [{ plateforme: 'Vinted', compte: UID, id: A1, numero: '12', ventes: [{ plateforme: 'Leboncoin', engagee: true }] }, { plateforme: 'Vinted', compte: UID, id: A2, numero: '13', ventes: [{ plateforme: 'Vinted', engagee: true }] }, { plateforme: 'Vinted', compte: UID, id: A3, numero: '14', ventes: [{ plateforme: 'eBay', engagee: false }] }, { plateforme: 'Vinted', compte: UID, id: '91020009', numero: '15', ventes: [{ plateforme: 'eBay', engagee: true }], aConfirmer: true }] };
      const l = P.listeMasquerAilleurs({ manques: [] }, calc, t);
      const l2 = P.listeMasquerAilleurs(null, null, t);
      dit(l.items.map((x) => x.id).join() === A1 && l.complet === true && l2.complet === false && !l2.items.length, 'P9 la liste publiée : vendue (engagée) sur un AUTRE site seulement ; autre compte Vinted, vente non engagée, remise en vente à confirmer ⇒ dehors ; lecture ratée ⇒ incomplète', l);
    }
  }

  // ══ R : LA BAISSE PAR RÈGLE, le vrai background.js ══
  const baseR = (o = {}) => ({ main: Object.assign({ vinted_baisse_regle: regle(), vinted_annonce_numeros: { [A1]: fiche('134', { min: '50' }) } }, o.main || {}), items: o.items || [item(A1, 59)], ...o.opts });
  await essaie('R1', async () => {
    const f = monter({ src, ...baseR({ main: { vinted_baisse_regle: undefined } }) });
    const r = await tickR(f);
    dit(!r.absent && deposees(f).length === 0 && f.j.vinted.length === 0, 'R1 aucune règle posée ⇒ éteinte : rien n’est rangé, aucune requête Vinted', r);
  });
  await essaie('R2', async () => {
    const f = monter({ src, ...baseR() });
    const r = await tickR(f);
    const d = (deposees(f)[0] || {}).data || {};
    dit(deposees(f).length === 1 && d.site === 'vinted' && d.args.uid === UID && d.args.id === A1 && d.args.prix === 56 && d.args.prixAvant === 59 && d.confirme === true && d.etat === 'attente' && d.pasAvant > Date.now() && f.j.vinted.length === 0,
      'R2 règle −5 % / 14 j, mini 50 € ⇒ UNE baisse rangée (59 → 56 €, prix vu 59), programmée plus tard ; ce passage ne touche pas Vinted', { r, d });
    // L'exécution : le chemin de baisse existant, prix LU puis RELU, au journal.
    for (const x of Object.values(f.table)) x.data.pasAvant = 0;
    delete f.store.vrmPrixAttSuivant;
    await f.ctx.prixAttenteTick('banc');
    const puts = f.j.vinted.filter((v) => v.methode === 'PUT');
    const fin = (deposees(f)[0] || {}).data || {};
    const journal = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'baisse_prix');
    dit(puts.length === 1 && f.prix[A1] === 56 && fin.etat === 'fait' && fin.prixVu === 56 && journal.length === 1 && f.j.vinted[0].methode === 'GET',
      'R3 … exécutée par `baisserPrixVinted` : prix lu avant, UNE modification, prix RELU 56 €, notée dans « Ce que VRM a fait »', { puts: puts.length, etat: fin.etat, vu: fin.prixVu, journal: journal.length });
    const r2 = await tickR(f);
    dit(deposees(f).length === 1, 'R4 un second passage juste après ⇒ rien de plus (espacement, et 14 j avant la suivante)', r2);
  });
  await essaie('R5', async () => {
    const f1 = monter({ src, ...baseR({ main: { vinted_annonce_numeros: { [A1]: fiche('134', { min: '57' }) } } }) }); await tickR(f1);
    const f2 = monter({ src, ...baseR({ main: { vinted_annonce_numeros: { [A1]: fiche('134', { min: '59' }) } } }) }); await tickR(f2);
    const f3 = monter({ src, ...baseR({ main: { vinted_baisse_regle: regle({ pct: 15 }), vinted_annonce_numeros: { [A1]: fiche('134', { buyPrice: '50' }) } } }) }); await tickR(f3);
    const f4 = monter({ src, ...baseR({ main: { vinted_annonce_numeros: { [A1]: fiche('134') } } }) }); await tickR(f4);
    const p = (f) => { const d = deposees(f)[0]; return d ? d.data.args.prix : null; };
    dit(p(f1) === 57 && p(f2) === null && p(f3) === 55 && p(f4) === null, 'R5 plancher tenu par l’extension : mini 57 ⇒ 57 € ; mini 59 ⇒ rien ; achat 50 € (−15 %) ⇒ 55 € (achat + 10 %) ; ni mini ni achat ⇒ AUCUNE baisse', [p(f1), p(f2), p(f3), p(f4)]);
  });
  await essaie('R6', async () => {
    const cas = [
      ['vérification anti-robot (1er captcha)', { store: { vrmCaptcha: { [UID]: { depuis: Date.now() - 60000 } } } }],
      ['vérification anti-robot (sécurité des comptes)', { store: { vrmSecu: { presence: { vinted: Date.now() }, comptes: { ['vinted:' + UID]: { robot: Date.now() - 60000 } } } } }],
      ['prudence', { store: { vrmPrudence: { [UID]: { depuis: Date.now() - 60000, jusqua: Date.now() + 20 * H } } } }],
      ['pause 429/403', { store: { vrmPauseVinted: { jusqua: Date.now() + H, depuis: Date.now() } } }],
      ['autre compte dans l’onglet', { connecte: UID2 }],
      ['dressing de plus de 24 h', { dressingAge: 30 * H }],
      ['format pas appris', { modeles: [] }],
      ['trop tôt (mise en ligne il y a 5 j)', { items: [item(A1, 59, { created_at_ts: Math.floor((Date.now() - 5 * J) / 1000) })] }],
    ];
    const rates = [];
    for (const [nom, o] of cas) {
      const f = monter({ src, ...baseR(), ...o, items: o.items || [item(A1, 59)] });
      await tickR(f);
      if (deposees(f).length || f.j.vinted.length) rates.push(nom);
    }
    dit(!rates.length, `R6 rien n’est rangé ni envoyé (${cas.length} cas : captcha, anti-robot, prudence, pause, autre compte, dressing ancien, format pas appris, trop tôt)`, rates.join(' · '));
  });
  await essaie('R7', async () => {
    const f = monter({ src, ...baseR(), store: { vrmActions: { [UID]: Array.from({ length: 45 }, (_, i) => Date.now() - 60000 + i) } } });
    await tickR(f);
    for (const x of Object.values(f.table)) x.data.pasAvant = 0;
    delete f.store.vrmPrixAttSuivant;
    await f.ctx.prixAttenteTick('banc');
    const d = (deposees(f)[0] || {}).data || {};
    dit(deposees(f).length === 1 && f.j.vinted.filter((v) => v.methode === 'PUT').length === 0 && d.etat === 'attente' && f.prix[A1] === 59, 'R7 45 actions déjà faites cette heure ⇒ la baisse ATTEND (réserve de 5 tenue), rien n’est modifié', { etat: d.etat });
  });

  // ══ M : VENDUE AILLEURS ⇒ MASQUÉE ══
  const baseM = (o = {}) => ({ main: { vinted_masquer_ailleurs: liste([{ id: A1, uid: UID, num: '134', site: 'Leboncoin' }]) }, items: [item(A1, 59), item(A2, 80)], ...o });
  await essaie('M1', async () => {
    const f = monter({ src, ...baseM() });
    const r = await tickM(f);
    const m = masqueurs(f);
    const reg = ((f.lignes.vinted_masquees_vrm || {}).items || {})[A1] || {};
    const journal = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'masquee');
    dit(m.length === 1 && m[0].methode === 'PUT' && m[0].chemin === `/api/v2/items/${A1}/is_hidden` && f.caches[A1] === true && reg.etat === 'masquee' && reg.relu === true && journal.length === 1,
      'M1 vendue (prouvée) sur Leboncoin ⇒ UN `PUT …/is_hidden {is_hidden:true}` sur le compte de l’onglet, relu, au registre et au journal', { r, reg });
    dit(!f.j.vinted.some((v) => /delete|\/items\/\d+$/.test(v.chemin) && v.methode !== 'GET'), 'M2 jamais une suppression');
    const r2 = await tickM(f);
    dit(masqueurs(f).length === 1, 'M3 un second passage ⇒ rien de plus (déjà masquée)', r2);
  });
  await essaie('M4', async () => {
    const cas = [
      ['pas dans la liste (aucune vente prouvée)', { main: { vinted_masquer_ailleurs: liste([]) } }],
      ['liste périmée (48 h)', { main: { vinted_masquer_ailleurs: liste([{ id: A1, uid: UID }], { at: Date.now() - 50 * H }) } }],
      ['geste jamais appris', { appris: false }],
      ['autre compte dans l’onglet', { connecte: UID2 }],
      ['vérification anti-robot', { store: { vrmCaptcha: { [UID]: { depuis: Date.now() - 60000 } } } }],
      ['pause 429/403', { store: { vrmPauseVinted: { jusqua: Date.now() + H, depuis: Date.now() } } }],
      ['plafond de l’heure (45 + 5 de réserve)', { store: { vrmActions: { [UID]: Array.from({ length: 45 }, (_, i) => Date.now() - 60000 + i) } } }],
      ['dressing de plus de 24 h', { dressingAge: 30 * H }],
      ['annonce d’un autre compte', { main: { vinted_masquer_ailleurs: liste([{ id: A1, uid: UID2 }]) } }],
    ];
    const rates = [];
    for (const [nom, o] of cas) { const f = monter({ src, ...baseM(), ...o }); await tickM(f); if (masqueurs(f).length) rates.push(nom); }
    dit(!rates.length, `M4 rien n’est masqué (${cas.length} cas)`, rates.join(' · '));
    const f = monter({ src, ...baseM(), appris: false }); await tickM(f);
    dit((f.lignes.vinted_masquees_vrm || {}).appris === false, 'M5 geste jamais vu ⇒ c’est DIT (registre : `appris: false`, l’app le lit)');
  });
  await essaie('M6', async () => {
    const reg = { [A2]: { uid: UID, etat: 'masquee', num: '200' } };
    const f = monter({ src, main: { vinted_masquer_ailleurs: liste([]) }, items: [item(A2, 80, { is_hidden: true })], registre: reg });
    await tickM(f);
    const m = masqueurs(f);
    const journal = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'demasquee');
    dit(m.length === 1 && f.caches[A2] === false && !((f.lignes.vinted_masquees_vrm || {}).items || {})[A2] && journal.length === 1, 'M6 vente annulée (plus dans une liste COMPLÈTE) ⇒ VRM DÉMASQUE ce qu’il a masqué, relu, au journal', { n: m.length });
    const g = monter({ src, main: { vinted_masquer_ailleurs: liste([], { complet: false }) }, items: [item(A2, 80, { is_hidden: true })], registre: reg });
    await tickM(g);
    const h = monter({ src, main: { vinted_masquer_ailleurs: liste([]) }, items: [item(A2, 80, { is_hidden: true })], registre: {} });
    await tickM(h);
    dit(!masqueurs(g).length && !masqueurs(h).length, 'M7 liste INCOMPLÈTE ⇒ rien démasqué ; une annonce masquée par LUI (pas au registre) ⇒ jamais démasquée');
  });
  await essaie('M8', async () => {
    const f = monter({ src, ...baseM(), rep: { masquer: 'muet' } });
    await tickM(f);
    const reg = ((f.lignes.vinted_masquees_vrm || {}).items || {})[A1] || {};
    const j0 = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'masquee').length;
    dit(reg.etat === 'envoye' && j0 === 0, 'M8 Vinted accepte sans état lisible ⇒ « envoyé », jamais « masquée » ni journal avant la relecture', reg);
    f.lignes[`harvest_${UID}_listings`] = { capturedAt: iso(Date.now() + 1000), payload: { items: [item(A1, 59, { is_hidden: true }), item(A2, 80)] } };
    delete f.store.vrmMasquerProchain;
    await tickM(f);
    const reg2 = ((f.lignes.vinted_masquees_vrm || {}).items || {})[A1] || {};
    const j1 = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'masquee').length;
    dit(reg2.etat === 'masquee' && j1 === 1, 'M9 … le dressing lu ensuite la montre masquée ⇒ « masquée », au journal', reg2);
  });
  return res;
}

const MUT = {
  'éteinte par défaut': ["if (!c || typeof c !== 'object' || c.actif !== true) return null;", "if (!c || typeof c !== 'object' || c.actif === false) return null;"],
  'plancher franchi': ['  if (v < plancher.c) v = plancher.c;\n', ''],
  'sans plancher ⇒ baisse': ["  if (!plancher || !Number.isInteger(plancher.c)) return { non: 'sans-plancher' };", "  if (!plancher || !Number.isInteger(plancher.c)) plancher = { c: 100 };"],
  'achat sans marge': ['return { c: Math.ceil(achat * REGLE_MARGE_ACHAT / 100), de: \'achat\' };', "return { c: achat, de: 'achat' };"],
  'prudence ignorée': ["  if (await prudenceDe(uid)) return { saute: 'prudence' };\n  { const arret", '  { const arret'],
  'anti-robot ignoré': ["if (await secuRobotDit('vinted', String(uid))) return null;", '', 'bg'],
  'captcha ignoré': ["  { const arret = await porteDiscretion(uid, 'baisse_prix', {}); if (arret && (arret.code === 'tout-arrete' || arret.code === 'verification')) return { saute: arret.code }; }\n", '', 'bg'],
  'masquer sans preuve': ['    if (!e || typeof e !== \'object\' || !/^\\d{4,15}$/.test(String(e.id)) || String(e.uid) !== u) continue;', "    if (!e || typeof e !== 'object' || !/^\\d{4,15}$/.test(String(e.id))) continue;"],
  'démasquer sur liste incomplète': ['  if (liste.complet === true) {', '  if (true) {'],
  'démasquer ce qu’il a masqué lui-même': ["    for (const id of Object.keys(reg)) {\n      const r = reg[id];\n      if (!r || String(r.uid) !== u || r.etat !== 'masquee' || dans.has(id)) continue;", '    for (const id of [...parId.keys()]) {\n      const r = reg[id];\n      if (dans.has(id)) continue;'],
  'geste pas appris': ["if (!masquerAppris(wr)) { await noterAppris(false);", "if (false) { await noterAppris(false);", 'bg'],
  'supprimer au lieu de masquer': ["`/api/v2/items/${id}/is_hidden`, { is_hidden: voulu }", "`/api/v2/items/${id}/delete`, null", 'bg'],
  'masquée sans relecture': ["  await noterMasquee(id, Object.assign(base, { etat: 'envoye' }));\n  return { lu: true, envoye: id, voulu };", "  await noterMasquee(id, Object.assign(base, { etat: 'masquee' }));\n  await noterJournal(uid, 'masquee', { a: id });\n  return { lu: true, envoye: id, voulu };", 'bg'],
  'plafond ignoré': ["const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu, sorte: 'masquer'", "const stop = null && await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu, sorte: 'masquer'", 'bg'],
};

(async () => {
  const ecrire = (txt) => { const f = path.join(os.tmpdir(), `bg-regles-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, txt); return f; };
  const base = await controles({ bg: BG });
  let ko = 0;
  for (const c of base) { if (!c.ok) ko++; console.log((c.ok ? '✅ ' : '❌ ') + c.m + (c.ok || !c.d ? '' : '  → ' + c.d)); }
  if (process.argv.includes('--prouve')) {
    console.log('\n── preuve : mutations (chacune doit faire rougir au moins un contrôle) ──');
    const bgSrc = fs.readFileSync(BG, 'utf8'), appSrc = fs.readFileSync(F_APP, 'utf8');
    let tenues = 0;
    for (const [nom, [de, vers, ou]] of Object.entries(MUT)) {
      if (!bgSrc.includes(de)) { console.log(`❌ mutation ${nom} : le texte visé est introuvable`); ko++; continue; }
      const f = ecrire(bgSrc.split(de).join(vers));
      // Une mutation du bloc partagé est jouée des DEUX côtés (sinon seul P1 rougirait).
      const dansBloc = ou !== 'bg' && appSrc.includes(de);
      const rouges = (await controles({ bg: f, appTexte: dansBloc ? appSrc.split(de).join(vers) : appSrc })).filter((x) => !x.ok);
      try { fs.unlinkSync(f); } catch (_) {}
      if (rouges.length) tenues++; else ko++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    console.log(`${tenues}/${Object.keys(MUT).length} mutations tenues`);
    const git = (ref) => { try { return cp.execFileSync('git', ['show', ref], { cwd: RACINE, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (_) { return null; } };
    const refAvant = process.env.VRM_REF_PUBLIEE || 'origin/main';
    const av = git(`${refAvant}:vinted-sync-extension/background.js`);
    if (av == null) console.log(`— ${refAvant} illisible ici : preuve sur le code d’avant non jouée (dit, pas conclu)`);
    else if (/function regleBaisseTick/.test(av)) console.log(`— ${refAvant} porte déjà \`regleBaisseTick\` : preuve d’avant sans objet`);
    else {
      const f = ecrire(av);
      const r = await controles({ bg: f }); try { fs.unlinkSync(f); } catch (_) {}
      const rouges = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const attendus = ['P1', 'R2', 'M1', 'M6'];
      const manque = attendus.filter((k) => !rouges.includes(k));
      console.log(`${manque.length ? '❌' : '✅'} §6.1 sur le code de ${refAvant} : ${rouges.length} rouge(s) — ${rouges.join(' ')}${manque.length ? ' ; attendus aussi : ' + manque.join(' ') : ''}`);
      if (manque.length) ko++;
    }
  }
  console.log(ko ? `\n❌ audit-regles-auto : ${ko} rouge(s)` : `\n✅ audit-regles-auto : ${base.length} contrôles — baisse par règle éteinte par défaut, jamais sous le plancher, dans les plafonds ; masquée seulement sur vente prouvée, jamais supprimée, démasquée si annulée`);
  process.exit(ko ? 1 : 0);
})();
