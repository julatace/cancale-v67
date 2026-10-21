// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import React from "react";
import { BoutonBordereau, CONDITIONS_RETRAIT_AUTO, EBAY_CONDITIONS, EBAY_ECARTS, EBAY_SKIN, EXT_ATTENDUE, Icon, JOURS_LETTRE, JOURS_NOM, NUM_OK, OFFRE_VEND_LA_PAIRE, PLANIF_HORIZON_MS, PLANIF_MIN_MS, PREUVE_PAR_VISITE, PhotoVente, PhotoVinted, RAISON_CONNEXION_EBAY, RAISON_RETRAIT_AUTO, REGLES_LOT_MAX, SELLER_HUB_PROGRAMMEES, SUPABASE_URL, ScreenHead, aExpedier, achatParNum, ageRegleJ, appelEbay, askConfirm, attenduDe, autoRemplirAttributs, caEbayPayees, centsR, clavierNum, cleNum, cleVerifEbay, compterReglesEbay, comptesBloquesVinted, connexionExtensionVrm, corpsCompteEbay, dansVueEbay, departDePreregle, descriptionDeFaits, descriptionEbayPropre, doublesVenteEbay, ebayTitre, enTeteSession, etatEbayDeVinted, etatEnClair, etatRegleOffre, eurEbay, extSait, extractBrand, extractSize, fichesPourEbay, heuresDuLot, idBrouillonEbay, isCloudReady, itemDeBrouillon, jourParisTexte, jumellesParPhoto, lbcAnnoncesSession, libellePreregle, lignesFraisEbay, lireBrouillonsEbay, lireEbayParCompte, lireEbayTous, lirePreuvesVenteVinted, lireReglesEbay, load, localApresRegle, marquerEbay, messageOffreCreation, modifierBrouillonsEbay, montantSaisi, nomCompteEbay, noterLienEbay, numDeSkuEbay, numEbayLu, numerosDejaVendus, offreEnvoyeeProgrammee, onCloudReady, onVmrExt, ouVenduesTexte, parisVersUtc, partsParis, prixAchatDe, prixCompatibleRegle, programmeesConnues, quandParisTexte, raisonExtGlobale, regleEngage, regleVieille, reglesEngagees, resultatRegleOffre, resultatReviseEbay, retraitsEbayAutoPermis, rythmeEbay, save, sbAuth, seRelitChezEbay, seuilDePourcent, seuilTropBas, signalerComptesEbay, skuEbayDe, skuEbayDouteux, texteOffresDejaFaites, texteReglesQuiRestent, toast, triNum, typeCompteEbayTexte, useEbayPaires, useSansSouris, uuidEnvoiEbay, valideRegleOffre, vmrCmd, vmrExtPresent } from "../App.jsx";

// (17 oct.) Julien : « trop de texte, ça rend moche » (écran Annonces eBay). Une
// explication qui ne change pas d'une fois à l'autre se replie derrière un « ⓘ »
// au bout du titre : le titre et les gestes restent, le POURQUOI s'ouvre au clic.
// Ce qui dit un RISQUE propre à la donnée (une règle d'offre, une raison qui
// distingue une ligne) reste visible — seul le texte fixe se replie.
function Pourquoi({ children, label = 'Pourquoi ?' }) {
  return <details className="vrm-pourquoi" data-pourquoi><summary aria-label={label} title={label}>ⓘ</summary><div>{children}</div></details>;
}
// eBay ne NUMÉROTE pas ses sections : un GROS titre blanc, une carte grise plate.
function BlocEbay({ n, titre: t, right, children }) {
  const C = EBAY_SKIN;
  return (
    <div style={{ borderRadius: 14, background: C.card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{t}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

// `brouillon` (5 octobre) : un brouillon à rouvrir pour le modifier ; il
// remplit le formulaire. `onBrouillon` : appelé après un enregistrement.
// (6 octobre) `dejaSurEbay` : N° → { etat: 'en-vente'|'programmee', debut } ;
// `ventes` : le verdict « déjà vendue, toutes plateformes » (`numerosDejaVendus`,
// §11) ; `enLigne` / `vendusVinted` : les annonces Vinted en vente / prouvées
// vendues (Set ; `undefined` en cours ; `null` pas su).
function EbayPublier({ onPublie, paires = [], dejaSurEbay = null, brouillon = null, onBrouillon, ventes = null, enLigne, vendusVinted, comptesPub = [], compteDefaut = 'principal', onCompte }) {
  const C = EBAY_SKIN;   // peau eBay : tout ce formulaire est au look de l'appli eBay (§ ci-dessus)
  const [ouvert, setOuvert] = React.useState(false);
  // ── SUR QUEL COMPTE eBAY (9 octobre) ── pré-choisi sur le compte affiché (un
  // seul choisi en haut), sinon le dernier utilisé. Le choix n'apparaît qu'à
  // partir de deux comptes reliés ; la confirmation NOMME le compte.
  const [compteChoisi, setCompteChoisi] = React.useState(null);
  const plusieursPub = Array.isArray(comptesPub) && comptesPub.length >= 2;
  const comptePub = (compteChoisi && comptesPub.some((c) => c.ref === compteChoisi)) ? compteChoisi : compteDefaut;
  const nomComptePub = nomCompteEbay(comptesPub.find((c) => c.ref === comptePub) || { principal: true });
  // ── LE BROUILLON EN COURS (5 octobre) ──
  const [brouillonId, setBrouillonId] = React.useState(null);     // null = nouvelle annonce
  const [numeroBrouillon, setNumeroBrouillon] = React.useState(''); // le N° gardé si la paire n'est plus listée
  const [brouillonMsg, setBrouillonMsg] = React.useState('');
  const [enregistre, setEnregistre] = React.useState(false);
  const racine = React.useRef(null);
  const [titre, setTitre] = React.useState('');
  const [prix, setPrix] = React.useState('');
  const [qty, setQty] = React.useState('1');
  const [cond, setCond] = React.useState('3000');
  const [desc, setDesc] = React.useState('');
  const [photos, setPhotos] = React.useState('');
  const [cat, setCat] = React.useState(null);          // {categoryId, categoryName, required:[]}
  const [asp, setAsp] = React.useState({});
  const [analyse, setAnalyse] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);          // {ok,url}|{err}
  const [check, setCheck] = React.useState(null);      // {ok,fees}|{err} — vérif à blanc eBay
  const [verif, setVerif] = React.useState(false);
  const [pairId, setPairId] = React.useState(null);    // paire choisie (ses photos partent avec)
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pairQ, setPairQ] = React.useState('');        // recherche dans le sélecteur de paires
  const [aiPret, setAiPret] = React.useState(false);   // l'IA de rédaction est-elle branchée ?
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiWhy, setAiWhy] = React.useState('');
  const [plusAttr, setPlusAttr] = React.useState(false);  // afficher les caractéristiques facultatives
  // (9 octobre) LA RÈGLE D'OFFRE de la nouvelle annonce (facultative) : eBay
  // acceptera toute offre à partir de ce montant. Validée en direct contre le
  // prix tapé (la même règle que la carte et la route, §11).
  const [offreA, setOffreA] = React.useState('');
  const [offreR, setOffreR] = React.useState('');
  const [offreBasOk, setOffreBasOk] = React.useState(false);
  const prixTapeN = Number(String(prix).replace(',', '.'));
  const prixOffre = Number.isFinite(prixTapeN) && prixTapeN > 0 ? prixTapeN : null;
  const offreAN = montantSaisi(offreA), offreRN = montantSaisi(offreR);
  const vOffre = (offreA.trim() || offreR.trim()) ? valideRegleOffre({ accepte: offreAN, refuse: offreRN, prix: prixOffre }) : null;
  const offreTropBas = !!(vOffre && vOffre.ok && vOffre.accepte != null && seuilTropBas(vOffre.accepte, prixOffre));
  const pairSel = paires.find(p => p.id === pairId) || null;
  // Un champ de caractéristique rendu comme eBay : liste déroulante quand eBay
  // fournit ses valeurs, texte libre sinon. On ne propose QUE les valeurs d'eBay.
  const champAttr = (a) => {
    const n = (a.valeurs || []).length;
    // Liste COURTE (≤ 12) → menu déroulant. Liste LONGUE (marques : des
    // centaines) → champ avec SUGGESTIONS (datalist) : on tape « aut » et « Autry »
    // apparaît, comme les sites de marques. Les suggestions restent les valeurs
    // d'eBay ; « Vérifier » refuse ce qui n'en est pas.
    if (n === 0) return (
      <input value={asp[a.nom] || ''} onChange={e => { setAsp(x => ({ ...x, [a.nom]: e.target.value })); setCheck(null); }} placeholder={/pointure|taille|size/i.test(a.nom) ? 'ex. 44' : /marque|brand/i.test(a.nom) ? 'ex. Nike' : /couleur|color/i.test(a.nom) ? 'ex. Bleu' : ''} style={inp} />
    );
    if (n > 12) {
      const dlId = 'dl-' + a.nom.replace(/[^a-z0-9]/gi, '');
      return (<>
        <input list={dlId} value={asp[a.nom] || ''} onChange={e => { setAsp(x => ({ ...x, [a.nom]: e.target.value })); setCheck(null); }} placeholder="tape pour chercher…" style={inp} />
        <datalist id={dlId}>{a.valeurs.map(v => <option key={v} value={v} />)}</datalist>
      </>);
    }
    return (
      <select value={asp[a.nom] || ''} onChange={e => { setAsp(x => ({ ...x, [a.nom]: e.target.value })); setCheck(null); }} style={inp}>
        <option value="">— choisir —</option>
        {a.valeurs.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  };
  // L'IA de rédaction (api/ai) est-elle disponible ? On ne montre le bouton que
  // si oui — jamais un bouton mort (§ « une clé perso reste sur l'appareil »).
  React.useEffect(() => { let stop = false;
    try { if ((load('vrm_ai_key', '') || '').trim()) { setAiPret(true); return; } } catch (_) {}
    fetch('/api/ai').then(r => r.json()).then(j => { if (!stop && j && j.ready) setAiPret(true); }).catch(() => {});
    return () => { stop = true; };
  }, []);
  // Génère un titre eBay avec l'IA — à partir des VRAIES caractéristiques de la
  // paire (marque/taille/état) ; l'IA a consigne de NE RIEN INVENTER (api/ai).
  const titreIA = async () => {
    const base = (pairSel ? pairSel.title : titre) || '';
    if (!base.trim()) { setRes({ err: 'Choisis une paire (ou tape un titre) d\'abord.' }); return; }
    setAiBusy(true); setAiWhy(''); setRes(null);
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() },
        body: JSON.stringify({ title: base, brand: extractBrand(base) || '', size: (pairSel && pairSel.taille) || extractSize(base) || '', price: prix || undefined, desc: desc || '', key: (load('vrm_ai_key', '') || '').trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok && j.title) { setTitre(String(j.title).slice(0, 80)); if (!desc.trim() && j.desc) setDesc(String(j.desc)); setCat(null); setCheck(null); setAiWhy(j.why || ''); }
      else setRes({ err: (j && j.reason === 'no-key') ? 'Ajoute ta clé IA dans Réglages pour la rédaction automatique.' : 'L\'IA n\'a pas pu rédiger le titre — réessaie.' });
    } catch (_) { setRes({ err: 'IA injoignable — réessaie.' }); }
    setAiBusy(false);
  };
  // Choisir une paire remplit le titre (règle §11 partagée), sa pointure et
  // TOUTES ses photos captées — plus aucun lien à coller. Le titre reste
  // modifiable ; la pointure sera reportée sur l'attribut eBay après l'analyse.
  // (16 oct.) Le PRIX Vinted aussi (« je veux le même prix d'une plateforme à
  // l'autre ») — seulement si le champ est vide : un prix tapé n'est jamais
  // écrasé. Et si la paire a moins de photos captées que Vinted n'en annonce
  // (publiée il y a deux minutes : rien n'est encore capté), on demande à
  // l'extension de lire sa page TOUT DE SUITE (`cmd: 'photos'`, sur ce clic).
  const [photosEtat, setPhotosEtat] = React.useState(null);   // null · 'cherche' · 'fait' · {raison}
  // (17 oct.) Choisir une paire lance l'analyse eBay (catégorie + caractéristiques)
  // sans attendre un second clic : c'est ELLE qui remplit marque, pointure et
  // état. Une LECTURE chez eBay (Taxonomy), rien n'est publié.
  const [autoAnalyse, setAutoAnalyse] = React.useState(0);
  const pairCourante = React.useRef(null);
  const choisirPaire = (p) => {
    pairCourante.current = p.id;
    setPairId(p.id); setPickerOpen(false); setPairQ('');
    setTitre(ebayTitre(p.title || '', p.taille || ''));   // « taille 36 », pas « T36 »
    setPhotos((p.photos || []).join('\n'));
    setDesc(p.desc || descriptionDeFaits(p));              // sa description Vinted ; à défaut, ses FAITS captés (jamais inventés)
    if (p.prix != null && !String(prix).trim()) setPrix(String(p.prix).replace('.', ','));
    { const ce = etatEbayDeVinted(p.etat, null); if (ce) setCond(ce); }   // l'état Vinted de la paire (vérifié contre la liste d'eBay à l'analyse)
    setCat(null); setCheck(null);
    setAutoAnalyse((n) => n + 1);   // la catégorie et ses caractéristiques (marque, pointure, état) se cherchent tout de suite
    setPhotosEtat(null);
    const manque = (p.photos || []).length < Math.max(2, Number(p.nPhotos) || 0);
    if (manque && p.uid && vmrExtPresent()) {
      setPhotosEtat('cherche');
      vmrCmd({ cmd: 'photos', uid: p.uid, id: p.id }, 30000).then(async (r) => {
        if (pairCourante.current !== p.id) return;
        if (!(r && r.accepte && r.etape === 'fait')) { setPhotosEtat({ raison: (r && r.raison) || "l'extension n'a pas répondu" }); return; }
        try {
          const rq = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_item_details&select=d:data->${encodeURIComponent(String(p.id))}`, { headers: sbAuth() });
          const rows = rq.ok ? await rq.json() : null;
          const d = rows && rows[0] && rows[0].d;
          const lues = Array.isArray(d && d.photos) ? d.photos.map((x) => typeof x === 'string' ? x : (x && (x.url || x.full_size_url)) || '').filter(Boolean) : [];
          if (lues.length) {
            // Seulement si c'est toujours CETTE paire, et sans écraser des photos retirées à la main.
            if (pairCourante.current !== p.id) return;
            setPhotos((old) => (old.split(/\s+/).filter(Boolean).length <= (p.photos || []).length ? lues.join('\n') : old));
            if (!String(p.desc || '').trim() && descriptionEbayPropre(d.description)) setDesc((old) => old.trim() ? old : descriptionEbayPropre(d.description));
            setPhotosEtat('fait');
          } else setPhotosEtat({ raison: "Vinted n'a rendu aucune photo" });
        } catch (_) { setPhotosEtat({ raison: 'la base ne répond pas' }); }
      });
    }
  };
  // Applique une réponse pubinfo → catégorie + caractéristiques eBay + pré-
  // remplissage prouvé. `nomForce` sert quand on CHOISIT une autre catégorie
  // (eBay renvoie toujours la 1ʳᵉ suggestion en `suggeree`, on garde le nom cliqué).
  // La catégorie telle qu'eBay la décrit (pubinfo), ou null.
  const catDepuisPubinfo = (j, nomForce) => {
    if (!(j && j.ok && (j.categorie && (j.categorie.categoryId || j.categorie.suggeree)))) return null;
    const attributs = Array.isArray(j.attributs) && j.attributs.length
      ? j.attributs
      : (j.attributsObligatoires || []).map(n => ({ nom: n, requis: true, mode: 'FREE_TEXT', valeurs: [] }));
    const required = attributs.filter(a => a.requis).map(a => a.nom);
    const catId = (j.categorie && j.categorie.categoryId) || (j.categorie && j.categorie.suggeree && j.categorie.suggeree.categoryId) || '';
    const catNom = nomForce || (j.categorie && j.categorie.suggeree && j.categorie.suggeree.categoryName) || catId;
    const conditions = Array.isArray(j.conditions) && j.conditions.length ? j.conditions : null;
    return { categoryId: catId, categoryName: catNom, required, attributs, cats: Array.isArray(j.categories) ? j.categories : [], conditions };
  };
  const appliquerPubinfo = (j, nomForce, fresh) => {
    const c = catDepuisPubinfo(j, nomForce);
    if (!c) { setRes({ err: (j && j.error) || 'eBay n\'a pas suggéré de catégorie pour ce titre.' }); return; }
    const { attributs, conditions } = c;
    setCat(c);
    // Si eBay donne SA liste d'états pour cette catégorie et que l'état courant
    // n'y est pas, on prend « Occasion » (3000) si présent, sinon le premier.
    const condVinted = pairSel ? etatEbayDeVinted(pairSel.etat, conditions) : null;
    if (condVinted) setCond(condVinted);
    else if (conditions && !conditions.some(c => c.id === cond)) {
      const occ = conditions.find(c => c.id === '3000');
      setCond((occ || conditions[0]).id);
    }
    // Pré-remplissage PROUVÉ (§5) ; on n'écrase pas une saisie manuelle.
    // La marque : celle que VINTED a enregistrée pour la paire d'abord, sinon
    // celle reconnue dans le titre (une liste de marques, jamais inventée).
    const src = pairSel ? pairSel.title : titre;
    const marqueV = (pairSel && pairSel.marque) || '';
    const auto = autoRemplirAttributs(attributs, { titre: src, marque: marqueV || extractBrand(src) || '', taille: (pairSel && pairSel.taille) || extractSize(src) || '', faits: { marque: marqueV, taille: (pairSel && pairSel.tailleVinted) || '' } });
    // Changement de catégorie ⇒ on repart des valeurs prouvées (les anciennes
    // caractéristiques n'ont pas de sens dans la nouvelle catégorie).
    if (fresh) setAsp(auto); else if (Object.keys(auto).length) setAsp(a => ({ ...auto, ...a }));
  };
  const analyser = async (categoryId, nomForce) => {
    if (!titre.trim()) { setRes({ err: 'Mets d\'abord un titre.' }); return; }
    setAnalyse(true); setRes(null); setCheck(null);
    try {
      const body = { action: 'pubinfo', title: titre, ...corpsCompteEbay(comptePub) };
      if (categoryId) body.categoryId = categoryId;   // choisir une autre catégorie → ses caractéristiques
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify(body) });
      appliquerPubinfo(await r.json(), nomForce, !!categoryId);
    } catch (_) { setRes({ err: 'Analyse impossible (réseau).' }); }
    setAnalyse(false);
  };
  React.useEffect(() => { if (autoAnalyse && titre.trim() && !analyse) analyser(); /* eslint-disable-line */ }, [autoAnalyse]);
  // Le formulaire, sous la forme d'un BROUILLON (5 octobre) : c'est ce qui est
  // enregistré, et c'est de lui que part l'annonce — `itemDeBrouillon`, la
  // MÊME règle que la liste des brouillons (§11). ebayGere: eBay gère la
  // livraison (mesuré : son compte refuse un tarif fixe envoyé par l'API).
  const brouillonCourant = () => ({
    pairId: pairId || null,
    numero: pairSel ? pairSel.num : numeroBrouillon,
    titre, prix, quantite: qty, etat: cond, description: desc,
    photos: photos.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s)),
    categorie: cat ? { id: cat.categoryId, nom: cat.categoryName, requis: cat.required || [] } : null,
    aspects: asp,
    cover: (pairSel && pairSel.cover) || null,
    // Le compte eBay choisi (seulement s'il y a un choix) : le brouillon rouvert
    // le retrouve, et la vue d'un compte ne montre que les siens.
    ...(plusieursPub ? { compte: comptePub } : {}),
    // ⚠️ `undefined`, jamais '' : `{ ...avant, ...brouillonCourant() }` doit
    // EFFACER une ancienne valeur, et JSON jette `undefined` — un brouillon sans
    // règle garde exactement la forme d'avant.
    offreAccepte: offreA.trim() || undefined,
    offreRefuse: offreR.trim() || undefined,
    offreSousMoitie: (offreTropBas && offreBasOk) || undefined,
  });
  // Construit le payload OU dit ce qui manque — une seule règle pour vérifier
  // ET publier (§11) : impossible de vérifier autre chose que ce qu'on publie.
  const buildItem = () => itemDeBrouillon(brouillonCourant());
  // ── ENREGISTRER EN BROUILLON : rien ne part chez eBay ─────────────────────
  // Relire-fusionner-écrire sur SA ligne `ebay_brouillons` ; une lecture ratée
  // n'écrit RIEN (sinon ses autres brouillons seraient effacés) — et on le dit.
  const enregistrerBrouillon = async () => {
    if (!titre.trim()) { setBrouillonMsg('Mets au moins un titre pour l\'enregistrer.'); return; }
    setEnregistre(true); setBrouillonMsg('');
    const id = brouillonId || idBrouillonEbay();
    const maintenant = Date.now();
    // (6 octobre) Un brouillon déjà PARTI (programmé ou publié entre-temps,
    // depuis la liste ou un autre onglet) ne se réécrit pas : le remettre en
    // « brouillon » le ferait ressortir de la liste des programmées, avec un
    // identifiant d'envoi déjà consommé chez eBay — et « Publier » créerait
    // une seconde annonce. On relit la ligne, on ne touche à rien, on le dit.
    let parti = '';
    const r = await modifierBrouillonsEbay((items) => {
      const avant = items[id] || {};
      if (avant.etatBrouillon && avant.etatBrouillon !== 'brouillon') { parti = avant.etatBrouillon; return false; }
      items[id] = { ...avant, ...brouillonCourant(), id, creeLe: avant.creeLe || maintenant, majLe: maintenant, etatBrouillon: 'brouillon', verif: null, envoi: null };
      return items;
    });
    setEnregistre(false);
    if (r.ok && parti) { setBrouillonMsg(parti === 'programmee' ? 'Ce brouillon a été programmé sur eBay entre-temps — rien n\'a été modifié. Pour le changer, annule d\'abord sa programmation (« Programmées sur eBay »).' : 'Ce brouillon a été publié sur eBay entre-temps — rien n\'a été modifié.'); if (onBrouillon) onBrouillon(r.items); return; }
    if (r.ok) { setBrouillonId(id); setBrouillonMsg('✓ Brouillon enregistré — rien n\'est parti chez eBay.'); if (onBrouillon) onBrouillon(r.items); }
    else setBrouillonMsg(r.raison === 'lecture' ? 'Je n\'ai pas pu relire tes brouillons — rien n\'a été enregistré (tes brouillons sont intacts). Réessaie dans un instant.' : 'L\'enregistrement a échoué — réessaie dans un instant.');
  };
  // ── ROUVRIR UN BROUILLON ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (!brouillon || !brouillon.id) return;
    const d = brouillon;
    setBrouillonId(d.id); setNumeroBrouillon(d.numero ? String(d.numero) : '');
    setPairId(d.pairId || null); setPickerOpen(false);
    setTitre(String(d.titre || '')); setPrix(String(d.prix == null ? '' : d.prix)); setQty(String(d.quantite || '1'));
    setCond(String(d.etat || '3000')); setDesc(String(d.description || '')); setPhotos((d.photos || []).join('\n'));
    setAsp(d.aspects || {}); setRes(null); setCheck(null); setBrouillonMsg('');
    setCompteChoisi(d.compte ? String(d.compte) : null);
    setOffreA(String(d.offreAccepte || '')); setOffreR(String(d.offreRefuse || '')); setOffreBasOk(d.offreSousMoitie === true);
    const c0 = d.categorie && d.categorie.id ? d.categorie : null;
    if (c0) {
      const requis = c0.requis || [];
      const autres = Object.keys(d.aspects || {}).filter((n) => !requis.includes(n));
      setCat({ categoryId: c0.id, categoryName: c0.nom || c0.id, required: requis, attributs: [...requis.map((n) => ({ nom: n, requis: true, mode: 'FREE_TEXT', valeurs: [] })), ...autres.map((n) => ({ nom: n, requis: false, mode: 'FREE_TEXT', valeurs: [] }))], cats: [], conditions: null });
    } else setCat(null);
    setOuvert(true);
    try { setTimeout(() => { if (racine.current && racine.current.scrollIntoView) racine.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); } catch (_) {}
    // Les listes de valeurs d'eBay (pour les menus) se rechargent à côté ; ses
    // valeurs à lui ne sont jamais remplacées.
    if (c0 && d.titre) {
      let stop = false;
      appelEbay({ action: 'pubinfo', title: d.titre, categoryId: c0.id, ...corpsCompteEbay(d.compte || comptePub) }).then(({ j }) => { if (stop) return; const c = catDepuisPubinfo(j, c0.nom); if (c) setCat(c); });
      return () => { stop = true; };
    }
  }, [brouillon]);
  // VÉRIFIER À BLANC (VerifyAddFixedPriceItem) : eBay valide exactement ce qu'on
  // publierait et renvoie les frais, SANS rien créer. Le filet pour la première
  // publication — les refus (attribut, photo) remontent avant d'engager.
  const verifier = async () => {
    const b = buildItem(); if (b.err) { setRes({ err: b.err }); setCheck(null); return; }
    setVerif(true); setRes(null); setCheck(null);
    try {
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'pubverify', item: b.item, ...corpsCompteEbay(comptePub) }) });
      const j = await r.json();
      // Les frais LUS PAR NOM (le total est `ListingFee`, jamais une somme).
      // (9 octobre) Les avertissements d'eBay se VOIENT (la route les rendait,
      // l'écran les jetait) — une catégorie qui n'accepte pas les offres le dit ici.
      if (j && j.ok) setCheck({ ok: true, fees: j.fees, frais: j.frais || null, avertissements: Array.isArray(j.avertissements) ? j.avertissements.filter(Boolean).map(String) : [] });
      else setCheck({ err: (j && j.error) || 'eBay refuserait cette annonce.' });
    } catch (_) { setCheck({ err: 'Vérification impossible (réseau).' }); }
    setVerif(false);
  };
  // ── CE QUI EMPÊCHE DE PUBLIER (6 octobre) ─────────────────────────────────
  // Revue contradictoire, prouvée : « Publier » ne vérifiait RIEN, alors que le
  // planificateur refuse une paire vendue ou déjà sur eBay. Un brouillon rouvert
  // d'une paire vendue partait ; une paire PROGRAMMÉE recevait une seconde
  // annonce. Les MÊMES règles (§11) : déjà vendue (toutes plateformes, par le
  // N°), « pas su » ⇒ rien ne part, déjà en vente ou programmée sur eBay, plus
  // en vente sur Vinted. Sans N°, aucune identité : elle part « pas reliée »,
  // comme avant. Le bouton est grisé et la raison dite UNE fois (jamais caché).
  const gardePublier = () => {
    const d = brouillonCourant();
    const n = d.numero ? cleNum(d.numero) : '';
    if (!n) return null;
    const ou = ventes && ventes.vendus && typeof ventes.vendus.get === 'function' ? ventes.vendus.get(n) : null;
    if (ou) return { k: 'vendue', t: `La paire N°${n} est déjà vendue sur ${ou} — rien ne sera publié.` };
    if (!pairSel && d.pairId && vendusVinted && typeof vendusVinted.has === 'function' && vendusVinted.has(String(d.pairId))) return { k: 'vendue', t: `La paire N°${n} est vendue sur Vinted — rien ne sera publié.` };
    if (!ventes || ventes.enCours) return { k: 'en-cours', t: `Je vérifie encore que la paire N°${n} n'est pas déjà vendue (Vinted, eBay, Leboncoin)…` };
    if (Array.isArray(ventes.pasSu) && ventes.pasSu.length) return { k: 'pas-su', t: `Je n'ai pas pu vérifier ${ventes.pasSu.length === 1 ? ventes.pasSu[0] : ventes.pasSu.slice(0, -1).join(', ') + ' ni ' + ventes.pasSu[ventes.pasSu.length - 1]} : je ne publie pas une paire qui est peut-être déjà vendue. Rouvre l'écran dans un moment.` };
    const deja = dejaSurEbay && typeof dejaSurEbay.get === 'function' ? dejaSurEbay.get(n) : null;
    if (deja) {
      const t = deja.debut && Number.isFinite(Date.parse(deja.debut)) ? ` (${quandParisTexte(Date.parse(deja.debut))})` : '';
      return deja.etat === 'programmee'
        ? { k: 'deja-programmee', t: `La paire N°${n} est déjà programmée sur eBay${t} — une paire, une annonce : rien ne sera publié. Si tu as annulé sa programmation sur eBay, « Relire chez eBay » plus bas, puis recommence.` }
        : { k: 'deja-en-ligne', t: deja.via ? `Cette paire est déjà en vente sur eBay sous la N°${deja.via} (même photo que la N°${n}) — une paire, une annonce : rien ne sera publié.` : `La paire N°${n} est déjà en vente sur eBay — une paire, une annonce : rien ne sera publié.` };
    }
    if (!pairSel) {
      if (enLigne && typeof enLigne.has === 'function') return { k: 'plus-en-vente', t: `La paire N°${n} n'est plus en vente sur Vinted — rien ne sera publié. Si tu l'as encore, remets-la en ligne sur Vinted, puis reviens.` };
      return { k: 'pas-su', t: `Je n'ai pas pu vérifier que la paire N°${n} est encore en vente sur Vinted — rouvre l'écran dans un moment.` };
    }
    return null;
  };
  const garde = gardePublier();
  const publier = async () => {
    const b = buildItem(); if (b.err) { setRes({ err: b.err }); return; }
    const g = gardePublier(); if (g) { setRes({ err: g.t }); return; }
    // (9 octobre) Une RÈGLE D'OFFRE part avec l'annonce : eBay vendra la paire
    // sans lui demander. TOUJOURS une confirmation qui le dit (même avec un
    // seul compte) — le compte y est nommé s'il y en a plusieurs.
    const offre = b.item.offre || null;
    if (offre) {
      const prixP = Number(String(b.item.price).replace(',', '.'));
      let achatP;
      try { if (pairSel) achatP = prixAchatDe((load('vinted_annonce_numeros', {}) || {})[pairSel.id], load('vinted_buyprice_by_num', {}) || {}); } catch (_) { achatP = undefined; }
      const lignes = [
        `« ${titre || 'cette paire'} » sera mise en vente à ${eurEbay(prixP)}${plusieursPub ? ` sur le compte eBay « ${nomComptePub} »` : ''}. Toute offre de ${eurEbay(offre.accepte)} ou plus ${OFFRE_VEND_LA_PAIRE}.`,
        offre.refuse != null && `Toute offre sous ${eurEbay(offre.refuse)} sera refusée par eBay.`,
        !b.item.numero && 'Cette annonce n\'est reliée à aucune paire : si eBay la vend, VRM ne saura pas quelle paire retirer de Vinted. Choisis la paire d\'abord.',
        typeof achatP === 'number' && offre.accepte < achatP && `C'est sous ton prix d'achat (${eurEbay(achatP)}), avant frais eBay.`,
        offre.sousMoitie && `C'est ${Math.round(offre.accepte / prixP * 100)} % du prix de l'annonce — tu l'as confirmé.`,
        b.item.numero && plusieursPub && `VRM vérifie avant que la paire N°${b.item.numero} n'est en vente sur AUCUN de tes comptes eBay.`,
      ].filter(Boolean);
      const ok = await askConfirm({ title: `Publier, et laisser eBay accepter les offres dès ${eurEbay(offre.accepte)} ?`, desc: lignes.join('\n\n'), ok: 'Oui, publier', cancel: 'Annuler' });
      if (!ok) return;
    } else if (plusieursPub) {
      // Plusieurs comptes : la confirmation NOMME le compte où elle part.
      const ok = await askConfirm({
        title: `Publier sur ton compte eBay « ${nomComptePub} » ?`,
        desc: `« ${titre || 'cette paire'} » sera mise en vente sur le compte eBay « ${nomComptePub} », tout de suite.${b.item.numero ? ` VRM vérifie avant que la paire N°${b.item.numero} n'est en vente sur AUCUN de tes comptes eBay.` : ''}`,
        ok: 'Oui, publier', cancel: 'Annuler',
      });
      if (!ok) return;
    }
    setBusy(true); setRes(null); setCheck(null);
    // `appelEbay` ne lève jamais : une coupure (code 0) ou une réponse illisible
    // n'est PAS « impossible » — la requête a pu arriver, l'annonce exister.
    const { code, j } = await appelEbay({ action: 'publish', item: b.item, ...corpsCompteEbay(comptePub) });
    if (j && j.ok) {
      if (plusieursPub && onCompte) onCompte(comptePub);
      // Ce qu'eBay a fait de la règle (relue après l'ajout), et ce qu'il signale.
      const mo = offre ? messageOffreCreation(j.offre, offre) : null;
      const avert = Array.isArray(j.avertissements) ? j.avertissements.filter(Boolean).map(String) : [];
      try { const pid = (b && b.pairId) || pairId; if (j.itemId && pid) noterLienEbay(j.itemId, pid, b && b.item && b.item.numero, 'publication'); } catch (_) {}
      setRes({ ok: true, url: j.url, itemId: j.itemId, sku: j.sku || null, compte: plusieursPub ? nomComptePub : '', offreMsg: mo ? mo.msg : '', offreOk: !!(mo && mo.ok), offreIssue: mo ? mo.issue : '', avertissements: avert }); if (onPublie) onPublie(comptePub);
      // Publiée depuis un brouillon : il sort de la liste des brouillons.
      if (brouillonId) { const id = brouillonId; modifierBrouillonsEbay((items) => { if (items[id]) items[id] = { ...items[id], etatBrouillon: 'en-ligne', programme: { itemId: j.itemId, debut: null, demande: null, at: Date.now() } }; return items; }).then((w) => { if (w.ok && onBrouillon) onBrouillon(w.items); }); }
    }
    else if (code === 0 || !j || code === 504 || (j && j.reason === 'incertain')) setRes({ err: (j && j.error) || 'eBay n\'a pas répondu — je ne sais pas si l\'annonce est partie. Rafraîchis depuis eBay (onglet « Compte eBay ») avant de recommencer.' });
    else setRes({ err: (j && j.error) || 'eBay a refusé la publication.' });
    setBusy(false);
  };
  const lab = { fontSize: 12.5, color: C.muted, display: 'block', marginBottom: 6, fontWeight: 500 };
  // ⚠️ fontSize 16 MINIMUM : en dessous, iOS Safari ZOOME automatiquement dès
  // qu'on touche un champ (plainte de Julien « ça zoome »). 16px = pas de zoom.
  const inp = { width: '100%', boxSizing: 'border-box', border: '1px solid transparent', background: C.card2, color: C.text, borderRadius: 12, padding: '13px 14px', fontSize: 16, fontFamily: 'inherit', outline: 'none' };
  // Un « bloc » = une section de l'annonce, comme les étapes du formulaire eBay :
  // eyebrow numéroté + carte. §7 : une seule teinte d'accent, rayons 10/12.
  const urls = photos.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
  const setUrls = (arr) => { setPhotos(arr.join('\n')); setCheck(null); };
  const reset = () => { setOuvert(false); setRes(null); setCheck(null); setTitre(''); setPrix(''); setCat(null); setAsp({}); setPhotos(''); setDesc(''); setPairId(null); setBrouillonId(null); setNumeroBrouillon(''); setBrouillonMsg(''); setOffreA(''); setOffreR(''); setOffreBasOk(false); };
  // (17 oct.) Une paire n'est proposée qu'UNE fois, même sous deux N° (même
  // photo exacte, `jumellesParPhoto`) : on garde celle déjà sur eBay, sinon
  // l'annonce la plus récente ; l'autre numéro est dit sur la ligne.
  const jumelles = React.useMemo(() => jumellesParPhoto(paires, (k) => !!(dejaSurEbay && typeof dejaSurEbay.has === 'function' && dejaSurEbay.has(k) && !(dejaSurEbay.get(k) || {}).via)), [paires, dejaSurEbay]);
  const listePaires = paires.filter(p => { const j = jumelles.get(String(p.id)); if (j && j.gardeId !== String(p.id)) return false; const q = pairQ.trim().toLowerCase(); return !q || p.num.includes(q) || (p.title || '').toLowerCase().includes(q) || String(p.taille).toLowerCase().includes(q); });
  const nJumellesMasquees = paires.filter(p => { const j = jumelles.get(String(p.id)); return j && j.gardeId !== String(p.id); }).length;
  const eur=n=>n==null?'—':(Math.round(n*100)/100).toFixed(2).replace('.',',')+' €';
  const condLabel = (EBAY_CONDITIONS.find(([v]) => v === cond) || [, 'Occasion'])[1];
  if (!ouvert) return (
    <button type="button" data-poster="ebay" onClick={() => setOuvert(true)} style={{ marginTop: 10, width: '100%', border: 'none', background: C.accent, color: '#fff', borderRadius: 999, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Icon name="tag" size={17}/> Vendre une paire sur eBay
    </button>
  );
  return (
    <div ref={racine} data-publier-brouillon-id={brouillonId || ''} style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 14, background: C.bg || C.card, overflow: 'hidden', boxShadow: C.shadow, scrollMarginTop: 12 }}>
      {/* En-tête façon feuille de vente eBay */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: `${C.accent}15`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="tag" size={17}/></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Vendre sur eBay</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{brouillonId ? 'Brouillon enregistré — modifie-le, enregistre-le ou publie-le' : 'Ton annonce, comme sur eBay — vérifiée avant publication'}</div>
        </div>
        <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" style={{ flexShrink: 0, border: 'none', background: 'transparent', color: C.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {res && res.ok ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 26, background: `${C.accent}15`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>Annonce publiée sur eBay{res.compte ? <span data-publie-compte={res.compte}> · {res.compte}</span> : null}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: res.sku ? 4 : 14 }}>N° {res.itemId}</div>
          {/* Le lien à la paire se DIT : c'est lui qui fera apparaître « vendue
              sur Vinted → retire-la d'eBay » le jour où elle part ailleurs. */}
          <div data-publie-sku={res.sku || ''} style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>{res.sku
            ? <>Reliée à la paire par la référence <b style={{ color: C.text }}>{res.sku}</b> : si elle se vend sur Vinted, VRM te proposera de la retirer d'eBay.</>
            : <>Pas reliée à une paire : relie-la depuis sa carte dans Annonces.</>}</div>
          {res.offreMsg && <div data-publie-offre={res.offreOk ? 'ok' : 'warn'} data-publie-offre-issue={res.offreIssue || ''} style={{ fontSize: 12.5, color: res.offreOk ? C.text : C.warn, marginBottom: 10, lineHeight: 1.5 }}>{res.offreMsg}</div>}
          {Array.isArray(res.avertissements) && res.avertissements.length > 0 && <div data-publie-avertissements={res.avertissements.length} style={{ fontSize: 12, color: C.warn, marginBottom: 12, lineHeight: 1.5 }}>eBay signale : {res.avertissements.map((a) => `« ${a} »`).join(' · ')}</div>}
          <a href={res.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', border: 'none', background: C.accent, color: '#fff', borderRadius: 999, padding: '12px 20px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Voir l'annonce sur eBay ↗</a>
          <div style={{ marginTop: 12 }}><button type="button" onClick={reset} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 10, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Terminé</button></div>
        </div>
      ) : (<>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* (9 octobre) SUR QUEL COMPTE eBAY — seulement s'il y en a plusieurs. */}
          {plusieursPub && (
            <div data-ebay-publier-compte={comptePub} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '10px 12px' }}>
              <label htmlFor="vrm-ebay-compte-pub" style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Publier sur le compte</label>
              <select id="vrm-ebay-compte-pub" value={comptePub} onChange={(e) => { setCompteChoisi(e.target.value); setCheck(null); }}
                style={{ flex: '0 1 240px', maxWidth: '100%', padding: '8px 11px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                {comptesPub.map((c) => <option key={c.ref} value={c.ref}>{nomCompteEbay(c)}</option>)}
              </select>
            </div>
          )}

          {/* APERÇU — comme la vignette d'annonce eBay : photo, titre, prix. Ne
              s'affiche que s'il y a de quoi montrer (pas de cadre vide). */}
          {(urls.length > 0 || titre.trim()) && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: 10, boxShadow: C.shadow }}>
              <div style={{ flexShrink: 0, width: 66, height: 66, borderRadius: 10, overflow: 'hidden', background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {urls[0] ? <PhotoVinted src={urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="tag" size={20} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: titre.trim() ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titre.trim() || 'Titre de ton annonce…'}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                  <span className="vrm-display" style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{prix.trim() ? eur(Number(String(prix).replace(',', '.')) || 0) : '—'}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{condLabel}{urls.length ? ` · ${urls.length} photo${urls.length > 1 ? 's' : ''}` : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* 1 — LA PAIRE : on CHOISIT une paire (comme sur eBay on choisit son
              objet), ses photos partent toutes seules — plus aucun lien à coller. */}
          <BlocEbay n="1" titre="La paire à vendre" right={pairSel ? <button type="button" onClick={() => setPickerOpen(true)} style={{ border: 'none', background: 'transparent', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Changer</button> : null}>
            {(!pairSel || pickerOpen) ? (
              paires.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Aucune paire numérotée n'est encore chargée sur cet appareil. Ouvre l'écran <b>Annonces</b> une fois (sur l'ordinateur où l'extension tourne) : tes paires — avec leurs photos — apparaîtront ici.</div>
              ) : (<>
                <input value={pairQ} onChange={e => setPairQ(e.target.value)} placeholder="Chercher : n°, marque, pointure…" style={{ ...inp, marginBottom: 10 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
                  {listePaires.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, padding: '6px 2px' }}>Aucune paire ne correspond.</div>}
                  {nJumellesMasquees > 0 && <div data-jumelles-masquees={nJumellesMasquees} style={{ fontSize: 11.5, color: C.muted, padding: '0 2px', lineHeight: 1.45 }}>{nJumellesMasquees === 1 ? 'Une paire porte deux N° (même photo sur deux fiches) : elle n\'est proposée qu\'une fois.' : `${nJumellesMasquees} paires portent deux N° (même photo sur deux fiches) : chacune n'est proposée qu'une fois.`}</div>}
                  {listePaires.slice(0, 120).map(p => (
                    <button key={p.id} type="button" data-choix-paire={p.num} onClick={() => choisirPaire(p)} style={{ display: 'flex', flexShrink: 0, minHeight: 64, alignItems: 'center', gap: 11, textAlign: 'left', border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {p.cover ? <PhotoVinted src={p.cover} alt="" loading="lazy" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: C.bg }} /> : <span style={{ width: 46, height: 46, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="vrm-display" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.accent }}>N°{p.num}</span>
                        <span style={{ display: 'block', fontSize: 12.5, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Titre pas encore capté'}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{p.taille ? `Pointure ${p.taille} · ` : ''}{p.photos.length} photo{p.photos.length > 1 ? 's' : ''}{(() => { const k = cleNum(p.num); const ou = ventes && ventes.vendus && typeof ventes.vendus.get === 'function' ? ventes.vendus.get(k) : null; const deja = dejaSurEbay && typeof dejaSurEbay.get === 'function' ? dejaSurEbay.get(k) : null;
                          const jm = jumelles.get(String(p.id));
                          return <>{ou ? <b data-paire-vendue={k} style={{ color: C.warn }}> · déjà vendue sur {ou}</b> : deja ? <b data-paire-deja-ebay={deja.etat} style={{ color: C.warn }}> · {deja.etat === 'programmee' ? 'déjà programmée sur eBay' : 'déjà en vente sur eBay'}{deja.via ? ` (sous la N°${deja.via}, même photo)` : ''}</b> : null}{jm ? <span data-paire-jumelle={jm.autres.map(cleNum).join(',')}> · même paire que la N°{jm.autres.join(', N°')} (même photo)</span> : null}</>; })()}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>)
            ) : (<>
              {/* Paire choisie : ses photos, en vignettes (retirables). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="vrm-display" style={{ fontSize: 13.5, fontWeight: 800, color: C.accent }}>N°{pairSel.num}</span>
                <span style={{ fontSize: 12.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pairSel.title}</span>
              </div>
              {urls.length > 0 ? (
                <div className="vrm-rangee" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {urls.map((u, i) => (
                    <div key={u + i} style={{ position: 'relative', width: 74, height: 74, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0, background: C.bg }}>
                      <PhotoVinted src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))} aria-label="Retirer" style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,.62)', color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, textAlign: 'center', background: 'rgba(0,0,0,.6)', color: '#fff', padding: '2px 0', fontWeight: 600 }}>couverture</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.warn, lineHeight: 1.45 }}>{photosEtat === 'cherche' ? 'Je récupère ses photos sur Vinted…' : "Cette paire n'a pas encore de photo captée. Rouvre son annonce sur Vinted (avec l'extension à jour) puis reviens."}</div>
              )}
              {/* ⚠️ HONNÊTE sur le nombre : si Vinted a plus de photos que ce
                  qu'on a capté (carrousel lazy tant que l'extension à jour n'est
                  pas passée), on le DIT et on envoie rouvrir l'annonce. */}
              {photosEtat === 'cherche' && urls.length > 0 ? (
                <div data-ebay-photos="cherche" style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Je récupère ses autres photos sur Vinted…</div>
              ) : photosEtat && photosEtat.raison ? (
                <div data-ebay-photos="echec" style={{ fontSize: 12, color: C.warn, marginTop: 8, lineHeight: 1.45 }}>Photos pas récupérées : {photosEtat.raison}. Ouvre son annonce sur Vinted, puis rechoisis la paire.</div>
              ) : pairSel.nPhotos != null && urls.length < pairSel.nPhotos ? (
                <div style={{ fontSize: 12, color: C.warn, marginTop: 8, lineHeight: 1.45, background: `${C.warn}12`, border: `1px solid ${C.warn}`, borderRadius: 8, padding: '8px 10px' }}>Seulement {urls.length} photo{urls.length > 1 ? 's' : ''} captée{urls.length > 1 ? 's' : ''} sur {pairSel.nPhotos}. Rouvre l'annonce sur Vinted (extension à jour) pour les avoir toutes — elles s'ajouteront ici automatiquement.</div>
              ) : (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>Ces photos viennent de ton annonce Vinted. La 1ʳᵉ sert de couverture ; tu peux en retirer.</div>
              )}
            </>)}
          </BlocEbay>

          {/* 2 — TITRE & CATÉGORIE */}
          <BlocEbay n="2" titre="Titre & catégorie" right={<span style={{ fontSize: 11, color: titre.length > 75 ? C.warn : C.muted }}>{titre.length}/80</span>}>
            <input value={titre} maxLength={80} onChange={e => { setTitre(e.target.value); setCat(null); setCheck(null); }} placeholder="Nike Air Max 1 Aquatone Bleu Taille 44" style={inp} />
            {/* Rédaction IA : optimise le titre à partir des VRAIES infos de la
                paire (jamais d'invention, api/ai). Affiché seulement si l'IA est
                branchée — sinon le titre reste celui de la paire, déjà rempli. */}
            {/* Bouton IA retiré le 30 septembre (rédaction IA abandonnée). */}
            {false && aiPret && (
              <button type="button" onClick={titreIA} disabled={aiBusy} style={{ marginTop: 8, width: '100%', border: `1px solid ${C.accent}`, background: `${C.accent}0d`, color: C.accent, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: aiBusy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: aiBusy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>{aiBusy ? 'L\'IA rédige…' : '✨ Optimiser le titre avec l\'IA'}</button>
            )}
            {aiWhy && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>✨ {aiWhy}</div>}
            <div style={{ marginTop: 10 }}>
              {!cat ? (
                <button type="button" onClick={() => analyser()} disabled={analyse || !titre.trim()} style={{ width: '100%', border: `1px solid ${C.accent}`, background: `${C.accent}12`, color: C.accent, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 700, cursor: (analyse || !titre.trim()) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (analyse || !titre.trim()) ? 0.5 : 1 }}>{analyse ? 'eBay cherche la catégorie…' : 'Trouver la catégorie eBay'}</button>
              ) : (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${C.accent}0d`, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px' }}>
                  <Icon name="check" size={15} />
                  <span style={{ fontSize: 12.5, color: C.text }}>Catégorie eBay : <b>{cat.categoryName}</b> <span style={{ color: C.muted }}>({cat.categoryId})</span></span>
                </div>
                {/* Les autres catégories proposées par eBay — si la 1ʳᵉ n'est pas
                    la bonne, on en choisit une autre (ses caractéristiques se
                    rechargent). Comme sur eBay ; rien n'est deviné. */}
                {Array.isArray(cat.cats) && cat.cats.filter(c => c.categoryId !== cat.categoryId).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Pas la bonne ? Autres catégories proposées par eBay :</div>
                    <div className="vrm-rangee" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {cat.cats.filter(c => c.categoryId !== cat.categoryId).map(c => (
                        <button key={c.categoryId} type="button" onClick={() => analyser(c.categoryId, c.categoryName)} disabled={analyse} style={{ border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: analyse ? 'default' : 'pointer', fontFamily: 'inherit' }}>{c.categoryName}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>)}
            </div>
          </BlocEbay>

          {cat && (<>
            {/* 3 — CARACTÉRISTIQUES : la MÊME interface qu'eBay. Chaque champ et ses
                valeurs viennent d'eBay (get_item_aspects_for_category) — listes
                déroulantes quand eBay en fournit, comme sur son site. Les
                obligatoires (✳) d'abord ; les facultatives sous un dépliant. */}
            <BlocEbay n="3" titre="Caractéristiques" right={(() => { const reste = (cat.required || []).filter(n => !String(asp[n] || '').trim()).length; return <span style={{ fontSize: 11, fontWeight: 700, color: reste ? C.warn : C.accent }}>{reste ? `${reste} requis` : '✓ complet'}</span>; })()}>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>Ces champs viennent d'eBay pour « {cat.categoryName} » — les mêmes que sur son site. ✳ = obligatoire. VRM a pré-rempli ce qu'il pouvait prouver ; complète le reste.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 10 }}>
                <div><label style={lab}>État</label><select value={cond} onChange={e => { setCond(e.target.value); setCheck(null); }} style={inp}>{(cat.conditions && cat.conditions.length ? cat.conditions.map(c => [c.id, c.label]) : EBAY_CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                {(cat.attributs || []).filter(a => a.requis).map(a => (
                  <div key={a.nom}><label style={lab}>{a.nom} <span style={{ color: C.accent }}>✳</span></label>{champAttr(a)}</div>
                ))}
              </div>
              {(() => {
                const opt = (cat.attributs || []).filter(a => !a.requis);
                if (!opt.length) return null;
                return (<>
                  <button type="button" onClick={() => setPlusAttr(v => !v)} style={{ marginTop: 12, border: 'none', background: 'transparent', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{plusAttr ? '− Moins de caractéristiques' : `+ Plus de caractéristiques (${opt.length})`}</button>
                  {plusAttr && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 10, marginTop: 10 }}>
                      {opt.map(a => (<div key={a.nom}><label style={lab}>{a.nom}</label>{champAttr(a)}</div>))}
                    </div>
                  )}
                </>);
              })()}
            </BlocEbay>

            {/* 4 — PRIX & LIVRAISON : on CHOISIT le mode de livraison (comme sur
                eBay), pas juste un montant. Le jeton part à eBay ; « Vérifier »
                confirme qu'il est accepté avant toute publication. */}
            <BlocEbay n="4" titre="Prix & livraison">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 10 }}>
                <div><label style={lab}>Prix (€)</label><input value={prix} onChange={e => { setPrix(e.target.value); setCheck(null); setOffreBasOk(false); }} inputMode="decimal" placeholder="ex. 74" style={inp} /></div>
                <div><label style={lab}>Quantité</label><input value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" style={inp} /></div>
              </div>
              {/* (9 octobre) LA RÈGLE D'OFFRE, facultative : c'est eBay qui
                  acceptera, au montant fixé ici. Validée contre le prix tapé. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 10, marginTop: 10 }}>
                <div><label style={lab}>Accepter les offres dès (€) — facultatif</label><input value={offreA} onChange={e => { setOffreA(e.target.value); setCheck(null); setOffreBasOk(false); }} inputMode="decimal" placeholder="montant en €" data-publier-offre-accepte="1" style={inp} /></div>
                <div><label style={lab}>Refuser les offres sous (€) — facultatif</label><input value={offreR} onChange={e => { setOffreR(e.target.value); setCheck(null); }} inputMode="decimal" placeholder="montant en €" data-publier-offre-refuse="1" style={inp} /></div>
              </div>
              {offreA.trim() && vOffre && vOffre.ok && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>eBay acceptera seul toute offre de ce montant ou plus : la paire sera vendue à ce prix.</div>}
              {vOffre && !vOffre.ok && <div data-publier-offre-erreur="1" style={{ fontSize: 12, color: C.warn, marginTop: 6, lineHeight: 1.45 }}>{vOffre.err}</div>}
              {offreTropBas && (
                <label data-publier-offre-sous-moitie="1" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.warn, marginTop: 8, lineHeight: 1.4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={offreBasOk} onChange={(e) => { setOffreBasOk(e.target.checked); setCheck(null); }} style={{ marginTop: 2 }} />
                  <span>Je fixe volontairement {eurEbay(vOffre.accepte)} — {Math.round(vOffre.accepte / prixOffre * 100)} % du prix.</span>
                </label>
              )}
              {/* ── LIVRAISON GÉRÉE PAR eBay (Julien, 27 sept. : « c'est MOI qui
                  choisis le transporteur, mais c'est eBay qui fixe le montant »).
                  MESURÉ 3 fois à blanc : eBay REFUSE tout <ShippingDetails> envoyé
                  par l'API — transporteur + coût ET transporteur seul (« Item.
                  ShippingDetails non valides ») ; seul un item SANS livraison passe.
                  Donc le choix du transporteur se fait DANS eBay (pas dans VRM), et
                  eBay fixe le prix. VRM publie sans toucher à la livraison. */}
              <div style={{ marginTop: 12, display: 'flex', gap: 11, alignItems: 'flex-start', background: `${C.accent}0D`, border: `1px solid ${C.accent}`, borderRadius: 12, padding: '12px 13px' }}>
                <Icon name="box" size={20} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
                <div style={{ minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                  <b>La livraison est gérée par eBay.</b> Le <b>transporteur</b> (Mondial Relay, Chronopost, Colissimo…) se choisit <b>dans eBay</b>, et c'est <b>eBay</b> qui fixe le montant, l'encaisse et te fournit le bordereau. <span style={{ color: C.muted }}>VRM publie l'annonce sans toucher à la livraison — tu ne paies jamais le port. (eBay refuse qu'une appli fixe le transporteur ou le prix à sa place : vérifié.)</span>
                </div>
              </div>
            </BlocEbay>

            {/* 5 — DESCRIPTION */}
            <BlocEbay n="5" titre="Description">
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="État, particularités, authenticité… (le titre est repris si tu laisses vide)" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </BlocEbay>

            {/* Vérif à blanc : eBay contrôle tout et donne les frais, sans rien créer. */}
            {/* Les frais LUS PAR NOM (5 octobre) : le total est `ListingFee`,
                jamais la somme de tous les frais (elle doublait). Absent ⇒ « — ». */}
            {check && check.ok && <div data-publier-frais={check.fees == null ? 'pas-su' : String(check.fees)} style={{ fontSize: 12.5, color: C.text, background: `${C.accent}10`, border: `1px solid ${C.accent}`, borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>✓ <b>eBay accepterait cette annonce.</b> Frais annoncés par eBay : {lignesFraisEbay(check.frais, false).map((l) => `${l.nom} ${l.montant == null ? '—' : eurEbay(l.montant)}`).join(' · ')} · <b>total {check.fees == null ? '— (eBay ne l\'a pas annoncé)' : eurEbay(check.fees)}</b>. Tu peux publier.</div>}
            {check && check.ok && Array.isArray(check.avertissements) && check.avertissements.length > 0 && <div data-publier-avertissements={check.avertissements.length} style={{ fontSize: 12.5, color: C.warn, lineHeight: 1.5 }}>eBay signale : {check.avertissements.map((a) => `« ${a} »`).join(' · ')}</div>}
            {check && check.err && <div style={{ fontSize: 12.5, color: C.warn, background: `${C.warn}12`, border: `1px solid ${C.warn}`, borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>⚠️ eBay signale : {check.err}<br /><span style={{ color: C.muted }}>Rien n'a été publié — corrige et revérifie.</span></div>}

            {garde && <div data-publier-garde={garde.k} style={{ fontSize: 12.5, color: garde.k === 'en-cours' ? C.muted : C.warn, lineHeight: 1.5 }}>{garde.t}</div>}
            <div className="vrm-rangee" style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={verifier} disabled={verif || busy} style={{ flex: 1, border: 'none', background: C.card2, color: C.text, borderRadius: 999, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: (verif || busy) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (verif || busy) ? 0.6 : 1 }}>{verif ? 'eBay vérifie…' : 'Vérifier sans publier'}</button>
              <button type="button" data-publier-ebay="1" onClick={publier} disabled={busy || verif || !!garde} style={{ flex: 1, border: 'none', background: C.accent, color: '#fff', borderRadius: 999, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: (busy || verif || garde) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (busy || verif || garde) ? 0.45 : 1 }}>{busy ? 'Publication…' : 'Publier sur eBay'}</button>
            </div>
          </>)}
          {/* ENREGISTRER EN BROUILLON (5 octobre) : rien ne part chez eBay. Il
              le retrouve dans « Brouillons », pour le reprendre ou le
              programmer plus tard. Possible dès qu'il y a un titre. */}
          {titre.trim() && (
            <button type="button" data-publier-brouillon={brouillonId || 'nouveau'} onClick={enregistrerBrouillon} disabled={enregistre || busy}
              style={{ width: '100%', border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 999, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: (enregistre || busy) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (enregistre || busy) ? 0.6 : 1 }}>
              {enregistre ? 'Enregistrement…' : (brouillonId ? 'Mettre à jour le brouillon' : 'Enregistrer en brouillon')}
            </button>
          )}
          {brouillonMsg && <div data-brouillon-msg="1" style={{ fontSize: 12.5, color: /^✓/.test(brouillonMsg) ? C.text : C.warn, lineHeight: 1.5 }}>{brouillonMsg}</div>}
        </div>
      </>)}
      {res && res.err && <div style={{ fontSize: 12.5, color: C.danger, margin: '0 14px 14px', lineHeight: 1.5 }}>{res.err}</div>}
    </div>
  );
}
function EbayConnexion({ onAnnonces, vue = '*', comptesEbay }) {
  const C = EBAY_SKIN;   // tout l'espace eBay est au look de l'appli eBay (Julien : « je veux exactement le même visuel que dans eBay »)
  const [st, setSt] = React.useState(null);          // {ready, canConsent} | null = en cours
  const [connected, setConnected] = React.useState(undefined); // true/false/null(pas su)/undefined(en cours)
  // (9 octobre) Ses comptes eBay, tels que la route les dit (pseudo, relié) —
  // jamais un jeton. `undefined` en cours · `null` pas su · tableau.
  const [comptesStatut, setComptesStatut] = React.useState(undefined);
  const [busy, setBusy] = React.useState(false);
  const [retour, setRetour] = React.useState('');
  const [deconnexion, setDeconnexion] = React.useState({});   // ref → '…' | message
  React.useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const e = p.get('ebay');
      if (e) {
        const compte = p.get('compte') || '';
        const r = p.get('raison') || '';
        setRetour(e === 'connecte' ? (p.get('nouveau') === '1' && compte ? `✓ Compte eBay « ${compte} » ajouté — il a ses propres annonces et ventes, choisis-le dans la liste « Compte » en haut.` : (compte ? `✓ Ton compte eBay « ${compte} » est bien relié.` : '✓ Ton compte eBay est bien relié.'))
          : e === 'refus' ? 'Connexion annulée sur eBay — tu peux réessayer.'
          : 'La connexion a échoué' + (r ? ` : ${RAISON_CONNEXION_EBAY[r] || r}` : '') + '.');
        p.delete('ebay'); p.delete('raison'); p.delete('compte'); p.delete('nouveau');
        window.history.replaceState(window.history.state, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
        if (e === 'connecte') signalerComptesEbay();
      }
    } catch (_) {}
  }, []);
  const lireStatut = React.useCallback(() => {
    return fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'status' }) })
      .then(r => r.json()).then(j => {
        setConnected(j && j.ok ? !!j.connected : null);
        setComptesStatut(j && j.ok ? (Array.isArray(j.comptes) ? j.comptes : null) : null);
      }).catch(() => { setConnected(null); setComptesStatut(null); });
  }, []);
  React.useEffect(() => {
    let stop = false;
    // (20 oct., audit) TROIS ÉTATS : une route qui ne répond pas (503, coupure,
    // réponse illisible) n'est PAS « eBay pas configuré ». Avant, tout échec
    // affichait « Ajoute tes clés eBay dans Vercel » — le mauvais geste, sur un
    // simple hoquet. Seul un `ready` booléen rendu par la route décide.
    fetch('/api/ebay').then(r => r.ok ? r.json() : null).then(j => { if (stop) return; setSt(j && typeof j.ready === 'boolean' ? { ready: j.ready, canConsent: !!j.canConsent } : { passu: true }); }).catch(() => { if (!stop) setSt({ passu: true }); });
    lireStatut();
    return () => { stop = true; };
  }, [lireStatut]);
  // `ajout` : « Connecter un AUTRE compte eBay » — eBay montre sa page de
  // connexion même si un compte est déjà ouvert dans ce navigateur.
  const connecter = async (ajout) => {
    setBusy(true);
    try {
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'authurl', state: 'vrm', ...(ajout === true ? { ajout: true } : {}) }) });
      const j = await r.json();
      if (j && j.ok && j.url) { window.location.href = j.url; return; }
      if (j && j.error) { setBusy(false); setRetour(j.error); return; }
    } catch (_) {}
    setBusy(false);
    setRetour("Impossible de démarrer la connexion — vérifie la configuration eBay (docs/ebay-api.md).");
  };
  // DÉCONNECTER UN compte : confirmé, et il NOMME le compte. Les autres ne sont
  // pas touchés (la route l'exige aussi : `confirme:true`).
  const deconnecter = async (c) => {
    const ref = c.principal ? 'principal' : c.cle;
    const nom = nomCompteEbay(c);
    // (9 octobre) Ses RÈGLES D'OFFRE restent posées chez eBay : eBay continuera
    // d'accepter — et VRM ne verra plus ces ventes. On le dit, avec le nombre.
    // (11 octobre, revue — tour 3) La MÊME règle que l'écran : une règle qu'eBay
    // tient peut-être est dite aussi ; une annonce terminée ne compte plus.
    const tR = texteReglesQuiRestent(await compterReglesEbay(comptesEbay, ref), 'deconnecter');
    const texteRegles = tR ? `\n\nSur ce compte : ${tR}` : '';
    const ok = await askConfirm({
      title: `Déconnecter le compte eBay « ${nom} » ?`,
      desc: `Tes autres comptes eBay ne sont pas touchés.\n\nVRM ne lira plus les annonces ni les ventes de « ${nom} », et ne publiera plus rien dessus ; ses ventes sortent aussi des totaux de VRM (chiffre d'affaires compris). Ses annonces restent en ligne sur eBay. Tu pourras le reconnecter : tu retrouveras tout.${texteRegles}`,
      ok: 'Oui, déconnecter', cancel: 'Annuler', danger: true,
    });
    if (!ok) return;
    setDeconnexion((m) => ({ ...m, [ref]: '…' }));
    const { j } = await appelEbay({ action: 'deconnecter', confirme: true, ...(c.principal ? {} : { compte: c.cle }) });
    if (j && j.ok) {
      setDeconnexion((m) => { const n = { ...m }; delete n[ref]; return n; });
      setRetour(`Compte eBay « ${nom} » déconnecté.`);
      signalerComptesEbay();
      lireStatut();
    } else setDeconnexion((m) => ({ ...m, [ref]: (j && j.error) || 'Je n\'ai pas pu le déconnecter — rien n\'a changé, réessaie.' }));
  };
  // ── Données eBay captées (annonces + ventes), lues dans la base comme le
  //    reste de l'app, et rafraîchies via l'action serveur `sync`. (9 octobre)
  //    CHAQUE compte a ses lignes ; on lit ceux de la vue (un, ou tous). ──
  const [data, setData] = React.useState(null);   // {listings, orders, capturedAt, illisibles} | null
  const [syncing, setSyncing] = React.useState(false);
  const syncLock=React.useRef(false);
  const [syncResult,setSyncResult]=React.useState({});
  const [commandesSuite,setCommandesSuite]=React.useState({});
  const [soldes, setSoldes] = React.useState(null);  // [{compte, solde}] — solde : {ok,dispo,enAttente,retenu}|{reason:'scope'}|null
  const autoFait = React.useRef(false);
  const comptesVue = React.useMemo(() => (Array.isArray(comptesEbay) ? comptesEbay : []).filter((c) => dansVueEbay({ _compte: c.ref }, vue)), [comptesEbay, vue]);
  // Solde à virer (getSellerFundsSummary), compte par compte. Lecture seule.
  const lireSolde = React.useCallback(async () => {
    const liste = comptesVue.length ? comptesVue : [{ ref: 'principal', principal: true, pseudo: '' }];
    const out = await Promise.all(liste.map(async (c) => {
      try {
        const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'finances', ...corpsCompteEbay(c.ref) }) });
        return { compte: c, solde: await r.json() };
      } catch (_) { return { compte: c, solde: null }; }
    }));
    setSoldes(out);
  }, [comptesVue]);
  const lireData = React.useCallback(async () => {
    if (!Array.isArray(comptesEbay)) return null;
    const [L, O] = await Promise.all([
      lireEbayTous('ebay_listings', 'items:data->items,capturedAt:data->>capturedAt,complet:data->complet', 'items', comptesVue),
      lireEbayTous('ebay_orders', 'orders:data->orders,capturedAt:data->>capturedAt,complet:data->complet,lues:data->lues,total:data->total,lecture:data->pagination->lues,totalLecture:data->pagination->total', 'orders', comptesVue),
    ]);
    if (!L || !O) return null;
    const caps = [...L.lignes, ...O.lignes].map((x) => x.ligne && Number(x.ligne.capturedAt)).filter((n) => Number.isFinite(n) && n > 0);
    const cap = caps.length ? Math.min(...caps) : null;
    setData({ lectures:L.lignes.map(l=>({compte:l.compte,annonces:l.ligne,commandes:O.lignes.find(o=>o.compte.ref===l.compte.ref)?.ligne})),listings: L.items, orders: O.items, capturedAt: cap, illisibles: [...new Set([...L.illisibles, ...O.illisibles])] });
    return cap;
  }, [comptesEbay, comptesVue]);
  const chargerPlusCommandes=async ref=>{
    if(syncLock.current)return;
    syncLock.current=true;setSyncing(true);setCommandesSuite(prev=>({...prev,[ref]:'Lecture en cours…'}));
    try{
      const r=await fetch('/api/ebay',{method:'POST',headers:{'content-type':'application/json',...enTeteSession()},body:JSON.stringify({action:'commandessuite',...corpsCompteEbay(ref)})});
      const j=await r.json();if(!r.ok || !j.ok)throw new Error(j.error || 'La page suivante n’a pas pu être lue.');
      setCommandesSuite(prev=>({...prev,[ref]:`${j.lues} commande${j.lues>1?'s':''} lue${j.lues>1?'s':''}${j.total!=null?` sur ${j.total}`:''} pour cette lecture eBay.${j.complete?' Lecture terminée.':j.issue?' La liste a changé : actualise ce compte avant de reprendre.':' Tu peux charger la suite.'}`}));
      signalerComptesEbay();await lireData();
    }catch(e){setCommandesSuite(prev=>({...prev,[ref]:e.message}));}
    finally{syncLock.current=false;setSyncing(false);}
  };
  const synchroniser = React.useCallback(async (refCible) => {
    if(syncLock.current)return;
    if(!Array.isArray(comptesStatut)){setRetour('Les comptes eBay n’ont pas pu être lus. Actualise leur connexion avant de reprendre.');return;}
    const ref=typeof refCible==='string'?refCible:null;
    const liste=comptesStatut.filter(c=>c.relie===true && (ref?(c.principal?'principal':c.cle)===ref:dansVueEbay({_compte:c.principal?'principal':c.cle},vue)));
    if(!liste.length){setRetour('Aucun compte connecté dans cette sélection.');return;}
    syncLock.current=true;setSyncing(true);let erreurs=0,partielles=0;
    try{
      for(const c of liste){
        const id=c.principal?'principal':c.cle;
        setSyncResult(prev=>({...prev,[id]:{etat:'lecture'}}));
        try{
          const r=await fetch('/api/ebay',{method:'POST',headers:{'content-type':'application/json',...enTeteSession()},body:JSON.stringify({action:'sync',...(c.principal?{}:corpsCompteEbay(c.cle))})});
          const j=await r.json();const ok=r.ok && j.ok===true;
          const manque=ok?['annonces','commandes'].filter(k=>j.lu?.[k]!==true):[];
          const incompletes=ok?['annonces','commandes'].filter(k=>j.lu?.[k]===true && j.complet?.[k]!==true):[];
          if(!ok)erreurs++;else if(manque.length || incompletes.length)partielles++;
          setSyncResult(prev=>({...prev,[id]:{etat:!ok?'erreur':manque.length || incompletes.length?'partiel':'ok',manque,incompletes,reason:j.reason || null,at:Date.now()}}));
        }catch(_){erreurs++;setSyncResult(prev=>({...prev,[id]:{etat:'erreur',at:Date.now()}}));}
      }
      signalerComptesEbay();await lireData();
      setRetour(erreurs?'Certaines lectures ont échoué. Tu peux reprendre uniquement le compte concerné.':partielles?'Lecture partielle : les données non relues conservent leur dernière capture.':'Comptes eBay actualisés.');
    }finally{syncLock.current=false;setSyncing(false);}
  }, [lireData,comptesStatut,vue]);
  React.useEffect(() => {
    if (connected !== true || !Array.isArray(comptesEbay)) return;
    let stop = false;
    (async () => {
      const cap = await lireData();
      lireSolde();
      if (stop || autoFait.current) return;
      // Première capture (jamais synchronisé) OU données vieilles de +6 h → on
      // rafraîchit une seule fois automatiquement (comme la moisson Vinted).
      if (cap == null || (Date.now() - cap) > 6 * 3600 * 1000) { autoFait.current = true; synchroniser(); }
    })();
    return () => { stop = true; };
  }, [connected, lireData, synchroniser, lireSolde, comptesEbay]);
  const eti = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 };
  const boite = (bg, bord) => ({ border: `1px solid ${bord || C.border}`, background: bg || C.card, borderRadius: 10, padding: '14px 16px' });
  return (
    <div style={boite()}>
      <div style={{ ...eti, marginBottom: 6 }}>Compte eBay · connexion</div>
      {retour && <div style={{ fontSize: 12.5, color: C.text, background: C.bg || 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>{retour}</div>}
      {st === null ? (
        <div style={{ fontSize: 13, color: C.muted }}>Vérification…</div>
      ) : st.passu ? (
        <div data-ebay-statut="passu" style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          Je n'ai pas pu vérifier la connexion eBay : le serveur n'a pas répondu. Rien n'est perdu — rouvre cet écran dans un instant.
        </div>
      ) : !st.ready ? (
        <div data-ebay-statut="non-configure" style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          eBay n'est <b>pas encore configuré</b>. Ajoute tes clés eBay dans Vercel (App ID, Dev ID, Cert ID), puis le RuName — la marche à suivre est dans <b>docs/ebay-api.md</b>. Tant que ce n'est pas fait, rien ne part sur eBay.
        </div>
      ) : !st.canConsent ? (
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          Tes clés eBay sont posées ✓. Il manque le <b>RuName</b> (l'URL de redirection, variable <code>EBAY_RUNAME</code>) à créer dans le portail eBay Developer et à coller dans Vercel — voir <b>docs/ebay-api.md</b>.
        </div>
      ) : connected === true ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ flex: '1 1 180px', minWidth: 0, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
              <Icon name="check" size={15}/> <b>Compte eBay relié</b>
              {Array.isArray(comptesStatut) && comptesStatut.length === 1 && typeCompteEbayTexte(comptesStatut[0]) && <span data-ebay-compte-type={comptesStatut[0].type} style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 999, padding: '1px 7px' }}>{typeCompteEbayTexte(comptesStatut[0])}</span>}
            </div>
            <button type="button" onClick={synchroniser} disabled={syncing}
              style={{ flexShrink: 0, border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 10, padding: '9px 13px', cursor: syncing ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: syncing ? 0.6 : 1 }}>
              {syncing ? 'Lecture eBay…' : 'Actualiser'}
            </button>
          </div>
          {/* (9 octobre) SES COMPTES eBAY : chacun nommé (son pseudo eBay), relié
              ou non, et « Déconnecter » — qui ne touche pas aux autres. La liste
              n'apparaît qu'à partir de deux comptes (un seul : rien ne change). */}
          {Array.isArray(comptesStatut) && comptesStatut.length >= 2 && (
            <div data-ebay-comptes={comptesStatut.length} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ ...eti, marginBottom: 6 }}>Tes comptes eBay</div>
              {comptesStatut.map((c) => {
                const ref = c.principal ? 'principal' : c.cle; const etat = deconnexion[ref];
                return (
                  <div key={ref} data-ebay-compte-ligne={ref} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomCompteEbay(c)}{typeCompteEbayTexte(c) ? <span data-ebay-compte-type={c.type} style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 999, padding: '1px 7px' }}>{typeCompteEbayTexte(c)}</span> : null}</div>
                      <div style={{ fontSize: 11, color: c.relie === false ? C.warn : C.muted }}>{c.relie === true ? 'relié' : c.relie === false ? 'plus relié — reconnecte-le avec « Connecter un autre compte eBay »' : 'état pas lu'}</div>
                      {etat && etat !== '…' && <div style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>{etat}</div>}
                    </div>
                    <button type="button" data-ebay-deconnecter={ref} disabled={etat === '…'} onClick={() => deconnecter(c)}
                      style={{ flexShrink: 0, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: etat === '…' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: etat === '…' ? 0.6 : 1 }}>{etat === '…' ? 'Déconnexion…' : 'Déconnecter'}</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <button type="button" data-ebay-connecter-autre onClick={() => connecter(true)} disabled={busy}
              style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 10, padding: '9px 13px', cursor: busy ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Ouverture d\'eBay…' : '+ Connecter un autre compte eBay'}
            </button>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>eBay te demandera de te connecter : choisis l'AUTRE compte (particulier ou pro). Chaque compte garde ses annonces et ses ventes à part.</div>
          </div>
          <details style={{fontSize:12,marginBottom:12}}><summary style={{cursor:'pointer'}}>Synchronisation par compte</summary><div style={{display:'grid',gap:8,marginTop:10}}>{(data?.lectures || []).map(l=>{const result=syncResult[l.compte.ref];const lecture=(v)=>v===undefined?'Lecture indisponible':v===null?'Jamais lu':Number(v.capturedAt)>0?new Date(Number(v.capturedAt)).toLocaleString('fr-FR'):'Date inconnue';return <div key={l.compte.ref} data-ebay-sync-compte={l.compte.ref} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10}}><b>{nomCompteEbay(l.compte)}</b><div style={{color:C.muted,fontSize:11,marginTop:4}}>Annonces : {lecture(l.annonces)}{l.annonces && l.annonces.complet!==true?' · partiel':''}<br/>Commandes : {lecture(l.commandes)}{l.commandes && l.commandes.complet!==true?' · partiel':''}</div>{l.commandes?.lecture!=null && <p style={{fontSize:11,color:C.muted}}>{l.commandes.lecture}{l.commandes.totalLecture!=null?` sur ${l.commandes.totalLecture}`:''} commandes pour cette lecture eBay</p>}{commandesSuite[l.compte.ref] && <p role="status" style={{fontSize:11}}>{commandesSuite[l.compte.ref]}</p>}{result && <p role="status" style={{fontSize:11}}>{result.etat==='lecture'?'Lecture en cours…':result.etat==='ok'?'Actualisé':result.etat==='partiel'?[result.manque?.length?`Non relu : ${result.manque.join(', ')}.`:'',result.incompletes?.length?`Lecture partielle : ${result.incompletes.join(', ')}.`:'','Historique conservé.'].filter(Boolean).join(' '):'Lecture échouée. Dernières données conservées.'}</p>}<button type="button" disabled={syncing} onClick={()=>synchroniser(l.compte.ref)} style={{marginTop:6,border:`1px solid ${C.border}`,borderRadius:8,background:C.card,color:C.text,padding:'6px 9px',cursor:'pointer'}}>{result && (result.etat==='erreur' || result.manque?.length)?'Reprendre ce compte':'Actualiser ce compte'}</button>{l.commandes?.complet!==true && <button type="button" disabled={syncing} onClick={()=>chargerPlusCommandes(l.compte.ref)} style={{marginTop:6,marginLeft:6,border:`1px solid ${C.border}`,borderRadius:8,background:C.card,color:C.text,padding:'6px 9px',cursor:'pointer'}}>Lire davantage de commandes</button>}</div>;})}</div></details>
          <details className="vrm-ebay-settings"><summary>Solde et paramètres du compte</summary>
          {data == null ? (
            <div style={{ fontSize: 12.5, color: C.muted }}>{syncing ? 'Première lecture de ton compte eBay…' : 'Chargement…'}</div>
          ) : (<>
            {/* ── Solde eBay à virer (getSellerFundsSummary). « disponible » et
                « en attente » ne se confondent JAMAIS (§5.14) — deux montants,
                deux mots. Absent ⇒ « — », jamais 0. Sans le droit « paiements »
                (jeton accordé avant qu'on le demande) : on invite à se
                reconnecter, on n'invente aucun chiffre. */}
            {(soldes || []).map(({ compte: cpt, solde }) => {
              // (9 octobre) Un solde PAR compte eBay : l'argent de deux comptes
              // ne s'additionne pas en un chiffre qu'eBay ne montre nulle part.
              const nomS = Array.isArray(comptesEbay) && comptesEbay.length >= 2 ? ` · ${nomCompteEbay(cpt)}` : '';
              const eur = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';
              if (solde && solde.reason === 'scope') return (
                <div key={cpt.ref} style={{ border: `1px solid ${C.warn}`, background: `${C.warn}10`, borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                  L'accès aux paiements{nomS} n'est pas autorisé. Tes annonces et ventes restent accessibles.
                  <div style={{ marginTop: 8 }}><button type="button" onClick={() => connecter(!cpt.principal)} disabled={busy} style={{ border: `1px solid ${C.accent}`, background: `${C.accent}12`, color: C.accent, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? 'Ouverture d\'eBay…' : 'Autoriser les paiements'}</button></div>
                </div>
              );
              if (solde && solde.ok && (solde.dispo != null || solde.retenu != null || solde.enAttente != null)) {
                const item = (v, lib, col) => <div><div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: col || C.text }}>{v == null ? '—' : eur(v)}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{lib}</div></div>;
                const enRoute = (solde.enAttente != null || solde.retenu != null) ? (Number(solde.enAttente || 0) + Number(solde.retenu || 0)) : null;
                return (
                  <div key={cpt.ref} data-ebay-solde={cpt.ref} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Solde eBay{nomS}</div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {item(solde.dispo, 'disponible à virer', C.text)}
                      {enRoute != null && enRoute > 0 && item(enRoute, 'en attente / retenu par eBay', C.muted)}
                    </div>
                    {/* (17 oct.) « Retirer l'argent » : sur eBay il n'y a rien à
                        retirer à la main — eBay verse lui-même le disponible sur
                        ton compte bancaire, selon ton calendrier de versements.
                        VRM ne déplace jamais d'argent. (Page non mesurée ici.) */}
                    <div data-ebay-retirer style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <span style={{ flex: '1 1 180px', fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>eBay vire tout seul le disponible sur ton compte bancaire, selon ton calendrier de versements.</span>
                      <a href="https://www.ebay.fr/sh/fin" target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Mes versements ↗</a>
                    </div>
                  </div>
                );
              }
              return null;
            })}
            {data.illisibles && data.illisibles.length > 0 && (
              <div data-ebay-compte-illisible={data.illisibles.length} style={{ fontSize: 12.5, color: C.warn, marginBottom: 10, lineHeight: 1.5 }}>Je n'ai pas pu lire les données {data.illisibles.length > 1 ? 'des comptes eBay' : 'du compte eBay'} {data.illisibles.map(nomCompteEbay).join(', ')} — rien n'est perdu ; les montants ci-dessous ne {data.illisibles.length > 1 ? 'les' : 'le'} comptent pas.</div>
            )}
            {/* Argent eBay : montants, en attente de paiement, payées, à expédier.
                Calculé depuis les commandes captées (Fulfillment API) — jamais un
                chiffre inventé. Ces montants viennent d'eBay, comme la ligne argent
                de Vinted. */}
            {(() => {
              const ords = data.orders || [];
              const eur = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';
              const val = (o) => Number((o && o.pricingSummary && o.pricingSummary.total && o.pricingSummary.total.value) || 0) || 0;
              const paye = (o) => String((o && o.orderPaymentStatus) || '').toUpperCase() === 'PAID';
              const livre = (o) => String((o && o.orderFulfillmentStatus) || '').toUpperCase() === 'FULFILLED';
              const euros=ords.every(o=>o.pricingSummary?.total?.currency==='EUR' && o.pricingSummary.total.value!=null && String(o.pricingSummary.total.value).trim()!=='' && Number.isFinite(Number(o.pricingSummary.total.value)));
              const total=euros?ords.reduce((s,o)=>s+val(o),0):null;
              const enAttente=euros?ords.filter(o=>!paye(o)).reduce((s,o)=>s+val(o),0):null;
              const payees=ords.some(paye)?caEbayPayees(ords):0;   // même règle que le Collectif (§11)
              const aExpedier = ords.filter(o => paye(o) && !livre(o)).length;
              const melange = new Set(ords.map((o) => o && o._compte)).size > 1;
              if (ords.length === 0) return <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>Aucune vente eBay pour l'instant — dès ta première vente, le montant, le paiement et les colis à expédier s'afficheront ici.</div>;
              const bloc = (v, lib, col) => <div><div className="vrm-display" style={{ fontSize: 20, fontWeight: 700, color: col || C.text }}>{v}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{lib}</div></div>;
              return (
                <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ ...eti, marginBottom: 8 }}>Argent eBay · {ords.length} vente{ords.length > 1 ? 's' : ''}</div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {bloc(eur(total), 'total des ventes')}
                    {bloc(eur(payees), 'payées')}
                    {enAttente > 0 && bloc(eur(enAttente), 'en attente de paiement', C.warn)}
                    {aExpedier > 0 && bloc(String(aExpedier), 'à expédier', C.accent)}
                  </div>
                  {/* Liste des ventes : acheteur, montant, état de paiement/expédition. */}
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ords.slice(0, 8).map((o, i) => {
                      const li = (o.lineItems && o.lineItems[0]) || {};
                      const titre = li.title || 'Vente eBay';
                      const acheteur = (o.buyer && o.buyer.username) || '';
                      const etat = !paye(o) ? { t: 'en attente de paiement', c: C.warn } : !livre(o) ? { t: 'à expédier', c: C.accent } : { t: 'expédiée', c: C.muted };
                      return (
                        <div key={(o._compte || '') + (o.orderId || i)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
                          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titre}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{acheteur ? acheteur + ' · ' : ''}<span style={{ color: etat.c, fontWeight: 600 }}>{etat.t}</span>{melange ? ` · ${nomCompteEbay({ pseudo: o._pseudo })}` : ''}</div>
                          </div>
                          <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{val(o).toFixed(2).replace('.',',')} {o.pricingSummary?.total?.currency==='EUR'?'€':o.pricingSummary?.total?.currency || ''}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* ⚠️ 4 octobre — Julien : « il y a deux fois le bouton pour poster
                les paires, ça ne me convient pas du tout ». Le publieur avait été
                « déplacé » vers l'onglet Annonces le 3 octobre (#390) en
                l'AJOUTANT là-bas, sans le retirer d'ici — et la liste des
                annonces, avec son « Modifier », était elle aussi écrite deux
                fois. Mettre en vente et modifier vivent UNE fois, dans Annonces ;
                ici il ne reste que le compte, l'argent et un renvoi. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              <div style={{ flex: '1 1 180px', minWidth: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                {data.listings.length} annonce{data.listings.length > 1 ? 's' : ''} eBay en ligne
                {data.capturedAt ? <> · captées {(() => { const j = Math.round((Date.now() - data.capturedAt) / 3600000); return j < 1 ? 'à l\'instant' : j < 24 ? `il y a ${j} h` : `il y a ${Math.round(j / 24)} j`; })()}</> : null}.
                {' '}Pour en mettre une en vente ou la modifier : l'onglet <b>Annonces</b>.
              </div>
              {onAnnonces && <button type="button" data-vers-annonces="ebay" onClick={onAnnonces}
                style={{ flexShrink: 0, border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 10, padding: '9px 13px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Voir mes annonces</button>}
            </div>
          </>)}
          </details>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 10 }}>
            Tout est prêt côté clés. Autorise ton compte vendeur sur la page d'eBay — <b>aucun mot de passe ne passe par VRM</b>, tu te connectes chez eBay.
          </div>
          <button type="button" onClick={() => connecter(false)} disabled={busy}
            style={{ border: 'none', borderRadius: 10, background: C.accent, color: '#fff', padding: '11px 16px', cursor: busy ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Ouverture d\'eBay…' : 'Connecter mon compte eBay'}
          </button>
          {connected === null && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>(État du compte non lisible pour l'instant — la base n'a pas répondu.)</div>}
        </>
      )}
    </div>
  );
}
// Une annonce eBay : résumé + détail DÉPLIABLE qui montre TOUTES les
// caractéristiques captées (specifics, catégorie, état, nb de photos, description).
// Julien veut voir que « tout est capté » ; c'est aussi la matière du
// remplissage complet à la republication. Lecture seule.
// (5 octobre) Elle porte aussi SON lien à une paire (le SKU `VRM-{n°}`), le geste
// « Relier à une paire » quand il manque, et « Faire une offre aux observateurs »
// quand eBay dit qu'il y a quelqu'un à qui l'envoyer. Rien ne part sans son clic,
// et ce qui engage (une offre) passe par une confirmation.
//   numero      : '' (pas reliée) ou le N° lu dans le SKU (`numDeSkuEbay`) ;
//   eligible    : true (eBay accepte une offre) · false · undefined (pas su) ;
//   paires      : ses paires en ligne (`useEbayPaires`) ; numsConnus : les N°
//                 connus de VRM ; titreDeNum : N° → titre ; pris : N° → annonce
//                 eBay qui le porte déjà (une paire, une annonce).
function EbayAnnonceCard({ it, first, onSaved, numero = '', eligible, paires = [], numsConnus = null, titreDeNum = null, pris = null, onSku, onOffre, compteNom = '',
  regle = null, bloquee = null, achat, onRegle, enLot = false, prixAffiche, nomCompteConfirm = '',onRelire }) {
  const E = EBAY_SKIN;
  const [open, setOpen] = React.useState(false);
  // ── RELIER À UNE PAIRE (action `sku`) ────────────────────────────────────
  const [relierOuvert, setRelierOuvert] = React.useState(false);
  const [numSaisi, setNumSaisi] = React.useState('');
  const [geste, setGeste] = React.useState('');   // '' · 'relier' · 'offre' : un envoi en cours
  const [info, setInfo] = React.useState('');      // le résultat du dernier geste, dit sur la carte
  // La couleur du message est FIXÉE par celui qui l'écrit (9 octobre) : 'ok'
  // (texte) pour un ✓ sans réserve, 'warn' pour tout le reste — jamais déduite
  // d'un « ✓ » en tête, jamais du vert, jamais du rouge (§7). null ⇒ l'ancienne
  // règle (✓ en tête), pour les gestes d'avant.
  const [infoTon, setInfoTon] = React.useState(null);
  const dire = (t, ton) => { setInfo(t); setInfoTon(ton || null); };
  // ── OFFRE AUX OBSERVATEURS (action `offre`) ──────────────────────────────
  const [offreOuverte, setOffreOuverte] = React.useState(false);
  const [remise, setRemise] = React.useState('10');
  const [mot, setMot] = React.useState('');
  // ── LA RÈGLE D'OFFRE (9 octobre) : c'est eBay qui accepte, au seuil fixé ──
  const [regleOuverte, setRegleOuverte] = React.useState(false);
  const [saisieA, setSaisieA] = React.useState('');
  const [saisieR, setSaisieR] = React.useState('');
  const [sousMoitieOk, setSousMoitieOk] = React.useState(false);
  const [envoiRegle, setEnvoiRegle] = React.useState('');      // '' · 'pose' · 'retrait'
  const envoiRef = React.useRef(false);                        // jamais deux envois, même sur un double clic
  const [regleSignal, setRegleSignal] = React.useState('');    // 'prix-change' · 'existante' : le panneau reste ouvert
  const prixCarte = prixAffiche != null ? prixAffiche : it.price;
  const prixBase = Number(String(prixCarte == null ? '' : prixCarte).replace(',', '.'));
  const remiseN = /^\d{1,2}$/.test(String(remise).trim()) ? parseInt(remise, 10) : NaN;
  const remiseOk = Number.isInteger(remiseN) && remiseN >= 5 && remiseN <= 50;
  const prixRemise = (isFinite(prixBase) && prixBase > 0 && remiseOk) ? Math.round(prixBase * (100 - remiseN)) / 100 : null;
  const eurE = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  // Les observateurs : `WatchCount` d'eBay. Les captures d'avant le rangeaient
  // sous `vues` (le mot était faux : ce sont des personnes qui SUIVENT
  // l'annonce, pas des vues). Absent ⇒ on ne donne pas de nombre.
  const obs = Number.isFinite(it.observateurs) ? it.observateurs : (/^\d+$/.test(String(it.vues == null ? '' : it.vues)) ? Number(it.vues) : null);
  const relier = async (brut) => {
    dire('');
    // « n125 » (l'écriture de ses titres) vaut 125, comme sur Leboncoin.
    const c = cleNum(brut);
    const n = (numsConnus && numsConnus.has(c)) ? c : c.replace(/^N[°O]?(?=\d)/, '');
    if (!NUM_OK.test(n)) { dire('Tape le numéro de la paire (125, ou B125).'); return; }
    if (numsConnus && !numsConnus.has(n)) { dire(`Aucune paire ne porte le N°${n} dans VRM.`); return; }
    if (pris && pris.has(n) && pris.get(n) !== String(it.itemId)) { dire(`La paire N°${n} est déjà reliée à une autre annonce eBay : une paire, une annonce.`); return; }
    const tp = (titreDeNum && titreDeNum.get(n)) || '';
    const ok = await askConfirm({
      title: `Relier cette annonce eBay à la paire N°${n} ?`,
      desc: `eBay : « ${it.title || it.itemId} »\nVRM : ${tp ? `« ${tp} »` : `paire N°${n}`}${numero && numero !== n ? `\nAujourd'hui : reliée à la N°${numero}.` : ''}\n\nVRM écrit la référence VRM-${n} dans l'étiquette personnalisée (SKU) de l'annonce eBay. Tu pourras la changer.`,
      ok: 'Oui, relier', cancel: 'Annuler',
    });
    if (!ok) return;
    setGeste('relier');
    try {
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'sku', itemId: it.itemId, numero: n, ...corpsCompteEbay(it._compte) }) });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) { try { const fs = fichesPourEbay(); const ids = Object.keys(fs).filter((k) => fs[k] && cleNum(fs[k].numero) === cleNum(n)); if (ids.length === 1) noterLienEbay(it.itemId, ids[0], n, 'main'); } catch (_) {} dire(`✓ Reliée à la paire N°${n} (${j.sku}).`); setRelierOuvert(false); setNumSaisi(''); if (onSku) onSku(it.itemId, j.sku); }
      else dire((j && j.error) || 'eBay a refusé la référence — rien n\'a changé.');
    } catch (_) { dire('Liaison impossible (réseau) — rien n\'a changé.'); }
    setGeste('');
  };
  const envoyerOffre = async () => {
    dire('');
    if (!remiseOk) { dire('La remise doit être un nombre entier entre 5 et 50 %.'); return; }
    if (mot.length > 2000) { dire('Message trop long (2 000 caractères au plus).'); return; }
    const prix = prixRemise != null ? eurE(prixRemise) : '';
    const ok = await askConfirm({
      title: `Envoyer une offre à −${remiseN} % ?`,
      desc: `Les personnes qui suivent « ${it.title || it.itemId} » sur eBay${obs ? ` (${obs})` : ''} recevront une offre${prix ? ` à ${prix}` : ''}, valable 48 h. C'est eBay qui les choisit : VRM ne voit pas qui elles sont.\n\nSi l'une d'elles accepte, la paire est vendue à ce prix.`,
      ok: 'Oui, envoyer', cancel: 'Annuler',
    });
    if (!ok) return;
    setGeste('offre');
    try {
      const corps = { action: 'offre', listingId: String(it.itemId), remise: remiseN, confirme: true, ...corpsCompteEbay(it._compte) };
      if (mot.trim()) corps.message = mot.trim();
      const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) {
        const n = Number(j.envoyees) || 0;
        dire(n ? `✓ Offre à −${remiseN} % envoyée à ${n} personne${n > 1 ? 's' : ''}, valable 48 h.` : `✓ Offre à −${remiseN} % envoyée par eBay, valable 48 h.`);
        setOffreOuverte(false); if (onOffre) onOffre(it.itemId);
      } else dire((j && j.error) || 'eBay a refusé l\'offre.');
    } catch (_) { dire('Envoi impossible (réseau) — regarde sur eBay avant de recommencer.'); }
    setGeste('');
  };
  // Les paires proposées : d'abord celles dont une PHOTO est exactement celle
  // de l'annonce eBay (une identité, §5) — jamais un classement par
  // ressemblance de titre. Sinon simplement par numéro.
  const photosEbay = new Set([it.photo, ...(((it.detail || {}).photos) || [])].filter(Boolean).map(String));
  const memePhoto = (p) => (p.photos || []).concat(p.cover ? [p.cover] : []).some((u) => photosEbay.has(String(u)));
  const qN = numSaisi.trim().toLowerCase();
  const choix = paires
    // Une paire déjà reliée à une AUTRE annonce eBay n'est pas proposée (une
    // paire, une annonce) — la taper reste possible, et le refus le dit.
    .filter((p) => !(pris && pris.has(cleNum(p.num)) && pris.get(cleNum(p.num)) !== String(it.itemId)))
    .filter((p) => !qN || String(p.num).toLowerCase().startsWith(qN.replace(/^n[°o]?/, '')) || String(p.title || '').toLowerCase().includes(qN))
    .map((p) => ({ ...p, memePhoto: memePhoto(p) }))
    .sort((a, b) => (Number(b.memePhoto) - Number(a.memePhoto)) || triNum(b.num, a.num))
    .slice(0, 6);
  const btnE = { border: `1px solid ${E.border}`, background: 'transparent', color: E.text, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  // ── LA RÈGLE D'OFFRE (9 octobre) ─────────────────────────────────────────
  // Julien : « je veux juste définir une règle sur chaque annonce et à chaque
  // offre au-dessus ça accepte ». C'est eBay qui accepte, au seuil qu'il fixe :
  // VRM le pose sur SON clic (confirmation qui dit la conséquence), le retire
  // d'un clic, et dit ce qu'eBay a VRAIMENT gardé (la route relit après).
  const cleRegle = ((it && it._compte) || 'principal') + ':' + String(it.itemId);
  const et = regle;
  const prixVuN = Number.isFinite(prixBase) && prixBase > 0 ? Math.round(prixBase * 100) / 100 : null;
  // Le seuil RELU (connue, aucune, ou « offres-inconnues » : seuil lu, offres
  // activées ou non pas montré) — ce que le panneau montre et la garde porte.
  const seuilLu = !!(et && et.lu && (et.etat === 'connue' || et.etat === 'aucune' || (et.etat === 'pas-su' && et.raison === 'offres-inconnues')));
  const refuseLu = seuilLu ? et.lu.refuse : null;
  const aN = montantSaisi(saisieA), rN = montantSaisi(saisieR);
  const vSaisie = aN == null ? null : valideRegleOffre({ accepte: aN, refuse: rN == null ? undefined : rN, prix: prixVuN });
  const errSaisie = vSaisie && !vSaisie.ok ? vSaisie.err : '';
  const tropBas = !!(vSaisie && vSaisie.ok && seuilTropBas(vSaisie.accepte, prixVuN));
  const pctSaisi = vSaisie && vSaisie.ok && prixVuN ? Math.round(vSaisie.accepte / prixVuN * 100) : null;
  const sousAchat = !!(vSaisie && vSaisie.ok && typeof achat === 'number' && vSaisie.accepte < achat);
  const gesteBloque = !!bloquee || !!enLot;
  const peutEnregistrer = !!prixVuN && aN != null && !!vSaisie && vSaisie.ok && (!tropBas || sousMoitieOk) && !envoiRegle && !gesteBloque;
  const fmtMontant = (n) => (n == null ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
  const ouvrirRegle = () => {
    const ouvrir = !regleOuverte;
    setRegleOuverte(ouvrir); setRelierOuvert(false); setOffreOuverte(false); dire(''); setRegleSignal('');
    if (ouvrir) {
      setSaisieA(et && et.etat === 'connue' ? fmtMontant(et.accepte) : (seuilLu && et.lu.accepte != null ? fmtMontant(et.lu.accepte) : ''));
      setSaisieR(refuseLu != null ? fmtMontant(refuseLu) : '');
      setSousMoitieOk(false);
    }
  };
  // Ce qu'eBay signale (avertissements), en clair.
  const avertissementsTexte = (res) => {
    const out = []; const errs = Array.isArray(res.erreurs) ? res.erreurs : [];
    const warns = errs.filter((e) => e && e.severite === 'Warning');
    if (warns.length) { for (const w of warns) out.push(String(w.code) === '21992' ? 'eBay signale que le refus automatique a sauté.' : `eBay signale : « ${w.message || ''} ».`); }
    else for (const a of (res.avertissements || [])) out.push(`eBay signale : « ${a} ».`);
    return out.join(' ');
  };
  const [relectureNecessaire,setRelectureNecessaire]=React.useState(false);
  const [lienEbayInfo, setLienEbayInfo] = React.useState(false);
  const appliquerIssue = (res, gesteFait, X) => {
    const L=res.lecture;setRelectureNecessaire(!!res.nonNote || L?.lu===false);
    // L'état local de la carte : la MÊME règle que le geste groupé (§11).
    const loc = localApresRegle(res);
    if (onRegle && (loc.entree !== undefined || loc.prix !== undefined)) onRegle(cleRegle, loc.entree, loc.prix);
    setLienEbayInfo(false);
    if (res.issue === 'ok') {
      let t = res.inchange ? '✓ C\'était déjà la règle sur eBay.'
        : (gesteFait === 'retrait' ? '✓ Règle retirée : les offres t\'arrivent sur eBay, c\'est toi qui décides.'
          : `✓ eBay accepte maintenant les offres dès ${eurEbay(L && L.accepte != null ? L.accepte : X)}.` + (L && L.refuse != null ? ` Refus sous ${eurEbay(L.refuse)}.` : ''));
      let ton = 'ok';
      const av = avertissementsTexte(res);
      if (av) { t += ' ' + av; ton = 'warn'; }
      if (res.nonNote) { t = t.replace(/^✓\s*/, '') + ' eBay l\'a fait, mais VRM n\'a pas pu le noter : « Relire chez eBay ».'; ton = 'warn'; }
      dire(t, ton); setRegleOuverte(false); return;
    }
    if(res.issue==='ecart' && L?.lu===false){dire('La règle n’est pas confirmée. La dernière observation peut être en retard : relis son état avant de recommencer.','warn');setRegleOuverte(false);return;}
    if (res.issue === 'ecart') {
      const t = (L && L.offresActives === true && L.accepte == null)
        ? 'eBay a activé les offres mais n\'a pas gardé le montant : les offres t\'arrivent, c\'est toi qui décides.'
        : `eBay a répondu « fait », mais l'annonce montre : ${etatEnClair(L)}. Regarde-la sur eBay.`;
      const av = avertissementsTexte(res);
      dire(t + (av ? ' ' + av : '') + (res.nonNote ? ' VRM n\'a pas pu le noter : « Relire chez eBay ».' : ''), 'warn'); setRegleOuverte(false); return;
    }
    if (res.issue === 'offres-inconnues') {
      // Relu : le montant est celui demandé ; eBay ne montre pas si les offres
      // sont activées. « Relire » rendrait la même chose : le geste est de
      // regarder l'annonce sur eBay.
      const av = avertissementsTexte(res);
      const seuilLu = L && L.accepte != null ? `eBay accepte dès ${eurEbay(L.accepte)}` + (L.refuse != null ? ` · refuse sous ${eurEbay(L.refuse)}` : '') : etatEnClair(L);
      dire(`eBay a répondu « fait » et l'annonce porte bien ton seuil : ${seuilLu}. Mais eBay ne montre pas si les offres y sont activées : regarde l'annonce sur eBay.` + (av ? ' ' + av : '') + (res.nonNote ? ' VRM n\'a pas pu le noter : « Relire chez eBay ».' : ''), 'warn');
      setLienEbayInfo(true); setRegleOuverte(false); return;
    }
    if (res.issue === 'non-relu') {
      dire('eBay a répondu « fait », mais je n\'ai pas pu le relire — « Relire chez eBay » plus haut.', 'warn'); setRegleOuverte(false); return;
    }
    if (res.issue === 'a-revoir') {
      if (res.reason === 'regle-changee' || res.reason === 'regle-existante') { dire(`eBay a déjà une règle : ${etatEnClair(L)}. La remplacer par ${eurEbay(X)} ? Enregistre à nouveau.`, 'warn'); setRegleSignal('existante'); }
      else { dire(res.msg || 'La règle ou le prix a changé sur eBay : rien n\'a été envoyé. Revois le montant.', 'warn'); setRegleSignal(res.reason === 'prix-change' ? 'prix-change' : 'a-revoir'); }
      setSousMoitieOk(false);
      return;
    }
    if (res.issue === 'incertain') {
      dire(res.msg, 'warn'); setRegleOuverte(false); return;
    }
    dire(res.msg + (gesteFait === 'retrait' ? ' Retire-la sur eBay :' : ''), 'warn');
    if (gesteFait === 'retrait') setLienEbayInfo(true);
  };
  const enregistrerRegle = async () => {
    if (envoiRef.current || !peutEnregistrer) return;
    envoiRef.current = true;
    try {
      const X = vSaisie.accepte;
      // `refuse` : un nombre s'il est saisi ; null si un refus LU a été effacé ;
      // ABSENT sinon (on ne retire jamais un refus qu'on n'a pas vu).
      let refuseCle;
      if (rN != null) refuseCle = vSaisie.refuse;
      else if (refuseLu != null) refuseCle = null;
      const titre = it.title || String(it.itemId);
      const lignes = [
        `« ${titre} » est à ${eurEbay(prixVuN)} sur eBay${nomCompteConfirm ? ` (compte ${nomCompteConfirm})` : ''}. Toute offre de ${eurEbay(X)} ou plus ${OFFRE_VEND_LA_PAIRE}, et l'acheteur devra la payer.`,
      ];
      if (typeof refuseCle === 'number') lignes.push(`Toute offre sous ${eurEbay(refuseCle)} sera refusée par eBay.`);
      else if (refuseCle === null && refuseLu != null) lignes.push(`Le refus sous ${eurEbay(refuseLu)} sera retiré.`);
      if (et && et.etat !== 'pas-su' && et.offresActives === false) lignes.push('Les offres seront activées sur cette annonce : les acheteurs pourront t\'en faire.');
      else if (!et || et.etat === 'pas-su' || et.offresActives == null) lignes.push('Les offres seront activées si elles ne le sont pas déjà.');
      if (!numero) lignes.push('Cette annonce n\'est reliée à aucune paire : si eBay la vend, VRM ne saura pas quelle paire retirer de Vinted. « Relier à une paire » d\'abord.');
      if (sousAchat) lignes.push(`C'est sous ton prix d'achat (${eurEbay(achat)}), avant frais eBay.`);
      if (tropBas) lignes.push(`C'est ${pctSaisi} % du prix de l'annonce — tu l'as confirmé.`);
      if (et && et.offresFaites > 0) lignes.push(texteOffresDejaFaites(1, 1));
      const ok = await askConfirm({ title: `eBay acceptera seul les offres dès ${eurEbay(X)} ?`, desc: lignes.join('\n\n'), ok: 'Oui, poser la règle', cancel: 'Annuler' });
      if (!ok) return;
      setEnvoiRegle('pose');
      const corps = { action: 'regleoffre', itemId: String(it.itemId), accepte: X };
      if (refuseCle !== undefined) corps.refuse = refuseCle;
      corps.prixVu = prixVuN;
      corps.attendu = attenduDe(et);
      if (tropBas && sousMoitieOk) corps.sousMoitie = true;
      corps.confirme = true;
      Object.assign(corps, corpsCompteEbay(it._compte));
      appliquerIssue(resultatRegleOffre(await appelEbay(corps)), 'pose', X);
    } finally { setEnvoiRegle(''); envoiRef.current = false; }
  };
  // Retirer : un clic, sans feuille — retirer rend la main, ça n'engage rien.
  const retirerRegle = async () => {
    if (envoiRef.current || enLot) return;
    envoiRef.current = true; setEnvoiRegle('retrait');
    try {
      appliquerIssue(resultatRegleOffre(await appelEbay({ action: 'regleoffre', itemId: String(it.itemId), accepte: null, refuse: null, confirme: true, ...corpsCompteEbay(it._compte) })), 'retrait', null);
    } finally { setEnvoiRegle(''); envoiRef.current = false; }
  };
  // ── MODIFIER L'ANNONCE (prix / stock) DEPUIS VRM, comme l'onglet Compte ────
  // Julien : « pouvoir modifier les annonces dans l'application ». Passe par
  // l'action serveur `revise` (Trading ReviseInventoryStatus) : ça change la
  // VRAIE annonce eBay. Geste explicite (✏️ → Enregistrer), jamais automatique.
  const [edit, setEdit] = React.useState(false);
  // ⚠️⚠️ (11 octobre, revue) Le champ Prix part du prix que la CARTE affiche
  // (`prixCarte` : relu chez eBay après une 409 « prix-change » ou un
  // changement de prix), jamais d'une copie figée de la liste. Il était
  // initialisé UNE fois sur `it.price` (90 €) : la carte disait 95 €, le champ
  // 90 — et changer le STOCK seul renvoyait 90 € à eBay, avec « ✓ Modifié sur
  // eBay ». `price` vaut `null` tant qu'il n'est pas TAPÉ : le champ montre
  // alors le prix de la carte, et le prix ne part pas (§11 : une source).
  const [price, setPrice] = React.useState(null);
  const champPrix = price != null ? price : (prixCarte == null || prixCarte === '' ? '' : String(prixCarte).replace('.', ','));
  const [qty, setQty] = React.useState(String(it.qty ?? ''));
  const descSimple=String(it.detail?.description || '').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
  const [titreEdite,setTitreEdite]=React.useState(it.title || '');
  const [descEditee,setDescEditee]=React.useState(descSimple);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [msgTon, setMsgTon] = React.useState('ok');
  // Le prix TAPÉ, lu par la règle de toute saisie de montant (`montantSaisi`,
  // §11) : '' ⇒ null (on n'y touche pas) · un nombre · NaN (illisible).
  const prixTape = montantSaisi(price == null ? '' : price);
  // (11 octobre) Une saisie non vide qu'on ne sait pas lire (« 72 € », « 0 »)
  // ne vaut PAS « prix inchangé » : avant, rien ne partait et l'écran disait
  // « ✓ Modifié sur eBay » sur un prix qui n'avait pas bougé.
  const prixIllisible = prixTape !== null && !(prixTape > 0);
  // (9 octobre) Le prix ne part QUE s'il a changé (au centime) : changer le
  // stock seul ne touche pas la règle d'offre.
  const prixChange = Number.isFinite(prixTape) && prixTape > 0 && centsR(prixTape) !== centsR(prixBase);
  const enregistrer = async () => {
    setMsg('');
    if (prixIllisible) { setMsg('Un prix en euros, par exemple 72 ou 72,50 — rien n\'a été envoyé à eBay.'); setMsgTon('warn'); return; }
    if (prixChange) { const g = prixCompatibleRegle(prixTape, et); if (!g.ok) { setMsg(g.msg); setMsgTon('warn'); return; } }
    setSaving(true);
    // Trois issues (`resultatReviseEbay`) : une coupure n'est pas un refus.
    const changes={...(prixChange?{price:String(price).trim().replace(',','.')}:{}),...(qty!==String(it.qty ?? '')?{quantity:qty}:{})};
    if(!Object.keys(changes).length){setMsg('Aucune modification.');setSaving(false);return;}
    if(!await askConfirm({title:'Modifier le prix / stock sur eBay ?',desc:`${it.title || it.itemId}${nomCompteConfirm?` · ${nomCompteConfirm}`:''}\n${prixChange?`Prix : ${prixCarte} → ${price} ${it.currency || it.detail?.currency || ''}\n`:''}${'quantity' in changes?`Stock disponible : ${it.qty ?? '—'} → ${qty}`:''}`,ok:'Modifier sur eBay',cancel:'Annuler'})){setSaving(false);return;}
    const res=resultatReviseEbay(await appelEbay({action:'modifierannonce',itemId:it.itemId,...changes,expectedPrice:prixCarte,expectedQuantity:it.qty,confirme:true,...corpsCompteEbay(it._compte)}));
    if (res.etat === 'ok') {
      if (res.regleLecture !== undefined && onRegle) onRegle(cleRegle, res.regleLecture, prixChange ? prixTape : undefined);
      setMsg(res.msg || '✓ Modifié sur eBay'); setMsgTon(res.msg ? res.ton : 'ok'); setEdit(false); setPrice(null); if (onSaved) onSaved();
    }
    else { setMsg(res.msg); setMsgTon('warn'); }
    setSaving(false);
  };
  const enregistrerTexte=async()=>{
    const changes={};
    if(titreEdite!==(it.title || ''))changes.title=titreEdite;
    if(descEditee!==descSimple)changes.description=descEditee;
    if(!Object.keys(changes).length){setMsg('Aucune modification.');return;}
    if(('price' in changes && !/^\d+(?:[,.]\d{1,2})?$/.test(price)) || ('quantity' in changes && !/^\d{1,6}$/.test(qty)) || ('title' in changes && !titreEdite.trim()) || ('description' in changes && !descEditee.trim())){setMsg('Vérifie les champs modifiés.');return;}
    if(!await askConfirm({title:'Modifier le texte de cette annonce eBay ?',desc:`${it.title || it.itemId}\n${'price' in changes?`Prix : ${it.price} → ${price} ${it.currency || ''}\n`:''}${'quantity' in changes?`Stock disponible : ${it.qty ?? '—'} → ${qty}\n`:''}${'title' in changes?`Titre : ${titreEdite}\n`:''}${'description' in changes?'La description sera remplacée par le texte saisi.':''}`,ok:'Modifier sur eBay',cancel:'Annuler'}))return;
    setSaving(true);setMsg('');
    try{
      const r=await fetch('/api/ebay',{method:'POST',headers:{'content-type':'application/json',...enTeteSession()},body:JSON.stringify({action:'modifierannonce',itemId:it.itemId,...corpsCompteEbay(it._compte),...changes,expectedPrice:it.price,expectedQuantity:it.qty,expectedTitle:it.title,confirme:true})});
      const j=await r.json();if(r.ok && j?.ok){setMsg('Modifications acceptées par eBay.');setEdit(false);if(onSaved)onSaved();}else setMsg(j?.error || 'eBay a refusé la modification.');
    }catch(_){setMsg('État incertain : actualise l’annonce avant de recommencer.');}
    finally{setSaving(false);}
  };
  const terminer=async()=>{
    if(!await askConfirm({title:'Terminer cette annonce ?',desc:`${it.title || it.itemId}\nElle ne sera plus proposée à la vente sur eBay.`,ok:'Terminer sur eBay',cancel:'Annuler'}))return;
    setSaving(true);setMsg('');try{const r=await fetch('/api/ebay',{method:'POST',headers:{'content-type':'application/json',...enTeteSession()},body:JSON.stringify({action:'terminerannonce',itemId:it.itemId,...corpsCompteEbay(it._compte),confirme:true})});const j=await r.json();if(r.ok && j?.ok){setMsg('Annonce terminée sur eBay.');if(onSaved)onSaved();}else setMsg(j?.error || 'eBay a refusé cette action.');}catch(_){setMsg('État incertain : actualise l’annonce avant de recommencer.');}finally{setSaving(false);}
  };
  const inpE = { width: 92, boxSizing: 'border-box', border: `1px solid ${E.border}`, background: E.bg || E.card, color: E.text, borderRadius: 8, padding: '9px 10px', fontSize: 16, fontFamily: 'inherit' };
  const euro=p=>{if(p==null || String(p).trim()==='')return '—';const n=Number(p),c=it.currency || it.detail?.currency;return Number.isFinite(n)?n.toFixed(2).replace('.',',')+(c?` ${c==='EUR'?'€':c}`:''):'';};
  const j = (() => { const t = Date.parse(it.depuis || ''); return isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 86400000)); })();
  const url = it.url || (it.itemId ? `https://www.ebay.fr/itm/${it.itemId}` : null);
  const d = it.detail || {};
  const specs = (d.specifics && typeof d.specifics === 'object') ? Object.entries(d.specifics).filter(([, v]) => v != null && String(v).trim()) : [];
  const nb = Array.isArray(d.photos) ? d.photos.length : null;
  const desc = String(d.description || '').replace(/&lt;br&gt;|<br\s*\/?>/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const chip = { fontSize: 11, color: E.text, background: E.card2, border: `1px solid ${E.border}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' };
  return (
    <div className="vrm-ebay-carte" data-regle-envoi={envoiRegle || undefined} style={{ borderTop: first ? 'none' : `1px solid ${E.border}` }}>
      <div onClick={() => setOpen(o => !o)} role="button" tabIndex={0} data-ebay-carte-ouvrir={it.itemId}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        className="vrm-ebay-carte-tete" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
        <PhotoVente src={it.photo} size={64} />
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: E.text, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.title || '(sans titre)'}</div>
          <div style={{ fontSize: 11.5, color: E.muted, marginTop: 2 }}>
            {/* Le lien à la paire : la pastille distingue, pas une phrase par carte (§7). */}
            <span data-relie={numero} data-sku-douteux={!numero && skuEbayDouteux(it) ? String(it.sku) : undefined} style={{ fontWeight: 700, color: numero ? E.text : E.warn }} title={!numero && skuEbayDouteux(it) ? `Sa référence ${it.sku} ne désigne plus sûrement une paire (numéro redonné depuis, ou porté par deux paires) : relie-la toi-même.` : undefined}>{numero ? `N°${numero}` : skuEbayDouteux(it) ? `${it.sku} à vérifier · pas reliée` : 'pas reliée'}</span>
            {obs != null ? ` · ${obs} observateur${obs > 1 ? 's' : ''}` : ''}
            {nb ? ` · ${nb} photo${nb > 1 ? 's' : ''}` : ''}
            {j != null ? ` · en ligne depuis ${j} j` : ''}
            {compteNom ? <span data-ebay-carte-compte style={{ color: E.muted }}>{` · ${compteNom}`}</span> : null}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="vrm-display" data-ebay-prix={prixVuN != null ? prixVuN.toFixed(2) : ''} style={{ fontSize: 16, fontWeight: 800, color: E.text }}>{euro(prixCarte)}</div>
          {/* (16 octobre, revue) « détails ▼ » est remplacé par le bouton « ⋯ »
              de la rangée d'actions ; ce bloc vide garde la forme que la
              feuille de style de la carte attend (prix, puis une ligne). */}
          <div aria-hidden="true" />
        </div>
      </div>
      {/* ── (16 octobre, revue) UNE rangée d'actions : le geste principal
          (relier quand le lien manque, sinon l'offre aux observateurs), les
          autres en lien texte, la règle d'offre sur la même rangée, et « ⋯ »
          pour le reste (modifier, détails). Avant : deux ou trois boutons
          pleine hauteur empilés par carte. ── */}
      <div data-ebay-carte-actions={it.itemId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px', padding: '0 14px 10px 14px' }}>
      {!numero && <button type="button" data-relier-ouvrir={it.itemId} onClick={() => { setRelierOuvert((o) => !o); setOffreOuverte(false); setRegleOuverte(false); dire(''); }} style={btnE}>Relier à une paire</button>}
      {eligible === true && <button type="button" data-offre-ouvrir={it.itemId} onClick={() => { setOffreOuverte((o) => !o); setRelierOuvert(false); setRegleOuverte(false); dire(''); }} aria-label={obs ? `Faire une offre aux ${obs} observateur${obs > 1 ? 's' : ''}` : 'Faire une offre aux observateurs'} style={btnE}>{obs ? `Offre aux ${obs} observateur${obs > 1 ? 's' : ''}` : 'Offre aux observateurs'}</button>}
      {/* ── (9 octobre) LA RÈGLE D'OFFRE : une ligne, ou une porte. Trois
          états — « pas su » n'affiche AUCUN montant et ne dit pas « aucune ».
          La raison d'un « pas su » se dit UNE fois au-dessus de la liste (§7). */}
      {et && (() => {
        const age = ageRegleJ(et), vieille = regleVieille(et);
        const attrs = { 'data-regle-offre-ligne': it.itemId, 'data-regle-offre': et.etat };
        if (et.etat === 'connue') { attrs['data-regle-accepte'] = Number(et.accepte).toFixed(2); attrs['data-regle-refuse'] = et.refuse != null ? Number(et.refuse).toFixed(2) : ''; if (vieille) attrs['data-regle-age'] = String(age); }
        if (et.etat === 'pas-su') attrs['data-regle-raison'] = et.raison;
        if (bloquee) attrs['data-regle-bloquee'] = bloquee.k;
        // (11 octobre, revue — tour 3) « Seuil relu, offres activées ou non pas
        // montré » ne ressemble plus à « jamais lue » : la carte dit le seuil que
        // eBay MONTRE (relu, ce n'est pas une donnée périmée) et donne SON geste,
        // le lien vers l'annonce — deux cartes « — » identiques ne disaient pas
        // laquelle regarder, et la ligne du haut n'avait pas de lien.
        const seuilMontre = et.etat === 'pas-su' && et.raison === 'offres-inconnues' && et.lu && et.lu.accepte != null;
        if (seuilMontre) attrs['data-regle-seuil-lu'] = Number(et.lu.accepte).toFixed(2);
        const montant = et.etat === 'connue'
          ? <>eBay accepte dès <b style={{ color: E.text }}>{eurEbay(et.accepte)}</b>{et.refuse != null ? <> · refuse sous {eurEbay(et.refuse)}</> : null}{vieille ? ` · lue il y a ${age} j` : ''}</>
          : (et.etat === 'aucune' && et.refuse != null && et.offresActives === true ? <>eBay refuse sous {eurEbay(et.refuse)}</>
            : (seuilMontre ? <>eBay montre un seuil dès {eurEbay(et.lu.accepte)} — activées ou non : pas montré{url ? <> · <a href={url} target="_blank" rel="noreferrer" data-regle-offres-inconnues-lien={it.itemId} onClick={(ev) => ev.stopPropagation()} style={{ color: E.accentSoft, fontWeight: 700, textDecoration: 'none' }}>Voir sur eBay ↗</a></> : null}</>
              : (et.etat === 'pas-su' ? '—' : null)));
        const btnR = { ...btnE, border: 'none', background: 'transparent', color: E.accentSoft, padding: '6px 2px', fontSize: 12.5, fontWeight: 700, opacity: (gesteBloque || envoiRegle) ? 0.45 : 1, cursor: (gesteBloque || envoiRegle) ? 'default' : 'pointer' };
        return (
          <div {...attrs} style={{ order: 2, flex: '1 1 100%', minWidth: 0, fontSize: 12.5, color: E.muted, lineHeight: 1.45 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: (montant === '—' || montant == null) ? 'nowrap' : 'wrap' }}>
              {montant != null && <span style={{ minWidth: 0 }}>Offres reçues : {montant}</span>}
              {et.etat === 'connue'
                ? <button type="button" data-regle-modifier={it.itemId} disabled={gesteBloque || !!envoiRegle} onClick={ouvrirRegle} style={btnR}>Modifier</button>
                : <button type="button" data-regle-ouvrir={it.itemId} disabled={gesteBloque || !!envoiRegle} onClick={ouvrirRegle} style={{ ...btnR, whiteSpace: 'nowrap' }}>Définir une règle</button>}
              {bloquee && regleEngage(et) && <button type="button" data-regle-retirer-direct={it.itemId} disabled={!!envoiRegle || enLot} onClick={retirerRegle} style={{ ...btnR, opacity: (envoiRegle || enLot) ? 0.45 : 1, cursor: (envoiRegle || enLot) ? 'default' : 'pointer' }}>{envoiRegle === 'retrait' ? 'Envoi…' : 'Retirer la règle'}</button>}
            </div>
            {bloquee && bloquee.t && <div data-regle-bloquee-texte={bloquee.k} style={{ fontSize: 11.5, color: E.warn, marginTop: 4 }}>{bloquee.t}</div>}
          </div>
        );
      })()}
      <button type="button" data-ebay-carte-plus={it.itemId} aria-label={open ? "Masquer les détails de l'annonce" : "Plus d'actions et détails de l'annonce"} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ ...btnE, order: 1, marginLeft: 'auto', border: 'none', background: 'transparent', color: E.muted, padding: '6px 10px', fontSize: 18, lineHeight: 1, minWidth: 44 }}>{open ? '×' : '⋯'}</button>
      </div>
      {regleOuverte && et && (
        <div data-regle-panneau={it.itemId} {...(regleSignal === 'prix-change' ? { 'data-regle-prix-change': '1' } : {})} {...(regleSignal === 'existante' ? { 'data-regle-existante': '1' } : {})}
          style={{ margin: '0 14px 12px', background: E.card2, borderRadius: 12, padding: '11px 12px' }}>
          <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 8 }}>
            {prixVuN ? <>Prix de l'annonce : <b style={{ color: E.text }}>{eurEbay(prixVuN)}</b>. </> : null}Une offre égale ou supérieure au montant ci-dessous est acceptée par eBay sans te demander : la paire est vendue à ce prix. En dessous, l'offre t'arrive sur eBay.
            {et.etat === 'pas-su' && et.raison === 'offres-inconnues' && et.lu
              ? <span data-regle-panneau-offres-inconnues={it.itemId}>{` Règle actuelle : eBay montre un seuil${et.lu.accepte != null ? ` dès ${eurEbay(et.lu.accepte)}` : ''}${et.lu.refuse != null ? ` (refus sous ${eurEbay(et.lu.refuse)})` : ''}, mais pas si les offres y sont activées. En enregistrant, VRM les active.`}</span>
              : (et.etat === 'pas-su' ? ' Règle actuelle : pas encore lue chez eBay — si elle existe, rien ne sera remplacé sans te le redemander.' : '')}
          </div>
          {!prixVuN && <div style={{ fontSize: 12, color: E.warn, marginBottom: 8 }}>Prix de l'annonce pas lu — rouvre l'écran.</div>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 11.5, color: E.muted, flex: '1 1 150px', minWidth: 0 }}>Accepter les offres dès (€)<br />
              <input value={saisieA} onChange={(e) => { setSaisieA(e.target.value); setSousMoitieOk(false); }} inputMode="decimal" placeholder="montant en €" data-regle-saisie-accepte={it.itemId} style={{ ...inpE, width: '100%', maxWidth: 160 }} /></label>
            <label style={{ fontSize: 11.5, color: E.muted, flex: '1 1 150px', minWidth: 0 }}>Refuser les offres sous (€) — facultatif<br />
              <input value={saisieR} onChange={(e) => setSaisieR(e.target.value)} inputMode="decimal" placeholder="montant en €" data-regle-saisie-refuse={it.itemId} style={{ ...inpE, width: '100%', maxWidth: 160 }} /></label>
          </div>
          {errSaisie && <div data-regle-erreur={it.itemId} style={{ fontSize: 11.5, color: E.warn, marginTop: 6 }}>{errSaisie}</div>}
          {tropBas && (
            <label data-regle-sous-moitie={it.itemId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: E.warn, marginTop: 8, lineHeight: 1.4, cursor: 'pointer' }}>
              <input type="checkbox" checked={sousMoitieOk} onChange={(e) => setSousMoitieOk(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Je fixe volontairement {eurEbay(vSaisie.accepte)} — {pctSaisi} % du prix de l'annonce.</span>
            </label>
          )}
          {typeof achat === 'number' && (sousAchat
            ? <div data-regle-achat="sous" data-regle-sous-achat={it.itemId} style={{ fontSize: 11.5, color: E.warn, marginTop: 6, lineHeight: 1.45 }}>C'est sous ton prix d'achat ({eurEbay(achat)}), avant frais eBay : une offre à ce montant te ferait vendre à perte.</div>
            : <div data-regle-achat="connu" style={{ fontSize: 11.5, color: E.muted, marginTop: 6 }}>Prix d'achat : {eurEbay(achat)}.</div>)}
          {achat === null && <div data-regle-achat="pas-saisi" style={{ fontSize: 11.5, color: E.muted, marginTop: 6 }}>Prix d'achat pas saisi (Vinted → Annonces → Coût d'achat).</div>}
          {et.offresFaites > 0 && <div data-regle-offres-faites={et.offresFaites} style={{ fontSize: 11.5, color: E.muted, marginTop: 6, lineHeight: 1.45 }}>eBay compte {et.offresFaites} offre{et.offresFaites > 1 ? 's' : ''} déjà faite{et.offresFaites > 1 ? 's' : ''} sur cette annonce : si l'une attend encore ta réponse et atteint le montant, eBay peut l'accepter dès que la règle est posée.</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" data-regle-enregistrer={it.itemId} disabled={!peutEnregistrer} onClick={enregistrerRegle} style={{ ...btnE, border: 'none', background: E.accent, color: '#fff', opacity: peutEnregistrer ? 1 : 0.45, cursor: peutEnregistrer ? 'pointer' : 'default' }}>{envoiRegle === 'pose' ? 'Envoi…' : 'Enregistrer la règle'}</button>
            <button type="button" data-regle-annuler={it.itemId} onClick={() => { setRegleOuverte(false); setRegleSignal(''); }} style={{ ...btnE, color: E.muted }}>Annuler</button>
            {et.lu && (et.lu.accepte != null || et.lu.refuse != null) && <button type="button" data-regle-retirer={it.itemId} disabled={!!envoiRegle || enLot} onClick={retirerRegle} style={{ ...btnE, opacity: (envoiRegle || enLot) ? 0.45 : 1 }}>{envoiRegle === 'retrait' ? 'Envoi…' : 'Retirer la règle'}</button>}
          </div>
        </div>
      )}
      {relierOuvert && (
        <div data-relier-panneau={it.itemId} style={{ margin: '0 14px 12px', background: E.card2, borderRadius: 12, padding: '11px 12px' }}>
          <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 8 }}>Quelle paire est en vente dans cette annonce ? C'est toi qui choisis : VRM ne la devine pas d'après le titre.</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: choix.length ? 2 : 0 }}>
            <input value={numSaisi} onChange={(e) => setNumSaisi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') relier(numSaisi); }} data-relier-num={it.itemId}
              inputMode={clavierNum()} placeholder="N° de la paire" aria-label="N° de la paire" style={{ ...inpE, width: 140 }} />
            <button type="button" data-relier-valider={it.itemId} disabled={!!geste || !numSaisi.trim()} onClick={() => relier(numSaisi)} style={{ ...btnE, opacity: (geste || !numSaisi.trim()) ? 0.5 : 1 }}>{geste === 'relier' ? 'Envoi…' : 'Relier'}</button>
          </div>
          {choix.map((p) => (
            <button key={p.id} type="button" data-relier-paire={p.num} disabled={!!geste} onClick={() => relier(p.num)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: `1px solid ${E.border}`, borderRadius: 10, background: E.card, padding: '7px 9px', marginTop: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <PhotoVente src={p.cover || (p.photos || [])[0]} size={38} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: E.text }}>N°{p.num}{p.memePhoto ? <span style={{ color: E.accentSoft, fontWeight: 600 }}> · même photo</span> : null}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: E.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || '—'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {offreOuverte && eligible === true && (
        <div data-offre-panneau={it.itemId} style={{ margin: '0 14px 12px', background: E.card2, borderRadius: 12, padding: '11px 12px' }}>
          <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 8 }}>eBay envoie l'offre aux personnes qui suivent l'annonce, valable 48 h. Si l'une accepte, la paire est vendue à ce prix.</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11.5, color: E.muted }}>Remise %<br /><input value={remise} onChange={(e) => setRemise(e.target.value)} inputMode="numeric" data-offre-remise={it.itemId} style={{ ...inpE, width: 76 }} /></label>
            <div style={{ fontSize: 12.5, color: E.muted, paddingBottom: 10 }}>soit <b data-offre-prix={prixRemise != null ? prixRemise.toFixed(2) : ''} style={{ color: E.text, fontSize: 15 }}>{prixRemise != null ? eurE(prixRemise) : '—'}</b>{isFinite(prixBase) && prixBase > 0 ? <> au lieu de {eurE(prixBase)}</> : null}</div>
          </div>
          {!remiseOk && <div style={{ fontSize: 11.5, color: E.warn, marginTop: 6 }}>Entre 5 et 50 %, un nombre entier.</div>}
          {/* (9 octobre) La règle d'offre ne joue pas sur une offre qu'il ENVOIE. */}
          {et && et.etat === 'connue' && prixRemise != null && prixRemise < et.accepte && (
            <div data-offre-sous-regle={it.itemId} style={{ fontSize: 11.5, color: E.warn, marginTop: 6, lineHeight: 1.45 }}>C'est sous ta règle d'offre ({eurEbay(et.accepte)}) : si l'une accepte, la paire part à {eurEbay(prixRemise)}.</div>
          )}
          <textarea value={mot} onChange={(e) => setMot(e.target.value)} maxLength={2000} rows={2} placeholder="Message (facultatif)" data-offre-message={it.itemId}
            style={{ ...inpE, width: '100%', marginTop: 9, resize: 'vertical', lineHeight: 1.45 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
            <button type="button" data-offre-envoyer={it.itemId} disabled={!!geste || !remiseOk} onClick={envoyerOffre} style={{ ...btnE, border: 'none', background: E.accent, color: '#fff', opacity: (geste || !remiseOk) ? 0.5 : 1 }}>{geste === 'offre' ? 'Envoi…' : 'Envoyer l\'offre'}</button>
            <button type="button" onClick={() => setOffreOuverte(false)} style={{ ...btnE, color: E.muted }}>Annuler</button>
          </div>
        </div>
      )}
      {info && <div data-ebay-info={it.itemId} data-ebay-info-ton={infoTon || (/^✓/.test(info) ? 'ok' : 'warn')} style={{ fontSize: 11.5, color: (infoTon ? infoTon === 'ok' : /^✓/.test(info)) ? E.text : E.warn, margin: '0 14px 11px', lineHeight: 1.45 }}>{info}{lienEbayInfo && url ? <> <a href={url} target="_blank" rel="noreferrer" style={{ color: E.accentSoft, fontWeight: 700 }}>Voir sur eBay ↗</a></> : null}</div>}
      {open && (
        <div style={{ padding: '0 14px 13px 14px' }}>
          {(d.categoryName || d.condition) && (
            <div style={{ fontSize: 11.5, color: E.muted, marginBottom: 8, lineHeight: 1.45 }}>
              {d.condition ? <>État : <b style={{ color: E.text }}>{d.condition}</b></> : null}
              {d.categoryName ? <>{d.condition ? ' · ' : ''}Catégorie : <b style={{ color: E.text }}>{String(d.categoryName).split(':').pop()}</b></> : null}
            </div>
          )}
          {specs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: desc ? 10 : 0 }}>
              {specs.map(([k, v]) => <span key={k} style={chip}><span style={{ color: E.muted }}>{k} : </span>{String(v)}</span>)}
            </div>
          )}
          {desc && <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 10 }}>{desc.slice(0, 280)}{desc.length > 280 ? '…' : ''}</div>}
          {/* ── Modifier prix / stock ── */}
          {!edit ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" data-ebay-revise-ouvrir={it.itemId} onClick={() => { setEdit(true);setMsg('');setPrice(null);setQty(String(it.qty ?? ''));setTitreEdite(it.title || '');setDescEditee(descSimple); }} style={{ border: `1px solid ${E.border}`, background: 'transparent', color: E.text, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Modifier l’annonce</button>
              {/* Le lien se change ici (la confirmation dit « tu pourras la
                  changer ») ; il ne s'affiche en façade que quand il MANQUE. */}
              {numero && <button type="button" data-relier-changer={it.itemId} onClick={() => { setRelierOuvert((o) => !o); setOffreOuverte(false); setRegleOuverte(false); dire(''); }} style={btnE}>Changer la paire reliée</button>}
              <button type="button" disabled={saving} onClick={terminer} style={btnE}>Terminer l’annonce</button>
              {onRelire && <button type="button" data-ebay-regle-relire-carte={it.itemId} onClick={async()=>{await onRelire();setRelectureNecessaire(false);}} style={btnE}>{relectureNecessaire?'Vérifier la règle sur eBay':'Actualiser la règle d’offre'}</button>}
              {url && <a href={url} target="_blank" rel="noreferrer" style={{ color: E.accentSoft, fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>Voir sur eBay ↗</a>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11.5, color: E.muted }}>Prix {it.currency || it.detail?.currency || '—'}<br /><input value={champPrix} onChange={e => setPrice(e.target.value)} inputMode="decimal" data-ebay-revise-prix={it.itemId} style={inpE} /></label>
              <label style={{ fontSize: 11.5, color: E.muted }}>Stock<br /><input value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" data-ebay-revise-stock={it.itemId} style={{ ...inpE, width: 72 }} /></label>
              <button type="button" data-ebay-revise-enregistrer={it.itemId} onClick={enregistrer} disabled={saving} style={{ border: 'none', background: E.accent, color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Envoi…' : 'Enregistrer'}</button>
              <label style={{fontSize:11.5,color:E.muted,flex:'1 1 100%'}}>Titre<input aria-label="Titre de l’annonce eBay" maxLength={80} value={titreEdite} onChange={e=>setTitreEdite(e.target.value)} style={{...inpE,width:'100%',marginTop:4}}/></label>
              <label style={{fontSize:11.5,color:E.muted,flex:'1 1 100%'}}>Description<textarea aria-label="Description de l’annonce eBay" value={descEditee} onChange={e=>setDescEditee(e.target.value)} rows={4} style={{...inpE,width:'100%',marginTop:4}}/></label>
              <button type="button" onClick={enregistrerTexte} disabled={saving} style={btnE}>Enregistrer le texte</button>
              <button type="button" onClick={() => { setEdit(false); setMsg(''); }} style={{ border: `1px solid ${E.border}`, background: 'transparent', color: E.muted, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            </div>
          )}
          {/* (9 octobre) Une règle d'offre connue : le nouveau prix la touche peut-être. */}
          {edit && et && et.etat === 'connue' && prixChange && (
            <div data-regle-rappel={it.itemId} style={{ fontSize: 11.5, color: E.muted, marginTop: 7, lineHeight: 1.45 }}>
              Ta règle d'offre : eBay accepte dès {eurEbay(et.accepte)} — {Math.round(et.accepte / prixTape * 100)} % du nouveau prix. Changer le prix peut la faire tomber : VRM la relit après et te le dit.
            </div>
          )}
          {/* Couleur FIXÉE (9 octobre) : jamais le vert ni le rouge (§7). */}
          {msg && <div data-ebay-revise-msg={it.itemId} data-ebay-revise-ton={msgTon} style={{ fontSize: 11.5, color: msgTon === 'ok' ? E.text : E.warn, marginTop: 7 }}>{msg}</div>}
          {specs.length === 0 && !d.categoryName && !desc && <div style={{ fontSize: 12, color: E.muted, marginTop: 8 }}>Caractéristiques pas encore captées pour cette annonce — rouvre-la sur eBay.</div>}
        </div>
      )}
    </div>
  );
}
// ── eBay → Annonces · BROUILLONS (5 octobre) ─────────────────────────────────
// Ses annonces eBay prêtes mais pas parties : on en coche une, plusieurs ou
// toutes, on les VÉRIFIE chez eBay (à blanc : rien n'est créé, les frais
// remontent par nom), puis on les PROGRAMME. Ce qui manque est dit brouillon
// par brouillon — la MÊME règle que le formulaire (`itemDeBrouillon`, §11).
function EbayBrouillons({ brouillons, connected, paires = [], onModifier, onPlanifier, onBrouillons, vue = '*', comptesPub = [] }) {
  const E = EBAY_SKIN;
  const [choix, setChoix] = React.useState(() => new Set());
  const [verifs, setVerifs] = React.useState({});      // id → {etat:'en-cours'|'ok'|'refus'|'erreur', frais, err, cle}
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  // (9 octobre) La vue d'UN compte ne montre que ses brouillons rattachés — et
  // ceux qui ne le sont à aucun (ils ne sont à personne d'autre).
  const liste = React.useMemo(() => {
    if (!brouillons || typeof brouillons !== 'object') return [];
    return Object.values(brouillons).filter((d) => d && d.id && (!d.etatBrouillon || d.etatBrouillon === 'brouillon'))
      .filter((d) => vue === '*' || !d.compte || d.compte === vue)
      .sort((a, b) => (b.majLe || 0) - (a.majLe || 0));
  }, [brouillons, vue]);
  const plusieurs = Array.isArray(comptesPub) && comptesPub.length >= 2;
  // Les coches suivent la liste : un brouillon parti (programmé, supprimé)
  // n'est plus coché en douce.
  const ids = liste.map((d) => d.id);
  const coches = ids.filter((id) => choix.has(id));
  const couverture = (d) => d.cover || (d.photos || [])[0] || (paires.find((p) => p.id === d.pairId) || {}).cover || '';
  const basculer = (id) => setChoix((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tout = () => setChoix((s) => (coches.length === ids.length ? new Set() : new Set(ids)));
  // VÉRIFIER LA SÉLECTION : une vérification à blanc PAR brouillon, l'une après
  // l'autre (on attend chaque réponse). Le résultat est gardé dans le
  // brouillon (une écriture à la fin, jamais sur une lecture ratée).
  const verifierSelection = async () => {
    const lot = liste.filter((d) => choix.has(d.id));
    if (!lot.length) return;
    setBusy(true); setMsg('');
    const res = {};
    for (const d of lot) {
      const b = itemDeBrouillon(d);
      if (b.err) { res[d.id] = { etat: 'refus', err: b.err, at: Date.now() }; setVerifs((v) => ({ ...v, [d.id]: res[d.id] })); continue; }
      setVerifs((v) => ({ ...v, [d.id]: { etat: 'en-cours' } }));
      const r = await appelEbay({ action: 'pubverify', item: b.item, ...corpsCompteEbay(d.compte) });
      const j = r.j;
      res[d.id] = (j && j.ok) ? { etat: 'ok', frais: j.frais || null, fees: j.fees == null ? null : j.fees, cle: cleVerifEbay(b.item, ''), at: Date.now() }
        : (r.code === 200 && j) ? { etat: 'refus', err: j.error || 'eBay refuserait cette annonce.', at: Date.now() }
        : { etat: 'erreur', err: (j && j.error) || 'eBay n\'a pas répondu — réessaie.', at: Date.now() };
      setVerifs((v) => ({ ...v, [d.id]: res[d.id] }));
    }
    const w = await modifierBrouillonsEbay((items) => { for (const id in res) if (items[id]) items[id] = { ...items[id], verif: res[id] }; return items; });
    if (w.ok) { if (onBrouillons) onBrouillons(w.items); }
    else setMsg('Vérifié, mais je n\'ai pas pu garder le résultat dans tes brouillons (la base n\'a pas répondu).');
    setBusy(false);
  };
  const supprimer = async (d) => {
    const ok = await askConfirm({ title: `Supprimer le brouillon « ${d.titre || 'sans titre'} » ?`, desc: 'Rien n\'est parti chez eBay : seul ce brouillon disparaît de VRM.', ok: 'Oui, supprimer', cancel: 'Annuler', danger: true });
    if (!ok) return;
    const w = await modifierBrouillonsEbay((items) => { delete items[d.id]; return items; });
    if (w.ok) { setChoix((s) => { const n = new Set(s); n.delete(d.id); return n; }); if (onBrouillons) onBrouillons(w.items); }
    else setMsg(w.raison === 'lecture' ? 'Je n\'ai pas pu relire tes brouillons — rien n\'a été supprimé.' : 'La suppression a échoué — réessaie.');
  };
  const etatListe = brouillons === undefined ? 'charge' : brouillons === null ? 'pas-su' : 'lu';
  const btn = { border: `1px solid ${E.border}`, background: 'transparent', color: E.text, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  if (etatListe === 'lu' && !liste.length) return <div data-ebay-brouillons="lu" data-nb="0" style={{ fontSize: 12, color: E.muted, margin: '12px 2px 0', lineHeight: 1.5 }}>Aucun brouillon eBay.{connected === true ? <> Prépare une annonce ci-dessus et « Enregistrer en brouillon » : tu pourras la vérifier, puis la programmer.</> : null}</div>;
  return (
    <div data-ebay-brouillons={etatListe} data-nb={liste.length} style={{ background: E.card, border: `1px solid ${E.border}`, borderRadius: 14, padding: '12px 14px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ flex: '1 1 auto', fontSize: 16, fontWeight: 800, color: E.text }}>Brouillons{liste.length ? ` (${liste.length})` : ''}</span>
        {liste.length > 1 && <button type="button" data-brouillons-tout="1" onClick={tout} style={{ ...btn, border: 'none', padding: '4px 0', color: E.accentSoft }}>{coches.length === ids.length ? 'Tout désélectionner' : 'Tout sélectionner'}</button>}
      </div>
      {etatListe === 'charge' && <div style={{ fontSize: 12.5, color: E.muted }}>Chargement…</div>}
      {etatListe === 'pas-su' && <div style={{ fontSize: 12.5, color: E.warn, lineHeight: 1.5 }}>Je n'ai pas pu lire tes brouillons — rien n'est perdu, c'est la lecture qui a échoué. Rouvre l'écran dans un moment.</div>}
      {liste.map((d, i) => {
        const b = itemDeBrouillon(d);
        const v0 = verifs[d.id] || d.verif || null;
        const cle = b.item ? cleVerifEbay(b.item, '') : '';
        // Une vérification ne vaut que pour l'annonce TELLE QU'ELLE EST : un
        // brouillon modifié depuis redevient « à vérifier ».
        const v = v0 && (v0.etat !== 'ok' || v0.cle === cle) ? v0 : null;
        const etat = b.err ? 'incomplet' : v ? (v.etat === 'en-cours' ? 'verif-en-cours' : v.etat === 'ok' ? 'verifie' : 'refuse') : 'a-verifier';
        const coche = choix.has(d.id);
        return (
          <div key={d.id} data-brouillon={d.id} data-brouillon-etat={etat} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${E.border}` : 'none' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, margin: '2px -8px 0 -10px', flexShrink: 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={coche} onChange={() => basculer(d.id)} data-brouillon-choix={d.id} aria-label={`Choisir ${d.titre || 'ce brouillon'}`} style={{ width: 22, height: 22, margin: 0, accentColor: E.accent }} />
            </label>
            <PhotoVente src={couverture(d)} size={48} />
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: E.text, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.numero ? <b>N°{cleNum(d.numero)} · </b> : null}{d.titre || '(sans titre)'}</div>
              <div style={{ fontSize: 11.5, color: E.muted, marginTop: 2 }}>{d.prix ? eurEbay(Number(String(d.prix).replace(',', '.')) || 0) : 'prix —'}{d.categorie && d.categorie.nom ? ` · ${String(d.categorie.nom).split(':').pop()}` : ''}{plusieurs && vue === '*' && d.compte ? <span data-brouillon-compte={d.compte}>{` · ${nomCompteEbay(comptesPub.find((c) => c.ref === d.compte) || { principal: d.compte === 'principal' })}`}</span> : null}{!d.numero ? <span style={{ color: E.warn }}> · pas de N°</span> : null}{(() => { const a = montantSaisi(d.offreAccepte); return Number.isFinite(a) && a > 0 ? <span data-brouillon-offre={a.toFixed(2)}>{` · offres dès ${eurEbay(a)}`}</span> : null; })()}</div>
              {d.envoi && d.envoi.ok === false && <div data-brouillon-echec={d.id} style={{ fontSize: 11.5, color: E.warn, marginTop: 3, lineHeight: 1.45 }}>Échec de la programmation : {d.envoi.err}</div>}
              {b.err ? <div style={{ fontSize: 11.5, color: E.warn, marginTop: 3, lineHeight: 1.45 }}>{b.err}</div>
                : etat === 'verif-en-cours' ? <div style={{ fontSize: 11.5, color: E.muted, marginTop: 3 }}>eBay vérifie…</div>
                : etat === 'verifie' ? <div data-brouillon-frais={v.fees == null ? 'pas-su' : String(v.fees)} style={{ fontSize: 11.5, color: E.text, marginTop: 3, lineHeight: 1.45 }}>✓ eBay l'accepterait · {lignesFraisEbay(v.frais, false).map((l) => `${l.nom} ${l.montant == null ? '—' : eurEbay(l.montant)}`).join(' · ')} · total {v.fees == null ? '— (pas annoncé)' : eurEbay(v.fees)}</div>
                : etat === 'refuse' ? <div data-brouillon-refus={d.id} style={{ fontSize: 11.5, color: E.warn, marginTop: 3, lineHeight: 1.45 }}>⚠️ {v.err}</div>
                : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button type="button" data-brouillon-modifier={d.id} onClick={() => onModifier && onModifier(d)} style={btn}>Modifier</button>
              <button type="button" data-brouillon-supprimer={d.id} onClick={() => supprimer(d)} aria-label="Supprimer ce brouillon" style={{ ...btn, borderColor: 'transparent', color: E.danger }}>Supprimer</button>
            </div>
          </div>
        );
      })}
      {liste.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" data-brouillons-verifier={coches.length} disabled={busy || !coches.length || connected !== true} onClick={verifierSelection}
            style={{ ...btn, flex: '1 1 160px', maxWidth: 320, padding: '11px 14px', opacity: (busy || !coches.length || connected !== true) ? 0.5 : 1 }}>{busy ? 'eBay vérifie…' : `Vérifier la sélection${coches.length ? ` (${coches.length})` : ''}`}</button>
          <button type="button" data-brouillons-programmer={coches.length} disabled={busy || !coches.length || connected !== true} onClick={() => onPlanifier && onPlanifier(coches)}
            style={{ ...btn, flex: '1 1 160px', maxWidth: 320, padding: '11px 14px', border: 'none', background: E.accent, color: '#fff', opacity: (busy || !coches.length || connected !== true) ? 0.5 : 1 }}>{`Programmer la sélection${coches.length ? ` (${coches.length})` : ''}`}</button>
        </div>
      )}
      {liste.length > 0 && connected !== true && <div style={{ fontSize: 11.5, color: E.muted, marginTop: 6 }}>{connected === false ? 'Relie ton compte eBay (onglet « Compte eBay ») pour vérifier et programmer.' : connected === null ? 'Je n\'ai pas pu savoir si ton compte eBay est relié — rouvre l\'écran dans un moment.' : ''}</div>}
      {msg && <div style={{ fontSize: 12, color: E.warn, marginTop: 8, lineHeight: 1.45 }}>{msg}</div>}
    </div>
  );
}

// ── LE PLANIFICATEUR (5 octobre) ─────────────────────────────────────────────
// « Programmer la sélection » : il règle TOUT — le départ (préréglages qu'il
// modifie, ou une date et une heure), le nombre par jour, la plage horaire,
// les jours, l'écart fixe entre deux annonces, l'ordre. L'aperçu donne
// l'heure EXACTE de chaque paire (heure de Paris), puis les frais LUS chez
// eBay pour CETTE heure, avant la moindre confirmation.
// ⚠️ Ce qu'on ne peut pas prouver est DIT, jamais promis : l'annulation d'une
//    annonce programmée par l'API n'est pas garantie, et une paire vendue
//    ailleurs avant son heure peut quand même partir. Il le lit et coche
//    « j'ai compris » avant sa PREMIÈRE programmation — c'est sa décision.
function EbayPlanificateur({ brouillons = [], annoncesEbay, programmees, ventes, dejaSurEbay = null, onFermer, onBrouillons, onFini, comptesPub = [], compteDefaut = 'principal', onCompte }) {
  const E = EBAY_SKIN;
  // (9 octobre) Le lot part sur UN compte eBay, choisi ici (pré-choisi comme le
  // formulaire) ; la confirmation le NOMME. `annoncesEbay` et `programmees`
  // sont l'union de TOUS les comptes : une paire en vente ou programmée sur un
  // compte est écartée du lot, quel que soit le compte choisi.
  const plusieursPub = Array.isArray(comptesPub) && comptesPub.length >= 2;
  const [compteLotChoisi, setCompteLotChoisi] = React.useState(null);
  const compteLot = (compteLotChoisi && comptesPub.some((c) => c.ref === compteLotChoisi)) ? compteLotChoisi : compteDefaut;
  const nomCompteLot = nomCompteEbay(comptesPub.find((c) => c.ref === compteLot) || { principal: true });
  const [rythme, setRythmeBrut] = React.useState(() => rythmeEbay(load('vrm_ebay_rythme', null)));
  // §5.49 : un réglage synchronisé lu au montage — rattrapé à l'arrivée du
  // nuage, et seulement s'il est resté au défaut (jamais par-dessus un choix).
  React.useEffect(() => onCloudReady(() => {
    setRythmeBrut((r) => (JSON.stringify(r) === JSON.stringify(rythmeEbay(null)) ? rythmeEbay(load('vrm_ebay_rythme', null)) : r));
  }), []);
  const changerRythme = (patch) => { const n = rythmeEbay({ ...rythme, ...patch }); setRythmeBrut(n); save('vrm_ebay_rythme', n); };
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(t); }, []);
  // ── L'ANCRE DU PLANNING (6 octobre) : figée tant qu'il ne touche à rien. ──
  // Revue contradictoire, prouvée : les heures partaient de `maintenant`, qui
  // avance toutes les 30 s. Avec « Maintenant » (le préréglage par défaut) ou un
  // départ à moins de 20 min, CHAQUE heure bougeait à chaque tic — donc la clé
  // des frais vérifiés aussi : « Programmer 3 annonces » retombait à « 1 » sans
  // un mot, et une vérification de plus de 30 s ne pouvait jamais aboutir. Les
  // heures se calculent sur l'ANCRE (à la minute) ; le tic ne sert plus qu'à
  // voir qu'une heure est passée sous 16 min — et là on réancre, pour de vrai.
  const ancreDe = () => Math.floor(Date.now() / 60000) * 60000;
  const [ancre, setAncre] = React.useState(ancreDe);
  const [depart, setDepart] = React.useState(() => ({ mode: 'preset', id: (rythme.preregles[0] || {}).id || 'maintenant' }));
  const [editPre, setEditPre] = React.useState(false);
  const [verifs, setVerifs] = React.useState({});
  const [verifEnCours, setVerifEnCours] = React.useState(false);
  const [limites, setLimites] = React.useState(undefined);   // undefined · null · {quantite, montant, devise} · {reason:'scope'}
  const [compris, setCompris] = React.useState(false);
  const [envoi, setEnvoi] = React.useState(null);            // {en: n/total} pendant · {bilan} après
  React.useEffect(() => { let stop = false;
    setLimites(undefined);
    appelEbay({ action: 'limites', ...corpsCompteEbay(compteLot) }).then(({ j }) => { if (stop) return; setLimites(j && j.ok ? j : (j && j.reason === 'scope' ? { reason: 'scope' } : null)); });
    return () => { stop = true; }; }, [compteLot]);

  // ── Ce qui peut partir, et pourquoi pas le reste ──
  // (6 octobre) Sur la forme CANONIQUE du SKU (`numDeSkuEbay`, la lecture de
  // l'anti double vente) : « VRM-030 », « vrm-30 », « VRM 30 » sont la N°30 — en
  // comparant la chaîne brute, une seconde annonce partait.
  const skuCanon = (sku) => skuEbayDe(numDeSkuEbay(sku));
  const skusEnLigne = React.useMemo(() => new Set((Array.isArray(annoncesEbay) ? annoncesEbay : []).map((a) => a && skuCanon(a.sku)).filter(Boolean)), [annoncesEbay]);
  const progParSku = React.useMemo(() => { const m = new Map(); for (const p of (Array.isArray(programmees) ? programmees : [])) { const k = p && skuCanon(p.sku); if (k) m.set(k, p); } return m; }, [programmees]);
  // Déjà vendue, toutes plateformes, par le N° (`numerosDejaVendus`, §11).
  const vendusPartout = ventes && ventes.vendus && typeof ventes.vendus.get === 'function' ? ventes.vendus : null;
  const analyse = React.useMemo(() => { const dansLeLot = new Set(); return brouillons.map((d) => {
    const b = itemDeBrouillon(d);
    if (b.err) return { d, raison: b.err };
    const sku = d.numero ? skuEbayDe(d.numero) : '';
    if (!sku) return { d, raison: 'pas de N° : sans lui, VRM ne la retrouverait pas si elle se vendait ailleurs avant l\'heure' };
    if (skusEnLigne.has(sku)) return { d, raison: 'déjà en vente sur eBay' };
    // (17 oct.) La même paire déjà sur eBay sous un AUTRE N° (photo exacte).
    const jv = dejaSurEbay && typeof dejaSurEbay.get === 'function' ? dejaSurEbay.get(numDeSkuEbay(sku)) : null;
    if (jv && jv.via) return { d, raison: `déjà ${jv.etat === 'programmee' ? 'programmée' : 'en vente'} sur eBay sous la N°${jv.via} (même photo)` };
    const p = progParSku.get(sku);
    if (p) return { d, raison: `déjà programmée sur eBay${p.debut && Number.isFinite(Date.parse(p.debut)) ? ` (${quandParisTexte(Date.parse(p.debut))})` : ''}` };
    const ou = vendusPartout && vendusPartout.get(numDeSkuEbay(sku));
    if (ou) return { d, raison: `déjà vendue sur ${ou}` };
    // Une paire, une annonce — AUSSI à l'intérieur du lot : deux brouillons du
    // même N° partiraient avec deux identifiants d'envoi (le 488 d'eBay ne
    // protège pas). Le premier part, les suivants sont écartés et c'est dit.
    if (dansLeLot.has(sku)) return { d, raison: 'un autre brouillon de la même paire est déjà dans ce lot' };
    dansLeLot.add(sku);
    return { d, item: b.item, sku };
  }); }, [brouillons, skusEnLigne, progParSku, vendusPartout, dejaSurEbay]);
  const ordonnes = React.useMemo(() => {
    const ok = analyse.filter((x) => x.item);
    if (rythme.ordre === 'numero') return [...ok].sort((a, b) => triNum(a.d.numero, b.d.numero));
    if (rythme.ordre === 'prix') return [...ok].sort((a, b) => (Number(a.item.price) || 0) - (Number(b.item.price) || 0));
    return ok;
  }, [analyse, rythme.ordre]);
  const preregle = rythme.preregles.find((p) => p.id === depart.id) || rythme.preregles[0];
  const departConcret = depart.mode === 'libre' ? { date: depart.date, heure: depart.heure } : departDePreregle(preregle, ancre);
  const plan = React.useMemo(() => heuresDuLot({ depart: departConcret, parJour: rythme.parJour, de: rythme.de, a: rythme.a, jours: rythme.jours, ecart: rythme.ecart, n: ordonnes.length, maintenant: ancre }),
    [JSON.stringify(departConcret), rythme.parJour, rythme.de, rythme.a, JSON.stringify(rythme.jours), rythme.ecart, ordonnes.length, ancre]);
  const lignes = React.useMemo(() => (plan.heures || []).map((h, i) => {
    const x = ordonnes[i];
    return { ...x, h, cle: cleVerifEbay(x.item, h.utc) };
  }), [plan, ordonnes]);
  const verifDe = (l) => { const v = verifs[l.d.id]; return v && v.cle === l.cle ? v : null; };
  // Réancrer : quand il change un réglage (départ, rythme, préréglages) — et
  // quand une heure est VRAIMENT passée sous 16 min (eBay en exige 15). Jamais
  // pendant une vérification ni pendant un envoi : ce qui part est ce qui a été vu.
  const reglageCle = JSON.stringify([depart, rythme.parJour, rythme.de, rythme.a, rythme.jours, rythme.ecart, rythme.preregles]);
  const premierRendu = React.useRef(true);
  React.useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    if (envoi || verifEnCours) return;
    setAncre(ancreDe());
  }, [reglageCle]);
  React.useEffect(() => {
    if (envoi || verifEnCours) return;
    if (lignes.some((l) => !l.h.immediat && l.h.ms < Date.now() + 16 * 60000)) setAncre(ancreDe());
  }, [maintenant]);
  const verifier = async () => {
    setVerifEnCours(true);
    for (const l of lignes) {
      setVerifs((v) => ({ ...v, [l.d.id]: { cle: l.cle, etat: 'en-cours' } }));
      const r = await appelEbay({ action: 'pubverify', item: l.item, scheduleTime: l.h.utc || '', ...corpsCompteEbay(compteLot) });
      const j = r.j;
      const res = (j && j.ok) ? { cle: l.cle, etat: 'ok', frais: j.frais || {}, fees: j.fees == null ? null : j.fees }
        : (r.code === 200 && j) ? { cle: l.cle, etat: 'refus', err: j.error || 'eBay refuserait cette annonce.' }
        : { cle: l.cle, etat: 'erreur', err: (j && j.error) || 'eBay n\'a pas répondu — revérifie.' };
      setVerifs((v) => ({ ...v, [l.d.id]: res }));
    }
    setVerifEnCours(false);
  };
  // ── Les totaux : seulement ce qui est CONNU, et la couverture à côté (§5) ──
  const verifiees = lignes.map((l) => ({ l, v: verifDe(l) }));
  const pretes = verifiees.filter(({ v }) => v && v.etat === 'ok' && v.fees != null);
  const totalConnu = pretes.length === lignes.length && lignes.length > 0;
  const total = pretes.reduce((s, { v }) => s + v.fees, 0);
  const progConnues = pretes.filter(({ l, v }) => !l.h.immediat && v.frais && v.frais.programmation != null);
  const progPasSu = pretes.filter(({ l, v }) => !l.h.immediat && !(v.frais && v.frais.programmation != null)).length;
  const totalProg = progConnues.reduce((s, { v }) => s + v.frais.programmation, 0);
  const progPayante = progConnues.some(({ v }) => v.frais.programmation > 0);
  const nonVerifiees = verifiees.filter(({ v }) => !v || v.etat !== 'ok').length;
  const perime = pretes.some(({ l }) => !l.h.immediat && l.h.ms < Date.now() + 16 * 60000);
  const programmees0 = Array.isArray(programmees) ? programmees.length : null;
  const enLigne0 = Array.isArray(annoncesEbay) ? annoncesEbay.length : null;
  const montantLot = lignes.reduce((s, l) => s + (Number(l.item.price) || 0), 0);
  const montantEnVente = (Array.isArray(annoncesEbay) ? annoncesEbay : []).reduce((s, a) => s + (Number(String((a && a.price) || '').replace(',', '.')) || 0), 0) + (Array.isArray(programmees) ? programmees : []).reduce((s, a) => s + (Number(String((a && a.price) || '').replace(',', '.')) || 0), 0);
  const besoinCompris = !rythme.risqueCompris;
  // « Pas su » ne vaut pas « pas vendue » : sans les ventes Vinted, eBay ET
  // Leboncoin lues, rien ne part (§5).
  const ventesSues = !!(ventes && !ventes.enCours && Array.isArray(ventes.pasSu) && !ventes.pasSu.length);
  const peutConfirmer = !envoi && !verifEnCours && pretes.length > 0 && ventesSues && !perime && (!besoinCompris || compris);
  // ── ENVOYER : une par une, chacune avec son UUID (gardé dans le brouillon
  //    AVANT l'envoi : un second essai après une coupure réutilise le même). ──
  const confirmer = async () => {
    const lot = pretes.map(({ l, v }) => ({ l, v }));
    const premiere = lot[0].l.h, derniere = lot[lot.length - 1].l.h;
    const quand = (h) => h.immediat ? 'tout de suite' : `${jourParisTexte(h.date)} à ${h.heure}`;
    // (9 octobre) Les annonces qui partent avec une RÈGLE D'OFFRE : chaque
    // montant est écrit — eBay vendra à ce prix sans lui demander.
    const avecOffre = lot.filter(({ l }) => l.item && l.item.offre);
    // (11 octobre, revue — tour 3) La feuille ne disait pas qu'une offre
    // acceptée VEND la paire — la forme exigée par la décision du 9 octobre, et
    // ce que disent la carte, le lot et la publication (§11). Avec
    // « Maintenant », la règle est active dès la confirmation.
    const texteOffres = avecOffre.length
      ? `\n${avecOffre.length} avec une règle d'offre — dès la mise en ligne, toute offre égale ou supérieure au montant ${OFFRE_VEND_LA_PAIRE} :` + avecOffre.map(({ l }) => {
        const p = Number(String(l.item.price).replace(',', '.')); const o = l.item.offre;
        return `\n« ${l.item.title || ''} » ${eurEbay(p)} → dès ${eurEbay(o.accepte)} (${p > 0 ? Math.round(o.accepte / p * 100) : '—'} %)${o.sousMoitie ? ' — moins de la moitié, confirmé dans le brouillon' : ''}`;
      }).join('')
      : '';
    const ok = await askConfirm({
      title: `Programmer ${lot.length} annonce${lot.length > 1 ? 's' : ''} sur eBay${plusieursPub ? ` (compte « ${nomCompteLot} »)` : ''} ?`,
      desc: `De ${quand(premiere)} à ${quand(derniere)} (heure de Paris, ± 15 min : c'est eBay qui arrondit).`
        + `\nFrais annoncés par eBay : ${eurEbay(lot.reduce((s, x) => s + x.v.fees, 0))}${progConnues.length ? ` (dont programmation ${eurEbay(totalProg)})` : ''}${progPayante ? ' — facturés à la création, non remboursés si tu annules.' : '.'}`
        + (progPasSu ? `\nFrais de programmation pas annoncés par eBay pour ${progPasSu} annonce${progPasSu > 1 ? 's' : ''}.` : '')
        + `\nC'est eBay qui les mettra en ligne à ces heures, même si VRM est fermé. Si une paire se vend ailleurs avant son heure, VRM te le dira — mais l'annulation peut devoir se faire sur eBay.`
        + texteOffres,
      ok: 'Oui, programmer', cancel: 'Annuler',
    });
    if (!ok) return;
    if (besoinCompris) changerRythme({ risqueCompris: true });
    if (plusieursPub && onCompte) onCompte(compteLot);
    const bilan = { programmees: [], refusees: [], incertaines: [] };
    setEnvoi({ en: 0, total: lot.length });
    for (let i = 0; i < lot.length; i++) {
      const { l, v } = lot[i];
      setEnvoi({ en: i + 1, total: lot.length });
      // (6 octobre) L'UUID déjà RANGÉ en base est GARDÉ : la copie de l'écran
      // peut être périmée (un essai « incertain » qui l'a rangé, un autre
      // onglet). En tirer un nouveau ôterait la protection 488 d'eBay — et un
      // second essai créerait une seconde annonce. On relit, on garde l'existant ;
      // écriture ratée ⇒ on n'envoie pas celle-là.
      let uuid = l.d.uuid || '';
      if (!uuid) {
        const neuf = uuidEnvoiEbay();
        let dejaRange = '';
        const w = await modifierBrouillonsEbay((items) => { const cur = items[l.d.id]; if (cur && cur.uuid) { dejaRange = String(cur.uuid); return false; } if (cur) items[l.d.id] = { ...cur, uuid: neuf }; return items; });
        if (!w.ok) { bilan.refusees.push({ d: l.d, err: 'Je n\'ai pas pu préparer son envoi (la base n\'a pas répondu) — rien n\'est parti.' }); continue; }
        uuid = dejaRange || neuf;
        if (onBrouillons) onBrouillons(w.items);
      }
      const corps = { action: 'programmer', confirme: true, uuid, fraisVus: v.fees, scheduleTime: l.h.utc || '', item: l.item, ...corpsCompteEbay(compteLot) };
      let r = await appelEbay(corps);
      const incertain = (x) => x.code === 0 || !x.j || x.code === 504 || (x.j && x.j.reason === 'incertain');
      // Le premier envoi a PEUT-ÊTRE créé l'annonce : ce doute ne s'efface plus.
      const repris = incertain(r);
      if (repris) {
        // On regarde d'abord CHEZ eBAY si elle est partie (par son SKU, forme
        // canonique), avant de redemander quoi que ce soit — puis UN seul
        // nouvel essai, avec le MÊME identifiant d'envoi.
        const p = await appelEbay({ action: 'programmees', ...corpsCompteEbay(compteLot) });
        const trouve = p.j && p.j.ok ? [...(p.j.items || []), ...(p.j.enLigne || [])].find((x) => x && skuCanon(x.sku) === l.sku) : null;
        if (trouve) r = { code: 200, j: { ok: true, itemId: trouve.itemId, debut: trouve.debut || null, retrouvee: true } };
        else if (p.j && p.j.ok) r = await appelEbay(corps);
      }
      let j = r.j || {};
      // Au second essai, la route peut retrouver la paire elle-même (« déjà
      // programmée / déjà en ligne », avec son numéro d'annonce) : c'est la
      // PREUVE qu'elle existe — le premier envoi est passé.
      if (repris && !j.ok && r.code === 409 && /^deja-/.test(String(j.reason || '')) && j.itemId) j = { ok: true, itemId: String(j.itemId), debut: j.debut && Number.isFinite(Date.parse(j.debut)) ? j.debut : null, retrouvee: true };
      if(j.ok && l.item.offre && (repris || !j.offre)){
        const expected={accepte:l.item.offre.accepte,refuse:l.item.offre.refuse ?? null};
        const lu=await appelEbay({action:'regleoffrelire',itemIds:[String(j.itemId)],attendues:{[String(j.itemId)]:expected},...corpsCompteEbay(compteLot)});
        const lecture=lu.j?.lectures?.[String(j.itemId)];
        const conforme=lecture?.lu===true && lecture.offresActives===true && centsR(lecture.accepte)===centsR(expected.accepte) && centsR(lecture.refuse)===centsR(expected.refuse);
        j.offre={lecture:lecture || null,verifie:lecture?.lu===true?conforme:null,range:lu.j?.range===true};
      }
      if (j.ok) {
        const enLigne = !!(l.h.immediat || j.enLigneMaintenant);
        const offre=l.item.offre?messageOffreCreation(j.offre,l.item.offre):null;
        bilan.programmees.push({d:l.d,debut:j.debut,enLigne,offre});
        await modifierBrouillonsEbay((items) => { if (items[l.d.id]) items[l.d.id] = { ...items[l.d.id], etatBrouillon: enLigne ? 'en-ligne' : 'programmee', programme: { itemId: j.itemId, debut: j.debut || null, fin: j.fin || null, demande: l.h.utc || null, sku: l.sku, enLigneMaintenant: !!j.enLigneMaintenant, at: Date.now(), compte: compteLot, pseudo: plusieursPub ? nomCompteLot : '' }, ...(plusieursPub ? { compte: compteLot } : {}), envoi: { ok: true, at: Date.now() } }; return items; });
      } else if (repris || incertain(r)) {
        // ⚠️ Un REFUS au second essai (frais, vérification, liste illisible)
        // ne prouve pas que le premier n'a rien créé : ça reste « incertaine »,
        // et le brouillon n'est JAMAIS marqué « échec » (il serait reprogrammé
        // ou republié — une seconde annonce).
        const pourquoi = j.error && repris && !incertain(r) ? ` (au second essai, eBay a répondu : « ${j.error} »)` : '';
        bilan.incertaines.push({ d: l.d, err: repris && !incertain(r)
          ? `Le premier envoi a peut-être programmé l'annonce${pourquoi} — je ne sais pas si elle est sur eBay. Rafraîchis depuis eBay avant de recommencer.`
          : (j.error || 'eBay n\'a pas répondu — je ne sais pas si elle est programmée. Rafraîchis depuis eBay avant de recommencer.') });
      } else {
        const err = j.error || 'eBay a refusé l\'annonce.';
        bilan.refusees.push({ d: l.d, err });
        await modifierBrouillonsEbay((items) => { if (items[l.d.id]) items[l.d.id] = { ...items[l.d.id], envoi: { ok: false, err, at: Date.now() } }; return items; });
      }
    }
    setEnvoi({ bilan });
    const fin = await lireBrouillonsEbay();
    if (fin && onBrouillons) onBrouillons(fin);
    if (onFini) onFini();
  };

  // ── RENDU ──
  const inp = { boxSizing: 'border-box', border: '1px solid transparent', background: E.card2, color: E.text, borderRadius: 10, padding: '10px 11px', fontSize: 16, fontFamily: 'inherit', outline: 'none' };
  const lab = { fontSize: 11.5, color: E.muted, display: 'block', marginBottom: 5, fontWeight: 500 };
  const pastille = (actif) => ({ border: `1px solid ${actif ? E.accent : E.border}`, background: actif ? `${E.accent}22` : 'transparent', color: actif ? E.text : E.muted, borderRadius: 999, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });
  const groupes = [];
  for (const l of lignes) { const g = groupes[groupes.length - 1]; if (g && g.date === l.h.date) g.lignes.push(l); else groupes.push({ date: l.h.date, lignes: [l] }); }
  const exclues = analyse.filter((x) => !x.item);
  const auj = partsParis(maintenant).date;
  const dateLibre = depart.mode === 'libre' ? depart.date : (departConcret && departConcret.date) || auj;
  const heureLibre = depart.mode === 'libre' ? depart.heure : (departConcret && departConcret.heure) || '20:00';
  const bilan = envoi && envoi.bilan;
  return (
    <div data-planif="1" style={{ background: E.card, border: `1px solid ${E.accent}`, borderRadius: 14, padding: '14px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: E.text }}>Programmer la sélection ({brouillons.length})</span>
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: 'none', background: 'transparent', color: E.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 10 }}>eBay les mettra en ligne lui-même aux heures choisies, même si VRM est fermé. Heure de Paris, jusqu'à 3 semaines à l'avance — ce sont exactement les heures que tu choisis, sans aucun hasard (± 15 min : c'est eBay qui arrondit).</div>

      {bilan ? (
        <div data-planif-bilan="1" data-programmees={bilan.programmees.length} data-refusees={bilan.refusees.length} data-incertaines={bilan.incertaines.length} style={{ fontSize: 13, color: E.text, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{bilan.programmees.length} sur {bilan.programmees.length + bilan.refusees.length + bilan.incertaines.length} programmée{bilan.programmees.length > 1 ? 's' : ''}{bilan.refusees.length ? ` · ${bilan.refusees.length} refusée${bilan.refusees.length > 1 ? 's' : ''}` : ''}{bilan.incertaines.length ? ` · ${bilan.incertaines.length} incertaine${bilan.incertaines.length > 1 ? 's' : ''}` : ''}</div>
          {bilan.programmees.filter((x) => x.enLigne).length > 0 && <div style={{ color: E.warn, marginTop: 4 }}>⚠️ En ligne TOUT DE SUITE : {bilan.programmees.filter((x) => x.enLigne).map((x) => (x.d.numero ? `N°${cleNum(x.d.numero)}` : x.d.titre)).join(', ')}.</div>}
          {bilan.programmees.filter(x=>x.offre).map(x=><div key={x.d.id} data-planif-offre={x.d.id} style={{fontSize:12,color:x.offre.ok?E.muted:E.warn,marginTop:6}}>{x.d.titre} · {x.offre.msg}</div>)}
          {[...bilan.refusees.map((x) => ({ ...x, k: 'refusée' })), ...bilan.incertaines.map((x) => ({ ...x, k: 'incertaine' }))].map((x) => (
            <div key={x.d.id} data-planif-refus={x.d.id} style={{ color: E.warn, marginTop: 4 }}>{x.d.numero ? `N°${cleNum(x.d.numero)}` : x.d.titre} — {x.err}</div>
          ))}
          <button type="button" onClick={onFermer} style={{ marginTop: 10, border: `1px solid ${E.border}`, background: 'transparent', color: E.text, borderRadius: 10, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Terminé</button>
        </div>
      ) : (<>
        {/* (9 octobre) SUR QUEL COMPTE eBAY — seulement s'il y en a plusieurs.
            Changer de compte efface les frais vérifiés (ils sont propres à
            chaque compte). */}
        {plusieursPub && (
          <div data-planif-compte={compteLot} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="vrm-ebay-compte-lot" style={{ ...lab, marginBottom: 0 }}>Programmer sur le compte</label>
            <select id="vrm-ebay-compte-lot" value={compteLot} disabled={!!envoi || verifEnCours} onChange={(e) => { setCompteLotChoisi(e.target.value); setVerifs({}); }}
              style={{ flex: '0 1 240px', maxWidth: '100%', padding: '8px 11px', borderRadius: 8, border: `1px solid ${E.border}`, background: E.card2, color: E.text, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              {comptesPub.map((c) => <option key={c.ref} value={c.ref}>{nomCompteEbay(c)}</option>)}
            </select>
          </div>
        )}
        {/* DÉPART */}
        <div style={{ marginBottom: 10 }}>
          <span style={lab}>Première mise en ligne</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rythme.preregles.map((p) => <button key={p.id} type="button" data-planif-preset={p.id} aria-pressed={depart.mode === 'preset' && depart.id === p.id} onClick={() => { setDepart({ mode: 'preset', id: p.id }); if (!envoi && !verifEnCours) setAncre(ancreDe()); }} style={pastille(depart.mode === 'preset' && depart.id === p.id)}>{libellePreregle(p)}</button>)}
            <button type="button" data-planif-libre="1" aria-pressed={depart.mode === 'libre'} onClick={() => setDepart({ mode: 'libre', date: dateLibre, heure: heureLibre })} style={pastille(depart.mode === 'libre')}>Choisir…</button>
            <button type="button" data-planif-preregles="1" onClick={() => setEditPre((x) => !x)} style={{ ...pastille(false), border: 'none', color: E.accentSoft }}>{editPre ? 'Fermer les préréglages' : 'Modifier les préréglages'}</button>
          </div>
          {depart.mode === 'libre' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input type="date" data-planif-depart-date="1" value={depart.date || ''} min={auj} onChange={(e) => setDepart((x) => ({ ...x, date: e.target.value }))} style={{ ...inp, width: 170 }} />
              <input type="time" data-planif-depart-heure="1" value={depart.heure || ''} onChange={(e) => setDepart((x) => ({ ...x, heure: e.target.value }))} style={{ ...inp, width: 120 }} />
            </div>
          )}
          {editPre && (
            <div data-planif-edit-preregles="1" style={{ marginTop: 8, background: E.card2, borderRadius: 10, padding: '10px 11px' }}>
              {rythme.preregles.map((p, i) => p.jour === 'maintenant' ? null : (
                <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <select value={p.jour} onChange={(e) => changerRythme({ preregles: rythme.preregles.map((q, k) => k === i ? { ...q, jour: e.target.value } : q) })} style={{ ...inp, padding: '8px 9px' }}>
                    <option value="auj">Aujourd'hui</option><option value="demain">Demain</option>
                    {JOURS_NOM.map((n, k) => <option key={k} value={'dow' + k}>{n.replace(/^./, (c) => c.toUpperCase())}</option>)}
                  </select>
                  <input type="time" value={p.heure} onChange={(e) => changerRythme({ preregles: rythme.preregles.map((q, k) => k === i ? { ...q, heure: e.target.value } : q) })} style={{ ...inp, width: 120, padding: '8px 9px' }} />
                  <button type="button" onClick={() => changerRythme({ preregles: rythme.preregles.filter((_, k) => k !== i) })} style={{ ...pastille(false), padding: '6px 10px' }}>Retirer</button>
                </div>
              ))}
              {rythme.preregles.length < 8 && <button type="button" onClick={() => changerRythme({ preregles: [...rythme.preregles, { id: 'p' + Date.now().toString(36), jour: 'demain', heure: '20:00' }] })} style={{ ...pastille(false), border: 'none', color: E.accentSoft, padding: '4px 0' }}>+ Ajouter un préréglage</button>}
              <div style={{ fontSize: 11, color: E.muted, marginTop: 4 }}>Enregistrés pour toi, sur tous tes appareils. « Ce soir 20 h » n'est qu'une habitude, pas une mesure.</div>
            </div>
          )}
        </div>
        {/* RYTHME */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label><span style={lab}>Par jour</span><input type="number" min="1" max="50" inputMode="numeric" data-planif-parjour="1" value={rythme.parJour} onChange={(e) => changerRythme({ parJour: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)) })} style={{ ...inp, width: '100%' }} /></label>
          <label><span style={lab}>De</span><input type="time" data-planif-de="1" value={rythme.de} onChange={(e) => changerRythme({ de: e.target.value })} style={{ ...inp, width: '100%' }} /></label>
          <label><span style={lab}>À</span><input type="time" data-planif-a="1" value={rythme.a} onChange={(e) => changerRythme({ a: e.target.value })} style={{ ...inp, width: '100%' }} /></label>
          <label><span style={lab}>Une toutes les</span><select data-planif-ecart="1" value={rythme.ecart} onChange={(e) => changerRythme({ ecart: Number(e.target.value) })} style={{ ...inp, width: '100%' }}>{EBAY_ECARTS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`}</option>)}</select></label>
          <label><span style={lab}>Ordre</span><select data-planif-ordre="1" value={rythme.ordre} onChange={(e) => changerRythme({ ordre: e.target.value })} style={{ ...inp, width: '100%' }}><option value="selection">ma sélection</option><option value="numero">N° croissant</option><option value="prix">prix croissant</option></select></label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <span style={lab}>Jours</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map((k) => <button key={k} type="button" data-planif-jour={k} aria-pressed={!!rythme.jours[k]} aria-label={JOURS_NOM[k]} onClick={() => changerRythme({ jours: rythme.jours.map((v, i) => i === k ? !v : v) })} style={{ ...pastille(!!rythme.jours[k]), width: 38, padding: '7px 0', textAlign: 'center' }}>{JOURS_LETTRE[k]}</button>)}
          </div>
        </div>

        {/* LIMITES DE VENTE (lues chez eBay) */}
        <div data-planif-limites={limites === undefined ? 'charge' : limites && limites.ok ? 'lu' : 'pas-su'} style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 10 }}>
          {limites === undefined ? 'Je lis tes limites de vente eBay…'
            : limites && limites.ok ? (<>Ta limite eBay : <b style={{ color: E.text }}>{limites.quantite != null ? `${limites.quantite} annonces` : '— annonces'}</b> et <b style={{ color: E.text }}>{limites.montant != null ? eurEbay(limites.montant) : '— €'}</b> par mois.
                {limites.quantite != null && enLigne0 != null && programmees0 != null && lignes.length + enLigne0 + programmees0 > limites.quantite && <span data-planif-limite-depassee="1" style={{ color: E.warn }}> Ce lot ({lignes.length}) et tes {enLigne0 + programmees0} annonce{enLigne0 + programmees0 > 1 ? 's' : ''} en ligne ou programmée{enLigne0 + programmees0 > 1 ? 's' : ''} dépassent {limites.quantite} : eBay pourrait refuser les dernières.</span>}
                {limites.montant != null && montantLot + montantEnVente > limites.montant && <span style={{ color: E.warn }}> Le montant ({eurEbay(montantLot + montantEnVente)} avec ce lot) dépasse ta limite : eBay pourrait refuser les dernières.</span>}</>)
            : <>Limites de vente eBay : pas su{limites && limites.reason === 'scope' ? ' (eBay n\'a pas autorisé VRM à les lire)' : ' (eBay n\'a pas répondu)'} — eBay refusera de lui-même ce qui les dépasse.</>}
        </div>

        {/* APERÇU EXACT */}
        {plan.erreur ? <div data-planif-erreur="1" style={{ fontSize: 12.5, color: E.warn, marginBottom: 10 }}>{plan.erreur}</div> : (
          <div data-planif-apercu={lignes.length} style={{ background: E.card2, borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
            {groupes.map((g) => (
              <div key={g.date} data-planif-jour-groupe={g.date} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: E.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{jourParisTexte(g.date)}</div>
                {g.lignes.map((l) => {
                  const v = verifDe(l);
                  return (
                    <div key={l.d.id} data-planif-ligne={l.d.id} data-heure-paris={`${l.h.date} ${l.h.heure}`} data-utc={l.h.utc} data-immediat={l.h.immediat ? '1' : '0'} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0', flexWrap: 'wrap' }}>
                      <span className="vrm-display" style={{ fontSize: 14, fontWeight: 800, color: E.text, width: 92, flexShrink: 0 }}>{l.h.immediat ? 'tout de suite' : l.h.heure}</span>
                      <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: 12.5, color: E.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.d.numero ? <b>N°{cleNum(l.d.numero)} · </b> : null}{l.d.titre}</span>
                      {v && v.etat === 'ok' && <span data-planif-frais={l.d.id} data-frais-total={v.fees == null ? 'pas-su' : String(v.fees)} data-frais-programmation={l.h.immediat ? 'sans' : (v.frais && v.frais.programmation != null ? String(v.frais.programmation) : 'pas-su')} style={{ flexBasis: '100%', paddingLeft: 102, fontSize: 11.5, color: E.muted, lineHeight: 1.45 }}>
                        {lignesFraisEbay(v.frais, !l.h.immediat).map((f) => `${f.nom} ${f.montant == null ? 'pas su' : eurEbay(f.montant)}`).join(' · ')} · total {v.fees == null ? 'pas su' : eurEbay(v.fees)}
                      </span>}
                      {v && v.etat === 'en-cours' && <span style={{ flexBasis: '100%', paddingLeft: 102, fontSize: 11.5, color: E.muted }}>eBay vérifie…</span>}
                      {v && (v.etat === 'refus' || v.etat === 'erreur') && <span data-planif-verif-refus={l.d.id} style={{ flexBasis: '100%', paddingLeft: 102, fontSize: 11.5, color: E.warn, lineHeight: 1.45 }}>⚠️ {v.err}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            {!lignes.length && <div style={{ fontSize: 12.5, color: E.muted }}>Rien à programmer dans cette sélection.</div>}
            {plan.horsHorizon > 0 && <div data-planif-hors-horizon={plan.horsHorizon} style={{ fontSize: 12, color: E.warn, lineHeight: 1.45, marginTop: 4 }}>{plan.horsHorizon} brouillon{plan.horsHorizon > 1 ? 's' : ''} tomberai{plan.horsHorizon > 1 ? 'ent' : 't'} au-delà de 3 semaines (la limite d'eBay) : {plan.horsHorizon > 1 ? 'ils restent' : 'il reste'} en brouillon{plan.horsHorizon > 1 ? 's' : ''}.</div>}
          </div>
        )}
        {exclues.length > 0 && (
          <div data-planif-exclues={exclues.length} style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 10 }}>
            <b style={{ color: E.text }}>{exclues.length} ne {exclues.length > 1 ? 'partiront' : 'partira'} pas :</b> {exclues.map((x) => `${x.d.numero ? 'N°' + cleNum(x.d.numero) : (x.d.titre || 'sans titre')} (${x.raison})`).join(' · ')}.
          </div>
        )}
        {ventes && Array.isArray(ventes.pasSu) && ventes.pasSu.length > 0 && <div data-planif-pas-su={ventes.pasSu.length} style={{ fontSize: 12.5, color: E.warn, lineHeight: 1.5, marginBottom: 10 }}>Je n'ai pas pu vérifier {ventes.pasSu.length === 1 ? ventes.pasSu[0] : ventes.pasSu.slice(0, -1).join(', ') + ' ni ' + ventes.pasSu[ventes.pasSu.length - 1]} : je ne programme rien tant que je ne sais pas qu'aucune de ces paires n'est déjà vendue. Rouvre l'écran dans un moment.</div>}
        {(!ventes || ventes.enCours) && lignes.length > 0 && <div data-planif-ventes-en-cours="1" style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginBottom: 10 }}>Je vérifie que ces paires ne sont pas déjà vendues (Vinted, eBay, Leboncoin)…</div>}

        {/* LES FRAIS, LUS CHEZ eBAY */}
        {lignes.length > 0 && !plan.erreur && (
          <button type="button" data-planif-verifier="1" disabled={verifEnCours} onClick={verifier} style={{ width: '100%', border: `1px solid ${E.border}`, background: E.card2, color: E.text, borderRadius: 999, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: verifEnCours ? 'default' : 'pointer', fontFamily: 'inherit', opacity: verifEnCours ? 0.6 : 1, marginBottom: 10 }}>{verifEnCours ? 'eBay vérifie…' : (nonVerifiees ? `Vérifier les frais chez eBay (${lignes.length})` : 'Revérifier les frais')}</button>
        )}
        {pretes.length > 0 && (
          <div data-planif-total={totalConnu ? String(Math.round(total * 100) / 100) : 'partiel'} data-planif-prog-total={String(Math.round(totalProg * 100) / 100)} data-planif-prog-pas-su={progPasSu} style={{ fontSize: 12.5, color: E.text, lineHeight: 1.55, marginBottom: 10 }}>
            Frais annoncés par eBay : <b>{eurEbay(total)}</b>{totalConnu ? ` pour ${pretes.length} annonce${pretes.length > 1 ? 's' : ''}` : ` pour ${pretes.length} annonce${pretes.length > 1 ? 's' : ''} vérifiée${pretes.length > 1 ? 's' : ''} sur ${lignes.length}`}{progConnues.length ? <> · dont programmation <b>{eurEbay(totalProg)}</b></> : null}{progPasSu ? <> · frais de programmation : <b>pas su</b> pour {progPasSu}</> : null} (avant remise éventuelle).
            {progPayante && <div data-planif-non-rembourse="1" style={{ color: E.warn }}>La programmation est facturée à la création, et non remboursée si tu annules.</div>}
          </div>
        )}
        {perime && <div style={{ fontSize: 12.5, color: E.warn, marginBottom: 10 }}>Le planning a vieilli : une heure est à moins de 15 minutes. Change le départ, puis revérifie.</div>}
        {/* LE RISQUE, DIT AVANT SA PREMIÈRE PROGRAMMATION */}
        {besoinCompris && pretes.length > 0 && (
          <label data-planif-risque="1" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: E.text, lineHeight: 1.5, background: `${E.warn}14`, border: `1px solid ${E.warn}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" data-planif-compris="1" checked={compris} onChange={(e) => setCompris(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, accentColor: E.accent }} />
            <span>Avant ta première programmation : <b>l'annulation d'une annonce programmée par VRM n'est pas garantie</b> — il faudra peut-être l'annuler sur eBay. Et une paire <b>vendue ailleurs avant son heure</b> peut quand même partir sur eBay (VRM te le dira, mais ne peut pas promettre de l'arrêter). J'ai compris.</span>
          </label>
        )}
        {envoi && !envoi.bilan && <div style={{ fontSize: 12.5, color: E.muted, marginBottom: 8 }}>Envoi à eBay : {envoi.en} sur {envoi.total}…</div>}
        <button type="button" data-planif-confirmer={pretes.length} disabled={!peutConfirmer} onClick={confirmer}
          style={{ width: '100%', border: 'none', background: E.accent, color: '#fff', borderRadius: 999, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: peutConfirmer ? 'pointer' : 'default', fontFamily: 'inherit', opacity: peutConfirmer ? 1 : 0.45 }}>
          {pretes.length ? `Programmer ${pretes.length} annonce${pretes.length > 1 ? 's' : ''}${totalConnu ? ` — ${eurEbay(total)}` : ''}` : 'Vérifie d\'abord les frais'}
        </button>
      </>)}
    </div>
  );
}
function EbayProgrammees({ programmees, brouillons, onRelire, onAnnule, vue = '*', comptesEbay }) {
  const E = EBAY_SKIN;
  const [deplacer, setDeplacer] = React.useState(null);   // {itemId, date, heure}
  const [infos, setInfos] = React.useState({});           // itemId → {texte, refus, lien}
  const [geste, setGeste] = React.useState('');
  const maintenant = Date.now();
  const relu = React.useRef(false);
  const P = programmees && typeof programmees === 'object' ? programmees : null;
  const etat = programmees === undefined ? 'charge' : programmees === null ? 'pas-su' : programmees === 'jamais' ? 'jamais' : 'lu';
  // La liste d'eBay, puis ce que VRM vient de programmer et qu'eBay n'a pas
  // encore relu — tant qu'il est encore attendu (`brouillonEncoreAttendu`).
  // (9 octobre) La vue d'UN compte ne montre que ses programmées.
  const lignes = React.useMemo(() => programmeesConnues(P, brouillons, true)
    .filter((l) => dansVueEbay(l, vue))
    .sort((a, b) => (Date.parse(a.debut) || 0) - (Date.parse(b.debut) || 0)), [programmees, brouillons, vue]);
  const melangeProg = Array.isArray(comptesEbay) && comptesEbay.length >= 2 && new Set(lignes.map((l) => l._compte)).size > 1;
  const enLigneIds = new Set(((P && P.enLigne) || []).map((x) => String(x && x.itemId)));
  const capture = P && P.capturedAt ? Number(P.capturedAt) : null;
  const statut = (l) => {
    if (enLigneIds.has(String(l.itemId))) return 'en-ligne';
    const t = Date.parse(l.debut || '');
    if (!Number.isFinite(t) || maintenant < t) return 'programmee';
    if (l.lu && capture && capture > t + 30 * 60000 && maintenant > t + 30 * 60000) return 'pas-partie';
    return 'a-relire';
  };
  // Une heure passée depuis la dernière lecture : on relit chez eBay (une fois).
  const aRelire = lignes.some((l) => statut(l) === 'a-relire');
  React.useEffect(() => { if (aRelire && !relu.current && onRelire) { relu.current = true; onRelire(); } }, [aRelire]);
  const annuler = async (l) => {
    const t = Date.parse(l.debut || '');
    const ok = await askConfirm({
      title: `Annuler la mise en ligne prévue ${Number.isFinite(t) ? 'le ' + quandParisTexte(t) : ''} ?`,
      desc: `« ${l.title || l.itemId} »${numDeSkuEbay(l.sku) ? ` · N°${numDeSkuEbay(l.sku)}` : ''}\n\nL'annulation par VRM n'est pas garantie : VRM la demande à eBay et te dit SA réponse. Si eBay refuse, annule-la dans le Seller Hub d'eBay. L'option de programmation déjà facturée ne sera probablement pas remboursée.`,
      ok: 'Oui, demander l\'annulation', cancel: 'Non', danger: true,
    });
    if (!ok) return;
    setGeste('annuler:' + l.itemId);
    const { code, j } = await appelEbay({ action: 'deprogrammer', itemId: String(l.itemId), confirme: true, ...corpsCompteEbay(l._compte) });
    let info;
    if (j && j.ok) info = { texte: j.verifie === true ? '✓ eBay a annulé la programmation (vérifié chez eBay).' : '✓ eBay a répondu « annulée » — je n\'ai pas pu le revérifier : rafraîchis dans un moment.', ok: true };
    else if (code === 0 || !j || code === 504 || (j && j.reason === 'incertain')) info = { texte: (j && j.error) || 'eBay n\'a pas répondu — je ne sais pas si elle est annulée. Regarde sur eBay avant de recommencer.', refus: true, lien: true };
    else info = { texte: `eBay a répondu : « ${(j && j.error) || 'refus'} ».${j && j.enLigne ? '' : ' Annule-la dans le Seller Hub d\'eBay.'}`, refus: true, lien: !(j && j.enLigne) };
    setInfos((m) => ({ ...m, [l.itemId]: info }));
    setGeste('');
    if (info.ok && onAnnule) onAnnule(String(l.itemId));
  };
  const validerDeplacer = async (l) => {
    const r = parisVersUtc(deplacer.date, deplacer.heure);
    if (r.ambigu || r.inexistant || r.invalide) { setInfos((m) => ({ ...m, [l.itemId]: { texte: r.ambigu ? 'Cette heure existe deux fois cette nuit-là (changement d\'heure) — choisis-en une autre.' : r.inexistant ? 'Cette heure n\'existe pas cette nuit-là (changement d\'heure).' : 'Choisis une date et une heure.', refus: true } })); return; }
    if (r.ms < Date.now() + PLANIF_MIN_MS || r.ms > Date.now() + PLANIF_HORIZON_MS) { setInfos((m) => ({ ...m, [l.itemId]: { texte: 'Entre 20 minutes et 3 semaines à l\'avance.', refus: true } })); return; }
    const ok = await askConfirm({ title: `La mettre en ligne le ${quandParisTexte(r.ms)} ?`, desc: `« ${l.title || l.itemId} » — heure de Paris, ± 15 min (c'est eBay qui arrondit).`, ok: 'Oui, déplacer', cancel: 'Annuler' });
    if (!ok) return;
    setGeste('deplacer:' + l.itemId);
    const { code, j } = await appelEbay({ action: 'reprogrammer', itemId: String(l.itemId), scheduleTime: new Date(r.ms).toISOString(), confirme: true, ...corpsCompteEbay(l._compte) });
    const incertaine = !(j && j.ok) && (code === 0 || !j || code === 504 || (j && j.reason === 'incertain'));
    setInfos((m) => ({ ...m, [l.itemId]: j && j.ok ? { texte: `✓ eBay la mettra en ligne le ${quandParisTexte(Date.parse(j.debut || j.demande))}.`, ok: true }
      : incertaine ? { texte: (j && j.error) || 'eBay n\'a pas répondu — je ne sais pas si l\'heure a changé. « Relire chez eBay » avant de recommencer.', refus: true }
      : { texte: `eBay a répondu : « ${(j && j.error) || 'refus'} ».`, refus: true } }));
    setGeste(''); setDeplacer(null);
    if (j && j.ok && onRelire) onRelire();
  };
  if (etat === 'lu' && !lignes.length) return null;
  const groupes = [];
  for (const l of lignes) { const t = Date.parse(l.debut || ''); const date = Number.isFinite(t) ? partsParis(t).date : 'inconnue'; const g = groupes[groupes.length - 1]; if (g && g.date === date) g.lignes.push(l); else groupes.push({ date, lignes: [l] }); }
  const btn = { border: `1px solid ${E.border}`, background: 'transparent', color: E.text, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  const inp = { boxSizing: 'border-box', border: '1px solid transparent', background: E.card2, color: E.text, borderRadius: 10, padding: '8px 10px', fontSize: 16, fontFamily: 'inherit', outline: 'none' };
  return (
    <div data-ebay-programmees={etat} data-nb={lignes.length} style={{ background: E.card, border: `1px solid ${E.border}`, borderRadius: 14, padding: '12px 14px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 auto', fontSize: 16, fontWeight: 800, color: E.text }}>Programmées sur eBay{lignes.length ? ` (${lignes.length})` : ''}</span>
        {onRelire && <button type="button" data-prog-relire="1" onClick={onRelire} style={{ ...btn, border: 'none', padding: '4px 0', color: E.accentSoft }}>Relire chez eBay</button>}
      </div>
      {etat === 'charge' && <div style={{ fontSize: 12.5, color: E.muted }}>Chargement…</div>}
      {etat === 'jamais' && <div style={{ fontSize: 12.5, color: E.muted }}>Je lis tes annonces programmées chez eBay…</div>}
      {etat === 'pas-su' && <div style={{ fontSize: 12.5, color: E.warn, lineHeight: 1.5 }}>Je n'ai pas pu lire tes annonces programmées — rien n'est perdu. « Relire chez eBay » dans un moment.</div>}
      {groupes.map((g) => (
        <div key={g.date} data-prog-jour={g.date} style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: E.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{g.date === 'inconnue' ? 'heure inconnue' : jourParisTexte(g.date)}</div>
          {g.lignes.map((l) => {
            const s = statut(l);
            const t = Date.parse(l.debut || '');
            const derniereHeure = Number.isFinite(t) && t - maintenant < 60 * 60000;
            const n = numEbayLu(l.sku, l.itemId, null, l.depuis);
            const info = infos[l.itemId];
            return (
              <div key={(l._compte || '') + l.itemId} data-prog={l.itemId} data-prog-statut={s} data-ebay-compte={l._compte || ''} style={{ padding: '8px 0', borderTop: `1px solid ${E.border}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <PhotoVente src={l.photo} size={44} />
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: n ? E.text : E.warn, fontWeight: 700 }}>{n ? `N°${n}` : 'pas reliée'}</span> · {l.title || l.itemId}</div>
                    <div style={{ fontSize: 11.5, color: s === 'pas-partie' ? E.warn : E.muted, marginTop: 2 }}>
                      {s === 'en-ligne' ? 'En ligne ✓' : s === 'pas-partie' ? `Pas partie à l'heure — prévue à ${Number.isFinite(t) ? partsParis(t).heure : '?'}. Relis chez eBay ; si elle n'apparaît toujours pas, regarde dans le Seller Hub.` : s === 'a-relire' ? `devrait être en ligne depuis ${Number.isFinite(t) ? partsParis(t).heure : '?'} — je relis chez eBay` : `Programmée · ${Number.isFinite(t) ? partsParis(t).heure : 'heure inconnue'}`}
                      {l.price ? ` · ${eurEbay(Number(String(l.price).replace(',', '.')) || 0)}` : ''}
                      {/* (9 octobre) La règle d'offre ENVOYÉE avec la programmation
                          (eBay ne la relit pas avant le départ) — dite comme telle. */}
                      {(() => { const a = offreEnvoyeeProgrammee(brouillons, l.itemId); return a != null ? <span data-programmee-offre={a.toFixed(2)}>{` · offres dès ${eurEbay(a)}`}</span> : null; })()}
                      {melangeProg ? ` · ${nomCompteEbay((comptesEbay || []).find((c) => c.ref === l._compte) || { pseudo: l._pseudo })}` : ''}
                    </div>
                  </div>
                </div>
                {s === 'programmee' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7, paddingLeft: 54 }}>
                    <button type="button" data-prog-deplacer={l.itemId} disabled={derniereHeure || !!geste} title={derniereHeure ? 'Elle part dans moins d\'une heure : eBay ne permet plus de la déplacer.' : ''}
                      onClick={() => { const p = Number.isFinite(t) ? partsParis(t) : partsParis(Date.now() + 86400000); setDeplacer({ itemId: l.itemId, date: p.date, heure: p.heure }); }}
                      style={{ ...btn, opacity: (derniereHeure || geste) ? 0.45 : 1, cursor: derniereHeure ? 'default' : 'pointer' }}>Déplacer</button>
                    <button type="button" data-prog-annuler={l.itemId} disabled={!!geste} onClick={() => annuler(l)} style={{ ...btn, opacity: geste ? 0.5 : 1 }}>{geste === 'annuler:' + l.itemId ? 'Demande à eBay…' : 'Annuler'}</button>
                    {derniereHeure && <span data-prog-derniere-heure={l.itemId} style={{ fontSize: 11, color: E.muted, alignSelf: 'center' }}>part dans moins d'une heure : plus déplaçable</span>}
                  </div>
                )}
                {deplacer && deplacer.itemId === l.itemId && (
                  <div data-prog-deplacer-panneau={l.itemId} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 7, paddingLeft: 54 }}>
                    <input type="date" value={deplacer.date} onChange={(e) => setDeplacer((x) => ({ ...x, date: e.target.value }))} style={{ ...inp, width: 160 }} />
                    <input type="time" value={deplacer.heure} onChange={(e) => setDeplacer((x) => ({ ...x, heure: e.target.value }))} style={{ ...inp, width: 110 }} />
                    <button type="button" data-prog-deplacer-valider={l.itemId} disabled={!!geste} onClick={() => validerDeplacer(l)} style={{ ...btn, border: 'none', background: E.accent, color: '#fff' }}>{geste ? 'Envoi…' : 'Valider'}</button>
                    <button type="button" onClick={() => setDeplacer(null)} style={{ ...btn, color: E.muted }}>Fermer</button>
                  </div>
                )}
                {info && <div data-prog-info={l.itemId} data-prog-refus={info.refus ? '1' : '0'} style={{ fontSize: 11.5, color: info.ok ? E.text : E.warn, marginTop: 5, paddingLeft: 54, lineHeight: 1.45 }}>{info.texte}{info.lien && <> <a href={SELLER_HUB_PROGRAMMEES} target="_blank" rel="noreferrer" data-prog-seller-hub="1" style={{ color: E.accentSoft, fontWeight: 700 }}>Ouvrir le Seller Hub ↗</a></>}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
// `prixDe(it)` : le prix que la CARTE affiche (relu chez eBay après une 409 ou un
// changement de prix) — la même source que `etatDe` (§11) : l'aperçu calculait
// son seuil sur l'ancien prix de la ligne lue, et proposait 85,50 € sur une
// annonce que la carte disait à 80 €.
function EbayReglesToutes({ items = [], etatDe, prixDe, regleBloquee, achats, nomRef, plusieursComptes = false, relit = false, onRelire, onRelireBase, onLot, onRegle, onDebut, onFini, onInterrompu }) {
  const E = EBAY_SKIN;
  const [pct, setPct] = React.useState('');
  const [choix, setChoix] = React.useState(() => new Map());   // clé → coché, ce qu'il a changé à la main
  const [lot, setLot] = React.useState(null);                   // l'aperçu FIGÉ au moment du « oui »
  const [issues, setIssues] = React.useState({});               // clé → issue (`resultatRegleOffre`)
  const [progres, setProgres] = React.useState(0);
  const [bilan, setBilan] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);
  const vivant = React.useRef(true);
  const arret = React.useRef(false);
  const envoyes = React.useRef(0);
  const lotRef = React.useRef(null);
  // Démonté pendant un lot (changer de sous-onglet démonte l'écran, une sonde
  // de connexion qui hoquette ferme le panneau) : plus aucun envoi après, et ce
  // qui n'est pas parti est NOTÉ sur l'appareil — une liste qui s'arrête sans un
  // mot se lirait « tout est fait ». Et (11 octobre) l'écran PARENT, s'il est
  // encore là, le DIT tout de suite (`onInterrompu`) : la note n'était lue qu'à
  // son prochain montage, donc jamais quand seul le panneau se fermait.
  const rappels = React.useRef({});
  rappels.current = { onInterrompu };
  React.useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
      const l = lotRef.current;
      if (l && l.enCours) {
        const n = l.items.length - envoyes.current;
        if (n > 0) { try { sessionStorage.setItem('vrm_regles_lot_interrompu', JSON.stringify({ n, at: Date.now() })); } catch (_) {} }
        if (n > 0 && rappels.current.onInterrompu) rappels.current.onInterrompu({ n, at: Date.now() });
      }
    };
  }, []);
  const pctN = /^\s*\d{1,2}\s*$/.test(pct) ? parseInt(pct, 10) : NaN;
  const pctOk = Number.isInteger(pctN) && pctN >= 50 && pctN <= 99;
  const cents = (v) => Math.round(Number(v) * 100);
  const lignes = !pctOk ? [] : items.map((it) => {
    const cle = ((it && it._compte) || 'principal') + ':' + String(it.itemId);
    const e = etatDe(it);
    const b = regleBloquee(it);
    const p0 = prixDe ? prixDe(it) : it.price;
    const prix = Number(String(p0 == null ? '' : p0).replace(',', '.'));
    const seuil = seuilDePourcent(prix, pctN);
    const numero = numDeSkuEbay(it.sku);
    const achat = numero ? (achats && achats.has(numero) ? achats.get(numero) : undefined) : undefined;
    const base = { cle, it, etat: e, prix: Number.isFinite(prix) ? Math.round(prix * 100) / 100 : null, seuil, numero, achat, cochable: false, defaut: false, plusBas: false };
    if (b) return { ...base, statut: 'exclue', note: b.k === 'vendue' ? 'vendue — retire-la d\'eBay' : (b.k === 'deux-comptes' ? 'en vente sur deux de tes comptes' : 'vente pas vérifiée') };
    if (e && e.etat === 'pas-su' && e.raison === 'devise') return { ...base, statut: 'exclue', note: 'autre devise que l\'euro' };
    // (11 octobre, revue) Seuil RELU, offres activées ou non pas montré : une
    // relecture rendrait la même chose (`seRelitChezEbay`) — le geste est de
    // regarder l'annonce sur eBay, pas de « la relire d'abord ».
    if (e && e.etat === 'pas-su' && e.raison === 'offres-inconnues') return { ...base, statut: 'a-voir-ebay', note: 'seuil lu ; offres activées ou non : eBay ne le montre pas — regarde-la sur eBay' };
    // ⚠️ (11 octobre, revue — tour 3) Seules les raisons qu'une relecture CHEZ
    // eBAY lève sont « à relire » (`seRelitChezEbay`, la règle de la ligne du
    // haut, §11). Notre propre lecture ratée proposait « Relire ces 9 annonces
    // chez eBay » — un bouton qui n'envoyait rien.
    if (e && e.etat === 'pas-su' && e.raison === 'illisible') return { ...base, statut: 'illisible', note: 'règle actuelle pas lisible dans VRM — rien n\'est remplacé à l\'aveugle' };
    if (e && e.etat === 'pas-su' && e.raison === 'pas-sur-ce-compte') return { ...base, statut: 'exclue', note: 'eBay ne la montre plus en vente sur ce compte' };
    if (!e || e.etat === 'pas-su') return { ...base, statut: 'a-relire', note: 'règle actuelle pas lue — relis-la d\'abord' };
    if (seuil == null) return { ...base, statut: 'exclue', note: 'prix trop bas' };
    if (e.refuse != null && cents(e.refuse) >= cents(seuil)) return { ...base, statut: 'exclue', note: `eBay refuse déjà sous ${eurEbay(e.refuse)} : baisse d'abord ce refus` };
    if (e.etat === 'connue' && cents(e.accepte) === cents(seuil)) return { ...base, statut: 'inchange', note: `déjà ${eurEbay(e.accepte)}` };
    if (e.etat === 'connue') {
      const plusBas = cents(seuil) < cents(e.accepte);
      return { ...base, statut: 'remplace', cochable: true, defaut: !plusBas, plusBas, note: `remplace ${eurEbay(e.accepte)}${plusBas ? ' — plus bas' : ''}` };
    }
    return { ...base, statut: 'nouvelle', cochable: true, defaut: !!numero, note: numero ? '' : 'sans paire reliée' };
  });
  const coche = (l) => l.cochable && (choix.has(l.cle) ? choix.get(l.cle) : l.defaut);
  const selection = lignes.filter(coche);
  const n = selection.length;
  const trop = n > REGLES_LOT_MAX;
  const aRelire = lignes.filter((l) => l.statut === 'a-relire' && seRelitChezEbay(l.etat || { etat: 'pas-su', raison: 'jamais' })).map((l) => l.it);
  const nIllisibles = lignes.filter((l) => l.statut === 'illisible').length;
  const pctReel = (l) => { const v = Math.round(l.seuil / l.prix * 1000) / 10; return String(v).replace('.', ','); };
  const sousAchat = (l) => typeof l.achat === 'number' && l.seuil != null && l.seuil < l.achat;
  const appliquer = async () => {
    if (enCours || !n || trop) return;
    const k = selection.filter((l) => l.statut === 'remplace').length;
    const jBas = selection.filter((l) => l.statut === 'remplace' && l.plusBas).length;
    const o = selection.filter((l) => !(l.etat && l.etat.offresActives === true)).length;
    const sA = selection.filter(sousAchat).length;
    const pA = selection.filter((l) => l.numero && l.achat === null).length;
    const r = selection.filter((l) => !l.numero).length;
    // (11 octobre, revue — tour 3) La conséquence que la feuille de la CARTE
    // dit déjà, sur la même annonce : une offre faite et en attente peut être
    // acceptée au moment même du lot (§11 : une phrase, deux feuilles).
    const f = selection.filter((l) => l.etat && Number(l.etat.offresFaites) > 0).length;
    const parCompte = new Map();
    for (const l of selection) { const ref = l.it._compte || 'principal'; parCompte.set(ref, (parCompte.get(ref) || 0) + 1); }
    const desc = [
      `Sur chacune, toute offre égale ou supérieure au montant affiché ${OFFRE_VEND_LA_PAIRE}.`,
      k > 0 && `${k} remplace${k > 1 ? 'nt' : ''} une règle existante${jBas ? ` (dont ${jBas} plus basse${jBas > 1 ? 's' : ''})` : ''}.`,
      o > 0 && `${o} où les offres seront activées si elles ne le sont pas déjà.`,
      sA > 0 && `${sA} sous ton prix d'achat (avant frais eBay).`,
      pA > 0 && `${pA} sans prix d'achat saisi.`,
      r > 0 && `${r} sans paire reliée : si eBay en vend une, VRM ne saura pas laquelle retirer de Vinted.`,
      texteOffresDejaFaites(f, n),
      parCompte.size > 1 && `Sur tes comptes ${[...parCompte.entries()].map(([ref, c]) => `${nomRef(ref)} (${c})`).join(', ')}.`,
      'VRM les règle une par une et te dit le résultat de chacune.',
    ].filter(Boolean);
    const ok = await askConfirm({ title: `Laisser eBay accepter les offres sur ${n} annonce${n > 1 ? 's' : ''} ?`, desc: desc.join('\n\n'), ok: n > 1 ? `Oui, régler les ${n}` : 'Oui, la régler', cancel: 'Annuler' });
    if (!ok || !vivant.current) return;
    // L'APERÇU EST FIGÉ : la suite ne lit que lui (l'écran peut changer pendant).
    const fige = selection.map((l) => ({ cle: l.cle, itemId: String(l.it.itemId), compte: l.it._compte || 'principal', seuil: l.seuil, prixVu: l.prix, attendu: attenduDe(l.etat), titre: l.it.title || String(l.it.itemId), prix: l.prix }));
    lotRef.current = { items: fige, enCours: true };
    envoyes.current = 0; arret.current = false;
    setLot(fige); setIssues({}); setBilan(null); setEnCours(true); setProgres(0);
    if (onDebut) onDebut();
    if (onLot) onLot(fige.map((x) => x.itemId));
    const res = {};
    for (let i = 0; i < fige.length; i++) {
      if (!vivant.current || arret.current) break;
      const x = fige[i];
      envoyes.current = i + 1;
      setProgres(i + 1);
      const rep = await appelEbay({ action: 'regleoffre', itemId: x.itemId, accepte: x.seuil, prixVu: x.prixVu, attendu: x.attendu, confirme: true, ...corpsCompteEbay(x.compte) });
      // L'issue porte le montant ENVOYÉ : elle ne se montre que sous une ligne
      // qui propose ce montant-là (un autre pourcentage ⇒ un autre montant).
      const r0 = { ...resultatRegleOffre(rep), seuilEnvoye: x.seuil };
      res[x.cle] = r0;
      // ⚠️ (11 octobre) La réponse d'eBay s'applique à la CARTE même si le
      // panneau a été fermé pendant l'envoi : l'écran parent est souvent encore
      // là, et sauter cette ligne lui laissait dire « aucune règle » sur une
      // annonce qu'eBay vendait dès le seuil.
      const loc = localApresRegle(r0);
      if (onRegle && (loc.entree !== undefined || loc.prix !== undefined)) onRegle(x.cle, loc.entree, loc.prix);
      if (!vivant.current) break;
      setIssues((m) => ({ ...m, [x.cle]: r0 }));
    }
    lotRef.current = { items: fige, enCours: false };
    if (!vivant.current) {
      // Le panneau n'est plus là : on rend les cartes (elles restaient grisées
      // pour toujours) et on relit ce que la base a rangé.
      if (onLot) onLot([]);
      if (onFini) await onFini();
      return;
    }
    const compte = { ok: 0, ecart: 0, 'offres-inconnues': 0, 'non-relu': 0, 'a-revoir': 0, incertain: 0, ko: 0 };
    const refus = new Map();
    let nonNote = 0;
    for (const x of fige) {
      const r1 = res[x.cle];
      if (!r1) continue;
      compte[r1.issue] = (compte[r1.issue] || 0) + 1;
      if (r1.nonNote) nonNote++;
      if (r1.issue === 'ko') refus.set(r1.msg, (refus.get(r1.msg) || 0) + 1);
    }
    setBilan({ total: fige.length, ...compte, nonEnvoyees: fige.filter((x) => !res[x.cle]).length, nonNote, refus: [...refus.entries()] });
    setEnCours(false);
    setChoix(new Map());
    if (onLot) onLot([]);
    if (onFini) await onFini();
  };
  const TEXTE_ISSUE = { ok: '✓ réglée', ecart: 'pas confirmée par eBay', 'offres-inconnues': 'seuil posé ; offres activées ou non : eBay ne le montre pas — regarde-la sur eBay', 'non-relu': 'posée par eBay, pas relue', 'a-revoir': 'à revoir : la règle ou le prix a changé sur eBay', incertain: 'sans réponse claire d\'eBay', ko: 'refusée' };
  // ⚠️ (11 octobre, revue — tour 3) eBay l'a fait, VRM n'a pas pu le NOTER
  // (`nonNote`, la même issue que la carte, §11) : jamais « ✓ réglée » en
  // couleur de texte — la carte, sur la même réponse, le dit en ambre.
  const NON_NOTE = 'VRM n\'a pas pu le noter : « Relire chez eBay »';
  const texteIssue0 = (r) => {
    if (r.issue === 'ko') return `refusée : « ${r.msg} »`;
    if (r.issue === 'ecart' && r.lecture) return `pas confirmée par eBay (l'annonce montre : ${etatEnClair(r.lecture)})`;
    // (11 octobre, revue) « À revoir » dit CE qui a changé : le prix relu chez
    // eBay (le montant au-dessus est déjà recalculé dessus), ou la règle lue.
    if (r.issue === 'a-revoir' && r.reason === 'prix-change' && r.prix != null && Number.isFinite(Number(r.prix))) return `à revoir : le prix sur eBay est maintenant de ${eurEbay(Number(r.prix))} — rien n'a été envoyé, le montant est recalculé sur ce prix`;
    if (r.issue === 'a-revoir' && r.lecture) return `à revoir : eBay a déjà une règle (${etatEnClair(r.lecture)}) — rien n'a été envoyé`;
    return TEXTE_ISSUE[r.issue];
  };
  const texteIssue = (r) => {
    if (!r) return '';
    if (r.nonNote && r.issue === 'ok') return `posée par eBay — ${NON_NOTE}`;
    const t = texteIssue0(r);
    return r.nonNote ? `${t} — ${NON_NOTE}` : t;
  };
  const couleurIssue = (r) => (r.issue === 'ok' && !r.nonNote ? E.text : E.warn);
  const bilanTexte = (b) => {
    const pl = (k, s, p) => (k > 1 ? p : s);
    const morceaux = [`${b.ok} sur ${b.total} réglée${pl(b.ok, '', 's')}`];
    if (b.ecart) morceaux.push(`${b.ecart} pas confirmée${pl(b.ecart, '', 's')} par eBay`);
    if (b['offres-inconnues']) morceaux.push(`${b['offres-inconnues']} où eBay montre le seuil mais pas si les offres sont activées : regarde-${pl(b['offres-inconnues'], 'la', 'les')} sur eBay`);
    if (b['non-relu']) morceaux.push(`${b['non-relu']} posée${pl(b['non-relu'], '', 's')} par eBay mais pas relue${pl(b['non-relu'], '', 's')} : « Relire chez eBay »`);
    if (b['a-revoir']) morceaux.push(`${b['a-revoir']} à revoir : la règle ou le prix a changé sur eBay`);
    if (b.incertain) morceaux.push(`${b.incertain} sans réponse claire d'eBay : relis-${pl(b.incertain, 'la', 'les')}`);
    if (b.ko) morceaux.push(`${b.ko} refusée${pl(b.ko, '', 's')} : ${b.refus.map(([m, c]) => `« ${m} »${c > 1 ? ` (×${c})` : ''}`).join(' · ')}`);
    if (b.nonEnvoyees) morceaux.push(`${b.nonEnvoyees} non envoyée${pl(b.nonEnvoyees, '', 's')}`);
    if (b.nonNote) morceaux.push(`dont ${b.nonNote} que VRM n'a pas pu noter : « Relire chez eBay »`);
    return morceaux.join(' · ') + '.';
  };
  const lienE = { flexShrink: 0, border: `1px solid ${E.border}`, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, color: E.text, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' };
  const inp = { width: 72, boxSizing: 'border-box', border: `1px solid ${E.border}`, background: E.bg || E.card, color: E.text, borderRadius: 8, padding: '8px 10px', fontSize: 16, fontFamily: 'inherit' };
  const ligneRendu = (l, r0) => {
    // (11 octobre) Une issue n'est montrée que sous une ligne qui propose le
    // montant qui a été ENVOYÉ : changer le pourcentage après un lot laissait
    // « ✓ réglée » sous « dès 72,00 € », comme si 72 € était posé.
    // ⚠️⚠️ (11 octobre, revue) SAUF « à revoir » : RIEN n'a été posé, et le
    // montant de la ligne a changé justement PARCE QUE le prix relu chez eBay
    // l'a recalculé (`prixDe`). Le bilan disait « 1 à revoir » et plus aucune
    // ligne ne disait laquelle. Chaque ligne affiche son issue.
    const r = r0 && (r0.issue === 'a-revoir' || (l.seuil != null && cents(r0.seuilEnvoye) === cents(l.seuil))) ? r0 : null;
    const statutAttr = { 'data-regles-ligne': String(l.it.itemId), 'data-regles-statut': l.statut, 'data-regles-seuil': l.seuil != null && (l.cochable || l.statut === 'inchange') ? l.seuil.toFixed(2) : '' };
    return (
      <div key={l.cle} {...statutAttr} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
        <span style={{ width: 22, flexShrink: 0 }}>
          {l.cochable && <input type="checkbox" data-regles-choix={String(l.it.itemId)} checked={coche(l)} disabled={enCours}
            onChange={(ev) => { const v = ev.target.checked; setChoix((m) => { const nm = new Map(m); nm.set(l.cle, v); return nm; }); }} />}
        </span>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.it.title || l.it.itemId}</div>
          <div style={{ fontSize: 11.5, color: E.muted, lineHeight: 1.45 }}>
            {l.prix != null ? eurEbay(l.prix) : '—'}{l.seuil != null && l.statut !== 'exclue' && l.statut !== 'a-relire' && l.statut !== 'a-voir-ebay' && l.statut !== 'illisible' ? <> → dès <b style={{ color: E.text }}>{eurEbay(l.seuil)}</b> ({pctReel(l)} %)</> : null}
            {/* Une cause, une phrase (§7) : l'issue « offres-inconnues » dit déjà ce que la note dirait. */}
            {l.note && !(r && r.issue === 'offres-inconnues' && l.statut === 'a-voir-ebay') ? ` · ${l.note}` : ''}
            {plusieursComptes ? ` · ${nomRef(l.it._compte || 'principal')}` : ''}
          </div>
          {l.cochable && sousAchat(l) && <div data-regles-sous-achat={String(l.it.itemId)} style={{ fontSize: 11.5, color: E.warn }}>sous ton prix d'achat ({eurEbay(l.achat)})</div>}
          {r && <div data-regles-issue={r.issue} {...(r.nonNote ? { 'data-regles-non-note': '1' } : {})} style={{ fontSize: 11.5, color: couleurIssue(r) }}>{texteIssue(r)}</div>}
        </div>
      </div>
    );
  };
  return (
    <div data-regles-toutes style={{ background: E.card, border: `1px solid ${E.border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
      {(enCours || bilan) && (
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: E.card, padding: '4px 0 8px', marginBottom: 6, borderBottom: `1px solid ${E.border}` }}>
          {enCours && lot && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span data-regles-progres={`${progres}/${lot.length}`} style={{ fontSize: 13, fontWeight: 700, color: E.text }}>Réglage en cours : {progres} sur {lot.length}</span>
              <button type="button" data-regles-arreter onClick={() => { arret.current = true; }} style={lienE}>Arrêter</button>
            </div>
          )}
          {!enCours && bilan && (
            <div data-regles-bilan data-regles-total={bilan.total} data-regles-ok={bilan.ok} data-regles-ecart={bilan.ecart} data-regles-offres-inconnues={bilan['offres-inconnues']} data-regles-non-relu={bilan['non-relu']}
              data-regles-a-revoir={bilan['a-revoir']} data-regles-incertain={bilan.incertain} data-regles-ko={bilan.ko} data-regles-non-envoyees={bilan.nonEnvoyees} data-regles-non-note={bilan.nonNote || 0}
              style={{ fontSize: 12.5, color: bilan.ok === bilan.total && !bilan.nonNote ? E.text : E.warn, lineHeight: 1.5 }}>{bilanTexte(bilan)}</div>
          )}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 800, color: E.text }}>Une règle pour toutes</div>
      <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, margin: '3px 0 8px' }}>Un pourcentage du prix de chaque annonce. Le montant est calculé maintenant, arrondi au centime supérieur, puis fixé : il ne suit pas un changement de prix. Rien ne part avant ta confirmation.</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: E.text }}>
        Accepter les offres dès
        <input value={pct} onChange={(ev) => { setPct(ev.target.value); setChoix(new Map()); }} inputMode="numeric" placeholder="90" data-regles-pct disabled={enCours} style={inp} />
        % du prix
      </label>
      {pct.trim() !== '' && !pctOk && <div data-regles-pct-erreur style={{ fontSize: 11.5, color: E.warn, marginTop: 6 }}>Entre 50 et 99 % (en dessous, fixe le montant annonce par annonce).</div>}
      {enCours && lot ? (
        <div style={{ marginTop: 10 }}>
          {lot.map((x) => {
            const r = issues[x.cle];
            return (
              <div key={x.cle} data-regles-lot-ligne={x.itemId} style={{ padding: '7px 0', borderTop: `1px solid ${E.border}` }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.titre}</div>
                <div style={{ fontSize: 11.5, color: E.muted }}>{eurEbay(x.prix)} → dès {eurEbay(x.seuil)}{plusieursComptes ? ` · ${nomRef(x.compte)}` : ''}</div>
                {r ? <div data-regles-issue={r.issue} {...(r.nonNote ? { 'data-regles-non-note': '1' } : {})} style={{ fontSize: 11.5, color: couleurIssue(r) }}>{texteIssue(r)}</div> : <div style={{ fontSize: 11.5, color: E.muted }}>en attente</div>}
              </div>
            );
          })}
        </div>
      ) : pctOk && (
        <div data-regles-apercu style={{ marginTop: 10 }}>
          {nIllisibles > 0 && (
            <div data-regles-toutes-illisibles={nIllisibles} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: E.warn, flex: '1 1 200px', minWidth: 0 }}>{nIllisibles} annonce{nIllisibles > 1 ? 's' : ''} dont VRM n'a pas pu lire la règle actuelle (c'est la lecture de VRM qui a échoué) : rien n'est remplacé à l'aveugle.</span>
              {onRelireBase && <button type="button" data-regles-toutes-relire-base disabled={relit} onClick={() => onRelireBase()} style={{ ...lienE, opacity: relit ? 0.55 : 1 }}>{relit ? 'Lecture…' : 'Réessayer'}</button>}
            </div>
          )}
          {aRelire.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: E.muted, flex: '1 1 200px', minWidth: 0 }}>{aRelire.length} annonce{aRelire.length > 1 ? 's' : ''} dont la règle actuelle n'est pas lue : relis-{aRelire.length > 1 ? 'les' : 'la'} d'abord, rien n'est remplacé à l'aveugle.</span>
              <button type="button" data-regles-toutes-relire disabled={relit} onClick={() => onRelire && onRelire(aRelire)} style={{ ...lienE, opacity: relit ? 0.55 : 1 }}>{relit ? 'Lecture…' : `Relire ces ${aRelire.length} annonce${aRelire.length > 1 ? 's' : ''} chez eBay`}</button>
            </div>
          )}
          {lignes.map((l) => ligneRendu(l, issues[l.cle]))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" data-regles-appliquer disabled={!n || trop || enCours} onClick={appliquer}
              style={{ ...lienE, border: 'none', background: E.accent, color: '#fff', opacity: (!n || trop || enCours) ? 0.45 : 1, cursor: (!n || trop || enCours) ? 'default' : 'pointer' }}>Appliquer à {n} annonce{n > 1 ? 's' : ''}</button>
            {trop && <span data-regles-trop style={{ fontSize: 11.5, color: E.warn }}>{REGLES_LOT_MAX} au plus à la fois : décoche-en, ou choisis un compte en haut.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
function EbayAnnonces({ baseKO, comptes = [], vue = '*', comptesEbay }) {
  const E = EBAY_SKIN;
  // (9 octobre) PLUSIEURS COMPTES eBAY. `items`, `commandes`, `programmees`,
  // `journalAuto`, `eligibles` portent TOUS les comptes actifs (chaque ligne
  // marquée de son compte) : c'est sur eux que tournent l'anti double vente, le
  // retrait automatique et la garde de publication — le sélecteur ne change que
  // ce qu'on VOIT (`vue`), jamais ce qui protège.
  const [items, setItems] = React.useState(undefined); // undefined=en cours · null=pas su · []=lu
  // ── LA RÈGLE D'OFFRE (9 octobre) : `ebay_offres{_clé}` de chaque compte. ──
  // `regles` : undefined en cours · { map, illisibles }. Les gestes posent un
  // état LOCAL (`reglesLocales`, même clé `${ref}:${itemId}`) qui prime sur la
  // ligne lue jusqu'au prochain chargement ; `prixLocaux` : le prix relu chez
  // eBay (409 « prix-change », changement de prix).
  const [regles, setRegles] = React.useState(undefined);
  const [reglesLocales, setReglesLocales] = React.useState(() => new Map());
  const [prixLocaux, setPrixLocaux] = React.useState(() => new Map());
  // (11 octobre, revue — tour 3) Les annonces qu'eBay vient de dire ABSENTES de
  // ce compte (liste complète, « Relire chez eBay ») : gardé tant que l'écran
  // est ouvert — un rechargement de la base ne doit pas les faire redevenir
  // « jamais lues », relues sans fin, si la synchro qui suit n'a pas abouti.
  const [absentesEbay, setAbsentesEbay] = React.useState(() => new Set());
  // Quand VRM a relu les ventes eBay de chaque compte : Map(ref → ms | null
  // jamais | undefined illisible) ; null = pas su du tout.
  const [ventesEbayLues, setVentesEbayLues] = React.useState(undefined);
  const [enLot, setEnLot] = React.useState(() => new Set());         // annonces d'un lot « une règle pour toutes » en cours
  const [lotInterrompu, setLotInterrompu] = React.useState(() => { try { const v = JSON.parse(sessionStorage.getItem('vrm_regles_lot_interrompu') || 'null'); return v && Number(v.n) > 0 ? v : null; } catch (_) { return null; } });
  const [relectureRegles, setRelectureRegles] = React.useState('');   // ce que « Relire chez eBay » a à dire
  const [relitRegles, setRelitRegles] = React.useState(false);
  const [relitVentes, setRelitVentes] = React.useState(false);
  const [toutesOuvert, setToutesOuvert] = React.useState(false);       // le panneau « Une règle pour toutes »
  const [illisiblesAnnonces, setIllisiblesAnnonces] = React.useState([]);   // comptes dont les annonces n'ont pas pu être lues
  const [comptesStatut, setComptesStatut] = React.useState(undefined);      // {cle,pseudo,principal,relie}[] — la route
  const [connected, setConnected] = React.useState(undefined); // true/false/null(pas su)/undefined(en cours)
  const { paires, enLigne, toutesLues } = useEbayPaires(comptes);  // source partagée avec l'onglet Compte (§11)
  const [commandes, setCommandes] = React.useState(undefined);       // ebay_orders : undefined · null · []
  const [vendusVinted, setVendusVinted] = React.useState(undefined); // prouvées vendues : undefined · null · Set
  // (11 octobre) Les ventes Vinted EN COURS qu'aucune preuve ne relie encore à
  // leur annonce : `undefined` en cours · `null` pas su · [{ uid, tx }].
  const [sansPreuve, setSansPreuve] = React.useState(undefined);
  // (revue du 11 octobre) Les comptes dont les ventes n'ont pas pu être lues
  // pour cette ligne : on le DIT, sinon « pas encore reliées » disparaît en
  // silence — l'écran d'une panne serait celui où tout est relié (§4.1).
  const [sansPreuveKO, setSansPreuveKO] = React.useState([]);
  // Le geste de la ligne « pas reliées » suit l'extension de CE navigateur (sa
  // version, sa session VRM) et l'appareil (téléphone : rien à générer ici).
  const sansSouris = useSansSouris();
  const [, majExt] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => onVmrExt(majExt), []);
  // L'extension prévient quand elle a rangé une preuve (une transaction lue,
  // un bordereau, des ventes) : on relit, regroupé (une rafale = une lecture).
  const [preuveRelue, setPreuveRelue] = React.useState(0);
  React.useEffect(() => {
    let t = null;
    const f = (e) => { const d = e && e.detail; if (!d || d.type !== 'maj' || !['preuves', 'label', 'ventes'].includes(d.quoi)) return; clearTimeout(t); t = setTimeout(() => setPreuveRelue((n) => n + 1), 1500); };
    window.addEventListener('vrm:ext', f);
    return () => { clearTimeout(t); window.removeEventListener('vrm:ext', f); };
  }, []);
  const [eligibles, setEligibles] = React.useState(undefined);       // offre : undefined · null · { ids:Set, complet }
  const [retraits, setRetraits] = React.useState({});                // itemId → '…' (en cours) | message
  // Retrait automatique (proposition 8) : l'interrupteur, et ce qui a été retiré
  // en son nom (`ebay_retraits_auto`, écrit par la route). Trois états pour le
  // journal : `undefined` en cours · `null` pas su · tableau.
  const [retraitAuto, setRetraitAuto] = React.useState(() => load('vrm_ebay_retrait_auto', false) === true);
  // (revue du 11 octobre) À l'arrivée du nuage, le réglage EST celui du nuage :
  // `v || …` ne pouvait jamais repasser à faux — éteint sur un autre appareil,
  // l'écran disait ALLUMÉ (« VRM retire tout seul ») pendant que le retrait
  // automatique, qui lit `load(…)`, ne faisait rien. Aucune saisie n'est à
  // protéger ici : le bouton est désactivé tant que le nuage n'est pas lu.
  React.useEffect(() => onCloudReady(() => setRetraitAuto(load('vrm_ebay_retrait_auto', false) === true)), []);
  const [journalAuto, setJournalAuto] = React.useState(undefined);
  // Le réglage est SYNCHRONISÉ : tant que le nuage n'est pas arrivé, on ne sait
  // pas s'il est allumé (trois états, jamais deux).
  const [reglageAutoLu, setReglageAutoLu] = React.useState(() => isCloudReady());
  React.useEffect(() => onCloudReady(() => setReglageAutoLu(true)), []);
  React.useEffect(() => { if (comptesEbay === undefined) return; let stop = false; (async () => {
    // Le journal de CHAQUE compte (`ebay_retraits_auto{_clé}`) : un seul
    // illisible ⇒ « pas su » (on ne présente pas une liste partielle).
    const r = comptesEbay === null ? null : await lireEbayTous('ebay_retraits_auto', 'items:data->items', 'items', comptesEbay);
    if (!stop) setJournalAuto(!r || r.illisibles.length ? null : r.items.slice().sort((a, b) => (Number(b && b.at) || 0) - (Number(a && a.at) || 0)));
  })(); return () => { stop = true; }; }, [retraits, comptesEbay]);
  const basculerRetraitAuto = async () => {
    if (retraitAuto) { setRetraitAuto(false); save('vrm_ebay_retrait_auto', false); return; }
    const ok = await askConfirm({
      title: 'Retirer d\'eBay, sans te demander, une paire vendue sur Vinted ?',
      desc: `Seulement quand tout est sûr : ${CONDITIONS_RETRAIT_AUTO}. Sinon, rien ne part : elle reste dans « à retirer », avec le bouton, et VRM te dit pourquoi. Ça se fait quand VRM est ouvert. Une annonce eBay terminée ne revient pas : il faudrait la republier.`,
      ok: 'Allumer', cancel: 'Annuler',
    });
    if (!ok) return;
    setRetraitAuto(true); save('vrm_ebay_retrait_auto', true);
  };
  // ── BROUILLONS ET PROGRAMMÉES (5 octobre) ──
  const [brouillons, setBrouillons] = React.useState(undefined);     // ebay_brouillons : undefined · null · {id: brouillon}
  const [programmees, setProgrammees] = React.useState(undefined);   // ebay_programmees : undefined · null · 'jamais' · {items, enLigne, capturedAt}
  const [ouvrirBrouillon, setOuvrirBrouillon] = React.useState(null); // le brouillon à rouvrir dans le formulaire
  const [planif, setPlanif] = React.useState(null);                  // ids des brouillons à programmer
  const [annulations, setAnnulations] = React.useState({});          // itemId → réponse d'eBay à « annuler »
  const [nuage, setNuage] = React.useState(0);
  React.useEffect(() => onCloudReady(() => setNuage((n) => n + 1)), []);
  // La ligne `ebay_programmees` (écrite par la route, au nom du vendeur) —
  // projetée (§4.4). Ligne ABSENTE = « jamais lue », pas « aucune » : on
  // demande alors à eBay, une fois.
  // Les programmées de CHAQUE compte (sa ligne `ebay_programmees{_clé}`),
  // réunies et marquées. Un compte illisible ⇒ `null` (« pas su ») ; un compte
  // dont la ligne n'a jamais été écrite est noté (`jamais`) et relu chez eBay.
  const chargerProgrammees = React.useCallback(async () => {
    if (comptesEbay === undefined) return;
    const r = comptesEbay === null ? null : await lireEbayParCompte('ebay_programmees', 'items:data->items,enLigne:data->enLigne,capturedAt:data->>capturedAt,complet:data->>complet', comptesEbay);
    if (!r || r.lignes.some((x) => x.ligne === undefined)) { setProgrammees(null); return; }
    const absents = r.lignes.filter((x) => x.ligne === null).map((x) => x.compte);
    if (absents.length === r.lignes.length) { setProgrammees('jamais'); return; }
    const lus = r.lignes.filter((x) => x.ligne);
    const caps = lus.map((x) => Number(x.ligne.capturedAt) || 0);
    setProgrammees({
      items: lus.flatMap((x) => marquerEbay(x.ligne.items, x.compte)),
      enLigne: lus.flatMap((x) => marquerEbay(x.ligne.enLigne, x.compte)),
      // La capture la plus ANCIENNE : prudent — un brouillon programmé reste
      // attendu tant que SON compte n'a pas été relu (`brouillonEncoreAttendu`).
      capturedAt: caps.every((n) => n > 0) ? Math.min(...caps) : null,
      complet: lus.every((x) => x.ligne.complet !== 'false'),
      jamais: absents.map((c) => c.ref),
    });
  }, [comptesEbay]);
  // Les comptes RELIÉS (la route le dit) — ceux à qui on peut demander quelque
  // chose. Avant d'avoir la réponse : aucun.
  const comptesRelies = React.useMemo(() => (Array.isArray(comptesStatut) ? comptesStatut : []).filter((c) => c.relie === true).map((c) => ({ ...c, ref: c.principal ? 'principal' : c.cle })), [comptesStatut]);
  const relireProgrammees = React.useCallback(async (refs) => {
    const liste = comptesRelies.filter((c) => !Array.isArray(refs) || refs.includes(c.ref));
    for (const c of (liste.length || Array.isArray(refs) ? liste : [{ ref: 'principal' }])) await appelEbay({ action: 'programmees', ...corpsCompteEbay(c.ref) });
    await chargerProgrammees();
  }, [chargerProgrammees, comptesRelies]);
  // Chargement rechargeable (pour rafraîchir après une publication / modif).
  const charger = React.useCallback(async () => {
    lireBrouillonsEbay().then((b) => setBrouillons(b));
    if (comptesEbay === undefined) return;
    chargerProgrammees();
    if (comptesEbay === null) { setItems(null); setCommandes(null); setRegles({ map: new Map(), illisibles: new Set(['*']) }); setVentesEbayLues(null); return; }
    const [L, O, RG] = await Promise.all([
      lireEbayTous('ebay_listings', 'items:data->items', 'items', comptesEbay),
      // Les commandes eBay : seulement la liste (§4.4), pour « vendue sur eBay » —
      // et (9 octobre) QUAND elles ont été relues (la fenêtre où eBay vend
      // sans que VRM le voie, dite à côté des règles d'offre).
      lireEbayTous('ebay_orders', 'orders:data->orders,capturedAt:data->>capturedAt', 'orders', comptesEbay),
      lireReglesEbay(comptesEbay),
    ]);
    setRegles(RG); setReglesLocales(new Map()); setPrixLocaux(new Map());
    setVentesEbayLues(O ? new Map(O.lignes.map(({ compte, ligne }) => [compte.ref, ligne === undefined ? undefined : (ligne && Number(ligne.capturedAt) > 0 ? Number(ligne.capturedAt) : null)])) : null);
    // Annonces : les comptes lisibles sont montrés, l'illisible est NOMMÉ ;
    // tous illisibles ⇒ « pas su » (comme avant).
    setIllisiblesAnnonces(L ? L.illisibles : []);
    setItems(!L || (L.illisibles.length && L.illisibles.length === L.comptes.length) ? null : L.items);
    // Commandes : un seul compte illisible ⇒ « pas su » (une vente eBay de ce
    // compte-là ne lèverait pas « retire-la de Vinted »).
    setCommandes(!O || O.illisibles.length ? null : O.items);
  }, [chargerProgrammees, comptesEbay]);
  React.useEffect(() => { charger(); }, [charger]);
  // Sonde de connexion eBay : le publieur ne sert à rien si aucun compte n'est
  // relié — on l'affiche alors seulement quand c'est le cas, sinon on renvoie
  // vers l'onglet « Compte eBay » (jamais un formulaire mort).
  React.useEffect(() => { let stop = false;
    fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'status' }) })
      .then(r => r.json()).then(j => {
        if (stop) return;
        setConnected(j && j.ok ? !!j.connected : null);
        // Une route d'avant (sans `comptes`) : le principal seul, relié si `connected`.
        setComptesStatut(j && j.ok ? (Array.isArray(j.comptes) ? j.comptes : [{ cle: '', pseudo: '', principal: true, relie: !!j.connected }]) : null);
      }).catch(() => { if (!stop) { setConnected(null); setComptesStatut(null); } });
    return () => { stop = true; }; }, [comptesEbay]);
  // Quelles annonces eBay accepte-t-il d'offrir aux observateurs ? Compte par
  // compte relié (un identifiant d'annonce est unique chez eBay). Trois états :
  // on ne montre un bouton que sur un OUI d'eBay ; un compte qui ne répond pas
  // ⇒ la liste n'est pas complète.
  const chargerEligibles = React.useCallback(async () => {
    const liste = comptesRelies.length ? comptesRelies : [{ ref: 'principal' }];
    const reps = await Promise.all(liste.map(async (c) => {
      try {
        const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'offreinfo', ...corpsCompteEbay(c.ref) }) });
        return await r.json().catch(() => null);
      } catch (_) { return null; }
    }));
    const lus = reps.filter((j) => j && j.ok && Array.isArray(j.eligibles));
    if (!lus.length) { setEligibles(null); return; }
    setEligibles({ ids: new Set(lus.flatMap((j) => j.eligibles.map(String))), complet: lus.length === reps.length && lus.every((j) => j.complet !== false) });
  }, [comptesRelies]);
  React.useEffect(() => { if (connected === true) chargerEligibles(); }, [connected, chargerEligibles]);
  // Jamais lue : on demande à eBay, une fois, compte relié.
  const programmeesDemandees = React.useRef(false);
  React.useEffect(() => {
    if (connected !== true || programmeesDemandees.current) return;
    if (programmees === 'jamais') { programmeesDemandees.current = true; relireProgrammees(); }
    else if (programmees && typeof programmees === 'object' && Array.isArray(programmees.jamais) && programmees.jamais.length && comptesRelies.length) { programmeesDemandees.current = true; relireProgrammees(programmees.jamais); }
  }, [programmees, connected, relireProgrammees, comptesRelies]);
  // Les programmées connues : la liste d'eBay + ce que VRM vient de programmer.
  // (6 octobre) La MÊME règle que la liste rendue (`programmeesConnues`, §11) :
  // un brouillon annulé, terminé ou passé en ligne ne ressuscite plus l'alerte.
  const listeProgrammees = React.useMemo(() => programmeesConnues(programmees && typeof programmees === 'object' ? programmees : null, brouillons, false), [programmees, brouillons]);
  // La preuve de vente Vinted n'est lue que s'il y a quelque chose à vérifier :
  // une annonce eBay reliée, une commande eBay qui porte un SKU VRM, une annonce
  // PROGRAMMÉE, ou un brouillon (on ne programme pas une paire déjà vendue).
  // (6 octobre) + le formulaire de mise en vente : il refuse une paire déjà
  // vendue, il a donc besoin de la même preuve.
  const aVerifier = (Array.isArray(items) && items.some((a) => a && numDeSkuEbay(a.sku)))
    || (Array.isArray(commandes) && commandes.some((o) => o && Array.isArray(o.lineItems) && o.lineItems.some((li) => li && numDeSkuEbay(li.sku))))
    || listeProgrammees.some((p) => p && numDeSkuEbay(p.sku))
    || !!(brouillons && typeof brouillons === 'object' && Object.keys(brouillons).length)
    || connected === true || !!ouvrirBrouillon;
  // Les ventes Leboncoin (5 Ko, projetées §4.4) : une paire vendue LÀ-BAS ne se
  // programme pas sur eBay. TROIS états : `undefined` en cours · `null` pas su
  // (la base n'a pas répondu) · objet lu (`{}` = aucune vente captée).
  const [ventesLbc, setVentesLbc] = React.useState(undefined);
  const [lbcItems, setLbcItems] = React.useState(undefined);   // annonces Leboncoin : lues SEULEMENT si une vente ne se relie pas sans elles
  // Les comptes dont on compte les ventes pas encore reliées : ceux qui sont
  // liés et pas mis de côté par lui (un compte exclu ne se réclame pas, §7).
  const comptesPreuve = React.useMemo(() => {
    const masques = new Set((load('vinted_accounts_hidden', []) || []).map(String));
    return (Array.isArray(comptes) ? comptes : []).map((a) => String((a && a.vinted_user_id) || '')).filter((u) => /^\d+$/.test(u) && !masques.has(u));
  }, [comptes, nuage]);
  // Les ventes de tous ses comptes (~190 Ko mesurés, la liste des commandes) ne
  // sont lues pour « pas encore reliées » que s'il y a ici une annonce reliée
  // (en ligne ou programmée) qu'une double vente pourrait toucher (§4.4).
  const avecSku = (Array.isArray(items) && items.some((a) => a && numDeSkuEbay(a.sku))) || listeProgrammees.some((p) => p && numDeSkuEbay(p.sku));
  const clePreuve = avecSku ? comptesPreuve.join(',') : '';
  React.useEffect(() => {
    if (!aVerifier) return;
    let stop = false;
    lirePreuvesVenteVinted({ comptes: avecSku ? comptesPreuve : null }).then((p) => { if (!stop) { setVendusVinted(p ? p.vendus : null); setSansPreuve(p ? p.sansPreuve : null); setSansPreuveKO(p && Array.isArray(p.sansPreuveKO) ? p.sansPreuveKO : []); } });
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_ventes&select=ventes:data->ventes`, { headers: sbAuth() });
        if (!r.ok) { if (!stop) setVentesLbc(null); return; }
        const rows = await r.json();
        if (!Array.isArray(rows)) { if (!stop) setVentesLbc(null); return; }
        const v = rows[0] && rows[0].ventes;
        if (!stop) setVentesLbc(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      } catch (_) { if (!stop) setVentesLbc(null); }
    })();
    return () => { stop = true; };
  }, [aVerifier, items, clePreuve, preuveRelue]);
  // Après une publication / modif : on resynchronise depuis eBay puis on relit.
  // (9 octobre) Chaque compte relié est relu, l'un après l'autre — ou seulement
  // celui qu'on vient de toucher (`ref`).
  const resync=React.useCallback(async(ref)=>{
   const liste=typeof ref==='string' && ref?[{ref}]:(comptesRelies.length?comptesRelies:[{ref:'principal'}]);let ok=true;
   for(const c of liste){try{const r=await fetch('/api/ebay',{method:'POST',headers:{'content-type':'application/json',...enTeteSession()},body:JSON.stringify({action:'sync',...corpsCompteEbay(c.ref)})});const j=await r.json();if(!r.ok || !j.ok || (j.lu && (!j.lu.commandes || !j.lu.annonces)))ok=false;}catch(_){ok=false;}}
   await charger();return {ok};
  },[charger,comptesRelies]);
  // ── (9 octobre) eBAY VEND SANS ATTENDRE VRM ──────────────────────────────
  // Une règle d'offre active, c'est eBay qui vend : VRM ne voit cette vente
  // qu'en relisant les ventes eBay. Une fois par ouverture, pour chaque compte
  // RELIÉ qui a au moins une règle active et dont les ventes ont plus de 6 h
  // (ou n'ont jamais été lues), on les relit — l'un après l'autre. Sans règle,
  // rien ne change.
  // ⚠️⚠️ (11 octobre, revue — tour 3) « Une règle active » se juge par LA règle
  // de l'écran (`reglesEngagees` : `etatRegleOffre` + `regleEngage`, §11) —
  // une règle qu'eBay tient PEUT-ÊTRE compte aussi (seuil relu sans l'état des
  // offres, pose incertaine, en cours, posée mais pas relue alors qu'eBay a
  // répondu « Success », programmée). Le filtre brut `offresActives === true`
  // les laissait toutes de côté : eBay vendait au seuil, VRM ne relisait rien.
  const ventesRelues = React.useRef(false);
  React.useEffect(() => {
    if (ventesRelues.current || connected !== true || !regles || items === undefined || !(ventesEbayLues instanceof Map) || comptesStatut === undefined) return;
    ventesRelues.current = true;
    const parRef = new Map();
    const de = (ref) => { if (!parRef.has(ref)) parRef.set(ref, { ref, entrees: {}, annonces: Array.isArray(items) ? [] : null, programmees: null, cap: null }); return parRef.get(ref); };
    for (const [k, e] of regles.map) { const i = k.lastIndexOf(':'); de(k.slice(0, i)).entrees[k.slice(i + 1)] = e; }
    for (const a of (Array.isArray(items) ? items : [])) { const c = parRef.get(a._compte || 'principal'); if (c) c.annonces.push(a); }
    const avecRegle = reglesEngagees([...parRef.values()]).refs;
    const relies = new Set(comptesRelies.map((c) => c.ref));
    const vieux = [...avecRegle].filter((ref) => relies.has(ref) && ventesEbayLues.has(ref) && ventesEbayLues.get(ref) !== undefined && (ventesEbayLues.get(ref) == null || Date.now() - ventesEbayLues.get(ref) > 6 * 3600000));
    if (!vieux.length) return;
    (async () => { for (const ref of vieux) await resync(ref); })();
  }, [connected, regles, items, ventesEbayLues, comptesStatut, comptesRelies, resync]);
  // ⚠️⚠️ (11 octobre, revue — tour 3) UNE PROGRAMMÉE PARTIE (le planificateur,
  // « Maintenant » ou à l'heure dite) : eBay la dit EN LIGNE (`programmees.enLigne`,
  // relu après le planificateur) mais la liste des annonces ne la porte pas
  // encore — elle sortait des programmées sans entrer ici, avec la règle
  // d'offre que VRM venait lui-même d'envoyer, et rien sur cet écran ne
  // relisait la liste. On relit le compte (une synchro : la liste ET la règle,
  // lue dans son GetItem), une fois par annonce et par ouverture.
  const partiesVues = React.useRef(new Set());
  React.useEffect(() => {
    if (connected !== true || !Array.isArray(items) || !programmees || typeof programmees !== 'object' || !Array.isArray(comptesStatut)) return;
    const presentes = new Set(items.map((a) => (a._compte || 'principal') + ':' + String(a.itemId)));
    const relies = new Set(comptesRelies.map((c) => c.ref));
    const refs = new Set();
    for (const x of (Array.isArray(programmees.enLigne) ? programmees.enLigne : [])) {
      if (!x || x.itemId == null) continue;
      const ref = x._compte || 'principal', cle = ref + ':' + String(x.itemId);
      if (presentes.has(cle) || partiesVues.current.has(cle)) continue;
      partiesVues.current.add(cle);
      if (relies.has(ref)) refs.add(ref);
    }
    if (!refs.size) return;
    (async () => { for (const ref of refs) await resync(ref); })();
  }, [connected, items, programmees, comptesStatut, comptesRelies, resync]);
  // ── L'ANTI DOUBLE VENTE : la règle partagée, sur ce que l'écran a lu ───────
  const fiches = React.useMemo(() => load('vinted_annonce_numeros', {}) || {}, [nuage, items]);
  // ── UNE PAIRE DÉJÀ VENDUE, TOUTES PLATEFORMES (6 octobre) : LE verdict que
  //    consomment le planificateur, le formulaire et l'alerte « à annuler » (§11).
  const ventesConnues = React.useMemo(() => numerosDejaVendus({
    numeros: fiches,
    autres: Object.values(brouillons && typeof brouillons === 'object' ? brouillons : {}).map((d) => d && { numero: d.numero, id: d.pairId }),
    enLigne,
    vendusVinted, commandes, ventesLbc, itemsLbc: lbcItems,
    liensLbc: load('vrm_lbc_liens', {}) || {},
  }), [fiches, brouillons, enLigne, vendusVinted, commandes, ventesLbc, lbcItems]);
  // Une vente Leboncoin qui ne se relie pas sans son annonce : on lit les
  // annonces (une fois par session, comme le tableau de bord) — `null` = pas su.
  React.useEffect(() => {
    if (!(ventesConnues.lbcSansPaire > 0) || lbcItems !== undefined) return;
    let stop = false;
    lbcAnnoncesSession().then((it) => { if (!stop) setLbcItems(it && typeof it === 'object' ? it : null); });
    return () => { stop = true; };
  }, [ventesConnues.lbcSansPaire, lbcItems]);
  const dv = React.useMemo(() => doublesVenteEbay({
    annonces: Array.isArray(items) ? items : [],
    commandes: Array.isArray(commandes) ? commandes : [],
    numeros: fiches,
    enLigne: enLigne || null,
    vendusVinted: vendusVinted || null,
    programmees: listeProgrammees,
    ventes: ventesConnues,
  }), [items, commandes, fiches, enLigne, vendusVinted, listeProgrammees, ventesConnues]);
  // ⚠️ (9 octobre) LA MÊME PAIRE EN VENTE SUR DEUX DE SES COMPTES eBAY (une
  // annonce publiée avant la garde, ou à la main sur eBay) : deux acheteurs
  // possibles pour une seule paire. Identité par SKU (§5) ; VRM ne choisit pas
  // laquelle retirer — il le dit, avec les deux annonces.
  const surDeuxComptes = React.useMemo(() => {
    const m = new Map();
    for (const a of (Array.isArray(items) ? items : [])) { const n = numDeSkuEbay(a && a.sku); if (!n) continue; const l = m.get(n) || []; l.push(a); m.set(n, l); }
    return [...m.entries()].filter(([, l]) => new Set(l.map((a) => a._compte)).size > 1).map(([numero, annonces]) => ({ numero, annonces }));
  }, [items]);
  // (revue du 8 octobre) Retrait automatique allumé : POURQUOI chaque paire
  // « à retirer » n'est pas partie toute seule — la MÊME règle que le passage de
  // la coque (`retraitsEbayAutoPermis`, §11), sur ce que l'écran a lu. Trois
  // états : `null` éteint / rien à retirer · `undefined` lectures en cours ·
  // Map(itemId → raison | 'permis').
  const autoJuge = React.useMemo(() => {
    if (!retraitAuto || !dv.aRetirerEbay.length) return null;
    if (vendusVinted === undefined || toutesLues === undefined) return undefined;
    const { permis, ecartes } = retraitsEbayAutoPermis({ aRetirerEbay: dv.aRetirerEbay, numeros: fiches, vendusVinted, toutesLues: toutesLues === true, comptesBloques: comptesBloquesVinted() });
    const m = new Map();
    for (const e of ecartes) if (e && e.itemId != null) m.set(String(e.itemId), e.raison);
    for (const d of permis) m.set(String(d.annonce.itemId), 'permis');
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retraitAuto, dv, fiches, vendusVinted, toutesLues, nuage]);
  // Les retraits automatiques dont eBay n'a pas dit l'issue (note de l'appareil).
  const autoIncertains = React.useMemo(() => load('vrm_ebay_auto_incertains', {}) || {}, [retraits, nuage, dv]);
  const numsConnus = React.useMemo(() => new Set(Object.values(fiches).map((f) => cleNum(f && f.numero)).filter(Boolean)), [fiches]);
  const titreDeNum = React.useMemo(() => { const m = new Map(); for (const f of Object.values(fiches)) { const k = cleNum(f && f.numero); if (k && !m.has(k)) m.set(k, (f && f.title) || ''); } return m; }, [fiches]);
  const pris = React.useMemo(() => { const m = new Map(); for (const a of (Array.isArray(items) ? items : [])) { const k = numEbayLu(a && a.sku, a && a.itemId, null, a && a.depuis); if (k && !m.has(k)) m.set(k, String(a.itemId)); } return m; }, [items]);
  // (9 octobre) Le prix d'achat de chaque paire, par son N° (une seule fiche ⇒
  // sa valeur ; ambigu ⇒ rien n'est dit). Déclaré APRÈS `fiches` (§4.6).
  const buyByNum = React.useMemo(() => load('vinted_buyprice_by_num', {}) || {}, [nuage, items]);
  const achats = React.useMemo(() => achatParNum(fiches, buyByNum), [fiches, buyByNum]);
  // POURQUOI on ne pose pas de règle d'offre sur une annonce : la paire est
  // déjà vendue (toutes plateformes, par le N°), ou en vente sur deux comptes,
  // ou on ne sait pas encore. Elle LIT le verdict de l'écran (§11), elle n'en
  // écrit pas un second. Retirer une règle, elle, reste toujours possible.
  const regleBloquee = (it) => {
    const n = numEbayLu(it && it.sku, it && it.itemId, null, it && it.depuis);
    if (!n) return null;            // pas reliée : la preuve de vente ne s'applique pas (le risque est dit à part)
    const id = String(it.itemId);
    if (dv.aRetirerEbay.some((d) => String(d.annonce && d.annonce.itemId) === id)) return { k: 'vendue', t: 'Vendue sur Vinted : retire-la d\'eBay plutôt que d\'y poser une règle d\'offre.' };
    const ou = ventesConnues.vendus.get(n);
    if (ou) return { k: 'vendue', t: `Déjà vendue sur ${ou} : pas de règle d'offre sur une paire partie.` };
    if (surDeuxComptes.some((d) => d.numero === n)) return { k: 'deux-comptes', t: 'En vente sur deux de tes comptes eBay : retire l\'une des deux annonces d\'abord.' };
    if (ventesConnues.enCours || vendusVinted === undefined) return { k: 'en-cours' };
    if (ventesConnues.pasSu.length || vendusVinted === null) return { k: 'pas-su' };
    return null;
  };
  // L'état local d'une carte : la ligne lue, ou ce qu'un geste vient de poser.
  const surRegle = React.useCallback((cle, entree, prix) => {
    if (entree !== undefined) setReglesLocales((m) => { const n = new Map(m); n.set(cle, entree); return n; });
    if (prix != null && Number.isFinite(Number(prix))) setPrixLocaux((m) => { const n = new Map(m); n.set(cle, Number(prix)); return n; });
  }, []);
  const cleAnnonce = (it) => ((it && it._compte) || 'principal') + ':' + String(it && it.itemId);
  // L'ÉTAT de la règle d'une annonce (`etatRegleOffre`, une fonction pour tout
  // l'écran, §11) — sur le prix connu (relu chez eBay après une 409).
  // Le prix d'une annonce tel que la CARTE l'affiche : relu chez eBay (409
  // « prix-change », changement de prix), sinon celui de la liste. UNE source
  // pour l'état de la règle ET l'aperçu « Une règle pour toutes » (§11).
  const prixDe = (it) => { const cle = cleAnnonce(it); return prixLocaux.has(cle) ? prixLocaux.get(cle) : (it && it.price); };
  const etatDe = (it) => {
    if (regles === undefined) return null;                       // en cours : ni ligne, ni bloc (pas de clignotement)
    const cle = cleAnnonce(it);
    if (absentesEbay.has(cle)) return { etat: 'pas-su', raison: 'pas-sur-ce-compte', risque: false };
    const itP = prixLocaux.has(cle) ? { ...it, price: prixDe(it) } : it;
    const l = reglesLocales.get(cle);
    return l ? etatRegleOffre(itP, new Map([[cle, l]]), null) : etatRegleOffre(itP, regles.map, regles.illisibles);
  };
  // La règle qu'un brouillon a ENVOYÉE avec sa programmation (eBay ne la relit
  // pas avant le départ) — dite comme telle.
  const offreDeProgrammee = (itemId) => offreEnvoyeeProgrammee(brouillons, itemId);
  // Le nom d'un compte eBay, pour les messages (son pseudo, sinon « compte principal »).
  const nomRef = (ref) => nomCompteEbay((Array.isArray(comptesEbay) ? comptesEbay : []).find((c) => c.ref === ref) || comptesRelies.find((c) => c.ref === ref) || {});
  // « Relire chez eBay » (la ligne « pas su » ET le geste groupé, §11) : seules
  // les raisons qui se relisent chez eBay (pas notre propre lecture ratée, pas
  // une autre devise) ; 50 au plus par clic ; compte par compte, par paquets de
  // 20, l'un après l'autre ; un compte qui ne répond pas est NOMMÉ. Tant qu'on
  // ne sait pas quels comptes sont reliés, rien ne part ; si on n'a pas pu le
  // savoir, on le dit — sans déclarer aucun compte « non relié ».
  const relireReglesEnCours = React.useRef(false);
  const relireRegles = async (cibles,forcer=false) => {
    if (relireReglesEnCours.current || comptesStatut === undefined) return;
    if (comptesStatut === null) { setRelectureRegles('Je n\'ai pas pu vérifier tes connexions eBay — rouvre l\'écran.'); return; }
    const aRelire = (cibles || []).filter((it) => forcer || seRelitChezEbay(etatDe(it)));
    if (!aRelire.length) { setRelectureRegles('Rien à relire chez eBay : rouvre l\'écran pour relire ce que VRM en sait.'); return; }
    relireReglesEnCours.current = true; setRelitRegles(true); setRelectureRegles('');
    const lot = aRelire.slice(0, 50);
    const relies = new Map(comptesRelies.map((c) => [c.ref, c]));
    const parCompte = new Map();
    for (const it of lot) { const ref = it._compte || 'principal'; if (!parCompte.has(ref)) parCompte.set(ref, []); parCompte.get(ref).push(it); }
    const notes = [];
    let ratees = 0;
    // (11 octobre, revue — tour 3) eBay dit, sur sa liste COMPLÈTE, que
    // l'annonce n'est plus en vente sur ce compte (terminée, vendue, déplacée) :
    // un fait mesuré, qui était AVALÉ — la carte restait « en ligne », la ligne
    // du haut « jamais lue », et « Relire » renvoyait la même relecture sans
    // fin. On le dit, la carte le porte, et on relit la LISTE de ce compte.
    const absentes = new Map();   // ref → nombre
    try {
      for (const [ref, liste] of parCompte) {
        if (!relies.has(ref)) { notes.push(`Le compte eBay ${nomRef(ref)} n'est plus connecté à VRM : ses annonces n'ont pas été relues.`); continue; }
        for (let i = 0; i < liste.length; i += 20) {
          const paquet = liste.slice(i, i + 20);
          const { j } = await appelEbay({ action: 'regleoffrelire', itemIds: paquet.map((it) => String(it.itemId)), ...corpsCompteEbay(ref) });
          if (!(j && j.ok && j.lectures && typeof j.lectures === 'object')) { notes.push(`eBay n'a pas répondu pour le compte ${nomRef(ref)} — réessaie dans un moment.`); break; }
          // ⚠️⚠️ (11 octobre, revue) Une lecture RATÉE ne remplace pas ce qu'on
          // savait : la route ne la range que sur une place vide, l'écran ne la
          // pose pas non plus par-dessus une règle connue (rien lu ne vaut pas
          // rien). On relit la base juste après, et on DIT combien ont raté.
          for (const [id, l] of Object.entries(j.lectures)) {
            if (l && typeof l === 'object' && l.lu === true) surRegle(ref + ':' + id,l,l.prix);
            else if (l && typeof l === 'object' && l.raison === 'pas-sur-ce-compte') { const k = ref + ':' + id; setAbsentesEbay((x) => { const n = new Set(x); n.add(k); return n; }); absentes.set(ref, (absentes.get(ref) || 0) + 1); }
            else if (l && typeof l === 'object' && (l.raison === 'lecture-ratee' || l.raison === 'pas-su')) ratees++;
          }
        }
      }
      if (ratees) notes.push(`eBay n'a pas rendu ${ratees} annonce${ratees > 1 ? 's' : ''} : VRM garde ce qu'il en savait — réessaie dans un moment.`);
      for (const [ref, n] of absentes) notes.push(`eBay ne montre plus ${n > 1 ? `${n} de ces annonces` : 'une de ces annonces'} en vente sur ${relies.size > 1 ? `le compte ${nomRef(ref)}` : 'ton compte'} (terminée${n > 1 ? 's' : ''}, vendue${n > 1 ? 's' : ''} ou déplacée${n > 1 ? 's' : ''}) : VRM relit tes annonces eBay.`);
      if (aRelire.length > lot.length) notes.push(`${lot.length} relues sur ${aRelire.length} — relance pour les suivantes.`);
      // Ce que la base en garde (la route vient de le ranger) ; l'état local,
      // posé à l'instant, prime jusqu'au prochain chargement.
      if (comptesEbay) { const RG = await lireReglesEbay(comptesEbay); setRegles(RG); }
    } finally { relireReglesEnCours.current = false; setRelitRegles(false); setRelectureRegles(notes.join(' ')); }
    // La liste des comptes où eBay ne montre plus une annonce : une synchro
    // (elle la sort d'ici si elle n'y est plus, et relit sa règle si elle y est).
    for (const ref of absentes.keys()) await resync(ref);
  };
  // (6 octobre) Ce que le formulaire de mise en vente doit savoir : la paire est
  // déjà EN VENTE sur eBay, ou déjà PROGRAMMÉE (elle n'était pas vue — une
  // publication immédiate créait une seconde annonce, et la programmée
  // s'ajoutait à son heure). N° → { etat, debut }.
  const dejaSurEbay = React.useMemo(() => {
    const m = new Map();
    for (const k of pris.keys()) m.set(k, { etat: 'en-vente' });
    for (const x of ((programmees && typeof programmees === 'object' && Array.isArray(programmees.enLigne)) ? programmees.enLigne : [])) { const k = numEbayLu(x && x.sku, x && x.itemId, null, x && x.depuis); if (k && !m.has(k)) m.set(k, { etat: 'en-vente' }); }
    for (const p of listeProgrammees) { const k = numEbayLu(p && p.sku, p && p.itemId, null, p && p.depuis); if (k && !m.has(k)) m.set(k, { etat: 'programmee', debut: p.debut || null }); }
    // (17 oct.) LA MÊME PAIRE SOUS UN AUTRE N° (photo exacte, `jumellesParPhoto`) :
    // si l'une est déjà sur eBay, l'autre l'est aussi — « une paire, une
    // annonce » vaut pour la paire, pas pour le numéro (la 80 publiée, la 81
    // repartait). Toutes les gardes (Publier, planificateur, sélecteur) lisent
    // cette carte : une seule règle (§11).
    const base = new Map(m);
    const jum = jumellesParPhoto(paires, (k) => base.has(k));
    for (const x of (Array.isArray(paires) ? paires : [])) {
      const j = jum.get(String(x.id)); const k = cleNum(x.num);
      if (!j || !k || m.has(k)) continue;
      const autre = j.autres.find((n) => base.has(cleNum(n)));
      if (autre) m.set(k, { ...base.get(cleNum(autre)), via: cleNum(autre) });
    }
    return m;
  }, [pris, programmees, listeProgrammees, paires]);
  const surSku = React.useCallback((itemId, sku) => {
    setItems((l) => Array.isArray(l) ? l.map((a) => String(a.itemId) === String(itemId) ? { ...a, sku } : a) : l);
  }, []);
  // Retirer d'eBay une paire VENDUE sur Vinted : sans retour côté eBay, donc
  // une confirmation qui le dit — et le serveur exige `confirme:true` lui aussi.
  const retirer = async (d) => {
    const a = d.annonce;
    const ok = await askConfirm({
      title: `Retirer « ${a.title || a.itemId} » d'eBay ?`,
      desc: `La paire N°${d.numero} est vendue sur Vinted. L'annonce eBay est terminée tout de suite : c'est sans retour côté eBay (il faudrait la republier).`,
      ok: 'Oui, retirer d\'eBay', cancel: 'Annuler', danger: true,
    });
    if (!ok) return;
    const id = String(a.itemId);
    setRetraits((m) => ({ ...m, [id]: '…' }));
    // (6 octobre) Une réponse sans résultat lisible (coupure, page d'erreur,
    // 504 « incertain ») n'est PAS un refus : l'annonce a pu être terminée.
    const { code, j } = await appelEbay({ action: 'retirer', itemId: id, confirme: true, ...corpsCompteEbay(a._compte) });
    if (j && j.ok) {
      setRetraits((m) => { const n = { ...m }; delete n[id]; return n; });
      setItems((l) => Array.isArray(l) ? l.filter((x) => String(x.itemId) !== id) : l);
      toast(`N°${d.numero} retirée d'eBay.`, 'ok');
      resync();
    } else if (code === 0 || !j || code === 504 || (j && j.reason === 'incertain')) setRetraits((m) => ({ ...m, [id]: (j && j.error) || 'eBay n\'a pas répondu — je ne sais pas si l\'annonce est retirée. Regarde sur eBay avant de recommencer.' }));
    else setRetraits((m) => ({ ...m, [id]: (j && j.error) || 'eBay a refusé le retrait.' }));
  };
  const wrap = (kids) => <div className="vrm-ebay-annonces" style={{ padding: 16, paddingBottom: 24 }}>{kids}</div>;
  const head = (n) => <ScreenHead icon="tag" title={`Annonces eBay${n != null ? ` (${n})` : ''}`}/>;
  // Le publieur, EN HAUT de l'onglet Annonces (Julien : « poster plus naturel »).
  // Affiché seulement si le compte est relié ; sinon une ligne qui renvoie au
  // compte, jamais un bouton mort.
  // (5 octobre) Un brouillon rouvert s'édite aussi sans connexion : il ne part
  // de toute façon chez eBay qu'au clic, et la route dit alors ce qui manque.
  // ── CE QU'ON VOIT (9 octobre) : le compte choisi en haut, ou tous. ──
  const plusieursComptes = Array.isArray(comptesEbay) && comptesEbay.length >= 2;
  const vueSeule = plusieursComptes && vue !== '*';
  const dansVue = (x) => !vueSeule || dansVueEbay(x, vue);
  // (9 octobre) Le compte où publier / programmer : celui de la vue s'il n'y en
  // a qu'un de choisi, sinon le dernier utilisé (réglage synchronisé), sinon le
  // premier relié. `dejaSurEbay` reste l'union de TOUS les comptes : une paire
  // en vente sur un compte reste bloquée sur l'autre, quelle que soit la vue.
  const [comptePubMemo, setComptePubMemo] = React.useState(() => { const v = load('vrm_ebay_compte_pub', ''); return typeof v === 'string' ? v : ''; });
  React.useEffect(() => onCloudReady(() => setComptePubMemo((v) => v || (() => { const n = load('vrm_ebay_compte_pub', ''); return typeof n === 'string' ? n : ''; })())), []);
  const choisirComptePub = (ref) => { setComptePubMemo(ref); save('vrm_ebay_compte_pub', ref); };
  const comptesPub = comptesRelies.map((c) => ({ ...c, pseudo: c.pseudo || ((Array.isArray(comptesEbay) ? comptesEbay : []).find((x) => x.ref === c.ref) || {}).pseudo || '' }));
  const compteDefautPub = (vueSeule && comptesPub.some((c) => c.ref === vue)) ? vue
    : (comptesPub.some((c) => c.ref === comptePubMemo) ? comptePubMemo : ((comptesPub[0] && comptesPub[0].ref) || 'principal'));
  const publier = (connected === true || ouvrirBrouillon)
    ? <EbayPublier paires={paires} onPublie={resync} dejaSurEbay={dejaSurEbay} brouillon={ouvrirBrouillon} onBrouillon={(b) => setBrouillons(b)}
        enLigne={enLigne} vendusVinted={vendusVinted} ventes={ventesConnues}
        comptesPub={comptesPub} compteDefaut={compteDefautPub} onCompte={choisirComptePub} />
    : connected === false
      ? <div style={{ fontSize: 12.5, color: E.muted, lineHeight: 1.5, border: `1px solid ${E.border}`, background: E.card, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>Pour mettre une paire en vente ici, relie d'abord ton compte eBay dans l'onglet <b style={{ color: E.text }}>« Compte eBay »</b>.</div>
      : null; // en cours / pas su : on ne dit rien plutôt qu'une fausse invite
  // ── 3 bis. BROUILLONS · PLANIFICATEUR · PROGRAMMÉES (5 octobre) ────────────
  const brouillonsChoisis = planif && brouillons && typeof brouillons === 'object' ? planif.map((id) => brouillons[id]).filter(Boolean) : [];
  // (6 octobre) Le brouillon redevient un brouillon — UN geste pour « Annuler »
  // de la liste ET « Annuler sa programmation » de l'alerte (nouvel identifiant
  // d'envoi au prochain essai : l'ancien a déjà servi chez eBay).
  const remettreBrouillon = (itemId) => modifierBrouillonsEbay((items0) => { for (const id in items0) { const d = items0[id]; if (d && d.programme && String(d.programme.itemId) === String(itemId)) items0[id] = { ...d, etatBrouillon: 'brouillon', programme: null, uuid: null, verif: null }; } return items0; })
    .then((w) => { if (w.ok) setBrouillons(w.items); return w; });
  // (16 oct., « premium » au téléphone) La LISTE des annonces est l'information
  // principale de l'écran : la mise en vente reste en haut, les brouillons et les
  // programmées passent SOUS la liste (`outilsSuite`), les notes aussi.
  const outilsSuite = (<>
    <EbayBrouillons brouillons={brouillons} connected={connected} paires={paires} vue={vueSeule ? vue : '*'} comptesPub={comptesPub}
      onModifier={(d) => setOuvrirBrouillon({ ...d })}
      onPlanifier={(ids) => setPlanif(ids)}
      onBrouillons={(b) => setBrouillons(b)} />
    {planif && brouillonsChoisis.length > 0 && (
      <EbayPlanificateur key={planif.join(',')} brouillons={brouillonsChoisis}
        comptesPub={comptesPub} compteDefaut={compteDefautPub} onCompte={choisirComptePub}
        annoncesEbay={Array.isArray(items) ? items : null} dejaSurEbay={dejaSurEbay}
        programmees={programmees && typeof programmees === 'object' ? listeProgrammees : (programmees === 'jamais' ? [] : null)}
        ventes={ventesConnues}
        onFermer={() => setPlanif(null)}
        onBrouillons={(b) => setBrouillons(b)}
        onFini={() => relireProgrammees()} />
    )}
    <EbayProgrammees programmees={programmees} brouillons={brouillons} vue={vueSeule ? vue : '*'} comptesEbay={comptesEbay}
      onRelire={() => relireProgrammees()}
      onAnnule={(itemId) => {
        setProgrammees((p) => (p && typeof p === 'object' ? { ...p, items: (p.items || []).filter((x) => String(x.itemId) !== itemId) } : p));
        remettreBrouillon(itemId);
      }} />
  </>);
  // (16 octobre, revue) « Vendre une paire » vient EN PREMIER, avant les
  // alertes : c'est le geste qu'on vient faire ici. `outils` ne garde que la suite.
  const outils = outilsSuite;
  // Annuler la programmation d'une paire vendue sur Vinted : la réponse d'eBay
  // est dite telle quelle (l'annulation par l'API n'est pas garantie).
  const annulerVendue = async (d) => {
    const a = d.annonce; const id = String(a.itemId);
    const t = Date.parse(a.debut || '');
    const ok = await askConfirm({
      title: `Annuler la mise en ligne de la N°${d.numero} sur eBay ?`,
      desc: `Elle est vendue sur ${d.ou || 'Vinted'}, et eBay doit la mettre en ligne ${Number.isFinite(t) ? 'le ' + quandParisTexte(t) : 'bientôt'}.\n\nVRM demande l'annulation à eBay et te dit SA réponse. Si eBay refuse, annule-la dans le Seller Hub d'eBay avant cette heure.`,
      ok: 'Oui, demander l\'annulation', cancel: 'Non', danger: true,
    });
    if (!ok) return;
    setAnnulations((m) => ({ ...m, [id]: '…' }));
    const { code, j } = await appelEbay({ action: 'deprogrammer', itemId: id, confirme: true, ...corpsCompteEbay(a._compte) });
    if (j && j.ok) {
      setAnnulations((m) => { const n = { ...m }; delete n[id]; return n; });
      setProgrammees((p) => (p && typeof p === 'object' ? { ...p, items: (p.items || []).filter((x) => String(x.itemId) !== id) } : p));
      // Sans ça, le brouillon « programmee » la remettait aussitôt dans la
      // liste — et l'alerte revenait, pour une chose qui n'existe plus.
      remettreBrouillon(id);
      toast(`N°${d.numero} : programmation annulée chez eBay.`, 'ok');
    } else setAnnulations((m) => ({ ...m, [id]: code === 0 || !j || code === 504 || (j && j.reason === 'incertain') ? 'eBay n\'a pas répondu — je ne sais pas si elle est annulée. Regarde sur eBay avant de recommencer.' : `eBay a répondu : « ${(j && j.error) || 'refus'} ». Annule-la dans le Seller Hub d'eBay.` }));
  };
  const bloc = (bord) => ({ background: E.card, border: `1px solid ${bord || E.border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 });
  const lienE = { flexShrink: 0, border: `1px solid ${E.border}`, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, color: E.text, background: 'transparent', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  const euroE = (v) => { const n = Number(v); return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : ''; };
  // ── CE QU'ON VOIT : le compte choisi, ou tous (9 octobre). Les alertes sont
  //    CALCULÉES sur tous les comptes (`dv`) ; on n'en montre ici que celles du
  //    compte affiché — et celles des autres comptes sont COMPTÉES, une ligne :
  //    une alerte qui disparaît sans un mot se lirait « réglé ». ────────────
  const dvVue = {
    aAnnulerEbay: dv.aAnnulerEbay.filter((d) => dansVue(d.annonce)),
    aRetirerEbay: dv.aRetirerEbay.filter((d) => dansVue(d.annonce)),
    aRetirerVinted: dv.aRetirerVinted.filter((d) => dansVue(d.commande)),
    nonReliees: dv.nonReliees.filter((a) => dansVue(a)),
  };
  const deuxComptesVue = surDeuxComptes.filter((d) => d.annonces.some((a) => dansVue(a)));
  const alertesAilleurs = (dv.aAnnulerEbay.length - dvVue.aAnnulerEbay.length) + (dv.aRetirerEbay.length - dvVue.aRetirerEbay.length) + (dv.aRetirerVinted.length - dvVue.aRetirerVinted.length) + (surDeuxComptes.length - deuxComptesVue.length);
  // Le compte d'une ligne, dit seulement quand la vue en MÉLANGE plusieurs (§7).
  const surCompte = (x) => (plusieursComptes && !vueSeule && x && x._compte) ? ` · ${nomCompteEbay(comptesEbay.find((c) => c.ref === x._compte) || { pseudo: x._pseudo })}` : '';
  // ── 1. ANTI DOUBLE VENTE — EN PREMIER, c'est le seul geste urgent ─────────
  const alertes = (<>
    {vueSeule && alertesAilleurs > 0 && (
      <div data-ebay-alertes-ailleurs={alertesAilleurs} style={{ ...bloc(E.warn), fontSize: 12.5, color: E.text, lineHeight: 1.5 }}>
        ⚠️ {alertesAilleurs} paire{alertesAilleurs > 1 ? 's' : ''} à régler sur tes autres comptes eBay (vendue{alertesAilleurs > 1 ? 's' : ''} ailleurs, encore en vente ou programmée{alertesAilleurs > 1 ? 's' : ''}) — choisis « Tous les comptes » en haut pour {alertesAilleurs > 1 ? 'les' : 'la'} voir.
      </div>
    )}
    {deuxComptesVue.length > 0 && (
      <div data-ebay-deux-comptes={deuxComptesVue.length} style={bloc(E.warn)}>
        <div style={{ fontSize: 14, fontWeight: 800, color: E.text }}>{deuxComptesVue.length} paire{deuxComptesVue.length > 1 ? 's' : ''} en vente sur deux de tes comptes eBay en même temps <Pourquoi>Deux personnes pourraient l'acheter, et tu n'en as qu'une. Retire l'une des deux annonces — VRM ne choisit pas laquelle à ta place.</Pourquoi></div>
        {deuxComptesVue.map((d) => (
          <div key={d.numero} data-ebay-deux-comptes-paire={d.numero} style={{ padding: '8px 0', borderTop: `1px solid ${E.border}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text }}>N°{d.numero} · {d.annonces[0].title || d.annonces[0].itemId}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 5 }}>
              {d.annonces.map((a) => <a key={a._compte + a.itemId} href={a.url || `https://www.ebay.fr/itm/${a.itemId}`} target="_blank" rel="noreferrer" data-ebay-deux-comptes-annonce={a._compte} style={lienE}>{nomCompteEbay((comptesEbay || []).find((c) => c.ref === a._compte) || { pseudo: a._pseudo })} ↗</a>)}
            </div>
          </div>
        ))}
      </div>
    )}
    {/* (5 octobre) PROGRAMMÉE sur eBay, VENDUE sur Vinted : eBay la mettra en
        ligne à l'heure dite si personne ne l'arrête. Identité par SKU (§5). */}
    {dvVue.aAnnulerEbay.length > 0 && (
      <div data-ebay-a-annuler={dvVue.aAnnulerEbay.length} style={bloc(E.warn)}>
        <div style={{ fontSize: 14, fontWeight: 800, color: E.text }}>{dvVue.aAnnulerEbay.length} paire{dvVue.aAnnulerEbay.length > 1 ? 's' : ''} vendue{dvVue.aAnnulerEbay.length > 1 ? 's' : ''} {ouVenduesTexte(dvVue.aAnnulerEbay)} — programmée{dvVue.aAnnulerEbay.length > 1 ? 's' : ''} sur eBay, à annuler</div>
        <Pourquoi>Sinon eBay {dvVue.aAnnulerEbay.length > 1 ? 'les' : 'la'} mettra en vente à l'heure prévue, et quelqu'un pourra l'acheter une deuxième fois. L'annulation par VRM n'est pas garantie : si eBay refuse, fais-le dans le Seller Hub.</Pourquoi>
        {dvVue.aAnnulerEbay.map((d) => {
          const id = String(d.annonce.itemId); const etat = annulations[id]; const t = Date.parse(d.annonce.debut || '');
          return (
            <div key={id} data-ebay-a-annuler-paire={d.numero} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
              <PhotoVente src={d.annonce.photo} size={44} />
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>N°{d.numero} · {d.annonce.title || id}</div>
                <div data-ebay-a-annuler-ou={d.ou || 'Vinted'} style={{ fontSize: 11, color: E.muted }}>{d.ou || 'Vinted'} : vendue · eBay : programmée{Number.isFinite(t) ? ` le ${quandParisTexte(t)}` : ''}{surCompte(d.annonce)}{(() => { const o = offreDeProgrammee(id); return o != null ? <span data-ebay-a-annuler-offre={o.toFixed(2)} style={{ color: E.warn }}> · elle part avec une règle d'offre (dès {eurEbay(o)})</span> : null; })()}</div>
                {etat && etat !== '…' && <div style={{ fontSize: 11, color: E.warn, marginTop: 2 }}>{etat} <a href={SELLER_HUB_PROGRAMMEES} target="_blank" rel="noreferrer" style={{ color: E.accentSoft, fontWeight: 700 }}>Seller Hub ↗</a></div>}
              </div>
              <button type="button" data-annuler-ebay={id} disabled={etat === '…'} onClick={() => annulerVendue(d)} style={{ ...lienE, opacity: etat === '…' ? 0.6 : 1 }}>{etat === '…' ? 'Demande à eBay…' : 'Annuler sa programmation'}</button>
            </div>
          );
        })}
      </div>
    )}
    {dvVue.aRetirerEbay.length > 0 && (
      <div data-ebay-a-retirer={dvVue.aRetirerEbay.length} style={bloc(E.warn)}>
        <div style={{ fontSize: 14, fontWeight: 800, color: E.text }}>{dvVue.aRetirerEbay.length} paire{dvVue.aRetirerEbay.length > 1 ? 's' : ''} vendue{dvVue.aRetirerEbay.length > 1 ? 's' : ''} sur Vinted — encore en vente sur eBay <Pourquoi>Retire-{dvVue.aRetirerEbay.length > 1 ? 'les' : 'la'} d'eBay, sinon quelqu'un peut l'acheter une deuxième fois. VRM te demande de confirmer : une annonce eBay terminée ne revient pas.</Pourquoi></div>
        {(() => {
          // Retrait automatique allumé : la raison commune à TOUTES les lignes se
          // dit une fois (§7) ; une raison qui distingue se dit sur sa ligne.
          if (!(autoJuge instanceof Map)) return null;
          const rs = dvVue.aRetirerEbay.map((d) => autoJuge.get(String(d.annonce.itemId)) || '');
          const r0 = rs[0];
          if (!(rs.length > 1 && r0 && r0 !== 'permis' && rs.every((x) => x === r0) && RAISON_RETRAIT_AUTO[r0])) return null;
          return <div data-ebay-auto-raison-commune={r0} style={{ fontSize: 11.5, color: E.muted, lineHeight: 1.45, margin: '0 0 4px' }}>Le retrait automatique ne {rs.length > 1 ? 'les' : 'la'} retire pas : {RAISON_RETRAIT_AUTO[r0]}.</div>;
        })()}
        {dvVue.aRetirerEbay.map((d, _i, tous) => {
          const id = String(d.annonce.itemId); const etat = retraits[id];
          const raison = autoJuge instanceof Map ? (autoJuge.get(id) || '') : null;
          const commune = autoJuge instanceof Map && tous.length > 1 && tous.every((x) => (autoJuge.get(String(x.annonce.itemId)) || '') === raison);
          const inc = autoIncertains && autoIncertains[id];
          return (
            <div key={id} data-ebay-doublon={d.numero} data-ebay-compte={d.annonce._compte || ''} {...(raison != null ? { 'data-ebay-auto-raison': raison } : {})} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
              <PhotoVente src={d.annonce.photo} size={44} />
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>N°{d.numero} · {d.annonce.title || id}</div>
                <div style={{ fontSize: 11, color: E.muted }}>Vinted : vendue · eBay : encore en vente{d.annonce.price ? ` à ${euroE(d.annonce.price)}` : ''}{surCompte(d.annonce)}{(() => { const k = regleEngage(etatDe(d.annonce)); return k ? <span data-ebay-doublon-regle={id} data-ebay-doublon-regle-k={k} style={{ color: E.warn, fontWeight: 700 }}>{k === 'oui' ? ' · elle a une règle d\'offre : eBay peut la vendre à tout moment' : ' · elle a peut-être une règle d\'offre chez eBay (pas relue) : eBay peut la vendre à tout moment'}</span> : null; })()}</div>
                {raison && raison !== 'permis' && !commune && RAISON_RETRAIT_AUTO[raison] && <div data-ebay-auto-raison-texte={raison} style={{ fontSize: 11, color: E.muted, marginTop: 2 }}>Pas retirée toute seule : {RAISON_RETRAIT_AUTO[raison]}.</div>}
                {inc && <div data-ebay-auto-incertain={id} style={{ fontSize: 11, color: E.warn, marginTop: 2 }}>Le retrait automatique du {new Date(inc.at).toLocaleDateString('fr-FR')} n'a pas eu de réponse claire d'eBay : regarde sur eBay avant de cliquer.</div>}
                {etat && etat !== '…' && <div data-ebay-retrait-erreur={id} style={{ fontSize: 11, color: E.warn, marginTop: 2 }}>{etat}</div>}
              </div>
              <button type="button" data-retirer-ebay={id} disabled={etat === '…'} onClick={() => retirer(d)} style={{ ...lienE, opacity: etat === '…' ? 0.6 : 1 }}>{etat === '…' ? 'Retrait…' : 'Retirer d\'eBay'}</button>
            </div>
          );
        })}
      </div>
    )}
    {dvVue.aRetirerVinted.length > 0 && (
      <div data-ebay-retirer-vinted={dvVue.aRetirerVinted.length} style={bloc(E.warn)}>
        <div style={{ fontSize: 14, fontWeight: 800, color: E.text }}>{dvVue.aRetirerVinted.length} paire{dvVue.aRetirerVinted.length > 1 ? 's' : ''} vendue{dvVue.aRetirerVinted.length > 1 ? 's' : ''} sur eBay — retire-{dvVue.aRetirerVinted.length > 1 ? 'les' : 'la'} de Vinted <Pourquoi>Sinon quelqu'un peut l'acheter une deuxième fois sur Vinted. VRM ne la retire pas de Vinted à ta place : là-bas, c'est sans retour.</Pourquoi></div>
        {dvVue.aRetirerVinted.map((d, i) => (
          <div key={String((d.commande && d.commande.orderId) || i) + d.numero} data-ebay-vendue={d.numero} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>N°{d.numero} · {(d.ligne && d.ligne.title) || titreDeNum.get(d.numero) || ''}</div>
              <div style={{ fontSize: 11, color: E.muted }}>
                eBay : {String((d.commande && d.commande.orderPaymentStatus) || '').toUpperCase() === 'PAID' ? 'payée' : 'achetée, paiement en attente'}
                {d.vendueVinted.length > 0 && <span style={{ color: E.warn, fontWeight: 700 }}> · vendue AUSSI sur Vinted : une des deux ventes ne pourra pas partir — annule-en une</span>}
              </div>
            </div>
            {d.surVinted[0] && <a href={'https://www.vinted.fr/items/' + d.surVinted[0]} target="_blank" rel="noreferrer" style={lienE}>Ouvrir sur Vinted</a>}
          </div>
        ))}
      </div>
    )}
    {/* Retrait automatique (proposition 8) — éteint par défaut, son choix.
        (11 octobre) Julien le croyait éteint : il était ALLUMÉ dans sa base.
        L'état se dit d'abord, en un mot, et ce qu'il fait EN SON NOM ; tant que
        le réglage n'est pas relu du nuage, on ne dit ni l'un ni l'autre (sur un
        appareil neuf, « éteint » serait un faux). On ne touche pas à SON choix. */}
    <div data-ebay-retrait-auto={!reglageAutoLu ? 'pas-lu' : retraitAuto ? 'allume' : 'eteint'} style={{ ...bloc(), display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: E.text }}>Retrait automatique d'eBay : <span data-ebay-retrait-etat={!reglageAutoLu ? 'pas-lu' : retraitAuto ? 'allume' : 'eteint'} style={{ fontWeight: 800 }}>{!reglageAutoLu ? '…' : retraitAuto ? 'ALLUMÉ' : 'ÉTEINT'}</span></div>
          <div data-ebay-retrait-auto-regle style={{ fontSize: 11.5, color: E.muted, lineHeight: 1.45 }}>{!reglageAutoLu
            ? 'Je relis ton réglage…'
            : retraitAuto
              ? 'VRM retire TOUT SEUL d\'eBay, sans te demander, une paire prouvée vendue sur Vinted dont l\'annonce porte le N° — dès que VRM est ouvert, sur n\'importe lequel de tes appareils. Une annonce eBay terminée ne revient pas : si la vente Vinted est annulée ensuite, il faudra la republier. Tu ne l\'as pas voulu ? « Éteindre ».'
              : 'VRM te montre les paires à retirer, c\'est toi qui cliques.'}</div>
        </div>
        <button type="button" data-ebay-retrait-auto-bouton disabled={!reglageAutoLu} onClick={basculerRetraitAuto} style={{ ...lienE, opacity: reglageAutoLu ? 1 : 0.5 }}>{retraitAuto ? 'Éteindre' : 'Allumer'}</button>
      </div>
      {Array.isArray(journalAuto) && journalAuto.length > 0 && (
        <div data-ebay-retraits-faits={journalAuto.length} style={{ fontSize: 11.5, color: E.muted, lineHeight: 1.5, borderTop: `1px solid ${E.border}`, paddingTop: 6 }}>
          Retirées en ton nom : {journalAuto.slice(0, 5).map((x) => `${x.sku || x.itemId}${x.titre ? ' · ' + x.titre : ''} (${new Date(x.at).toLocaleDateString('fr-FR')})`).join(' — ')}{journalAuto.length > 5 ? ` — et ${journalAuto.length - 5} autre${journalAuto.length - 5 > 1 ? 's' : ''}` : ''}
        </div>
      )}
      {journalAuto === null && retraitAuto && <div style={{ fontSize: 11.5, color: E.muted }}>Je n'ai pas pu relire la liste de ce qui a été retiré en ton nom — rouvre l'écran dans un moment.</div>}
    </div>
  </>);
  // ── 2. CE QUI N'A PAS PU ÊTRE LU, DIT UNE FOIS (§7) ────────────────────────
  // « Pas su » ne vaut pas « rien à retirer » : sans les ventes Vinted, une
  // paire vendue là-bas reste ici sans alerte — on le dit, avec ce que ça empêche.
  const relieesEbay = Array.isArray(items) && items.some((a) => a && numDeSkuEbay(a.sku));
  const skuCommandes = Array.isArray(commandes) && commandes.some((o) => o && Array.isArray(o.lineItems) && o.lineItems.some((li) => li && numDeSkuEbay(li.sku)));
  // (6 octobre) + les programmées : une paire vendue sur Leboncoin (ou Vinted)
  // et programmée ici ne lève l'alerte que si ses ventes ont été lues.
  const progReliees = listeProgrammees.some((p) => p && numDeSkuEbay(p.sku));
  const lbcPasSu = progReliees && (ventesLbc === null || ventesConnues.pasSu.includes('tes annonces Leboncoin'));
  // (revue du 11 octobre) Les ventes d'AUTRES comptes illisibles : la preuve
  // tient (elle ne dépend pas d'eux), mais la ligne « pas encore reliées » ne
  // peut pas être écrite — on nomme les comptes et ce que ça empêche, sinon
  // l'écran d'une panne est celui où tout est relié (§4.1).
  const nomCompte = (u) => { const a = (Array.isArray(comptes) ? comptes : []).find((x) => String(x && x.vinted_user_id) === String(u)); return (a && a.login) || `#${u}`; };
  const ventesKO = (relieesEbay || progReliees) && vendusVinted instanceof Set && sansPreuve === null && Array.isArray(sansPreuveKO) && sansPreuveKO.length
    ? sansPreuveKO.map(nomCompte) : [];
  const pasSu = [
    (relieesEbay || progReliees) && vendusVinted === null && 'tes ventes Vinted',
    ventesKO.length > 0 && `les ventes Vinted de ${ventesKO.join(', ')}`,
    commandes === null && 'tes ventes eBay',
    lbcPasSu && 'tes ventes Leboncoin',
    skuCommandes && enLigne === null && 'tes annonces Vinted',
  ].filter(Boolean);
  const effets = [
    (relieesEbay || progReliees) && vendusVinted === null && 'je ne peux pas te dire si une paire en vente ou programmée ici est déjà partie sur Vinted',
    ventesKO.length > 0 && `je ne peux pas te dire quelles ventes en cours ${ventesKO.length > 1 ? 'de ces comptes' : 'de ce compte'} ne sont pas encore reliées à leur annonce`,
    lbcPasSu && 'je ne peux pas te dire si une paire programmée ici est déjà vendue sur Leboncoin',
    (commandes === null || (skuCommandes && enLigne === null)) && 'je ne peux pas te dire si une paire vendue ici est encore en vente sur Vinted',
  ].filter(Boolean);
  const ligneComptesIllisibles = illisiblesAnnonces.filter((c) => dansVue({ _compte: c.ref })).length > 0 && (
    <div data-ebay-annonces-illisibles={illisiblesAnnonces.length} style={{ ...bloc(E.warn), fontSize: 12.5, color: E.text, lineHeight: 1.5 }}>
      ⚠️ Je n'ai pas pu lire les annonces {illisiblesAnnonces.length > 1 ? 'des comptes eBay' : 'du compte eBay'} {illisiblesAnnonces.map(nomCompteEbay).join(', ')} — rien n'est perdu, rouvre l'écran dans un moment. La liste ci-dessous ne {illisiblesAnnonces.length > 1 ? 'les' : 'le'} compte pas.
    </div>
  );
  const lignePasSu = pasSu.length > 0 && (
    <div data-ebay-pas-su={pasSu.length} style={{ ...bloc(E.warn), fontSize: 12.5, color: E.text, lineHeight: 1.5 }}>
      ⚠️ Je n'ai pas pu lire {pasSu.length === 1 ? pasSu[0] : pasSu.slice(0, -1).join(', ') + ' ni ' + pasSu[pasSu.length - 1]} — rien n'est perdu, rouvre l'écran dans un moment. En attendant, {effets.join(', et ')}.
    </div>
  );
  // ── 2 bis. LES VENTES VINTED QUE L'ANTI DOUBLE VENTE NE VOIT PAS (11 octobre)
  // Une vente EN COURS (à poster, en route) qu'aucune preuve ne relie à son
  // annonce — ni transaction rangée, ni bordereau. Si sa paire est aussi en
  // vente ici, VRM ne peut pas le dire : c'était la N°553 du 10 octobre. Dit UNE
  // fois (§7), chaque compte NOMMÉ (le geste se fait compte par compte), et le
  // geste suit l'extension de CE navigateur (`extSait`, trois états) — jamais
  // la promesse qu'elle le fera si elle ne sait pas le faire.
  const nSansPreuve = (relieesEbay || progReliees) && Array.isArray(sansPreuve) ? sansPreuve.length : 0;
  const ligneSansPreuve = nSansPreuve > 0 && (() => {
    const parCompte = new Map();
    for (const v of sansPreuve) parCompte.set(v.uid, (parCompte.get(v.uid) || 0) + 1);
    const nom = nomCompte;
    const noms = [...parCompte.entries()].map(([u, n]) => parCompte.size > 1 ? `${nom(u)} (${n})` : nom(u));
    const un = nSansPreuve === 1, ce = parCompte.size === 1 ? 'ce compte' : 'chacun de ces comptes';
    const cap = extSait('preuves');
    // ⚠️⚠️ (revue du 11 octobre) « ELLE LIT TOUTE SEULE » N'EST VRAI QUE SI ELLE
    //    PEUT ÉCRIRE : sans session VRM, la visite s'arrête avant de lire quoi que
    //    ce soit (`visite_sans_session`, prouvé dans le vm). La promesse ne se fait
    //    qu'à une extension connectée à CE compte VRM, ici, sur un ordinateur — la
    //    même règle que les annonces à confirmer (`connexionExtensionVrm`, §11) ;
    //    sinon on dit ce qui bloque, avec la phrase de l'indicateur
    //    (`raisonExtGlobale`) : une voix, pas deux.
    const ailleurs = cap === 'absente' || sansSouris;
    const blocage = cap === 'ok' && !ailleurs ? raisonExtGlobale(false, { cap: 'preuves', role: 'lit la transaction de tes ventes' }) : null;
    const promet = cap === 'ok' && !ailleurs && !blocage && connexionExtensionVrm() === 'ok';
    // Une ligne a son bouton « Générer le bordereau » seulement si elle est à
    // poster, SANS bordereau déjà rangé (un bordereau capté au téléchargement ne
    // porte pas l'annonce : « Générer » répondrait « déjà fait » et ne relierait
    // rien — l'écran Ventes, lui, dit « prêt à imprimer », §11), et sur un
    // ordinateur (au doigt, un bouton grisé n'explique rien).
    // ⚠️ Relecture croisée de la 5.174 : « ou génère son bordereau (bouton
    //    ci-dessous) » s'écrivait au-dessus d'un bouton GRISÉ — deux extensions
    //    (« je n'en envoie aucune » dans le même paragraphe), code périmé, autre
    //    compte VRM, pas connectée, et sa 5.164 d'aujourd'hui. Le bouton ne sert
    //    ici qu'à RELIER la vente : il n'est monté — et proposé — que si
    //    l'extension de ce navigateur peut recevoir la commande (la règle de
    //    l'indicateur, `raisonExtGlobale`, §11). Sinon : ouvrir la vente sur
    //    vinted.fr, et le bouton reste sur l'écran Ventes (grisé, avec sa raison).
    const commandePossible = raisonExtGlobale(sansSouris, { cap: 'commande' }) === null;
    const aBouton = (v) => commandePossible && !v.bordCapte && aExpedier({ status: v.statut, transaction_user_status: v.tus });
    const generer = sansPreuve.some(aBouton);
    // (revue du 11 octobre) LE CHIFFRE, PAS LA PROMESSE : l'extension n'en lit
    // que `PREUVE_PAR_VISITE` par visite et par compte (`PREUVE_MAX_PAR_VISITE`
    // dans background.js, comparé par audit-preuve-vente) — « à ta prochaine
    // visite » n'est vrai que si aucun compte n'en a plus.
    const plusParCompte = Math.max(...parCompte.values());
    const quand = plusParCompte > PREUVE_PAR_VISITE ? 'au fil de tes visites' : 'à ta prochaine visite';
    const ouvre = `ouvre ${un ? 'la vente' : 'chaque vente'} sur vinted.fr (lien${un ? '' : 's'} ci-dessous), connecté sur ${ce}`;
    const ouGenere = generer ? ` — ou génère ${un ? 'son' : 'leur'} bordereau depuis VRM (bouton ci-dessous) : un bordereau généré par VRM relie la vente` : '';
    const geste = promet
      ? `L'extension de ce navigateur lit ${un ? 'sa transaction' : 'leur transaction'} toute seule sur vinted.fr, connecté sur ${ce} — ${PREUVE_PAR_VISITE} par visite, donc ${quand}.`
      : ailleurs
        ? `Sur l'ordinateur où l'extension VRM est installée : passe sur vinted.fr connecté sur ${ce}, ou ouvre ${un ? 'la vente' : 'chaque vente'} (lien${un ? '' : 's'} ci-dessous) si l'extension n'est pas à jour.`
        : cap === 'retard'
          ? `L'extension installée ici ne va pas ${un ? 'la' : 'les'} chercher toute seule : mets-la à jour (${EXT_ATTENDUE}). En attendant, ${ouvre}${ouGenere}.`
          : `${blocage ? blocage.texte : 'Je vérifie que l\'extension de ce navigateur est connectée à ton compte VRM.'} Tant que ce n'est pas réglé, elle ne lit rien : ${ouvre}${ouGenere}.`;
    // (revue du 11 octobre) « Ouvre la conversation de chaque vente » sans dire
    // LAQUELLE : il a neuf comptes et des dizaines de ventes. Chaque vente est
    // nommée (son titre, sinon son n° de transaction), avec le lien vers SA
    // conversation (ou sa transaction) — et, si elle est à poster, son bouton
    // « Générer le bordereau » : un bordereau capté porte l'annonce (§5).
    const lienVente = (v) => v.conv ? `https://www.vinted.fr/inbox/${encodeURIComponent(v.conv)}` : `https://www.vinted.fr/member/transactions/${encodeURIComponent(v.tx)}`;
    return (
      <div data-ebay-ventes-sans-preuve={nSansPreuve} data-ebay-sans-preuve-geste={cap} data-ebay-sans-preuve-promesse={promet ? '1' : '0'} data-ebay-sans-preuve-blocage={blocage ? blocage.code : ''} style={{ ...bloc(), fontSize: 12.5, color: E.text, lineHeight: 1.5 }}>
        {/* (16 octobre, revue) Un titre court, une ligne de pourquoi, le geste ;
            puis une liste dont chaque ligne a la MÊME forme (titre à gauche, lien
            texte à droite) — avant, les liens étaient des boutons placés de deux
            façons selon la longueur du titre. */}
        <div style={{ fontSize: 13.5, fontWeight: 700, color: E.text }}>{nSansPreuve} vente{un ? '' : 's'} Vinted pas encore reliée{un ? '' : 's'} à {un ? 'son' : 'leur'} annonce <span style={{ fontWeight: 500, color: E.muted }}>· {noms.join(', ')}</span></div>
        <div style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, marginTop: 3 }}>Tant que ce n'est pas fait, VRM ne peut pas te dire de retirer {un ? 'sa' : 'leur'} paire d'eBay. {geste}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {sansPreuve.map((v) => (
            <div key={v.uid + ':' + v.tx} data-ebay-sans-preuve-vente={v.tx} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, minHeight: 44, borderTop: `1px solid ${E.border}` }}>
              <span style={{ flex: '1 1 0', minWidth: 0, fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.titre || `vente n° ${v.tx}`}{parCompte.size > 1 ? <span style={{ color: E.muted, fontWeight: 500 }}> · {nom(v.uid)}</span> : null}{v.bordCapte && <span data-ebay-sans-preuve-bord-capte={v.tx} style={{ color: E.muted, fontWeight: 500, fontSize: 11.5 }}> · bordereau déjà là (Ventes)</span>}</span>
              {aBouton(v) && (
                <BoutonBordereau uid={v.uid} tx={String(v.tx)} conv={v.conv} login={nom(v.uid)} aGenerer pdf={false} sansRepli onFait={() => setPreuveRelue((n) => n + 1)} />
              )}
              <a href={lienVente(v)} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 2px', fontSize: 12.5, fontWeight: 700, color: E.accentSoft, textDecoration: 'none', whiteSpace: 'nowrap' }}>ouvrir sur Vinted ↗</a>
            </div>
          ))}
        </div>
      </div>
    );
  })();
  if (baseKO) return wrap(<>{head()}<div style={{ color: E.muted, fontSize: 13, marginTop: 10 }}>Je n'ai pas pu lire tes données — rien n'est perdu, c'est la lecture qui a échoué. Réessaie dans un instant.</div></>);
  if (items === undefined) return wrap(<>{head()}{publier}{alertes}{lignePasSu}{ligneSansPreuve}{outils}<div style={{ color: E.muted, fontSize: 13, marginTop: 10 }}>Chargement…</div></>);
  if (items === null) return wrap(<>{head()}{publier}{alertes}{lignePasSu}{ligneSansPreuve}{outils}<div style={{ color: E.muted, fontSize: 13, marginTop: 10 }}>Je n'ai pas pu lire tes annonces eBay. Réessaie dans un instant.</div></>);
  // Les annonces du compte affiché (ou de tous) — l'union reste derrière pour
  // ce qui protège (`dv`, `pris`, `dejaSurEbay`).
  const itemsVue = items.filter((a) => dansVue(a));
  // ⚠️ Une paire VENDUE sur eBay sort de cette liste (l'annonce est terminée) :
  //    c'est justement quand il n'en reste aucune que « retire-la de Vinted »
  //    compte le plus. Les alertes passent donc AVANT ce cas.
  if (!itemsVue.length) return wrap(<>{head(0)}{publier}{alertes}{ligneComptesIllisibles}{lignePasSu}{ligneSansPreuve}{outils}<div style={{ color: E.muted, fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{vueSeule ? 'Pas d\'annonce en ligne sur ce compte eBay.' : 'Pas encore d\'annonce eBay en ligne.'} {connected === true ? 'Mets une paire en vente ci-dessus — elle apparaîtra ici.' : 'Connecte ton compte eBay (onglet « Compte eBay ») et synchronise.'}</div></>);
  // ── 4. L'OFFRE AUX OBSERVATEURS et les annonces pas reliées : une phrase
  //    chacune, au-dessus de la liste ; sur la carte, seulement le bouton ou la
  //    pastille, qui distinguent (§7). ─────────────────────────────────────────
  const elig = eligibles && eligibles.ids;
  const nElig = elig ? itemsVue.filter((a) => elig.has(String(a.itemId))).length : 0;
  const nSans = elig && eligibles.complet ? itemsVue.length - nElig : 0;
  // §7 : le compte se dit UNE fois quand toutes les annonces affichées sont sur
  // le même ; sur chaque carte seulement quand la liste en mélange plusieurs.
  const melangeAnnonces = plusieursComptes && new Set(itemsVue.map((a) => a && a._compte)).size > 1;
  const compteUnique = plusieursComptes && !melangeAnnonces && itemsVue[0] ? nomCompteEbay(comptesEbay.find((c) => c.ref === itemsVue[0]._compte) || { pseudo: itemsVue[0]._pseudo }) : '';
  // ── 5. LA RÈGLE D'OFFRE (9 octobre) — sur ce qu'on VOIT (`itemsVue`) ──────
  // Une ligne par carte (ce qui distingue), et au-dessus de la liste, UNE fois
  // chacun (§7) : ce que ça engage, ce qui n'a pas pu être lu, ce qui bloque.
  const etatsVue = new Map(itemsVue.map((it) => [cleAnnonce(it), etatDe(it)]));
  const etatVue = (it) => etatsVue.get(cleAnnonce(it)) || null;
  const connues = itemsVue.filter((it) => regleEngage(etatVue(it)) === 'oui');
  // (11 octobre, revue — tour 3) Celles où eBay tient PEUT-ÊTRE une règle (la
  // même règle que la relecture des ventes, `regleEngage`, §11) : elles
  // engagent autant, tant que VRM ne sait pas — le bloc les compte à part.
  const peutEtreRegle = itemsVue.filter((it) => regleEngage(etatVue(it)) === 'peut-etre');
  const vieillesRegles = connues.filter((it) => regleVieille(etatVue(it))).length;
  // La fenêtre des ventes : depuis quand VRM n'a pas relu les ventes eBay des
  // comptes qui ont une règle active — ou peut-être active (le plus ancien) —
  // eBay vend sans attendre.
  const refsRegle = [...new Set([...connues, ...peutEtreRegle].map((it) => it._compte || 'principal'))];
  const ventesAge = (() => {
    if (!refsRegle.length || ventesEbayLues === undefined) return { etat: 'en-cours' };
    if (!(ventesEbayLues instanceof Map)) return { etat: 'illisible' };
    const v = refsRegle.map((ref) => ventesEbayLues.has(ref) ? ventesEbayLues.get(ref) : undefined);
    if (v.some((x) => x === undefined)) return { etat: 'illisible' };
    if (v.some((x) => x == null)) return { etat: 'jamais' };
    return { etat: 'lu', h: Math.max(0, Math.floor((Date.now() - Math.min(...v)) / 3600000)) };
  })();
  const ventesVieilles = ventesAge.etat === 'jamais' || ventesAge.etat === 'illisible' || (ventesAge.etat === 'lu' && ventesAge.h > 6);
  const relireVentesEbay = async () => {
    if (relitVentes) return;
    setRelitVentes(true);
    const relies = Array.isArray(comptesStatut) ? new Set(comptesRelies.map((c) => c.ref)) : null;
    try{const issues=[];for(const ref of refsRegle)if(!relies || relies.has(ref))issues.push(await resync(ref));setRelectureRegles(issues.some(x=>!x?.ok)?'Les ventes eBay n’ont pas pu être relues sur tous les comptes. Les dernières données restent affichées.':'Ventes eBay actualisées.');}finally{setRelitVentes(false);}
  };
  // « Voir le retrait automatique » : il est PLUS HAUT (dans les alertes). On y
  // va, et on met le focus sur son bouton — rien n'est allumé ici (allumer
  // garde sa propre confirmation), aucune requête.
  const versRetraitAuto = () => {
    try {
      const reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const bloc0 = document.querySelector('[data-ebay-retrait-auto]');
      if (bloc0 && bloc0.scrollIntoView) bloc0.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'center' });
      const b = document.querySelector('[data-ebay-retrait-auto-bouton]');
      if (b) b.focus({ preventScroll: true });
    } catch (_) {}
  };
  // Les annonces dont la règle n'a pas pu être lue : la raison se dit ICI, une
  // fois (sur la carte elle serait la même partout, §7).
  const ORDRE_CAUSES_REGLE = ['illisible', 'jamais', 'prix-change', 'ancienne', 'offres-inconnues', 'lecture-ratee', 'apres-ecriture', 'incertain', 'en-cours', 'programmee', 'devise', 'pas-sur-ce-compte'];
  const pasSuRegle = itemsVue.filter((it) => { const e = etatVue(it); return e && e.etat === 'pas-su'; });
  const causesRegle = new Map();
  for (const it of pasSuRegle) { const r = etatVue(it).raison || 'jamais'; causesRegle.set(r, (causesRegle.get(r) || 0) + 1); }
  // ⚠️⚠️ (11 octobre, revue — tour 3) CHAQUE « pas su » AVEC SON GESTE, et
  // seulement le sien (`seRelitChezEbay` / `PAS_SU_SANS_RELECTURE`, §11) :
  //   · ce qu'une relecture chez eBay lève (jamais lue, prix changé, ancienne,
  //     lecture pas claire, programmée) ⇒ « Relire chez eBay » ;
  //   · seuil relu, offres activées ou non pas montré ⇒ le lien vers CHAQUE
  //     annonce (nommée), jamais un « regarde-les » sans lien ;
  //   · notre propre lecture ratée ⇒ « Réessayer » (relire VRM) — plus
  //     « Relire chez eBay », qui n'envoyait rien et répondait « rouvre l'écran » ;
  //   · une autre devise ⇒ dite, sans geste (VRM n'y pose pas de règle) ;
  //   · plus sur ce compte selon eBay ⇒ dite (l'écran relit déjà la liste).
  const relisablesRegle = pasSuRegle.filter((it) => seRelitChezEbay(etatVue(it)));
  const causesTexte = (() => {
    const n = (k) => relisablesRegle.filter((it) => (etatVue(it).raison || 'jamais') === k).length;
    const pasClaire = n('lecture-ratee') + n('apres-ecriture') + n('incertain') + n('en-cours');
    return [
      n('jamais') && `${n('jamais')} jamais lue${n('jamais') > 1 ? 's' : ''}`,
      n('prix-change') && `${n('prix-change')} au prix changé depuis la dernière lecture : la règle a pu tomber ou rester`,
      n('ancienne') && `${n('ancienne')} dont la dernière lecture a plus d'un mois`,
      pasClaire && `${pasClaire} dont la dernière lecture n'est pas claire`,
      n('programmee') && `${n('programmee')} partie${n('programmee') > 1 ? 's' : ''} avec une règle programmée, pas encore relue${n('programmee') > 1 ? 's' : ''}`,
    ].filter(Boolean).join(' · ');
  })();
  const risqueRegle = pasSuRegle.some((it) => etatVue(it).risque === true);
  // (11 octobre, revue) « Seuil relu, offres activées ou non pas montré » n'est
  // PAS « pas encore lue » : elle se dit à part, avec SON geste (regarder
  // l'annonce sur eBay), et « Relire chez eBay » ne s'affiche que s'il reste
  // une annonce vraiment pas lue (§11 : `PAS_SU_SANS_RELECTURE`).
  const offresInconnuesRegle = pasSuRegle.filter((it) => etatVue(it).raison === 'offres-inconnues');
  const nPasLueRegle = relisablesRegle.length;
  const nIllisibleRegle = causesRegle.get('illisible') || 0, nDeviseRegle = causesRegle.get('devise') || 0, nAbsenteRegle = causesRegle.get('pas-sur-ce-compte') || 0;
  const lienEbayDe = (it) => it.url || `https://www.ebay.fr/itm/${it.itemId}`;
  // « Réessayer » : relit ce que VRM a rangé (notre base) — jamais eBay.
  const relireBase = async () => {
    if (relitRegles || !comptesEbay) return;
    setRelitRegles(true);
    try { const RG = await lireReglesEbay(comptesEbay); setRegles(RG); setRelectureRegles(RG.illisibles.size ? 'VRM n\'arrive toujours pas à relire ce qu\'il sait de ces règles — rien n\'est perdu, réessaie dans un moment.' : ''); }
    finally { setRelitRegles(false); }
  };
  // Une paire dont la vente n'a pas pu être vérifiée : pas de règle d'offre
  // (dit UNE fois pour toutes les cartes reliées ; une paire vendue ou en
  // vente sur deux comptes se dit sur SA carte, parce que ça distingue).
  const bloqueCommun = (() => {
    const ks = itemsVue.filter((it) => numDeSkuEbay(it.sku)).map((it) => { const b = regleBloquee(it); return b && b.k; });
    if (ks.includes('pas-su')) return 'pas-su';
    if (ks.includes('en-cours')) return 'en-cours';
    return null;
  })();
  const pasSuVentes = [...new Set([...(Array.isArray(ventesConnues.pasSu) ? ventesConnues.pasSu : []), ...(vendusVinted === null ? ['tes ventes Vinted'] : [])])];
  const nonRelieesRegle = dvVue.nonReliees.filter((a) => !!regleEngage(etatDe(a))).length;
  const nonRelieesPeutEtre = dvVue.nonReliees.some((a) => regleEngage(etatDe(a)) === 'peut-etre');
  // (11 octobre) Pendant un lot, la porte est grisée : fermer le panneau
  // arrêtait le lot sans le dire (le bandeau n'apparaissait qu'au montage
  // suivant), la réponse en vol n'était jamais appliquée — la carte disait
  // « aucune règle » sur une annonce qu'eBay vendait dès le seuil — et les
  // cartes du lot restaient grisées. On arrête par « Arrêter », juste au-dessus,
  // qui fait un bilan.
  const lotEnCours = enLot.size > 0;
  const porteGrisee = regles === undefined || lotEnCours;
  const porteToutes = connected === true && itemsVue.length > 0 && (
    <button type="button" data-regles-toutes-ouvrir disabled={porteGrisee} onClick={() => setToutesOuvert((o) => !o)}
      style={{ ...lienE, opacity: porteGrisee ? 0.55 : 1, cursor: porteGrisee ? 'default' : 'pointer' }}>{regles === undefined ? 'Lecture des règles…' : (toutesOuvert ? 'Fermer « Une règle pour toutes »' : 'Une règle pour toutes')}</button>
  );
  const blocEngagement = (connues.length > 0 || peutEtreRegle.length > 0) && (
    <div data-regles-engagement={connues.length} data-regles-engagement-peut-etre={peutEtreRegle.length} style={{ ...bloc(E.warn), fontSize: 12.5, color: E.text, lineHeight: 1.5 }}>
      <div>
        {connues.length > 0
          ? <>Règle d'offre active sur <b>{connues.length} annonce{connues.length > 1 ? 's' : ''}</b>{peutEtreRegle.length > 0 ? <>, et <b>peut-être sur {peutEtreRegle.length} autre{peutEtreRegle.length > 1 ? 's' : ''}</b> (VRM ne l'a pas relue — dit plus bas)</> : null} : eBay accepte, sans te demander, toute offre à partir du montant fixé</>
          : <>eBay tient <b>peut-être une règle d'offre sur {peutEtreRegle.length} annonce{peutEtreRegle.length > 1 ? 's' : ''}</b> (VRM ne l'a pas relue — dit plus bas) : si elle y est, eBay accepte, sans te demander, toute offre à partir de son montant</>}
        {' '}— une offre acceptée est une vente, au prix de l'offre. En dessous, l'offre t'arrive sur eBay.{vieillesRegles > 0 ? ` Dont ${vieillesRegles} lue${vieillesRegles > 1 ? 's' : ''} il y a plus de 7 jours.` : ''}
      </div>
      <div data-regles-fenetre-ventes {...(ventesAge.etat === 'lu' ? { 'data-regles-ventes-age-h': String(ventesAge.h) } : {})} style={{ marginTop: 6, color: ventesVieilles ? E.warn : E.muted, fontSize: 12 }}>
        eBay vend sans attendre VRM : VRM ne voit cette vente qu'en relisant tes ventes eBay — {ventesAge.etat === 'lu' ? `dernière lecture il y a ${ventesAge.h < 1 ? 'moins d\'une heure' : (ventesAge.h < 48 ? `${ventesAge.h} h` : `${Math.floor(ventesAge.h / 24)} jours`)}` : (ventesAge.etat === 'jamais' ? 'pas encore lues' : (ventesAge.etat === 'illisible' ? 'je n\'ai pas pu savoir quand' : 'lecture en cours'))}.
        {' '}<button type="button" data-regles-relire-ventes disabled={relitVentes} onClick={relireVentesEbay} style={{ ...lienE, padding: '5px 9px', fontSize: 12, opacity: relitVentes ? 0.6 : 1 }}>{relitVentes ? 'Lecture…' : 'Relire mes ventes eBay'}</button>
      </div>
      <div data-regles-fenetre style={{ marginTop: 6, color: E.muted, fontSize: 12 }}>
        Si une de ces paires se vend sur Vinted, VRM ne la retire d'eBay que quand tu ouvres VRM et que la vente Vinted a été captée{retraitAuto ? '' : ' — et seulement si le retrait automatique est allumé : sinon c\'est toi qui cliques'}. Entre les deux, eBay peut encore accepter une offre ici.
      </div>
      {!retraitAuto && <div style={{ marginTop: 6 }}><button type="button" data-regles-vers-retrait onClick={versRetraitAuto} style={{ ...lienE, padding: '5px 9px', fontSize: 12 }}>Voir le retrait automatique</button></div>}
      {!pasSuRegle.length && porteToutes && <div style={{ marginTop: 8 }}>{porteToutes}</div>}
    </div>
  );
  const lienA = { color: E.accentSoft, fontWeight: 700, textDecoration: 'none' };
  const lignePasSuRegle = pasSuRegle.length > 0 && (
    <div data-regles-pas-su={pasSuRegle.length} data-regles-causes={ORDRE_CAUSES_REGLE.filter((k) => causesRegle.get(k)).map((k) => `${k}:${causesRegle.get(k)}`).join(',')}
      style={{ fontSize: 12, color: risqueRegle ? E.warn : E.muted, lineHeight: 1.5, margin: '0 2px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 220px', minWidth: 0 }}>
        {nPasLueRegle > 0 && `Règle d'offre pas encore lue pour ${nPasLueRegle} annonce${nPasLueRegle > 1 ? 's' : ''} (${causesTexte}).`}
        {offresInconnuesRegle.length > 0 && <span data-regles-offres-inconnues-ligne={offresInconnuesRegle.length}>{nPasLueRegle > 0 ? ' ' : ''}{offresInconnuesRegle.length === 1 ? '1 annonce' : `${offresInconnuesRegle.length} annonces`} où eBay montre ton seuil mais pas si les offres y sont activées : regarde-{offresInconnuesRegle.length > 1 ? 'les' : 'la'} sur eBay —{' '}
          {offresInconnuesRegle.map((it, i) => <React.Fragment key={cleAnnonce(it)}>{i > 0 ? ' · ' : ''}<a href={lienEbayDe(it)} target="_blank" rel="noreferrer" data-regles-offres-inconnues-lien={it.itemId} style={lienA}>{offresInconnuesRegle.length === 1 ? 'Voir sur eBay' : (it.title || it.itemId)} ↗</a></React.Fragment>)}.</span>}
        {nIllisibleRegle > 0 && <span data-regles-illisibles={nIllisibleRegle}>{(nPasLueRegle || offresInconnuesRegle.length) ? ' ' : ''}Je n'ai pas pu lire ce que VRM sait de la règle d'offre de {nIllisibleRegle === 1 ? '1 annonce' : `${nIllisibleRegle} annonces`} — rien n'est perdu, c'est la lecture de VRM qui a échoué.</span>}
        {nDeviseRegle > 0 && <span data-regles-devise={nDeviseRegle}>{(nPasLueRegle || offresInconnuesRegle.length || nIllisibleRegle) ? ' ' : ''}{nDeviseRegle === 1 ? '1 annonce' : `${nDeviseRegle} annonces`} dans une autre devise que l'euro : VRM n'y pose pas de règle d'offre.</span>}
        {nAbsenteRegle > 0 && <span data-regles-absentes={nAbsenteRegle}>{(nPasLueRegle || offresInconnuesRegle.length || nIllisibleRegle || nDeviseRegle) ? ' ' : ''}{nAbsenteRegle === 1 ? '1 annonce' : `${nAbsenteRegle} annonces`} qu'eBay ne montre plus en vente sur ce compte (terminée, vendue ou déplacée).</span>}
      </span>
      {nPasLueRegle > 0 && <button type="button" data-regles-relire disabled={relitRegles || comptesStatut === undefined} onClick={() => relireRegles(relisablesRegle)}
        style={{ ...lienE, padding: '5px 9px', fontSize: 12, opacity: (relitRegles || comptesStatut === undefined) ? 0.55 : 1 }}>{relitRegles ? 'Lecture…' : 'Relire chez eBay'}</button>}
      {nIllisibleRegle > 0 && <button type="button" data-regles-relire-base disabled={relitRegles} onClick={relireBase}
        style={{ ...lienE, padding: '5px 9px', fontSize: 12, opacity: relitRegles ? 0.55 : 1 }}>{relitRegles ? 'Lecture…' : 'Réessayer'}</button>}
      {porteToutes}
    </div>
  );
  return wrap(<>
    {head(itemsVue.length)}
    <div className="vrm-plat-intro" style={{ color: E.muted, fontSize: 12, marginBottom: 12 }}>{compteUnique ? `Sur ton compte eBay ${compteUnique} — ` : (melangeAnnonces ? `Sur tes ${new Set(itemsVue.map((a) => a._compte)).size} comptes eBay — ` : 'Tes annonces en ligne sur eBay — ')}touche une annonce pour la modifier</div>
    {publier}
    {alertes}
    {ligneComptesIllisibles}
    {lignePasSu}
    {ligneSansPreuve}
    {blocEngagement}
    {lignePasSuRegle}
    {!blocEngagement && !lignePasSuRegle && porteToutes && <div style={{ margin: '0 2px 10px' }}>{porteToutes}</div>}
    {relectureRegles && <div data-regles-relecture style={{ fontSize: 12, color: E.warn, lineHeight: 1.5, margin: '0 2px 10px' }}>{relectureRegles}</div>}
    {bloqueCommun && (
      <div data-regles-bloquees-commun={bloqueCommun} style={{ fontSize: 12, color: bloqueCommun === 'pas-su' ? E.warn : E.muted, lineHeight: 1.5, margin: '0 2px 10px' }}>
        {bloqueCommun === 'pas-su'
          ? `Je n'ai pas pu vérifier ${pasSuVentes.length <= 1 ? (pasSuVentes[0] || 'tes ventes') : pasSuVentes.slice(0, -1).join(', ') + ' ni ' + pasSuVentes[pasSuVentes.length - 1]} : pas de règle d'offre tant que je ne sais pas si la paire est déjà vendue.`
          : 'Je vérifie encore que tes paires ne sont pas déjà vendues (Vinted, eBay, Leboncoin) : la règle d\'offre attend cette vérification.'}
      </div>
    )}
    {lotInterrompu && (
      <div data-regles-lot-interrompu={lotInterrompu.n} style={{ ...bloc(E.warn), fontSize: 12.5, color: E.text, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ flex: 1, minWidth: 0 }}>Le dernier lot a été interrompu : {lotInterrompu.n} annonce{lotInterrompu.n > 1 ? 's' : ''} non envoyée{lotInterrompu.n > 1 ? 's' : ''}. Rouvre « Une règle pour toutes » pour {lotInterrompu.n > 1 ? 'les' : 'la'} reprendre.</span>
        <button className="vrm-icon-control" type="button" data-regles-lot-interrompu-fermer aria-label="Effacer ce message" onClick={() => { try { sessionStorage.removeItem('vrm_regles_lot_interrompu'); } catch (_) {} setLotInterrompu(null); }} style={{ ...lienE, padding: '4px 9px' }}>✕</button>
      </div>
    )}
    {toutesOuvert && connected === true && regles !== undefined && (
      <EbayReglesToutes items={itemsVue} etatDe={etatDe} prixDe={prixDe} regleBloquee={regleBloquee} achats={achats} nomRef={nomRef}
        plusieursComptes={melangeAnnonces} relit={relitRegles} onRelire={relireRegles} onRelireBase={relireBase}
        onLot={(ids) => setEnLot(new Set(ids))} onRegle={surRegle} onInterrompu={(v) => setLotInterrompu(v)}
        onDebut={() => { setLotInterrompu(null); try { sessionStorage.removeItem('vrm_regles_lot_interrompu'); } catch (_) {} }}
        onFini={async () => { if (comptesEbay) { const RG = await lireReglesEbay(comptesEbay); setRegles(RG); } }} />
    )}
    <div className="vrm-ebay-liste" style={{ background: E.card, border: `1px solid ${E.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {itemsVue.map((it, i) => {
        const n = numEbayLu(it.sku, it.itemId, null, it.depuis);
        const cle = cleAnnonce(it);
        return (
          <div key={(it._compte || '') + (it.itemId || i)} data-ebay-annonce={it.itemId || ''} data-ebay-compte={it._compte || ''}>
            <EbayAnnonceCard it={it} first={i === 0} onSaved={() => resync(it._compte)} compteNom={melangeAnnonces ? nomCompteEbay(comptesEbay.find((c) => c.ref === it._compte) || { pseudo: it._pseudo }) : ''}
              numero={n}
              eligible={elig ? (elig.has(String(it.itemId)) ? true : (eligibles.complet ? false : undefined)) : undefined}
              paires={paires} numsConnus={numsConnus} titreDeNum={titreDeNum} pris={pris}
              onSku={(id, sku) => { surSku(id, sku); resync(); }}
              onOffre={() => chargerEligibles()}
              regle={etatVue(it)} bloquee={regleBloquee(it)} achat={n && achats.has(n) ? achats.get(n) : undefined}
              onRegle={surRegle} enLot={enLot.has(String(it.itemId))} prixAffiche={prixLocaux.has(cle) ? prixLocaux.get(cle) : undefined}
              nomCompteConfirm={plusieursComptes ? nomRef(it._compte || 'principal') : ''} onRelire={()=>relireRegles([it],true)}/>
          </div>
        );
      })}
    </div>
    <div className="vrm-ebay-suite">
    {nSans > 0 && (
      <div className="vrm-plat-note" data-ebay-sans-observateur={nSans} style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, margin: '0 2px 8px' }}>
        {nElig ? `Offre aux observateurs possible sur ${nElig} annonce${nElig > 1 ? 's' : ''} · ` : ''}pas d'observateur à qui l'envoyer pour {nElig ? (nSans === 1 ? "l'autre" : `les ${nSans} autres`) : (nSans === 1 ? 'cette annonce' : `ces ${nSans} annonces`)} pour l'instant.
      </div>
    )}
    {dvVue.nonReliees.length > 0 && (
      <div className="vrm-plat-note" data-ebay-non-reliees={dvVue.nonReliees.length} style={{ fontSize: 12, color: E.muted, lineHeight: 1.5, margin: '0 2px 10px' }}>
        <b style={{ color: E.text }}>{dvVue.nonReliees.length} annonce{dvVue.nonReliees.length > 1 ? 's' : ''} pas reliée{dvVue.nonReliees.length > 1 ? 's' : ''} à une paire</b>{nonRelieesRegle > 0 ? <span data-ebay-non-reliees-regles={nonRelieesRegle} style={{ color: E.warn }}> — {nonRelieesRegle} avec{nonRelieesPeutEtre ? ' peut-être' : ''} une règle d'offre : si eBay en vend une, VRM ne saura pas laquelle retirer de Vinted</span> : null} <Pourquoi>Sans ce lien, VRM ne peut pas te dire de {dvVue.nonReliees.length > 1 ? 'les' : 'la'} retirer d'ici quand la paire se vend sur Vinted. « Relier à une paire » sur sa carte — c'est toi qui choisis.{dvVue.nonReliees.some(skuEbayDouteux) ? ' Une annonce marquée « à vérifier » porte une référence VRM dont le numéro a été redonné depuis (panne du 18 octobre) ou est porté par deux paires : VRM ne la compte plus, ni comme « en vente », ni pour le retrait automatique, tant que tu ne l\'as pas reliée.' : ''}</Pourquoi>
      </div>
    )}
      {outilsSuite}
    </div>
  </>);
}

export { EbayAnnonces, EbayConnexion };
