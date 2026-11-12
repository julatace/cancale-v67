// ── LA FEUILLE « RANGER CET ACHAT » (11 nov. 2026, lot rangement-guide) ───────
// La RÈGLE (N° en série, cases à la suite, écriture) : src/rangementArrivee.js.
// Ici, seulement ce qui se dessine et ce qu'il touche :
//   · la photo de l'achat, son prix lu ;
//   · une ligne par article (un lot de N = N lignes) : le N° proposé (ou tapé,
//     « Je numérote moi-même »), la case proposée, la fiche (titre, marque,
//     taille, prix d'achat), tout modifiable ;
//   · le plan du Stock : un toucher sur une case libre la donne à la ligne choisie ;
//   · UN geste « Rangé » (la coque écrit, la pilule offre « Annuler » 5 s),
//     « Plus tard » (rien n'est écrit), « Pas à ranger » (la proposition se tait).
// Rien n'est écrit ici : `preparer` lit, `ranger` écrit (App.jsx, `RangerAchatCoque`).
import React from 'react';
import { tr } from './i18n/index.js';
import { lignesDeLAchat, caseChoisie, validerNumeroTape, caseEnMots, LOT_MAX } from './rangementArrivee.js';
import './ranger-achat.css';

const motCase = (c) => (c ? tr('ranger.niveau', { meuble: c.meuble, niveau: c.rangee, case: c.colonne }) : '');
const prixAffiche = (p) => { const n = Number(String(p == null ? '' : p).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €' : ''; };

// Le plan d'un meuble : chaque case, prise (son N°), à une ligne de la feuille, libre.
function Plan({ prep, lignes, courante, onCase }) {
  const meubles = (prep && Array.isArray(prep.meubles) ? prep.meubles : []).filter((m) => m && m.id != null);
  const caseCour = lignes[courante] && lignes[courante].case;
  const [vu, setVu] = React.useState(() => (caseCour ? String(caseCour.meubleId) : (meubles[0] ? String(meubles[0].id) : '')));
  React.useEffect(() => { if (caseCour) setVu(String(caseCour.meubleId)); }, [caseCour && caseCour.meubleId, courante]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = meubles.find((x) => String(x.id) === vu) || meubles[0];
  if (!m) return null;
  const cols = Math.max(1, Number(m.cols) || 1), rows = Math.max(1, Number(m.rows) || 1);
  const occupant = {};
  for (const k of Object.keys(prep.slots || {})) { const s = prep.slots[k]; if (s && String(s.m) === String(m.id)) occupant[Number(s.i)] = k; }
  const parLigne = {};
  lignes.forEach((l, k) => { if (l.case && String(l.case.meubleId) === String(m.id)) parLigne[Number(l.case.i)] = k; });
  const autres = lignes.filter((_, k) => k !== courante).map((l) => l.case).filter(Boolean);
  return (
    <div className="vrm-ra-plan" data-ranger-plan={m.id}>
      {meubles.length > 1 ? (
        <div className="vrm-ra-meubles" role="tablist">
          {meubles.map((x) => <button key={x.id} type="button" role="tab" aria-selected={String(x.id) === String(m.id)} className={'vrm-ra-meuble' + (String(x.id) === String(m.id) ? ' is-choisi' : '')} data-ranger-meuble={x.id} onClick={() => setVu(String(x.id))}>{String(x.name || 'Meuble')}</button>)}
        </div>
      ) : <div className="vrm-ra-meuble-nom">{String(m.name || 'Meuble')}</div>}
      <div className="vrm-ra-defile">
        <div className="vrm-ra-grille" style={{ gridTemplateColumns: `repeat(${cols}, minmax(44px, 52px))` }}>
          {Array.from({ length: cols * rows }, (_, i) => {
            const occ = occupant[i], k = parLigne[i];
            const libre = occ == null && k == null && !!caseChoisie({ meubles, slots: prep.slots, m: m.id, i, autres });
            const etat = occ != null ? 'prise' : k === courante ? 'courante' : k != null ? 'ligne' : libre ? 'libre' : 'bloquee';
            const num = occ != null ? occ : k != null ? lignes[k].numero : '';
            const lib = etat === 'prise' ? tr('ranger.case.prise', { n: occ }) : etat === 'courante' || etat === 'ligne' ? tr('ranger.case.ligne', { n: lignes[k].numero || '—' }) : etat === 'libre' ? tr('ranger.case.libre') : tr('ranger.case.bloquee');
            const pl = { niveau: Math.floor(i / cols) + 1, case: (i % cols) + 1 };
            return (
              <button key={i} type="button" className={'vrm-ra-case is-' + etat} data-ranger-case={i} data-ranger-case-etat={etat}
                disabled={etat !== 'libre'} aria-label={`${lib} — ${tr('ranger.niveau', { meuble: String(m.name || 'Meuble'), niveau: pl.niveau, case: pl.case })}`}
                onClick={() => { const c = caseChoisie({ meubles, slots: prep.slots, m: m.id, i, autres }); if (c) onCase(c); }}>
                {num ? <span className="vrm-ra-case-num">{num}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Le corps d'UN achat (la feuille passe au suivant après « Rangé »).
function UnAchat({ entree, preparer, ranger, onSuivant, onPlusTard, onPasARanger, Bouton, Photo, position }) {
  const lotConnu = Math.max(1, Number(entree.n) || (Array.isArray(entree.articles) && entree.articles.length > 1 ? entree.articles.length : 0) || 1);
  const [n, setN] = React.useState(entree.lot && !entree.n ? 2 : lotConnu);
  const [prep, setPrep] = React.useState(undefined);         // undefined : en cours · { ok:false, raison } · prêt
  const [lignes, setLignes] = React.useState([]);
  const [courante, setCourante] = React.useState(0);
  const [envoi, setEnvoi] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    let vivant = true; setPrep(undefined); setErreur('');
    Promise.resolve(preparer(entree, n)).then((p) => {
      if (!vivant) return;
      setPrep(p || { ok: false, raison: 'lecture' });
      if (p && p.ok) {
        const base = lignesDeLAchat(entree, { n, marqueDe: p.marqueDe });
        setLignes(base.map((l, k) => ({ ...l, numero: p.numeroEcrit ? '' : String((p.numeros || [])[k] || ''), case: (p.cases || [])[k] || null })));
        setCourante(0);
      }
    }).catch(() => { if (vivant) setPrep({ ok: false, raison: 'lecture' }); });
    return () => { vivant = false; };
  }, [entree, n, tour]); // eslint-disable-line react-hooks/exhaustive-deps

  const poser = (k, champs) => setLignes((L) => L.map((l, j) => (j === k ? { ...l, ...champs } : l)));
  const validation = (k) => {
    if (!prep || !prep.ok || !prep.numeroEcrit) return null;
    const v = validerNumeroTape(lignes[k].numero, { pris: prep.pris, archive: prep.archive, cleNum: prep.cleNum, autres: lignes.filter((_, j) => j !== k).map((l) => l.numero).filter(Boolean) });
    return v.ok ? null : v.raison;
  };
  const refusTexte = (r, l) => {
    if (r === 'pris') return tr('ranger.refus.pris', { n: (l && l.numero) || '' });
    if (r === 'archive') return tr('ranger.refus.archive', { a: (prep && prep.archive) || '' });
    if (['illisible', 'double', 'case', 'deja', 'vide', 'numero'].includes(r)) return tr('ranger.refus.' + (r === 'numero' ? 'illisible' : r));
    return tr('ranger.refus.lecture');
  };
  const raisons = lignes.map((_, k) => validation(k));
  const pret = !!(prep && prep.ok) && lignes.length > 0 && lignes.every((l) => String(l.numero || '').trim()) && raisons.every((r) => !r || r === 'vide');
  const valider = async () => {
    if (!pret || envoi) return;
    setEnvoi(true); setErreur('');
    let r = null; try { r = await ranger(entree, lignes); } catch (_) { r = { ok: false, raison: 'lecture' }; }
    setEnvoi(false);
    if (r && r.ok) { onSuivant(); return; }
    setErreur(refusTexte(r && r.raison, r && Number.isInteger(r.ligne) ? lignes[r.ligne] : null));
    if (r && (r.raison === 'pris' || r.raison === 'case')) setTour((t) => t + 1);   // relire : un N° ou une case a bougé ailleurs
  };

  const prixLu = prixAffiche(entree.prix);
  return (
    <>
    <div className="vrm-ra-achat" data-ranger-tx={entree.tx || ''} data-ranger-n={lignes.length}>
      <div className="vrm-ra-tete">
        <div className="vrm-ra-photo">{entree.photo && Photo ? <Photo src={entree.photo} alt="" /> : null}</div>
        <div className="vrm-ra-tete-textes">
          <span className="vrm-ra-titre-achat">{entree.titre || tr('ranger.sansTitre')}</span>
          <span className="vrm-ra-sous" data-ranger-prix-lu={prixLu ? String(entree.prix) : ''}>{[prixLu ? tr('ranger.achete', { prix: prixLu }) : tr('ranger.prixPasLu'), position].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      {entree.lot ? (
        <div className="vrm-ra-lot" data-ranger-lot={n}>
          <span>{tr('ranger.combien')}</span>
          <span className="vrm-ra-pas">
            <button type="button" aria-label="−" disabled={n <= 1 || prep === undefined} onClick={() => setN((x) => Math.max(1, x - 1))}>−</button>
            <b data-ranger-lot-n={n}>{n}</b>
            <button type="button" aria-label="+" disabled={n >= LOT_MAX || prep === undefined} onClick={() => setN((x) => Math.min(LOT_MAX, x + 1))}>+</button>
          </span>
        </div>
      ) : null}
      {prep === undefined ? <div className="vrm-ra-attente" data-ranger-attente="">{tr('ranger.attente')}</div> : null}
      {prep && !prep.ok ? (
        <div className="vrm-ra-passu" data-ranger-passu={prep.raison || ''}>
          <b>—</b> <span>{tr(prep.raison === 'numeros' ? 'ranger.numPasSu' : 'ranger.refus.lecture')}</span>
          <Bouton variante="secondaire" className="vrm-b-petit" onClick={() => setTour((t) => t + 1)}>{tr('ranger.reessayer')}</Bouton>
        </div>
      ) : null}
      {prep && prep.ok ? (
        <>
          {prep.numeroEcrit ? <p className="vrm-ra-aide" data-ranger-tape="">{tr('ranger.numeroTapeAide')}</p> : null}
          <ol className="vrm-ra-lignes">
            {lignes.map((l, k) => {
              const r = raisons[k];
              return (
                <li key={k} className={'vrm-ra-ligne' + (k === courante ? ' is-courante' : '')} data-ranger-ligne={k} data-ranger-num={l.numero || ''}
                  data-ranger-case-m={l.case ? l.case.meubleId : ''} data-ranger-case-i={l.case ? l.case.i : ''} onClick={() => setCourante(k)}>
                  <div className="vrm-ra-ligne-tete">
                    {prep.numeroEcrit ? (
                      <label className="vrm-ra-num-tape"><span>{tr('ranger.numero')}</span>
                        <input inputMode={prep.clavier || 'numeric'} autoComplete="off" value={l.numero} data-ranger-num-tape={k} aria-invalid={r && r !== 'vide' ? 'true' : undefined}
                          onChange={(e) => poser(k, { numero: e.target.value.toUpperCase().slice(0, 9) })} onFocus={() => setCourante(k)} /></label>
                    ) : <span className="vrm-ra-num" data-ranger-num-propose={l.numero}>{tr('ranger.numero')}{l.numero}</span>}
                    <button type="button" className="vrm-ra-case-mots" data-ranger-case-mots={k} onClick={() => setCourante(k)}>
                      {l.case ? motCase(l.case) : (prep.aucunMeuble ? tr('ranger.aucunMeuble') : tr('ranger.plein'))}
                    </button>
                  </div>
                  {r && r !== 'vide' ? <p className="vrm-ra-refus" data-ranger-refus={r}>{refusTexte(r, l)}</p> : null}
                  <div className="vrm-ra-champs">
                    <label className="is-large"><span>{tr('ranger.champ.titre')}</span><input value={l.titre} placeholder={l.titreLot || ''} data-ranger-titre={k} onChange={(e) => poser(k, { titre: e.target.value })} onFocus={() => setCourante(k)} /></label>
                    <label><span>{tr('ranger.champ.marque')}</span><input value={l.marque} data-ranger-marque={k} onChange={(e) => poser(k, { marque: e.target.value })} onFocus={() => setCourante(k)} /></label>
                    <label><span>{tr('ranger.champ.taille')}</span><input value={l.taille} data-ranger-taille={k} onChange={(e) => poser(k, { taille: e.target.value })} onFocus={() => setCourante(k)} /></label>
                    <label><span>{tr('ranger.champ.prix')}</span><input inputMode="decimal" value={l.prix} placeholder={l.indicatif ? '≈ ' + l.indicatif : ''} data-ranger-prix={k} onChange={(e) => poser(k, { prix: e.target.value.replace(/[^\d.,]/g, '').slice(0, 9) })} onFocus={() => setCourante(k)} /></label>
                  </div>
                </li>
              );
            })}
          </ol>
          {Array.isArray(prep.meubles) && prep.meubles.length ? (
            <>
              <p className="vrm-ra-aide">{lignes.length > 1 ? tr('ranger.toucherCaseLigne', { n: lignes[courante] ? lignes[courante].numero || '—' : '—' }) : tr('ranger.toucherCase')}</p>
              <Plan prep={prep} lignes={lignes} courante={courante} onCase={(c) => poser(courante, { case: c })} />
            </>
          ) : null}
        </>
      ) : null}
      {erreur ? <p className="vrm-ra-refus" role="alert" data-ranger-erreur="">{erreur}</p> : null}
    </div>
    {/* Le pied d'actions collé en bas de la feuille (`.vrm-fs-pied`, enfant direct de la feuille). */}
    <div className="vrm-fs-pied vrm-ra-pied">
        <Bouton variante="primaire" plein data-ranger-ok="" occupe={envoi} disabled={!pret} onClick={valider}>{lignes.length > 1 ? tr('ranger.rangeN', { n: lignes.length }) : tr('ranger.range')}</Bouton>
        <div className="vrm-ra-pied-second">
          <Bouton variante="secondaire" data-ranger-plus-tard="" onClick={onPlusTard}>{tr('ranger.plusTard')}</Bouton>
          {onPasARanger && entree.tx ? <Bouton variante="secondaire" data-ranger-pas="" onClick={() => onPasARanger(entree)}>{tr('ranger.pasARanger')}</Bouton> : null}
      </div>
    </div>
    </>
  );
}

export function RangerAchat({ entrees, preparer, ranger, onFermer, onPasARanger = null, Feuille, Bouton, Photo = null }) {
  const liste = Array.isArray(entrees) ? entrees.filter(Boolean) : [];
  const [idx, setIdx] = React.useState(0);
  const e = liste[idx];
  React.useEffect(() => { if (!e) onFermer(); }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return null;
  const suivant = () => { if (idx + 1 < liste.length) setIdx(idx + 1); else onFermer(); };
  const position = liste.length > 1 ? tr('ranger.position', { i: idx + 1, n: liste.length }) : '';
  return (
    <Feuille titre={tr('ranger.titre')} onClose={onFermer} maxWidth={560} data-ranger-feuille={liste.length}>
      <UnAchat key={(e.tx || e.suivi || 'x') + ':' + idx} entree={e} preparer={preparer} ranger={ranger} onSuivant={suivant} onPlusTard={suivant}
        onPasARanger={onPasARanger ? (x) => { onPasARanger(x); suivant(); } : null} Bouton={Bouton} Photo={Photo} position={position} />
    </Feuille>
  );
}

export { caseEnMots };
