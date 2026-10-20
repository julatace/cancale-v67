// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « COMMUNAUTÉ » — la carte des revendeurs VRM (migration 018)
//  Demande de Julien (20 octobre) : une carte où chacun peut mettre son
//  emplacement, pour échanger avec ceux de sa ville. Ce que l'écran garantit,
//  et ce que la BASE garantit derrière lui (supabase/migrations/018-communaute.sql) :
//   • opt-in : invisible tant qu'on n'a pas choisi sa ville ; « Me retirer »
//     supprime la ligne, en un geste ;
//   • jamais une position exacte : une VILLE choisie par la personne, arrondie
//     à ~5 km ; « me localiser » PROPOSE la ville la plus proche, on confirme ;
//   • des autres : un pseudo, une ville — jamais un email ni un compte Vinted ;
//   • messages entre personnes visibles, texte brut (React l'échappe : aucun
//     lien n'est rendu), Bloquer et Signaler dans chaque fil ;
//   • trois états partout : chargement · pas su · lu — et « pas encore activée
//     sur ta base » tant que la 018 n'est pas appliquée (jamais « personne »).
//  Migration 019 : un pseudo DISCORD facultatif sur sa présence (montré aux
//  membres visibles), et un CLASSEMENT opt-in (jour · semaine · mois · année)
//  du NOMBRE de ventes Vinted — compté par la base, jamais un montant.
//  Migration 020 : des GROUPES à code (un accompagnement) — la carte et le
//  classement peuvent n'afficher que les membres d'un groupe.
//  La carte : Leaflet 1.9.4 depuis cdnjs, chargé à l'ouverture de l'écran
//  (jamais au démarrage), fond OpenStreetMap / CARTO avec leur attribution.
//  Injoignable ⇒ la même communauté en liste.
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cellules, resume, grouperParPixels, COUCOU, quandCourt, distanceKm, RAYON_PRES_KM } from './regles.js';
import './communaute.css';

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
let promesseLeaflet = null;
function chargerLeaflet() {
  if (typeof window !== 'undefined' && window.L && window.L.map) return Promise.resolve(window.L);
  if (promesseLeaflet) return promesseLeaflet;
  promesseLeaflet = new Promise((ok, ko) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET_CSS; l.crossOrigin = ''; document.head.appendChild(l);
    }
    const s = document.createElement('script'); s.src = LEAFLET_JS; s.async = true; s.crossOrigin = '';
    const t = setTimeout(() => { promesseLeaflet = null; ko(new Error('délai')); }, 15000);
    s.onload = () => { clearTimeout(t); if (window.L && window.L.map) ok(window.L); else { promesseLeaflet = null; ko(new Error('vide')); } };
    s.onerror = () => { clearTimeout(t); promesseLeaflet = null; ko(new Error('réseau')); };
    document.head.appendChild(s);
  });
  return promesseLeaflet;
}

const ENDPOINT = '/api/compte?mode=communaute';
const PAS_SU = "Je n'ai pas pu lire la carte — rien n'est perdu, c'est la lecture qui a échoué.";

function useApi(headers) {
  return useCallback(async (corps) => {
    try {
      const r = await fetch(ENDPOINT, corps
        ? { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }
        : { headers: headers(), cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!j || typeof j !== 'object') return { ok: false, erreur: 'pas-su', message: PAS_SU };
      return { ...j, status: r.status };
    } catch (_) { return { ok: false, erreur: 'pas-su', message: PAS_SU }; }
  }, [headers]);
}

// ── LA CARTE (Leaflet) ───────────────────────────────────────────────────────
function Carte({ cells, moi, sombre, onCellules, onEchec }) {
  const boite = useRef(null), carte = useRef(null), calque = useRef(null), fond = useRef(null);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    let vivant = true;
    chargerLeaflet().then((L) => {
      if (!vivant || !boite.current || carte.current) return;
      const m = L.map(boite.current, { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 12 });
      carte.current = m;
      calque.current = L.layerGroup().addTo(m);
      if (moi) m.setView([Number(moi.lat), Number(moi.lon)], 9);
      else m.setView([46.6, 2.4], 5);
      setPret(true);
    }).catch(() => { if (vivant) onEchec(); });
    return () => { vivant = false; if (carte.current) { carte.current.remove(); carte.current = null; } };
  }, []);
  // Le fond suit le thème (clair / sombre), avec l'attribution exigée.
  useEffect(() => {
    if (!pret) return;
    const L = window.L, m = carte.current;
    if (fond.current) m.removeLayer(fond.current);
    fond.current = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${sombre ? 'dark_all' : 'voyager'}/{z}/{x}/{y}{r}.png`, {
      subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    }).addTo(m);
  }, [pret, sombre]);
  // Les épingles : regroupées au zoom courant (le nombre de personnes dedans).
  useEffect(() => {
    if (!pret) return;
    const L = window.L, m = carte.current;
    const dessiner = () => {
      calque.current.clearLayers();
      const groupes = grouperParPixels(cells, (c) => m.project([c.lat, c.lon], m.getZoom()));
      for (const g of groupes) {
        const cls = 'vrm-cm-pin' + (g.moi ? ' moi' : '') + (g.pres ? ' pres' : '') + (g.cells.length > 1 ? ' groupe' : '');
        // Seul un NOMBRE entre dans le HTML de l'épingle : jamais un texte saisi.
        const icone = L.divIcon({ className: '', html: `<button type="button" class="${cls}" data-cm-pin="${g.n}" aria-label="${g.n} revendeur${g.n > 1 ? 's' : ''}">${g.n}</button>`, iconSize: [44, 44], iconAnchor: [22, 22] });
        const mk = L.marker([g.lat, g.lon], { icon: icone, keyboard: false });
        mk.addTo(calque.current);
        // Un vrai bouton, écouté directement : au doigt comme à la souris (et
        // au clavier), sans dépendre de la détection de « clic » de la carte.
        const bouton = mk.getElement() && mk.getElement().querySelector('button');
        if (bouton) {
          L.DomEvent.disableClickPropagation(bouton);
          bouton.addEventListener('click', (e) => {
            e.preventDefault();
            if (g.cells.length > 1 && m.getZoom() < 11) m.flyToBounds(L.latLngBounds(g.cells.map((c) => [c.lat, c.lon])).pad(0.6), { duration: 0.6, maxZoom: 11 });
            else onCellules(g.cells);
          });
        }
      }
    };
    dessiner();
    m.on('zoomend', dessiner);
    return () => { m.off('zoomend', dessiner); };
  }, [pret, cells]);
  useEffect(() => {
    if (pret && moi) carte.current.flyTo([Number(moi.lat), Number(moi.lon)], Math.max(carte.current.getZoom(), 8), { duration: 0.6 });
  }, [pret, moi && moi.lat, moi && moi.lon]);
  return <div className="vrm-cm-carte" data-cm-carte={pret ? 'prete' : 'charge'} role="region" aria-label="Carte de la communauté">
    <div className="vrm-cm-carte-fond" ref={boite} />
    {!pret && <p className="vrm-cm-carte-attente">Chargement de la carte…</p>}
  </div>;
}

// ── REJOINDRE / CHANGER DE VILLE ─────────────────────────────────────────────
function Rejoindre({ api, moi, prenom, onFait, onAnnuler, FermeAuRetour }) {
  const [pseudo, setPseudo] = useState(moi ? moi.pseudo : (prenom || 'Revendeur'));
  const [q, setQ] = useState(moi ? moi.ville : '');
  const [villes, setVilles] = useState(null), [choix, setChoix] = useState(null);
  const [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const chercher = async (e) => {
    e && e.preventDefault(); setMsg(''); setChoix(null);
    if (q.trim().length < 2) { setMsg('Tape au moins deux lettres du nom de ta ville.'); return; }
    setOccupe(true); const r = await api({ action: 'ville', q }); setOccupe(false);
    if (!r.ok) { setVilles(null); setMsg(r.message || PAS_SU); return; }
    setVilles(r.villes); if (!r.villes.length) setMsg('Aucune ville trouvée sous ce nom. Essaie l’orthographe exacte.');
  };
  const localiser = () => {
    setMsg('');
    if (!navigator.geolocation) { setMsg('Ce navigateur ne sait pas te localiser : tape le nom de ta ville.'); return; }
    setOccupe(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      // La position ne sert qu'à PROPOSER une ville ; elle n'est jamais enregistrée.
      const r = await api({ action: 'ville', lat: p.coords.latitude, lon: p.coords.longitude });
      setOccupe(false);
      if (!r.ok || !r.villes.length) { setMsg(r.message || 'Je ne trouve pas de ville ici : tape son nom.'); return; }
      setVilles(r.villes); setChoix(r.villes[0]); setQ(r.villes[0].nom);
    }, () => { setOccupe(false); setMsg('Localisation refusée ou indisponible : tape le nom de ta ville.'); }, { timeout: 10000, maximumAge: 600000 });
  };
  const valider = async () => {
    if (!choix) { setMsg('Choisis ta ville dans la liste.'); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'rejoindre', pseudo, ville: choix.nom, pays: choix.pays, lat: choix.lat, lon: choix.lon });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait();
  };
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget && !occupe) onAnnuler(); }}>
    <FermeAuRetour fermer={onAnnuler} />
    <div className="vrm-cm-feuille" role="dialog" aria-modal="true" aria-label="Apparaître sur la carte" data-cm-rejoindre>
      <div className="vrm-cm-feuille-tete"><h3>{moi ? 'Changer ma présence' : 'Apparaître sur la carte'}</h3><button type="button" className="vrm-cm-x" onClick={onAnnuler} aria-label="Fermer">×</button></div>
      <p className="vrm-cm-note">Les autres verront <b>ton pseudo et ta ville</b>, placée à environ 5 km près. Jamais ton adresse, ton email ni tes comptes Vinted. Tu peux te retirer quand tu veux.</p>
      <label className="vrm-cm-champ"><span>Ton pseudo</span>
        <input value={pseudo} maxLength={30} onChange={(e) => setPseudo(e.target.value)} placeholder="Revendeur" data-cm-pseudo /></label>
      <form className="vrm-cm-ville" onSubmit={chercher}>
        <label className="vrm-cm-champ"><span>Ta ville</span>
          <input value={q} maxLength={80} onChange={(e) => { setQ(e.target.value); setChoix(null); }} placeholder="Cancale, Lyon, Bruxelles…" data-cm-ville-q /></label>
        <div className="vrm-cm-ligne-boutons">
          <button type="submit" disabled={occupe} data-cm-chercher>Chercher</button>
          <button type="button" onClick={localiser} disabled={occupe} data-cm-localiser>Me localiser</button>
        </div>
      </form>
      {villes && villes.length > 0 && <ul className="vrm-cm-villes" role="listbox" aria-label="Villes trouvées">
        {villes.map((v, i) => { const pris = choix && choix.nom === v.nom && choix.lat === v.lat && choix.lon === v.lon;
          return <li key={i}><button type="button" role="option" aria-selected={!!pris} className={pris ? 'pris' : ''} onClick={() => setChoix(v)} data-cm-ville-choix={v.nom}>
            <b>{v.nom}</b><span>{[v.region, v.pays].filter(Boolean).join(' · ')}</span></button></li>; })}
      </ul>}
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="button" className="vrm-cm-primaire" disabled={occupe || !choix} onClick={valider} data-cm-valider>
        {occupe ? 'Un instant…' : choix ? `Apparaître à ${choix.nom}` : 'Choisis ta ville'}</button>
    </div>
  </div>;
}

// ── UN FIL DE CONVERSATION ───────────────────────────────────────────────────
function Fil({ api, conv, entete, onFerme, onChange, FermeAuRetour }) {
  const [fil, setFil] = useState(undefined), [texte, setTexte] = useState(''), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const bas = useRef(null);
  const lire = useCallback(async () => {
    const r = await api({ action: 'fil', conv });
    if (r.ok) { setFil(r.fil); onChange(); } else setFil((f) => (f === undefined ? null : f));
    if (!r.ok) setMsg(r.message || PAS_SU);
  }, [api, conv]);
  useEffect(() => { lire(); const id = setInterval(() => { if (document.visibilityState === 'visible') lire(); }, 15000); return () => clearInterval(id); }, [lire]);
  useEffect(() => { if (bas.current) bas.current.scrollTop = bas.current.scrollHeight; }, [fil && fil.messages && fil.messages.length]);
  const autre = fil && fil.autre;
  const envoyer = async (t) => {
    const x = String(t || '').trim(); if (!x) return;
    if (!autre) { setMsg("Cette personne n'est plus sur la carte : la conversation est en lecture seule."); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'ecrire', pid: autre.pid, texte: x });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    setTexte(''); lire();
  };
  const bloquer = async (oui) => {
    if (oui && !window.confirm('Bloquer cette personne ? Tu ne recevras plus ses messages (elle ne le saura pas) et elle disparaîtra de ta carte.')) return;
    const r = await api({ action: 'bloquer', conv, oui });
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    lire();
  };
  const signaler = async () => {
    const raison = window.prompt('Pourquoi signales-tu cette personne ? (facultatif — le propriétaire de VRM lira ton signalement et ses derniers messages)', '');
    if (raison === null) return;
    const r = await api({ action: 'signaler', conv, raison });
    setMsg(r.ok ? 'Signalement envoyé. Merci : il sera lu par le propriétaire de VRM.' : (r.message || PAS_SU));
  };
  const titre = autre ? autre.pseudo : (entete && entete.pseudo) || 'Ancien membre de la carte';
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille vrm-cm-fil" role="dialog" aria-modal="true" aria-label={'Conversation avec ' + titre} data-cm-fil={conv}>
      <div className="vrm-cm-feuille-tete"><h3>{titre}{autre && autre.ville ? <small> · {autre.ville}</small> : null}</h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label="Fermer">×</button></div>
      {fil === undefined ? <p role="status">Lecture de la conversation…</p> : fil === null ? <p className="vrm-cm-msg">{msg || PAS_SU} <button type="button" onClick={lire}>Réessayer</button></p> : <>
        <div className="vrm-cm-bulles" ref={bas} data-cm-messages={fil.messages.length}>
          {fil.messages.length === 0 && <p className="vrm-cm-note">Aucun message pour l’instant.</p>}
          {fil.messages.map((m) => <div key={m.id} className={'vrm-cm-bulle' + (m.moi ? ' moi' : '')} data-cm-bulle={m.moi ? 'moi' : 'autre'}>
            <span className="vrm-cm-bulle-texte">{m.texte}</span><time>{quandCourt(m.le)}</time></div>)}
        </div>
        {fil.bloque ? <p className="vrm-cm-note" data-cm-bloque>Tu as bloqué cette personne : ses messages ne t’arrivent plus. <button type="button" className="vrm-cm-lien" onClick={() => bloquer(false)}>Débloquer</button></p>
          : !autre ? <p className="vrm-cm-note">Cette personne n’est plus sur la carte : la conversation est en lecture seule.</p>
          : <form className="vrm-cm-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(texte); }}>
            <textarea value={texte} maxLength={500} rows={2} onChange={(e) => setTexte(e.target.value)} placeholder="Ton message (500 caractères au plus)" aria-label="Ton message" data-cm-texte />
            <button type="submit" className="vrm-cm-primaire" disabled={occupe || !texte.trim()} data-cm-envoyer>{occupe ? '…' : 'Envoyer'}</button>
          </form>}
        {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
        <div className="vrm-cm-moderation">
          {!fil.bloque && <button type="button" className="vrm-cm-lien" onClick={() => bloquer(true)} data-cm-bloquer>Bloquer</button>}
          <button type="button" className="vrm-cm-lien" onClick={signaler} data-cm-signaler>Signaler</button>
        </div>
      </>}
    </div>
  </div>;
}

// ── LES PERSONNES D'UN ENDROIT ───────────────────────────────────────────────
function Personnes({ cells, moi, onEcrire, onCoucou, onFerme, envoye, FermeAuRetour }) {
  const personnes = cells.flatMap((c) => c.personnes);
  const villes = [...new Set(personnes.map((p) => p.ville))];
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille" role="dialog" aria-modal="true" aria-label={'Revendeurs à ' + villes.join(', ')} data-cm-personnes={personnes.length}>
      <div className="vrm-cm-feuille-tete"><h3>{villes.join(' · ')}</h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label="Fermer">×</button></div>
      <p className="vrm-cm-note">{personnes.length} revendeur{personnes.length > 1 ? 's' : ''} ici.</p>
      <ul className="vrm-cm-liste">{personnes.map((p) => <li key={p.pid} data-cm-personne={p.pid}>
        <div><b>{p.pseudo}</b>{p.moi && <span className="vrm-cm-badge"> toi</span>}{p.premier && <span className="vrm-cm-badge" data-cm-premier> 🥇 premier de {p.ville}</span>}<small>{p.ville}</small>
          {p.discord && <DiscordDe pseudo={p.discord} />}</div>
        {!p.moi && <div className="vrm-cm-ligne-boutons">
          {moi ? <>
            <button type="button" onClick={() => onCoucou(p)} disabled={envoye.has(p.pid)} data-cm-coucou={p.pid}>{envoye.has(p.pid) ? 'Coucou envoyé ✓' : '👋 Coucou'}</button>
            <button type="button" className="vrm-cm-primaire" onClick={() => onEcrire(p)} data-cm-ecrire={p.pid}>Écrire</button>
          </> : <small className="vrm-cm-note">Mets-toi sur la carte pour lui écrire.</small>}
        </div>}
      </li>)}</ul>
    </div>
  </div>;
}

// ── L'ÉCRAN ──────────────────────────────────────────────────────────────────
export default function Communaute({ headers, sombre = false, prenom = '', FermeAuRetour }) {
  const api = useApi(headers);
  const [etat, setEtat] = useState('charge');          // charge · pas-su · non-installe · abonnement · lu
  const [msgEtat, setMsgEtat] = useState('');
  const [carte, setCarte] = useState(null), [convs, setConvs] = useState([]);
  const [rejoindre, setRejoindre] = useState(false), [cellsOuvertes, setCellsOuvertes] = useState(null);
  const [filOuvert, setFilOuvert] = useState(null), [enListe, setEnListe] = useState(false);
  const [envoye, setEnvoye] = useState(() => new Set()), [toast, setToast] = useState('');
  const [vue, setVue] = useState('carte');            // carte · classement
  const [groupeId, setGroupeId] = useState(null);     // null = tous les membres
  const vivant = useRef(true);
  const lire = useCallback(async (discret) => {
    if (!discret) setEtat((e) => (e === 'lu' ? e : 'charge'));
    const r = await api();
    if (!vivant.current) return;
    if (r.ok && r.carte && Array.isArray(r.carte.profils)) { setCarte(r.carte); setConvs(Array.isArray(r.conversations) ? r.conversations : []); setEtat('lu'); return; }
    const e = r.erreur === 'non-installe' ? 'non-installe' : r.erreur === 'abonnement' ? 'abonnement' : 'pas-su';
    // Une relecture discrète ratée garde ce qu'on montrait (« pas su » ne vaut pas « personne »).
    if (discret && carte) { setMsgEtat(r.message || PAS_SU); return; }
    setEtat(e); setMsgEtat(r.message || PAS_SU);
  }, [api, carte]);
  useEffect(() => { vivant.current = true; lire(); return () => { vivant.current = false; }; }, []);
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === 'visible' && !filOuvert) lire(true); }, 30000); return () => clearInterval(id); }, [lire, filOuvert]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  const moi = carte && carte.moi;
  const groupes = carte && Array.isArray(carte.groupes) ? carte.groupes : null;   // null : la 020 n'est pas installée
  const groupe = (groupes && groupeId && groupes.find((g) => g.id === groupeId)) || null;
  useEffect(() => { if (groupeId && groupes && !groupe) setGroupeId(null); }, [groupeId, groupes, groupe]);
  const tousProfils = (carte && carte.profils) || [];
  const profils = useMemo(() => (groupe ? tousProfils.filter((p) => p.moi || groupe.membres.includes(p.pid)) : tousProfils), [carte, groupe]);
  const cells = useMemo(() => cellules(profils, moi), [profils]);
  const r = useMemo(() => resume(profils, moi), [profils]);
  const nonLus = convs.reduce((s, c) => s + (Number(c.nonLus) || 0), 0);
  const pres = useMemo(() => (moi ? profils.filter((p) => !p.moi && distanceKm({ lat: +moi.lat, lon: +moi.lon }, { lat: +p.lat, lon: +p.lon }) <= RAYON_PRES_KM) : []), [profils]);

  const quitter = async () => {
    const x = await api({ action: 'quitter' });
    if (!x.ok) { setToast(x.message || PAS_SU); return; }
    setToast('Tu n’es plus sur la carte.'); lire(true);
  };
  const ecrireA = async (p, texte) => {
    const x = await api({ action: 'ecrire', pid: p.pid, texte });
    if (!x.ok) { setToast(x.message || PAS_SU); return null; }
    lire(true); return x.conv;
  };
  const coucou = async (p) => { const c = await ecrireA(p, COUCOU(moi && moi.ville)); if (c) { setEnvoye((s) => new Set(s).add(p.pid)); setToast('Coucou envoyé à ' + p.pseudo + ' 👋'); } };
  const ouvrirEcrire = (p) => {
    const c = convs.find((x) => x.pid === p.pid);
    setCellsOuvertes(null);
    if (c) { setFilOuvert({ conv: c.conv, entete: c }); return; }
    setFilOuvert({ nouveau: p });
  };

  // Les feuilles et le toast vivent sur <body> : l'écran est dans une coque
  // zoomée / empilée, où un `position:fixed` resterait sous la barre du bas.
  const portail = (x) => createPortal(<div className="vrm-communaute vrm-cm-portail" data-dark={sombre ? 'true' : 'false'}>{x}</div>, document.body);
  const entete = <header className="vrm-cm-entete"><div><h2>La carte des revendeurs</h2>
    <p>Trouve les revendeurs VRM de ta ville et échange avec eux.</p></div></header>;

  if (etat === 'charge') return <section className="vrm-communaute" data-dark={sombre ? 'true' : 'false'} data-communaute-etat="charge">{entete}<p role="status" className="vrm-cm-note">Lecture de la carte…</p></section>;
  if (etat !== 'lu') return <section className="vrm-communaute" data-dark={sombre ? 'true' : 'false'} data-communaute-etat={etat}>{entete}
    <div className="vrm-cm-carton">
      {etat === 'non-installe' ? <><b>La carte de la communauté n’est pas encore activée sur ta base.</b><p>Elle s’ouvrira dès que la mise à jour de la base sera faite. Rien n’est perdu, rien n’est partagé d’ici là.</p></>
        : etat === 'abonnement' ? <><b>Ton abonnement n’est pas actif.</b><p>La carte de la communauté est réservée aux abonnés : tu n’es pas montré aux autres tant qu’il n’est pas réglé.</p></>
        : <><b>{PAS_SU}</b><p>Ce n’est pas que personne n’est sur la carte : je n’ai simplement pas pu la lire.</p><button type="button" onClick={() => lire()} data-cm-reessayer>Réessayer</button></>}
    </div></section>;

  const onglets = <div className="vrm-cm-onglets" role="group" aria-label="Communauté">
    {[['carte', 'Carte'], ['classement', 'Classement']].map(([k, t]) => <button key={k} type="button" className="vrm-cm-onglet" aria-pressed={vue === k} onClick={() => setVue(k)} data-cm-vue={k}>{t}</button>)}
  </div>;
  const blocGroupes = groupes && <Groupes api={api} moi={moi} groupes={groupes} actif={groupe} onChoisir={setGroupeId}
    onFait={async (t, id) => { setToast(t); await lire(true); if (id !== undefined) setGroupeId(id); }} />;
  if (vue === 'classement') return <section className="vrm-communaute" data-dark={sombre ? 'true' : 'false'} data-communaute-etat="lu" data-cm-vue-active="classement">
    {entete}{onglets}{blocGroupes}
    <Classement key={groupe ? groupe.id : 'tous'} api={api} moi={moi} groupe={groupe} />
    {toast && portail(<div className="vrm-cm-toast" role="status" data-cm-toast>{toast}</div>)}
  </section>;

  return <section className="vrm-communaute" data-dark={sombre ? 'true' : 'false'} data-communaute-etat="lu" data-cm-total={r.total} data-cm-vue-active="carte">
    {entete}{onglets}{blocGroupes}
    {msgEtat && etat === 'lu' && <p className="vrm-cm-note" role="status">{msgEtat}</p>}

    {/* Ma présence : l'opt-in, toujours visible */}
    <div className="vrm-cm-carton vrm-cm-moi" data-cm-moi={moi ? 'visible' : 'invisible'}>
      {moi ? <>
        <div><b>Tu es sur la carte à {moi.ville}</b><span> sous le pseudo « {moi.pseudo} »{r.premier ? ' · 🥇 premier de ta ville sur VRM' : ''}</span></div>
        <div className="vrm-cm-ligne-boutons">
          <button type="button" onClick={() => setRejoindre(true)} data-cm-changer>Changer</button>
          <button type="button" onClick={quitter} data-cm-quitter>Me retirer de la carte</button>
        </div>
        {'discord' in moi && <MonDiscord api={api} actuel={moi.discord || ''} onFait={(t) => { setToast(t); lire(true); }} />}
      </> : <>
        <div><b>Tu n’es pas sur la carte.</b><span> Personne ne te voit tant que tu ne l’as pas décidé.</span></div>
        <button type="button" className="vrm-cm-primaire" onClick={() => setRejoindre(true)} data-cm-apparaitre>Apparaître sur la carte</button>
      </>}
    </div>

    {/* Ce qui se passe : uniquement ce qui est lu */}
    {r.autres === 0 ? (groupe ? <div className="vrm-cm-carton vrm-cm-vide" data-cm-vide="groupe">
      <b>Personne d’autre que toi dans « {groupe.nom} » pour l’instant.</b>
      <p>Donne le code <b>{codeLisible(groupe.code)}</b> aux membres de ton accompagnement : ils apparaîtront ici dès qu’ils l’auront tapé.</p>
    </div> : <div className="vrm-cm-carton vrm-cm-vide" data-cm-vide>
      <b>{moi ? 'Personne d’autre que toi sur la carte pour l’instant.' : 'Personne n’est encore sur la carte.'}</b>
      <p>{moi ? 'Dès qu’un autre revendeur VRM y mettra sa ville, il apparaîtra ici — et vous pourrez vous écrire.' : 'Sois le premier : mets ta ville, les prochains revendeurs te trouveront.'}</p>
    </div>) : <ul className="vrm-cm-chiffres" aria-label="La communauté en chiffres">
      <li data-cm-chiffre="total"><b>{r.total}</b> {groupe ? `membre${r.total > 1 ? 's' : ''} dans « ${groupe.nom} »` : `revendeur${r.total > 1 ? 's' : ''} sur la carte`}</li>
      <li data-cm-chiffre="villes"><b>{r.villes}</b> ville{r.villes > 1 ? 's' : ''}</li>
      {moi && <li data-cm-chiffre="ville"><b>{r.dansMaVille}</b> autre{r.dansMaVille > 1 ? 's' : ''} à {moi.ville}</li>}
      {moi && <li data-cm-chiffre="pres"><b>{r.pres}</b> à moins de {RAYON_PRES_KM} km</li>}
    </ul>}

    {enListe ? <div className="vrm-cm-carton" data-cm-liste-secours>
      <p className="vrm-cm-note">La carte n’a pas pu se charger (réseau). Voici la même communauté en liste.</p>
      <ul className="vrm-cm-liste">{cells.map((c) => <li key={c.cle}><div><b>{c.villes.join(' · ')}</b><small>{c.personnes.length} revendeur{c.personnes.length > 1 ? 's' : ''}</small></div>
        <button type="button" onClick={() => setCellsOuvertes([c])}>Voir</button></li>)}</ul>
    </div> : <Carte cells={cells} moi={moi} sombre={sombre} onCellules={setCellsOuvertes} onEchec={() => setEnListe(true)} />}

    {pres.length > 0 && <div className="vrm-cm-carton" data-cm-pres={pres.length}>
      <h3>Près de toi</h3>
      <ul className="vrm-cm-liste">{pres.slice(0, 8).map((p) => <li key={p.pid}><div><b>{p.pseudo}</b>{p.premier && <span className="vrm-cm-badge"> 🥇</span>}<small>{p.ville}</small>{p.discord && <DiscordDe pseudo={p.discord} />}</div>
        <div className="vrm-cm-ligne-boutons">
          <button type="button" onClick={() => coucou(p)} disabled={envoye.has(p.pid)}>{envoye.has(p.pid) ? 'Coucou envoyé ✓' : '👋 Coucou'}</button>
          <button type="button" className="vrm-cm-primaire" onClick={() => ouvrirEcrire(p)}>Écrire</button>
        </div></li>)}</ul>
    </div>}

    <div className="vrm-cm-carton" data-cm-conversations={convs.length}>
      <h3>Messages{nonLus > 0 ? <span className="vrm-cm-pastille" data-cm-nonlus={nonLus}>{nonLus} non lu{nonLus > 1 ? 's' : ''}</span> : null}</h3>
      {convs.length === 0 ? <p className="vrm-cm-note">Aucune conversation. Touche une épingle de la carte pour dire bonjour.</p>
        : <ul className="vrm-cm-liste">{convs.map((c) => <li key={c.conv}><button type="button" className="vrm-cm-conv" onClick={() => setFilOuvert({ conv: c.conv, entete: c })} data-cm-conv={c.conv}>
          <b>{c.pseudo || 'Ancien membre de la carte'}{c.ville ? <small> · {c.ville}</small> : null}</b>
          <span>{c.deMoi ? 'Toi : ' : ''}{c.dernier}</span>
          <time>{quandCourt(c.quand)}</time>{c.nonLus > 0 && <span className="vrm-cm-pastille">{c.nonLus}</span>}
        </button></li>)}</ul>}
      <p className="vrm-cm-note">Messages courts entre revendeurs de la carte (20 par heure). Tu peux bloquer ou signaler quelqu’un depuis la conversation.</p>
    </div>

    {rejoindre && portail(<Rejoindre api={api} moi={moi} prenom={prenom} FermeAuRetour={FermeAuRetour} onAnnuler={() => setRejoindre(false)} onFait={() => { setRejoindre(false); setToast('Te voilà sur la carte !'); lire(true); }} />)}
    {cellsOuvertes && portail(<Personnes cells={cellsOuvertes} moi={moi} envoye={envoye} FermeAuRetour={FermeAuRetour} onFerme={() => setCellsOuvertes(null)} onCoucou={coucou} onEcrire={ouvrirEcrire} />)}
    {filOuvert && filOuvert.conv && portail(<Fil api={api} conv={filOuvert.conv} entete={filOuvert.entete} FermeAuRetour={FermeAuRetour} onFerme={() => setFilOuvert(null)} onChange={() => lire(true)} />)}
    {filOuvert && filOuvert.nouveau && portail(<PremierMessage p={filOuvert.nouveau} FermeAuRetour={FermeAuRetour} onFerme={() => setFilOuvert(null)}
      onEnvoyer={async (t) => { const c = await ecrireA(filOuvert.nouveau, t); if (c) setFilOuvert({ conv: c, entete: filOuvert.nouveau }); }} />)}
    {toast && portail(<div className="vrm-cm-toast" role="status" data-cm-toast>{toast}</div>)}
  </section>;
}

function PremierMessage({ p, onEnvoyer, onFerme, FermeAuRetour }) {
  const [t, setT] = useState(''), [occupe, setOccupe] = useState(false);
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille" role="dialog" aria-modal="true" aria-label={'Écrire à ' + p.pseudo} data-cm-premier-message>
      <div className="vrm-cm-feuille-tete"><h3>Écrire à {p.pseudo}<small> · {p.ville}</small></h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label="Fermer">×</button></div>
      <form className="vrm-cm-saisie" onSubmit={async (e) => { e.preventDefault(); if (!t.trim()) return; setOccupe(true); await onEnvoyer(t); setOccupe(false); }}>
        <textarea value={t} maxLength={500} rows={3} onChange={(e) => setT(e.target.value)} placeholder="Ton message (500 caractères au plus)" aria-label="Ton message" data-cm-texte />
        <button type="submit" className="vrm-cm-primaire" disabled={occupe || !t.trim()} data-cm-envoyer>{occupe ? '…' : 'Envoyer'}</button>
      </form>
    </div>
  </div>;
}

// ── LE PSEUDO DISCORD (019) ──────────────────────────────────────────────────
// Même forme que la contrainte de la base : 2 à 32 caractères a-z 0-9 . _ ,
// jamais « .. ». Un « @ » tapé en tête est retiré (c'est l'habitude), un « @ »
// ailleurs est refusé.
export const DISCORD_RE = /^[a-z0-9._]{2,32}$/;
export const discordPropre = (x) => String(x || '').trim().replace(/^@/, '').toLowerCase();
export const discordValide = (d) => DISCORD_RE.test(d) && !d.includes('..');

function DiscordDe({ pseudo }) {
  const [copie, setCopie] = useState('');
  const copier = async () => {
    try { await navigator.clipboard.writeText(pseudo); setCopie('copié'); }
    catch (_) { setCopie('copie impossible — sélectionne-le'); }
  };
  return <span className="vrm-cm-discord" data-cm-discord={pseudo}>Discord : <b className="vrm-cm-select">{pseudo}</b>
    <button type="button" className="vrm-cm-lien" onClick={copier} data-cm-discord-copier>{copie || 'Copier'}</button></span>;
}

function MonDiscord({ api, actuel, onFait }) {
  const [ouvert, setOuvert] = useState(false), [v, setV] = useState(actuel), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const poser = async (valeur) => {
    const d = discordPropre(valeur);
    if (d && !discordValide(d)) { setMsg('2 à 32 caractères : lettres minuscules, chiffres, « . » ou « _ » (comme ton pseudo Discord).'); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'discord', discord: d });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    setOuvert(false); onFait(d ? 'Ton pseudo Discord est visible des membres de la carte.' : 'Ton pseudo Discord est retiré.');
  };
  if (!ouvert) return <div className="vrm-cm-discord-moi" data-cm-mon-discord={actuel ? 'oui' : 'non'}>
    {actuel ? <><span>Discord : <b>{actuel}</b></span>
      <div className="vrm-cm-ligne-boutons"><button type="button" onClick={() => { setV(actuel); setOuvert(true); }} data-cm-discord-modifier>Modifier</button>
        <button type="button" onClick={() => poser('')} disabled={occupe} data-cm-discord-retirer>Retirer</button></div></>
      : <><span>Pas de pseudo Discord (facultatif).</span>
        <button type="button" onClick={() => { setV(''); setOuvert(true); }} data-cm-discord-ajouter>Ajouter mon pseudo Discord</button></>}
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
  </div>;
  return <form className="vrm-cm-discord-moi" onSubmit={(e) => { e.preventDefault(); poser(v); }} data-cm-mon-discord="saisie">
    <label className="vrm-cm-champ"><span>Ton pseudo Discord</span>
      <input value={v} maxLength={33} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setV(e.target.value)} placeholder="ton.pseudo" data-cm-discord-champ /></label>
    <p className="vrm-cm-note">Facultatif. Les autres membres de la carte le verront pour t’écrire sur Discord. VRM ne se connecte jamais à Discord.</p>
    <div className="vrm-cm-ligne-boutons">
      <button type="submit" className="vrm-cm-primaire" disabled={occupe} data-cm-discord-valider>{occupe ? 'Un instant…' : 'Enregistrer'}</button>
      <button type="button" onClick={() => { setOuvert(false); setMsg(''); }}>Annuler</button>
    </div>
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
  </form>;
}

// ── LE CLASSEMENT (019) ──────────────────────────────────────────────────────
// Le nombre de ventes Vinted de la période, COMPTÉ PAR LA BASE (le navigateur
// n'envoie que la période). Opt-in : on n'y figure que si on l'a activé.
export const PERIODES = [['jour', 'Aujourd’hui'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']];
export const rangTexte = (n) => (Number(n) === 1 ? '1er' : `${n}ᵉ`);
const CLASSEMENT_PAS_SU = "Je n'ai pas pu lire le classement — rien n'est perdu, c'est la lecture qui a échoué.";

function Classement({ api, moi, groupe }) {
  const [periode, setPeriode] = useState('semaine');
  const [etat, setEtat] = useState('charge'), [c, setC] = useState(null), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const seq = useRef(0);
  const lire = useCallback(async (per) => {
    const n = ++seq.current;
    setEtat('charge'); setMsg('');
    const r = await api(groupe ? { action: 'classement', periode: per, groupe: groupe.id } : { action: 'classement', periode: per });
    if (n !== seq.current) return;
    if (r.ok && r.classement && Array.isArray(r.classement.lignes)) { setC(r.classement); setEtat('lu'); return; }
    setC(null);
    setEtat(r.erreur === 'non-installe' ? 'non-installe' : r.erreur === 'abonnement' ? 'abonnement' : 'pas-su');
    setMsg(r.message || CLASSEMENT_PAS_SU);
  }, [api, groupe]);
  useEffect(() => { lire(periode); }, [periode, lire]);
  const inscrire = async (oui) => {
    if (oui && !window.confirm('Entrer dans le classement ? Les membres VRM verront ton pseudo, ta ville et ton NOMBRE de ventes Vinted sur la période — jamais un montant. Tu peux en sortir quand tu veux.')) return;
    setOccupe(true);
    const r = await api({ action: 'inscrire', oui });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || CLASSEMENT_PAS_SU); return; }
    lire(periode);
  };
  const choix = <div className="vrm-cm-onglets vrm-cm-periodes" role="group" aria-label="Période">
    {PERIODES.map(([k, t]) => <button key={k} type="button" className="vrm-cm-onglet" aria-pressed={periode === k} onClick={() => setPeriode(k)} data-cm-periode={k}>{t}</button>)}
  </div>;
  const note = <p className="vrm-cm-note" data-cm-classement-regle>Le chiffre : tes ventes Vinted faites sur la période (annulées et remboursées non comptées), comptées par VRM à partir de ce que l’extension a capté — jamais un montant. Leboncoin et eBay n’y entrent pas.</p>;

  if (etat === 'non-installe' || etat === 'abonnement' || etat === 'pas-su') return <div className="vrm-cm-carton" data-cm-classement={etat}>
    {etat === 'non-installe' ? <><b>Le classement n’est pas encore activé sur ta base.</b><p>Il s’ouvrira dès que la mise à jour de la base sera faite. Rien n’est partagé d’ici là.</p></>
      : etat === 'abonnement' ? <><b>Ton abonnement n’est pas actif.</b><p>Le classement est réservé aux abonnés.</p></>
      : <><b>{CLASSEMENT_PAS_SU}</b><p>Ce n’est pas un classement vide : je n’ai simplement pas pu le lire.</p><button type="button" onClick={() => lire(periode)} data-cm-classement-reessayer>Réessayer</button></>}
  </div>;

  const inscrit = c && c.inscrit, visible = c ? c.visible : !!moi;
  return <div data-cm-classement={etat} data-cm-classement-n={c ? c.n : ''} data-cm-classement-groupe={groupe ? groupe.id : ''}>
    {groupe ? <div className="vrm-cm-carton" data-cm-classement-de-groupe><b>Classement de « {groupe.nom} »</b><span> · les membres du groupe, entre eux.</span></div>
    : <div className="vrm-cm-carton vrm-cm-moi" data-cm-inscrit={inscrit ? 'oui' : 'non'}>
      {!c ? <span>Lecture du classement…</span>
        : inscrit ? <><div><b>Tu es dans le classement</b><span> sous le pseudo « {(moi && moi.pseudo) || '—'} ».</span></div>
          <button type="button" onClick={() => inscrire(false)} disabled={occupe} data-cm-classement-sortir>Me retirer du classement</button></>
        : !visible ? <div><b>Tu n’es pas dans le classement.</b><span> Mets-toi d’abord sur la carte (onglet Carte) : le classement montre ton pseudo et ta ville.</span></div>
        : <><div><b>Tu n’es pas dans le classement.</b><span> Personne ne voit tes ventes tant que tu ne l’as pas décidé.</span></div>
          <button type="button" className="vrm-cm-primaire" onClick={() => inscrire(true)} disabled={occupe} data-cm-classement-entrer>Entrer dans le classement</button></>}
      {msg && etat === 'lu' && <p className="vrm-cm-msg" role="alert">{msg}</p>}
    </div>}
    {choix}
    {etat === 'charge' ? <p role="status" className="vrm-cm-note">Lecture du classement…</p>
      : c.n === 0 && !groupe ? <div className="vrm-cm-carton vrm-cm-vide" data-cm-classement-vide><b>Personne n’est encore dans le classement.</b><p>Sois le premier : entre dans le classement, les prochains te trouveront en haut.</p></div>
      : <div className="vrm-cm-carton">
        {c.moi ? <p className="vrm-cm-rang-moi" data-cm-rang-moi={c.moi.rang}>Tu es <b>{rangTexte(c.moi.rang)}</b> sur {c.n} · {c.moi.ventes} vente{c.moi.ventes > 1 ? 's' : ''}</p>
          : <p className="vrm-cm-note">{c.n} membre{c.n > 1 ? 's' : ''} dans le classement.</p>}
        <ol className="vrm-cm-classement">{c.lignes.map((l) => <li key={l.pid} className={l.moi ? 'moi' : ''} data-cm-ligne={l.pid} data-cm-ligne-ventes={l.ventes} data-cm-ligne-moi={l.moi ? 'oui' : 'non'}>
          <span className="vrm-cm-rang">{l.rang <= 3 ? ['🥇', '🥈', '🥉'][l.rang - 1] + ' ' : ''}{rangTexte(l.rang)}</span>
          <span className="vrm-cm-qui"><b>{l.pseudo}</b>{l.moi && <span className="vrm-cm-badge"> toi</span>}<small>{l.ville}</small></span>
          <span className="vrm-cm-ventes"><b>{l.ventes}</b> vente{l.ventes > 1 ? 's' : ''}</span>
        </li>)}</ol>
      </div>}
    {note}
  </div>;
}

// ── LES GROUPES À CODE (020) ─────────────────────────────────────────────────
// Un accompagnement : celui qui crée le groupe reçoit un code de 8 caractères et
// le donne à ses membres ; la carte et le classement peuvent ne montrer qu'eux.
// Entrer dans un groupe est un consentement dit AVANT le geste.
export const codeLisible = (c) => (String(c || '').length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : String(c || ''));
export const codeTape = (x) => String(x || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

function Groupes({ api, moi, groupes, actif, onChoisir, onFait }) {
  const [mode, setMode] = useState(''), [v, setV] = useState(''), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false), [copie, setCopie] = useState('');
  const fermer = () => { setMode(''); setV(''); setMsg(''); };
  const entrer = async (e) => {
    e.preventDefault();
    const c = codeTape(v);
    if (!CODE_RE.test(c)) { setMsg('Un code fait 8 caractères (lettres et chiffres), par exemple ABCD-2345.'); return; }
    if (!window.confirm('Entrer dans ce groupe ? Ses membres verront ton pseudo, ta ville et ton NOMBRE de ventes Vinted (jamais un montant). Tu pourras le quitter quand tu veux.')) return;
    setOccupe(true); setMsg('');
    const r = await api({ action: 'groupe-entrer', code: c });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    fermer(); onFait(r.deja ? `Tu es déjà dans « ${r.nom} ».` : `Bienvenue dans « ${r.nom} » !`, r.id);
  };
  const creer = async (e) => {
    e.preventDefault();
    const n = v.trim();
    if (n.length < 2 || n.length > 40 || /[@<>]/.test(n)) { setMsg('Un nom de 2 à 40 caractères, sans « @ ».'); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'groupe-creer', nom: n });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    fermer(); onFait(`Groupe créé. Son code : ${codeLisible(r.code)} — donne-le à tes membres.`, r.id);
  };
  const quitter = async () => {
    if (!actif || !window.confirm(`Quitter « ${actif.nom} » ? Tu n’y apparaîtras plus. Pour revenir, il faudra le code.`)) return;
    const r = await api({ action: 'groupe-quitter', groupe: actif.id });
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(`Tu as quitté « ${actif.nom} ».`, null);
  };
  const nouveauCode = async () => {
    if (!actif || !window.confirm('Changer le code ? L’ancien ne marchera plus pour entrer (les membres déjà dedans restent).')) return;
    const r = await api({ action: 'groupe-code', groupe: actif.id });
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(`Nouveau code : ${codeLisible(r.code)}`);
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(codeLisible(actif.code)); setCopie('copié'); }
    catch (_) { setCopie('copie impossible — sélectionne-le'); }
  };
  return <div className="vrm-cm-carton vrm-cm-groupes" data-cm-groupes={groupes.length}>
    <div className="vrm-cm-groupes-tete"><b>Groupe d’accompagnement</b>
      <span className="vrm-cm-note"> Entre le code de ton accompagnement pour vous comparer entre vous.</span></div>
    {groupes.length > 0 && <div className="vrm-cm-onglets vrm-cm-choix-groupe" role="group" aria-label="Qui afficher">
      <button type="button" className="vrm-cm-onglet" aria-pressed={!actif} onClick={() => onChoisir(null)} data-cm-groupe-choix="tous">Tous les membres</button>
      {groupes.map((g) => <button key={g.id} type="button" className="vrm-cm-onglet" aria-pressed={!!actif && actif.id === g.id} onClick={() => onChoisir(g.id)} data-cm-groupe-choix={g.id}>{g.nom}</button>)}
    </div>}
    {actif && <div className="vrm-cm-groupe-actif" data-cm-groupe-actif={actif.id}>
      <span>{actif.membres.length} membre{actif.membres.length > 1 ? 's' : ''} · code <b className="vrm-cm-select" data-cm-groupe-code={actif.code}>{codeLisible(actif.code)}</b></span>
      <div className="vrm-cm-ligne-boutons">
        <button type="button" onClick={copier} data-cm-groupe-copier>{copie || 'Copier le code'}</button>
        {actif.createur && <button type="button" onClick={nouveauCode} data-cm-groupe-nouveau-code>Nouveau code</button>}
        <button type="button" onClick={quitter} data-cm-groupe-quitter>Quitter le groupe</button>
      </div>
    </div>}
    {!moi ? <p className="vrm-cm-note" data-cm-groupe-carte-requise>Mets-toi d’abord sur la carte (onglet Carte) : un groupe montre ton pseudo et ta ville à ses membres.</p>
      : mode === '' ? <div className="vrm-cm-ligne-boutons">
        <button type="button" className="vrm-cm-primaire" onClick={() => setMode('entrer')} data-cm-groupe-entrer>Entrer un code</button>
        <button type="button" onClick={() => setMode('creer')} data-cm-groupe-creer>Créer un groupe</button>
      </div>
      : <form className="vrm-cm-ville" onSubmit={mode === 'entrer' ? entrer : creer} data-cm-groupe-form={mode}>
        <label className="vrm-cm-champ"><span>{mode === 'entrer' ? 'Le code du groupe' : 'Le nom du groupe'}</span>
          <input value={v} maxLength={mode === 'entrer' ? 12 : 40} autoCapitalize={mode === 'entrer' ? 'characters' : 'sentences'} autoCorrect="off" spellCheck={false}
            onChange={(e) => setV(e.target.value)} placeholder={mode === 'entrer' ? 'ABCD-2345' : 'Accompagnement de Julien'} data-cm-groupe-champ /></label>
        {mode === 'entrer' ? <p className="vrm-cm-note">Ses membres verront ton pseudo, ta ville et ton nombre de ventes Vinted — jamais un montant.</p>
          : <p className="vrm-cm-note">Tu recevras un code à donner aux membres de ton accompagnement. Toi seul pourras le changer.</p>}
        <div className="vrm-cm-ligne-boutons">
          <button type="submit" className="vrm-cm-primaire" disabled={occupe} data-cm-groupe-valider>{occupe ? 'Un instant…' : mode === 'entrer' ? 'Entrer dans le groupe' : 'Créer le groupe'}</button>
          <button type="button" onClick={fermer}>Annuler</button>
        </div>
      </form>}
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
  </div>;
}
