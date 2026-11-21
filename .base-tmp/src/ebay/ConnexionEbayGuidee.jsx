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

export function ConnexionEbayGuidee({ C, busy, onConnecter, passu = false }) {
  return (
    <div data-ebay-connexion-guidee="" style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{tr('ebay.cx.titre')}</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {[1, 2, 3].map((n) => (
          <li key={n} data-ebay-cx-etape={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 14, background: `${C.accent}15`, color: C.accentTexte || C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{n}</span>
            <span style={{ fontSize: 15, color: C.text, lineHeight: 1.45, paddingTop: 4 }}>{tr(`ebay.cx.etape.${n}`)}</span>
          </li>
        ))}
      </ol>
      <div>
        <BoutonBase variante="primaire" occupe={busy} onClick={() => onConnecter(false)} data-ebay-connecter="">{tr(busy ? 'ebay.cx.ouverture' : 'ebay.cx.bouton')}</BoutonBase>
      </div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{tr('ebay.cx.plusieurs')}</div>
      {passu && <div data-ebay-cx-passu style={{ fontSize: 12, color: C.muted }}>{tr('ebay.cx.passu')}</div>}
    </div>
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
