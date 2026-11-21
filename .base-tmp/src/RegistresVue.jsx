// ── LES REGISTRES À L'ÉCRAN (11 nov., lot livre-registre) — Argent → Déclarer ──
// La feuille ouverte par « Voir » sur la carte « Registres » : le livre des
// recettes ou le registre des achats d'une période, PAR MOIS, filtrable
// (plateforme, recherche, « À compléter »), avec les manques NOMMÉS et leur
// geste, les mentions obligatoires et leurs sources (« à vérifier »), et les
// exports PDF · CSV · Excel horodatés. Aucune règle ici : les lignes viennent
// de `completerRecettes` / `completerAchats` (src/registresConformes.js) que la
// carte calcule ; ce composant les MONTRE.
import React from 'react';
import { Bouton, C, SheetShell, Segmente, fmt } from './App.jsx';
import { tr } from './i18n/index.js';
import { parMois, totauxPeriodes, filtrerLignes, plateformesDe, manquesNommes, OBLIGATIONS, SOURCES, etatSource } from './registresConformes.js';
import { libellePeriode } from './registres.js';

const aller = (q) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })); } catch (_) {} };
const GESTES = {
  achats: { cle: 'registres.geste.achats', faire: () => aller('?tab=cat_achats') },
  vinted: { cle: 'registres.geste.vinted', faire: () => { try { window.open('https://www.vinted.fr/', '_blank', 'noopener'); } catch (_) {} } },
};
const champ = { height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 15, padding: '0 10px', fontFamily: 'inherit', minWidth: 0 };

function Ligne({ l, type }) {
  const qui = type === 'recettes' ? l.client : l.fournisseur;
  const manque = (l.manques || []).filter((m) => m !== 'article');
  return (
    <li className="vrm-registre-ligne" data-registre-ligne={l.id} data-registre-ligne-manques={manque.join(',')}
      style={{ listStyle: 'none', padding: '10px 0', borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', columnGap: 12, rowGap: 2 }}>
      <span style={{ fontSize: 15, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span className="vrm-display" style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{l.date || '—'}</span>{l.nature}
      </span>
      <span className="vrm-display" data-registre-ligne-montant={l.montant == null ? '' : String(Math.round(l.montant * 100))} style={{ fontSize: 15, fontWeight: 600, color: l.montant == null ? C.muted : C.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{l.montant == null ? '—' : fmt(l.montant)}</span>
      <span style={{ gridColumn: '1 / -1', fontSize: 13, color: C.muted, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        <span className="vrm-sensible">{qui || '—'}</span>{l.reglement ? ` · ${l.reglement}` : ''}{l.piece ? ` · ${l.piece}` : ''}{l.num ? ` · N°${l.num}` : ''}
        {manque.length ? <span data-registre-a-completer="" style={{ display: 'block', color: C.warn }}>{tr('registres.aCompleter', { quoi: manque.map((m) => tr('registres.manque.' + m)).join(', ') })}</span> : null}
      </span>
    </li>
  );
}

export default function RegistresVue({ type, setType, periode, setPeriode, periodes, registres, onClose, exporter, enCours }) {
  const R = registres[type];
  const [plateforme, setPlateforme] = React.useState('');
  const [q, setQ] = React.useState('');
  const [aCompleter, setACompleter] = React.useState(false);
  React.useEffect(() => { setPlateforme(''); setACompleter(false); }, [type]);
  const plats = React.useMemo(() => plateformesDe(R), [R]);
  const mois = React.useMemo(() => (R ? parMois(R).filter((m) => m.n) : []), [R]);
  const totaux = React.useMemo(() => (R ? totauxPeriodes(R) : []), [R]);
  const manques = React.useMemo(() => (R ? manquesNommes(R) : []), [R]);
  const nACompleter = R ? filtrerLignes(R.lignes, { aCompleter: true }).length : 0;
  const filtre = { plateforme, q, aCompleter };
  const filtrees = R ? filtrerLignes(R.lignes, filtre).length : 0;
  const hors = R ? filtrerLignes(R.horsPeriode, filtre) : [];
  const total = totaux.length ? totaux[totaux.length - 1] : null;
  return (
    <SheetShell onClose={onClose} maxWidth={860} titre={tr('registres.titre')} data-registres-vue={type}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' }}
        data-registres-vue-etat={R === undefined ? 'encours' : R === null ? 'passu' : 'lu'} data-registres-vue-n={R ? R.n : ''} data-registres-vue-filtrees={filtrees}
        data-registres-vue-total={R ? String(Math.round(R.total * 100)) : ''} data-registres-vue-hors={R ? R.horsPeriode.length : ''} data-registres-vue-mois={mois.map((m) => `${m.ym}:${m.n}:${Math.round(m.total * 100)}`).join(',')}>
        <Segmente label={tr('registres.titre')} value={type} onChange={setType}
          options={[{ v: 'recettes', l: tr('registres.recettes'), data: { 'data-registres-vue-type': 'recettes' } }, { v: 'achats', l: tr('registres.achats'), data: { 'data-registres-vue-type': 'achats' } }]} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label={tr('registres.periode')} data-registres-vue-periode="" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ ...champ, flex: '1 1 150px' }}>
            {periodes.map((p) => <option key={p} value={p}>{libellePeriode(p)}</option>)}
          </select>
          {plats.length > 1 && <select aria-label={tr('registres.plateforme')} data-registres-vue-plateforme="" value={plateforme} onChange={(e) => setPlateforme(e.target.value)} style={{ ...champ, flex: '1 1 140px' }}>
            <option value="">{tr('registres.toutes')}</option>
            {plats.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>}
          <input type="search" aria-label={tr('registres.chercher')} placeholder={tr('registres.chercher')} data-registres-vue-q="" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...champ, flex: '2 1 180px' }} />
          {nACompleter > 0 && <Bouton variante={aCompleter ? 'primaire' : 'secondaire'} data-registres-vue-acompleter={aCompleter ? '1' : '0'} aria-pressed={aCompleter} onClick={() => setACompleter((x) => !x)}>{tr('registres.filtreACompleter', { n: nACompleter })}</Bouton>}
        </div>

        {R === undefined ? <p style={{ margin: 0, fontSize: 15, color: C.muted }}>{tr('registres.lecture')}</p>
          : R === null ? <p data-registres-vue-passu="" style={{ margin: 0, fontSize: 15, color: C.muted }}>— {tr('registres.pasLu')}</p>
          : <>
            {total && <div className="vrm-display" data-registres-vue-entete="" style={{ fontSize: 20, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.4 }}>
              {total.partiel ? <span style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>{tr('registres.auMoins')} </span> : null}{fmt(total.total)}
              <span style={{ fontSize: 15, fontWeight: 600, color: C.muted }}> · {tr(type === 'recettes' ? 'registres.nRecettes' : 'registres.nAchats', { n: R.n })}</span>
            </div>}
            {manques.length > 0 && <ul data-registres-vue-manques={manques.length} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {manques.map((m) => (
                <li key={m.cle} data-registres-manque={m.cle} data-registres-manque-n={m.n} style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 15, color: m.n ? C.warn : C.muted }}>
                  <span style={{ flex: '1 1 200px' }}>{m.cle === 'pas-lu' ? tr('registres.mq.pasLu', { quoi: m.texte.replace(/^Pas lu : /, '') }) : tr(`registres.mq.${type}.${m.cle}`, { n: m.n })}{m.geste === 'fichier' ? <span style={{ color: C.muted }}> · {tr('registres.geste.fichier')}</span> : null}</span>
                  {GESTES[m.geste] && <Bouton variante="discret" data-registres-geste={m.geste} onClick={GESTES[m.geste].faire}>{tr(GESTES[m.geste].cle)}</Bouton>}
                </li>))}
            </ul>}
            {mois.length === 0 && <p style={{ margin: 0, fontSize: 15, color: C.muted }}>{tr('registres.aucune')}</p>}
            {mois.map((m) => {
              const ls = filtrerLignes(m.lignes, filtre);
              if (!ls.length) return null;
              return (
                <section key={m.ym} data-registres-vue-groupe={m.ym}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginTop: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{m.libelle}</h3>
                    <span className="vrm-display" style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{m.n} · {m.sansMontant ? `${tr('registres.auMoins')} ` : ''}{fmt(m.total)}</span>
                  </div>
                  <ul style={{ margin: 0, padding: 0 }}>{ls.map((l) => <Ligne key={l.id} l={l} type={type} />)}</ul>
                </section>
              );
            })}
            {hors.length > 0 && <section data-registres-vue-groupe="hors">
              <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: C.text }}>{tr(type === 'recettes' ? 'registres.horsRecettes' : 'registres.horsAchats', { n: hors.length })}</h3>
              <ul style={{ margin: 0, padding: 0 }}>{hors.map((l) => <Ligne key={l.id} l={l} type={type} />)}</ul>
            </section>}
            <details className="vrm-repli" data-registres-sources="">
              <summary style={{ fontSize: 13, color: C.muted, minHeight: 44, display: 'flex', alignItems: 'center' }}>{tr('registres.loi')}</summary>
              <ul style={{ margin: '4px 0 0', padding: 0 }}>
                {OBLIGATIONS[type].map((o) => (
                  <li key={o.cle} data-registres-obligation={o.cle} style={{ listStyle: 'none', padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
                    <b style={{ display: 'block', color: C.text, fontWeight: 600 }}>{tr(`registres.obl.${type}.${o.cle}`)}</b>
                    {o.sources.map((s, i) => <span key={s}>{i ? ' · ' : ''}<a href={SOURCES[s].url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{SOURCES[s].nom}</a> <span data-registres-source-etat={SOURCES[s].verifie ? 'verifiee' : 'a-verifier'} style={{ color: SOURCES[s].verifie ? C.muted : C.warn }}>({SOURCES[s].verifie ? etatSource(SOURCES[s]) : tr('registres.aVerifier')})</span></span>)}
                  </li>))}
              </ul>
            </details>
          </>}
        <div className="vrm-fs-pied" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['pdf', 'doc', 'PDF'], ['csv', 'save', 'CSV'], ['xlsx', 'save', 'Excel']].map(([forme, icone, nom]) => (
            <Bouton key={forme} variante={forme === 'pdf' ? 'primaire' : 'secondaire'} icone={icone} data-registres-vue-export={forme} disabled={!R || !!enCours} onClick={() => exporter(R, forme)} style={{ flex: '1 1 100px' }}>{enCours === type + forme ? '…' : nom}</Bouton>))}
        </div>
      </div>
    </SheetShell>
  );
}
