// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { STYLE_FLOU, lbcFloute } from '../flouCompte.js';
import { motsVendeur } from '../profilVendeur.js';
import React, { useState, useEffect } from 'react';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import { PAS_SU } from '../libelles.js';
import { AlerteArnaque, CompteurArnaque, PastilleArnaque } from '../AlerteArnaque.jsx';
import { motifDeLApercu } from '../antiArnaque.js';
// (11 nov., anti-arnaque) L'aperçu d'un fil Leboncoin : son auteur se lit dans `dernierDeMoi` (texte ⇒ « true »/« false »).
const deMoiMeta = (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : null);
import { trierRecents } from '../ordreConversations.js';
import { Bouton, BulleConv, C, CadreFil, ComposeConv, EXT_CAPACITES, FicheConvVolet, Icon, LigneConv, PhotoVinted, PiedSansEnvoi, RapidesConv, SUPABASE_URL, TeteFil, annonceLbcALui, annonceLbcEnVente, annoncesLbcVendues, comptesLbcProuves, comptesLbcSession, extSait, ilYaBr, lbcListingsSession, lireBaseRelue, reponsesRapidesPartagees, useCompteLbcOuvert, useVueSession, vmrCmd } from '../App.jsx';


// ⟦← App.jsx #1⟧
// ⟦→ ecrans/Leboncoin.jsx #8⟧

// ── LEBONCOIN : UN FIL, ET RÉPONDRE SUR SON CLIC (3 nov., extension 5.318) ──
// Le fil (`lbc_fil_{conv}`) : le texte des messages, leur date, « de toi » —
// jamais le nom de la personne. « Envoyer » n'existe qu'avec
// `extSait('lbcrepondre') === 'ok'` ET une recette APPRISE de son propre envoi
// (`lbc_envoi.appris`) ; sinon le pied mène à Leboncoin. Part de l'onglet
// leboncoin.fr connecté sur le compte du fil, une à la fois, dans les 50 actions/h.
const etiquetteResultatLbc = (r) => {
  if (!r) return { ton: 'muet', texte: "L'extension n'a pas répondu — je ne sais pas si le message est parti. Regarde la conversation sur Leboncoin avant de renvoyer." };
  if (r.accepte === true && r.etape === 'fait') return { ton: 'ok', texte: 'Envoyé sur Leboncoin.' };
  if (r.accepte === true && r.etape === 'incertain') return { ton: 'muet', texte: r.raison || 'Je ne sais pas si le message est parti — regarde sur Leboncoin avant de renvoyer.' };
  if (r.accepte === true && r.etape === 'refuse') return { ton: 'ko', texte: r.raison || "Leboncoin a refusé : le message n'est pas parti." };
  return { ton: 'ko', texte: (r.raison ? r.raison.charAt(0).toUpperCase() + r.raison.slice(1) : "Rien n'est parti.") + (/[.!]$/.test(r.raison || '') ? '' : '.') };
};
function FilLeboncoin({ conv, nom, envoi, onFerme }) {
  const [fil, setFil] = React.useState(undefined);   // undefined en cours · null pas su · objet
  const [texte, setTexte] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const [res, setRes] = React.useState(null);
  const relire = React.useCallback(async () => {
    const j = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_fil_${encodeURIComponent(conv)}&select=messages:data->messages,page:data->>page`);
    if (!Array.isArray(j)) { setFil(null); return; }
    setFil(j[0] ? { messages: Array.isArray(j[0].messages) ? j[0].messages : [], page: j[0].page || '' } : { messages: null, page: '' });
  }, [conv]);
  React.useEffect(() => { relire(); }, [relire]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'lbc') relire(); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [relire]);
  const cap = extSait('lbcrepondre');
  const peut = cap === 'ok' && envoi && envoi.appris === true;
  const envoyer = async () => {
    const t = texte.trim();
    if (!t || enCours || !peut) return;
    setEnCours(true); setRes(null);
    let r = null; try { r = await vmrCmd({ cmd: 'lbcRepondre', conv, texte: t }, 45000); } catch (_) { r = null; }
    setEnCours(false); setRes(etiquetteResultatLbc(r));
    if (r && r.accepte === true && r.etape === 'fait') { setTexte(''); relire(); }
  };
  const style = { fontSize: 13, color: C.muted, lineHeight: 1.55, textAlign: 'center', padding: '20px 0' };
  let corps;
  if (fil === undefined) corps = <div data-lbc-fil-etat="charge" style={style}>…</div>;
  else if (fil === null) corps = <div data-lbc-fil-etat="pas-su" style={style}>Conversation illisible pour l'instant.</div>;
  else if (!fil.messages || !fil.messages.length) corps = <div data-lbc-fil-etat="vide" style={style}>—</div>;
  else corps = (
    <div data-lbc-fil-etat="lu" data-lbc-fil-n={fil.messages.length} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fil.messages.slice(-80).map((m, i) => (
        <BulleConv key={m.id || i} moi={m.deMoi === true} qui={m.deMoi === true ? 'Toi' : ''} texte={m.t} quand={Date.parse(m.at || '') || null} avecDate traduire={m.deMoi !== true ? m.t : ''}
          attrs={{ 'data-lbc-msg': m.deMoi === true ? 'moi' : m.deMoi === false ? 'autre' : 'passu' }}/>
      ))}
    </div>
  );
  // La page où le fil a été VU (sur leboncoin.fr), sinon la messagerie — jamais une adresse devinée.
  const page = fil && /^\/messages[\w/.-]*$/.test(fil.page || '') ? fil.page : '/messages';
  const lien = `https://www.leboncoin.fr${page}`;
  const resultat = res && <div role="status" data-lbc-resultat={res.ton} style={{ fontSize: 13, color: res.ton === 'ko' ? C.warn : res.ton === 'ok' ? C.text : C.muted, lineHeight: 1.5, marginBottom: 8 }}>{res.texte}</div>;
  let pied;
  if (fil && fil.messages && fil.messages.length && peut) pied = (
    <div className="vrm-chat-foot" data-lbc-repondre="pret" style={{ borderTop: `1px solid ${C.border}`, background: C.card }}>
      {resultat}
      <RapidesConv liste={reponsesRapidesPartagees()} onChoisir={(t) => setTexte(String(t).slice(0, 2000))} desactive={enCours}/>
      <ComposeConv valeur={texte} onChange={(t) => setTexte(String(t).slice(0, 2000))} onEnvoyer={envoyer} enCours={enCours} etiquette="Ta réponse sur Leboncoin" libelleEnvoyer="Envoyer"
        envoiBloque={!texte.trim() || enCours} attrsEnvoyer={{ 'data-lbc-envoyer': '' }}/>
    </div>
  );
  else pied = <PiedSansEnvoi attrs={{ 'data-lbc-repondre': cap !== 'ok' ? 'ext-' + cap : (envoi && envoi.appris ? 'sans-fil' : 'pas-appris') }} lien={lien} texteLien="Répondre sur Leboncoin ↗"
    raison={cap === 'retard' ? <>Extension <b>{EXT_CAPACITES.lbcrepondre}</b></> : null}>{resultat}</PiedSansEnvoi>;
  return (
    <CadreFil etiquette="Conversation Leboncoin" onFermer={onFerme} attrs={{ 'data-lbc-fil-ouvert': conv }}>
      <TeteFil onFermer={onFerme} nom={nom || 'Leboncoin'} titre="" compte="Leboncoin"/>
      <div className="vrm-chat-history" style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fil && fil.messages ? <AlerteArnaque site="leboncoin" lien={lien} messages={fil.messages}/> : null}
        {corps}
      </div>
      {pied}
    </CadreFil>
  );
}
// ── MESSAGES LEBONCOIN (29 oct., « fais un peu plus de cohérence ») ──────
// La même forme que Messages Vinted : deux zones, « Conversations » et
// « ♡ Favoris reçus » (Julien : « messages aux favoris, tout pareil » — sur
// Leboncoin SEULEMENT, rien ne change côté Vinted). Ce qui est MESURÉ :
//   · conversations : Leboncoin ne donne à l'extension que le NOMBRE de non-lus
//     du compte connecté (compteur de messagerie) — jamais le texte ; on répond
//     sur Leboncoin ;
//   · favoris : la page « Statistiques » d'une annonce donne des NOMBRES par
//     jour (`stats/proxy/v2/classified/history/daily` : TotalFavorites, Views,
//     TotalMessages…), jamais QUI a mis en favori. Aucun appel vu ne permet
//     d'écrire à ces personnes : VRM n'en invente pas, il montre le nombre.
function MessagesLeboncoin() {
  const [zone, setZone] = useVueSession('leboncoin-messages-zone', 'conversations');
  return (
    <div data-messages-lbc-zone={zone}>
      <div className="vrm-messages-sections" role="group" aria-label="Choisir Conversations ou Favoris">
        <button type="button" aria-pressed={zone === 'conversations'} onClick={() => setZone('conversations')}><Icon name="chat" size={17}/>Conversations</button>
        <button type="button" aria-pressed={zone === 'favoris'} onClick={() => setZone('favoris')} data-lbc-zone-favoris=""><Icon name="heart" size={17}/>Favoris reçus</button>
      </div>
      {zone === 'favoris' ? <FavorisLeboncoin/> : <ConversationsLeboncoin/>}
    </div>
  );
}
function ConversationsLeboncoin() {
  const [d, setD] = useState(undefined);
  const [ouvert, setOuvert] = useState('');   // le compte dont le fil est ouvert (1er nov.)
  const [ouvertConv, setOuvertConv] = useState('');   // (3 nov.) la conversation ouverte
  const [tickLbc, setTickLbc] = useState(0);
  useEffect(() => { let stop = false; (async () => {
    try {
      // (1er nov.) Projetées (§4.4) et relues une fois sur un échec passager
      // (`lireBaseRelue`) : un jeton qui expire ne fait plus dire « pas pu lire ».
      const [jm, ja, jf, je] = await Promise.all([
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_messages&select=compteurs:data->compteurs,comptes:data->comptes`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=a:data->accounts`),
        // (3 nov., 5.318) Les fils lus, en SCALAIRES (§4.4 : jamais le texte de tous les fils d'un coup).
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=like.lbc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu,dm:meta->>dernierDeMoi,compte:meta->>compte`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_envoi&select=appris:data->appris,raison:data->>raison,at:data->>at`),
      ]);
      if (!Array.isArray(jm)) { if (!stop) setD(null); return; }
      const m = jm[0] || {};
      const acc = (Array.isArray(ja) && ja[0] && ja[0].a && typeof ja[0].a === 'object') ? ja[0].a : {};
      const fils = Array.isArray(jf) ? jf.map((x) => ({ ...x, conv: String(x.id || '').replace(/^lbc_fil_/, '') })).filter((x) => x.conv && Number(x.n) > 0) : null;
      const envoi = Array.isArray(je) ? (je[0] ? { appris: je[0].appris === true, raison: je[0].raison || '' } : { appris: false, raison: '' }) : null;
      if (!stop) setD({ compteurs: (m.compteurs && typeof m.compteurs === 'object') ? m.compteurs : {}, comptes: (m.comptes && typeof m.comptes === 'object') ? m.comptes : {}, acc, fils, envoi });
    } catch (_) { if (!stop) setD(null); }
  })(); return () => { stop = true; }; }, [tickLbc]);
  React.useEffect(() => {
    const f = (e) => { const x = e && e.detail; if (x && x.type === 'maj' && x.quoi === 'lbc') setTickLbc((t) => t + 1); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, []);
  const cap = extSait('lbcmsg');
  // (31 oct.) Le compte Leboncoin OUVERT mis en avant, les autres estompés (§11).
  const lbcOuvert = useCompteLbcOuvert();
  // (28 oct.) `8442c3e8…` (compteur de messagerie) et `lbc-account:8442c3e8…`
  // (session privée, qui porte le NOM) sont UNE identité (5.212).
  const nu = (id) => String(id || '').replace(/^lbc-account:/, '');
  const accDe = (id) => { if (!d) return {}; const k = nu(id); return { ...(d.acc[k] || {}), ...(d.acc['lbc-account:' + k] || {}) }; };
  const nomDe = (id) => { const c = (d && d.comptes[id]) || {}; const a = accDe(id); return c.name || a.name || 'Compte Leboncoin'; };
  const typeDe = (id) => (((d && d.comptes[id]) || {}).pro || accDe(id).type === 'pro') ? 'pro' : accDe(id).type === 'particulier' ? 'particulier' : '';
  const age = (iso) => { const t = Date.parse(iso || ''); if (!t) return null; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  // (5 nov., chantier G) Le geste principal de l'état « jamais relevé » : le bouton commun (`Bouton`), plus un aplat fait main.
  const ouvrir = <Bouton variante="primaire" href="https://www.leboncoin.fr/messages" target="_blank" rel="noreferrer" data-ouvrir-messages-lbc="" style={{ marginTop: 10 }}>Ouvrir sur Leboncoin ↗</Bouton>;
  if (d === undefined) return <div role="status" data-messages-lbc="charge" style={{ fontSize: 13, color: C.muted, padding: '12px 0' }}>{PAS_SU.enCours}</div>;
  // (5 nov., chantier G, revue 1.10) La panne par `EtatPanne` : la raison, UN « Réessayer » ; le site reste à un lien.
  if (d === null) return <div data-messages-lbc="pas-su"><EtatPanne quoi="Tes messages Leboncoin" raison="Rien n’est perdu : c’est la lecture qui a échoué." onReessayer={() => { setD(undefined); setTickLbc((t) => t + 1); }}/>
    <a href="https://www.leboncoin.fr/messages" target="_blank" rel="noreferrer" data-ouvrir-messages-lbc="" className="vrm-pied-lien" data-pied-lien="ouvrir-lbc">Ouvrir sur Leboncoin ↗</a></div>;
  // UNE ligne par compte : l'identifiant de messagerie et la session privée sont
  // le même compte (jamais deux lignes pour un compte).
  const ids = [...new Set([...Object.keys(d.compteurs), ...Object.keys(d.comptes)].map(nu))];
  const lignes = ids.map((id) => ({ id, nom: nomDe(id), type: typeDe(id), c: d.compteurs[id] || d.compteurs['lbc-account:' + id] || null }));
  const releves = lignes.filter((l) => l.c);
  const pasLus = lignes.filter((l) => !l.c);
  // (11 nov.) Le plus récent en haut par HORODATAGE (avant : comparaison de textes) ; sans date, en bas.
  const fils = Array.isArray(d.fils) ? trierRecents(d.fils, (f) => f && f.da) : [];
  if (!releves.length && !fils.length) {
    return (
      <div data-messages-lbc="jamais" style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Pas encore de messages relevés</div>
        <div style={{ color: C.muted }}>
          {cap === 'ok' ? <>Ouvre <b>leboncoin.fr</b> une fois, connecté : les non-lus arrivent.</>
            : cap === 'retard' ? <>L'extension installée ne relève pas encore les messages : il lui faut la <b>{EXT_CAPACITES.lbcmsg}</b>. Mets-la à jour.</>
            : <>L'extension les relève quand tu passes sur leboncoin.fr.</>}
        </div>
        {ouvrir}
      </div>
    );
  }
  const total = releves.reduce((a, l) => a + (Number(l.c.unread) || 0), 0);
  const filChoisi = fils.find((f) => f.conv === ouvertConv) || null;
  // (1er nov.) La présentation de Messages · Vinted (liste · fil · fiche). Ce que
  // Leboncoin donne ne change pas : un NOMBRE par compte, jamais le texte ni
  // l'annonce d'un message. Le fil le DIT et mène à Leboncoin ; la fiche dit
  // « Pas reliée » (aucune identité ne relie un message à une annonce).
  const choisi = lignes.find((l) => l.id === ouvert) || null;
  const nonLus = (n) => (n > 0 ? `${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}` : 'Aucun message non lu');
  return (
    <div data-messages-lbc={String(total)} data-messagerie-site="leboncoin">
      <div data-messages-lbc-total="" style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>
        {total > 0 ? `${total} message${total > 1 ? 's' : ''} non lu${total > 1 ? 's' : ''}` : 'Aucun message non lu'}
        {pasLus.length ? <span style={{ fontWeight: 400, color: C.muted }}>{` sur ${releves.length > 1 ? `${releves.length} comptes relevés` : 'le compte relevé'}`}</span> : null}
      </div>
      <div className="vrm-message-workspace">
        <div className="vrm-inbox-column">
          {/* Chaque compte NOMMÉ avec SON nombre ; un compte lié jamais relevé dit
              « — » et le geste, jamais « 0 » (« pas su » ≠ « rien »). */}
          <div className="vrm-msg-list">
            {[...releves, ...pasLus].map((l) => {
              const vieux = l.c && Date.now() - Date.parse(l.c.at || 0) > 24 * 3600e3;
              const t = l.c ? Date.parse(l.c.at || '') : NaN;
              const flou = lbcFloute(lbcOuvert, l.id);
              return (
                <div key={l.id} data-compte-lbc={l.id} data-flou={flou ? '1' : '0'} style={flou ? STYLE_FLOU : undefined}>
                  <LigneConv actif={ouvert === l.id} onClick={() => { setOuvertConv(''); setOuvert(l.id); }} ariaLabel={`${l.nom} : ${l.c ? nonLus(Number(l.c.unread) || 0) : 'pas encore lu'}`}
                    nom={l.nom} compte={l.type} quand={isFinite(t) ? t : null} couleurHeure={C.muted}
                    extrait={l.c ? nonLus(Number(l.c.unread) || 0) : '—'} couleurExtrait={l.c && l.c.unread > 0 ? C.text : C.muted}
                    apres={vieux ? <span className="vrm-msg-etat" title="Ouvre leboncoin.fr sur ce compte pour le mettre à jour" style={{ color: C.muted, borderColor: C.border }}>à relire</span> : null}
                    point={l.c && l.c.unread > 0 ? C.accent : null}/>
                </div>
              );
            })}
          </div>
          {/* Un compte « pas encore lu » : le geste est dit UNE fois, sous la liste
              (§7) — pas sur chaque ligne. */}
          {pasLus.length ? <div data-messages-lbc-geste="" style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{pasLus.length > 1 ? `${pasLus.length} comptes n'ont pas encore été lus` : `${pasLus[0].nom} n'a pas encore été lu`} : connecte-toi une fois {pasLus.length > 1 ? 'à chacun' : 'à ce compte'} sur leboncoin.fr, avec l'extension.</div> : null}
          {/* (3 nov., 5.318) Les conversations LUES par l'extension : texte, date, « de toi ». */}
          {fils.length ? <CompteurArnaque n={fils.filter((f) => motifDeLApercu(f.ap, deMoiMeta(f.dm))).length} style={{ marginTop: 10 }}/> : null}
          {fils.length ? (
            <div className="vrm-msg-list" data-lbc-convs={fils.length} style={{ marginTop: 10 }}>
              {fils.slice(0, 40).map((f) => {
                const t = Date.parse(f.da || ''); const flou = lbcFloute(lbcOuvert, f.compte);
                return (
                  <div key={f.conv} data-lbc-conv={f.conv} data-flou={flou ? '1' : '0'} style={flou && ouvertConv !== f.conv ? STYLE_FLOU : undefined}>
                    <LigneConv actif={ouvertConv === f.conv} onClick={() => { setOuvert(''); setOuvertConv(f.conv); }} ariaLabel={`Ouvrir la conversation Leboncoin de ${nomDe(f.compte)}`}
                      nom={nomDe(f.compte)} compte={typeDe(f.compte)} quand={isFinite(t) ? t : null} couleurHeure={C.muted}
                      extrait={f.ap || ''} toi={!!f.ap && f.dm === 'true'} couleurExtrait={C.muted} apres={<PastilleArnaque motif={motifDeLApercu(f.ap, deMoiMeta(f.dm))}/>}/>
                  </div>
                );
              })}
            </div>
          ) : null}
          {/* Sous la liste, le lien reste discret : le geste « Répondre sur Leboncoin » est dans le fil (§7, l'accent est rare). */}
          <a href="https://www.leboncoin.fr/messages" target="_blank" rel="noreferrer" data-ouvrir-messages-lbc="" className="vrm-pied-lien" data-pied-lien="ouvrir-lbc" style={{ marginTop: 6 }}>Ouvrir sur Leboncoin ↗</a>
        </div>
        <div className="vrm-chat-column">{filChoisi ? (
          <FilLeboncoin key={filChoisi.conv} conv={filChoisi.conv} nom={nomDe(filChoisi.compte)} envoi={d.envoi} onFerme={() => setOuvertConv('')}/>
        ) : choisi ? (
          <CadreFil etiquette="Messages Leboncoin" onFermer={() => setOuvert('')} attrs={{ 'data-lbc-fil': choisi.id }}>
            <TeteFil onFermer={() => setOuvert('')} nom={choisi.nom} titre={choisi.type ? 'compte ' + choisi.type : ''} compte="Leboncoin"/>
            <div className="vrm-chat-history" style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div data-lbc-fil-texte="absent" style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, textAlign: 'center', padding: '24px 8px' }}>
                {/* Le nombre est sur la ligne du compte (une fois, §7) : ici, seulement ce que VRM ne sait pas. */}
                {choisi.c ? 'Leboncoin donne le nombre de non-lus, jamais le texte : réponds là-bas.'
                  : 'Pas encore lu. Leboncoin donne le nombre, jamais le texte.'}
              </div>
            </div>
            <PiedSansEnvoi raison="Pour lire et répondre, ouvre ta messagerie Leboncoin." lien="https://www.leboncoin.fr/messages" texteLien="Répondre sur Leboncoin ↗"/>
          </CadreFil>
        ) : <div className="vrm-chat-empty"><Icon name="chat" size={28}/><span>{fils.length ? 'Choisis une conversation' : 'Choisis un compte'}</span></div>}</div>
        <FicheConvVolet site="leboncoin" etat={choisi || filChoisi ? 'non-reliee' : 'aucune'} raison={`Leboncoin ne dit pas à VRM de quelle annonce parle un message : VRM ne devine pas ${motsVendeur().le}.`}/>
      </div>
    </div>
  );
}
// ── ♡ FAVORIS REÇUS SUR LEBONCOIN (29 oct.) — des NOMBRES, jamais QUI ──────
// Seulement SES annonces encore en vente (la règle de l'écran Leboncoin :
// `annonceLbcALui`, `annonceLbcEnVente`, §11), triées par nombre de favoris.
// Le nombre vient de la page « Statistiques » de l'annonce, lue par l'extension
// quand il l'ouvre (`stats.favoris`, total du dernier jour lu) ; sans lui :
// « — » et le geste, jamais 0.
function FavorisLeboncoin() {
  const [d, setD] = useState(undefined);
  const [relu, setRelu] = useState(0);   // (5 nov., chantier G) « Réessayer » relit
  const capStats = extSait('lbcstats');
  // (31 oct.) Le compte Leboncoin OUVERT mis en avant, les autres estompés (§11).
  const lbcOuvert = useCompteLbcOuvert();
  useEffect(() => { let stop = false; (async () => {
    try {
      const [l, jv, ja] = await Promise.all([
        lbcListingsSession(),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_ventes&select=v:data->ventes`),
        lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=a:data->accounts`),
      ]);
      if (!l || !Array.isArray(jv) || !Array.isArray(ja)) { if (!stop) setD(null); return; }
      if (!stop) setD({ items: l.items || {}, ventes: (jv[0] && jv[0].v) || {}, acc: (ja[0] && ja[0].a) || {} });
    } catch (_) { if (!stop) setD(null); }
  })(); return () => { stop = true; }; }, [relu]);
  if (d === undefined) return <div role="status" data-favoris-lbc="charge" style={{ fontSize: 13, color: C.muted, padding: '12px 0' }}>{PAS_SU.enCours}</div>;
  if (d === null) return <EtatPanne data-favoris-lbc="pas-su" quoi="Tes favoris Leboncoin" raison="Tes annonces n’ont pas pu être lues. Rien n’est perdu : c’est la lecture qui a échoué." onReessayer={() => { setD(undefined); setRelu((n) => n + 1); }}/>;
  const prouves = new Set([...comptesLbcProuves(d.ventes, d.items), ...comptesLbcSession(d.acc)]);
  const vendues = annoncesLbcVendues(d.ventes);
  const ads = Object.values(d.items).filter((ad) => ad && ad.id != null && annonceLbcALui(ad, prouves) && annonceLbcEnVente(ad, vendues));
  const fav = (ad) => (ad.stats && Number.isFinite(ad.stats.favoris) ? ad.stats.favoris : null);
  ads.sort((a, b) => ((fav(b) == null ? -1 : fav(b)) - (fav(a) == null ? -1 : fav(a))) || String(a.subject || '').localeCompare(String(b.subject || ''), 'fr'));
  const connus = ads.filter((a) => fav(a) != null);
  const total = connus.reduce((s, a) => s + fav(a), 0);
  return (
    <div data-favoris-lbc={ads.length ? String(connus.length) : 'aucune'}>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>
        <span data-favoris-lbc-qui="jamais">Leboncoin donne le <b>nombre</b> de favoris, jamais <b>qui</b> : VRM n'écrit à personne.</span>{' '}
        {capStats === 'ok' ? <>Ouvre les <b>statistiques</b> de l'annonce sur Leboncoin : le chiffre suit.</>
          : capStats === 'retard' ? <>Pour relever ce chiffre, il faut l'extension <b>{EXT_CAPACITES.lbcstats}</b> : mets-la à jour depuis Paramètres → État des connexions, puis ouvre les <b>statistiques</b> de l'annonce sur Leboncoin.</>
          : <>C'est l'extension, là où elle est installée, qui relève ce chiffre quand tu ouvres les <b>statistiques</b> d'une annonce sur Leboncoin.</>}
      </div>
      {!ads.length ? (
        <div data-favoris-lbc-vide="" style={{ fontSize: 13, color: C.muted }}>Aucune annonce Leboncoin en vente à toi pour l'instant.</div>
      ) : (<>
        <div data-favoris-lbc-total="" style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {connus.length ? `${total} favori${total > 1 ? 's' : ''}` : 'Pas encore de chiffre relevé'}
          <span style={{ fontWeight: 400, color: C.muted }}>{connus.length ? ` sur ${connus.length} annonce${connus.length > 1 ? 's' : ''} relevée${connus.length > 1 ? 's' : ''} (${ads.length} en vente)` : ` — ${ads.length} annonce${ads.length > 1 ? 's' : ''} en vente`}</span>
        </div>
        {ads.map((ad) => {
          const f = fav(ad), st = ad.stats || {};
          const lien = /^https:\/\/(?:www\.)?leboncoin\.fr\//i.test(String(ad.url || '')) ? ad.url : '';
          const ph = Array.isArray(ad.images) && ad.images[0];
          return (
            <div key={ad.id} data-favoris-lbc-annonce={ad.id} data-favoris={f == null ? 'passu' : String(f)} data-flou={lbcFloute(lbcOuvert, ad.account || ad.lbcUser) ? '1' : '0'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.border}`, ...(lbcFloute(lbcOuvert, ad.account || ad.lbcUser) ? STYLE_FLOU : null) }}>
              <div style={{ width: 36, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: C.card2 || C.border }}>{ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.subject || 'Annonce'}</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {f != null ? [
                    Number.isFinite(st.vues) ? `${st.vues} vue${st.vues > 1 ? 's' : ''}` : '',
                    Number.isFinite(st.messages) ? `${st.messages} message${st.messages > 1 ? 's' : ''}` : '',
                    // (29 oct., revue) Sans date de fin du relevé (`au`), l'heure où
                    // l'extension l'a pris (`at`) ; sans l'une ni l'autre, rien.
                    st.au ? `relevé le ${new Date(st.au + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : isFinite(Date.parse(st.at || '')) ? `relevé il y a ${ilYaBr(Date.parse(st.at))}` : '',
                  ].filter(Boolean).join(' · ') : 'pas encore relevé'}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: f ? C.text : C.muted, fontVariantNumeric: 'tabular-nums' }}>{f == null ? '—' : f}</span>
                <span aria-label="favoris" style={{ color: C.muted, display: 'inline-flex', verticalAlign: '-2px', marginLeft: 4 }}><Icon name="heart" size={13}/></span>
              </div>
              {lien ? <a href={lien} target="_blank" rel="noreferrer" aria-label={`Ouvrir l'annonce sur Leboncoin : ${ad.subject || ad.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, color: C.muted, textDecoration: 'none', flexShrink: 0 }}>↗</a> : null}
            </div>
          );
        })}
      </>)}
    </div>
  );
}
export { MessagesLeboncoin, FilLeboncoin };
