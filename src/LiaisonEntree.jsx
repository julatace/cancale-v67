// ── « RELIER MES ANNONCES » : L'ENTRÉE ET L'ÉTAT D'UN LIEN (19 nov.) ──────────────────────────────
// Ce que les autres écrans posent (une ligne, un état) — le parcours lui-même (src/LiaisonSites.jsx) et
// ses règles arrivent à la demande. UN compteur (« N annonces à relier », §7 : une source, lue partout)
// et l'état du lien d'UNE annonce (relié à N°… · à relier · à vérifier · que sur ce site).
//   <LigneLiaison site="Leboncoin"/>             la ligne d'entrée (rien quand il n'y a rien à faire)
//   <EtatLien site="eBay" id="12345"/>           l'état d'une annonce, qui ouvre le parcours sur elle
//   const res = useLiaison();  texteLiaison(res, site)  → { n, surs, nContra, titre, detail }
// Rien ici ne lit la base ni ne relie : tout vient de src/liaisonEtat.js.
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireLiaison, abonnerLiaison, demanderLiaison, ouvrirLiaison } from './liaisonEtat.js';
import './liaison-entree.css';

export function useLiaison(actif = true) {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerLiaison(maj), []);
  React.useEffect(() => { if (actif) demanderLiaison(); }, [actif]);
  return lireLiaison();
}
// Les mots du compteur (une source pour la ligne d'un site, Annonces → Outils, la carte du jour).
export function texteLiaison(res, site = null) {
  const lu = !!(res && res.lu);
  const file = lu ? res.file.filter((e) => !e.plusTard && (!site || e.annonce.plateforme === site)) : [];
  const n = file.length, surs = file.filter((e) => e.avant).length;
  const nContra = lu ? res.contradictions.filter((c) => !site || c.plateforme === site).length : 0;
  const sites = [...new Set(file.map((e) => e.annonce.plateforme))];
  return { n, surs, nContra, titre: tr('liaE.aRelier', { n }), detail: [surs ? tr('liaE.nSures', { n: surs }) : '', site ? '' : sites.join(' · ')].filter(Boolean).join(' · ') };
}

// La ligne d'entrée : « 8 annonces à relier › » et, s'il y en a, « 1 lien à vérifier › ». Rien sinon.
export function LigneLiaison({ site = null }) {
  useLangue();
  const res = useLiaison();
  const t = texteLiaison(res, site);
  if (!t.n && !t.nContra) return null;
  return (
    <div className="n-liae" data-liaison-entree={site || 'tous'} data-n={String(t.n)} data-contradictions={String(t.nContra)}>
      {t.n ? (
        <button type="button" className="n-liae-ligne" data-liaison-ouvrir={site || 'tous'} onClick={() => ouvrirLiaison({ site })}>
          <span className="n-liae-point" aria-hidden="true"/>
          <span className="n-liae-texte">{t.titre}</span>
          {t.surs ? <span className="n-liae-sous">{tr('liaE.nSures', { n: t.surs })}</span> : null}
          <span className="n-liae-chevron" aria-hidden="true">›</span>
        </button>
      ) : null}
      {t.nContra ? (
        <button type="button" className="n-liae-ligne" data-liaison-contradictions={site || 'tous'} onClick={() => ouvrirLiaison({ site, vue: 'contradictions' })}>
          <span className="n-liae-point" aria-hidden="true"/>
          <span className="n-liae-texte">{tr('liaE.aVerifierN', { n: t.nContra })}</span>
          <span className="n-liae-chevron" aria-hidden="true">›</span>
        </button>
      ) : null}
    </div>
  );
}

// L'état du lien d'UNE annonce (rangée d'un site, fiche) : il ouvre le parcours sur elle.
// « Pas su » (rien lu) ⇒ rien n'est affiché (jamais « à relier » par défaut).
export function EtatLien({ site, id, compact = false }) {
  useLangue();
  const res = useLiaison();
  const e = res && res.lu ? res.parCle.get(`${site}:${id}`) : null;
  if (!e) return null;
  const texte = e.etat === 'relie' ? tr('liaE.relie', { numero: e.numero })
    : e.etat === 'aVerifier' ? tr('liaE.aVerifier')
    : e.etat === 'propre' ? (e.numero ? tr('liaE.seuleNumero', { site, numero: e.numero }) : tr('liaE.seule', { site }))
    : tr('liaE.aRelierCourt');
  return (
    <button type="button" className={`n-liae-etat is-${e.etat}${compact ? ' is-compact' : ''}`} data-liaison-etat={e.etat} data-liaison-annonce={e.cle} data-numero={e.numero || ''}
      onClick={(ev) => { ev.stopPropagation(); ouvrirLiaison(e.etat === 'aVerifier' ? { site, vue: 'contradictions' } : { site, id }); }}>
      {e.etat === 'aRelier' || e.etat === 'aVerifier' ? <span className="n-liae-point" aria-hidden="true"/> : null}
      <span>{texte}</span>
    </button>
  );
}
