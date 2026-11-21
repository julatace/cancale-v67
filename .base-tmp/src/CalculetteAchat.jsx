import React, { useState, useMemo } from 'react';
import { SITES_CALCULETTE, calculer, eurosCalc } from './calculetteAchat.js';
import { emballagesAvecCout } from './emballages.js';
import { BarreCoutVente, PointCout } from './CascadeVente.jsx';
import './styles-calculette-emballages.css';

// ════════════════════════════════════════════════════════════════════════════
//  LA CALCULETTE D'ACHAT (10 nov., lot L) — ouverte depuis Achats et ⌘K.
//  Il tape le prix d'achat et le prix de revente ; VRM dit le bénéfice net avec
//  les frais qu'il LIT (src/calculetteAchat.js → `cascadeVente`). Rien n'est
//  conseillé, rien n'est écrit : la feuille fermée, tout est oublié.
//  Couleurs (§7) : neutre ; l'accent sur le bénéfice ; une perte en ambre.
// ════════════════════════════════════════════════════════════════════════════

const Champ = ({ id, label, value, onChange, placeholder, autoFocus }) => (
  <label className="vrm-calc-champ" htmlFor={id}>
    <span>{label}</span>
    <span className="vrm-calc-saisie">
      <input id={id} autoFocus={autoFocus} inputMode="decimal" enterKeyHint="next" autoComplete="off" value={value} placeholder={placeholder}
        data-calc-champ={id} onChange={(e) => onChange(e.target.value)}/>
      <span aria-hidden="true">€</span>
    </span>
  </label>
);

export default function CalculetteAchat({ onClose, Feuille, contexte = {}, emballages = null }) {
  const [achat, setAchat] = useState('');
  const [revente, setRevente] = useState('');
  const [site, setSite] = useState('vinted');
  const [emb, setEmb] = useState('');
  const r = useMemo(() => calculer({ achat, revente, site, emballage: emb }, contexte), [achat, revente, site, emb, contexte]);
  const choix = useMemo(() => emballagesAvecCout(emballages), [emballages]);
  const perte = r.etat === 'ok' && r.benefice < 0;
  const corps = (
    <div className="vrm-calc" data-calculette="" data-calc-etat={r.etat} data-calc-site={site}
      data-calc-benefice={r.etat === 'ok' ? String(r.benefice) : ''} data-calc-borne={r.etat === 'ok' ? r.borne : ''}>
      <div className="vrm-calc-grille">
        <Champ id="calc-achat" label="Je l’achète" value={achat} onChange={setAchat} placeholder="60" autoFocus/>
        <Champ id="calc-revente" label="Je la revends" value={revente} onChange={setRevente} placeholder="120"/>
      </div>
      <div className="vrm-calc-sites" role="radiogroup" aria-label="Sur quelle plateforme ?">
        {SITES_CALCULETTE.map((s) => (
          <button key={s.cle} type="button" role="radio" aria-checked={site === s.cle} className={'vrm-calc-site' + (site === s.cle ? ' is-on' : '')}
            data-calc-site-choix={s.cle} onClick={() => setSite(s.cle)}>{s.nom}</button>
        ))}
      </div>
      <div className="vrm-calc-emb">
        <Champ id="calc-emballage" label="Emballage" value={emb} onChange={setEmb} placeholder="0,80"/>
        {choix.length ? (
          <div className="vrm-calc-puces" aria-label="Mes emballages">
            {choix.map((t) => <button key={t.id} type="button" className="vrm-calc-puce" data-calc-emb-choix={t.id} onClick={() => setEmb(t.cout)}>{t.nom} · {t.cout} €</button>)}
          </div>
        ) : null}
      </div>
      <section className={'vrm-calc-res' + (perte ? ' is-perte' : '')} aria-live="polite" data-calc-resultat="">
        {r.etat === 'vide' ? <p className="vrm-calc-attente">Tape les deux prix.</p>
          : r.etat === 'illisible' ? <p className="vrm-calc-attente" data-calc-illisible="">Un montant ne se lit pas : par exemple 12,50.</p>
          : (
            <>
              <div className="vrm-calc-tete">{perte ? 'Tu perds' : 'Tu gagnes'}</div>
              <div className="vrm-calc-montant">
                {r.borne === 'au-plus' ? <span className="vrm-calc-borne" data-calc-au-plus="">au plus </span> : r.borne === 'environ' ? <span className="vrm-calc-borne" data-calc-environ="">environ </span> : null}
                <b>{eurosCalc(Math.abs(r.benefice))}</b>
              </div>
              <BarreCoutVente c={r.cascade}/>
              <dl className="vrm-calc-lignes">
                <div><dt><PointCout cle="achat"/>Achat</dt><dd>{eurosCalc(-r.cascade.achat)}</dd></div>
                <div data-calc-frais={r.frais.etat}><dt><PointCout cle="frais"/>Frais {site === 'vinted' ? 'Vinted' : site === 'ebay' ? 'eBay' : site === 'leboncoin' ? 'Leboncoin' : 'Vestiaire'}</dt>
                  <dd>{r.frais.etat === 'pasLu' ? '—' : eurosCalc(-(r.cascade.frais || 0))}<small>{r.frais.phrase}</small></dd></div>
                <div data-calc-emb={r.cascade.emballage == null ? 'vide' : String(r.cascade.emballage)}><dt><PointCout cle="emballage"/>Emballage</dt>
                  <dd>{r.cascade.emballage == null ? '—' : eurosCalc(-r.cascade.emballage)}{r.cascade.emballage == null ? <small>pas compté</small> : null}</dd></div>
              </dl>
            </>
          )}
      </section>
      <p className="vrm-calc-note">Rien n’est enregistré.</p>
    </div>
  );
  if (!Feuille) return corps;
  return <Feuille onClose={onClose} titre="Calculette d’achat" maxWidth={460} data-calculette-feuille="">{corps}</Feuille>;
}
