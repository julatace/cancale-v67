#!/usr/bin/env node
// AUDIT (13 nov.) — LES RAPPELS DES TRANSPORTEURS : LE MÊME COLIS, JAMAIS UNE 2e LIGNE.
// Julien : « je veux que l'app sache simplement lire les rappels ».
// Il EXÉCUTE la vraie route api/email-inbound.js sur une base en mémoire (lire-fusionner-réécrire réel) :
// pour chaque forme MESURÉE (Mondial Relay « Le temps file… », Chronopost « …vous attend toujours en relais
// Pickup ! », Vinted Go « Libère de la place… #n° » et « Rappel : récupère ton colis avant le JJ/MM/AAAA #n° »),
// l'e-mail d'arrivée puis le rappel ⇒ UNE ligne (celle du n°), « à retirer », le code, le point, le QR et les
// horaires gardés, la date limite mise à jour si le rappel la donne ; un colis retiré reste retiré ; la clé de
// notification du rappel est celle de l'arrivée (pas de 2e notification). Fixtures INVENTÉES.
// `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE. §6.1 : rouge sur un arbre d'avant.
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  // un rappel qui crée une 2e ligne (la clé de ligne n'est plus le n° pour un rappel)
  'rappel-2e-ligne': ['api/email-inbound.js', "const rowId = `email_track_${carrier}_${track.suivi || shortHash(", "const rowId = `email_track_${carrier}_${(/rappel|temps file|toujours|lib[eè]re/i.test(subject) ? 'r' : '') + (track.suivi || '')}${shortHash("],
  // un rappel qui efface le code (la ligne d'avant n'est plus relue pour les champs absents)
  'rappel-efface-code': ['api/_lib/rappel-colis.js', "    if (vide(track[k]) && !vide(prev[k])) track[k] = prev[k];", "    if (k !== 'code' && vide(track[k]) && !vide(prev[k])) track[k] = prev[k];"],
  // un rappel qui réveille un retiré
  'rappel-reveille-retire': ['api/_lib/etat-colis-email.js', " if(retraitTenu(precedent))return {...nouveau,status:'delivered',label:precedent.statusLabel||'Livré / retiré'};", ''],
  'rappel-efface-horaires': ['api/_lib/rappel-colis.js', "const GARDES = ['code', 'code2', 'lieu', 'limite', 'artTitle', 'horaires'];", "const GARDES = ['code', 'code2', 'lieu', 'limite', 'artTitle'];"],
  'date-en-gras-ignoree': ['api/_lib/retrait-colis.js', "const DECO = String.raw`[\\s*_]`;", "const DECO = String.raw`\\s`;"],
};
if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(R, d), path.join(dir, d), { recursive: true });
    fs.copyFileSync(path.join(R, 'package.json'), path.join(dir, 'package.json'));
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '_horloge-notif.cjs'), path.join(dir, 'scripts', '_horloge-notif.cjs'));
    fs.copyFileSync(__filename, path.join(dir, 'scripts', path.basename(__filename)));
    try { fs.symlinkSync(path.dirname(path.dirname(require.resolve('web-push/package.json', { paths: [R] }))), path.join(dir, 'node_modules')); } catch (_) {}
    const p = path.join(dir, f); const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable (audit périmé)`); rouges++; fs.rmSync(dir, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, t.replace(de, vers));
    const r = spawnSync(process.execPath, [path.join(dir, 'scripts', path.basename(__filename))], { env: { ...process.env, AUDIT_RACINE: dir }, encoding: 'utf8' });
    const tombe = r.status === 1;
    console.log(`${tombe ? '✅' : '❌'} mutation ${nom} ⇒ ${tombe ? 'ROUGE (attendu)' : `reste ${r.status === 0 ? 'VERT' : 'en panne (' + r.status + ')'}`}`);
    if (!tombe) rouges++;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(rouges ? `\n${rouges} mutation(s) non vue(s)` : '\nToutes les mutations font tomber l’audit.');
  process.exit(rouges ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail != null ? ' — ' + detail : ''}`); } };
const J = JSON.stringify;
const Jw = '11111111-1111-1111-1111-111111111111';

(async () => {
  process.env.VRM_OWNER_UID = Jw; process.env.EMAIL_INBOUND_SECRET = 'cle-banc-rappels';
  let base = new Map();
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') { try { for (const x of JSON.parse(opts.body || '[]')) if (/^email_track_/.test(x.id)) base.set(x.id, x.data); } catch (_) {} return rep('', 201); }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: Jw }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([{ owner: Jw, data: { adresses: { 'recu@vrm.center': { owner: Jw } } } }]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import('file://' + path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(Jw, 'recu@vrm.center'), owner: Jw, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    const eq = /[?&]id=eq\.(email_track_[^&]+)&select=data/.exec(u);
    if (eq) return rep(base.has(eq[1]) ? [{ data: base.get(eq[1]) }] : []);
    return rep([]);
  };
  let route;
  try { route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?rappels'); }
  catch (e) { dit(false, 'la route se charge', String(e && e.message).slice(0, 200)); process.exit(1); }
  let n = 0;
  const envoyer = async (mail, sourceDate) => {
    n++;
    const res = { code: null, status(c) { this.code = c; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-rappels' }, body: { messageId: `<rappel-${n}@banc>`, to: 'recu@vrm.center', html: '', attachments: [], sourceDate, ...mail } }, res);
    return res;
  };
  const lignes = () => [...base.entries()];

  const H_VG = "Horaires d'ouverture\n*Lundi–Dimanche*\n\n07:00-21:00 \n";
  const FORMES = [
    { nom: 'Mondial Relay « Le temps file… »', carrier: 'mondialrelay', suivi: '81234567',
      arrivee: { from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 81234567 est disponible 📦', text: 'Bonjour,\nVotre colis est disponible.\nVotre code de retrait est 418205\nPOINT RELAIS®\nTABAC DU BANC\n1 Rue Imaginaire\n56000 Vannes\nRETRAIT JUSQU’AU\n\n20/11\n' },
      rappel: { from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Le temps file : votre colis vous attend avec impatience ⏳', text: "Vinted te transfère cet e-mail de la part de Mondial Relay.\nLe temps file : votre colis vous attend avec impatience ⏳\nTic-tac, tic-tac... ⌛\nN'oubliez pas de venir chercher votre colis n° 81234567 !\nINFO PRATIQUES\nHoraires d'ouvertures, photo, itinéraire : toutes les informations juste ici !" },
      code: '418205', limiteRappel: null },
    { nom: 'Chronopost « …vous attend toujours en relais Pickup ! »', carrier: 'chronopost', suivi: 'XY123456789FR',
      arrivee: { from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis XY123456789FR est disponible en Relais Pickup', text: "Bonjour,\nVotre colis XY123456789FR vous attend.\nDétails du relais Pickup\n\nEPICERIE DU BANC\nRUE DES ESSAIS\n35000 RENNES\n\nHoraires d’ouverture :\n\nlun. - sam. 09:00 - 19:30\n\nCode de retrait : 482913\nVous avez jusqu’au 20/11/2026 pour le retirer." },
      rappel: { from: 'Chronopost <noreply@chronopost.fr>', subject: 'Votre colis VINTED vous attend toujours en relais Pickup !', text: "Votre colis VINTED vous attend toujours en relais Pickup\nN'attendez pas pour récupérer votre colis !\nVotre colis n° XY123456789FR\nPour retirer votre colis présentez ce Pickup Pass au relais EPICERIE DU BANC." },
      code: '482913', horaires: true, limiteRappel: null },
    { nom: 'Vinted Go « Libère de la place… #n° »', carrier: 'vinted', suivi: 'VGS0000000000042',
      arrivee: { from: 'no-reply@vintedgo.com', subject: 'Ton colis Vinted Go est arrivé', text: "Ton colis Vinted Go est arrivé. Tu peux dès à présent le récupérer.\nCode de retrait\nScanne ce QR code pour récupérer ton colis ou saisis le code suivant :\n*C49341*\nÀ retirer avant le\n*20/11/2026*\nAdresse\n*Consigne Vinted Go*\n* Laverie du Banc *\n* 2 Rue Imaginaire *\n*Rennes*\n" + H_VG + 'Numéro de suivi : VGS0000000000042' },
      rappel: { from: 'no-reply@vintedgo.com', subject: 'Libère de la place dans la consigne : récupère ton colis sans attendre ! #VGS0000000000042', text: "Tu n'as toujours pas récupéré ton colis Vinted Go.\nGrâce à toi, d'autres membres pourront profiter de la consigne." },
      code: 'C49341', limiteArrivee: '2026-11-20', horaires: true, limiteRappel: null },
    { nom: 'Vinted Go « Rappel : récupère ton colis avant le JJ/MM/AAAA #n° »', carrier: 'vinted', suivi: '1792000000000099',
      arrivee: { from: 'no-reply@vintedgo.com', subject: 'Ton colis Vinted Go est arrivé', text: "Ton colis Vinted Go est arrivé.\nScanne ce QR code pour récupérer ton colis ou saisis le code suivant :\n*B36315*\nÀ retirer avant le\n*19/11/2026*\nAdresse\n*Consigne Vinted Go*\n* Laverie du Banc *\n* 2 Rue Imaginaire *\n*Rennes*\nNuméro de suivi : 1792000000000099" },
      rappel: { from: 'no-reply@vintedgo.com', subject: 'Rappel : récupère ton colis avant le 21/11/2026 #1792000000000099', text: "Tu n'as toujours pas récupéré ton colis Vinted Go.\nNous le retournerons à l'expéditeur si tu ne le récupères pas à temps." },
      code: 'B36315', limiteArrivee: '2026-11-19', limiteRappel: '2026-11-21' },
  ];
  const { formeRappel } = await import('file://' + path.join(R, 'api/_lib/rappel-colis.js')).catch(() => ({ formeRappel: null }));
  for (const f of FORMES) {
    base = new Map();
    const r1 = await envoyer(f.arrivee, '2026-11-13T08:00:00Z');
    const avant = lignes();
    const l1 = avant.length === 1 ? avant[0][1] : null;
    dit(r1.code === 200 && !!l1 && l1.status === 'available' && l1.code === f.code, `${f.nom} : l'arrivée est rangée (à retirer, code)`, J({ code: r1.code, n: avant.length, l1: l1 && { st: l1.status, code: l1.code, lim: l1.limite } }));
    if (f.limiteArrivee) dit(!!l1 && l1.limite === f.limiteArrivee, `${f.nom} : la date limite de l'arrivée est lue (« À retirer avant le » / « *JJ/MM/AAAA* » à la ligne)`, l1 && l1.limite);
    const r2 = await envoyer(f.rappel, '2026-11-15T08:00:00Z');
    const apres = lignes();
    const l2 = apres.length ? apres[0][1] : null;
    dit(r2.code === 200 && apres.length === 1 && apres[0][0] === avant[0][0], `${f.nom} : le rappel tombe sur la ligne du MÊME colis (une seule ligne, celle du n°)`, J(apres.map(([k]) => k)));
    dit(!!l2 && l2.status === 'available', `${f.nom} : toujours « à retirer »`, l2 && l2.status);
    dit(!!l2 && l2.code === f.code && !!l2.lieu && (!l1.qrUrl || l2.qrUrl === l1.qrUrl), `${f.nom} : code, point (et QR) gardés`, J(l2 && { code: l2.code, lieu: l2.lieu }));
    if (f.horaires) dit(!!l2 && J(l2.horaires) === J(l1.horaires) && !!l1.horaires, `${f.nom} : les horaires du point gardés`, J(l2 && l2.horaires));
    if (f.limiteRappel) dit(!!l2 && l2.limite === f.limiteRappel, `${f.nom} : la date limite du rappel (« avant le … » du sujet) remplace l'ancienne`, l2 && l2.limite);
    else dit(!!l2 && l2.limite === l1.limite, `${f.nom} : sans date dans le rappel, la date limite reste`, l2 && J([l1.limite, l2.limite]));
    if (formeRappel) dit(!!formeRappel(f.rappel.subject) && !formeRappel(f.arrivee.subject), `${f.nom} : la forme est reconnue comme un rappel (et l'arrivée non)`, formeRappel(f.rappel.subject));
    const k1 = route.cleNotifColis({ ...l1, status: 'available' }, avant[0][0]), k2 = route.cleNotifColis({ ...l2, status: 'available' }, apres[0][0]);
    dit(k1 === k2, `${f.nom} : la clé de notification du rappel est celle de l'arrivée (pas de 2e notification)`, J([k1, k2]));
  }
  // Un colis RETIRÉ ne se réveille pas : ni par un rappel plus ancien traité après, ni par un plus récent.
  for (const [quand, date] of [['plus ancien (traité après)', '2026-11-13T09:00:00Z'], ['plus récent', '2026-11-16T09:00:00Z']]) {
    base = new Map();
    const f = FORMES[0];
    await envoyer(f.arrivee, '2026-11-13T08:00:00Z');
    await envoyer({ from: f.arrivee.from, subject: 'Votre colis 81234567 a été retiré', text: 'Votre colis n° 81234567 a bien été retiré. Merci !' }, '2026-11-14T10:00:00Z');
    const r = lignes()[0][1];
    dit(r && r.status === 'delivered', `retiré : le colis est rangé « retiré »`, r && r.status);
    await envoyer(f.rappel, date);
    const l = lignes();
    dit(l.length === 1 && l[0][1].status === 'delivered', `retiré + rappel ${quand} : il reste RETIRÉ, une seule ligne`, J(l.map(([k, v]) => [k, v.status])));
  }

  console.log(ko ? `\n${ko} CONTRÔLE(S) EN ÉCHEC sur ${ok + ko}` : `\nTOUS VERTS (${ok}) — un rappel est le même colis : une ligne, rien d'effacé, un retiré reste retiré.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a planté — ' + (e && e.stack || e)); process.exit(2); });
