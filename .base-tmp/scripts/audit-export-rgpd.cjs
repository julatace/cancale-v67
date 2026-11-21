// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « TOUTES MES DONNÉES » (RGPD art. 15 et 20), 12 nov.
//        node scripts/audit-export-rgpd.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Le VRAI api/compte.js (`mode=mes-donnees`) est EXÉCUTÉ contre une fausse base
// à la forme PostgREST (filtres eq/gt/like, and/or, data->>, projection, ordre,
// limite) qui sert DEUX vendeuses ; l'assembleur de l'app (src/exportRgpd.js)
// tire les pages comme le ferait l'écran :
//   R1 chaque ligne de A part, identique (une ligne de 6 Mo traverse en
//      plusieurs morceaux et se recolle à l'octet) ;
//   R2 RIEN de B ne sort — la fausse base rend B dès qu'un filtre manque ;
//   R3 aucun secret (jetons Vinted/eBay, clés de téléphone, widget, Photoroom) ;
//   R4 les lignes lourdes (PDF, pièces jointes, transactions brutes) : leur
//      RÉSUMÉ seulement ; aucun PDF dans le fichier ;
//   R5 chaque réponse reste sous la limite de Vercel (4,5 Mo) ;
//   R6 une lecture ratée au milieu ⇒ 503, l'export dit « incomplet » ;
//   R7 sans session : 401 ; un `owner` glissé dans l'adresse ne change rien ;
//   R8 compte.json : ses comptes, son abonnement, son parrainage EN NOMBRES (pas
//      l'identifiant des autres), ses signalements sans `de`, ses adresses prouvées ;
//   R9 le zip se relit (CRC) ; l'écran branche l'export sans le fermer quand
//      l'abonnement a pris fin ; la politique de confidentialité le dit.
// Données inventées (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
if (process.argv.includes('--prouve')) {
  const { prouver } = require('./_mutations-audit.cjs');
  prouver(__filename, path.join(__dirname, '..'), {
    'filtre owner oublié (résumés)': [['api/_lib/export-rgpd.js', "app_data?owner=eq.${o}&${ou}", "app_data?${ou}"]],
    'secrets laissés': [['api/_lib/export-rgpd.js', "export const SECRETS = ['ebay_tokens*', 'push_subs',", "export const SECRETS = ['zz_rien',"]],
    'champs de jeton laissés': [['api/_lib/export-rgpd.js', 'for (const k of Object.keys(v)) if (!CLE_SECRETE.test(k)) o[k] = sansSecrets(v[k], prof + 1);', 'for (const k of Object.keys(v)) o[k] = sansSecrets(v[k], prof + 1);']],
    'lourds en entier': [['api/_lib/export-rgpd.js', "&and=(${pas(SECRETS)},${pas(LOURDS)})", "&and=(${pas(SECRETS)})"]],
    'morceau trop grand': [['api/_lib/export-rgpd.js', 'export const MORCEAU = 1500000;', 'export const MORCEAU = 9000000;']],
    'lecture ratée = vide': [['api/_lib/export-rgpd.js', "    if (!r.ok) return null;\n    const j = await r.json();\n    return Array.isArray(j) ? j : null;", "    if (!r.ok) return [];\n    const j = await r.json();\n    return Array.isArray(j) ? j : [];"]],
    'identité des filleuls': [['api/_lib/export-rgpd.js', "lire(url, service, `parrainages?parrain=eq.${o}&select=paye_le,credit_parrain_le`, fetcher)", "lire(url, service, `parrainages?parrain=eq.${o}&select=filleul,paye_le,credit_parrain_le`, fetcher)"], ['api/_lib/export-rgpd.js', "tes_filleuls: { inscrits: parrain.length,", "tes_filleuls: { liste: parrain, inscrits: parrain.length,"]],
    'assembleur qui ignore une page ratée': [['src/exportRgpd.js', "if (!j || j.ok !== true || !Array.isArray(j.morceaux)) return { ok: false, raison: 'page', pages };", "if (!j || j.ok !== true || !Array.isArray(j.morceaux)) return { ok: true, pages, fichiers: [...fichiers].map(([nom, texte]) => ({ nom, texte })) };"]],
  }, ['public']);
  return;
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
const { appeler } = require('./_monde-paiement.cjs');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROPRIO = '99999999-9999-4999-8999-999999999999', NEUTRE = '00000000-0000-0000-0000-000000000000';
const SERVICE = 'sb_secret_export';
const JETONS = { 'aa.bb.A': { id: A, email: 'a@exemple.test', created_at: '2026-10-01T10:00:00Z' }, 'aa.bb.B': { id: B, email: 'b@exemple.test', created_at: '2026-10-02T10:00:00Z' } };
// Un texte de 6 Mo : une capture énorme (forme d'une liste de ventes).
const ENORME = { capturedAt: '2026-11-01T10:00:00Z', payload: Array.from({ length: 13000 }, (_, i) => ({ id: 900000 + i, title: `Article A n°${i} « guillemets » \\ ${'x'.repeat(320)}`, price: { amount: String(10 + (i % 90)) } })) };
const lignesDe = (o, m) => [
  { owner: o, id: 'main', data: { reglages: { theme: 'clair' }, marqueur: m + '-main' } },
  { owner: o, id: 'vinted_sales', data: { payload: [{ id: 1, title: m + ' vente 1', price: { amount: '42.0' } }], capturedAt: '2026-11-01T10:00:00Z' } },
  { owner: o, id: 'email_vente_17', data: { sujet: m + ' — vendu', corps: 'Bonjour', compte: { access_token: m + '-JETON-SECRET', login: m + '-login' } } },
  { owner: o, id: 'email_invoice_tx1', data: { numero: 'F2026-0001', marqueur: m + '-facture' } },
  { owner: o, id: 'harvest_111_txn_555', meta: { statut: 'Commande finalisée', marqueur: m + '-resume' }, data: { brut: m + '-BRUT-TRANSACTION'.repeat(10) } },
  { owner: o, id: 'harvest_111_label_555', meta: { pages: 1 }, data: { pdf: 'JVBERi0xLjQK' + m + 'PDF'.repeat(50) } },
  { owner: o, id: 'email_qpj_3', meta: { taille: 40000 }, data: { b64: 'JVBERi0xLjQK' + m + 'PJ' } },
  { owner: o, id: 'ebay_tokens', data: { refresh: m + '-EBAY-SECRET' } },
  { owner: o, id: 'push_subs', data: [{ endpoint: 'https://push.exemple/' + m, keys: { p256dh: m + '-CLE', auth: m + '-AUTH' } }] },
  { owner: o, id: 'vrm_widget_token', data: { jeton: m + '-WIDGET' } },
];
const reset = () => {
  const B_ = {
    app_data: [...lignesDe(A, 'AAA'), { owner: A, id: 'harvest_111_sales', data: ENORME }, ...lignesDe(B, 'BBB'),
      ...Array.from({ length: 60 }, (_, i) => ({ owner: A, id: `stock_${String(i).padStart(3, '0')}`, data: { n: i, marqueur: 'AAA-stock' } })),
      { owner: NEUTRE, id: 'vrm_email_preuve_1', data: { owner: A, adresse: 'a-recoit@exemple.test', jeton: 'AAA-PREUVE-SECRET' } },
      { owner: NEUTRE, id: 'vrm_email_preuve_2', data: { owner: B, adresse: 'b-recoit@exemple.test' } },
      { owner: NEUTRE, id: 'jeton_widget_x', data: { owner: A, jeton: 'AAA-INDEX-SECRET' } },
      { owner: PROPRIO, id: 'signalement_1', data: { de: A, texte: 'AAA ne marche pas', ecran: 'ventes' } },
      { owner: PROPRIO, id: 'signalement_2', data: { de: B, texte: 'BBB ne marche pas', ecran: 'colis' } }],
    vinted_accounts: [{ owner: A, vinted_user_id: '111', login: 'aaa_login', domain: 'www.vinted.fr', access_token: 'AAA-VINTED-SECRET' }, { owner: B, vinted_user_id: '222', login: 'bbb_login', domain: 'www.vinted.fr', access_token: 'BBB-VINTED-SECRET' }],
    abonnements: [{ owner: A, statut: 'canceled', plan: 'solo', fin_periode: '2026-11-01T00:00:00Z', annule_fin_periode: true, mode_test: false, client_stripe: 'cus_A' }, { owner: B, statut: 'active', plan: 'pro', client_stripe: 'cus_B' }],
    parrainage_codes: [{ owner: A, code: 'AAAACODE' }, { owner: B, code: 'BBBBCODE' }],
    parrainages: [{ filleul: B, parrain: A, inscrit: '2026-10-05T00:00:00Z', paye_le: '2026-10-12T00:00:00Z', credit_parrain_le: '2026-10-12T00:00:00Z', credit_filleul_le: '2026-10-12T00:00:00Z' }],
  };
  return B_;
};
let base = reset(), panne = 0, reponses = [], requetes = [];
// ── Une mini PostgREST : seulement les filtres PRÉSENTS dans l'adresse comptent ──
const like = (motif) => new RegExp('^' + motif.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const valeur = (l, champ) => { const m = /^data->>(.+)$/.exec(champ); return m ? (l.data && l.data[m[1]] != null ? String(l.data[m[1]]) : null) : (l[champ] == null ? null : String(l[champ])); };
const cond = (l, champ, op, v) => {
  const x = valeur(l, champ);
  if (op === 'eq') return x === v; if (op === 'gt') return x != null && x > v; if (op === 'gte') return x != null && x >= v;
  if (op === 'like') return x != null && like(v).test(x); if (op === 'not.like') return !(x != null && like(v).test(x));
  if (op === 'is' && v === 'null') return x == null; if (op === 'not.is' && v === 'null') return x != null;
  throw new Error('opérateur inconnu ' + op);
};
const groupe = (s) => s.split(',').map((t) => { const m = /^([a-z_>-]+)\.(not\.like|like|eq|gt)\.(.*)$/.exec(t); if (!m) throw new Error('groupe ' + t); return [m[1], m[2], m[3]]; });
function servir(u, h) {
  const url = new URL(u), table = url.pathname.split('/').pop();
  if (!String(h.apikey || '') === SERVICE) return { status: 401, body: [] };
  let l = (base[table] || []).slice();
  let select = null, order = null, limit = null;
  for (const [k, v] of url.searchParams) {
    if (k === 'select') { select = v; continue; } if (k === 'order') { order = v; continue; } if (k === 'limit') { limit = Number(v); continue; }
    if (k === 'and') { const g = groupe(v.slice(1, -1)); l = l.filter((x) => g.every(([c, o, w]) => cond(x, c, o, w))); continue; }
    if (k === 'or') { const g = groupe(v.slice(1, -1)); l = l.filter((x) => g.some(([c, o, w]) => cond(x, c, o, w))); continue; }
    const m = /^(not\.is|is|eq|gt|gte|like|not\.like)\.(.*)$/.exec(v);
    if (!m) throw new Error('filtre ' + k + '=' + v);
    l = l.filter((x) => cond(x, k, m[1], m[2]));
  }
  if (order === 'id.asc') l.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (limit != null) l = l.slice(0, limit);
  if (select) {
    const champs = select.split(',').map((s) => { const m = /^([a-z_]+):(.+)$/.exec(s); return m ? [m[1], m[2]] : [s, s]; });
    l = l.map((x) => Object.fromEntries(champs.map(([n, c]) => [n, /^data->>/.test(c) ? valeur(x, c) : x[c] === undefined ? null : x[c]])));
  }
  return { status: 200, body: l };
}
global.fetch = async (u, o = {}) => {
  u = String(u); const h = o.headers || {};
  if (u.includes('/auth/v1/user')) { const j = JETONS[String(h.Authorization || '').replace('Bearer ', '')]; return new Response(JSON.stringify(j || { msg: 'x' }), { status: j ? 200 : 401 }); }
  if (u.includes('/rest/v1/vrm_reglages')) return new Response(JSON.stringify([{ valeur: PROPRIO }]), { status: 200 });
  if (u.includes('/rest/v1/')) {
    requetes.push(u);
    if (panne && --panne === 0) return new Response('<html>522</html>', { status: 522 });
    const x = servir(u, h);
    return new Response(JSON.stringify(x.body), { status: x.status, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 404 });
};

(async () => {
  process.env.SUPABASE_SERVICE_KEY = SERVICE; delete process.env.VRM_OWNER_UID;
  let compte, assembleur, zip;
  try {
    compte = (await import('file://' + path.join(R, 'api', 'compte.js'))).default;
    assembleur = await import('file://' + path.join(R, 'src', 'exportRgpd.js'));
    zip = await import('file://' + path.join(R, 'src', 'exportDonnees.js'));
  } catch (e) { dit(false, 'les modules se chargent', e.message); return fin(); }
  // L'app tire les pages ; chaque appel passe par le VRAI handler.
  const tirer = (jeton, extraQuery = {}) => assembleur.toutesMesDonnees({
    entetes: () => ({ authorization: 'Bearer ' + jeton }),
    fetcher: async (u, o) => {
      const q = Object.fromEntries(new URL(u, 'http://x').searchParams);
      const r = await appeler(compte, { method: 'GET', query: { ...q, ...extraQuery }, headers: o.headers });
      const corps = JSON.stringify(r.corps);
      reponses.push(Buffer.byteLength(corps));
      return new Response(corps, { status: r.code || 200 });
    },
  });

  let res;
  await essaie('R1', async () => {
    res = await tirer('aa.bb.A');
    dit(res.ok === true && res.pages > 3, `l’export se termine (${res.pages} pages)`, JSON.stringify({ ok: res.ok, raison: res.raison }));
    const parNom = new Map(res.fichiers.map((f) => [f.nom.split('/').slice(1).join('/'), f.texte]));
    const attendues = lignesDe(A, 'AAA').filter((l) => ['main', 'vinted_sales', 'email_vente_17', 'email_invoice_tx1'].includes(l.id)).concat(Array.from({ length: 60 }, (_, i) => ({ id: `stock_${String(i).padStart(3, '0')}` })));
    const manquent = attendues.filter((l) => !parNom.has(`donnees/${l.id}.json`)).map((l) => l.id);
    dit(!manquent.length, `chaque ligne de A est là (${attendues.length + 1} attendues, dont 60 au-delà d’une page)`, manquent.join(','));
    const e = parNom.get('donnees/harvest_111_sales.json');
    let relu = null; try { relu = JSON.parse(e); } catch (_) {}
    dit(relu && JSON.stringify(relu.donnees) === JSON.stringify(ENORME) && e.length > 3e6, `la ligne de ${(e ? e.length / 1e6 : 0).toFixed(1)} Mo traverse en morceaux et se recolle à l’octet`);
    const v = JSON.parse(parNom.get('donnees/email_vente_17.json'));
    dit(v.donnees.sujet === 'AAA — vendu' && v.donnees.compte.login === 'AAA-login'.replace('AAA-login', 'AAA-login') && !('access_token' in v.donnees.compte), 'R3 · le contenu reste, le champ de jeton part (access_token retiré au fond de la ligne)', JSON.stringify(v.donnees.compte));
    const dossiers = new Set(res.fichiers.map((f) => f.nom.split('/')[0]));
    dit(dossiers.size === 1 && /^VRM-mes-donnees-\d{4}-\d{2}-\d{2}$/.test([...dossiers][0]), 'tout dans UN dossier « VRM-mes-donnees-AAAA-MM-JJ »', [...dossiers].join(','));
  });
  await essaie('R2-R4', async () => {
    const tout = res.fichiers.map((f) => f.nom + '\n' + f.texte).join('\n');
    const fuites = ['BBB', 'bbb_login', 'b-recoit', B, 'BBBBCODE', 'cus_B'].filter((m) => tout.includes(m));
    dit(!fuites.length, 'R2 · RIEN de la vendeuse B (lignes, compte, preuve, signalement, code, client Stripe)', fuites.join(','));
    const secrets = ['JETON-SECRET', 'EBAY-SECRET', 'AAA-CLE', 'AAA-AUTH', 'AAA-WIDGET', 'VINTED-SECRET', 'PREUVE-SECRET', 'INDEX-SECRET'].filter((m) => tout.includes(m));
    dit(!secrets.length, 'R3 · aucun jeton ni clé (Vinted, eBay, téléphones, widget, preuve, index)', secrets.join(','));
    dit(!/JVBERi0/.test(tout) && !tout.includes('BRUT-TRANSACTION'), 'R4 · aucun PDF, aucune pièce jointe, aucune transaction brute');
    const resumes = res.fichiers.filter((f) => /\/resumes\//.test(f.nom)).flatMap((f) => JSON.parse(f.texte));
    const ids = resumes.map((x) => x.id).sort().join(',');
    dit(ids === 'email_qpj_3,harvest_111_label_555,harvest_111_txn_555' && resumes.find((x) => x.id === 'harvest_111_txn_555').resume.marqueur === 'AAA-resume', 'R4 · leur RÉSUMÉ part (id, date, meta)', ids);
    const tailleMax = Math.max(...reponses);
    dit(tailleMax < 4.5e6, `R5 · chaque réponse < 4,5 Mo (la plus grosse : ${(tailleMax / 1e6).toFixed(2)} Mo)`);
    const sansOwner = requetes.filter((u) => /\/rest\/v1\/(app_data|vinted_accounts|abonnements|parrainage_codes)\?/.test(u) && !/owner=eq\./.test(u));
    dit(!sansOwner.length, '  chaque lecture porte owner=eq.', sansOwner[0]);
  });
  await essaie('R8', async () => {
    const c = JSON.parse(res.fichiers.find((f) => /\/compte\.json$/.test(f.nom)).texte);
    dit(c.connexion.email === 'a@exemple.test' && c.comptes_de_revente.length === 1 && c.comptes_de_revente[0].login === 'aaa_login' && c.abonnement && c.abonnement.statut === 'canceled', 'R8 · compte.json : e-mail, comptes de revente, abonnement', JSON.stringify(c.comptes_de_revente));
    dit(c.parrainage.ton_code === 'AAAACODE' && c.parrainage.tes_filleuls.inscrits === 1 && c.parrainage.tes_filleuls.ont_paye === 1 && Object.keys(c.parrainage.tes_filleuls).length === 3, '  parrainage : son code et des NOMBRES (jamais l’identifiant du filleul)', JSON.stringify(c.parrainage));
    dit(c.signalements_envoyes.length === 1 && c.signalements_envoyes[0].texte === 'AAA ne marche pas' && !('de' in c.signalements_envoyes[0]), '  ses signalements, sans « de »', JSON.stringify(c.signalements_envoyes));
    dit(c.adresses_prouvees.length === 1 && c.adresses_prouvees[0].adresse === 'a-recoit@exemple.test', '  son adresse prouvée (sans le jeton de preuve)', JSON.stringify(c.adresses_prouvees));
    const lis = res.fichiers.find((f) => /LISEZMOI\.txt$/.test(f.nom));
    dit(lis && /ne figure pas/.test(lis.texte) && /PDF/.test(lis.texte) && /jetons/.test(lis.texte), '  LISEZMOI dit ce qui manque exprès, et pourquoi');
  });
  await essaie('R6', async () => {
    panne = 4; const r = await tirer('aa.bb.A'); panne = 0;
    dit(r.ok === false, 'R6 · une lecture ratée au milieu : l’export n’est PAS donné pour complet', JSON.stringify({ ok: r.ok, raison: r.raison, pages: r.pages }));
    panne = 1; const r1 = await appeler(compte, { method: 'GET', query: { mode: 'mes-donnees' }, headers: { authorization: 'Bearer aa.bb.A' } }); panne = 0;
    dit(r1.code === 503 && r1.corps.ok === false, '  la route répond 503 (jamais une page vide qui aurait l’air complète)', `HTTP ${r1.code}`);
  });
  await essaie('R7', async () => {
    const r = await appeler(compte, { method: 'GET', query: { mode: 'mes-donnees' }, headers: {} });
    dit(r.code === 401, 'R7 · sans session : 401', `HTTP ${r.code}`);
    const r2 = await tirer('aa.bb.A', { owner: B, uid: B });
    const t = r2.fichiers.map((f) => f.texte).join('');
    dit(r2.ok && !t.includes('BBB') && t.includes('AAA-main'), '  un owner glissé dans l’adresse ne change rien (le compte vient du jeton)');
    const r3 = await appeler(compte, { method: 'GET', query: { mode: 'mes-donnees', suite: 'pas-un-curseur' }, headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r3.code === 400, '  un curseur forgé : refusé', `HTTP ${r3.code}`);
    const r4 = await appeler(compte, { method: 'POST', query: { mode: 'mes-donnees' }, headers: { authorization: 'Bearer aa.bb.A' } });
    dit(r4.code === 405, '  lecture seule : POST refusé', `HTTP ${r4.code}`);
  });
  await essaie('R9', async () => {
    const z = zip.zipStocke(res.fichiers);
    const relu = zip.lireZipStocke(z);
    dit(relu.length === res.fichiers.length && relu.every((f) => f.crcOk), `R9 · le zip se relit (${relu.length} fichiers, CRC justes)`);
    const { sansCommentaires } = require('./_mutations-audit.cjs');
    const reg = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'ecrans', 'Reglages.jsx'), 'utf8'));
    const corps = (/async function exporterMesDonnees\(\) \{([\s\S]*?)\n\}/.exec(reg) || [])[1] || '';
    dit(/toutesMesDonnees\(/.test(corps) && !/lectureSeule/.test(corps) && /INCOMPLET/.test(corps), '  « Exporter mes données » tire l’export complet, reste ouvert sans abonnement, dit « incomplet »');
    const conf = fs.readFileSync(path.join(R, 'public', 'legal', 'confidentialite.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    dit(/toutes tes données/i.test(conf) && /un mois/.test(conf) && /Supprimer mon compte/.test(conf), '  la politique de confidentialité dit l’export complet, la suppression et le délai d’un mois');
  });
  fin();
  function fin() {
    console.log(ko ? `\n❌ audit-export-rgpd : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-export-rgpd : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
