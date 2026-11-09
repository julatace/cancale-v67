#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « COMPTES ET SÉCURITÉ » (4 nov.) — EXÉCUTE les règles :
//   1. src/compteChoix.js      : puces « Tous · comptes », choix mémorisé PAR SITE ;
//   2. src/montantsCaches.js   : chaque montant en € devient « ••• », les N° restent,
//                                un montant coupé en deux nœuds aussi ;
//   3. src/securiteCompte.js   : « partout » n'efface rien sans le oui de Supabase,
//                                N° par l'IDENTITÉ seulement, filtres ;
//   4. api/_lib/securite-compte.js : appareils CLOISONNÉS (un autre vendeur ne voit
//      rien et ne ferme rien), jamais l'IP, journal sans source inventée ;
//   5. supabase/migrations/024 : les deux fonctions filtrent sur `user_id = p_user`,
//      service_role seul, aucune IP rendue ; api/compte.js passe l'identifiant du
//      JETON, jamais celui de la requête.
//  `--prouve` : rejoue l'audit sur des copies MUTÉES des règles (chaque mutation
//  réaffaiblit une règle) et exige qu'il passe au ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = {
  choix: path.join(R, 'src/compteChoix.js'),
  montants: path.join(R, 'src/montantsCaches.js'),
  client: path.join(R, 'src/securiteCompte.js'),
  serveur: path.join(R, 'api/_lib/securite-compte.js'),
  sql: path.join(R, 'supabase/migrations/024-appareils-connectes.sql'),
  compte: path.join(R, 'api/compte.js'),
};

async function audit(fichiers, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 240) : ''}`); };
  const imp = async (f) => { try { return await import(pathToFileURL(f).href + '?t=' + Date.now() + Math.random()); } catch (e) { dit(false, 'module ' + path.basename(f), e.message); return null; } };
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { dit(false, 'fichier ' + path.basename(f)); return ''; } };

  // ── 1. Puces de compte ─────────────────────────────────────────────────────
  const C = await imp(fichiers.choix);
  if (C) {
    const opts = [{ val: '111', nom: 'a' }, { val: '222', nom: 'b' }];
    const p = C.pucesComptes(opts, '222');
    dit(p.length === 3 && p[0].val === '*' && p.filter((x) => x.actif).length === 1 && p[2].actif, '1.1 « Tous » + un par compte, UNE puce allumée (la valeur)', JSON.stringify(p));
    dit(C.pucesComptes(opts, '999').find((x) => x.actif).val === '*', '1.2 un compte hors liste vaut « Tous » (jamais un compte qu\'on ne propose pas)');
    dit(C.pucesComptes(opts, '').find((x) => x.actif).val === '*', '1.3 rien choisi ⇒ « Tous » allumé');
    dit(C.pucesComptes([{ val: '111', nom: 'a' }], '111').length === 0, '1.4 un seul compte ⇒ pas de rangée');
    dit(C.pucesComptes([...opts, { val: '111', nom: 'dup' }], '').length === 3, '1.5 un compte en double n\'a qu\'une puce');
    let carte = C.memoriserChoix({}, 'vinted', '222');
    carte = C.memoriserChoix(carte, 'ebay', 'compte2');
    dit(C.choixPourSite(carte, 'vinted') === '222' && C.choixPourSite(carte, 'ebay') === 'compte2', '1.6 chaque site garde SON choix');
    dit(C.choixPourSite(carte, 'leboncoin') === '', '1.7 un site sans choix ne reçoit pas celui d\'un autre');
    const sans = C.memoriserChoix(carte, 'vinted', '');
    dit(C.choixPourSite(sans, 'vinted') === '' && C.choixPourSite(sans, 'ebay') === 'compte2', '1.8 effacer un site ne touche pas les autres');
    dit(C.choixPourSite('{"vinted":"<script>"}', 'vinted') === '' && C.choixPourSite('pas du json', 'vinted') === '', '1.9 une carte abîmée ne choisit rien');
    dit(C.choixPourSite(JSON.stringify(carte), 'vinted') === '222', '1.10 relue depuis le stockage (texte)');
  }

  // ── 2. Montants cachés ─────────────────────────────────────────────────────
  const M = await imp(fichiers.montants);
  if (M) {
    const cas = [
      ['45,00 €', '•••'], ['Total 1 234,56 € · 3 paires', 'Total ••• · 3 paires'], ['N°12 45 €', 'N°12 •••'],
      ['−3,50 €', '•••'], ['-3,50 €', '•••'], ['+12€ de bénéfice', '••• de bénéfice'], ['12 k€', '•••'], ['1 234 €', '•••'],
      ['€45', '•••'], ['3 paires · N°B125', '3 paires · N°B125'], ['au moins 0,00 €', 'au moins •••'], ['12 %', '12 %'],
    ];
    for (const [a, b] of cas) dit(M.masquerTexte(a) === b, `2. « ${a} » ⇒ « ${b} »`, M.masquerTexte(a));
    const s = M.masquerSuite(['Bénéfice ', '45', ' €', ' sur 3']);
    dit(s.join('') === 'Bénéfice ••• sur 3', '2.a coupé en deux nœuds (« 45 » puis « € »)', JSON.stringify(s));
    const s2 = M.masquerSuite(['35,00', ' ', '€']);
    dit(!/\d/.test(s2.join('')), '2.b « {n}{\' \'}€ » : l\'espace entre les deux nœuds est transparent', JSON.stringify(s2));
    const s3 = M.masquerSuite(['N°12', ' ', 'paires']);
    dit(s3.join('') === 'N°12 paires', '2.c un N° suivi d\'autre chose que « € » reste', JSON.stringify(s3));
    const s4 = M.masquerSuite(['45', '€'], [false]);
    dit(s4[0] === '45', '2.d deux blocs différents ne se relient pas', JSON.stringify(s4));
    dit(!M.montantVisible('Total ••• · 3 paires') && M.montantVisible('Total 3 €'), '2.e le témoin `montantVisible`');
    dit(M.lireMontantsCaches('1') && !M.lireMontantsCaches(null) && !M.lireMontantsCaches('0'), '2.f mémorisé : « 1 » seulement');
  }

  // ── 3. Règles de l'écran ───────────────────────────────────────────────────
  const S = await imp(fichiers.client);
  if (S) {
    const appels = [];
    const faux = (st) => async (u, o) => { appels.push({ u, o }); if (st === 'jette') throw new Error('réseau'); return { status: st }; };
    dit(await S.deconnecterPartout({ fetch: faux(204), url: 'https://x', apikey: 'k', jeton: 'j' }) === 'ok', '3.1 204 ⇒ ok');
    dit(/\/auth\/v1\/logout\?scope=global$/.test(appels[0].u) && appels[0].o.method === 'POST' && appels[0].o.headers.Authorization === 'Bearer j', '3.2 POST logout?scope=global avec SON jeton', JSON.stringify(appels[0]));
    dit(await S.deconnecterPartout({ fetch: faux(503), url: 'https://x', apikey: 'k', jeton: 'j' }) === 'injoignable', '3.3 503 ⇒ « pas fait » (rien n\'est effacé ici)');
    dit(await S.deconnecterPartout({ fetch: faux('jette'), url: 'https://x', apikey: 'k', jeton: 'j' }) === 'injoignable', '3.4 réseau coupé ⇒ « pas fait »');
    dit(await S.deconnecterPartout({ fetch: faux(401), url: 'https://x', apikey: 'k', jeton: 'j' }) === 'refuse', '3.5 401 ⇒ session déjà morte');
    dit(/extension/i.test(S.texteConfirmationPartout({ extension: 'liaison' })) && /mot de passe/.test(S.texteConfirmationPartout({ extension: 'ancienne' })), '3.6 la confirmation dit ce que devient l\'extension');
    const fiches = { 51003: { numero: '4' }, 51001: { numero: '2' } };
    const nd = (id) => (fiches[id] && fiches[id].numero) || null;
    const L1 = S.ligneJournal({ type: 'favori', resultat: 'ok', cle: { item: '51003' } }, { numeroDeItem: nd });
    dit(L1.article === 'N°4', '3.7 N° par l\'identifiant de l\'annonce', L1.article);
    const L2 = S.ligneJournal({ type: 'favori', resultat: 'refuse', cle: { item: '99999' } }, { numeroDeItem: nd });
    dit(L2.article === 'article 99999' && L2.aVerifier, '3.8 sans fiche : jamais un N° deviné', L2.article);
    const L3 = S.ligneJournal({ type: 'republication', resultat: 'ok', cle: { item: '77777', ancien: '51001' } }, { numeroDeItem: nd });
    dit(L3.article === 'N°2', '3.9 republication : le N° de l\'ancienne annonce', L3.article);
    const L4 = S.ligneJournal({ type: 'ebay_retrait', resultat: 'ok', cle: { sku: 'VRM-230' } }, { numeroDeItem: () => '230' });
    dit(L4.article === 'SKU VRM-230', '3.10 eBay : le SKU tel qu\'écrit (un « 230 » d\'avant la coupure n\'est pas le N°230)', L4.article);
    const ev = [{ type: 'favori', compte: '1' }, { type: 'favori_offre', compte: '2' }, { type: 'ebay_retrait', compte: 'principal' }, { type: 'bordereau', compte: '1' }];
    dit(S.filtrerJournal(ev, { type: 'favoris' }).length === 2 && S.filtrerJournal(ev, { compte: '1' }).length === 2 && S.filtrerJournal(ev, { compte: '1', type: 'bordereau' }).length === 1, '3.11 filtres par type et par compte');
  }

  // ── 4. Serveur : appareils cloisonnés, journal ─────────────────────────────
  const V = await imp(fichiers.serveur);
  if (V) {
    const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
    const SA1 = 'aaaaaaaa-0000-4000-8000-000000000001', SA2 = 'aaaaaaaa-0000-4000-8000-000000000002', SB1 = 'bbbbbbbb-0000-4000-8000-000000000001';
    const jeton = (sid) => 'x.' + Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url') + '.y';
    // La base : auth.sessions de deux vendeurs, et les deux fonctions de la 024 FIDÈLES à leur SQL.
    const mk = (opts = {}) => {
      const sessions = [
        { id: SA1, user_id: A, user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', ip: '81.2.3.4', cree_le: '2026-11-01T10:00:00Z', actif_le: '2026-11-04T09:00:00Z' },
        { id: SA2, user_id: A, user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', ip: '81.2.3.5', cree_le: '2026-10-20T10:00:00Z', actif_le: '2026-11-03T09:00:00Z' },
        { id: SB1, user_id: B, user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', ip: '9.9.9.9', cree_le: '2026-11-02T10:00:00Z', actif_le: '2026-11-04T08:00:00Z' },
      ];
      const appels = [];
      const f = async (u, o) => {
        const corps = JSON.parse(o.body || '{}'); appels.push({ u, corps, cle: o.headers.Authorization });
        if (opts.absente) return { status: 404, ok: false, json: async () => ({}) };
        if (/vrm_sessions_de$/.test(u)) {
          const rows = opts.fuite ? sessions : sessions.filter((s) => s.user_id === corps.p_user);
          return { status: 200, ok: true, json: async () => rows.map(({ ip, ...r }) => (opts.fuite ? { ...r, ip } : (({ user_id, ...x }) => x)(r))) };
        }
        if (/vrm_fermer_session$/.test(u)) {
          const i = sessions.findIndex((s) => s.id === corps.p_id && s.user_id === corps.p_user);
          if (i >= 0) sessions.splice(i, 1);
          return { status: 200, ok: true, json: async () => (i >= 0 ? 1 : 0) };
        }
        return { status: 404, ok: false, json: async () => ({}) };
      };
      return { f, appels, sessions };
    };
    const d = mk();
    const rA = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: A }, jeton: jeton(SA1), methode: 'GET', corps: { user: B }, fetch: d.f });
    dit(rA.status === 200 && rA.body.appareils.length === 2, '4.1 A voit SES deux appareils', JSON.stringify(rA.body));
    dit(d.appels.every((x) => x.corps.p_user === A), '4.2 l\'identifiant passé est celui du JETON (un `user` dans la requête est ignoré)', JSON.stringify(d.appels.map((x) => x.corps)));
    dit(rA.body.appareils[0].ici && rA.body.appareils[0].appareil === 'iPhone · Safari' && rA.body.appareils[1].appareil === 'Mac · Chrome', '4.3 « cet appareil » en tête, navigateur résumé', JSON.stringify(rA.body.appareils));
    dit(!/81\.2\.3|9\.9\.9/.test(JSON.stringify(rA.body)) && rA.body.appareils.every((a) => !('ip' in a)), '4.4 aucune adresse IP rendue');
    const rB = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: B }, jeton: jeton(SB1), methode: 'GET', corps: {}, fetch: d.f });
    dit(rB.status === 200 && rB.body.appareils.length === 1 && rB.body.appareils.every((a) => a.id === SB1), '4.5 B ne voit RIEN de A', JSON.stringify(rB.body));
    const nAvant = d.appels.length;
    const fB = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: B }, jeton: jeton(SB1), methode: 'POST', corps: { session: SA2 }, fetch: d.f });
    dit(fB.status === 404 && d.sessions.some((s) => s.id === SA2) && !d.appels.slice(nAvant).some((x) => /fermer/.test(x.u)), '4.6 B ne ferme PAS une session de A (refusé avant tout appel de fermeture)', JSON.stringify(fB));
    const fIci = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: A }, jeton: jeton(SA1), methode: 'POST', corps: { session: SA1 }, fetch: d.f });
    dit(fIci.status === 409 && d.sessions.some((s) => s.id === SA1), '4.7 l\'appareil qui demande ne se ferme pas par ici');
    const fA = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: A }, jeton: jeton(SA1), methode: 'POST', corps: { session: SA2 }, fetch: d.f });
    dit(fA.status === 200 && !d.sessions.some((s) => s.id === SA2) && d.sessions.some((s) => s.id === SB1), '4.8 A ferme SON autre appareil, rien d\'autre', JSON.stringify(fA));
    const fuite = mk({ fuite: true });
    const rF = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: B }, jeton: jeton(SB1), methode: 'GET', fetch: fuite.f });
    dit(rF.status === 200 && rF.body.appareils.length === 1 && rF.body.appareils[0].id === SB1, '4.9 une fonction de base qui rendrait tout : refiltré ici, B ne voit toujours rien de A', JSON.stringify(rF.body));
    const rAbs = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: { id: A }, jeton: jeton(SA1), methode: 'GET', fetch: mk({ absente: true }).f });
    dit(rAbs.status === 503 && rAbs.body.erreur === 'pas-installe', '4.10 migration pas appliquée ⇒ dit, jamais une liste vide', JSON.stringify(rAbs.body));
    const rSans = await V.traiterAppareils({ base: 'https://b', cle: 'service', user: null, methode: 'GET', fetch: d.f });
    dit(rSans.status === 401, '4.11 sans session ⇒ 401');
    dit(V.resumerAppareil('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36') === 'Android · Chrome' && V.resumerAppareil('') === 'Appareil inconnu', '4.12 résumé Android · Chrome');
    // Journal
    const ev = V.evenementsJournal({
      favoris: [{ compte: '111', jobs: [{ etat: 'envoye', envoyeLe: 1793019613888, itemId: '5' }, { etat: 'annule', itemId: '6', traiteLe: 1793045845205 }, { etat: 'attente' }, { etat: 'refuse', traiteLe: 1793045845205, itemId: '7' }, { etat: 'incertain', traiteLe: 1793045845205, itemId: '8' }] }],
      brouillons: [{ parVRM: true, etat: 'publie', publieLe: '2026-11-01T09:27:41Z', itemId: '9', ancienId: '3', uid: '111' }, { etat: 'publie', at: '2026-11-01T09:33:55Z', itemId: '10' }, { parVRM: true, etat: 'brouillon', at: '2026-10-29T13:35:21Z', ancienId: '4', uid: '222' }],
      ebayRetraits: [{ compte: 'principal', items: [{ at: 1791734859132, sku: 'VRM-12', itemId: '1' }] }],
      ebayAgent: [{ compte: 'principal', items: [{ action: 'terminerannonce', etat: 'reussi', at: 1793007362243, ref: '123' }] }],
      bordereaux: [{ uid: '111', tx: '42', item: '5', capturedAt: '1793019613000' }],
    });
    dit(ev.length === 8, '4.13 journal : 3 favoris partis, 2 republications PAR VRM, 1 retrait, 1 action eBay, 1 bordereau', ev.length);
    dit(!ev.some((e) => e.cle && e.cle.item === '6') && !ev.some((e) => e.cle && e.cle.item === '10'), '4.14 un favori annulé ou une republication faite à la main n\'est pas « fait par VRM »');
    dit(ev.find((e) => e.cle.item === '8').resultat === 'verifier' && ev.find((e) => e.cle.item === '7').resultat === 'refuse' && ev.find((e) => e.cle.ancien === '4').resultat === 'pause', '4.15 résultats : à vérifier, refusé, en pause');
    dit(ev.every((e, i) => i === 0 || (ev[i - 1].at || Infinity) >= (e.at || Infinity)), '4.16 le plus récent d\'abord');
    const lus = [];
    const j = await V.lireJournal({ userId: A, neutre: '00000000-0000-0000-0000-000000000000',
      lireVendeur: async (c) => { lus.push(c); if (/vinted_accounts/.test(c)) return [{ vinted_user_id: '111' }]; return []; },
      lireService: async (c) => { lus.push('SERVICE ' + c); return [{ id: 'favoris_file_' + require('crypto').createHash('sha256').update('111').digest('hex'), groupe: { jobs: [{ etat: 'envoye', envoyeLe: 1793019613888, itemId: '5', message: 'secret', recipientId: '99' }] } }]; } });
    const serv = lus.filter((x) => /^SERVICE/.test(x));
    dit(serv.length === 1 && serv[0].includes(`proprietaires=cs.${encodeURIComponent(JSON.stringify([A]))}`) && serv[0].includes(`data->groupes->${encodeURIComponent('"' + A + '"')}`), '4.17 la file des favoris : seulement celles où il est propriétaire, seulement SA part', serv[0]);
    dit(lus.filter((x) => /^app_data/.test(x)).every((x) => x.includes(`owner=eq.${A}`)), '4.18 chaque ligne lue en son nom porte AUSSI le filtre sur son identifiant', JSON.stringify(lus));
    dit(!lus.some((x) => /select=[^&]*\bdata(&|,|$)/.test(x)), '4.19 jamais `select=data` (un bordereau porte son PDF)', JSON.stringify(lus));
    dit(j.evenements.length === 1 && j.evenements[0].compte === '111' && !/secret|99/.test(JSON.stringify(j.evenements)), '4.20 le compte retrouvé par l\'empreinte, ni message ni destinataire rendus', JSON.stringify(j.evenements));
    dit(Array.isArray(j.nonJournalise) && j.nonJournalise.some((x) => x.id === 'offres') && j.nonJournalise.some((x) => x.id === 'lbc'), '4.21 ce qui n\'est pas noté en base est dit');
    const j2 = await V.lireJournal({ userId: A, neutre: 'n', lireVendeur: async () => null, lireService: async () => null });
    dit(j2.pasLu.length === 6 && j2.pasLu.includes('relais') && j2.evenements.length === 0, '4.22 rien lu ⇒ « pas lu » nommé, jamais « rien »', JSON.stringify(j2.pasLu));
  }

  // ── 5. SQL et branchement de la route ──────────────────────────────────────
  const sql = lire(fichiers.sql).replace(/--.*$/gm, '');
  const fn = (nom) => (new RegExp(`create or replace function public\\.${nom}[\\s\\S]*?\\$\\$;`, 'i').exec(sql) || [''])[0];
  const lst = fn('vrm_sessions_de'), fer = fn('vrm_fermer_session');
  dit(/where\s+s\.user_id\s*=\s*p_user/i.test(lst), '5.1 la liste filtre sur user_id = p_user');
  dit(/where\s+s\.id\s*=\s*p_id\s+and\s+s\.user_id\s*=\s*p_user/i.test(fer), '5.2 la fermeture exige id ET user_id');
  dit(!/\bip\b/i.test(lst), '5.3 la liste ne lit pas l\'adresse IP');
  dit(/security definer/i.test(lst) && /set search_path\s*=\s*''/i.test(lst) && /security definer/i.test(fer) && /set search_path\s*=\s*''/i.test(fer), '5.4 security definer avec search_path vide');
  dit(/revoke all on function public\.vrm_sessions_de\(uuid\) from public, anon, authenticated/i.test(sql) && /revoke all on function public\.vrm_fermer_session\(uuid, uuid\) from public, anon, authenticated/i.test(sql), '5.5 ni anon ni authenticated ne peuvent les appeler');
  dit(/grant execute on function public\.vrm_sessions_de\(uuid\) to service_role/i.test(sql) && !/grant[^;]*to (anon|authenticated)/i.test(sql), '5.6 service_role seul');
  const cpt = lire(fichiers.compte);
  const corpsFn = (nom) => (new RegExp(`async function ${nom}\\(req, res\\) \\{[\\s\\S]*?\\n\\}`).exec(cpt) || [''])[0];
  const ap = corpsFn('appareils'), jo = corpsFn('journalVrm');
  dit(/const u = await vendeurExige\(req, res\)/.test(ap) && /user: u,/.test(ap) && /jeton: jetonDe\(req\)/.test(ap), '5.7 mode=appareils : l\'utilisateur vient de vendeurExige (le jeton)');
  dit(/const u = await vendeurExige\(req, res\)/.test(jo) && /userId: u\.id/.test(jo) && /lireCommeVendeur\(req, c\)/.test(jo), '5.8 mode=journal : son identifiant, ses lignes lues avec SON jeton');
  dit(/mode === 'appareils'/.test(cpt) && /mode === 'journal'/.test(cpt), '5.9 les deux modes sont branchés');
  return ko;
}

const MUTATIONS = [
  ['choix', "const eff = vus.has(v) ? v : '*';", "const eff = v || '*';", 'compte hors liste allumé'],
  ['choix', "return SITES.has(site) ? (c[site] || '') : '';", "return Object.values(c)[0] || '';", 'choix d\'un autre site'],
  ['montants', 'if (!lie || j >= t.length || !RE_DEBUT_EURO.test(t[j])) continue;', 'if (true) continue;', 'montant coupé en deux nœuds'],
  ['montants', "while (lie && j < t.length && blanc(t[j]))", "while (false)", 'espace entre deux nœuds'],
  ['montants', 'const RE_EURO_DEVANT = new RegExp', 'const RE_EURO_DEVANT_X = /(?!)/g; const _x = new RegExp', '« €45 »'],
  ['montants', 'const SIGNE = String.raw`(?:[+\\-−]\\s?)?`;', 'const SIGNE = String.raw`(?:[+]\\s?)?`;', 'signe −'],
  ['client', "if (r && (r.status === 204 || r.status === 200)) return 'ok';", "if (r) return 'ok';", 'panne prise pour un oui'],
  ['client', "if (!article && c.item) article = 'article ' + c.item;", "if (!article && c.item) article = 'N°' + c.item;", 'N° deviné'],
  ['client', "if (!article && c.ancien && numeroDeItem)", "if (false && c.ancien && numeroDeItem)", 'republication sans son N°'],
  ['client', "if (!article && c.sku) article = 'SKU ' + c.sku;", "if (!article && c.sku) article = 'N°' + c.sku.replace(/^VRM-/i, '');", 'SKU pris pour un N°'],
  ['serveur', "const r = await rpc(base, cle, 'vrm_sessions_de', { p_user: user.id }, f);", "const r = await rpc(base, cle, 'vrm_sessions_de', { p_user: (corps && corps.user) || user.id }, f);", 'identifiant de la requête'],
  ['serveur', ".filter((l) => l && UUID.test(String(l.id || '')) && (l.user_id == null || String(l.user_id) === String(userId)))", ".filter((l) => l && UUID.test(String(l.id || '')))", 'pas de refiltrage'],
  ['serveur', "if (!l.body.appareils.some((a) => a.id === id)) return", "if (false) return", 'fermer une session hors de sa liste'],
  ['serveur', "if (id === ici) return", "if (false) return", 'se fermer soi-même'],
  ['serveur', "creeLe: l.cree_le || null,", "creeLe: l.cree_le || null, ip: l.ip,", 'IP rendue'],
  ['serveur', "if (!resultat) continue;          // en attente, annulé, ignoré : rien n'est parti", "", 'favori annulé compté'],
  ['serveur', "if (!b || b.parVRM !== true) continue;", "if (!b) continue;", 'republication à la main comptée'],
  ['serveur', "chemin.replace('app_data?', `app_data?owner=eq.${userId}&`)", "chemin", 'filtre owner retiré'],
  ['serveur', "&data->proprietaires=cs.${encodeURIComponent(JSON.stringify([userId]))}", "", 'files des autres vendeurs'],
  ['serveur', "{ sources.favoris = null; pasLu.push('favoris'); }\n  } else", "{ sources.favoris = []; }\n  } else", 'pas lu pris pour rien'],
  ['sql', "where s.user_id = p_user", "where true", 'fonction SQL sans filtre'],
  ['sql', "delete from auth.sessions s where s.id = p_id and s.user_id = p_user;", "delete from auth.sessions s where s.id = p_id;", 'fermeture SQL sans user_id'],
  ['sql', "revoke all on function public.vrm_sessions_de(uuid) from public, anon, authenticated;", "grant execute on function public.vrm_sessions_de(uuid) to authenticated;", 'fonction ouverte aux clients'],
  ['compte', "user: u, jeton: jetonDe(req)", "user: { id: corps.user || u.id }, jeton: jetonDe(req)", 'route : identifiant de la requête'],
];

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await audit(F, true);
    console.log(ko ? `\n${ko} KO` : '\n✅ audit-comptes-securite : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  if (await audit(F, false)) { console.log('KO  l\'audit doit être vert avant les mutations'); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-cs-'));
  let rates = 0;
  for (const [cle, de, vers, nom] of MUTATIONS) {
    const src = fs.readFileSync(F[cle], 'utf8');
    if (!src.includes(de)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rates++; continue; }
    const f = path.join(tmp, cle + '-' + Math.random().toString(36).slice(2) + path.extname(F[cle]));
    fs.writeFileSync(f, src.replace(de, vers));
    const n = await audit({ ...F, [cle]: f }, false).catch(() => 1);   // une règle qui lève est rouge aussi
    console.log(`${n ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${n} rouge(s)`);
    if (!n) rates++;
  }
  console.log(rates ? `\n${rates} mutation(s) passée(s) inaperçue(s)` : `\n✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations rouges`);
  process.exit(rates ? 1 : 0);
})();
