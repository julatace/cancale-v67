// ── « OUVRE TON COMPTE MONDIAL RELAY, VRM RÉCUPÈRE TES COLIS ET LEURS QR » (5 nov.) ──
// Julien (vocal du 5 nov.) : « quand il se connecte à son compte Mondial Relay,
// l'extension capte TOUS les colis arrivés avec leurs QR codes… Une animation
// l'explique. » Une scène courte en CSS/SVG : le compte Mondial Relay ouvert
// dans le navigateur (n'importe lequel, Orion compris), ses colis qui glissent
// vers VRM, où chacun arrive avec son CODE et son QR, reliés par le n° de suivi.
// ⚠️ DONNÉES INVENTÉES (§2.3 et vocal : « des données simulées, jamais les
// siennes ») : n°, codes, relais et QR sont faux — le QR dessiné est un motif
// décoratif, pas un code lisible. `prefers-reduced-motion` ⇒ la scène finale, fixe.
//
// `LecturesMondialRelay` : la fraîcheur de CHAQUE compte Mondial Relay relu
// (« relu il y a 3 min »), une ligne par compte, depuis les lignes `mr_colis_*`
// (src/retraitQr.js). Rien lu ⇒ rien d'affiché ici (l'explication dit le geste).
import React from 'react';
import { ilYa } from './retraitQr.js';

const CSS = `
.mrx{--mrx-ink:var(--vrm-ink,#1D1D1F);--mrx-muted:var(--vrm-muted,#6E6E73);--mrx-line:var(--vrm-line,#E5E5EA);--mrx-surface:var(--vrm-surface,#FFFFFF);--mrx-bg:var(--vrm-bg,#F5F5F7);--mrx-accent:var(--vrm-accent,#0071E3);
  display:flex;flex-direction:column;gap:12px;color:var(--mrx-ink)}
.mrx-scene{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);align-items:center;gap:8px;padding:14px;border-radius:14px;background:var(--mrx-bg);overflow:hidden;min-height:176px}
.mrx-fen{background:var(--mrx-surface);border:1px solid var(--mrx-line);border-radius:12px;padding:8px;min-width:0;display:flex;flex-direction:column;gap:6px}
.mrx-barre{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mrx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mrx-barre i{width:6px;height:6px;border-radius:999px;background:var(--mrx-line);flex:none}
.mrx-colis{display:flex;align-items:center;gap:6px;font-size:11px;padding:6px;border-radius:12px;background:var(--mrx-bg);min-width:0}
.mrx-colis b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mrx-colis svg{flex:none}
.mrx-fleche{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--mrx-accent)}
.mrx-point{width:8px;height:8px;border-radius:999px;background:var(--mrx-accent);opacity:0}
.mrx-vrm .mrx-colis{background:var(--mrx-surface);border:1px solid var(--mrx-line);justify-content:space-between}
.mrx-code{font-family:var(--vrm-police-mono,ui-monospace,monospace);font-size:12px;font-weight:600;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.mrx-qr{width:28px;height:28px;border-radius:6px;background:#fff;padding:2px;box-sizing:border-box;flex:none}
.mrx-etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
.mrx-etapes li{font-size:12px;line-height:1.4;color:var(--mrx-muted);padding:8px;border-radius:12px;background:var(--mrx-bg)}
.mrx-etapes li b{display:block;color:var(--mrx-ink);font-weight:600;margin-bottom:2px}
.mrx-faux{font-size:11px;color:var(--mrx-muted)}
@media (max-width:520px){.mrx-etapes{grid-template-columns:1fr}.mrx-scene{grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);padding:10px}}
@media (prefers-reduced-motion:no-preference){
  .mrx-anime .mrx-src .mrx-colis{animation:mrxPart 6s cubic-bezier(.2,.8,.2,1) infinite both}
  .mrx-anime .mrx-src .mrx-colis:nth-child(3){animation-delay:.35s}
  .mrx-anime .mrx-vrm .mrx-colis{animation:mrxArrive 6s cubic-bezier(.2,.8,.2,1) infinite both}
  .mrx-anime .mrx-vrm .mrx-colis:nth-child(3){animation-delay:.35s}
  .mrx-anime .mrx-point{animation:mrxFlux 6s linear infinite}
  .mrx-anime .mrx-point:nth-child(2){animation-delay:.25s}
  .mrx-anime .mrx-point:nth-child(3){animation-delay:.5s}
}
@keyframes mrxPart{0%,18%{opacity:1;transform:none}34%{opacity:.35;transform:translateX(10px)}82%{opacity:.35;transform:translateX(10px)}100%{opacity:1;transform:none}}
@keyframes mrxArrive{0%,30%{opacity:0;transform:translateX(-10px)}46%,88%{opacity:1;transform:none}100%{opacity:0;transform:translateX(-10px)}}
@keyframes mrxFlux{0%,16%{opacity:0;transform:translateY(-6px)}26%{opacity:1}40%{opacity:0;transform:translateY(6px)}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.mrx-point{opacity:.5}}
`;

// Un motif de QR DÉCORATIF (aucune donnée, illisible exprès) : trois repères et des cases fixes.
function QrDecoratif({ graine = 1 }) {
  const cases = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const repere = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
    if (repere) continue;
    if (((x * 7 + y * 5 + graine * 3) % 3) === 0) cases.push(<rect key={x + '-' + y} x={x} y={y} width="1" height="1"/>);
  }
  const rep = (x, y) => <g key={'r' + x + y}><rect x={x} y={y} width="3" height="3" fill="none" stroke="#111" strokeWidth=".6"/><rect x={x + 1} y={y + 1} width="1" height="1"/></g>;
  return <svg className="mrx-qr" viewBox="-.5 -.5 10 10" aria-hidden="true" fill="#111">{rep(0, 0)}{rep(6, 0)}{rep(0, 6)}{cases}</svg>;
}
const Boite = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>;

// Les colis de la scène : INVENTÉS.
const EXEMPLE = [{ n: '00 000 001', code: '482913', g: 1 }, { n: '00 000 002', code: '730256', g: 2 }];

export default function ExpliqueMondialRelay({ anime = true }) {
  return (
    <div className={'mrx' + (anime ? ' mrx-anime' : '')} data-explique-mr="">
      <style>{CSS}</style>
      <div className="mrx-scene" role="img" aria-label="Exemple inventé : ton compte Mondial Relay ouvert dans le navigateur, ses colis arrivent dans VRM avec leur code et leur QR">
        <div className="mrx-fen mrx-src">
          <div className="mrx-barre"><i/><i/><i/>mondialrelay.fr · Mes colis</div>
          {EXEMPLE.map((c) => <div key={c.n} className="mrx-colis"><Boite/><b>n° {c.n}</b></div>)}
        </div>
        <div className="mrx-fleche" aria-hidden="true"><span className="mrx-point"/><span className="mrx-point"/><span className="mrx-point"/></div>
        <div className="mrx-fen mrx-vrm">
          <div className="mrx-barre"><i/><i/><i/>VRM · À retirer</div>
          {EXEMPLE.map((c) => <div key={c.n} className="mrx-colis"><span className="mrx-code">{c.code}</span><QrDecoratif graine={c.g}/></div>)}
        </div>
      </div>
      <ol className="mrx-etapes">
        <li><b>1. Ouvre ton compte</b>sur mondialrelay.fr, connecté — Chrome, Orion ou un autre navigateur avec l’extension VRM.</li>
        <li><b>2. VRM relève tes colis</b>ceux qui arrivent, leur code et leur QR, compte par compte.</li>
        <li><b>3. Au relais</b>« En grand » : le code et le QR, reliés par le n° de suivi — jamais par le titre.</li>
      </ol>
      <span className="mrx-faux">Exemple inventé : n°, codes et QR de cette animation sont faux.</span>
    </div>
  );
}

// Une ligne par compte Mondial Relay relu : son nom, ses colis, « relu il y a … ».
export function LecturesMondialRelay({ mr, maintenant = Date.now() }) {
  if (!mr || !Array.isArray(mr.comptes) || !mr.comptes.length) return null;
  return (
    <ul className="vrm-mr-comptes" data-mr-comptes={mr.comptes.length}>
      {mr.comptes.map((c) => {
        const age = Date.parse(c.luAt || '');
        const vieux = Number.isFinite(age) && maintenant - age > 24 * 3600e3;
        return <li key={c.cle} data-mr-compte={c.cle} data-mr-compte-n={c.n} data-mr-relu={c.luAt || ''} data-mr-complet={c.complet ? '1' : '0'}>
          <span className="vrm-mr-nom">Mondial Relay · {c.libelle}</span>
          <span className={'vrm-mr-frais' + (vieux ? ' is-ambre' : '')}>{c.n} colis · {c.luAt ? `relu ${ilYa(c.luAt, maintenant)}` : 'jamais relu'}{c.complet ? '' : ' · lecture partielle'}{vieux ? ' · ouvre ce compte sur mondialrelay.fr pour le relire' : ''}</span>
        </li>;
      })}
    </ul>
  );
}
