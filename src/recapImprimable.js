// ═══════════════════════════════════════════════════════════════════════════
// « RÉCAP DE <MOIS> » EN UNE PAGE IMPRIMABLE (13 nov., point 16 de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Argent → Déclarer → « Récap de <mois> » → « Imprimer » : UNE page A4, ouverte
// dans la fenêtre d'impression du navigateur (imprimer, ou « Enregistrer en PDF »).
// Lisible en noir et blanc : encre, gris, filets ; aucune couleur, aucun fond.
//
// AUCUN CHIFFRE N'EST CALCULÉ ICI (§5 « une seule règle par notion ») : la page
// MET EN PAGE les données du « Rapport du mois » (`donneesRapportMois`,
// src/rapportMois.js), assemblées par l'écran avec les règles propriétaires —
//   · ventes, vendu      = `bilanLignes` sur `ventesFaites` (date de la VENTE) ;
//   · reçu               = la ligne publiée par Ventes, datée au VERSEMENT ;
//   · achats             = `registreDesAchats` du mois ;
//   · dépenses           = `comptaChargesMois` ;
//   · bénéfice           = `chiffreBenefice(beneficeDuMoisPub)` et sa couverture —
//                          JAMAIS « au moins » devant un bénéfice (un prix d'achat
//                          manquant le ferait BAISSER : src/beneficeNoms.js) ; pas
//                          su ⇒ « — », le brut au prix connu en note, le manque nommé ;
//   · URSSAF du mois     = `montantPeriodeUrssaf` / `aPayerUrssaf`, régime CHOISI ;
//   · par plateforme     = `margeParPlateforme` ; par compte = les lignes du vendu,
//                          groupées par le compte qu'elles PORTENT (les comptes
//                          écartés n'y sont jamais) ;
//   · la période URSSAF  = `nextUrssafDeadline` + `montantPeriodeUrssaf` + le registre
//                          (`moisDeclare`), passés tout faits (`periode`).
// « Pas su » s'écrit « — » (jamais 0) ; un minimum dit « au moins » ; ce qui
// manque est NOMMÉ ; jamais « encaissé ». Pur (aucune lecture, aucun DOM) :
// exécuté par scripts/audit-recap-imprimable.cjs, imprimé par le banc
// scripts/bancs/recap-imprimer.cjs (une page A4 au PDF de Chromium).
// ═══════════════════════════════════════════════════════════════════════════
import { eurosTexte } from './registres.js';

// Ce qui tient sur UNE page, quel que soit le mois : au-delà, la page le dit
// (« et N autres… ») et le Rapport du mois (PDF) les liste tous.
export const LIMITES = Object.freeze({ plateformes: 6, comptes: 8, manques: 7 });
export const titreRecapImprimable = (mois) => `Récap de ${mois}`;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
const cle = (d, k) => (d.cles || []).find((x) => x.cle === k) || { texte: '—', note: '' };

// Les lignes du haut : [clé, libellé, valeur écrite, note] — la même liste pour
// la page et pour l'audit.
export function lignesRecap(d) {
  const ventes = cle(d, 'ventes'), vendu = cle(d, 'vendu'), recu = cle(d, 'recu'), benef = cle(d, 'benefice');
  const a = d.achats || { etat: 'passu' };
  const achats = a.etat !== 'lu' ? { v: '—', n: 'pas pu être lus' }
    : { v: a.n === 0 ? eurosTexte(0) : `${a.complet ? '' : 'au moins '}${eurosTexte(a.total)}`, n: `${pl(a.n, 'achat')}${a.complet ? '' : ' · des montants pas lus'}` };
  return [
    ['ventes', 'Ventes du mois', ventes.texte, ventes.note || 'au jour de la vente'],
    ['vendu', 'Vendu', vendu.texte, vendu.note || ''],
    ['recu', 'Reçu', recu.texte, recu.note || 'au jour du versement'],
    ['achats', 'Achats', achats.v, achats.n],
    ['depenses', 'Dépenses', d.depenseTexte || '—', d.depense == null ? 'pas lues' : 'dépenses, abonnements et packs notés'],
    ['benefice', 'Bénéfice', benef.texte, benef.note || ''],
  ];
}

// Le bloc URSSAF : `null` = aucune section (régime pas choisi).
export function blocUrssaf(d, periode = null) {
  const u = d.urssaf;
  if (!u) return null;
  if (!u.micro) return { micro: false, regime: u.regimeTexte || '', raison: u.raison || 'Rien à déclarer à l’URSSAF pour ce statut.' };
  const am = u.partiel ? 'au moins ' : '';
  const lignes = [
    ['ca', `À déclarer — argent reçu en ${d.mois}`, u.ca == null ? '—' : am + eurosTexte(u.ca)],
    ['cotis', `Cotisations estimées (${String(u.taux).replace('.', ',')} %)`, u.apayer == null ? '—' : am + eurosTexte(u.apayer)],
  ];
  let note = 'Une estimation : vérifie sur autoentrepreneur.urssaf.fr.';
  if (!periode) note = 'Rythme de déclaration pas choisi : choisis-le dans Argent → Déclarer. ' + note;
  else if (periode.declaree) note = `Période ${periode.label} déjà notée « déclarée ». ` + note;
  else if (!periode.memeQueMois && periode.nDeclares > 0) note = `Période ${periode.label} : ${pl(periode.nDeclares, 'mois déjà noté', 'mois déjà notés')} « déclaré${periode.nDeclares > 1 ? 's' : ''} », le reste au plus tard le ${periode.date}. ` + note;
  else if (!periode.memeQueMois) {
    lignes.push(['periode', `Toute la période ${periode.label} (à déclarer au plus tard le ${periode.date})`, periode.ca == null ? '—' : (periode.partiel ? 'au moins ' : '') + eurosTexte(periode.ca)]);
  } else note = `À déclarer au plus tard le ${periode.date}. ` + note;
  return { micro: true, regime: u.regimeTexte || '', lignes, note };
}

// Les comptes : les LIMITES.comptes premiers, puis « et N autres » avec LEUR somme
// (les mêmes lignes, rien d'autre).
const comptesTenus = (comptes) => {
  if (!Array.isArray(comptes)) return null;
  const vus = comptes.slice(0, LIMITES.comptes), reste = comptes.slice(LIMITES.comptes);
  return { vus, reste: reste.length ? { n: reste.length, ventes: reste.reduce((s, c) => s + c.n, 0), eur: Math.round(reste.reduce((s, c) => s + Math.round(c.eur * 100), 0)) / 100 } : null };
};

// Ce qui manque AUX CHIFFRES DE CETTE PAGE : la liste du Rapport du mois, sans ce que la
// page n'imprime pas (catégories, stock, top 10) — rien n'est reformulé.
const HORS_PAGE = [/^Catégories\b/, /sans catégorie/, /du top 10/, /^Stock\b/];
export const manquesRecap = (d) => (Array.isArray(d && d.manques) ? d.manques : []).filter((m) => !HORS_PAGE.some((re) => re.test(String(m))));

export function pageRecapImprimable(d, { periode = null } = {}) {
  if (!d) return '';
  const titre = titreRecapImprimable(d.mois);
  const maj = d.mois.charAt(0).toUpperCase() + d.mois.slice(1);
  const L = lignesRecap(d);
  const U = blocUrssaf(d, periode);
  const plats = Array.isArray(d.plateformes) ? d.plateformes : null;
  const C = comptesTenus(d.comptes);
  const manques = manquesRecap(d);
  const ligne = ([k, lib, val, note]) => `<tr data-recap-l="${esc(k)}"><th scope="row">${esc(lib)}${note ? `<small>${esc(note)}</small>` : ''}</th><td>${esc(val)}</td></tr>`;
  const plat = (p) => p.etat !== 'lu'
    ? `<tr data-recap-plat="${esc(p.plat)}"><th scope="row">${esc(p.plat)}</th><td colspan="3" class="gris">${esc(p.raison || 'pas lu')}</td></tr>`
    : `<tr data-recap-plat="${esc(p.plat)}"><th scope="row">${esc(p.plat)}</th><td>${esc(pl(p.n, 'vente'))}</td><td>${esc(p.vendu == null ? '—' : (p.partiel ? 'au moins ' : '') + eurosTexte(p.vendu / 100))}</td><td>${esc(p.benef == null ? '—' : eurosTexte(p.benef / 100))}${p.nFin ? `<small>${esc(p.nConnu)}/${esc(p.nFin)} prix connus</small>` : ''}</td></tr>`;
  const plusPlats = plats && plats.length > LIMITES.plateformes ? plats.length - LIMITES.plateformes : 0;
  const plusManques = manques.length > LIMITES.manques ? manques.length - LIMITES.manques : 0;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page{size:A4 portrait;margin:14mm 14mm 12mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000}
body{font:10pt/1.35 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:economy;print-color-adjust:economy}
.page{max-width:182mm;margin:0 auto;padding:6mm 0}
@media print{.page{padding:0;max-width:none}}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5pt solid #000;padding-bottom:2.5mm;margin-bottom:2mm;gap:6mm}
h1{font-size:19pt;margin:0;letter-spacing:-0.2pt}
.sous{font-size:9pt;color:#333;margin-top:1mm}
.boutique{text-align:right;font-size:9pt;color:#333}
.boutique b{display:block;font-size:10.5pt;color:#000}
h2{font-size:10pt;margin:3.5mm 0 1mm;text-transform:uppercase;letter-spacing:0.6pt}
table{width:100%;border-collapse:collapse}
th,td{padding:0.9mm 0;border-bottom:0.5pt solid #999;vertical-align:top;text-align:left;font-weight:normal}
td{text-align:right;white-space:nowrap;padding-left:3mm}
th small,td small{display:block;font-size:7.6pt;color:#444;white-space:normal}
.chiffres th{font-weight:600}
.chiffres td{font-size:10.5pt;font-weight:700}
.chiffres tr[data-recap-l="benefice"] th,.chiffres tr[data-recap-l="benefice"] td{border-bottom:1.2pt solid #000}
.tab th{width:30%}
.tete th,.tete td{font-size:8pt;color:#444;border-bottom:0.8pt solid #000;padding-top:0}
.gris{color:#444;text-align:left;white-space:normal}
.deux{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
ul{margin:0;padding-left:4.5mm;font-size:8.4pt;columns:2;column-gap:8mm}
li{margin:0 0 0.8mm;break-inside:avoid}
footer{margin-top:3mm;padding-top:2mm;border-top:0.5pt solid #999;font-size:7.8pt;color:#444}
</style></head><body><div class="page" data-recap-imprimable="${esc(d.ym)}">
<header><div><h1>${esc(titre)}</h1><div class="sous">${esc(maj)}${d.enCours ? ` · mois en cours, arrêté au ${esc(d.etabliLe)}` : ' · du 1er au dernier jour du mois'}</div></div>
<div class="boutique">${d.boutique ? `<b>${esc(d.boutique.nom)}</b>${d.boutique.sous ? esc(d.boutique.sous) + '<br>' : ''}` : ''}Établi le ${esc(d.etabliLe)}</div></header>
<h2>Le mois</h2>
<table class="chiffres">${L.map(ligne).join('')}</table>
${U ? `<h2>URSSAF${U.regime ? ` · ${esc(U.regime)}` : ''}</h2>${U.micro ? `<table class="chiffres" data-recap-urssaf="micro">${U.lignes.map(([k, lib, v]) => ligne([k, lib, v, ''])).join('')}</table><p class="sous">${esc(U.note)}</p>` : `<p class="sous" data-recap-urssaf="hors">${esc(U.raison)}</p>`}` : ''}
<div class="deux">
<section><h2>Par plateforme</h2>${!plats ? '<p class="sous">Pas encore calculé : ouvre Ventes une fois.</p>' : !plats.length ? '<p class="sous">Aucune vente sur le mois.</p>'
  : `<table class="tab"><tr class="tete"><th>Site</th><td>Ventes</td><td>Vendu</td><td>Bénéfice</td></tr>${plats.slice(0, LIMITES.plateformes).map(plat).join('')}</table>${plusPlats ? `<p class="sous">et ${esc(pl(plusPlats, 'autre site', 'autres sites'))} (le Rapport du mois les détaille).</p>` : ''}`}</section>
<section><h2>Par compte</h2>${!C ? '<p class="sous">Ventes pas encore lues.</p>' : !C.vus.length ? '<p class="sous">Aucune vente sur le mois.</p>'
  : `<table class="tab"><tr class="tete"><th>Compte</th><td>Ventes</td><td>Vendu${d.venduPartiel ? ' (au moins)' : ''}</td></tr>${C.vus.map((c) => `<tr data-recap-compte="${esc(c.nom)}"><th scope="row">${esc(c.nom)}</th><td>${esc(c.n)}</td><td>${esc(eurosTexte(c.eur))}</td></tr>`).join('')}${C.reste ? `<tr data-recap-compte-reste="${C.reste.n}"><th scope="row">et ${esc(pl(C.reste.n, 'autre compte', 'autres comptes'))}</th><td>${esc(C.reste.ventes)}</td><td>${esc(eurosTexte(C.reste.eur))}</td></tr>` : ''}</table>`}</section>
</div>
<h2>Ce qui manque</h2>${manques.length ? `<ul data-recap-manques="${manques.length}">${manques.slice(0, LIMITES.manques).map((m) => `<li>${esc(m)}</li>`).join('')}${plusManques ? `<li>et ${esc(pl(plusManques, 'autre point', 'autres points'))} : le Rapport du mois (PDF) les liste tous.</li>` : ''}</ul>` : '<p class="sous" data-recap-manques="0">Rien : tous les chiffres de cette page sont complets.</p>'}
<footer>Vendu : au jour de la vente, toutes plateformes. Reçu et URSSAF : au jour où la plateforme a versé l’argent. Un tiret « — » veut dire « pas su », jamais zéro. « Au moins » : un minimum, ce qui manque est nommé ci-dessus. Établi par VRM d’après tes ventes lues.</footer>
</div></body></html>`;
}
