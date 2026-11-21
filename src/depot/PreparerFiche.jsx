// ── PRÉPARER UNE FICHE À L'AVANCE (21 nov., ext. 5.429 — points 61 à 63) ─────────────────────────────────────────────
// « À publier » → « Préparer » : photos (l'étoile = la couverture, l'ordre au glisser), titre, modèle, marque, taille,
// état, couleurs, colis, catégorie, prix, description (le modèle type le plus précis proposé, modifiable, aperçu).
// « Enregistrer » range la fiche (`vrm_fiches_neuves[id]` + `depot` : photos, couverture, modèle, préparée le) ; le
// lendemain, « Déposer N sur Vinted » se fait dans le panneau de l'extension (rien ne part d'ici).
// ⚠️ Rien n'est deviné : la description proposée ne remplace JAMAIS un texte qu'il a écrit (seulement un champ vide, ou
// sur SON toucher « Utiliser ce modèle ») ; une variable sans valeur reste écrite « {taille} » et est nommée.
// Règles : src/depot/regles.js. Composants natifs ; tout texte par tr().
import React from 'react';
import { Feuille, Groupe, Rangee, Bouton, ListeOrdonnee, Champ } from '../natif/index.js';
import { tr } from '../i18n/index.js';
import { ETATS_DEPOT, COLIS_DEPOT, CHAMPS_DEPOT, manquesDepot, ordrePhotos, descriptionProposee, couleursDe } from './regles.js';
import './preparer.css';

const COULEURS_VINTED = ['Noir', 'Blanc', 'Gris', 'Gris clair', 'Gris foncé', 'Beige', 'Crème', 'Marron', 'Bleu', 'Bleu clair', 'Marine', 'Rouge', 'Bordeaux', 'Vert', 'Kaki', 'Jaune', 'Moutarde', 'Rose', 'Orange', 'Violet', 'Lila', 'Turquoise', 'Argenté', 'Doré', 'Multicolore'];
const nomChamp = (k) => tr('depot.m.' + k);
const libChamp = (k) => tr('depot.l.' + k);

// `fiche` : la fiche « À publier » ; `lireStudio()` ⇒ { photos:[{id,img}] } | null ; `modeles` : vrm_modeles_desc ;
// `onEnregistrer(fiche)` : l'écriture (App.jsx) ; `onFermer`.
export default function PreparerFiche({ fiche, lireStudio, modeles = [], onEnregistrer, onFermer, ouvrirStudio = null }) {
  const f0 = fiche || {};
  const d0 = f0.depot || {};
  const [v, setV] = React.useState(() => ({ titre: f0.titre || '', modele: f0.modele || '', marque: f0.marque || '', taille: f0.taille || '', etat: f0.etat || '',
    couleur: couleursDe(f0)[0] || '', couleur2: couleursDe(f0)[1] || '', colis: f0.colis || '', categorie: f0.categorie || '', prix: f0.prix != null ? String(f0.prix).replace('.', ',') : '', description: f0.description || '' }));
  const [studio, setStudio] = React.useState(undefined);
  const [ordre, setOrdre] = React.useState(() => (Array.isArray(d0.photos) ? d0.photos.slice() : null));
  const [couv, setCouv] = React.useState(d0.couverture || '');
  const [dit, setDit] = React.useState('');
  React.useEffect(() => { let mort = false; Promise.resolve(lireStudio ? lireStudio() : null).then((r) => { if (mort) return; setStudio(r && Array.isArray(r.photos) ? r.photos.filter((p) => p && p.id && typeof p.img === 'string') : null); }).catch(() => { if (!mort) setStudio(null); }); return () => { mort = true; }; }, [lireStudio]);
  const poser = (k) => (x) => setV((o) => ({ ...o, [k]: typeof x === 'string' ? x : (x && x.target ? x.target.value : '') }));
  // L'ordre : SON ordre s'il l'a posé, sinon celui du studio ; une photo retirée du studio sort de la liste (jamais remplacée).
  const ids = Array.isArray(studio) ? studio.map((p) => p.id) : [];
  const dans = (ordre || ids).filter((id) => ids.includes(id));
  const horsAnnonce = ids.filter((id) => !dans.includes(id));
  const vues = ordrePhotos(dans, couv);
  const prixN = Number(String(v.prix).replace(',', '.'));
  const ficheVue = { ...f0, ...v, prix: Number.isFinite(prixN) && prixN > 0 ? prixN : null, couleurs: [v.couleur, v.couleur2].filter(Boolean) };
  const propose = descriptionProposee(modeles, ficheVue);
  const mq = manquesDepot(ficheVue, vues.length, 'publier');
  const utiliser = () => { if (propose) setV((o) => ({ ...o, description: propose.texte })); };
  // Une description VIDE reçoit le modèle proposé (jamais un texte qu'il a écrit).
  React.useEffect(() => { if (propose && !String(v.description || '').trim()) setV((o) => (String(o.description || '').trim() ? o : { ...o, description: propose.texte })); }, [propose && propose.modeleId]); // eslint-disable-line react-hooks/exhaustive-deps
  const deplacer = (de, vers) => { const l = vues.slice(); const [x] = l.splice(de, 1); l.splice(vers, 0, x); if (vers === 0 || de === 0) setCouv(l[0]); setOrdre(l); };
  const enregistrer = () => {
    const depot = { photos: vues, couverture: vues[0] || '', modele: propose ? propose.modeleId : '', prepareeAt: new Date().toISOString() };
    const out = { ...f0, ...v, couleurs: [v.couleur, v.couleur2].filter(Boolean), prix: Number.isFinite(prixN) && prixN > 0 ? Math.round(prixN * 100) / 100 : null, depot };
    delete out.couleur2;
    const r = onEnregistrer ? onEnregistrer(out) : false;
    if (r === false) { setDit(tr('depot.pasEnregistre')); return; }
    onFermer && onFermer();
  };
  const portee = propose ? (propose.portee === 'modele' ? tr('depot.porteeModele', { m: v.modele }) : propose.portee === 'marque' ? tr('depot.porteeMarque', { m: v.marque }) : tr('depot.porteeDefaut')) : '';
  const champ = (k, props = {}) => <Champ libelle={libChamp(k)} valeur={v[k]} onChange={poser(k)} attrs={{ 'data-prep-champ': k }} {...props}/>;
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('depot.titre', { n: f0.numero || '' })} attrs={{ 'data-preparer': f0.id || '' }}
      pied={<Bouton variante="plein" large onClick={enregistrer} attrs={{ 'data-prep-enregistrer': '' }}>{tr('depot.enregistrer')}</Bouton>}>
      <p className="prep-etat" data-prep-manque={mq.manque.join(' ')} data-ton={mq.manque.length ? 'ambre' : ''}>{mq.manque.length ? tr('depot.manque', { l: mq.manque.map(nomChamp).join(', ') }) : tr('depot.prete')}{mq.variables.length ? ' · ' + tr('depot.variables', { l: mq.variables.map((x) => '{' + x + '}').join(', ') }) : ''}</p>
      {dit ? <p className="prep-etat" data-ton="ambre" role="status">{dit}</p> : null}
      <Groupe titre={tr('depot.photos')} pied={tr('depot.photosNote')} attrs={{ 'data-prep-photos': studio === undefined ? 'cours' : studio === null ? 'pas-su' : String(vues.length) }}>
        {studio === undefined ? <Rangee titre={tr('depot.photosLecture')}/> : studio === null ? <Rangee titre={tr('depot.photosPasSu')}/> : !ids.length
          ? <Rangee titre={tr('depot.photosAucune')} fin={ouvrirStudio ? 'chevron' : null} onClick={ouvrirStudio || null} ton="ambre"/>
          : <ListeOrdonnee mode="montrees" attrs={{ 'data-prep-ordre': vues.join(',') }} attrsElement={(x) => ({ 'data-prep-photo': x.cle, 'data-prep-couverture': x.cle === vues[0] ? '' : undefined })}
              elements={vues.map((id, i) => { const p = studio.find((y) => y.id === id); return { cle: id, nom: i === 0 ? tr('depot.couverture') : tr('depot.photoN', { n: i + 1 }), phrase: '',
                icone: <img className="prep-vig" src={p ? p.img : ''} alt=""/>,
                apercu: i === 0 ? <span className="prep-etoile" aria-hidden="true">★</span> : <button type="button" className="prep-etoile-b" aria-label={tr('depot.faireCouverture', { n: i + 1 })} onClick={() => { setCouv(id); setOrdre(vues); }} data-prep-etoile={id}>☆</button> }; })}
              onBasculer={(cle) => setOrdre(vues.filter((x) => x !== cle))} onDeplacer={deplacer}
              libelles={{ retirer: (n) => tr('depot.retirerPhoto', { n }), deplacer: (n) => tr('depot.deplacer', { n }), monter: tr('depot.monter'), descendre: tr('depot.descendre') }}/>}
        {Array.isArray(studio) && horsAnnonce.length ? <ListeOrdonnee mode="ajout" attrs={{ 'data-prep-hors': String(horsAnnonce.length) }}
          elements={horsAnnonce.map((id) => { const p = studio.find((y) => y.id === id); return { cle: id, nom: tr('depot.horsAnnonce'), icone: <img className="prep-vig" src={p ? p.img : ''} alt=""/> }; })}
          onBasculer={(cle) => setOrdre([...vues, cle])} libelles={{ ajouter: () => tr('depot.ajouterPhoto') }}/> : null}
      </Groupe>
      <Groupe titre={tr('depot.annonce')}>
        <div className="prep-champs">
          {champ('titre')}
          {champ('marque')}
          {champ('modele', { placeholder: tr('depot.modeleEx') })}
          {champ('taille', { placeholder: '42' })}
          {champ('categorie', { placeholder: tr('depot.categorieEx') })}
          {champ('prix', { inputMode: 'decimal', suffixe: '€' })}
        </div>
      </Groupe>
      <Groupe titre={libChamp('etat')}>
        <div className="prep-choix" role="radiogroup" aria-label={libChamp('etat')}>
          {ETATS_DEPOT.map((e) => <button key={e} type="button" role="radio" aria-checked={v.etat === e} className="sb-touche" data-prep-etat={e} onClick={() => setV((o) => ({ ...o, etat: e }))}>{tr('depot.etat.' + ETATS_DEPOT.indexOf(e))}</button>)}
        </div>
      </Groupe>
      <Groupe titre={tr('depot.couleursColis')}>
        <div className="prep-champs">
          {champ('couleur', { attrs: { 'data-prep-champ': 'couleur', list: 'prep-couleurs' } })}
          {champ('couleur2', { attrs: { 'data-prep-champ': 'couleur2', list: 'prep-couleurs' } })}
          <datalist id="prep-couleurs">{COULEURS_VINTED.map((c) => <option key={c} value={c}/>)}</datalist>
        </div>
        <div className="prep-choix" role="radiogroup" aria-label={libChamp('colis')}>
          {Object.keys(COLIS_DEPOT).map((k) => <button key={k} type="button" role="radio" aria-checked={v.colis === k} className="sb-touche" data-prep-colis={k} onClick={() => setV((o) => ({ ...o, colis: k }))}>{tr('depot.colis.' + k)}</button>)}
        </div>
      </Groupe>
      <Groupe titre={libChamp('description')} attrs={{ 'data-prep-modele': propose ? propose.modeleId : '' }}>
        {propose ? <Rangee titre={tr('depot.modeleChoisi', { p: portee })} sousTitre={propose.manques.length ? tr('depot.variables', { l: propose.manques.map((x) => '{' + x + '}').join(', ') }) : tr('depot.modeleRempli')}
          actions={v.description !== propose.texte ? <Bouton variante="teinte" taille="compact" onClick={utiliser} attrs={{ 'data-prep-utiliser': propose.modeleId }}>{tr('depot.utiliser')}</Bouton> : null} attrs={{ 'data-prep-propose': propose.portee }}/>
          : <Rangee titre={tr('depot.aucunModele')} attrs={{ 'data-prep-propose': '' }}/>}
        <label className="prep-desc"><span className="n-lu-seul">{libChamp('description')}</span>
          <textarea value={v.description} onChange={poser('description')} rows={7} data-prep-champ="description" aria-label={libChamp('description')}/></label>
      </Groupe>
    </Feuille>
  );
}
export { CHAMPS_DEPOT };
