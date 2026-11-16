// ── « LA PAIRE À SORTIR EN PREMIER » — MA JOURNÉE (15 nov. 2026, maquette validée par Julien) ──────
// Quand une vente tombe : la grande photo, la plaque N°, le site et le compte, la date limite, et OÙ
// est le carton (« Étagère A · rangée 2 · case 3 » + le mini-plan du meuble, la case allumée) ; un
// geste : « Je l'ai sortie », puis « Imprimer le bordereau ». Plusieurs ventes : la plus pressée
// d'abord, puis le même meuble à la suite. Sans emplacement connu : dit franchement + « Ranger
// d'abord ». Après « Je l'ai sortie » : la pile descend (la règle du Stock) — dit une fois, « Compris ».
//
// ⚠️ CE FICHIER NE DÉCIDE RIEN. L'ordre et l'emplacement viennent de src/paireASortir.js (par
//    IDENTITÉ du N°, jamais un titre) ; le geste « Je l'ai sortie » est celui du Stock (la
//    déclaration `vinted_pairs_lost` + la case libérée, la pile tassée — `opsSortieCases`), passé
//    par Ma journée (`onSortir`, un geste annulable accompagné). Récit :
//    docs/passation/2026-11-15-refonte-journee.md.
import React from 'react';
import { tr } from './i18n/index.js';
import MarquePlateforme from './plateformes/Marque.jsx';
import { planAutour, aideLieu } from './paireASortir.js';

const Plq = ({ num, taille = '' }) => (num ? <span className={'sb-plaque vrm-so-pq' + (taille ? ' is-' + taille : '')} data-so-plaque={num}><small>N°</small>{num}</span> : null);

// Le mini-plan du meuble : la case visée allumée (sa photo dedans), les autres cases prises en tuiles
// blanches, les libres en creux pointillés ; les numéros de rangée et de colonne (les VRAIS, même dans
// la fenêtre d'un grand meuble), celui de la cible à l'accent.
function MiniPlan({ lieu, slots, photo, Photo }) {
  const p = planAutour(lieu, slots, { max: 6 });
  if (!p) return null;
  const n = Math.max(p.cols.length, p.lignes.length);
  const s = n >= 6 ? 15 : n >= 5 ? 17 : 20;
  return (
    <div className="vrm-so-plan" style={{ '--s': s + 'px' }} aria-hidden="true" data-so-plan={`${lieu.rangee}:${lieu.colonne}`} data-so-plan-coupe={p.coupe ? '1' : undefined}>
      <div className="vrm-so-pl-row is-lab"><b/>{p.cols.map((c) => <b key={c} className={c === lieu.colonne ? 'is-on' : ''}>{c}</b>)}</div>
      {p.lignes.map((l) => (
        <div key={l.r} className="vrm-so-pl-row">
          <b className={l.r === lieu.rangee ? 'is-on' : ''}>{l.r}</b>
          {l.cases.map((c) => (
            <i key={c.c} className={'vrm-so-pc is-' + c.etat} data-so-case={c.etat === 'cible' ? 'cible' : undefined}>
              {c.etat === 'cible' && photo && Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async" width={s} height={s}/> : null}
            </i>
          ))}
        </div>
      ))}
    </div>
  );
}

// Une pile en miniature (Avant / Maintenant) : du haut vers le bas ; `cible` = la case vidée (Avant).
function MiniPile({ col, cible = -1, descendus = [] }) {
  return (
    <div className="vrm-so-mp">
      {col.map((k, r) => k
        ? <span key={r} className={'vrm-so-mb' + (r === cible ? ' is-on' : '') + (descendus.includes(k) ? ' is-fl' : '')}>N°{k}{descendus.includes(k) ? <i aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></i> : null}</span>
        : <span key={r} className="vrm-so-mb is-vide"/>)}
    </div>
  );
}

const lieuEnMots = (lieu) => {
  if (!lieu) return '';
  if (lieu.pile) return (lieu.depuisBas === 1 ? tr('sortir.pileBas') : tr('sortir.pileN', { n: lieu.depuisBas }));
  return tr('sortir.rangeeCase', { r: lieu.rangee, c: lieu.colonne });
};
const aideEnMots = (lieu) => { const a = aideLieu(lieu); return a ? tr(a.cle, a) : ''; };
const nomMeuble = (lieu) => (lieu && lieu.nom) || tr('sortir.meuble');

// La ligne « site + compte » posée sur la photo.
const Site = ({ v }) => (v.site || v.compte ? (
  <span className="vrm-so-site" data-so-site={v.site || ''}>{v.site ? <MarquePlateforme site={v.site} taille={13}/> : null}{v.compte ? <span>{v.compte}</span> : null}</span>
) : null);

function Carte({ v, total, rang, slots, Photo, Icon, mots, onSortir, onImprimer, onRanger, compact = false }) {
  const lieu = v.lieu;
  const meta = [v.taille ? 'T' + v.taille : '', v.prix || '', v.acheteur ? tr('sortir.acheteur', { qui: v.acheteur }) : ''].filter(Boolean).join(' · ');
  const raison = { sansNumero: 'sortir.inconnu.sansNumero', pasRange: 'sortir.inconnu.pasRange', meubleAbsent: 'sortir.inconnu.meubleAbsent', horsMeuble: 'sortir.inconnu.horsMeuble', doublon: 'sortir.inconnu.doublon' }[v.raison] || 'sortir.inconnu.pasRange';
  // (16 nov., lot personnalisation-simple — Julien : la grande photo et le bloc pointillé prenaient tout l'écran à 390 px)
  // AU TÉLÉPHONE, la carte est COMPACTE : une vignette à gauche, le N°, le site, le rang et la date à côté ; le lieu (ou
  // « VRM ne sait pas où… », en plus petit) ; « Je l'ai sortie » reste le plein de la carte. Les mêmes `data-*`.
  if (compact) return (
    <div className={'vrm-so-carte is-compact' + (total > 1 ? ' is-plusieurs' : '')} data-sortir-premier={v.cle} data-sortir-compact="" data-sortir-num={v.num || ''} data-sortir-lieu={lieu ? `${lieu.meubleId}:${lieu.i}` : ''} data-sortir-raison={lieu ? undefined : (v.raison || 'pasRange')}>
      <div className="vrm-so-c-tete">
        <div className="vrm-so-ph">{v.photo && Photo ? <Photo src={v.photo} alt="" loading="lazy" decoding="async" width={72} height={72}/> : <span className="vrm-so-ph-vide" aria-hidden="true">{Icon ? <Icon name="box" size={24}/> : null}</span>}</div>
        <div className="vrm-so-m">
          <span className="vrm-so-c-l1"><Plq num={v.num}/>{v.site || v.compte ? <span className="vrm-so-c-site" data-so-site={v.site || ''}>{v.site ? <MarquePlateforme site={v.site} taille={12}/> : null}{v.compte ? <span>{v.compte}</span> : null}</span> : null}{total > 1 ? <span className="vrm-so-c-rang">{tr('sortir.rangSur', { k: rang, n: total })}</span> : null}</span>
          <b>{v.titre || tr('sortir.sansTitre')}</b>
          {v.echeance ? <span className={'vrm-so-lim' + (v.echeanceAmbre === false ? '' : ' is-ambre')} data-sortir-limite="">{Icon ? <Icon name="clock" size={13}/> : null}{v.echeance}</span> : meta ? <span>{meta}</span> : null}
        </div>
      </div>
      {lieu ? (
        <div className="vrm-so-ou" data-sortir-ou="">
          <MiniPlan lieu={lieu} slots={slots} photo={v.photo} Photo={Photo}/>
          <div className="vrm-so-ou-t">
            <b data-sortir-meuble="">{nomMeuble(lieu)}</b>
            <em data-sortir-place="">{lieuEnMots(lieu)}</em>
            {aideEnMots(lieu) ? <small>{aideEnMots(lieu)}</small> : null}
          </div>
        </div>
      ) : (
        <div className="vrm-so-inc" data-sortir-inconnu={v.raison || 'pasRange'}>
          <div><b>{tr('sortir.inconnu.titre', { ce: mots.ce })}</b><span>{tr(raison, { num: v.num || '', nom: mots.nom })}</span></div>
        </div>
      )}
      <button type="button" className="sb-btn-plein vrm-so-plein" data-sortir-geste="sortie" data-sortir-cle={v.cle} onClick={() => onSortir(v)}>
        {Icon ? <Icon name="check" size={20}/> : null}<span>{tr(mots.e ? 'sortir.jeLaiSortieF' : 'sortir.jeLaiSortie')}</span>
      </button>
      {lieu
        ? (onImprimer ? <button type="button" className="sb-touche vrm-so-touche" data-sortir-imprimer="" onClick={onImprimer}>{Icon ? <Icon name="printer" size={18}/> : null}<span>{tr('sortir.puisImprimer')}</span></button> : null)
        : <button type="button" className="sb-touche vrm-so-touche" data-sortir-ranger={v.num || ''} onClick={() => onRanger(v)}>{Icon ? <Icon name="box" size={18}/> : null}<span>{tr('sortir.rangerDabord')}</span></button>}
    </div>
  );
  return (
    <div className={'vrm-so-carte' + (total > 1 ? ' is-plusieurs' : '')} data-sortir-premier={v.cle} data-sortir-num={v.num || ''} data-sortir-lieu={lieu ? `${lieu.meubleId}:${lieu.i}` : ''} data-sortir-raison={lieu ? undefined : (v.raison || 'pasRange')}>
      <div className="vrm-so-ph">
        {v.photo && Photo ? <Photo src={v.photo} alt="" loading="lazy" decoding="async"/> : <span className="vrm-so-ph-vide" aria-hidden="true">{Icon ? <Icon name="box" size={40}/> : null}</span>}
        {v.num ? <span className="vrm-so-ph-pq"><Plq num={v.num} taille="xl"/></span> : null}
        <Site v={v}/>
        {total > 1 ? <span className="vrm-so-rang">{tr('sortir.rangSur', { k: rang, n: total })}</span> : null}
      </div>
      <div className="vrm-so-m">
        <b>{v.titre || tr('sortir.sansTitre')}</b>
        {meta ? <span>{meta}</span> : null}
        {v.echeance ? <span className={'vrm-so-lim' + (v.echeanceAmbre === false ? '' : ' is-ambre')} data-sortir-limite="">{Icon ? <Icon name="clock" size={13}/> : null}{v.echeance}</span> : null}
      </div>
      {lieu ? (
        <div className="vrm-so-ou" data-sortir-ou="">
          <MiniPlan lieu={lieu} slots={slots} photo={v.photo} Photo={Photo}/>
          <div className="vrm-so-ou-t">
            <span className="vrm-so-ds">{tr('sortir.ouCarton')}</span>
            <b data-sortir-meuble="">{nomMeuble(lieu)}</b>
            <em data-sortir-place="">{lieuEnMots(lieu)}</em>
            {aideEnMots(lieu) ? <small>{aideEnMots(lieu)}</small> : null}
          </div>
        </div>
      ) : (
        <div className="vrm-so-inc" data-sortir-inconnu={v.raison || 'pasRange'}>
          <span className="vrm-so-q" aria-hidden="true">?</span>
          <div><b>{tr('sortir.inconnu.titre', { ce: mots.ce })}</b><span>{tr(raison, { num: v.num || '', nom: mots.nom })}</span></div>
        </div>
      )}
      <button type="button" className="sb-btn-plein vrm-so-plein" data-sortir-geste="sortie" data-sortir-cle={v.cle} onClick={() => onSortir(v)}>
        {Icon ? <Icon name="check" size={20}/> : null}<span>{tr(mots.e ? 'sortir.jeLaiSortieF' : 'sortir.jeLaiSortie')}</span>
      </button>
      {lieu
        ? (onImprimer ? <button type="button" className="sb-touche vrm-so-touche" data-sortir-imprimer="" onClick={onImprimer}>{Icon ? <Icon name="printer" size={18}/> : null}<span>{tr('sortir.puisImprimer')}</span></button> : null)
        : <button type="button" className="sb-touche vrm-so-touche" data-sortir-ranger={v.num || ''} onClick={() => onRanger(v)}>{Icon ? <Icon name="box" size={18}/> : null}<span>{tr('sortir.rangerDabord')}</span></button>}
    </div>
  );
}

// liste : l'ordre de sortie (`ordreDeSortie(...).aSortir`) ; nSorties : celles déjà sorties par son geste.
// apres : { num, lieu, colAvant, colApres, cible, descendus, phrase } posé par Ma journée juste après
// « Je l'ai sortie » ; onCompris l'efface (dit une fois).
export default function PaireASortir({ liste, nSorties = 0, slots, Photo, Icon, mots, apres = null, onSortir, onImprimer, onRanger, onCompris, toutesImprimer = null, ordi = false }) {
  const l = Array.isArray(liste) ? liste : [];
  const total = l.length + nSorties;
  if (!l.length && !apres) return null;
  const premier = l[0];
  const suite = l.slice(1, 4);
  const uneSeule = total === 1;
  return (
    <section className="vrm-so" data-sortir-ordi={ordi ? '1' : undefined} data-sortir="" data-sortir-n={String(l.length)} data-sortir-sorties={String(nSorties)} aria-label={tr('sortir.aria')}>
      {apres ? (
        <>
          <div className="vrm-so-sec"><b data-sortir-compte="">{tr('sortir.surSorties', { k: nSorties, n: total })}</b>
            <span className="vrm-so-ok3" aria-hidden="true">{Array.from({ length: Math.min(total, 5) }, (_, k) => <i key={k} className={k < nSorties ? 'is-ok' : ''}>{Icon && k < nSorties ? <Icon name="check" size={10}/> : null}</i>)}</span></div>
          <div className="vrm-so-carte vrm-so-d" data-sortir-apres={apres.num || ''} data-sortir-descendus={(apres.descendus || []).join(',')}>
            <div className="vrm-so-d-h"><span className="vrm-so-d-ok" aria-hidden="true">{Icon ? <Icon name="check" size={22}/> : null}</span>
              <div><b>{tr(mots.e ? 'sortir.estSortieF' : 'sortir.estSortie', { num: apres.num || '' })}</b><span>{apres.lieu ? tr('sortir.caseLibre', { meuble: nomMeuble(apres.lieu) }) : tr('sortir.declaree')}</span></div></div>
            {apres.descendus && apres.descendus.length ? (<>
              <div className="vrm-so-d-p">
                <div className="vrm-so-d-c"><span className="vrm-so-ds">{tr('sortir.avant')}</span><MiniPile col={apres.colAvant} cible={apres.cible}/></div>
                <span className="vrm-so-d-f" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
                <div className="vrm-so-d-c"><span className="vrm-so-ds">{tr('sortir.maintenant')}</span><MiniPile col={apres.colApres} descendus={apres.descendus}/></div>
              </div>
              <p className="vrm-so-d-t" data-sortir-phrase="">{apres.phrase} {tr('sortir.numNeChangePas')}</p>
            </>) : null}
            <div className="vrm-so-d-a"><button type="button" className="sb-lien" data-sortir-compris="" onClick={onCompris}>{tr('sortir.compris')}</button></div>
          </div>
          {!l.length && toutesImprimer ? (
            <div className="vrm-so-carte vrm-so-fin" data-sortir-fin={String(nSorties)}>
              <div><b>{tr((nSorties > 1 ? 'sortir.toutesSorties' : 'sortir.laSortie') + (mots.e ? 'F' : ''), { n: nSorties })}</b>
                {toutesImprimer.nums && toutesImprimer.nums.length ? <span>{tr('sortir.bordereauxPrets', { liste: toutesImprimer.nums.map((n) => 'N°' + n).join(', ') })}</span> : null}</div>
              <button type="button" className="sb-btn-plein vrm-so-plein" data-sortir-imprimer-tout="" onClick={toutesImprimer.imprimer}>
                {Icon ? <Icon name="printer" size={20}/> : null}<span>{(toutesImprimer.n > 1 ? tr('sj.imprimerLesN', { n: toutesImprimer.n }) : tr('sj.imprimerLe'))}</span></button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="vrm-so-sec"><b>{uneSeule ? tr(mots.e ? 'sortir.vendueASortirF' : 'sortir.vendueASortir') : tr('sortir.nASortir', { n: total })}</b>{uneSeule ? <span>{tr('sortir.uneVente')}</span> : null}</div>
      )}
      {!apres && !uneSeule ? <p className="vrm-so-regle" data-sortir-regle="">{tr('sortir.regle')}</p> : null}
      {premier ? (
        <Carte v={premier} total={total} rang={nSorties + 1} slots={slots} Photo={Photo} Icon={Icon} mots={mots} onSortir={onSortir} onImprimer={onImprimer} onRanger={onRanger} compact={!ordi}/>
      ) : null}
      {suite.length && !apres ? (
        <div className="vrm-so-suite" data-sortir-suite={String(l.length - 1)}>
          {ordi ? <span className="vrm-so-ds vrm-so-ensuite">{tr('sj.v.ensuite')}</span> : null}
          <div role="list" className="vrm-so-suite-l">
          {suite.map((x, k) => (
            <div key={x.cle} role="listitem" className="vrm-so-ss" data-sortir-rang={String(k + 2)} data-sortir-num={x.num || ''} data-sortir-lieu={x.lieu ? `${x.lieu.meubleId}:${x.lieu.i}` : ''}>
              <span className="vrm-so-ss-n">{k + 2 + nSorties}</span>
              <span className="vrm-so-ss-ph">{x.photo && Photo ? <Photo src={x.photo} alt="" loading="lazy" decoding="async" width={44} height={44}/> : (Icon ? <Icon name="box" size={18}/> : null)}</span>
              <span className="vrm-so-ss-mid">
                <span className="vrm-so-ss-l1"><Plq num={x.num}/>{x.site ? <MarquePlateforme site={x.site} taille={12}/> : null}{x.compte ? <span className="vrm-so-cpt">{x.compte}</span> : null}</span>
                <span className="vrm-so-ss-ou">{Icon ? <Icon name="pin" size={13}/> : null}{x.lieu ? `${nomMeuble(x.lieu)} · ${lieuEnMots(x.lieu)}` : tr('sortir.ouInconnu')}</span>
              </span>
              <span className="vrm-so-ss-end"><b>{x.echeanceCourte || ''}</b></span>
            </div>
          ))}
          {l.length > 4 ? <div className="vrm-so-ss vrm-so-ss-plus" role="listitem">{tr('sortir.autres', { n: l.length - 4 })}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
