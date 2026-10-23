#!/usr/bin/env node
// AUDIT (23 oct.) — LES COLIS À RETIRER, FIABLES.
// Julien : « Pareil nouveau colis Mondial Relay mais c'est pas mis à jour dans
// l'app… je veux que ça soit fiable, pour l'instant c'est catastrophique : il doit
// prendre en compte si une paire est repartie au vendeur et n'est plus disponible. »
// MESURÉ (lecture seule, sa base) — reproduit ici avec des valeurs INVENTÉES :
//   · Mondial Relay écrit « RETRAIT JUSQU'AU 26/10 », SANS l'année : 22 colis
//     « disponibles » sur 22 n'avaient AUCUNE date limite rangée ;
//   · l'en-tête « POINT RELAIS® » (le ®) faisait manquer le lieu ;
//   · un point relais garde 4 à 7 jours (MR 5, Chronopost 4 à 7, Vinted Go 6) :
//     l'app supposait 14 jours, et 10 de grâce après la limite ;
//   · le widget ne comptait que les achats Vinted (« 1 à retirer » contre 7).
// Il EXÉCUTE : la règle partagée (api/_lib/retrait-colis.js), la vraie
// `parseCarrierEmail` et la vraie route api/email-inbound, les vraies règles de
// l'app (src/App.jsx, extraites par Babel), la vraie route api/widget.
// `--prouve` : réaffaiblit la règle de cinq façons, chacune doit rendre ROUGE.
// Données inventées. §6.1 : lancé depuis un arbre d'avant, il est rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

// ── --prouve : chaque mutation doit faire tomber l'audit ────────────────────
const MUTATIONS = {
  'limite-ignoree': ['api/_lib/retrait-colis.js', 'const j = limite ? joursAvantLimite(limite, auj) : null;', 'const j = null;'],
  'limite-passee-a-retirer': ['api/_lib/retrait-colis.js', "return j < 0 ? { etat: 'delai_depasse', jours: j }", "return j < 0 ? { etat: 'a_retirer', jours: j }"],
  'annee-absente': ['api/_lib/retrait-colis.js', '  if (nNum) { const l = avecAnnee(+nNum[1], +nNum[2], recuLe); if (l) return l; }', ''],
  'widget-sans-nouveaux': ['api/widget.js', 'const nouveauxEmail = pubRetirer ? await colisEmailDepuis(m.vrm_colis_retirer, retiresMain, today) : 0;', 'const nouveauxEmail = 0;'],
  'widget-rappel-double': ['api/widget.js', "    if (cle && vus.has(cle)) continue;", ''],
  'widget-sans-vinted': ['api/widget.js', "    const nouveauxVinted = pubRetirer ? colisVintedDepuis(m.vrm_colis_retirer, txBuy, pickupDone, masques, today) : 0;", '    const nouveauxVinted = 0;'],
  'widget-vinted-masque': ['api/widget.js', "    if (u && masques.has(u)) continue;", ''],
  'entites-en-espace': ['api/_lib/entites-html.js', "export function decoderEntitesHtml(s) {\n  return String(s == null ? '' : s)", "export function decoderEntitesHtml(s) {\n  return String(s == null ? '' : s).replace(/&[#a-z0-9]+;/gi, ' ')"],
  'annonce-sans-code-a-retirer': ['api/email-inbound.js', "  if (status === 'available' && !code && annonceArriveeFuture(all)) { status = 'transit'; label = 'En transit'; lieu = null; }", ''],
  'retour-cle-commune': ['api/email-inbound.js', "  if (t.status === 'retour') return `retour-${id}`;", ''],
  'retour-sans-statut': ['api/_lib/etat-colis-email.js', " if(retour)return 'retour';", ''],
  'app-limite-extrait': ['src/App.jsx', "if(!d.limite&&(d.extraitCode||d.extraitLieu)){", "if(false){"],
  'app-annonce-a-retirer': ['src/App.jsx', "if(d.status==='available'&&d.lieu&&LIEU_AU_FUTUR.test(d.lieu)&&!codeRetrait(d.code)&&!d.qrB64&&!d.qrUrl)return", "if(false)return"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-retrait-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Une fausse base à état, à la forme de PostgREST (id eq/like, owner, meta->>) ──
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-retrait';
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const base = new Map();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') { for (const r of JSON.parse(opts.body || '[]')) base.set(`${r.owner || A}|${r.id}`, r.data); return new Response('', { status: 201 }); }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  const idp = u.searchParams.get('id') || '';
  const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || null;
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const filtresMeta = [...u.searchParams.entries()].filter(([k]) => /^meta->>/.test(k)).map(([k, v]) => [k.slice(7), v.replace(/^eq\./, '')]);
  const lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; })
    .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true))
    .filter((l) => filtresMeta.every(([k, v]) => String(l.data && l.data[k]) === v));
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => {
      const o = {};
      for (const part of sel.split(',')) {
        const [alias, ch] = part.includes(':') ? part.split(':') : [part.split(/->>|->/).pop(), part];
        if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
        if (/^meta->>/.test(ch)) { const v = l.data ? l.data[ch.slice(7)] : undefined; o[alias] = v == null ? null : (typeof v === 'object' ? null : String(v)); continue; }
        const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
        o[alias] = v === undefined ? null : v;
      }
      return o;
    }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── Les règles de l'app, extraites telles quelles (Babel) ───────────────────
function chargeApp(noms, injecte) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
  }
  const ctx = { ...injecte }; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) continue; try { vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); } catch (e) { ctx['__err_' + nom] = e.message; } }
  return ctx;
}

const RECU_MR = '2026-10-21T13:33:23.000Z';
const MR_TEXTE = ['Bonjour,', 'Votre colis 12345678 est disponible.', '', 'POINT RELAIS®', "TABA'TEST", '12 Rue Exemple', '56000 Vannes', '',
  "RETRAIT JUSQU'AU 26/10", '', 'Votre code de retrait : 123456', '', 'Avec 19 000 points de proximité partout en France',
  "MONDIAL RELAY, 1 avenue de l'horizon, 59650 VILLENEUVE D'ASCQ"].join('\n');

(async () => {
  let M = null;
  await essaie('règle partagée', async () => {
    M = await importer('api/_lib/retrait-colis.js');
    const L = M.limiteRetraitDepuisTexte;
    dit(L("RETRAIT JUSQU'AU 26/10", RECU_MR) === '2026-10-26', "Mondial Relay « RETRAIT JUSQU'AU 26/10 » (sans l'année) ⇒ 2026-10-26, l'année de la réception", L("RETRAIT JUSQU'AU 26/10", RECU_MR));
    dit(L("jusqu'au 02/01", '2026-12-29T10:00:00Z') === '2027-01-02', 'reçu le 29/12, « jusqu\'au 02/01 » ⇒ l\'année suivante', L("jusqu'au 02/01", '2026-12-29T10:00:00Z'));
    dit(L("jusqu'au 10/10", RECU_MR) === null, 'une date sans année AVANT la réception n\'est jamais devinée (l\'an prochain serait à 354 jours) ⇒ rien');
    dit(L("jusqu'au 30/11", RECU_MR) === null, 'plus de 30 jours après la réception ⇒ rien (mieux vaut un blanc qu\'un faux)');
    dit(L('Rappel : récupère ton colis avant le 25/09/2026', '2026-09-21T08:00:00Z') === '2026-09-25', 'Vinted Go « avant le 25/09/2026 » ⇒ 2026-09-25');
    dit(L("À retirer jusqu’au 29/10/2026", '2026-10-22T11:28:00Z') === '2026-10-29', "Chronopost « À retirer jusqu'au 29/10/2026 » ⇒ 2026-10-29");
    dit(L('Votre colis est disponible.', RECU_MR) === null, 'aucune date écrite ⇒ null, jamais une date inventée');
    const E = (o, quand) => M.etatRetrait(o, Date.parse(quand));
    const NOW = '2026-10-23T08:00:00Z', arr4 = Date.parse('2026-10-19T08:00:00Z');
    dit(E({ limite: '2026-10-22', arriveeMs: arr4 }, NOW).etat === 'delai_depasse', 'limite ÉCRITE passée hier, arrivé il y a 4 jours ⇒ « délai dépassé » (pas « à retirer »)', JSON.stringify(E({ limite: '2026-10-22', arriveeMs: arr4 }, NOW)));
    dit(E({ limite: '2026-10-23', arriveeMs: arr4 }, NOW).etat === 'a_retirer' && E({ limite: '2026-10-23', arriveeMs: arr4 }, NOW).jours === 0, 'limite aujourd\'hui ⇒ encore à retirer (le jour est compris)');
    dit(E({ limite: null, arriveeMs: Date.parse('2026-10-14T08:00:00Z') }, NOW).etat === 'trop_long', 'sans date limite, arrivé il y a 9 jours (garde mesurée : 7) ⇒ « à vérifier »');
    dit(E({ limite: null, arriveeMs: Date.parse('2026-10-20T08:00:00Z') }, NOW).etat === 'a_retirer', 'sans date limite, arrivé il y a 3 jours ⇒ à retirer');
    dit(E({ limite: '2026-10-29', arriveeMs: Date.parse('2026-10-10T08:00:00Z') }, NOW).etat === 'a_retirer', 'la limite ÉCRITE tranche, même arrivé depuis longtemps (elle vient du transporteur)');
    dit(M.estAVerifier({ etat: 'delai_depasse' }) && M.estAVerifier({ etat: 'trop_long' }) && !M.estAVerifier({ etat: 'a_retirer' }), '« à vérifier » = délai dépassé ou trop long, jamais un colis à retirer');
    const pub = { colis: [['2026-10-26', 0], ['2026-10-22', 0], ['', Date.parse('2026-10-12T08:00:00Z')], ['2026-10-24', 0]], aVerifier: 1, at: 5 };
    const p = M.retirerPublie(pub, Date.parse(NOW));
    dit(p && p.n === 2 && p.aVerifier === 3 && p.urgents === 1, 'la liste publiée par l\'app, RELUE avec la règle à l\'affichage : une limite passée sort du compte', JSON.stringify(p));
    dit(M.retirerPublie(null) === null && M.retirerPublie({ colis: 'x' }) === null, 'publication absente ou illisible ⇒ null (« pas su »), jamais 0');
    dit(M.lieuDepuisExtrait("TABA'TEST | 12 Rue Exemple | 56000 Vannes | Avec 19 000 points de proximité") === "TABA'TEST, 12 Rue Exemple, 56000 Vannes", 'le lieu gardé dans l\'extrait « NOM | rue | CP Ville » est lu');
    dit(M.lieuDepuisExtrait("MONDIAL RELAY | 1 avenue de l'horizon | 59650 VILLENEUVE D'ASCQ") === null, 'le siège du transporteur n\'est jamais un point relais');
  });

  await essaie('parseCarrierEmail', async () => {
    const { parseCarrierEmail } = await importer('api/email-inbound.js');
    const mr = parseCarrierEmail({ from: 'shipping@relay.vinted.com', subject: 'Votre colis 12345678 est disponible 📦', text: MR_TEXTE, html: '' }, 'mondialrelay', RECU_MR);
    dit(mr.status === 'available' && mr.code === '123456', 'Mondial Relay « disponible » : statut et code lus', `${mr.status} ${mr.code}`);
    dit(mr.limite === '2026-10-26', 'Mondial Relay : la date limite sans année est rangée', mr.limite);
    dit(/TABA'TEST/.test(mr.lieu || '') && /12 Rue Exemple/.test(mr.lieu || '') && /56000 Vannes/.test(mr.lieu || ''), 'Mondial Relay : « POINT RELAIS® » ne fait plus manquer le lieu', mr.lieu);
    const fut = parseCarrierEmail({ from: 'x', subject: 'Information sur votre colis XW000000001TS', text: '', html: '<p>Votre colis XW000000001TS sera disponible dans les prochains jours dans votre Relais Pickup.</p>' }, 'chronopost', '2026-10-23T09:53:00Z');
    dit(fut.status !== 'available' && !fut.lieu, '« sera disponible dans les prochains jours » n\'est pas un colis arrivé (et le futur n\'est pas un lieu)', `${fut.status} · lieu=${fut.lieu}`);
    const ret = parseCarrierEmail({ from: 'x', subject: "Votre colis 12345679 a été retourné à l'expéditeur", text: "Votre colis 12345679 n'a pas été retiré dans les délais. Il a été retourné à l'expéditeur.", html: '' }, 'mondialrelay', RECU_MR);
    dit(ret.status === 'retour', 'le transporteur écrit « retourné à l\'expéditeur » ⇒ statut « retour » (reparti), jamais « perdu »', ret.status);
    const cond = parseCarrierEmail({ from: 'x', subject: 'Votre colis 12345680 vous attend', text: "Votre colis vous attend. S'il n'est pas retiré avant le 26/10, il sera retourné à l'expéditeur. Code de retrait : 222333", html: '' }, 'mondialrelay', RECU_MR);
    dit(cond.status !== 'retour', 'un rappel AU CONDITIONNEL (« s\'il n\'est pas retiré… il sera retourné ») n\'est pas un retour', cond.status);
    // L'annonce, même quand elle dit aussi « dès qu'il EST disponible » (la tournure
    // qui la faisait passer pour une arrivée) : sans code, ce n'est pas un colis là.
    const fut2 = parseCarrierEmail({ from: 'x', subject: 'Information sur votre colis XW000000002TS', text: '', html: "<p>Votre colis XW000000002TS sera disponible dans les prochains jours dans votre Relais Pickup. Vous recevrez un e-mail d&egrave;s qu&rsquo;il est disponible.</p>" }, 'chronopost', '2026-10-23T09:53:00Z');
    dit(fut2.status === 'transit' && !fut2.lieu, 'une annonce sans code qui dit aussi « dès qu\'il est disponible » reste « en route »', `${fut2.status} · lieu=${fut2.lieu}`);
    // Les ENTITÉS d'un e-mail HTML (mesuré : Chronopost « commer&ccedil;ant »,
    // « Pri&#232;re ») se décodent : la date limite et le code écrits avec une
    // apostrophe typographique ou un accent sont lus.
    const ch = parseCarrierEmail({ from: 'x', subject: 'Votre colis VINTED est arrivé en relais Pickup', text: '', html: "<p>Votre colis 09440000000077 est arriv&eacute; en relais Pickup.</p><p>&Agrave; retirer jusqu&rsquo;au 29/10/2026</p><p>communiquez le code de retrait suivant au commer&ccedil;ant : 731204</p><p>TERRA TEST</p><p>11 RUE EXEMPLE</p><p>56000 VANNES</p><p>Pri&#232;re de ne pas r&#xE9;pondre</p>" }, 'chronopost', '2026-10-22T11:28:00Z');
    dit(ch.limite === '2026-10-29' && ch.code === '731204', 'e-mail HTML à entités : la date limite (« jusqu&rsquo;au ») et le code sont lus', `limite=${ch.limite} code=${ch.code}`);
    const { decoderEntitesHtml } = await importer('api/_lib/entites-html.js');
    dit(decoderEntitesHtml('Pri&#232;re de ne pas r&eacute;pondre &amp;eacute; &inconnue;') === 'Prière de ne pas répondre &eacute; &inconnue;', 'les entités se décodent en vrais caractères (plus en espace) ; « &amp; » en dernier, une entité inconnue reste', decoderEntitesHtml('Pri&#232;re de ne pas r&eacute;pondre &amp;eacute; &inconnue;'));
    const { cleNotifColis, bodyNotifColis } = await importer('api/email-inbound.js');
    dit(cleNotifColis({ status: 'retour', suivi: '1' }) === 'retour-1' && cleNotifColis({ status: 'transit', suivi: '1' }) === 'track-1', 'le retour a SA clé de notification (sinon le « en transit » d\'avant l\'avait consommée)');
    const br = bodyNotifColis({ status: 'retour', suivi: '1' }, 'mondialrelay');
    dit(/repart/.test(br) && !/perdu/i.test(br), 'la notification du retour dit qu\'il repart, jamais « perdu »', br);
    dit(/jusqu'au 26\/10/.test(bodyNotifColis({ status: 'available', suivi: '1', code: '123456', limite: '2026-10-26' }, 'mondialrelay')), 'la notification d\'arrivée dit « jusqu\'au 26/10 » (le jour est compris)');
  });

  await essaie('route api/email-inbound', async () => {
    base.clear();
    base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
    const inbound = await importer('api/email-inbound.js');
    const recoit = async (subject, text, quand) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-retrait' }, __recuLe: quand, body: { from: 'shipping@relay.vinted.com', to: 'boite@banc.test', subject, text, html: '', attachments: [] } }, res); return res; };
    const r1 = await recoit('Votre colis 12345678 est disponible 📦', MR_TEXTE, RECU_MR);
    const ligne = () => [...base.entries()].filter(([k]) => /\|email_track_.*12345678$/.test(k)).map(([, d]) => d)[0];
    const l1 = ligne();
    dit(r1.code === 200 && l1 && l1.status === 'available', 'la vraie route range le Mondial Relay « disponible »', `HTTP ${r1.code} · ${l1 && l1.status}`);
    dit(l1 && l1.limite === '2026-10-26', 'la ligne rangée porte la date limite (26/10)', l1 && l1.limite);
    dit(l1 && /TABA'TEST/.test(l1.lieu || ''), 'la ligne rangée porte le lieu', l1 && l1.lieu);
    const r2 = await recoit("Votre colis 12345678 a été retourné à l'expéditeur", "Votre colis 12345678 n'a pas été retiré dans les délais. Il a été retourné à l'expéditeur.", '2026-10-27T09:00:00.000Z');
    // ⚠️ Le retour peut être rangé sur une AUTRE ligne (autre expéditeur ⇒ autre
    // transporteur reconnu) : c'est le n° de suivi qui relie les deux (l'app le fait).
    const lignes = [...base.entries()].filter(([k]) => /\|email_track_.*12345678$/.test(k)).map(([, d]) => d);
    dit(r2.code === 200 && lignes.some((l) => l.status === 'retour' && l.suivi === '12345678'), 'puis le transporteur écrit le retour : une ligne du même n° de suivi passe « reparti »', `HTTP ${r2.code} · ${lignes.map((l) => l.status).join(',')}`);
    const cles = ((base.get(`${A}|push_dedup`) || {}).keys) || [];
    dit(cles.includes('relais-12345678-code') && cles.includes('retour-12345678'), 'les deux notifications partent (catégorie « colis ») : l\'arrivée, puis le retour — chacune sa clé', cles.join(', '));
  });

  await essaie('règles de l\'app', async () => {
    const AR = await importer('api/_lib/arrivee-colis.js');
    const app = chargeApp(['SUJET_SORTANT', 'SUJET_ENTRANT', 'colisKey', 'sensColis', 'etatColisEmail', 'isColisEnAttente', 'isColisActive'],
      { arriveeColisEmail: AR.arriveeColisEmail, etatRetrait: M.etatRetrait });
    const NOW = Date.parse('2026-10-23T08:00:00Z');
    const t = (o) => ({ status: 'available', subject: 'Votre colis 1 est disponible', ...o });
    const passe = t({ suivi: '1', limite: '2026-10-22', receivedAt: '2026-10-19T08:00:00Z' });
    const ok = t({ suivi: '2', limite: '2026-10-26', receivedAt: '2026-10-21T13:00:00Z' });
    const vieux = t({ suivi: '3', limite: null, receivedAt: '2026-10-12T08:00:00Z' });
    dit(typeof app.etatColisEmail === 'function' && app.etatColisEmail(passe, NOW).etat === 'delai_depasse', 'app : un colis dont la limite écrite est passée est « délai dépassé »', app.__err_etatColisEmail || '');
    dit(typeof app.isColisEnAttente === 'function' && app.isColisEnAttente(passe, new Set(), new Set()) && app.isColisEnAttente(vieux, new Set(), new Set()), 'app : il reste VISIBLE (en attente, à vérifier) — un colis caché est un colis perdu');
    // ⚠️ `isColisActive` lit l'horloge : on la fige au 23 oct.
    const vraiNow = Date.now; Date.now = () => NOW;
    try {
      dit(!app.isColisActive(passe, new Set(), new Set()) && !app.isColisActive(vieux, new Set(), new Set()) && app.isColisActive(ok, new Set(), new Set()),
        'app : seuls les colis dans leur délai comptent « à retirer » (pas la limite passée, pas 11 jours sans limite)');
    } finally { Date.now = vraiNow; }
  });

  await essaie('reclassifyTrack (lignes déjà rangées)', async () => {
    const EC = await importer('api/_lib/etat-colis-email.js');
    const CR = await importer('api/_lib/code-retrait-email.js');
    const app = chargeApp(['codeRetrait', 'reclassifyTrack'], {
      codeRetraitTournure: CR.codeRetraitTournure, lieuDepuisExtrait: M.lieuDepuisExtrait, limiteRetraitDepuisTexte: M.limiteRetraitDepuisTexte,
      LIEU_AU_FUTUR: M.LIEU_AU_FUTUR, etatColisDepuisTexte: EC.etatColisDepuisTexte, normaliserSuivi: EC.normaliserSuivi,
    });
    dit(typeof app.reclassifyTrack === 'function', 'la règle de relecture de l\'app se charge', app.__err_reclassifyTrack || app.__err_codeRetrait || '');
    // La forme RÉELLE du Mondial Relay du 21 octobre (lieu et date limite vides, l'extrait gardé).
    const vieux = { type: 'suivi', carrier: 'mondialrelay', suivi: '30000008', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 30000008 est disponible 📦', code: '444444', lieu: null, limite: null, receivedAt: '2026-10-21T13:33:23.590Z',
      extraitLieu: "TABA'TEST | 9 Rue Exemple | 56000 Vannes | Avec 19 000 points de proximité partout en France | MONDIAL RELAY, 1 avenue de l’horizon, 59650 VILLENEUVE D’ASCQ" };
    const v = app.reclassifyTrack(vieux);
    dit(v.status === 'available' && v.lieu === "TABA'TEST, 9 Rue Exemple, 56000 Vannes" && v.limite == null, 'ligne d\'avant : le lieu est relu dans les lignes gardées, la date limite (absente de ces lignes) reste inconnue', `${v.status} · ${v.lieu} · ${v.limite}`);
    const avecDate = app.reclassifyTrack({ ...vieux, extraitCode: "RETRAIT JUSQU&rsquo;AU 26/10 | Votre code de retrait" });
    dit(avecDate.limite === '2026-10-26', 'si une ligne gardée porte « RETRAIT JUSQU\'AU 26/10 », la date limite est relue (année de l\'e-mail)', avecDate.limite);
    // La forme RÉELLE de « Information sur votre colis » (2 lignes Chronopost).
    const info = app.reclassifyTrack({ type: 'suivi', carrier: 'chronopost', suivi: 'XW000000002TS', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Information sur votre colis XW000000002TS', code: null, lieu: 'les prochains jours dans votre Relais Pickup', limite: null, qrB64: null, qrUrl: null, receivedAt: '2026-10-22T09:58:23.030Z' });
    dit(info.status === 'transit' && !info.lieu, '« Information sur votre colis » rangé « disponible » : relu « en route », sans ce futur pour lieu', `${info.status} · ${info.lieu}`);
    const infoCode = app.reclassifyTrack({ ...info, status: 'available', lieu: 'les prochains jours dans votre Relais Pickup', code: '123456' });
    dit(infoCode.status === 'available', '… mais un code prouverait l\'arrivée : la ligne reste « disponible »', infoCode.status);
  });

  await essaie('route api/widget', async () => {
    base.clear();
    const T0 = Date.parse('2026-10-22T18:00:00Z');   // dernière publication de l'app
    base.set(`${A}|main`, {
      vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {},
      vrm_colis_collected: ['30000009'],
      vrm_colis_retirer: { total: 2, prets: 2, sansCode: 0, aVerifier: 0, urgents: 0, at: T0,
        colis: [['2099-01-01', T0], ['2020-01-01', T0]], vus: ['30000001', '30000002'], vusTx: ['7001'] },
      vinted_accounts_hidden: ['999'],
    });
    // Les achats Vinted « au point relais » rangés par l'extension (résumé) :
    // 7001 vu par l'app · 7002 NOUVEAU (capture après la publication) · 7003 coché
    // retiré · 7005 capture d'AVANT la publication (l'app l'a vue, et l'a écarté) ·
    // 7004 sur un compte masqué.
    base.get(`${A}|main`).vinted_pickup_done = { '7003': '2026-10-23T06:00:00Z' };
    base.set(`${A}|harvest_111_orders_purchased`, { capturedAt: '2026-10-23T06:30:00Z', resume: { n: 3, at: '2026-10-23T06:30:00Z', txns: ['7001', '7002', '7003'] } });
    base.set(`${A}|harvest_333_orders_purchased`, { capturedAt: '2026-10-22T10:00:00Z', resume: { n: 1, at: '2026-10-22T10:00:00Z', txns: ['7005'] } });
    base.set(`${A}|harvest_999_orders_purchased`, { capturedAt: '2026-10-23T06:30:00Z', resume: { n: 1, at: '2026-10-23T06:30:00Z', txns: ['7004'] } });
    const tr = (suivi, o) => base.set(`${A}|email_track_mondialrelay_${suivi}`, { suivi, status: 'available', subject: `Votre colis ${suivi} est disponible`, limite: '2099-01-01', ...o });
    tr('30000001', { receivedAt: '2026-10-23T07:00:00Z', subject: 'Le temps file : votre colis vous attend' });   // rappel d'un colis déjà compté
    tr('30000003', { receivedAt: '2026-10-23T06:00:00Z' });                                                       // NOUVEAU depuis la publication
    tr('30000004', { receivedAt: '2026-10-22T10:00:00Z' });                                                       // avant la publication
    tr('30000009', { receivedAt: '2026-10-23T06:00:00Z' });                                                       // coché « J'ai retiré »
    tr('30000010', { receivedAt: '2026-10-23T06:00:00Z', sens: 'sortant' });                                     // un colis qu'il envoie
    tr('30000011', { receivedAt: '2026-10-23T06:00:00Z', limite: '2020-01-01' });                                // délai écrit déjà dépassé
    const w = await importer('api/widget.js');
    const res = faireRes();
    await w.default({ method: 'GET', headers: {}, query: {} }, res);
    const c = res.corps || {};
    dit(res.code === 200, 'le widget répond', `HTTP ${res.code}`);
    dit(c.pickup === 3, 'widget : la liste de l\'app relue (1 dans le délai, 1 limite passée ⇒ sortie) + le colis e-mail ET l\'achat Vinted arrivés APRÈS la publication = 3', `pickup=${c.pickup} · nouveaux=${c.pickupNouveaux}`);
    dit(c.pickupNouveaux === 2, 'widget : deux nouveaux — ni le rappel d\'un colis déjà compté, ni un colis d\'avant la publication, ni un coché retiré, ni un colis envoyé, ni un délai dépassé, ni un achat déjà vu, ni un compte masqué', `nouveaux=${c.pickupNouveaux}`);
    dit(c.pickupAVerifier === 1 && c.pickupSource === 'app' && c.pickupAuMoins === false, 'widget : « à vérifier » dit à part, la source est l\'app', `aVerifier=${c.pickupAVerifier} source=${c.pickupSource} auMoins=${c.pickupAuMoins}`);
  });

  console.log(ko ? `\n❌ colis à retirer fiables : ${ko} rouge(s)` : '\n✅ colis à retirer fiables : tout est vert');
  process.exit(ko ? 1 : 0);
})();
