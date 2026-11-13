#!/usr/bin/env node
// AUDIT (13 nov.) — LES HORAIRES D'OUVERTURE DES POINTS RELAIS, LUS DANS L'E-MAIL DE RETRAIT.
// Demande : « les e-mails de retrait donnent les horaires du point ; VRM ne les garde pas ».
// Il EXÉCUTE : la règle pure (api/_lib/horaires-relais.js) sur une fixture INVENTÉE par transporteur
// (formes mesurées en lecture seule le 13 nov. : Vinted Go, Chronopost Pickup, Mondial Relay = un lien),
// la vraie `parseCarrierEmail` et la vraie route api/email-inbound (la ligne de suivi garde `horaires`),
// la relecture des lignes déjà rangées (src/lieuxRetrait.js, servie sous la forme projetée réelle) et ce
// que l'écran dit (« Ouvert lun.–sam. 9 h–19 h 30 », ouvert / fermé à une heure FIXÉE de Paris).
// Aucune donnée réelle. `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE.
// §6.1 : lancé avec AUDIT_RACINE=<arbre d'avant>, il est rouge (la règle n'y existe pas).
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';   // sans elle, les routes serveur répondent 503
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'texte-coupe-accepte': ['api/_lib/horaires-relais.js', "    if (/…|\\.\\.\\.\\s*$/.test(l)) return null;", ''],
  'ligne-a-moitie-comprise': ['api/_lib/horaires-relais.js', "    if (js === 'partielle') return null;", "    if (js === 'partielle') break;"],
  'deux-blocs-on-choisit': ['api/_lib/horaires-relais.js', "  return trouves.every((b) => JSON.stringify(b) === k) ? trouves[0] : null;", '  return trouves[0];'],
  'jour-non-dit-ferme': ['api/_lib/horaires-relais.js', "  if (!auj) return null;", '  if (!auj) return { ouvert: false };'],
  'jour-dit-deux-fois': ['api/_lib/horaires-relais.js', "for (const d of e.jours) { if (vus.has(d)) return null; vus.add(d); }\n    e.plages", "for (const d of e.jours) { vus.add(d); }\n    e.plages"],
  'suggestions-lues': ['api/_lib/horaires-relais.js', "  const lignes = sansSuggestions(texte.replace(", "  const lignes = (texte.replace("],
  'route-ne-range-pas': ['api/email-inbound.js', "        ...(track.horaires ? { horaires: track.horaires } : {}),\n", ''],
  'relecture-muette': ['src/lieuxRetrait.js', "      if (hs.length === 1) horairesLus.set(s, JSON.parse(hs[0]));", ''],
  'lecture-sans-horaires': ['src/suivisSansQr.js', "'extraitCode', 'horaires'];", "'extraitCode'];"],
};
if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hor-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(R, d), path.join(dir, d), { recursive: true, filter: (s) => !/node_modules/.test(s) });
    fs.copyFileSync(path.join(R, 'package.json'), path.join(dir, 'package.json'));
    try { fs.symlinkSync(path.dirname(path.dirname(require.resolve('web-push/package.json', { paths: [R] }))), path.join(dir, 'node_modules')); } catch (_) {}
    const p = path.join(dir, f); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable (audit périmé)`); rouges++; fs.rmSync(dir, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: dir }, encoding: 'utf8' });
    const tombe = r.status === 1;   // 1 = des contrôles rouges ; 2 = l'audit a planté (ce n'est pas une preuve)
    console.log(`${tombe ? '✅' : '❌'} mutation ${nom} ⇒ ${tombe ? 'ROUGE (attendu)' : 'reste VERT : la règle ne la voit pas'}`);
    if (!tombe) rouges++;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(rouges ? `\n${rouges} mutation(s) non vue(s)` : '\nToutes les mutations font tomber l’audit.');
  process.exit(rouges ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail != null ? ' — ' + detail : ''}`); } };
const J = JSON.stringify;

// ── FIXTURES INVENTÉES (formes des transporteurs ; noms, rues, villes, n° imaginaires) ──────
const F = {
  // Chronopost Pickup, forme mesurée : « Détails du relais Pickup », puis l'en-tête et une ligne vide.
  chronopost: "Bonjour,\nVotre colis XY123456789FR est disponible.\nDétails du relais Pickup\n\nEPICERIE DU BANC\nRUE DES ESSAIS\n35000 RENNES\n\nVoir sur la carte\n\nHoraires d’ouverture :\n\nlun. - sam. 09:00 - 19:30\n\nCode de retrait : 482913",
  // Chronopost, forme à plusieurs lignes (pause de midi, dimanche fermé).
  chronopostMidi: "Horaires d'ouverture :\nlun. - ven. 09:00 - 12:00 14:00 - 19:00\nsam. 09:00 - 12:00\ndim. fermé\nVoir sur la carte",
  // Vinted Go, forme mesurée (astérisques de mise en gras, jours groupés au tiret long, « Fermé »).
  vintedGo: "Détails de la commande\n\n*Paire de banc 10.00 €* \nHoraires d'ouverture\n*Lundi*\n\nFermé \n*Mardi–Vendredi*\n\n10:00-19:00 \n*Samedi–Dimanche*\n\nFermé\n\nTu peux désormais aussi suivre ton colis.",
  vintedGoTous: "Horaires d'ouverture\n*Lundi–Dimanche*\n\n07:00-21:00 \nCode de retrait\nScanne ce QR code",
  // Mondial Relay, forme mesurée : un LIEN vers les horaires, aucune heure.
  mondialLien: "RETRAIT JUSQU’AU\n\n09/11\n\nINFO PRATIQUES\n\nHoraires d'ouvertures, photo, itinéraire : toutes les informations juste ici !\n\nS'y rendre →",
  // Mondial Relay / Relais Colis : tableau jour par jour (heures « 09h00 »), plusieurs plages.
  mondialTableau: "POINT RELAIS®\nTABAC DU BANC\n1 Rue Imaginaire\n56000 Vannes\nHoraires d'ouverture :\nLundi : 09h00 - 12h00 / 14h00 - 19h00\nMardi : 09h00 - 12h00 / 14h00 - 19h00\nMercredi : fermé\nJeudi : 09h00 - 19h00\nVendredi : 09h00 - 19h00\nSamedi : 09h00 - 12h00\nDimanche : fermé\nCode : 123456",
  relaisColis: "Votre colis vous attend au Relais Colis\nHoraires : du lundi au samedi de 9h à 12h et de 14h à 19h\nDimanche : fermé\nMerci",
  // InPost / casier : 24 h/24, 7 j/7.
  inpost: "Votre colis est dans le casier\nHoraires : 24h/24 7j/7\nCode d'ouverture : 654321",
  // Colissimo (bureau de poste), DPD Pickup, GLS, UPS Access Point : mêmes briques.
  colissimo: "Bureau de poste\nHoraires d’ouverture :\nLun. au Ven. : 9h00-12h30, 13h30-18h00\nSam. : 9h00-12h00",
  dpd: "DPD Pickup\nHoraires d'ouverture : lun - sam 08:30 - 20:00",
};
const ATTENDU = {
  chronopost: [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '19:30' }] }],
  chronopostMidi: [{ jours: [1, 2, 3, 4, 5], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [6], plages: [{ de: '09:00', a: '12:00' }] }, { jours: [7], plages: [] }],
  vintedGo: [{ jours: [1], plages: [] }, { jours: [2, 3, 4, 5], plages: [{ de: '10:00', a: '19:00' }] }, { jours: [6, 7], plages: [] }],
  vintedGoTous: [{ jours: [1, 2, 3, 4, 5, 6, 7], plages: [{ de: '07:00', a: '21:00' }] }],
  mondialLien: null,
  mondialTableau: [{ jours: [1], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [2], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [3], plages: [] }, { jours: [4], plages: [{ de: '09:00', a: '19:00' }] }, { jours: [5], plages: [{ de: '09:00', a: '19:00' }] }, { jours: [6], plages: [{ de: '09:00', a: '12:00' }] }, { jours: [7], plages: [] }],
  relaisColis: [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [7], plages: [] }],
  inpost: [{ jours: [1, 2, 3, 4, 5, 6, 7], plages: [{ de: '00:00', a: '24:00' }] }],
  colissimo: [{ jours: [1, 2, 3, 4, 5], plages: [{ de: '09:00', a: '12:30' }, { de: '13:30', a: '18:00' }] }, { jours: [6], plages: [{ de: '09:00', a: '12:00' }] }],
  dpd: [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '08:30', a: '20:00' }] }],
};
// Ce qui ne doit JAMAIS donner d'horaires.
const RIEN = {
  'texte coupé (texte gardé borné à 1 500 car., mesuré)': "Détails du relais Pickup\n\nEPICERIE DU BANC\n\nHoraires d’ouverture :\n\nlun. - sa…",
  'conseil « Vérifie les horaires d’ouverture »': "3. *Dépose ton colis dans un point relais*\n - Vérifie les horaires d'ouverture du point relais\n\nMondial Relay le plus proche de chez toi.",
  'ligne à moitié comprise': "Horaires d'ouverture :\nlun. - sam. 09:00 - 19:30 sauf jours fériés et vacances scolaires",
  'ligne à moitié comprise après une ligne lue': "Horaires d'ouverture :\nlun. - ven. 09:00 - 19:00\nsam. 09:00 - 12:00 sauf jours fériés",
  'texte coupé juste après une ligne entière': "Horaires d’ouverture :\n\nlun. - ven. 09:00 - 19:00\n…",
  'jour sans heure ni « fermé »': "Horaires d'ouverture :\nlun. - ven.\nCode : 123456",
  'jour dit deux fois': "Horaires :\nlun. - ven. 09:00 - 19:00\nven. 09:00 - 12:00",
  'heure impossible (25:00)': "Horaires : lun. - sam. 09:00 - 25:00",
  'plage à l’envers': "Horaires : lun. - sam. 19:00 - 09:00",
  'deux blocs différents': "Horaires d'ouverture : lun. - sam. 09:00 - 19:00\nAutre texte\nHoraires d'ouverture : lun. - ven. 10:00 - 18:00",
  'seulement fermé': "Horaires : lun. - dim. fermé",
  'suggestions de points de proximité (pas le point du colis)': "Votre colis est arrivé.\nCode : 123456\n\nPoints relais de proximité pour vos prochains envois :\nTABAC VOISIN\nHoraires : lun. - sam. 08:00 - 20:00",
};

(async () => {
  let H;
  try { H = await import('file://' + path.join(R, 'api/_lib/horaires-relais.js')); }
  catch (e) { dit(false, 'la règle des horaires existe (api/_lib/horaires-relais.js)', String(e && e.message).slice(0, 160)); console.log(`\n${ko} CONTRÔLE(S) EN ÉCHEC`); process.exit(1); }

  // ── 1. LA LECTURE, TRANSPORTEUR PAR TRANSPORTEUR ─────────────────────────────
  for (const [k, txt] of Object.entries(F)) {
    const h = H.horairesDepuisTexte(txt);
    dit(J(h) === J(ATTENDU[k]), `1. ${k} : ${ATTENDU[k] ? 'horaires lus tels qu’écrits' : 'aucune heure écrite ⇒ rien'}`, J(h));
  }
  for (const [k, txt] of Object.entries(RIEN)) dit(H.horairesDepuisTexte(txt) === null, `1. ${k} ⇒ rien (jamais un horaire inventé)`, J(H.horairesDepuisTexte(txt)));
  dit(H.horairesValides([{ jours: [1, 1], plages: [] }, { jours: [2], plages: [{ de: '09:00', a: '10:00' }] }]) === null && H.horairesValides([{ jours: [8], plages: [{ de: '09:00', a: '10:00' }] }]) === null && H.horairesValides('lun') === null,
    '1. une valeur rangée n’est crue que sous la forme exacte (jour en double, jour 8, texte ⇒ rien)');

  // ── 2. CE QUE L'ÉCRAN DIT, À UNE HEURE FIXÉE (Paris) ─────────────────────────
  const at = (iso) => Date.parse(iso);
  const ch = ATTENDU.chronopost, vg = ATTENDU.vintedGo, mt = ATTENDU.relaisColis;
  dit(H.texteHoraires(ch) === 'Ouvert lun.–sam. 9 h–19 h 30', '2. « Ouvert lun.–sam. 9 h–19 h 30 »', H.texteHoraires(ch));
  dit(H.texteHoraires(vg) === 'Ouvert mar.–ven. 10 h–19 h', '2. Vinted Go : seuls les jours ouverts sont dits', H.texteHoraires(vg));
  dit(H.texteHoraires(mt) === 'Ouvert lun.–sam. 9 h–12 h, 14 h–19 h', '2. deux plages : « 9 h–12 h, 14 h–19 h »', H.texteHoraires(mt));
  dit(H.texteHoraires(ATTENDU.inpost) === 'Ouvert tous les jours 24 h/24', '2. casier : « tous les jours 24 h/24 »', H.texteHoraires(ATTENDU.inpost));
  dit(H.texteHoraires(null) === '' && H.phraseOuverture(H.etatOuverture(null, at('2026-11-13T10:00:00+01:00'))) === '', '2. horaires pas sus ⇒ rien');
  const cas = [
    [ch, '2026-11-13T10:00:00+01:00', 'ouvert maintenant · ferme à 19 h 30', 'vendredi 10 h (heure de Paris)'],
    [ch, '2026-11-13T08:00:00+01:00', 'fermé — ouvre à 9 h', 'vendredi 8 h'],
    [ch, '2026-11-13T20:00:00+01:00', 'fermé — ouvre demain à 9 h', 'vendredi 20 h'],
    [ch, '2026-11-13T19:00:00Z', 'fermé — ouvre demain à 9 h', 'vendredi 19 h UTC = 20 h à Paris (fuseau)'],
    [ch, '2026-11-14T20:00:00+01:00', 'fermé maintenant', 'samedi 20 h : le dimanche n’est pas dit ⇒ aucune promesse'],
    [ch, '2026-11-15T10:00:00+01:00', '', 'dimanche (pas dit dans l’e-mail) ⇒ pas su'],
    [vg, '2026-11-16T12:00:00+01:00', 'fermé — ouvre demain à 10 h', 'Vinted Go, lundi fermé'],
    [vg, '2026-11-14T12:00:00+01:00', 'fermé — ouvre mardi à 10 h', 'Vinted Go, samedi : ouvre mardi'],
    [mt, '2026-11-13T12:30:00+01:00', 'fermé — ouvre à 14 h', 'pause de midi'],
    [ATTENDU.inpost, '2026-11-13T03:00:00+01:00', 'ouvert maintenant', 'casier 24 h/24 : ne « ferme » pas'],
  ];
  for (const [h, iso, attendu, quoi] of cas) { const p = H.phraseOuverture(H.etatOuverture(h, at(iso))); dit(p === attendu, `2. ${quoi} : « ${attendu || '(rien)'} »`, p); }
  dit(J(H.horairesDuPoint([{ horaires: vg, ms: 1 }, { horaires: ch, ms: 5 }, { horaires: 'x', ms: 9 }], (c) => c.ms)) === J(ch), '2. un point : les horaires de son e-mail le plus récent (une valeur illisible ne compte pas)');

  // ── 3. LA VRAIE parseCarrierEmail ET LA VRAIE ROUTE ──────────────────────────
  const Jw = '11111111-1111-1111-1111-111111111111';
  process.env.VRM_OWNER_UID = Jw; process.env.EMAIL_INBOUND_SECRET = 'cle-banc-horaires';
  const ecrites = [];
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push({ id: x.id, data: x.data })); } catch (_) {} return rep('', 201); }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: Jw }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([{ owner: Jw, data: { adresses: { 'recu@vrm.center': { owner: Jw } } } }]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import('file://' + path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(Jw, 'recu@vrm.center'), owner: Jw, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    return rep([]);
  };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?horaires');
  const mailCh = { from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis XY123456789FR est disponible en Relais Pickup', text: F.chronopost + '\nVous avez jusqu’au 20/11/2026 pour le retirer.' };
  const t = route.parseCarrierEmail(mailCh, 'chronopost', '2026-11-13T09:00:00Z');
  dit(t && t.status === 'available' && J(t.horaires) === J(ATTENDU.chronopost), '3. parseCarrierEmail (Chronopost Pickup) : horaires lus', t && J({ st: t.status, h: t.horaires }));
  const tVg = route.parseCarrierEmail({ from: 'no-reply@vintedgo.com', subject: 'Ton colis Vinted Go est arrivé', text: 'Ton colis Vinted Go est arrivé.\nScanne ce QR code pour récupérer ton colis ou saisis le code suivant : C49341\nÀ retirer avant le 20/11/2026\nAdresse\nConsigne Vinted Go\nLaverie du Banc\n2 Rue Imaginaire\nRennes\n' + F.vintedGo + '\nNuméro de suivi : VGS0000000000001' }, 'vinted', '2026-11-13T09:00:00Z');
  dit(tVg && J(tVg.horaires) === J(ATTENDU.vintedGo), '3. parseCarrierEmail (Vinted Go) : horaires lus', tVg && J(tVg.horaires));
  const tMr = route.parseCarrierEmail({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 12345678 est disponible', text: 'Votre code de retrait est 418205\nPoint Relais\nTabac du Banc\n17 Rue Imaginaire\n56000 Vannes\n' + F.mondialLien }, 'mondialrelay', '2026-11-13T09:00:00Z');
  dit(tMr && tMr.status === 'available' && !('horaires' in tMr), '3. parseCarrierEmail (Mondial Relay, un lien) : aucun horaire rangé', tMr && J(tMr.horaires));
  const tTr = route.parseCarrierEmail({ from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis XY123456789FR est en cours de livraison', text: 'Votre colis est en route.\n' + F.chronopost.replace(/Code de retrait.*$/, '') }, 'chronopost', '2026-11-13T09:00:00Z');
  dit(tTr && tTr.status !== 'available' && !('horaires' in tTr), '3. un colis pas encore arrivé : aucun horaire rangé', tTr && J({ st: tTr.status, h: tTr.horaires }));
  const res = { code: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
  await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-horaires' }, body: { messageId: '<horaires-1@banc>', to: 'recu@vrm.center', html: '', attachments: [], ...mailCh } }, res);
  const ligne = ecrites.find((x) => /^email_track_/.test(x.id));
  dit(res.code === 200 && ligne && J(ligne.data.horaires) === J(ATTENDU.chronopost), '3. la route range `horaires` sur la ligne de suivi', ligne ? J(ligne.data.horaires) : 'aucune ligne écrite (' + res.code + ' ' + J(res.corps).slice(0, 300) + ')');

  // ── 4. LES LIGNES DÉJÀ RANGÉES : RELUES DANS LE TEXTE GARDÉ DE LEUR E-MAIL ──────
  const Sq = await import('file://' + path.join(R, 'src/suivisSansQr.js'));
  dit(Sq.CHAMPS_HORS_META.includes('horaires') && /horaires:data->horaires/.test(Sq.SEL_SUIVI_SANS_QR), '4. la lecture des suivis (sans `select=data`) lit `horaires` par son chemin (un tableau n’est pas dans `meta`)', Sq.SEL_SUIVI_SANS_QR);
  const d = Sq.dataDeLigneSansQr({ id: 'email_track_chronopost_XY1', meta: { status: 'available', suivi: 'XY1' }, horaires: ATTENDU.chronopost });
  dit(d && J(d.horaires) === J(ATTENDU.chronopost), '4. une ligne lue en projection garde ses horaires');
  const { lieuxRelusDansTextes } = await import('file://' + path.join(R, 'src/lieuxRetrait.js'));
  const k1 = 'a'.repeat(32), k2 = 'b'.repeat(32), k3 = 'c'.repeat(32);
  const textes = { [k1]: F.vintedGo, [k2]: RIEN['texte coupé (texte gardé borné à 1 500 car., mesuré)'], [k3]: F.chronopost };
  const requetes = [];
  const lire = async (q) => {
    requetes.push(q);
    if (/select=data(?:&|$)/.test(q)) throw new Error('select=data interdit');
    if (/email_reception_/.test(q)) return [{ id: 'email_reception_' + k1, s: 'VGS1' }, { id: 'email_reception_' + k2, s: 'XY2' }, { id: 'email_reception_' + k3, s: 'XY3' }];
    if (/email_texte_/.test(q)) return Object.entries(textes).filter(([k]) => q.includes('email_texte_' + k)).map(([k, v]) => ({ id: 'email_texte_' + k, texte: v }));
    return [];
  };
  const lignes = [
    { suivi: 'VGS1', status: 'available', lieu: 'Laverie du Banc, 2 Rue Imaginaire, 35000 Rennes' },
    { suivi: 'XY2', status: 'available', lieu: 'EPICERIE DU BANC, RUE DES ESSAIS, 35000 RENNES' },
    { suivi: 'XY3', status: 'available', lieu: 'EPICERIE DU BANC, RUE DES ESSAIS, 35000 RENNES', horaires: ATTENDU.vintedGoTous },
    { suivi: 'VGS1', status: 'transit', lieu: '' },
  ];
  const relues = await lieuxRelusDansTextes(lignes, lire);
  dit(relues && J(relues[0].horaires) === J(ATTENDU.vintedGo), '4. une ligne d’avant (Vinted Go) : horaires relus dans le texte gardé de SON e-mail', relues && J(relues[0].horaires));
  dit(relues && !('horaires' in relues[1]), '4. texte gardé coupé (Chronopost, mesuré) : rien', relues && J(relues[1].horaires));
  dit(relues && J(relues[2].horaires) === J(ATTENDU.vintedGoTous), '4. des horaires déjà rangés ne sont jamais remplacés par la relecture', relues && J(relues[2].horaires));
  dit(relues && !('horaires' in relues[3]), '4. un colis pas au point (en route) : rien', relues && J(relues[3].horaires));
  dit(requetes.length > 0 && requetes.every((q) => /select=id,(?:s:data->resume->>s|texte:data->>texte)/.test(q)), '4. lectures projetées (jamais `select=data`)', J(requetes));
  const panne = await lieuxRelusDansTextes(lignes, async () => { throw new Error('réseau'); });
  dit(panne === lignes, '4. lecture ratée ⇒ la liste telle quelle (rien deviné)');

  console.log(ko ? `\n${ko} CONTRÔLE(S) EN ÉCHEC sur ${ok + ko}` : `\nTOUS VERTS (${ok}) — les horaires des points relais sont lus, rangés, relus et dits sans rien inventer.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a planté — ' + (e && e.stack || e)); process.exit(2); });
