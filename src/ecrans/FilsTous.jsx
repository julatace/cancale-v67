// ── MESSAGES · TOUS : UN SEUL FIL PAR ACHETEUR ET PAR PAIRE (10 nov., lot AB) ──
// Validé par Julien (propositions du 9 nov., n° 42). La RÈGLE est dans
// src/filUnique.js (§5 : jamais par ressemblance) ; cet écran ne fait que lire
// ce que les écrans des sites lisent déjà, en SCALAIRES (§4.4), et montrer.
//   · Vinted : les conversations de la liste Vinted (passées par App.jsx avec
//     leur paire PAR IDENTITÉ, `paireDeConv`) — un fil Vinted s'ouvre dans LE
//     fil Vinted (réponse, offres, plafond d'actions, rien de recopié) ;
//   · Leboncoin : `lbc_fil_*` (extension 5.318) — `FilLeboncoin` ;
//   · Vestiaire : `vc_fil_*` + `vc_messages` (5.317) — `FilVestiaire` ;
//   · eBay : VRM ne garde pas ses messages (lus en direct sur son filtre) — dit.
// Un fil de plusieurs conversations montre leurs messages dans l'ordre, chacun
// avec la marque de SA plateforme ; « Répondre » ouvre la conversation du DERNIER
// message dans son propre fil (règles d'envoi de ce site, recettes APPRISES, 50/h).
// Deux conversations sans identité commune ne sont JAMAIS fusionnées : VRM
// demande (« Peut-être la même paire ? »), SON clic relie, « Délier » défait.
import React from 'react';
import { motsVendeur } from '../profilVendeur.js';
import { C, Icon, LigneConv, CadreFil, TeteFil, BulleConv, PiedSansEnvoi, Bouton, SUPABASE_URL, lireBaseRelue, load, save, onCloudReady, cleNum, urlPhotoVc, appelEbay, corpsCompteEbay, lireComptesEbay, askConfirm, verifierMessageAvantEnvoi } from '../App.jsx';
import { risquesMessage, phraseRisqueMessage } from '../messageSur.js';
import { tr } from '../i18n/index.js';
import { LogoSite } from '../SelecteurSites.jsx';
import { AlerteArnaque, CompteurArnaque, PastilleArnaque } from '../AlerteArnaque.jsx';
import { motifDeLApercu } from '../antiArnaque.js';
import { FilLeboncoin } from './MessagesLeboncoin.jsx';
import { FilVestiaire, ficheDuNumero } from './Vestiaire.jsx';
import { CLE_FILS_RELIES, convVinted, convLeboncoin, convVestiaire, convEbay, regrouperFils, suggestionsFils, relierFils, refuserFils, delierFil, messagesDuFil, conversationDeReponse } from '../filUnique.js';
import { trj } from '../i18n/react.js';
import { BarreOutils, LigneAFaire } from '../ui/index.js';   // (14 nov., refonte) les briques communes des écrans de liste

const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const lireRelies = () => { try { const v = load(CLE_FILS_RELIES, {}); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };

function Marques({ plateformes }) {
  return (
    <span className="vrm-fil-marques" data-fil-marques={plateformes.join(',')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, flexShrink: 0 }}>
      {plateformes.map((p) => <span key={p} title={NOM_SITE[p]} style={{ display: 'inline-flex' }}><LogoSite site={p}/></span>)}
    </span>
  );
}

// Lecture des fils Leboncoin et Vestiaire (scalaires) — trois états par site.
function useAutresSites() {
  const [d, setD] = React.useState({ lbc: undefined, vc: undefined });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { let stop = false; (async () => {
    const [jf, jm, je, vf, vm, vl, ve] = await Promise.all([
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.lbc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu,dm:meta->>dernierDeMoi,compte:meta->>compte`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_messages&select=comptes:data->comptes`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_envoi&select=appris:data->appris,raison:data->>raison,at:data->>at`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.vc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu,dm:meta->>dernierDeMoi,pid:meta->>productId,ref:meta->>ref`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_messages&select=conversations:data->conversations`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=liens:data->liens`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_envoi&select=appris:data->appris,raison:data->>raison,at:data->>at,chemin:data->>chemin`),
    ]);
    if (stop) return;
    let lbc = null;
    if (Array.isArray(jf)) {
      const comptes = Array.isArray(jm) && jm[0] && jm[0].comptes && typeof jm[0].comptes === 'object' ? jm[0].comptes : {};
      const nomDe = (id) => { const k = String(id || '').replace(/^lbc-account:/, ''); const c = comptes[k] || comptes['lbc-account:' + k] || {}; return c.name || ''; };
      lbc = { fils: jf.map((x) => ({ ...x, conv: String(x.id || '').replace(/^lbc_fil_/, ''), nom: nomDe(x.compte) })).filter((x) => x.conv && Number(x.n) > 0),
        envoi: Array.isArray(je) ? (je[0] ? { appris: je[0].appris === true, raison: je[0].raison || '' } : { appris: false, raison: '' }) : null };
    }
    let vc = null;
    if (Array.isArray(vf)) {
      const convs = Array.isArray(vm) && vm[0] && vm[0].conversations && typeof vm[0].conversations === 'object' ? vm[0].conversations : {};
      const liens = Array.isArray(vl) && vl[0] && vl[0].liens && typeof vl[0].liens === 'object' ? vl[0].liens : {};
      const fils = vf.map((x) => {
        const conv = String(x.id || '').replace(/^vc_fil_/, ''); const v = convs[conv] || {};
        const pid = String(v.productId || x.pid || ''); const ref = v.ref || x.ref || '';
        // Le N° : la RÉFÉRENCE VRM de l'article ou le lien posé par VRM (jamais le titre, §5).
        const num = cleNum((pid && liens[pid]) || ref || '');
        const f = num ? ficheDuNumero(num) : null;
        return { conv, pid, num, compte: v.compte || '', apercu: x.ap || v.apercu || '', date: x.da || v.date || '',
          deMoi: x.ap ? x.dm === 'true' : v.apercuDeMoi === true ? true : null, nonLu: v.nonLu === true ? true : v.nonLu === false ? false : null,
          titre: (f && f.titre) || String(v.titre || ''), photo: (f && f.photo) || urlPhotoVc(v.photo || '') || null, n: Number(x.n) || 0 };
      }).filter((x) => x.conv && x.n > 0);
      vc = { fils, envoi: Array.isArray(ve) ? (ve[0] ? { appris: ve[0].appris === true, raison: /^\/chat\/channel\/?$/.test(String(ve[0].chemin || '')) ? '' : (ve[0].raison || '') } : { appris: false, raison: '' }) : null };
    }
    setD({ lbc, vc });
  })(); return () => { stop = true; }; }, [tick]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && (x.quoi === 'lbc' || x.quoi === 'vestiaire')) setTick((t) => t + 1); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, []);
  return d;
}

// Les messages d'une conversation pour le fil fusionné : `null` pas su, [] lue vide.
async function lireMessages(e, vintedDe, lireVinted, ebayDe) {
  if (e.plateforme === 'ebay') { const x = ebayDe ? ebayDe(e) : null; if (!x) return null; const m = x.m; return [{ t: m.body || m.subject, at: m.date, deMoi: false }, ...(m.responses || []).filter(Boolean).map((t) => ({ t, at: null, deMoi: true }))]; }
  if (e.plateforme === 'vinted') { const c = vintedDe(e); if (!c) return null; try { return await lireVinted(c); } catch (_) { return null; } }
  const id = (e.plateforme === 'leboncoin' ? 'lbc_fil_' : 'vc_fil_') + e.conv;
  const j = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=messages:data->messages`);
  if (!Array.isArray(j)) return null;
  return j[0] && Array.isArray(j[0].messages) ? j[0].messages : [];
}

function FilFusionne({ fil, vintedDe, lireVinted, ebayDe, onRepondre, onDelier, onFermer, nomDe }) {
  const [parConv, setParConv] = React.useState(undefined);
  React.useEffect(() => { let stop = false; (async () => {
    const l = await Promise.all(fil.convs.map(async (e) => ({ entree: e, messages: await lireMessages(e, vintedDe, lireVinted, ebayDe) })));
    if (!stop) setParConv(l);
  })(); return () => { stop = true; }; }, [fil.cle, fil.convs.length]);
  const messages = parConv ? messagesDuFil(parConv) : [];
  const ratees = parConv ? parConv.filter((x) => x.messages == null).map((x) => x.entree) : [];
  const via = parConv ? conversationDeReponse(fil, messages) : null;
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55, textAlign: 'center', padding: '20px 0' };
  return (
    <CadreFil etiquette="Fil de messages" onFermer={onFermer} attrs={{ 'data-fil-fusionne': fil.cle, 'data-fil-n': String(fil.convs.length) }}>
      <TeteFil onFermer={onFermer} nom={nomDe(fil)} titre={fil.num ? `N°${fil.num}` : ''} compte={fil.plateformes.map((p) => NOM_SITE[p]).join(' · ')}/>
      <div className="vrm-chat-history" style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {parConv ? <AlerteArnaque site={fil.plateformes.length === 1 ? fil.plateformes[0] : ''} messages={messages}/> : null}
        {parConv === undefined ? <div role="status" data-fil-etat="charge" style={style}>{tr('messages.lecture')}</div>
          : !messages.length ? <div data-fil-etat="vide" style={style}>—</div>
          : messages.map((m, i) => (
            <BulleConv key={m.conv + ':' + m.rang} moi={m.deMoi === true} qui={m.deMoi === true ? 'Toi' : m.deMoi === false ? "L'autre personne" : ''} texte={m.t} quand={m.at} avecDate
              attrs={{ 'data-fil-msg': m.plateforme, 'data-fil-msg-i': String(i) }}
              apres={<small className="vrm-bulle-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, marginTop: 3 }}><LogoSite site={m.plateforme}/>{NOM_SITE[m.plateforme]}</small>}/>
          ))}
        {ratees.length ? <div data-fil-ratees={ratees.map((e) => e.plateforme).join(',')} style={{ ...style, padding: '4px 0' }}>{trj('messages.puLire', { x: ratees.map((e) => NOM_SITE[e.plateforme]).join(', ') })}</div> : null}
      </div>
      <div className="vrm-chat-foot" style={{ borderTop: `1px solid ${C.border}`, background: C.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {parConv === undefined ? null : via
          ? <Bouton variante="primaire" data-fil-repondre={via.plateforme} onClick={() => onRepondre(via)}>{trj('messages.repondre', { x: NOM_SITE[via.plateforme] })}</Bouton>
          : <div data-fil-repondre="passu" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {fil.convs.map((e) => <Bouton key={e.cle} variante="secondaire" data-fil-repondre-choix={e.plateforme} onClick={() => onRepondre(e)}>{trj('messages.ouvrir', { x: NOM_SITE[e.plateforme] })}</Bouton>)}
            </div>}
        {onDelier ? <button type="button" className="vrm-pied-lien" data-fil-delier="" onClick={onDelier} style={{ minHeight: 44, alignSelf: 'flex-start' }}>{tr('messages.memeFilDelier')}</button> : null}
      </div>
    </CadreFil>
  );
}


// (11 nov., ebay-complet — ajout validé par Julien) eBay DANS « Tous » : ses échanges
// lus EN DIRECT (action `messages`, page 1, chaque compte eBay actif) — VRM ne les
// range pas. Trois états : undefined en cours · null pas su · { items, messages }.
function useEbayTous() {
  const [d, setD] = React.useState(undefined);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { let stop = false; (async () => {
    const comptes = await lireComptesEbay(false).catch(() => null);
    if (stop) return;
    if (!Array.isArray(comptes)) { setD(null); return; }
    if (!comptes.length) { setD({ items: [], messages: new Map(), aucun: true }); return; }
    const res = await Promise.all(comptes.map(async (c) => { const ref = c.ref || 'principal'; const { j } = await appelEbay({ action: 'messages', page: 1, ...corpsCompteEbay(ref) }); return { ref, j }; }));
    if (stop) return;
    if (res.some((r) => !(r.j && r.j.ok && Array.isArray(r.j.messages)))) { setD(null); return; }
    const messages = new Map(), items = [];
    for (const { ref, j } of res) for (const m of j.messages) { items.push({ m, compte: ref }); messages.set(ref + ':' + m.id, { m, compte: ref }); }
    setD({ items, messages });
  })(); return () => { stop = true; }; }, [tick]);
  return [d, () => setTick((t) => t + 1)];
}
// Le fil d'un échange eBay : la question, ses réponses, et « Envoyer » sur SON clic
// (confirmé) seulement pour une question d'acheteur sur une annonce — la route relit
// la question chez eBay juste avant (`repondre`, AddMemberMessageRTQ).
function FilEbay({ x, onFerme, onEnvoye }) {
  const [t, setT] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  if (!x) return <div className="vrm-chat-empty" data-fil-etat="passu"><span>{tr('ebay.fil.passu')}</span></div>;
  const m = x.m, rep = Array.isArray(m.responses) ? m.responses.filter(Boolean) : [];
  const question = /^AskSellerQuestion$/i.test(String(m.type || '')) && /^\d{6,19}$/.test(String(m.itemId || ''));
  const envoyer = async () => {
    const body = t.trim(); if (!body) return;
    if (!(await verifierMessageAvantEnvoi(body, 'ebay'))) return;   // (12 nov.) un mot qui fait bannir : SON « Envoyer quand même »
    const ok = await askConfirm({ title: tr('ebay.fil.conf.titre'), desc: body, ok: tr('ebay.fil.conf.ok'), cancel: tr('ebay.conf.annuler') });
    if (!ok) return;
    setOccupe(true);
    const { j } = await appelEbay({ action: 'repondre', confirme: true, itemId: String(m.itemId), messageId: String(m.id), body, ...corpsCompteEbay(x.compte) });
    setOccupe(false);
    if (j && j.ok) { setT(''); setMsg(tr('ebay.fil.envoye')); if (onEnvoye) onEnvoye(); } else setMsg((j && j.error) || tr('ebay.err.autre'));
  };
  return (
    <div data-fil-ebay={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onFerme} aria-label={tr('ebay.fil.fermer')} style={{ minHeight: 44, minWidth: 44, border: 'none', background: 'transparent', color: C.muted, fontSize: 20, cursor: 'pointer' }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titre || m.subject || 'eBay'}</div><div style={{ fontSize: 12, color: C.muted }}>eBay</div></div>
      </div>
      <div data-fil-ebay-question style={{ alignSelf: 'flex-start', maxWidth: '85%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '8px 12px', fontSize: 15, color: C.text, whiteSpace: 'pre-wrap' }}>{m.body || m.subject}</div>
      {rep.map((r, i) => <div key={i} data-fil-ebay-reponse style={{ alignSelf: 'flex-end', maxWidth: '85%', background: `${C.accent}14`, borderRadius: 16, padding: '8px 12px', fontSize: 15, color: C.text, whiteSpace: 'pre-wrap' }}>{r}</div>)}
      {question ? (<>
        {risquesMessage(t, 'ebay').length > 0 && <p role="status" data-message-risque={risquesMessage(t, 'ebay').map((r) => r.code).join(' ')} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.warn }}>{risquesMessage(t, 'ebay')[0].texte} · {phraseRisqueMessage('ebay')}</p>}
        <textarea data-fil-ebay-saisie value={t} onChange={(e) => setT(e.target.value.slice(0, 2000))} rows={3} aria-label={tr('ebay.fil.repondre')} placeholder={tr('ebay.fil.repondre')} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, fontSize: 17, fontFamily: 'inherit', background: C.card, color: C.text }}/>
        <div><Bouton variante="primaire" occupe={occupe} disabled={!t.trim()} data-fil-ebay-envoyer="" onClick={envoyer}>{tr('ebay.fil.envoyer')}</Bouton></div>
      </>) : <p data-fil-ebay-sans-reponse style={{ fontSize: 13, color: C.muted }}>{tr('ebay.fil.surEbay')}</p>}
      {msg && <p role="status" style={{ fontSize: 13, color: C.text }}>{msg}</p>}
    </div>
  );
}

export function FilsTous({ vinted, vintedOuvert, ouvrirVinted, fermerVinted, rendreVinted, lireVinted }) {
  const autres = useAutresSites();
  const [ebayTous, relireEbay] = useEbayTous();
  const [relies, setRelies] = React.useState(lireRelies);
  React.useEffect(() => { const stop = onCloudReady(() => setRelies(lireRelies())); return typeof stop === 'function' ? stop : undefined; }, []);
  const ecrire = (n) => { setRelies(n); save(CLE_FILS_RELIES, n); };
  const [ouvert, setOuvert] = React.useState('');      // la clé du fil ouvert
  const [via, setVia] = React.useState('');            // la conversation ouverte pour répondre (fil fusionné)
  // (14 nov., refonte — AJOUT 2 : « imagine si j'ai 1000 ») Retrouver un fil : le pseudo, le modèle, le N°
  // ou un mot du dernier message, filtré ICI (rien n'est relu ni écrit ; l'ordre reste celui des fils).
  const [cherche, setCherche] = React.useState('');

  const parCle = new Map();
  const entrees = [];
  for (const x of (Array.isArray(vinted) ? vinted : [])) { const e = convVinted(x.c, x.paire); if (e) { e.compteNom = x.compte || ''; parCle.set(e.cle, { e, c: x.c }); entrees.push(e); } }
  for (const f of ((autres.lbc && autres.lbc.fils) || [])) { const e = convLeboncoin(f); if (e) { e.compteNom = f.nom || ''; parCle.set(e.cle, { e }); entrees.push(e); } }
  for (const v of ((autres.vc && autres.vc.fils) || [])) { const e = convVestiaire(v); if (e) { parCle.set(e.cle, { e }); entrees.push(e); } }
  for (const x of ((ebayTous && ebayTous.items) || [])) { const e = convEbay(x.m, x.compte); if (e) { parCle.set(e.cle, { e }); entrees.push(e); } }
  const fils = regrouperFils(entrees, relies.liens);
  const propositions = suggestionsFils(fils, relies.liens, relies.refus);
  const motCherche = cherche.trim().toLowerCase().replace(/^n°\s*/, '');
  const filsVus = motCherche ? fils.filter((f) => {
    const d = f.dernier || f.convs[f.convs.length - 1];
    const t = [f.num ? 'n°' + f.num : '', f.num || '', ...f.convs.map((c) => [c.nom, c.titre, c.compteNom].join(' ')), d ? d.apercu : ''].join(' ').toLowerCase();
    return t.includes(motCherche);
  }) : fils;
  const filDe = (cle) => fils.find((f) => f.cle === cle) || null;
  const vintedDe = (e) => (parCle.get(e.cle) || {}).c || null;
  const nomDe = (f) => {
    const v = f.convs.find((c) => c.plateforme === 'vinted' && c.nom);
    if (v) return v.nom;
    const t = f.convs.find((c) => c.titre);
    return t ? t.titre : f.convs[0].plateforme === 'leboncoin' ? 'Acheteur Leboncoin' : f.convs[0].plateforme === 'ebay' ? 'Acheteur eBay' : 'Acheteur Vestiaire';
  };
  const ouvrir = (f) => {
    setVia('');
    setOuvert(f.cle);
    const seul = f.convs.length === 1 ? f.convs[0] : null;
    if (seul && seul.plateforme === 'vinted') { const c = vintedDe(seul); if (c) ouvrirVinted(c); }
    else fermerVinted();
  };
  const fermer = () => { setOuvert(''); setVia(''); fermerVinted(); };
  const repondre = (e) => { setVia(e.cle); if (e.plateforme === 'vinted') { const c = vintedDe(e); if (c) ouvrirVinted(c); } else fermerVinted(); };

  const choisi = ouvert ? filDe(ouvert) : null;
  const conv = choisi ? (via ? choisi.convs.find((c) => c.cle === via) : choisi.convs.length === 1 ? choisi.convs[0] : null) : null;
  // Le fil Vinted fermé de l'intérieur (sa flèche « retour ») ferme aussi ce choix.
  const vuVinted = React.useRef('');
  const cleVinted = conv && conv.plateforme === 'vinted' ? conv.compte + ':' + conv.conv : '';
  React.useEffect(() => {
    if (cleVinted && vintedOuvert === cleVinted) { vuVinted.current = cleVinted; return; }
    if (cleVinted && vuVinted.current === cleVinted && !vintedOuvert) { vuVinted.current = ''; if (via) setVia(''); else setOuvert(''); }
  }, [vintedOuvert, cleVinted]);
  const panneau = () => {
    if (!choisi) return <div className="vrm-chat-empty"><Icon name="chat" size={28}/><span>{tr('messages.choisisFil')}</span></div>;
    if (!conv) return <FilFusionne key={choisi.cle} fil={choisi} vintedDe={vintedDe} lireVinted={lireVinted} ebayDe={(e) => (ebayTous && ebayTous.messages ? ebayTous.messages.get(e.compte + ':' + e.conv) : null)} onRepondre={repondre} onFermer={fermer} nomDe={nomDe}
      onDelier={choisi.convs.some((c) => Object.values(relies.liens || {}).some((l) => l && (l.a === c.cle || l.b === c.cle))) ? () => { ecrire(delierFil(relies, choisi.convs.map((c) => c.cle))); setOuvert(''); } : null}/>;
    const fermerConv = () => (via ? (setVia(''), fermerVinted()) : fermer());
    if (conv.plateforme === 'vinted') return vintedOuvert === conv.compte + ':' + conv.conv ? rendreVinted() : <div className="vrm-chat-empty" data-fil-etat="charge"><span>{tr('messages.lecture')}</span></div>;
    if (conv.plateforme === 'ebay') return <FilEbay key={conv.cle} x={ebayTous && ebayTous.messages ? ebayTous.messages.get(conv.compte + ':' + conv.conv) : null} onFerme={fermerConv} onEnvoye={relireEbay}/>;
    if (conv.plateforme === 'leboncoin') return <FilLeboncoin key={conv.cle} conv={conv.conv} nom={conv.compteNom || 'Leboncoin'} envoi={autres.lbc && autres.lbc.envoi} onFerme={fermerConv}/>;
    return <FilVestiaire key={conv.cle} conv={conv.conv} num={conv.num || ''} titre={conv.titre || ''} envoi={autres.vc && autres.vc.envoi} onFerme={fermerConv}/>;
  };

  const chargement = vinted === undefined || autres.lbc === undefined || autres.vc === undefined;
  const sources = [['vinted', vinted === null ? 'passu' : 'lu'], ['leboncoin', autres.lbc === null ? 'passu' : 'lu'], ['vestiaire', autres.vc === null ? 'passu' : 'lu'], ['ebay', ebayTous === undefined ? 'charge' : ebayTous === null ? 'passu' : 'lu']];
  const pasLus = sources.filter(([, s]) => s === 'passu').map(([p]) => p);
  const muted = { fontSize: 13, color: C.muted, lineHeight: 1.5 };
  return (
    <div data-fils-tous={chargement ? 'charge' : String(fils.length)} data-fils-sources={sources.map(([p, s]) => p + ':' + s).join(',')}>
      <div className="vrm-message-workspace">
        <div className="vrm-inbox-column">
          {/* (14 nov., refonte — AJOUT 3) Les questions « Peut-être la même paire ? » passent dans UNE ligne
              « À faire · N › » : la feuille montre la question du moment avec SES deux gestes (Oui / Non),
              la suivante vient après. Rien n'est relié sans son clic. */}
          {fils.length ? <BarreOutils className="vrm-ms-msg-outils" valeur={cherche} onChange={setCherche} placeholder={tr('ms.msg.chercher')} label={tr('ms.msg.chercher')}
            data-msg-recherche="" champAttrs={{ 'data-msg-recherche': '', autoComplete: 'off' }}/> : null}
          <LigneAFaire n={propositions.length} titre={tr('ms.msg.aFaire')} className="vrm-ms-msg-afaire" data-msg-afaire={propositions.length}>
          {/* Une question à la fois (la liste reste au premier écran) ; « Non » ou « Oui » fait venir la suivante. */}
            {propositions.slice(0, 1).map((p) => {
              const A = filDe(p.a), B = filDe(p.b); if (!A || !B) return null;
              return (
                <div key={p.cle} data-fil-proposition={p.sorte} data-fil-a={p.a} data-fil-b={p.b} style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.card, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: C.text }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: C.warn, flexShrink: 0 }}/>
                    {p.sorte === 'paire' ? `Peut-être ${motsVendeur().meme} ?` : tr('messages.peutEtreMeme2')}
                  </div>
                  <div style={{ ...muted, marginTop: 4 }}>
                    {[A, B].map((f, i) => <div key={f.cle} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Marques plateformes={f.plateformes}/><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomDe(f)}{f.num ? ` · N°${f.num}` : ''}</span></div>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <Bouton variante="secondaire" data-fil-relier="" onClick={() => ecrire(relierFils(relies, p.a, p.b))}>{tr('messages.ouiMemeFil')}</Bouton>
                    <Bouton variante="secondaire" data-fil-refuser="" onClick={() => ecrire(refuserFils(relies, p.a, p.b))}>{tr('messages.non')}</Bouton>
                  </div>
                </div>
              );
            })}
            {propositions.length > 1 ? <p data-fil-propositions-autres={propositions.length - 1} style={{ ...muted, margin: '-4px 0 10px' }}>{tr('messages.encore')} {propositions.length - 1} {tr('messages.question')}{propositions.length > 2 ? 's' : ''} {tr('messages.apresCelleCi')}</p> : null}
          </LigneAFaire>
          {chargement && !fils.length ? <div role="status" style={{ ...muted, padding: '12px 0' }}>{tr('messages.lecture')}</div>
            : !fils.length ? <div data-fils-vide="" style={{ ...muted, padding: '12px 0' }}>{tr('messages.aucuneConversationLue')}</div>
            : motCherche && !filsVus.length ? <div data-fils-rien="" className="vrm-ms-rien">{tr('ms.msg.rien', { x: cherche.trim() })}</div>
            : <><CompteurArnaque n={fils.filter((f) => { const d = f.dernier || f.convs[f.convs.length - 1]; return d && motifDeLApercu(d.apercu, d.deMoi); }).length}/><div className="vrm-msg-list" style={{ border: `1px solid ${C.border}`, background: C.card }}>
                {filsVus.slice(0, 80).map((f, i) => {
                  const d = f.dernier || f.convs[f.convs.length - 1];
                  const titre = f.convs.find((c) => c.titre);
                  return (
                    <LigneConv key={f.cle} actif={ouvert === f.cle} style={i < 12 ? { '--i': i } : undefined}
                      attrs={{ 'data-fil': f.cle, 'data-fil-convs': String(f.convs.length), 'data-fil-sites': f.plateformes.join(','), 'data-fil-num': f.num || undefined, 'data-nonlu': f.nonLu === true ? '1' : undefined }}
                      onClick={() => ouvrir(f)} ariaLabel={`Ouvrir le fil ${nomDe(f)}`}
                      photo={(f.convs.find((c) => c.photo) || {}).photo || null} nom={nomDe(f)} sensible={f.convs.some((c) => c.plateforme === 'vinted')}
                      quand={f.at} couleurHeure={f.nonLu === true ? C.text : C.muted}
                      titre={titre && titre.titre !== nomDe(f) ? titre.titre : ''} num={f.num || ''}
                      extrait={d ? d.apercu : ''} toi={!!(d && d.apercu && d.deMoi === true)} couleurExtrait={f.nonLu === true ? C.text : C.muted}
                      apres={<>{f.convs.length > 1 ? <span className="vrm-msg-etat" data-fil-relie="" style={{ color: C.muted, borderColor: C.border }}>{trj('messages.conv', { x: f.convs.length })}</span> : null}<PastilleArnaque motif={d ? motifDeLApercu(d.apercu, d.deMoi) : null}/><Marques plateformes={f.plateformes}/></>}
                      point={f.nonLu === true ? C.accent : null}/>
                  );
                })}
              </div></>}
          {pasLus.length ? <p data-fils-pas-lus={pasLus.join(',')} style={{ ...muted, marginTop: 8 }}>{trj('messages.puLireRien', { x: pasLus.map((p) => NOM_SITE[p]).join(', ') })}</p> : null}
          {ebayTous === undefined ? <p data-fils-ebay="charge" style={{ ...muted, marginTop: 8 }}>{tr('ebay.fil.lecture')}</p> : null}
        </div>
        <div className="vrm-chat-column">{panneau()}</div>
      </div>
    </div>
  );
}
