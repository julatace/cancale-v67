// ════════════════════════════════════════════════════════════════════════════
//  COLIS ET VENTES TOUT DE SUITE — LE RENDU DE L'INSTANTANÉ (9 nov., soir)
//  Les derniers chiffres et listes rendus sur CET appareil pour CE compte
//  (src/colisVentesInstantanes.js), posés dans la forme de l'écran vrai (mêmes
//  classes : la place ne bouge pas quand il les remplace), avec « Mis à jour il y a
//  N min » à la place de « Modifier ». INERTE : aucun geste n'en part — imprimer,
//  colis fait, retiré, scanner, envoyer disent « Vérification… ». Les attributs
//  de l'écran vrai qui portent un chiffre ou une identité (`data-fu-case`,
//  `data-carte-*`, `data-bord-card`, `data-tx-colis`, `data-toutes-id`,
//  `data-colis-onglet-n`…) ne sont PAS repris : `data-inst-*` seulement (seuls
//  quelques attributs de STYLE sans valeur sont repris : `data-ton`,
//  `data-toutes-prix`, `data-colis-dates`, `data-colis-limite-texte`, `data-colis-lignes`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ventesMontrable } from './colisVentesInstantanes.js';
import { useInerte, useMaintenant, MentionInstantane, CarteInstantanee } from './InstantaneCommun.jsx';
import './styles-colis-ventes-instantanes.css';
import MarquePlateforme from './plateformes/Marque.jsx';
import { LogoSite } from './SelecteurSites.jsx';

const NOMS_SITES = { toutes: 'Tous', vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
// (15 nov.) Les marques : src/plateformes/marques.js (une source), la même forme que le vrai sélecteur.

// Le filtre des sites, inerte, dans l'écran au téléphone. À l'ordinateur, l'écran vrai (monté,
// caché, pendant l'attente) a déjà posé le sien dans la barre du haut (`DansBarreHaut`) : rien ici.
function FiltreInstantane({ sites, ordi = false, cle }) {
  const ref = React.useRef(null);
  useInerte(ref);
  if (ordi || !sites || sites.length < 2) return null;
  const rangee = (
    <div ref={ref} className="vrm-rangee vrm-filtres vrm-filtre-site vrm-sel-sites vrm-ji" data-inst-filtre={cle} data-selecteur-logos="" data-n={sites.length} aria-hidden="true">
      {sites.map((s) => (
        <button key={s} type="button" tabIndex={-1} aria-pressed={s === 'toutes' ? 'true' : 'false'} data-site={s}>
          <span className="vrm-ss-in">
            {s === 'toutes'
              ? <><span className="vrm-ss-logo vrm-ss-tous" data-logo-site="toutes" aria-hidden="true"><i/><i/><i/><i/></span><span className="vrm-ss-nom">Tous</span></>
              : <span className="vrm-ss-logo" data-logo-site={s} aria-hidden="true"><MarquePlateforme site={s} taille={18}/></span>}
          </span>
        </button>
      ))}
    </div>
  );
  return rangee;
}

// (16 nov., lot ecrans-restes) L'instantané de COLIS est retiré : Colis vit dans Ventes « À expédier » depuis le
// lot DJ3 (11 nov.), plus rien ne le rangeait (`CaptureColis` retiré) et `ColisInstantane` n'était plus jamais
// montré — un instantané rangé avant le 11 nov. aurait pu l'être (§4.11 : code mort, retiré).

// ── VENTES ──────────────────────────────────────────────────────────────────
export function VentesInstantanee({ snap, maintenant = null, fmt = null, ordi = false, dateTete = '' }) {
  const ref = React.useRef(null);
  const now = useMaintenant(maintenant);
  useInerte(ref);
  const M = ventesMontrable(snap, now);
  if (!M) return null;
  return (
    <div ref={ref} className="vrm-ji vrm-inst" style={{ position: 'relative' }} data-inst-ecran="ventes" data-inst-t={String(M.t)} data-inst-age={String(Math.floor(M.age / 60000))} aria-busy="true">
      {/* La forme de `rendreTache('ventes')` (App.jsx) : tête, filtre, carte, « À venir », liste. */}
      <section className="vrm-tache" aria-label="Ventes — derniers chiffres connus">
        <header className="vrm-market-heading vrm-tache-tete">
          {dateTete ? <span className="vrm-fu-date-tete">{dateTete}</span> : null}
          <h1>Ventes</h1>
          {M.phrase ? <p className="vrm-phrase-ecran">{M.phrase}</p> : null}
        </header>
        {M.carte ? null : <MentionInstantane age={M.age} className="vrm-ji-age vrm-ji-age-seule" prefixe="data-inst"/>}
        <div className="vrm-tache-filtres" style={{ padding: '0 16px' }}>
          <FiltreInstantane sites={M.sites} ordi={ordi} cle="ventes"/>
        </div>
        {M.carte ? <div style={{ padding: '12px 16px 0' }}><CarteInstantanee carte={M.carte} age={M.age} fmt={fmt} maintenant={now}/></div> : null}
        {M.aVenir ? (
          <div className="vrm-a-venir-hote" style={{ padding: '12px 16px 0' }}>
            <section className="vrm-a-venir vrm-inst-a-venir" data-inst-a-venir="">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div className="vrm-inst-a-venir-titre">{M.aVenir.titre}</div>
                  {M.aVenir.lignes.map((l, i) => <div key={i} className="vrm-inst-a-venir-ligne">{l}</div>)}
                </div>
                <span className="vrm-display vrm-inst-a-venir-total" data-inst-a-venir-total="">{M.aVenir.total}</span>
              </div>
            </section>
          </div>
        ) : null}
        <div className="vrm-ventes-toutes" data-inst-ventes={String(M.lignes.length)} style={{ padding: '4px 16px 16px' }}>
          {M.replis.map((r, i) => (
            <div key={i} className="vrm-toutes-repli"><div className="vrm-toutes-repli-tete"><span className="vrm-toutes-repli-txt">{r}</span>{" "}<span className="vrm-toutes-repli-chevron" aria-hidden="true">›</span></div></div>
          ))}
          <div className="vrm-toutes-liste" role="list">
            {M.lignes.map((l, i) => (
              <div key={i} role="listitem" className="vrm-toutes-ligne vrm-inst-vente" data-inst-vente={l.site}>
                <span className="vrm-toutes-photo vrm-inst-photo" aria-hidden="true" style={{ width: 64, height: 80, flexShrink: 0, borderRadius: 12 }}/>
                <span className="vrm-toutes-titre" style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{l.num ? <span className="vrm-inst-num">N°{l.num} </span> : null}{l.titre}</span>
                  <span className="vrm-toutes-meta" style={{ display: 'block', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>{l.site && l.site !== 'toutes' ? <LogoSite site={l.site}/> : null}{l.siteNom || NOMS_SITES[l.site] || ''}</span>
                    {l.date ? <> · {l.date}</> : null}
                  </span>
                  {l.etat ? <span className="vrm-toutes-etat" data-ton={l.ton || undefined}>{l.etat}</span> : null}
                </span>
                <span className="vrm-toutes-bureau" aria-hidden="true">
                  <span><b className="vrm-toutes-bureau-site">{l.site && l.site !== 'toutes' ? <LogoSite site={l.site}/> : null}{l.siteNom || NOMS_SITES[l.site] || ''}</b></span>
                  <span>{l.date}</span>
                  <span data-ton={l.ton || undefined}>{l.etat}</span>
                </span>
                <span className="vrm-toutes-montant" style={{ flexShrink: 0, textAlign: 'right' }}><span data-toutes-prix="" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{l.prix}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
