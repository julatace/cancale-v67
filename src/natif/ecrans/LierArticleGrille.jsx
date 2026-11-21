// ── src/natif/ecrans/LierArticleGrille.jsx — le geste INVERSE : « Relier à une vente / une annonce » depuis un ACHAT ──────
// (21 nov., lot relier-code — Julien : « rends relier les achats à la vente / à l'annonce plus facile ») La MÊME feuille que
// « Lier à un achat » (src/natif/ecrans/LierAchatGrille.jsx, mêmes classes, même confirmation « Oui ») vue depuis l'achat :
// l'ACHAT en haut (posé par la feuille de l'app), puis la MEILLEURE vente / annonce proposée (l'affectation globale de
// src/liaisonAchat.js lue dans l'autre sens, `propositionsPourAchat` de src/relierPropositions.js — jamais une égalité
// tranchée), 2–3 autres avec leur raison, puis la grille de ses ventes et annonces SANS achat, des plus récentes.
// SON toucher choisit une case, « Oui » relie — par les écritures d'avant (`relierAchatVente` / `relierAchatAnnonce` de
// src/App.jsx, passées en `onRelier`). Un LOT reste ouvert après un lien : « 1 sur 3 relié · choisis la suivante » ; son prix
// est demandé article par article par l'écriture d'avant (`ecritureRelierAchat`), jamais divisé (§2.5).
import React from 'react';
import { tr } from '../../i18n/index.js';
import { phraseRaisons, TeteSerie } from './LierAchatGrille.jsx';
import '../ventes-lisibles.css';
import '../relier-facile.css';

const PAS = 60;
const prixCourt = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toFixed(Number(n) % 1 ? 2 : 0).replace('.', ',')} €`);
const jourCourt = (t) => { if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// articles : [{ key, genre: 'vente' | 'annonce', titre, photo, prix, t (ms), num, site }] — déjà sans achat (la règle de l'app).
// propositions : { meilleure: { key, p } | null, autres: [{ key, p }], egalite } · lot : { n, relies } | null.
export default function LierArticleGrille({ articles, propositions = null, raisonsDe = null, couleurDe = (c) => c, lot = null, Photo = null, onRelier, onPasCelle = null, Plaque = null, serie = null }) {
  const [q, setQ] = React.useState('');
  const [genre, setGenre] = React.useState('');
  const [choisi, setChoisi] = React.useState('');
  const [nVus, setNVus] = React.useState(PAS);
  const [envoi, setEnvoi] = React.useState(false);
  const charge = Array.isArray(articles);
  const parCle = React.useMemo(() => new Map((charge ? articles : []).map((x) => [x.key, x])), [articles, charge]);
  const liste = React.useMemo(() => {
    if (!charge) return [];
    const mots = sansAccent(q).split(/\s+/).filter(Boolean);
    return articles.filter((x) => (!genre || x.genre === genre) && (!mots.length || mots.every((w) => sansAccent([x.titre, x.num ? 'n' + x.num : '', x.site].join(' ')).includes(w))));
  }, [articles, charge, q, genre]);
  React.useEffect(() => { setNVus(PAS); }, [q, genre]);
  React.useEffect(() => { if (choisi && !parCle.has(choisi)) setChoisi(''); }, [parCle, choisi]);
  const nVentes = charge ? articles.filter((x) => x.genre === 'vente').length : 0;
  const nAnnonces = charge ? articles.length - nVentes : 0;
  const props = propositions || { meilleure: null, autres: [], egalite: false };
  const meilleure = props.meilleure && parCle.has(props.meilleure.key) ? props.meilleure : null;
  const autres = (props.autres || []).filter((x) => parCle.has(x.key));
  const art = choisi ? parCle.get(choisi) || null : null;
  const relier = async () => { if (!art || envoi) return; setEnvoi(true); try { const ok = await onRelier(art); if (ok) setChoisi(''); } finally { setEnvoi(false); } };
  const vignette = (x, lazy) => <span className="n-rf-autre-photo">{x.photo ? (Photo ? <Photo src={x.photo} alt="" loading={lazy ? 'lazy' : undefined} decoding="async"/> : <img src={x.photo} alt="" decoding="async"/>) : null}</span>;
  const sous = (x) => [x.genre === 'vente' ? tr('la.inv.vendue', { date: jourCourt(x.t) }) : tr('la.inv.enLigne'), x.site].filter(Boolean).join(' · ');
  return (
    <div className="n-la" data-la-inverse="" data-la-n={charge ? String(liste.length) : ''} data-la-serie-achats={serie ? '1' : undefined}>
      {/* (21 nov., fiche-sites) En série depuis Achats : « 3 sur 18 · Passer » (la tête de la série de Ventes). */}
      <TeteSerie serie={serie}/>
      {lot ? <div className="n-rf-lot-tete" data-la-lot-tete={`${lot.relies}/${lot.n == null ? '?' : lot.n}`}>{lot.n ? tr('la.inv.lot', { k: String(lot.relies), n: String(lot.n) }) : tr('la.inv.lotSans', { k: String(lot.relies) })}</div> : null}
      <div className="n-la-haut">
        <div className="n-la-recherche">
          <input type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('la.inv.chercher')} aria-label={tr('la.inv.chercher')} data-la-recherche=""/>
        </div>
        {nVentes && nAnnonces ? (
          <div className="n-la-filtres" role="group" aria-label={tr('la.filtrer')}>
            {[['', tr('la.inv.tout')], ['vente', tr('la.inv.ventes', { n: String(nVentes) })], ['annonce', tr('la.inv.annonces', { n: String(nAnnonces) })]].map(([k, l]) => (
              <button key={k || 'tout'} type="button" className="n-la-pilule" aria-pressed={genre === k ? 'true' : 'false'} data-la-genre={k || 'tout'} onClick={() => setGenre(k)}><span className="n-la-pilule-txt">{l}</span></button>
            ))}
          </div>
        ) : null}
        <div className="n-la-compte" data-la-compte="">{!charge ? tr('la.inv.lecture') : tr('la.inv.n', { n: String(liste.length) })}</div>
      </div>
      {charge && (meilleure || autres.length) ? (
        <div className="n-rf-props" data-la-propositions={String((meilleure ? 1 : 0) + autres.length)}>
          {meilleure ? (() => {
            const x = parCle.get(meilleure.key), on = choisi === x.key;
            return (
              <section className="n-rf-best" data-la-meilleure={x.key} data-la-niveau={meilleure.p.niveau} data-la-choisi={on ? '1' : undefined} aria-label={tr('la.meilleure')}>
                <div className="n-rf-best-tete"><span className="n-rf-best-mot">{tr('la.meilleure')}</span>
                  <span className="n-rf-etiquette" data-ton={meilleure.p.niveau === 'tres-probable' ? 'vert' : 'gris'}>{meilleure.p.niveau === 'tres-probable' ? tr('la.niveau.tres') : tr('la.niveau.verifier')}</span></div>
                <div className="n-rf-best-corps">
                  <span className="n-rf-best-photo">{x.photo ? (Photo ? <Photo src={x.photo} alt="" decoding="async"/> : <img src={x.photo} alt="" decoding="async"/>) : null}</span>
                  <span className="n-rf-best-txt">
                    <span className="n-rf-best-titre">{x.num && Plaque ? <Plaque numero={x.num}/> : null} {x.titre || '—'}</span>
                    <span className="n-rf-raison" data-la-raison="">{raisonsDe ? phraseRaisons(raisonsDe(meilleure.p, x), couleurDe) : ''}</span>
                    <span className="n-rf-best-pied"><b>{prixCourt(x.prix)}</b><span>{sous(x)}</span></span>
                  </span>
                </div>
                <div className="n-rf-best-gestes">
                  {onPasCelle ? <button type="button" className="n-la-non" data-la-pas-celle={x.key} onClick={() => { if (on) setChoisi(''); onPasCelle(x.key); }}>{tr('la.pasCelle')}</button> : null}
                  <button type="button" className="n-la-oui n-rf-relier" data-la-relier={x.key} aria-pressed={on ? 'true' : 'false'} onClick={() => setChoisi(on ? '' : x.key)}>{tr('la.relier')}</button>
                </div>
              </section>
            );
          })() : null}
          {autres.length ? (
            <div className="n-rf-autres" data-la-autres={String(autres.length)} data-la-egalite={props.egalite && !meilleure ? '1' : undefined}>
              <div className="n-rf-autres-tete">{props.egalite && !meilleure ? tr('la.egalite') : meilleure ? tr('la.autres') : tr('la.suggestions')}</div>
              {autres.map(({ key, p }) => {
                const x = parCle.get(key), on = choisi === key;
                return (
                  <button key={key} type="button" className="n-rf-autre" data-la-suggestion={key} data-la-choisi={on ? '1' : undefined} aria-pressed={on ? 'true' : 'false'} onClick={() => setChoisi(on ? '' : key)}>
                    {vignette(x, true)}
                    <span className="n-rf-autre-txt"><span className="n-rf-autre-titre">{x.titre || '—'}</span><span className="n-rf-raison" data-la-raison="">{raisonsDe ? phraseRaisons(raisonsDe(p, x), couleurDe) : ''}</span></span>
                    <span className="n-rf-autre-prix">{prixCourt(x.prix)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="n-rf-grille-tete">{tr('la.inv.tous')}</div>
        </div>
      ) : null}
      {!charge ? <div className="n-la-grille" aria-busy="true" data-la-attente="">{Array.from({ length: 6 }, (_, i) => <span key={i} className="n-la-case n-la-case-attente" aria-hidden="true"><span className="n-la-photo"/></span>)}</div>
        : !liste.length ? <div className="n-la-vide" data-la-vide="">{q.trim() || genre ? tr('la.videFiltre') : tr('la.inv.vide')}</div>
          : <div className="n-la-grille" role="listbox" aria-label={tr('la.inv.grille')} data-la-grille={String(liste.length)}>
            {liste.slice(0, nVus).map((x) => {
              const on = x.key === choisi;
              return (
                <button key={x.key} type="button" role="option" aria-selected={on ? 'true' : 'false'} className="n-la-case" data-la-article={x.key} data-la-choisi={on ? '1' : undefined}
                  aria-label={tr('la.caseAria', { titre: x.titre || '—', prix: prixCourt(x.prix), date: jourCourt(x.t) })} onClick={() => setChoisi(on ? '' : x.key)}>
                  <span className="n-la-photo" data-la-photo={x.photo ? '1' : '0'}>{x.photo ? (Photo ? <Photo src={x.photo} alt="" loading="lazy" decoding="async"/> : <img src={x.photo} alt="" loading="lazy" decoding="async"/>) : null}
                    {on ? <span className="n-la-coche" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.2 5.8 10 11 4.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span> : null}</span>
                  <span className="n-la-prix">{prixCourt(x.prix)}</span>
                  <span className="n-la-titre">{x.titre || '—'}</span>
                  <span className="n-la-date">{sous(x)}</span>
                </button>
              );
            })}
          </div>}
      {charge && liste.length > nVus ? <div className="n-la-fin"><button type="button" className="n-la-plus" data-la-suite="" onClick={() => setNVus((n) => n + PAS)}>{tr('la.suite', { n: String(liste.length - nVus) })}</button></div> : null}
      {art ? (
        <div className="n-la-confirme" role="region" aria-label={tr('la.inv.confirmer')} data-la-confirme={art.key}>
          <div className="n-la-confirme-txt">
            <span className="n-la-confirme-q">{art.genre === 'vente' ? tr('la.inv.confirmerVente') : tr('la.inv.confirmerAnnonce')}</span>
            <span className="n-la-confirme-titre">{art.titre || '—'} · {prixCourt(art.prix)}</span>
          </div>
          <button type="button" className="n-la-non" data-la-non="" onClick={() => setChoisi('')}>{tr('la.non')}</button>
          <button type="button" className="n-la-oui" data-la-oui="" disabled={envoi} onClick={relier}>{tr('la.oui')}</button>
        </div>
      ) : null}
    </div>
  );
}

