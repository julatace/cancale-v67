#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LOT 53/55 (13 nov.) : LE BILAN MENSUEL PAR E-MAIL ET « ÉCRIRE AU SUPPORT »
// ════════════════════════════════════════════════════════════════════════════
// Récit : docs/passation/2026-11-13-lot5355.md. Ce contrôle EXÉCUTE (§4.10) :
//   · le passage d'UN vendeur du cron du matin (`api/ship-reminders.js`,
//     `_banc.bilanDuMoisVendeur`, dans SON contexte), avec ses vraies lectures
//     (projetées, paginées) contre une fausse base à la forme PostgREST, et le
//     vrai client SMTP (`api/_lib/smtp.js`) contre un faux serveur SMTP LOCAL :
//     aucun envoi réel ;
//   · la vraie route `api/compte.js` (`?mode=bilan-mois`, `?mode=aide`).
//   B  bilan mensuel : activé par défaut pour un compte créé depuis le 13 nov.,
//      éteint pour un compte d'avant (et aucune vente lue), un choix posé gagne ;
//      date de création pas sue ⇒ rien ; une fois par vendeur et par mois ;
//      SMTP pas configuré ⇒ rien ne part et la route le dit (Réglages) ;
//      chiffres = la règle (vendu au jour de la vente, reçu au jour du
//      versement), bénéfice brut avec couverture et manque nommé, JAMAIS
//      « au moins » devant un bénéfice, « — » quand pas su ; temps gagné écrit
//      SEULEMENT s'il est mesuré ; lien vers le récap du mois lu par l'app ;
//      désinscription en un lien.
//   S  écrire au support : ce qui est RANGÉ n'a que texte · version · extension ·
//      écran · navigateur · depuis · heure (+ sceau) ; texte masqué (e-mail,
//      montant, pseudo) ; rangé chez LUI (owner = sa session) ; 5 par heure ;
//      le propriétaire seul lit (403 sinon), avec l'adresse de SON compte pour
//      répondre ; une ligne posée à la main (sans sceau) n'est pas montrée ;
//      « Traitée » s'écrit chez le propriétaire, jamais dans la ligne du vendeur.
//   W  le branchement (code sans commentaires) : Réglages → Aide, garde-fou.
//   `node scripts/audit-lot5355.cjs [--html=dossier] [--prouve]`
//   `--prouve` : ROUGE sur origin/main (git archive) et sur chaque mutation.
// Données inventées (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs'), os = require('os'), net = require('net'), cp = require('child_process');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');
const R = process.env.AUDIT_RACINE || ICI;

const MUTATIONS = {
  'défaut toujours éteint': [['api/_lib/bilan-mois.js', '  return t >= Date.parse(DEFAUT_ACTIF_DEPUIS);', '  return false;']],
  'défaut toujours allumé': [['api/_lib/bilan-mois.js', '  return t >= Date.parse(DEFAUT_ACTIF_DEPUIS);', '  return true;']],
  'date pas sue ⇒ oui': [['api/_lib/bilan-mois.js', '  if (!Number.isFinite(t)) return null;', '  if (!Number.isFinite(t)) return true;']],
  'SMTP pas vérifié': [['api/_lib/bilan-mois.js', "  if (!config || !config.pret) return 'envoi non configuré';", '']],
  'deux fois le même mois': [['api/_lib/bilan-mois.js', "  if (deja && ['envoye', 'incertain', 'en-cours'].includes(deja.issue)) return 'déjà envoyé';", '']],
  '« au moins » devant le bénéfice': [['api/_lib/bilan-mois.js', "(be.etat === 'partiel' && !(Math.abs(Number(be.brut)) > 0)) ? '—' : euros(be.brut)", "(be.etat === 'partiel' && !(Math.abs(Number(be.brut)) > 0)) ? '—' : (be.etat === 'partiel' ? 'au moins ' : '') + euros(be.brut)"]],
  'temps gagné raisonné écrit': [['api/_lib/bilan-mois.js', "g && g.nature === 'mesurée' && g.par === 'vente'", "g && g.par === 'vente'"]],
  'lien vers Compta nue': [['api/_lib/bilan-mois.js', "bouton: { mot: 'Voir le récap du mois', url: lienRecapMois(b.mois) },", "bouton: { mot: 'Voir le récap du mois', url: `${SITE}/?tab=compta` },"]],
  'cible bilanmois ignorée par l’app': [['src/cibleNotif.js', "'case', 'bilanmois'];", "'case'];"]],
  'support : un champ de plus': [['src/demandeAide.js', "    depuis: DEPUIS_AIDE.includes(c.depuis) ? c.depuis : 'reglages',\n", "    depuis: DEPUIS_AIDE.includes(c.depuis) ? c.depuis : 'reglages',\n    pseudo: c.pseudo,\n"]],
  'support : texte pas masqué': [['src/demandeAide.js', 'masquerPseudos(masquer(propre(', '((propre(']],
  'support : sceau pas vérifié': [['api/_lib/demande-aide.js', "    if (!sceauValable(owner, x.id, brut, service)) { ecartees++; continue; }\n", '']],
  'support : liste ouverte à tous': [['api/_lib/demande-aide.js', "  if (String((utilisateur && utilisateur.id) || '').toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };\n", '']],
  'support : 5/h retiré': [['api/_lib/demande-aide.js', '    if (j.length === 1) id = essai;', '    id = essai;']],
  'support : traitée chez le vendeur': [['api/_lib/demande-aide.js', '  const r = await modifierLigneCas({ url, entetes: sbCle(service), owner: p.proprio, id: ID_SUIVI,', '  const r = await modifierLigneCas({ url, entetes: sbCle(service), owner: de, id: ID_SUIVI,']],
  'garde-fou sans « Écrire au support »': [['src/composants/GardeEcran.jsx', "{GardeEcran.Support ? <GardeEcran.Support ecran={String(nom || '').split(':')[0]} taille=\"petit\"/> : null}", '']],
};

if (process.argv.includes('--prouve')) {
  // node_modules : celui du dépôt, ou d'un dossier parent (un worktree n'en a pas).
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  nm = fs.realpathSync(path.join(nm, 'node_modules'));
  const lancer = (t) => { const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 }); return { r, rouges: ((r.stdout || '').match(/^❌/gm) || []).length }; };
  const base0 = process.env.AUDIT_DEPART || 'origin/main';
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-lot5355-'));
  try {
    cp.execSync(`git -C "${ICI}" archive ${base0} api src package.json | tar -x -C "${t}"`);
    fs.symlinkSync(nm, path.join(t, 'node_modules'));
    const { r, rouges } = lancer(t);
    console.log(`${r.status && rouges ? '✅' : '❌'} sur ${base0} : ${rouges} rouge(s)`);
    for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 40)) console.log('     ' + l.slice(0, 170));
    if (!(r.status && rouges)) process.exitCode = 1;
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  // Chaque mutation dans une COPIE de l'arbre (api, src, package.json), une à la fois.
  let attrapees = 0;
  for (const [nom, edits] of Object.entries(MUTATIONS)) {
    const m = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-lot5355-mut-'));
    try {
      for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(ICI, x), path.join(m, x), { recursive: true });
      fs.symlinkSync(nm, path.join(m, 'node_modules'));
      let ancre = true;
      for (const [f, de, vers] of edits) { const p = path.join(m, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(de)) { ancre = false; break; } fs.writeFileSync(p, s.replace(de, vers)); }
      if (!ancre) { console.log(`❌ mutation « ${nom} » : ancre introuvable`); continue; }
      const { r, rouges } = lancer(m);
      const tombe = r.status !== 0 && rouges > 0;
      if (tombe) attrapees++;
      console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    } finally { fs.rmSync(m, { recursive: true, force: true }); }
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(attrapees === n ? `\n✅ ${attrapees}/${n} mutations attrapées` : `\n❌ ${n - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === n && !process.exitCode ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d) => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } };
const titre = (t) => console.log('\n── ' + t);
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const importer = (f) => import(pathToFileURL(path.join(R, f)).href);
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const { sansCommentaires } = require(path.join(ICI, 'scripts', '_mutations-audit.cjs'));

// ── LES PERSONNES (inventées) ───────────────────────────────────────────────
const JULIEN = '11111111-1111-4111-8111-111111111111';     // le propriétaire de l'installation
const NEUF = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';       // compte créé le 20 nov. 2026
const ANCIEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';     // compte créé le 1er oct. 2026
const FLOU = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';       // date de création illisible
const users = new Map([
  [JULIEN, { email: 'proprio@exemple.test', email_confirmed_at: '2026-07-01T10:00:00Z', created_at: '2026-07-01T10:00:00Z' }],
  [NEUF, { email: 'neuf.vendeur@exemple.test', email_confirmed_at: '2026-11-20T10:00:00Z', created_at: '2026-11-20T10:00:00Z' }],
  [ANCIEN, { email: 'ancien.vendeur@exemple.test', email_confirmed_at: '2026-10-01T10:00:00Z', created_at: '2026-10-01T10:00:00Z' }],
  [FLOU, { email: 'flou.vendeur@exemple.test', email_confirmed_at: '2026-11-20T10:00:00Z', created_at: 'pas une date' }],
]);
const sessions = new Map([['a.b.julien', JULIEN], ['a.b.neuf', NEUF], ['a.b.ancien', ANCIEN]]);   // jetons à trois morceaux (api/_lib/session.js)

// ── LA FAUSSE BASE (forme PostgREST) ────────────────────────────────────────
const base = new Map();                 // owner|id → data
const k = (o, i) => `${o}|${i}`;
let appels = [];
let panne = null;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const iso = (s) => new Date(s).toISOString();
// Novembre 2026 : deux ventes finalisées (80 € le 3, 120 € le 25), une remboursée,
// une d'octobre ; versements : la vente du 3 versée le 6 nov., celle du 25 versée le 2 déc.
const ORDERS = [
  { transaction_id: 7001, title: 'Article inventé un', status: 'Commande finalisée', date: iso('2026-11-03T12:00:00+01:00'), price: { amount: '80.0' } },
  { transaction_id: 7002, title: 'Article inventé deux', status: 'Commande finalisée', date: iso('2026-11-25T12:00:00+01:00'), price: { amount: '120.0' } },
  { transaction_id: 7003, title: 'Remboursé', status: 'Remboursement effectué', date: iso('2026-11-10T12:00:00+01:00'), price: { amount: '999' } },
  { transaction_id: 7000, title: 'Octobre', status: 'Commande finalisée', date: iso('2026-10-20T12:00:00+02:00'), price: { amount: '40' } },
];
const TXN = [
  { tx: '7001', s: '450', su: iso('2026-11-06T10:00:00+01:00'), it: '9001' },
  { tx: '7002', s: '450', su: iso('2026-12-02T10:00:00+01:00'), it: '9002' },
  { tx: '7000', s: '450', su: iso('2026-11-02T10:00:00+01:00'), it: '9000' },
];
let lecturesVentes = 0;
function donneesVendeur(owner) {
  base.set(k(owner, '__comptes'), [{ vinted_user_id: '501', login: 'compte_invente' }]);
  base.set(k(owner, '__orders'), [{ id: 'harvest_501_orders_sold', orders: ORDERS, txns: null, cap: iso('2026-12-01T05:00:00+01:00') }]);
  base.set(k(owner, '__txn'), TXN);
}
const ownerDe = (q) => (q.get('owner') || '').replace(/^eq\./, '');
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const q = u.searchParams, p = u.pathname, methode = (o.method || 'GET').toUpperCase();
  appels.push({ url: String(url), methode });
  if (panne) { const x = panne(String(url), o); if (x) return x; }
  const h = o.headers || {};
  const jeton = String(h.Authorization || h.authorization || '').replace(/^Bearer /, '');
  if (p.endsWith('/auth/v1/user')) { const id = sessions.get(jeton); return id ? rep({ id, ...users.get(id) }) : rep({ message: 'jwt' }, 401); }
  const adm = /\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/.exec(p);
  if (adm) { const x = users.get(adm[1]); return x ? rep({ id: adm[1], ...x }) : rep({ message: 'not found' }, 404); }
  if (p.endsWith('/rest/v1/vrm_reglages')) return rep((q.get('cle') || '') === 'eq.proprietaire' ? [{ valeur: JULIEN }] : []);
  if (p.endsWith('/rest/v1/rpc/vrm_acces')) return rep({ obligatoire: false, proprietaire: sessions.get(jeton) === JULIEN, acces: true });
  const owner = ownerDe(q);
  if (p.endsWith('/rest/v1/vinted_accounts')) return rep(base.get(k(owner, '__comptes')) || []);
  if (!p.endsWith('/rest/v1/app_data')) return rep([]);
  const id = (q.get('id') || '');
  const sel = q.get('select') || '';
  if (methode === 'GET') {
    if (id === 'like.harvest_%_orders_sold') { lecturesVentes++; return rep(base.get(k(owner, '__orders')) || []); }
    if (id === 'like.harvest_%_txn_%') { lecturesVentes++; return rep(base.get(k(owner, '__txn')) || []); }
    // Les demandes d'aide de TOUS les vendeurs (projetées, le propriétaire).
    if (id === 'like.demande_aide_*' && !owner) {
      const out = [];
      for (const [cle, d] of base) {
        const [o2, i2] = cle.split('|');
        if (!i2.startsWith('demande_aide_')) continue;
        const ligne = { owner: o2, id: i2 };
        for (const s of sel.split(',')) { const m = /^(\w+):data->>(\w+)$/.exec(s); if (m) ligne[m[1]] = d[m[2]] == null ? null : String(d[m[2]]); else if (s !== 'owner' && s !== 'id') throw new Error('select inconnu du banc : ' + s); }
        out.push(ligne);
      }
      out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return rep(out);
    }
    if (id.startsWith('like.')) return rep([]);
    const i = id.replace(/^eq\./, '');
    const d = base.get(k(owner, i));
    if (d === undefined) return rep([]);
    if (sel === 'data' || sel === '') return rep([{ data: JSON.parse(JSON.stringify(d)) }]);
    // Projection `cle:data->cle`.
    const ligne = {};
    for (const s of sel.split(',')) { const m = /^(\w+):data->(\w+)$/.exec(s); if (m) ligne[m[1]] = d[m[2]] === undefined ? null : d[m[2]]; }
    return rep([ligne]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    const prefer = String(h.Prefer || '');
    const out = [];
    for (const l of lignes) {
      const c = k(l.owner, l.id);
      if (base.has(c) && /ignore-duplicates/.test(prefer)) continue;
      if (base.has(c) && !/merge-duplicates/.test(prefer)) return rep({ code: '23505' }, 409);
      base.set(c, JSON.parse(JSON.stringify(l.data)));
      out.push({ id: l.id });
    }
    return rep(/return=representation/.test(prefer) ? out : '', 201);
  }
  if (methode === 'PATCH') {
    const i = id.replace(/^eq\./, '');
    const d = base.get(k(owner, i));
    if (d === undefined) return rep([]);
    const cond = q.get('data->>rev');
    const lu = d && d.rev != null ? String(d.rev) : null;
    if (cond != null && (cond === 'is.null' ? lu !== null : cond !== 'eq.' + lu)) return rep([]);
    base.set(k(owner, i), JSON.parse(o.body).data);
    return rep([{ id: i }]);
  }
  return rep([]);
};
const faireRes = () => { const x = { code: null, corps: null, entetes: {} }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = (a, b) => { x.entetes[a] = b; }; x.end = () => x; return x; };

// ── LE FAUX SERVEUR SMTP (local, aucun envoi réel) ──────────────────────────
const recus = [];
const serveur = net.createServer((s) => {
  let data = false, buf = '', rcpt = '';
  s.write('220 banc ESMTP\r\n');
  s.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const l = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) { if (l === '.') { data = false; recus.push({ a: rcpt, brut: s._msg.join('\r\n') }); s.write('250 OK\r\n'); } else s._msg.push(l); continue; }
      if (/^EHLO/i.test(l)) s.write('250-banc\r\n250 AUTH PLAIN LOGIN\r\n');
      else if (/^AUTH/i.test(l)) s.write('235 ok\r\n');
      else if (/^RCPT TO:<(.*)>/i.test(l)) { rcpt = /^RCPT TO:<(.*)>/i.exec(l)[1]; s.write('250 ok\r\n'); }
      else if (/^DATA/i.test(l)) { data = true; s._msg = []; s.write('354 go\r\n'); }
      else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
      else s.write('250 ok\r\n');
    }
  });
  s.on('error', () => {});
});
const morceau = (brut, type) => {
  const m = new RegExp(`Content-Type: ${type.replace('/', '\\/')}; charset=UTF-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`).exec(brut);
  return m ? Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8') : '';
};
const decoder = (brut) => {
  const [tete] = brut.split('\r\n\r\n');
  const sujet = /^Subject: (.*)$/m.exec(tete);
  const dec = (x) => String(x || '').replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  return { tete, sujet: sujet ? dec(sujet[1]) : '', texte: morceau(brut, 'text/plain'), html: morceau(brut, 'text/html') };
};
const CONFIG = { RELANCES_SMTP_HOTE: 'smtp.exemple.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'banc', RELANCES_SMTP_MOT_DE_PASSE: 'mdp-banc', RELANCES_EXPEDITEUR: 'bonjour@vrm.exemple.test' };
const configurer = (on) => { for (const [a, b] of Object.entries(CONFIG)) { if (on) process.env[a] = b; else delete process.env[a]; } };

let fini = false;
process.on('exit', () => { if (!fini) { console.log('❌ audit-lot5355 : arrêté avant la fin'); process.exitCode = 1; } });
(async () => {
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const port = serveur.address().port;
  process.env.SUPABASE_URL = 'https://base-de-banc.invalid';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
  process.env.CRON_SECRET = 'cron-banc';
  delete process.env.VRM_OWNER_UID;
  delete process.env.VAPID_PRIVATE_KEY;
  configurer(true);
  let smtp, cron, owner, compte, BM, cible, regleAide;
  try { smtp = await importer('api/_lib/smtp.js'); smtp._banc.connecter = () => new Promise((a, b) => { const s = net.connect({ host: '127.0.0.1', port }, () => a(s)); s.once('error', b); }); } catch (e) { dit(false, 'api/_lib/smtp.js se charge', e.message); }
  try { cron = await importer('api/ship-reminders.js'); } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { owner = await importer('api/_lib/owner.js'); } catch (e) { dit(false, 'api/_lib/owner.js se charge', e.message); }
  try { compte = await importer('api/compte.js'); } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  try { BM = await importer('api/_lib/bilan-mois.js'); } catch (e) { dit(false, 'api/_lib/bilan-mois.js se charge', e.message); }
  try { cible = await importer('src/cibleNotif.js'); } catch (e) { dit(false, 'src/cibleNotif.js se charge', e.message); }
  try { regleAide = await importer('src/demandeAide.js'); } catch (e) { dit(false, 'src/demandeAide.js (la règle du support) se charge', e.message); }
  const passage = async (o, t, reste = 5) => {
    const f = cron && cron._banc && cron._banc.bilanDuMoisVendeur;
    if (typeof f !== 'function') throw new Error('_banc.bilanDuMoisVendeur absent');
    return owner.contexteVendeur.run({ owner: o, compteurBilan: { reste } }, () => f(t));
  };
  const LE_1ER = Date.parse('2026-12-01T07:30:00+01:00');
  // La publication de Ventes (`vrm_benefice_jours`, v2) est fabriquée par la RÈGLE de
  // l'app recopiée côté serveur (api/_lib/benefice-regle.js, tenue par audit-bilan-mois).
  let BR = null;
  try { BR = await importer('api/_lib/benefice-regle.js'); } catch (e) { dit(false, 'api/_lib/benefice-regle.js se charge', e.message); }
  const pubDe = (ventes) => {
    const jours = {};
    for (const [ts, eur, achat] of ventes) {
      const kj = BR.jourClef(new Date(ts));
      const acc = BR.beneficeVide(); acc.n = 1; acc.ca = Math.round(eur * 100);
      if (achat != null) { acc.nCout = 1; acc.cout = Math.round(achat * 100); acc.caCouvert = acc.ca; }
      jours[kj] = jours[kj] ? BR.cumulerBenefice(BR.cumulerBenefice(BR.beneficeVide(), jours[kj]), acc) : acc;
    }
    const tab = {}; for (const [kj, b] of Object.entries(jours)) tab[kj] = BR.BENEF_CHAMPS.map((c) => b[c] || 0);
    return { v: 2, jours: tab, at: Date.parse('2026-12-01T06:00:00+01:00') };
  };

  titre('B — le bilan mensuel par e-mail (le passage du cron, envoi simulé)');
  let mailNeuf = null;
  await essaie('B1', async () => {
    base.clear(); recus.length = 0; donneesVendeur(NEUF);
    base.set(k(NEUF, 'main'), { vrm_benefice_jours: pubDe([['2026-11-03T12:00:00Z', 80, 30], ['2026-11-25T12:00:00Z', 120, null]]) });
    const r = await passage(NEUF, LE_1ER);
    dit(r && r.issue === 'envoye' && recus.length === 1 && recus[0].a === 'neuf.vendeur@exemple.test', 'B1 compte créé le 20 nov., rien choisi ⇒ le bilan PART (activé par défaut), à l’adresse de SON compte', { r, recus: recus.map((x) => x.a) });
    dit(r && r.parDefaut === true, 'B1 … et le cron le dit « par défaut »', r);
    mailNeuf = recus[0] ? decoder(recus[0].brut) : null;
  });
  await essaie('B2', async () => {
    const m = mailNeuf || { texte: '', html: '', sujet: '', tete: '' };
    dit(/bilan de novembre 2026/.test(m.sujet), 'B2 sujet « Ton bilan de novembre 2026 »', m.sujet);
    dit(/Ventes : 2\b/.test(m.texte), 'B2 Ventes : 2 (la remboursée et celle d’octobre n’y sont pas)', m.texte.slice(0, 400));
    dit(m.texte.includes('Vendu : ' + BM.euros(200)) && !/Vendu : au moins/.test(m.texte), 'B2 Vendu : 200,00 € (au jour de la vente), complet ⇒ sans « au moins »');
    dit(m.texte.includes('Reçu : ' + BM.euros(120)), 'B2 Reçu : 120,00 € = AU JOUR DU VERSEMENT (80 € versés le 6 nov. + 40 € d’octobre versés le 2 nov. ; les 120 € versés le 2 déc. n’y sont pas)');
    const ligneB = (m.texte.split('\n').find((l) => /^Bénéfice brut/.test(l)) || '');
    dit(ligneB.startsWith('Bénéfice brut : ' + BM.euros(50)) && /sur 1 vente de 2/.test(ligneB) && /1 prix d’achat manque/.test(ligneB), 'B2 Bénéfice brut : 50,00 € — sa couverture « sur 1 vente de 2 » et le manque NOMMÉ « 1 prix d’achat manque »', ligneB);
    dit(!/au moins/i.test(ligneB) && !/Bénéfice[^\n]*au moins/i.test(m.html.replace(/<[^>]+>/g, ' ')), 'B2 JAMAIS « au moins » devant un bénéfice (src/beneficeNoms.js), ni dans le texte ni dans le HTML', ligneB);
    dit(/ce n’est pas un minimum/.test(m.texte), 'B2 la phrase dit pourquoi ce n’est pas un minimum');
    dit(!/Temps gagné/i.test(m.texte) && !/Temps gagn/i.test(m.html), 'B2 temps gagné : aucune durée MESURÉE dans la règle ⇒ la ligne n’est pas écrite');
    const lien = (/(https:\/\/vrm\.center\/\?tab=compta[^\s)>"]*)/.exec(m.texte) || [])[1] || '';
    dit(lien === 'https://vrm.center/?tab=compta&cible=bilanmois&mois=2026-11', 'B2 le bouton mène au récap de CE mois dans l’app', lien);
    const c = cible && lien ? cible.lireCible(new URL(lien).searchParams) : null;
    dit(c && c.type === 'bilanmois' && c.mois === '2026-11', 'B2 … et l’app lit cette adresse (src/cibleNotif.js : cible bilanmois, mois 2026-11)', c);
    const sel = c ? cible.selecteursCible(c).essais : [];
    dit(sel.some((x) => x.includes('data-cible~="bilanmois:2026-11"')), 'B2 … qui vise la carte « Bilan du mois » de CE mois (`data-cible`)', sel);
    dit(/List-Unsubscribe: <https:\/\/vrm\.center\/api\/compte\?mode=bilan-mois&d=/.test(m.tete) && /List-Unsubscribe-Post: List-Unsubscribe=One-Click/.test(m.tete), 'B2 désinscription en un lien (List-Unsubscribe One-Click)');
    dit(/parce qu’il est activé dans VRM/.test(m.texte), 'B2 le pied dit pourquoi il le reçoit (activé par défaut) et où le couper');
    dit(!/encaiss/i.test(m.texte) && !/compte_invente|neuf\.vendeur/.test(m.texte), 'B2 jamais « encaissé », aucun pseudo ni adresse dans le texte');
    const dossier = (process.argv.find((a) => a.startsWith('--html=')) || '').slice(7);
    if (dossier && m.html) { fs.mkdirSync(dossier, { recursive: true }); fs.writeFileSync(path.join(dossier, 'bilan-mensuel.html'), m.html); console.log('   (HTML écrit : ' + path.join(dossier, 'bilan-mensuel.html') + ')'); }
  });
  await essaie('B3', async () => {
    recus.length = 0;
    const r = await passage(NEUF, LE_1ER + 86400e3);
    dit(r === 'déjà envoyé' && recus.length === 0, 'B3 le lendemain : rien (une fois par vendeur et par mois)', r);
  });
  await essaie('B4', async () => {
    base.clear(); recus.length = 0; donneesVendeur(ANCIEN); lecturesVentes = 0;
    const r = await passage(ANCIEN, LE_1ER);
    dit(r === 'éteint' && recus.length === 0, 'B4 compte d’AVANT le 13 nov., rien choisi ⇒ éteint, rien ne part', r);
    dit(lecturesVentes === 0, 'B4 … et aucune vente n’est lue', lecturesVentes);
    base.set(k(ANCIEN, 'bilan_mois_choix'), { actif: true, at: '2026-11-15T10:00:00Z' });
    const r2 = await passage(ANCIEN, LE_1ER);
    dit(r2 && r2.issue === 'envoye' && recus.length === 1 && !r2.parDefaut, 'B4 le même, qui l’a ACTIVÉ ⇒ il part (un choix posé gagne)', r2);
    const t2 = recus[0] ? decoder(recus[0].brut).texte : '';
    dit(/Bénéfice brut : — \(pas encore calculé/.test(t2), 'B4 publication du bénéfice absente ⇒ « Bénéfice brut : — » et la raison, jamais 0', t2.split('\n').find((l) => /Bénéfice/.test(l)));
  });
  await essaie('B5', async () => {
    base.clear(); recus.length = 0; donneesVendeur(NEUF);
    base.set(k(NEUF, 'bilan_mois_choix'), { actif: false, at: '2026-11-21T10:00:00Z' });
    const r = await passage(NEUF, LE_1ER);
    dit(r === 'éteint' && recus.length === 0, 'B5 compte neuf qui l’a COUPÉ ⇒ rien', r);
    base.clear(); donneesVendeur(FLOU);
    const r2 = await passage(FLOU, LE_1ER);
    dit(r2 === 'défaut pas su — rien' && recus.length === 0, 'B5 date de création illisible ⇒ rien (« pas su » ne vaut pas « oui »)', r2);
  });
  await essaie('B6', async () => {
    base.clear(); recus.length = 0; donneesVendeur(NEUF); configurer(false);
    const r = await passage(NEUF, LE_1ER);
    dit(r === 'envoi non configuré' && recus.length === 0, 'B6 SMTP pas configuré (RELANCES_SMTP_*) ⇒ RIEN ne part', r);
    const res = faireRes();
    await compte.default({ method: 'GET', query: { mode: 'bilan-mois' }, headers: { authorization: 'Bearer a.b.neuf' } }, res);
    dit(res.code === 200 && res.corps && res.corps.configure === false && res.corps.actif === true && res.corps.defaut === true, 'B6 … et la route de Réglages le dit (configure:false), compte neuf activé par défaut', res.corps);
    const res2 = faireRes();
    await compte.default({ method: 'GET', query: { mode: 'bilan-mois' }, headers: { authorization: 'Bearer a.b.ancien' } }, res2);
    dit(res2.corps && res2.corps.actif === false && res2.corps.defaut === true, 'B6 compte d’avant : éteint par défaut (la MÊME règle que le cron)', res2.corps);
    configurer(true);
  });
  await essaie('B7', async () => {
    base.clear(); recus.length = 0; donneesVendeur(NEUF);
    const lien = BM.lienBilan(NEUF, process.env.SUPABASE_SERVICE_KEY);
    const d = new URL(lien).searchParams.get('d');
    const res = faireRes();
    await compte.default({ method: 'POST', query: { mode: 'bilan-mois', d }, headers: {}, body: 'List-Unsubscribe=One-Click' }, res);
    dit(res.code === 200 && base.get(k(NEUF, 'bilan_mois_choix')) && base.get(k(NEUF, 'bilan_mois_choix')).actif === false, 'B7 le « un clic » de la messagerie coupe le bilan de CE compte', res.code);
    const r = await passage(NEUF, LE_1ER);
    dit(r === 'éteint' && recus.length === 0, 'B7 … et le mois suivant rien ne part', r);
  });
  await essaie('B8', async () => {
    // Le temps gagné, SEULEMENT mesuré : la règle exécutée sur un geste mesuré.
    const G = [{ id: 'bordereaux', par: 'vente', sans: 120, avec: 20, nature: 'mesurée' }, { id: 'numeros', par: 'vente', sans: 60, avec: 10, nature: 'raisonnée' }];
    const t = BM.tempsGagneMesure({ etat: 'su', n: 12 }, G);
    dit(t && t.minutes === 20 && t.gestes.join() === 'bordereaux', 'B8 un geste MESURÉ (100 s × 12 ventes) ⇒ ≈ 20 min, le geste raisonné n’est pas compté', t);
    dit(BM.tempsGagneMesure({ etat: 'partiel', n: 12 }, G) === null, 'B8 ventes pas toutes lues ⇒ pas de temps gagné');
    dit(BM.tempsGagneMesure({ etat: 'su', n: 12 }) === null, 'B8 la règle d’aujourd’hui (toutes raisonnées) ⇒ pas de temps gagné');
    const b = { mois: '2026-11', libelle: 'novembre 2026', vendu: { etat: 'su', n: 12, eur: 500, manque: [] }, recu: { etat: 'su', eur: 400, manque: [] }, benefice: { etat: 'pas-su', raison: 'x' }, meilleure: null, temps: t };
    const txt = BM.texteBilanMois(b, { lien: 'https://vrm.center/x' }).texte;
    dit(/Temps gagné : ≈ 20 min \(mesuré, sur 12 ventes\)/.test(txt), 'B8 … et l’e-mail l’écrit alors « Temps gagné : ≈ 20 min (mesuré, sur 12 ventes) »', txt.split('\n').find((l) => /Temps/.test(l)));
  });

  titre('S — « Écrire au support » (la vraie route `?mode=aide`)');
  const poster = async (jeton, corps) => { const res = faireRes(); await compte.default({ method: 'POST', query: { mode: 'aide' }, headers: { authorization: 'Bearer ' + jeton }, body: corps }, res); return res; };
  const lister = async (jeton) => { const res = faireRes(); await compte.default({ method: 'GET', query: { mode: 'aide' }, headers: { authorization: 'Bearer ' + jeton } }, res); return res; };
  const CORPS = {
    texte: 'Bonjour, ma vente à 87,50 € pour marie_dupont (acheteuse.x@exemple.test) n’apparaît pas, lea75 aussi', version: '13 novembre à 10:30', extension: '5.380.0', ecran: 'ventes', navigateur: 'Chrome', depuis: 'reglages',
    pseudo: 'compte_invente', montant: 87.5, email: 'acheteuse.x@exemple.test', plan: { l: 10, h: 10, b: [[0, 0, 5, 5, 0]] }, plantages: [{ message: 'x' }], lectures: [{ m: 'GET', quoi: 'base' }], ecranTaille: { largeur: 390, hauteur: 844 },
  };
  let idNeuf = null;
  await essaie('S1', async () => {
    base.clear();
    const t0 = Date.now();
    const res = await poster('a.b.neuf', CORPS);
    idNeuf = res.corps && res.corps.id;
    dit(res.code === 200 && res.corps.ok === true && /^demande_aide_\d{10}_1$/.test(String(idNeuf)), 'S1 envoyée : 200, l’id rangé rendu (l’app ne dit « Reçu » que sur lui)', res.corps);
    const ligne = base.get(k(NEUF, idNeuf));
    dit(!!ligne, 'S1 rangée chez LUI (owner = sa session), pas chez le propriétaire', [...base.keys()]);
    const cles = ligne ? Object.keys(ligne).sort().join(',') : '';
    dit(cles === ['at', 'depuis', 'ecran', 'extension', 'navigateur', 'sceau', 'texte', 'version'].sort().join(','), 'S1 la ligne n’a QUE texte, version, extension, écran, navigateur, depuis, heure (+ sceau) — ni pseudo, ni montant, ni e-mail, ni capture, ni plantage', cles);
    dit(ligne && ligne.version === '13 novembre à 10:30' && ligne.extension === '5.380.0' && ligne.ecran === 'ventes' && ligne.navigateur === 'Chrome', 'S1 les cinq faits techniques sont ceux de l’app', ligne);
    dit(ligne && Math.abs(Date.parse(ligne.at) - t0) < 60000, 'S1 l’heure est posée par le SERVEUR', ligne && ligne.at);
    dit(ligne && !/87,50|marie_dupont|acheteuse|lea75/.test(ligne.texte) && /\{montant\}/.test(ligne.texte) && /\{email\}/.test(ligne.texte) && /\{pseudo\}/.test(ligne.texte), 'S1 le texte tapé est masqué (montant, e-mail, pseudos)', ligne && ligne.texte);
    const apercu = regleAide.normaliserDemandeAide(CORPS);
    const { at, sceau, ...range } = ligne || {};
    dit(JSON.stringify(apercu) === JSON.stringify(range), 'S1 l’aperçu de l’app (la même règle) EST ce qui est rangé', { apercu, range });
    dit(/ni pseudo, ni montant, ni e-mail d’acheteur/.test(regleAide.PHRASE_RIEN_DAUTRE) && regleAide.ACCUSE_AIDE === 'Reçu, réponse par e-mail.', 'S1 la feuille le dit, et l’accusé est « Reçu, réponse par e-mail. »');
  });
  await essaie('S2', async () => {
    const codes = [];
    for (let n = 0; n < 5; n++) codes.push((await poster('a.b.neuf', { texte: 'Encore une question ' + n, ecran: 'colis' })).code);
    const n = [...base.keys()].filter((x) => x.startsWith(NEUF + '|demande_aide_')).length;
    dit(codes.slice(0, 4).every((c) => c === 200) && codes[4] === 429 && n === 5, 'S2 5 demandes par heure au plus : la 6e ⇒ 429, rien d’écrit', { codes, n });
  });
  await essaie('S3', async () => {
    // Une ligne posée à la main par un vendeur (RLS le permet) : sans sceau valable.
    base.set(k(ANCIEN, 'demande_aide_2026111309_1'), { texte: 'fausse demande', version: '', extension: null, ecran: '', navigateur: 'Chrome', depuis: 'reglages', at: new Date().toISOString(), sceau: 'x'.repeat(32) });
    const vendeur = await lister('a.b.neuf');
    dit(vendeur.code === 403, 'S3 un vendeur ne lit pas les demandes : 403', vendeur.code);
    const res = await lister('a.b.julien');
    const L = (res.corps && res.corps.demandes) || [];
    const a = L.find((x) => x.id === idNeuf);
    dit(res.code === 200 && L.length === 5 && !!a, 'S3 le propriétaire lit les 5 demandes scellées', { code: res.code, n: L.length });
    dit(a && a.repondre === 'neuf.vendeur@exemple.test' && a.de === NEUF && a.traitee === false, 'S3 … avec l’adresse de SON compte pour répondre (lue chez Supabase Auth, pas rangée)', a);
    dit(!L.some((x) => x.texte === 'fausse demande') && res.corps.ecartees === 1, 'S3 la ligne sans sceau n’est pas montrée (et le nombre écarté est dit)', res.corps && res.corps.ecartees);
  });
  await essaie('S4', async () => {
    const res = faireRes();
    await compte.default({ method: 'POST', query: { mode: 'aide' }, headers: { authorization: 'Bearer a.b.julien' }, body: { action: 'traitee', de: NEUF, id: idNeuf, traitee: true } }, res);
    const suivi = base.get(k(JULIEN, 'demandes_aide_suivi'));
    dit(res.code === 200 && suivi && suivi.traitees && suivi.traitees[`${NEUF}:${idNeuf}`], 'S4 « Traitée » s’écrit chez le PROPRIÉTAIRE (demandes_aide_suivi)', { code: res.code, suivi });
    const ligne = base.get(k(NEUF, idNeuf));
    dit(ligne && !('traitee' in ligne) && !base.has(k(NEUF, 'demandes_aide_suivi')), 'S4 … jamais dans les lignes du vendeur', ligne);
    const L = ((await lister('a.b.julien')).corps || {}).demandes || [];
    dit((L.find((x) => x.id === idNeuf) || {}).traitee === true, 'S4 la liste la dit traitée');
    const res2 = faireRes();
    await compte.default({ method: 'POST', query: { mode: 'aide' }, headers: { authorization: 'Bearer a.b.neuf' }, body: { action: 'traitee', de: NEUF, id: idNeuf } }, res2);
    dit(res2.code === 403, 'S4 un vendeur ne marque rien : 403', res2.code);
  });
  await essaie('S5', async () => {
    const service = process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
    const res = await poster('a.b.neuf', { texte: 'question sans serveur' });
    process.env.SUPABASE_SERVICE_KEY = service;
    dit(res.code === 503 && res.corps.raison === 'non-configure', 'S5 serveur sans clé de service ⇒ 503 « pas configuré », jamais « reçu »', res.corps);
    const vide = await poster('a.b.ancien', { texte: ' ' });
    dit(vide.code === 400, 'S5 texte vide ⇒ 400', vide.code);
  });

  titre('W — le branchement (code sans commentaires)');
  await essaie('W', async () => {
    const reg = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
    dit(/id:'support'[^\n]*onClick:\(\)=>setSupport\(true\)/.test(reg) && /<EcrireSupportFeuille depuis="reglages"/.test(reg), 'W Réglages → Aide → « Écrire au support » ouvre la feuille');
    dit(/proprioInst && \{ id:'demandes-aide'[^\n]*<DemandesAideRecues/.test(reg), 'W « Demandes d’aide » : l’entrée du PROPRIÉTAIRE seul');
    dit(/Bilan mensuel par e-mail/.test(reg) && /aucun bilan ne part/.test(reg), 'W Réglages → Notifications : « Bilan mensuel par e-mail », et dit quand l’envoi n’est pas configuré');
    const g = sansCommentaires(lire('src/composants/GardeEcran.jsx'));
    dit(/GardeEcran\.Support \? <GardeEcran\.Support/.test(g), 'W le garde-fou d’un écran tombé porte « Écrire au support »');
    const app = sansCommentaires(lire('src/App.jsx'));
    dit(/GardeEcran\.Support = EcrireSupport;/.test(app) && /contexteSupport = \(ecran\) =>/.test(app), 'W l’app pose le relais (contexte : version, extension, écran, navigateur)');
    const ctx = (/const contexteSupport = \(ecran\) => \{[\s\S]*?\n\};/.exec(app) || [''])[0];
    dit(ctx && !/plantages|lectures|instantaneEcran|ecranTaille/.test(ctx), 'W … et rien d’autre (ni plantages, ni requêtes, ni capture, ni taille)', ctx.slice(0, 300));
    const cpt = sansCommentaires(lire('api/compte.js'));
    dit(/if \(mode === 'aide'\)/.test(cpt), 'W la route `?mode=aide` est dans api/compte.js (aucune fonction api/ de plus)');
    const fonctions = fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js'));
    dit(fonctions.length <= 12, `W ${fonctions.length} fonctions api/ (12 au plus)`, fonctions);
  });

  fini = true;
  serveur.close();
  console.log(`\n${ko ? '❌' : '✅'} audit-lot5355 : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ planté : ' + String((e && e.stack) || e).slice(0, 600)); fini = true; process.exit(1); });
