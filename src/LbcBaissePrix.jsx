// ── « BAISSER LE PRIX » SUR LEBONCOIN (11 nov., lot lbc-plus — extension 5.363) ──
// La porte (au-dessus de ses annonces Leboncoin) et la feuille : la MÊME feuille que
// Vinted (src/BaissePrixSerie.jsx), sur ses annonces Leboncoin EN VENTE. La liste
// PROPOSÉE vient des statistiques déjà relevées (src/lbcPlus.js : « 0 favori en 30
// jours » ⇒ cochée, −5 % proposé) ; il coche, change la baisse, voit l'aperçu, et
// c'est SON clic qui lance. Une commande par annonce (`lbcPrix`), compte de l'onglet
// seulement, prix lu avant (celui de l'aperçu, revérifié en base par l'extension) et
// RELU après (réponse de Leboncoin, sinon « Mes annonces » relue, `lbcRelire`).
// La forme de la requête s'APPREND sur son propre geste : tant que l'extension ne l'a
// pas vue, rien ne part et la feuille dit le geste.
import React from 'react';
import BaissePrixSerie from './BaissePrixSerie.jsx';
import { propositionsBaisse, JOURS_SANS_FAVORI, PCT_PROPOSE } from './lbcPlus.js';
import { idCompteLbcFlou } from './flouCompte.js';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { C, PhotoVinted, SUPABASE_URL, extSait, lireBaseRelue, useCompteLbcOuvert, vmrCmd, vmrExtPresent, vmrExtVersion, EXT_CAPACITES, enregistrerSoldeVrm, soldeOkVrm } from './App.jsx';

const URL_RECETTE = () => `${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_prix_recette&select=appris:data->appris,raison:data->>raison,at:data->>at`;

export function useRecettePrixLbc(cle) {
  const [r, setR] = React.useState(undefined);   // undefined en cours · null pas su · { appris, raison, at }
  React.useEffect(() => {
    let vivant = true;
    lireBaseRelue(URL_RECETTE()).then((rows) => { if (vivant) setR(Array.isArray(rows) ? (rows[0] || { appris: false, raison: '', at: '' }) : null); }).catch(() => { if (vivant) setR(null); });
    return () => { vivant = false; };
  }, [cle]);
  return r;
}

// Ce qui empêche d'envoyer (une phrase, le geste dedans) — '' si rien.
export function raisonPrixLbc({ present, sait, recette }) {
  if (!present) return tr('lbcplus.baisse.sansExt');
  if (sait !== 'ok') return tr('lbcplus.baisse.ext', { v: EXT_CAPACITES.lbcprix });
  if (recette === undefined) return tr('lbcplus.baisse.verif');
  if (recette === null) return tr('lbcplus.baisse.pasSu');
  if (recette.appris !== true) return recette.raison ? tr('lbcplus.baisse.pasRejouable', { raison: recette.raison }) : tr('lbcplus.baisse.apprendre');
  return '';
}

export default function LbcBaissePrix({ annonces = [], onFini }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState(false);
  const recette = useRecettePrixLbc(ouvert);   // relue à l'ouverture de la feuille
  const ouvertLbc = useCompteLbcOuvert();
  const prop = React.useMemo(() => propositionsBaisse(annonces), [annonces]);
  if (!annonces.length) return null;
  const extRaison = raisonPrixLbc({ present: vmrExtPresent(), sait: extSait('lbcprix'), recette });
  const lignes = prop.lignes.map((l) => ({ ...l, uid: idCompteLbcFlou(l.uid), propose: l.propose }));
  const compteOnglet = ouvertLbc === undefined ? undefined : (ouvertLbc ? idCompteLbcFlou(ouvertLbc) : null);
  const onBaisser = async (l) => {
    let r = null;
    try { r = await vmrCmd({ cmd: 'lbcPrix', id: String(l.id), prixAvant: Number(l.prix), prix: Number(l.nouveau), confirme: true }, 60000); } catch (_) { r = null; }
    if (r == null) return { sansReponse: true };
    return r;
  };
  const onRelire = async (envoyees) => {
    const depuis = Date.now() - 10 * 60000;
    let r = null;
    try { r = await vmrCmd({ cmd: 'lbcRelire', ids: envoyees.map((l) => String(l.id)) }, 90000); } catch (_) { r = null; }
    if (!r || !r.annonces) return null;
    const out = {};
    for (const l of envoyees) {
      const a = r.annonces[String(l.id)];
      const vu = a && Date.parse(a.seenAt || '');
      out[l.id] = a && Number.isFinite(vu) && vu >= depuis && a.prix != null ? Number(a.prix) : null;   // une lecture d'AVANT n'est pas une relecture
    }
    return out;
  };
  return (
    <>
      <div data-lbc-baisse-porte={prop.nProposees} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{tr('lbcplus.baisse.titre')}</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }} data-lbc-baisse-resume="">
            {prop.nProposees ? tr('lbcplus.baisse.proposees', { n: prop.nProposees, j: JOURS_SANS_FAVORI }) : tr('lbcplus.baisse.aucune', { j: JOURS_SANS_FAVORI })}
            {prop.nPasSu ? ` · ${tr('lbcplus.baisse.statsManquent', { n: prop.nPasSu })}` : ''}
          </div>
        </div>
        <button type="button" data-lbc-baisse-ouvrir="" onClick={() => setOuvert(true)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('lbcplus.baisse.ouvrir')}</button>
      </div>
      {ouvert ? <BaissePrixSerie site="leboncoin" modeDefaut="pct" texteDefaut={String(PCT_PROPOSE)} annonces={lignes} compteOnglet={compteOnglet}
        extRaison={extRaison} onBaisser={onBaisser} onRelire={onRelire} Photo={PhotoVinted}
        soldeOk={soldeOkVrm()} onSolde={enregistrerSoldeVrm}
        onFermer={() => setOuvert(false)} onFini={() => { if (onFini) onFini(); }}/> : null}
    </>
  );
}
export const versionExtPrixLbc = () => vmrExtVersion();
