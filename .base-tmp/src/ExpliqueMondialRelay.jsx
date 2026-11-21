// ── « LE QR MONDIAL RELAY : UNE CAPTURE DE L'APP » (5 nov.) ──────────────────
// Julien (5 nov., mot pour mot) : « je ne peux pas avoir les qr code dans le
// navigateur c'est que dans l'app ». Le QR Mondial Relay n'existe QUE dans
// l'application mobile Mondial Relay (ni e-mail, ni mondialrelay.fr) : aucune
// extension ne peut le lire. La scène montre le SEUL chemin : une capture d'écran
// de l'app, choisie sur le colis dans VRM (« Ajouter le QR »), lue DANS le
// téléphone (src/lireQrCapture.js), le code et le QR ensuite « En grand ».
// ⚠️ DONNÉES INVENTÉES (§2.3 et vocal : « des données simulées, jamais les
// siennes ») : n°, code et QR sont faux — le QR dessiné est un motif décoratif,
// pas un code lisible. `prefers-reduced-motion` ⇒ la scène finale, fixe.
//
// `LecturesMondialRelay` : la fraîcheur de CHAQUE compte Mondial Relay relu (pour
// les CODES seulement — piste `mr_colis_*`, src/retraitQr.js). Rien lu ⇒ rien ici.
import React from 'react';
import { ilYa } from './retraitQr.js';

const CSS = `
.mrx{--mrx-ink:var(--vrm-ink,#1D1D1F);--mrx-muted:var(--vrm-muted,#6E6E73);--mrx-line:var(--vrm-line,#E5E5EA);--mrx-surface:var(--vrm-surface,#FFFFFF);--mrx-bg:var(--vrm-bg,#F5F5F7);--mrx-accent:var(--vrm-accent,#0071E3);
  display:flex;flex-direction:column;gap:12px;color:var(--mrx-ink)}
.mrx-scene{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);align-items:center;gap:8px;padding:14px;border-radius:14px;background:var(--mrx-bg);overflow:hidden;min-height:176px}
.mrx-fen{overflow:hidden;background:var(--mrx-surface);border:1px solid var(--mrx-line);border-radius:12px;padding:8px;min-width:0;display:flex;flex-direction:column;gap:6px}
.mrx-barre{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mrx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mrx-barre i{width:6px;height:6px;border-radius:999px;background:var(--mrx-line);flex:none}
.mrx-colis{display:flex;align-items:center;gap:6px;font-size:11px;padding:6px;border-radius:12px;background:var(--mrx-bg);min-width:0}
.mrx-colis b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mrx-colis svg{flex:none}
.mrx-fleche{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--mrx-accent)}
.mrx-point{width:8px;height:8px;border-radius:999px;background:var(--mrx-accent);opacity:.25}
.mrx-vrm .mrx-colis{background:var(--mrx-surface);border:1px solid var(--mrx-line);justify-content:space-between}
.mrx-code{font-family:var(--vrm-police-mono,ui-monospace,monospace);font-size:12px;font-weight:600;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.mrx-qr{width:28px;height:28px;border-radius:6px;background:#fff;padding:2px;box-sizing:border-box;flex:none}
.mrx-etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
.mrx-etapes li{font-size:12px;line-height:1.4;color:var(--mrx-muted);padding:8px;border-radius:12px;background:var(--mrx-bg)}
.mrx-etapes li b{display:block;color:var(--mrx-ink);font-weight:600;margin-bottom:2px}
.mrx-faux{font-size:11px;color:var(--mrx-muted)}
.mrx-centre{justify-content:center}
.mrx-flash{font-size:11px;color:var(--mrx-muted)}
@media (max-width:520px){.mrx-etapes{grid-template-columns:1fr}.mrx-scene{grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);padding:10px}}
@media (prefers-reduced-motion:no-preference){
  .mrx-anime .mrx-src .mrx-colis{animation:mrxPart 6s cubic-bezier(.2,.8,.2,1) infinite both}
  .mrx-anime .mrx-vrm .mrx-colis{animation:mrxArrive 6s cubic-bezier(.2,.8,.2,1) infinite both}
  .mrx-anime .mrx-point{animation:mrxFlux 6s linear infinite}
  .mrx-anime .mrx-point:nth-child(2){animation-delay:.25s}
  .mrx-anime .mrx-point:nth-child(3){animation-delay:.5s}
}
@keyframes mrxPart{0%,10%{opacity:.4;transform:translateX(6px)}22%,40%{opacity:1;transform:none}56%,100%{opacity:.4;transform:translateX(6px)}}
@keyframes mrxArrive{0%,10%{opacity:1;transform:none}20%,44%{opacity:0;transform:translateX(-10px)}60%,100%{opacity:1;transform:none}}
@keyframes mrxFlux{0%,38%{opacity:.25;transform:translateY(-6px)}46%{opacity:1}56%{opacity:.25;transform:translateY(6px)}100%{opacity:.25}}
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

// Le colis de la scène : INVENTÉ.
const EXEMPLE = { n: '00 000 001', code: '482913', g: 1 };

export default function ExpliqueMondialRelay({ anime = true }) {
  return (
    <div className={'mrx' + (anime ? ' mrx-anime' : '')} data-explique-mr="" data-explique-mr-chemin="capture">
      <style>{CSS}</style>
      <div className="mrx-scene" role="img" aria-label="Exemple inventé : une capture d’écran de l’app Mondial Relay, choisie sur le colis dans VRM, qui y montre ensuite le code et le QR">
        <div className="mrx-fen mrx-src">
          <div className="mrx-barre"><i/><i/><i/>App Mondial Relay</div>
          <div className="mrx-colis"><Boite/><b>n° {EXEMPLE.n}</b></div>
          <div className="mrx-colis mrx-centre"><QrDecoratif graine={EXEMPLE.g}/><span className="mrx-flash">capture</span></div>
        </div>
        <div className="mrx-fleche" aria-hidden="true"><span className="mrx-point"/><span className="mrx-point"/><span className="mrx-point"/></div>
        <div className="mrx-fen mrx-vrm">
          <div className="mrx-barre"><i/><i/><i/>VRM</div>
          <div className="mrx-colis"><span className="mrx-code">{EXEMPLE.code}</span><QrDecoratif graine={EXEMPLE.g}/></div>
          <div className="mrx-colis mrx-centre"><b>En grand</b></div>
        </div>
      </div>
      <ol className="mrx-etapes">
        <li><b>1. Dans l’app Mondial Relay</b>ouvre le colis et fais une capture d’écran de son QR.</li>
        <li><b>2. Dans VRM, sur ce colis</b>« Ajouter le QR », choisis la capture. Lu sur ton téléphone.</li>
        <li><b>3. Au relais</b>« En grand » : le code et le QR. Sans QR, le code suffit au comptoir.</li>
      </ol>
      <span className="mrx-faux">Exemple inventé : n°, code et QR de cette animation sont faux.</span>
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
          <span className={'vrm-mr-frais' + (vieux ? ' is-ambre' : '')}>{c.n} colis · {c.luAt ? `codes relus ${ilYa(c.luAt, maintenant)}` : 'jamais relu'}{c.complet ? '' : ' · lecture partielle'}{vieux ? ' · ouvre ce compte sur mondialrelay.fr pour relire ses codes' : ''}</span>
        </li>;
      })}
    </ul>
  );
}
