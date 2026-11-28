// ════════════════════════════════════════════════════════════════════════════
//  « PUBLIER PARTOUT » DEPUIS LE DOSSIER : UNE FILE PAR SITE (28 nov. 2026, ext. 5.458.0 — `aussifile`)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Publier partout depuis le dossier À publier » ; « imagine que les onglets Vinted et Vestiaire ne sont pas
// allumés en même temps ».
// Un article du dossier (brouillon numéroté) part AUSSI sur Leboncoin et Vestiaire, avec le même achat, le même prix mini
// et le même N°, par le chemin de « Publier aussi sur… » (5.424 : feuille avant / après, rien ne part s'il reste un champ
// « à choisir », formulaire rempli par la page du site, RELU avant « Publier »).
//   · SON toucher « Mettre en file » écrit UNE tâche par site dans la ligne dédiée `vrm_aussi_file` (jamais `main`) ;
//   · l'extension la lance SEULE quand un onglet de CE site, connecté (sur le compte voulu s'il l'a choisi), est ouvert —
//     ce Chrome, l'ordinateur allumé, ou la prochaine fois qu'il ouvre le site. AUCUNE limite de temps : un site jamais
//     ouvert attend (« En attente : ouvre Vestiaire pour publier ») ;
//   · JAMAIS DEUX : une tâche par site et par N° ; « faite » seulement quand le site a rendu l'identifiant de l'annonce
//     (`ad_id` / `productId`), reliée par cette identité ; un clic sans réponse claire ⇒ « pas su », jamais relancée ;
//   · les sites ne s'attendent jamais entre eux (une tâche par site) ;
//   · VENDUE entre-temps (preuve : la vente Vinted d'une annonce de CE N°, ou la liste « à retirer partout » de l'app qui
//     nomme ce N°) ⇒ les tâches en attente sont ANNULÉES et c'est dit ;
//   · les plafonds et gardes de l'extension s'appliquent (ceux de `publierUnAussi` : sécurité du compte, pause, 50/h…) ;
//     un refus passager (onglet, compte, plafond, pause, session…) laisse la tâche en attente, avec sa raison.
// Le bloc <file-aussi-regle> est recopié TEL QUEL dans vinted-sync-extension/background.js (audit-file-aussi vérifie
// l'égalité) — jamais modifié là-bas à la main.
// <file-aussi-regle>
const FA_ID = 'vrm_aussi_file';
const FA_SITES = ['leboncoin', 'vestiaire'];
const FA_MAX = 200;
const FA_ETATS = ['attente', 'a-choisir', 'en-cours', 'fait', 'pas-su', 'arrete', 'annule'];
// Les refus PASSAGERS : la tâche reste en attente (elle repartira à la prochaine ouverture du site).
const FA_PASSAGERS = /^(onglet|autre-compte|plafond|en-cours|lbc-pause|stockage|lecture|session|canal|tout-arrete|lbc-absent|vc-absent|deux-comptes|secu-[\w-]+|file|pause)$/;
const faCle = (site, numero, cleNumF) => String(site) + ':' + cleNumF(numero);
// La ligne, toujours complète (forme fausse ⇒ ignorée).
function faLigne(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const src = o.jobs && typeof o.jobs === 'object' && !Array.isArray(o.jobs) ? o.jobs : {};
  const jobs = {};
  for (const [k, j] of Object.entries(src).slice(0, FA_MAX)) {
    if (!j || typeof j !== 'object' || !FA_SITES.includes(j.site) || !FA_ETATS.includes(j.etat)) continue;
    jobs[k] = j;
  }
  return { v: 1, jobs };
}
// SA demande (l'app) : { site, brouillon, numero, compte?, reponses?, pct? } ⇒ { ok, cle, job } | { ok: false, code }.
// Une tâche ACTIVE (attente, à choisir, en cours, faite, pas su) pour ce site et ce N° ⇒ refus (jamais deux).
function faDemande(d, actuelle, maintenant, cleNumF) {
  const x = d && typeof d === 'object' ? d : {};
  if (!FA_SITES.includes(x.site)) return { ok: false, code: 'site' };
  if (!/^d[a-z0-9]{4,40}$/i.test(String(x.brouillon || ''))) return { ok: false, code: 'brouillon' };
  const n = cleNumF(x.numero);
  if (!/^[A-Z]{0,3}\d{1,7}$/.test(n)) return { ok: false, code: 'numero' };
  const L = faLigne(actuelle);
  const cle = faCle(x.site, n, cleNumF);
  const p = L.jobs[cle];
  if (p && !['arrete', 'annule'].includes(p.etat)) return { ok: false, code: 'deja', etat: p.etat };
  const rep = x.reponses && typeof x.reponses === 'object' && !Array.isArray(x.reponses) ? x.reponses : {};
  const pct = Number(x.pct);
  const job = { site: x.site, brouillon: String(x.brouillon), numero: n, compte: typeof x.compte === 'string' ? x.compte.slice(0, 64) : '', reponses: Object.fromEntries(Object.entries(rep).slice(0, 30).map(([k, v]) => [String(k).slice(0, 60), String(v == null ? '' : v).slice(0, 200)])),
    pct: [0, 5, 10, 15, 20].includes(pct) ? pct : 0, etat: 'attente', at: Number(maintenant) || 0, maj: Number(maintenant) || 0 };
  return { ok: true, cle, job };
}
// La prochaine tâche d'un site (la plus ancienne en attente). `null` : rien à faire.
function faProchaine(ligne, site) {
  const L = faLigne(ligne);
  const l = Object.entries(L.jobs).filter(([, j]) => j.site === site && j.etat === 'attente').sort((a, b) => Number(a[1].at) - Number(b[1].at));
  return l.length ? { cle: l[0][0], job: l[0][1] } : null;
}
// VENDUE AILLEURS ? (preuves seulement) `vendusVinted` : Set des annonces Vinted vendues (prouvées) ; `fiches` :
// vinted_annonce_numeros ; `rp` : la liste « à retirer partout » de l'app (vrm_retirer_partout). Rend la raison, ou ''.
function faVendue(job, { vendusVinted = null, fiches = null, rp = null } = {}, cleNumF) {
  const n = cleNumF(job && job.numero);
  if (!n) return '';
  if (vendusVinted && typeof vendusVinted.has === 'function' && fiches && typeof fiches === 'object') {
    for (const [id, f] of Object.entries(fiches)) if (f && cleNumF(f.numero) === n && vendusVinted.has(String(id))) return 'vinted';
  }
  if (rp && Array.isArray(rp.items)) for (const e of rp.items) if (e && cleNumF(e.num) === n && String(e.venduSur || '').trim()) return String(e.venduSur).slice(0, 20);
  return '';
}
// L'issue d'un dépôt (`publierUnAussi`) ⇒ l'état de la tâche. `r` : { etat, id, lien, code, raison }.
function faApres(job, r, maintenant) {
  const j = Object.assign({}, job, { maj: Number(maintenant) || 0 });
  const e = r && typeof r === 'object' ? r : {};
  if (e.etat === 'publiee' && /^[\w-]{1,40}$/.test(String(e.id || ''))) return Object.assign(j, { etat: 'fait', id: String(e.id), lien: String(e.lien || '').slice(0, 300), raison: '' });
  if (e.etat === 'pas-su') return Object.assign(j, { etat: 'pas-su', raison: String(e.raison || '').slice(0, 240) });
  if (e.code === 'deja') return Object.assign(j, { etat: 'pas-su', raison: String(e.raison || '').slice(0, 240) });
  if (FA_PASSAGERS.test(String(e.code || ''))) return Object.assign(j, { etat: 'attente', raison: String(e.raison || '').slice(0, 240), essais: (Number(job.essais) || 0) + 1 });
  return Object.assign(j, { etat: 'arrete', code: String(e.code || '').slice(0, 40), raison: String(e.raison || '').slice(0, 240) });
}
// L'article tel que « Publier aussi » l'attend, depuis le BROUILLON (son identité : `brouillon`, son N°) et ses photos.
function faEntree(fiche, photos) {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const p = Number(String(f.prix == null ? '' : f.prix).replace(',', '.'));
  const m = Number(String(f.min == null ? '' : f.min).replace(',', '.'));
  const a = Number(String(f.buyPrice == null ? '' : f.buyPrice).replace(',', '.'));
  return { brouillon: String(f.id || ''), id: '', numero: String(f.numero || ''), titre: String(f.titre || ''), description: String(f.description || ''), marque: String(f.marque || ''), taille: String(f.taille || ''),
    etat: String(f.etat || ''), couleur: String((Array.isArray(f.couleurs) && f.couleurs[0]) || f.couleur || ''), catalogId: '', prix: Number.isFinite(p) && p > 0 ? p : null,
    prixMini: Number.isFinite(m) && m > 0 ? m : null, achat: Number.isFinite(a) && a > 0 ? a : null,
    photos: (Array.isArray(photos) ? photos : []).map((x) => (typeof x === 'string' ? x : x && x.img)).filter((u) => typeof u === 'string' && /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(u)).slice(0, 20) };
}
// </file-aussi-regle>
export { FA_ID, FA_SITES, FA_ETATS, FA_PASSAGERS, faCle, faLigne, faDemande, faProchaine, faVendue, faApres, faEntree };
