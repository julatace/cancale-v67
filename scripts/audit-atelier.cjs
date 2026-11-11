#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  L'ATELIER DANS ORGANISATION (10 nov., lot N) — règles EXÉCUTÉES, pas lues.
//
//  1. identité : 50 achats au même titre ⇒ 50 cartes distinctes ; une carte ne
//     se crée ni ne bouge que par SON id (`a:` n° de transaction, `n:` N°) ;
//  2. la vraie route Organisation (api/_lib/operations.js, fetch simulé, données
//     INVENTÉES) : le responsable place / avance / sort / renomme ; le MEMBRE
//     d'une équipe est refusé et sa projection ne porte pas l'atelier (bornes
//     du mode équipe inchangées) ;
//  3. Ma journée : une ligne seulement si une étape (hors la dernière) a des
//     paires depuis plus de 7 j ; « pas su » (date illisible) ne compte pas ;
//  4. lectures : Ma journée projette `data->atelier` (jamais `select=data`) ;
//     aucune requête vers Vinted dans les fichiers de l'atelier.
//
//  Lancement : node scripts/audit-atelier.cjs [--mutation=NOM]
//  Mutations : membre · titre · septjours · derniere · projection · selectdata
//  Chemins déduits de l'emplacement du banc (§6.7).
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const FICHIERS = ['src/operations/atelier.js', 'src/operations/metier.js', 'src/operations/Atelier.jsx', 'src/operations/Operations.jsx',
  'api/_lib/operations.js', 'api/_lib/session.js', 'api/_lib/cle.js', 'api/_lib/fetch-delai.js', 'src/App.jsx'];
const MUTATIONS = {
  // Le membre n'est plus borné à mission.* : il pourrait déplacer les paires du vendeur.
  membre: ['src/operations/metier.js', (s) => s.replace(" if(membre)exige(['mission.etat','mission.etape'].includes(type),'Action réservée au responsable.');\n", '\n')],
  // Une carte rapprochée par son TITRE (ressemblance) au lieu de son id.
  titre: ['src/operations/metier.js', (s) => s.replace('const x=a.paires.find(y=>y.id===id);', "const x=a.paires.find(y=>y.id===id||(p.titre&&y.titre===p.titre));")],
  // Le seuil passe à 0 jour.
  septjours: ['src/operations/atelier.js', (s) => s.replace('export const ATTENTE_JOURS = 7;', 'export const ATTENTE_JOURS = 0;')],
  // La dernière étape (« mise en ligne », c'est fini) compte comme une attente.
  derniere: ['src/operations/atelier.js', (s) => s.replace('if (!p || (derniere && p.etape === derniere.id)) return false;', 'if (!p) return false;')],
  // Le membre lit toute la ligne du vendeur.
  projection: ['api/_lib/operations.js', (s) => s.replace('function projection(d,membre){return membre?', 'function projection(d,membre){return false?')],
  // Ma journée relit toute la ligne.
  selectdata: ['src/App.jsx', (s) => s.replace('&select=a:data->atelier`', '&select=data`')],
};

let ko = 0, ok = 0;
const dit = (vrai, quoi, detail) => { if (vrai) { ok++; console.log('  ✅ ' + quoi); } else { ko++; console.log('  ❌ ' + quoi + (detail ? ' — ' + detail : '')); } };

(async () => {
  // Copie de travail (la mutation ne touche jamais le dépôt).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-atelier-'));
  for (const f of FICHIERS) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RACINE, f), d); }
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  if (MUT) { const m = MUTATIONS[MUT]; if (!m) { console.error('mutation inconnue : ' + MUT); process.exit(2); } const p = path.join(tmp, m[0]); const a = fs.readFileSync(p, 'utf8'), b = m[1](a); if (a === b) { console.error('mutation sans effet : ' + MUT); process.exit(2); } fs.writeFileSync(p, b); console.log('  (mutation : ' + MUT + ')'); }
  const imp = (f) => import(pathToFileURL(path.join(tmp, f)).href);
  const A = await imp('src/operations/atelier.js');
  const M = await imp('src/operations/metier.js');

  console.log('1. Identité');
  const now = '2026-11-10T10:00:00.000Z';
  const cmd = (type, donnees) => ({ id: crypto.randomUUID(), type, donnees });
  let d = M.VIDE();
  let refusIdentite = '';
  for (let i = 0; i < 50; i++) { try { d = M.appliquer(d, cmd('atelier.placer', { cible: 'a:' + (900000000 + i), titre: 'Nike Air Max 90 blanche 42', etape: 'recue' }), { acteur: 'u', maintenant: now, empreinte: 'x' + i }); } catch (e) { refusIdentite = refusIdentite || e.message; } }
  dit(!refusIdentite, 'aucun achat refusé parce qu’un autre porte le même titre', refusIdentite);
  dit(d.atelier && d.atelier.paires.length === 50 && new Set(d.atelier.paires.map((p) => p.id)).size === 50, '50 achats au même titre ⇒ 50 cartes distinctes', String(d.atelier && d.atelier.paires.length));
  try { d = M.appliquer(d, cmd('atelier.placer', { cible: 'a:900000007', titre: 'Nike Air Max 90 blanche 42', etape: 'nettoyee' }), { acteur: 'u', maintenant: now, empreinte: 'y' }); } catch (e) { dit(false, 'avancer a:900000007', e.message); }
  dit(d.atelier.paires.filter((p) => p.etape === 'nettoyee').map((p) => p.id).join() === 'a:900000007', 'avancer UNE carte ne bouge qu’elle (par son id)');
  let refus = '';
  try { M.appliquer(d, cmd('atelier.placer', { cible: 'Nike Air Max', etape: 'recue' }), { acteur: 'u', maintenant: now, empreinte: 'z' }); } catch (e) { refus = e.message; }
  dit(/non reconnue/.test(refus), 'un titre n’est pas une identité (refusé)', refus);
  dit(A.idNumero('007') === 'n:7' && A.idNumero(' b125 ') === 'n:B125' && A.idNumero('Nike') === '', 'N° normalisé comme partout (« 007 » = « 7 », B125)');
  const pub = A.achatsPourAtelier({ vinted: [{ transaction_id: 111111, title: 'X', date: '2026-11-01T00:00:00Z', status: 'Commande annulée' }, { transaction_id: 222222, title: 'X', date: '2026-11-01T00:00:00Z' }, { transaction_id: 333333, title: 'X', date: '2026-11-01T00:00:00Z' }], annule: (o) => /annul/i.test(o.status || ''), numParTx: { 333333: 'B12' }, maintenant: Date.parse(now) });
  dit(pub.map((x) => x.id).join() === 'a:222222,a:333333' && pub[1].num === 'B12', 'achats publiés : par n° de transaction, hors annulés, N° seulement s’il est relié', JSON.stringify(pub.map((x) => [x.id, x.num])));

  console.log('2. La vraie route Organisation (responsable / membre)');
  const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', E = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-only';
  let data = null, acteur = U;
  global.fetch = async (url, opt = {}) => {
    const u = new URL(url); const rep = (j, s = 200) => new Response(JSON.stringify(j), { status: s });
    if (u.pathname.endsWith('/auth/v1/user')) return rep({ id: acteur });
    if (u.pathname.endsWith('/rpc/vrm_acces')) return rep({ acces: true });
    if (u.pathname.endsWith('/rpc/vrm_equipe_lister')) return rep({ equipe: [{ id: E, email: 'aide@example.test', statut: 'actif' }], membre_de: acteur !== U ? [{ id: E, vendeur: U, acces: true }] : [] });
    if (u.pathname.endsWith('/app_data')) {
      if (!opt.method || opt.method === 'GET') return rep(data ? [{ data }] : []);
      const body = JSON.parse(opt.body);
      if (opt.method === 'PATCH' && u.searchParams.get('data->>revision') !== 'eq.' + data.revision) return rep([]);
      data = body.data; return rep([{ data }]);
    }
    throw Error('réseau inattendu ' + url);
  };
  const { routeOperations } = await imp('api/_lib/operations.js');
  const appel = async (method, body, query = {}) => { let code = 200, j; await routeOperations({ method, query: { mode: 'operations', ...query }, headers: { authorization: 'Bearer a.b.c' }, body: body ? JSON.stringify(body) : undefined }, { setHeader() {}, status(c) { code = c; return this; }, json(x) { j = x; return this; } }); return { code, j }; };
  let r = await appel('GET');
  const rev = () => (data ? data.revision : 0);
  r = await appel('POST', { id: crypto.randomUUID(), revision: rev(), type: 'atelier.placer', donnees: { cible: 'a:123456789', titre: 'Paire A', etape: 'recue' } });
  dit(r.code === 200 && data.atelier.paires.length === 1, 'le responsable ajoute une paire', r.code + ' ' + (r.j && r.j.message));
  r = await appel('POST', { id: crypto.randomUUID(), revision: rev(), type: 'atelier.etapes', donnees: { etapes: [{ id: 'recue', nom: 'Reçue' }, { id: 'nettoyee', nom: 'Lavée' }, { id: 'photographiee', nom: 'Photographiée' }, { id: 'en_ligne', nom: 'Mise en ligne' }] } });
  dit(r.code === 200 && data.atelier.etapes[1].nom === 'Lavée' && data.atelier.etapes[1].id === 'nettoyee', 'il renomme une étape (son id reste)');
  r = await appel('POST', { id: crypto.randomUUID(), revision: rev(), type: 'atelier.etapes', donnees: { etapes: [{ id: 'nettoyee', nom: 'Lavée' }, { id: 'en_ligne', nom: 'Mise en ligne' }] } });
  dit(r.code === 400 && data.atelier.etapes.length === 4, 'retirer une étape qui porte des paires est refusé', r.code + ' ' + (r.j && r.j.message));
  acteur = E;
  const avant = JSON.stringify(data.atelier);
  r = await appel('POST', { id: crypto.randomUUID(), revision: rev(), type: 'atelier.placer', donnees: { cible: 'a:123456789', etape: 'nettoyee' } }, { vendeur: U });
  dit(r.code >= 400 && JSON.stringify(data.atelier) === avant, 'le membre de l’équipe ne déplace rien (bornes du mode équipe)', r.code + ' ' + (r.j && r.j.message));
  r = await appel('GET', null, { vendeur: U });
  dit(r.code === 200 && r.j.donnees && !('atelier' in r.j.donnees), 'le membre ne lit pas l’atelier (projection : ses missions)', JSON.stringify(Object.keys((r.j && r.j.donnees) || {})));
  acteur = U;
  r = await appel('POST', { id: crypto.randomUUID(), revision: rev(), type: 'atelier.sortir', donnees: { cible: 'a:123456789' } });
  dit(r.code === 200 && data.atelier.paires.length === 0, 'il sort la paire de l’atelier');

  console.log('3. Ma journée : > 7 j seulement, hors dernière étape');
  const jour = 86400000, t = Date.parse(now);
  const iso = (j) => new Date(t - j * jour).toISOString();
  const don = { atelier: { etapes: A.ETAPES_DEFAUT.map((e) => ({ ...e })), paires: [
    { id: 'a:1000001', etape: 'recue', depuis: iso(3) },
    { id: 'a:1000002', etape: 'nettoyee', depuis: iso(9) },
    { id: 'a:1000003', etape: 'nettoyee', depuis: 'pas une date' },
    { id: 'a:1000004', etape: 'en_ligne', depuis: iso(30) },
  ] } };
  const res = A.resumeAtelier(don, now), ligne = A.ligneAtelierJournee(res);
  dit(res.etapes.map((e) => e.n).join() === '1,2,0,1', 'le nombre par étape', res.etapes.map((e) => e.n).join());
  dit(res.enRetard === 1 && ligne && ligne.n === 1 && /Nettoyée/.test(ligne.court), 'une ligne : 1 paire à « Nettoyée » depuis plus de 7 j', JSON.stringify(ligne));
  const calme = A.ligneAtelierJournee(A.resumeAtelier({ atelier: { ...don.atelier, paires: don.atelier.paires.filter((p) => p.id !== 'a:1000002') } }, now));
  dit(calme === null, 'rien d’ancien (3 j, date illisible, dernière étape) ⇒ aucune ligne', JSON.stringify(calme));
  const p7 = A.resumeAtelier({ atelier: { ...don.atelier, paires: [{ id: 'a:1000005', etape: 'recue', depuis: iso(7) }] } }, now);
  dit(p7.enRetard === 0, 'exactement 7 j ⇒ pas encore « plus de 7 j »');

  console.log('4. Lectures et envois');
  const app = fs.readFileSync(path.join(tmp, 'src/App.jsx'), 'utf8');
  const hook = (app.match(/function useAtelierJournee[\s\S]*?\n}\n/) || [''])[0];
  dit(/select=a:data->atelier`/.test(hook) && !/select=data[`&]/.test(hook), 'Ma journée projette data->atelier (jamais select=data)');
  dit(/useAtelierJournee\(only === 'journee'\)/.test(app) && /id: 'atelier-attente'[^\n]*color: C\.warn[^\n]*tab: 'organisation'/.test(app), 'la ligne de Ma journée est ambre et ouvre Organisation');
  const sources = ['src/operations/atelier.js', 'src/operations/Atelier.jsx'].map((f) => fs.readFileSync(path.join(tmp, f), 'utf8').replace(/\/\/.*$/gm, '')).join('\n');
  dit(!/vinted\.fr|fetch\(|chrome\.runtime|postMessage/.test(sources), 'rien de l’atelier n’appelle Vinted ni l’extension');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
