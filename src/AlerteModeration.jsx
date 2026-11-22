// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE EN TÊTE DE MA JOURNÉE : « VINTED A MASQUÉ / A FAIT DISPARAÎTRE /
// LIMITE » (11 nov., extension 5.350)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (ce qui est une alerte, le texte, quand elle s'arrête) :
// src/moderationVinted.js. Ici : UNE lecture projetée (`moderation_vinted_*`,
// `e` seulement), relue quand l'extension dit « moderation » ou au retour sur
// l'onglet. Chaque alerte dit QUOI (l'annonce par son N° — identité, jamais un
// titre), QUAND, la raison si Vinted la donne, et LE geste (un lien Vinted).
// « C'est vu » la range (`vrm_moderation_vu`, synchronisé) : elle reste dans
// Paramètres → « Ce que VRM a fait ».
// Pas su (lecture ratée) ⇒ rien : jamais d'alerte sur « pas su ». Une « disparue »
// dont la vente est PROUVÉE n'est pas une alerte (lue seulement s'il y en a une).
// Ambre (un geste à faire), jamais rouge (§7).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireTout, load, save, onCloudReady, lirePreuvesVenteVinted } from './App.jsx';
import { SELECT_MODERATION, LIGNE_MODERATION_VU, alertesActives, texteEvenement, evenementsDesLignes } from './moderationVinted.js';
import { tr, date as dateLoc } from './i18n/index.js';
import './styles-alerte-moderation.css';

// (21 nov., ext. 5.428, choix 57) « nike air max 1 taille 42 masquée par Vinted · Raison : … · Que faire » : le titre et la taille
// LUS sur l'annonce masquée (affichage ; l'alerte désigne l'identifiant), la raison si Vinted en donne une, le conseil qui
// suit cette raison ; sans raison : « Vinted ne dit pas pourquoi ». Masquée par LUI ou par VRM : jamais ici (la règle l'écarte).
export function texteMasquee(e, { numero = null, nom = '' } = {}) {
  if (!e || e.s !== 'masquee') return null;
  const titre = e.ti ? (e.ta ? tr('mod5428.articleTaille', { titre: e.ti, taille: e.ta }) : tr('mod5428.article', { titre: e.ti }))
    : numero ? 'N°' + numero : tr('mod5428.articleId', { id: e.a || '' });
  const raison = e.r ? tr('mod5428.raison', { raison: e.r }) : tr('mod5428.sansRaison');
  const conseil = tr('mod5428.queFaire', { conseil: tr('mod5428.c.' + (e.r ? (e.c || 'autre') : 'inconnu')) });
  return { titre: tr('mod5428.masquee', { article: (numero && e.ti ? 'N°' + numero + ' · ' : '') + titre }),
    quand: tr('mod5428.vue', { date: dateLoc(e.t, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) + (nom ? ' · ' + nom : ''),
    detail: raison + ' · ' + conseil + (e.r ? '' : ' ' + tr('mod5428.prudence')), geste: tr('mod5428.ouvrir'), lien: e.a ? `https://www.vinted.fr/items/${e.a}` : 'https://www.vinted.fr/inbox' };
}

export default function AlerteModeration({ comptes = [] }) {
  const [rows, setRows] = React.useState(undefined);
  const [vu, setVu] = React.useState(() => load(LIGNE_MODERATION_VU, {}) || {});
  const [vendues, setVendues] = React.useState(null);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => {
    let mort = false;
    const lire = () => lireTout(`id=like.moderation_vinted_*&select=${SELECT_MODERATION}`, { strict: true })
      .then((r) => { if (!mort) { setRows(Array.isArray(r) ? r : null); setMaintenant(Date.now()); } }, () => { if (!mort) setRows(null); });
    lire();
    const surExt = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && (d.quoi === 'moderation' || d.quoi === 'etatcompte')) lire(); };
    const auRetour = () => { if (document.visibilityState === 'visible') lire(); };
    const relireVu = () => setVu(load(LIGNE_MODERATION_VU, {}) || {});
    const off = onCloudReady(relireVu);
    const surSave = (e) => { if (e && e.detail && e.detail.k === LIGNE_MODERATION_VU) relireVu(); };
    window.addEventListener('vrm:ext', surExt);
    window.addEventListener('vrm:save', surSave);
    document.addEventListener('visibilitychange', auRetour);
    return () => { mort = true; off && off(); window.removeEventListener('vrm:ext', surExt); window.removeEventListener('vrm:save', surSave); document.removeEventListener('visibilitychange', auRetour); };
  }, []);
  // Les comptes qu'il a (jamais un compte retiré : « ne plus lui en parler »).
  const uids = React.useMemo(() => new Set((comptes || []).map((a) => String((a && a.vinted_user_id) || '')).filter(Boolean)), [comptes]);
  const brutes = React.useMemo(() => (Array.isArray(rows) ? alertesActives(rows, { vu, maintenant }) : null), [rows, vu, maintenant]);
  const aDisparue = !!(brutes && brutes.some((e) => e.s === 'disparue'));
  React.useEffect(() => {
    if (!aDisparue || vendues !== null) return undefined;
    let mort = false;
    lirePreuvesVenteVinted().then((p) => { if (!mort) setVendues(p && p.vendus instanceof Set ? p.vendus : false); }, () => { if (!mort) setVendues(false); });
    return () => { mort = true; };
  }, [aDisparue, vendues]);
  if (!Array.isArray(rows)) return null;                      // en cours ou pas su : rien
  // (19 nov., lot compte-bloque) « compte fermé » a sa carte à lui, avec la question (src/CompteBloque.jsx).
  const liste = alertesActives(rows, { vu, maintenant, vendues: vendues || null }).filter((e) => (!uids.size || uids.has(e.compte)) && e.s !== 'banni');
  // (22 nov., ext. 5.438, choix 3) Une annonce que Vinted ne masque PLUS (sa fin `f`, posée par la lecture complète du
  // dressing qui la voit visible) est DITE trois jours, une fois (« C'est vu » la range : clé `{cle}:f`) — jamais devinée.
  const revenues = (evenementsDesLignes(rows) || []).filter((e) => e.s === 'masquee' && Number(e.f) > 0 && maintenant - Number(e.f) < 3 * 864e5 && !(vu[e.cle + ':f'] != null) && (!uids.size || uids.has(e.compte)));
  if (!liste.length && !revenues.length) return null;
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const labels = load('vinted_account_labels', {}) || {};
  const nomDe = (uid) => labels[uid] || ((comptes || []).find((a) => String(a && a.vinted_user_id) === String(uid)) || {}).login || '';
  const marquerVu = (cles) => {
    const v = { ...(load(LIGNE_MODERATION_VU, {}) || {}) };
    const t = Date.now();
    for (const k of cles) v[k] = t;
    // Borné : 300 clés, les plus récentes.
    const garde = Object.fromEntries(Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 300));
    save(LIGNE_MODERATION_VU, garde);
    setVu(garde);
  };
  return (
    <section className="vrm-moderation" data-moderation={liste.length} aria-label="Vinted a agi sur tes annonces ou ton compte">
      <div className="vrm-moderation-tete">
        <h2 className="vrm-moderation-titre">{!liste.length ? tr('mod5438.titreVisible') : liste.length > 1 ? `Vinted a agi ${liste.length} fois` : 'Vinted a agi'}</h2>
        {liste.length + revenues.length > 1 ? <button type="button" className="vrm-lien-action vrm-moderation-tout" data-moderation-tout-vu="" onClick={() => marquerVu(liste.map((e) => e.cle).concat(revenues.map((e) => e.cle + ':f')))}>Tout est vu</button> : null}
      </div>
      {liste.map((e) => {
        const num = e.a && fiches[e.a] && fiches[e.a].numero ? fiches[e.a].numero : null;
        const t = e.s === 'masquee' ? texteMasquee(e, { numero: num, nom: nomDe(e.compte) }) : texteEvenement(e, { numero: num, nom: nomDe(e.compte) });
        if (!t) return null;
        return (
          <div key={e.cle} className="vrm-moderation-ligne" data-moderation-sorte={e.s} data-moderation-raison={e.s === 'masquee' ? (e.r ? (e.c || 'autre') : 'inconnue') : undefined} data-moderation-compte={e.compte} data-moderation-item={e.a || undefined}>
            <div className="vrm-moderation-corps">
              <div className="vrm-moderation-quoi">{t.titre}</div>
              <div className="vrm-moderation-quand">{t.quand}</div>
              <div className="vrm-moderation-detail">{t.detail}</div>
            </div>
            <div className="vrm-moderation-gestes">
              <a className="vrm-moderation-geste" href={t.lien} target="_blank" rel="noopener noreferrer" data-moderation-geste={e.s}>{e.s === 'masquee' ? tr('mod5438.verifier') : t.geste}</a>
              {e.s === 'masquee' && e.a ? <a className="vrm-moderation-vu" href={`https://www.vinted.fr/items/${e.a}/edit`} target="_blank" rel="noopener noreferrer" data-moderation-modifier={e.a}>{tr('mod5438.modifier')}</a> : null}
              {e.s === 'masquee' ? <a className="vrm-moderation-vu" href="https://www.vinted.fr/help" target="_blank" rel="noopener noreferrer" data-moderation-contacter="">{tr('mod5438.contacter')}</a> : null}
              <button type="button" className="vrm-moderation-vu" data-moderation-vu={e.cle} onClick={() => marquerVu([e.cle])}>C’est vu</button>
            </div>
          </div>
        );
      })}
      {revenues.map((e) => {
        const num = e.a && fiches[e.a] && fiches[e.a].numero ? fiches[e.a].numero : null;
        const art = e.ti ? (e.ta ? tr('mod5428.articleTaille', { titre: e.ti, taille: e.ta }) : tr('mod5428.article', { titre: e.ti })) : num ? 'N°' + num : tr('mod5428.articleId', { id: e.a || '' });
        return (
          <div key={e.cle + ':f'} className="vrm-moderation-ligne" data-moderation-sorte="visible" data-moderation-compte={e.compte} data-moderation-item={e.a || undefined}>
            <div className="vrm-moderation-corps">
              <div className="vrm-moderation-quoi">{tr('mod5438.visible', { article: art })}</div>
              <div className="vrm-moderation-quand">{dateLoc(e.f, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{nomDe(e.compte) ? ' · ' + nomDe(e.compte) : ''}</div>
              <div className="vrm-moderation-detail">{tr('mod5438.visibleDetail')}</div>
            </div>
            <div className="vrm-moderation-gestes">
              <a className="vrm-moderation-geste" href={`https://www.vinted.fr/items/${e.a}`} target="_blank" rel="noopener noreferrer" data-moderation-geste="visible">{tr('mod5438.verifier')}</a>
              <button type="button" className="vrm-moderation-vu" data-moderation-vu={e.cle + ':f'} onClick={() => marquerVu([e.cle + ':f'])}>{tr('mod5438.cestVu')}</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
