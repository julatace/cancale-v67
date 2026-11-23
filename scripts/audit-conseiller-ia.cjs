// ════════════════════════════════════════════════════════════════════════════
//  « DEMANDE À VRM » — §2.9 EXÉCUTÉ (23 nov.). docs/passation/2026-11-23-conseiller.md
//  Ce script EXÉCUTE (esbuild → CommonJS) api/_lib/conseiller-ia.js et api/_lib/claude-cle.js avec un réseau d'essai :
//    E  aucune requête IA sans la clé DU VENDEUR (clé du serveur posée, propriétaire connecté, clé dans le corps :
//       rien ne part) ; avec sa clé, UNE requête, sa clé, Haiku 5.5, le contexte NETTOYÉ (aucun acheteur, textes bornés) ;
//       le geste hors liste fermée devient « aucun » ; le coût est rendu ;
//    F  la clé : vérifiée chez Anthropic, refusée ⇒ rien rangé, sans coffre ⇒ rien rangé, rangée CHIFFRÉE, jamais rendue ;
//    G  l'écran : aucune requête vers /api/ai tant que sa clé n'est pas posée ; le mode passe avant la clé du serveur.
//  Mutation : `--mutation=<nom>` ou `--mutation=toutes` ⇒ chaque règle réaffaiblie doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const IA = 'api/_lib/conseiller-ia.js', CC = 'api/_lib/claude-cle.js', DV = 'src/conseiller/DemandeVRM.jsx';
const MUTATIONS = {
  cle_serveur:  [IA, "  const key = await lireCle(u.id);", "  const key = (await lireCle(u.id)) || process.env.AI_API_KEY || '';"],
  cle_corps:    [IA, "  const key = await lireCle(u.id);", "  const key = (b.key && String(b.key)) || (await lireCle(u.id));"],
  sans_filtre:  [IA, "if (CLE_INTERDITE.test(k)) continue; ", ""],
  geste_libre:  [IA, "geste: GESTES_IA.includes(p.geste) ? p.geste : 'aucun',", "geste: String(p.geste || 'aucun'),"],
  pas_su_zero:  [IA, "if (key === undefined) { res.status(503).json({ ok: false, reason: 'cle-pas-su' }); return; }", ""],
  refusee_rangee: [CC, "  if (verif === 'refusee') return repondre(res, 400,", "  if (false) return repondre(res, 400,"],
  en_clair:     [CC, "data: { v: 1, chiffre, fin: finDe(cle)", "data: { v: 1, chiffre, cle, fin: finDe(cle)"],
  ecran_sans_garde: [DV, "if (!posee) { setQuestion(q); setMontrerCle(true); return; }", ""],
};
const arg = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let ok = 0, ko = 0, SILENCE = false;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!SILENCE) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const texte = (f, m) => { const t = lire(f); if (!m || m[0] !== f) return t; if (!t.includes(m[1])) throw new Error(`motif absent dans ${f}`); return t.replace(m[1], m[2]); };

async function charger(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cia-'));
  fs.writeFileSync(path.join(dir, 'entree.js'), `export * as IA from ${JSON.stringify(path.join(R, IA))};\nexport * as CC from ${JSON.stringify(path.join(R, CC))};\nexport * as CO from ${JSON.stringify(path.join(R, 'api/_lib/coffre.js'))};\n`);
  const cible = mutation ? path.join(R, mutation[0]) : null;
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.js')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', nodePaths: [NM], logLevel: 'silent',
    plugins: [{ name: 'mutant', setup(b) { b.onLoad({ filter: /\.js$/ }, (a) => (!cible || path.resolve(a.path) !== cible ? undefined : { contents: texte(mutation[0], mutation), loader: 'js' })); } }] });
  return require(path.join(dir, 'sortie.cjs'));
}
const repo = () => { const r = { code: 0, corps: null, entetes: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (j) => { r.corps = j; return r; }; r.setHeader = (k, v) => { r.entetes[k] = v; }; return r; };
const UID = '11111111-1111-1111-1111-111111111111';

async function verifier(mutation) {
  const { IA: M, CC: K, CO } = await charger(mutation);
  process.env.AI_API_KEY = 'sk-ant-SERVEUR-de-julien-000000000000';
  process.env.VRM_OWNER_UID = UID;
  const appels = [];
  const appeler = async (url, o) => { appels.push({ url, o, corps: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 2400, output_tokens: 300 }, content: [{ type: 'text', text: JSON.stringify({ reponse: 'Baisse les 5 paires conseillées.', chiffres: [{ libelle: 'Baisses', valeur: '5' }], geste: 'supprimer_tout' }) }] }) }; };
  const base = { session: async () => ({ id: UID }), acces: async () => true, appeler };
  const poser = (body) => ({ method: 'POST', headers: {}, query: { mode: 'conseiller' }, body });
  // E1 — le propriétaire, la clé du serveur posée, AUCUNE clé du vendeur ⇒ rien ne part.
  let r = repo(); await M.handleConseiller(poser({ question: 'Qu’est-ce que je baisse ?', contexte: {} }), r, { ...base, lireCle: async () => '' });
  dit(r.corps && r.corps.reason === 'no-key' && appels.length === 0, 'E1 sans SA clé : « no-key », aucune requête vers Anthropic (même le propriétaire, clé du serveur posée)', JSON.stringify(r.corps) + ' appels=' + appels.length);
  r = repo(); await M.handleConseiller(poser({ question: 'x', key: 'sk-ant-VOLEE-000000000000000000', contexte: {} }), r, { ...base, lireCle: async () => '' });
  dit(r.corps && r.corps.reason === 'no-key' && appels.length === 0, 'E2 une clé envoyée par le navigateur est IGNORÉE (seule la clé du coffre compte)');
  r = repo(); await M.handleConseiller(poser({ question: 'x', contexte: {} }), r, { ...base, lireCle: async () => undefined });
  dit(r.code === 503 && appels.length === 0, 'E3 coffre illisible (« pas su ») ⇒ 503, aucune requête (jamais un repli)');
  r = repo(); await M.handleConseiller(poser({ question: 'x', contexte: {} }), r, { ...base, session: async () => null, lireCle: async () => 'sk-ant-VENDEUR-111111111111111111' });
  dit(r.code === 401 && appels.length === 0, 'E4 sans session ⇒ 401, aucune requête');
  // E5 — avec SA clé.
  const ctx = { conseils: [{ id: 'baisses', chiffres: { n: 5 } }], acheteur: 'jean_dupont', emailClient: 'a@b.fr', modeles90j: { modeles: [{ nom: 'Adidas Samba'.padEnd(200, 'x'), n: 4, beneficeMoyen: 31.456 }] }, profond: { a: { b: { c: { d: { e: 1 } } } } } };
  r = repo(); await M.handleConseiller(poser({ question: 'Qu’est-ce que je baisse ?', contexte: ctx }), r, { ...base, lireCle: async () => 'sk-ant-VENDEUR-111111111111111111' });
  const a = appels[0] || { o: { headers: {} }, corps: {} };
  dit(appels.length === 1 && a.o.headers['x-api-key'] === 'sk-ant-VENDEUR-111111111111111111' && a.corps.model === 'claude-haiku-5-5', 'E5 avec SA clé : une requête, SA clé, Claude Haiku 5.5', JSON.stringify({ n: appels.length, k: a.o.headers['x-api-key'], m: a.corps.model }));
  const envoye = JSON.stringify(a.corps.messages || []);
  dit(!/jean_dupont|a@b\.fr|acheteur|emailClient/.test(envoye) && !/x{100}/.test(envoye) && /31\.46/.test(envoye) && !/"e":1/.test(envoye), 'E5 le contexte est NETTOYÉ : aucun acheteur ni e-mail, textes bornés à 80, nombres arrondis, profondeur bornée');
  dit(r.corps && r.corps.ok && r.corps.geste === 'aucun' && r.corps.chiffres.length === 1, 'E6 un geste hors liste fermée (« supprimer_tout ») devient « aucun » ; les chiffres cités sont rendus', JSON.stringify(r.corps));
  dit(r.corps && Math.abs(r.corps.cout - (2400 * 0.10 + 300 * 0.50) / 1e6) < 1e-9, 'E7 le coût réel est rendu (jetons × prix publics de Haiku 5.5)', String(r.corps && r.corps.cout));
  dit(!/AI_API_KEY|ANTHROPIC_API_KEY|b\.key/.test(lire(IA).replace(/\/\/.*$/gm, '')), 'E8 le mode conseiller ne lit jamais la clé du serveur ni une clé du corps');

  // F — la clé dans le coffre (réseau d'essai : Supabase + Anthropic).
  process.env.SUPABASE_SERVICE_KEY = 'service-essai'; process.env.VRM_COFFRE_CLE = 'coffre-essai-0123456789';
  const base_ = new Map(); let antStatut = 200;
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/v1/models')) return { ok: antStatut === 200, status: antStatut, json: async () => ({ data: [{ id: 'claude-haiku-5-5' }] }) };
    if (u.includes('/rest/v1/app_data')) {
      if ((o.method || 'GET') === 'POST') { const rows = JSON.parse(o.body); for (const x of rows) base_.set(x.owner + ':' + x.id, x.data); return { ok: true, status: 201, json: async () => null }; }
      if (o.method === 'DELETE') { for (const k of [...base_.keys()]) if (k.startsWith(UID)) base_.delete(k); return { ok: true, status: 204, json: async () => null }; }
      const d = base_.get(UID + ':claude_cle');
      return { ok: true, status: 200, json: async () => (d ? [{ chiffre: d.chiffre, fin: d.fin, at: d.at, verif: d.verif }] : []) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  const vendeur = { id: UID };
  antStatut = 401; r = repo(); await K.routeClaude({ method: 'POST' }, r, { vendeur, corps: { action: 'poser', cle: 'sk-ant-REFUSEE-22222222222222222' }, acces: true, cloisonnee: true });
  dit(r.code === 400 && !base_.size, 'F1 Anthropic refuse la clé ⇒ rien n’est rangé', JSON.stringify(r.corps));
  antStatut = 200; r = repo(); await K.routeClaude({ method: 'POST' }, r, { vendeur, corps: { action: 'poser', cle: 'sk-ant-BONNE-3333333333333333333' }, acces: true, cloisonnee: true });
  const rangee = base_.get(UID + ':claude_cle');
  dit(r.code === 200 && rangee && !JSON.stringify(rangee).includes('BONNE') && rangee.fin === '3333', 'F2 la clé acceptée est rangée CHIFFRÉE (jamais en clair), avec ses 4 derniers caractères', JSON.stringify(rangee));
  dit(!JSON.stringify(r.corps).includes('BONNE'), 'F3 la réponse au navigateur ne contient jamais la clé');
  r = repo(); await K.routeClaude({ method: 'GET' }, r, { vendeur, corps: null, acces: true, cloisonnee: true });
  dit(r.corps && r.corps.etat === 'posee' && !JSON.stringify(r.corps).includes('BONNE'), 'F3 l’état relu dit « posée » et …3333, jamais la clé');
  dit((await K.lireCleClaude(UID)) === 'sk-ant-BONNE-3333333333333333333', 'F4 le serveur seul la relit (déchiffrée) pour la question');
  const sauve = process.env.VRM_COFFRE_CLE, sk = process.env.SUPABASE_SERVICE_KEY; process.env.VRM_COFFRE_CLE = ''; process.env.SUPABASE_SERVICE_KEY = '';
  base_.clear(); r = repo(); await K.poser(UID, { cle: 'sk-ant-SANSCOFFRE-4444444444444444' }, r);
  dit(r.code === 503 && !base_.size, 'F5 sans coffre ⇒ rien n’est rangé (jamais en clair)');
  process.env.VRM_COFFRE_CLE = sauve; process.env.SUPABASE_SERVICE_KEY = sk;
  r = repo(); await K.routeClaude({ method: 'GET' }, r, { vendeur, corps: null, acces: true, cloisonnee: false });
  dit(r.code === 503, 'F6 base pas cloisonnée ⇒ aucune clé rangée ni lue');

  // G — l'écran et la route.
  const dv = lire(DV).replace(/\/\/.*$/gm, '');
  const iAi = dv.indexOf("'/api/ai?mode=conseiller'"), iGarde = dv.indexOf('if (!posee) { setQuestion(q); setMontrerCle(true); return; }');
  dit(iAi > 0 && iGarde > 0 && iGarde < iAi && (dv.match(/\/api\/ai/g) || []).length === 1, 'G1 l’écran : une seule requête vers /api/ai, gardée par « sa clé est posée »');
  dit(!/localStorage|sessionStorage/.test(dv) && !/setItem\(/.test(dv), 'G2 la clé n’est jamais gardée dans le navigateur');
  const ai = lire('api/ai.js');
  dit(ai.indexOf("req.query.mode === 'conseiller'") > 0 && ai.indexOf("req.query.mode === 'conseiller'") < ai.indexOf('const cleServeur'), 'G3 le mode conseiller passe AVANT la clé du serveur dans api/ai.js');
}

(async () => {
  if (arg) {
    const noms = arg === 'toutes' ? Object.keys(MUTATIONS) : arg.split(','); let vues = 0;
    for (const n of noms) {
      ok = 0; ko = 0; SILENCE = true;
      const m = MUTATIONS[n];
      if (m[0] === DV) { const t = lire(DV); fs.writeFileSync(path.join(R, DV), texte(DV, m)); try { await verifier(null); } catch (_) { ko++; } finally { fs.writeFileSync(path.join(R, DV), t); } }
      else { try { await verifier(m); } catch (_) { ko++; } }
      SILENCE = false; console.log(`${ko ? '✅' : '❌'} mutation ${n} : ${ko ? 'vue (' + ko + ' rouge)' : 'PAS VUE'}`); if (ko) vues++;
    }
    console.log(`\n${vues}/${noms.length} mutations vues`); process.exit(vues === noms.length ? 0 : 1);
  }
  await verifier(null);
  console.log(`\n${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌', e && e.stack || e); process.exit(1); });
