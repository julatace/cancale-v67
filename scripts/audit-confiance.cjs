#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA CONFIANCE (8 nov.) : « Tes données », le journal des gestes, /statut
// ════════════════════════════════════════════════════════════════════════════
// Julien (8 nov.) : « des vendeurs vont payer et doivent avoir confiance ».
// Trois promesses, jugées sur le CODE (pas sur l'orthographe d'un libellé) :
//
//   A. LA PAGE PUBLIQUE vrm.center/statut ne porte AUCUNE donnée d'un vendeur :
//      ses scripts ne lisent que /api/sante, /etat-version.json et
//      /statut-incidents.json ; /api/sante ne rend que des oui/non et l'état
//      sondé (base · e-mails · notifications · heure) ; le fichier d'incidents
//      (écrit à la main) n'a ni adresse, ni pseudo, ni téléphone, ni long
//      numéro ; et la page elle-même retire un tel texte (`incidentsSurs`,
//      EXÉCUTÉE ici dans une vm).
//   B. LE JOURNAL « Ce que l'extension a fait » : chaque ligne porte sa PREUVE
//      (la ligne de la base qui la note) et l'écran l'affiche ; les commandes du
//      téléphone (`cmd_relais_*`) sont lues SANS leur corps (jamais le texte d'un
//      message) ; un geste qui n'est pas parti (en attente, annulé, expiré)
//      n'est pas « fait ».
//   C. « TES DONNÉES » (src/tesDonnees.js) : chaque phrase a sa preuve dans le
//      code ; et les règles sont jugées : le plafond écrit = `ACTIONS_MAX_HEURE`,
//      les suppressions Leboncoin = `LBC_SUPPRIME_MAX_HEURE`, aucune commande de
//      l'app ne supprime une annonce Vinted (`EXEC_PERMIS`, exécuté), chaque site
//      du manifeste de l'extension est nommé, le serveur est bien à Dublin.
//
// `node scripts/audit-confiance.cjs`           — le code d'ici
// `node scripts/audit-confiance.cjs --prouve`  — en plus : rouge sur la branche
//    de départ (git archive) ET sur 13 mutations (chacune réaffaiblit une règle
//    dans une copie : l'audit doit la voir).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..');
const DEPART = 'origin/claude/amazing-lovelace-xd7obl';

// Ce qui ressemble à une donnée personnelle (règle de l'AUDIT, écrite ici,
// indépendante de celle de la page : une page qui se trompe ne se juge pas seule).
const PERSO = [
  ['adresse e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['pseudo en @', /(^|[\s(«"'])@[A-Za-z0-9_.-]{2,}/],
  ['téléphone', /(\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/],
  ['long numéro (commande, suivi, transaction)', /\d{7,}/],
  ['identifiant', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
];
const persoDans = (t) => PERSO.filter(([, re]) => re.test(String(t || ''))).map(([n]) => n);

async function verifier(R, { silencieux = false } = {}) {
  const res = [];
  const dit = (ok, nom, detail) => { res.push({ ok: !!ok, nom }); if (!silencieux) console.log(`${ok ? 'OK' : 'KO'}  ${nom}${!ok && detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : ''}`); };
  const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return null; } };
  const imp = async (f) => { try { return await import(pathToFileURL(path.join(R, f)).href + '?t=' + Date.now() + Math.random()); } catch (e) { return { __erreur: String(e && e.message || e) }; } };
  const sansCommentaires = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');

  // ── A. LA PAGE PUBLIQUE ────────────────────────────────────────────────────
  if (!silencieux) console.log('\n── A. vrm.center/statut : aucune donnée d’un vendeur');
  const vercel = (() => { try { return JSON.parse(lire('vercel.json')); } catch (_) { return null; } })();
  dit(vercel && (vercel.rewrites || []).some((x) => x.source === '/statut' && x.destination === '/statut.html'), 'A1 vercel.json : /statut → /statut.html');
  const html = lire('public/statut.html');
  dit(!!html, 'A2 public/statut.html existe');
  const scripts = html ? [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)] : [];
  const srcs = scripts.map((m) => (/\bsrc="([^"]+)"/.exec(m[1]) || [])[1] || null);
  dit(html && scripts.length > 0 && scripts.every((m) => m[2].trim() === '') && srcs.every((s) => s === '/etat.js' || s === '/statut.js') && srcs.includes('/statut.js'),
    'A3 aucun script en ligne ; seulement /etat.js et /statut.js (servis par VRM)', srcs);
  dit(html && !/<(iframe|img|link)\b[^>]*\b(src|href)="https?:\/\//i.test(html), 'A4 rien de chargé d’un autre site');
  const PERMIS = new Set(['/api/sante', '/etat-version.json', '/statut-incidents.json']);
  for (const f of ['public/statut.js', 'public/etat.js']) {
    const brut = lire(f); const js = sansCommentaires(brut);
    if (!brut) { dit(false, `A5 ${f} existe`); continue; }
    const lus = [...js.matchAll(/\b(?:fetch|lire)\s*\(\s*([^,)]+)/g)].map((m) => m[1].trim());
    const ok = lus.length > 0 && lus.every((u) => /^['"][^'"]+['"]$/.test(u) ? PERMIS.has(u.slice(1, -1)) : u === 'url');
    const litterales = [...js.matchAll(/['"](\/[A-Za-z0-9_\-./?=&]+)['"]/g)].map((m) => m[1]).filter((u) => /^\/(api|rest|auth)\b/.test(u));
    dit(ok && litterales.every((u) => PERMIS.has(u)), `A5 ${f} : ne lit que /api/sante, /etat-version.json, /statut-incidents.json`, { lus, litterales });
    const interdit = ['Authorization', 'access_token', 'supabase', 'sb-', 'cookie', 'apikey', 'mode=journal', 'vinted_accounts', 'app_data'].filter((x) => js.includes(x));
    const ls = [...js.matchAll(/localStorage\.(\w+)\(\s*([^)]*)\)/g)].filter((m) => !(m[1] === 'getItem' && /^['"]vinted_dark['"]$/.test(m[2].trim())));
    dit(!interdit.length && !ls.length, `A6 ${f} : ni session, ni jeton, ni base ; le stockage seulement pour le thème`, { interdit, ls: ls.map((m) => m[0]) });
  }
  // A7 — la règle de la page, EXÉCUTÉE.
  const sjs = lire('public/statut.js');
  let surs = null;
  if (sjs) {
    const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} }, Date, Array, Object, JSON, isFinite, Math, String };
    try { vm.createContext(ctx); vm.runInContext(sjs, ctx); surs = ctx.window.VRM_STATUT && ctx.window.VRM_STATUT.incidentsSurs; } catch (_) { surs = null; }
  }
  if (typeof surs !== 'function') dit(false, 'A7 incidentsSurs exécutable');
  else {
    const T = Date.parse('2026-11-08T12:00:00Z');
    const piege = {
      incidents: [
        { debut: '2026-11-08T10:00:00Z', titre: 'E-mails lents', texte: 'Écris-nous à jean.dupont@gmail.com', touche: ['emails', 'secret'], compte: 'vanessa5723', email: 'x@y.fr' },
        { debut: '2026-11-08T09:00:00Z', titre: 'Colis de @vanessa5723', texte: 'Commande 12345678901 bloquée' },
        { debut: '2026-11-08T08:00:00Z', titre: 'Appel', texte: 'Appelle le 06 12 34 56 78' },
        { debut: '2026-11-08T07:00:00Z', titre: 'Id', texte: 'compte 3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f' },
        { debut: '2026-10-01T10:00:00Z', fin: '2026-10-01T11:00:00Z', titre: 'Vieux', texte: 'résolu il y a longtemps' },
        { debut: '2026-11-07T10:00:00Z', fin: '2026-11-07T11:00:00Z', titre: 'Base lente', texte: 'Rétablie.' },
        { debut: 'pas une date', titre: 'Sans date' },
      ],
    };
    const r = surs(piege, T);
    const sortie = JSON.stringify(r || null);
    const textesSortie = Array.isArray(r) ? r.map((x) => x.titre + ' ' + x.texte).join(' | ') : '';
    dit(Array.isArray(r) && !persoDans(textesSortie).length && !/vanessa|dupont|12345678901|06 12/.test(sortie), 'A7 la page retire tout texte qui porte une donnée personnelle (adresse, pseudo, long numéro, téléphone, identifiant)', sortie);
    dit(Array.isArray(r) && r.every((x) => Object.keys(x).sort().join(',') === 'debut,fin,texte,titre,touche') && r.every((x) => x.touche.every((k) => ['base', 'emails', 'notifications', 'extension', 'autre'].includes(k))), 'A8 seulement les champs connus (un champ « compte » ou « email » posé par erreur ne sort pas)', sortie);
    dit(Array.isArray(r) && r.length === 5 && !r.some((x) => x.titre === 'Vieux' || x.titre === 'Sans date') && r[r.length - 1].titre === 'Base lente', 'A9 en cours d’abord ; résolu depuis plus de 30 jours ou sans date : retiré', r && r.map((x) => x.titre));
    dit(surs({}, T) === null && surs(null, T) === null, 'A10 fichier illisible ⇒ « pas su » (null), jamais « aucun incident »');
  }
  // A11 — le fichier écrit à la main.
  const inc = (() => { try { return JSON.parse(lire('public/statut-incidents.json')); } catch (_) { return null; } })();
  const textesInc = inc && Array.isArray(inc.incidents) ? inc.incidents.flatMap((x) => [x && x.titre, x && x.texte]).filter(Boolean) : null;
  const fautes = (textesInc || []).map((t) => [t, persoDans(t)]).filter(([, p]) => p.length);
  dit(Array.isArray(textesInc) && !fautes.length && inc.incidents.every((x) => x && Number.isFinite(Date.parse(x.debut))), 'A11 public/statut-incidents.json : lisible, daté, sans aucune donnée personnelle', fautes);
  // A12 — /api/sante : des oui/non et l'état sondé, rien d'autre.
  const compte = lire('api/compte.js') || '';
  const corpsSante = (/async function sante\(req, res\) \{[\s\S]*?return repondre\(res, 200, \{([\s\S]*?)\}\);/.exec(compte) || [])[1];
  const paires = corpsSante ? corpsSante.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  // (9 nov.) `statut` : la projection publique des sondes (api/_lib/statut-sondes.js `statutPublic`,
  // mots fixes et dates seulement — jugée par scripts/audit-statut-auto.cjs).
  const valeurOk = (l) => /^ok: true,$/.test(l) || /^etat,$/.test(l) || /^statut,$/.test(l) || /^\w+: !!process\.env\.[A-Z_]+,$/.test(l) || /^stripe: stripePret\(\),$/.test(l) || /^relancesEssai: configurationRelances\(\)\.pret,$/.test(l);
  dit(paires.length >= 3 && paires.every(valeurOk), 'A12 /api/sante ne rend que des oui/non et `etat` (aucune valeur de variable, aucune donnée)', paires.filter((l) => !valeurOk(l)));
  const ETAT = await imp('api/_lib/etat-public.js');
  if (ETAT.__erreur || typeof ETAT.sonderEtat !== 'function') dit(false, 'A13 etat-public exécutable', ETAT.__erreur);
  else {
    const fetcher = async () => ({ ok: true, json: async () => [{ id: 'vrm_email_collecteur_passage', at: new Date(Date.now() - 60e3).toISOString(), etat: 'debut', email: 'jean@x.fr', owner: 'a-b' }] });
    const e = await ETAT.sonderEtat({ env: { SUPABASE_SERVICE_KEY: 's', EMAIL_INBOUND_SECRET: 'x' }, fetcher, pushPret: true });
    const cles = Object.keys(e).sort().join(',');
    dit(cles === 'base,emails,notifications,verifieA' && ['base', 'emails', 'notifications'].every((k) => ['ok', 'panne', 'inconnu'].includes(e[k])) && !/jean|a-b/.test(JSON.stringify(e)), 'A13 l’état sondé : base · e-mails · notifications · heure, en mots fixes — rien de ce que la base a rendu', e);
  }

  // ── B. LE JOURNAL DES GESTES ───────────────────────────────────────────────
  if (!silencieux) console.log('\n── B. « Ce que l’extension a fait » : chaque geste avec sa preuve, jamais un message');
  const S = await imp('api/_lib/securite-compte.js');
  const Cl = await imp('src/securiteCompte.js');
  if (S.__erreur || typeof S.evenementsJournal !== 'function') dit(false, 'B0 securite-compte exécutable', S.__erreur);
  else {
    const SECRET = 'SECRET-MESSAGE-NE-SORT-PAS';
    const relais = [
      { cmd: 'exec', etat: 'fait', finiLe: 1793019613888, uid: '111', methode: 'PUT', endpoint: '/api/v2/transactions/42/offer_requests/7/accept', body: SECRET },
      { cmd: 'exec', etat: 'refuse', finiLe: 1793019600000, uid: '111', methode: 'PUT', endpoint: '/api/v2/transactions/43/offer_requests/8/reject' },
      { cmd: 'exec', etat: 'fait', finiLe: 1793019500000, uid: '111', methode: 'POST', endpoint: '/api/v2/conversations/99/replies', body: { message: SECRET }, message: SECRET },
      { cmd: 'exec', etat: 'echec', finiLe: 1793019400000, uid: '222', methode: 'POST', endpoint: '/api/v2/transactions/44/offers' },
      { cmd: 'bordereau', etat: 'fait', finiLe: 1793019300000, uid: '111', tx: '45' },
      { cmd: 'lbcPublier', etat: 'en-cours', prisLe: 1793019200000, lbc: '3001' },
      { cmd: 'exec', etat: 'attente', demandeLe: 1793019100000, uid: '111', methode: 'PUT', endpoint: '/api/v2/transactions/46/offer_requests/9/accept' },
      { cmd: 'exec', etat: 'annulee', demandeLe: 1793019100000, uid: '111', methode: 'POST', endpoint: '/api/v2/conversations/98/replies' },
      { cmd: 'bordereau', etat: 'expiree', finiLe: 1793019100000, uid: '111', tx: '47' },
      { cmd: 'exec', etat: 'fait', finiLe: 1793019100000, uid: '111', methode: 'GET', endpoint: '/api/v2/conversations/97' },
      { cmd: 'exec', etat: 'fait', finiLe: 1793019100000, uid: '111', methode: 'DELETE', endpoint: '/api/v2/items/5' },
    ];
    let ev = [];
    try { ev = S.evenementsJournal({
      favoris: [{ compte: '111', jobs: [{ etat: 'envoye', envoyeLe: 1793019613000, itemId: '5', message: SECRET }] }],
      brouillons: [{ parVRM: true, etat: 'publie', publieLe: '2026-11-01T09:27:41Z', itemId: '9', uid: '111' }],
      ebayRetraits: [{ compte: 'principal', items: [{ at: 1791734859132, sku: 'VRM-12' }] }],
      ebayAgent: [{ compte: 'principal', items: [{ action: 'terminerannonce', etat: 'reussi', at: 1793007362243, ref: 'VRM-3' }] }],
      bordereaux: [{ uid: '111', tx: '42', item: '5', capturedAt: '1793019613000' }],
      relais,
    }); } catch (e) { ev = []; dit(false, 'B0 evenementsJournal lève', String(e && e.message)); }
    const PREUVES = new Set(Object.values(S.PREUVES_JOURNAL || {}));
    dit(ev.length === 11 && ev.every((e) => typeof e.preuve === 'string' && e.preuve && PREUVES.has(e.preuve)), 'B1 chaque geste rendu porte sa PREUVE (la ligne de la base qui le note) — 5 sources + 6 commandes du téléphone', ev.map((e) => [e.type, e.preuve]));
    const sourcesVues = new Set(ev.map((e) => e.source));
    dit(['favoris', 'brouillons', 'ebay_retraits_auto', 'ebay_agent_journal', 'bordereaux', 'relais'].every((s) => sourcesVues.has(s) && (S.PREUVES_JOURNAL || {})[s]), 'B2 les six sources ont une preuve nommée', [...sourcesVues]);
    dit(!JSON.stringify(ev).includes(SECRET), 'B3 jamais le texte d’un message (ni favori, ni réponse, ni corps de commande)');
    const r = ev.filter((e) => e.source === 'relais');
    const typeDe = (t) => r.find((e) => e.type === t) || { cle: {} };
    const parType = Object.fromEntries(r.map((e) => [e.type, e.resultat]));
    dit(r.length === 6 && parType.offre_acceptee === 'ok' && parType.offre_refusee === 'refuse' && parType.message_envoye === 'ok' && parType.offre_faite === 'refuse' && parType.bordereau_demande === 'ok' && parType.lbc_publication === 'en_cours',
      'B4 téléphone : acceptée / refusée / message / offre (échec ⇒ refusé) / bordereau / Leboncoin en cours', parType);
    dit(!r.some((e) => e.at === 1793019100000), 'B5 en attente, annulée, expirée, une lecture, un geste inconnu : rien n’est « fait »');
    dit(r.every((e) => e.via === 'telephone') && r.length > 0 && typeDe('offre_acceptee').cle.tx === '42', 'B6 le geste dit « depuis ton téléphone » et nomme la commande par son numéro (identité, pas un titre)');
    // La lecture en base : projetée, sans corps.
    const lus = [];
    await S.lireJournal({ userId: '7a1c0e3a-0000-4000-8000-000000000001', neutre: '00000000-0000-0000-0000-000000000000',
      lireVendeur: async (c) => { lus.push(c); if (/vinted_accounts/.test(c)) return [{ vinted_user_id: '111' }]; if (/cmd_relais_/.test(c)) return relais.map((x) => ({ ...x, body: SECRET })); return []; },
      lireService: async () => [] }).catch((e) => ({ evenements: [], nonJournalise: [], __leve: String(e && e.message) })).then((j) => {
      const q = lus.find((x) => /cmd_relais_/.test(x)) || '';
      dit(q && /owner=eq\./.test(q) && !/body|select=data(&|,|$)|data->args(&|,|$)|data->args\b(?!->)/.test(q) && /data->args->>endpoint/.test(q), 'B7 les commandes du téléphone lues champ par champ : jamais `select=data`, jamais `args.body`', q);
      dit(!JSON.stringify(j).includes(SECRET) && j.evenements.some((e) => e.source === 'relais'), 'B8 même si la base rendait le corps, il ne sort pas de la route');
      dit((j.nonJournalise || []).some((x) => x.id === 'offres') && (j.nonJournalise || []).some((x) => x.id === 'messages') && (j.nonJournalise || []).some((x) => x.id === 'lbc') && (j.nonJournalise || []).some((x) => x.id === 'vestiaire'), 'B9 ce que l’extension ne note pas en base est DIT (« pas su » nommé, jamais un vide)', j.nonJournalise);
    });
    // Côté écran.
    if (Cl.__erreur || typeof Cl.ligneJournal !== 'function') dit(false, 'B10 src/securiteCompte.js exécutable', Cl.__erreur);
    else {
      const avec = Cl.ligneJournal(ev[0], { numeroDeItem: () => null, nomCompte: () => null });
      const sans = Cl.ligneJournal({ ...ev[0], preuve: undefined }, {});
      dit(avec.preuve === ev[0].preuve && sans.preuve === null, 'B10 la ligne de l’écran porte la preuve ; sans preuve ⇒ null (dit « pas su »)', { avec: avec.preuve, sans: sans.preuve });
      const types = Object.keys(S.TYPES_JOURNAL || {});
      const filtres = (Cl.FILTRES_TYPE || []).map((x) => x[0]).filter((x) => x !== 'tous');
      const malRanges = types.filter((t) => !Cl.LIBELLES_TYPE[t] || filtres.filter((f) => Cl.filtrerJournal([{ type: t }], { type: f }).length).length !== 1);
      dit(types.length >= 12 && !malRanges.length, 'B11 chaque type de geste a son libellé et UNE puce de filtre', malRanges);
    }
    const reg = lire('src/ecrans/Reglages.jsx') || '';
    const journal = (/function JournalVrm\(\) \{[\s\S]*?\n\}\n/.exec(reg) || [''])[0];
    const boucle = (/g\.l\.map\(\(e, i\) => \{[\s\S]*?\); \}\)\}/.exec(journal) || [''])[0];
    dit(/data-journal-preuve=\{L\.preuve \? 'oui' : 'pas-su'\}/.test(boucle) && /\{L\.preuve \|\|/.test(boucle), 'B12 l’écran affiche la preuve sur CHAQUE ligne (et « pas su » si elle manque)');
  }

  // ── C. « TES DONNÉES » ─────────────────────────────────────────────────────
  if (!silencieux) console.log('\n── C. « Tes données » : chaque phrase tenue par le code');
  const TD = await imp('src/tesDonnees.js');
  if (TD.__erreur || typeof TD.toutesLesPreuves !== 'function') dit(false, 'C0 src/tesDonnees.js exécutable', TD.__erreur);
  else {
    const preuves = TD.toutesLesPreuves();
    const manque = preuves.filter((p) => { const t = lire(p.fichier); return !p.cherche || t == null || !t.includes(p.cherche); });
    const ids = new Set(preuves.map((p) => p.id));
    const lignes = TD.CE_QUE_VRM_LIT.length + TD.GESTES.reduce((n, g) => n + g.lignes.length, 0) + TD.STOCKAGE.length + TD.ACCES.length;
    dit(preuves.length >= lignes && ids.size === lignes && !manque.length, `C1 chacune des ${lignes} phrases a une preuve qui existe dans le code`, manque);
    const bg = lire('vinted-sync-extension/background.js') || '';
    const plafond = Number((/^const ACTIONS_MAX_HEURE = (\d+);/m.exec(bg) || [])[1]);
    dit(plafond === TD.PLAFOND_ACTIONS_HEURE && TD.GESTES.some((g) => g.lignes.some((l) => l.texte.includes(String(plafond) + ' actions'))), 'C2 le plafond écrit est celui de l’extension', { extension: plafond, page: TD.PLAFOND_ACTIONS_HEURE });
    const lbc = Number((/^const LBC_SUPPRIME_MAX_HEURE = (\d+);/m.exec(bg) || [])[1]);
    dit(lbc === TD.PLAFOND_SUPPRESSIONS_LBC, 'C3 les suppressions Leboncoin écrites sont celles de l’extension', { extension: lbc, page: TD.PLAFOND_SUPPRESSIONS_LBC });
    const bloc = (/const EXEC_PERMIS = \[[\s\S]*?\n\];/.exec(bg) || [''])[0];
    let permis = null;
    try { permis = vm.runInNewContext(bloc.replace('const EXEC_PERMIS =', '(') .replace(/\];$/, '])')); } catch (_) { permis = null; }
    const supprime = Array.isArray(permis) ? permis.filter((p) => p.methode === 'DELETE' || ['/api/v2/items/5', '/api/v2/items/5/delete', '/api/v2/items/5/hide'].some((e) => p.chemin.test(e))) : null;
    dit(Array.isArray(permis) && permis.length >= 5 && supprime.length === 0, 'C4 aucune commande de l’app ne supprime ni ne masque une annonce Vinted (EXEC_PERMIS exécuté)', supprime && supprime.map((p) => p.methode + ' ' + p.chemin));
    const acc = permis && permis.find((p) => p.chemin.test('/api/v2/transactions/1/offer_requests/2/accept'));
    dit(acc && acc.confirmer === true, 'C5 accepter une offre depuis le téléphone demande sa confirmation', acc);
    const man = (() => { try { return JSON.parse(lire('vinted-sync-extension/manifest.json')); } catch (_) { return null; } })();
    const motifs = man ? [...(man.host_permissions || []), ...(man.content_scripts || []).flatMap((c) => c.matches || []), ...(man.optional_host_permissions || [])] : [];
    const hote = (m) => { const x = /^https?:\/\/([^/]+)\//.exec(m); return x ? x[1].replace(/^\*\./, '') : m; };
    const inconnus = [...new Set(motifs.map(hote))].filter((h) => !TD.SITES_EXTENSION.some((s) => s.motif.test(h)));
    const permsInterdites = man ? (man.permissions || []).concat(man.optional_permissions || []).filter((x) => ['history', 'webRequest', 'webRequestBlocking', 'debugger', 'browsingData', 'topSites', 'bookmarks', '<all_urls>'].includes(x)) : ['?'];
    dit(man && !permsInterdites.length && /ni ton historique de navigation/.test(TD.CE_QUE_VRM_NE_LIT_PAS || ''), 'C6b « elle ne lit pas ton historique » : aucune permission historique, requêtes, signets', permsInterdites);
    dit(man && motifs.length > 0 && !inconnus.length && !motifs.some((m) => /<all_urls>|^\*:|^https?:\/\/\*\//.test(m)), 'C6 chaque site que l’extension peut ouvrir est nommé sur la page (aucun « tous les sites »)', inconnus);
    dit(vercel && JSON.stringify(vercel.regions) === '["dub1"]' && TD.STOCKAGE.some((s) => /Dublin/.test(s.detail)), 'C7 « le serveur à Dublin » : vercel.json → regions ["dub1"]', vercel && vercel.regions);
    const sql = lire('supabase/migrations/001-multi-utilisateurs.sql') || '';
    dit(/alter table public\.app_data\s+enable row level security/i.test(sql) && /using \(owner = auth\.uid\(\)\)/.test(sql), 'C8 « ta base ne rend tes lignes qu’à ta session » : RLS sur owner = auth.uid()');
    const td = lire('src/composants/TesDonnees.jsx') || '';
    const regl = lire('src/ecrans/Reglages.jsx') || '';
    dit(/onExporter=\{exporterMesDonnees\}/.test(regl) && /onFermer=\{AUTH\.user \? \(\)=>ouvrirSous\('fermer'\)/.test(regl) && /\{ id:'fermer', type:'panneau'[^\n]*<FermerCompte\/>/.test(regl) && /onJournal=\{AUTH\.user \? \(\)=>ouvrirSous\('journal-vrm'\)/.test(regl),
      'C9 « Exporter » = l’export existant ; « Fermer mon compte » ouvre la fermeture existante (confirmation par l’adresse) ; « Ce que l’extension a fait » ouvre le journal');
    dit(/href="\/statut"/.test(td) && /window\.open\('\/statut'/.test(regl) && /data-aide-statut/.test(regl), 'C10 /statut joignable depuis « Tes données », l’Aide et « Résoudre un problème »');
    const fermer = (/function FermerCompte\(\) \{[\s\S]*?\n\}\n/.exec(regl) || [''])[0];
    dit(/const pareil = !!email && tape\.trim\(\)\.toLowerCase\(\) === email\.trim\(\)\.toLowerCase\(\)/.test(fermer) && /disabled=\{!pareil \|\| occupe\}/.test(fermer) && /info\.proprietaire/.test(fermer), 'C11 fermer le compte : recopier son adresse, bouton éteint sinon ; jamais pour le propriétaire de l’installation');
  }
  return res;
}

// ── Les preuves (§6) : rouge sur la branche de départ, rouge sur chaque mutation ──
const FICHIERS = ['public/statut.html', 'public/statut.js', 'public/etat.js', 'public/statut-incidents.json', 'vercel.json', 'api/compte.js', 'api/_lib/etat-public.js', 'api/_lib/cle.js', 'api/_lib/securite-compte.js',
  'src/securiteCompte.js', 'src/tesDonnees.js', 'src/composants/TesDonnees.jsx', 'src/ecrans/Reglages.jsx', 'vinted-sync-extension/background.js', 'vinted-sync-extension/manifest.json', 'package.json',
  'supabase/migrations/001-multi-utilisateurs.sql', 'docs/passation/2026-11-06-sauvegarde-prix.md', 'public/legal/confidentialite.html', 'api/ebay.js', 'api/email-inbound.js', 'api/_lib/favoris-auto.js', 'src/ecrans/Ebay.jsx', 'src/App.jsx', 'api/_lib/cle-service.js'];
function copie(nom) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'confiance-' + nom + '-'));
  for (const f of FICHIERS) { const src = path.join(RACINE, f); if (!fs.existsSync(src)) continue; fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.copyFileSync(src, path.join(d, f)); }
  return d;
}
function muter(d, f, avant, apres) {
  const p = path.join(d, f); const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(avant)) throw new Error(`mutation introuvable dans ${f} : ${avant.slice(0, 60)}`);
  fs.writeFileSync(p, t.split(avant).join(apres));
}
const MUTATIONS = [
  ['la page lit le journal d’un vendeur', 'public/statut.js', "fetch('/statut-incidents.json'", "fetch('/api/compte?mode=journal'", 'A5'],
  ['la page lit la session', 'public/statut.js', "if (typeof window !== 'undefined') window.VRM_STATUT", "var jeton = localStorage.getItem('sb-session'); if (typeof window !== 'undefined') window.VRM_STATUT", 'A6'],
  ['la page ne retire plus une adresse', 'public/statut.js', 'if (perso(corps)) corps = RETIRE;', '', 'A7'],
  ['la page recopie tous les champs', 'public/statut.js', 'out.push({ debut: debut, fin: fin, titre: titre, texte: corps, touche: touche });', 'out.push(Object.assign({}, x, { debut: debut, fin: fin, titre: titre, texte: corps, touche: touche }));', 'A8'],
  ['un incident nomme un vendeur', 'public/statut-incidents.json', '"incidents": []', '"incidents": [{ "debut": "2026-11-08T10:00:00Z", "titre": "Colis bloqué", "texte": "Le colis de jean.dupont@gmail.com" }]', 'A11'],
  ['/api/sante rend l’identifiant du propriétaire', 'api/compte.js', 'owner: !!process.env.VRM_OWNER_UID,', 'owner: process.env.VRM_OWNER_UID,', 'A12'],
  ['un geste sort sans preuve', 'api/_lib/securite-compte.js', '.map((e) => ({ ...e, preuve: PREUVES_JOURNAL[e.source] }))', '.map((e) => ({ ...e }))', 'B1'],
  ['le corps de la commande est lu', 'api/_lib/securite-compte.js', 'endpoint:data->args->>endpoint&order', 'endpoint:data->args->>endpoint,body:data->args->body&order', 'B7'],
  ['« en attente » compte comme fait', 'api/_lib/securite-compte.js', "const ETAT_RELAIS = { fait: 'ok',", "const ETAT_RELAIS = { attente: 'ok', annulee: 'ok', fait: 'ok',", 'B5'],
  ['l’écran n’affiche plus la preuve', 'src/ecrans/Reglages.jsx', "<span className=\"vrm-sec-sous vrm-sec-preuve\" data-journal-preuve={L.preuve ? 'oui' : 'pas-su'}>{L.preuve || 'D’où vient cette ligne : pas su'}</span>", '', 'B12'],
  ['l’extension monte à 60 actions/h', 'vinted-sync-extension/background.js', 'const ACTIONS_MAX_HEURE = 50;', 'const ACTIONS_MAX_HEURE = 60;', 'C2'],
  ['une commande supprime une annonce Vinted', 'vinted-sync-extension/background.js', "{ methode: 'POST', chemin: /^\\/api\\/v2\\/transactions\\/\\d+\\/offers$/ },", "{ methode: 'POST', chemin: /^\\/api\\/v2\\/transactions\\/\\d+\\/offers$/ },\n  { methode: 'DELETE', chemin: /^\\/api\\/v2\\/items\\/\\d+$/ },", 'C4'],
  ['l’extension ouvre tous les sites', 'vinted-sync-extension/manifest.json', '"host_permissions": [', '"host_permissions": [\n    "<all_urls>",', 'C6'],
];

(async () => {
  const res = await verifier(RACINE);
  const ko = res.filter((r) => !r.ok);
  console.log(`\n${ko.length ? '❌' : '✅'} audit-confiance : ${res.length - ko.length}/${res.length}`);
  if (!process.argv.includes('--prouve')) { process.exitCode = ko.length ? 1 : 0; return; }
  let preuveKo = 0;
  console.log('\n── Preuves : la branche de départ et 13 mutations doivent être ROUGES');
  // 1. La branche de départ (git archive), sans ce chantier.
  try {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'confiance-depart-'));
    const tar = execFileSync('git', ['-C', RACINE, 'archive', DEPART, ...FICHIERS.filter((f) => { try { execFileSync('git', ['-C', RACINE, 'cat-file', '-e', `${DEPART}:${f}`], { stdio: 'ignore' }); return true; } catch (_) { return false; } })], { maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', d], { input: tar });
    const r = await verifier(d, { silencieux: true });
    const rouges = r.filter((x) => !x.ok).map((x) => x.nom.split(' ')[0]);
    const ok = ['A1', 'A2', 'B1', 'B7', 'C0'].every((k) => rouges.includes(k));
    console.log(`${ok ? 'OK' : 'KO'}  départ (${DEPART}) : rouge — ${rouges.length} contrôles (${rouges.slice(0, 12).join(' ')}…)`);
    if (!ok) preuveKo++;
  } catch (e) { console.log('KO  départ : ' + (e && e.message)); preuveKo++; }
  // 2. Les mutations.
  for (const [nom, f, avant, apres, attendu] of MUTATIONS) {
    const d = copie('mut');
    try { muter(d, f, avant, apres); } catch (e) { console.log('KO  ' + nom + ' — ' + e.message); preuveKo++; continue; }
    const r = await verifier(d, { silencieux: true });
    const rouges = r.filter((x) => !x.ok).map((x) => x.nom.split(' ')[0]);
    const ok = rouges.includes(attendu);
    console.log(`${ok ? 'OK' : 'KO'}  mutation « ${nom} » ⇒ ${attendu} rouge${ok ? '' : ' — rouges : ' + rouges.join(' ')}`);
    if (!ok) preuveKo++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${preuveKo ? '❌' : '✅'} preuves : ${preuveKo ? preuveKo + ' KO' : 'toutes rouges comme attendu'}`);
  process.exitCode = ko.length || preuveKo ? 1 : 0;
})();
