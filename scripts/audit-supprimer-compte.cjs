require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ═══════════════════════════════════════════════════════════════════════════
// « SUPPRIMER MON COMPTE » (9 nov., RGPD) — LA ROUTE, EXÉCUTÉE (§4.10)
// ═══════════════════════════════════════════════════════════════════════════
// Charge le VRAI api/compte.js (`?mode=supprimer`) sur une fausse base à deux
// vendeurs (scripts/_faux-compte-rgpd.cjs, la vraie forme PostgREST) et prouve :
//   · sans session : 401 ; en GET : l'inventaire seul, rien d'effacé ;
//   · la confirmation FORTE est jugée par le serveur : « SUPPRIMER » ET (mot de
//     passe juste OU connexion de moins de 10 min) — sinon rien n'est touché ;
//   · le propriétaire de l'installation est refusé (variable, `vrm_acces`,
//     `vrm_reglages`) ; « pas su » ⇒ refus ;
//   · une LECTURE ratée (inventaire) ⇒ rien n'est effacé, ni Stripe touché ;
//   · seules les lignes du vendeur du jeton partent (l'autre reste INTACT, sous
//     le neutre comme chez le propriétaire) ; ses factures Pro restent, mises de
//     côté 10 ans ; le journal ne porte ni e-mail ni identifiant ;
//   · un échec à mi-chemin garde le compte de connexion, et la suppression se
//     REJOUE jusqu'au bout sans refaire Stripe.
// ⚠️ (13 nov., lot 51) La demande pose 30 JOURS DE GRÂCE : l'effacement est fait
//    par le passage du cron (api/_lib/suppression-differee.js), joué ici à J+31 ;
//    la grâce elle-même (annuler, lecture KO…) : scripts/audit-suppression-differee.cjs.
// `--src <arbre>` : le lancer sur un autre arbre. `--prouve` : le lance sur
// origin/main ET sur une MUTATION (filtre propriétaire retiré) — les deux
// doivent échouer.
// Aucune donnée réelle : tout est inventé.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const ici = path.join(__dirname, '..');
  const lancer = (racine) => cp.spawnSync(process.execPath, [__filename, '--src', racine], { encoding: 'utf8' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-supprimer-'));
  const avant = path.join(tmp, 'avant'), mut = path.join(tmp, 'mutation');
  fs.mkdirSync(avant); fs.mkdirSync(mut);
  cp.execSync(`git -C "${ici}" archive origin/main api src public | tar -x -C "${avant}"`);
  cp.execSync(`git -C "${ici}" ls-files -z api src public | (cd "${ici}" && xargs -0 tar -cf -) | tar -x -C "${mut}"`, { shell: '/bin/bash' });
  let nm = ici; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  for (const d of [avant, mut]) fs.symlinkSync(path.join(nm, 'node_modules'), path.join(d, 'node_modules'));
  const f = path.join(mut, 'api', '_lib', 'suppression-compte.js');
  const src = fs.readFileSync(f, 'utf8');
  const muté = src.replace('donnees: `app_data?owner=eq.${o}`', 'donnees: `app_data?owner=not.is.null`');
  if (muté === src) { console.log('❌ la mutation ne trouve pas le filtre propriétaire'); process.exit(1); }
  fs.writeFileSync(f, muté);
  const ra = lancer(avant), rm = lancer(mut), ri = lancer(ici);
  const ko = (r) => r.status !== 0;
  const rouges = (r) => (r.stdout || '').split('\n').filter((l) => l.startsWith('❌')).map((l) => '     ' + l.slice(0, 160)).join('\n');
  console.log(`${ko(ra) ? '✅' : '❌'} sur origin/main : ROUGE (${(ra.stdout.match(/❌/g) || []).length} en échec)\n${rouges(ra)}`);
  console.log(`${ko(rm) ? '✅' : '❌'} sur la mutation « filtre propriétaire retiré » : ROUGE (${(rm.stdout.match(/❌/g) || []).length} en échec)\n${rouges(rm)}`);
  console.log(`${!ko(ri) ? '✅' : '❌'} sur ce code : VERT`);
  process.exit(ko(ra) && ko(rm) && !ko(ri) ? 0 : 1);
}

const F = require('./_faux-compte-rgpd.cjs');
const { A, B, P, NEUTRE, MDP, etat, reset, session } = F;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
global.fetch = F.faux;

const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = (jeton, corps, method = 'POST', mode = 'supprimer') => {
  const buf = corps == null ? null : Buffer.from(JSON.stringify(corps), 'utf8');
  return { method, query: { mode }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const lignes = (o) => etat.base.app_data.filter((l) => l.owner === o);
const intactB = () => lignes(B).length === 3 && etat.base.vinted_accounts.some((l) => l.owner === B) && etat.base.detourage_usage.some((l) => l.owner === B)
  && etat.base.stockage.includes(`${B}/ccc-v1.jpg`) && etat.base.utilisateurs.has(B) && !etat.base.subs.sub_B.cancel_at_period_end
  && etat.base.app_data.some((l) => l.id === 'vrm_email_preuve_' + 'b'.repeat(40)) && etat.base.app_data.some((l) => l.id === 'jeton_reception_' + 'b'.repeat(64))
  && etat.base.app_data.some((l) => l.id === 'signalement_2026110910_222222222222_1') && etat.base.app_data.some((l) => l.id === 'email_quarantaine_1')
  && etat.base.app_data.some((l) => l.owner === P && l.id === 'main');
const rienTouche = () => etat.deletes.length === 0 && !etat.stripe.some((x) => x.m !== 'GET') && etat.base.utilisateurs.has(A) && lignes(A).length === 7;
const BON = (mdp = MDP[A]) => ({ confirmation: 'SUPPRIMER', motDePasse: mdp });

(async () => {
  process.env.SUPABASE_SERVICE_KEY = F.SERVICE;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  for (const k of Object.keys(process.env)) if (/^RELANCES_SMTP|^RELANCES_EXPEDITEUR/.test(k)) delete process.env[k];
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n${ko} en échec`); process.exit(1); }
  const appel = async (jeton, corps, method, mode) => { const r = faireRes(); await compte(req(jeton, corps, method, mode), r); return r; };
  // (13 nov., lot 51) L'effacement d'une demande : le passage du cron à J+31 (le même Stripe simulé).
  let lib = null;
  try { lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'suppression-differee.js')); } catch (_) { lib = null; }
  const stripeFaux = async (m, chemin, params) => { const r = await F.faux('https://api.stripe.com/v1/' + chemin, { method: m, body: params ? Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&') : '' }); return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) }; };
  const echeance = (j = 31) => (lib ? lib.passageSuppressionsPrevues({ maintenant: Date.now() + j * 864e5, env: { SUPABASE_SERVICE_KEY: F.SERVICE }, stripe: stripeFaux, pret: () => true }) : Promise.resolve({ fait: false }));
  // La demande, puis son échéance : la réponse de la route, et le passage.
  const demanderPuisEffacer = async (jeton, corps) => { const r = await appel(jeton, corps); const p = r.code === 200 && r.corps && r.corps.prevue ? await echeance() : null; return { r, p }; };

  console.log('── Qui peut supprimer');
  await essaie('sans session', async () => {
    reset(); const r = await appel(null, BON());
    dit(r.code === 401 && rienTouche(), 'sans session : 401, rien n’est touché', `HTTP ${r.code}`);
  });
  await essaie('GET inventaire', async () => {
    reset(); const r = await appel(session(A), null, 'GET');
    const n = r.corps && r.corps.nombres;
    dit(r.code === 200 && n && n.donnees === 7 && n.facturesPro === 2 && n.comptesVinted === 1 && n.indexJetons === 2 && n.preuvesAdresse === 1 && rienTouche(), 'GET : l’inventaire de SES données (7 lignes, 2 factures Pro, 1 compte Vinted, 2 adresses VRM), rien n’est effacé', JSON.stringify(n));
  });
  await essaie('GET fermer', async () => {
    reset(); const r = await appel(session(A), null, 'GET', 'fermer');
    dit(r.code === 405 && rienTouche(), 'l’ancien `fermer` en GET : refusé (jamais d’un simple lien)', `HTTP ${r.code}`);
  });

  console.log('\n── La confirmation forte, jugée par le serveur');
  for (const [nom, corps, code] of [
    ['absente', {}, 400], ['« supprimer » en minuscules', { confirmation: 'supprimer', motDePasse: MDP[A] }, 400],
    ['son e-mail (l’ancienne confirmation)', { confirmation: 'vendeuse.a@exemple.test' }, 400],
    ['mot de passe faux', BON('mauvais'), 403], ['mot de passe d’un AUTRE compte', BON(MDP[B]), 403],
    ['sans mot de passe, connecté il y a 2 h', { confirmation: 'SUPPRIMER' }, 403],
  ]) {
    await essaie(nom, async () => { reset(); const r = await appel(session(A), corps); dit(r.code === code && rienTouche(), `${nom} : ${code}, rien n’est touché`, `HTTP ${r.code} · ${r.corps && r.corps.message}`); });
  }
  await essaie('mdp pas su', async () => {
    reset(); etat.pannes.add('mdp'); const r = await appel(session(A), BON());
    dit(r.code === 503 && rienTouche(), 'le service de connexion ne dit pas si le mot de passe est juste : 503, rien n’est touché', `HTTP ${r.code}`);
  });

  console.log('\n── Jamais le propriétaire de l’installation');
  await essaie('env', async () => { reset(); process.env.VRM_OWNER_UID = A; const r = await appel(session(A), BON()); dit(r.code === 403 && rienTouche() && !etat.stripe.length, 'VRM_OWNER_UID : refusé', `HTTP ${r.code}`); });
  await essaie('rpc', async () => { reset(); etat.proprioRpc = A; const r = await appel(session(A), BON()); dit(r.code === 403 && rienTouche(), '`vrm_acces` le dit : refusé', `HTTP ${r.code}`); });
  await essaie('reglages', async () => { reset(); etat.proprioReglage = A; const r = await appel(session(A), BON()); dit(r.code === 403 && rienTouche(), '`vrm_reglages` le dit (et `vrm_acces` non) : refusé', `HTTP ${r.code}`); });
  await essaie('rpc pas su', async () => { reset(); etat.pannes.add('rpc'); const r = await appel(session(A), BON()); dit(r.code === 503 && rienTouche(), '`vrm_acces` muet : refus (« pas su » n’efface rien)', `HTTP ${r.code}`); });
  await essaie('reglages pas su', async () => { reset(); etat.pannes.add('reglages'); const r = await appel(session(A), BON()); dit(r.code === 503 && rienTouche(), '`vrm_reglages` muet : refus', `HTTP ${r.code}`); });

  console.log('\n── Une lecture ratée n’efface rien');
  await essaie('inventaire', async () => {
    reset(); etat.pannes.add('lecture-app_data'); const r = await appel(session(A), BON());
    dit(r.code === 503 && rienTouche(), 'l’inventaire ne se lit pas : 503, RIEN d’effacé, Stripe pas touché', `HTTP ${r.code} · ${etat.deletes.join(' ')}`);
  });
  await essaie('abonnement', async () => {
    reset(); etat.pannes.add('abonnements'); const r = await appel(session(A), BON());
    dit(r.code === 503 && rienTouche(), 'l’abonnement ne se lit pas : rien d’effacé (pas su s’il paie encore)', `HTTP ${r.code}`);
  });
  await essaie('stripe', async () => {
    reset(); etat.pannes.add('stripe'); const r = await appel(session(A), BON());
    dit(r.code >= 500 && etat.deletes.length === 0 && etat.base.utilisateurs.has(A), 'Stripe muet : rien d’effacé', `HTTP ${r.code}`);
  });

  console.log('\n── La suppression : les SIENNES, et seulement elles (demande, puis échéance à J+31)');
  await essaie('A supprime', async () => {
    reset(); const { r, p } = await demanderPuisEffacer(session(A), BON());
    dit(r.code === 200 && r.corps.ok === true && !!r.corps.prevue, 'A demande la suppression de son compte (mot de passe) : 200, prévue dans 30 jours', `HTTP ${r.code} · ${r.corps && r.corps.message}`);
    dit(!!p && p.fait === true && p.supprimes === 1, 'à l’échéance, le passage du cron supprime son compte', JSON.stringify(p));
    const restent = lignes(A).map((l) => l.id).sort().join(',');
    dit(restent === 'email_invoice_av902,email_invoice_tx901', 'il ne reste de A QUE ses 2 factures Pro (pièces comptables)', restent);
    const g = etat.base.app_data.find((l) => l.owner === NEUTRE && l.id === 'vrm_factures_gardees_' + A.replace(/-/g, ''));
    dit(!!g && g.data.n === 2 && Date.parse(g.data.jusque) - Date.now() > 9.9 * 365 * 864e5, '… mises de côté 10 ans (une ligne neutre dit jusqu’à quand)', JSON.stringify(g && g.data));
    dit(!etat.base.vinted_accounts.some((l) => l.owner === A) && !etat.base.detourage_usage.some((l) => l.owner === A) && !etat.base.stockage.some((x) => x.startsWith(A)), 'ses comptes Vinted, compteurs et photos sont effacés');
    dit(!etat.base.app_data.some((l) => l.data && (l.data.owner === A || l.data.de === A) && !/^vrm_factures_gardees_/.test(l.id)), 'sous le neutre et chez le propriétaire : ses preuves d’adresse, ses adresses VRM (index des jetons), ses signalements et sa demande sont effacés');
    const eff = etat.deletes.filter((x) => !/vrm_suppression_|vrm_effacement_prevu_/.test(x));
    dit(!etat.base.utilisateurs.has(A) && eff[eff.length - 1] === 'auth:' + A, 'son compte de connexion est supprimé, EN DERNIER (seuls le journal et la demande viennent après)', eff.slice(-2).join(' → '));
    dit(intactB(), 'l’autre vendeur est INTACT (lignes, comptes, photos, compte, abonnement, preuve, adresse VRM, signalement), le propriétaire aussi');
    dit(etat.stripe.some((x) => x.m === 'POST' && /cancel_at_period_end=true/.test(x.corps)) && etat.base.subs.sub_A.cancel_at_period_end, 'l’abonnement est résilié AVANT (dès la demande : aucun nouveau prélèvement)');
    const j = etat.base.app_data.find((l) => l.owner === NEUTRE && /^vrm_suppression_[0-9a-f]{32}$/.test(l.id));
    const brut = JSON.stringify(j || {});
    dit(!!j && j.data.issue === 'supprime' && !brut.includes(A) && !brut.includes(A.replace(/-/g, '').slice(0, 12)) && !/@/.test(brut), 'le journal : une ligne neutre, date + nombres, NI identifiant NI e-mail', brut.slice(0, 200));
    dit(r.corps.etapes.email === 'non-configure', 'sans SMTP : aucun e-mail, et c’est dit (`etapes.email`)', r.corps.etapes.email);
  });
  await essaie('B connexion récente', async () => {
    reset(); const { r, p } = await demanderPuisEffacer(session(B, 3 * 60e3), { confirmation: 'SUPPRIMER' });
    dit(r.code === 200 && p && p.supprimes === 1 && !etat.base.utilisateurs.has(B) && lignes(A).length === 7 && etat.base.utilisateurs.has(A), 'B, connecté il y a 3 min, sans mot de passe (compte Google/Discord) : supprimé à l’échéance — A intact', `HTTP ${r.code}`);
  });

  console.log('\n── Un échec se dit, et se rejoue');
  await essaie('rejouable', async () => {
    reset();
    const j = session(A, 60e3);
    const r0 = await appel(j, { confirmation: 'SUPPRIMER' });
    etat.pannes.add('auth');
    const p1 = await echeance(31);
    dit(r0.code === 200 && p1.incomplets === 1 && etat.base.utilisateurs.has(A), 'le compte de connexion ne part pas : INCOMPLÈTE, dite par le passage, compte gardé', JSON.stringify(p1));
    etat.pannes.delete('auth');
    const p2 = await echeance(32);
    dit(p2.supprimes === 1 && !etat.base.utilisateurs.has(A), 'relancée le lendemain : elle va au bout', JSON.stringify(p2));
    dit(etat.stripe.filter((x) => x.m === 'POST').length === 1, 'Stripe n’est résilié qu’UNE fois (le rejeu voit « déjà résilié »)', String(etat.stripe.filter((x) => x.m === 'POST').length));
    const r3 = await appel(j, { confirmation: 'SUPPRIMER' });
    dit(r3.code === 401 && intactB(), 'rejouée une fois de plus, compte parti : 401, rien d’autre touché', `HTTP ${r3.code}`);
  });
  await essaie('équipe muette', async () => {
    reset(); const r = await appel(session(A), BON()); etat.pannes.add('equipe'); const p = await echeance(31);
    dit(r.code === 200 && p.incomplets === 1 && etat.base.utilisateurs.has(A), 'l’équipe ne s’efface pas : INCOMPLÈTE, compte gardé', JSON.stringify(p));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
