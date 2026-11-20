// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN D'ARRIVÉE D'UN ACHAT (20 nov. 2026, lot arrivee-scan) — chargé à la demande
//  Julien : « la paire est reconnue par son n° de suivi, l'app lui donne son N°, te dit dans quelle case la ranger,
//  et imprime l'étiquette si tu imprimes les tiennes ». Une page simple, comme Paramètres (NATIF.md §1 bis) :
//  l'achat (photo, titre, prix payé), ce que contient le colis, le N°, la case (le meuble dessiné, la case qui
//  respire), UN plein « Ranger ici » ; puis « Imprimer l'étiquette » (méthode « imprimée ») et « Scanner le suivant ».
//  AUCUNE règle ici (src/arriveeAchat.js) et AUCUNE écriture : la coque (`ArriveeCoque`, src/App.jsx) écrit sur
//  SON toucher, en UN geste annulable 10 s (N° entré au pool d'abord — il n'en ressort jamais —, fiche, case,
//  prix du reçu, colis retiré).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { Feuille, Groupe, Rangee, Vignette, Plaque, Bouton } from './natif/index.js';
import MeubleDessin from './stockV2/MeubleDessin.jsx';
import { numeroArrivee, pairesDansLeColis, casesArrivee, autreCase, lignesArrivee, etiquettesArrivee, DUREE_ANNULER_ARRIVEE } from './arriveeAchat.js';
import { prixPayeArrivee } from './atelierArrivee.js';
import { validerNumeroTape } from './rangementArrivee.js';
import './arrivee-achat.css';

const enLigne = () => { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch (_) { return true; } };
const placeEnMots = (c, meubles) => {
  if (!c) return '';
  const m = (meubles || []).find((x) => x && String(x.id) === String(c.meubleId));
  const cols = Math.max(1, Number(m && m.cols) || 1);
  return tr('arv.case.mots', { meuble: (m && m.name) || c.meuble || tr('arv.case.meuble'), r: Math.floor(Number(c.i) / cols) + 1, c: (Number(c.i) % cols) + 1 });
};

export default function ArriveeAchat({ entree, coque, onFermer, onSuivant = null, suivantScan = true, Photo = null }) {
  useLangue();
  const e = entree || {};
  const [prep, setPrep] = React.useState(undefined);        // undefined : en cours · { ok:false, raison } · { ok, numeros, numeroEcrit, pris, archive, cleNum }
  const [articles, setArticles] = React.useState(undefined);
  const [nChoisi, setNChoisi] = React.useState(null);
  const [tapes, setTapes] = React.useState([]);            // « je numérote moi-même » : SES N°
  const [cases, setCases] = React.useState(null);           // une case par paire (null = pas de case)
  const [sel, setSel] = React.useState(0);                  // la paire dont la case est montrée
  const [vueMeuble, setVueMeuble] = React.useState(null);   // le meuble montré (son id)
  const [fait, setFait] = React.useState(null);             // après « Ranger ici » : { numeros, lignes, horsLigne? }
  const [envoi, setEnvoi] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [enReseau, setEnReseau] = React.useState(enLigne);
  const [jeton, setJeton] = React.useState(0);              // relire (réseau revenu, N° pris entre-temps)

  const etat = React.useMemo(() => { try { return coque.lireEtat(); } catch (_) { return null; } }, [coque, jeton, fait]);   // eslint-disable-line react-hooks/exhaustive-deps
  const deja = React.useMemo(() => numeroArrivee({ tx: e.tx, fiches: etat && etat.fiches, numsAchat: (() => { try { return coque.numsAchat(e.tx) || []; } catch (_) { return []; } })() }), [etat, e.tx, coque]);
  const methode = React.useMemo(() => { try { return coque.methode(); } catch (_) { return null; } }, [coque]);
  const n = pairesDansLeColis(e, { articles: articles || null, choisi: nChoisi });

  React.useEffect(() => { const on = () => { setEnReseau(true); setJeton((j) => j + 1); }; const off = () => setEnReseau(false);
    window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  // Ce que SA transaction dit (un lot : ses articles). Pas su ⇒ null : il dit combien.
  React.useEffect(() => {
    let vivant = true;
    if (typeof coque.details !== 'function') { setArticles(null); return undefined; }
    Promise.resolve().then(() => coque.details(e)).then((d) => { if (vivant) setArticles(d && Array.isArray(d.articles) && d.articles.length ? d.articles : null); }, () => { if (vivant) setArticles(null); });
    return () => { vivant = false; };
  }, [e, coque]);
  // Le N° : relu sur les N° servis (en ligne seulement : une lecture ratée ne donne rien).
  React.useEffect(() => {
    if (!deja.su || deja.etat !== 'nouveau' || n == null) { setPrep(deja.su ? null : undefined); return undefined; }
    if (!enReseau) { setPrep({ ok: false, raison: 'horsLigne' }); return undefined; }
    let vivant = true; setPrep(undefined);
    Promise.resolve().then(() => coque.preparer(e, n)).then((r) => { if (vivant) setPrep(r || { ok: false, raison: 'lecture' }); }, () => { if (vivant) setPrep({ ok: false, raison: 'lecture' }); });
    return () => { vivant = false; };
  }, [deja.su, deja.etat, n, enReseau, jeton, coque, e]);

  const numeros = deja.su && deja.etat === 'attribue' ? deja.numeros
    : prep && prep.ok ? (prep.numeroEcrit ? Array.from({ length: n || 0 }, (_, k) => String(tapes[k] || '').trim()) : (prep.numeros || []))
    : [];
  const verifTapes = prep && prep.ok && prep.numeroEcrit
    ? numeros.map((x, k) => (x ? validerNumeroTape(x, { pris: new Set(prep.pris || []), archive: prep.archive || '', cleNum: prep.cleNum, autres: numeros.filter((_, j) => j !== k && numeros[j]) }) : { ok: false, raison: 'vide' }))
    : null;
  const numerosPrets = numeros.length > 0 && numeros.every(Boolean) && (!verifTapes || verifTapes.every((v) => v.ok));
  const sigNums = numeros.join('|');
  // Les cases : la règle du Stock, recalculée quand les N° ou les cases changent ; SON choix gardé.
  React.useEffect(() => {
    if (!etat || !numerosPrets) { setCases(null); return; }
    const cleNum = coque.cleNum;
    const nums = deja.etat === 'attribue' ? numeros.filter((x) => !(etat.slots || {})[cleNum(x)]) : numeros;
    const r = casesArrivee({ meubles: etat.meubles, slots: etat.slots, numeros: nums.length ? nums : numeros, cleNum });
    setCases(r.su ? { ...r, pour: nums } : { su: false });
    setSel(0);
    const c0 = r.su && r.cases && r.cases.find(Boolean); setVueMeuble(c0 ? String(c0.meubleId) : (etat.meubles && etat.meubles[0] ? String(etat.meubles[0].id) : null));
  }, [sigNums, numerosPrets, etat]);   // eslint-disable-line react-hooks/exhaustive-deps

  const prix = prixPayeArrivee(e);
  const meubles = (etat && Array.isArray(etat.meubles) ? etat.meubles : []).filter((m) => m && m.id != null);
  const meubleVu = meubles.find((m) => String(m.id) === String(vueMeuble)) || meubles[0] || null;
  const listeCases = cases && cases.su ? cases.cases : [];
  const caseSel = listeCases[sel] || null;
  const infoCase = React.useMemo(() => {
    const parI = new Map();
    if (meubleVu && etat && etat.slots) for (const [cle, s] of Object.entries(etat.slots)) if (s && String(s.m) === String(meubleVu.id)) parI.set(Number(s.i), { num: cle, cle });
    return (i) => parI.get(i) || null;
  }, [meubleVu, etat]);
  const toucherCase = (i) => {
    if (!meubleVu || !cases || !cases.su) return;
    const c = autreCase({ meubles, slots: etat.slots, cases: listeCases, k: sel, m: meubleVu.id, i });
    if (!c) { setMsg(tr('arv.case.prise')); return; }
    setMsg(''); const l = listeCases.slice(); l[sel] = c; setCases({ ...cases, cases: l });
  };

  const ranger = async () => {
    if (envoi) return;
    setEnvoi(true); setMsg('');
    try {
      const r = await coque.ranger({ entree: e, numeros, cases: listeCases, n, attribue: deja.etat === 'attribue', horsLigne: !enReseau || (prep && prep.raison === 'horsLigne'), prix, duree: DUREE_ANNULER_ARRIVEE });
      if (r && r.ok) { setFait({ numeros: r.numeros || [], lignes: r.lignes || [], horsLigne: !!r.horsLigne, retire: !!r.retire }); return; }
      if (r && r.raison === 'pris') { setMsg(tr('arv.err.pris')); setJeton((j) => j + 1); return; }
      setMsg(tr('arv.err.' + (r && ['case', 'deja', 'lecture', 'numero'].includes(r.raison) ? r.raison : 'lecture')));
    } finally { setEnvoi(false); }
  };
  const etiq = fait ? etiquettesArrivee(methode, fait.lignes) : null;

  // ── ce qui se montre ──
  const titre = e.titre || tr('arv.sansTitre');
  const sousTitre = [e.taille ? (/^\d/.test(String(e.taille)) ? tr('arv.taille', { t: e.taille }) : e.taille) : '', e.compte || ''].filter(Boolean).join(' · ');
  const tete = (
    <Groupe attrs={{ 'data-arv-achat': e.tx || e.suivi || '' }}>
      <Rangee vignette={<Vignette src="" alt="" image={e.photo && Photo ? <Photo src={e.photo} alt=""/> : null}/>} titre={titre} lignes={2} sousTitre={sousTitre || undefined}/>
      <Rangee titre={tr('arv.paye')} valeur={prix ? monnaie(prix.centimes / 100) : '—'} detailValeur={prix ? tr(prix.source === 'recu' ? 'arv.paye.recu' : 'arv.paye.article') : (e.lot || n !== 1 ? tr('arv.paye.lot') : tr('arv.paye.pasLu'))}
        attrs={{ 'data-arv-prix': prix ? String(prix.centimes) : '', 'data-arv-prix-source': prix ? prix.source : '' }}/>
    </Groupe>
  );
  let corps;
  if (!deja.su) corps = <Groupe><Rangee titre={tr('arv.lecture')} attrs={{ 'data-arv-etat': 'lecture' }}/></Groupe>;
  else if (deja.etat === 'range' && !fait) {
    corps = (
      <Groupe titre={tr('arv.deja.titre')} pied={tr('arv.deja.pied')} attrs={{ 'data-arv-etat': 'deja' }}>
        {deja.fiches.map((f) => <Rangee key={f.id} titre={f.titre || titre} plaque={<Plaque numero={f.numero}/>} sousTitre={f.case ? placeEnMots({ meubleId: f.case.m, i: f.case.i }, meubles) : tr('arv.deja.sansCase')} attrs={{ 'data-arv-deja': String(f.numero) }}/>)}
      </Groupe>
    );
  } else if (fait) {
    corps = (
      <Groupe titre={tr('arv.fait.titre')} pied={fait.horsLigne ? tr('arv.fait.horsLigne') : tr('arv.fait.pied', { s: Math.round(DUREE_ANNULER_ARRIVEE / 1000) })} attrs={{ 'data-arv-etat': 'fait', 'data-arv-fait': (fait.numeros || []).join(',') }}>
        {(fait.lignes || []).map((l, k) => <Rangee key={k} titre={l.titre || titre} plaque={<Plaque numero={l.numero} grand/>} sousTitre={l.case ? placeEnMots(l.case, meubles) : tr('arv.case.aucune')} attrs={{ 'data-arv-range': String(l.numero) }}/>)}
        {fait.horsLigne ? <Rangee titre={tr('arv.fait.note')} attrs={{ 'data-arv-note': '' }}/> : null}
        {fait.retire ? <Rangee titre={tr('arv.fait.retire')} attrs={{ 'data-arv-retire': '' }}/> : null}
      </Groupe>
    );
  } else {
    const horsLigne = prep && prep.raison === 'horsLigne';
    corps = <>
      <Groupe titre={tr('arv.colis')} attrs={{ 'data-arv-n': n == null ? '' : String(n) }}>
        {n === 1 && !e.lot && nChoisi == null ? <Rangee titre={tr('arv.contient1')} attrs={{ 'data-arv-contient': '1' }}/> : (
          <Rangee titre={n == null ? tr('arv.combien') : tr('arv.contientN', { n })} attrs={{ 'data-arv-contient': n == null ? '' : String(n) }}
            fin={<span className="arv-compteur">
              <button type="button" className="arv-pas" aria-label={tr('arv.moins')} data-arv-moins="" disabled={(n || 1) <= 1} onClick={() => setNChoisi(Math.max(1, (n || 2) - 1))}>−</button>
              <button type="button" className="arv-pas" aria-label={tr('arv.plus')} data-arv-plus="" onClick={() => setNChoisi(Math.min(40, (n || 1) + 1))}>+</button>
            </span>}/>
        )}
      </Groupe>
      {horsLigne ? (
        <Groupe titre={tr('arv.numero')} pied={tr('arv.horsLigne.pied')} attrs={{ 'data-arv-etat': 'horsLigne' }}>
          <Rangee titre={tr('arv.horsLigne')}/>
        </Groupe>
      ) : n == null ? null : prep === undefined && deja.etat === 'nouveau' ? (
        <Groupe titre={tr('arv.numero')}><Rangee titre={tr('arv.lecture')} attrs={{ 'data-arv-etat': 'lecture' }}/></Groupe>
      ) : prep && !prep.ok && deja.etat === 'nouveau' ? (
        <Groupe titre={tr('arv.numero')} pied={tr('arv.err.lecturePied')} attrs={{ 'data-arv-etat': 'pasSu' }}><Rangee titre={tr('arv.err.lecture')}/></Groupe>
      ) : (
        <Groupe titre={n > 1 ? tr('arv.numeros') : tr('arv.numero')} pied={deja.etat === 'attribue' ? tr('arv.attribue') : prep && prep.numeroEcrit ? tr('arv.moi.pied') : ''} attrs={{ 'data-arv-numeros': numeros.join(','), 'data-arv-mode': deja.etat === 'attribue' ? 'attribue' : prep && prep.numeroEcrit ? 'moi' : 'vrm' }}>
          {numeros.map((x, k) => {
            const art = articles && articles[k];
            const nom = (art && art.titre) || (n > 1 ? tr('arv.paireK', { k: k + 1, n }) : titre);
            const c = listeCases[k];
            if (prep && prep.numeroEcrit) {
              const v = verifTapes ? verifTapes[k] : null;
              return (
                <div key={k} className="arv-saisie" data-arv-saisie={k}>
                  <label className="arv-saisie-l"><span>{nom}</span>
                    <input inputMode="text" autoCapitalize="characters" autoComplete="off" value={tapes[k] || ''} placeholder={tr('arv.moi.place')} aria-label={tr('arv.moi.aria', { k: k + 1 })}
                      onChange={(ev) => { const t = tapes.slice(); t[k] = ev.target.value; setTapes(t); }}/>
                  </label>
                  {x && v && !v.ok ? <small className="arv-saisie-err" data-arv-refus={v.raison}>{tr('arv.moi.refus.' + (['pris', 'archive', 'double', 'illisible'].includes(v.raison) ? v.raison : 'illisible'))}</small> : null}
                </div>
              );
            }
            return <Rangee key={k} titre={nom} plaque={<Plaque numero={x} grand/>} sousTitre={c ? placeEnMots(c, meubles) : cases && cases.su ? tr('arv.case.aucune') : ''}
              selectionnee={n > 1 && sel === k} onClick={n > 1 ? () => { setSel(k); if (c) setVueMeuble(String(c.meubleId)); } : undefined} attrs={{ 'data-arv-paire': String(x), 'data-arv-case': c ? `${c.meubleId}:${c.i}` : '' }}/>;
          })}
        </Groupe>
      )}
      {numerosPrets && cases && cases.su ? (
        meubles.length ? (
          <Groupe titre={tr('arv.case')} pied={msg && msg === tr('arv.case.prise') ? msg : tr('arv.case.pied')} attrs={{ 'data-arv-cases': listeCases.map((c) => (c ? `${c.meubleId}:${c.i}` : '-')).join(',') }}>
            {caseSel ? <Rangee titre={placeEnMots(caseSel, meubles)} attrs={{ 'data-arv-ici': `${caseSel.meubleId}:${caseSel.i}` }}/> : <Rangee titre={tr('arv.case.plein')} attrs={{ 'data-arv-ici': '' }}/>}
            {meubles.length > 1 ? (
              <div className="arv-meubles" role="tablist">
                {meubles.map((m) => <button key={m.id} type="button" role="tab" aria-selected={meubleVu && String(meubleVu.id) === String(m.id) ? 'true' : 'false'} className="arv-meuble-onglet" data-arv-meuble={String(m.id)} onClick={() => setVueMeuble(String(m.id))}>{m.name || tr('arv.case.meuble')}</button>)}
              </div>
            ) : null}
            {meubleVu ? <div className="arv-dessin"><MeubleDessin m={meubleVu} info={infoCase} mode="pres" vise={caseSel && String(caseSel.meubleId) === String(meubleVu.id) ? Number(caseSel.i) : null} onCase={toucherCase}/></div> : null}
          </Groupe>
        ) : <Groupe titre={tr('arv.case')}><Rangee titre={tr('arv.case.sansMeuble')} attrs={{ 'data-arv-ici': 'sans-meuble' }}/></Groupe>
      ) : null}
      {msg && msg !== tr('arv.case.prise') ? <p className="arv-msg" role="alert" data-arv-msg="">{msg}</p> : null}
    </>;
  }

  // Le plein : « Ranger ici » (un N° prêt), « Noter l'arrivée » (hors ligne), « Scanner le suivant » (fait / déjà rangé).
  const horsLigne = !!(prep && prep.raison === 'horsLigne');
  let pied = null;
  if (fait || (deja.su && deja.etat === 'range')) {
    pied = onSuivant ? <Bouton variante="plein" onClick={onSuivant} attrs={{ 'data-arv-suivant': suivantScan ? 'scan' : 'file' }}>{suivantScan ? tr('arv.suivant') : tr('arv.suivantFile')}</Bouton>
      : <Bouton variante="plein" onClick={onFermer} attrs={{ 'data-arv-fermer': '' }}>{tr('arv.terminer')}</Bouton>;
  } else if (horsLigne && deja.etat === 'nouveau') {
    pied = <Bouton variante="plein" chargement={envoi} onClick={ranger} attrs={{ 'data-arv-noter': '' }}>{tr('arv.noter')}</Bouton>;
  } else if (deja.su) {
    const pret = numerosPrets && cases && cases.su;
    pied = <Bouton variante="plein" chargement={envoi} indisponible={!pret} raison={!pret ? (prep && prep.numeroEcrit && !numerosPrets ? tr('arv.moi.raison') : n == null ? tr('arv.combien.raison') : '') : ''} onClick={ranger} attrs={{ 'data-arv-ranger': '' }}>
      {listeCases.some(Boolean) ? (n > 1 ? tr('arv.rangerN', { n }) : tr('arv.ranger')) : (n > 1 ? tr('arv.donnerN', { n }) : tr('arv.donner'))}
    </Bouton>;
  }
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('arv.titre')} detente="pleine" pied={pied} className="arv" attrs={{ 'data-arv': '', 'data-arv-tx': e.tx || '', 'data-arv-reseau': enReseau ? '1' : '0' }}>
      {tete}
      {corps}
      {fait && etiq ? (
        <Groupe attrs={{ 'data-arv-etiquette': etiq.format }}>
          <Rangee titre={etiq.etiquettes.length > 1 ? tr('arv.imprimerN', { n: etiq.etiquettes.length }) : tr('arv.imprimer')} sousTitre={tr('arv.imprimer.format', { f: etiq.format.replace('x', ' × ') })} fin="chevron"
            onClick={() => { try { coque.imprimer(etiq); } catch (_) {} }} attrs={{ 'data-arv-imprimer': etiq.etiquettes.map((x) => x.num).join(',') }}/>
        </Groupe>
      ) : null}
      {fait && onSuivant ? <Groupe><Rangee titre={tr('arv.terminer')} onClick={onFermer} attrs={{ 'data-arv-fermer': '' }}/></Groupe> : null}
    </Feuille>
  );
}
