#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// AUDIT « MESSAGES PARFAITS » (28 nov.) — les règles PURES du lot, EXÉCUTÉES (aucun navigateur, aucune base) :
//   S. le statut de l'extension (src/messages/statutExtension.js) : trois états vrais et DATÉS — connectée et à jour ·
//      connectée mais différente (version, autre compte VRM, aucun onglet / compte non relié) · pas joignable (absente,
//      muette, réponse trop vieille) — et « on vérifie » qui ne vaut jamais « ok » ;
//   C. « Autre prix » d'une contre-offre (src/messages/contreOffre.js) : jamais sous le plancher sans le forcer, jamais à
//      ou sous l'offre, jamais au-dessus du prix affiché, un montant illisible n'est pas 0 ;
//   A. la photo de profil (src/filUnique.js `avatarPersonne`) : https seulement, l'image « pas de photo » de Vinted écartée,
//      portée par `convVinted` (`avatar`), jamais une identité (la clé du fil ne change pas).
//   `--mutation` : chaque règle affaiblie (copie dans un dossier temporaire) doit rougir.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src');

const MUTATIONS = {
  'statut : une réponse vieille reste « ok »': ['messages/statutExtension.js', 'if (!datee || maintenant - datee > VIEUX_MS)', 'if (false)'],
  'statut : version ancienne dite « ok »': ['messages/statutExtension.js', "if (ECART_NAV.has(nav.code)) return { ...base, etat: 'ecart', code: nav.code, cle: nav.cle, vars: nav.vars || {} };\n  if (nav.code !== 'ok')", "if (nav.code !== 'ok' && nav.code !== 'maj')"],
  'statut : compte non relié dit « ok »': ['messages/statutExtension.js', 'if (!Object.prototype.hasOwnProperty.call(comptes || {}, uid))', 'if (false)'],
  'contre : sous le plancher sans le dire': ['messages/contreOffre.js', 'if (c < p) return', 'if (false) return'],
  'contre : à ou sous l\'offre permis': ['messages/contreOffre.js', 'if (o != null && c <= o)', 'if (false)'],
  'avatar : « pas de photo » gardée': ['filUnique.js', "if (/\\/assets\\/no-photo\\//i.test(u) || /\\/no[-_]?photo/i.test(u)) return null;", ''],
};

async function charger(mut) {
  if (!mut) return {
    S: await import(pathToFileURL(path.join(SRC, 'messages', 'statutExtension.js')).href),
    C: await import(pathToFileURL(path.join(SRC, 'messages', 'contreOffre.js')).href),
    F: await import(pathToFileURL(path.join(SRC, 'filUnique.js')).href),
  };
  // Une copie de src/ (les seuls fichiers lus) dans un dossier temporaire, la règle affaiblie.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mparf-'));
  for (const f of ['messages/statutExtension.js', 'messages/contreOffre.js', 'filUnique.js', 'questionsEbay.js', 'extension/peutFaire.js']) {
    const d = path.join(dir, f); fs.mkdirSync(path.dirname(d), { recursive: true });
    let t = fs.readFileSync(path.join(SRC, f), 'utf8');
    if (f === mut[0]) { if (!t.includes(mut[1])) throw new Error('mutation introuvable : ' + mut[1]); t = t.replace(mut[1], mut[2]); }
    fs.writeFileSync(d, t);
  }
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  try {
    return {
      S: await import(pathToFileURL(path.join(dir, 'messages', 'statutExtension.js')).href),
      C: await import(pathToFileURL(path.join(dir, 'messages', 'contreOffre.js')).href),
      F: await import(pathToFileURL(path.join(dir, 'filUnique.js')).href),
    };
  } finally { setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }, 50); }
}

function juger({ S, C, F }) {
  const ok = [], ko = [];
  const verif = (c, t, d) => (c ? ok : ko).push(t + (c || d == null ? '' : ' — ' + JSON.stringify(d)));
  const T = 1_800_000_000_000;
  const moi = { id: 'u-moi', email: 'vendeur@exemple.test' };
  const etat = (o = {}) => ({ ok: true, vrm: { connecte: true, user_id: 'u-moi' }, vinted: { uid: '41000001', login: 'boutique_a' }, ...o });
  const faits = (o = {}, e = {}) => ({ maintenant: T, attendue: '5.455.7', capacites: {}, telephone: false, moi, relais: { niveau: 'hors' },
    noms: { vinted: { 41000001: 'boutique_a', 41000002: 'atelier_b' } },
    ext: { present: true, appelsFinis: true, installeeIci: true, version: '5.455.7', plusieurs: [], perime: false, etat: etat(e), ...o } });
  const comptes = { 41000001: 'boutique_a', 41000002: 'atelier_b' };
  const st = (f, at = T - 5000, extra = {}) => S.statutExtension({ faits: f, at, essai: at, maintenant: T, comptes, ...extra });

  // S — trois états, datés
  let r = st(faits());
  verif(r.etat === 'ok' && r.compte === '41000001' && r.vars.compte === 'boutique_a' && r.at === T - 5000, 'S1 connectée, à jour, boutique_a dans l\'onglet ⇒ « ok », daté', r);
  r = st(faits({ version: '5.455.6' }));
  verif(r.etat === 'ecart' && r.code === 'maj', 'S2 version plus ancienne que celle servie (5.455.6 < 5.455.7) ⇒ « différente » (jamais « à jour »)', r);
  r = st(faits({}, { vrm: { connecte: true, user_id: 'u-autre', email: 'autre@exemple.test' } }));
  verif(r.etat === 'ecart' && r.code === 'autre-vrm', 'S3 branchée à un autre compte VRM ⇒ « différente »', r);
  r = st(faits({}, { vinted: null }));
  verif(r.etat === 'ecart' && r.code === 'sans-onglet', 'S4 aucun compte Vinted dans l\'onglet ⇒ « différente » (plus « compte de l\'onglet »)', r);
  r = st(faits({}, { vinted: { uid: '99999999', login: 'inconnu' } }));
  verif(r.etat === 'ecart' && r.code === 'compte-non-relie', 'S5 un compte non relié à VRM ouvert sur vinted.fr ⇒ « différente »', r);
  r = st(faits({}, { vintedPasSu: true }));
  verif(r.etat === 'ecart' && r.code === 'onglet-passu', 'S6 cookie pas lu ⇒ « différente », jamais « ok »', r);
  r = st(faits({ present: false, installeeIci: false }));
  verif(r.etat === 'injoignable' && r.code === 'absente', 'S7 aucune extension ici ⇒ « pas joignable »', r);
  r = st(faits({ etat: null }));
  verif(r.etat === 'injoignable' && r.code === 'muette', 'S8 elle ne répond plus (deux ratés) ⇒ « pas joignable »', r);
  r = st(faits(), T - 120000);
  verif(r.etat === 'injoignable' && r.code === 'ancien' && r.vars.s === 120, 'S9 la dernière réponse a 2 min ⇒ « pas joignable » (la cause du « parfois faux »)', r);
  r = st(faits({ etat: undefined }), 0, { essai: T - 2000 });
  verif(r.etat === 'verif', 'S10 première réponse attendue ⇒ « on vérifie » (ni oui ni non)', r);
  r = st(faits({ etat: undefined }), 0, { essai: T - 15000 });
  verif(r.etat !== 'ok', 'S11 « on vérifie » ne devient jamais « ok » sans réponse', r);
  r = S.statutExtension({ faits: null, maintenant: T, comptes });
  verif(r.etat === 'verif', 'S12 aucun fait posé ⇒ « on vérifie »', r);

  // C — Autre prix
  const pl = { c: 5000, de: 'mini' };
  const c = (saisi, o = {}) => C.prixContreOffre({ saisi, offre: 40, affiche: 85, plancher: pl, ...o });
  verif(c('62').ok && c('62').code === 'ok' && c('62').prix === 62, 'C1 62 € au-dessus du plancher (50 €) ⇒ permis', c('62'));
  verif(c('45').ok && c('45').sous === true && c('45').code === 'sousPlancher', 'C2 45 € sous le plancher ⇒ « sous » (il faut le forcer)', c('45'));
  verif(!c('40').ok && c('40').code === 'sousOffre' && !c('39').ok, 'C3 à ou sous l\'offre reçue ⇒ refusé', c('40'));
  verif(!c('90').ok && c('90').code === 'dessusAffiche', 'C4 au-dessus du prix affiché ⇒ refusé', c('90'));
  verif(!c('abc').ok && c('abc').code === 'illisible' && !c('').ok && c('').code === 'vide' && !c('0,5', { offre: 0.1 }).ok, 'C5 illisible, vide, moins de 1 € ⇒ refusé (jamais 0)');
  verif(c('62,50').prix === 62.5 && c('62.5 €').prix === 62.5, 'C6 « 62,50 » et « 62.5 € » se lisent pareil', c('62,50'));
  verif(c('62', { plancher: null }).ok && c('62', { plancher: null }).sansPlancher === true, 'C7 aucun plancher connu ⇒ « sans plancher » (il faut le forcer)', c('62', { plancher: null }));

  // A — la photo de profil
  const url = 'https://images1.vinted.net/t/01_abc/f800/123.jpeg?s=x';
  verif(F.avatarPersonne({ url }) === url && F.avatarPersonne(url) === url, 'A1 une photo https de Vinted est gardée');
  verif(F.avatarPersonne({ url: 'https://static.vinted.com/assets/no-photo/user-clothing/system-photo/default.png' }) === null, 'A2 l\'image « pas de photo » de Vinted ⇒ l\'initiale');
  verif(F.avatarPersonne({ url: 'http://x.test/a.jpg' }) === null && F.avatarPersonne({ url: 'data:image/png;base64,AAAA' }) === null && F.avatarPersonne(null) === null, 'A3 ni http, ni data:, ni rien');
  const conv = { id: 7300001, updated_at: '2026-11-28T10:00:00Z', description: 'Bonjour', opposite_user: { id: 5001, login: 'acheteuse_lea', photo: { url } }, _acc: { vinted_user_id: '41000001' } };
  const e1 = F.convVinted(conv, null), e2 = F.convVinted({ ...conv, opposite_user: { id: 5001, login: 'acheteuse_lea' } }, null);
  verif(e1 && e1.avatar === url && e2 && e2.avatar === null && e1.cle === e2.cle && e1.interlocuteur === e2.interlocuteur, 'A4 `convVinted` porte la photo (`avatar`) ; la clé du fil et l\'interlocuteur n\'en dépendent pas');
  return { ok, ko };
}

(async () => {
  if (process.argv.includes('--mutation')) {
    const base = juger(await charger(null));
    if (base.ko.length) { console.log('❌ l\'arbre de départ n\'est pas vert'); base.ko.forEach((x) => console.log('   ' + x)); process.exit(1); }
    let rate = 0;
    for (const [nom, m] of Object.entries(MUTATIONS)) {
      const r = juger(await charger(m));
      if (r.ko.length) console.log(`  ✅ rouge — ${nom} (${r.ko[0].slice(0, 80)})`); else { console.log(`  ❌ reste VERT — ${nom}`); rate++; }
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) restent vertes` : `\n✅ audit-messages-parfaits --mutation : ${Object.keys(MUTATIONS).length} mutations, toutes rouges`);
    process.exit(rate ? 1 : 0);
  }
  const r = juger(await charger(null));
  r.ok.forEach((x) => console.log('✅ ' + x)); r.ko.forEach((x) => console.log('❌ ' + x));
  console.log(`\n${r.ko.length ? '❌' : '✅'} audit-messages-parfaits : ${r.ok.length} verts, ${r.ko.length} rouge(s)`);
  process.exit(r.ko.length ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
