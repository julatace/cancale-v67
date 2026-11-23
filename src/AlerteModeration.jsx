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
import { lireTout, load, save, onCloudReady, lirePreuvesVenteVinted, PhotoVinted } from './App.jsx';
import { Feuille } from './natif/index.js';
import { poserComptesFeuille } from './moderationFeuille.js';
import { ArretModerationCompte } from './Discretion.jsx';
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
  const [feuille, setFeuille] = React.useState('');   // (23 nov.) le compte dont la feuille des annonces disparues est ouverte
  const [menuA, setMenuA] = React.useState('');       // l'annonce dont le petit menu est ouvert
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
  // (23 nov.) Les comptes dont les annonces disparues sont expliquées ici (la feuille) : le bandeau « Vinted a modéré ce compte »
  // de ces comptes se range dans la feuille (src/moderationFeuille.js). La MÊME règle que la liste ci-dessous.
  const comptesDisp = Array.isArray(rows) ? [...new Set(alertesActives(rows, { vu, maintenant, vendues: vendues || null })
    .filter((e) => e.s === 'disparue' && (!uids.size || uids.has(e.compte))).map((e) => e.compte))].sort().join(',') : '';
  React.useEffect(() => { poserComptesFeuille(comptesDisp ? comptesDisp.split(',') : []); return () => poserComptesFeuille([]); }, [comptesDisp]);
  if (!Array.isArray(rows)) return null;                      // en cours ou pas su : rien
  // (19 nov., lot compte-bloque) « compte fermé » a sa carte à lui, avec la question (src/CompteBloque.jsx).
  const liste = alertesActives(rows, { vu, maintenant, vendues: vendues || null }).filter((e) => (!uids.size || uids.has(e.compte)) && e.s !== 'banni');
  // (22 nov., ext. 5.438, choix 3) Une annonce que Vinted ne masque PLUS (sa fin `f`, posée par la lecture complète du
  // dressing qui la voit visible) est DITE trois jours, une fois (« C'est vu » la range : clé `{cle}:f`) — jamais devinée.
  const revenues = (evenementsDesLignes(rows) || []).filter((e) => e.s === 'masquee' && Number(e.f) > 0 && maintenant - Number(e.f) < 3 * 864e5 && !(vu[e.cle + ':f'] != null) && (!uids.size || uids.has(e.compte)));
  // (23 nov., Julien : « montre-moi les PHOTOS des annonces supprimées au lieu de dire ça, et fais un pop-up ») Les annonces
  // DISPARUES d'un compte : UNE ligne compacte (photos empilées, « 5 annonces ont disparu de shop_cancale »), le détail dans une
  // feuille. La photo, le titre, le prix et le N° viennent de la fiche de CET identifiant d'annonce (`vinted_annonce_numeros`,
  // clé = l'id Vinted) — jamais d'une ressemblance ; sans fiche : une vignette neutre et « l'annonce {id} ».
  const disparues = liste.filter((e) => e.s === 'disparue');
  const autres = liste.filter((e) => e.s !== 'disparue');
  const groupes = [...disparues.reduce((m, e) => { const g = m.get(e.compte) || []; g.push(e); m.set(e.compte, g); return m; }, new Map()).entries()];
  if (!autres.length && !revenues.length && !groupes.length) return null;
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
  const ficheDe = (a) => (a && fiches[a]) || null;
  const prixDe = (f) => { const p = f && f.price; const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  const euros = (n) => (n == null ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: n % 1 ? 2 : 0 }) + ' €');
  const quand = (ms) => dateLoc(ms, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ligneDisparues = ([u, evts]) => {
    const photos = evts.map((e) => (ficheDe(e.a) || {}).photo).filter(Boolean).slice(0, 3);
    return (
      <button key={'d:' + u} type="button" className="vrm-mod-disp" data-moderation-disparues={String(evts.length)} data-moderation-compte={u} onClick={() => setFeuille(u)}>
        <span className="vrm-mod-pile" aria-hidden="true" data-moderation-pile={String(photos.length)}>
          {photos.length ? photos.map((ph, i) => <span key={ph + i} className="vrm-mod-pile-ph" style={{ zIndex: 3 - i }}><PhotoVinted src={ph} alt="" loading="lazy" decoding="async"/></span>)
            : <span className="vrm-mod-pile-ph vrm-mod-pile-vide"/>}
        </span>
        <span className="vrm-mod-disp-texte">{tr('ru.mod.disparues', { n: evts.length, compte: nomDe(u) || ('#' + u) })}</span>
        <span className="vrm-mod-chev" aria-hidden="true">›</span>
      </button>
    );
  };
  const groupeOuvert = feuille ? (groupes.find(([u]) => u === feuille) || null) : null;
  const feuilleDisparues = groupeOuvert ? (() => {
    const [u, evts] = groupeOuvert;
    const debut = Math.min(...evts.map((e) => e.av || e.t)), fin = Math.max(...evts.map((e) => e.t));
    return (
      <Feuille ouverte onFermer={() => { setFeuille(''); setMenuA(''); }} titre={tr('ru.mod.titreFeuille', { compte: nomDe(u) || ('#' + u) })} attrs={{ 'data-moderation-feuille': u, 'data-moderation-feuille-n': String(evts.length) }}>
        <p className="vrm-mod-phrase" data-moderation-phrase="">{tr('ru.mod.phrase', { debut: quand(debut), fin: quand(fin) })}</p>
        <ArretModerationCompte uid={u}/>
        <ul className="vrm-mod-grille" data-moderation-grille={String(evts.length)}>
          {evts.map((e) => { const f = ficheDe(e.a); const px = prixDe(f); const num = f && f.numero ? f.numero : null;
            return (
              <li key={e.cle} className="vrm-mod-case" data-moderation-case={e.a} data-moderation-photo={f && f.photo ? '1' : '0'}>
                <span className="vrm-mod-case-ph">{f && f.photo ? <PhotoVinted src={f.photo} alt="" loading="lazy" decoding="async"/> : <span className="vrm-mod-case-vide" aria-hidden="true"/>}</span>
                <span className="vrm-mod-case-titre">{(f && f.title) || tr('ru.mod.annonceId', { id: e.a })}</span>
                <span className="vrm-mod-case-pied">{num ? <b className="vrm-mod-num">{'N°' + num}</b> : null}{px != null ? <span>{euros(px)}</span> : null}</span>
                <button type="button" className="vrm-mod-case-menu" aria-label={tr('ru.mod.menu')} aria-expanded={menuA === e.cle} data-moderation-menu={e.a} onClick={() => setMenuA(menuA === e.cle ? '' : e.cle)}>⋯</button>
                {menuA === e.cle ? <span className="vrm-mod-case-choix" role="menu">
                  <button type="button" role="menuitem" data-moderation-moi={e.cle} onClick={() => { marquerVu([e.cle, e.cle + ':moi']); setMenuA(''); }}>{tr('ru.mod.moi')}</button>
                  <button type="button" role="menuitem" data-moderation-vu={e.cle} onClick={() => { marquerVu([e.cle]); setMenuA(''); }}>{tr('ru.mod.vu')}</button>
                </span> : null}
              </li>
            ); })}
        </ul>
        <div className="vrm-mod-gestes">
          <a className="vrm-mod-plein" href="https://www.vinted.fr/inbox" target="_blank" rel="noopener noreferrer" data-moderation-geste="disparue">{tr('ru.mod.messages')}</a>
          <button type="button" className="vrm-mod-second" data-moderation-tout-vu="feuille" onClick={() => { marquerVu(evts.map((e) => e.cle)); setFeuille(''); }}>{tr('ru.mod.toutVu')}</button>
        </div>
      </Feuille>
    );
  })() : null;
  if (!autres.length && !revenues.length) return (
    <section className="vrm-moderation vrm-moderation-compacte" data-moderation={liste.length} aria-label={tr('ru.mod.aria')}>
      {groupes.map(ligneDisparues)}
      {feuilleDisparues}
    </section>
  );
  return (
    <section className="vrm-moderation" data-moderation={liste.length} aria-label="Vinted a agi sur tes annonces ou ton compte">
      {groupes.map(ligneDisparues)}
      {feuilleDisparues}
      <div className="vrm-moderation-tete">
        <h2 className="vrm-moderation-titre">{!autres.length ? tr('mod5438.titreVisible') : autres.length > 1 ? `Vinted a agi ${autres.length} fois` : 'Vinted a agi'}</h2>
        {autres.length + revenues.length > 1 ? <button type="button" className="vrm-lien-action vrm-moderation-tout" data-moderation-tout-vu="" onClick={() => marquerVu(autres.map((e) => e.cle).concat(revenues.map((e) => e.cle + ':f')))}>Tout est vu</button> : null}
      </div>
      {autres.map((e) => {
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
