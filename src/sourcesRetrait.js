// ════════════════════════════════════════════════════════════════════════════
//  D'OÙ VIENT CHAQUE INFORMATION D'UN COLIS À RETIRER (10 nov., retraits irréprochables)
//  Julien : « il faut vraiment quelque chose de parfait, d'irréprochable, il doit y avoir aucune
//  erreur, impossible que ce soit sur les messages, les mails et la lecture sur Vinted directement ».
//
//  Une règle pure, une fois pour la carte « à retirer » (Colis), son détail et les bancs :
//   · les MARQUES : quelles sources ont vu CE colis — `vinted` (la commande ou son suivi, lus sur
//     Vinted par l'extension), `email` (e-mail du transporteur ou de Vinted), `message` (la
//     conversation Vinted de SA commande), `sms`, `transporteur` (son site, lu par VRM) ;
//   · LE CODE, par identité seulement (§5) : celui des e-mails/SMS de CE n° (le plus récent fait foi
//     entre eux — un nouveau code émis pour ce n° remplace l'ancien, règle du 1er nov.) et celui de la
//     conversation de SA commande (reliée par n° de suivi, code ou conversation — jamais le titre).
//     Deux sources DIFFÉRENTES qui donnent le même code ⇒ « sûr ». Deux codes différents ⇒ DÉSACCORD :
//     la carte le dit en ambre avec les deux valeurs et leur source — jamais un choix silencieux.
//     (Avant : la carte d'un e-mail ne montrait que le code de l'e-mail ; celui de la conversation,
//     s'il différait, était ignoré, et s'il était seul, la carte disait « code pas encore lu ».)
//   · L'HEURE DE LA DERNIÈRE VÉRIFICATION : la plus récente des lectures datées (e-mail reçu, lecture
//     chez le transporteur, conversation lue, achats relus sur Vinted). Rien de daté ⇒ null (« — »).
// ════════════════════════════════════════════════════════════════════════════

export const NOMS_SOURCES = { vinted: 'Vinted', email: 'e-mail', message: 'message', sms: 'SMS', transporteur: 'transporteur' };
const ORDRE = ['vinted', 'email', 'message', 'sms', 'transporteur'];

const msDe = (v) => { if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };
// Un code de retrait tel qu'on le compare : majuscules, sans espace.
export const normCode = (c) => String(c == null ? '' : c).toUpperCase().replace(/[\s ]+/g, '');

// La source d'une ligne de suivi (e-mail, SMS, ou ligne fabriquée depuis le transporteur).
export function sourceDeLigne(t) {
  if (!t) return null;
  if (t.source === 'sms') return 'sms';
  if (t.synthetique || (t.viaTransporteur && !t.subject)) return 'transporteur';
  return 'email';
}

// Ce qu'UNE ligne dit du code : sa source, son ÉMETTEUR (le transporteur de la ligne, « vinted » pour un
// e-mail de Vinted) — deux e-mails d'un même émetteur (un rappel qui redit le code) ne font qu'UNE voix.
export function codeLuDeLigne(t) {
  return { source: sourceDeLigne(t), emetteur: t && t.source === 'vinted-commande' ? 'vinted' : String((t && t.carrier) || ''), code: t ? t.code : '', at: msDe(t && t.emailAt) ?? msDe(t && t.receivedAt) };
}

// Les codes LUS sur les lignes d'un colis : [{ source, code, at }]. Une ligne fusionnée (deux e-mails
// du même n°) porte `codesLus` ; sinon sa propre valeur.
export function codesDesLignes(t, codeValide = (c) => normCode(c)) {
  if (!t) return [];
  const brut = Array.isArray(t.codesLus) && t.codesLus.length ? t.codesLus : [codeLuDeLigne(t)];
  return brut.map((x) => ({ source: x.source || 'email', emetteur: x.emetteur || '', code: codeValide(x.code) ? normCode(codeValide(x.code)) : '', at: msDe(x.at) })).filter((x) => x.code);
}

// Ce que valent les codes d'un colis. `lignes` : [{ source, code, at }] (e-mails, SMS) ; `message` : le
// code de la conversation de SA commande ('' si aucun). Rend
//   { code, sources, sur, desaccord: null | [{ source, code }], remplace: null | { code, source } }.
export function verdictCode({ lignes = [], message = '' } = {}) {
  const ls = (lignes || []).filter((x) => x && x.code);
  // Entre e-mails et SMS du même n° : le plus récent fait foi (un nouveau code remplace l'ancien).
  const tries = [...ls].sort((a, b) => (b.at || 0) - (a.at || 0));
  const retenu = tries[0] || null;
  const autresDates = tries.filter((x) => retenu && x.code !== retenu.code);
  // Un code plus ANCIEN, daté, d'un e-mail/SMS du même n° : remplacé (dit, pas un désaccord). Sans date
  // des deux côtés, on ne sait pas lequel est le plus récent : c'est un désaccord.
  const remplace = retenu && retenu.at != null && autresDates.length && autresDates.every((x) => x.at != null && x.at < retenu.at)
    ? { code: autresDates[0].code, source: autresDates[0].source } : null;
  const msg = normCode(message);
  const cand = [];
  if (retenu) cand.push({ source: retenu.source, code: retenu.code });
  if (!remplace) for (const x of autresDates) cand.push({ source: x.source, code: x.code });
  if (msg) cand.push({ source: 'message', code: msg });
  const distincts = [...new Set(cand.map((x) => x.code))];
  if (!distincts.length) return { code: '', sources: [], sur: false, desaccord: null, remplace };
  if (distincts.length > 1) {
    // Une valeur par code, avec ses sources : la carte les montre TOUTES.
    const parCode = distincts.map((c) => ({ code: c, sources: [...new Set(cand.filter((x) => x.code === c).map((x) => x.source))] }));
    return { code: '', sources: [], sur: false, desaccord: parCode.flatMap((p) => p.sources.map((s) => ({ source: s, code: p.code }))), remplace };
  }
  const code = distincts[0];
  const sources = [...cand.filter((x) => x.code === code).map((x) => x.source), ...ls.filter((x) => x.code === code).map((x) => x.source)];
  const uniques = ORDRE.filter((s) => sources.includes(s));
  // « Sûr » : au moins DEUX voix indépendantes (source + émetteur) donnent ce code — l'e-mail du
  // transporteur et la conversation, l'e-mail et le SMS, l'e-mail de Vinted et celui de la consigne.
  const voix = new Set(ls.filter((x) => x.code === code).map((x) => x.source + ':' + (x.emetteur || '')));
  if (msg === code) voix.add('message');
  return { code, sources: uniques, sur: voix.size >= 2, desaccord: null, remplace };
}

// Les marques et l'heure de la dernière vérification d'un colis.
//   t   : sa ligne de suivi (e-mail/SMS, fusionnée) ou null ;
//   o   : SA commande Vinted (reliée par identité) ou null — `capMs` : l'heure où ses achats ont été relus ;
//   r   : la conversation de cette commande (`panel_colis_relais[tx]`) ou null ;
//   tr  : la lecture chez le transporteur (par n°) ou null ;
//   vs  : le suivi Vinted de la commande (`harvest_*_suivi_*`) ou null.
export function sourcesDuColis({ t = null, o = null, r = null, tr = null, vs = null, capMs = null, codeValide } = {}) {
  const m = new Set();
  const dates = [];
  if (t) {
    const s = Array.isArray(t.codesLus) && t.codesLus.length ? t.codesLus.map((x) => x.source) : [sourceDeLigne(t)];
    for (const x of s) if (x) m.add(x);
    if (Array.isArray(t.sourcesLues)) for (const x of t.sourcesLues) if (x) m.add(x);
    const at = msDe(t.receivedAt) ?? msDe(t.emailAt); if (at != null && sourceDeLigne(t) !== 'transporteur') dates.push(at);
  }
  const trLu = tr && (tr.lu || tr.etat) ? tr : (t && t.transp && (t.transp.lu || t.transp.etat) ? t.transp : null);
  if (trLu) { m.add('transporteur'); const l = msDe(trLu.lu); if (l != null) dates.push(l); }
  if (o) { m.add('vinted'); if (msDe(capMs) != null) dates.push(msDe(capMs)); }
  if (vs) { m.add('vinted'); const c = msDe(vs.capturedAt) ?? msDe(vs.cap); if (c != null) dates.push(c); }
  const codeMsg = r && r.code ? r.code : '';
  if (r && (codeMsg || r.lieu || r.arriveLe)) { m.add('message'); const a = msDe(r.at); if (a != null) dates.push(a); }
  const v = verdictCode({ lignes: codesDesLignes(t, codeValide), message: codeValide ? (codeValide(codeMsg) || '') : codeMsg });
  return { marques: ORDRE.filter((x) => m.has(x)), code: v, verifieMs: dates.length ? Math.max(...dates) : null };
}

// « vérifié à 14:32 » (aujourd'hui), « vérifié hier 18:05 », « vérifié le 6 nov. » ; null ⇒ ''.
export function texteVerifie(ms, maintenant = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms), n = new Date(maintenant);
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const jour = (x) => x.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  if (jour(d) === jour(n)) return `vérifié à ${hm}`;
  if (jour(d) === jour(new Date(maintenant - 86400000))) return `vérifié hier ${hm}`;
  return `vérifié le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}`;
}
