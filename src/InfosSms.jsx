// ══════════════════════════════════════════════════════════════════════════════
// « REÇU PAR SMS » — Colis → À envoyer (Vestiaire) et À retirer (Pickup), 9 nov.
// Des informations SANS identité (src/infosSms.js) : dites, jamais comptées comme
// un colis, jamais rattachées seules. Aucun style ajouté (classes existantes).
// `lire(path)` → tableau | null ; `ecrireLiens(data)` → bool (ligne `vrm_sms_liens`).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lignesInfosSms } from './infosSms.js';

const jourFr = (j) => { const d = new Date(String(j).slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }) : ''; };
const aujourdhuiParis = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()); } catch (_) { return ''; } };

// Les lignes montrées pour une source (la règle de cet écran, une fois).
const lignesDe = (etat, source) => {
  let l = lignesInfosSms(etat.infos, { liens: etat.liens, ventes: etat.ventes, aujourdhui: aujourdhuiParis(), source });
  if (source === 'pickup') l = l.filter((x) => Date.parse(x.derniere || '') > Date.now() - 14 * 864e5).reverse();
  return l;
};

// `publier(cle, n)` (9 nov., lot AC) : « À trancher » (src/aTrancher.js) consomme CE compte —
// les ventes Vestiaire reçues par SMS pas reliées par son clic, les colis Pickup montrés.
// Une lecture ratée ne publie rien (pas su ≠ 0) ; les liens pas lus ⇒ Vestiaire pas publié.
export default function InfosSms({ onglet, lire, ecrireLiens, publier = null }) {
  const [etat, setEtat] = React.useState(undefined);   // undefined en cours · null pas su · { infos, liens, ventes }
  React.useEffect(() => {
    if (!etat || typeof publier !== 'function') return;
    if (etat.liensLus) publier('sms-vestiaire', lignesDe(etat, 'vestiaire').filter((x) => !x.lie).length);
    publier('sms-pickup', lignesDe(etat, 'pickup').length);
  }, [etat, publier]);
  const charger = React.useCallback(async () => {
    const [i, l, v] = await Promise.all([
      lire('id=eq.vrm_sms_infos&select=infos:data->infos'),
      lire('id=eq.vrm_sms_liens&select=liens:data->liens'),
      lire('id=eq.vc_ventes&select=ventes:data->ventes'),
    ]);
    if (!Array.isArray(i)) { setEtat(null); return; }
    const ventes = Array.isArray(v) && v[0] && v[0].ventes && typeof v[0].ventes === 'object'
      ? Object.values(v[0].ventes).filter((x) => x && x.aExpedier && x.productId).map((x) => ({ pid: String(x.productId), titre: x.titre || '' })) : [];
    setEtat({ infos: (i[0] && i[0].infos) || {}, liens: (Array.isArray(l) && l[0] && l[0].liens) || {}, liensLus: Array.isArray(l), ventes });
  }, [lire]);
  React.useEffect(() => { charger(); }, [charger]);
  if (!etat) return null;
  const source = onglet === 'envoyer' ? 'vestiaire' : onglet === 'retirer' ? 'pickup' : null;
  if (!source) return null;
  const lignes = lignesDe(etat, source);
  if (!lignes.length) return null;
  const relier = async (cle, pid) => {
    if (!etat.liensLus) return;                                  // une lecture ratée n'écrit rien
    const ok = await ecrireLiens({ liens: { ...etat.liens, [cle]: pid } });
    if (ok) charger();
  };
  return (
    <div className="vrm-colis-note" data-infos-sms={source} data-infos-sms-n={lignes.length}>
      {source === 'vestiaire'
        ? <p style={{ margin: '0 0 4px' }}>Reçu par SMS de Vestiaire (sans n° de commande : rien n'est relié tout seul)</p>
        : <p style={{ margin: '0 0 4px' }}>Reçu par SMS de Pickup (ni n° ni code : peut-être plusieurs fois le même colis)</p>}
      {lignes.map((x) => x.source === 'vestiaire' ? (
        <div key={x.cle} data-info-sms={x.cle} data-info-sms-a-verifier={x.aVerifier ? '1' : '0'} data-info-sms-lie={x.lie || ''}>
          {`Un article ${x.marque} vendu, à expédier avant le ${jourFr(x.jour)}`}
          {x.aVerifier ? ' · date passée : vérifie sur Vestiaire s\'il est parti' : ''}
          {x.lie ? ' · relié par toi à ta vente' : ''}
          {x.suggestion ? <> · c'est peut-être « {x.suggestion.titre} » <button type="button" className="vrm-lien-action" data-info-sms-relier={x.suggestion.pid} onClick={() => relier(x.cle, x.suggestion.pid)}>Oui, c'est elle</button></> : null}
        </div>
      ) : (
        <div key={x.cle} data-info-sms={x.cle}>
          {`Un colis ${x.plateforme ? x.plateforme.charAt(0) + x.plateforme.slice(1).toLowerCase() + ' ' : ''}au relais ${x.relais}`}
          {x.pass ? <> · <a className="vrm-lien-action" href={x.pass} target="_blank" rel="noopener noreferrer" data-info-sms-pass="">Présenter le Pass</a></> : null}
        </div>
      ))}
    </div>
  );
}
