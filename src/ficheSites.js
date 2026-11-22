// ── src/ficheSites.js — « SUR LES SITES » : UNE RANGÉE PAR SITE SUR LA FICHE D'UN ARTICLE (21 nov. 2026) ─────────────────
// Julien (21 nov., choix 5) : la fiche d'une paire dit, pour CHAQUE site (Vinted, Leboncoin, eBay, Vestiaire), où elle en
// est — en ligne, masquée, vendue, pas publiée, pas revue depuis N j — avec son prix, ses vues, ses favoris, sa date et son
// lien ; « Publier sur… » là où elle n'est pas. CLAUDE.md §2.11 : l'objet central est l'ARTICLE, chaque site a les mêmes
// informations et les mêmes gestes. Récit : docs/passation/2026-11-21-fiche-sites.md.
//
// ⚠️ MODULE PUR, AUCUNE RÈGLE D'IDENTITÉ ICI. Il range ce que l'app a DÉJÀ relié à CE N° par identité (§5) :
//    l'annonce Vinted par sa fiche (`toutSurLeNumero`), eBay par le SKU `VRM-{n°}`, Leboncoin par le lien posé ou la
//    référence VRM, Vestiaire par le N° donné (`sitesDuNumero`, src/prixPartout.js), les ventes par leur transaction.
//    Il ne reçoit AUCUN titre à comparer et n'en lit aucun : 50 annonces au même titre sans identité ⇒ « pas publiée »
//    partout (audit-fiche-sites, audit-identite §17).
// ⚠️ « PAS SU » NE VAUT PAS « PAS PUBLIÉE ». Un site dont la lecture manque (`pasLus`, ou la lecture en cours) est « — »
//    avec sa raison, jamais « pas publiée », et n'offre pas « Publier sur… » (on ne propose pas de publier ce qui est
//    peut-être déjà en ligne).
// ⚠️ « Publier sur… » ne PUBLIE RIEN : il ouvre le parcours existant (« Publier ailleurs », qui passe par le panneau de
//    l'extension pour Leboncoin et Vestiaire, `publierfiche`, et par la route eBay) — rien ne part sans son toucher là-bas.
//    Jamais pour une paire vendue (sur n'importe quel site), jamais pour Vinted (aucun chemin « vers Vinted » ici).

export const SITES_FICHE = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
// Les sites où « Publier sur… » a un chemin (le parcours « Publier ailleurs » : `vrm:publier-ailleurs`).
export const SITES_PUBLIABLES = ['leboncoin', 'ebay', 'vestiaire'];
// L'ordre d'une rangée dans son site : la vente d'abord (ce qui est fait), puis ce qui est en ligne, puis le reste.
// (22 nov., intégration finale) + 'publiee' (ext. 5.424) : l'annonce que VRM vient de CRÉER, retenue par SON identifiant, pas encore relue.
// (22 nov., ext. 5.435, choix 2a) + 'en-pause' (une annonce Leboncoin en pause) et 'hors-ligne' (une annonce Vestiaire hors ligne,
// ou en attente de validation) : encore chez lui, sur CE site, par la même identité — pas « pas publiée », pas « vendue ».
const RANG = { vendue: 0, 'en-ligne': 1, publiee: 2, 'en-pause': 3, 'hors-ligne': 3, masquee: 3, 'pas-revue': 4, retiree: 5 };
const ETATS_ENTREE = Object.keys(RANG);
const JOUR = 86400000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lienSur = (v) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : '');
// Le nom d'un site tel que les lectures le disent (« Vinted », « eBay », « Leboncoin », « Vestiaire ») ⇒ sa clé.
export const cleSiteFiche = (v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return SITES_FICHE.includes(s) ? s : ''; };

// ENTRÉE
//   entrees : les annonces et ventes de CE N° (déjà par identité), une par annonce ou vente :
//             { site, etat: 'vendue'|'en-ligne'|'masquee'|'pas-revue'|'retiree', compte, prix (centimes|null), vues, favoris,
//               date (ms, la vente), depuis | creeLe (ms, la mise en ligne lue), lu (ms, la dernière lecture complète du compte,
//               pour « pas revue »), lien (https), id } — un nombre pas lu reste absent (jamais 0) ;
//   o.pasLus      : les sites dont la lecture MANQUE (noms ou clés) ; `undefined` = lecture en cours (tout ce qui n'a pas
//                   d'entrée est alors « — », rien n'est « pas publiée ») ;
//   o.montres     : les sites que le vendeur montre (Paramètres → plateformes) ; null = les quatre. Un site non montré
//                   apparaît quand même s'il porte une entrée (une vente sur Vestiaire ne disparaît pas) ;
//   o.publier     : true si le geste « Publier sur… » est branché ; o.double : deux paires sous ce N° (rien n'est proposé) ;
//   o.maintenant  : l'heure (ms).
// SORTIE : [{ site, etat: …|'pas-publiee'|'pas-su', raison ('lecture'|'pas-lu'|''), compte, prix, vues, favoris, date,
//            dateSorte ('vente'|'mise'|null), jours (pas revue : jours pleins depuis la dernière lecture | null), lien, id,
//            publier (bool), premiere (la 1re rangée de son site), n (les rangées de son site) }] — au moins une par site montré.
export function rangeesSitesFiche(entrees, o = {}) {
  const maintenant = num(o.maintenant) != null ? o.maintenant : Date.now();
  const lecture = o.pasLus === undefined;
  const pasLus = new Set((Array.isArray(o.pasLus) ? o.pasLus : []).map(cleSiteFiche).filter(Boolean));
  const montres = Array.isArray(o.montres) ? new Set(o.montres.map(cleSiteFiche).filter(Boolean)) : null;
  const parSite = new Map(SITES_FICHE.map((s) => [s, []]));
  for (const e of Array.isArray(entrees) ? entrees : []) {
    if (!e || !parSite.has(e.site) || !ETATS_ENTREE.includes(e.etat)) continue;
    parSite.get(e.site).push(e);
  }
  const vendueQuelquePart = [...parSite.values()].some((l) => l.some((e) => e.etat === 'vendue'));
  const peutPublier = !!o.publier && !o.double && !vendueQuelquePart;
  const out = [];
  for (const site of SITES_FICHE) {
    const l = parSite.get(site).slice().sort((a, b) => (RANG[a.etat] - RANG[b.etat]) || ((num(b.date) || 0) - (num(a.date) || 0)));
    if (montres && !montres.has(site) && !l.length) continue;
    // Un site ne compte comme « présent » que par une annonce qui y est encore (vendue, en ligne, masquée, pas revue).
    const present = l.some((e) => e.etat !== 'retiree');
    const rangee = (e) => {
      const vente = e.etat === 'vendue';
      const mise = num(e.depuis) != null ? e.depuis : num(e.creeLe);
      const date = vente ? num(e.date) : mise;
      const jours = e.etat === 'pas-revue' && num(e.lu) != null && e.lu <= maintenant ? Math.floor((maintenant - e.lu) / JOUR) : null;
      return { site, etat: e.etat, raison: '', compte: String(e.compte || ''), prix: num(e.prix), vues: num(e.vues), favoris: num(e.favoris),
        date, dateSorte: date == null ? null : vente ? 'vente' : 'mise', jours, lien: vente || e.etat === 'retiree' ? '' : lienSur(e.lien), id: e.id != null ? String(e.id) : '', publier: false };
    };
    let ici;
    if (present) ici = l.filter((e) => e.etat !== 'retiree').map(rangee);      // une annonce retirée ne redit rien quand une autre est là
    else {
      // Rien de vivant sur ce site. LU ⇒ « pas publiée » (ou « plus en ligne » si une annonce de CE N° y a été retirée) et
      // « Publier sur… » ; PAS LU ⇒ « — » et pourquoi, jamais « pas publiée », aucun geste.
      const su = !lecture && !pasLus.has(site);
      const ret = l.find((e) => e.etat === 'retiree') || null;
      const r = su && ret ? rangee(ret) : { site, etat: su ? 'pas-publiee' : 'pas-su', raison: su ? '' : lecture ? 'lecture' : 'pas-lu', compte: '', prix: null, vues: null, favoris: null,
        date: null, dateSorte: null, jours: null, lien: '', id: '', publier: false };
      r.publier = su && peutPublier && SITES_PUBLIABLES.includes(site);
      ici = [r];
    }
    ici.forEach((r, i) => { r.premiere = i === 0; r.n = ici.length; out.push(r); });
  }
  return out;
}

// (22 nov., ext. 5.435, Julien choix 2a : « Leboncoin et Vestiaire à égalité avec Vinted ») LES ANNONCES DES AUTRES SITES
// QUI NE SONT PAS EN LIGNE, PAR LA MÊME IDENTITÉ que la règle du prix (`sitesDuNumero`) : le N° rendu par `o.numLbc` (lien posé
// à la main, référence VRM) et `o.numVc` (N° donné, référence, lien VRM) — jamais par un titre (aucun titre n'est lu ici).
//   lbcItems  `lbc_listings.items` (null = pas lu ⇒ rien) ; vcItems `vc_listings.items` (null = pas lu ⇒ rien) ;
//   o.etatLbc(ad) ⇒ l'état Leboncoin de l'app (`etatAnnonceLeboncoin` avec `lbcSortieDe`) : 'pause' ⇒ « en pause » ;
//   o.etatVc(it)  ⇒ la famille Vestiaire (`etatAnnonceVcBrut`) : 'attente' ⇒ « hors ligne » ; 'retiree' ⇒ « hors ligne » si le
//                   mot de Vestiaire dit hors ligne (dépublié, désactivé…), sinon « plus en ligne » ; jamais 'vendue' (la vente
//                   a sa rangée par sa transaction), jamais un état inconnu (« pas dit » n'est pas « hors ligne »).
// Rend les entrées de `rangeesSitesFiche` ({ site, etat: 'en-pause'|'hors-ligne'|'retiree', id, compte, prix (centimes|null),
// favoris, depuis, lien }). Un nombre pas lu reste absent.
const HORS_LIGNE_VC = /unpublish|offline|hors.?ligne|deactiv|d[ée]sactiv|inactiv|paus|hidden|masqu/i;
const centimes = (v) => { const a = v && typeof v === 'object' ? (v.valeur != null ? v.valeur : v.amount) : Array.isArray(v) ? v[0] : v; const n = Number(String(a == null ? '' : a).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const msLu = (d) => { if (d == null || d === '') return undefined; const n = Number(d); const t = Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(d)); return Number.isFinite(t) && t > 0 ? t : undefined; };
export function annoncesHorsLigneAutresSites(cle, { lbcItems, vcItems } = {}, o = {}) {
  const k = o.cleNum ? o.cleNum(cle) : String(cle == null ? '' : cle).trim();
  const out = [];
  if (!k) return out;
  const meme = (v) => v != null && String(v).trim() !== '' && (o.cleNum ? o.cleNum(v) : String(v).trim()) === k;
  if (lbcItems && typeof lbcItems === 'object' && typeof o.etatLbc === 'function' && typeof o.numLbc === 'function') {
    for (const [id, ad] of Object.entries(lbcItems)) {
      if (!ad || typeof ad !== 'object' || !/^\d{5,15}$/.test(String(id))) continue;
      let e = null; try { e = o.etatLbc(ad, id); } catch (_) { e = null; }
      if (e !== 'pause') continue;
      if (!meme(o.numLbc(ad, id))) continue;
      out.push({ site: 'leboncoin', etat: 'en-pause', id: String(id), compte: String(ad.accountName || ''), prix: centimes(ad.price), favoris: ad.stats && Number.isFinite(ad.stats.favoris) ? ad.stats.favoris : undefined,
        depuis: msLu(ad.publieeLe), lien: lienSur(ad.url) && /^https:\/\/(www\.)?leboncoin\.fr\//i.test(ad.url) ? ad.url : `https://www.leboncoin.fr/ad/x/${encodeURIComponent(String(id))}` });
    }
  }
  if (vcItems && typeof vcItems === 'object' && typeof o.etatVc === 'function' && typeof o.numVc === 'function') {
    for (const [id, it] of Object.entries(vcItems)) {
      if (!it || typeof it !== 'object' || !/^[\w-]{3,40}$/.test(String(id))) continue;
      let e = null; try { e = o.etatVc(it, id); } catch (_) { e = null; }
      if (e !== 'attente' && e !== 'retiree') continue;
      if (!meme(o.numVc(id, it))) continue;
      const hors = e === 'attente' || HORS_LIGNE_VC.test(String(it.statut || ''));
      out.push({ site: 'vestiaire', etat: hors ? 'hors-ligne' : 'retiree', id: String(id), compte: '', prix: centimes(it.prix), depuis: msLu(it.depuis),
        lien: hors ? `https://fr.vestiairecollective.com/${encodeURIComponent(String(id))}.shtml` : '' });
    }
  }
  return out;
}

// Le résumé des rangées (pour l'en-tête de la section et les bancs) : combien de sites lus, où elle est, où la publier.
export function resumeSitesFiche(rangees) {
  const l = Array.isArray(rangees) ? rangees : [];
  const de = (etat) => [...new Set(l.filter((r) => r.etat === etat).map((r) => r.site))];
  return { enLigne: de('en-ligne'), vendue: de('vendue'), pasPubliee: de('pas-publiee'), pasSu: de('pas-su'), publier: [...new Set(l.filter((r) => r.publier).map((r) => r.site))] };
}
