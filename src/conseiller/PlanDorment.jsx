// ── src/conseiller/PlanDorment.jsx — « Plan du matin » : les paires qui dorment, UNE action chacune (24 nov.) ──
// docs/passation/2026-11-24-paires-dorment.md. Le plan arrive CALCULÉ (src/conseiller/planDorment.js, publié par Annonces) :
// ici seulement son texte (tr, 5 langues) et LE bouton de chaque paire. Rien ne part d'ici : le toucher appelle `onAgir`
// (src/conseiller/Branche.jsx), qui ouvre le chemin gardé existant (panneau de l'extension, compte de l'onglet, plafonds).
// Composants natifs, aucun style en ligne, aucune couleur en dur, aucun orange.
import React from 'react';
import { Groupe, Rangee, Bouton, Vignette, Plaque, BoutonIcone } from '../natif/index.js';
import { tr, monnaie, nombre } from '../i18n/index.js';

const eur = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : monnaie(Number(v), 'EUR'));
const ICONE = { baisser: 'tag', favoris: 'heart', republier: 'sync', prix: 'pencil', lbc: 'shop', vestiaire: 'shop', ebay: 'shop' };
const SITE = { lbc: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };

// Le verbe du bouton (≤ 4 mots).
export function texteAction(a) {
  if (!a) return '';
  if (a.k === 'baisser') return tr('cplan.aBaisser', { prix: eur(a.sugg) });
  if (a.k === 'lbc' || a.k === 'vestiaire' || a.k === 'ebay') return tr('cplan.aAilleurs', { site: SITE[a.k] });
  return tr('cplan.a.' + a.k);
}
// Pourquoi CETTE action (≤ 5 mots).
const raison = (a) => tr('cplan.r.' + ((a && a.pourquoi) || 'vues'));

function LignePlan({ l, onAgir, verdict, Icon, Photo }) {
  const a = l.action || {};
  const v = verdict ? verdict(l) : { ok: true };
  const bloque = a.bloque ? tr('cplan.bloqueExt') : (!v.ok ? (v.texte || tr('cplan.bloqueCompte')) : '');
  const vues = l.vues == null ? '—' : nombre(l.vues), fav = l.favoris == null ? '—' : nombre(l.favoris);
  return (
    <Rangee
      vignette={<Vignette taille={56} image={Photo && l.photo ? <Photo src={l.photo} alt="" width={56} height={56} loading="lazy" decoding="async"/> : null} src={Photo ? '' : l.photo}/>}
      plaque={l.numero ? <Plaque numero={l.numero}/> : null}
      titre={tr('cplan.depuis', { n: l.age, j: nombre(l.age) })}
      sousTitre={tr('cplan.chiffres', { vues, fav, nv: l.vues || 0, nf: l.favoris || 0 }) + ' · ' + raison(a)}
      lignes={1}
      attrs={{ 'data-plan-ligne': l.cle, 'data-plan-action': a.k, 'data-plan-sugg': a.sugg == null ? '' : String(a.sugg), 'data-plan-bloque': bloque ? '1' : '' }}
      pied={<div className="n-plan-pied">
        <Bouton variante="teinte" icone={Icon ? <Icon name={ICONE[a.k] || 'check'} size={18}/> : null} indisponible={!!bloque} raison={bloque}
          onClick={() => { if (!bloque && onAgir) onAgir(l); }} attrs={{ 'data-plan-bouton': l.cle }}>{texteAction(a)}</Bouton>
      </div>}/>
  );
}

// Le groupe du Conseiller. `plan` : la publication (src/conseiller/publications.js `CLE_PUB_PLAN`) ou null (rien publié).
export function PlanDuMatin({ plan, onAgir, verdict = null, Icon = null, Photo = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  const idPq = React.useId();
  if (!plan || typeof plan !== 'object') return null;
  const L = Array.isArray(plan.lignes) ? plan.lignes : [];
  const S = plan.seuils || {};
  const phrase = plan.etat === 'peu' ? tr('cplan.peu', { n: S.n || 0, min: S.min || 0 })
    : plan.etat !== 'su' ? tr('cplan.passu')
    : L.length ? tr('cplan.sous', { n: L.length }) : tr('cplan.rien');
  return (
    <Groupe titre={tr('cplan.entete')} attrs={{ 'data-cons-groupe': 'plan', 'data-plan-etat': plan.etat, 'data-plan-n': String(L.length), 'data-plan-seuils': JSON.stringify(S) }}
      action={<BoutonIcone libelle={ouvert ? tr('cons.replier') : tr('cons.btnPq')} icone={Icon ? <Icon name="info" size={20}/> : null} actif={ouvert} onClick={() => setOuvert((x) => !x)}
        attrs={{ 'aria-expanded': ouvert ? 'true' : 'false', 'aria-controls': idPq, 'data-plan-pourquoi': '' }}/>}>
      <p className="n-plan-phrase">{phrase}</p>
      {ouvert ? <div className="n-cons-explication n-plan-explication" id={idPq} data-plan-explication="">
        <div className="n-cons-textes">
          {plan.etat === 'su' ? <p>{tr('cplan.pq.seuil', { vues: nombre(S.vuesJour), fav: nombre(S.favorisJour), n: S.n })}</p> : null}
          <p>{tr('cplan.pq.age')}</p>
          <p>{tr('cplan.pq.actions')}</p>
          {plan.passu > 0 ? <p>{tr('cplan.pq.passu', { n: plan.passu })}</p> : null}
          <p>{tr('cplan.pq.effet')}</p>
        </div>
      </div> : null}
      {L.map((l) => <LignePlan key={l.cle} l={l} onAgir={onAgir} verdict={verdict} Icon={Icon} Photo={Photo}/>)}
    </Groupe>
  );
}
