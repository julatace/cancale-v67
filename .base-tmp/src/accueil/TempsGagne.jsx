// ══════════════════════════════════════════════════════════════════════════
// « LE TEMPS QUE VRM TE FAIT GAGNER » — le calculateur de la page d'accueil
// publique (11 nov., lot temps-gagne). Un morceau À PART (React.lazy dans
// src/Accueil.jsx) : il ne pèse rien dans le fichier d'entrée et ne se charge
// qu'à l'approche de sa section.
// La règle (durées de référence justifiées, arrondis) : ./tempsGagne.js.
// ⚠️ Une ESTIMATION à partir des chiffres du visiteur, dite comme telle ; jamais
//    un résultat de client, jamais un témoignage (scripts/audit-temps-gagne.cjs).
// ══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { CHAMPS, valeursDepart, valeursBornees, tempsGagne, arrondiSemaine, arrondiMois } from './tempsGagne.js';

const CSS = `
.av-tg{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:56px;margin-top:56px;align-items:start}
.av-tg-champs{display:flex;flex-direction:column;gap:20px;background:var(--fond2);border-radius:28px;padding:32px}
.av-tg-champ label{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:16px;font-weight:600}
.av-tg-champ output{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;min-width:2.5ch;text-align:right}
.av-tg-champ input{width:100%;height:44px;margin:0;accent-color:var(--accent);cursor:pointer;background:transparent}
.av-tg-total{font-variant-numeric:tabular-nums}
.av-tg-total b{display:block;font-size:clamp(48px,5.6vw,80px);font-weight:700;letter-spacing:-.045em;line-height:1}
.av-tg-total span{display:block;margin-top:8px;font-size:19px;color:var(--gris)}
.av-tg-liste{list-style:none;padding:0;margin:32px 0 0;border-top:1px solid rgba(128,128,128,.25)}
.av-tg-liste li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 16px;padding:14px 0;border-bottom:1px solid rgba(128,128,128,.25)}
.av-tg-liste h3{font-size:16px;font-weight:600;line-height:1.35;letter-spacing:-.01em}
.av-tg-liste p{grid-column:1;font-size:14px;color:var(--gris);line-height:1.4}
.av-tg-liste .g{grid-row:1/span 2;grid-column:2;align-self:center;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.av-tg-liste li[data-zero] h3,.av-tg-liste li[data-zero] .g{color:var(--gris)}
.av-tg-note{margin-top:20px;font-size:14px;color:var(--gris);line-height:1.5;max-width:36em}
@media (max-width:1023px){.av-tg{grid-template-columns:1fr;gap:40px}}
@media (max-width:759px){.av-tg{margin-top:32px}.av-tg-champs{padding:24px 20px;border-radius:24px;gap:12px}}
`;

// Une durée en minutes (« 55 min », « 1 h 25 min », « 4 h »).
export function dureeMinutes(m) {
  const n = Math.max(0, Math.round(m));
  if (n < 60) return tr('accueil.temps.min', { n });
  const h = Math.floor(n / 60), r = n % 60;
  return r ? tr('accueil.temps.hmin', { h, m: r }) : tr('accueil.temps.h', { h });
}
// Une durée de référence en secondes (« 20 s », « 2 min », « 1 min 30 », « rien »).
export function dureeSecondes(s) {
  if (!s) return tr('accueil.temps.rien');
  if (s < 60) return tr('accueil.temps.s', { n: s });
  const m = Math.floor(s / 60), r = s % 60;
  return r ? tr('accueil.temps.minS', { m, s: r }) : tr('accueil.temps.min', { n: m });
}

export default function TempsGagne() {
  useLangue();
  const [v, setV] = React.useState(valeursDepart);
  const x = valeursBornees(v);
  const r = tempsGagne(x);
  const semaine = arrondiSemaine(r.secondes), mois = arrondiMois(r.secondes);
  const poser = (id) => (e) => { const n = Number(e.target.value); setV((a) => ({ ...a, [id]: n })); };

  return (
    <div className="av-tg" data-temps-gagne="">
      <style>{CSS}</style>
      <form className="av-tg-champs" onSubmit={(e) => e.preventDefault()} aria-label={tr('accueil.temps.tesChiffres')}>
        {CHAMPS.map((c) => (
          <div key={c.id} className="av-tg-champ">
            <label htmlFor={`av-tg-${c.id}`}>{tr(`accueil.temps.champ.${c.id}`)}<output htmlFor={`av-tg-${c.id}`} data-valeur={c.id}>{x[c.id]}</output></label>
            <input id={`av-tg-${c.id}`} type="range" min={c.min} max={c.max} step={c.pas} value={x[c.id]} onChange={poser(c.id)} data-champ={c.id} />
          </div>
        ))}
      </form>
      <div>
        <p className="av-tg-total" aria-live="polite" data-total-minutes={semaine} data-mois-minutes={mois}>
          <b>≈ {dureeMinutes(semaine)}</b>
          <span>{tr('accueil.temps.parSemaine', { mois: dureeMinutes(mois) })}</span>
        </p>
        <ul className="av-tg-liste">
          {r.gestes.map((g) => {
            const gain = Math.round(g.secondes / 60);
            return (
              <li key={g.id} data-geste={g.id} data-secondes={g.secondes} {...(g.secondes ? {} : { 'data-zero': '' })}>
                <h3>{tr(`accueil.temps.geste.${g.id}`)}</h3>
                <p>{tr('accueil.temps.ref', { sans: dureeSecondes(g.sans), avec: dureeSecondes(g.avec), par: tr(`accueil.temps.par.${g.par}`) })}</p>
                <span className="g">{g.secondes && !gain ? tr('accueil.temps.moinsDUne') : dureeMinutes(gain)}</span>
              </li>
            );
          })}
        </ul>
        <p className="av-tg-note" data-estimation="">{tr('accueil.temps.note')}</p>
      </div>
    </div>
  );
}
