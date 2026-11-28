// ═══════════════════════════════════════════════════════════════════════════
// « TOUT VA BIEN ? » — CE QUI TOURNE, MORCEAU PAR MORCEAU (27 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Retenu le 11 oct. (« page tout va bien ? »), étendu le 27 nov. : en tête de la page, UNE rangée par
// morceau qui doit tourner — l'extension de ce navigateur, chaque site (Vinted, Leboncoin, Vestiaire,
// eBay), les e-mails, la dernière capture, la file des favoris, le serveur. Chaque rangée a UN état :
//   'ok'      ça marche (pastille verte) ;
//   'geste'   bloqué : une phrase courte (≤ 8 mots) et LE geste ; le détail sous « Pourquoi ? » ;
//   'passu'   la sonde n'a pas répondu : ni vert ni alerte, la valeur est « — » et la raison est dite ;
//   'lecture' on lit encore (rien n'est affirmé) ;
//   'neutre'  rien à faire de ton côté (téléphone, aucun compte, une mise à jour qui peut attendre).
// Ce module ne lit rien et n'écrit rien : il RANGE ce que les lectures de toujours ont rendu
// (`etatNavigateur` de la page Extension, `lignesFraicheur`, les lignes d'appareils `ext_appareil_*`,
// `/api/email-rattacher?mode=reception`, `/api/compte?mode=favoris&carte=1`, `/api/sante`).
// « Pas su » ne vaut jamais « oui » : `undefined` = en cours, `null` = pas su, sinon la valeur lue.
// Les textes sont des CLÉS `tr()` (src/i18n/langues/*/toutVaBienSondes.js) et leurs variables.
// JS pur : scripts/bancs/tout-va-bien-sondes.cjs l'exécute (mutations comprises).
// ═══════════════════════════════════════════════════════════════════════════

export const SITES_SONDES = Object.freeze(['vinted', 'leboncoin', 'vestiaire', 'ebay']);
export const CAPTURE_VIEILLE_MS = 24 * 3600e3;   // la même borne que « à relire » (src/comptesLies.js A_RELIRE_MS)
const NOMS_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' };
const ts = (v) => { const n = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(n) && n > 0 ? n : null; };
const L = (k, v = {}) => ({ k, v });
const PASSU = '—';

// ── 1. L'extension de CE navigateur ─────────────────────────────────────────
// `nav` : etatNavigateur(…) (src/extension/peutFaire.js) ; `contact` : le dernier signe d'une extension
// (ligne d'appareil la plus récente), null = pas su.
const SOUS_GESTE_EXT = { absente: 'tvb.s.ext.absente', ailleurs: 'tvb.s.ext.absente', muette: 'tvb.s.ext.muette', 'vrm-passu': 'tvb.s.ext.muette',
  vrm: 'tvb.s.ext.vrm', 'autre-vrm': 'tvb.s.ext.autre', retard: 'tvb.s.ext.retard', 'telephone-retard': 'tvb.s.ext.retard', plusieurs: 'tvb.s.ext.plusieurs', perime: 'tvb.s.ext.plusieurs' };
const VALEUR_GESTE_EXT = { installer: 'tvb.g.installer', 'mettre-a-jour': 'tvb.g.maj', brancher: 'tvb.g.brancher' };
export function sondeExtension(nav, { contact = null, quand = String, attendue = '' } = {}) {
  const base = { cle: 'extension', titre: L('tvb.s.ext') };
  if (nav === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  if (!nav || typeof nav !== 'object' || nav.code === 'verif' || nav.code === 'vrm-encours')
    return { ...base, etat: 'passu', sous: L('tvb.s.ext.passu'), valeur: PASSU, pourquoi: [L('tvb.s.ext.passu.p')] };
  const vu = contact ? L('tvb.s.contact', { quand: quand(contact) }) : L('tvb.s.contact.passu');
  if (nav.ton === 'ok') return { ...base, etat: 'ok', sous: L('tvb.s.ext.ok', { v: (nav.vars && nav.vars.version) || '' }), valeur: null, pourquoi: [L(nav.cle, nav.vars || {}), L('tvb.s.ext.attendue', { attendue }), vu] };
  if (nav.ton === 'geste') return { ...base, etat: 'geste', sous: L(SOUS_GESTE_EXT[nav.code] || 'tvb.s.ext.regler'), valeur: L(VALEUR_GESTE_EXT[nav.geste] || 'tvb.g.voir'),
    pourquoi: [L(nav.cle, nav.vars || {}), L('tvb.s.ext.attendue', { attendue }), vu], geste: { type: 'extension', geste: nav.geste || null }, code: nav.code };
  // neutre : le téléphone (l'ordinateur agit), une mise à jour qui peut attendre.
  return { ...base, etat: 'neutre', sous: L(nav.code === 'maj' ? 'tvb.s.ext.maj' : 'tvb.s.ext.ailleurs', { attendue }), valeur: null,
    pourquoi: [L(nav.cle, nav.vars || {}), vu], geste: nav.code === 'maj' ? { type: 'extension', geste: 'mettre-a-jour' } : null, code: nav.code };
}

// ── 2. Chaque site : ses comptes, leur dernière lecture COMPLÈTE ────────────
// `lignes` : lignesFraicheur(…) (src/fraicheurComptes.js : relu il y a plus de 24 h ⇒ « à relire ») ;
// `pannes` : les comptes dont l'envoi est REFUSÉ (api/_lib/garde-capture.js) ; `passu` : sites pas lus.
export function sondeSite(site, { lignes, pannes = [], passu = [] } = {}) {
  const nomSite = NOMS_SITE[site] || site;
  const base = { cle: 'site:' + site, site, titre: L('tvb.s.site', { site: nomSite }) };
  if ((passu || []).includes(site)) return { ...base, etat: 'passu', sous: L('tvb.s.site.passu'), valeur: PASSU, pourquoi: [L('tvb.s.site.passu.p', { site: nomSite })] };
  if (lignes === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  const les = (Array.isArray(lignes) ? lignes : []).filter((l) => l && l.plateforme === site);
  if (!les.length) return null;   // aucun compte sur ce site : pas de rangée
  const enPanne = new Map((pannes || []).filter((p) => p && p.plateforme === site).map((p) => [String(p.id), p]));
  const actifs = les.filter((l) => !String(l.bloque || '').startsWith('masqué') && l.etat !== 'banni');
  const regle = L('tvb.s.site.regle', { site: nomSite });
  const detail = les.map((l) => L('tvb.s.site.compte', { compte: l.nom || l.id, quand: l.quand || '' }));
  if (!actifs.length) return { ...base, etat: 'neutre', sous: L('tvb.s.site.aucunActif'), valeur: null, pourquoi: [...detail] };
  const panne = actifs.find((l) => enPanne.has(String(l.id)));
  if (panne) { const p = enPanne.get(String(panne.id));
    return { ...base, etat: 'geste', sous: L('tvb.s.site.panne', { compte: panne.nom || panne.id }), valeur: L('tvb.g.voir'),
      pourquoi: [L('tvb.s.site.panne.p', { cause: String(p.cause || ''), geste: String(p.geste || '') }), ...detail], geste: { type: 'panne' } }; }
  const aRelire = actifs.filter((l) => l.geste);
  if (aRelire.length) return { ...base, etat: 'geste',
    sous: aRelire.length === 1 ? L(aRelire[0].etat === 'jamais' ? 'tvb.s.site.jamais' : 'tvb.s.site.un', { compte: aRelire[0].nom || aRelire[0].id }) : L('tvb.s.site.n', { n: aRelire.length }),
    valeur: site === 'ebay' ? L('tvb.g.ebay') : L('tvb.g.ouvrir', { site: nomSite }), pourquoi: [...aRelire.map((l) => L('tvb.s.site.geste', { compte: l.nom || l.id, geste: String(l.bloque || '') })), regle],
    geste: { type: 'compte', plateforme: site } };
  return { ...base, etat: 'ok', sous: L('tvb.s.site.ok', { n: actifs.length }), valeur: null, pourquoi: [...detail, regle] };
}

// ── 3. Les e-mails : la chaîne de réception (serveur) et le dernier e-mail rangé AU NOM du vendeur ──
// `reception` : la réponse de /api/email-rattacher?mode=reception ; `chaine` : `etat.emails` de /api/sante
// ('ok' | 'panne' | 'inconnu', api/_lib/etat-public.js) ou null/undefined.
export const COLLECTEUR_MUET_MS = 20 * 60000;   // la borne de src/receptionEmail.js `etatCollecteur`
export function sondeEmails(reception, { chaine, quand = String, maintenant = Date.now() } = {}) {
  const base = { cle: 'emails', titre: L('tvb.s.emails') };
  if (chaine === 'panne') return { ...base, etat: 'geste', sous: L('tvb.s.emails.panne'), valeur: L('tvb.g.voir'), pourquoi: [L('tvb.s.emails.panne.p')], geste: { type: 'aller', aller: '?tab=emails' } };
  if (reception === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  if (!reception || typeof reception !== 'object') return { ...base, etat: 'passu', sous: L('tvb.s.emails.passu'), valeur: PASSU, pourquoi: [L('tvb.s.emails.passu.p')] };
  const c = reception.collecteur || {};
  const passe = Math.max(ts(c.dernierPassage) || 0, ts(c.dernierSucces) || 0) || null;
  const dernier = ts(reception.dernierEmail);
  const vu = dernier ? L('tvb.s.emails.dernier', { quand: quand(dernier) }) : L('tvb.s.emails.aucun.p');
  if (!passe || passe > maintenant + 300000) return { ...base, etat: 'passu', sous: L('tvb.s.emails.inconnu'), valeur: PASSU, pourquoi: [L('tvb.s.emails.inconnu.p'), vu] };
  if (maintenant - passe > COLLECTEUR_MUET_MS || (c.etat === 'erreur' && !(ts(c.dernierSucces) > ts(c.dernierPassage))))
    return { ...base, etat: 'geste', sous: L('tvb.s.emails.alerte'), valeur: L('tvb.g.voir'), pourquoi: [L('tvb.s.emails.alerte.p', { quand: quand(passe) }), vu], geste: { type: 'aller', aller: '?tab=emails' } };
  if (!dernier) return { ...base, etat: 'neutre', sous: L('tvb.s.emails.aucun'), valeur: null, pourquoi: [L('tvb.s.emails.ok.p', { quand: quand(passe) }), vu], geste: { type: 'aller', aller: '?tab=emails' } };
  return { ...base, etat: 'ok', sous: L('tvb.s.emails.ok', { quand: quand(dernier) }), valeur: null, pourquoi: [L('tvb.s.emails.ok.p', { quand: quand(passe) }), vu] };
}

// ── 4. La dernière capture : le dernier envoi ACCEPTÉ d'une extension, tous appareils ──
// `appareils` : lireAppareils(…) (api/_lib/garde-capture.js) — undefined en cours, null pas lu.
export function sondeCapture(appareils, { quand = String, maintenant = Date.now() } = {}) {
  const base = { cle: 'capture', titre: L('tvb.s.capture') };
  if (appareils === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  if (!Array.isArray(appareils)) return { ...base, etat: 'passu', sous: L('tvb.s.capture.passu'), valeur: PASSU, pourquoi: [L('tvb.s.capture.passu.p')] };
  let best = null;
  for (const a of appareils) for (const f of Object.values((a && a.flux) || {})) { const t = ts(f && f.okAt); if (t && (!best || t > best.at)) best = { at: t, ou: a.nom || '' }; }
  if (!best) return { ...base, etat: 'neutre', sous: L('tvb.s.capture.aucune'), valeur: null, pourquoi: [L('tvb.s.capture.aucune.p')] };
  const p = [L('tvb.s.capture.p', { quand: quand(best.at), ou: best.ou })];
  if (maintenant - best.at > CAPTURE_VIEILLE_MS) return { ...base, etat: 'geste', sous: L('tvb.s.capture.vieille'), valeur: L('tvb.g.ouvrir', { site: 'Vinted' }),
    pourquoi: [...p, L('tvb.s.capture.vieille.p')], geste: { type: 'compte', plateforme: 'vinted' } };   // le lien du site : LIENS_SITE_TVB (src/ToutVaBien.jsx)
  return { ...base, etat: 'ok', sous: L('tvb.s.capture.ok', { quand: quand(best.at) }), valeur: null, pourquoi: p };
}

// ── 5. La file des favoris (serveur), compte par compte ─────────────────────
// `files` : [{ uid, nom, carte }] — `carte` = resumeFileCarte (api/_lib/favoris-carte.js), null = pas lue ;
// undefined = en cours ; null = les comptes Vinted pas lus.
export function sondeFavoris(files, { quand = String } = {}) {
  const base = { cle: 'favoris', titre: L('tvb.s.fav') };
  if (files === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  if (!Array.isArray(files)) return { ...base, etat: 'passu', sous: L('tvb.s.fav.passu'), valeur: PASSU, pourquoi: [L('tvb.s.fav.passu.p')] };
  if (!files.length) return null;   // aucun compte Vinted : pas de file
  const lues = files.filter((f) => f && f.carte && typeof f.carte === 'object');
  const ratees = files.filter((f) => !(f && f.carte && typeof f.carte === 'object'));
  const manque = ratees.length ? [L('tvb.s.fav.partiel', { comptes: ratees.map((f) => f.nom || f.uid).join(', ') })] : [];
  const geste = { type: 'aller', aller: '?tab=favoris' };
  const incertains = lues.reduce((s, f) => s + (Number(f.carte.incertains) || 0), 0);
  if (incertains) return { ...base, etat: 'geste', sous: L('tvb.s.fav.incertains', { n: incertains }), valeur: L('tvb.g.voir'), pourquoi: [L('tvb.s.fav.incertains.p'), ...manque], geste };
  const enPause = lues.find((f) => !f.carte.active && (Number(f.carte.attente) || 0) > 0);
  if (enPause) return { ...base, etat: 'geste', sous: L('tvb.s.fav.pause', { compte: enPause.nom || enPause.uid }), valeur: L('tvb.g.voir'),
    pourquoi: [enPause.carte.raison ? L('tvb.s.fav.raison', { raison: String(enPause.carte.raison) }) : L('tvb.s.fav.pause.p'), ...manque], geste };
  if (!lues.length) return { ...base, etat: 'passu', sous: L('tvb.s.fav.passu'), valeur: PASSU, pourquoi: [L('tvb.s.fav.passu.p'), ...manque] };
  // Un compte pas lu : rien n'est affirmé pour la file entière (« pas su » ne vaut pas « oui »).
  if (ratees.length) return { ...base, etat: 'passu', sous: L('tvb.s.fav.passu'), valeur: PASSU, pourquoi: manque };
  const actives = lues.filter((f) => f.carte.active);
  if (actives.length) {
    const attente = actives.reduce((s, f) => s + (Number(f.carte.attente) || 0) + (Number(f.carte.encours) || 0), 0);
    const prochain = actives.map((f) => Number(f.carte.prochain) || 0).filter((x) => x > 0).sort((a, b) => a - b)[0];
    return { ...base, etat: 'ok', sous: L('tvb.s.fav.encours', { n: attente }), valeur: null, pourquoi: [prochain ? L('tvb.s.fav.prochain', { quand: quand(prochain) }) : L('tvb.s.fav.encours.p')] };
  }
  return { ...base, etat: 'ok', sous: L('tvb.s.fav.vide'), valeur: null, pourquoi: [L('tvb.s.fav.vide.p')] };
}

// ── 6. Le serveur : /api/sante (la base, les notifications) ──────────────────
export function sondeServeur(sante) {
  const base = { cle: 'serveur', titre: L('tvb.s.srv') };
  if (sante === undefined) return { ...base, etat: 'lecture', sous: L('tvb.s.lecture'), valeur: null, pourquoi: [] };
  if (!sante || sante.ok !== true || !sante.etat || typeof sante.etat !== 'object') return { ...base, etat: 'passu', sous: L('tvb.s.srv.passu'), valeur: PASSU, pourquoi: [L('tvb.s.srv.passu.p')] };
  const e = sante.etat;
  const notifs = e.notifications === 'ok' ? L('tvb.s.srv.notifs.ok') : e.notifications === 'panne' ? L('tvb.s.srv.notifs.panne') : L('tvb.s.srv.notifs.passu');
  if (e.base === 'panne') return { ...base, etat: 'geste', sous: L('tvb.s.srv.panne'), valeur: L('tvb.g.etat'), pourquoi: [L('tvb.s.srv.panne.p'), notifs], geste: { type: 'lien', lien: '/statut' } };
  if (e.base !== 'ok') return { ...base, etat: 'passu', sous: L('tvb.s.srv.passu'), valeur: PASSU, pourquoi: [L('tvb.s.srv.inconnu.p'), notifs] };
  return { ...base, etat: 'ok', sous: L('tvb.s.srv.ok'), valeur: null, pourquoi: [L('tvb.s.srv.ok.p'), notifs] };
}

// ── Toutes les rangées, dans l'ordre de la page ─────────────────────────────
export function sondesToutVaBien(p = {}) {
  const out = [sondeExtension(p.nav, { contact: p.contact, quand: p.quand, attendue: p.attendue })];
  for (const s of SITES_SONDES) { const r = sondeSite(s, { lignes: p.lignes, pannes: p.pannes, passu: p.passuSites }); if (r) out.push(r); }
  out.push(sondeEmails(p.reception, { chaine: p.sante && p.sante.ok === true && p.sante.etat ? p.sante.etat.emails : undefined, quand: p.quand, maintenant: p.maintenant }));
  out.push(sondeCapture(p.appareils, { quand: p.quand, maintenant: p.maintenant }));
  const f = sondeFavoris(p.favoris, { quand: p.quand }); if (f) out.push(f);
  out.push(sondeServeur(p.sante));
  return out;
}
// Le résumé : ce qui demande un geste, ce qui n'a pas répondu, ce qu'on lit encore.
export const bilanSondes = (sondes) => ({
  gestes: sondes.filter((s) => s.etat === 'geste').length,
  passu: sondes.filter((s) => s.etat === 'passu').map((s) => s.cle),
  lecture: sondes.some((s) => s.etat === 'lecture'),
});
