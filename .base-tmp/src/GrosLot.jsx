// ── LE BLOC « UN LOT » DU FORMULAIRE « NOUVEL ACHAT » (11 nov. 2026, lot gros-lot) ──
// La RÈGLE (répartition au centime, N° consécutifs, plan d'écriture) : src/grosLot.js.
// Ici, seulement ce qui se dessine et ce qu'il touche, sous les champs communs du
// formulaire (nom, PRIX TOTAL, où, date, référence, facture — une seule saisie) :
//   · le nombre d'articles, les frais / le port ;
//   · la répartition, SON choix : parts égales · au prorata d'un prix visé · à la main ;
//   · une ligne par article : son N° (proposé, ou tapé en « Je numérote moi-même »),
//     une photo facultative, le titre, la taille, son prix visé ou son montant, SA part ;
//   · le total réparti, juste au centime, et le reste DIT (« 1 ct posé sur l'article 1 »).
// Rien n'est écrit ici : « Ajouter le lot » (Achats.jsx) appelle la coque (App.jsx).
import React from 'react';
import { tr } from './i18n/index.js';
import { SegmenteBase } from './composants/Bouton.jsx';
import './styles-gros-lot.css';
import { repartirGrosLot, centimesTapes, texteCentimes, nombreArticles, listeRangs, suiteDepuis, LOT_MAX } from './grosLot.js';

export const LOT0 = () => ({ n: '', frais: '', mode: 'egal', articles: [], ranger: true });
const ART0 = () => ({ titre: '', taille: '', visee: '', main: '', photo: null, numero: '' });

// Les articles suivent le nombre tapé (on garde ce qui est déjà saisi).
export const avecNombre = (lot, v) => {
  const n = nombreArticles(v);
  const a = Array.isArray(lot.articles) ? lot.articles.slice(0, n || lot.articles.length) : [];
  if (n) while (a.length < n) a.push(ART0());
  return { ...lot, n: v, articles: n ? a : lot.articles };
};

// (intégration g1, branchement rangement-guide) Une case dite en mots, par tr (meuble · niveau · case).
export const caseLot = (c) => (c ? tr('groslot.case', { meuble: c.meuble, rangee: c.rangee, colonne: c.colonne }) : '');
// Les cases montrées sont celles qui partent : `apercuCases(n)` (la règle du rangement guidé), si « Ranger » est coché.
export const casesDuLot = (lot, apercuCases) => {
  const n = nombreArticles(lot && lot.n);
  if (!n || typeof apercuCases !== 'function') return null;
  const r = apercuCases(n);
  return r && !r.aucunMeuble && Array.isArray(r.cases) && r.cases.some(Boolean) ? r.cases : null;
};

// La répartition de l'écran : la MÊME fonction que la coque rejouera à « Ajouter ».
export function repartitionDuLot(lot, totalTexte) {
  const n = nombreArticles(lot && lot.n);
  const articles = (lot && lot.articles) || [];
  return repartirGrosLot({
    total: centimesTapes(totalTexte), frais: centimesTapes(lot && lot.frais), n: n || 0, mode: lot && lot.mode,
    visees: articles.map((a) => centimesTapes(a.visee)), manuels: articles.map((a) => centimesTapes(a.main)),
  });
}

// La phrase de la répartition (ok ou refus), et les rangs en cause.
export function phraseRepartition(r) {
  if (!r) return '';
  if (r.ok) {
    if (r.reste.cases) return tr('groslot.reste.cases', { montant: texteCentimes(r.reste.centimes), rangs: listeRangs(r.reste.sur) });
    if (r.reste.centimes > 0) return tr('groslot.reste.centimes', { n: r.reste.centimes, rangs: listeRangs(r.reste.sur) });
    return tr('groslot.reste.aucun');
  }
  if (r.raison === 'visee') return tr('groslot.refus.visee', { rangs: listeRangs(r.rangs) });
  if (r.raison === 'illisible') return tr('groslot.refus.illisible', { rangs: listeRangs(r.rangs) });
  if (r.raison === 'trop') return tr('groslot.refus.trop', { montant: texteCentimes(-r.ecart) });
  if (r.raison === 'ecart') return tr('groslot.refus.ecart', { montant: texteCentimes(r.ecart) });
  if (r.raison === 'frais') return tr('groslot.refus.frais');
  if (r.raison === 'n') return tr('groslot.refus.n', { max: LOT_MAX });
  return tr('groslot.refus.total');
}

export function BlocGrosLot({ lot, setLot, totalTexte, C, Icon, Bouton, moiMeme = false, apercuNumeros = null, apercuCases = null, compresser = null, clavier = 'numeric', cleNum = null, erreursNum = null }) {
  const fichiers = React.useRef({});
  const r = repartitionDuLot(lot, totalTexte);
  const n = nombreArticles(lot.n);
  const apercu = !moiMeme && n && typeof apercuNumeros === 'function' ? apercuNumeros(n) : null;
  const casesP = casesDuLot(lot, apercuCases);
  const ranger = !!casesP && lot.ranger !== false;
  const nSansCase = casesP ? casesP.filter((c) => !c).length : 0;
  const premiere = casesP ? casesP.find(Boolean) : null, derniere = casesP ? [...casesP].reverse().find(Boolean) : null;
  const majArt = (i, patch) => setLot((l) => ({ ...l, articles: l.articles.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const inp = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 10px', height: 44, fontSize: 15, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minWidth: 0 };
  const lab = { fontSize: 12, color: C.muted, fontWeight: 600 };
  const choisirPhoto = async (i, ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f || typeof compresser !== 'function') return;
    const b64 = await compresser(f, 480, 0.62);
    if (b64) majArt(i, { photo: b64 });
  };
  const errNum = (i) => (Array.isArray(erreursNum) ? erreursNum.find((e) => e.i === i) : null);
  const somme = r.ok ? r.parts.reduce((s, p) => s + p, 0) : null;
  return (
    <div className="vrm-gl" data-gros-lot="" data-lot-mode={lot.mode} data-lot-n={n || ''}>
      <div className="vrm-gl-deux">
        <label className="vrm-gl-champ"><span style={lab}>{tr('groslot.nombre')}</span>
          <input data-lot-champ="n" value={lot.n} inputMode="numeric" placeholder="20" autoComplete="off" style={inp}
            onChange={(e) => setLot((l) => avecNombre(l, e.target.value.replace(/\D/g, '').slice(0, 2)))} /></label>
        <label className="vrm-gl-champ"><span style={lab}>{tr('groslot.frais')}</span>
          <input data-lot-champ="frais" value={lot.frais} inputMode="decimal" placeholder="0,00" autoComplete="off" style={inp}
            onChange={(e) => setLot((l) => ({ ...l, frais: e.target.value }))} /></label>
      </div>
      <div className="vrm-gl-champ"><span style={lab}>{tr('groslot.repartir')}</span>
        <SegmenteBase label={tr('groslot.repartir')} plein value={lot.mode} onChange={(v) => setLot((l) => ({ ...l, mode: v }))}
          options={[{ v: 'egal', l: tr('groslot.mode.egal'), data: { 'data-lot-mode-choix': 'egal' } }, { v: 'revente', l: tr('groslot.mode.revente'), data: { 'data-lot-mode-choix': 'revente' } }, { v: 'main', l: tr('groslot.mode.main'), data: { 'data-lot-mode-choix': 'main' } }]} />
      </div>
      {n ? (
        <>
          {moiMeme ? (
            <div className="vrm-gl-suite">
              <span style={{ fontSize: 13, color: C.muted }}>{tr('groslot.moiMeme')}</span>
              {lot.articles[0] && String(lot.articles[0].numero || '').trim() ? (
                <Bouton variante="secondaire" data-lot-suite="" style={{ minHeight: 44 }}
                  onClick={() => { const s = suiteDepuis(lot.articles[0].numero, n, cleNum); if (s.length) setLot((l) => ({ ...l, articles: l.articles.map((a, j) => ({ ...a, numero: s[j] })) })); }}>
                  {tr('groslot.suite', { num: lot.articles[0].numero })}
                </Bouton>
              ) : null}
            </div>
          ) : (
            <div className="vrm-gl-suite" data-lot-numeros={apercu ? apercu.join(',') : ''} style={{ fontSize: 13, color: C.muted }}>
              {apercu && apercu.length ? tr('groslot.numeros', { de: apercu[0], a: apercu[apercu.length - 1] }) : tr('groslot.numerosPasSu')}
            </div>
          )}
          {casesP ? (
            <label className="vrm-gl-ranger" data-lot-ranger={ranger ? '1' : '0'} data-lot-cases={casesP.map((c) => (c ? c.meubleId + ':' + c.i : '-')).join(',')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 13, color: C.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={ranger} onChange={(ev) => setLot((l) => ({ ...l, ranger: ev.target.checked }))} style={{ width: 20, height: 20, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <b style={{ color: C.text, fontWeight: 600 }}>{tr('groslot.ranger')}</b>
                {' · '}{premiere === derniere ? caseLot(premiere) : tr('groslot.cases', { de: caseLot(premiere), a: caseLot(derniere) })}
                {nSansCase ? ` · ${tr('groslot.sansCase', { n: nSansCase })}` : ''}
              </span>
            </label>
          ) : null}
          <ol className="vrm-gl-liste" aria-label={tr('groslot.articles')}>
            {lot.articles.map((a, i) => {
              const e = errNum(i);
              const part = r.ok ? r.parts[i] : null;
              const enCause = !r.ok && Array.isArray(r.rangs) && r.rangs.includes(i);
              return (
                <li key={i} className="vrm-gl-art" data-lot-article={i + 1} data-lot-part={part == null ? '' : String(part)} style={{ borderColor: C.border, background: C.card }}>
                  <div className="vrm-gl-art-haut">
                    {moiMeme ? (
                      <input data-lot-num-tape={i + 1} aria-label={tr('groslot.numeroDe', { i: i + 1 })} value={a.numero} inputMode={clavier} placeholder="N°" autoComplete="off"
                        onChange={(ev) => majArt(i, { numero: ev.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9) })}
                        style={{ ...inp, width: 76, flexShrink: 0, fontWeight: 700, ...(e ? { borderColor: C.warn } : null) }} />
                    ) : (
                      <span className="vrm-gl-num" data-lot-num={apercu ? apercu[i] : ''} style={{ background: C.card2 || C.bg, color: C.text }}>{apercu ? `N°${apercu[i]}` : '—'}</span>
                    )}
                    <button type="button" className="vrm-gl-photo" data-lot-photo={i + 1} data-lot-photo-pleine={a.photo ? '1' : '0'} aria-label={a.photo ? tr('groslot.photoChanger', { i: i + 1 }) : tr('groslot.photoAjouter', { i: i + 1 })}
                      onClick={() => fichiers.current[i] && fichiers.current[i].click()} style={{ borderColor: C.border, background: C.card2 || C.bg, color: C.muted }}>
                      {a.photo ? <img src={a.photo} alt="" /> : <Icon name="camera" size={18} />}
                    </button>
                    <input ref={(el) => { fichiers.current[i] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={(ev) => choisirPhoto(i, ev)} />
                    <input data-lot-titre={i + 1} aria-label={tr('groslot.titreDe', { i: i + 1 })} value={a.titre} placeholder={tr('groslot.titre')} autoComplete="off"
                      onChange={(ev) => majArt(i, { titre: ev.target.value })} style={{ ...inp, flex: 1 }} />
                  </div>
                  <div className="vrm-gl-art-bas">
                    <input data-lot-taille={i + 1} aria-label={tr('groslot.tailleDe', { i: i + 1 })} value={a.taille} placeholder={tr('groslot.taille')} autoComplete="off"
                      onChange={(ev) => majArt(i, { taille: ev.target.value })} style={{ ...inp, width: 84, flexShrink: 0 }} />
                    {lot.mode === 'revente' ? (
                      <input data-lot-visee={i + 1} aria-label={tr('groslot.viseeDe', { i: i + 1 })} value={a.visee} inputMode="decimal" placeholder={tr('groslot.visee')} autoComplete="off"
                        onChange={(ev) => majArt(i, { visee: ev.target.value })} style={{ ...inp, flex: 1, ...(enCause ? { borderColor: C.warn } : null) }} />
                    ) : lot.mode === 'main' ? (
                      <input data-lot-main={i + 1} aria-label={tr('groslot.mainDe', { i: i + 1 })} value={a.main} inputMode="decimal" placeholder={tr('groslot.mainVide')} autoComplete="off"
                        onChange={(ev) => majArt(i, { main: ev.target.value })} style={{ ...inp, flex: 1, ...(enCause ? { borderColor: C.warn } : null) }} />
                    ) : <span style={{ flex: 1 }} />}
                    <span className="vrm-gl-part" aria-label={tr('groslot.partDe', { i: i + 1 })}>{part == null ? '—' : `${texteCentimes(part)} €`}</span>
                  </div>
                  {ranger ? <div className="vrm-gl-case" data-lot-case={casesP[i] ? casesP[i].meubleId + ':' + casesP[i].i : ''} style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{casesP[i] ? caseLot(casesP[i]) : '—'}</div> : null}
                  {e ? <div role="alert" data-lot-num-erreur={e.raison} style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>{tr('groslot.num.' + e.raison, { n: e.num })}</div> : null}
                </li>
              );
            })}
          </ol>
          <div className="vrm-gl-total" data-lot-ok={r.ok ? '1' : '0'} data-lot-somme={somme == null ? '' : String(somme)} data-lot-cible={r.cible == null ? '' : String(r.cible)}
            data-lot-reste={r.ok ? String(r.reste.centimes) : ''} data-lot-reste-sur={r.ok ? r.reste.sur.map((x) => x + 1).join(',') : ''} role="status" aria-live="polite">
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
              {r.ok ? tr('groslot.totalOk', { montant: texteCentimes(somme) }) : tr('groslot.totalPasJuste')}
            </div>
            <div style={{ fontSize: 13, color: r.ok ? C.muted : C.warn, marginTop: 2 }}>{phraseRepartition(r)}</div>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: C.muted }}>{tr('groslot.combien', { max: LOT_MAX })}</div>
      )}
    </div>
  );
}
