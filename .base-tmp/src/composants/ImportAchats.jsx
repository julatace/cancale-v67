// ═══════════════════════════════════════════════════════════════════════════
// « IMPORTER UN TABLEUR » — la feuille (10 nov., lot J). La règle : src/importAchats.js
// ═══════════════════════════════════════════════════════════════════════════
// Choisir un .csv / .xlsx ⇒ chaque ligne montrée (à importer · déjà là · écartée
// et pourquoi) ⇒ RIEN n'est écrit avant « Importer N achats ». Le fichier est lu
// dans le navigateur ; il ne part nulle part.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { motsVendeur } from '../profilVendeur.js';
import { lireFichierAchats, reconnaitreColonnes, colonnesSuffisantes, apercuImport, resumeImport, ecrituresImport, NOMS_CHAMPS, CHAMPS } from '../importAchats.js';
import './import-achats.css';

const LIGNES_AFFICHEES = 150;
const prixTexte = (p) => (p ? `${p} €` : '—');
const dateTexte = (d) => { const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };

export function ImportAchatsFeuille({ onClose, onImporter, existants, numeroDe, etatNumero, Feuille, Bouton }) {
  const [fichier, setFichier] = React.useState(null);   // { nom, rows } | null
  const [colonnes, setColonnes] = React.useState([]);
  const [erreur, setErreur] = React.useState('');
  const [lecture, setLecture] = React.useState(false);
  const entree = React.useRef(null);

  const choisir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    setErreur(''); setLecture(true);
    try {
      const r = await lireFichierAchats({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) });
      if (r.erreur) { setErreur(r.erreur); setFichier(null); }
      else if (!r.rows || r.rows.length < 2) { setErreur('Aucune ligne lue dans ce fichier.'); setFichier(null); }
      else { setFichier({ nom: f.name, rows: r.rows }); setColonnes(reconnaitreColonnes(r.rows[0])); }
    } catch (_) { setErreur('Fichier illisible : enregistre-le en .csv.'); }
    setLecture(false);
  };
  const manque = fichier ? colonnesSuffisantes(colonnes) : [];
  const lignes = React.useMemo(() => (fichier && !manque.length ? apercuImport({ rows: fichier.rows, colonnes, existants, numeroDe, etatNumero }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fichier, colonnes.join('|'), manque.length]);
  const res = resumeImport(lignes);
  const importer = () => {
    if (!res.ok) return;
    const w = ecrituresImport(lignes, () => 'ob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    onImporter(w);
  };
  const changerColonne = (i, champ) => setColonnes((cs) => cs.map((c, k) => (k === i ? champ : (champ && c === champ ? '' : c))));

  return (
    <Feuille onClose={onClose} titre="Importer un tableur" sousTitre={fichier ? fichier.nom : 'Tes achats, depuis Excel ou un .csv'} maxWidth={620} z={2100} data-import-achats={fichier ? 'apercu' : 'choisir'}>
      <div className="vrm-imp">
        {!fichier && (
          <>
            <p className="vrm-imp-phrase">Une ligne par achat. VRM lit ces colonnes&nbsp;:</p>
            <ul className="vrm-imp-puces" aria-label="Colonnes lues">
              {CHAMPS.map((c) => <li key={c} data-imp-colonne-attendue={c}>{NOMS_CHAMPS[c]}{['date', 'titre', 'prix'].includes(c) ? '' : ' · facultatif'}</li>)}
            </ul>
            <p className="vrm-imp-note">Rien n’est enregistré avant ton «&nbsp;Importer&nbsp;».</p>
          </>
        )}
        {erreur && <p className="vrm-imp-erreur" role="alert" data-imp-erreur="">{erreur}</p>}
        {fichier && (
          <>
            <div className="vrm-imp-colonnes" data-imp-colonnes="">
              {fichier.rows[0].map((h, i) => (
                <label key={i} className="vrm-imp-col">
                  <span className="vrm-imp-col-nom">{String(h || `Colonne ${i + 1}`).slice(0, 28)}</span>
                  <select value={colonnes[i] || ''} onChange={(e) => changerColonne(i, e.target.value)} data-imp-col={i} data-imp-champ={colonnes[i] || ''}>
                    {['', ...CHAMPS].map((c) => <option key={c} value={c}>{NOMS_CHAMPS[c]}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {manque.length > 0 ? (
              <p className="vrm-imp-erreur" role="alert" data-imp-manque={manque.join(',')}>Choisis la colonne {manque.map((c) => `« ${NOMS_CHAMPS[c]} »`).join(', ')}.</p>
            ) : (
              <>
                <div className="vrm-imp-resume" data-imp-ok={res.ok} data-imp-doubles={res.doubles} data-imp-ecartees={res.ecartees} data-imp-couts={res.couts}>
                  <span className="vrm-imp-pastille"><b>{res.ok}</b> à importer</span>
                  {res.doubles > 0 && <span className="vrm-imp-pastille"><b>{res.doubles}</b> déjà là</span>}
                  {res.ecartees > 0 && <span className="vrm-imp-pastille vrm-imp-ambre"><b>{res.ecartees}</b> écartée{res.ecartees > 1 ? 's' : ''}</span>}
                  {res.couts > 0 && <span className="vrm-imp-pastille"><b>{res.couts}</b> coût{res.couts > 1 ? 's' : ''} {motsVendeur().deNom}</span>}
                </div>
                {res.sansRef > 0 && <p className="vrm-imp-note" data-imp-sans-ref={res.sansRef}>{res.sansRef} sans référence : un doublon ne s’y voit pas.</p>}
                <ul className="vrm-imp-lignes" data-imp-lignes={lignes.length}>
                  {lignes.slice(0, LIGNES_AFFICHEES).map((l) => (
                    <li key={l.n} data-imp-ligne={l.n} data-imp-etat={l.etat} className={'vrm-imp-ligne vrm-imp-' + l.etat}>
                      <span className="vrm-imp-n">{l.n}</span>
                      <span className="vrm-imp-corps">
                        <span className="vrm-imp-titre">{l.rec ? l.rec.title : (l.apercu || '—')}</span>
                        <span className="vrm-imp-meta">
                          {l.etat === 'ok'
                            ? [dateTexte(l.rec.date), l.rec.source, l.numero ? `N°${l.numero}${l.coutPose ? ' · coût posé' : l.noteNumero ? ' · ' + l.noteNumero : ''}` : l.noteNumero].filter(Boolean).join(' · ')
                            : l.raison}
                        </span>
                      </span>
                      <span className="vrm-imp-prix" data-imp-prix={l.rec ? l.rec.price : ''}>{l.etat === 'ok' ? prixTexte(l.rec.price) : (l.etat === 'double' ? 'Déjà là' : 'Écartée')}</span>
                    </li>
                  ))}
                </ul>
                {lignes.length > LIGNES_AFFICHEES && <p className="vrm-imp-note">et {lignes.length - LIGNES_AFFICHEES} autres lignes.</p>}
              </>
            )}
          </>
        )}
        <input ref={entree} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={choisir} style={{ display: 'none' }} data-imp-fichier="" />
      </div>
      <div className="vrm-fs-pied vrm-imp-pied">
        {fichier && !manque.length
          ? <Bouton variante="primaire" plein disabled={!res.ok} onClick={importer} data-imp-importer={res.ok}>{res.ok ? `Importer ${res.ok} achat${res.ok > 1 ? 's' : ''}` : 'Rien à importer'}</Bouton>
          : null}
        <Bouton variante={fichier ? 'discret' : 'primaire'} plein={!fichier} disabled={lecture} onClick={() => entree.current && entree.current.click()} data-imp-choisir="">
          {lecture ? 'Lecture…' : fichier ? 'Autre fichier' : 'Choisir le fichier'}
        </Bouton>
      </div>
    </Feuille>
  );
}
export default ImportAchatsFeuille;
