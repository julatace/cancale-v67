require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ═══════════════════════════════════════════════════════════════════════════
// « SUPPRIMER MON COMPTE » : 30 JOURS DE GRÂCE (13 nov., lot 51) — EXÉCUTÉ (§4.10)
// ═══════════════════════════════════════════════════════════════════════════
// Charge le VRAI api/compte.js (`?mode=supprimer`, `?mode=supprimer-annuler`,
// `?mode=suppression-prevue`) et le VRAI passage du cron
// (api/_lib/suppression-differee.js) sur une fausse base à deux vendeurs
// (scripts/_faux-compte-rgpd.cjs : la vraie forme PostgREST, DELETE réel) :
//   · la demande (confirmation forte jugée par le serveur) RÉSILIE l'abonnement
//     et pose une ligne NEUTRE datée de +30 j — RIEN n'est effacé ;
//   · rejouée, la date ne bouge pas ; l'état se lit (bandeau) ;
//   · l'annulation (sa session) retire SA demande — jamais celle de l'autre — et
//     reprend l'abonnement que la demande avait résilié ;
//   · le passage du cron n'efface rien avant l'échéance, efface à l'échéance par
//     `effacerCompte` (factures Pro gardées, l'autre vendeur INTACT, les e-mails
//     en quarantaine du neutre intacts), un compte annulé entre-temps reste ;
//   · lecture KO, écriture OK : demande illisible, inventaire illisible,
//     abonnement illisible, Stripe muet ⇒ RIEN d'effacé, la demande reste ;
//   · jamais le propriétaire de l'installation (demande refusée ; ligne forgée
//     à son nom ignorée par le cron) ;
//   · un compte VIDE (aucune donnée, aucun compte de revente, aucun abonnement)
//     part tout de suite — c'est dit (`immediat`).
// `--src <arbre>` : le lancer sur un autre arbre. `--prouve` : rouge sur
// origin/main ET sur 5 mutations, vert ici.
// Aucune donnée réelle : tout est inventé.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const ici = path.join(__dirname, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-sup-differee-'));
  let nm = ici; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  const arbre = (nom, depuisMain) => {
    const d = path.join(tmp, nom); fs.mkdirSync(d);
    if (depuisMain) cp.execSync(`git -C "${ici}" archive origin/main api src public | tar -x -C "${d}"`);
    else cp.execSync(`git -C "${ici}" ls-files -z api src public | (cd "${ici}" && xargs -0 tar -cf -) | tar -x -C "${d}"`, { shell: '/bin/bash' });
    for (const f of ['api/_lib/suppression-differee.js']) if (!depuisMain && fs.existsSync(path.join(ici, f))) fs.copyFileSync(path.join(ici, f), path.join(d, f));
    fs.symlinkSync(path.join(nm, 'node_modules'), path.join(d, 'node_modules'));
    return d;
  };
  const muter = (d, f, de, vers) => { const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(de)) throw new Error(`mutation introuvable dans ${f} : ${de.slice(0, 60)}`); fs.writeFileSync(p, s.replace(de, vers)); };
  const MUT = [
    ['grâce retirée (tout part tout de suite)', 'api/_lib/suppression-differee.js', 'return inv.donnees === 0 && inv.comptesVinted === 0', 'return true || inv.donnees === 0'],
    ['l’annulation par motif (toutes les demandes)', 'api/_lib/suppression-differee.js', "`app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idPrevu(owner)}`) : Promise.resolve(null))", "`app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.${PREFIXE_PREVU}*`) : Promise.resolve(null))"],
    ['le délai de 30 jours ramené à 0', 'api/_lib/suppression-differee.js', 'demandeMs + DELAI_GRACE_JOURS * 864e5', 'demandeMs'],
    ['la garde du propriétaire retirée du cron', 'api/_lib/suppression-differee.js', "if (owner === proprio || owner === envProprio) { ign('proprietaire'); continue; }", ''],
    ['inventaire illisible ⇒ on efface quand même', 'api/_lib/suppression-differee.js', "if (!inv) { ign('inventaire pas su'); continue; }", ''],
  ];
  const lancer = (racine) => cp.spawnSync(process.execPath, [__filename, '--src', racine], { encoding: 'utf8' });
  const ko = (r) => r.status !== 0;
  const rouges = (r) => (r.stdout || '').split('\n').filter((l) => l.startsWith('❌')).slice(0, 4).map((l) => '     ' + l.slice(0, 150)).join('\n');
  let bon = true;
  const ra = lancer(arbre('avant', true));
  console.log(`${ko(ra) ? '✅' : '❌'} sur origin/main : ROUGE (${(ra.stdout.match(/❌/g) || []).length} en échec)\n${rouges(ra)}`); bon = bon && ko(ra);
  MUT.forEach(([nom, f, de, vers], i) => {
    const d = arbre('mut' + i, false); muter(d, f, de, vers);
    const r = lancer(d);
    console.log(`${ko(r) ? '✅' : '❌'} mutation « ${nom} » : ROUGE (${(r.stdout.match(/❌/g) || []).length} en échec)\n${rouges(r)}`); bon = bon && ko(r);
  });
  const ri = lancer(ici);
  console.log(`${!ko(ri) ? '✅' : '❌'} sur ce code : VERT`); bon = bon && !ko(ri);
  process.exit(bon ? 0 : 1);
}

const F = require('./_faux-compte-rgpd.cjs');
const { A, B, P, NEUTRE, MDP, etat, reset, session } = F;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
global.fetch = F.faux;
const J = 864e5;
const idP = (o) => 'vrm_effacement_prevu_' + o.replace(/-/g, '');
const prevueDe = (o) => etat.base.app_data.find((l) => l.owner === NEUTRE && l.id === idP(o));
const lignes = (o) => etat.base.app_data.filter((l) => l.owner === o);
const effaces = () => etat.deletes.filter((x) => !/vrm_suppression_|vrm_effacement_prevu_/.test(x));
const intactB = () => lignes(B).length === 3 && etat.base.vinted_accounts.some((l) => l.owner === B) && etat.base.utilisateurs.has(B)
  && etat.base.app_data.some((l) => l.id === 'vrm_email_preuve_' + 'b'.repeat(40)) && etat.base.app_data.some((l) => l.id === 'jeton_reception_' + 'b'.repeat(64))
  && etat.base.app_data.some((l) => l.id === 'signalement_2026110910_222222222222_1') && etat.base.stockage.includes(`${B}/ccc-v1.jpg`);
const quarantaineIntacte = () => etat.base.app_data.some((l) => l.owner === NEUTRE && l.id === 'email_quarantaine_1');
const intactA = () => lignes(A).length === 7 && etat.base.utilisateurs.has(A) && etat.base.vinted_accounts.some((l) => l.owner === A);
const BON = (mdp = MDP[A]) => ({ confirmation: 'SUPPRIMER', motDePasse: mdp });

const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = (jeton, corps, method = 'POST', mode = 'supprimer') => {
  const buf = corps == null ? null : Buffer.from(JSON.stringify(corps), 'utf8');
  return { method, query: { mode }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};

(async () => {
  process.env.SUPABASE_SERVICE_KEY = F.SERVICE;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  for (const k of Object.keys(process.env)) if (/^RELANCES_SMTP|^RELANCES_EXPEDITEUR/.test(k)) delete process.env[k];
  let compte, lib;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message.split('\n')[0]); console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`); process.exit(1); }
  // Le passage du cron absent (l'arbre d'avant) : les contrôles de la ROUTE tournent quand même
  // (un rouge de comportement, pas seulement « le fichier n'existe pas »).
  try { lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'suppression-differee.js')); }
  catch (e) { dit(false, 'api/_lib/suppression-differee.js se charge', e.message.split('\n')[0]); lib = { passageSuppressionsPrevues: async () => ({ fait: false, arret: 'absent' }) }; }
  const appel = async (jeton, corps, method, mode) => { const r = faireRes(); await compte(req(jeton, corps, method, mode), r); return r; };
  const ENV = { SUPABASE_SERVICE_KEY: F.SERVICE, RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'u', RELANCES_SMTP_MOT_DE_PASSE: 'p', RELANCES_EXPEDITEUR: 'vrm@exemple.test' };   // SMTP du PASSAGE seulement (la route reste sans)
  const stripeFaux = async (m, chemin, params) => {
    const corps = params ? Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&') : '';
    const r = await F.faux('https://api.stripe.com/v1/' + chemin, { method: m, body: corps });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
  };
  const mails = [];
  const passage = (dansJours, extra = {}) => lib.passageSuppressionsPrevues({ maintenant: Date.now() + dansJours * J, env: ENV, stripe: stripeFaux, pret: () => true, envoyer: async (m) => { mails.push(m); return { issue: 'envoye' }; }, adresse: async () => ({ etat: 'ok', email: 'x@exemple.test' }), ...extra });

  console.log('── La demande : RIEN n’est effacé, la date est dans 30 jours');
  await essaie('A demande', async () => {
    reset(); const t0 = Date.now(); const r = await appel(session(A), BON());
    const p = prevueDe(A);
    dit(r.code === 200 && r.corps.ok === true && r.corps.prevue && !r.corps.immediat, 'A demande la suppression (mot de passe) : 200, une suppression PRÉVUE', `HTTP ${r.code} · ${r.corps && r.corps.message}`);
    dit(!!p && p.data.owner === A && Math.abs(Date.parse(p.data.effaceLe) - (t0 + 30 * J)) < 60e3, 'la demande : une ligne sous le NEUTRE, à son nom, effacement dans 30 jours', JSON.stringify(p && p.data));
    dit(effaces().length === 0 && intactA() && intactB(), 'rien n’est effacé : ni ses lignes, ni ses comptes, ni son compte de connexion (ni rien de B)', effaces().join(' '));
    dit(etat.base.subs.sub_A.cancel_at_period_end === true && p && p.data.abonnement === 'resilie', 'son abonnement est résilié tout de suite (aucun nouveau prélèvement), noté dans la demande');
    dit(/supprimé le \d+ \S+ \d{4}/.test(r.corps.message) && /annuler/.test(r.corps.message), 'la phrase dit la date et qu’il peut annuler', r.corps.message);
    dit(r.corps.etapes && r.corps.etapes.email === 'non-configure', 'sans SMTP : aucun e-mail, et c’est dit', r.corps.etapes && r.corps.etapes.email);
    const r2 = await appel(session(A), BON());
    dit(r2.code === 200 && r2.corps.deja === true && prevueDe(A).data.effaceLe === p.data.effaceLe && etat.stripe.filter((x) => x.m === 'POST').length === 1, 'rejouée : « déjà prévue », la MÊME date, Stripe pas rappelé', r2.corps && r2.corps.message);
    const e = await appel(session(A), null, 'GET', 'suppression-prevue');
    dit(e.code === 200 && e.corps.prevue && e.corps.prevue.effaceLe === p.data.effaceLe, 'l’état (bandeau) : la demande et sa date', JSON.stringify(e.corps));
    const eb = await appel(session(B), null, 'GET', 'suppression-prevue');
    dit(eb.code === 200 && eb.corps.prevue === null, 'B ne voit AUCUNE demande (la sienne seulement)', JSON.stringify(eb.corps));
    const g = await appel(session(A), null, 'GET', 'supprimer');
    dit(g.code === 200 && g.corps.prevue && g.corps.prevueSu === true && g.corps.graceJours === 30, 'l’inventaire (Réglages) porte la demande en cours et les 30 jours', JSON.stringify({ prevue: g.corps.prevue, graceJours: g.corps.graceJours }));
  });
  await essaie('lecture KO demande', async () => {
    reset(); etat.pannesMotif.push({ re: /vrm_effacement_prevu_/, m: 'GET' });
    const r = await appel(session(A), BON());
    dit(r.code === 503 && !prevueDe(A) && effaces().length === 0 && !etat.stripe.some((x) => x.m !== 'GET'), 'l’état de la demande ne se lit pas : 503, rien posé, Stripe pas touché', `HTTP ${r.code}`);
  });
  await essaie('écriture KO demande', async () => {
    reset(); etat.pannesMotif.push({ re: /on_conflict=owner,id/, m: 'POST' });
    const r = await appel(session(A), BON());
    dit(r.code === 503 && r.corps.ok === false && !prevueDe(A) && effaces().length === 0 && /pas enregistrée/.test(r.corps.message) && /reprendre/.test(r.corps.message), 'la demande ne s’écrit pas : 503, rien d’effacé, et la phrase dit que l’abonnement résilié se reprend', r.corps && r.corps.message);
  });
  await essaie('B récent', async () => {
    reset(); const r = await appel(session(B, 3 * 60e3), { confirmation: 'SUPPRIMER' });
    dit(r.code === 200 && prevueDe(B) && !prevueDe(A) && etat.base.utilisateurs.has(B), 'B, connecté il y a 3 min (compte Discord) : demande posée À SON NOM, rien effacé', `HTTP ${r.code}`);
  });
  await essaie('propriétaire', async () => {
    reset(); etat.proprioReglage = A; const r = await appel(session(A), BON());
    dit(r.code === 403 && !prevueDe(A) && !etat.stripe.length, 'le propriétaire de l’installation : refusé, aucune demande posée', `HTTP ${r.code}`);
  });

  console.log('\n── L’annulation : SA demande, et elle seule');
  await essaie('annuler', async () => {
    reset(); await appel(session(A), BON()); await appel(session(B, 60e3), { confirmation: 'SUPPRIMER' });
    const rb = await appel(session(B, 60e3), null, 'POST', 'supprimer-annuler');
    dit(rb.code === 200 && rb.corps.annule === true && !prevueDe(B) && !!prevueDe(A), 'B annule : SA demande part, celle de A reste', JSON.stringify(rb.corps));
    const ra = await appel(session(A), null, 'POST', 'supprimer-annuler');
    dit(ra.code === 200 && ra.corps.annule === true && !prevueDe(A) && ra.corps.abonnement === 'repris' && etat.base.subs.sub_A.cancel_at_period_end === false, 'A annule : sa demande part, son abonnement résilié par la demande est REPRIS', JSON.stringify(ra.corps));
    dit(intactA() && etat.base.utilisateurs.has(B) && lignes(B).length === 3, 'après annulation : tout est là (A et B)');
    const r3 = await appel(session(A), null, 'POST', 'supprimer-annuler');
    dit(r3.code === 200 && r3.corps.rien === true, 'annuler sans demande : « aucune suppression n’était prévue »', r3.corps && r3.corps.message);
    const r4 = await appel(null, null, 'POST', 'supprimer-annuler');
    dit(r4.code === 401, 'annuler sans session : 401', `HTTP ${r4.code}`);
  });
  await essaie('annuler KO', async () => {
    reset(); await appel(session(A), BON());
    etat.pannesMotif.push({ re: /vrm_effacement_prevu_/, m: 'DELETE' });
    const r = await appel(session(A), null, 'POST', 'supprimer-annuler');
    dit(r.code === 503 && !!prevueDe(A) && /PAS annulée/.test(r.corps.message) && /toujours prévue le/.test(r.corps.message), 'le retrait ne passe pas : 503, la phrase dit « PAS annulée » et la date', r.corps && r.corps.message);
    etat.pannesMotif = [{ re: /vrm_effacement_prevu_/, m: 'GET' }];
    const r2 = await appel(session(A), null, 'POST', 'supprimer-annuler');
    dit(r2.code === 503 && !!prevueDe(A), 'la demande ne se lit pas : 503, rien de changé', `HTTP ${r2.code}`);
  });

  console.log('\n── Le passage du cron : rien avant l’échéance, tout à l’échéance');
  await essaie('avant', async () => {
    reset(); await appel(session(A), BON()); etat.deletes = [];
    const r = await passage(29);
    dit(r.fait === true && r.supprimes === 0 && effaces().length === 0 && intactA() && !!prevueDe(A), 'à J+29 : rien n’est effacé, la demande reste', JSON.stringify(r));
  });
  await essaie('échéance', async () => {
    reset(); await appel(session(A), BON()); await appel(session(B, 60e3), { confirmation: 'SUPPRIMER' }); await appel(session(B, 60e3), null, 'POST', 'supprimer-annuler');
    etat.deletes = []; mails.length = 0;
    const r = await passage(31);
    dit(r.fait === true && r.supprimes === 1 && r.incomplets === 0, 'à J+31 : UN compte supprimé (A) — B a annulé', JSON.stringify(r));
    const restent = lignes(A).map((l) => l.id).sort().join(',');
    dit(restent === 'email_invoice_av902,email_invoice_tx901' && !etat.base.utilisateurs.has(A) && !etat.base.vinted_accounts.some((l) => l.owner === A), 'A : ses lignes, ses comptes de revente et son compte de connexion effacés ; ses 2 factures Pro gardées (loi)', restent);
    dit(!etat.base.app_data.some((l) => l.data && (l.data.owner === A || l.data.de === A) && !/^vrm_factures_gardees_/.test(l.id)), 'ses adresses prouvées, adresses VRM, signalements, et sa demande : effacés');
    dit(intactB() && quarantaineIntacte() && etat.base.app_data.some((l) => l.owner === P && l.id === 'main'), 'B (qui a annulé) INTACT ; les e-mails en quarantaine du neutre et la ligne du propriétaire, intacts');
    dit(mails.length === 1 && /supprimé/.test(mails[0].sujet) && /il y a 30 jours/.test(mails[0].texte), 'un e-mail « ton compte est supprimé » (motif : demandé il y a 30 jours)', mails[0] && mails[0].sujet);
    const j = etat.base.app_data.find((l) => l.owner === NEUTRE && /^vrm_suppression_[0-9a-f]{32}$/.test(l.id));
    dit(!!j && j.data.issue === 'supprime' && j.data.nombres.differee === 1 && !JSON.stringify(j).includes(A), 'le journal minimal (neutre, sans identifiant), marqué « différée »', JSON.stringify(j && j.data));
    const r2 = await passage(32);
    dit(r2.fait === true && r2.dues === 0 && intactB(), 'le lendemain : plus rien à faire', JSON.stringify(r2));
  });
  await essaie('rejouable', async () => {
    reset(); await appel(session(A), BON()); etat.pannes.add('auth');
    const r1 = await passage(31);
    dit(r1.incomplets === 1 && etat.base.utilisateurs.has(A) && !!prevueDe(A), 'le compte de connexion ne part pas : incomplet, la demande RESTE (relancée demain)', JSON.stringify(r1));
    etat.pannes.delete('auth');
    const r2 = await passage(32);
    dit(r2.supprimes === 1 && !etat.base.utilisateurs.has(A) && !prevueDe(A), 'le lendemain : il va au bout, la demande part', JSON.stringify(r2));
    dit(etat.stripe.filter((x) => x.m === 'POST').length === 1, 'Stripe résilié UNE fois en tout (demande), jamais rappelé au passage', String(etat.stripe.filter((x) => x.m === 'POST').length));
  });

  console.log('\n── Lecture KO, écriture OK : rien n’est effacé');
  for (const [nom, motif] of [
    ['la relecture de la demande', { re: /id=eq\.vrm_effacement_prevu_/, m: 'GET' }],
    ['l’inventaire', { re: /owner=eq\.11111111-1111-4111-8111-111111111111&select=id&limit=1/, m: 'GET' }],
    ['l’abonnement', { re: /\/rest\/v1\/abonnements\?owner=eq\./, m: 'GET' }],
    ['Stripe', { re: /api\.stripe\.com/, m: 'GET' }],
  ]) {
    await essaie(nom, async () => {
      reset(); etat.base.subs.sub_A.cancel_at_period_end = false;
      await appel(session(A), BON()); etat.base.subs.sub_A.cancel_at_period_end = false; etat.deletes = [];
      etat.pannesMotif.push(motif);
      const r = await passage(31);
      dit(r.supprimes === 0 && effaces().length === 0 && intactA() && !!prevueDe(A), `${nom} ne se lit pas : RIEN d’effacé, la demande reste`, JSON.stringify(r.ignores || r));
    });
  }
  await essaie('liste illisible', async () => {
    reset(); await appel(session(A), BON()); etat.deletes = [];
    etat.pannesMotif.push({ re: /id=like\.vrm_effacement_prevu_/, m: 'GET' });
    const r = await passage(31);
    dit(r.fait === false && effaces().length === 0 && intactA(), 'la liste des demandes ne se lit pas : le passage s’arrête, rien d’effacé', JSON.stringify(r));
  });
  await essaie('propriétaire pas su', async () => {
    reset(); await appel(session(A), BON()); etat.deletes = []; etat.pannes.add('reglages');
    const r = await passage(31);
    dit(r.fait === false && effaces().length === 0 && intactA(), 'le propriétaire ne se lit pas : le passage s’arrête', JSON.stringify(r));
  });

  console.log('\n── Jamais le propriétaire, jamais une ligne qui ne colle pas');
  await essaie('ligne forgée', async () => {
    reset();
    const ilYa = new Date(Date.now() - 40 * J).toISOString();
    etat.base.app_data.push({ owner: NEUTRE, id: idP(P), data: { owner: P, demandeLe: ilYa, effaceLe: ilYa, abonnement: 'aucun' } });
    etat.base.app_data.push({ owner: NEUTRE, id: idP(B), data: { owner: A, demandeLe: ilYa, effaceLe: ilYa, abonnement: 'aucun' } });
    const r = await passage(0);
    dit(r.fait === true && r.supprimes === 0 && etat.base.utilisateurs.has(P) && intactA() && intactB(), 'une demande au nom du propriétaire, une ligne dont le nom ne colle pas : ignorées, rien d’effacé', JSON.stringify(r.ignores));
  });

  console.log('\n── Un compte VIDE part tout de suite (dit)');
  await essaie('vide', async () => {
    reset();
    const V = '33333333-3333-4333-8333-333333333333';
    etat.base.utilisateurs.add(V); F.EMAIL[V] = 'v@exemple.test';
    const r = await appel(session(V, 60e3), { confirmation: 'SUPPRIMER' });
    dit(r.code === 200 && r.corps.immediat === true && !etat.base.utilisateurs.has(V) && !prevueDe(V) && intactA() && intactB(), 'compte sans donnée, sans compte de revente, sans abonnement : supprimé tout de suite (`immediat`), A et B intacts', `HTTP ${r.code} · ${r.corps && r.corps.message}`);
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
