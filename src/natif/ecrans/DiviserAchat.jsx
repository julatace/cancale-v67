// ── src/natif/ecrans/DiviserAchat.jsx — « Diviser cet achat » (22 nov., lot achats-lot) ─────────────────────────────
// La feuille d'UN achat : un lot (prouvé par SA transaction, ou « peut-être » par le titre) ou un achat simple, divisé
// en N parts par SON toucher, le prix réparti au centime (src/achatDivise.js : la règle, exécutée telle quelle ici et
// dans la coque, qui la rejoue avant d'écrire). Une VUE : elle ne lit rien, n'écrit rien ; elle appelle `onDiviser`,
// `onRepartir`, `onRegrouper` (la coque : src/ecrans/Comptabilite.jsx).
//
// Props :
//   ouverte, onFermer
//   achat        { tx, titre, photo, prix (texte), date (texte), compte }
//   lot          `lotDeLAchat(...)` : { etat, n, par }
//   articles     les articles lus dans SA transaction [{ item, titre, photo, taille, prix }] (undefined/null : pas lus)
//   totalInfo    `totalADiviser(...)` : { total, source, detail, rembourse, raison }
//   fichesLibres [{ cle, numero, titre, photo, prixSaisi (c|null), prixVente (c|null) }] — ses paires numérotées sans achat
//   prixVenteDe(N°) → centimes | null (le prix de vente LU d'une part : « Prix de vente »)
//   apercuNumeros(k) → [N°…] (les k prochains, rien de réservé) | null (pas su)
//   numeroEcrit  vrai ⇒ il tape lui-même les N° (Réglages)
//   division     la division en cours (`divisionActive`) ou null ; historique (les divisions closes)
//   regroupement `peutRegrouper(...)` : { ok, raison, nums }
//   onDiviser(d) / onRepartir(d) / onRegrouper() → promesse { ok, raison } ; Icon
import React from 'react';
import { tr, monnaie } from '../../i18n/index.js';
import { Feuille, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Segmente, Pastille, Champ } from '../index.js';
import '../lot-achat.css';
import { repartirParts, modesPossibles, PARTS_MIN, PARTS_MAX } from '../../achatDivise.js';

const eur = (c) => (Number.isSafeInteger(c) ? monnaie(c / 100) : '—');
const pourTexte = (c) => (Number.isSafeInteger(c) ? (c / 100).toFixed(2).replace('.', ',') : '');

function Pas({ n, setN, Icon, bloque }) {
  return (
    <Rangee titre={tr('lotachat.parts')} sousTitre={bloque ? tr('lotachat.partsLues') : tr('lotachat.partsAide', { min: PARTS_MIN, max: PARTS_MAX })}
      valeur={String(n)} valeurForte attrs={{ 'data-lot-n': String(n) }}
      pied={<span className="n-lot-pas">
        <BoutonIcone libelle={tr('lotachat.moins')} icone={Icon ? <Icon name="minus" size={20}/> : '−'} indisponible={n <= PARTS_MIN} raison={tr('lotachat.min', { n: PARTS_MIN })} onClick={() => setN(Math.max(PARTS_MIN, n - 1))} attrs={{ 'data-lot-moins': '' }}/>
        <BoutonIcone libelle={tr('lotachat.plus')} icone={Icon ? <Icon name="plus" size={20}/> : '+'} indisponible={n >= PARTS_MAX} raison={tr('lotachat.max', { n: PARTS_MAX })} onClick={() => setN(Math.min(PARTS_MAX, n + 1))} attrs={{ 'data-lot-plus': '' }}/>
      </span>}/>
  );
}

export default function DiviserAchat({ ouverte = false, onFermer, achat = null, lot = null, articles = null, totalInfo = null, fichesLibres = [], apercuNumeros = null, numeroEcrit = false,
  prixVenteDe = null, division = null, regroupement = null, onDiviser = null, onRepartir = null, onRegrouper = null, Icon = null }) {
  const lus = Array.isArray(articles) && articles.length > 1 ? articles : null;
  const nDepart = division ? division.parts.length : lus ? lus.length : lot && lot.n ? lot.n : 2;
  const [vue, setVue] = React.useState(division ? 'division' : 'diviser');
  const [n, setNbrut] = React.useState(nDepart);
  const [mode, setMode] = React.useState(division ? division.mode : lus && lus.every((a) => a.prix > 0) ? 'articles' : 'egal');
  const [fraisMode, setFraisMode] = React.useState('prorata');
  const [manuels, setManuels] = React.useState([]);
  const [cibles, setCibles] = React.useState([]);      // par part : { type: 'neuf' } | { type: 'fiche', cle }
  const [titres, setTitres] = React.useState([]);
  const [tapes, setTapes] = React.useState([]);        // N° tapés (numérotation à la main)
  const [choix, setChoix] = React.useState(-1);        // la part dont on choisit la paire
  React.useEffect(() => { if (ouverte) { setVue(division ? 'division' : 'diviser'); setNbrut(nDepart); setChoix(-1); } }, [ouverte, division]);   // eslint-disable-line react-hooks/exhaustive-deps
  const setN = (k) => { setNbrut(k); setChoix(-1); };
  const total = totalInfo ? totalInfo.total : null;
  const enRepartition = vue === 'repartir' && division;
  const nEff = enRepartition ? division.parts.length : n;
  const cibleDe = (i) => (enRepartition ? (division.parts[i].fiche ? { type: 'fiche', cle: division.parts[i].fiche } : { type: 'neuf' }) : (cibles[i] || { type: 'neuf' }));
  const ficheDe = (i) => { const c = cibleDe(i); return c.type === 'fiche' ? fichesLibres.find((f) => f.cle === c.cle) || null : null; };
  const neufs = [...Array(nEff).keys()].filter((i) => cibleDe(i).type === 'neuf');
  const apercu = enRepartition ? null : numeroEcrit ? null : (apercuNumeros ? apercuNumeros(neufs.length) : null);
  const numeroDe = (i) => {
    if (enRepartition) return division.parts[i].numero || '';
    const f = ficheDe(i); if (f) return f.numero;
    if (numeroEcrit) return String(tapes[i] || '').trim();
    const j = neufs.indexOf(i); return apercu && apercu[j] != null ? String(apercu[j]) : '';
  };
  const articleDe = (i) => (enRepartition ? division.parts[i] : lus && lus.length === nEff ? lus[i] : null);
  const fixes = {};
  for (let i = 0; i < nEff; i++) {
    if (enRepartition) { if (division.parts[i].saisie) fixes[i] = division.parts[i].prix; continue; }
    const f = ficheDe(i); if (f && Number.isSafeInteger(f.prixSaisi)) fixes[i] = f.prixSaisi;
  }
  const poids = {
    articles: lus && lus.length === nEff ? lus.map((a) => a.prix) : (enRepartition ? division.parts.map((p) => (articles && p.item ? (articles.find((a) => a.item === p.item) || {}).prix : null)) : []),
    ventes: [...Array(nEff).keys()].map((i) => { if (enRepartition) return prixVenteDe ? prixVenteDe(division.parts[i].numero) : null; const f = ficheDe(i); return f ? f.prixVente : null; }),
  };
  const possibles = modesPossibles({ n: nEff, poids });
  const modeEff = possibles.includes(mode) ? mode : 'egal';
  const detail = totalInfo && totalInfo.detail;
  const fp = detail ? detail.port + detail.frais : 0;
  const rep = Number.isSafeInteger(total) ? repartirParts({ total, n: nEff, mode: modeEff, poids, manuels, fixes, detail, fraisMode }) : null;
  const numerosManquants = !enRepartition && neufs.some((i) => !numeroDe(i));
  const doublonTape = numeroEcrit && !enRepartition && new Set(neufs.map((i) => numeroDe(i).toUpperCase()).filter(Boolean)).size !== neufs.filter((i) => numeroDe(i)).length;
  const raison = total == null ? tr('lotachat.raison.' + ((totalInfo && totalInfo.raison) || 'prix'))
    : !rep || !rep.ok ? (rep && rep.raison === 'ecart' ? tr('lotachat.resteBloque', { reste: eur(rep.reste) }) : rep && rep.raison === 'fixes' ? tr('lotachat.raison.fixes') : tr('lotachat.raison.illisible'))
      : numerosManquants ? (numeroEcrit ? tr('lotachat.raison.tape') : tr('lotachat.raison.numeros')) : doublonTape ? tr('lotachat.raison.doublon') : '';
  const pret = !raison;
  const changer = (setter, i, v) => setter((l) => { const u = l.slice(); u[i] = v; return u; });
  const choisis = new Set([...Array(nEff).keys()].map((i) => (cibleDe(i).type === 'fiche' ? cibleDe(i).cle : null)).filter(Boolean));
  const lancer = async () => {
    const d = { n: nEff, mode: modeEff, fraisMode, manuels: manuels.slice(0, nEff), titres: [...Array(nEff).keys()].map((i) => String(titres[i] || '').trim()),
      cibles: [...Array(nEff).keys()].map((i) => { const c = cibleDe(i); return c.type === 'fiche' ? { type: 'fiche', cle: c.cle } : { type: 'neuf', numero: numeroDe(i) }; }), apercu };
    const r = enRepartition ? await onRepartir(d) : await onDiviser(d);
    if (r && r.ok) { onFermer && onFermer(); return enRepartition ? tr('lotachat.reparti') : tr('lotachat.divise', { n: nEff }); }
    throw new Error(tr('lotachat.echec.' + ((r && r.raison) || 'lecture')));
  };
  const etiquetteLot = !lot ? null : lot.etat === 'divise' ? <Pastille ton="accent">{tr('lotachat.diviseEn', { n: lot.n })}</Pastille>
    : lot.etat === 'prouve' ? <Pastille ton="accent">{tr('lotachat.lotDe', { n: lot.n })}</Pastille>
      : lot.etat === 'peutEtre' ? <Pastille>{tr('lotachat.peutEtre')}</Pastille> : null;
  const phraseLot = !lot ? '' : lot.etat === 'prouve' ? tr(lot.par === 'articles' ? 'lotachat.prouveArticles' : 'lotachat.prouveNombre', { n: lot.n })
    : lot.etat === 'peutEtre' ? tr('lotachat.peutEtreDit') : lot.etat === 'simple' ? tr('lotachat.simpleDit') : '';
  const phraseTotal = total == null ? '' : totalInfo.source === 'recu'
    ? (fp > 0 ? tr('lotachat.totalRecuDetail', { articles: eur(detail.articles), port: eur(detail.port), frais: eur(detail.frais) }) : tr('lotachat.totalRecu'))
    : tr('lotachat.totalCommande');
  const phraseRemb = totalInfo && totalInfo.rembourse ? tr('lotachat.rembDeduit', { montant: eur(totalInfo.rembourse) }) : '';
  const titreFeuille = division ? (enRepartition ? tr('lotachat.titreRepartir') : tr('lotachat.titreDivision')) : tr('lotachat.titre');
  const plein = vue === 'division' ? null
    : <Bouton variante="plein" indisponible={!pret} raison={raison} onClick={lancer} attrs={{ 'data-lot-valider': pret ? 'pret' : 'bloque' }}>
      {enRepartition ? tr('lotachat.enregistrer') : tr('lotachat.diviserEn', { n: nEff })}</Bouton>;
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={titreFeuille} detente="pleine" pied={plein} attrs={{ 'data-diviser-achat': achat ? achat.tx : '' }}>
      {achat ? <Groupe>
        <Rangee vignette={<Vignette src={achat.photo || ''} alt="" taille={44}/>} titre={achat.titre || tr('lotachat.sansTitre')} lignes={2}
          sousTitre={[achat.date, achat.compte].filter(Boolean).join(' · ')} valeur={achat.prix || null} valeurForte pastilleSous={etiquetteLot}
          note={phraseLot} attrs={{ 'data-lot-etat': lot ? lot.etat : '' }}/>
      </Groupe> : null}

      {vue === 'division' && division ? <>
        <Groupe titre={tr('lotachat.lesParts', { n: division.parts.length })} pied={tr('lotachat.sommeJuste', { total: eur(division.total) })}>
          {division.parts.map((p) => <Rangee key={p.id} vignette={<Vignette src={p.photo || ''} alt="" taille={44}/>} titre={p.titre || tr('lotachat.article', { k: p.k })}
            plaque={p.numero ? <Plaque numero={p.numero}/> : null} sousTitre={p.saisie ? tr('lotachat.prixGarde') : tr('lotachat.partDe', { k: p.k, n: division.parts.length })}
            valeur={eur(p.prix)} attrs={{ 'data-lot-part': p.id, 'data-lot-part-prix': String(p.prix) }}/>)}
        </Groupe>
        <Groupe>
          <Rangee titre={tr('lotachat.changerRepartition')} fin="chevron" onClick={() => { setMode(division.mode); setManuels(division.parts.map((p) => pourTexte(p.prix))); setVue('repartir'); }} attrs={{ 'data-lot-changer': '' }}/>
        </Groupe>
        <Groupe titre={tr('lotachat.historique')}>
          {(division.historique || []).slice().reverse().map((h, i) => <Rangee key={i} titre={tr('lotachat.geste.' + h.geste, { n: h.n })}
            sousTitre={[h.at ? new Date(h.at).toLocaleString() : '', tr('lotachat.mode.' + (h.mode || 'egal'))].filter(Boolean).join(' · ')} valeur={eur(h.total)} attrs={{ 'data-lot-historique': h.geste }}/>)}
        </Groupe>
        <div className="n-lot-regrouper">
          {regroupement && regroupement.ok
            ? <Bouton variante="destructif" confirmation={tr('lotachat.regrouperConfirme')} onClick={async () => { const r = await onRegrouper(); if (r && r.ok) { onFermer && onFermer(); return tr('lotachat.regroupe'); } throw new Error(tr('lotachat.echec.' + ((r && r.raison) || 'lecture'))); }} attrs={{ 'data-lot-regrouper': 'ok' }}>{tr('lotachat.regrouper')}</Bouton>
            : <Bouton indisponible raison={regroupement ? tr('lotachat.pasRegrouper.' + (regroupement.raison || 'passu'), { nums: (regroupement.nums || []).map((x) => 'N°' + x).join(', ') }) : tr('lotachat.pasRegrouper.passu', { nums: '' })} attrs={{ 'data-lot-regrouper': 'non' }}>{tr('lotachat.regrouper')}</Bouton>}
        </div>
      </> : <>
        {!enRepartition ? <Groupe titre={tr('lotachat.combien')}><Pas n={n} setN={setN} Icon={Icon} bloque={!!lus && n === lus.length}/></Groupe> : null}

        <Groupe titre={tr('lotachat.lesArticles')} pied={rep && rep.arrondi && rep.arrondi.length ? tr('lotachat.arrondi', { n: rep.arrondi.length, rangs: rep.arrondi.map((i) => i + 1).join(', ') }) : ''}>
          {[...Array(nEff).keys()].map((i) => {
            const a = articleDe(i), f = enRepartition ? null : ficheDe(i), num = numeroDe(i), part = rep && rep.parts ? rep.parts[i] : null;
            const titre = (a && a.titre) || (f && f.titre) || String(titres[i] || '').trim() || tr('lotachat.article', { k: i + 1 });
            const fixe = fixes[i] != null;
            const sous = fixe ? tr('lotachat.prixGarde') : enRepartition ? tr('lotachat.partDe', { k: i + 1, n: nEff }) : f ? tr('lotachat.paireNumerotee') : tr('lotachat.nouveauNumero');
            const champs = [];
            if (!enRepartition && !f && !(a && a.titre)) champs.push(<Champ key="t" libelle={tr('lotachat.nommer')} valeur={titres[i] || ''} onChange={(v) => changer(setTitres, i, v)} placeholder={tr('lotachat.article', { k: i + 1 })} attrs={{ 'data-lot-nom': String(i + 1) }}/>);
            if (!enRepartition && !f && numeroEcrit) champs.push(<Champ key="n" libelle={tr('lotachat.numeroTape')} valeur={tapes[i] || ''} onChange={(v) => changer(setTapes, i, v)} inputMode="text" attrs={{ 'data-lot-tape': String(i + 1) }}/>);
            if (modeEff === 'main' && !fixe) champs.push(<Champ key="m" libelle={tr('lotachat.montant')} valeur={manuels[i] || ''} onChange={(v) => changer(setManuels, i, v)} inputMode="decimal" suffixe="€" attrs={{ 'data-lot-main': String(i + 1) }}/>);
            return <React.Fragment key={i}>
              <Rangee vignette={<Vignette src={(a && a.photo) || (f && f.photo) || ''} alt="" taille={44}/>} titre={titre} lignes={2}
                plaque={num ? <Plaque numero={num}/> : null} sousTitre={sous} valeur={modeEff === 'main' && !fixe ? null : eur(part)}
                detailValeur={a && Number.isSafeInteger(a.prix) && !enRepartition ? tr('lotachat.prixAffiche', { prix: eur(a.prix) }) : ''}
                fin={enRepartition ? null : 'chevron'} onClick={enRepartition ? null : () => setChoix((c) => (c === i ? -1 : i))}
                pied={champs.length ? <span className="n-lot-champs">{champs}</span> : null}
                attrs={{ 'data-lot-ligne': String(i + 1), 'data-lot-ligne-prix': part != null ? String(part) : '', 'data-lot-ligne-num': num || '' }}/>
              {choix === i ? <Groupe titre={tr('lotachat.quellePaire', { k: i + 1 })} attrs={{ 'data-lot-choix': String(i + 1) }}>
                <Rangee titre={tr('lotachat.nouveauNumero')} fin={!f ? 'coche' : null} onClick={() => { changer(setCibles, i, { type: 'neuf' }); setChoix(-1); }} attrs={{ 'data-lot-choisir': 'neuf' }}/>
                {fichesLibres.filter((x) => !choisis.has(x.cle) || (f && f.cle === x.cle)).slice(0, 40).map((x) => <Rangee key={x.cle} vignette={<Vignette src={x.photo || ''} alt="" taille={44}/>}
                  titre={x.titre || tr('lotachat.sansTitre')} plaque={<Plaque numero={x.numero}/>} sousTitre={Number.isSafeInteger(x.prixSaisi) ? tr('lotachat.dejaPrix', { prix: eur(x.prixSaisi) }) : ''}
                  fin={f && f.cle === x.cle ? 'coche' : null} onClick={() => { changer(setCibles, i, { type: 'fiche', cle: x.cle }); setChoix(-1); }} attrs={{ 'data-lot-choisir': x.numero }}/>)}
              </Groupe> : null}
            </React.Fragment>;
          })}
        </Groupe>

        <Groupe titre={tr('lotachat.repartir')} pied={[phraseTotal, phraseRemb].filter(Boolean).join(' ')}>
          <div className="n-lot-segment"><Segmente libelle={tr('lotachat.repartir')} valeur={modeEff} onChange={setMode}
            options={possibles.map((m) => ({ cle: m, libelle: tr('lotachat.mode.' + m), attrs: { 'data-lot-mode': m } }))}/></div>
          {fp > 0 && modeEff !== 'main' ? <div className="n-lot-segment"><Segmente libelle={tr('lotachat.fraisPort')} valeur={fraisMode} onChange={setFraisMode}
            options={[{ cle: 'prorata', libelle: tr('lotachat.frais.prorata'), attrs: { 'data-lot-frais': 'prorata' } }, { cle: 'egal', libelle: tr('lotachat.frais.egal'), attrs: { 'data-lot-frais': 'egal' } }]}/></div> : null}
          <Rangee titre={tr('lotachat.total')} valeur={eur(total)} valeurForte attrs={{ 'data-lot-total': total != null ? String(total) : '' }}/>
          {modeEff === 'main' && rep ? <Rangee titre={rep.reste === 0 && rep.ok ? tr('lotachat.toutReparti') : tr('lotachat.reste')} valeur={eur(rep.reste)} ton={rep.ok ? 'neutre' : 'ambre'}
            sousTitre={rep.ok ? '' : tr('lotachat.resteAide')} attrs={{ 'data-lot-reste': rep.reste != null ? String(rep.reste) : '' }}/> : null}
        </Groupe>

        <Groupe titre={tr('lotachat.avantApres')}>
          <Rangee titre={tr('lotachat.avant')} sousTitre={tr('lotachat.avantDit')} valeur={eur(total)} attrs={{ 'data-lot-avant': '' }}/>
          <Rangee titre={tr('lotachat.apres')} sousTitre={rep && rep.parts ? rep.parts.map(eur).join(' + ') : '—'} sousLignes={2}
            valeur={rep && rep.ok ? eur(rep.somme) : '—'} attrs={{ 'data-lot-apres': rep && rep.ok ? String(rep.somme) : '' }}/>
        </Groupe>
      </>}
    </Feuille>
  );
}
