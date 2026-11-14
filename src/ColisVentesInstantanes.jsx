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
import { colisMontrable, ventesMontrable } from './colisVentesInstantanes.js';
import { useInerte, useMaintenant, MentionInstantane, CarteInstantanee, GesteVerification } from './InstantaneCommun.jsx';
import { SqLignes } from './Squelette.jsx';
import './styles-colis-ventes-instantanes.css';

const NOMS_SITES = { toutes: 'Tous', vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const LOGO = (s) => (s === 'vinted' ? '/brands/vinted.svg' : s === 'leboncoin' ? '/brands/leboncoin.svg' : s === 'ebay' ? '/brands/ebay.svg' : s === 'vestiaire' ? '/brands/vestiaire.svg' : null);

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
              : <span className="vrm-ss-logo" data-logo-site={s} aria-hidden="true" style={LOGO(s) ? { '--vrm-ss-logo': `url("${LOGO(s)}")` } : undefined}/>}
          </span>
        </button>
      ))}
    </div>
  );
  return rangee;
}

// ── COLIS ───────────────────────────────────────────────────────────────────
export function ColisInstantane({ snap, maintenant = null, fmt = null, Icon = null, ordi = false, dateTete = '' }) {
  const ref = React.useRef(null);
  const now = useMaintenant(maintenant);
  useInerte(ref);
  const M = colisMontrable(snap, now);
  if (!M) return null;
  const largeurOk = typeof window !== 'undefined' && M.largeur && Math.abs((window.innerWidth || 0) - M.largeur) < 2;
  return (
    // Le cadre de l'écran vrai (la racine de `Comptabilite` : 16 px en haut).
    <div ref={ref} className="vrm-ji vrm-inst" style={{ padding: '16px 14px 40px', position: 'relative' }} data-inst-ecran="colis" data-inst-t={String(M.t)} data-inst-age={String(Math.floor(M.age / 60000))} data-inst-onglet={M.onglet} aria-busy="true">
      <div className="vrm-screen-head vrm-screen-head-doublon">
        <div className="vrm-tete-row">
          <div className="vrm-screen-head-titre a-repere">
            {Icon ? <span className="vrm-screen-repere" aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}><Icon name="box" size={20}/></span> : null}
            {dateTete ? <span className="vrm-fu-date-tete">{dateTete}</span> : null}
            <h1 className="vrm-display">Colis</h1>
            {M.phrase ? <p className="vrm-phrase-ecran">{M.phrase}</p> : null}
          </div>
          <div className="vrm-screen-actions" style={{ flexShrink: 0, maxWidth: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {/* Scanner, Tout imprimer, Outils : des gestes — gardés jusqu'à la relecture. */}
            <div className="vrm-colis-barre"><GesteVerification/></div>
          </div>
        </div>
      </div>
      {M.carte ? null : <MentionInstantane age={M.age} className="vrm-ji-age vrm-ji-age-seule" prefixe="data-inst"/>}
      {M.prochain ? (
        <div className="vrm-colis-prochain" data-inst-prochain={M.prochain.cle}>
          <span className="vrm-colis-prochain-txt">{M.prochain.texte}{M.prochain.sous ? <span className="vrm-colis-prochain-sous"> · {M.prochain.sous}</span> : null}</span>
          <GesteVerification/>
        </div>
      ) : null}
      <CarteInstantanee carte={M.carte} age={M.age} fmt={fmt} maintenant={now}/>
      <FiltreInstantane sites={M.sites} ordi={ordi} cle="colis"/>
      {M.onglets ? (
        <div className="vrm-colis-onglets" data-inst-onglets={M.onglet}>
          <div role="group" aria-label="Colis à envoyer, envoyés ou à retirer" className="vrm-seg vrm-seg-plein">
            {M.onglets.map((o) => (
              <button key={o.cle} type="button" tabIndex={-1} className="vrm-seg-btn" aria-pressed={o.cle === M.onglet ? 'true' : 'false'} data-inst-onglet-choix={o.cle} data-inst-onglet-n={o.n == null ? '' : String(o.n)}>
                {o.l}{o.n != null ? <span className="vrm-seg-n"> {o.n}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {M.liste ? (
        <>
          {largeurOk && M.ecart ? <div aria-hidden="true" style={{ height: M.ecart }}/> : null}
          <div className="vrm-colis-grille" data-colis-lignes="1" data-inst-liste={String(M.liste.filter((l) => l.g == null).length)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {M.liste.map((l, i) => (l.g != null ? (
              <div key={'g' + i} className="vrm-fu-groupe-transp" data-inst-groupe="">
                <span className="vrm-fu-groupe-tuile" aria-hidden="true">{Icon ? <Icon name="box" size={16}/> : null}</span><h3>{l.g}</h3><span>{l.n}</span>
              </div>
            ) : (
              <div key={'c' + i} className="vrm-colis-carte vrm-inst-carte" data-inst-colis={l.num || ''} style={{ padding: 14, borderRadius: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="vrm-colis-photo vrm-inst-photo" aria-hidden="true" style={{ width: 64, height: 80, borderRadius: 12, boxSizing: 'border-box', flexShrink: 0 }}/>
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span className="vrm-colis-titre" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                        {l.num ? <><span className="vrm-num vrm-num-petit vrm-colis-titre-num" role="img" aria-label={'Numéro ' + l.num}><span className="vrm-num-prefixe" aria-hidden="true">N°</span><span aria-hidden="true">{l.num}</span></span>{' '}</> : null}{l.titre}
                      </span>
                      <span className="vrm-display vrm-colis-prix" style={{ flexShrink: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.prix}</span>
                    </div>
                    {l.limite || l.attente ? (
                      <div style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span data-colis-dates="" style={{ flex: '0 1 auto', minWidth: 0 }}>{l.limite ? <span data-colis-limite-texte="" style={{ overflowWrap: 'anywhere', fontWeight: 400 }}>{l.limite}</span> : null}{l.attente ? <span>{l.attente}</span> : null}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="vrm-colis-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  <div className="vrm-rangee-bord">
                    {l.transp ? <span className="vrm-transporteur vrm-puce-transp"><span>{l.transp}</span></span> : null}
                    {/* Imprimer, Générer, Déposé, Suivre : gardés jusqu'à la relecture. */}
                    <GesteVerification/>
                  </div>
                </div>
              </div>
            )))}
          </div>
        </>
      ) : (
        // « Envoyés » et « À retirer » ne rangent aucune liste (suivis, points relais, codes) : leur place, en attente.
        <div className="vrm-inst-attente-liste" aria-hidden="true"><SqLignes n={Math.min(3, Math.max(1, (M.onglets && (M.onglets.find((o) => o.cle === M.onglet) || {}).n) || 1))} montant={false}/></div>
      )}
    </div>
  );
}

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
                    <span>{l.site && l.site !== 'toutes' ? <span className="vrm-logo-site" data-logo-site={l.site} aria-hidden="true" style={LOGO(l.site) ? { '--vrm-ss-logo': `url("${LOGO(l.site)}")` } : undefined}/> : null}{l.siteNom || NOMS_SITES[l.site] || ''}</span>
                    {l.date ? <> · {l.date}</> : null}
                  </span>
                  {l.etat ? <span className="vrm-toutes-etat" data-ton={l.ton || undefined}>{l.etat}</span> : null}
                </span>
                <span className="vrm-toutes-bureau" aria-hidden="true">
                  <span><b className="vrm-toutes-bureau-site">{l.site && l.site !== 'toutes' ? <span className="vrm-logo-site" data-logo-site={l.site} aria-hidden="true" style={LOGO(l.site) ? { '--vrm-ss-logo': `url("${LOGO(l.site)}")` } : undefined}/> : null}{l.siteNom || NOMS_SITES[l.site] || ''}</b></span>
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
