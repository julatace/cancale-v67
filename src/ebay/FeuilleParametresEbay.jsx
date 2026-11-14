// ════════════════════════════════════════════════════════════════════════════
// « TOUS LES RÉGLAGES eBAY » (11 nov., lot `ebay-complet`). Une feuille, deux
// usages : `mode="annonce"` (cette annonce, depuis Vendre sur eBay) et
// `mode="defauts"` (Paramètres → Comptes eBay : ce que chaque nouvelle annonce
// reprend). Les règles vivent dans src/ebay/parametres.js (pures) ; ici, le
// dessin. Le serveur relit TOUT (api/_lib/ebay-parametres.js) : cette feuille
// n'est jamais la seule garde.
//
// Ce qui ne bouge pas (§2.8) : la livraison est GÉRÉE par eBay — l'acheteur paie
// le port, eBay fournit l'étiquette. La feuille le dit et n'offre aucun port,
// aucun transporteur, aucune « livraison gratuite ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonBase } from '../composants/Bouton.jsx';
import { DUREES_ENCHERE, DELAIS_ENVOI, JOURS_RETOUR, SOUS_TITRE_MAX, DEFAUTS_USINE, coutsOptions, tauxSponsorLu } from './parametres.js';

function Groupe({ id, C, children }) {
  return (
    <section data-ebay-param-groupe={id} style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted, margin: '0 0 8px' }}>{tr(`ebay.groupe.${id}`)}</h3>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}
function Ligne({ cle, C, children, aide = true, payant = false, attr = {} }) {
  return (
    <div data-ebay-param={cle} {...attr} style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, marginTop: -1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{tr(`ebay.param.${cle}`)}{payant ? <span data-ebay-param-payant style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 999, padding: '1px 7px' }}>{tr('ebay.param.payant')}</span> : null}</div>
          {aide ? <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{tr(`ebay.param.${cle}.aide`)}</div> : null}
        </div>
        <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>{children}</div>
      </div>
    </div>
  );
}
const Interrupteur = ({ on, onChange, label, C, disabled, attr = {} }) => (
  // La cible au doigt fait 44 px (§7) ; le dessin de l'interrupteur, 32.
  <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} {...attr}
    style={{ width: 56, height: 44, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, padding: 0, display: 'block' }}>
    <span aria-hidden="true" style={{ display: 'block', position: 'relative', width: 52, height: 32, margin: '0 auto', borderRadius: 16, background: on ? C.accent : (C.card2 || C.border) }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 26, height: 26, borderRadius: 13, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }}/>
    </span>
  </button>
);
function Choix({ valeur, options, onChange, C, label, attr = {} }) {
  return (
    <div role="group" aria-label={label} {...attr} style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 12, background: C.card2 || C.bg, flexWrap: 'wrap' }}>
      {options.map(([v, lib]) => (
        <button key={String(v)} type="button" aria-pressed={valeur === v} data-ebay-choix={String(v)} onClick={() => onChange(v)}
          style={{ minHeight: 44, minWidth: 44, border: 'none', borderRadius: 10, background: valeur === v ? C.card : 'transparent', boxShadow: valeur === v ? '0 1px 3px rgba(0,0,0,.12)' : 'none', color: C.text, fontSize: 15, fontWeight: valeur === v ? 600 : 500, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>{lib}</button>
      ))}
    </div>
  );
}

// `valeurs` : les réglages fusionnés (défauts + annonce). `compte` : la partie
// `compte` de l'action `parametres` (undefined en cours · null pas lue · objet).
// `typeCompte` : 'pro' | 'particulier' | '' (pas su).
export default function FeuilleParametresEbay({ Feuille, C, mode = 'annonce', valeurs, onChange, onClose, compte, typeCompte = '', devise = 'EUR', onProgrammer = null, onUsine = null }) {
  const v = valeurs || DEFAUTS_USINE;
  const set = (patch) => onChange({ ...v, ...patch });
  const inp = { boxSizing: 'border-box', border: `1px solid ${C.border}`, background: C.card2 || C.card, color: C.text, borderRadius: 12, padding: '9px 11px', fontSize: 17, fontFamily: 'inherit', outline: 'none', minHeight: 44 };
  const pro = typeCompte === 'pro';
  const enchere = v.format === 'enchere';
  const couts = coutsOptions(v);
  const pol = compte && typeof compte === 'object' ? compte : null;
  const selPol = (k) => {
    const l = pol ? pol[k] : undefined;
    if (compte === undefined) return <span style={{ fontSize: 13, color: C.muted }}>…</span>;
    if (!Array.isArray(l)) return <span data-ebay-pol-passu={k} style={{ fontSize: 13, color: C.muted }}>{tr('ebay.param.politiques.passu')}</span>;
    if (!l.length) return <span data-ebay-pol-vide={k} style={{ fontSize: 13, color: C.muted }}>{tr('ebay.param.politiques.aucune')}</span>;
    return (
      <select aria-label={tr(`ebay.param.politique.${k}`)} data-ebay-pol={k} value={(v.politiques || {})[k] || ''} onChange={(e) => set({ politiques: { ...(v.politiques || {}), [k]: e.target.value } })} style={{ ...inp, maxWidth: 230 }}>
        <option value="">{tr('ebay.param.politiques.celleDeLAnnonce')}</option>
        {l.map((p) => <option key={p.id} value={p.id}>{p.nom || p.id}</option>)}
      </select>
    );
  };
  return (
    <Feuille onClose={onClose} titre={tr(mode === 'defauts' ? 'ebay.param.titreDefauts' : 'ebay.param.titre')} sousTitre={tr(mode === 'defauts' ? 'ebay.param.sousTitreDefauts' : 'ebay.param.sousTitreFeuille')} data-ebay-parametres={mode} maxWidth={560}>
      <Groupe id="vente" C={C}>
        <Ligne cle="format" C={C}>
          <Choix C={C} label={tr('ebay.param.format')} valeur={v.format} onChange={(x) => set({ format: x })} options={[['fixe', tr('ebay.param.format.fixe')], ['enchere', tr('ebay.param.format.enchere')]]} attr={{ 'data-ebay-format': v.format }}/>
        </Ligne>
        {enchere && (<>
          <Ligne cle="dureeJours" C={C} aide={false}>
            <select aria-label={tr('ebay.param.dureeJours')} data-ebay-duree value={v.dureeJours} onChange={(e) => set({ dureeJours: Number(e.target.value) })} style={inp}>
              {DUREES_ENCHERE.map((d) => <option key={d} value={d}>{tr('ebay.param.jours', { n: d })}</option>)}
            </select>
          </Ligne>
          {mode === 'annonce' && <Ligne cle="achatImmediat" C={C}>
            <input aria-label={tr('ebay.param.achatImmediat')} inputMode="decimal" value={v.achatImmediat || ''} onChange={(e) => set({ achatImmediat: e.target.value })} placeholder={devise} style={{ ...inp, width: 120 }}/>
          </Ligne>}
          {mode === 'annonce' && <Ligne cle="prixReserve" C={C} payant>
            <input aria-label={tr('ebay.param.prixReserve')} inputMode="decimal" value={v.prixReserve || ''} onChange={(e) => set({ prixReserve: e.target.value })} placeholder={devise} style={{ ...inp, width: 120 }}/>
          </Ligne>}
        </>)}
        {!enchere && <Ligne cle="offres" C={C}>
          <Interrupteur C={C} on={v.offres} onChange={(x) => set({ offres: x })} label={tr('ebay.param.offres')} attr={{ 'data-ebay-offres': v.offres ? 'oui' : 'non' }}/>
        </Ligne>}
      </Groupe>

      <Groupe id="envoi" C={C}>
        <Ligne cle="livraison" C={C} attr={{ 'data-ebay-livraison': 'geree' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('ebay.param.livraison.geree')}</span>
        </Ligne>
        <Ligne cle="delaiEnvoi" C={C}>
          <select aria-label={tr('ebay.param.delaiEnvoi')} data-ebay-delai value={v.delaiEnvoi} onChange={(e) => set({ delaiEnvoi: Number(e.target.value) })} style={inp}>
            {DELAIS_ENVOI.map((d) => <option key={d} value={d}>{d === 0 ? tr('ebay.param.delai.jour') : tr('ebay.param.jours', { n: d })}</option>)}
          </select>
        </Ligne>
        <Ligne cle="lieu" C={C}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input aria-label={tr('ebay.param.lieu.ville')} value={v.lieu || ''} onChange={(e) => set({ lieu: e.target.value.slice(0, 45) })} placeholder={tr('ebay.param.lieu.ville')} style={{ ...inp, width: 150 }}/>
            <input aria-label={tr('ebay.param.lieu.cp')} value={v.codePostal || ''} onChange={(e) => set({ codePostal: e.target.value.slice(0, 12) })} placeholder={tr('ebay.param.lieu.cp')} inputMode="numeric" style={{ ...inp, width: 130 }}/>
          </div>
        </Ligne>
      </Groupe>

      <Groupe id="retours" C={C}>
        <Ligne cle="retours" C={C} attr={{ 'data-ebay-retours': v.retours && v.retours.acceptes === false ? 'non' : 'oui' }}>
          <Interrupteur C={C} on={!(v.retours && v.retours.acceptes === false)} disabled={pro && !(v.retours && v.retours.acceptes === false)} onChange={(x) => set({ retours: { ...(v.retours || DEFAUTS_USINE.retours), acceptes: x } })} label={tr('ebay.param.retours')}/>
        </Ligne>
        {pro && <div data-ebay-retours-pro style={{ padding: '0 14px 10px', fontSize: 12, color: C.muted }}>{tr('ebay.param.retours.pro')}</div>}
        {!(v.retours && v.retours.acceptes === false) && (<>
          <Ligne cle="retours.jours" C={C} aide={false}>
            <Choix C={C} label={tr('ebay.param.retours.jours')} valeur={(v.retours || {}).jours} onChange={(x) => set({ retours: { ...(v.retours || DEFAUTS_USINE.retours), jours: x } })} options={JOURS_RETOUR.map((j) => [j, tr('ebay.param.jours', { n: j })])}/>
          </Ligne>
          <Ligne cle="retours.payePar" C={C} aide={false}>
            <Choix C={C} label={tr('ebay.param.retours.payePar')} valeur={(v.retours || {}).payePar} onChange={(x) => set({ retours: { ...(v.retours || DEFAUTS_USINE.retours), payePar: x } })} options={[['Buyer', tr('ebay.param.retours.acheteur')], ['Seller', tr('ebay.param.retours.moi')]]}/>
          </Ligne>
        </>)}
      </Groupe>

      <Groupe id="compte" C={C}>
        <Ligne cle="politiques" C={C} attr={{ 'data-ebay-politiques': compte === undefined ? 'charge' : !pol ? 'passu' : pol.politiquesActivees === true ? 'oui' : pol.politiquesActivees === false ? 'non' : 'passu' }}>
          {pol && pol.politiquesActivees === false ? <span style={{ fontSize: 13, color: C.muted }}>{tr('ebay.param.politiques.non')}</span> : null}
        </Ligne>
        {pol && pol.politiquesActivees !== false && (<>
          <Ligne cle="politique.paiement" C={C} aide={false}>{selPol('paiement')}</Ligne>
          <Ligne cle="politique.retour" C={C} aide={false}>{selPol('retour')}</Ligne>
        </>)}
        {pro ? (
          <Ligne cle="tva" C={C}>
            <input aria-label={tr('ebay.param.tva')} data-ebay-tva inputMode="decimal" value={v.tva || ''} onChange={(e) => set({ tva: e.target.value })} placeholder="%" style={{ ...inp, width: 90 }}/>
          </Ligne>
        ) : null}
      </Groupe>

      <Groupe id="visibilite" C={C}>
        <Ligne cle="programmation" C={C}>
          {mode === 'annonce' && onProgrammer ? <BoutonBase taille="petit" onClick={onProgrammer} data-ebay-programmer>{tr('ebay.param.programmation.ouvrir')}</BoutonBase> : null}
        </Ligne>
        {!enchere && <Ligne cle="sponsorisee" C={C} payant attr={{ 'data-ebay-sponsor': v.sponsorisee ? 'oui' : 'non' }}>
          <Interrupteur C={C} on={v.sponsorisee} onChange={(x) => set({ sponsorisee: x })} label={tr('ebay.param.sponsorisee')}/>
        </Ligne>}
        {!enchere && v.sponsorisee && (
          <div style={{ padding: '0 14px 12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: C.text }}>
              {tr('ebay.param.sponsorisee.taux')}
              <input aria-label={tr('ebay.param.sponsorisee.taux')} data-ebay-sponsor-taux inputMode="decimal" value={String(v.tauxSponsor == null ? '' : v.tauxSponsor)} onChange={(e) => set({ tauxSponsor: e.target.value })} style={{ ...inp, width: 80 }}/>%
            </label>
            <div data-ebay-sponsor-cout style={{ fontSize: 12, color: tauxSponsorLu(v.tauxSponsor) ? C.muted : C.warn, marginTop: 6, lineHeight: 1.4 }}>{tauxSponsorLu(v.tauxSponsor) ? tr('ebay.param.sponsorisee.cout', { n: tauxSponsorLu(v.tauxSponsor) }) : tr('ebay.param.sponsorisee.borne')}</div>
          </div>
        )}
        {mode === 'annonce' && <Ligne cle="sousTitre" C={C} payant>
          <input aria-label={tr('ebay.param.sousTitre')} value={v.sousTitre || ''} maxLength={SOUS_TITRE_MAX} onChange={(e) => set({ sousTitre: e.target.value })} style={{ ...inp, width: 220, maxWidth: '100%' }}/>
        </Ligne>}
        {mode === 'annonce' && <Ligne cle="categorie2" C={C} payant>
          <input aria-label={tr('ebay.param.categorie2')} inputMode="numeric" value={v.categorie2 || ''} onChange={(e) => set({ categorie2: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="15709" style={{ ...inp, width: 110 }}/>
        </Ligne>}
        <Ligne cle="privee" C={C}>
          <Interrupteur C={C} on={v.privee} onChange={(x) => set({ privee: x })} label={tr('ebay.param.privee')}/>
        </Ligne>
      </Groupe>

      {couts.length > 0 && (
        <p data-ebay-couts={couts.map((c) => c.cle).join(',')} style={{ fontSize: 13, color: C.text, margin: '14px 2px 0', lineHeight: 1.45 }}>
          {tr('ebay.param.couts', { liste: couts.map((c) => tr(`ebay.param.${c.cle}`)).join(', ') })}
        </p>
      )}
      <div className="vrm-fs-pied" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        {onUsine && <BoutonBase onClick={onUsine} data-ebay-param-usine>{tr('ebay.param.usine')}</BoutonBase>}
        <BoutonBase variante="primaire" onClick={onClose} data-ebay-param-fini>{tr('ebay.param.fini')}</BoutonBase>
      </div>
    </Feuille>
  );
}
