// ════════════════════════════════════════════════════════════════════════════
//  « COMPTE PRO » SUR LA CARTE D'UN COMPTE VINTED (Paramètres → Mes comptes)
// ════════════════════════════════════════════════════════════════════════════
// (11 nov., lot vinted-pro) Une phrase sous la pastille, et — pour un compte Pro —
// un repli « L'argent de tes ventes Pro » lu À L'OUVERTURE seulement (scalaires des
// transactions de CE compte + lignes de SON relevé). La règle : src/vintedPro.js.
// Les `data-vpro-*` sont ce que lisent les bancs (jamais un libellé, §6.4).
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { resumeArgentPro, SELECT_TXN_PRO, BAREME_VINTED_PRO } from './vintedPro.js';

const eur = (c) => monnaie(c / 100);

export function PhraseComptePro({ statut }) {
  if (!statut) return null;
  if (statut.etat === 'pro') return <p className="vrm-cl-pro" data-vpro-phrase="pro" data-vpro-source={statut.source}>{tr(statut.source === 'email' ? 'vpro.pro.email' : 'vpro.pro.profil')}</p>;
  if (statut.etat === 'passu') return <p className="vrm-cl-pro is-passu" data-vpro-phrase="passu">{tr('vpro.passu')}</p>;
  return null;
}

async function lireArgentPro(lireTout, uid) {
  const u = String(uid || '');
  if (!/^\d{1,20}$/.test(u)) return null;
  try {
    const [txns, releves] = await Promise.all([
      lireTout(`id=like.harvest_${u}_txn_*&select=${SELECT_TXN_PRO}`, { strict: true }),
      lireTout(`id=like.harvest_${u}_releve_*&select=id,l:data->lignes`, { strict: true }),
    ]);
    if (!Array.isArray(txns) || !Array.isArray(releves)) return null;
    const lignes = releves.flatMap((r) => (r && Array.isArray(r.l) ? r.l : []));
    return { resume: resumeArgentPro(txns, lignes), nReleves: releves.length };
  } catch (_) { return null; }
}

export function ArgentComptePro({ uid, lireTout }) {
  // undefined : pas encore ouvert · 'lecture' · null : pas su · objet lu
  const [lu, setLu] = React.useState(undefined);
  const lire = React.useCallback(() => { setLu('lecture'); lireArgentPro(lireTout, uid).then(setLu); }, [lireTout, uid]);
  const onToggle = (e) => { if (e.currentTarget.open && (lu === undefined || lu === null)) lire(); };
  const r = lu && typeof lu === 'object' ? lu.resume : null;
  return (
    <details className="vrm-cl-gerer vrm-vpro" data-vpro-argent={uid} onToggle={onToggle}>
      <summary>{tr('vpro.frais.titre')}</summary>
      <div className="vrm-vpro-corps" data-vpro-etat={lu === undefined ? '' : lu === 'lecture' ? 'lecture' : lu === null ? 'passu' : r && r.nCa ? 'lu' : 'vide'}>
        {lu === 'lecture' ? <p className="vrm-vpro-muet">{tr('vpro.frais.lecture')}</p> : null}
        {lu === null ? <p className="vrm-vpro-muet">{tr('vpro.frais.panne')} <button type="button" className="vrm-lien-action" onClick={lire}>{tr('vpro.frais.reessayer')}</button></p> : null}
        {r && !r.nCa ? <p className="vrm-vpro-muet">{tr('vpro.frais.aucune')}</p> : null}
        {r && r.nCa ? (
          <dl className="vrm-vpro-liste">
            <div data-vpro-ligne="ca" data-vpro-c={r.caC} data-vpro-n={r.nCa}>
              <dt>{tr('vpro.frais.ca')}</dt>
              <dd><b>{eur(r.caC)}</b><small>{tr('vpro.frais.surN', { n: r.nCa })}</small></dd>
            </div>
            <div data-vpro-ligne="protection" data-vpro-c={r.nProtection ? r.protectionC : ''} data-vpro-n={r.nProtection}>
              <dt>{tr('vpro.frais.protection')}</dt>
              <dd><b>{r.nProtection ? eur(r.protectionC) : '—'}</b><small>{tr('vpro.frais.protectionQui')}</small></dd>
            </div>
            <div data-vpro-ligne="commission" data-vpro-c={r.nCommission ? r.commissionC : ''} data-vpro-n={r.nCommission}>
              <dt>{tr('vpro.frais.commission')}</dt>
              <dd><b>{r.nCommission ? eur(r.commissionC) : '—'}</b><small>{r.nCommission ? tr('vpro.frais.surN', { n: r.nCommission }) : tr('vpro.frais.commissionPasLue')}</small></dd>
            </div>
            <div data-vpro-ligne="recu" data-vpro-c={r.nRecu ? r.recuC : ''} data-vpro-n={r.nRecu}>
              <dt>{tr('vpro.frais.recu')}</dt>
              <dd><b>{r.nRecu ? eur(r.recuC) : '—'}</b>{r.nRecu ? <small>{tr('vpro.frais.surN', { n: r.nRecu })}</small> : null}</dd>
            </div>
          </dl>
        ) : null}
        {r && r.ecartees ? <p className="vrm-vpro-muet" data-vpro-ecartees={r.ecartees}>{tr('vpro.frais.ecartees', { n: r.ecartees })}</p> : null}
        {r ? <p className="vrm-vpro-muet"><a href={BAREME_VINTED_PRO.sources[0]} target="_blank" rel="noreferrer" className="vrm-lien-action" data-vpro-bareme="">{tr('vpro.frais.bareme')}</a></p> : null}
      </div>
    </details>
  );
}
