#!/usr/bin/env node
// Audit du 5 nov. — le récapitulatif au réveil de ce qui est arrivé pendant les
// heures calmes (api/_lib/reveil-calme.js, `api/ship-reminders.js?moment=reveil`).
// 1. La RÈGLE, exécutée : fenêtre après la fin des heures calmes, un seul par
//    jour, seules les entrées `calme` NON LUES des dernières 24 h, « pas su » ⇒
//    rien, les accords (« 1 vente », « 2 colis à poster »).
// 2. La ROUTE, exécutée avec une fausse base (vraie forme : `select=data`,
//    filtre `owner=eq.`, pagination `Range`) : le mémo du jour est écrit AVANT
//    l'envoi, un second appel le même jour ne renvoie rien, mémo pas écrit ⇒
//    rien ne part.
// Données inventées (le dépôt est public). Mutation : `--muter` (le mémo du jour
// ignoré) doit finir en rouge.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const R = path.join(__dirname, '..');
const MUTER = process.argv.includes('--muter');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };

const O = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hhmm = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));

(async () => {
  let racine = R;
  if (MUTER) {
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'reveil-'));
    fs.cpSync(path.join(R, 'api'), path.join(racine, 'api'), { recursive: true });
    fs.cpSync(path.join(R, 'src'), path.join(racine, 'src'), { recursive: true });
    fs.writeFileSync(path.join(racine, 'package.json'), '{"type":"module"}');
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(racine, 'node_modules')); } catch (_) {}
    const f = path.join(racine, 'api/_lib/reveil-calme.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("if (dejaJour === jour) return { envoyer: false, raison: 'deja' };", ''));
  }
  const { resumeReveil, jourParis } = await import('file://' + path.join(racine, 'api/_lib/reveil-calme.js'));
  const H = 3600e3;
  const t0 = Date.parse('2026-11-06T07:20:00Z'); // 8 h 20 à Paris
  const prefs = { calme: { actif: true, debut: '22:00', fin: '08:00' } };
  const e = (seq, famille, heuresAvant, etat = 'calme') => ({ seq, famille, cat: famille, at: new Date(t0 - heuresAvant * H).toISOString(), etat, titre: 't', texte: '', url: '/' });
  const journal = { n: 9, entrees: [e(1, 'ventes', 9), e(2, 'ventes', 8), e(3, 'offres', 7), e(4, 'poster', 6), e(5, 'poster', 5), e(6, 'ventes', 30), e(7, 'messages', 3, 'envoyee'), e(8, 'arrives', 2), e(9, 'doublevente', 1)] };

  console.log('1. La règle');
  {
    const r = resumeReveil({ prefs, journal, lu: { luJusqua: 0, lus: [8] }, dejaJour: null, maintenant: t0 });
    dit(r.envoyer && r.n === 6, `6 notifications comptées (calme, < 24 h, non lues) — ${r.n}`, JSON.stringify(r));
    dit(r.body === '2 ventes · 1 offre · 2 colis à poster · 1 double vente', `le texte accorde chaque type : « ${r.body} »`);
    dit(/cloche=1/.test(r.url || ''), 'elle ouvre la cloche');
    dit(!resumeReveil({ prefs, journal, lu: {}, dejaJour: jourParis(t0), maintenant: t0 }).envoyer, 'une seule fois par jour');
    dit(resumeReveil({ prefs, journal, lu: {}, dejaJour: null, maintenant: t0 - 2 * H }).raison === 'pas-l-heure', 'pendant les heures calmes : rien');
    dit(resumeReveil({ prefs, journal, lu: {}, dejaJour: null, maintenant: t0 + 4 * H }).raison === 'pas-l-heure', 'plus de 3 h après la fin : rien');
    dit(resumeReveil({ prefs, journal, lu: null, dejaJour: null, maintenant: t0 }).raison === 'pas-su', 'ce qu\'il a lu illisible : rien (pas su)');
    dit(resumeReveil({ prefs: { calme: { actif: false } }, journal, lu: {}, dejaJour: null, maintenant: t0 }).raison === 'calme-eteint', 'heures calmes coupées à la main : rien (8 nov. : allumées par défaut)');
    dit(resumeReveil({ prefs, journal, lu: { luJusqua: 9 }, dejaJour: null, maintenant: t0 }).raison === 'rien', 'tout déjà lu : rien');
  }

  console.log('2. La route ?moment=reveil');
  process.env.CRON_SECRET = 'secret-banc'; process.env.SUPABASE_SERVICE_KEY = 'service-banc';
  delete process.env.VAPID_PRIVATE_KEY;
  const maintenant = Date.now();
  // (11 nov.) La route lit l'horloge des notifications : ce banc juge les heures calmes, il pose l'heure lui-même.
  process.env.VRM_NOTIF_HORLOGE = new Date(maintenant).toISOString();
  const prefsRoute = { calme: { actif: true, debut: hhmm(maintenant - 10 * H), fin: hhmm(maintenant - 20 * 60e3) } };
  const journalRoute = { n: 2, entrees: [{ seq: 1, famille: 'ventes', cat: 'vente', at: new Date(maintenant - 2 * H).toISOString(), etat: 'calme', titre: 'Vendu', texte: '', url: '/' }, { seq: 2, famille: 'offres', cat: 'offre', at: new Date(maintenant - H).toISOString(), etat: 'calme', titre: 'Offre', texte: '', url: '/' }] };
  let memo = null, ecritures = 0, lecturesSubs = 0, panneMemo = false, envois = 0;
  const rep = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url)), m = (o.method || 'GET').toUpperCase();
    if (/\/rpc\/vrm_acces_pour/.test(u)) { envois++; return rep(true); } // seul l'envoi demande l'accès du vendeur
    if (!/\/rest\/v1\/app_data/.test(u)) return rep([]);
    if (m === 'POST') {
      const l = JSON.parse(o.body)[0];
      if (l.id === 'push_reveil') { if (panneMemo) return rep({ message: 'panne' }, 503); ecritures++; memo = l.data; }
      return rep(null, 201);
    }
    if (/select=owner&limit=1/.test(u)) return rep([]);
    if (/id=eq\.main&select=owner/.test(u)) return rep([{ owner: O }]);
    const avecMoi = u.includes(`owner=eq.${O}`);
    if (/id=eq\.push_prefs/.test(u)) return rep(avecMoi ? [{ data: prefsRoute }] : []);
    if (/id=eq\.push_reveil/.test(u)) return rep(avecMoi && memo ? [{ data: memo }] : []);
    if (/id=eq\.push_journal_lu/.test(u)) return rep(avecMoi ? [{ data: { luJusqua: 0, lus: [] } }] : []);
    if (/id=eq\.push_journal/.test(u)) return rep(avecMoi ? [{ data: journalRoute }] : []);
    if (/id=eq\.push_subs/.test(u)) { lecturesSubs++; return rep(avecMoi ? [{ data: { subs: [] } }] : []); }
    return rep([]);
  };
  const route = (await import('file://' + path.join(racine, 'api/ship-reminders.js'))).default;
  const appel = async () => { const r = { code: 0, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.corps = b; return r; } }; await route({ method: 'GET', headers: { authorization: 'Bearer secret-banc' }, query: { moment: 'reveil' } }, r); return r; };
  {
    panneMemo = true;
    const r0 = await appel();
    dit(r0.corps && r0.corps.bilans && r0.corps.bilans[0].reveil === 'memo-non-ecrit' && envois === 0, 'mémo pas écrit ⇒ rien ne part', JSON.stringify(r0.corps && r0.corps.bilans));
    panneMemo = false;
    const r1 = await appel();
    dit(r1.code === 200 && r1.corps.bilans[0].reveil === 'envoye' && r1.corps.bilans[0].n === 2 && ecritures === 1 && envois >= 1, 'à la fin des heures calmes : un récapitulatif (2), mémo écrit avant', JSON.stringify(r1.corps && r1.corps.bilans));
    const avant = lecturesSubs;
    const r2 = await appel();
    dit(r2.corps.bilans[0].reveil === 'deja' && ecritures === 1, 'second appel le même jour : rien', JSON.stringify(r2.corps && r2.corps.bilans));
    dit(!('relances' in r2.corps), 'le moment « réveil » ne lance pas les e-mails de l\'essai');
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
