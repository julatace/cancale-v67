// ════════════════════════════════════════════════════════════════════════════
//  LE COUCOU DE LA CARTE (17 nov., migration 047, PAS APPLIQUÉE)
//  Julien : « que les personnes puissent se faire coucou, mais pas échanger des
//  messages dans mon app, mais sur Discord ». Sur la carte comme dans les
//  groupes : un toucher, AUCUN champ, aucun contenu ; celui qui le reçoit a UN
//  geste, « Lui écrire sur Discord » (le profil Discord signé de l'auteur), sinon
//  « Pas de Discord lié » et rien d'autre. Mêmes bornes que les groupes (une
//  paire par 24 h, 20 par jour, couper quelqu'un). Sans la 047 : « bientôt »,
//  jamais de repli vers un message.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, dateRelative } from '../i18n/index.js';
import { lienPourEcrire } from './coucou.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ilYa = (x) => {
  const t = Date.parse(x || ''); if (!isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return dateRelative(-Math.max(1, m), 'minute');
  if (m < 48 * 60) return dateRelative(-Math.round(m / 60), 'hour');
  return dateRelative(-Math.round(m / 1440), 'day');
};

// La forme lue de la route : `null` si elle n'est pas la bonne (« pas su »).
export function coucousCarteLus(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.recus) || !Array.isArray(x.deja)) return null;
  const nom = (s) => String(s || '').slice(0, 40);
  return {
    envoyes24h: Math.max(0, Number(x.envoyes24h) || 0), plafond: Number(x.plafond) || 20,
    deja: new Set(x.deja.filter((p) => UUID_RE.test(String(p)))),
    // Sur la carte, pas de salon de groupe : son profil Discord, sinon rien.
    recus: x.recus.filter((r) => r && UUID_RE.test(String(r.id))).map((r) => ({ id: r.id, de: nom(r.de_nom), le: r.le, ecrire: lienPourEcrire({ profil: r.profil, groupe: '' }) })),
    sourdines: (Array.isArray(x.sourdines) ? x.sourdines : []).filter((s) => s && UUID_RE.test(String(s.coucou))).map((s) => ({ coucou: s.coucou, nom: nom(s.nom) })),
  };
}

// Le bouton d'une personne de la carte : un toucher, aucun texte.
export function BoutonCoucouCarte({ p, cc, onCoucou }) {
  if (cc === 'non-installe') return <small className="vrm-cm-note" data-cm-coucou-bientot={p.pid}>{tr('cmc.bientotCourt')}</small>;
  const lu = cc && typeof cc === 'object';
  const deja = lu && cc.deja.has(p.pid), plafond = lu && cc.envoyes24h >= cc.plafond;
  return <button type="button" onClick={() => onCoucou(p)} disabled={!lu || deja || plafond} data-cm-coucou={p.pid} data-etat={!lu ? 'charge' : deja ? 'deja' : plafond ? 'plafond' : 'pret'}
    aria-label={tr('grp.coucou.aria', { nom: p.pseudo })}>
    {deja ? tr('grp.coucou.deja') : plafond ? tr('grp.coucou.plafondCourt') : <><span aria-hidden="true">👋</span> {tr('grp.coucou.bouton')}</>}
  </button>;
}

// Les coucous reçus sur la carte : UN geste chacun (Discord), et « ⋯ » pour couper.
export function CoucousCarte({ cc, onPlus }) {
  if (cc === 'non-installe') return <div className="vrm-cm-carton" data-cm-coucous-carte="non-installe"><h3>{tr('cmc.titre')}</h3><p className="vrm-cm-note">{tr('cmc.bientot')}</p></div>;
  if (!cc || typeof cc !== 'object') return null;
  return <div className="vrm-cm-carton" data-cm-coucous-carte={cc.recus.length}>
    <h3>{tr('cmc.titre')}</h3>
    {cc.recus.length === 0 ? <p className="vrm-cm-note">{tr('cmc.aucun')}</p>
      : <ul className="vrm-cm-liste">{cc.recus.map((r) => <li key={r.id} data-cm-coucou-recu={r.id} data-ecrire={r.ecrire.sorte}>
        <div><b>{tr('grp.coucou.aFait', { nom: r.de })}</b><small>{ilYa(r.le)}</small></div>
        <div className="vrm-cm-ligne-boutons">
          {r.ecrire.sorte === 'aucun' ? <span className="vrm-cm-note" data-cm-coucou-ecrire="aucun">{tr('grp.coucou.pasDeDiscord')}</span>
            : <a className="vrm-gc-discord-lien" href={r.ecrire.url} target="_blank" rel="noopener noreferrer" data-cm-coucou-ecrire={r.ecrire.sorte}>{tr('grp.coucou.ecrire')}</a>}
          <button type="button" className="vrm-gc-plus" onClick={() => onPlus(r)} aria-label={tr('grp.coucou.plusAria', { nom: r.de })} data-cm-coucou-plus>⋯</button>
        </div>
      </li>)}</ul>}
    <p className="vrm-cm-note">{tr('cmc.note')}</p>
  </div>;
}

export function FeuilleCoucouCarte({ r, onCouper, onFerme, FermeAuRetour }) {
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille vrm-gc-feuille" role="dialog" aria-modal="true" aria-label={tr('grp.coucou.aFait', { nom: r.de })} data-cm-coucou-feuille>
      <div className="vrm-cm-feuille-tete"><h3>{tr('grp.coucou.aFait', { nom: r.de })}</h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label={tr('grp.fermer')}>×</button></div>
      <p className="vrm-cm-note">{tr('cmc.sourdineNote')}</p>
      <div className="vrm-gc-bas">
        <button type="button" onClick={onCouper} data-cm-coucou-sourdine>{tr('grp.coucou.sourdine')}</button>
        <button type="button" className="vrm-cm-lien" onClick={onFerme}>{tr('grp.annuler')}</button>
      </div>
    </div>
  </div>;
}
