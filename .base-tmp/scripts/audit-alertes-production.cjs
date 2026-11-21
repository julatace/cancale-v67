#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES ALERTES DE PRODUCTION (11 nov.)
//          node scripts/audit-alertes-production.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//   P  la règle pure (api/_lib/alertes-production.js) : regroupement à l'heure +
//      compteur, interrupteur, filtre des données personnelles, 30 jours ;
//   R  la VRAIE route api/compte.js?mode=alertes : propriétaire seul, 403
//      sinon, interrupteur écrit sur son clic ;
//   S  la VRAIE route api/ship-reminders.js?moment=sondes : une sonde dégradée
//      2 fois ⇒ UNE alerte ; muette 3 fois ⇒ UNE alerte dite « pas de réponse » ;
//   C  la VRAIE route ?moment=colis : la sélection en panne 2 passages de suite
//      ⇒ UNE alerte ; un passage ⇒ rien ;
//   E  la VRAIE route api/email-inbound.js : 3 réponses 503 en une heure ⇒ UNE
//      alerte (2 ⇒ rien) ;
//   G  la purge des erreurs de plus de 30 jours (ce qui est plus récent reste).
// Fausses bases de forme PostgREST, push simulé. Données inventées (dépôt public).
// `--prouve` : réaffaiblit le code, une mutation à la fois ⇒ ROUGE exigé.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const PG = require(path.join(__dirname, 'bancs', '_minipgrest.cjs'));

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['plus de regroupement à l’heure', 'api/_lib/alertes-production.js', '  if (a.notifieA && maintenant - (ms(a.notifieA) || 0) < GROUPE_MS) return null;\n', ''],
    ['le filtre des données personnelles retiré', 'api/_lib/alertes-production.js', "  return nettoyer(String(texte || ''))\n    .replace(/@[\\w.-]{2,}/g, '{pseudo}')", "  return (String(texte || ''))"],
    ['l’interrupteur ignoré', 'api/_lib/alertes-production.js', '  if (!typeActif(d.reglages, a.type)) { a.coupe = true; return null; }\n', ''],
    ['gardées 30 jours ⇒ pour toujours', 'api/_lib/alertes-production.js', 'maintenant - (ms(a.dernier) || 0) > GARDE_MS) delete d.alertes[k];', 'false) delete d.alertes[k];'],
    ['une sonde muette alerte dès la 1re fois', 'api/_lib/statut-sondes.js', 'export const MUETTES_POUR_ALERTE = 3;', 'export const MUETTES_POUR_ALERTE = 1;'],
    ['les 503 des e-mails ne sont plus notés', 'api/email-inbound.js', '  if (code === 503 || (code < 400 && ecritureRatee())) await noter503();\n', ''],
    ['la route colis ne prévient plus', 'api/ship-reminders.js', '    const alerte = await alerterColis(r);', '    const alerte = null;'],
    ['la route rend les alertes à tout le monde', 'api/_lib/alertes-production.js', "if (!utilisateur || String(utilisateur.id).toLowerCase() !== String(proprio).toLowerCase())", 'if (!utilisateur)'],
    ['la purge efface aussi le récent', 'api/_lib/alertes-production.js', "id=like.plantage_*&meta->>at=lt.", "id=like.plantage_*&meta->>at=gte.2000-01-01&x=lt."],
  ];
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 180000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 700)); } };
const imp = (rel) => import('file://' + path.join(R, rel));
const JULIEN = '11111111-1111-4111-8111-111111111111';
const AUTRE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const SECRETS = ['perso.julien@exemple.test', 'marie_dupont75', '87,50', 'XW123456789FR', '06 12 34 56 78', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '18273645501'];
const H = 3600e3, T0 = Date.parse('2026-11-11T11:00:00Z');
const rep = (c, st = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });
const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

// Une fausse base PostgREST générique (GET filtré, POST, PATCH conditionnel, DELETE filtré).
function fausseBase() {
  const b = { rows: [], panne: null, jetons: {}, lectures: [] };
  b.fetch = async (url, o = {}) => {
    const s = String(url); const u = new URL(s); const p = u.pathname; const m = (o.method || 'GET').toUpperCase();
    const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (b.panne) { const x = b.panne(u, m); if (x === 'jette') throw new Error('réseau'); if (x) return x; }
    if (p.endsWith('/auth/v1/user')) { const x = b.jetons[String(h.authorization || '').replace(/^Bearer /, '')]; return x ? rep(x) : rep({}, 401); }
    if (p.endsWith('/auth/v1/settings')) return rep({ external: {} });
    if (p.includes('/rpc/')) return rep(true);
    if (p.endsWith('/vrm_reglages')) return rep([{ valeur: JULIEN }]);
    if (!p.endsWith('/rest/v1/app_data')) return rep([]);
    if (m === 'GET') { b.lectures.push(s); return rep(PG.servir(b.rows, s, h).body); }
    const retour = String(h.prefer || '').includes('return=representation');
    if (m === 'POST') {
      const faites = [];
      for (const l of JSON.parse(o.body || '[]')) {
        const i = b.rows.findIndex((r) => r.owner === l.owner && r.id === l.id);
        if (i >= 0 && !String(h.prefer || '').includes('merge-duplicates')) { if (String(h.prefer || '').includes('ignore-duplicates')) continue; return rep({ message: 'conflit' }, 409); }
        const ligne = { owner: l.owner, id: l.id, data: JSON.parse(JSON.stringify(l.data)), meta: l.meta || {} };
        if (i >= 0) b.rows[i] = ligne; else b.rows.push(ligne); faites.push(ligne);
      }
      return retour ? rep(faites, 201) : rep('', 201);
    }
    if (m === 'PATCH') { const cibles = b.rows.filter((r) => PG.servir([r], s, {}).body.length); const maj = JSON.parse(o.body || '{}'); for (const r of cibles) { if (maj.data !== undefined) r.data = JSON.parse(JSON.stringify(maj.data)); } return retour ? rep(cibles.map((r) => ({ id: r.id }))) : new Response(null, { status: 204 }); }
    if (m === 'DELETE') { const avant = b.rows.length; b.rows = b.rows.filter((r) => !PG.servir([r], s, {}).body.length); b.supprimees = (b.supprimees || 0) + avant - b.rows.length; return new Response(null, { status: 204 }); }
    return rep([]);
  };
  b.ligne = () => { const r = b.rows.find((x) => x.owner === JULIEN && x.id === 'alertes_production'); return r && r.data; };
  return b;
}

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
  process.env.VRM_OWNER_UID = JULIEN;
  process.env.CRON_SECRET = 'cle-banc-cron';
  delete process.env.VAPID_PRIVATE_KEY;
  const AP = await imp('api/_lib/alertes-production.js');

  // ── P. la règle pure ──────────────────────────────────────────────────────
  console.log('── P. la règle pure');
  await essaie('P', async () => {
    const sig = { type: 'colis', cle: 'colis:test', titre: 'Colis en panne', corps: 'Le passage a échoué.' };
    let d = AP.etatVide(), dues = 0, derniere = null;
    for (let i = 0; i < 5; i++) { const r = AP.apresSignal(d, sig, T0 + i * 10 * 60e3); d = r.data; dues += r.dues.length; if (r.dues[0]) derniere = r.dues[0]; }
    dit(dues === 1 && d.alertes['colis:test'].n === 5, 'P1 5 signaux en 40 min ⇒ UNE notification, compteur 5', { dues, n: d.alertes['colis:test'].n });
    const v0 = AP.apresVidange(d, T0 + 50 * 60e3);
    dit(v0.dues.length === 0, 'P1 avant l’heure, la vidange n’envoie rien');
    const v1 = AP.apresVidange(d, T0 + 61 * 60e3);
    dit(v1.dues.length === 1 && /×4 depuis/.test(v1.dues[0].body), 'P1 après l’heure : UNE notification « ×4 depuis … » (ce qui attendait)', v1.dues[0] && v1.dues[0].body);
    dit(AP.apresVidange(v1.data, T0 + 62 * 60e3).dues.length === 0, 'P1 rien de neuf ⇒ rien ne repart');
    dit(derniere && derniere.cat === 'signalement' && derniere.url === '/?tab=settings', 'P1 la notification va dans la cloche (signalement) et ouvre Paramètres');
    // Interrupteur.
    const coupe = AP.apresReglage(AP.etatVide(), 'colis', false);
    const rc = AP.apresSignal(coupe, sig, T0);
    dit(rc.dues.length === 0 && rc.data.alertes['colis:test'] && rc.data.alertes['colis:test'].coupe === true, 'P2 type coupé : noté au journal, aucune notification');
    const rr = AP.apresVidange(AP.apresReglage(rc.data, 'colis', true), T0 + 60e3);
    dit(rr.dues.length === 1, 'P2 rallumé : ce qui attendait part (une fois)');
    dit(AP.apresReglage(AP.etatVide(), 'pirate', false) === null, 'P2 un type inconnu est refusé');
    // Filtre.
    const sale = { type: 'plantage', cle: 'plantage', titre: `Erreur pour ${SECRETS[0]}`, corps: `@${SECRETS[1]} a payé ${SECRETS[2]} € colis ${SECRETS[3]} tél ${SECRETS[4]} id ${SECRETS[5]} tx ${SECRETS[6]}` };
    const rs = AP.apresSignal(AP.etatVide(), sale, T0);
    const tout = JSON.stringify(rs);
    const fuites = SECRETS.filter((x) => tout.includes(x) || tout.includes(x.replace(/\s/g, '')));
    dit(!fuites.length && rs.dues.length === 1, 'P3 aucune donnée personnelle ni dans la ligne ni dans la notification (e-mail, pseudo, prix, n° de suivi, téléphone, UUID, n°)', fuites);
    dit(/\{email\}/.test(tout) && /\{pseudo\}/.test(tout), 'P3 les valeurs sont remplacées, pas l’alerte supprimée');
    // 30 jours.
    const vieux = AP.apresSignal(AP.etatVide(), sig, T0 - 31 * 864e5).data;
    const ap = AP.apresSignal(vieux, { ...sig, cle: 'colis:autre' }, T0).data;
    dit(!ap.alertes['colis:test'] && ap.alertes['colis:autre'], 'P4 une alerte de plus de 30 jours est effacée');
    const panneau = AP.alertesPourPanneau(vieux, T0);
    dit(panneau.alertes.length === 0, 'P4 le panneau ne montre rien de plus de 30 jours');
    // Séries.
    let s = AP.etatVide(), nd = 0;
    for (const e of [true, null, true]) { const r = AP.apresSuite(s, { cle: 'k', echec: e, seuil: 2, signal: sig }, T0); s = r.data; nd += r.dues.length; }
    dit(nd === 1, 'P5 série : échec, pas su (ni compté ni effacé), échec ⇒ seuil 2 atteint, UNE alerte');
    let s2 = AP.etatVide(), nd2 = 0;
    for (const e of [true, false, true]) { const r = AP.apresSuite(s2, { cle: 'k', echec: e, seuil: 2, signal: sig }, T0); s2 = r.data; nd2 += r.dues.length; }
    dit(nd2 === 0, 'P5 série coupée par une réussite ⇒ aucune alerte');
    let s3 = AP.etatVide(), nd3 = 0;
    for (const t of [0, 2 * H, 4 * H]) { const r = AP.apresSuite(s3, { cle: 'k', echec: true, seuil: 3, fenetreMs: H, signal: sig }, T0 + t); s3 = r.data; nd3 += r.dues.length; }
    dit(nd3 === 0, 'P5 trois échecs espacés de 2 h (fenêtre d’une heure) ⇒ aucune alerte');
    dit(AP.refusEnSerie([{ lus: 1, echecs: 1 }]) === null && AP.refusEnSerie([{ lus: 2, echecs: 4 }]) === true && AP.refusEnSerie([{ lus: 9, echecs: 1 }]) === false, 'P6 transporteur : trop peu pour juger ⇒ pas su ; la moitié en échec ⇒ série');
  });

  // ── R. la vraie route api/compte.js?mode=alertes ──────────────────────────
  console.log('── R. la route ?mode=alertes');
  const base = fausseBase();
  base.jetons = { 'j.julien.x': { id: JULIEN }, 'j.autre.x': { id: AUTRE } };
  global.fetch = base.fetch;
  await essaie('R', async () => {
    const compte = (await imp('api/compte.js')).default;
    const appel = async (jeton, method = 'GET', body) => { const res = faireRes(); await compte({ method, query: { mode: 'alertes' }, headers: { authorization: 'Bearer ' + jeton }, body }, res); return res; };
    const a = await appel('j.autre.x');
    dit(a.code === 403, 'R1 un autre compte : 403', a.code);
    const j = await appel('j.julien.x');
    dit(j.code === 200 && j.corps.reglages && j.corps.reglages.plantage === true && Array.isArray(j.corps.alertes), 'R1 le propriétaire lit les alertes et les interrupteurs (tout allumé par défaut)', JSON.stringify(j.corps).slice(0, 200));
    const p = await appel('j.julien.x', 'POST', { type: 'colis', actif: false });
    dit(p.code === 200 && p.corps.reglages.colis === false && base.ligne() && base.ligne().reglages.colis === false, 'R2 l’interrupteur « colis » est écrit sur SON clic', JSON.stringify(p.corps).slice(0, 200));
    const pa = await appel('j.autre.x', 'POST', { type: 'colis', actif: true });
    dit(pa.code === 403 && base.ligne().reglages.colis === false, 'R2 un autre compte ne peut pas le changer');
    const pb = await appel('j.julien.x', 'POST', { type: 'colis', actif: 'oui' });
    dit(pb.code === 400, 'R2 une valeur qui n’est pas oui/non est refusée');
    await appel('j.julien.x', 'POST', { type: 'colis', actif: true });
  });

  // ── S. la vraie route des sondes ──────────────────────────────────────────
  console.log('── S. la route ?moment=sondes');
  await essaie('S', async () => {
    const SR = await imp('api/ship-reminders.js');
    const envois = [];
    SR._bancSondes.envoyer = async (n, proprio) => { envois.push({ n, proprio }); return { sent: 1 }; };
    const sonde = async () => { const res = faireRes(); await SR.default({ method: 'GET', query: { moment: 'sondes' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res); return res; };
    // La connexion répond 500 : dégradée.
    base.panne = (u) => (u.pathname.endsWith('/auth/v1/settings') ? rep({ message: 'non' }, 500) : null);
    const r1 = await sonde();
    const n1 = envois.filter((e) => /connexion/.test(e.n.title)).length;
    const r2 = await sonde();
    const n2 = envois.filter((e) => /connexion/.test(e.n.title)).length;
    await sonde();
    const n3 = envois.filter((e) => /connexion/.test(e.n.title)).length;
    dit(r1.code === 200 && n1 === 0 && n2 === 1 && n3 === 1, 'S1 la connexion dégradée : rien à la 1re sonde, UNE alerte à la 2e, rien de plus à la 3e', { codes: [r1.code, r2.code], n1, n2, n3 });
    dit(envois.every((e) => e.proprio === JULIEN), 'S1 au PROPRIÉTAIRE seul');
    dit(base.ligne() && base.ligne().alertes['sonde:connexion'] && base.ligne().alertes['sonde:connexion'].type === 'sante', 'S1 notée au journal (type « santé »)');
    // La connexion ne répond plus du tout : muette.
    base.panne = (u) => (u.pathname.endsWith('/auth/v1/settings') ? 'jette' : null);
    const m0 = envois.length;
    await sonde(); await sonde();
    const m2 = envois.length - m0;
    await sonde();
    const muettes = envois.slice(m0).filter((e) => /Pas de réponse/.test(e.n.title));
    await sonde();
    dit(m2 === 0 && muettes.length === 1 && envois.slice(m0).filter((e) => /Pas de réponse/.test(e.n.title)).length === 1, 'S2 muette : rien après 2, UNE alerte « Pas de réponse » à la 3e, rien de plus ensuite', { m2, muettes: muettes.length });
    dit(muettes[0] && /pas une panne prouvée/.test(muettes[0].n.body) && !/panne sur/.test(muettes[0].n.title), 'S2 dite comme telle : « pas su », jamais « panne »', muettes[0] && muettes[0].n);
    dit(base.ligne().alertes['muette:connexion'] && base.ligne().alertes['muette:connexion'].nature === 'muette', 'S2 rangée « muette » au journal');
    base.panne = null;
  });

  // ── C. la vraie route ?moment=colis ───────────────────────────────────────
  console.log('── C. la route ?moment=colis');
  await essaie('C', async () => {
    const SR = await imp('api/ship-reminders.js');
    const envois = [];
    SR._bancSondes.envoyer = async (n, proprio) => { envois.push({ n, proprio }); return { sent: 1 }; };
    const colis = async () => { const res = faireRes(); await SR.default({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res); return res; };
    // La sélection des colis dus ne répond pas ; la ligne des alertes, si.
    base.panne = (u, m) => (m === 'GET' && u.pathname.endsWith('/app_data') && !/alertes_production|select=owner&limit=1/.test(decodeURIComponent(u.search)) ? rep('<html>522</html>', 522) : null);
    const c1 = await colis();
    const e1 = envois.filter((e) => /colis/i.test(e.n.title)).length;
    const c2 = await colis();
    const e2 = envois.filter((e) => /colis/i.test(e.n.title)).length;
    dit(c1.code === 503 && c2.code === 503, 'C la route répond 503 (sélection pas lue)', [c1.code, c2.code]);
    dit(e1 === 0 && e2 === 1, 'C1 1 passage en panne ⇒ rien ; 2 de suite ⇒ UNE alerte « Vérification des colis en panne »', { e1, e2 });
    dit(c2.corps && c2.corps.alerte && c2.corps.alerte.notifiees === 1 && !JSON.stringify(c2.corps).includes(JULIEN), 'C1 la réponse le dit en nombres (aucun vendeur nommé)', JSON.stringify(c2.corps));
    await colis();
    dit(envois.filter((e) => /colis/i.test(e.n.title)).length === 1, 'C2 3e passage dans l’heure : regroupé, rien de plus');
    dit(base.ligne().alertes['colis:passage'].n === 2, 'C2 le compteur monte (2 signaux après le seuil)', base.ligne().alertes['colis:passage'].n);
    base.panne = null;
  });

  // ── E. la vraie route des e-mails ─────────────────────────────────────────
  console.log('── E. la route des e-mails (503)');
  await essaie('E', async () => {
    const { fauxInbound, A } = require(path.join(__dirname, '_faux-inbound.cjs'));
    const fi = fauxInbound(R);
    fi.panne((id) => id !== 'alertes_production');
    const mail = { from: 'Vinted <no-reply@vinted.fr>', subject: 'Information', text: 'Bonjour, ceci est une information.' };
    const codes = [];
    const ligne = () => fi.base.get(`${A}|alertes_production`);
    codes.push((await fi.recoit(mail)).code);
    codes.push((await fi.recoit(mail)).code);
    const apres2 = ligne();
    codes.push((await fi.recoit(mail)).code);
    const apres3 = ligne();
    dit(codes.every((c) => c === 503), 'E la route répond 503 quand la base ne range pas', codes);
    dit(apres2 && apres2.suites && apres2.suites['emails:503'] && apres2.suites['emails:503'].n === 2 && !(apres2.alertes || {})['emails:503'], 'E1 2 refus ⇒ la série est comptée, aucune alerte', apres2);
    dit(apres3 && apres3.alertes && apres3.alertes['emails:503'] && apres3.alertes['emails:503'].notifieA, 'E1 3 refus en une heure ⇒ UNE alerte « E-mails refusés en série », marquée avant l’envoi', apres3 && apres3.alertes);
    dit(!JSON.stringify(apres3 || {}).match(/no-reply@vinted|vinted\.fr|Bonjour/), 'E2 l’alerte ne porte rien de l’e-mail');
    fi.panne(null);
  });

  // ── G. la purge à 30 jours ────────────────────────────────────────────────
  console.log('── G. la purge');
  await essaie('G', async () => {
    const b = fausseBase();
    const jour = (t) => new Date(t).toISOString().slice(0, 10);
    const at = (t) => new Date(t).toISOString();
    b.rows = [
      { owner: JULIEN, id: 'plantages_terrain_' + jour(T0 - 40 * 864e5), data: {} },
      { owner: JULIEN, id: 'plantages_terrain_' + jour(T0 - 2 * 864e5), data: {} },
      { owner: AUTRE, id: 'plantage_vieux', data: { at: at(T0 - 35 * 864e5) }, meta: { at: at(T0 - 35 * 864e5) } },
      { owner: AUTRE, id: 'plantage_recent', data: { at: at(T0 - 3 * 864e5) }, meta: { at: at(T0 - 3 * 864e5) } },
      { owner: AUTRE, id: 'plantage_sans_date', data: {}, meta: {} },
      { owner: AUTRE, id: 'main', data: {}, meta: { at: at(T0 - 90 * 864e5) } },
    ];
    const r = await AP.purgerErreursAnciennes({ url: 'https://banc.supabase.co', headers: {}, proprio: JULIEN, fetcher: b.fetch, maintenant: T0 });
    const restent = b.rows.map((x) => x.id).sort();
    dit(r.fait && JSON.stringify(restent) === JSON.stringify(['main', 'plantage_recent', 'plantage_sans_date', 'plantages_terrain_' + jour(T0 - 2 * 864e5)].sort()), 'G plus de 30 jours effacé ; récent, sans date et le reste gardés', restent);
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
