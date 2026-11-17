require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMMUNAUTÉ : AUCUN MESSAGE DANS L'APP, LE COUCOU VA SUR DISCORD » (17 nov.)
//  BANC_PORT=7993 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/communaute-sans-message.cjs
//  (CAPTURES=dossier ; BANC_MUTATION=paire-un-sens | sans-sourdine : le faux base réaffaiblit ⇒ ROUGE)
//
//  Julien : « que les personnes puissent se faire coucou, mais pas échanger des
//  messages dans mon app, mais sur Discord ». Le VRAI api/compte.js est exécuté ;
//  le faux PostgREST applique les règles de la 018 (carte), 025, 046 et 047.
//  Juge, à 390 px tactile (clair, sombre) et 1512 px :
//   · dans TOUTES les vues de Communauté (Carte, Classement, Groupes, la feuille
//     des personnes d'un endroit, les coucous reçus) : AUCUN champ de message —
//     ni zone de texte, ni champ éditable, ni bouton « Écrire » / « Envoyer », ni
//     liste de conversations ou « non lus » ; un champ de saisie visible n'est
//     permis que s'il est sur la liste des champs de FORMULAIRE (pseudo, ville,
//     pseudo Discord, nom et phrase d'un groupe, code, lien Discord d'un groupe) ;
//   · le « 👋 Coucou » de la carte : la requête ne porte QUE le pid public ;
//     aucun message n'est écrit (la route d'avant n'est plus appelée) ;
//   · celui qui le reçoit : « Pas de Discord lié » (rien d'autre), puis — l'auteur
//     a relié son Discord (signé) — « Lui écrire sur Discord » vers SON profil ;
//   · une paire, un coucou par 24 h (il ne peut pas le rendre) ; couper ⇒ plus rien ;
//   · sans la 047 : « Coucou : bientôt », et toujours aucun champ de message.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 7993);
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const MUTATION = process.env.BANC_MUTATION || '';
const CAPTURES = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
process.env.SUPABASE_SERVICE_KEY = 'eyJ.cle-de-service-du-banc';
process.env.DISCORD_CLIENT_SECRET = 'secret-discord-du-banc';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + String(d).slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };

// ── Les personnes (inventées) ────────────────────────────────────────────────
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', Ca = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice.secret@exemple.test', login: 'alice_vinted_secret' }, [Bu]: { id: Bu, email: 'bruno.secret@exemple.test', login: 'bruno_vinted_secret' }, [Ca]: { id: Ca, email: 'carla.secret@exemple.test', login: 'carla_vinted_secret' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });
const DID_A = '123456789012345678';
// Une petite image (PNG 8×8, inventée) pour la photo du groupe.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAACiElEQVR4nO3aV0oDURTG8XvFxdgbQRD00W6KLiAgYi/P7kPdhZiMKcZYUnQJ6hLcxvgwIIJmvkjuOTMZvh95EJLAuYc/YcbEDp1/Gups0Bo/6hlibdBaLigMCwJYEMCCABYEsCCABQEsCGBBAAsCWBDAggAWBLAggAUBLAhgQQALAlgQwIIAFgSwIIAFASwIYEEACwJiUdBD7qbTU4vFLc1JfouyoHquAF/zvbul4qbwOH+LpqD7bPG/bwm2uezlnA8TTrugWtbr5e3BZle8rJtpujBgra/26HE732pZT23mAWt8ncdd5tbJdgJ3mVudsZUKqmZKDrcTqGZKCSmoki47306gki73fUHldEVoO4FyutLHBZU2qqLbCZQ2qnJHiMWVdO/kTiFYkLdeExr6N2+9xoIAoYNIFVRYq0uMG6KwVmdBgMRZEvX/IImziFwHXa8+OR+0G9erT87PkqiCjEBEifoMMgIfQywIYEEACwJYEMCCABYEiNyL5R/n3E7ZpfzjHO/FwvBeDOibezFr/e3nWeezhtt+npU4SHIKEjqI4LcaO42UxMR/2mmkhE6RkILkTiH7vdhuc0Zo7p92mzNyRxD/ZnWvOS26nb3mtOj8Gt/N77emhLaz35qSHl7p1x0HrUnn2zloTSpMrvf7oMP2hMPtHLYndMbW+32QNf5Re9zJdo7a42oza9+LHb+MGWOuFt56ebvmzNFcB528jBpjLhfe//sW/WmjvJs/fR0J/riY/4CviWrOWFxJn70Od3oq8vES9f8gCbEoKM5YEMCCABYEsCCABQEsCGBBAAsCWBDAggAWBLAggAUBLAhgQQALAlgQwIIAFgSwIIAFASwIYEEACwK+ALTiKwLH0xBuAAAAAElFTkSuQmCC', 'base64');

// ── La base : les RÈGLES de la 025 et de la 046, en JS ───────────────────────
let B;
const reset = (o = {}) => { B = { carte47: true, profils: {}, ccarte: [], msgs: 0, installe: true, coucou: true, groupes: [], membres: [], partages: {}, habillage: {}, coucous: [], sourdines: [], ouverts: {}, discordComptes: {}, n: 1, reponses: [], envois: [], lectures: [], ...o }; };
const uuid = () => `00000000-0000-4000-8000-${String(B.n++).padStart(12, '0')}`;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeNeuf = () => { let c = ''; for (let i = 0; i < 8; i++) c += ALPHA[(B.n * 7 + i * 13 + B.groupes.length * 3) % 32]; B.n++; return c; };
const niveau = (p) => (p === 'detail' ? 2 : p === 'chiffres' ? 1 : 0);
const gDe = (id) => B.groupes.find((g) => g.id === id);
const vue = (m) => ({ id: m.id, nom: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, partage_le: m.partage_le, ...(m.statut === 'accepte' && niveau(m.partage) >= 1 ? { chiffres: null, chiffres_le: null } : {}) });
const H24 = 24 * 3600e3;
const role = (g, o) => { const x = gDe(g); if (!x || x.ferme) return null; if (x.cree_par === o) return 'createur'; return B.membres.some((m) => m.groupe === g && m.owner === o && m.statut === 'accepte') ? 'membre' : null; };
const ouvert = (mid) => B.ouverts[mid] === true;
const recent = (x, y) => B.coucous.some((c) => (MUTATION === 'paire-un-sens' ? (c.de === x && c.a === y) : ((c.de === x && c.a === y) || (c.de === y && c.a === x))) && Date.now() - c.t < H24);
const nomDans = (g, o) => { const x = gDe(g); if (x && x.cree_par === o) return x.createur; const m = B.membres.find((y) => y.groupe === g && y.owner === o); return m ? m.nom : ''; };
const muet = (qui, de) => B.sourdines.some((s) => s.owner === qui && s.muet === de && s.actif);
function rpc(fn, a, uid, service) {
  if (fn === 'vrm_communaute_carte') {
    const pr = (o) => ({ ...B.profils[o], moi: o === uid, premier: false });
    return { acces: true, moi: B.profils[uid] ? { ...B.profils[uid] } : null, profils: Object.keys(B.profils).map(pr), groupes: [] };
  }
  if (fn === 'vrm_communaute_conversations' || fn === 'vrm_communaute_fil') return [];
  if (fn === 'vrm_communaute_ecrire') { B.msgs++; return { ok: true, conv: uuid() }; }
  if (/^vrm_carte_coucou/.test(fn)) {
    if (!B.carte47) return undefined;
    const ownerDe = (pid) => Object.keys(B.profils).find((o) => B.profils[o].pid === pid);
    const recentC = (x, y) => recent(x, y) || B.ccarte.some((c) => (MUTATION === 'paire-un-sens' ? (c.de === x && c.a === y) : ((c.de === x && c.a === y) || (c.de === y && c.a === x))) && Date.now() - c.t < H24);
    if (fn === 'vrm_carte_coucou_a_sonner') { if (!service) return 'refus'; const c = B.ccarte.find((x) => x.id === a.p_coucou && x.de === a.p_de); return c ? { a: c.a, de_nom: B.profils[c.de].pseudo } : null; }
    if (fn === 'vrm_carte_coucou_auteurs') { if (!service) return 'refus'; return B.ccarte.filter((c) => c.a === a.p_a).map((c) => ({ id: c.id, de: c.de })); }
    if (service) return 'refus';
    if (fn === 'vrm_carte_coucou') {
      B.envois.push({ uid, a, carte: true });
      if (!B.profils[uid]) return { ok: false, raison: 'carte' };
      const cible = ownerDe(a.p_pid); if (!cible) return { ok: false, raison: 'cible' };
      if (cible === uid) return { ok: false, raison: 'soi' };
      if (MUTATION !== 'sans-sourdine' && muet(cible, uid)) return { ok: false, raison: 'indisponible' };
      if (recentC(uid, cible)) return { ok: false, raison: 'deja' };
      const c = { id: uuid(), de: uid, a: cible, t: Date.now() }; B.ccarte.push(c); return { ok: true, id: c.id };
    }
    if (fn === 'vrm_carte_coucou_lire') return { acces: true, envoyes24h: B.ccarte.filter((c) => c.de === uid && Date.now() - c.t < H24).length, plafond: 20,
      deja: Object.keys(B.profils).filter((o) => o !== uid && recentC(uid, o)).map((o) => B.profils[o].pid),
      recus: B.ccarte.filter((c) => c.a === uid && B.profils[c.de] && !muet(uid, c.de)).map((c) => ({ id: c.id, de_pid: B.profils[c.de].pid, de_nom: B.profils[c.de].pseudo, le: new Date(c.t).toISOString() })), sourdines: [] };
    if (fn === 'vrm_carte_coucou_sourdine') { const c = B.ccarte.find((x) => x.id === a.p_coucou && x.a === uid); if (!c) return { ok: false, raison: 'coucou' };
      let s = B.sourdines.find((x) => x.owner === uid && x.muet === c.de); if (!s) { s = { owner: uid, muet: c.de }; B.sourdines.push(s); } s.actif = a.p_oui === true; return { ok: true }; }
    return undefined;
  }
  const now = new Date().toISOString();
  if (/^vrm_(coucou_|accomp_habiller)/.test(fn)) {
    if (!B.coucou) return undefined;
    if (fn === 'vrm_coucou_a_sonner') { if (!service) return 'refus'; const c = B.coucous.find((x) => x.id === a.p_coucou && x.de === a.p_de); return c ? { a: c.a, de_nom: nomDans(c.groupe, c.de), groupe_nom: gDe(c.groupe).nom } : null; }
    if (fn === 'vrm_coucou_auteurs') { if (!service) return 'refus'; return B.coucous.filter((c) => c.a === a.p_a).map((c) => ({ id: c.id, de: c.de })); }
    if (service) return 'refus';
    if (fn === 'vrm_coucou_lire') {
      const mes = [...B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ g, r: 'createur' })),
        ...B.membres.filter((m) => m.owner === uid && m.statut === 'accepte' && !gDe(m.groupe).ferme).map((m) => ({ g: gDe(m.groupe), r: 'membre', adh: m.id }))];
      return { acces: true, envoyes24h: B.coucous.filter((c) => c.de === uid && Date.now() - c.t < H24).length, plafond: 20,
        groupes: mes.map(({ g, r, adh }) => ({ groupe: g.id, discord: (B.habillage[g.id] || {}).discord || null, photo: (B.habillage[g.id] || {}).photo || null, ouvert: r === 'membre' ? ouvert(adh) : null,
          cibles: r === 'createur' ? B.membres.filter((m) => m.groupe === g.id && m.statut === 'accepte').map((m) => ({ cible: m.id, role: 'membre', nom: m.nom, deja: recent(uid, m.owner) }))
            : [{ cible: null, role: 'createur', nom: g.createur, deja: recent(uid, g.cree_par) }, ...(ouvert(adh) ? B.membres.filter((m) => m.groupe === g.id && m.statut === 'accepte' && m.owner !== uid && ouvert(m.id)).map((m) => ({ cible: m.id, role: 'membre', nom: m.nom, deja: recent(uid, m.owner) })) : [])] })),
        recus: B.coucous.filter((c) => c.a === uid && role(c.groupe, uid) && !(MUTATION !== 'sourdine-visible' && muet(uid, c.de))).sort((x, y) => y.t - x.t).map((c) => ({ id: c.id, groupe: c.groupe, groupe_nom: gDe(c.groupe).nom, de_nom: nomDans(c.groupe, c.de), le: new Date(c.t).toISOString(), discord_groupe: (B.habillage[c.groupe] || {}).discord || null })),
        sourdines: B.sourdines.filter((s) => s.owner === uid && s.actif).map((s) => { const c = B.coucous.find((x) => x.de === s.muet && x.a === uid); return { coucou: c.id, nom: nomDans(c.groupe, c.de) }; }) };
    }
    if (fn === 'vrm_coucou_envoyer') {
      B.envois.push({ uid, a });
      const r = role(a.p_groupe, uid); if (!r && MUTATION !== 'hors-groupe') return { ok: false, raison: 'groupe' };
      let cible;
      if (a.p_membre == null) { if (r === 'createur') return { ok: false, raison: 'soi' }; cible = gDe(a.p_groupe).cree_par; }
      else {
        const m = B.membres.find((x) => x.id === a.p_membre && x.groupe === a.p_groupe && x.statut === 'accepte'); if (!m) return { ok: false, raison: 'cible' };
        if (m.owner === uid) return { ok: false, raison: 'soi' };
        if (r === 'membre') { const moiM = B.membres.find((x) => x.groupe === a.p_groupe && x.owner === uid); if (!(ouvert(moiM.id) && ouvert(m.id))) return { ok: false, raison: 'cible' }; }
        cible = m.owner;
      }
      if (MUTATION !== 'sans-sourdine' && muet(cible, uid)) return { ok: false, raison: 'indisponible' };
      if (recent(uid, cible)) return { ok: false, raison: 'deja' };
      if (B.coucous.filter((c) => c.de === uid && Date.now() - c.t < H24).length >= 20) return { ok: false, raison: 'plafond' };
      const c = { id: uuid(), de: uid, a: cible, groupe: a.p_groupe, t: Date.now() }; B.coucous.push(c);
      return { ok: true, id: c.id };
    }
    if (fn === 'vrm_coucou_sourdine') { const c = B.coucous.find((x) => x.id === a.p_coucou && x.a === uid); if (!c) return { ok: false, raison: 'coucou' };
      let s = B.sourdines.find((x) => x.owner === uid && x.muet === c.de); if (!s) { s = { owner: uid, muet: c.de }; B.sourdines.push(s); } s.actif = a.p_oui === true; return { ok: true, sourdine: s.actif }; }
    if (fn === 'vrm_coucou_ouvrir') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; B.ouverts[m.id] = a.p_oui === true; return { ok: true, ouvert: a.p_oui === true }; }
    if (fn === 'vrm_accomp_habiller') { const g = gDe(a.p_groupe); if (!g || g.cree_par !== uid) return { ok: false, raison: 'pas-createur' }; B.habillage[g.id] = { discord: a.p_discord || null, photo: a.p_photo || null }; return { ok: true }; }
    return undefined;
  }
  if (!fn.startsWith('vrm_accomp_') || !B.installe || service) return undefined;
  if (fn === 'vrm_accomp_lire') return { acces: true,
    crees: B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ id: g.id, nom: g.nom, description: g.description, code: g.code, createur: g.createur, cree_le: g.cree_le, membres: B.membres.filter((m) => m.groupe === g.id && ['attente', 'accepte'].includes(m.statut)).map(vue) })),
    rejoints: B.membres.filter((m) => m.owner === uid && m.statut !== 'parti').map((m) => { const g = gDe(m.groupe); return { id: m.id, groupe: g.id, nom: g.nom, description: g.description, createur: g.createur, moi: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, ferme: !!g.ferme, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length }; }),
    niveau: 0, publie: null };
  if (fn === 'vrm_accomp_creer') { const g = { id: uuid(), nom: a.p_nom, description: a.p_description, code: codeNeuf(), cree_par: uid, createur: a.p_createur, cree_le: now }; B.groupes.push(g); return { ok: true, id: g.id, code: g.code, nom: g.nom }; }
  if (fn === 'vrm_accomp_apercu') { const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' }; const m = B.membres.find((x) => x.groupe === g.id && x.owner === uid); return { ok: true, nom: g.nom, description: g.description, createur: g.createur, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length, createur_moi: g.cree_par === uid, statut: m ? m.statut : null }; }
  if (fn === 'vrm_accomp_demander') { const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' }; const m = { id: uuid(), groupe: g.id, owner: uid, nom: a.p_nom, statut: 'attente', partage: a.p_partage, demande_le: now }; B.membres.push(m); return { ok: true, id: m.id, nom: g.nom, statut: 'attente' }; }
  if (fn === 'vrm_accomp_decider') { const m = B.membres.find((x) => x.id === a.p_membre); if (!m || gDe(m.groupe).cree_par !== uid) return { ok: false, raison: 'pas-createur' }; m.statut = a.p_oui === true ? 'accepte' : 'refuse'; m.decide_le = now; return { ok: true, statut: m.statut }; }
  if (fn === 'vrm_accomp_ce_que_voit') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); return m ? { acces: true, vue: vue(m) } : { acces: true, erreur: 'adhesion' }; }
  if (fn === 'vrm_accomp_partage') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; m.partage = a.p_partage; return { ok: true, partage: m.partage, niveau: niveau(m.partage) }; }
  return { ok: true };
}

function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const service = tok === process.env.SUPABASE_SERVICE_KEY;
  const qui = JETONS[tok]; const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin] = u.split('?');
  if (/\/auth\/v1\/admin\//.test(chemin)) return json({ id: 'x', user_metadata: {} });
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z', identities: [] }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces' || fn === 'vrm_acces_pour') return json(fn === 'vrm_acces' ? { obligatoire: false, proprietaire: false, acces: true } : true);
    if (!uid && !service) return json({ message: 'permission denied' }, 401);
    const r = rpc(fn, (corps && corps.json) || {}, uid, service);
    if (r === undefined) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
    if (r === 'refus') return json({ message: 'permission denied' }, 403);
    return json(r);
  }
  if (service) B.lectures.push(u);
  if (service && cible.startsWith('app_data') && /id=eq\.vrm_discord/.test(u)) {
    const m = /owner=in\.\(([^)]*)\)/.exec(u); const ow = m ? m[1].split(',') : [];
    return json(ow.filter((o) => B.discordComptes[o]).map((o) => ({ owner: o, ...B.discordComptes[o] })));
  }
  if (cible.startsWith('vinted_accounts') && /owner\.neq\./.test(u)) return json([]);
  if (cible.startsWith('vinted_accounts')) return json(uid ? [{ vinted_user_id: '1' + uid.slice(0, 3), login: USERS[uid].login, owner: uid }] : []);
  return json([], 200, { 'content-range': '0-0/0' });
}
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || '{}'); } catch (_) { return {}; } })() });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/api\.stripe\.com|discord|push|fcm|mozilla/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, chemin = '/?tab=communaute', partage = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.addInitScript(({ s, sombre, partage }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    // Un vendeur déjà installé : ni Bienvenue, ni parcours, ni « Tu vends quoi ? » par-dessus l'écran.
    try { const at = '2026-11-01T10:00:00.000Z';
      localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
      localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at, statut: null, version: 1 }));
      localStorage.setItem('vrm_parcours_nouveau', JSON.stringify({ etape: 'fin', fini: true, at }));
      localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: 'sneakers', at, vu: at }));
      localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); } catch (_) {}
    // La feuille de partage d'iOS : un faux qui note ce qu'on lui donne (le banc ne quitte pas la page).
    if (partage) { window.__partages = []; navigator.share = (d) => { window.__partages.push(d); return Promise.resolve(); }; }
    else { try { delete Navigator.prototype.share; } catch (_) {} try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (_) {} }
  }, { s: session(qui), sombre, partage });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || '{}'); } catch (_) { return {}; } })() });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    return r.abort();
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && (mode === 'communaute' || mode === 'abonnement' || mode === 'confidentialite')) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const lecteur = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return lecteur ? lecteur[Symbol.asyncIterator]() : (async function* () {})(); } };
      await compte(req, res);
      const body = JSON.stringify(res.corps);
      if (mode === 'communaute') B.reponses.push({ qui, action: corps && corps.action, corps, body });
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(400);
  if (process.env.BANC_DEBUG) { await pg.screenshot({ path: process.env.BANC_DEBUG }); console.log('DEBUG', erreurs.join(' | ').slice(0, 300)); }
  return { ctx, pg, erreurs };
}
const aller = async (pg) => {
  if (!(await pg.$('[data-cm-vue-active="groupes"]'))) await pg.click('[data-cm-vue="groupes"]');
  await pg.waitForSelector('[data-cm-accomp]:not([data-cm-accomp="charge"])', { timeout: 10000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-cm-coucou-etat]'); return !e || e.getAttribute('data-cm-coucou-etat') !== 'charge'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(250);
};
const recharger = async (pg) => { await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {}); await aller(pg); };
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const capture = async (pg, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } };
const cibles = (pg) => pg.$$eval('[data-cm-vue-active="groupes"] button, [data-cm-vue-active="groupes"] a, .vrm-gc-feuille button, .vrm-gc-feuille a, .vrm-cm-partage-option', (e) => e.filter((b) => b.offsetParent && !b.closest('.vrm-cm-onglets, .vrm-cm-tableau')).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const pleins = (pg, portee) => pg.$$eval(portee + ' .vrm-cm-primaire', (e) => e.filter((b) => b.offsetParent).length);
const air = (pg) => pg.evaluate(() => {
  const cartes = [...document.querySelectorAll('.vrm-gc-groupe')].filter((e) => e.offsetParent).map((e) => { const s = getComputedStyle(e); return Math.min(parseFloat(s.paddingLeft), parseFloat(s.paddingTop), parseFloat(s.paddingRight)); });
  const rangees = [...document.querySelectorAll('.vrm-gc-liste > li')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height));
  return { carte: cartes.length ? Math.min(...cartes) : null, rangee: rangees.length ? Math.min(...rangees) : null };
});
const secretsDans = (s, autre) => [autre, USERS[autre].email, USERS[autre].login].filter((x) => s.includes(x));


// Les champs de FORMULAIRE permis (jamais un message) : tout autre champ visible est un rouge.
const PERMIS = ['data-cm-pseudo', 'data-cm-ville', 'data-cm-discord-champ', 'data-cm-discord-saisie', 'data-cm-accomp-nom', 'data-cm-accomp-description', 'data-cm-accomp-createur',
  'data-cm-accomp-code-tape', 'data-cm-accomp-moi', 'data-cm-accomp-discord-champ', 'data-cm-accomp-photo', 'data-cm-accomp-niveau', 'data-cm-coucou-ouvrir'];
const champsMessage = (pg) => pg.evaluate((permis) => {
  const zone = [...document.querySelectorAll('.vrm-communaute')];
  const champs = zone.flatMap((z) => [...z.querySelectorAll('textarea, input, [contenteditable=""], [contenteditable="true"]')]).filter((e) => e.offsetParent || e.type === 'file');
  const mauvais = champs.filter((e) => e.tagName === 'TEXTAREA' && !e.hasAttribute('data-cm-accomp-description') || e.isContentEditable || !permis.some((a) => e.hasAttribute(a)));
  const boutons = zone.flatMap((z) => [...z.querySelectorAll('button, a')]).filter((b) => b.offsetParent && /^(Écrire|Envoyer|Répondre)\b/.test((b.textContent || '').trim()));
  const fils = zone.flatMap((z) => [...z.querySelectorAll('[data-cm-conv], [data-cm-nonlus], [data-cm-fil], [data-cm-texte], [data-cm-ecrire], [data-cm-premier-message]')]);
  return [...mauvais.map((e) => e.outerHTML.slice(0, 90)), ...boutons.map((b) => 'bouton ' + b.textContent.trim()), ...fils.map((e) => e.outerHTML.slice(0, 90))];
}, PERMIS);
const toutesLesVues = async (pg, etq) => {
  const trouves = [];
  for (const vue of ['carte', 'classement', 'groupes']) {
    if (await pg.$(`[data-cm-vue="${vue}"]`)) { await pg.click(`[data-cm-vue="${vue}"]`); await pg.waitForTimeout(700); }
    trouves.push(...(await champsMessage(pg)).map((x) => vue + ' : ' + x));
  }
  await pg.click('[data-cm-vue="carte"]'); await pg.waitForTimeout(600);
  return trouves;
};
const ouvrirPersonnes = async (pg) => {
  if (await pg.$('[data-cm-pin]')) await pg.click('[data-cm-pin]');
  else if (await pg.$('[data-cm-liste-secours] button')) await pg.click('[data-cm-liste-secours] button');
  await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
};

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  const AV = await import('file://' + path.join(RACINE, 'api', '_lib', 'avatar-discord.js')).catch(() => ({}));
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  const surCarte = () => {
    B.profils[A] = { pid: '11111111-aaaa-4aaa-8aaa-111111111111', pseudo: 'alice_carte', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, depuis: '2026-11-01T00:00:00Z', discord: null };
    B.profils[Bu] = { pid: '22222222-bbbb-4bbb-8bbb-222222222222', pseudo: 'bruno_carte', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, depuis: '2026-11-02T00:00:00Z', discord: null };
  };
  try {
    for (const [largeur, sombre, nomTheme] of [[390, false, '390-clair'], [390, true, '390-sombre'], [1512, false, '1512-clair']]) {
      console.log(`\n── ${nomTheme} · Alice fait coucou à Bruno sur la carte`);
      reset(); surCarte();
      // Un groupe (025/046) où Bruno est membre : la page Groupes est jugée aussi.
      B.groupes.push({ id: '33333333-cccc-4ccc-8ccc-333333333333', nom: 'Groupe du banc', description: '', code: 'ABCDEFGH', cree_par: A, createur: 'Coach Alice', cree_le: new Date().toISOString() });
      B.membres.push({ id: '44444444-dddd-4ddd-8ddd-444444444444', groupe: '33333333-cccc-4ccc-8ccc-333333333333', owner: Bu, nom: 'Bruno', statut: 'accepte', partage: 'rien', demande_le: new Date().toISOString() });
      await essaie(`coucou ${nomTheme}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur, sombre });
        const trouves = await toutesLesVues(pg, nomTheme);
        dit(trouves.length === 0, 'Carte, Classement, Groupes : AUCUN champ de message, aucun « Écrire », aucune conversation', trouves.slice(0, 4).join(' | '));
        await ouvrirPersonnes(pg);
        const f = await champsMessage(pg);
        dit(f.length === 0 && !!(await pg.$(`[data-cm-coucou="${B.profils[Bu].pid}"]`)), 'la feuille d’un endroit : un bouton « 👋 Coucou », aucun champ de message', f.join(' | '));
        if (nomTheme !== '1512-clair') await capture(pg, 'carte-personnes-' + nomTheme);
        await pg.click(`[data-cm-coucou="${B.profils[Bu].pid}"]`);
        await pg.waitForFunction(() => /Coucou envoyé/.test(document.body.innerText), null, { timeout: 6000 }).catch(() => {});
        const req = B.reponses.filter((r) => r.action === 'carte-coucou');
        dit(B.ccarte.length === 1 && req.length === 1 && Object.keys(req[0].corps).sort().join() === 'action,pid', 'le coucou part : la requête ne porte que le pid public', req[0] && JSON.stringify(req[0].corps));
        dit(B.msgs === 0 && !B.reponses.some((r) => ['ecrire', 'fil'].includes(r.action)), 'aucun message écrit, aucune conversation lue');
        dit(B.lectures.some((u) => /push_(subs|prefs|journal)/.test(u) && u.includes('owner=eq.' + Bu)), 'la notification part chez Bruno');
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
        await ctx.close();
      });
      await essaie(`recevoir ${nomTheme}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { qui: Bu, largeur, sombre });
        await pg.waitForSelector('[data-cm-coucou-recu]', { timeout: 8000 });
        dit(/alice_carte t’a fait coucou/.test(await texte(pg)) && await attr(pg, '[data-cm-coucou-ecrire]', 'data-cm-coucou-ecrire') === 'aucun' && !(await pg.$('[data-cm-coucou-recu] a')), 'Bruno : « alice_carte t’a fait coucou » — pas de Discord relié ⇒ « Pas de Discord lié », AUCUN autre geste');
        dit(await attr(pg, `[data-cm-coucou="${B.profils[A].pid}"]`, 'data-etat') === 'deja' || !(await pg.$(`[data-cm-coucou="${B.profils[A].pid}"]`)) && await (async () => { await ouvrirPersonnes(pg); return await attr(pg, `[data-cm-coucou="${B.profils[A].pid}"]`, 'data-etat') === 'deja'; })(), 'il ne peut pas le rendre dans les 24 h (une paire, un coucou)');
        await pg.keyboard.press('Escape').catch(() => {}); await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' });
        if (AV.signerIdDiscord) B.discordComptes[A] = { discord: 'alice_banc', did: DID_A, signatureId: AV.signerIdDiscord(A, 'alice_banc', DID_A), avatar: null, pid: '', signatureAvatar: null };
        await pg.waitForSelector('[data-cm-coucou-recu]', { timeout: 15000 });
        dit(await attr(pg, '[data-cm-coucou-ecrire]', 'data-cm-coucou-ecrire') === 'profil' && await attr(pg, '[data-cm-coucou-ecrire]', 'href') === `https://discord.com/users/${DID_A}`, 'Alice a relié son Discord ⇒ « Lui écrire sur Discord » ouvre SON profil', await attr(pg, '[data-cm-coucou-ecrire]', 'href'));
        await capture(pg, 'carte-recu-' + nomTheme);
        const trouves = await toutesLesVues(pg, nomTheme);
        dit(trouves.length === 0, 'chez Bruno non plus, aucun champ de message', trouves.slice(0, 4).join(' | '));
        await pg.click('[data-cm-coucou-plus]');
        await pg.waitForSelector('[data-cm-coucou-sourdine]', { timeout: 5000 });
        await pg.click('[data-cm-coucou-sourdine]');
        await pg.waitForFunction(() => !document.querySelector('[data-cm-coucou-recu]'), null, { timeout: 6000 }).catch(() => {});
        dit(!(await pg.$('[data-cm-coucou-recu]')), 'couper Alice : son coucou disparaît');
        for (const c of B.ccarte) c.t -= 25 * 3600e3;
        const x = await pg.evaluate(async ([pid, jeton]) => { const r = await fetch('/api/compte?mode=communaute', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jeton }, body: JSON.stringify({ action: 'carte-coucou', pid }) }); return r.status; }, [B.profils[Bu].pid, jetonDe(A)]);
        dit(x !== 200 && B.ccarte.length === 1, '25 h plus tard, Alice coupée ne passe pas', x);
        const y = await pg.evaluate(async (jeton) => { const r = await fetch('/api/compte?mode=communaute', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jeton }, body: JSON.stringify({ action: 'ecrire', pid: '11111111-aaaa-4aaa-8aaa-111111111111', texte: 'Salut' }) }); return r.status; }, jetonDe(Bu));
        dit(y === 410 && B.msgs === 0, 'écrire un message par la route : retiré (410), rien n’est écrit', y);
        await ctx.close();
      });
    }

    console.log('\n── 390 px sombre · sans la 047');
    reset({ carte47: false }); surCarte();
    await essaie('sans 047', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur: 390, sombre: true });
      await pg.waitForSelector('[data-cm-coucous-carte="non-installe"]', { timeout: 8000 }).catch(() => {});
      dit(!!(await pg.$('[data-cm-coucous-carte="non-installe"]')), 'la carte dit « Le coucou de la carte arrive bientôt »');
      await ouvrirPersonnes(pg);
      dit(!!(await pg.$('[data-cm-coucou-bientot]')) && !(await pg.$('[data-cm-coucou]')), 'la personne : « Coucou : bientôt », aucun bouton');
      const f = await champsMessage(pg);
      dit(f.length === 0 && B.msgs === 0, 'et AUCUN repli vers un message', f.join(' | '));
      await capture(pg, 'carte-sans-047-390-sombre');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
