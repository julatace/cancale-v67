// ── L'HISTORIQUE D'UN N° (9 nov. 2026, lot AF — proposition 49, validée) ───────
// « Un N° écrit sur un carton ne change jamais sans trace. » La fiche d'une paire
// raconte, EN LECTURE SEULE, la ligne de vie de SON N° : quand et pourquoi il a été
// posé (à la mise en ligne, à la main, repris d'une annonce republiée, réglé comme
// doublon, lu dans l'annonce, ancien N° passé en « B » le jour de la remise à zéro),
// changé, quitté par une annonce, et sa case du Stock libérée (colis parti).
//
// ⚠️ RIEN N'EST DEVINÉ (§5, « mieux vaut un blanc qu'un faux »). Chaque ligne vient
//    d'une trace qui EXISTE :
//      · la fiche de l'annonce (`vinted_annonce_numeros`) : `numberedAt` + `auto`,
//        `manuelAt`, `repriseAt`/`repriseDe`, `recreeAt`/`recreeDe`, `ecritAt`,
//        `reattribue` { de, vers, at, main | archive, ecrit }, `numeroRendu`,
//        `cartonVerifie` — chaque champ ne garde que SON dernier événement ;
//      · le N° posé sur une VENTE (`vinted_sale_overrides` : `manuelAt`, `autoAssigned`) ;
//      · le marqueur du serveur (`vrm_numerotation` : `archive`, `appliqueLe`, `coupure`) ;
//      · le journal des cases libérées du Stock (`vrm_stock_sortis`) ;
//      · le JOURNAL DES N° (`vrm_numeros_journal`, append-only, ce lot) : chaque
//        changement de N° d'une fiche, écrit AU MOMENT où il arrive (`save`, App.jsx),
//        sur la même ligne synchronisée que les fiches (`main`, comparer-et-échanger
//        sur `data.rev`). Il commence le 9 nov. 2026 : avant, seul le dernier
//        changement de chaque fiche est connu, et ce qui manque est DIT
//        (« origine non enregistrée (avant le 9 nov. 2026) »).
// ⚠️ CE MODULE NE CHANGE AUCUN N°. Il lit ; le journal ne fait qu'AJOUTER des lignes.
//
// Module PUR (aucun accès au navigateur ni à la base) : la fiche (App.jsx), l'écriture
// du journal (`save`, App.jsx) et `scripts/audit-doublons-historique.cjs` exécutent les
// MÊMES fonctions (§11).

export const CLE_JOURNAL_NUMEROS = 'vrm_numeros_journal';
// Le jour où le journal a commencé : avant, on ne sait que le DERNIER changement de chaque fiche.
export const JOURNAL_DEBUT = '2026-11-09';

const str = (v) => String(v == null ? '' : v).trim();
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, '');
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
};
const isoOk = (v) => { const t = Date.parse(str(v)); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const frais = (a, b) => !!str(a) && str(a) !== str(b);

// ── 1. LE JOURNAL : ce qui a changé entre deux états des fiches ─────────────────
// `avant` / `apres` : `vinted_annonce_numeros` avant et après UNE écriture. Rend les
// lignes à AJOUTER : une par fiche dont le N° (sa clé `cleNum`) a changé ou est apparu.
//   { at, id, num, de?, quoi, src? }
//   quoi : 'auto' (donné à la mise en ligne) · 'main' (saisi à la main) · 'doublon'
//          (règlement automatique des doublons, décision du 20 oct.) · 'reprise'
//          (repris de l'annonce remplacée, `recreeDe` / `repriseDe`) · 'ecrit' (lu dans
//          l'annonce) · 'archive' (ancien N° d'archive remplacé) · 'inconnu'.
// La date est celle du champ de la fiche qui porte l'événement (sinon `maintenant`).
// `avant` illisible (rien sur l'appareil) ⇒ AUCUNE ligne : on ne sait pas ce qui est neuf.
export function evenementsNumeroFiches(avant, apres, { maintenant = new Date().toISOString(), cle = cleDefaut } = {}) {
  if (!estObjet(avant) || !estObjet(apres)) return [];
  const out = [];
  for (const id of Object.keys(apres)) {
    const f = apres[id];
    if (!estObjet(f)) continue;
    const num = str(f.numero);
    if (!num) continue;                                   // un N° ne se retire jamais : rien à noter
    const a = estObjet(avant[id]) ? avant[id] : null;
    const ancien = a ? str(a.numero) : '';
    if (ancien && cle(ancien) === cle(num)) continue;     // même N° (« b125 » = « B125 »)
    const r = estObjet(f.reattribue) ? f.reattribue : null;
    const rFrais = r && cle(r.vers) === cle(num) && frais(r.at, a && estObjet(a.reattribue) ? a.reattribue.at : '');
    let quoi = 'inconnu', at = null, de = ancien || '', src = '';
    if (frais(f.recreeAt, a && a.recreeAt)) { quoi = 'reprise'; at = f.recreeAt; src = str(f.recreeDe); if (!de && estObjet(f.numeroRendu)) de = str(f.numeroRendu.de); }
    else if (frais(f.repriseAt, a && a.repriseAt)) { quoi = 'reprise'; at = f.repriseAt; src = str(f.repriseDe); }
    else if (rFrais) { quoi = r.main ? 'main' : r.archive ? 'archive' : (str(f.ecritAt) && str(f.ecritAt) === str(r.at) ? 'ecrit' : 'doublon'); at = r.at; de = str(r.de) || de; }
    else if (frais(f.ecritAt, a && a.ecritAt)) { quoi = 'ecrit'; at = f.ecritAt; }
    else if (frais(f.manuelAt, a && a.manuelAt)) { quoi = 'main'; at = f.manuelAt; }
    else if (f.auto === true) { quoi = 'auto'; at = (!ancien && f.numberedAt) || null; }
    const l = { at: isoOk(at) || isoOk(maintenant) || new Date().toISOString(), id: String(id), num, quoi };
    if (de && cle(de) !== cle(num)) l.de = de;
    if (src) l.src = src;
    out.push(l);
  }
  return out;
}

// Ajouter au journal : APPEND-ONLY. Les lignes déjà là ne bougent jamais ; une ligne
// identique (même contenu) n'est pas doublée (deux onglets, un rejeu de la file d'envoi).
export function ajouterAuJournal(journal, lignes) {
  const base = Array.isArray(journal) ? journal.slice() : [];
  const vus = new Set(base.map((l) => JSON.stringify(l)));
  for (const l of (Array.isArray(lignes) ? lignes : [])) { const k = JSON.stringify(l); if (!vus.has(k)) { vus.add(k); base.push(l); } }
  return base;
}

// ── 2. LA LIGNE DE VIE D'UN N° ────────────────────────────────────────────────
// { cle, fiches, saleOv, journal, marqueur, sortieStock, estArchive, cle: cleNum }
// Rend null quand les fiches ne sont pas lues (« pas su »), sinon
//   { evenements: [{ cle, quoi, at, texte, preuve, id? }], origineConnue, note }
// triés du plus ancien au plus récent (sans date en tête : « — »).
const QUAND_JOURNAL = 'avant le 9 nov. 2026';
const TEXTE = {
  auto: 'Donné à la mise en ligne',
  main: 'Saisi à la main',
  doublon: 'Réglé comme doublon (décision du 20 oct.)',
  reprise: 'Repris de l’annonce remplacée',
  ecrit: 'Lu dans le texte de l’annonce',
  archive: 'Remise en vente : N° neuf, l’ancien était un N° d’archive',
  inconnu: 'Posé',
};
export function historiqueNumero({ cle: cible, fiches, saleOv = null, journal = null, marqueur = null, sortieStock = null, estArchive = null, cleNum = cleDefaut } = {}) {
  if (!estObjet(fiches)) return null;
  const k = cleNum(cible);
  if (!k) return null;
  const evs = [];
  const vus = new Set();                                  // id|quoi|at : une trace dite une fois
  const pousser = (e) => { const s = `${e.id || ''}|${e.quoi}|${e.at || ''}`; if (vus.has(s)) return; vus.add(s); evs.push(e); };
  const sur = (id) => ` · annonce ${id}`;
  let origineConnue = false;

  // a. Le journal (depuis le 9 nov.) : le N° posé sur une fiche, ou QUITTÉ par elle.
  for (const l of (Array.isArray(journal) ? journal : [])) {
    if (!estObjet(l)) continue;
    const at = isoOk(l.at);
    if (cleNum(l.num) === k) {
      origineConnue = true;
      pousser({ cle: 'journal', quoi: l.quoi || 'inconnu', at, id: str(l.id),
        texte: `${TEXTE[l.quoi] || TEXTE.inconnu}${l.de ? ` (avant : N°${l.de})` : ''}`,
        preuve: `journal des N°${sur(str(l.id))}${l.src ? ` · remplace l’annonce ${l.src}` : ''}` });
    } else if (l.de && cleNum(l.de) === k) {
      pousser({ cle: 'quitte', quoi: 'quitte', at, id: str(l.id), texte: `Quitté par une annonce : elle porte maintenant le N°${str(l.num)} (${(TEXTE[l.quoi] || TEXTE.inconnu).toLowerCase()})`, preuve: `journal des N°${sur(str(l.id))}` });
    }
  }
  const dejaJournal = (id) => evs.some((e) => e.cle === 'journal' && e.id === String(id));

  // b. Les fiches qui portent CE N° : leur origine, par leurs champs (le dernier événement).
  for (const id of Object.keys(fiches)) {
    const f = fiches[id];
    if (!estObjet(f) || cleNum(f.numero) !== k) continue;
    const r = estObjet(f.reattribue) && cleNum(f.reattribue.vers) === k ? f.reattribue : null;
    let o = null;
    if (str(f.recreeAt) || str(f.recreeDe)) o = { quoi: 'reprise', at: isoOk(f.recreeAt), texte: TEXTE.reprise, preuve: `l’annonce ${str(f.recreeDe) || '?'} remplacée par celle-ci (republiée par VRM)` };
    else if (str(f.repriseAt)) o = { quoi: 'reprise', at: isoOk(f.repriseAt), texte: 'Repris d’une ancienne fiche de la même paire', preuve: f.repriseDe ? `ancienne fiche ${str(f.repriseDe)}` : 'ancienne fiche' };
    else if (r) o = { quoi: r.main ? 'main' : r.archive ? 'archive' : (str(f.ecritAt) && str(f.ecritAt) === str(r.at) ? 'ecrit' : 'doublon'), at: isoOk(r.at),
      texte: `${r.main ? TEXTE.main : r.archive ? TEXTE.archive : (str(f.ecritAt) && str(f.ecritAt) === str(r.at) ? TEXTE.ecrit : TEXTE.doublon)} (avant : N°${str(r.de)})`, preuve: 'fiche de l’annonce' };
    else if (str(f.ecritAt)) o = { quoi: 'ecrit', at: isoOk(f.ecritAt), texte: TEXTE.ecrit, preuve: f.ecrit ? `lu dans ${str(f.ecrit) === 'titre' ? 'le titre' : 'la description'}` : 'fiche de l’annonce' };
    else if (str(f.manuelAt)) o = { quoi: 'main', at: isoOk(f.manuelAt), texte: TEXTE.main, preuve: 'fiche de l’annonce' };
    else if (f.auto === true && str(f.numberedAt)) o = { quoi: 'auto', at: isoOk(f.numberedAt), texte: TEXTE.auto, preuve: 'fiche de l’annonce' };
    else if (str(f.numberedAt)) o = { quoi: 'inconnu', at: isoOk(f.numberedAt), texte: 'Posé — la manière n’est pas enregistrée', preuve: 'fiche de l’annonce' };
    if (o) {
      origineConnue = true;
      // Le journal a déjà dit CET événement (même fiche, même nature, même jour) : une fois.
      const doublonJ = evs.some((e) => e.cle === 'journal' && e.id === String(id) && e.quoi === o.quoi && (!o.at || !e.at || o.at.slice(0, 16) === e.at.slice(0, 16)));
      if (!doublonJ) pousser({ cle: 'fiche', id: String(id), ...o, preuve: o.preuve + sur(id) });
    } else if (!dejaJournal(id)) pousser({ cle: 'fiche', quoi: 'inconnu', at: null, id: String(id), texte: `Origine non enregistrée (${QUAND_JOURNAL})`, preuve: 'fiche de l’annonce' + sur(id) });
    // Ce qui a suivi, sur la même fiche.
    if (r && str(r.ecrit)) pousser({ cle: 'carton', quoi: 'ecrit-carton', at: isoOk(r.ecrit), id: String(id), texte: '« C’est écrit » : le nouveau N° est écrit là où l’article est rangé', preuve: 'ton clic' + sur(id) });
    const cv = isoOk(f.cartonVerifie);
    if (cv && cv !== isoOk(f.manuelAt) && !(r && cv === isoOk(r.ecrit))) pousser({ cle: 'carton', quoi: 'carton', at: cv, id: String(id), texte: 'N° vérifié là où l’article est rangé', preuve: 'ton clic' + sur(id) });
  }

  // c. Les fiches qui ont QUITTÉ ce N° (leur dernier changement le dit).
  for (const id of Object.keys(fiches)) {
    const f = fiches[id];
    if (!estObjet(f) || cleNum(f.numero) === k) continue;
    const r = estObjet(f.reattribue) ? f.reattribue : null;
    if (r && cleNum(r.de) === k && cleNum(r.vers) === cleNum(f.numero)) {
      const at = isoOk(r.at);
      if (!evs.some((e) => e.cle === 'quitte' && e.id === String(id))) pousser({ cle: 'quitte', quoi: 'quitte', at, id: String(id),
        texte: `Quitté par une annonce : elle porte maintenant le N°${str(f.numero)} (${r.main ? 'changé à la main' : r.archive ? 'remise en vente' : 'doublon réglé'})`, preuve: 'fiche de l’annonce' + sur(id) });
    }
    const nr = estObjet(f.numeroRendu) ? f.numeroRendu : null;
    if (nr && cleNum(nr.de) === k && !evs.some((e) => e.cle === 'quitte' && e.id === String(id))) pousser({ cle: 'quitte', quoi: 'quitte', at: isoOk(nr.at), id: String(id),
      texte: `Quitté par une annonce republiée : elle a repris le N°${str(f.numero)} de l’annonce qu’elle remplace`, preuve: 'fiche de l’annonce' + sur(id) });
  }

  // d. Le N° posé sur une VENTE (sans fiche d'annonce).
  if (estObjet(saleOv)) {
    for (const tx of Object.keys(saleOv)) {
      const o = saleOv[tx];
      if (!estObjet(o) || cleNum(o.numero) !== k) continue;
      origineConnue = true;
      if (str(o.manuelAt)) pousser({ cle: 'vente', quoi: 'main', at: isoOk(o.manuelAt), texte: 'Saisi à la main sur la vente', preuve: `transaction ${tx}` });
      else if (o.autoAssigned) pousser({ cle: 'vente', quoi: 'auto', at: null, texte: 'Posé sur la vente par VRM (date non enregistrée)', preuve: `transaction ${tx}` });
      else pousser({ cle: 'vente', quoi: 'inconnu', at: null, texte: `Posé sur la vente — origine non enregistrée (${QUAND_JOURNAL})`, preuve: `transaction ${tx}` });
    }
  }

  // e. La remise à zéro (migration 013) : un N° d'archive est l'ANCIEN numéro + la lettre.
  const m = estObjet(marqueur) && !marqueur.annule ? marqueur : null;
  const lettre = m ? str(m.archive).toUpperCase() : '';
  if (lettre && (typeof estArchive === 'function' ? estArchive(k) : k.startsWith(lettre)) && k.startsWith(lettre)) {
    origineConnue = true;
    pousser({ cle: 'archive', quoi: 'b013', at: isoOk(m.appliqueLe) || isoOk(m.coupure), texte: `Ancien N°${k.slice(lettre.length)} passé en « ${k} » à la remise à zéro`, preuve: `migration 013${isoOk(m.coupure) ? ` · annonces d’avant le ${new Date(Date.parse(m.coupure)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` });
  }

  // f. Sa case du Stock libérée (colis parti) — le N° reste.
  if (estObjet(sortieStock) && Number.isFinite(Number(sortieStock.at))) {
    pousser({ cle: 'stock', quoi: 'libere', at: new Date(Number(sortieStock.at)).toISOString(), texte: `Case du Stock libérée (colis parti)${sortieStock.itemName ? ` · « ${str(sortieStock.itemName)} »` : ''} — le N° reste`, preuve: 'journal du Stock' });
  }

  const t = (e) => (e.at ? Date.parse(e.at) : -Infinity);
  evs.sort((a, b) => t(a) - t(b));
  const avantJournal = evs.some((e) => e.at && e.at.slice(0, 10) < JOURNAL_DEBUT && e.cle !== 'archive' && e.cle !== 'stock');
  return {
    cle: k, evenements: evs, origineConnue,
    note: !evs.length ? `Aucune trace de ce N° (${QUAND_JOURNAL}, VRM ne gardait pas de journal).`
      : avantJournal ? 'Avant le 9 nov. 2026, VRM ne gardait que le dernier changement de chaque annonce.' : '',
  };
}

// Le jour d'une ligne (« 3 nov. 2026 »), ou « — » sans date.
export const dateLigne = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};
