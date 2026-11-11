// ═══════════════════════════════════════════════════════════════════════════
// PARAMÈTRES → IMPORTER (11 nov.) — la règle : src/importStock.js
// ═══════════════════════════════════════════════════════════════════════════
// Mon stock · Mes ventes passées ⇒ un fichier (.csv / .xlsx, lu dans le
// navigateur) ⇒ colonnes reconnues, réglables ⇒ APERÇU ligne par ligne, calculé
// par tranches (2 000 lignes sans figer l'écran) ⇒ « Importer N lignes ».
// En dessous : ses imports (« Annuler cet import », deux gestes) et, pour le
// stock importé, une annonce PROPOSÉE par paire — c'est SON clic qui relie.
// Tout ce qui lit ou écrit ses données arrive par `outils` (App.jsx).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireFichierAchats } from '../importAchats.js';
import { NOMS, champsDe, OBLIGATOIRES, reconnaitreColonnes, colonnesManquantes, changerColonne, apercuParTranches, resume, ecritures, propositionAnnonce } from '../importStock.js';
import './import-stock.css';

const LIGNES_AFFICHEES = 150;
const prixTexte = (p) => (p ? `${p} €` : '—');
const dateTexte = (d) => { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };
const pl = (n, un, des) => `${Number(n).toLocaleString('fr-FR')} ${n > 1 ? des : un}`;
const NOM_ETAT = { conflit: 'Conflit', double: 'Déjà là', averifier: 'À vérifier', ecartee: 'Écartée' };
const nouvelId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function MetaLigne({ mode, l }) {
  if (l.etat !== 'ok' && l.etat !== 'averifier') return <span className="vrm-imps-meta">{l.raison}</span>;
  const r = l.rec || {};
  const morceaux = mode === 'ventes'
    ? [dateTexte(r.date), r.plateforme && r.plateforme !== 'Autre' ? r.plateforme : r.site, r.versement ? 'versée le ' + dateTexte(r.versement) : '', r.ref ? 'n° ' + r.ref : '']
    : [r.date ? 'acheté le ' + dateTexte(r.date) : '', r.emplacement, r.notes];
  if (l.etat === 'averifier') morceaux.push(l.raison);
  return (
    <span className="vrm-imps-meta">
      {morceaux.filter(Boolean).join(' · ')}
      {(l.notes || []).map((n) => <span key={n} className="vrm-imps-note-ligne" data-imps-note={n}> · {n}</span>)}
    </span>
  );
}

export function ImportStockReglage({ outils, Bouton, Segmente }) {
  const [mode, setMode] = React.useState('stock');
  const [fichier, setFichier] = React.useState(null);   // { nom, rows }
  const [colonnes, setColonnes] = React.useState([]);
  const [erreur, setErreur] = React.useState('');
  const [lecture, setLecture] = React.useState(false);
  const [calcul, setCalcul] = React.useState(null);     // { fait, total } pendant l'aperçu
  const [lignes, setLignes] = React.useState(null);     // null = pas calculé
  const [servis, setServis] = React.useState(undefined); // undefined en cours · null pas su · { prendre }
  const [avecSansRef, setAvecSansRef] = React.useState(false);
  const [ecriture, setEcriture] = React.useState(false);
  const [etat, setEtat] = React.useState(() => outils.lireEtat());
  const [aAnnuler, setAAnnuler] = React.useState(null);
  const [relire, setRelire] = React.useState(0);          // un refus à l'écriture ⇒ l'aperçu est relu
  const [annonces, setAnnonces] = React.useState(() => outils.annonces());
  const entree = React.useRef(null);
  const gen = React.useRef(0);

  React.useEffect(() => outils.ecouter(() => { setEtat(outils.lireEtat()); setAnnonces(outils.annonces()); }), [outils]);

  const manque = fichier ? colonnesManquantes(mode, colonnes) : [];
  // L'aperçu : relu à chaque changement de colonne, par tranches. Les N° servis
  // sont relus AVANT (pas su ⇒ pas d'aperçu, et c'est dit).
  React.useEffect(() => {
    const n = ++gen.current;
    setLignes(null); setCalcul(null);
    if (!fichier || manque.length) return undefined;
    let fini = false;
    (async () => {
      const contexte = await outils.contexte(mode);
      if (n !== gen.current) return;
      setServis(contexte);
      if (!contexte) return;
      setCalcul({ fait: 0, total: fichier.rows.length - 1 });
      const out = await apercuParTranches(mode, { rows: fichier.rows, colonnes, avecSansRef, ...contexte }, {
        annule: () => n !== gen.current,
        surAvance: (fait, total) => { if (n === gen.current) setCalcul({ fait, total }); },
      });
      if (n !== gen.current || !out) return;
      fini = true; setCalcul(null); setLignes(out);
    })().catch(() => { if (n === gen.current) setServis(null); });
    return () => { if (!fini) gen.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichier, colonnes.join('|'), mode, avecSansRef, manque.length, relire]);

  const choisir = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    setErreur(''); setLecture(true); setFichier(null);
    try {
      await new Promise((r) => setTimeout(r, 0));   // « Lecture… » s'affiche avant le travail
      const r = await lireFichierAchats({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) });
      if (r.erreur) setErreur(r.erreur);
      else if (!r.rows || r.rows.length < 2) setErreur('Aucune ligne lue dans ce fichier.');
      else { setColonnes(reconnaitreColonnes(mode, r.rows[0])); setFichier({ nom: f.name, rows: r.rows }); }
    } catch (_) { setErreur('Fichier illisible : enregistre-le en .csv.'); }
    setLecture(false);
  };
  const changerMode = (m) => {
    if (m === mode) return;
    setMode(m); setAvecSansRef(false);
    if (fichier) setColonnes(reconnaitreColonnes(m, fichier.rows[0]));
  };
  const res = resume(lignes || []);
  const importer = async () => {
    if (!res.ok || ecriture || !lignes) return;
    setEcriture(true);
    try {
      const importId = nouvelId('imp_');
      const w = ecritures(mode, lignes, { nouvelId: () => nouvelId(mode === 'ventes' ? 'vi_' : 'si_'), importId, nom: fichier.nom, coutExiste: outils.coutExiste });
      const r = await outils.ecrire(mode, w);
      if (r && r.ok) {
        outils.toast(`${pl(w.items.length, mode === 'ventes' ? 'vente importée' : 'paire importée', mode === 'ventes' ? 'ventes importées' : 'paires importées')}`);
        setFichier(null); setLignes(null); setEtat(outils.lireEtat());
      } else { setErreur((r && r.raison) || 'Rien n’a été écrit : réessaie.'); setRelire((x) => x + 1); }
    } finally { setEcriture(false); }
  };
  const annuler = async (imp) => {
    const r = await outils.annuler(imp);
    setAAnnuler(null);
    if (r && r.ok) { outils.toast(`Import annulé · ${pl(r.retires, 'ligne retirée', 'lignes retirées')}`); setEtat(outils.lireEtat()); }
    else outils.toast((r && r.raison) || 'Pas pu annuler : réessaie.');
  };

  // Les propositions : une annonce par paire importée sans annonce, jamais deux fois la même.
  const propositions = React.useMemo(() => {
    if (!Array.isArray(annonces)) return null;
    const deja = new Set(); const out = [];
    for (const it of (etat.stock || [])) {
      if (!it || it.annonce || out.length >= 30) continue;
      const p = propositionAnnonce(it, annonces, { marqueDe: outils.marqueDe, dejaProposees: deja });
      if (p) { deja.add(String(p.annonce.id)); out.push({ it, a: p.annonce }); }
    }
    return out;
  }, [annonces, etat.stock, outils]);
  const relier = async (it, a) => {
    const r = await outils.relier(it, a);
    outils.toast(r && r.ok ? `N°${it.numero} relié à son annonce` : ((r && r.raison) || 'Pas pu relier : réessaie.'));
    setEtat(outils.lireEtat()); setAnnonces(outils.annonces());
  };

  const noms = NOMS[mode];
  const imports = (etat.imports || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return (
    <div className="vrm-imps" data-imps={fichier ? (lignes ? 'apercu' : 'calcul') : 'choisir'} data-imps-mode={mode}>
      <Segmente label="Quoi importer" plein value={mode} onChange={changerMode}
        options={[{ v: 'stock', l: 'Mon stock', data: { 'data-imps-mode-choix': 'stock' } }, { v: 'ventes', l: 'Mes ventes passées', data: { 'data-imps-mode-choix': 'ventes' } }]}/>
      {!fichier && (
        <>
          <p className="vrm-imps-phrase">{mode === 'ventes' ? 'Une ligne par vente. VRM lit ces colonnes :' : 'Une ligne par paire. VRM lit ces colonnes :'}</p>
          <ul className="vrm-imps-puces" aria-label="Colonnes lues">
            {champsDe(mode).map((c) => <li key={c} data-imps-attendue={c}>{noms[c]}{OBLIGATOIRES[mode].includes(c) ? '' : ' · facultatif'}</li>)}
          </ul>
          <p className="vrm-imps-note">{mode === 'ventes'
            ? 'Le chiffre d’affaires déclaré reste daté au jour du versement : une vente sans date de versement est « à dater », dans aucun mois.'
            : 'Un N° qui existe déjà dans VRM n’est jamais écrasé ni renuméroté : il est montré en conflit.'} Rien n’est enregistré avant ton «&nbsp;Importer&nbsp;».</p>
        </>
      )}
      {erreur && <p className="vrm-imps-erreur" role="alert" data-imps-erreur="">{erreur}</p>}
      {fichier && (
        <>
          <p className="vrm-imps-fichier" data-imps-fichier-nom="">{fichier.nom} · {pl(fichier.rows.length - 1, 'ligne', 'lignes')}</p>
          <div className="vrm-imps-colonnes" data-imps-colonnes="">
            {fichier.rows[0].map((h, i) => (
              <label key={i} className="vrm-imps-col">
                <span className="vrm-imps-col-nom">{String(h || `Colonne ${i + 1}`).slice(0, 28)}</span>
                <select value={colonnes[i] || ''} onChange={(e) => setColonnes((cs) => changerColonne(cs, i, e.target.value))} data-imps-col={i} data-imps-champ={colonnes[i] || ''}>
                  {['', ...champsDe(mode)].map((c) => <option key={c} value={c}>{noms[c]}</option>)}
                </select>
              </label>
            ))}
          </div>
          {manque.length > 0 ? (
            <p className="vrm-imps-erreur" role="alert" data-imps-manque={manque.join(',')}>Choisis la colonne {manque.map((c) => `« ${noms[c]} »`).join(', ')}.</p>
          ) : servis === null ? (
            <p className="vrm-imps-erreur" role="alert" data-imps-pas-su="">Je n’ai pas pu relire tes N° déjà servis : aucun aperçu, rien ne sera écrit. Réessaie dans un instant.</p>
          ) : !lignes ? (
            <p className="vrm-imps-note" role="status" data-imps-calcul={calcul ? calcul.fait : 0}>{calcul ? `Lecture des lignes… ${calcul.fait.toLocaleString('fr-FR')} / ${calcul.total.toLocaleString('fr-FR')}` : 'Lecture de tes N° déjà servis…'}</p>
          ) : (
            <>
              <div className="vrm-imps-resume" data-imps-ok={res.ok} data-imps-conflits={res.conflits} data-imps-doubles={res.doubles} data-imps-averifier={res.averifier} data-imps-ecartees={res.ecartees} data-imps-adater={res.aDater}>
                <span className="vrm-imps-pastille"><b>{res.ok.toLocaleString('fr-FR')}</b> à importer</span>
                {res.conflits > 0 && <span className="vrm-imps-pastille vrm-imps-ambre"><b>{res.conflits.toLocaleString('fr-FR')}</b> en conflit</span>}
                {res.doubles > 0 && <span className="vrm-imps-pastille"><b>{res.doubles}</b> déjà là</span>}
                {res.averifier > 0 && <span className="vrm-imps-pastille vrm-imps-ambre"><b>{res.averifier}</b> à vérifier</span>}
                {res.ecartees > 0 && <span className="vrm-imps-pastille vrm-imps-ambre"><b>{res.ecartees.toLocaleString('fr-FR')}</b> ignorée{res.ecartees > 1 ? 's' : ''}</span>}
              </div>
              {mode === 'ventes' && res.aDater > 0 && <p className="vrm-imps-note" data-imps-note-adater={res.aDater}>{pl(res.aDater, 'vente sans date de versement', 'ventes sans date de versement')} : à dater, dans aucun mois déclaré.</p>}
              {(res.averifier > 0 || avecSansRef) && (
                <label className="vrm-imps-case" data-imps-sans-ref={avecSansRef ? 'on' : 'off'}>
                  <input type="checkbox" checked={avecSansRef} onChange={(e) => setAvecSansRef(e.target.checked)} data-imps-sans-ref-case=""/>
                  <span>Importer aussi les ventes sans n° de commande : elles ne sont pas sur un compte relié à VRM.</span>
                </label>
              )}
              <ul className="vrm-imps-lignes" data-imps-lignes={lignes.length}>
                {lignes.slice(0, LIGNES_AFFICHEES).map((l) => (
                  <li key={l.n} data-imps-ligne={l.n} data-imps-etat={l.etat} data-imps-num={l.numero || (l.rec && l.rec.numero) || ''} className={'vrm-imps-ligne vrm-imps-' + l.etat}>
                    <span className="vrm-imps-n">{l.n}</span>
                    <span className="vrm-imps-corps">
                      <span className="vrm-imps-titre">{mode === 'stock' && (l.numero || (l.rec && l.rec.numero)) ? <b className="vrm-imps-num">N°{l.numero || l.rec.numero}</b> : null}{(l.rec && l.rec.titre) || l.apercu || '—'}</span>
                      <MetaLigne mode={mode} l={l}/>
                    </span>
                    <span className="vrm-imps-prix" data-imps-prix={l.rec ? (l.rec.prix || '') : ''}>{l.etat === 'ok' ? prixTexte(l.rec.prix) : NOM_ETAT[l.etat]}</span>
                  </li>
                ))}
              </ul>
              {lignes.length > LIGNES_AFFICHEES && <p className="vrm-imps-note">et {pl(lignes.length - LIGNES_AFFICHEES, 'autre ligne', 'autres lignes')} (comptées ci-dessus).</p>}
            </>
          )}
        </>
      )}
      <input ref={entree} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={choisir} style={{ display: 'none' }} data-imps-fichier=""/>
      <div className="vrm-imps-pied">
        {fichier && lignes && !manque.length
          ? <Bouton variante="primaire" plein disabled={!res.ok || ecriture} onClick={importer} data-imps-importer={res.ok}>{ecriture ? 'Écriture…' : res.ok ? `Importer ${pl(res.ok, 'ligne', 'lignes')}` : 'Rien à importer'}</Bouton>
          : null}
        <Bouton variante={fichier ? 'discret' : 'primaire'} plein={!fichier} disabled={lecture || ecriture} onClick={() => entree.current && entree.current.click()} data-imps-choisir="">
          {lecture ? 'Lecture…' : fichier ? 'Autre fichier' : 'Choisir le fichier'}
        </Bouton>
      </div>

      {imports.length > 0 && (
        <section className="vrm-imps-bloc" data-imps-journal={imports.length}>
          <h4 className="vrm-imps-h">Tes imports</h4>
          <ul className="vrm-imps-lignes">
            {imports.map((imp) => (
              <li key={imp.id} className="vrm-imps-ligne" data-imps-import={imp.id} data-imps-import-type={imp.type} data-imps-import-n={imp.n}>
                <span className="vrm-imps-corps">
                  <span className="vrm-imps-titre">{imp.type === 'ventes' ? pl(imp.n, 'vente passée', 'ventes passées') : pl(imp.n, 'paire en stock', 'paires en stock')}</span>
                  <span className="vrm-imps-meta">{[dateTexte(String(imp.at).slice(0, 10)), imp.nom].filter(Boolean).join(' · ')}</span>
                </span>
                {aAnnuler === imp.id
                  ? <Bouton variante="danger" onClick={() => annuler(imp)} data-imps-annuler-confirmer={imp.id}>Retirer {pl(imp.n, 'ligne', 'lignes')}</Bouton>
                  : <Bouton variante="discret" onClick={() => setAAnnuler(imp.id)} data-imps-annuler={imp.id}>Annuler</Bouton>}
              </li>
            ))}
          </ul>
          {aAnnuler && <p className="vrm-imps-note" data-imps-annuler-phrase="">Tout ce que cet import a créé sera retiré, rien d’autre. {(imports.find((x) => x.id === aAnnuler) || {}).type === 'stock' ? 'Ses N° restent réservés : ils sont peut-être écrits sur tes cartons.' : ''}</p>}
        </section>
      )}

      {mode === 'stock' && (etat.stock || []).length > 0 && (
        <section className="vrm-imps-bloc" data-imps-propositions={propositions ? propositions.length : 'pas-su'}>
          <h4 className="vrm-imps-h">Relier tes paires à leurs annonces</h4>
          {propositions === null
            ? <p className="vrm-imps-note">Ouvre Annonces une fois : VRM pourra te proposer l’annonce Vinted de chaque paire importée.</p>
            : !propositions.length
              ? <p className="vrm-imps-note">Aucune annonce sans N° ne ressemble à une paire importée.</p>
              : (
                <>
                  <p className="vrm-imps-note">Une proposition, par ressemblance : vérifie avant de relier. L’annonce prend alors le N° de la paire.</p>
                  <ul className="vrm-imps-lignes">
                    {propositions.map(({ it, a }) => (
                      <li key={it.id} className="vrm-imps-ligne" data-imps-proposition={it.numero} data-imps-proposition-annonce={a.id}>
                        <span className="vrm-imps-corps">
                          <span className="vrm-imps-titre"><b className="vrm-imps-num">N°{it.numero}</b>{it.titre}</span>
                          <span className="vrm-imps-meta">peut-être « {a.titre} »</span>
                        </span>
                        <Bouton variante="secondaire" onClick={() => relier(it, a)} data-imps-relier={a.id}>Relier</Bouton>
                      </li>
                    ))}
                  </ul>
                </>
              )}
        </section>
      )}
    </div>
  );
}
export default ImportStockReglage;
