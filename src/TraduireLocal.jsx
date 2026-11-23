// ══════════════════════════════════════════════════════════════════════════════
//  TRADUIRE SUR L'APPAREIL · NOTE DE L'ACHETEUR — écran Messages de l'app (21 nov. 2026, ext. 5.430)
//  docs/passation/2026-11-21-ext-5430.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (21 nov., choix n° 69) : un message dans une autre langue que la sienne est RECONNU (API LanguageDetector de
// Chrome si elle est là, sinon les indices simples de la règle des réponses rapides, `rrLangue`) et « Traduire »
// l'affiche traduit sous l'original par l'API Translator intégrée à Chrome — sur l'appareil. AUCUN appel réseau à un
// service de traduction, aucune clé (CLAUDE.md §2.9). Navigateur sans ces API (Safari, Orion, ancien Chrome) : pas de
// bouton, et UNE ligne par fil dit pourquoi (`TraductionAbsente`).
// (choix n° 75) L'étiquette de note de l'acheteur : la MÊME règle que l'extension (src/noteAcheteur.js).
import React from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { rrLangue } from './reponsesRapides.js';
import { naNote, naEtiquette } from './noteAcheteur.js';
import './styles-traduire.css';

export const traductionPresente = () => { try { return typeof window !== 'undefined' && !!window.Translator && typeof window.Translator.create === 'function'; } catch (_) { return false; } };
const nomLangue = (c) => { try { const n = new Intl.DisplayNames([langueCourante()], { type: 'language' }).of(c); return n || c; } catch (_) { return c; } };
// La langue d'un texte : le navigateur d'abord (modèle déjà sur l'appareil, confiance ≥ 0,6), sinon les indices simples.
export async function langueDuTexte(texte) {
  const t = String(texte || '').trim();
  if (!t) return null;
  try {
    const L = typeof window !== 'undefined' ? window.LanguageDetector : null;
    if (L && typeof L.create === 'function' && (typeof L.availability !== 'function' || (await L.availability()) === 'available')) {
      const d = await L.create(); const r = await d.detect(t); try { if (d.destroy) d.destroy(); } catch (_) {}
      const x = Array.isArray(r) ? r[0] : null;
      const c = x && typeof x.detectedLanguage === 'string' ? x.detectedLanguage.slice(0, 2).toLowerCase() : '';
      if (c && c !== 'un' && Number(x.confidence) >= 0.6) return c;
    }
  } catch (_) {}
  return rrLangue(t);
}
// Le bouton « Traduire » d'UNE bulle : seulement si la langue est reconnue ET n'est pas la sienne, et si le navigateur sait.
export function BoutonTraduire({ texte }) {
  const [langue, setLangue] = React.useState(undefined);
  const [etat, setEtat] = React.useState('idle');   // idle | charge | fait | ko
  const [trad, setTrad] = React.useState('');
  React.useEffect(() => { let vivant = true; langueDuTexte(texte).then((l) => { if (vivant) setLangue(l || ''); }); return () => { vivant = false; }; }, [texte]);
  const ui = langueCourante();
  if (!traductionPresente() || !langue || langue === ui) return null;
  const lancer = async () => {
    if (etat === 'charge') return;
    setEtat('charge');
    try {
      if ((await window.Translator.availability({ sourceLanguage: langue, targetLanguage: ui })) === 'unavailable') { setEtat('ko'); return; }
      const t = await window.Translator.create({ sourceLanguage: langue, targetLanguage: ui });
      const out = await t.translate(String(texte)); try { if (t.destroy) t.destroy(); } catch (_) {}
      if (out && String(out).trim()) { setTrad(String(out)); setEtat('fait'); } else setEtat('ko');
    } catch (_) { setEtat('ko'); }
  };
  if (etat === 'fait') return <div className="vrm-trad" data-traduit={langue}>{trad}<small>{tr('tr.depuis', { l: nomLangue(langue) })}</small></div>;
  if (etat === 'ko') return <div className="vrm-trad-ko" data-traduction="ko">{tr('tr.ko')}</div>;
  return <button type="button" className="vrm-trad-btn" data-traduire={langue} onClick={lancer} disabled={etat === 'charge'}>{etat === 'charge' ? tr('tr.charge') : tr('tr.traduire')}</button>;
}
// UNE ligne par fil, quand le navigateur ne sait pas traduire et qu'un message de l'autre personne est dans une autre langue.
export function TraductionAbsente({ textes }) {
  const [langue, setLangue] = React.useState('');
  const cle = (textes || []).join('\u0001');
  React.useEffect(() => {
    let vivant = true;
    if (traductionPresente()) { setLangue(''); return undefined; }
    (async () => { for (const t of textes || []) { const l = await langueDuTexte(t); if (l && l !== langueCourante()) { if (vivant) setLangue(l); return; } } if (vivant) setLangue(''); })();
    return () => { vivant = false; };
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!langue) return null;
  return <div className="vrm-trad-absente" data-traduction="absente" data-traduction-langue={langue} role="note">{tr('tr.absente', { l: nomLangue(langue) })}</div>;
}
const etoilesTxt = (e) => { try { return new Intl.NumberFormat(langueCourante(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(e)); } catch (_) { return String(e); } };
// L'étiquette de note de l'acheteur (`opposite_user` de la conversation : feedback_reputation, review_count) ;
// pas sue ⇒ rien (l'écran ne dit pas une note qu'il n'a pas lue). `reglage` = SON réglage (seuil, compte neuf).
export function NoteAcheteurApp({ u, reglage = null }) {
  const et = naEtiquette(naNote(u), reglage);
  if (et.k === 'pas-su') return null;
  const txt = et.k === 'neuf' ? tr('na.neuf') : tr(et.n === 1 ? 'na.note1' : 'na.note', { e: etoilesTxt(et.etoiles), n: et.n });
  return (
    <span className="vrm-note-acheteur" data-note-acheteur={et.k} data-note-etoiles={et.etoiles == null ? undefined : String(et.etoiles)} data-k={et.ambre ? 'ambre' : undefined}>
      {txt}
    </span>
  );
}
export function NoteAcheteurAvis({ u, reglage = null }) {
  const et = naEtiquette(naNote(u), reglage);
  return et.k === 'note' && et.ambre ? <p className="vrm-note-avis" data-note-avis="basse" role="note">{tr('na.basse')}</p> : null;
}
