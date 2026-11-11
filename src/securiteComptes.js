// ════════════════════════════════════════════════════════════════════════════
//  SÉCURITÉ DES COMPTES (Vinted, Vestiaire… — 11 nov., lot securite-vinted)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « améliore la sécurité des comptes Vinted pour faire comme Vintex,
// pour ne pas se faire bannir », puis « on peut faire la même chose avec
// Vestiaire Collective ». Récit : docs/passation/2026-11-11-securite-vinted.md.
//
// UNE règle, pure (rien lu, rien écrit, rien envoyé), par plateforme et par
// compte. Le bloc <securite-comptes-regle> est RECOPIÉ tel quel dans
// vinted-sync-extension/background.js (`node scripts/audit-securite-comptes.cjs
// --recopie`) : l'extension décide avec la MÊME règle que l'écran l'explique.
//
// ⚠️ Rien ne se relâche ici : le plafond de 50 actions/heure/compte (sa décision
//    du 29 oct.), la réserve de 5, la pause 429/403, « une requête à la fois »,
//    le compte de l'onglet seulement restent dans l'extension, AVANT cette règle.
//    Cette couche n'ajoute que des freins (jamais une place de plus).
// ⚠️ Refusé (CLAUDE.md §3), et absent d'ici exprès : changer d'empreinte,
//    d'appareil, d'adresse IP, modifier une photo pour tromper, piloter la souris.
//
// Les MODES d'un geste (qui l'a voulu, quand il part) :
//   auto       VRM décide seul (offres auto, mode auto des favoris)
//   programme  lancé par lui, part plus tard sans lui (mise en ligne programmée, file)
//   serie      lancé par lui, part maintenant en série (baisses, Republier, favoris)
//   suite      la fin d'un geste DÉJÀ commencé (la mise en ligne d'une paire
//              republiée : jamais une paire laissée entre suppression et brouillon)
//   visite     fait pendant sa visite sur le site (bordereau généré en passant)
//   clic       UN geste sur son clic (répondre, trancher une offre)
// ════════════════════════════════════════════════════════════════════════════

// <securite-comptes-regle>
const SECU_V = 1;
const SECU_PLATEFORMES = ['vinted', 'vestiaire', 'leboncoin'];
const SECU_NOMS = { vinted: 'Vinted', vestiaire: 'Vestiaire', leboncoin: 'Leboncoin' };
const SECU_HOTES = { vinted: 'vinted.fr', vestiaire: 'vestiairecollective.com', leboncoin: 'leboncoin.fr' };
const SECU_SORTES = ['offre', 'favori', 'republication', 'mise_en_ligne', 'baisse', 'reponse', 'vacances', 'bordereau', 'publication', 'autre'];
const SECU_TYPES_REGLABLES = ['offre', 'favori', 'republication', 'baisse', 'reponse'];
const SECU_MODES = ['auto', 'programme', 'serie', 'suite', 'visite', 'clic'];
const SECU_SANS_LUI = ['auto', 'programme'];          // partent sans qu'il soit derrière l'écran
const SECU_COMPTES = ['auto', 'programme', 'serie'];  // comptent dans le plafond du jour et par type
const SECU_DEFAUT = {
  repos: { actif: true, debut: 23 * 60, fin: 8 * 60 },  // 23 h → 8 h (heure de Paris)
  varierMin: 9,          // chaque jour, début et fin bougent de ±9 min au plus
  parJour: 0,            // 0 = pas de plafond par jour (son choix) ; sinon N gestes VRM par jour
  parType: {},           // { offre: 10, … } par HEURE, à l'intérieur des 50/h ; 0/absent = rien de plus
  espaceS: 40,           // au moins 40 s (plus un tirage) entre deux gestes AUTOMATIQUES d'un même compte
  presence: { actif: true, min: 30 },   // « n'agir que si tu es là » : onglet utilisé il y a ≤ 30 min
  calme: [],             // jours de la semaine (0 = dimanche … 6 = samedi) : rien d'automatique
  calmeDates: [],        // journées calmes posées une fois ('AAAA-MM-JJ')
  rodage: true,          // un compte récent démarre plus doucement
};
const SECU_CLIC_MS = 3000;            // deux clics du même compte : 3 s au moins (jamais une rafale)
const SECU_CLIC_PRUDENCE_MS = 20000;  // en prudence : 20 s
const SECU_SERIE_MS = 8000;           // une série qu'il a lancée : 8 à 14 s au moins entre deux gestes (son espacement à lui s'ajoute)
const SECU_ATTENTE_MAX_MS = 25000;    // l'extension n'attend jamais plus (l'app attend sa réponse) : au-delà, « plus tard », dit
const SECU_REVEIL_MIN = 40;           // les 40 min après le repos : un geste toutes les 4 à 7 min
const SECU_PRUDENCE_MS = { 429: 3 * 3600000, 403: 6 * 3600000, restreint: 24 * 3600000, apresRobot: 6 * 3600000 };
const SECU_RODAGE = { jeune: { heure: 10, jours: 7, ventes: 3 }, recent: { heure: 25, jours: 30, ventes: 10 } };

function secuEntier(v, min, max, def) {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function secuCle(plateforme, compte) {
  const p = String(plateforme || ''), c = String(compte == null ? '' : compte);
  return SECU_PLATEFORMES.includes(p) && /^[\w-]{1,40}$/.test(c) ? p + ':' + c : '';
}
// Un réglage lu (de n'importe où) rendu PROPRE : champ par champ, bornes tenues.
function secuNet(r, base) {
  const b = base || SECU_DEFAUT, x = r && typeof r === 'object' ? r : {};
  const rp = x.repos && typeof x.repos === 'object' ? x.repos : {};
  const pr = x.presence && typeof x.presence === 'object' ? x.presence : {};
  const pt = {};
  const srcType = x.parType && typeof x.parType === 'object' ? x.parType : {};
  for (const s of SECU_TYPES_REGLABLES) {
    const v = s in srcType ? secuEntier(srcType[s], 0, 50, 0) : secuEntier((b.parType || {})[s], 0, 50, 0);
    if (v > 0) pt[s] = v;
  }
  const jours = Array.isArray(x.calme) ? x.calme : b.calme;
  const dates = Array.isArray(x.calmeDates) ? x.calmeDates : b.calmeDates;
  return {
    repos: {
      actif: typeof rp.actif === 'boolean' ? rp.actif : b.repos.actif,
      debut: secuEntier(rp.debut, 0, 1439, b.repos.debut),
      fin: secuEntier(rp.fin, 0, 1439, b.repos.fin),
    },
    varierMin: secuEntier(x.varierMin, 0, 30, b.varierMin),
    parJour: secuEntier(x.parJour, 0, 1200, b.parJour),
    parType: pt,
    espaceS: secuEntier(x.espaceS, 20, 900, b.espaceS),
    presence: { actif: typeof pr.actif === 'boolean' ? pr.actif : b.presence.actif, min: secuEntier(pr.min, 5, 720, b.presence.min) },
    calme: [...new Set((jours || []).map((d) => secuEntier(d, -1, 7, -1)).filter((d) => d >= 0 && d <= 6))].sort(),
    calmeDates: [...new Set((dates || []).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-14),
    rodage: typeof x.rodage === 'boolean' ? x.rodage : b.rodage,
  };
}
// Les réglages d'UN compte : le défaut, puis la plateforme, puis le compte.
function secuReglages(tout, plateforme, compte) {
  const t = tout && typeof tout === 'object' ? tout : {};
  const pf = (t.plateformes && t.plateformes[plateforme]) || null;
  const cle = secuCle(plateforme, compte);
  const cp = (cle && t.comptes && t.comptes[cle]) || null;
  return secuNet(cp, secuNet(pf, SECU_DEFAUT));
}
// L'heure de Paris : jour 'AAAA-MM-JJ', minute du jour, jour de la semaine.
function secuParis(ms) {
  const d = new Date(Number(ms));
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(d);
    const g = (k) => (p.find((x) => x.type === k) || {}).value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    return { jour: `${g('year')}-${g('month')}-${g('day')}`, min: Number(g('hour')) * 60 + Number(g('minute')) + Number(g('second')) / 60, dow };
  } catch (_) {
    return { jour: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
  }
}
function secuHash(s) {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// Le décalage du jour (en minutes, à la seconde près : jamais une heure ronde),
// le même pour l'app et l'extension, différent chaque jour et pour chaque compte.
function secuDecalage(jour, compte, cote, varierMin) {
  const v = Math.max(0, Number(varierMin) || 0) * 60;
  if (!v) return 0;
  return ((secuHash(`${jour}|${compte}|${cote}`) % (2 * v + 1)) - v) / 60;
}
function secuJourSuivant(jour) {
  const d = new Date(jour + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
// Le repos en cours (`{ jusqua }`), ou null ; `reveil` = la fin du repos est toute récente.
function secuRepos(reg, ms, compte) {
  const r = reg && reg.repos;
  if (!r || !r.actif || r.debut === r.fin) return { repos: null, reveil: null };
  const p = secuParis(ms), j = p.jour, demain = secuJourSuivant(j);
  const deb = r.debut + secuDecalage(j, compte, 'debut', reg.varierMin);
  const fin = r.fin + secuDecalage(j, compte, 'fin', reg.varierMin);
  const finDemain = r.fin + secuDecalage(demain, compte, 'fin', reg.varierMin);
  const a = (minutes) => Math.round(ms + (minutes - p.min) * 60000);
  let repos = null;
  if (r.debut > r.fin) {
    if (p.min < fin) repos = { jusqua: a(fin) };
    else if (p.min >= deb) repos = { jusqua: a(1440 + finDemain) };
  } else if (p.min >= deb && p.min < fin) repos = { jusqua: a(fin) };
  let reveil = null;
  if (!repos && p.min >= fin && p.min < fin + SECU_REVEIL_MIN) reveil = { jusqua: a(fin + SECU_REVEIL_MIN) };
  return { repos, reveil };
}
function secuCalme(reg, ms) {
  const p = secuParis(ms);
  if (!(reg && ((reg.calme || []).includes(p.dow) || (reg.calmeDates || []).includes(p.jour)))) return null;
  return { jusqua: Math.round(ms + (1440 - p.min) * 60000), jour: p.jour };
}
// Un délai VARIABLE entre deux bornes : jamais une minute ronde (une valeur à
// moins de 1,5 s d'une minute pleine reçoit 2,3 à 6,4 s de plus).
function secuDelaiVariable(minMs, maxMs, rnd) {
  const r = typeof rnd === 'function' ? rnd : Math.random;
  const a = Math.max(0, Number(minMs) || 0), b = Math.max(a, Number(maxMs) || a);
  let v = a + r() * (b - a);
  const reste = v % 60000;
  if (reste < 1500 || reste > 58500) v += 2300 + r() * 4100;
  return Math.round(v);
}
// L'espacement voulu après le geste de `dernier` : la base, plus un tirage qui
// dépend de ce geste (l'app et l'extension disent la même heure), à la seconde.
function secuCible(baseMs, dernier) {
  const h = secuHash('espace|' + dernier);
  let v = baseMs + (h % Math.max(1, Math.round(baseMs * 0.8)));
  const reste = v % 60000;
  if (reste < 1500 || reste > 58500) v += 2300 + (h % 4100);
  return v;
}
function secuRetryAfterMs(v, maintenant) {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).trim();
  let ms = 0;
  if (/^\d{1,7}$/.test(s)) ms = Number(s) * 1000;
  else { const t = Date.parse(s); if (Number.isFinite(t)) ms = t - (Number(maintenant) || Date.now()); }
  return Math.max(0, Math.min(24 * 3600000, Math.round(ms) || 0));
}
// Une réponse est-elle un CONTRÔLE ANTI-ROBOT (captcha, page de vérification,
// défi DataDome / Cloudflare) ou un signe de RESTRICTION ? 'robot' · 'restreint' · ''.
// `entetes` : quelques en-têtes en minuscules (x-datadome, x-dd-b, cf-mitigated, content-type).
function secuDefi(rep) {
  const r = rep && typeof rep === 'object' ? rep : {};
  const st = Number(r.status) || 0;
  const e = r.entetes && typeof r.entetes === 'object' ? r.entetes : {};
  if (e['x-datadome'] || e['x-dd-b'] || /challenge/i.test(String(e['cf-mitigated'] || ''))) return 'robot';
  const html = /text\/html/i.test(String(e['content-type'] || ''));
  if (st < 400 && !html && !r.defi) return '';
  let txt = String(r.texte || '').slice(0, 6000);
  try { if (r.json != null) txt += ' ' + JSON.stringify(r.json).slice(0, 6000); } catch (_) {}
  if (r.defi === true || /captcha-delivery\.com|geo\.captcha|\bdatadome\b|\bcaptcha\b|cf-chl|challenge-platform|hcaptcha|recaptcha|turnstile|just a moment|verify you are (?:a )?human|v[ée]rifi(?:e|er) que vous [êe]tes (?:un )?humain/i.test(txt)) return 'robot';
  if (st >= 400 && /automat|activit[ée] inhabituelle|unusual activity|suspicious|restreint|restricted|suspendu|suspended|banned|bloqu[ée]/i.test(txt)) return 'restreint';
  return '';
}
// « Tout arrêter » : le DERNIER geste (arrêt ou relance), d'où qu'il vienne, fait foi.
function secuArretEffectif(evts) {
  let d = null;
  for (const e of Array.isArray(evts) ? evts : []) {
    if (!e || (e.s !== 'arret' && e.s !== 'relance')) continue;
    const at = Number(e.at);
    if (!Number.isFinite(at) || at <= 0) continue;
    if (!d || at > d.at) d = { s: e.s, at };
  }
  return d && d.s === 'arret' ? { arrete: true, at: d.at } : { arrete: false, at: d ? d.at : null };
}
// Un compte récent (LU : ancienneté en jours, ventes faites) démarre doucement.
// Rien de lu ⇒ null (« pas su » : pas de rodage inventé, et l'écran le dit).
function secuRodage(profil, reg) {
  if (reg && reg.rodage === false) return null;
  const p = profil && typeof profil === 'object' ? profil : {};
  const age = Number.isFinite(Number(p.ageJours)) && p.ageJours !== null && p.ageJours !== '' ? Number(p.ageJours) : null;
  const ventes = Number.isFinite(Number(p.ventes)) && p.ventes !== null && p.ventes !== '' ? Number(p.ventes) : null;
  if (age === null && ventes === null) return null;
  const sous = (n) => (age !== null && age < n.jours) || (ventes !== null && ventes < n.ventes);
  if (sous(SECU_RODAGE.jeune)) return { niveau: 'jeune', heure: SECU_RODAGE.jeune.heure, age, ventes };
  if (sous(SECU_RODAGE.recent)) return { niveau: 'recent', heure: SECU_RODAGE.recent.heure, age, ventes };
  return null;
}
// LA DÉCISION, pour UN geste d'UN compte. Rend { ok: true, attendreMs } ou
// { ok: false, code, jusqua } — jamais une place de plus que l'extension n'en donne.
//   etat : { robot, prudence: { jusqua }, dernier }   gestes : [{ t, s, m }] (24 h)
//   presenceAt : son dernier geste dans l'onglet du site   arret : « Tout arrêter »
function secuDecision(o) {
  const x = o || {};
  const now = Number(x.maintenant) || Date.now();
  const mode = SECU_MODES.includes(x.mode) ? x.mode : 'clic';
  const sorte = SECU_SORTES.includes(x.sorte) ? x.sorte : 'autre';
  const reg = x.reg || SECU_DEFAUT;
  const etat = x.etat && typeof x.etat === 'object' ? x.etat : {};
  const non = (code, jusqua) => ({ ok: false, code, jusqua: Number.isFinite(jusqua) ? Math.round(jusqua) : null });
  if (etat.robot) return non('robot', null);
  if (x.arret && mode !== 'clic') return non('arret', null);
  const prudence = etat.prudence && Number(etat.prudence.jusqua) > now ? etat.prudence : null;
  const dernier = Number(etat.dernier) || 0;
  if (mode === 'clic') {
    const e = prudence ? SECU_CLIC_PRUDENCE_MS : SECU_CLIC_MS;
    return { ok: true, attendreMs: dernier && now - dernier < e ? e - (now - dernier) : 0 };
  }
  if (mode === 'suite') return { ok: true, attendreMs: 0 };
  if (prudence) return non('prudence', Number(prudence.jusqua));
  let reveil = null;
  if (SECU_SANS_LUI.includes(mode)) {
    const rp = secuRepos(reg, now, x.compte);
    if (rp.repos) return non('repos', rp.repos.jusqua);
    reveil = rp.reveil;
    const c = secuCalme(reg, now);
    if (c) return non('calme', c.jusqua);
  }
  if (mode === 'auto' && reg.presence && reg.presence.actif) {
    const p = Number(x.presenceAt) || 0;
    if (!p || now - p > reg.presence.min * 60000) return non('absent', null);
  }
  const gestes = (Array.isArray(x.gestes) ? x.gestes : []).filter((g) => g && Number(g.t) > now - 25 * 3600000 && Number(g.t) <= now + 60000);
  if (SECU_COMPTES.includes(mode)) {
    const jour = secuParis(now).jour;
    if (reg.parJour > 0) {
      const n = gestes.filter((g) => SECU_COMPTES.includes(g.m) && secuParis(g.t).jour === jour).length;
      if (n >= reg.parJour) { const p = secuParis(now); return non('jour', now + (1440 - p.min) * 60000); }
    }
    const heure = gestes.filter((g) => now - Number(g.t) < 3600000).sort((a, b) => a.t - b.t);
    const max = reg.parType && reg.parType[sorte];
    if (max > 0) {
      const l = heure.filter((g) => g.s === sorte && SECU_COMPTES.includes(g.m));
      if (l.length >= max) return non('type', Number(l[l.length - max].t) + 3600000);
    }
    const ro = secuRodage(x.profil, reg);
    if (ro) {
      const l = heure.filter((g) => SECU_COMPTES.includes(g.m));
      if (l.length >= ro.heure) return non('rodage', Number(l[l.length - ro.heure].t) + 3600000);
    }
  }
  if (dernier) {
    const base = reveil && SECU_SANS_LUI.includes(mode) ? 4 * 60000 : SECU_SANS_LUI.includes(mode) ? reg.espaceS * 1000 : SECU_SERIE_MS;
    const cible = reveil && SECU_SANS_LUI.includes(mode) ? Math.min(7 * 60000, secuCible(base, dernier)) : secuCible(base, dernier);
    const reste = cible - (now - dernier);
    if (reste > 0) {
      if (reste > SECU_ATTENTE_MAX_MS) return non(reveil ? 'reveil' : 'espace', now + reste);
      return { ok: true, attendreMs: Math.round(reste) };
    }
  }
  return { ok: true, attendreMs: 0 };
}
// L'heure de Paris dite « 8 h 07 ».
function secuHeure(ms) {
  if (!Number.isFinite(Number(ms))) return '';
  const m = secuParis(Number(ms)).min;
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  return `${h} h ${String(mm).padStart(2, '0')}`;
}
// LA PHRASE d'un compte (Paramètres → Mes comptes, carte de l'extension) : une
// seule, la plus importante. { niveau, cle, v } ; le texte vient de SECU_PHRASES
// (le même que src/i18n/langues/fr.js, `securite.phrase.<cle>`).
function secuPhrase(o) {
  const x = o || {};
  const now = Number(x.maintenant) || Date.now();
  const site = SECU_NOMS[x.plateforme] || 'le site';
  const etat = x.etat && typeof x.etat === 'object' ? x.etat : null;
  const reg = x.reg || SECU_DEFAUT;
  if (etat && etat.robot) return { niveau: 'robot', cle: 'robot', v: { site, hote: SECU_HOTES[x.plateforme] || '' } };
  if (x.arret && x.arret.arrete) return { niveau: 'arret', cle: 'arret', v: { heure: secuHeure(x.arret.at) } };
  if (x.pause && Number(x.pause.jusqua) > now) return { niveau: 'pause', cle: 'pause', v: { site, heure: secuHeure(x.pause.jusqua) } };
  if (etat && etat.prudence && Number(etat.prudence.jusqua) > now) return { niveau: 'prudence', cle: 'prudence', v: { site, heure: secuHeure(etat.prudence.jusqua) } };
  if (x.frein && Number(x.frein.jusqua) > now) return { niveau: 'prudence', cle: 'prudence', v: { site, heure: secuHeure(x.frein.jusqua) } };
  const rp = secuRepos(reg, now, x.compte);
  if (rp.repos) return { niveau: 'repos', cle: 'repos', v: { heure: secuHeure(rp.repos.jusqua) } };
  if (secuCalme(reg, now)) return { niveau: 'calme', cle: 'calme', v: {} };
  const ro = secuRodage(x.profil, reg);
  if (ro) return { niveau: 'rodage', cle: 'rodage', v: { n: ro.heure } };
  const n = Number.isFinite(Number(x.aujourdhui)) ? Number(x.aujourdhui) : null;
  if (n === null) return { niveau: 'ok', cle: 'okPasSu', v: {} };
  if (reg.parJour > 0) return { niveau: 'ok', cle: 'okPlafond', v: { n, max: reg.parJour } };
  return { niveau: 'ok', cle: 'ok', v: { n } };
}
const SECU_PHRASES = {
  robot: '{site} vérifie ton compte · fais la vérification toi-même sur {hote}',
  arret: 'Tout est arrêté depuis {heure} · rien d’automatique ne part',
  pause: '{site} demande de ralentir · reprise à {heure}',
  prudence: 'Prudence jusqu’à {heure} · {site} a refusé un geste',
  repos: 'Repos jusqu’à {heure} · rien d’automatique la nuit',
  calme: 'Journée calme · rien d’automatique aujourd’hui',
  rodage: 'Compte récent · VRM y va doucement ({n}/h au plus)',
  ok: 'Calme · {n} gestes de VRM aujourd’hui',
  okPlafond: 'Calme · {n}/{max} gestes de VRM aujourd’hui',
  okPasSu: 'Calme',
};
// Ce qu'un refus dit à l'endroit du geste (l'extension, le journal de la carte).
const SECU_REFUS = {
  robot: '{site} vérifie ton compte : fais la vérification toi-même sur {hote}. Rien n’est parti, et rien ne repart avant une lecture normale.',
  arret: 'Tout est arrêté (« Tout arrêter ») : rien d’automatique ne part. Relance depuis VRM ou la carte de l’extension.',
  prudence: 'Prudence sur ce compte jusqu’à {heure} : {site} a refusé un geste. Rien n’est parti.',
  repos: 'Repos sur ce compte jusqu’à {heure} : rien d’automatique ne part la nuit.',
  calme: 'Journée calme sur ce compte : rien d’automatique aujourd’hui.',
  absent: 'Tu n’as pas utilisé {site} depuis un moment : VRM n’agit seul que si tu es là. Rien n’est parti.',
  jour: 'Plafond du jour atteint sur ce compte (ton réglage) : la suite demain.',
  type: 'Plafond de ce type de geste atteint cette heure (ton réglage) : la suite à {heure}.',
  rodage: 'Compte récent : VRM y va doucement. La suite à {heure}.',
  espace: 'Pas de rafale : le prochain geste de ce compte à {heure}.',
  reveil: 'Fin du repos : VRM reprend doucement. Le prochain geste à {heure}.',
  reglages: 'Les réglages de sécurité n’ont pas pu être lus : rien d’automatique ne part.',
};
function secuTexte(table, cle, v) {
  return String(table[cle] || '').replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? String(v[k]) : ''));
}
// </securite-comptes-regle>

export {
  SECU_V, SECU_PLATEFORMES, SECU_NOMS, SECU_HOTES, SECU_SORTES, SECU_TYPES_REGLABLES, SECU_MODES, SECU_DEFAUT, SECU_PRUDENCE_MS, SECU_RODAGE, SECU_REVEIL_MIN,
  secuCle, secuNet, secuReglages, secuParis, secuDecalage, secuRepos, secuCalme, secuDelaiVariable, secuCible, secuRetryAfterMs, secuDefi,
  secuArretEffectif, secuRodage, secuDecision, secuHeure, secuPhrase, SECU_PHRASES, SECU_REFUS, secuTexte,
};

// ── CÔTÉ APP SEULEMENT ───────────────────────────────────────────────────────
// La clé synchronisée (SYNC_KEYS) : SES réglages, écrits sur SON clic seulement.
//   { v, plateformes: { vinted: {…}, vestiaire: {…} }, comptes: { 'vinted:111': {…} },
//     evts: [{ s: 'arret' | 'relance', at, par: 'app' }] }
export const CLE_SECURITE = 'vrm_securite_comptes';
// Ce que chaque navigateur publie (ligne dédiée, un écrivain par ligne) : l'état
// LU (refus, vérification, prudence) et le compte des gestes par jour.
export const PREFIXE_ETAT_SECU = 'securite_etat_';
export const SELECT_ETAT_SECU = 'id,at:data->>at,c:data->comptes,evts:data->evts';
// Le journal (lot G) : Vinted `journal_vrm_{uid}_{nav}`, Vestiaire `journal_vc_{compte}_{nav}`.
export const PREFIXES_JOURNAL = { vinted: 'journal_vrm_', vestiaire: 'journal_vc_' };

// Un geste de réglage : rend la NOUVELLE valeur de la clé (rien n'est écrit ici).
export function poserReglage(tout, { plateforme, compte = null, champ, valeur }) {
  const t = tout && typeof tout === 'object' ? JSON.parse(JSON.stringify(tout)) : {};
  t.v = SECU_V;
  const cible = compte ? (t.comptes = t.comptes || {}, t.comptes[secuCle(plateforme, compte)] = t.comptes[secuCle(plateforme, compte)] || {})
    : (t.plateformes = t.plateformes || {}, t.plateformes[plateforme] = t.plateformes[plateforme] || {});
  const ch = String(champ || '').split('.');
  let o = cible;
  for (let i = 0; i < ch.length - 1; i++) { o[ch[i]] = o[ch[i]] && typeof o[ch[i]] === 'object' ? o[ch[i]] : {}; o = o[ch[i]]; }
  o[ch[ch.length - 1]] = valeur;
  return t;
}
export function poserArret(tout, arret, maintenant = Date.now()) {
  const t = tout && typeof tout === 'object' ? JSON.parse(JSON.stringify(tout)) : {};
  t.v = SECU_V;
  t.evts = [...(Array.isArray(t.evts) ? t.evts : []), { s: arret ? 'arret' : 'relance', at: maintenant, par: 'app' }].slice(-10);
  return t;
}
// Tous les événements « Tout arrêter » connus : ceux de l'app (sa clé) et ceux
// publiés par chaque navigateur (carte de l'extension). `rows` null ⇒ ceux de l'app.
export function arretDeTous(tout, rows) {
  const e = [...((tout && Array.isArray(tout.evts)) ? tout.evts : [])];
  for (const r of Array.isArray(rows) ? rows : []) if (r && Array.isArray(r.evts)) e.push(...r.evts);
  return secuArretEffectif(e);
}
// L'état d'un compte, toutes lignes `securite_etat_*` confondues (un par navigateur) :
// la vérification ou la prudence vue par N'IMPORTE quel navigateur compte. `null` = pas su.
export function etatDuCompte(rows, cle, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return null;
  let robot = null, prudence = null, dernier = 0, vu = false;
  const jours = {};
  for (const r of rows) {
    if (!r || !/^securite_etat_[0-9a-f]{16}$/.test(String(r.id || ''))) continue;
    const c = r.c && typeof r.c === 'object' ? r.c[cle] : null;
    if (!c || typeof c !== 'object') continue;
    vu = true;
    if (c.robot && Number(c.robot.depuis) > 0 && (!robot || c.robot.depuis > robot.depuis)) robot = { depuis: Number(c.robot.depuis) };
    if (c.prudence && Number(c.prudence.jusqua) > maintenant && (!prudence || c.prudence.jusqua > prudence.jusqua)) prudence = { jusqua: Number(c.prudence.jusqua), raison: String(c.prudence.raison || ''), depuis: Number(c.prudence.depuis) || null };
    if (Number(c.dernier) > dernier) dernier = Number(c.dernier);
    for (const [j, n] of Object.entries(c.jours && typeof c.jours === 'object' ? c.jours : {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(j) && Number.isFinite(Number(n && n.n))) jours[j] = (jours[j] || 0) + Number(n.n);
    }
  }
  return vu ? { robot, prudence, dernier: dernier || null, jours } : { robot: null, prudence: null, dernier: null, jours: {} };
}
// Les 7 derniers jours (Paris), du plus ancien au plus récent.
export function septJours(maintenant = Date.now()) {
  const out = [];
  for (let i = 6; i >= 0; i--) out.push(secuParis(maintenant - i * 86400000).jour);
  return [...new Set(out)];
}
// « Ce que VRM fait sur tes comptes » : gestes ACCEPTÉS notés au journal, par
// compte et par jour (Paris). rows : [{ id, e: [{ t, s }] }] — `null` ⇒ null.
// Le compte vient de l'identifiant EXACT de la ligne (jamais d'un LIKE).
export function tableauGestes(rows, jours) {
  if (rows === undefined) return undefined;
  if (!Array.isArray(rows)) return null;
  const re = /^journal_(vrm|vc)_([\w-]{1,40})_([0-9a-f]{16})$/;
  const parCompte = {};
  const vus = new Set();
  for (const r of rows) {
    const m = re.exec(String(r && r.id || ''));
    if (!m) continue;
    const cle = secuCle(m[1] === 'vrm' ? 'vinted' : 'vestiaire', m[2]);
    if (!cle) continue;
    parCompte[cle] = parCompte[cle] || { total: 0, jours: Object.fromEntries(jours.map((j) => [j, 0])), sortes: {} };
    for (const e of Array.isArray(r.e) ? r.e : []) {
      const t = Number(e && e.t);
      if (!Number.isFinite(t) || t <= 0) continue;
      const k = `${cle}|${e.s}|${e.a || ''}|${e.x || ''}|${Math.round(t / 1000)}`;
      if (vus.has(k)) continue; vus.add(k);
      const j = secuParis(t).jour;
      if (!(j in parCompte[cle].jours)) continue;
      parCompte[cle].jours[j] += 1; parCompte[cle].total += 1;
      parCompte[cle].sortes[e.s] = (parCompte[cle].sortes[e.s] || 0) + 1;
    }
  }
  return parCompte;
}
// Les comptes à montrer : ses comptes Vinted reliés, puis tout compte Vestiaire
// que l'extension a vu (état publié, journal ou réglage) — jamais un compte deviné.
export function comptesSecurite({ comptesVinted = [], rowsEtat = null, tableau = null, reglages = null, noms = {} } = {}) {
  const out = [], vus = new Set();
  const pousser = (pf, id, nom) => { const cle = secuCle(pf, id); if (!cle || vus.has(cle)) return; vus.add(cle); out.push({ cle, plateforme: pf, compte: String(id), nom: nom || (pf === 'vestiaire' ? 'Vestiaire' : String(id)) }); };
  for (const a of comptesVinted || []) { const u = String((a && a.vinted_user_id) || ''); if (/^\d{1,20}$/.test(u)) pousser('vinted', u, noms[u] || a.login || a.username || ''); }
  const vc = new Set();
  for (const r of Array.isArray(rowsEtat) ? rowsEtat : []) for (const k of Object.keys((r && r.c) || {})) if (/^vestiaire:/.test(k)) vc.add(k.slice(10));
  for (const k of Object.keys(tableau || {})) if (/^vestiaire:/.test(k)) vc.add(k.slice(10));
  for (const k of Object.keys((reglages && reglages.comptes) || {})) if (/^vestiaire:/.test(k)) vc.add(k.slice(10));
  for (const id of [...vc].sort()) pousser('vestiaire', id, '');
  return out;
}
// Les minutes du jour ⇄ « 23:00 » (champ <input type=time>).
export function versHeure(min) { const m = Math.max(0, Math.min(1439, Math.round(Number(min) || 0))); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
export function depuisHeure(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return null; const h = Number(m[1]), mi = Number(m[2]); return h < 24 && mi < 60 ? h * 60 + mi : null; }
