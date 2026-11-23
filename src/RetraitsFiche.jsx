// (21 nov., ext. 5.426 — « une paire vendue est retirée partout ») La fiche d'une paire : « Vendue sur X → retirée sur »,
// une ligne par AUTRE site, son état LU (src/retirerPartout.js `retraitsDuNumero` : la liste publiée par VRM, le registre
// de l'extension `vrm_retraits_partout`, les masquées Vinted `vinted_masquees_vrm`, le réglage par site). Lecture seule :
// rien ne part d'ici — les gestes sont dans le panneau de l'extension. Une lecture ratée ⇒ la section se tait (« pas su »).
import React from 'react';
import { tr } from './i18n/index.js';
import { retraitsDuNumero, RETIRER_CLE, RETRAITS_REGISTRE, RETIRER_REGLAGE_CLE } from './retirerPartout.js';

const NOM = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const FAITS = ['retiree', 'hors-ligne'];
const CLE_ETAT = { retiree: 'rp.e.retiree', 'hors-ligne': 'rp.e.horsLigne', attente: 'rp.e.attente', envoye: 'rp.e.envoye', incertain: 'rp.e.incertain', refuse: 'rp.e.refuse', 'pas-appris': 'rp.e.pasAppris', eteint: 'rp.e.eteint', 'a-faire': 'rp.e.aFaire', ebay: 'rp.e.ebay' };

// `lire(id)` → Promise<items | null> (la ligne projetée `items:data->items`) ; `charger(cle)` → la valeur synchronisée de `main`.
export default function RetraitsFiche({ num, lire, charger, logo = null }) {
  const [lu, setLu] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true;
    setLu(undefined);
    Promise.all([lire(RETRAITS_REGISTRE), lire('vinted_masquees_vrm')]).then(([registre, masquees]) => {
      if (!vivant) return;
      setLu(registre === null || masquees === null ? null : { registre: registre || {}, masquees: masquees || {} });
    }, () => { if (vivant) setLu(null); });
    return () => { vivant = false; };
  }, [num, lire]);
  if (!lu) return null;
  const ligne = retraitsDuNumero(num, { liste: charger(RETIRER_CLE), registre: lu.registre, masquees: lu.masquees, reglage: charger(RETIRER_REGLAGE_CLE) });
  if (!ligne || !ligne.sites.length) return null;
  const titre = tr('rp.titre', { site: ligne.venduSur || '—' });
  return (
    <section className="nf-section" aria-label={titre} data-fd-retraits={ligne.sites.length} data-fd-retraits-reste={ligne.sites.filter((s) => !FAITS.includes(s.etat)).length}>
      <h3 className="nf-section-titre">{titre}</h3>
      <dl className="nf-tableau" data-fd-retraits-liste="">
        {ligne.sites.map((s) => {
          const aFaire = !FAITS.includes(s.etat) && s.etat !== 'eteint' && s.etat !== 'ebay';
          return <div key={s.site + ':' + s.id} className="nf-ligne" data-fd-retrait={s.site} data-fd-retrait-etat={s.etat} data-fd-retrait-retard={s.retard ? '1' : undefined}>
            <dt className="nf-lib">{logo ? <span className="nf-logo" aria-hidden="true">{logo(s.site)}</span> : null}{NOM[s.site] || s.site}</dt>
            <dd className="nf-val"><span className="nf-etat-site" data-nf-ton={aFaire ? 'ambre' : FAITS.includes(s.etat) ? 'vendue' : 'enligne'}>{tr(CLE_ETAT[s.etat] || 'rp.e.attente')}{s.retard ? ' · ' + tr('rp.retard') : ''}</span></dd>
          </div>;
        })}
      </dl>
      <p className="nf-pied">{tr('rp.pied')}</p>
    </section>
  );
}
