// ── src/natif/ecrans/celluleAchat.jsx — l'ACHAT d'une vente, en UN toucher (20 nov., refait le 21 nov.) ─────────────────
// Julien (20 nov.) : « il y a la place pour mettre le bouton relier, fais un beau logo » ; (21 nov.) « on est obligé d'appuyer
// sur les points (⋯) pour remplir le prix d'achat ou relier un achat : améliore ça, pour eBay aussi ».
// Trois états, décidés par l'app (src/App.jsx), jamais ici :
//   · reliée à son achat (`relie`)            ⇒ « Acheté 30 € » (les maillons gris) ; le toucher montre l'achat ;
//   · prix d'achat connu, pas d'achat relié    ⇒ « Acheté 30 € » ; le toucher ouvre « Relier » sur CETTE vente ;
//   · rien de connu                            ⇒ DEUX gestes visibles : « Relier » (les maillons) et le champ « Prix d'achat ».
// Le champ écrit par `saisir(texte)` — le chemin de la saisie d'avant de CETTE vente (Vinted : `setSaleOverride` comme
// `CoutAchatVente` ; eBay : `vrm_ebay_couts` comme la ligne eBay ; Leboncoin / Vestiaire : le prix du N°), qui RELIT la valeur
// avant d'écrire et n'écrase jamais un prix connu (§2.5). Un montant illisible n'est jamais écrit : il est dit.
// Rien n'est relié tout seul (§5) : « Relier » ouvre la feuille de liaison, c'est SON toucher qui relie.
//
// `a` = { relie, prix (texte, '' = pas connu), ouvrir() | null, saisir(texte) → 'ok' | 'illisible' | 'vide' | 'refus' | null, titre }
//       ou null (rien à dire : la cellule dit « — »).
import React from 'react';
import { tr } from '../../i18n/index.js';
import { prixAchatSaisi } from '../../prixAuNumerotage.js';

// (23 nov., robot chaque-bouton) Le toucher et les touches restent dans la cellule (la rangée ne s'ouvre pas) — SAUF Échap :
// arrêté ici, il n'atteignait plus la coque, et « Relier un achat » (ouvert par ce bouton, le focus resté dessus) ne se
// fermait plus au clavier à l'ordinateur.
const stop = (e) => { if (e && e.key === 'Escape') return; e.stopPropagation(); };

function ChampPrix({ a, onPose, court = false, auto = false }) {
  const [txt, setTxt] = React.useState('');
  const [faux, setFaux] = React.useState(false);
  const fait = React.useRef(false);
  const valider = () => {
    if (fait.current) return;
    const t = txt.trim();
    if (!t) { setFaux(false); return; }
    const r = a.saisir(t);
    if (r === 'illisible') { setFaux(true); return; }
    if (r === 'ok') { fait.current = true; onPose(prixAchatSaisi(t) || t); }
    setTxt(''); setFaux(false);
  };
  const aide = faux ? tr('vt.prixIllisible') : '';
  return (
    <form className="n-vt-prix" data-vt-prix-achat="" data-vt-faux={faux ? '1' : undefined} onSubmit={(e) => { e.preventDefault(); valider(); }} onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <input className="n-vt-prix-champ" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={txt} placeholder={tr(court ? 'vt.prixPayeCourt' : 'vt.prixAchatChamp')}
        aria-label={tr('vt.prixAchatAria', { titre: a.titre || '' })} aria-invalid={faux ? 'true' : undefined} title={aide || undefined} autoFocus={auto || undefined}
        onChange={(e) => { setTxt(e.target.value); if (faux) setFaux(false); }} onBlur={valider}
        onKeyDown={(e) => { if (e.key === 'Escape') { setTxt(''); setFaux(false); e.currentTarget.blur(); } }} data-vt-prix-champ=""/>
      <span className="n-vt-prix-eur" aria-hidden="true">€</span>
      {faux ? <span className="n-vt-prix-aide" role="alert">{aide}</span> : null}
    </form>
  );
}

// Les gestes de l'achat (cellule « Achat » du tableau, pied de la rangée au téléphone).
export function GestesAchat({ a, Icon = null, court = false, replie = false, auto = false }) {   // `auto` (25 nov.) : le champ ouvert par un geste prend la main
  const [pose, setPose] = React.useState('');   // le prix qu'il vient de taper, montré tout de suite (la relecture suit)
  // (23 nov., style-clarte-5 — « l'icône lien + le champ Payé € sur chaque ligne alourdit ») Dans un tableau (`replie`), le champ
  // ne s'ouvre qu'au toucher d'un petit « + prix » ; le prix connu s'affiche tel quel. Même saisie, même relecture (§2.5).
  const [ouvert, setOuvert] = React.useState(false);
  if (!a) return null;
  const maillons = (n = 18) => (Icon ? <Icon name="relier" size={n}/> : null);
  const prix = a.prix || (pose ? pose.replace(/\s*€$/, '') + ' €' : '');
  if (a.relie || prix) {
    const nom = a.relie ? tr('vt.achatRelie', { prix: prix || '—' }) : tr('vt.achatConnuAria', { prix });
    const corps = <><span className="n-vt-relier-rond" aria-hidden="true">{maillons(16)}</span><span className="n-vt-relier-prix">{prix ? tr('vt.achatConnu', { prix }) : tr('vt.relierCourt')}</span></>;
    return (
      <span className="n-vt-achat" data-vt-achat={a.relie ? 'relie' : 'prix'}>
        {a.ouvrir ? <button type="button" className="n-vt-relier" data-n-famille="second" data-vt-relier={a.relie ? 'relie' : 'prix'} aria-label={nom} title={nom}
          onClick={(e) => { e.stopPropagation(); a.ouvrir(); }} onKeyDown={stop}>{corps}</button>
          : <span className="n-vt-relier" data-vt-relier={a.relie ? 'relie' : 'prix'}>{corps}</span>}
      </span>
    );
  }
  if (!a.ouvrir && !a.saisir) return null;
  return (
    <span className="n-vt-achat" data-vt-achat="libre">
      {a.ouvrir ? <button type="button" className="n-vt-relier" data-n-famille="second" data-vt-relier="libre" aria-label={tr('vt.relierAria', { titre: a.titre || '' })} title={tr('vt.relier')}
        onClick={(e) => { e.stopPropagation(); a.ouvrir(); }} onKeyDown={stop}>
        <span className="n-vt-relier-rond" aria-hidden="true">{maillons(16)}</span><span className="n-vt-relier-mot">{tr('vt.relierCourt')}</span>
      </button> : null}
      {a.saisir && (!replie || ouvert) ? <ChampPrix a={a} onPose={(x) => { setPose(x); setOuvert(false); }} court={court} auto={replie || auto}/> : null}
      {a.saisir && replie && !ouvert ? <button type="button" className="n-vt-plus-prix" data-n-famille="champ" data-vt-plus-prix="" aria-label={tr('vt.prixAchatAria', { titre: a.titre || '' })}
        onClick={(e) => { e.stopPropagation(); setOuvert(true); }} onKeyDown={stop}>{tr('vt.plusPrix')}</button> : null}
    </span>
  );
}

// La cellule « Achat » d'un tableau de Ventes (VentesBureau, VentesTableau).
export function celluleAchat(a, Icon) {
  if (!a) return null;
  return <GestesAchat a={a} Icon={Icon} court replie/>;
}
