// ════════════════════════════════════════════════════════════════════════════
//  « RELIER LA BOÎTE DE <COMPTE> » ET LA RECHERCHE DE LA BOÎTE (6 nov., onglets C)
//  — les règles EXÉCUTÉES, sur des données INVENTÉES (le dépôt est public).
//  Récit : docs/passation/2026-11-06-onglets-c.md.
//
//  R1 La VRAIE règle des comptes muets (`etatEmailsComptes`, extraite d'App.jsx)
//     → `comptesARelier` : exactement les comptes muets PROUVÉS, avec leur adresse
//     et la messagerie suggérée ; trois états (en cours · pas su · lu) ; aucun
//     compte « à relier » sur une lecture ratée (on n'accuse personne).
//  R2 `boitesQuiArrivent` : les boîtes des comptes qui REÇOIVENT, jamais un relais
//     d'Apple ni un compte muet.
//  R3 LA VÉRIFICATION (`verifRelie`) : « relié » seulement sur un e-mail LU plus
//     récent que le dernier connu ; lecture ratée ⇒ « pas su » ; rien ⇒ « attente ».
//  R4 La VRAIE lecture de la preuve (`lireDernierEmailCompte`, extraite d'App.jsx)
//     sur une base servie dans sa forme : filtre par COMPTE (`meta->>account`),
//     projection scalaire (jamais `select=data`), le journal compté pour CE compte
//     seulement, 503 ⇒ `null`.
//  R5 La RECHERCHE (`filtreRecherche`, et la VRAIE `lireJournalEmail`) : côté base,
//     sur sujet / expéditeur / article / code / n° de suivi, rien ne sort du
//     filtre (virgule, parenthèse, guillemet), < 2 caractères ⇒ aucun filtre,
//     l'e-mail d'un autre vendeur jamais rendu.
//  R6 Le pas-à-pas : les messageries (Gmail, iCloud, Outlook, Yahoo, Orange/SFR/
//     Free, relais d'Apple, autre) ; Yahoo et le relais n'ont pas de règle
//     d'expéditeur ; le domaine suggère la messagerie ; aucune requête dans
//     `RelierCompte.jsx` ni `RelierBoite.jsx`.
//  R7 L'app : UN chemin (`relierBoiteDe`) depuis Comptes liés, Colis et Ma
//     journée ; E-mails monte `EcranEmails` (les comptes à relier, la preuve).
//  --prouve : chaque mutation rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'muets-tous': [['src/relierCompte.js', "(Array.isArray(etat.muets) ? etat.muets : [])", "(Array.isArray(etat.lignes) ? etat.lignes : [])"], ['src/relierCompte.js', ".filter((l) => l && l.statut === 'muet' && l.uid)", ".filter((l) => l && l.uid)"]],
  'pas-su-vaut-liste': [['src/relierCompte.js', "  if (etat.etat !== 'lu') return null;", "  if (etat.etat !== 'lu') return [];"]],
  'relais-comme-boite': [['src/relierCompte.js', "if (!a || !a.includes('@') || messagerieDeAdresse(a) === 'relais-apple') continue;", "if (!a || !a.includes('@')) continue;"]],
  'relie-sans-preuve': [['src/relierCompte.js', "  if (!Number.isFinite(t)) return 'attente';", "  if (!Number.isFinite(t)) return 'relie';"]],
  'relie-sur-ancien': [['src/relierCompte.js', "return !Number.isFinite(r) || t > r ? 'relie' : 'attente';", "return 'relie';"]],
  'panne-vaut-rien': [['src/App.jsx', "    if (!r1.ok || !r2.ok) return null;", "    if (!r1.ok || !r2.ok) return '';"]],
  'journal-tous-comptes': [['src/App.jsx', "if (e && String(e.account || '').trim() === l) prend(e.at);", "if (e) prend(e.at);"]],
  'recherche-sans-garde': [['api/_lib/reception-email.js', "replace(/[^\\p{L}\\p{N} @._'’-]+/gu,' ')", "replace(/[\\u0000]+/gu,' ')"]],
  'recherche-ignoree': [['api/_lib/reception-email.js', " if(parMots)filtres.push(parMots);", " "]],
  'yahoo-regle': [['src/relierBoite.js', "  if (m.regle === 'transfert' || m.regle === 'relais') return { lignes: [], texte: '' };", ""]],
  'colis-sans-chemin': [['src/App.jsx', "onClick={() => relierBoiteDe(c.uid)}>Relier la boîte de {c.login}</button>", "onClick={() => {}}>Relier la boîte de {c.login}</button>"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); } };
const APP_BRUT = require("./_source-app.cjs").sourceAppDe(path.join(R, 'src/App.jsx'));
function chargeApp(noms, globals = {}) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const ast = parser.parse(APP_BRUT, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + APP_BRUT.slice(d.start, d.end) + ';';
    if (n.type === 'FunctionDeclaration' && n.id && noms.includes(n.id.name)) t[n.id.name] = APP_BRUT.slice(n.start, n.end);
  }
  const ctx = { ...globals }; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) throw new Error(nom + ' introuvable dans App.jsx'); vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); }
  return ctx;
}
const J = 86400000, NOW = Date.parse('2026-11-06T10:00:00Z');
const iso = (j) => new Date(NOW - j * J).toISOString();

(async () => {
  // Un module absent (l'arbre d'avant) se DIT en rouge ; l'audit va au bout.
  let RC = {}, RB = {};
  try { RC = await import('file://' + path.join(R, 'src/relierCompte.js')); } catch (e) { dit(false, 'src/relierCompte.js se charge', String(e && e.message).slice(0, 160)); }
  try { RB = await import('file://' + path.join(R, 'src/relierBoite.js')); } catch (e) { dit(false, 'src/relierBoite.js se charge', String(e && e.message).slice(0, 160)); }

  // ── R1 · R2 — la vraie règle, projetée ───────────────────────────────────
  await essaie('R1', async () => {
    const { etatEmailsComptes } = chargeApp(['CSE_DELAI_MS', 'CSE_MIN_VENTES', 'CSE_MIN_JOURS', 'estRelaisApple', 'etatEmailsComptes']);
    // Cinq comptes inventés : A reçoit (Gmail), B jamais reçu (relais d'Apple, 4 ventes),
    // C muet depuis 20 j (iCloud), D a vendu hier seulement (surveiller), E hors des totaux.
    const comptes = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ vinted_user_id: 100 + i, login: 'vendeuse_' + x }));
    const v = (uid, tx, j) => ({ _acc: { vinted_user_id: uid }, transaction_id: tx, date: iso(j), status: 'Commande finalisée' });
    const ventes = [v(100, 1, 10), v(101, 2, 25), v(101, 3, 18), v(101, 4, 12), v(101, 5, 9), v(102, 6, 15), v(102, 7, 11), v(103, 8, 1), v(104, 9, 30), v(104, 10, 20)];
    const reception = { parCompte: { vendeuse_a: { n: 9, last: iso(1) }, vendeuse_c: { n: 4, last: iso(20) } }, bordTx: new Set(['1']), debut: iso(60) };
    const adresses = { 100: 'boutique.a@gmail.com', 101: 'x1y2z3@privaterelay.appleid.com', 102: 'vendeuse.c@icloud.com', 103: 'vendeuse.d@yahoo.fr' };
    const e = etatEmailsComptes({ comptes, reception, ventes, ventesKO: [], adresses, exclus: ['104'], maintenant: NOW, annulee: () => false });
    const l = RC.comptesARelier(e, adresses, NOW);
    dit(Array.isArray(l) && l.map((x) => x.uid).join(',') === '101,102', 'R1 à relier = les comptes muets PROUVÉS (B, C), le plus de ventes sans e-mail d’abord', JSON.stringify(l));
    const b = l.find((x) => x.uid === '101'), c = l.find((x) => x.uid === '102');
    dit(b && b.messagerie === 'relais-apple' && b.adresse === adresses[101] && b.jamais === true && b.dernier === '' && b.nSansEmail === 4, 'R1 B : relais d’Apple, jamais reçu, 4 ventes sans e-mail', JSON.stringify(b));
    dit(c && c.messagerie === 'icloud' && c.jours === 20 && c.dernier === iso(20), 'R1 C : iCloud, « depuis 20 j » (son dernier e-mail), repère = ce dernier e-mail', JSON.stringify(c));
    dit(/aucun e-mail depuis 20 j · 2 ventes sans leur e-mail/.test(RC.phraseARelier(c)), 'R1 la phrase dit la PREUVE (jours, ventes sans e-mail)', RC.phraseARelier(c));
    dit(RC.comptesARelier(etatEmailsComptes({ comptes, reception: null }), adresses) === null, 'R1 réception pas lue ⇒ `null` (pas su), jamais une liste');
    dit(RC.comptesARelier(etatEmailsComptes({ comptes, reception: undefined }), adresses) === undefined, 'R1 en cours ⇒ `undefined`');
    const sansVentes = etatEmailsComptes({ comptes, reception, ventes: null, ventesKO: [], adresses, exclus: [], maintenant: NOW });
    dit(Array.isArray(RC.comptesARelier(sansVentes, adresses)) && RC.comptesARelier(sansVentes, adresses).length === 0, 'R1 ventes pas lues ⇒ personne n’est accusé');
    const bo = RC.boitesQuiArrivent(e, adresses);
    dit(bo.join(',') === 'boutique.a@gmail.com', 'R2 boîtes qui arrivent : celle du compte qui reçoit, jamais un relais ni un compte muet', JSON.stringify(bo));
    const e2 = { etat: 'lu', lignes: [{ uid: '1', statut: 'recoit' }, { uid: '2', statut: 'recoit' }], muets: [] };
    dit(RC.boitesQuiArrivent(e2, { 1: 'r@privaterelay.appleid.com', 2: 'Z@icloud.com' }).join() === 'z@icloud.com', 'R2 un relais d’Apple qui reçoit n’est pas une boîte');
  });

  // ── R3 — la vérification ──────────────────────────────────────────────────
  await essaie('R3', async () => {
    dit(RC.verifRelie(undefined, '') === 'encours', 'R3 lecture en cours ⇒ « encours »');
    dit(RC.verifRelie(null, '') === 'passu', 'R3 lecture ratée ⇒ « pas su », jamais « relié »');
    dit(RC.verifRelie('', '') === 'attente' && RC.verifRelie('', iso(20)) === 'attente', 'R3 aucun e-mail ⇒ « attente »');
    dit(RC.verifRelie(iso(20), iso(20)) === 'attente' && RC.verifRelie(iso(25), iso(20)) === 'attente', 'R3 un e-mail déjà connu (ou plus ancien) ne prouve rien');
    dit(RC.verifRelie(iso(0.01), iso(20)) === 'relie' && RC.verifRelie(iso(0.01), '') === 'relie', 'R3 un e-mail plus récent que le dernier connu (ou le premier) ⇒ « relié »');
    dit(RC.verifRelie('pas une date', '') === 'attente', 'R3 une date illisible n’est pas une preuve');
  });

  // ── R4 — la vraie lecture de la preuve ───────────────────────────────────
  await essaie('R4', async () => {
    const lignes = [
      { id: 'email_offer_1', meta: { account: 'vendeuse_b', receivedAt: iso(0.5) } },
      { id: 'email_track_x', meta: { account: 'vendeuse_b', receivedAt: iso(3) } },
      { id: 'email_sale_2', meta: { account: 'vendeuse_a', receivedAt: iso(0.01) } },
      { id: 'email_journal', data: { entries: [{ account: 'vendeuse_b', at: iso(0.2) }, { account: 'vendeuse_a', at: iso(0.001) }] } },
    ];
    const vues = []; let panne = false;
    const fetch = async (url) => {
      const u = decodeURIComponent(String(url)); vues.push(u);
      if (panne) return { ok: false, status: 503, json: async () => ({}) };
      if (/select=data(&|$)/.test(u)) throw new Error('select=data interdit');
      const q = new URL(u.replace(/^[^?]*/, 'http://x/x'));
      const acc = (/meta->>account=eq\.([^&]*)/.exec(u) || [])[1];
      if (/id=eq\.email_journal/.test(u)) return { ok: true, json: async () => lignes.filter((x) => x.id === 'email_journal').map((x) => ({ entries: x.data.entries })) };
      if (/id=like\.email_\*/.test(u) && acc) {
        const r = lignes.filter((x) => x.meta && x.meta.account === acc).sort((a, b) => (a.meta.receivedAt < b.meta.receivedAt ? 1 : -1)).slice(0, Number(q.searchParams.get('limit') || 1e9));
        return { ok: true, json: async () => r.map((x) => ({ at: x.meta.receivedAt })) };
      }
      return { ok: true, json: async () => [] };
    };
    const { lireDernierEmailCompte } = chargeApp(['lireDernierEmailCompte'], { fetch, SUPABASE_URL: 'https://base.test', sbAuth: () => ({}), Date, String, Number, Array, Promise, encodeURIComponent });
    const b = await lireDernierEmailCompte('vendeuse_b');
    dit(b === iso(0.2), 'R4 la preuve = le plus récent de SES e-mails (ici le journal), jamais celui d’un autre compte', b);
    dit(vues.some((u) => /meta->>account=eq\.vendeuse_b/.test(u) && /limit=1\b/.test(u) && /select=at:meta->>receivedAt/.test(u)) && !vues.some((u) => /select=data(&|$)/.test(u)), 'R4 lecture filtrée par COMPTE, une ligne, un scalaire — jamais `select=data`', vues.join(' ¦ '));
    dit(await lireDernierEmailCompte('vendeuse_z') === '', 'R4 aucun e-mail de ce compte ⇒ `\'\'` (attente), pas `null`');
    panne = true;
    dit(await lireDernierEmailCompte('vendeuse_b') === null, 'R4 base en panne ⇒ `null` (pas su)');
    dit(await lireDernierEmailCompte('') === null, 'R4 sans compte ⇒ `null`');
  });

  // ── R5 — la recherche, côté base ─────────────────────────────────────────
  await essaie('R5', async () => {
    const REC = await import('file://' + path.join(R, 'api/_lib/reception-email.js'));
    const f = decodeURIComponent(REC.filtreRecherche('Nike), or=(id.eq.x "a'));
    const dedans = (/^or=\((.*)\)$/.exec(f) || [])[1] || '';
    const valeurs = [...dedans.matchAll(/\.ilike\."([^"]*)"/g)].map((m) => m[1]);
    dit(valeurs.length === 5 && valeurs.every((v) => !/[,()"]/.test(v)) && dedans.split(',').length === 5, 'R5 aucune virgule, parenthèse ni guillemet ne sort du filtre (5 champs, entre guillemets)', f);
    dit(REC.filtreRecherche('a') === '' && REC.filtreRecherche('  ') === '' && REC.filtreRecherche('(),"') === '', 'R5 moins de 2 caractères utiles ⇒ aucun filtre');
    // La vraie route : une base servie dans sa forme (owner, id like, `or=(…ilike…)`, projection).
    const MOI = '11111111-1111-1111-1111-111111111111', AUTRE = '22222222-2222-2222-2222-222222222222';
    const rec = (o, i, d) => ({ owner: o, id: 'email_reception_' + String(i).padStart(64, '0'), data: { at: iso(i / 10), etat: 'integre', type: 'suivi', adresses: ['moi@exemple.test'], from: 'Mondial Relay <noreply@exemple.test>', ...d } });
    const base = [
      rec(MOI, 1, { subject: 'Votre colis est disponible', resume: { t: 'suivi', s: 'MR998877', code: '418205', a: 'Asics Gel 1130' } }),
      rec(MOI, 2, { subject: 'Ton article Nike Air Max est vendu', type: 'vente', resume: { t: 'vente', a: 'Nike Air Max 90' } }),
      rec(MOI, 3, { subject: 'Newsletter', type: 'connu-sans-action', resume: null }),
      rec(AUTRE, 4, { subject: 'Nike Air Max chez un autre vendeur', type: 'vente', resume: { t: 'vente', a: 'Nike Air Max 1' } }),
    ];
    const val = (x, expr) => { if (expr === 'id') return x.id; const p = expr.split(/->>?/); if (p[0] !== 'data') return undefined; let v = x.data; for (const k of p.slice(1)) { if (v == null || typeof v !== 'object') return undefined; v = v[k]; } return v; };
    const like = (s, motif) => new RegExp('^' + motif.split('*').map((m) => m.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i').test(String(s == null ? '' : s));
    const requetes = [];
    const fetcher = async (url) => {
      const u = String(url); requetes.push(decodeURIComponent(u));
      const q = new URLSearchParams(u.split('?')[1]);
      if (/\/vinted_accounts/.test(u)) return { ok: true, json: async () => [] };
      let l = base.slice();
      for (const [k, v] of q.entries()) {
        if (k === 'owner') l = l.filter((x) => x.owner === v.slice(3));
        else if (k === 'id' && v.startsWith('like.')) l = l.filter((x) => like(x.id, v.slice(5)));
        else if (k === 'id' && v.startsWith('eq.')) l = l.filter((x) => x.id === v.slice(3));
        else if (k === 'or') {
          const conds = [...v.slice(1, -1).matchAll(/([^,]+?)\.ilike\."([^"]*)"/g)].map((m) => [m[1], m[2]]);
          if (!conds.length) throw new Error('or= non servi : ' + v);
          l = l.filter((x) => conds.some(([c, m]) => like(val(x, c), m)));
        } else if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
        else throw new Error('filtre non servi : ' + k + '=' + v);
      }
      // Les petites lignes de réglage (registre, état des comptes) se lisent entières ; une ligne d'e-mail, jamais (§4.4).
      if (q.get('select') === 'data' && /email_reception/.test(String(q.get('id') || ''))) throw new Error('select=data interdit');
      const sel = String(q.get('select') || '').split(',').map((c) => c.split(':'));
      const proj = (x) => Object.fromEntries(sel.map(([a, b]) => [a, b ? val(x, b) : (a === 'id' ? x.id : a === 'data' ? x.data : val(x, a))]));
      return { ok: true, json: async () => l.slice(0, Number(q.get('limit') || 1e9)).map(proj) };
    };
    const lit = (cherche) => REC.lireJournalEmail({ owner: MOI, url: 'https://base.test', headers: {}, fetcher, cherche });
    const n = (r) => r.emails.map((e) => e.id.slice(-1)).sort().join(',');
    dit(n(await lit('nike air')) === '2', 'R5 « nike air » : SON e-mail de vente (sujet / article), jamais celui d’un autre vendeur', n(await lit('nike air')));
    dit(n(await lit('418 205')) === '1' && n(await lit('mr9988')) === '1', 'R5 un code de retrait (espaces compris) ou un n° de suivi retrouvent leur colis');
    dit(n(await lit('mondial')) === '1,2,3', 'R5 l’expéditeur se cherche aussi');
    const r0 = await lit('a');
    dit(r0.emails.length === 3 && r0.cherche === '', 'R5 un seul caractère : toute sa boîte, aucune recherche dite', JSON.stringify({ n: r0.emails.length, c: r0.cherche }));
    const r1 = await lit('nike air');
    dit(r1.cherche === 'nike air' && r1.compteurs && r1.compteurs.sur === 3, 'R5 la réponse dit ce qui a été cherché ; les compteurs restent ceux de la boîte (dit à l’écran)', JSON.stringify({ c: r1.cherche, sur: r1.compteurs && r1.compteurs.sur }));
    dit(!requetes.some((u) => /email_reception/.test(u) && /[?&]select=data(&|$)/.test(u)), 'R5 jamais `select=data` sur une ligne d’e-mail');
    const route = fs.readFileSync(path.join(R, 'api/email-rattacher.js'), 'utf8');
    dit(/cherche:String\(q\.cherche\|\|''\)/.test(route), 'R5 la route passe `cherche` à la lecture');
  });

  // ── R6 — le pas-à-pas ────────────────────────────────────────────────────
  await essaie('R6', async () => {
    const ids = RB.MESSAGERIES.map((m) => m.id);
    dit(['gmail', 'icloud', 'outlook', 'yahoo', 'fai', 'relais-apple', 'autre'].every((x) => ids.includes(x)) && ids[ids.length - 1] === 'autre', 'R6 sept messageries, « autre » en dernier (le repli)', ids.join(','));
    dit(RB.MESSAGERIES.every((m) => m.etapes.length >= 4 && m.etapes.every((e) => RB.SCENES.includes(e.scene) && e.titre && e.geste)), 'R6 chacune étape par étape, chaque étape a sa scène');
    dit(RB.regleFiltre('yahoo', ['vinted']).texte === '' && RB.regleFiltre('relais-apple', ['vinted']).texte === '' && RB.regleFiltre('gmail', ['vinted']).texte === 'vinted', 'R6 Yahoo (toute la boîte) et le relais d’Apple : aucune règle d’expéditeur');
    const dom = { 'a@gmail.com': 'gmail', 'b@googlemail.com': 'gmail', 'c@icloud.com': 'icloud', 'd@me.com': 'icloud', 'e@hotmail.fr': 'outlook', 'f@outlook.com': 'outlook', 'g@live.fr': 'outlook', 'h@yahoo.fr': 'yahoo', 'i@ymail.com': 'yahoo', 'j@orange.fr': 'fai', 'k@wanadoo.fr': 'fai', 'l@sfr.fr': 'fai', 'm@free.fr': 'fai', 'n@privaterelay.appleid.com': 'relais-apple', 'o@exemple.test': 'autre', '': 'autre', 'pas-une-adresse': 'autre', 'p@gmail.com.exemple.test': 'autre' };
    const faux = Object.entries(dom).filter(([a, m]) => RB.messagerieDeAdresse(a) !== m);
    dit(!faux.length, 'R6 le domaine suggère la messagerie (jamais par ressemblance : « gmail.com.exemple.test » n’est pas Gmail)', JSON.stringify(faux));
    const w = RB.motsScene('relais', RB.EXPEDITEURS[0]);
    dit(w.libAdresse === 'Transférer à' && /\.test$/.test(w.champAdresse) && RB.motsScene('regles', RB.EXPEDITEURS[0]).champAdresse === 'De : vinted', 'R6 la scène du relais montre « Transférer à » (adresse inventée), les règles « De : … »');
    const lu = (f) => sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8')).replace(/^import[^\n]*$/gm, '');
    const pages = lu('src/RelierCompte.jsx') + lu('src/relierCompte.js') + lu('src/RelierBoite.jsx');
    dit(!/\bfetch\s*\(|requeteJson|XMLHttpRequest|sendBeacon|['"`]\/api\//.test(pages), 'R6 le pas-à-pas n’appelle AUCUNE route (la preuve est lue par l’écran)');
    dit(/messagerieInitiale=\{c\.messagerie\}/.test(lu('src/RelierCompte.jsx')) && (lu('src/RelierCompte.jsx').match(/<RelierBoite\b/g) || []).length === 1, 'R6 RelierCompte RÉUTILISE la scène animée (une fois), ouverte sur la messagerie suggérée');
    const boite = lu('src/BoiteEmails.jsx');
    dit(/\{!compteOuvert && <section className="vrm-boite-guide"/.test(boite), 'R6 un compte choisi ⇒ pas de seconde scène (jamais deux pas-à-pas)');
  });

  // ── R7 — l'app ────────────────────────────────────────────────────────────
  await essaie('R7', async () => {
    const APP = sansCommentaires(APP_BRUT);
    const relierDe = (/function relierBoiteDe\([^\n]*\n/.exec(APP) || [''])[0];
    dit(/vrm:relier-compte/.test(relierDe) && /detail:'emails'/.test(relierDe), 'R7 `relierBoiteDe` ouvre E-mails sur le pas-à-pas DU compte');
    const ligneCL = (/function LigneEmailsCompte\([\s\S]*?\n\}/.exec(APP) || [''])[0];
    const colisF = (/function ComptesARelierColis\([\s\S]*?\n\}/.exec(APP) || [''])[0];
    const appels = [/const relier = \(\) => relierBoiteDe\(uid\);/.test(ligneCL), /onClick=\{\(\) => relierBoiteDe\(c\.uid\)\}/.test(colisF), /relierBoiteDe\(comptesARelierJour\[0\]\.uid\)/.test(APP)];
    dit(appels.every(Boolean), 'R7 un seul chemin (`relierBoiteDe`) depuis Comptes liés, Colis et Ma journée', JSON.stringify(appels));
    dit(/<EcranEmails comptes=\{vintedAccounts\}/.test(APP) && /lireDernier=\{lireDernierEmailCompte\}/.test(APP), 'R7 E-mails monte `EcranEmails` (comptes à relier + la preuve)');
    const colis = (/function ComptesARelierColis\([\s\S]*?\n\}/.exec(APP) || [''])[0];
    dit(/aExpedier\(o\)/.test(colis) && /useComptesARelier\(comptes\)/.test(colis) && /!Array\.isArray\(liste\)/.test(colis), 'R7 Colis : seulement un compte à relier qui a des colis à envoyer (la règle `aExpedier`), rien sur une lecture ratée');
    dit(/\{only === 'bordereaux' && <ComptesARelierColis comptes=\{accounts\}\/>\}/.test(APP), 'R7 Colis porte la ligne');
    dit(/\{comptesARelierJour\.length \? carteARelier\(\) : null\}/.test(APP) && /\(comptesARelierJour\.length \? 1 : 0\)/.test(APP), 'R7 Ma journée : UNE carte, comptée dans « N gestes »');
    dit(/useComptesARelier\(accounts, only === 'journee'\)/.test(APP), 'R7 Ma journée ne lit la règle que sur Ma journée');
  });

  console.log(ko ? `\n❌ audit-relier-compte : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-relier-compte : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
}
