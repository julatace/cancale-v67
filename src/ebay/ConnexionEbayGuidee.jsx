// ════════════════════════════════════════════════════════════════════════════
// LA CONNEXION À eBAY, GUIDÉE (11 nov., lot `ebay-complet`). Julien : « améliore
// la page de connexion du compte, absolument tout ».
//
//  • `ConnexionEbayGuidee` : avant la connexion, trois étapes dites AVANT (ce qui
//    va se passer chez eBay, qu'aucun mot de passe ne passe par VRM, ce que VRM
//    vérifie au retour), puis UN bouton.
//  • `RetourConnexionEbay` : au retour d'eBay, ce qui a été CONSTATÉ (le compte
//    relié, nommé par son pseudo) ou l'erreur TRADUITE avec son geste
//    (`raisonConnexion`) — jamais un code brut.
//  • `EtatJetonEbay` : chaque compte dit AVANT que son autorisation expire
//    (30 jours avant, `etatJeton` côté serveur), avec « Reconnecter » ; un
//    compte plus relié ou expiré le dit en ambre (un geste à faire, §7).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateI18n } from '../i18n/index.js';
import { BoutonBase } from '../composants/Bouton.jsx';
import { etatCompte, raisonConnexion } from './parametres.js';
import { TuileSite } from '../sites/SiteSoigne.jsx';

export function ConnexionEbayGuidee({ C, busy, onConnecter, passu = false }) {
  // (28 nov., sites soignés) La RÉFÉRENCE de qualité que Julien aime, posée sur les jetons natifs (src/sites/site-soigne.css) :
  // la tuile du logo, le titre, trois étapes dans des pastilles teintées, UN plein, une note courte. Les autres pages des
  // sites reprennent cette recette (`EtatSite`). Les attributs data-* lus par les bancs restent les mêmes.
  return (
    <section className="ss-etat" data-ss-site="ebay" data-ss-etat="connexion" data-ebay-connexion-guidee="">
      <TuileSite site="ebay" taille={44}/>
      <h3 className="ss-etat-titre">{tr('ebay.cx.titre')}</h3>
      <ol className="ss-etapes">
        {[1, 2, 3].map((n) => (
          <li key={n} className="ss-etape" data-ebay-cx-etape={n}>
            <span className="ss-etape-n" aria-hidden="true">{n}</span>
            <span className="ss-etape-texte">{tr(`ebay.cx.etape.${n}`)}</span>
          </li>
        ))}
      </ol>
      <div className="ss-etat-gestes">
        <BoutonBase variante="primaire" occupe={busy} onClick={() => onConnecter(false)} data-ebay-connecter="">{tr(busy ? 'ebay.cx.ouverture' : 'ebay.cx.bouton')}</BoutonBase>
      </div>
      <p className="ss-etat-note">{tr('ebay.cx.plusieurs')}</p>
      {passu && <p className="ss-etat-note" data-ebay-cx-passu>{tr('ebay.cx.passu')}</p>}
    </section>
  );
}

// `statut` / `raison` / `compte` / `nouveau` : lus dans l'adresse du retour.
export function RetourConnexionEbay({ C, statut, raison, compte, nouveau, onReessayer, onFermer }) {
  const code = raisonConnexion(statut, raison);
  const ok = code === 'connecte';
  return (
    <div role="status" data-ebay-retour={code} style={{ border: `1px solid ${ok ? C.border : C.warn}`, background: ok ? C.card : `${C.warn}10`, borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
        {ok ? tr(nouveau && compte ? 'ebay.cx.retour.ajoute' : compte ? 'ebay.cx.retour.relie' : 'ebay.cx.retour.relieSansNom', { compte: compte || '' }) : tr(`ebay.cx.err.${code}`)}
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{ok ? tr('ebay.cx.retour.verifie') : tr(`ebay.cx.err.${code}.geste`)}</div>
      {!ok && code === 'autre' && raison ? <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{tr('ebay.cx.err.detail', { detail: String(raison).slice(0, 120) })}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {!ok && code !== 'cles' && onReessayer && <BoutonBase variante="primaire" taille="petit" onClick={onReessayer} data-ebay-retour-reessayer>{tr('ebay.cx.reessayer')}</BoutonBase>}
        {onFermer && <BoutonBase taille="petit" onClick={onFermer} data-ebay-retour-fermer>{tr('ebay.guide.compris')}</BoutonBase>}
      </div>
    </div>
  );
}

export function EtatJetonEbay({ C, compte, onReconnecter, busy }) {
  const e = etatCompte(compte);
  const j = compte && compte.jeton;
  if (e === 'relie') return <span data-ebay-jeton="ok" style={{ fontSize: 11, color: C.muted }}>{tr('ebay.cx.jeton.ok', { date: dateI18n(j.expireLe) })}</span>;
  if (e === 'relie-sans-date') return <span data-ebay-jeton="sans-date" style={{ fontSize: 11, color: C.muted }}>{tr('ebay.cx.jeton.relie')}</span>;
  if (e === 'pas-su') return <span data-ebay-jeton="passu" style={{ fontSize: 11, color: C.muted }}>{tr('ebay.cx.jeton.passu')}</span>;
  const cle = e === 'bientot' ? 'ebay.cx.jeton.bientot' : e === 'expire' ? 'ebay.cx.jeton.expire' : 'ebay.cx.jeton.plusRelie';
  return (
    <span data-ebay-jeton={e} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: C.warn, fontWeight: 600 }}>{tr(cle, { n: j && j.joursRestants != null ? Math.max(0, j.joursRestants) : 0, date: j ? dateI18n(j.expireLe) : '' })}</span>
      {onReconnecter && <BoutonBase taille="petit" occupe={busy} onClick={onReconnecter} data-ebay-reconnecter="">{tr('ebay.cx.reconnecter')}</BoutonBase>}
    </span>
  );
}
