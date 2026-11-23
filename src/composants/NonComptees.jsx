// ══ LES VENTES NON COMPTÉES, GROUPÉES (16 nov., lot argent-mieux) ══════════════════════════════
// Julien (captures iPhone d'Argent) : un « mur » ambre — « 1 vente Vinted (deux prix chez Vinted
// (47,61 € et 46,80 €) : ouvre ton porte-monnaie…) · 1 vente Vinted (…) · … » répété des centaines de
// fois. La cause : chaque vente portait ses deux prix DANS sa raison, et les ventes se groupaient par
// raison. Désormais la raison est une phrase (src/vintedPro.js), les prix vivent à côté.
// Ici, LA FORME seulement (aucune règle neuve) : une ligne par site et par raison, le nombre, la
// somme « au moins » quand chaque vente du groupe la porte (le plus bas des deux prix lus — jamais un
// prix choisi pour le total, qui reste SANS ces ventes, §5), UN geste, et le détail par vente REPLIÉ
// (une liste : N° · date · les deux prix), jamais un paragraphe.
// Deux sources, les mêmes lignes que le total (§5) :
//   · `liste` : les ventes mises à part (`ventesDeclarables().ecartees`, `manque`) — avec le détail ;
//   · `par` / `parC` : la ligne PUBLIÉE (`vinted_urssaf_mois.nonComptees`) — les nombres seulement.
import React from 'react';
import { tr, localeCourante } from '../i18n/index.js';
import PourquoiReplie from './PourquoiReplie.jsx';
import { montant } from '../format.js';
import { RAISON_DEUX_PRIX, RAISON_DEUX_PRIX_RELEVE, RAISON_PRO_PAS_LU } from '../vintedPro.js';

// La raison (texte rangé) ⇒ un code stable (la clé de groupe et du texte traduit).
const CODES = { [RAISON_DEUX_PRIX]: 'deux-prix', [RAISON_DEUX_PRIX_RELEVE]: 'deux-prix-releve', [RAISON_PRO_PAS_LU]: 'pro-pas-lu',
  'prix pas lu': 'prix-pas-lu', 'prix inconnu': 'prix-pas-lu', 'montant pas sûr': 'montant-pas-sur', 'montant pas lu': 'montant-pas-lu',
  'montant reçu inconnu': 'montant-pas-lu', 'devise non dite': 'devise', 'autre devise': 'devise', 'autre devise que l’euro': 'devise',
  'frais eBay inconnus': 'frais-ebay', 'vente pas datée': 'pas-datee' };
// (avant le 16 nov.) une raison qui portait encore ses prix : « deux prix chez Vinted (… et …) … »
export const codeRaison = (r, code) => code || CODES[r] || (/^deux prix chez Vinted/.test(String(r || '')) ? (/relevé dit/.test(String(r)) ? 'deux-prix-releve' : 'deux-prix') : 'autre');
const GESTES = { 'deux-prix': 'nc.geste.deuxPrix', 'deux-prix-releve': 'nc.geste.deuxPrixReleve', 'pro-pas-lu': 'nc.geste.proPasLu', 'prix-pas-lu': 'nc.geste.prixPasLu',
  'montant-pas-sur': 'nc.geste.montant', 'montant-pas-lu': 'nc.geste.montant', 'frais-ebay': 'nc.geste.fraisEbay' };
const eur = (c) => montant(c / 100);
const dateCourte = (t) => (t ? new Date(t).toLocaleDateString(localeCourante(), { day: 'numeric', month: 'short' }) : '—');

// Les groupes, d'une source ou de l'autre. → [{ cle, plateforme, code, raison, n, c (centimes | null), ventes }]
export function groupesNonComptees({ liste = null, par = null, parC = null, det = null } = {}) {
  const g = new Map();
  if (Array.isArray(liste)) {
    for (const x of liste) {
      if (!x) continue;
      const code = codeRaison(x.raison, x.code), cle = `${x.plateforme}|${code}`;
      const e = g.get(cle) || { cle, plateforme: x.plateforme, code, raison: x.raison, n: 0, c: 0, ventes: [] };
      e.n += 1; e.c = e.c === null || !Number.isSafeInteger(x.auMoinsC) ? null : e.c + x.auMoinsC;
      e.ventes.push(x); g.set(cle, e);
    }
  } else if (par && typeof par === 'object') {
    for (const [k, n0] of Object.entries(par)) {
      const n = Number(n0) || 0; if (n <= 0) continue;
      const [pl, r] = k.split('|'); const code = codeRaison(r), cle = `${pl}|${code}`;
      const c0 = parC && Number.isSafeInteger(parC[k]) ? parC[k] : null;
      const e = g.get(cle) || { cle, plateforme: pl, code, raison: r, n: 0, c: 0, ventes: [] };
      e.n += n; e.c = e.c === null || c0 === null ? null : e.c + c0; g.set(cle, e);
    }
    // Le détail publié (`det`) : rangé dans SON groupe, par la même clé.
    for (const d of (Array.isArray(det) ? det : [])) {
      if (!d || !d.k) continue;
      const [pl, r] = String(d.k).split('|'); const e = g.get(`${pl}|${codeRaison(r)}`);
      if (e) e.ventes.push({ id: d.id, ts: d.t, itemId: d.it, deux: Number.isSafeInteger(d.l) && Number.isSafeInteger(d.a) ? { listeC: d.l, artC: d.a, releveC: Number.isSafeInteger(d.r) ? d.r : null } : null });
    }
  }
  return [...g.values()].sort((a, b) => b.n - a.n);
}

function numeroDe(itemId, fiches) {
  const f = itemId && fiches ? fiches[itemId] : null;
  const n = f && (f.numero || f.num);
  return n ? String(n) : '';
}

// La liste. `compact` : sans geste ni détail (une ligne d'un récapitulatif).
export default function NonComptees({ liste = null, par = null, parC = null, det = null, compact = false, className = '' }) {
  const G = groupesNonComptees({ liste, par, parC, det });
  if (!G.length) return null;
  let fiches = null;
  if (!compact && G.some((x) => x.ventes.length)) { try { fiches = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || 'null'); } catch (_) { fiches = null; } }
  const nTot = G.reduce((t, x) => t + x.n, 0);
  return (
    <div className={('vrm-nc ' + className).trim()} data-nc-liste={nTot}>
      <p className="vrm-nc-tete">{tr('nc.tete', { n: nTot })}</p>
      <ul className="vrm-nc-groupes">
        {G.map((x) => {
          const libKey = 'nc.lib.' + x.code;
          const lib = tr(libKey, { n: x.n, site: x.plateforme });
          const geste = GESTES[x.code] ? tr(GESTES[x.code]) : '';
          const avecDetail = !compact && x.ventes.length > 0 && x.ventes.some((v) => v.deux || v.titre || v.ts || v.tsVente);
          return (
            <li key={x.cle} className="vrm-nc-groupe" data-nc-groupe={x.cle} data-nc-n={x.n} data-nc-centimes={x.c == null ? '' : String(x.c)}>
              <div className="vrm-nc-ligne">
                <span className="vrm-nc-lib">{lib === libKey ? tr('nc.lib.autre', { n: x.n, site: x.plateforme, raison: x.raison }) : lib}</span>
                {x.c != null && x.c > 0 ? <span className="vrm-nc-eur">{tr('nc.auMoins', { x: eur(x.c) })}</span> : null}
              </div>
              {!compact && geste ? <p className="vrm-nc-geste">{geste}</p> : null}
              {!compact && (x.code === 'deux-prix' || x.code === 'deux-prix-releve') ? <PourquoiReplie label={tr('nc.pourquoi')}>{tr('nc.pourquoi.deuxPrix')}</PourquoiReplie> : null}
              {avecDetail ? (
                <details className="vrm-nc-detail" data-nc-detail="">
                  <summary>{tr('nc.voir', { n: x.ventes.length })}</summary>
                  <ol className="vrm-nc-ventes">
                    {x.ventes.map((v) => {
                      const num = numeroDe(v.itemId, fiches);
                      return (
                        <li key={v.id} className="vrm-nc-vente" data-nc-vente={v.id}>
                          <span className="vrm-nc-num">{num ? `N°${num}` : (v.titre || '—')}</span>
                          <span className="vrm-nc-date">{dateCourte(v.tsVente || v.ts)}</span>
                          <span className="vrm-nc-prix">{v.deux ? `${eur(v.deux.listeC)} / ${eur(v.deux.artC)}${v.deux.releveC != null ? ` · ${tr('nc.releve', { x: eur(v.deux.releveC) })}` : ''}` : '—'}</span>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
