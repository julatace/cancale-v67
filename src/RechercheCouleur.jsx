// ── CHERCHER PAR COULEUR — la feuille (14 nov., proposition 104) ───────────────────
// Ouverte depuis la loupe quand il tape une couleur (« bleu », « blue »…) : ses paires
// dont la PHOTO a cette couleur dominante (src/couleurPhoto.js, calculée sur l'appareil,
// gardée par identité de photo, src/indexCouleurs.js). Une rangée de pastilles pour
// changer de couleur. ⚠️ Une recherche, jamais une identité : rien n'est relié, rien
// n'est écrit ; SON toucher ouvre la fiche du N°. Chargée à la demande.
import React from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { FAMILLES, TEINTES, nomCouleur, photosDeCouleur } from './couleurPhoto.js';
import { mettreAJourCouleurs } from './indexCouleurs.js';
import './styles-atelier-photos.css';

export default function RechercheCouleur({ Feuille, Photo, Bouton, famille: initiale, lireEntrees, lireOctets, ouvrirNumero, onClose }) {
  const [famille, setFamille] = React.useState(FAMILLES.includes(initiale) ? initiale : 'bleu');
  const [entrees, setEntrees] = React.useState(undefined);   // undefined lecture · null pas su · []
  const [couleurs, setCouleurs] = React.useState(new Map());
  const [aLire, setALire] = React.useState(0);
  const [progres, setProgres] = React.useState(null);
  const [illisibles, setIllisibles] = React.useState(0);
  const vivant = React.useRef(true);
  React.useEffect(() => { vivant.current = true; return () => { vivant.current = false; }; }, []);
  React.useEffect(() => {
    let ok = true;
    Promise.resolve(lireEntrees()).then(async (r) => {
      if (!ok) return;
      if (!r || !Array.isArray(r.entrees)) { setEntrees(null); return; }
      const avec = r.entrees.filter((e) => e && e.src);
      setEntrees(avec);
      const g = await mettreAJourCouleurs(avec, { seulementGardees: true });
      if (ok) { setCouleurs(g.couleurs); setALire(g.aLire); }
    }).catch(() => { if (ok) setEntrees(null); });
    return () => { ok = false; };
  }, [lireEntrees]);
  const lire = async () => {
    if (!Array.isArray(entrees)) return;
    setProgres({ faits: 0, total: aLire });
    const g = await mettreAJourCouleurs(entrees, { lireOctets, surProgres: (p) => { if (vivant.current) setProgres(p); }, arrete: () => !vivant.current });
    if (!vivant.current) return;
    setCouleurs(g.couleurs); setALire(0); setIllisibles(g.illisibles.length); setProgres(null);
  };
  const l = langueCourante();
  const res = Array.isArray(entrees) ? photosDeCouleur(entrees.map((e) => ({ ...e, couleurs: couleurs.get(String(e.cle)) || null })), famille) : [];
  return (
    <Feuille onClose={onClose} titre={tr('atelier.couleur.titre')} data-recherche-couleur={famille}>
      <div className="vrm-atl-feuille">
        <div className="vrm-atl-nuancier" role="group" aria-label={tr('atelier.couleur.choisir')}>
          {FAMILLES.map((f) => (
            <button key={f} type="button" className="vrm-atl-teinte" aria-pressed={f === famille} data-couleur-famille={f} onClick={() => setFamille(f)}>
              <i style={{ background: TEINTES[f] }}/>{nomCouleur(f, l)}
            </button>
          ))}
        </div>
        {entrees === undefined ? <p className="vrm-atl-raison">{tr('atelier.photos.lecture')}</p> : null}
        {entrees === null ? <p className="vrm-atl-refus" role="alert" data-couleur-passu="">{tr('atelier.couleur.passu')}</p> : null}
        {Array.isArray(entrees) ? (
          <div className="vrm-atl-chiffre" data-couleur-resultats={res.length}>
            <b>{res.length}</b><span>{tr('atelier.couleur.nPhotos', { couleur: nomCouleur(famille, l), n: Array.isArray(entrees) ? entrees.length - aLire : 0 })}</span>
          </div>
        ) : null}
        {aLire > 0 ? (
          <div className="vrm-atl-carte" data-couleur-a-lire={aLire}>
            <div className="vrm-atl-rangee">
              <span className="vrm-atl-rangee-txt"><b>{tr('atelier.couleur.aLire', { n: aLire })}</b><small>{progres ? tr('atelier.couleur.progres', { faits: progres.faits, total: progres.total }) : tr('atelier.couleur.aLireSous')}</small></span>
              {!progres ? <span className="vrm-atl-gestes"><button type="button" className="vrm-atl-geste" data-couleur-lire="" onClick={lire}>{tr('atelier.couleur.lire')}</button></span> : null}
            </div>
          </div>
        ) : null}
        {illisibles ? <p className="vrm-atl-raison" data-couleur-illisibles={illisibles}>{tr('atelier.couleur.illisibles', { n: illisibles })}</p> : null}
        {res.length ? (
          <div className="vrm-atl-grille">
            {res.slice(0, 120).map((e) => (
              <button key={e.cle} type="button" className="vrm-atl-tuile" data-couleur-photo={e.cle} data-couleur-num={e.num || ''} data-couleur-part={e.part}
                aria-label={e.num ? tr('atelier.couleur.ouvrir', { num: e.num }) : (e.titre || tr('atelier.fusion.sansNum'))} onClick={() => { if (e.num) ouvrirNumero(e.num); }}>
                {Photo ? Photo(e.src) : null}
                <b>{e.num ? `N°${e.num}` : tr('atelier.fusion.sansNum')}</b>
              </button>
            ))}
          </div>
        ) : Array.isArray(entrees) && !aLire ? <p className="vrm-atl-vide" data-couleur-vide="">{tr('atelier.couleur.aucune', { couleur: nomCouleur(famille, l) })}</p> : null}
        <p className="vrm-atl-raison" style={{ margin: 0 }}>{tr('atelier.couleur.pourquoi')}</p>
      </div>
    </Feuille>
  );
}
