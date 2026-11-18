#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE COUCOU ET L'HABILLAGE DES GROUPES, CÔTÉ APP ET ROUTE (17 nov., 046)
//  node scripts/audit-coucou.cjs
//  node scripts/audit-coucou.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  EXÉCUTE (§4.10) :
//   · src/communaute/coucou.js — LA RÈGLE DU GESTE de celui qui reçoit : son
//     profil Discord s'il l'a relié, sinon le salon du groupe, sinon « Pas de
//     Discord lié » ; le lien Discord d'un groupe (invitation ou salon, rien
//     d'autre) ; la photo (petit JPEG) ; l'état du bouton (24 h, 20 par jour) ;
//     la forme lue de la route (une forme inconnue ⇒ `null`, jamais « aucun ») ;
//   · api/_lib/avatar-discord.js — l'identifiant Discord n'est cru que SIGNÉ ;
//   · la VRAIE route `?mode=communaute` (api/_lib/communaute.js →
//     accompagnement.js → coucou.js), base simulée : 046 absente ⇒ 503
//     `non-installe` (« bientôt »), jamais une liste vide ; un coucou ne relaie
//     AUCUN texte (seuls groupe et personne partent, quoi que le navigateur
//     envoie) ; le jeton de l'APPELANT ; la clé de service seulement pour sonner
//     et trouver le Discord, avec l'identité VÉRIFIÉE (jamais un champ du corps) ;
//     la notification part au nom de CELUI QUI REÇOIT ; aucun compte renvoyé ;
//     un lien ou une photo refusés AVANT la base ; « Fermer mon compte » détache
//     les coucous ;
//   · l'écran (src/communaute/Accompagnement.jsx, commentaires retirés) : aucun
//     champ de texte dans le coucou, aucune réponse dans l'app, UN geste.
//  Aucune donnée réelle : tout est inventé ici.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MOD = path.join(RACINE, 'src/communaute/coucou.js');
const ROUTE = path.join(RACINE, 'api/_lib/coucou.js');
const AVATAR = path.join(RACINE, 'api/_lib/avatar-discord.js');
const ECRAN = path.join(RACINE, 'src/communaute/Accompagnement.jsx');
const CARTE = path.join(RACINE, 'src/communaute/Communaute.jsx');
const COMMU = path.join(RACINE, 'api/_lib/communaute.js');
const MUTATION = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const remplace = (s, a, b, nom) => { if (s.split(a).length !== 2) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(a).join(b); };
const MUTATIONS = {
  // Le salon du groupe passe avant le profil de la personne.
  'lien-ordre': { f: MOD, m: (s) => remplace(s, "  const p = profilDiscord(profil);\n  if (p) return { sorte: 'profil', url: p };\n  const g = lienDiscordGroupe(groupe);\n  if (g) return { sorte: 'groupe', url: g };",
    "  const g = lienDiscordGroupe(groupe);\n  if (g) return { sorte: 'groupe', url: g };\n  const p = profilDiscord(profil);\n  if (p) return { sorte: 'profil', url: p };", 'lo') },
  // Rien de lié ⇒ on propose quand même quelque chose.
  'aucun-propose': { f: MOD, m: (s) => remplace(s, "  return { sorte: 'aucun', url: '' };", "  return { sorte: 'groupe', url: 'https://discord.com/' };", 'ap') },
  // N'importe quelle adresse accepte comme lien Discord.
  'discord-libre': { f: MOD, m: (s) => remplace(s, "  return DISCORD_GROUPE_RE.test(s) && s.length <= 120 ? s : null;", "  return s;", 'dl') },
  // Le texte du navigateur relayé à la base.
  'texte-relaye': { f: ROUTE, m: (s) => remplace(s, "nom = 'vrm_coucou_envoyer'; args = { p_groupe: g, p_membre: m };", "nom = 'vrm_coucou_envoyer'; args = { p_groupe: g, p_membre: m, p_texte: c.texte };", 'tr') },
  // 046 absente ⇒ une liste vide (« aucun coucou ») au lieu de « bientôt ».
  'non-installe-vide': { f: ROUTE, m: (s) => remplace(s, "    const r = await rpcEquipe('vrm_coucou_lire', {}, qui);\n    if (r.etat === 'absent') return nonInstalle();", "    const r = await rpcEquipe('vrm_coucou_lire', {}, qui);\n    if (r.etat === 'absent') return dire(200, { ok: true, coucou: { envoyes24h: 0, groupes: [], recus: [], sourdines: [] } });", 'niv') },
  // L'identifiant Discord cru sans signature.
  'id-non-signe': { f: AVATAR, m: (s) => remplace(s, "if(/^\\d{15,25}$/.test(did)&&typeof d.signatureId==='string'&&egal(signerIdDiscord(owner,d.discord,did),d.signatureId))return did;", "if(/^\\d{15,25}$/.test(did))return did;", 'ins') },
  // L'auteur pris dans le corps de la requête (usurpable).
  'sonner-de-corps': { f: ROUTE, m: (s) => { const [a, b] = ["  const moi = utilisateur && UUID_RE.test(String(utilisateur.id || '')) ? utilisateur.id : '';", "  const moi = String((corps || {}).de || (utilisateur && utilisateur.id) || '');"]; if (!s.includes(a)) throw new Error('mutation sdc : ancre introuvable'); return s.split(a).join(b); } },
  // Le compte de l'auteur renvoyé au navigateur.
  'owner-renvoye': { f: ROUTE, m: (s) => remplace(s, "le: x.le, discord_groupe: x.discord_groupe || null, profil: profils[x.id] || null }));", "le: x.le, discord_groupe: x.discord_groupe || null, profil: profils[x.id] || null, de: x.de }));", 'or') },
  // La notification part chez l'auteur au lieu de celui qui reçoit.
  'sonne-chez-soi': { f: ROUTE, m: (s) => remplace(s, "    return await contexteVendeur.run({ owner: d.a }, async () => {", "    return await contexteVendeur.run({ owner: moi }, async () => {", 'scs') },
  // « Fermer mon compte » oublie les coucous.
  'effacer-oublie': { f: path.join(RACINE, 'api/_lib/communaute.js'), m: (s) => remplace(s, '  const k = await effacerCoucous(owner, SERVICE);', '  const k = 0;', 'eo') },
  // L'écran envoie un texte avec le coucou.
  'ecran-texte': { f: ECRAN, m: (s) => remplace(s, "    const r = await api({ action: 'accomp-coucou', groupe, membre: cible.cible });", "    const r = await api({ action: 'accomp-coucou', groupe, membre: cible.cible, texte: 'Coucou !' });", 'et') },
  // L'écran propose de répondre dans l'app.
  'ecran-repondre': { f: ECRAN, m: (s) => remplace(s, "        <button type=\"button\" className=\"vrm-gc-plus\" onClick={() => onPlus(r)}", "        <textarea data-cm-coucou-reponse /><button type=\"button\" className=\"vrm-gc-plus\" onClick={() => onPlus(r)}", 'er') },
  // (17 nov., carte) La carte retrouve un champ de message.
  'carte-texte': { f: CARTE, m: (s) => remplace(s, "    <CoucousCarte cc={cc} onPlus={setCoucouPlus} />", "    <CoucousCarte cc={cc} onPlus={setCoucouPlus} /><textarea data-cm-texte />", 'ct') },
  // La route laisse encore écrire un message sur la carte.
  'carte-ecrire': { f: COMMU, m: (s) => remplace(s, "export const MESSAGES_RETIRES = new Set(['ecrire', 'fil', 'bloquer', 'signaler']);", "export const MESSAGES_RETIRES = new Set(['bloquer', 'signaler']);", 'ce') },
  // Le coucou de la carte relaie un texte.
  'carte-texte-relaye': { f: ROUTE, m: (s) => remplace(s, "    nom = 'vrm_carte_coucou'; args = { p_pid: pid };", "    nom = 'vrm_carte_coucou'; args = { p_pid: pid, p_texte: c.texte };", 'ctr') },
  // La 047 absente ⇒ repli vers un message.
  'carte-repli-message': { f: ROUTE, m: (s) => remplace(s, "    const r = await rpcEquipe('vrm_carte_coucou_lire', {}, qui);\n    if (r.etat === 'absent') return nonInstalle();", "    const r = await rpcEquipe('vrm_carte_coucou_lire', {}, qui);\n    if (r.etat === 'absent') return dire(200, { ok: true, coucou: { envoyes24h: 0, deja: [], recus: [], sourdines: [] } });", 'crm') },
};

if (process.argv.includes('--prouve')) {
  let n = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌ /gm) || []).length, saute = /ancre introuvable|NON exécuté/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && rouges > 0 && !saute; if (bon) n++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? rouges + ' rouge(s)' : saute ? 'non exécutée' : 'RESTE VERTE'}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 1)) console.log('      ' + l.slice(0, 200));
  }
  console.log(`\n${n}/${noms.length} mutations attrapées.`); process.exit(n === noms.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && !c ? ' — ' + String(d).slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.stack || e)); } };

if (!fs.existsSync(MOD) || !fs.existsSync(ROUTE)) { console.log('❌ src/communaute/coucou.js ou api/_lib/coucou.js absent — le coucou n’existe pas'); process.exit(1); }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-coucou-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });
fs.writeFileSync(path.join(TMP, 'package.json'), '{"type":"module"}');
fs.cpSync(path.join(RACINE, 'api'), path.join(TMP, 'api'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'src'), { recursive: true });
for (const d of fs.readdirSync(path.join(RACINE, 'src'))) {
  // Le code de l'app sans les gros fichiers d'écran (seuls les modules purs sont importés).
  const p = path.join(RACINE, 'src', d);
  fs.cpSync(p, path.join(TMP, 'src', d), { recursive: true });
}
try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(TMP, 'node_modules'), 'dir'); } catch (_) {}
if (MUTATION) {
  const mu = MUTATIONS[MUTATION]; if (!mu) { console.log('❌ mutation inconnue — NON exécuté'); process.exit(1); }
  const cible = path.join(TMP, path.relative(RACINE, mu.f));
  try { fs.writeFileSync(cible, mu.m(fs.readFileSync(cible, 'utf8'))); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  console.log(`(mutation « ${MUTATION} »)`);
}

// ── Des identités INVENTÉES ──────────────────────────────────────────────────
const MOI = '11111111-1111-4111-8111-111111111111', AUTRE = '22222222-2222-4222-8222-222222222222', LEA = '33333333-3333-4333-8333-333333333333';
const G = '44444444-4444-4444-8444-444444444444', M = '55555555-5555-4555-8555-555555555555';
const C1 = '66666666-6666-4666-8666-666666666666', C2 = '77777777-7777-4777-8777-777777777777';
const SERVICE = 'eyJ.cle-de-service-inventee', JETON = 'jeton-du-vendeur-invente';
process.env.SUPABASE_SERVICE_KEY = SERVICE;
process.env.DISCORD_CLIENT_SECRET = 'secret-discord-invente';
const DID = '123456789012345678';

// ── Le faux PostgREST ────────────────────────────────────────────────────────
let BASE;
const reset = (o = {}) => { BASE = { installe: true, panne: false, appels: [], lectures: [], raison: null, lignesDiscord: [], ...o }; };
const rep = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'content-type': 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = decodeURIComponent(String(url)), h = o.headers || {};
  const auth = h.Authorization || h.authorization || '';
  const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
  if (!m) {
    BASE.lectures.push({ u, auth, methode: o.method || 'GET' });
    if (/app_data\?id=eq\.vrm_discord/.test(u)) return rep(BASE.lignesDiscord);
    return rep([]);
  }
  const fn = m[1], args = o.body ? JSON.parse(o.body) : {};
  BASE.appels.push({ fn, args, auth, corps: o.body || '' });
  if (fn === 'vrm_communaute_effacer') return rep(2);
  if (fn === 'vrm_acces_pour') return rep(true);
  if (!/^vrm_(coucou_|accomp_habiller|carte_coucou)/.test(fn)) return rep({ code: 'PGRST202' }, 404);
  if (!BASE.installe) return rep({ code: 'PGRST202', message: 'Could not find the function' }, 404);
  if (BASE.panne) return new Response('<html>522</html>', { status: 522 });
  if (fn === 'vrm_coucou_lire') return rep({ acces: true, envoyes24h: 3, plafond: 20,
    groupes: [{ groupe: G, discord: 'https://discord.gg/abcd', photo: null, ouvert: false, cibles: [{ cible: null, role: 'createur', nom: 'Coach Léa', deja: false }] }],
    recus: [{ id: C1, de: LEA, groupe: G, groupe_nom: 'Groupe inventé', de_nom: 'Léa', le: new Date().toISOString(), discord_groupe: 'https://discord.gg/abcd' },
            { id: C2, groupe: G, groupe_nom: 'Groupe inventé', de_nom: 'Bob', le: new Date().toISOString(), discord_groupe: null }],
    sourdines: [] });
  if (fn === 'vrm_coucou_auteurs') return rep([{ id: C1, de: LEA }, { id: C2, de: AUTRE }]);
  if (fn === 'vrm_coucou_envoyer') return rep(BASE.raison ? { ok: false, raison: BASE.raison } : { ok: true, id: C1 });
  if (fn === 'vrm_coucou_a_sonner') return rep(args.p_de === MOI ? { a: LEA, de_nom: 'Moi', groupe_nom: 'Groupe inventé' } : null);
  if (fn === 'vrm_coucou_effacer') return rep(4);
  if (fn === 'vrm_carte_coucou_effacer') return rep(1);
  if (fn === 'vrm_carte_coucou_lire') return rep({ acces: true, envoyes24h: 1, plafond: 20, deja: [M], recus: [{ id: C1, de: LEA, de_pid: M, de_nom: 'lea_carte', le: new Date().toISOString() }, { id: C2, de_pid: G, de_nom: 'bob_carte', le: new Date().toISOString() }], sourdines: [] });
  if (fn === 'vrm_carte_coucou_auteurs') return rep([{ id: C1, de: LEA }, { id: C2, de: AUTRE }]);
  if (fn === 'vrm_carte_coucou') return rep(BASE.raison ? { ok: false, raison: BASE.raison } : { ok: true, id: C1 });
  if (fn === 'vrm_carte_coucou_a_sonner') return rep(args.p_de === MOI ? { a: LEA, de_nom: 'moi_carte' } : null);
  return rep({ ok: true });
};
const appeler = async (route, corps, uid = MOI) => {
  const res = { code: 200, corps: null, status(n) { this.code = n; return this; }, json(x) { this.corps = x; return this; }, setHeader() {} };
  await route({ method: 'POST', headers: { authorization: 'Bearer ' + JETON } }, res, { utilisateur: { id: uid }, corps });
  return res;
};

(async () => {
  const K = await import(path.join(TMP, 'src/communaute/coucou.js'));
  const AV = await import(path.join(TMP, 'api/_lib/avatar-discord.js'));
  const { routeCommunaute, effacerCommunaute } = await import(path.join(TMP, 'api/_lib/communaute.js'));

  await essaie('le geste de celui qui reçoit', () => {
    const a = K.lienPourEcrire({ profil: DID, groupe: 'https://discord.gg/abcd' });
    dit(a.sorte === 'profil' && a.url === `https://discord.com/users/${DID}`, 'Discord relié ⇒ SON profil (même si le groupe a un salon)', JSON.stringify(a));
    const b = K.lienPourEcrire({ profil: '', groupe: 'https://discord.gg/abcd' });
    dit(b.sorte === 'groupe' && b.url === 'https://discord.gg/abcd', 'pas de Discord relié ⇒ le salon du groupe', JSON.stringify(b));
    const c = K.lienPourEcrire({ profil: '', groupe: '' });
    dit(c.sorte === 'aucun' && c.url === '', 'ni l’un ni l’autre ⇒ « Pas de Discord lié », AUCUNE adresse proposée', JSON.stringify(c));
    dit(K.lienPourEcrire({ profil: '12', groupe: 'https://evil.example/' }).sorte === 'aucun', 'un identifiant impossible et un salon qui n’est pas Discord ⇒ rien');
  });

  await essaie('le lien Discord d’un groupe', () => {
    for (const bon of ['https://discord.gg/abcd', 'https://discord.com/invite/Ab-12', 'https://discord.com/channels/123456789012345678/876543210987654321', 'https://www.discord.com/channels/123456789012345678', ' https://discordapp.com/invite/abcd '])
      dit(typeof K.lienDiscordGroupe(bon) === 'string' && K.lienDiscordGroupe(bon) !== '', `accepté : ${bon.trim()}`);
    for (const mauvais of ['http://discord.gg/abcd', 'https://evil.example/discord.gg/abcd', 'javascript:alert(1)', 'https://discord.gg/a b', 'https://discord.com/users/123456789012345678', 'https://discord.gg.evil.example/abcd'])
      dit(K.lienDiscordGroupe(mauvais) === null, `refusé : ${mauvais}`);
    dit(K.lienDiscordGroupe('') === '' && K.lienDiscordGroupe(null) === '', 'vide ⇒ aucun lien (retirer)');
  });

  await essaie('photo, bouton, forme lue', () => {
    dit(K.photoValide('data:image/jpeg;base64,QUJD') && !K.photoValide('data:image/png;base64,QUJD') && !K.photoValide('https://x/y.jpg') && !K.photoValide('data:image/jpeg;base64,' + 'A'.repeat(K.PHOTO_MAX)), 'la photo : un petit JPEG en data URL, rien d’autre');
    dit(K.etatCoucou({ deja: true }, { envoyes24h: 0 }) === 'deja', 'déjà un coucou entre vous dans les 24 h ⇒ « deja »');
    dit(K.etatCoucou({ deja: false }, { envoyes24h: K.COUCOU_PAR_JOUR }) === 'plafond' && K.etatCoucou({ deja: false }, { envoyes24h: K.COUCOU_PAR_JOUR - 1 }) === 'pret', `${K.COUCOU_PAR_JOUR} par jour ⇒ « plafond »`);
    dit(K.coucousLus(null) === null && K.coucousLus({ groupes: 'x', recus: [] }) === null, 'une forme inconnue ⇒ `null` (« pas su »), jamais « aucun coucou »');
    const l = K.coucousLus({ groupes: [], recus: [{ id: C1, groupe: G, de_nom: 'Léa', groupe_nom: 'G', le: 'x', profil: 'pas-un-id', discord_groupe: 'javascript:x' }] });
    dit(l && l.recus[0].ecrire.sorte === 'aucun', 'des liens impossibles venus de la route ⇒ « Pas de Discord lié »', JSON.stringify(l));
    for (const lg of ['fr', 'en', 'es', 'it', 'de']) {
      const t = K.texteCoucou(lg, 'Léa', 'Groupe');
      dit(t.title.includes('Léa') && t.body.includes('Groupe') && /Discord/.test(t.body) && !/\p{Extended_Pictographic}/u.test(t.title + t.body), `notification (${lg}) : qui, quel groupe, « Discord », sans emoji ni contenu`, JSON.stringify(t));
    }
  });

  await essaie('l’identifiant Discord n’est cru que signé', () => {
    const sig = AV.signerIdDiscord(LEA, 'lea_invente', DID);
    dit(AV.idDiscordVerifie(LEA, { discord: 'lea_invente', did: DID, signatureId: sig }) === DID, 'signé par le serveur ⇒ cru');
    dit(AV.idDiscordVerifie(LEA, { discord: 'lea_invente', did: DID, signatureId: 'f'.repeat(64) }) === '', 'signature fausse ⇒ rien');
    dit(AV.idDiscordVerifie(AUTRE, { discord: 'lea_invente', did: DID, signatureId: sig }) === '', 'la ligne d’un autre compte ⇒ rien');
    dit(AV.idDiscordVerifie(LEA, { discord: 'lea_invente', did: DID }) === '', 'sans signature ⇒ rien');
  });

  await essaie('route : la 046 absente, une panne', async () => {
    reset({ installe: false });
    let r = await appeler(routeCommunaute, { action: 'accomp-coucou-lire' });
    dit(r.code === 503 && r.corps.erreur === 'non-installe' && /bientôt/.test(r.corps.message), '046 absente ⇒ 503 « bientôt », jamais « aucun coucou »', JSON.stringify(r.corps));
    r = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: G, membre: null });
    dit(r.code === 503 && r.corps.erreur === 'non-installe', '046 absente ⇒ aucun coucou ne se dit envoyé', JSON.stringify(r.corps));
    reset({ panne: true });
    r = await appeler(routeCommunaute, { action: 'accomp-coucou-lire' });
    dit(r.code === 503 && r.corps.erreur === 'pas-su', 'panne ⇒ 503 « pas su »');
  });

  await essaie('route : lire', async () => {
    reset();
    BASE.lignesDiscord = [{ owner: LEA, discord: 'lea_invente', did: DID, signatureId: AV.signerIdDiscord(LEA, 'lea_invente', DID), avatar: null, pid: '', signatureAvatar: null },
      { owner: AUTRE, discord: 'bob_invente', did: '999999999999999999', signatureId: 'forgee' }];
    const r = await appeler(routeCommunaute, { action: 'accomp-coucou-lire' });
    const recus = r.corps && r.corps.coucou && r.corps.coucou.recus || [];
    dit(r.code === 200 && recus.length === 2, 'lu ⇒ 200 et les coucous reçus', JSON.stringify(r.corps).slice(0, 200));
    dit(recus[0] && recus[0].profil === DID, 'Léa a relié son Discord (signé) ⇒ son identifiant est proposé', JSON.stringify(recus[0]));
    dit(recus[1] && recus[1].profil === null, 'Bob : identifiant non signé ⇒ rien (le salon du groupe prendra la place)', JSON.stringify(recus[1]));
    const corps = JSON.stringify(r.corps);
    dit(!corps.includes(LEA) && !corps.includes(AUTRE), 'aucun compte renvoyé au navigateur');
    const lireRpc = BASE.appels.find((a) => a.fn === 'vrm_coucou_lire'), auteurs = BASE.appels.find((a) => a.fn === 'vrm_coucou_auteurs');
    dit(lireRpc && lireRpc.auth === 'Bearer ' + JETON, 'la lecture part avec le JETON DE L’APPELANT');
    dit(auteurs && auteurs.auth === 'Bearer ' + SERVICE && auteurs.args.p_a === MOI, 'les auteurs : clé de service, pour l’identité VÉRIFIÉE de l’appelant seulement', JSON.stringify(auteurs && auteurs.args));
    const disc = BASE.lectures.find((l) => /vrm_discord/.test(l.u));
    dit(disc && /owner=in\.\(/.test(disc.u) && disc.u.includes(LEA) && !/select=data\b|select=\*/.test(disc.u), 'le Discord des auteurs : projection, bornée à eux', disc && disc.u);
  });

  await essaie('route : faire coucou', async () => {
    reset();
    const r = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: G, membre: M, texte: 'Salut, ça va ?', message: 'Écris-moi', contenu: 'x', de: AUTRE });
    const env = BASE.appels.find((a) => a.fn === 'vrm_coucou_envoyer');
    dit(r.code === 200 && r.corps.ok === true, 'le coucou part', JSON.stringify(r.corps));
    dit(env && Object.keys(env.args).sort().join(',') === 'p_groupe,p_membre' && env.args.p_groupe === G && env.args.p_membre === M, 'à la base : le groupe et la personne, RIEN d’autre (aucun texte relayé)', env && env.corps);
    dit(!BASE.appels.some((a) => /Salut|Écris-moi/.test(a.corps)) && !BASE.lectures.some((l) => /Salut|Écris-moi/.test(l.u)), 'le texte envoyé par le navigateur ne va NULLE PART');
    dit(env && env.auth === 'Bearer ' + JETON, 'faire coucou : le JETON DE L’APPELANT');
    const s = BASE.appels.find((a) => a.fn === 'vrm_coucou_a_sonner');
    dit(s && s.auth === 'Bearer ' + SERVICE && s.args.p_de === MOI && s.args.p_coucou === C1, 'sonner : clé de service, avec l’identité VÉRIFIÉE (pas le « de » du corps)', JSON.stringify(s && s.args));
    const subs = BASE.lectures.filter((l) => /push_subs|push_prefs|push_journal/.test(l.u));
    dit(subs.length > 0 && subs.every((l) => l.u.includes('owner=eq.' + LEA)) && !subs.some((l) => l.u.includes('owner=eq.' + MOI)), 'la notification part au nom de CELUI QUI REÇOIT (ses appareils, sa cloche)', subs.map((l) => l.u.replace(/^.*\/rest\/v1\//, '')).join(' | ').slice(0, 220));
    reset();
    const r0 = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: G });
    const e0 = BASE.appels.find((a) => a.fn === 'vrm_coucou_envoyer');
    dit(r0.code === 200 && e0 && e0.args.p_membre === null, 'sans personne ⇒ au créateur (p_membre null)');
    reset();
    const r1 = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: 'pas-un-uuid', membre: M });
    const r2 = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: G, membre: 'x' });
    dit(r1.code === 404 && r2.code === 404 && !BASE.appels.some((a) => a.fn === 'vrm_coucou_envoyer'), 'un identifiant impossible ⇒ refusé AVANT la base');
    for (const [raison, code] of [['plafond', 429], ['deja', 409], ['indisponible', 409], ['groupe', 404], ['cible', 404]]) {
      reset({ raison });
      const x = await appeler(routeCommunaute, { action: 'accomp-coucou', groupe: G, membre: M });
      dit(x.code === code && x.corps.erreur === raison && x.corps.message && !BASE.appels.some((a) => a.fn === 'vrm_coucou_a_sonner'), `refus « ${raison} » ⇒ ${code}, dit en clair, rien ne sonne`, JSON.stringify(x.corps));
    }
  });

  await essaie('route : habiller, couper, ouvrir', async () => {
    reset();
    let r = await appeler(routeCommunaute, { action: 'accomp-habiller', groupe: G, discord: 'https://evil.example/x', photo: '' });
    dit(r.code === 400 && r.corps.erreur === 'discord-groupe' && !BASE.appels.length, 'un lien qui n’est pas Discord ⇒ refusé AVANT la base');
    r = await appeler(routeCommunaute, { action: 'accomp-habiller', groupe: G, discord: '', photo: 'data:image/svg+xml;base64,PHN2Zz4=' });
    dit(r.code === 400 && r.corps.erreur === 'photo' && !BASE.appels.length, 'une photo qui n’est pas un JPEG ⇒ refusée AVANT la base');
    r = await appeler(routeCommunaute, { action: 'accomp-habiller', groupe: G, discord: 'https://discordapp.com/invite/abcd', photo: '' });
    const h = BASE.appels.find((a) => a.fn === 'vrm_accomp_habiller');
    dit(r.code === 200 && h && h.args.p_discord === 'https://discord.com/invite/abcd' && h.args.p_photo === null, 'un lien propre part (discordapp ⇒ discord.com)', JSON.stringify(h && h.args));
    reset();
    r = await appeler(routeCommunaute, { action: 'accomp-coucou-sourdine', coucou: C1, oui: 'oui' });
    const so = BASE.appels.find((a) => a.fn === 'vrm_coucou_sourdine');
    dit(so && so.args.p_oui === false, 'couper : seul un `true` explicite coupe');
    reset();
    r = await appeler(routeCommunaute, { action: 'accomp-coucou-ouvrir', adhesion: M, oui: 1 });
    const ou = BASE.appels.find((a) => a.fn === 'vrm_coucou_ouvrir');
    dit(ou && ou.args.p_oui === false, 'ouvrir aux autres membres : seul un `true` explicite ouvre (non par défaut)');
  });


  await essaie('la carte : le coucou remplace les messages', async () => {
    reset({ installe: false });
    let r = await appeler(routeCommunaute, { action: 'carte-coucou-lire' });
    dit(r.code === 503 && r.corps.erreur === 'non-installe' && /bientôt/.test(r.corps.message), 'carte, 047 absente ⇒ « bientôt », jamais une liste vide ni un message', JSON.stringify(r.corps));
    reset();
    for (const action of ['ecrire', 'fil', 'bloquer', 'signaler']) {
      const x = await appeler(routeCommunaute, { action, pid: M, conv: G, texte: 'Salut' });
      dit(x.code === 410 && x.corps.erreur === 'retire' && /Discord/.test(x.corps.message) && !BASE.appels.some((a) => /vrm_communaute_(ecrire|fil)/.test(a.fn)), `« ${action} » : retiré (410), rien ne part à la base`, JSON.stringify(x.corps));
    }
    r = await appeler(routeCommunaute, { action: 'carte-coucou', pid: M, texte: 'Coucou, on échange ?' });
    const env = BASE.appels.find((a) => a.fn === 'vrm_carte_coucou');
    dit(r.code === 200 && env && Object.keys(env.args).join() === 'p_pid' && env.auth === 'Bearer ' + JETON, 'coucou de la carte : seul le pid public part, avec le jeton de l’appelant', env && env.corps);
    const s = BASE.appels.find((a) => a.fn === 'vrm_carte_coucou_a_sonner');
    dit(s && s.args.p_de === MOI && s.auth === 'Bearer ' + SERVICE, 'sonner : clé de service, identité vérifiée');
    dit(BASE.lectures.some((l) => /push_(subs|prefs|journal)/.test(l.u) && l.u.includes('owner=eq.' + LEA)), 'la notification part chez celui qui reçoit');
    reset();
    BASE.lignesDiscord = [{ owner: LEA, discord: 'lea_invente', did: DID, signatureId: AV.signerIdDiscord(LEA, 'lea_invente', DID) }];
    r = await appeler(routeCommunaute, { action: 'carte-coucou-lire' });
    const recus = (r.corps.coucou || {}).recus || [];
    dit(r.code === 200 && recus[0] && recus[0].profil === DID && recus[1] && recus[1].profil === null && !JSON.stringify(r.corps).includes(LEA), 'coucous reçus : le profil Discord signé, sinon rien ; aucun compte renvoyé', JSON.stringify(r.corps).slice(0, 200));
    const src = fs.readFileSync(path.join(TMP, 'src/communaute/Communaute.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    dit(!/<textarea\b/.test(src) && !/data-cm-texte|data-cm-envoyer|action: 'ecrire'|'fil'/.test(src), 'l’écran de la carte : aucun champ de message, aucune action « écrire » ni « fil »');
    dit(!/data-cm-conv\b|data-cm-nonlus/.test(src), 'plus de liste de conversations ni de « non lus »');
  });

  await essaie('fermer mon compte', async () => {
    reset();
    const n = await effacerCommunaute(MOI, SERVICE);
    dit(BASE.appels.some((a) => a.fn === 'vrm_coucou_effacer' && a.args.p_owner === MOI && a.auth === 'Bearer ' + SERVICE), '« Fermer mon compte » détache aussi les coucous (clé de service)', n);
    reset({ installe: false });
    dit(await effacerCommunaute(MOI, SERVICE) !== null, 'sans la 046 : 0 de ce côté, la fermeture continue');
  });

  await essaie('l’écran : un signe, jamais un message', () => {
    const src = fs.readFileSync(path.join(TMP, 'src/communaute/Accompagnement.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const appel = (src.match(/api\(\{ action: 'accomp-coucou',[^}]*\}\)/) || [''])[0];
    dit(/^api\(\{ action: 'accomp-coucou', groupe, membre: cible\.cible \}\)$/.test(appel), 'le bouton n’envoie que le groupe et la personne', appel);
    const fn = (nom) => { const i = src.indexOf('function ' + nom + '('); if (i < 0) return ''; const fins = ['\nfunction ', '\nexport '].map((x) => src.indexOf(x, i + 10)).filter((x) => x > 0); return src.slice(i, fins.length ? Math.min(...fins) : undefined); };
    for (const nom of ['BoutonCoucou', 'CoucousRecus']) dit(fn(nom) && !/<(input|textarea|select)\b|contentEditable/i.test(fn(nom)), `${nom} : aucun champ de saisie`);
    dit(!/accomp-coucou-(repondre|message|ecrire|texte)|action: 'ecrire'/.test(src), 'aucune action « répondre » ni « écrire » dans les groupes');
    const recus = fn('CoucousRecus');
    dit((recus.match(/<a\b/g) || []).length === 1 && /data-cm-coucou-ecrire="aucun"/.test(recus) && (recus.match(/<button\b/g) || []).length === 1, 'un coucou reçu : UN geste (« Lui écrire sur Discord » ou « Pas de Discord lié ») + « ⋯ » (couper)');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
