// ═══════════════════════════════════════════════════════════════════════════
// LE LIVRE DE POLICE — REGISTRE DES OBJETS MOBILIERS (10 novembre, lot R)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (9 nov., proposition 27, « Fais tout ») : le livre de police tenu depuis
// les achats — date, description, prix, vendeur (pseudo + plateforme), n° de la
// paire ; export PDF. Ce que la plateforme ne donne pas (pièce d'identité du
// vendeur) est dit « à compléter », jamais inventé.
//
// ── CE QUE DIT LE DROIT (sources, relues le 10 nov. 2026) ──────────────────────
// ⚠️ Légifrance et service-public.gouv.fr n'étaient pas joignables depuis la
//    session (réseau fermé) : le texte ci-dessous vient des extraits officiels
//    rendus par la recherche, recoupés. Rien n'est ajouté de mémoire. À relire
//    sur la source avant toute nouvelle mention :
//    · Code pénal, art. 321-7 (l'obligation) et R321-1 à R321-12 (le registre) :
//      https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070719/LEGISCTA000006117615/
//    · Art. R321-3 (version en vigueur depuis le 29 janvier 2012, décret
//      n° 2012-99) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000025213232
//    · Fiche officielle « Vente de biens d'occasion par des professionnels » :
//      https://entreprendre.service-public.gouv.fr/vosdroits/F39552
//    · Déclaration préalable (préfecture) : cerfa n° 11733*02,
//      https://www.formulaires.service-public.gouv.fr/gf/cerfa_11733_02.do
//
//  À QUI : le professionnel qui vend des objets mobiliers usagés ou acquis
//  auprès de personnes autres que celles qui les fabriquent ou en font le
//  commerce (art. 321-7). Un particulier qui vend ses affaires n'est pas visé.
//  ⇒ VRM ne le PROPOSE qu'à un statut professionnel CHOISI par lui
//    (`vinted_regime` micro · societe · marge, src/profilFiscal.js) ; jamais
//    deviné, jamais à un particulier, jamais à un statut pas choisi.
//
//  LES MENTIONS, POUR CHAQUE OBJET (ou lot) :
//    · R321-3 — un NUMÉRO D'ORDRE porté sur le registre (et de façon apparente
//      sur l'objet ou le lot) ; la NATURE, la PROVENANCE et la DESCRIPTION de
//      l'objet (ses caractéristiques et ce qui permet de l'identifier) ;
//      l'IDENTITÉ de la personne qui l'a vendu : nom, prénoms, qualité et
//      domicile, la nature, le numéro et la date de délivrance de sa pièce
//      d'identité, avec l'autorité qui l'a établie (une personne morale : sa
//      dénomination, son siège, et l'identité de son représentant) ;
//    · le PRIX D'ACHAT et le MODE DE RÈGLEMENT — cités par la fiche pratique
//      officielle de mairie (Carpentras, « statut du brocanteur ») et les guides
//      professionnels au titre de R321-3 à R321-6 ; l'extrait Légifrance lu ne
//      montrait pas ce passage : la mention est TENUE (elle ne coûte rien et ne
//      peut pas faire défaut), sans prétendre à une citation exacte ;
//    · R321-5 — le cas échéant, la mesure de protection de l'objet (code du
//      patrimoine) lorsque le revendeur en est informé : sans objet pour des
//      chaussures d'occasion, rien n'est écrit à sa place ;
//    · R321-6 — mentions sans blanc, rature ni abréviation ; un registre tenu
//      sur ordinateur doit GARANTIR L'INTÉGRITÉ des données. Un fichier exporté
//      par VRM ne le garantit pas : l'export le DIT, et ne se présente jamais
//      comme « le » registre réglementaire.
//    · Conservation : la fiche officielle F39552 parle de plusieurs années
//      (cinq ans après clôture pour le papier) — non recopié ici, à lire.
//
// ── CE QUE VRM SAIT, ET CE QU'IL NE SAIT PAS ──────────────────────────────────
//   · Une ligne = une ligne du REGISTRE DES ACHATS (`registreDesAchats`,
//     src/registres.js) : mêmes achats, mêmes montants, mêmes comptes écartés
//     (§5 « une règle par notion »). Rien n'est recompté ici.
//   · Le N° D'ORDRE est à LUI : une ligne `vrm_livre_police` (append-only),
//     posé sur SON clic (« Inscrire »), dans l'ordre des dates d'achat, à la
//     suite du dernier. JAMAIS réattribué, jamais renuméroté, jamais rendu : un
//     achat annulé après son inscription garde son numéro (sa ligne le dit).
//     Écriture en comparer-et-échanger sur `data.rev` : deux appareils ne
//     donnent jamais le même numéro à deux achats. Une lecture ratée n'écrit RIEN.
//   · Le VENDEUR : sur Vinted, le PSEUDO lu dans SA transaction, côté acheteur
//     (`user_side` = 'buyer', `seller.login`) — jamais déduit d'un titre ni
//     d'une conversation ; pas lu ⇒ « à compléter ». Un achat en gros : le nom
//     du fournisseur qu'IL a saisi. Hors plateforme : la source qu'il a saisie
//     n'est pas une personne ⇒ « à compléter ».
//   · L'IDENTITÉ CIVILE (nom, prénoms, domicile, pièce d'identité) : aucune
//     plateforme ne la donne. VRM ne la stocke pas : chaque ligne la dit « à
//     compléter », et le résumé compte ce qui manque. JAMAIS le mot « conforme ».
//
// JS pur, sans React ni lecture : scripts/audit-livre-police.cjs l'exécute.
// ─────────────────────────────────────────────────────────────────────────────

export const LIVRE_POLICE_ID = 'vrm_livre_police';
export const A_COMPLETER = 'à compléter';
const STATUTS_PRO = new Set(['micro', 'societe', 'marge']);

// Proposé seulement à un statut professionnel CHOISI (le profil de src/profilFiscal.js).
export const livrePolicePropose = (profil) => !!(profil && STATUTS_PRO.has(profil.etat));

// Les mentions que VRM tient, et l'article qui les demande (l'export les liste).
export const MENTIONS = Object.freeze([
  Object.freeze({ id: 'ordre', nom: 'N° d’ordre', article: 'R321-3' }),
  Object.freeze({ id: 'date', nom: 'Date d’achat', article: 'R321-3' }),
  Object.freeze({ id: 'description', nom: 'Nature et description', article: 'R321-3' }),
  Object.freeze({ id: 'provenance', nom: 'Provenance', article: 'R321-3' }),
  Object.freeze({ id: 'prix', nom: 'Prix d’achat', article: 'R321-3' }),
  Object.freeze({ id: 'reglement', nom: 'Mode de règlement', article: 'R321-3' }),
  Object.freeze({ id: 'vendeur', nom: 'Vendeur', article: 'R321-3' }),
  Object.freeze({ id: 'identite', nom: 'Identité du vendeur (nom, prénoms, domicile, pièce d’identité)', article: 'R321-3' }),
]);

// ── LE PSEUDO DU VENDEUR (Vinted) ──────────────────────────────────────────
// Une ligne de transaction PROJETÉE ({ side, vendeur }) : le pseudo seulement
// quand la transaction est lue CÔTÉ ACHETEUR (un achat entre ses propres comptes
// lu côté vendeur porterait son propre pseudo).
export const pseudoVendeurTx = (r) => {
  if (!r || r.side !== 'buyer') return '';
  const p = String(r.vendeur == null ? '' : r.vendeur).trim();
  return p && p.length <= 80 ? p : '';
};
// Les ids des transactions à lire pour des lignes Vinted : `harvest_{uid}_txn_{tx}`.
export const idsTransactions = (lignes, uidDeTx) => {
  const out = new Set();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l || l.plateforme !== 'Vinted' || !/^\d+$/.test(String(l.reference || ''))) continue;
    const u = String((uidDeTx && uidDeTx(String(l.reference))) || '');
    if (/^\d+$/.test(u)) out.add(`harvest_${u}_txn_${l.reference}`);
  }
  return [...out].sort();
};

// ── L'ÉTAT (la ligne `vrm_livre_police`) ───────────────────────────────────
// { v: 1, rev, dernier, ordre: { [id d'achat]: { n, ts, t, at } } }
//   n  : le n° d'ordre · ts : la date d'achat au moment de l'inscription ·
//   t  : la description d'alors (80 car.) — pour qu'un achat disparu depuis
//        (annulé, compte retiré) garde une ligne lisible · at : inscrit le.
export const etatVide = () => ({ v: 1, dernier: 0, ordre: {} });
// Un état lisible et SAIN ? `null` si abîmé (deux achats sous le même numéro, un
// numéro au-delà du dernier) : alors rien ne s'inscrit, l'écran le dit.
export function etatLu(d) {
  if (d == null) return null;
  if (typeof d !== 'object' || Array.isArray(d)) return null;
  if (d.ordre == null && d.dernier == null) return etatVide();
  const ordre = d.ordre && typeof d.ordre === 'object' && !Array.isArray(d.ordre) ? d.ordre : null;
  if (!ordre) return null;
  const vus = new Set(); let max = 0;
  for (const [id, e] of Object.entries(ordre)) {
    if (!id || !e || !Number.isSafeInteger(e.n) || e.n < 1 || vus.has(e.n)) return null;
    vus.add(e.n); if (e.n > max) max = e.n;
  }
  const dernier = Number.isSafeInteger(d.dernier) && d.dernier >= max ? d.dernier : null;
  if (dernier == null) return null;
  return { v: 1, rev: Number.isSafeInteger(d.rev) ? d.rev : null, dernier, ordre };
}

// Les lignes du registre des achats qui peuvent recevoir un numéro : datées, pas
// encore inscrites. Dans l'ordre des dates d'achat (puis de l'identifiant).
export function aInscrire(lignes, etat) {
  const o = (etat && etat.ordre) || {};
  const vus = new Set();
  const out = [];
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l || !l.id || l.ts == null || !Number.isFinite(l.ts) || o[l.id] || vus.has(l.id)) continue;
    if (/^vinted:\?/.test(String(l.id))) continue;   // un achat sans n° de transaction n'a pas d'identité stable
    vus.add(l.id); out.push(l);
  }
  return out.sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
}

// INSCRIRE : à la suite du dernier numéro, jamais un trou rempli, jamais un
// numéro changé. Rend un NOUVEL état (l'ancien n'est pas touché).
export function inscrire(etat, lignes, { maintenant = Date.now() } = {}) {
  const e = etatLu(etat);
  if (!e) return null;
  const ordre = { ...e.ordre };
  let dernier = e.dernier;
  const at = new Date(maintenant).toISOString();
  for (const l of aInscrire(lignes, e)) {
    dernier += 1;
    ordre[l.id] = { n: dernier, ts: l.ts, t: descriptionDe(l).slice(0, 80), at };
  }
  return { v: 1, dernier, ordre };
}

// ── UNE LIGNE DU LIVRE ─────────────────────────────────────────────────────
const propreTxt = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
export function descriptionDe(l) {
  const t = propreTxt(l && l.titre);
  const num = propreTxt(l && l.num);
  return [t, num ? `N° ${num}` : ''].filter(Boolean).join(' · ');
}
const provenanceDe = (l) => {
  if (!l) return '';
  if (l.plateforme === 'Vinted') return `Vinted${l.compte ? ` (compte ${propreTxt(l.compte)})` : ''}`;
  if (l.plateforme === 'Achat en gros') return 'Achat en gros';
  return propreTxt(l.fournisseur) ? `Hors plateforme · ${propreTxt(l.fournisseur)}` : 'Hors plateforme';
};
// Le vendeur CONNU : Vinted = le pseudo lu (pseudos : Map tx → pseudo ; null = pas lu) ;
// gros (ou hors rattaché) = le fournisseur qu'il a saisi ; sinon rien.
const vendeurDe = (l, pseudos) => {
  if (!l) return '';
  if (l.plateforme === 'Vinted') { const p = pseudos && pseudos.get ? pseudos.get(String(l.reference)) : ''; return p ? `${p} (pseudo Vinted)` : ''; }
  if (l.gros || l.rattache) return propreTxt(l.fournisseur);
  return '';
};

// ── LE LIVRE D'UNE PÉRIODE ─────────────────────────────────────────────────
// registre : la sortie de `registreDesAchats` pour CETTE période (null = pas su ⇒ null)
// etat     : `etatLu(...)` (null = pas su ou abîmé : les lignes sont « pas inscrites »)
// pseudos  : Map tx → pseudo (null = les transactions n'ont pas pu être lues)
// dansPeriode(ts) : la date d'achat d'une ligne inscrite DISPARUE tombe-t-elle dans la période ?
export function livreDePolice({ registre, etat, pseudos = null, dansPeriode = () => false } = {}) {
  if (!registre || !Array.isArray(registre.lignes)) return null;
  const o = (etat && etat.ordre) || {};
  const presents = new Set(registre.lignes.map((l) => l && l.id).filter(Boolean));
  const lignes = [];
  for (const l of registre.lignes) {
    if (!l) continue;
    const ins = o[l.id];
    const vendeur = vendeurDe(l, pseudos);
    lignes.push({
      id: l.id, n: ins ? ins.n : null, ts: l.ts, date: l.date || '',
      description: descriptionDe(l) || '', provenance: provenanceDe(l),
      montant: l.montant == null ? null : l.montant, source: l.source || '',
      reglement: propreTxt(l.reglement), vendeur, reference: propreTxt(l.reference),
      note: ins ? '' : 'pas encore inscrit',
    });
  }
  // Un achat inscrit qui n'est plus dans les achats (annulé, compte retiré) :
  // son numéro reste à lui, sa ligne aussi (rien ne disparaît d'un registre).
  for (const [id, e] of Object.entries(o)) {
    if (presents.has(id) || !e || !dansPeriode(e.ts)) continue;
    lignes.push({ id, n: e.n, ts: e.ts, date: '', description: propreTxt(e.t), provenance: '', montant: null, source: '', reglement: '', vendeur: '', reference: '', note: 'plus dans tes achats (annulé ?)', disparu: true });
  }
  lignes.sort((a, b) => (a.n == null) - (b.n == null) || (a.n || 0) - (b.n || 0) || (a.ts || 0) - (b.ts || 0) || String(a.id).localeCompare(String(b.id)));
  // Ce qui manque, compté par mention (jamais « conforme »).
  const manque = {
    ordre: lignes.filter((l) => l.n == null).length,
    description: lignes.filter((l) => !l.description).length,
    prix: lignes.filter((l) => l.montant == null || l.source === 'article').length,
    reglement: lignes.filter((l) => !l.reglement).length,
    vendeur: lignes.filter((l) => !l.vendeur).length,
    identite: lignes.length,   // aucune plateforme ne donne l'identité civile
  };
  const lus = [...(Array.isArray(registre.manque) ? registre.manque : []), ...(pseudos === null ? ['pseudos des vendeurs Vinted'] : [])];
  return { type: 'police', periode: registre.periode, lignes, n: lignes.length, manque, pasLu: lus, sansDate: (registre.horsPeriode || []).length, exclues: registre.exclues || 0 };
}

// Les mentions à compléter, en clair ([libellé, nombre de lignes]) — l'écran et l'export.
export function aCompleter(L) {
  if (!L) return [];
  const M = L.manque || {};
  const out = [];
  if (M.ordre) out.push(['Pas encore inscrits (sans n° d’ordre)', M.ordre]);
  if (M.identite) out.push(['Identité du vendeur (nom, prénoms, domicile, pièce d’identité)', M.identite]);
  if (M.vendeur) out.push(['Vendeur inconnu', M.vendeur]);
  if (M.prix) out.push(['Prix d’achat incomplet (sans port ni frais) ou absent', M.prix]);
  if (M.reglement) out.push(['Mode de règlement', M.reglement]);
  if (M.description) out.push(['Description', M.description]);
  return out;
}

// ── L'EXPORT (tableur et PDF, faits dans le navigateur) ─────────────────────
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const libellePeriodePolice = (p) => {
  const s = String(p || '');
  if (/^\d{4}$/.test(s)) return `année ${s}`;
  const t = /^(\d{4})-T([1-4])$/.exec(s);
  if (t) return `${t[2] === '1' ? '1er' : t[2] + 'e'} trimestre ${t[1]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : s;
};
export const titreLivre = (L) => `Livre de police — registre des objets mobiliers — ${libellePeriodePolice(L.periode)}`;
export const nomFichierLivre = (L, ext) => `Livre-de-police-${L.periode}.${ext}`;
const jourFr = (t) => { const d = new Date(t); return t == null || isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const eur = (x) => {
  if (x == null || !Number.isFinite(Number(x))) return '';
  const c = Math.round(Number(x) * 100), n = Math.abs(c);
  return (c < 0 ? '-' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0');
};
// Les avertissements écrits EN TÊTE de chaque export (jamais « conforme »).
export const AVERTISSEMENTS = Object.freeze([
  'Établi par VRM à partir de tes achats : à vérifier et à compléter.',
  'L’identité civile des vendeurs (nom, prénoms, domicile, pièce d’identité) n’est donnée par aucune plateforme : elle est à compléter.',
  'Un fichier exporté ne garantit pas l’intégrité des données exigée d’un registre tenu sur ordinateur (code pénal, art. R321-6).',
]);
export const COLONNES_POLICE = Object.freeze([
  ['n', 'N° d’ordre'], ['date', 'Date d’achat'], ['description', 'Nature et description'], ['provenance', 'Provenance'],
  ['prix', 'Prix d’achat (€)'], ['reglement', 'Règlement'], ['vendeur', 'Vendeur'], ['identite', 'Identité du vendeur'], ['note', 'Note'],
]);
const cellule = (l, k) => {
  if (k === 'n') return l.n == null ? '' : String(l.n);
  if (k === 'prix') return l.montant == null ? A_COMPLETER : eur(l.montant) + (l.source === 'article' ? ' (article seul)' : '');
  if (k === 'identite') return A_COMPLETER;
  if (k === 'vendeur' || k === 'reglement' || k === 'description') return l[k] || A_COMPLETER;
  return String(l[k] == null ? '' : l[k]);
};
export function enTeteLivre(L, { entreprise = null, maintenant = Date.now() } = {}) {
  const H = [titreLivre(L)];
  if (entreprise && entreprise.nom) H.push(entreprise.nom + (entreprise.siret ? ` · SIRET ${entreprise.siret}` : ''));
  H.push(`Établi le ${jourFr(maintenant)} · ${L.n} ligne${L.n > 1 ? 's' : ''}`);
  return H;
}
export function csvLivre(L, opts = {}) {
  const e = (v) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const R = [];
  for (const h of enTeteLivre(L, opts)) R.push([h]);
  for (const a of AVERTISSEMENTS) R.push([a]);
  const ac = aCompleter(L);
  if (ac.length) { R.push(['Mentions à compléter']); for (const [k, n] of ac) R.push([k, String(n)]); }
  if (L.pasLu.length) R.push(['Pas lu', L.pasLu.join(', ')]);
  R.push([]);
  R.push(COLONNES_POLICE.map((c) => c[1]));
  for (const l of L.lignes) R.push(COLONNES_POLICE.map(([k]) => cellule(l, k)));
  return '﻿' + R.map((r) => r.map(e).join(';')).join('\r\n') + '\r\n';
}

const A4P = [841.89, 595.28];
export async function pdfLivre(L, { PDFLib = null, entreprise = null, maintenant = Date.now() } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(titreLivre(L));
  if (entreprise && entreprise.nom) doc.setAuthor(entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88), AMBRE = rgb(0.62, 0.38, 0.02);
  const M = 30, [W, H] = A4P;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/[−—–]/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  let page = doc.addPage(A4P); let y = H - M;
  const txt = (s, x, yy, { font = f, t = 8, c = ENCRE, max = null } = {}) => { page.drawText(max ? borne(s, font, t, max) : propre(s), { x, y: yy, size: t, font, color: c }); };
  const LARG = { n: 40, date: 52, description: 170, provenance: 100, prix: 70, reglement: 72, vendeur: 92, identite: 70, note: 0 };
  const xs = []; let x = M;
  for (const [k] of COLONNES_POLICE) { xs.push(x); x += LARG[k]; }
  const largeur = (i) => (LARG[COLONNES_POLICE[i][0]] || (W - M - xs[i])) - 6;
  const tete = enTeteLivre(L, { entreprise, maintenant });
  txt(tete[0], M, y - 6, { font: fb, t: 14 }); y -= 22;
  for (const h of tete.slice(1)) { txt(h, M, y, { t: 9, c: GRIS }); y -= 12; }
  y -= 4;
  for (const a of AVERTISSEMENTS) { txt(a, M, y, { t: 8.5, c: AMBRE }); y -= 11; }
  const ac = aCompleter(L);
  if (ac.length) {
    y -= 4; txt('Mentions à compléter', M, y, { font: fb, t: 9 }); y -= 12;
    for (const [k, n] of ac) { txt(k, M, y, { t: 8.5 }); txt(String(n), M + 330, y, { t: 8.5, font: fb }); y -= 11; }
  }
  if (L.pasLu.length) { txt(`Pas lu : ${L.pasLu.join(', ')}`, M, y, { t: 8.5, c: GRIS }); y -= 11; }
  y -= 8;
  const entete = () => {
    COLONNES_POLICE.forEach(([, h], i) => txt(h, xs[i], y, { font: fb, t: 7.5, c: GRIS, max: largeur(i) }));
    y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 11;
  };
  entete();
  if (!L.lignes.length) { txt('Aucun achat sur la période.', M, y, { c: GRIS }); y -= 12; }
  for (const l of L.lignes) {
    if (y < M + 14) { page = doc.addPage(A4P); y = H - M; entete(); }
    COLONNES_POLICE.forEach(([k], i) => { const v = cellule(l, k); txt(v, xs[i], y, { t: 7.5, max: largeur(i), c: v === A_COMPLETER ? AMBRE : ENCRE }); });
    y -= 11;
  }
  return doc.save();
}

// ── LIRE ET ÉCRIRE LA LIGNE `vrm_livre_police` ─────────────────────────────
// La même forme que src/emailsLusEcriture.js : relire, appliquer, écrire en
// comparer-et-échanger sur `data.rev` ; trois essais. Une lecture ratée n'écrit
// RIEN (§5) ; un état abîmé n'écrit RIEN. Dépendances passées par l'appelant.
// La ligne reste légère (un numéro, une date et 80 caractères par achat).
const filtreProprio = (owner, cloisonne) => (cloisonne ? `&owner=eq.${encodeURIComponent(owner)}` : '');
// `null` = pas su · `{ existe, etat }` (etat null = abîmé).
export async function lireLivrePolice({ url, entetes, owner, cloisonne, fetcher = fetch }) {
  if (!owner) return null;
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${LIVRE_POLICE_ID}${filtreProprio(owner, cloisonne)}&select=id,data&limit=1`, { headers: entetes(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    if (!j[0]) return { existe: false, etat: etatVide() };
    return { existe: true, etat: etatLu(j[0].data) };
  } catch (_) { return null; }
}
// Rend { ok: true, etat, nouveaux } ou { ok: false, raison: 'pasLu' | 'abime' | 'conflit' | 'refus' }.
export async function inscrireEnBase(lignes, { url, entetes, avecOwner, owner, cloisonne, fetcher = fetch, maintenant = Date.now() }) {
  if (!owner) return { ok: false, raison: 'pasLu' };
  for (let essai = 0; essai < 3; essai++) {
    const lu = await lireLivrePolice({ url, entetes, owner, cloisonne, fetcher });
    if (!lu) return { ok: false, raison: 'pasLu' };
    if (!lu.etat) return { ok: false, raison: 'abime' };
    const neuf = inscrire(lu.etat, lignes, { maintenant });
    if (!neuf) return { ok: false, raison: 'abime' };
    const nouveaux = neuf.dernier - lu.etat.dernier;
    if (!nouveaux) return { ok: true, etat: lu.etat, nouveaux: 0 };
    const rev = lu.etat.rev;
    const data = { ...neuf, rev: (rev || 0) + 1 };
    try {
      if (!lu.existe) {
        const r = await fetcher(`${url}/rest/v1/app_data`, { method: 'POST', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify([avecOwner({ id: LIVRE_POLICE_ID, data })]) });
        if (r.ok) return { ok: true, etat: etatLu(data), nouveaux };
        if (r.status !== 409) return { ok: false, raison: 'refus' };
        continue;   // un autre appareil l'a créée : relire, rejouer
      }
      const garde = rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
      const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${LIVRE_POLICE_ID}${filtreProprio(owner, cloisonne)}&${garde}&select=id`, { method: 'PATCH', headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date(maintenant).toISOString() }) });
      if (!r.ok) return { ok: false, raison: 'refus' };
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length === 1) return { ok: true, etat: etatLu(data), nouveaux };
    } catch (_) { return { ok: false, raison: 'refus' }; }
  }
  return { ok: false, raison: 'conflit' };
}
