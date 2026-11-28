// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT (28 nov. 2026, lot agent-rangement) — la conversation, dans une feuille native.
//  Julien : « je veux que tu améliores le ranger : je veux un vrai agent IA qui pose des questions, totalement
//  intelligent, qui adapte les étages, les pièces de rangement, etc. ». Récit : docs/passation/2026-11-28-agent-rangement.md.
//
//  Une question à la fois ; réponses en boutons, en texte libre (tapé ou dicté par le clavier), photo facultative. À la
//  fin : LE PLAN, dessiné (pièces → meubles → étages → cases, les cartons d'aujourd'hui à leur place), ses incohérences,
//  les déplacements proposés — et rien n'est écrit avant « Appliquer ce plan » (SON toucher).
//  DEUX MOTEURS, choisis seuls (`/api/ai?usage=rangement`) et DITS en haut de la feuille :
//    · « IA » : sa clé (rangée chiffrée côté serveur, api/_lib/ia-cle.js — collée ici, jamais relue par le navigateur),
//      ou, pour le seul propriétaire de l'installation, la clé du serveur ; chaque réponse du modèle est VALIDÉE
//      (src/rangement/moteurIA.js ⇒ src/rangement/plan.js) : une réponse fausse est refusée et l'assistant continue SANS IA ;
//    · « Sans IA » : l'entretien par règles (src/rangement/entretien.js), le même plan.
//  CLAUDE.md §2.9 : jamais un repli sur la clé de Julien pour un autre vendeur. §5 : aucun N° changé (le plan ne touche
//  que des emplacements, src/rangement/plan.js `appliquerPlan`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from '../i18n/index.js';
import { Feuille, Groupe, Rangee, Bouton, BoutonIcone } from '../natif/index.js';
import MeubleDessin from '../stockV2/MeubleDessin.jsx';
import { demarrer, question, repondre, planDe } from './entretien.js';
import { validerPlan, appliquerPlan, incoherences, capacite, placeDe } from './plan.js';
import { contexteIA, corpsRequete, lireReponseIA } from './moteurIA.js';
import './assistant.css';

// Une photo réduite (1024 px, JPEG) avant tout envoi — jamais l'original.
function reduirePhoto(fichier) {
  return new Promise((ok) => {
    try {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    } catch (_) { ok(null); }
  });
}

// ── LA CLÉ IA DU VENDEUR (rangée côté serveur ; le navigateur n'en apprend que la fin) ──
function CarteCle({ enTete, onChange }) {
  const [etat, setEtat] = React.useState(undefined);   // undefined lecture · null pas su · { etat, fin }
  const [cle, setCle] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const lire = React.useCallback(() => {
    fetch('/api/compte?mode=ia-cle', { headers: enTete() }).then((r) => r.json().then((j) => (r.ok ? j : null))).then((j) => setEtat(j || null)).catch(() => setEtat(null));
  }, [enTete]);
  React.useEffect(() => { lire(); }, [lire]);
  const envoyer = async (corps) => {
    setEnCours(true); setMsg('');
    try {
      const r = await fetch('/api/compte?mode=ia-cle', { method: 'POST', headers: { 'content-type': 'application/json', ...enTete() }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (r.ok && j) { setEtat(j); setCle(''); onChange && onChange(); setMsg(corps.action === 'poser' ? tr('rgt.cle.rangee') : tr('rgt.cle.retiree')); }
      else setMsg((j && j.message) || tr('rgt.cle.echec'));
    } catch (_) { setMsg(tr('rgt.cle.echec')); }
    finally { setEnCours(false); }
  };
  const posee = etat && etat.etat === 'posee';
  return (
    <Groupe titre={tr('rgt.cle.titre')} pied={tr('rgt.cle.pied')} attrs={{ 'data-rgt-cle': posee ? 'posee' : etat === undefined ? 'lecture' : etat === null ? 'passu' : 'aucune' }}>
      {posee ? <Rangee titre={tr('rgt.cle.posee', { fin: etat.fin || '' })} sousTitre={etat.verif === 'ok' ? tr('rgt.cle.verifiee') : tr('rgt.cle.pasVerifiee')}
        valeur={<Bouton variante="texte" chargement={enCours} onClick={() => envoyer({ action: 'retirer', confirme: true })} attrs={{ 'data-rgt-cle-retirer': '' }}>{tr('rgt.cle.retirer')}</Bouton>}/> : (
        <div className="rgt-cle">
          <label className="rgt-cle-champ">
            <span className="rgt-cle-libelle">{tr('rgt.cle.libelle')}</span>
            <input type="password" autoComplete="off" spellCheck="false" value={cle} onChange={(e) => setCle(e.target.value)} placeholder="sk-ant-…" data-rgt-cle-champ="" maxLength={300}/>
          </label>
          <Bouton variante="teinte" chargement={enCours} indisponible={!cle.trim()} onClick={() => envoyer({ action: 'poser', cle: cle.trim() })} attrs={{ 'data-rgt-cle-poser': '' }}>{tr('rgt.cle.poser')}</Bouton>
        </div>)}
      {etat === null ? <p className="rgt-note" role="status">{tr('rgt.cle.passu')}</p> : null}
      {msg ? <p className="rgt-note" role="status" data-rgt-cle-msg="">{msg}</p> : null}
    </Groupe>
  );
}

// ── L'APERÇU DU PLAN ──────────────────────────────────────────────────────────
function Apercu({ plan, resultat, existants, articles }) {
  const parId = new Map(resultat.meubles.map((m) => [String(m.id), m]));
  const nomDe = (id) => { const m = parId.get(String(id)) || existants.find((x) => String(x.id) === String(id)); return m ? m.name : '—'; };
  const parMeuble = new Map();
  for (const k of Object.keys(resultat.slots)) { const s = resultat.slots[k]; if (!s) continue; if (!parMeuble.has(String(s.m))) parMeuble.set(String(s.m), new Map()); parMeuble.get(String(s.m)).set(Number(s.i), k); }
  const bouge = new Set(resultat.deplacements.map((d) => d.cle));
  const info = (mid) => (i) => { const k = parMeuble.get(String(mid)) && parMeuble.get(String(mid)).get(i); return k ? { num: k, cle: k, etat: bouge.has(k) ? 'plusenligne' : '', double: false, photo: null } : null; };
  const groupes = [];
  for (const m of resultat.meubles) { const p = m.piece || tr('rgt.piece.defaut'); let g = groupes.find((x) => x.nom === p); if (!g) { g = { nom: p, meubles: [] }; groupes.push(g); } g.meubles.push(m); }
  const inco = incoherences(plan, { articles });
  const cap = capacite(plan);
  const place = (x) => { const m = parId.get(String(x.m)) || existants.find((y) => String(y.id) === String(x.m)); const p = placeDe(x.i, m); return tr('rgt.place', { nom: nomDe(x.m), r: p.rangee, c: p.colonne }); };
  return (
    <div className="rgt-apercu" data-rgt-apercu={resultat.meubles.length} data-rgt-places={cap.places}>
      <p className="rgt-resume" data-rgt-resume="">{tr('rgt.resume', { n: cap.pieces, pieces: cap.pieces, meubles: cap.meubles, places: nombre(cap.places) })}{Number.isFinite(articles) ? ' ' + tr('rgt.resumeArticles', { n: nombre(articles) }) : ''}</p>
      {inco.map((x, k) => <p key={k} className="rgt-alerte" role="status" data-rgt-incoherence={x.k}>{tr('rgt.inco.' + x.k, { n: x.n, piece: x.piece || '', meuble: x.meuble || '' })}</p>)}
      {groupes.map((g) => (
        <Groupe key={g.nom} titre={g.nom} attrs={{ 'data-rgt-piece': g.nom }}>
          <div className="rgt-meubles">
            {g.meubles.map((m) => (
              <figure key={m.id} className="rgt-meuble" data-rgt-meuble={m.id} data-rgt-neuf={resultat.nouveaux.includes(String(m.id)) ? '' : undefined}>
                <figcaption className="rgt-meuble-tete">
                  <span className="rgt-meuble-nom">{m.name}{m.porte ? <span className="rgt-porte" data-rgt-porte="">{tr('rgt.porte')}</span> : null}</span>
                  <span className="rgt-meuble-n">{tr('rgt.meuble.dims', { r: m.rows, c: m.cols, n: nombre(m.rows * m.cols) })}{resultat.nouveaux.includes(String(m.id)) ? ' · ' + tr('rgt.neuf') : ''}</span>
                </figcaption>
                <MeubleDessin m={m} info={info(m.id)} mode="loin"/>
              </figure>))}
          </div>
        </Groupe>))}
      {resultat.retires.length ? <Groupe titre={tr('rgt.retires')}>{resultat.retires.map((id) => <Rangee key={id} titre={nomDe(id)} attrs={{ 'data-rgt-retire': id }}/>)}</Groupe> : null}
      <Groupe titre={tr('rgt.deplacements', { n: resultat.deplacements.length })} pied={tr('rgt.numerosGardes')} attrs={{ 'data-rgt-deplacements': resultat.deplacements.length }}>
        {resultat.deplacements.length === 0 ? <Rangee titre={tr('rgt.aucunDeplacement')}/> : resultat.deplacements.slice(0, 40).map((d) => (
          <Rangee key={d.cle} titre={tr('rgt.num', { n: d.cle })} sousTitre={place(d.de) + ' → ' + place(d.vers)} attrs={{ 'data-rgt-deplace': d.cle }}/>))}
        {resultat.aRanger.map((x) => <Rangee key={x.cle} titre={tr('rgt.num', { n: x.cle })} sousTitre={place(x.de) + ' → ' + tr('rgt.versARanger')} attrs={{ 'data-rgt-a-ranger': x.cle }}/>)}
      </Groupe>
      {plan.etiquetage ? <Groupe titre={tr('rgt.numerotation')}><Rangee titre={tr(plan.etiquetage.qui === 'moi' ? 'rgt.c.numMoi' : plan.etiquetage.serie === 'lettre' ? 'rgt.etiq.lettre' : 'rgt.c.numVrm', { l: plan.etiquetage.lettre || '' })} attrs={{ 'data-rgt-etiquetage': plan.etiquetage.qui }}/></Groupe> : null}
    </div>
  );
}

// ── LA FEUILLE ────────────────────────────────────────────────────────────────
// Props : ouverte, fermer, meubles, slots (les lus : null = pas su), articles (nombre | null), methode ({ qui } | null),
// archive (la lettre des anciens N°), enTete() (l'en-tête de session), appliquer(resultat, plan) → Promise<bool>, Icon.
export default function AssistantRangement({ ouverte, fermer, meubles, slots, articles = null, methode = null, archive = '', enTete, appliquer, Icon, langue = 'fr' }) {
  const lu = Array.isArray(meubles) && !!slots && typeof slots === 'object';
  const ctx = React.useMemo(() => ({ meubles: lu ? meubles : [], slots: lu ? slots : {}, articles, methode, archive, dire: (cle, v) => tr(cle, v) }), [lu, meubles, slots, articles, methode, archive]);
  const [moteur, setMoteur] = React.useState(undefined);          // undefined lecture · 'ia' · 'regles'
  const [source, setSource] = React.useState(null);               // 'vendeur' · 'proprietaire'
  const [cleOuverte, setCleOuverte] = React.useState(false);
  const [fil, setFil] = React.useState([]);                       // [{ de: 'vrm'|'moi', texte, photo? , note? }]
  const [etat, setEtat] = React.useState(null);                   // l'entretien sans IA
  const [qIA, setQIA] = React.useState(null);                     // la question en cours de l'IA
  const [hist, setHist] = React.useState([]);                     // l'historique envoyé au modèle
  const [attente, setAttente] = React.useState(false);
  const [plan, setPlan] = React.useState(null);                   // { plan, explication }
  const [texte, setTexte] = React.useState('');
  const [photo, setPhoto] = React.useState(null);
  const [applique, setApplique] = React.useState(false);
  const graine = React.useRef(Date.now().toString(36));
  const bas = React.useRef(null);
  const refPhoto = React.useRef(null);

  const sonder = React.useCallback(() => {
    setMoteur(undefined);
    fetch('/api/ai?usage=rangement', { headers: enTete() }).then((r) => r.json()).then((j) => {
      if (j && (j.moteur === 'vendeur' || j.moteur === 'proprietaire')) { setSource(j.moteur); setMoteur('ia'); } else { setSource(null); setMoteur('regles'); }
    }).catch(() => { setSource(null); setMoteur('regles'); });
  }, [enTete]);
  // À chaque ouverture : un entretien neuf.
  React.useEffect(() => {
    if (!ouverte) return;
    setFil([]); setEtat(null); setQIA(null); setHist([]); setPlan(null); setTexte(''); setPhoto(null); setApplique(false); graine.current = Date.now().toString(36);
    sonder();
  }, [ouverte]);   // eslint-disable-line react-hooks/exhaustive-deps

  const versRegles = (note) => {
    setMoteur('regles'); setQIA(null);
    setFil((f) => [...f, ...(note ? [{ de: 'vrm', texte: note, note: true }] : [])]);
    setEtat(demarrer(ctx));
  };
  const appelIA = async (h, ph) => {
    setAttente(true);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', ...enTete() },
        body: JSON.stringify(corpsRequete({ historique: h, contexte: contexteIA({ meubles: ctx.meubles, slots: ctx.slots, articles, methode, langue }), photo: ph })) });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) { versRegles(tr(j && j.reason === 'no-key' ? 'rgt.ia.sansCle' : 'rgt.ia.panne')); return; }
      const l = lireReponseIA(j.reponse, { existants: ctx.meubles });
      if (!l.ok) { versRegles(tr('rgt.ia.refusee')); return; }
      if (l.type === 'question') { setQIA(l); setHist([...h, { role: 'assistant', texte: JSON.stringify(j.reponse) }]); setFil((f) => [...f, { de: 'vrm', texte: l.texte }]); }
      else { setHist([...h, { role: 'assistant', texte: JSON.stringify(j.reponse) }]); setPlan({ plan: l.plan, explication: l.explication }); setFil((f) => [...f, { de: 'vrm', texte: l.explication || tr('rgt.planPret') }]); }
    } catch (_) { versRegles(tr('rgt.ia.panne')); }
    finally { setAttente(false); }
  };
  // Le premier mot de l'assistant, quand le moteur est connu.
  React.useEffect(() => {
    if (!ouverte || moteur === undefined || fil.length || !lu) return;
    if (moteur === 'ia') { setFil([{ de: 'vrm', texte: tr('rgt.bonjourIA'), note: true }]); appelIA([], null); }
    else { setFil([{ de: 'vrm', texte: tr('rgt.bonjour'), note: true }]); setEtat(demarrer(ctx)); }
  }, [ouverte, moteur, lu]);   // eslint-disable-line react-hooks/exhaustive-deps

  // La question sans IA en cours (et sa bulle, ajoutée une fois).
  const qR = moteur === 'regles' && etat ? question(etat, ctx) : null;
  const dernierId = React.useRef(null);
  React.useEffect(() => {
    if (!qR) return;
    if (dernierId.current === etat) return;   // chaque réponse rend un NOUVEL état : une bulle par question posée
    dernierId.current = etat;
    setFil((f) => [...f, ...(qR.incompris ? [{ de: 'vrm', texte: tr('rgt.incompris'), note: true }] : []), { de: 'vrm', texte: tr(qR.cle, qR.vars) + (qR.erreur ? ' ' + tr('rgt.lettre.' + qR.erreur, { l: archive }) : '') }]);
  });
  React.useEffect(() => {
    if (moteur === 'regles' && etat && etat.fini && !plan) {
      const v = validerPlan(planDe(etat), { existants: ctx.meubles });
      if (v.ok) { setPlan({ plan: v.plan, explication: '' }); setFil((f) => [...f, { de: 'vrm', texte: tr('rgt.planPret') }]); }
      else setFil((f) => [...f, { de: 'vrm', texte: tr('rgt.planFaux'), note: true }]);
    }
  }, [etat, moteur]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { try { if (bas.current && bas.current.scrollIntoView) bas.current.scrollIntoView({ block: 'end' }); } catch (_) {} }, [fil.length, plan]);

  const envoyer = (rep) => {
    if (attente) return;
    const ph = photo; setPhoto(null); setTexte('');
    const dit = rep.libelle != null ? rep.libelle : rep.texte;
    setFil((f) => [...f, { de: 'moi', texte: dit, photo: ph }]);
    if (moteur === 'ia') { const h = [...hist, { role: 'user', texte: dit }]; setHist(h); appelIA(h, ph); return; }
    if (ph) setFil((f) => [...f, { de: 'vrm', texte: tr('rgt.photoSansIA'), note: true }]);
    setEtat((e) => repondre(e, rep.v !== undefined ? { v: rep.v } : { texte: rep.texte }, ctx));
  };
  const resultat = React.useMemo(() => (plan && lu ? appliquerPlan({ meubles: ctx.meubles, slots: ctx.slots, plan: plan.plan, idNeuf: (k) => 'm' + graine.current + k }) : null), [plan, lu, ctx]);
  const choix = qIA ? qIA.choix.map((c) => ({ libelle: c, texte: c })) : qR ? (qR.choix || []).map((c) => ({ v: c.v, libelle: tr(c.cle, c.vars) })) : [];
  const saisie = qIA ? qIA.saisie : qR ? qR.saisie : null;
  const photoPermise = qIA ? true : qR ? !!qR.photo : false;
  const enQuestion = !plan && (qIA || qR) && !attente;
  const valider = async () => { if (!resultat || applique) return; setApplique(true); const ok = await appliquer(resultat, plan.plan); if (ok) fermer(); else setApplique(false); };
  const recommencer = () => { setPlan(null); setFil([]); setEtat(null); setQIA(null); setHist([]); graine.current = Date.now().toString(36); dernierId.current = null; sonder(); };

  const ligneMoteur = moteur === undefined ? tr('rgt.moteur.lecture') : moteur === 'ia' ? tr(source === 'proprietaire' ? 'rgt.moteur.iaProprio' : 'rgt.moteur.ia') : tr('rgt.moteur.regles');
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={tr('rgt.titre')} detente="pleine" className="rgt-feuille"
      pied={plan && resultat ? <Bouton variante="plein" chargement={applique} onClick={valider} attrs={{ 'data-rgt-appliquer': '' }}>{tr('rgt.appliquer')}</Bouton> : null}
      attrs={{ 'data-rgt': moteur || 'lecture', 'data-rgt-source': source || undefined }}>
      <div className="rgt-moteur" data-rgt-moteur={moteur || 'lecture'}>
        <span className="rgt-moteur-pastille" data-ia={moteur === 'ia' ? '' : undefined} aria-hidden="true">{Icon ? <Icon name={moteur === 'ia' ? 'spark' : 'chat'} size={16}/> : null}</span>
        <span className="rgt-moteur-texte" role="status">{ligneMoteur}</span>
        <Bouton variante="texte" attrs={{ 'data-rgt-cle-ouvrir': '' }} onClick={() => setCleOuverte((x) => !x)}>{tr(moteur === 'ia' && source === 'vendeur' ? 'rgt.cle.gerer' : 'rgt.cle.ajouter')}</Bouton>
      </div>
      {cleOuverte ? <CarteCle enTete={enTete} onChange={() => { setCleOuverte(false); recommencer(); }}/> : null}
      {!lu ? <p className="rgt-alerte" role="status" data-rgt-pas-lu="">{tr('rgt.pasLu')}</p> : null}
      <ol className="rgt-fil" aria-live="polite" data-rgt-fil={fil.length}>
        {fil.map((b, k) => (
          <li key={k} className={'rgt-bulle' + (b.de === 'moi' ? ' is-moi' : '') + (b.note ? ' is-note' : '')} data-rgt-bulle={b.de}>
            {b.photo ? <img className="rgt-bulle-photo" src={b.photo} alt={tr('rgt.photoJointe')}/> : null}
            {b.texte ? <span>{b.texte}</span> : null}
          </li>))}
        {attente ? <li className="rgt-bulle is-attente" data-rgt-attente=""><span className="rgt-points" aria-label={tr('rgt.reflechit')}><i/><i/><i/></span></li> : null}
      </ol>
      {enQuestion ? (
        <div className="rgt-reponses" data-rgt-question={qR ? qR.id : 'ia'}>
          {choix.length ? <div className="rgt-choix">{choix.map((c, k) => <button key={k} type="button" className="rgt-choix-b" data-rgt-choix={c.v !== undefined ? String(c.v) : c.libelle} onClick={() => envoyer(c)}>{c.libelle}</button>)}</div> : null}
          <form className="rgt-saisie" onSubmit={(e) => { e.preventDefault(); if (texte.trim() || photo) envoyer({ texte: texte.trim() || tr('rgt.photoSeule') }); }}>
            {photoPermise ? <>
              <BoutonIcone libelle={tr('rgt.joindrePhoto')} icone={Icon ? <Icon name="camera" size={20}/> : '📷'} actif={!!photo} onClick={() => refPhoto.current && refPhoto.current.click()} attrs={{ 'data-rgt-photo': photo ? 'jointe' : '' }}/>
              <input ref={refPhoto} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) setPhoto(await reduirePhoto(f)); }}/>
            </> : null}
            <input className="rgt-saisie-champ" value={texte} onChange={(e) => setTexte(e.target.value)} inputMode={saisie === 'nombre' ? 'numeric' : 'text'} enterKeyHint="send"
              placeholder={tr(saisie === 'nombre' ? 'rgt.saisie.nombre' : 'rgt.saisie.texte')} aria-label={tr('rgt.saisie.libelle')} data-rgt-saisie="" maxLength={200}/>
            <BoutonIcone libelle={tr('rgt.envoyer')} icone={Icon ? <Icon name="send" size={20}/> : '→'} indisponible={!texte.trim() && !photo} onClick={() => { if (texte.trim() || photo) envoyer({ texte: texte.trim() || tr('rgt.photoSeule') }); }} attrs={{ 'data-rgt-envoyer': '' }}/>
          </form>
          {photo ? <p className="rgt-note" data-rgt-photo-prete="">{tr(moteur === 'ia' ? 'rgt.photoPrete' : 'rgt.photoPreteSansIA')}</p> : null}
        </div>) : null}
      {plan && resultat ? <>
        <Apercu plan={plan.plan} resultat={resultat} existants={ctx.meubles} articles={articles}/>
        <div className="rgt-gestes"><Bouton variante="texte" attrs={{ 'data-rgt-recommencer': '' }} onClick={recommencer}>{tr('rgt.recommencer')}</Bouton></div>
        <p className="rgt-note">{tr('rgt.rienAvant')}</p>
      </> : null}
      <div ref={bas} aria-hidden="true"/>
    </Feuille>
  );
}
