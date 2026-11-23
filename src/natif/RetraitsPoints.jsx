// ════════════════════════════════════════════════════════════════════════════
//  src/natif/RetraitsPoints.jsx — LES COLIS À RETIRER, UNE CARTE PAR POINT (20 nov.)
//  Julien : « Colis à retirer beaucoup plus visuel, c'est pas exceptionnel, tu peux encore faire ».
//  Style natif « entre Vintex et natif » (docs/design/NATIF.md §2 bis) : cartes à filet, petites capitales grises,
//  étiquettes douces, accent rare, ambre = urgent. AUCUNE règle ici : les points arrivent de `pointsARetirer`
//  (src/relaisColis.js) sur la liste `pickupUnion`, chaque geste est celui d'avant (`enGrand` = openQrView). Tri, résumé, compte à rebours, itinéraire : src/retraitsVue.js.
//    · une bande résumé et le plan des points (liste ordonnée, aucune carte payante) ;
//    · une carte par point : nom en grand, sorte (consigne / comptoir), transporteur et logo, adresse + Itinéraire,
//      horaires LUS, compte à rebours de la limite LUE, mini-carte seulement si un repère sûr existe ;
//    · chaque colis : photo, titre, N°, prix payé, le CODE en très grand + « Copier », miniature du QR s'il existe,
//      « Nouveau » s'il vient d'arriver ;
//    · (20 nov., suite) la BARRE DU TRAJET de chaque colis (Payé · Expédié · En transit · Au point · Retiré), chaque
//      étape sur sa date LUE (src/retraitTrajet.js), grise sinon ; le QR à DROITE du code, en grand, sur blanc ;
//      la RÉTENTION : un colis « à vérifier » (date limite dépassée…) reste dans sa carte, code et QR visibles ;
//    · (20 nov., Julien : « je ne veux plus de Je suis au point ») plus d'écran plein : le contenu, le code et le QR
//      restent dans la carte du point ; toucher le code ou le QR l'ouvre en grand (`enGrand` = openQrView, comme avant).
//    · (21 nov., Julien : « les retraits des colis, tu peux faire clairement mieux », « simple, calme ») UNE liste groupée par
//      point : en tête nom, adresse, horaires lus, nombre, Itinéraire ; dessous chaque colis (contenu, frise, CODE en grand,
//      QR) ; « En route vers ce point » replié dessous avec la date prévue (src/relaisPrevision.js) ; les points où rien
//      n'attend encore mais où des achats arrivent (« Bientôt ») ; la CARTE des points (src/natif/CartePoints.jsx) sur son
//      toucher ; les achats sans point lu, une rangée repliée à la fin. Plus de plan des points ni de bouton « Copier ».
//    · (21 nov., lot relier-code — Julien : « améliore le design du carré où il y a le code de retrait ») chaque colis est un
//      BILLET (façon carte de retrait / Wallet) : la paire en haut, la frise fine, une ligne de coupe, puis le CODE sur fond
//      BLANC même en mode sombre (chasse fixe, chiffres groupés « 978 216 », 34–40 px, encre noire), le QR à côté à taille
//      scannable, et « Plein écran » (le geste d'avant, `enGrand`) — PAS de « Copier » (Julien, 21 nov. : « enlève Copier sur
//      les retraits »). En tête du point : logo du
//      transporteur en couleur, nom du point, l'étiquette d'état « Au point · à retirer avant le 24 nov. » (ambre à moins de 2 j,
//      date tirée de la limite LUE seulement), adresse et « Itinéraire ». Plusieurs colis au même point = billets séparés.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, localeCourante } from '../i18n/index.js';
import { CLE_RETRAITS_VUS, estNouveau, marquerVu } from '../retraitsNouveaux.js';
import { trierPoints, resumeRetraits, limiteDuPoint, compteARebours, lienItineraire, appareilApple, colisDuPoint, mentionVerif } from '../retraitsVue.js';
import { jourCourt } from '../retraitTrajet.js';
import { CartePoints } from './CartePoints.jsx';
import { arriveePrevue } from '../relaisPrevision.js';
import { Plaque } from './Plaque.jsx';
import { texteContenu, rangeeRetrait } from '../contenuColis.js';
import './retraits.css';

// (20 nov., rétention) Tout colis que `pickupUnion` n'a pas FINI par une preuve reste dans la carte de son point :
// les comptés, puis les « à vérifier » (date limite dépassée…), code et QR visibles (src/retraitsVue.js `colisDuPoint`).
const SITES = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' };   // noms de marque, non traduits
const MENTION = { depasse: 'retraits.m.depasse', 'trop-long': 'retraits.m.tropLong', 'sans-code': 'retraits.m.sansCode', transporteur: 'retraits.m.transporteur', doute: 'retraits.m.doute', autre: 'retraits.m.autre' };
const lireNouveaux = () => { try { return JSON.parse(localStorage.getItem(CLE_RETRAITS_VUS) || 'null'); } catch (_) { return null; } };
const texteRebours = (c) => {
  if (!c) return '';
  if (c.cle === 'depasse') return tr('retraits.v.depasse');
  if (c.cle === 'aujourdhui') return c.heure ? tr('retraits.v.aujourdhuiHeure', { h: c.heure }) : tr('retraits.v.aujourdhui');
  if (c.cle === 'demain') return c.heure ? tr('retraits.v.demainHeure', { h: c.heure }) : tr('retraits.v.demain');
  return tr('retraits.v.dans', { n: c.n });
};

// « 978216 » ⇒ ['978', '216'] ; « 1234 » ⇒ ['12', '34'] ; un code long (lettres) par 4. Affichage seulement : le texte du
// code reste entier dans le DOM (les morceaux sont des <code> collés : <code> garde sa chasse fixe sous la règle de police globale), rien n'est changé à ce qu'on tape au guichet.
export function grouperCode(code) {
  const c = String(code || '');
  if (!c) return [];
  if (/\s/.test(c)) return c.split(/\s+/).filter(Boolean);
  const pas = c.length > 7 ? 4 : c.length === 4 ? 2 : 3;
  const out = [];
  for (let i = 0; i < c.length; i += pas) out.push(c.slice(i, i + pas));
  if (out.length > 1 && out[out.length - 1].length === 1) { const d = out.pop(); out[out.length - 1] += d; }
  return out;
}
// L'étiquette d'état du point : « Au point · à retirer avant le 24 nov. » — la date tirée de la limite LUE (jours restants),
// jamais d'une estimation ; dépassée ⇒ « date limite dépassée ».
const texteEtatPoint = (c, loc) => {
  if (!c) return '';
  if (c.cle === 'depasse') return tr('retraits.v.depasse');
  if (c.cle === 'aujourdhui') return tr('retraits.b.avantAuj', { h: c.heure || '' }).replace(/\s+·?\s*$/, '');
  let d = '';
  try { d = new Date(Date.now() + c.n * 86400e3).toLocaleDateString(loc, { day: 'numeric', month: 'short' }); } catch (_) { d = ''; }
  return tr('retraits.b.avant', { date: d });
};

// La barre du trajet : cinq étapes, chacune allumée par SA date lue (jamais déduite d'une autre). La plus avancée des
// étapes lues est la courante ; une étape non lue reste grise, sans date.
// (21 nov., relier-code — « tu peux faire mieux sur le visuel ») COMPACTE, sur une ligne au pied du billet : cinq traits (franchis
// en encre, la courante en vert sapin, jamais de bleu), puis « Au point · 21 nov. » ; le nom et la date de CHAQUE étape restent dans
// la liste pour le lecteur d'écran (`n-rp-lu`), rien n'est inventé ni retiré.
function Trajet({ t }) {
  if (!t || !Array.isArray(t.etapes) || !t.etapes.length) return null;
  const loc = localeCourante();
  const aria = t.etapes.map((e) => tr('retraits.t.' + e.cle) + ' ' + (e.lue ? jourCourt(e.at, loc) : tr('retraits.t.pasLue'))).join(', ');
  const c = t.courante >= 0 ? t.etapes[t.courante] : null;
  return (
    <div className="n-rp-frise" data-rp-frise="">
      <ol className="n-rp-trajet" data-rp-trajet="" data-rp-trajet-courante={c ? c.cle : ''} aria-label={tr('retraits.t.aria', { etapes: aria })}>
        {t.etapes.map((e, i) => (
          <li key={e.cle} className={'n-rp-etape' + (e.lue ? ' is-lue' : '') + (i === t.courante ? ' is-courante' : '')}
            data-rp-etape={e.cle} data-rp-etape-lue={e.lue ? '1' : '0'} data-rp-etape-courante={i === t.courante ? '1' : undefined} data-rp-etape-at={e.lue ? new Date(e.at).toISOString() : ''} aria-hidden="true">
            <span className="n-rp-etape-point"/>
            <span className="n-rp-etape-nom n-rp-lu">{tr('retraits.t.' + e.cle)}</span>
            <span className="n-rp-etape-date n-rp-lu">{e.lue ? jourCourt(e.at, loc) : ''}</span>
          </li>))}
      </ol>
      {c ? <span className="n-rp-frise-txt" aria-hidden="true"><b>{tr('retraits.t.' + c.cle)}</b>{c.lue ? ' · ' + jourCourt(c.at, loc) : ''}</span> : null}
    </div>
  );
}

// Ce qu'il y a dans le colis : vignette 48 (la PHOTO de la paire ; place réservée), titre complet sur 2 lignes, N° en plaque,
// prix · taille · compte en petit ; « pas encore lu » : une petite ligne discrète.
function Contenu({ x, c, rg, photo, aides, prix, neuf, Icon = null }) {
  const relie = !!(c && c.etat === 'relie');
  const pasLu = !!(c && c.etat === 'pas-lu');
  // (20 nov., Julien : « les mêmes dispositions sur toutes les plateformes ») Un achat Leboncoin ou Vestiaire relié à CE
  // colis par son n° de suivi (`achatsAutres`, src/retraitQr.js) : SA photo et SON titre, comme un achat Vinted ; le site dit.
  const autre = !!(c && c.etat === 'autre-site');
  // (21 nov., lot 77) Le colis RETOUR d'une de SES ventes (relié par le n° exact du colis retour) : le titre de la vente,
  // « Retour de ta vente · N°12 » (le N° de la paire, gardé).
  const retour = !!(c && c.etat === 'retour');
  const titre = relie || autre || retour ? (c.titre || aides.titre(x)) : (rg && rg.titreDe === 'email' ? rg.titre : (pasLu ? '' : aides.titre(x)));
  const phrase = texteContenu(c, tr);
  const details = relie ? [c.taille ? tr('retraits.c.taille', { t: c.taille }) : '', phrase].filter(Boolean) : [];
  return (
    <div className={'n-rp-contenu' + (pasLu && !titre ? ' is-pas-lu' : '')} data-rp-contenu={c ? c.etat : ''} data-rp-contenu-tx={relie || retour ? c.tx : undefined}>
      <span className={'n-rp-vignette v2-passe-photo' + (relie && c.nb ? ' is-lot' : '')} aria-hidden="true" data-rp-photo={photo ? '1' : '0'} data-rp-photo-src={(relie || autre || retour) && (c.photo || x.photo) ? (c.photo || x.photo) : undefined} data-v2-photo-article={photo ? '' : undefined}>
        {photo || (Icon ? <Icon name="box" size={26}/> : null)}
        {relie && c.nb ? <span className="n-rp-lot-n" data-rp-lot={c.nb}>×{c.nb}</span> : null}
      </span>
      <span className="n-rp-colis-texte">
        {titre ? <span className="n-rp-colis-titre v2-passe-titre" data-rp-titre="">{titre}</span> : null}
        {pasLu ? <span className={'n-rp-pas-lu' + (titre ? '' : ' is-seul')} data-rp-pas-lu="" data-v2-contenu="pas-lu" data-v2-contenu-raison={c.raison} data-v2-contenu-compte={c.compte || undefined}>{phrase}</span> : null}
        <span className="n-rp-colis-meta">
          {neuf ? <span className="n-rp-etiquette" data-n-ton="vert" data-rp-nouveau="">{tr('v2.passe.nouveau')}</span> : null}
          {x.num ? <span className="n-rp-num" data-rp-num={x.num}><Plaque numero={x.num}/></span> : null}
          {relie && c.nb ? <span className="n-rp-etiquette" data-n-ton="neutre">{tr('retraits.c.lot', { n: c.nb })}</span> : null}
          {retour ? <span className="n-rp-etiquette" data-n-ton="neutre" data-rp-retour={c.tx}>{phrase}</span> : null}
          {autre && SITES[c.site] ? <span className="n-rp-etiquette" data-n-ton="neutre" data-rp-site={c.site}>{SITES[c.site]}</span> : null}
          {prix ? <span className="n-rp-prix" data-rp-prix="">{prix}</span> : null}
          {details.length ? <span className="n-rp-dedans" data-rp-prix={c.prix ? '' : undefined} data-v2-contenu="relie" data-v2-contenu-tx={c.tx || undefined} data-v2-contenu-compte={c.compte || undefined}>{details.join(' · ')}</span> : null}
        </span>
      </span>
    </div>
  );
}

// (21 nov., relier-code — Julien : « améliore le design du carré où il y a le code de retrait », puis « tu peux faire mieux sur le
// visuel du colis à retirer », « enlève Copier ») UN BILLET par colis, compact : la paire (vignette 48, titre complet, N°) ; la zone
// du CODE sur blanc (code groupé en chasse fixe à gauche, QR à droite, une petite icône « plein écran » dans son coin) — toucher la
// zone = plein écran pour le guichet (`enGrand`, le geste d'avant) ; la frise compacte au pied. Aucun « Copier ».
function LigneColis({ x, aides, Photo, Icon, nouveaux }) {
  const neuf = !!(nouveaux && estNouveau(nouveaux.etat, x.cle || x.id));
  const conflit = x.codesDesaccord && x.codesDesaccord.length > 1;
  const code = conflit ? '' : (x.code || '');
  const qr = aides.qrSrc(x);
  const ouvrir = aides.enGrand(x);
  const mention = mentionVerif(x);
  const contenu = x.contenu || null;
  const contenuTxt = texteContenu(contenu, tr);
  const prix = contenuTxt ? '' : (aides.prixDe ? aides.prixDe(x) : '');
  const rg = rangeeRetrait(x) || { codeEtat: '', qr: false, limite: {}, titreDe: '', transporteur: {} };
  const srcPhoto = x.photo || (contenu && contenu.etat === 'retour' ? contenu.photo : null);   // (21 nov., lot 77) la photo de la vente retournée
  const photo = srcPhoto && Photo ? Photo(srcPhoto) : null;
  const voir = ouvrir ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const seul = (e) => { e.stopPropagation(); if (voir) voir(); };
  const long = code.length > 7;
  const morceaux = grouperCode(code);
  const texteCode = <code className={'n-rp-code-txt' + (long ? ' is-long' : '')} data-rp-code-grand="" data-v2-code-grand="" data-rp-code-groupes={String(morceaux.length)}>{morceaux.map((m, i) => <code key={i} className="n-rp-code-g">{m}</code>)}</code>;
  return (
    <li className={'n-rp-colis n-rp-billet' + (neuf ? ' is-nouveau' : '')  + (mention ? ' is-verif' : '')} data-rp-colis={x.cle || x.id} data-rp-code={code} data-rp-sorte={x.sorte || ''} data-rp-verif={mention || undefined}
      data-v2-face={x.cle || x.id} data-v2-code={x.code || ''} data-v2-sorte={x.sorte || ''} data-v2-code-etat={rg.codeEtat} data-v2-qr-dispo={rg.qr ? '1' : '0'} data-v2-limite-jour={(rg.limite && rg.limite.jour) || ''} data-v2-limite-source={(rg.limite && rg.limite.source) || ''} data-v2-titre-de={rg.titreDe || ''} data-v2-transporteur={(rg.transporteur && rg.transporteur.cle) || ''}>
      <Contenu x={x} c={contenu} rg={rg} photo={photo} aides={aides} prix={prix} neuf={neuf} Icon={Icon}/>
      {mention ? <p className="n-rp-verif" data-rp-verif-mention={mention}><span className="n-rp-etiquette" data-n-ton="ambre">{tr(MENTION[mention] || MENTION.autre)}</span>{mention === 'autre' && x.raisonVerif ? <span className="n-rp-verif-raison">{x.raisonVerif}</span> : null}</p> : null}
      <div className={'n-rp-code-zone n-rp-billet-code' + (qr ? ' avec-qr' : '') + (voir ? ' is-touchable' : '')} data-rp-billet="" onClick={voir || undefined}>
        <div className="n-rp-code-col">
          <span className="n-rp-code-mot">{tr('retraits.b.code')}</span>
          {code && voir ? <button type="button" className="n-rp-plein" data-rp-plein="" onClick={seul} aria-label={tr('retraits.b.plein')} title={tr('retraits.b.plein')}>{Icon ? <Icon name="agrandir" size={16}/> : null}</button> : null}
          {code ? (voir
            ? <div role="button" tabIndex={0} className={'n-rp-code n-rp-code-btn' + (long ? ' is-long' : '')} onClick={seul} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seul(e); } }} data-v2-en-grand="" aria-label={tr('v2.passe.afficherCode') + ' · ' + code}>{texteCode}</div>
            : <span className={'n-rp-code' + (long ? ' is-long' : '')}>{texteCode}</span>)
            : <span className="n-rp-sans-code" data-rp-sans-code={conflit ? 'conflit' : 'pas-lu'}>{tr(conflit ? 'v2.passe.codesEnConflit' : 'retraits.v.codePasLu')}</span>}
        </div>
        {qr ? <button type="button" className="n-rp-qr" onClick={voir ? seul : undefined} data-rp-qr="" aria-label={tr('retraits.v.qrEnGrand') + ' · ' + aides.titre(x)}><img src={qr} alt="" loading="lazy" decoding="async"/></button> : null}
      </div>
      <Trajet t={x.trajet}/>
    </li>
  );
}

// QUAND un achat en route arrive (src/relaisPrevision.js) : une date LUE, le texte de Vinted, ou « pas encore dite ».
function phraseArrivee(a, loc) {
  const ar = arriveePrevue(a);
  const jour = (j) => { try { return new Date(j + 'T12:00:00').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_) { return j; } };
  if (ar.cle === 'lue' && ar.dans === 0) return { cle: 'aujourdhui', texte: tr('retraits.p.prevuAuj') };
  if (ar.cle === 'lue' && ar.dans === 1) return { cle: 'demain', texte: tr('retraits.p.prevuDemain') };
  if (ar.cle === 'lue') return { cle: 'lue', texte: tr('retraits.p.prevuLe', { date: jour(ar.jour) }) };
  if (ar.cle === 'lue-passee') return { cle: 'passee', texte: tr('retraits.p.prevuPasse', { date: jour(ar.jour) }) };
  if (ar.cle === 'vinted') return { cle: 'vinted', texte: tr('retraits.p.prevuVinted', { texte: ar.texte }) };
  return { cle: 'pas-dite', texte: tr('retraits.p.pasDite') };
}
// Un achat EN ROUTE vers ce point : photo, titre, quand il arrive. Lecture seule, aucun geste.
function LigneEnRoute({ a, Photo, Icon, loc }) {
  const q = phraseArrivee(a, loc);
  return (
    <li className="n-rp-route" data-rp-route={a.id} data-rp-route-quand={q.cle}>
      <span className="n-rp-vignette" aria-hidden="true">{a.photo && Photo ? Photo(a.photo) : (Icon ? <Icon name="box" size={22}/> : null)}</span>
      <span className="n-rp-colis-texte">
        <span className="n-rp-route-titre">{a.titre || tr('v2.enRoute.sansTitre')}</span>
        <span className={'n-rp-route-quand' + (q.cle === 'aujourdhui' || q.cle === 'demain' ? ' is-proche' : '')}>{[q.texte, a.compte].filter(Boolean).join(' · ')}</span>
      </span>
    </li>
  );
}

function CartePoint({ p, aides, Photo, Icon, Logo, nouveaux, apple, loc }) {
  const { comptes, verif } = colisDuPoint(p);
  const colis = [...comptes, ...verif];
  const attendus = p.attendus || [];
  const transp = (p.transporteurs || [])[0] || '';
  const nomT = transp ? aides.nomTransporteur(transp) : '';
  const rebours = compteARebours(limiteDuPoint(p));
  const horaires = aides.horairesDe ? aides.horairesDe(p) : '';
  const lien = lienItineraire(p, { apple });
  const lieu = p.nom || tr('v2.retirer.pointInconnu');
  // Le nom d'un point est parfois son adresse (« 10 Rue du Bois Aurant ») : la ligne d'adresse ne la redit pas, elle dit la ville.
  const adresse = p.adresse && p.nom && normTexte(p.adresse).startsWith(normTexte(p.nom)) ? (p.ville || '') : (p.adresse || '');
  const sorte = colis.length ? tr(p.consigne ? 'retraits.p.consigne' : 'retraits.p.comptoir') : '';
  return (
    <article className="n-rp-carte" data-v2-passe={p.inconnu ? 'inconnu' : String(p.numero || '')} data-v2-passe-n={String(colis.length)} id={'n-rp-' + (p.cle || p.numero)} data-rp-point={p.inconnu ? 'inconnu' : String(p.numero || '')} data-rp-n={String(comptes.length)} data-rp-verif-n={String(verif.length)} data-rp-attendus={String(attendus.length)} data-rp-sorte={p.consigne ? 'consigne' : 'comptoir'} aria-label={tr('v2.passe.aria', { lieu, n: colis.length })}>
      {/* (21 nov., relier-code) Le BANDEAU du point, une fois : la couleur douce de son transporteur, son logo, le nom du point,
          « transporteur · comptoir / consigne », et l'échéance LUE à droite (ambre à moins de 2 j) ; dessous l'adresse et Itinéraire. */}
      <header className="n-rp-tete" data-rp-teinte={transp || 'aucun'}>
        <div className="n-rp-tete-ligne">
          <span className="n-rp-logo" aria-hidden="true">{transp && Logo ? <Logo cle={transp} taille={24}/> : (Icon ? <Icon name="pin" size={18}/> : null)}</span>
          <span className="n-rp-tete-txt">
            <h3 className="n-rp-nom">{lieu}</h3>
            <span className="n-rp-transp" data-rp-transp={transp}><span data-rp-sorte-etiquette={sorte ? (p.consigne ? 'consigne' : 'comptoir') : undefined}>{[nomT || (colis.length ? tr('retraits.v.transpInconnu') : ''), sorte].filter(Boolean).join(' · ')}</span>
              {sorte ? <span className="n-rp-lu">{tr(p.consigne ? 'v2.passe.consigne' : 'v2.passe.comptoir')}</span> : null}</span>
          </span>
          {!colis.length ? null
            : !comptes.length ? <span className="n-rp-etiquette n-rp-etat" data-n-ton="ambre" data-rp-rebours="verif">{tr('retraits.v.nVerif', { n: verif.length })}</span>
            : rebours ? <span className="n-rp-etiquette n-rp-etat" data-n-ton={rebours.ambre ? 'ambre' : 'neutre'} data-rp-rebours={rebours.cle}>{texteEtatPoint(rebours, loc)}</span>
            : <span className="n-rp-etiquette n-rp-etat" data-n-ton="neutre" data-rp-rebours="pas-lu">{tr('retraits.v.limitePasLue')}</span>}
        </div>
        <div className="n-rp-adresse-ligne">
          <span className="n-rp-adresse" data-rp-adresse="">{adresse || (p.adresse ? '' : tr('retraits.v.adressePasLue'))}{horaires ? <span className="n-rp-horaires" data-rp-horaires=""> · {horaires}</span> : null}</span>
          {lien ? <a className="n-rp-itineraire" href={lien} target="_blank" rel="noopener noreferrer" data-rp-itineraire="">{Icon ? <Icon name="pin" size={15}/> : null}<span>{tr('retraits.v.itineraire')}</span></a> : null}
        </div>
      </header>
      {colis.length ? <ul className="n-rp-liste">
        {comptes.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux}/>)}
      </ul> : <p className="n-rp-rien-ici" data-rp-rien-ici="">{tr('retraits.p.rienIci')}</p>}
      {verif.length ? <>
        <p className="n-rp-verif-tete" data-rp-verif-tete={verif.length}>{tr('retraits.m.horsCompte')}</p>
        <ul className="n-rp-liste" data-rp-verif-liste="">
          {verif.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux}/>)}
        </ul>
      </> : null}
      {/* (21 nov., ext. 5.411) EN ROUTE VERS CE POINT : les achats dont le suivi de CETTE transaction nomme ce point (identité,
          `attendus` de pointsARetirer), repliés sous les colis déjà là ; ouverts quand rien n'attend encore ici. */}
      {attendus.length ? <details className="n-rp-routes" data-rp-routes={String(attendus.length)} open={!colis.length}>
        <summary className="n-rp-routes-tete"><span>{tr('retraits.p.enRouteVers')}</span><span className="n-rp-routes-n">{attendus.length}</span></summary>
        <ul className="n-rp-liste">{attendus.map((a) => <LigneEnRoute key={a.id} a={a} Photo={Photo} Icon={Icon} loc={loc}/>)}</ul>
      </details> : null}
    </article>
  );
}
const normTexte = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// L'illustration de « Rien à retirer » : un colis ouvert, sobre (traits seulement, jetons de l'encre).
const IllustrationVide = () => (
  <svg className="n-rp-vide-ill" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true" focusable="false">
    <path d="M20 38 L60 22 L100 38 L60 54 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M20 38 V70 L60 86 V54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M100 38 V70 L60 86" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M20 38 L8 26 L48 10 L60 22 M100 38 L112 26 L72 10 L60 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" opacity=".55"/>
  </svg>
);
export function RienARetirer({ phrase = '' }) {
  return (
    <div className="n-rp-vide" data-rp-vide="">
      <IllustrationVide/>
      <p className="n-rp-vide-phrase">{phrase || tr('retraits.v.rien')}</p>
    </div>
  );
}

// `enRouteSansPoint` : les achats en route dont aucun point n'est encore lu (une liste repliée, à la fin) ;
// `extRelais` : ce que sait l'extension de CE navigateur (`extSait('relaisprevu')` : 'ok' · 'retard' · 'absente').
// `titre` : l'intertitre de la liste (« À retirer ») ; `scanner` : { label, ouvrir } — le scanner d'un colis à retirer (le geste
// du grand chiffre d'avant, à droite du titre). (21 nov.) Les nombres ne s'écrivent qu'une fois : sur la ligne du titre.
// (21 nov., relier-code) Deux dessins du billet, mêmes éléments : « b » (défaut) une carte par point, bandeau teinté en tête, billets
// séparés par une ligne de coupe ; « a » le bandeau du point posé sur la page, chaque billet une carte. `vrm_banc_retrait_variante`
// (« a ») ne sert qu'aux captures de comparaison.
const varianteRetrait = () => { try { return localStorage.getItem('vrm_banc_retrait_variante') === 'a' ? 'a' : 'b'; } catch (_) { return 'b'; } };
export function RetraitsPoints({ points = [], aides, Photo, Icon, Logo, enRouteSansPoint = [], extRelais = 'ok', titre = '', scanner = null, variante = varianteRetrait(), compact = false }) {
  const propres = points.map((p) => ({ ...p, arrives: (p.arrives || []).filter((x) => x && !x.redirige) }));
  const avec = trierPoints(propres.filter((p) => { const d = colisDuPoint(p); return d.comptes.length + d.verif.length > 0; }));
  // Les points où rien n'attend encore, mais où des achats ARRIVENT (prévision) : après, du plus chargé au moins chargé.
  const bientot = propres.filter((p) => !p.inconnu && (p.attendus || []).length && !avec.includes(p)).sort((a, b) => b.attendus.length - a.attendus.length || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  const [etatN, setEtatN] = React.useState(lireNouveaux);
  React.useEffect(() => { const f = () => setEtatN(lireNouveaux()); window.addEventListener('vrm:retraits-nouveaux', f); return () => window.removeEventListener('vrm:retraits-nouveaux', f); }, []);
  const nouveaux = React.useMemo(() => ({ etat: etatN, vu: (cle) => { const e = marquerVu(lireNouveaux(), cle); if (!e) return; try { localStorage.setItem(CLE_RETRAITS_VUS, JSON.stringify(e)); } catch (_) {} setEtatN(e); } }), [etatN]);
  const apple = React.useMemo(() => appareilApple(), []);
  const [carte, setCarte] = React.useState(false);
  const loc = localeCourante();
  if (!avec.length && !bientot.length && !enRouteSansPoint.length) return null;
  const r = resumeRetraits(avec);
  const nRoute = [...avec, ...bientot].reduce((t, p) => t + (p.attendus || []).length, 0);
  // La carte : un repère par point à la position LUE (liste Vinted), son nombre à retirer, sinon en route.
  const reperes = [...avec, ...bientot].filter((p) => p.repere && !p.sansCarte && Number.isFinite(Number(p.repere.lat)) && Number.isFinite(Number(p.repere.lon)))
    .map((p) => { const d = colisDuPoint(p); const n = d.comptes.length + d.verif.length; return { cle: p.cle || String(p.numero), lat: p.repere.lat, lon: p.repere.lon, nom: p.nom || '', n: n || (p.attendus || []).length, sorte: n ? 'aretirer' : 'enroute' }; });
  // (23 nov., revue UX #7) `compact` (Achats au téléphone) : RIEN à retirer, seulement des achats attendus à un point ⇒ UNE ligne
  // repliée « Bientôt au point · N en route › » (le détail, les mêmes cartes, en dépliant) : la liste des achats reste au 1er écran.
  if (compact && !avec.length && bientot.length) return (
    <details className="n-rp n-rp-compact" data-rp="" data-rp-compact="" data-rp-points="0" data-rp-colis="0" data-rp-bientot={String(bientot.length)} data-rp-en-route={String(nRoute)}>
      <summary className="n-rp-compact-tete"><span>{tr('ru.rp.bientot', { n: nRoute })}</span><span className="n-rp-routes-n" aria-hidden="true">›</span></summary>
      <div className="n-rp-cartes">{bientot.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} apple={apple} loc={loc}/>)}</div>
    </details>
  );
  const aller = (cle) => { try { document.getElementById('n-rp-' + cle).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} };
  return (
    <div className="n-rp" data-rp-variante={variante} data-rp="" data-rp-points={String(avec.length)} data-rp-colis={String(r.colis)} data-rp-bientot={String(bientot.length)} data-rp-en-route={String(nRoute)}>
      <div className={'n-rp-resume' + (titre ? ' avec-titre' : '')} data-rp-resume="" aria-label={tr('retraits.v.resumeAria')}>
        {titre ? <h2 className="n-rp-titre" data-rp-titre-liste="">{titre}</h2> : null}
        <p className="n-rp-resume-ligne">
          {avec.length ? <><b data-rp-resume-colis={r.colis}>{tr('retraits.v.nColis', { n: r.colis })}</b><span aria-hidden="true"> · </span><span data-rp-resume-points={r.points}>{tr('retraits.v.nPoints', { n: r.points })}</span></> : null}
          {r.urgents ? <><span aria-hidden="true"> · </span><span className="n-rp-urgent" data-rp-resume-urgents={r.urgents}>{tr('retraits.v.nUrgents', { n: r.urgents })}</span></> : null}
          {nRoute ? <>{avec.length ? <span aria-hidden="true"> · </span> : null}<span data-rp-resume-route={nRoute}>{tr('retraits.p.nEnRoute', { n: nRoute })}</span></> : null}
        </p>
        {scanner && typeof scanner.ouvrir === 'function' ? <button type="button" className="sb-rond n-rp-scan" aria-label={scanner.label} title={scanner.label} onClick={scanner.ouvrir}
          data-colis-barre-btn="scanner" data-colis-scanner="" data-scan-mode-bouton="retrait"><Icon name="scan" size={20}/></button> : null}
        {reperes.length ? <button type="button" className="sb-touche n-rp-carte-btn" aria-pressed={carte} data-rp-carte-btn={carte ? '1' : '0'} onClick={() => setCarte((v) => !v)}>
          <Icon name="pin" size={18}/><span>{tr('retraits.p.carte')}</span>
        </button> : null}
      </div>
      {carte && reperes.length ? <CartePoints reperes={reperes} onPoint={aller} label={tr('retraits.p.carteAria')}/> : null}
      {/* Rien à retirer ni à prévoir sous un point, mais des achats en route sans point lu : « Rien à retirer » d'abord (jamais une
          liste vide sous un titre), la rangée repliée des achats sans point dessous. */}
      {!avec.length && !bientot.length ? <RienARetirer/> : null}
      {avec.length ? <div className="n-rp-cartes" data-v2-bloc="passes">
        {avec.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} apple={apple} loc={loc}/>)}
      </div> : null}
      {bientot.length ? <section className="n-rp-bientot" data-rp-bientot-liste={String(bientot.length)} aria-label={tr('retraits.p.bientot')}>
        <h2 className="n-rp-section">{tr('retraits.p.bientot')}</h2>
        <div className="n-rp-cartes">
          {bientot.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} apple={apple} loc={loc}/>)}
        </div>
      </section> : null}
      {/* Les achats en route dont le point n'est pas encore lu : UNE rangée repliée, à la fin (jamais 20 rangées en tête). */}
      {enRouteSansPoint.length ? <details className="n-rp-routes n-rp-sans-point" data-rp-sans-point={String(enRouteSansPoint.length)}>
        <summary className="n-rp-routes-tete"><span>{tr('retraits.p.sansPoint')}</span><span className="n-rp-routes-n">{enRouteSansPoint.length}</span></summary>
        <p className="n-rp-sans-point-pourquoi" data-rp-sans-point-ext={extRelais}>{tr(extRelais === 'ok' ? 'retraits.p.sansPointOk' : 'retraits.p.sansPointExt')}</p>
        <ul className="n-rp-liste">{enRouteSansPoint.slice(0, 60).map((a) => <LigneEnRoute key={a.id} a={a} Photo={Photo} Icon={Icon} loc={loc}/>)}</ul>
      </details> : null}
    </div>
  );
}

export default RetraitsPoints;
