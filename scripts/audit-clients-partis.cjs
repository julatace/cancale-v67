require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ═══════════════════════════════════════════════════════════════════════════
// LES CLIENTS PARTIS (9 nov., validé par Julien) — LE PASSAGE DU CRON, EXÉCUTÉ
// ═══════════════════════════════════════════════════════════════════════════
// Un abonnement terminé : données gardées 12 mois ; à 11 mois un e-mail, UNE
// fois ; à 12 mois la suppression par la fonction de « Supprimer mon compte ».
// Exécute le VRAI api/_lib/clients-partis.js (celui qu'appelle le cron du matin,
// api/ship-reminders.js) sur la fausse base à deux vendeurs, horloge simulée :
//   · 10 mois : rien ; 11 mois : un e-mail à A, une fois (rejoué : aucun autre) ;
//   · 12 mois : A supprimé (sauf ses factures Pro, gardées 10 ans), B intact ;
//   · un abonnement actif, Stripe muet, Stripe qui dit « vivant », le mode test,
//     le propriétaire de l'installation, le propriétaire « pas su » ⇒ RIEN ;
//   · borné (N par passage) et rejouable.
// `--prouve` : sur origin/main (le passage n'existe pas) et sur une MUTATION
// (la garde du propriétaire retirée), il doit être ROUGE.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const ici = path.join(__dirname, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-partis-'));
  const avant = path.join(tmp, 'avant'), mut = path.join(tmp, 'mutation');
  fs.mkdirSync(avant); fs.mkdirSync(mut);
  cp.execSync(`git -C "${ici}" archive origin/main api src public | tar -x -C "${avant}"`);
  cp.execSync(`git -C "${ici}" ls-files -z api src public | (cd "${ici}" && xargs -0 tar -cf -) | tar -x -C "${mut}"`, { shell: '/bin/bash' });
  let nm = ici; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  for (const d of [avant, mut]) fs.symlinkSync(path.join(nm, 'node_modules'), path.join(d, 'node_modules'));
  const f = path.join(mut, 'api', '_lib', 'clients-partis.js');
  const src = fs.readFileSync(f, 'utf8');
  const muté = src.replace("if (owner === proprio || owner === envProprio) { ign('proprietaire'); continue; }", '');
  if (muté === src) { console.log('❌ la mutation ne trouve pas la garde du propriétaire'); process.exit(1); }
  fs.writeFileSync(f, muté);
  const lancer = (r) => cp.spawnSync(process.execPath, [__filename, '--src', r], { encoding: 'utf8' });
  const ra = lancer(avant), rm = lancer(mut), ri = lancer(ici);
  const rouges = (r) => (r.stdout || '').split('\n').filter((l) => l.startsWith('❌')).slice(0, 6).map((l) => '     ' + l.slice(0, 160)).join('\n');
  console.log(`${ra.status ? '✅' : '❌'} sur origin/main : ROUGE\n${rouges(ra)}`);
  console.log(`${rm.status ? '✅' : '❌'} sur la mutation « garde du propriétaire retirée » : ROUGE\n${rouges(rm)}`);
  console.log(`${!ri.status ? '✅' : '❌'} sur ce code : VERT`);
  process.exit(ra.status && rm.status && !ri.status ? 0 : 1);
}

const F = require('./_faux-compte-rgpd.cjs');
const { A, B, P, NEUTRE, etat, reset } = F;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
global.fetch = F.faux;

const JOUR = 864e5;
const T0 = Date.parse('2025-09-15T10:00:00Z');                 // la fin de l'abonnement de A, chez Stripe
const mois = (n, j = 1) => { const d = new Date(T0); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime() + j * JOUR; };
// A : abonnement terminé (la ligne ET Stripe le disent). B : actif. P : le propriétaire, terminé aussi.
const prepare = () => {
  reset();
  const b = etat.base;
  b.abonnements[A] = { owner: A, statut: 'canceled', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', mode_test: false };
  b.subs.sub_A = { id: 'sub_A', customer: 'cus_A', status: 'canceled', ended_at: Math.floor(T0 / 1000) };
  b.abonnements[P] = { owner: P, statut: 'canceled', client_stripe: 'cus_P', abonnement_stripe: 'sub_P', mode_test: false };
  b.subs.sub_P = { id: 'sub_P', customer: 'cus_P', status: 'canceled', ended_at: Math.floor(T0 / 1000) };
};
let mails;
const envoyer = async (m) => { mails.push(m); return { issue: 'envoye' }; };

(async () => {
  process.env.SUPABASE_SERVICE_KEY = F.SERVICE;
  process.env.STRIPE_SECRET_KEY = 'sk_live_banc';
  Object.assign(process.env, { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'u', RELANCES_SMTP_MOT_DE_PASSE: 'p', RELANCES_EXPEDITEUR: 'vrm@exemple.test' });
  let mod;
  try { mod = await import('file://' + path.join(RACINE, 'api', '_lib', 'clients-partis.js')); }
  catch (e) { dit(false, 'api/_lib/clients-partis.js se charge', e.message.split('\n')[0]); console.log(`\n${ko} en échec`); process.exit(1); }
  const passe = (maintenant, o = {}) => mod.passageClientsPartis({ maintenant, envoyer, ...o });

  await essaie('le cron l’appelle', async () => {
    const sr = fs.readFileSync(path.join(RACINE, 'api', 'ship-reminders.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
    dit(/import \{ passageClientsPartis \} from '\.\/_lib\/clients-partis\.js'/.test(sr) && /if \(!soir && !reveil\) \{ try \{ clientsPartis = await passageClientsPartis\(/.test(sr), 'le cron du matin (api/ship-reminders.js) lance le passage, une fois par jour');
  });

  console.log('── L’horloge avance');
  await essaie('10 mois', async () => {
    prepare(); mails = [];
    const r = await passe(mois(10, 20));
    dit(r.fait && !mails.length && etat.base.utilisateurs.has(A) && !etat.deletes.length, '10 mois après la fin : rien (ni e-mail, ni suppression)', JSON.stringify(r.ignores));
  });
  await essaie('11 mois', async () => {
    prepare(); mails = [];
    const r = await passe(mois(11, 1));
    dit(mails.length === 1 && mails[0].a === F.EMAIL[A], '11 mois : UN e-mail, à A', mails.map((m) => m.a).join(','));
    dit(mails[0] && /seront supprimées le 15\/09\/2026/.test(mails[0].sujet) && /vue=compte/.test(mails[0].texte) && /export/i.test(mails[0].texte), '… qui dit la date (fin + 12 mois, lue chez Stripe) et comment exporter', mails[0] && mails[0].sujet);
    dit(etat.base.utilisateurs.has(A) && !etat.deletes.length, '… et rien n’est supprimé');
    await passe(mois(11, 2)); await passe(mois(11, 9));
    dit(mails.length === 1, 'les passages suivants (J+1, J+8) : aucun autre e-mail (une fois)', String(mails.length));
    dit(r.avis === 1, 'le passage le compte', JSON.stringify(r));
  });
  await essaie('11 mois sans SMTP', async () => {
    prepare(); mails = [];
    const h = process.env.RELANCES_SMTP_HOTE; delete process.env.RELANCES_SMTP_HOTE;
    const r = await passe(mois(11, 1));
    process.env.RELANCES_SMTP_HOTE = h;
    dit(!mails.length && r.ignores['smtp non configure'] === 1, 'SMTP pas configuré : aucun e-mail, et le passage le dit', JSON.stringify(r.ignores));
  });
  await essaie('12 mois', async () => {
    prepare(); mails = [];
    const r = await passe(mois(12, 1));
    const restent = etat.base.app_data.filter((l) => l.owner === A).map((l) => l.id).sort().join(',');
    dit(r.supprimes === 1 && !etat.base.utilisateurs.has(A) && restent === 'email_invoice_av902,email_invoice_tx901', '12 mois : A est supprimé — il ne reste que ses factures Pro', restent);
    dit(etat.base.app_data.some((l) => l.owner === NEUTRE && l.id === 'vrm_factures_gardees_' + A.replace(/-/g, '')), '… mises de côté 10 ans');
    dit(etat.base.utilisateurs.has(B) && etat.base.app_data.filter((l) => l.owner === B).length === 3 && etat.base.vinted_accounts.some((l) => l.owner === B), 'B (abonnement actif) : intact');
    dit(etat.base.utilisateurs.has(P) && etat.base.app_data.some((l) => l.owner === P && l.id === 'main'), 'P (le propriétaire, abonnement terminé aussi) : intact');
    const j = etat.base.app_data.find((l) => l.owner === NEUTRE && /^vrm_suppression_/.test(l.id));
    dit(!!j && j.data.nombres.depart === 1 && !JSON.stringify(j).includes(A) && !/@/.test(JSON.stringify(j)), 'le journal minimal : sans identifiant ni e-mail', JSON.stringify(j && j.data).slice(0, 120));
    dit(mails.length === 1 && /est supprimé/.test(mails[0].sujet), 'l’e-mail de confirmation part (adresse lue AVANT la suppression)', mails.map((m) => m.sujet).join(' | '));
    const vrais = () => etat.deletes.filter((x) => !/vrm_suppression_|vrm_factures_gardees_/.test(x)).length;
    const n = vrais(); mails = [];
    const r2 = await passe(mois(12, 2));
    dit(r2.fait && r2.supprimes === 0 && vrais() === n && !mails.length, 'rejoué le lendemain : plus rien à faire (idempotent)', JSON.stringify(r2.ignores));
  });

  console.log('\n── Jamais : actif, pas su, test, propriétaire');
  await essaie('Stripe dit vivant', async () => {
    prepare(); mails = []; etat.base.subs.sub_A.status = 'active'; delete etat.base.subs.sub_A.ended_at;
    const r = await passe(mois(13));
    dit(etat.base.utilisateurs.has(A) && !mails.length && r.ignores['pas fini chez Stripe'] === 1, 'la ligne dit « terminé », Stripe dit « actif » : rien', JSON.stringify(r.ignores));
  });
  await essaie('Stripe muet', async () => {
    prepare(); mails = []; etat.pannes.add('stripe');
    const r = await passe(mois(13));
    dit(etat.base.utilisateurs.has(A) && !mails.length && !etat.deletes.length && r.ignores['stripe pas su'] >= 1, 'Stripe muet (statut illisible) : rien', JSON.stringify(r.ignores));
  });
  await essaie('autre client', async () => {
    prepare(); etat.base.subs.sub_A.customer = 'cus_X';
    const r = await passe(mois(13));
    dit(etat.base.utilisateurs.has(A) && r.ignores['pas son client'] === 1, 'l’abonnement Stripe n’est pas de son client : rien', JSON.stringify(r.ignores));
  });
  await essaie('mode test', async () => {
    prepare(); etat.base.abonnements[A].mode_test = true;
    const r = await passe(mois(13));
    dit(etat.base.utilisateurs.has(A) && r.ignores['mode test'] >= 1, 'un abonnement du mode TEST de Stripe : rien', JSON.stringify(r.ignores));
  });
  await essaie('propriétaire env', async () => {
    prepare(); etat.proprioReglage = null; process.env.VRM_OWNER_UID = A;
    const r = await passe(mois(13), { env: process.env });
    delete process.env.VRM_OWNER_UID;
    dit(etat.base.utilisateurs.has(A) && r.ignores.proprietaire >= 1, 'A déclaré propriétaire (VRM_OWNER_UID) : rien', JSON.stringify(r.ignores));
  });
  await essaie('propriétaire pas su', async () => {
    prepare(); mails = []; etat.pannes.add('reglages');
    const r = await passe(mois(13));
    dit(!r.fait && r.arret === 'proprietaire pas su' && etat.base.utilisateurs.has(A) && !etat.deletes.length && !mails.length, 'le propriétaire « pas su » : le passage s’arrête, rien', JSON.stringify(r));
  });
  await essaie('abonnements illisibles', async () => {
    prepare(); etat.pannes.add('abonnements');
    const r = await passe(mois(13));
    dit(!r.fait && etat.base.utilisateurs.has(A) && !etat.deletes.length, 'la liste des abonnements ne se lit pas : rien', JSON.stringify(r));
  });
  await essaie('inventaire illisible', async () => {
    prepare(); etat.pannes.add('lecture-app_data');
    const r = await passe(mois(13));
    dit(etat.base.utilisateurs.has(A) && !etat.deletes.length, 'une lecture ratée (avis, inventaire) : rien n’est effacé', JSON.stringify(r.ignores));
  });
  await essaie('borné', async () => {
    prepare(); etat.base.abonnements[B] = { owner: B, statut: 'canceled', client_stripe: 'cus_B', abonnement_stripe: 'sub_B', mode_test: false };
    etat.base.subs.sub_B = { id: 'sub_B', customer: 'cus_B', status: 'canceled', ended_at: Math.floor(T0 / 1000) };
    const r = await passe(mois(13), { maxSuppressions: 1 });
    dit(r.supprimes === 1 && [A, B].filter((x) => etat.base.utilisateurs.has(x)).length === 1, 'deux comptes à supprimer, plafond 1 : un seul par passage', JSON.stringify(r.ignores));
    const r2 = await passe(mois(13, 2), { maxSuppressions: 1 });
    dit(r2.supprimes === 1 && !etat.base.utilisateurs.has(A) && !etat.base.utilisateurs.has(B), '… l’autre au passage suivant');
  });

  console.log('\n── Les factures Pro gardées, effacées après 10 ans');
  await essaie('10 ans', async () => {
    prepare(); await passe(mois(12, 1));
    const m = await import('file://' + path.join(RACINE, 'api', '_lib', 'effacer-compte.js'));
    const r9 = await m.purgerFacturesGardees({ url: 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: F.SERVICE, maintenant: Date.now() + 9 * 365 * JOUR });
    dit(r9.purges === 0 && etat.base.app_data.some((l) => l.owner === A && /^email_invoice_/.test(l.id)), 'à 9 ans : gardées');
    const r11 = await m.purgerFacturesGardees({ url: 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: F.SERVICE, maintenant: Date.now() + 11 * 365 * JOUR });
    dit(r11.purges === 1 && !etat.base.app_data.some((l) => l.owner === A) && etat.base.app_data.some((l) => l.owner === B && l.id === 'email_invoice_tx77'), 'après 10 ans : effacées (celles de B restent)', JSON.stringify(r11));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
