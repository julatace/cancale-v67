// ════════════════════════════════════════════════════════════════════════════
//  « DÉPOSER N SUR VINTED » — LES BROUILLONS PRÉPARÉS DANS VRM (ext. 5.429, 21 nov. — `depotpanneau`)
//
//  Julien (21 nov., point 61) : il prépare ses fiches dans VRM (photos, titre, description, marque, taille, état,
//  couleurs, colis, prix) ; le lendemain il ouvre le panneau sur vinted.fr, coche, choisit « Brouillon Vinted » ou
//  « Publier » pour le lot, et confirme. Ce fichier est la VUE du panneau (rien n'écrit d'ici) : la liste lue par le
//  fond (`depotFiches`), le récapitulatif, puis la frise de chaque fiche — chaque étape « faite » SEULEMENT sur SA
//  preuve datée par le fond (photos acceptées par la page, formulaire rempli, brouillon relu, ordre des photos relu,
//  N° lié, en ligne) ; la première sans preuve est « en cours », ou en ambre « arrêtée ici ». L'avant / après : la
//  fiche contre ce que la page de Vinted a relu, champ par champ.
//  Rien ne part sans SON toucher (« Confirmer le dépôt ») ; le fond refait toutes les gardes.
//  Composants communs (`VRM_UI` : vu-plaque, vu-btn, vu-seg, vu-n, vu-barre) ; la petite feuille ci-dessous ne pose
//  aucun style en ligne. Textes en 5 langues.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.VRM_DEPOT) return;
  const UI = globalThis.VRM_UI || null;
  const esc = UI ? UI.esc : (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LANGUE = UI ? UI.langue() : 'fr';
  const MOTS = {
    titre: { fr: 'Brouillons préparés', en: 'Prepared drafts', es: 'Borradores preparados', it: 'Bozze preparate', de: 'Vorbereitete Entwürfe' },
    pret1: { fr: '1 prête dans VRM', en: '1 ready in VRM', es: '1 lista en VRM', it: '1 pronta in VRM', de: '1 bereit in VRM' },
    pretN: { fr: '{n} prêtes dans VRM', en: '{n} ready in VRM', es: '{n} listas en VRM', it: '{n} pronte in VRM', de: '{n} bereit in VRM' },
    aucune: { fr: 'Aucune fiche préparée. Prépare-les dans VRM (Annonces → À publier → Préparer).', en: 'No prepared listing. Prepare them in VRM (Listings → To publish → Prepare).', es: 'Ninguna ficha preparada. Prepáralas en VRM (Anuncios → Por publicar → Preparar).', it: 'Nessuna scheda preparata. Preparale in VRM (Annunci → Da pubblicare → Prepara).', de: 'Keine vorbereitete Karte. Bereite sie in VRM vor (Anzeigen → Zu veröffentlichen → Vorbereiten).' },
    aPrep1: { fr: '1 autre fiche à préparer dans VRM', en: '1 more to prepare in VRM', es: '1 más por preparar en VRM', it: 'un’altra da preparare in VRM', de: '1 weitere in VRM vorzubereiten' },
    aPrepN: { fr: '{n} autres fiches à préparer dans VRM', en: '{n} more to prepare in VRM', es: '{n} más por preparar en VRM', it: 'altre {n} da preparare in VRM', de: '{n} weitere in VRM vorzubereiten' },
    lecture: { fr: 'Je lis tes fiches préparées…', en: 'Reading your prepared listings…', es: 'Leyendo tus fichas preparadas…', it: 'Leggo le tue schede preparate…', de: 'Vorbereitete Karten werden gelesen…' },
    modeBrouillon: { fr: 'Brouillon Vinted', en: 'Vinted draft', es: 'Borrador de Vinted', it: 'Bozza Vinted', de: 'Vinted-Entwurf' },
    modePublier: { fr: 'Publier', en: 'Publish', es: 'Publicar', it: 'Pubblica', de: 'Veröffentlichen' },
    modeLib: { fr: 'Pour ce lot', en: 'For this batch', es: 'Para este lote', it: 'Per questo lotto', de: 'Für diesen Stapel' },
    deposer: { fr: 'Déposer {n} sur Vinted', en: 'Post {n} on Vinted', es: 'Publicar {n} en Vinted', it: 'Deposita {n} su Vinted', de: '{n} auf Vinted einstellen' },
    cocher: { fr: 'Choisir la fiche N°{n}', en: 'Choose listing No. {n}', es: 'Elegir la ficha N.º {n}', it: 'Scegli la scheda N. {n}', de: 'Karte Nr. {n} wählen' },
    photo1: { fr: '1 photo', en: '1 photo', es: '1 foto', it: '1 foto', de: '1 Foto' },
    photoN: { fr: '{n} photos', en: '{n} photos', es: '{n} fotos', it: '{n} foto', de: '{n} Fotos' },
    prete: { fr: 'Prête', en: 'Ready', es: 'Lista', it: 'Pronta', de: 'Bereit' },
    manque: { fr: 'Manque : {l}', en: 'Missing: {l}', es: 'Falta: {l}', it: 'Manca: {l}', de: 'Fehlt: {l}' },
    aFinir: { fr: 'À finir sur Vinted : {l}', en: 'To finish on Vinted: {l}', es: 'Por terminar en Vinted: {l}', it: 'Da finire su Vinted: {l}', de: 'Auf Vinted fertigstellen: {l}' },
    deja: { fr: 'Déjà sur Vinted ({e})', en: 'Already on Vinted ({e})', es: 'Ya en Vinted ({e})', it: 'Già su Vinted ({e})', de: 'Schon auf Vinted ({e})' },
    eBrouillon: { fr: 'brouillon', en: 'draft', es: 'borrador', it: 'bozza', de: 'Entwurf' },
    eEnLigne: { fr: 'en ligne', en: 'online', es: 'en línea', it: 'online', de: 'online' },
    recap1: { fr: 'Déposer 1 fiche sur Vinted', en: 'Post 1 listing on Vinted', es: 'Publicar 1 ficha en Vinted', it: 'Deposita 1 scheda su Vinted', de: '1 Karte auf Vinted einstellen' },
    recapN: { fr: 'Déposer {n} fiches sur Vinted', en: 'Post {n} listings on Vinted', es: 'Publicar {n} fichas en Vinted', it: 'Deposita {n} schede su Vinted', de: '{n} Karten auf Vinted einstellen' },
    recapMode: { fr: 'Mode : {m}', en: 'Mode: {m}', es: 'Modo: {m}', it: 'Modalità: {m}', de: 'Modus: {m}' },
    recapRythme: { fr: 'Une à la fois, 1 à 3 min au hasard entre deux — environ {d} en tout.', en: 'One at a time, 1 to 3 min at random between two — about {d} in all.', es: 'Una a la vez, de 1 a 3 min al azar entre dos — unos {d} en total.', it: 'Una alla volta, da 1 a 3 min a caso tra due — circa {d} in tutto.', de: 'Eine nach der anderen, 1 bis 3 Min. zufällig dazwischen — etwa {d} insgesamt.' },
    recapForm: { fr: 'VRM remplit le formulaire de Vinted dans l’onglet de travail, relit chaque brouillon contre ta fiche, vérifie l’ordre des photos et pose le N°.', en: 'VRM fills Vinted’s form in the work tab, checks each draft against your listing, checks the photo order and sets the No.', es: 'VRM rellena el formulario de Vinted en la pestaña de trabajo, compara cada borrador con tu ficha, verifica el orden de las fotos y pone el N.º.', it: 'VRM compila il modulo di Vinted nella scheda di lavoro, rilegge ogni bozza con la tua scheda, verifica l’ordine delle foto e mette il N.', de: 'VRM füllt das Vinted-Formular im Arbeitstab aus, prüft jeden Entwurf gegen deine Karte, prüft die Fotoreihenfolge und setzt die Nr.' },
    recapPublier: { fr: 'En ligne seulement si rien ne manque ; sinon VRM s’arrête avant « Publier » et dit ce qui manque.', en: 'Published only if nothing is missing; otherwise VRM stops before “Publish” and says what is missing.', es: 'Publicada solo si no falta nada; si no, VRM se detiene antes de «Publicar» y dice lo que falta.', it: 'Pubblicata solo se non manca nulla; altrimenti VRM si ferma prima di «Pubblica» e dice cosa manca.', de: 'Nur veröffentlicht, wenn nichts fehlt; sonst stoppt VRM vor „Veröffentlichen“ und sagt, was fehlt.' },
    recapRien: { fr: 'Rien ne part avant « Confirmer le dépôt ». Garde cet onglet Vinted ouvert ; tu peux tout arrêter à tout moment.', en: 'Nothing is sent before “Confirm”. Keep this Vinted tab open; you can stop at any time.', es: 'Nada sale antes de «Confirmar». Deja abierta esta pestaña de Vinted; puedes parar en cualquier momento.', it: 'Nulla parte prima di «Conferma». Tieni aperta questa scheda Vinted; puoi fermare tutto in qualsiasi momento.', de: 'Nichts wird vor „Bestätigen“ gesendet. Lass diesen Vinted-Tab offen; du kannst jederzeit stoppen.' },
    confirmer: { fr: 'Confirmer le dépôt', en: 'Confirm', es: 'Confirmar', it: 'Conferma', de: 'Bestätigen' },
    retour: { fr: 'Retour', en: 'Back', es: 'Volver', it: 'Indietro', de: 'Zurück' },
    envoi: { fr: 'Envoi…', en: 'Sending…', es: 'Enviando…', it: 'Invio…', de: 'Wird gesendet…' },
    lotCours: { fr: 'Dépôt en cours · {f} sur {n}', en: 'Posting · {f} of {n}', es: 'Publicando · {f} de {n}', it: 'Deposito in corso · {f} di {n}', de: 'Wird eingestellt · {f} von {n}' },
    lotFini: { fr: 'Dépôt fini · {f} sur {n} déposées', en: 'Done · {f} of {n} posted', es: 'Terminado · {f} de {n} publicadas', it: 'Finito · {f} di {n} depositate', de: 'Fertig · {f} von {n} eingestellt' },
    lotArrete: { fr: 'Dépôt arrêté · {f} sur {n} déposées', en: 'Stopped · {f} of {n} posted', es: 'Detenido · {f} de {n} publicadas', it: 'Fermato · {f} di {n} depositate', de: 'Gestoppt · {f} von {n} eingestellt' },
    prochain: { fr: 'La suivante vers {h}', en: 'Next around {h}', es: 'La siguiente hacia las {h}', it: 'La prossima verso le {h}', de: 'Die nächste gegen {h}' },
    arreter: { fr: 'Arrêter le dépôt', en: 'Stop posting', es: 'Detener', it: 'Ferma il deposito', de: 'Einstellen stoppen' },
    fermerBilan: { fr: 'Fermer le bilan', en: 'Close the summary', es: 'Cerrar el resumen', it: 'Chiudi il riepilogo', de: 'Übersicht schließen' },
    voirVinted: { fr: 'Voir sur Vinted', en: 'See on Vinted', es: 'Ver en Vinted', it: 'Vedi su Vinted', de: 'Auf Vinted ansehen' },
    avantApres: { fr: 'Avant / après', en: 'Before / after', es: 'Antes / después', it: 'Prima / dopo', de: 'Vorher / nachher' },
    colFiche: { fr: 'Ta fiche', en: 'Your listing', es: 'Tu ficha', it: 'La tua scheda', de: 'Deine Karte' },
    colRelu: { fr: 'Relu chez Vinted', en: 'Read back on Vinted', es: 'Leído en Vinted', it: 'Riletto su Vinted', de: 'Bei Vinted gelesen' },
    ok: { fr: 'pareil', en: 'same', es: 'igual', it: 'uguale', de: 'gleich' },
    ecart: { fr: 'écart', en: 'differs', es: 'diferente', it: 'diverso', de: 'abweichend' },
    aFinirC: { fr: 'à finir', en: 'to finish', es: 'por terminar', it: 'da finire', de: 'fertigstellen' },
    pasRelu: { fr: 'pas relu', en: 'not read back', es: 'no leído', it: 'non riletto', de: 'nicht gelesen' },
    attente: { fr: 'En attente', en: 'Waiting', es: 'En espera', it: 'In attesa', de: 'Wartet' },
    e_photos: { fr: 'Photos', en: 'Photos', es: 'Fotos', it: 'Foto', de: 'Fotos' },
    e_formulaire: { fr: 'Formulaire', en: 'Form', es: 'Formulario', it: 'Modulo', de: 'Formular' },
    e_brouillon: { fr: 'Brouillon relu', en: 'Draft checked', es: 'Borrador revisado', it: 'Bozza riletta', de: 'Entwurf geprüft' },
    e_ordre: { fr: 'Ordre des photos', en: 'Photo order', es: 'Orden de fotos', it: 'Ordine foto', de: 'Fotoreihenfolge' },
    e_ordrePasSu: { fr: 'Ordre pas relu', en: 'Order not read', es: 'Orden no leído', it: 'Ordine non riletto', de: 'Reihenfolge nicht gelesen' },
    e_numero: { fr: 'N° posé', en: 'No. set', es: 'N.º puesto', it: 'N. messo', de: 'Nr. gesetzt' },
    e_enLigne: { fr: 'En ligne', en: 'Online', es: 'En línea', it: 'Online', de: 'Online' },
    etapeFaite: { fr: 'fait', en: 'done', es: 'hecho', it: 'fatto', de: 'erledigt' },
    etapeCours: { fr: 'en cours', en: 'in progress', es: 'en curso', it: 'in corso', de: 'läuft' },
    etapeArret: { fr: 'arrêtée ici', en: 'stopped here', es: 'detenida aquí', it: 'fermata qui', de: 'hier gestoppt' },
    c_photos: { fr: 'Photos', en: 'Photos', es: 'Fotos', it: 'Foto', de: 'Fotos' }, c_titre: { fr: 'Titre', en: 'Title', es: 'Título', it: 'Titolo', de: 'Titel' },
    c_description: { fr: 'Description', en: 'Description', es: 'Descripción', it: 'Descrizione', de: 'Beschreibung' }, c_categorie: { fr: 'Catégorie', en: 'Category', es: 'Categoría', it: 'Categoria', de: 'Kategorie' },
    c_marque: { fr: 'Marque', en: 'Brand', es: 'Marca', it: 'Marca', de: 'Marke' }, c_taille: { fr: 'Taille', en: 'Size', es: 'Talla', it: 'Taglia', de: 'Größe' },
    c_etat: { fr: 'État', en: 'Condition', es: 'Estado', it: 'Condizioni', de: 'Zustand' }, c_couleurs: { fr: 'Couleurs', en: 'Colours', es: 'Colores', it: 'Colori', de: 'Farben' },
    c_colis: { fr: 'Colis', en: 'Parcel', es: 'Paquete', it: 'Pacco', de: 'Paket' }, c_prix: { fr: 'Prix', en: 'Price', es: 'Precio', it: 'Prezzo', de: 'Preis' },
    m_photos: { fr: 'les photos', en: 'photos', es: 'las fotos', it: 'le foto', de: 'Fotos' }, m_titre: { fr: 'le titre', en: 'title', es: 'el título', it: 'il titolo', de: 'Titel' },
    m_description: { fr: 'la description', en: 'description', es: 'la descripción', it: 'la descrizione', de: 'Beschreibung' }, m_categorie: { fr: 'la catégorie', en: 'category', es: 'la categoría', it: 'la categoria', de: 'Kategorie' },
    m_marque: { fr: 'la marque', en: 'brand', es: 'la marca', it: 'la marca', de: 'Marke' }, m_taille: { fr: 'la taille', en: 'size', es: 'la talla', it: 'la taglia', de: 'Größe' },
    m_etat: { fr: 'l’état', en: 'condition', es: 'el estado', it: 'le condizioni', de: 'Zustand' }, m_couleurs: { fr: 'la couleur', en: 'colour', es: 'el color', it: 'il colore', de: 'Farbe' },
    m_colis: { fr: 'le colis', en: 'parcel', es: 'el paquete', it: 'il pacco', de: 'Paket' }, m_prix: { fr: 'le prix', en: 'price', es: 'el precio', it: 'il prezzo', de: 'Preis' },
    variable: { fr: 'la variable {v} n’a pas de valeur', en: 'variable {v} has no value', es: 'la variable {v} no tiene valor', it: 'la variabile {v} non ha valore', de: 'Variable {v} hat keinen Wert' },
  };
  const T = (cle, vars) => { const m = MOTS[cle]; const s = m ? (m[LANGUE] || m.fr) : String(cle); return vars ? String(s).replace(/\{(\w+)\}/g, (x, k) => (k in vars ? String(vars[k]) : x)) : s; };
  const pluriel = (n, un, plusieurs) => T(Number(n) === 1 ? un : plusieurs, { n });
  const euros = (n) => { const x = Number(n); if (!(x > 0)) return ''; const c = Math.round(x * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; };
  const heure = (t) => { try { return new Date(Number(t)).toLocaleTimeString(LANGUE, { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const etiquette = (n) => (UI && UI.etiquette ? UI.etiquette(n) : `<span class="vu-n"><small>N°</small>${esc(n)}</span>`);
  // La feuille du dépôt (dans la racine du panneau) : aucune couleur propre, les jetons `--vu-*` seulement.
  const CSS = `
  .dp { margin: 0 0 12px; padding: 4px 0; }
  .dp-tete { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 4px 14px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .dp-tete b { font-weight: 650; }
  .dp-tete .dp-sous { flex: 1; min-width: 0; color: var(--vu-muet); font-size: 13px; }
  .dp-tete .dp-chev { color: var(--vu-muet); }
  .dp-liste { list-style: none; margin: 0; padding: 0; }
  .dp-r { display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 8px 14px; border-top: .5px solid var(--vu-filet); }
  .dp-r[data-depot-pret="non"] { opacity: .72; }
  .dp-case { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: -6px; flex: none; }
  .dp-case input { width: 20px; height: 20px; accent-color: var(--vu-barre); }
  .dp-txt { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .dp-txt b { font-weight: 600; overflow-wrap: anywhere; }
  .dp-txt small { color: var(--vu-muet); font-size: 13px; }
  .dp-txt small[data-ton="ambre"] { color: var(--vu-ambre); }
  .dp-mode { display: grid; gap: 6px; padding: 10px 14px; border-top: .5px solid var(--vu-filet); }
  .dp-mode > span { color: var(--vu-muet); font-size: 13px; }
  .dp-pied { display: grid; gap: 8px; padding: 10px 14px 6px; }
  .dp-note { margin: 0; padding: 0 14px 8px; color: var(--vu-muet); font-size: 13px; }
  .dp-err { margin: 0; padding: 8px 14px; color: var(--vu-ambre); font-size: 13px; }
  .dp-recap { display: grid; gap: 8px; padding: 6px 14px 4px; }
  .dp-recap h3 { margin: 0; font-size: 17px; font-weight: 650; }
  .dp-recap p { margin: 0; color: var(--vu-muet); font-size: 14px; }
  .dp-recap p b { color: var(--vu-encre); }
  .dp-lot { list-style: none; margin: 0; padding: 0; }
  .dp-lot > li { display: grid; gap: 8px; padding: 10px 14px; border-top: .5px solid var(--vu-filet); }
  .dp-lot-t { display: flex; align-items: center; gap: 10px; }
  .dp-lot-t b { flex: 1; min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
  .dp-frise { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .dp-frise li { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; font-size: 13px; color: var(--vu-muet); }
  .dp-frise i { display: inline-block; width: 12px; height: 12px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px currentColor; flex: none; }
  .dp-frise li[data-etat="fait"] { color: var(--vu-encre); }
  .dp-frise li[data-etat="fait"] i { background: var(--vu-barre); box-shadow: none; }
  .dp-frise li[data-etat="cours"] { color: var(--vu-encre); font-weight: 600; }
  .dp-frise li[data-etat="cours"] i { box-shadow: inset 0 0 0 2px var(--vu-barre); animation: dp-pouls 1.6s ease-in-out infinite; }
  .dp-frise li[data-etat="arret"] { color: var(--vu-ambre); font-weight: 600; }
  .dp-frise li[data-etat="arret"] i { background: var(--vu-ambre-point); box-shadow: none; }
  .dp-frise li small { font-variant-numeric: tabular-nums; }
  .dp-raison { margin: 0; font-size: 13px; color: var(--vu-muet); }
  .dp-raison[data-ton="ambre"] { color: var(--vu-ambre); }
  .dp-aa summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 600; font-size: 14px; }
  .dp-aa table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .dp-aa th, .dp-aa td { text-align: left; padding: 6px 4px; border-top: .5px solid var(--vu-filet); vertical-align: top; overflow-wrap: anywhere; }
  .dp-aa th { color: var(--vu-muet); font-weight: 500; }
  .dp-aa tbody th { white-space: nowrap; overflow-wrap: normal; width: 1%; padding-right: 10px; }
  .dp-aa td[data-etat="ecart"], .dp-aa td[data-etat="a-finir"] { color: var(--vu-ambre); font-weight: 600; }
  .dp-aa td[data-etat="ok"] { color: var(--vu-muet); }
  .dp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  @keyframes dp-pouls { 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) { .dp-frise li[data-etat="cours"] i { animation: none; } }
  `;
  const ETAPES = ['photos', 'formulaire', 'brouillon', 'ordre', 'numero', 'enLigne'];
  // LA règle de la frise : une étape est « faite » si et seulement si le fond a daté SA preuve ; la première sans
  // preuve est « en cours » (la fiche avance) ou « arrêtée ici » (la fiche s'est arrêtée) ; jamais déduite d'une suivante.
  function frise(fi, mode) {
    const p = (fi && fi.preuves) || {};
    const etapes = mode === 'publier' ? ETAPES : ETAPES.filter((k) => k !== 'enLigne');
    let premier = true;
    return etapes.map((k) => {
      if (k === 'ordre' && fi && fi.ordre === 'pas-su' && !p.ordre) return { k, etat: 'pas-su', at: 0 };
      if (p[k] && !(k === 'ordre' && fi.ordre === 'faux')) return { k, etat: 'fait', at: Number(p[k]) };
      if (!premier) return { k, etat: 'attente', at: 0 };
      premier = false;
      const e = fi ? fi.etape : 'attente';
      return { k, etat: e === 'cours' ? 'cours' : (['arret', 'brouillon-arret', 'incertain'].includes(e) || (k === 'ordre' && fi.ordre === 'faux')) ? 'arret' : 'attente', at: 0 };
    });
  }
  function creer({ demander, rendre }) {
    let fiches, erreur = '', sel = new Set(), mode = 'brouillon', recap = false, envoi = false, refus = null, lot = null, ouvert = false, minut = null, aPreparer = 0, bilanVu = 0, enVol = false;
    const suivre = () => { clearTimeout(minut); if (lot && lot.etat === 'cours') minut = setTimeout(() => charger(true), 3000); };
    function charger(force) {
      if (enVol || (!force && fiches !== undefined)) return;
      enVol = true;
      demander({ from: 'vrm-badge', action: 'depotFiches' }, (r) => {
        enVol = false;
        if (r && r.ok) { fiches = r.fiches || []; aPreparer = Number(r.aPreparer) || 0; erreur = ''; for (const id of [...sel]) if (!fiches.some((f) => f.id === id && !f.depose)) sel.delete(id); }
        else { if (fiches === undefined) fiches = null; erreur = (r && r.raison) || 'L’extension n’a pas répondu.'; }
        lot = r && r.lot ? r.lot : lot;
        suivre(); rendre();
      });
    }
    function ouvrir(ids) { ouvert = true; for (const id of ids || []) if (/^[\w-]{1,40}$/.test(String(id))) sel.add(String(id)); charger(true); }
    const manqueDe = (f) => (mode === 'publier' ? f.manquePublier : f.manqueBrouillon) || [];
    const prete = (f) => !f.depose && f.prepare && !manqueDe(f).length;
    function ligneFiche(f) {
      const mq = manqueDe(f);
      const etat = f.depose ? `<small>${esc(T('deja', { e: T(f.depose === 'en-ligne' ? 'eEnLigne' : 'eBrouillon') }))}</small>`
        : mq.length ? `<small data-ton="ambre" data-depot-manque="${esc(mq.join(' '))}">${esc(T('manque', { l: mq.map((k) => T('m_' + k)).join(', ') }))}${f.variables && f.variables.length ? ' · ' + esc(T('variable', { v: '{' + f.variables[0] + '}' })) : ''}</small>`
          : `<small data-depot-prete>${esc(T('prete'))}${mode === 'brouillon' && f.aFinir && f.aFinir.length ? ' · ' + esc(T('aFinir', { l: f.aFinir.map((k) => T('m_' + k)).join(', ') })) : ''}</small>`;
      const ok = prete(f);
      return `<li class="dp-r" data-depot-fiche="${esc(f.id)}" data-depot-pret="${ok ? 'oui' : 'non'}">`
        + `<label class="dp-case"><input type="checkbox" data-depot-cocher="${esc(f.id)}"${sel.has(f.id) && ok ? ' checked' : ''}${ok ? '' : ' disabled'} aria-label="${esc(T('cocher', { n: f.numero }))}"></label>`
        + etiquette(f.numero)
        + `<span class="dp-txt"><b>${esc(f.titre || '—')}</b><small>${esc([pluriel(f.nPhotos, 'photo1', 'photoN'), euros(f.prix)].filter(Boolean).join(' · '))}</small>${etat}</span></li>`;
    }
    function lotHtml() {
      const ids = lot.ids || [];
      const faits = ids.filter((id) => lot.fiches[id] && lot.fiches[id].etape === 'fait').length;
      const finis = ids.filter((id) => lot.fiches[id] && !['attente', 'cours'].includes(lot.fiches[id].etape)).length;
      const tete = lot.etat === 'cours' ? T('lotCours', { f: Math.min(ids.length, finis + 1), n: ids.length }) : T(lot.etat === 'arretee' ? 'lotArrete' : 'lotFini', { f: faits, n: ids.length });
      const pc = ids.length ? Math.round((finis / ids.length) * 100) : 0;
      const ligne = (id) => {
        const fi = lot.fiches[id] || {};
        const fr = frise(fi, lot.mode);
        const voir = fi.itemId ? `https://www.vinted.fr/items/${encodeURIComponent(fi.itemId)}` : fi.draftId ? `https://www.vinted.fr/items/${encodeURIComponent(fi.draftId)}/edit` : '';
        const bilan = Array.isArray(fi.bilan) && fi.bilan.length ? `<details class="dp-aa" data-depot-avant-apres="${esc(id)}"${lot.ids.length === 1 || fi.etape !== 'fait' ? ' open' : ''}><summary>${esc(T('avantApres'))}</summary><table><thead><tr><th></th><th>${esc(T('colFiche'))}</th><th>${esc(T('colRelu'))}</th></tr></thead><tbody>${fi.bilan.map((b) => `<tr data-champ="${esc(b.k)}"><th>${esc(T('c_' + b.k))}</th><td>${esc(b.avant || '—')}</td><td data-etat="${esc(b.etat)}">${esc(b.apres || '')}${b.apres ? ' · ' : ''}${esc(T(b.etat === 'ok' ? 'ok' : b.etat === 'ecart' ? 'ecart' : b.etat === 'a-finir' ? 'aFinirC' : 'pasRelu'))}</td></tr>`).join('')}</tbody></table></details>` : '';
        return `<li data-depot-lot-fiche="${esc(id)}" data-depot-etape="${esc(fi.etape || 'attente')}"><div class="dp-lot-t">${etiquette(fi.numero || '')}<b>${esc(fi.titre || '—')}</b></div>`
          + `<ol class="dp-frise" data-depot-frise="${esc(id)}">${fr.map((x) => `<li data-etape="${x.k}" data-etat="${x.etat}"><i aria-hidden="true"></i><span>${esc(T(x.k === 'ordre' && x.etat === 'pas-su' ? 'e_ordrePasSu' : 'e_' + x.k))}</span>${x.at ? `<small>${esc(heure(x.at))}</small>` : ''}<span class="vu-muet" hidden>${esc(T(x.etat === 'fait' ? 'etapeFaite' : x.etat === 'cours' ? 'etapeCours' : x.etat === 'arret' ? 'etapeArret' : 'attente'))}</span></li>`).join('')}</ol>`
          + (fi.raison ? `<p class="dp-raison"${fi.etape !== 'fait' ? ' data-ton="ambre"' : ''} data-depot-raison>${esc(fi.raison)}</p>` : '')
          + bilan + (voir ? `<div class="dp-actions"><a class="vu-lien" href="${esc(voir)}" target="_blank" rel="noopener" data-depot-voir="${esc(id)}">${esc(T('voirVinted'))}</a></div>` : '') + '</li>';
      };
      return `<div class="dp-tete" data-depot-lot="${esc(lot.etat)}"><b>${esc(tete)}</b><span class="dp-sous">${esc(T(lot.mode === 'publier' ? 'modePublier' : 'modeBrouillon'))}${lot.etat === 'cours' && Number(lot.prochain) > Date.now() ? ' · ' + esc(T('prochain', { h: heure(lot.prochain) })) : ''}</span></div>`
        + `<div class="dp-pied">${UI && UI.barre ? UI.barre(pc, ' data-depot-barre') : ''}</div>`
        + (lot.arret && lot.arret.raison ? `<p class="dp-err" data-depot-arret="${esc(lot.arret.code || '')}">${esc(lot.arret.raison)}</p>` : '')
        + `<ol class="dp-lot">${ids.map(ligne).join('')}</ol>`
        + `<div class="dp-pied">${lot.etat === 'cours' ? `<button type="button" class="vu-btn vu-sec" data-depot-arreter>${esc(T('arreter'))}</button>` : `<button type="button" class="vu-btn vu-sec" data-depot-fermer-bilan>${esc(T('fermerBilan'))}</button>`}</div>`;
    }
    function depotHtml(site) {
      if (site && site !== 'vinted') return '';
      const voirLot = lot && (lot.etat === 'cours' || Number(lot.finLe || 0) > bilanVu);
      const pretes = Array.isArray(fiches) ? fiches.filter((f) => !f.depose && f.prepare) : [];
      if (!ouvert && !voirLot && !(Array.isArray(fiches) && pretes.length)) return '';
      const st = `<style data-vrm-depot-css>${CSS}</style>`;
      if (voirLot) return `${st}<section class="dp vu-plaque" data-depot="lot" aria-label="${esc(T('titre'))}">${lotHtml()}</section>`;
      const sous = fiches === undefined ? T('lecture') : Array.isArray(fiches) ? pluriel(pretes.length, 'pret1', 'pretN') : '';
      const tete = `<button type="button" class="dp-tete" data-depot-ouvrir aria-expanded="${ouvert ? 'true' : 'false'}"><b>${esc(T('titre'))}</b><span class="dp-sous">${esc(sous)}</span><span class="dp-chev" aria-hidden="true">${ouvert ? '⌃' : '›'}</span></button>`;
      if (!ouvert) return `${st}<section class="dp vu-plaque" data-depot="ferme">${tete}</section>`;
      if (fiches === undefined) return `${st}<section class="dp vu-plaque" data-depot="lecture" role="status">${tete}</section>`;
      if (fiches === null) return `${st}<section class="dp vu-plaque" data-depot="pas-su">${tete}<p class="dp-err">${esc(erreur)}</p></section>`;
      const cochees = fiches.filter((f) => sel.has(f.id) && prete(f));
      if (recap && cochees.length) {
        const d = UI && UI.duree ? UI.duree(cochees.length * 3 * 60000 + Math.max(0, cochees.length - 1) * 2 * 60000) : '';
        return `${st}<section class="dp vu-plaque" data-depot="recap" role="dialog" aria-label="${esc(pluriel(cochees.length, 'recap1', 'recapN'))}">${tete}<div class="dp-recap"><h3>${esc(pluriel(cochees.length, 'recap1', 'recapN'))}</h3>`
          + `<p><b>${esc(T('recapMode', { m: T(mode === 'publier' ? 'modePublier' : 'modeBrouillon') }))}</b></p><p>${esc(T('recapRythme', { d }))}</p><p>${esc(T('recapForm'))}</p>${mode === 'publier' ? `<p>${esc(T('recapPublier'))}</p>` : ''}<p>${esc(T('recapRien'))}</p></div>`
          + (refus ? `<p class="dp-err" data-depot-refus>${esc(refus)}</p>` : '')
          + `<ul class="dp-liste">${cochees.map((f) => `<li class="dp-r" data-depot-recap-fiche="${esc(f.id)}">${etiquette(f.numero)}<span class="dp-txt"><b>${esc(f.titre || '—')}</b><small>${esc([pluriel(f.nPhotos, 'photo1', 'photoN'), euros(f.prix)].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ul>`
          + `<div class="dp-pied"><button type="button" class="vu-btn vu-plein" data-depot-confirmer${envoi ? ' disabled' : ''}>${esc(envoi ? T('envoi') : T('confirmer'))}</button><button type="button" class="vu-btn vu-sec" data-depot-retour>${esc(T('retour'))}</button></div></section>`;
      }
      const seg = `<div class="dp-mode"><span>${esc(T('modeLib'))}</span><div class="vu-seg" role="group" aria-label="${esc(T('modeLib'))}"><button type="button" data-depot-mode="brouillon" aria-pressed="${mode === 'brouillon'}">${esc(T('modeBrouillon'))}</button><button type="button" data-depot-mode="publier" aria-pressed="${mode === 'publier'}">${esc(T('modePublier'))}</button></div></div>`;
      return `${st}<section class="dp vu-plaque" data-depot="liste" data-depot-n="${fiches.length}">${tete}`
        + (fiches.length ? seg + `<ul class="dp-liste">${fiches.map(ligneFiche).join('')}</ul>` : `<p class="dp-note" data-depot-aucune>${esc(T('aucune'))}</p>`)
        + (aPreparer ? `<p class="dp-note" data-depot-a-preparer="${aPreparer}">${esc(pluriel(aPreparer, 'aPrep1', 'aPrepN'))}</p>` : '')
        + (refus ? `<p class="dp-err" data-depot-refus>${esc(refus)}</p>` : '')
        + (fiches.length ? `<div class="dp-pied"><button type="button" class="vu-btn vu-plein" data-depot-lancer${cochees.length ? '' : ' disabled'}>${esc(T('deposer', { n: cochees.length }))}</button></div>` : '')
        + '</section>';
    }
    function lier(R) {
      const q = (s) => R.querySelector(s);
      const b = q('[data-depot-ouvrir]'); if (b) b.addEventListener('click', () => { ouvert = !ouvert; if (ouvert) charger(true); rendre(); });
      R.querySelectorAll('[data-depot-cocher]').forEach((c) => c.addEventListener('change', () => { const id = c.getAttribute('data-depot-cocher'); if (c.checked) sel.add(id); else sel.delete(id); refus = null; rendre(); }));
      R.querySelectorAll('[data-depot-mode]').forEach((x) => x.addEventListener('click', () => { mode = x.getAttribute('data-depot-mode') === 'publier' ? 'publier' : 'brouillon'; refus = null; rendre(); }));
      const l = q('[data-depot-lancer]'); if (l) l.addEventListener('click', () => { recap = true; refus = null; rendre(); });
      const rt = q('[data-depot-retour]'); if (rt) rt.addEventListener('click', () => { recap = false; rendre(); });
      const cf = q('[data-depot-confirmer]'); if (cf) cf.addEventListener('click', () => {
        if (envoi) return;
        const ids = (fiches || []).filter((f) => sel.has(f.id) && prete(f)).map((f) => f.id);
        envoi = true; rendre();
        demander({ from: 'vrm-badge', action: 'depotLancer', ids, mode, confirme: true }, (r) => {
          envoi = false;
          if (r && r.ok) { lot = r.lot; recap = false; sel.clear(); refus = null; suivre(); }
          else refus = (r && r.raison) || 'L’extension n’a pas répondu : rien n’est parti.';
          rendre();
        });
      });
      const ar = q('[data-depot-arreter]'); if (ar) ar.addEventListener('click', () => demander({ from: 'vrm-badge', action: 'depotArreter' }, (r) => { if (r && r.lot) lot = r.lot; rendre(); charger(true); }));
      const fb = q('[data-depot-fermer-bilan]'); if (fb) fb.addEventListener('click', () => { bilanVu = Number((lot && lot.finLe) || Date.now()); charger(true); rendre(); });
    }
    return { depotHtml, lier, ouvrir, charger };
  }
  globalThis.VRM_DEPOT = Object.freeze({ creer, frise, MOTS, CSS, T });
})();
