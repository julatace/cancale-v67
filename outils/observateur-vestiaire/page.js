// VRM Observateur Vestiaire — la page de lecture. Lit IndexedDB et chrome.storage.local, rien d'autre ; aucune requête réseau
// (la politique de sécurité de l'extension, connect-src 'none', l'interdit de toute façon).
'use strict';
const R = window.VRMObs;
const B = window.VRMBase;
const $ = (id) => document.getElementById(id);
const fmtN = (n) => Number(n || 0).toLocaleString('fr-FR');
const p2 = (n) => String(n).padStart(2, '0');
const heure = (t) => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
const jourHeure = (t) => new Date(t).toLocaleString('fr-FR');
const el = (tag, attrs, ...enfants) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null) continue; if (k === 'class') e.className = v; else if (k.startsWith('data-')) e.setAttribute(k, v); else e[k] = v; }
  for (const c of enfants) if (c != null) e.append(c instanceof Node ? c : String(c));
  return e;
};

let evs = [];
let extensions = [];

async function charger() {
  try { await chrome.runtime.sendMessage({ quoi: 'vider' }); } catch (_) {}
  const brut = await B.tout();
  evs = R.attribuer(R.fusionner(brut));
  const o = await chrome.storage.local.get(['obs_on', 'obs_complet', 'obs_console', 'obs_plafond', 'obs_extensions']);
  $('on').checked = o.obs_on === true;
  $('voyant').dataset.on = o.obs_on === true ? '1' : '0';
  $('complet').checked = o.obs_complet === true;
  $('console').checked = o.obs_console === true;
  if (document.activeElement !== $('plafond')) $('plafond').value = o.obs_plafond || 200000;
  extensions = (o.obs_extensions && o.obs_extensions.liste) || [];
  $('ext-lu').textContent = o.obs_extensions ? 'Lue le ' + jourHeure(o.obs_extensions.lu) : 'Pas encore lue (allume l\'enregistrement, ou « Relire la liste »).';
  dessiner(brut.length);
  try { const r = await chrome.runtime.sendMessage({ quoi: 'debogueur' }); dessinerDbg((r && r.etat) || {}); } catch (_) {}
}

function dessinerDbg(etat) {
  const z = $('dbg-etat'); z.replaceChildren();
  const ids = Object.keys(etat);
  if (!$('complet').checked) return;
  if (!ids.length) { z.append('Aucun onglet Vestiaire attaché pour l\'instant (ouvre vestiairecollective.com).'); return; }
  for (const id of ids) {
    const v = etat[id];
    z.append(el('div', { 'data-dbg': v.ok ? 'ok' : 'erreur', 'data-tab': id }, 'Onglet ' + id + ' : ', v.ok ? 'attaché depuis ' + heure(v.depuis) : el('span', { class: 'badge erreur' }, 'attache impossible — ' + v.erreur)));
  }
}

function ligne(cellules, attrs) { return el('tr', attrs, ...cellules.map((c) => (c instanceof Node && c.tagName === 'TD' ? c : el('td', {}, c)))); }
function nombre(v) { return el('td', { class: 'n' }, v); }
function statutBadge(e) {
  if (e.erreur) return el('span', { class: 'badge erreur' }, 'échec : ' + e.erreur);
  const s = e.statut;
  if (s == null || s === '') return el('span', { class: 'doux' }, '—');
  if (s === 429 || s === 403) return el('span', { class: 'badge erreur' }, String(s));
  if (s >= 400) return el('span', { class: 'badge alerte' }, String(s));
  return el('span', { class: 'badge ok' }, String(s));
}
function origine(e) {
  const morceaux = [];
  if (e.tabId != null && e.tabId >= 0) morceaux.push('onglet ' + e.tabId);
  if (e.frame && e.frame !== 'principale') morceaux.push(e.frame);
  const ids = [].concat(e.extPile || [], e.extId ? [e.extId] : []);
  for (const id of new Set(ids)) { const x = extensions.find((y) => y.id === id); morceaux.push('extension ' + (x ? x.name : id)); }
  if (e.initiator && !/vestiairecollective\./.test(e.initiator)) morceaux.push(e.initiator);
  if (e.origine === 'exploration') morceaux.push('EXPLORATION');
  morceaux.push(e.src === 'reseau' ? (e.vuParPage ? 'réseau + page' : 'réseau') : e.src);
  return morceaux.join(' · ');
}
function detailDe(e) {
  const d = el('div', {});
  if (e.src === 'geste') {
    d.append(R.descCible(e.cible) || (e.cible && e.cible.tag) || '');
    if (e.champ) d.append(el('div', { class: 'doux' }, 'champ « ' + e.champ + ' » · ' + e.longueur + ' caractère(s)' + (e.nbEvenements ? ' · ' + e.nbEvenements + ' frappe(s)' : '')));
    if (e.valeur != null) d.append(el('pre', {}, e.valeur));
    if (e.detail) d.append(el('div', { class: 'doux' }, e.detail));
  } else if (e.methode) {
    d.append(el('code', {}, e.methode + ' ' + (e.hote || '') + (e.chemin || '') + (e.recherche ? '?' + e.recherche : '')));
    if (e.sens) d.append(el('div', { class: 'doux' }, 'WebSocket ' + e.sens));
  } else d.append(e.detail || '');
  const plus = [];
  if (e.corps && (e.corps.texte || e.corps.note)) plus.push(['Envoyé', (e.corps.note ? '(' + e.corps.note + ') ' : '') + e.corps.texte + (e.corps.tronque ? ' …[coupé]' : '')]);
  if (e.reponse && (e.reponse.texte || e.reponse.note)) plus.push(['Reçu', (e.reponse.note ? '(' + e.reponse.note + ') ' : '') + e.reponse.texte + (e.reponse.tronque ? ' …[coupé]' : '')]);
  if (e.pile) plus.push(['Appelé depuis', e.pile]);
  if (e.liste) plus.push(['Liste', JSON.stringify(e.liste, null, 1)]);
  if (plus.length) {
    const det = el('details', {}, el('summary', { class: 'doux' }, plus.map((p) => p[0]).join(' · ')));
    for (const [t, v] of plus) det.append(el('div', { class: 'doux' }, t), el('pre', {}, v));
    d.append(det);
  }
  return d;
}

function dessiner(nBrut) {
  const n = evs.length;
  $('compteur').textContent = fmtN(n); $('compteur').dataset.n = String(n);
  $('compteur').dataset.brut = String(nBrut);
  $('compteur-txt').textContent = n > 1 ? 'événements notés' : 'événement noté';
  $('periode').textContent = n ? 'Du ' + jourHeure(evs[0].t) + ' au ' + jourHeure(evs[n - 1].t) + (nBrut !== n ? ' · ' + fmtN(nBrut - n) + ' doublon(s) réunis (même requête vue par plusieurs capteurs)' : '') : 'Rien encore. Allume « Enregistrer », puis va sur vestiairecollective.com.';

  dessinerRoutes();
  const seqs = R.sequencesMessage(evs, 1);
  const zs = $('sequence'); zs.replaceChildren();
  if (!seqs.length) zs.append('Aucun message envoyé vu pour l\'instant.');
  else {
    const s = seqs[seqs.length - 1];
    zs.append(el('p', {}, 'Envoi du ' + jourHeure(Date.parse(s.t)) + ' · ', el('code', {}, s.route), s.apresGesteHumain === false ? ' — sans geste humain juste avant' : ''));
    const t = el('table', { id: 'sequence-table' });
    for (const et of s.etapes) t.append(ligne([(et.dt_ms >= 0 ? '+' : '') + (et.dt_ms / 1000).toFixed(1).replace('.', ',') + ' s', et.quoi + (et.cetEnvoi ? '  ⇐ cet envoi' : '')], { class: et.cetEnvoi ? 'ecriture' : '', 'data-etape': et.cetEnvoi ? 'envoi' : '' }));
    zs.append(t);
  }

  // Ce que l'outil a fait
  const o = R.outil(evs, extensions);
  const zo = $('outil'); zo.replaceChildren();
  zo.append(el('table', { id: 'outil-table' },
    ligne(['Gestes humains (isTrusted = vrai)', nombre(o.gestesHumains)], { 'data-cle': 'gestesHumains', 'data-n': o.gestesHumains }),
    ligne(['Gestes simulés par un programme (isTrusted = faux)', nombre(o.gestesAuto)], { 'data-cle': 'gestesAuto', 'data-n': o.gestesAuto, class: o.gestesAuto ? 'ligne-erreur' : '' }),
    ligne(['Écritures juste après un geste humain', nombre(o.ecrituresAvecGeste)], { 'data-cle': 'ecrituresAvecGeste', 'data-n': o.ecrituresAvecGeste }),
    ligne(['Écritures sans geste humain juste avant', nombre(o.ecrituresSansGeste)], { 'data-cle': 'ecrituresSansGeste', 'data-n': o.ecrituresSansGeste, class: o.ecrituresSansGeste ? 'ligne-erreur' : '' })));
  const detailAuto = Object.entries(o.autoParType).concat(Object.entries(o.sansGesteParType));
  if (detailAuto.length) zo.append(el('p', { class: 'doux' }, 'Détail : ' + detailAuto.map(([k, v]) => k + ' × ' + v).join(' · ')));
  const pe = Object.values(o.parExtension);
  if (pe.length) {
    const t = el('table', { id: 'outil-ext' }, ligne(['Extension vue dans les appels', 'Événements', 'Écritures']));
    for (const x of pe) t.append(ligne([(x.nom || '(nom inconnu)') + ' — ' + x.id, nombre(x.n), nombre(x.ecritures)], { 'data-ext': x.id }));
    zo.append(t);
  }

  // Refus
  const refus = evs.filter((e) => (e.statut || 0) >= 400);
  $('alertes-carte').hidden = !refus.length;
  const za = $('alertes'); za.replaceChildren();
  if (refus.length) {
    const c = { 429: 0, 403: 0, autre: 0 };
    for (const e of refus) { if (e.statut === 429) c[429]++; else if (e.statut === 403) c[403]++; else c.autre++; }
    za.append(el('p', {}, el('span', { class: 'badge erreur' }, c[429] + ' × 429'), ' ', el('span', { class: 'badge erreur' }, c[403] + ' × 403'), ' ', el('span', { class: 'badge alerte' }, c.autre + ' autre(s)')));
    const t = el('table', {});
    for (const e of refus.slice(-200).reverse()) t.append(ligne([heure(e.t), statutBadge(e), el('code', {}, e.methode + ' ' + e.chemin), e._action.nom], { 'data-statut': e.statut }));
    za.append(t);
  }

  // Par type
  const res = R.resumer(evs);
  const tb = $('resume').tBodies[0]; tb.replaceChildren();
  for (const r of res) tb.append(ligne([r.nom, nombre(fmtN(r.n)), nombre(r.parHeure == null ? '—' : r.parHeure.toFixed(1).replace('.', ',')), nombre(R.duree(r.ecartMin)), nombre(R.duree(r.ecartMoy)), nombre(R.duree(r.ecartMax)),
    el('td', { class: 'n' }, r.s4xx + r.s5xx ? el('span', { class: 'badge ' + (r.s429 || r.s403 ? 'erreur' : 'alerte') }, String(r.s4xx + r.s5xx)) : '0'), nombre(r.cat === 'ecriture' ? r.sansGeste : '')],
  { 'data-action': r.id, 'data-n': r.n, 'data-cat': r.cat, class: r.cat === 'ecriture' ? 'ecriture' : '' }));

  for (const [id, gran] of [['jours', 'jour'], ['heures', 'heure']]) {
    const b = $(id).tBodies[0]; b.replaceChildren();
    for (const j of R.parPeriode(evs, gran)) b.append(ligne([j.periode, nombre(j.ecritures), nombre(j.gestesHumains), nombre(j.gestesAuto), nombre(j.lectures), nombre(j.refus)], { 'data-periode': j.periode }));
  }

  const te = $('extensions').tBodies[0]; te.replaceChildren();
  for (const x of extensions) te.append(ligne([x.name + (x.moi ? ' (cet observateur)' : ''), x.enabled ? 'oui' : 'non', (x.permissions || []).join(', '), (x.hostPermissions || []).join(', '), el('code', {}, x.id)], { 'data-ext': x.id }));

  // Filtres
  const selO = $('onglet'); const valO = selO.value;
  const tabs = Array.from(new Set(evs.map((e) => e.tabId).filter((t) => t != null && t >= 0))).sort((a, b) => a - b);
  selO.replaceChildren(el('option', { value: '' }, 'Tous'), ...tabs.map((t) => el('option', { value: String(t) }, 'Onglet ' + t)));
  selO.value = valO;
  const selT = $('type'); const valT = selT.value;
  selT.replaceChildren(el('option', { value: '' }, 'Toutes'), ...res.map((r) => el('option', { value: r.id }, r.nom)));
  selT.value = valT;
  dessinerChrono();
}

function dessinerRoutes() {
  const th = $('theme').value;
  const tb = $('routes').tBodies[0]; tb.replaceChildren();
  for (const r of R.routes(evs).filter((x) => !th || x.themes.includes(th)).slice(0, 600)) {
    tb.append(ligne([el('code', {}, r.cle), r.themes.join(', '), nombre(fmtN(r.n)), Object.entries(r.statuts).map(([k, v]) => k + (v > 1 ? ' ×' + v : '')).join(' · '), el('span', { class: 'doux' }, r.enTetesRequete.join(', '))], { 'data-route': r.cle, 'data-themes': r.themes.join(' '), class: r.cat === 'ecriture' ? 'ecriture' : '' }));
  }
}

function dessinerChrono() {
  const regrouper = $('regrouper-lectures').checked;
  const fO = $('onglet').value; const fT = $('type').value; const fS = $('source').value;
  let liste = evs.filter((e) => (!fO || String(e.tabId) === fO) && (!fT || e._action.id === fT));
  if (fS) liste = liste.filter((e) => (fS === 'contexte' ? e._action.cat === 'contexte' : e.src === fS));
  const MAX = 3000;
  const tronque = liste.length > MAX;
  if (tronque) liste = liste.slice(-MAX);
  $('chrono-note').textContent = tronque ? 'Seuls les ' + fmtN(MAX) + ' derniers sont affichés ; l\'export contient tout.' : '';
  const dernierParType = new Map();
  const tb = $('chrono').tBodies[0];
  const lignes = [];
  let paquet = null;
  const fermer = () => {
    if (!paquet) return;
    lignes.push(ligne([heure(paquet.debut), 'Lectures', paquet.n + ' lecture(s) · ' + Array.from(paquet.chemins).slice(0, 4).join(', ') + (paquet.chemins.size > 4 ? '…' : ''), paquet.refus ? el('span', { class: 'badge erreur' }, paquet.refus + ' refus') : '', R.duree(paquet.fin - paquet.debut), '', ''], { class: 'lectures', 'data-action': 'lectures', 'data-n': paquet.n }));
    paquet = null;
  };
  for (const e of liste) {
    const a = e._action;
    const avant = dernierParType.get(a.id);
    dernierParType.set(a.id, e.t);
    if (regrouper && a.cat === 'lecture') {
      if (!paquet) paquet = { debut: e.t, fin: e.t, n: 0, chemins: new Set(), refus: 0 };
      paquet.n++; paquet.fin = e.t; paquet.chemins.add(e.chemin); if ((e.statut || 0) >= 400) paquet.refus++;
      if ((e.statut || 0) < 400) continue;
    }
    fermer();
    const nom = a.cat === 'ecriture' && e.apresGesteHumain === false ? a.nom + ' — sans geste humain' : a.nom;
    lignes.push(ligne([heure(e.t), nom, detailDe(e), statutBadge(e), R.duree(e.duree), avant == null ? '—' : '+ ' + R.duree(e.t - avant), origine(e)], {
      class: [a.cat === 'ecriture' || (a.cat === 'geste' && !a.humain) ? 'ecriture' : '', (e.statut || 0) === 429 || (e.statut || 0) === 403 ? 'ligne-erreur' : ''].join(' ').trim(),
      'data-action': a.id, 'data-statut': e.statut == null ? '' : String(e.statut), 'data-src': e.src, 'data-trusted': e.isTrusted == null ? '' : String(e.isTrusted),
    }));
  }
  fermer();
  tb.replaceChildren(...lignes.reverse());   // le plus récent en haut
}

// ── Gestes ─────────────────────────────────────────────────────────────────
$('on').addEventListener('change', async (e) => { await chrome.storage.local.set({ obs_on: e.target.checked }); setTimeout(charger, 300); });
$('complet').addEventListener('change', async (e) => { await chrome.storage.local.set({ obs_complet: e.target.checked }); setTimeout(charger, 800); });
$('console').addEventListener('change', async (e) => { await chrome.storage.local.set({ obs_console: e.target.checked }); });
$('plafond').addEventListener('change', async (e) => { const v = Math.max(50, Math.round(Number(e.target.value) || 200000)); e.target.value = v; await chrome.storage.local.set({ obs_plafond: v }); });
$('regrouper-lectures').addEventListener('change', dessinerChrono);
$('theme').addEventListener('change', dessinerRoutes);
$('onglet').addEventListener('change', dessinerChrono);
$('type').addEventListener('change', dessinerChrono);
$('source').addEventListener('change', dessinerChrono);
$('effacer').addEventListener('click', async () => {
  if (!confirm('Effacer tout ce qui a été noté ? Rien ne pourra être récupéré.')) return;
  await chrome.runtime.sendMessage({ quoi: 'effacer' });
  charger();
});
$('ext-relire').addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ quoi: 'extensions' });
  if (r && r.liste) await chrome.storage.local.set({ obs_extensions: { lu: Date.now(), liste: r.liste } });
  charger();
});

const estEdge = /\bEdg\//.test(navigator.userAgent);
const URL_NE = estEdge ? 'edge://net-export' : 'chrome://net-export';
$('netexport-url').textContent = URL_NE;
$('ouvrir-netexport').textContent = 'Ouvrir ' + URL_NE;
$('ouvrir-netexport').addEventListener('click', async () => {
  try { await chrome.tabs.create({ url: URL_NE }); }
  catch (_) {
    try { await navigator.clipboard.writeText(URL_NE); $('ouvrir-netexport').textContent = 'Copié : colle-le dans un nouvel onglet'; } catch (__) { $('ouvrir-netexport').textContent = 'Tape ' + URL_NE + ' dans un nouvel onglet'; }
  }
});

function telecharger(nom, type, contenu) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = el('a', { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const horodate = () => { const d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()); };
const propre = (liste) => liste.map((e) => { const c = Object.assign({}, e, { action: e._action && e._action.nom, categorie: e._action && e._action.cat }); delete c._action; return c; });
function exportJson() {
  const resume = R.resumeExport(evs);
  // Le résumé lisible d'abord, puis les routes, puis tout le détail.
  return JSON.stringify({
    outil: 'VRM Observateur Vestiaire', version: chrome.runtime.getManifest().version, exporte: new Date().toISOString(),
    resume_lisible: resume.texte,
    resume: { hotes: resume.hotes, parTheme: resume.parTheme, sequencesMessage: resume.sequencesMessage },
    routes: resume.routes,
    extensions, evenements: propre(evs),
    note: 'Valeurs des cookies, jetons, mots de passe, cartes, IBAN, e-mails et téléphones remplacées par « [masqué] » avant d\'être notées ; des en-têtes, seuls les noms.',
  }, null, 1);
}
async function exporter() {
  await charger();
  const h = horodate();
  telecharger('vrm-observateur-vestiaire-' + h + '.json', 'application/json', exportJson());
  await new Promise((r) => setTimeout(r, 400));
  telecharger('vrm-observateur-vestiaire-' + h + '.csv', 'text/csv;charset=utf-8', R.enCsv(evs));
}
$('exporter').addEventListener('click', exporter);
$('export-html').addEventListener('click', async () => { await charger(); telecharger('vrm-observateur-vestiaire-resume-' + horodate() + '.html', 'text/html;charset=utf-8', R.resumeHtml(evs, extensions)); });

charger().then(() => { if (location.hash === '#exporter') { history.replaceState(null, '', location.pathname); exporter(); } });
setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('details[open]')) charger(); }, 4000);
