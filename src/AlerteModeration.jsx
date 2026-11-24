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
// (24 nov., réconciliation #1321 × #1346 — Julien : « c'est moche ») UNE carte : la base de la revue UX (#1321 : une
// ligne compacte par compte, photos empilées, la feuille aux grandes photos) + ce que le lot moderation-carte (#1346)
// faisait mieux : le compte et la fenêtre (« entre le … et le … ») dits UNE fois sur la ligne, l'explication UNE fois
// sous « Pourquoi ? », le N° en pastille sur SA photo (identifiant d'annonce, jamais un titre), 6 photos puis « Voir les
// N autres », le geste toujours visible (pied de la feuille), tous les textes par tr(), ni ambre ni orange ni trait de
// bord (gris clair, accent ardoise). Le rouge reste aux deux paires sous un N° (§7). Cibles 44 px.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireTout, load, save, onCloudReady, lirePreuvesVenteVinted, PhotoVinted, Icon } from './App.jsx';
import { Feuille, Bouton } from './natif/index.js';
import { Pourquoi } from './natif/Actions.jsx';
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

const jourCourt = (ms) => dateLoc(ms, { day: 'numeric', month: 'short' }).replace(/\.$/, '');
// La fenêtre d'un groupe, dite une fois : « entre le 21 nov et le 23 nov » (ou « le 23 nov »).
export function fenetreGroupe(evts) {
  const L = (evts || []).filter((e) => e && Number(e.t) > 0);
  if (!L.length) return '';
  const de = Math.min(...L.map((e) => Number(e.av) > 0 ? Number(e.av) : Number(e.t))), a = Math.max(...L.map((e) => Number(e.t)));
  const j1 = jourCourt(de), j2 = jourCourt(a);
  return j1 === j2 ? tr('modc.le', { jour: j2 }) : tr('modc.entre', { de: j1, a: j2 });
}
// La photo d'une annonce : celle de SA fiche (`vinted_annonce_numeros[id].photo`), par identifiant — jamais par titre.
const photoDeFiche = (f) => (f && (typeof f.photo === 'string' ? f.photo : (f.photo && f.photo.url))) || '';
// « 5 annonces ont disparu de shop_cancale » : jamais un « · » en début de ligne.
const insecable = (t) => String(t || '').replace(/ · /g, '\u00a0·\u00a0');
const PHOTOS_VISIBLES = 6;

export default function AlerteModeration({ comptes = [] }) {
  const [rows, setRows] = React.useState(undefined);
  const [vu, setVu] = React.useState(() => load(LIGNE_MODERATION_VU, {}) || {});
  const [vendues, setVendues] = React.useState(null);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  const [feuille, setFeuille] = React.useState('');   // (23 nov.) le compte dont la feuille des annonces disparues est ouverte
  const [menuA, setMenuA] = React.useState('');       // l'annonce dont le petit menu est ouvert
  const [toutes, setToutes] = React.useState(false);  // « Voir les N autres » dans la feuille
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
  const ligneDisparues = ([u, evts]) => {
    const photos = evts.map((e) => photoDeFiche(ficheDe(e.a))).filter(Boolean).slice(0, 3);
    const nom = nomDe(u) || ('#' + u);
    return (
      <button key={'d:' + u} type="button" className="vrm-mod-disp" data-moderation-disparues={String(evts.length)} data-moderation-groupe="disparue" data-moderation-compte={u} data-moderation-n={evts.length}
        aria-haspopup="dialog" onClick={() => { setFeuille(u); setToutes(false); setMenuA(''); }}>
        <span className="vrm-mod-pile" aria-hidden="true" data-moderation-pile={String(photos.length)}>
          {photos.length ? photos.map((ph, i) => <span key={ph + i} className="vrm-mod-pile-ph" style={{ zIndex: 3 - i }}><PhotoVinted src={ph} alt="" loading="lazy" decoding="async" repli={null}/></span>)
            : <span className="vrm-mod-pile-ph vrm-mod-pile-vide"><Icon name="image" size={18}/></span>}
          <span className="vrm-mod-pile-n" data-moderation-pastille="">{evts.length}</span>
        </span>
        <span className="vrm-mod-disp-texte">
          <span className="vrm-mod-disp-titre" data-moderation-groupe-titre="">{insecable(tr('ru.mod.disparues', { n: evts.length, compte: nom }))}</span>
          <span className="vrm-mod-disp-quand" data-moderation-fenetre="">{fenetreGroupe(evts)}</span>
        </span>
        <span className="vrm-mod-chev" aria-hidden="true"><Icon name="chevron" size={18}/></span>
      </button>
    );
  };
  const groupeOuvert = feuille ? (groupes.find(([u]) => u === feuille) || null) : null;
  const feuilleDisparues = groupeOuvert ? (() => {
    const [u, evts] = groupeOuvert;
    const vues = toutes ? evts : evts.slice(0, PHOTOS_VISIBLES);
    const reste = evts.length - vues.length;
    return (
      <Feuille ouverte onFermer={() => { setFeuille(''); setMenuA(''); }} titre={tr('ru.mod.titreFeuille', { compte: nomDe(u) || ('#' + u) })}
        attrs={{ 'data-moderation-feuille': u, 'data-moderation-feuille-n': String(evts.length) }}
        pied={<div className="vrm-mod-gestes">
          {/* LE geste : ouvrir la messagerie Vinted (Vinted y dit pourquoi il a retiré une annonce). Toujours visible. */}
          <Bouton variante="plein" large icone={<Icon name="chat" size={18}/>} onClick={() => { try { window.open('https://www.vinted.fr/inbox', '_blank', 'noopener,noreferrer'); } catch (_) {} }} attrs={{ 'data-moderation-geste': 'disparue', 'data-href': 'https://www.vinted.fr/inbox' }}>{tr('ru.mod.messages')}</Bouton>
          <Bouton variante="teinte" large icone={<Icon name="check" size={18}/>} onClick={() => { marquerVu(evts.map((e) => e.cle)); setFeuille(''); }} attrs={{ 'data-moderation-tout-vu': 'feuille', 'data-moderation-groupe-vu': u }}>{tr('ru.mod.toutVu')}</Bouton>
        </div>}>
        {/* La fenêtre (≤ 8 mots, la même source que la ligne : `fenetreGroupe`) ; l'explication entière sous « Pourquoi ? », une fois. */}
        <p className="vrm-mod-phrase" data-moderation-phrase="">{fenetreGroupe(evts)}</p>
        <div className="vrm-mod-pourquoi"><Pourquoi attrs={{ 'data-moderation-pourquoi': 'disparue' }}>{tr('modc.pourquoiDisparue', { n: evts.length })}</Pourquoi></div>
        <ArretModerationCompte uid={u}/>
        <ul className="vrm-mod-grille" data-moderation-grille={String(evts.length)}>
          {vues.map((e) => { const f = ficheDe(e.a); const ph = photoDeFiche(f); const px = prixDe(f); const num = f && f.numero != null && f.numero !== '' ? String(f.numero) : null;
            return (
              <li key={e.cle} className="vrm-mod-case" data-moderation-case={e.a} data-moderation-item={e.a || undefined} data-moderation-photo={ph ? '1' : '0'}>
                <span className="vrm-mod-case-ph">
                  {ph ? <PhotoVinted src={ph} alt="" loading="lazy" decoding="async" repli={null}/> : <span className="vrm-mod-case-vide" aria-hidden="true"><Icon name="image" size={28}/></span>}
                  {num ? <b className="vrm-mod-num" data-moderation-num={num}>{'N°' + num}</b> : null}
                </span>
                <span className="vrm-mod-case-titre">{(f && f.title) || tr('ru.mod.annonceId', { id: e.a })}</span>
                {px != null ? <span className="vrm-mod-case-pied">{euros(px)}</span> : null}
                <button type="button" className="vrm-mod-case-menu" aria-label={tr('ru.mod.menu')} aria-expanded={menuA === e.cle} data-moderation-menu={e.a} onClick={() => setMenuA(menuA === e.cle ? '' : e.cle)}><Icon name="more" size={20}/></button>
                {menuA === e.cle ? <span className="vrm-mod-case-choix" role="menu">
                  <button type="button" role="menuitem" data-moderation-moi={e.cle} onClick={() => { marquerVu([e.cle, e.cle + ':moi']); setMenuA(''); }}>{tr('ru.mod.moi')}</button>
                  <button type="button" role="menuitem" data-moderation-vu={e.cle} onClick={() => { marquerVu([e.cle]); setMenuA(''); }}>{tr('ru.mod.vu')}</button>
                </span> : null}
              </li>
            ); })}
        </ul>
        {reste > 0 ? <button type="button" className="vrm-mod-plus" data-moderation-plus={reste} onClick={() => setToutes(true)}>{tr('modc.voirAutres', { n: reste })}</button> : null}
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
    <section className="vrm-moderation" data-moderation={liste.length} aria-label={tr('modc.aria')}>
      {groupes.map(ligneDisparues)}
      {feuilleDisparues}
      <div className="vrm-moderation-tete">
        <h2 className="vrm-moderation-titre">{!autres.length ? tr('mod5438.titreVisible') : autres.length > 1 ? tr('modc.titre', { n: autres.length }) : tr('modc.titreUn')}</h2>
        {/* « Tout est vu » de la carte range TOUT ce qu'elle montre, disparues comprises (sinon la carte reste). */}
        {liste.length + revenues.length > 1 ? <button type="button" className="vrm-lien-action vrm-moderation-tout" data-moderation-tout-vu="" onClick={() => marquerVu(liste.map((e) => e.cle).concat(revenues.map((e) => e.cle + ':f')))}>{tr('modc.toutVu')}</button> : null}
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
              <button type="button" className="vrm-moderation-vu" data-moderation-vu={e.cle} onClick={() => marquerVu([e.cle])}>{tr('mod5438.cestVu')}</button>
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
