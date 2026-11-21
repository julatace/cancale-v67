#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE L'ESPACE FORMATEUR, CÔTÉ APP ET ROUTE (10 nov., lot AR)
//  node scripts/audit-formateurs.cjs            (le contrôle)
//  node scripts/audit-formateurs.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  EXÉCUTE la vraie règle du suivi (src/communaute/formateur.js), la vraie route
//  (api/_lib/formateur.js, par api/compte.js) et le vrai script de la page
//  publique (public/formateur.js, dans un DOM minimal). Données INVENTÉES.
//  La base elle-même (032) est prouvée par audit-formateurs-sql.cjs.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 240) : '')); };
const remplace = (s, a, b, nom) => { if (s.split(a).length !== 2) throw new Error('ancre introuvable : ' + nom); return s.split(a).join(b); };

const MUTATIONS = {
  // Un élève qui ne partage pas compte pour 0 vente (« pas su » = 0).
  'prive-compte-zero': { f: 'src/communaute/formateur.js', m: (s) => remplace(s, "  const lus = lignes.filter((l) => l.chiffres === 'lu');", "  const lus = lignes.map((l) => (l.chiffres === 'lu' ? l : { ...l, ventes: 0, ca: 0 }));", 'pcz') },
  // Le total partiel se dit complet.
  'total-complet': { f: 'src/communaute/formateur.js', m: (s) => remplace(s, '    complet: lignes.length > 0 && lus.length === lignes.length,', '    complet: lignes.length > 0,', 'tc') },
  // Les étapes d'un élève sans accord comptées (la clé `faits` ignorée).
  'etapes-sans-accord': { f: 'src/communaute/formateur.js', m: (s) => remplace(s, "p && Array.isArray(p.faits) ? p.faits.filter((x) => ids.has(x)).length : null;", "p && Array.isArray(p.faits) ? p.faits.filter((x) => ids.has(x)).length : 0;", 'esa') },
  // La route donne l'accord sur un simple « oui » textuel.
  'accord-laxiste': { f: 'api/_lib/formateur.js', m: (s) => remplace(s, "p_etapes: c.etapes === true };", "p_etapes: !!c.etapes };", 'al') },
  // La route élargit un partage absent.
  'partage-elargi': { f: 'api/_lib/formateur.js', m: (s) => remplace(s, "    const p = c.partage == null ? 'rien' : String(c.partage);\n    if (!PARTAGES.includes(p)) return refus('partage');\n    nom = 'vrm_form_demander'", "    const p = c.partage == null ? 'chiffres' : String(c.partage);\n    if (!PARTAGES.includes(p)) return refus('partage');\n    nom = 'vrm_form_demander'", 'pe') },
  // La page publique relaie tout ce que la base rend.
  'page-relaie-tout': { f: 'api/_lib/formateur.js', m: (s) => remplace(s, "  return { code: 200, corps: { ok: true, page: { adresse: a, nom: String(d.nom || ''), presentation: String(d.presentation || ''), groupes } } };", "  return { code: 200, corps: { ok: true, page: { ...d, adresse: a, groupes: d.groupes } } };", 'prt') },
  // La page publique pose le texte du formateur en HTML.
  'page-html': { f: 'public/formateur.js', m: (s) => remplace(s, "    $('presentation').textContent = p.presentation || '';", "    $('presentation').innerHTML = p.presentation || '';", 'ph') },
};

if (args.includes('--prouve')) {
  let r = 0; const noms = Object.keys(MUTATIONS);
  for (const n of noms) {
    const x = spawnSync(process.execPath, [__filename, '--mutation=' + n], { encoding: 'utf8' });
    const rouges = (x.stdout.match(/^❌ /gm) || []).length, saute = /ancre introuvable/.test(x.stdout + x.stderr);
    const bon = x.status !== 0 && rouges > 0 && !saute; if (bon) r++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${n} » → ${bon ? rouges + ' rouge(s)' : saute ? 'ancre introuvable' : 'RESTE VERTE'}`);
  }
  console.log(`\n${r}/${noms.length} mutations attrapées.`); process.exit(r === noms.length ? 0 : 1);
}

// L'arbre à juger : le vrai, ou une copie mutée (fichiers copiés dans un dossier temporaire).
let ARBRE = RACINE;
if (MUTATION) {
  const mu = MUTATIONS[MUTATION]; if (!mu) { console.log('❌ mutation inconnue'); process.exit(1); }
  ARBRE = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-form-mut-'));
  for (const d of ['api', 'src/communaute', 'public']) fs.cpSync(path.join(RACINE, d), path.join(ARBRE, d), { recursive: true, filter: (f) => !/\.(png|zip|jpg|webp|pdf|woff2?)$/.test(f) });
  fs.writeFileSync(path.join(ARBRE, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
  if (!fs.existsSync(path.join(ARBRE, 'node_modules'))) fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(ARBRE, 'node_modules'));
  try { const f = path.join(ARBRE, mu.f); fs.writeFileSync(f, mu.m(fs.readFileSync(f, 'utf8'))); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  process.on('exit', () => { try { fs.rmSync(ARBRE, { recursive: true, force: true }); } catch (_) {} });
}

(async () => {
  const R = await import('file://' + path.join(ARBRE, 'src/communaute/formateur.js'));
  // ── 1. LA RÈGLE DU SUIVI ──
  const mois = R.moisCle(Date.UTC(2026, 10, 10, 12));
  const ch = (n, ca) => ({ v: 1, ventes: true, achats: true, semaines: {}, mois: { [mois]: [n, ca, 0, 0] } });
  const membres = [
    { id: 'm1', nom: 'Bea', statut: 'accepte', partage: 'chiffres', chiffres: ch(3, 12000) },
    { id: 'm2', nom: 'Cam', statut: 'accepte', partage: 'rien' },
    { id: 'm3', nom: 'Dan', statut: 'accepte', partage: 'detail', chiffres: null },
    { id: 'm4', nom: 'Eve', statut: 'attente', partage: 'chiffres' },
  ];
  const form = { etapes: [{ id: 'e1' }, { id: 'e2' }], progres: [{ membre: 'm1', faits: ['e1', 'e9'] }, { membre: 'm2' }] };
  const s = R.suiviGroupe(membres, form, Date.UTC(2026, 10, 10, 12));
  dit(s.eleves === 3, 'seuls les élèves ACCEPTÉS sont au suivi (pas la demande en attente)', s.eleves);
  dit(s.ventes === 3 && s.ca === 12000, 'le total ne somme que ce qui est PARTAGÉ et publié', `${s.ventes} · ${s.ca}`);
  dit(s.partagent === 1 && s.complet === false, 'couverture « 1 sur 3 » : le total se dit « au moins »', `${s.partagent} · ${s.complet}`);
  const l = Object.fromEntries(s.lignes.map((x) => [x.id, x]));
  dit(l.m2.chiffres === 'prive' && l.m2.ventes === null, 'un élève qui ne partage pas : « Ne partage pas », jamais 0', JSON.stringify(l.m2));
  dit(l.m3.chiffres === 'attente' && l.m3.ventes === null, 'partage permis mais pas encore publié : « pas encore reçu », jamais 0', JSON.stringify(l.m3));
  dit(l.m1.faits === 1 && l.m1.total === 2, 'étapes : seulement les coches d’étapes VIVANTES (1/2)', JSON.stringify(l.m1));
  dit(l.m2.etapes === 'prive' && l.m2.faits === null, 'sans accord (pas de clé « faits ») : « Étapes privées »', JSON.stringify(l.m2));
  const vide = R.suiviGroupe([{ id: 'm2', nom: 'Cam', statut: 'accepte', partage: 'rien' }], null);
  dit(vide.ventes === null && vide.lignes[0].etapes === 'aucune', 'personne ne partage : le total est « — » (null), pas 0');
  dit(R.adresseDepuisNom('Coach Élodie  & Co') === 'coach-elodie-co', 'une adresse proposée depuis un nom (accents, espaces)', R.adresseDepuisNom('Coach Élodie  & Co'));
  dit(!R.adresseOk('a--b') && !R.adresseOk('-ab') && R.adresseOk('abc'), 'la forme d’adresse = celle de la base');
  dit(R.lienFormateurLu('{"a":"coach-julien","g":"00000000-0000-4000-8000-000000000001"}')?.adresse === 'coach-julien' && R.lienFormateurLu('{"a":"x","g":"pas-un-uuid"}') === null, 'le lien de la page est VÉRIFIÉ avant usage');

  // ── 2. LA ROUTE (le vrai api/compte.js, faux PostgREST) ──
  const appels = [];
  let REPONSE = {};
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    if (/\/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', email: 'invente@exemple.test' }), { status: 200 });
    const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (m) { const corps = JSON.parse(o.body || '{}'); appels.push({ fn: m[1], corps, auth: (o.headers || {}).Authorization }); const r = REPONSE[m[1]]; return r === undefined ? new Response('{"code":"PGRST202"}', { status: 404 }) : new Response(JSON.stringify(r), { status: 200 }); }
    return new Response('[]', { status: 200 });
  };
  const compte = (await import('file://' + path.join(ARBRE, 'api', 'compte.js'))).default;
  const appeler = async (query, corps, jeton) => {
    const res = { code: 200, corps: null, en: {}, setHeader(k, v) { this.en[k] = v; }, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
    const it = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
    const req = { method: corps ? 'POST' : 'GET', query, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps || undefined, [Symbol.asyncIterator]() { return it ? it[Symbol.asyncIterator]() : (async function* () {})(); } };
    await compte(req, res); return res;
  };
  const J = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.c2ln';
  REPONSE = {};
  let r = await appeler({ mode: 'communaute' }, { action: 'form-lire' }, J);
  dit(r.code === 503 && r.corps.erreur === 'non-installe', 'base sans la 032 ⇒ 503 « non-installe », jamais un espace vide', JSON.stringify(r.corps));
  REPONSE = { vrm_form_demander: { ok: true, id: 'x', statut: 'attente' }, vrm_form_accord: { ok: true }, vrm_form_lire: { acces: true, page: null, crees: [], rejoints: [] } };
  r = await appeler({ mode: 'communaute' }, { action: 'form-lire' }, J);
  dit(r.code === 200 && r.corps.form && Array.isArray(r.corps.form.crees), 'form-lire relaie l’espace', JSON.stringify(r.corps));
  appels.length = 0;
  r = await appeler({ mode: 'communaute' }, { action: 'form-demander', adresse: 'Coach-Julien', groupe: '00000000-0000-4000-8000-000000000001', nom: 'Bea' }, J);
  const d = appels.find((a) => a.fn === 'vrm_form_demander');
  dit(r.code === 200 && d && d.corps.p_partage === 'rien' && d.corps.p_adresse === 'coach-julien', 'demander sans partage ⇒ « rien » (jamais élargi), adresse en minuscules', JSON.stringify(d && d.corps));
  dit(d && /Bearer /.test(d.auth || '') && !String(d.auth).includes('service'), 'la route relaie avec le JETON de l’appelant', d && d.auth);
  appels.length = 0;
  await appeler({ mode: 'communaute' }, { action: 'form-accord', adhesion: '00000000-0000-4000-8000-000000000002', etapes: 'oui' }, J);
  const ac = appels.find((a) => a.fn === 'vrm_form_accord');
  dit(ac && ac.corps.p_etapes === false, 'l’accord ne se donne que par un « true » explicite', JSON.stringify(ac && ac.corps));
  r = await appeler({ mode: 'communaute' }, { action: 'form-page-ranger', adresse: 'a b', nom: 'Coach', presentation: '' }, J);
  dit(r.code === 400 && r.corps.erreur === 'adresse', 'une adresse mal formée est refusée avant la base');

  // La page publique, SANS session.
  REPONSE = { vrm_form_page: { ok: true, adresse: 'coach-julien', nom: 'Coach Julien', presentation: 'Bonjour', owner: '11111111-1111-4111-8111-111111111111', email: 'invente@exemple.test', groupes: [{ id: '00000000-0000-4000-8000-000000000001', nom: 'Formation', description: 'd', code: 'ABCDEFGH' }] } };
  appels.length = 0;
  r = await appeler({ mode: 'formateur', f: 'coach-julien' }, null, null);
  const txt = JSON.stringify(r.corps);
  dit(r.code === 200 && r.corps.page.nom === 'Coach Julien' && r.corps.page.groupes.length === 1, 'la page publique se lit SANS session', txt);
  dit(!/1111111|exemple\.test|ABCDEFGH|owner|email|code/.test(txt), 'elle ne relaie que nom, présentation, groupes (id, nom, description) — même si la base en rendait plus', txt);
  dit(appels[0] && appels[0].auth === 'Bearer ' + appels[0].auth.slice(7) && !/eyJhbGciOiJIUzI1NiJ9\.eyJzdWIi/.test(appels[0].auth), 'avec la clé PUBLIQUE, jamais un jeton de vendeur');
  dit(r.en['Cache-Control'] === 'no-store', 'jamais mise en cache (une page retirée disparaît tout de suite)');
  REPONSE = { vrm_form_page: { ok: false, raison: 'page' } };
  r = await appeler({ mode: 'formateur', f: 'coach-julien' }, null, null);
  dit(r.code === 404 && r.corps.erreur === 'page', 'pas publiée / inconnue ⇒ 404 « page »');
  REPONSE = {};
  r = await appeler({ mode: 'formateur', f: 'coach-julien' }, null, null);
  dit(r.code === 503 && r.corps.erreur === 'non-installe', 'base sans la 032 ⇒ 503 « non-installe »');

  // ── 3. LE SCRIPT DE LA PAGE PUBLIQUE, dans un DOM minimal ──
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, hidden: false, textContent: '', innerHTML: '', attrs: {}, children: [], className: '', href: '',
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }, get firstChild() { return this.children[0] || null; }, addEventListener() {} });
  const main = el('main');
  let pret = null;
  const page = { ok: true, page: { adresse: 'coach-julien', nom: '<img src=x onerror=alert(1)>', presentation: '<b>gras</b>', groupes: [{ id: '00000000-0000-4000-8000-000000000001', nom: 'Formation', description: '' }, { id: 'pas-un-uuid', nom: 'X' }] } };
  const ctx = { window: {}, document: { documentElement: el('html'), getElementById: el, querySelector: () => main, createElement: () => el('c' + Math.random()), addEventListener: (_, f) => { pret = f; }, title: '' },
    localStorage: { getItem: () => null }, location: { pathname: '/f/coach-julien', search: '' }, URLSearchParams,
    fetch: async (u) => { ctx.url = u; return { status: 200, json: async () => page }; }, encodeURIComponent, decodeURIComponent, console };
  ctx.window.matchMedia = () => ({ matches: false }); ctx.matchMedia = ctx.window.matchMedia;
  vm.runInNewContext(fs.readFileSync(path.join(ARBRE, 'public/formateur.js'), 'utf8'), ctx);
  pret(); await new Promise((x) => setTimeout(x, 20));
  dit(ctx.url === '/api/compte?mode=formateur&f=coach-julien', 'la page lit la route publique de SON adresse', ctx.url);
  dit(main.attrs['data-formateur-etat'] === 'lu', 'la page est rendue', main.attrs['data-formateur-etat']);
  dit(els.nom.textContent === page.page.nom && els.presentation.innerHTML === '' && els.presentation.textContent === '<b>gras</b>', 'le texte du formateur est posé en TEXTE, jamais en HTML');
  const liens = els.groupes.children.map((li) => li.children[2] && li.children[2].href);
  dit(liens.length === 1 && liens[0] === '/?tab=communaute&formateur=coach-julien&g=00000000-0000-4000-8000-000000000001', '« Demander à rejoindre » ouvre VRM sur ce groupe (identifiant vérifié)', JSON.stringify(liens));

  // ── 4. LE BRANCHEMENT ──
  const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  dit(/sessionStorage\.setItem\('vrm_form_lien'/.test(app), 'l’app garde le lien de la page avant de nettoyer l’adresse');
  const vercel = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
  dit((vercel.rewrites || []).some((x) => x.source === '/f/([a-z0-9-]+)' && x.destination === '/formateur.html'), 'vercel.json : /f/<adresse> → /formateur.html');
  const html = fs.readFileSync(path.join(RACINE, 'public/formateur.html'), 'utf8');
  dit(!/<script>[^<]/.test(html) && /<script src="\/formateur\.js"><\/script>/.test(html), 'aucun script en ligne (la CSP les refuse)');
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
