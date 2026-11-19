// ════════════════════════════════════════════════════════════════════════════
//  VRM-UI — LA FEUILLE ET LES PIÈCES COMMUNES DE L'EXTENSION (5.406, 17 nov.)
//
//  Julien : « fait tout mieux sur l'extension déjà parce qu'elle est horrible ».
//  UNE feuille de style et UN jeu de pièces pour TOUT ce que l'extension montre :
//  la carte du logo (Vinted, Leboncoin, Vestiaire, eBay), la fenêtre de l'icône,
//  l'écran « action en cours », la ligne sous ses annonces, l'encart d'achat, les
//  alertes du formulaire de dépôt, les messages brefs et les bandeaux.
//  Le look « design v2 » de l'app (src/designV2/*.css) : la COQUE bleue, la
//  PORCELAINE (blanc le jour, bleu-nuit la nuit) posée dessus, UN plein, l'étiquette
//  N° en KRAFT comme signature, l'ambre pour un geste, jamais violet ni rouge (sauf
//  deux paires sous un N°, §7).
//  Pièces : `.vu-coque` (le panneau), `.vu-plaque` (la porcelaine), `.vu-btn`
//  (`.vu-plein` · `.vu-sec` · `.vu-lien`), `.vu-seg` (contrôle segmenté), `.vu-n`
//  (étiquette kraft), `.vu-barre` (progression), `.vu-point` (état), `.vu-bandeau`,
//  `.vu-toast`, `.vu-sous` (ligne secondaire).
//  Textes : `T(clé, vars)` — fr, en, es, it, de, choisis par la langue du NAVIGATEUR
//  (la règle de chrome.i18n) ; une clé absente ⇒ le français ; `scripts/audit-extension-feuille.cjs`
//  exige les cinq langues et les mêmes {variables} pour chaque clé.
//  Contraste ≥ 4,5:1 mesuré (scripts/bancs/extension-surfaces.cjs), cibles ≥ 44 px.
//  Aucune lecture de la page, aucune requête : des styles et du texte.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.VRM_UI) return;
  const MOTS = {
    // ── la carte ──
    c_notifications: { fr: "Notifications", en: "Notifications", es: "Notificaciones", it: "Notifiche", de: "Benachrichtigungen" },
    c_automatisations: { fr: "Automatisations", en: "Automations", es: "Automatizaciones", it: "Automazioni", de: "Automatisierungen" },
    s_tous: { fr: "Toutes", en: "All", es: "Todos", it: "Tutti", de: "Alle" },
    s_en_vente: { fr: "En vente", en: "For sale", es: "En venta", it: "In vendita", de: "Zum Verkauf" },
    s_brouillon: { fr: "Brouillon", en: "Draft", es: "Borrador", it: "Bozza", de: "Entwurf" },
    s_masque: { fr: "Masqué", en: "Hidden", es: "Oculto", it: "Nascosto", de: "Ausgeblendet" },
    s_reserve: { fr: "Réservé", en: "Reserved", es: "Reservado", it: "Riservato", de: "Reserviert" },
    s_vendu: { fr: "Vendu", en: "Sold", es: "Vendido", it: "Venduto", de: "Verkauft" },
    s_a_confirmer: { fr: "À confirmer", en: "To confirm", es: "Por confirmar", it: "Da confermare", de: "Zu bestätigen" },
    a_choisir: { fr: "Choisir une action", en: "Choose an action", es: "Elegir una acción", it: "Scegli un’azione", de: "Aktion wählen" },
    a_choisir_n: { fr: "Choisir une action ({n})", en: "Choose an action ({n})", es: "Elegir una acción ({n})", it: "Scegli un’azione ({n})", de: "Aktion wählen ({n})" },
    ac_republier: { fr: "Republier dans VRM", en: "Relist in VRM", es: "Volver a publicar en VRM", it: "Ripubblica in VRM", de: "In VRM neu einstellen" },
    ac_baisser: { fr: "Baisser le prix dans VRM", en: "Lower the price in VRM", es: "Bajar el precio en VRM", it: "Abbassa il prezzo in VRM", de: "Preis in VRM senken" },
    ac_favoris: { fr: "Offre à leurs favoris", en: "Offer to their favourites", es: "Oferta a sus favoritos", it: "Offerta ai loro preferiti", de: "Angebot an ihre Favoriten" },
    ac_ouvrir: { fr: "Ouvrir sur Vinted", en: "Open on Vinted", es: "Abrir en Vinted", it: "Apri su Vinted", de: "Auf Vinted öffnen" },
    a_chercher: { fr: "Rechercher un article ou un N°", en: "Search an item or a number", es: "Buscar un artículo o un n.º", it: "Cerca un articolo o un n.", de: "Artikel oder Nr. suchen" },
    a_vue: { fr: "Affichage", en: "View", es: "Vista", it: "Vista", de: "Ansicht" },
    a_liste: { fr: "Liste", en: "List", es: "Lista", it: "Elenco", de: "Liste" },
    a_grille: { fr: "Grille", en: "Grid", es: "Cuadrícula", it: "Griglia", de: "Raster" },
    a_colonnes: { fr: "Colonnes", en: "Columns", es: "Columnas", it: "Colonne", de: "Spalten" },
    a_statut: { fr: "Statut", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    a_statuts_pas_su: { fr: "Les statuts (brouillon, masqué, réservé, vendu) arrivent avec la prochaine lecture de ton dressing.", en: "Statuses (draft, hidden, reserved, sold) arrive with the next read of your wardrobe.", es: "Los estados (borrador, oculto, reservado, vendido) llegan con la próxima lectura de tu armario.", it: "Gli stati (bozza, nascosto, riservato, venduto) arrivano con la prossima lettura del tuo guardaroba.", de: "Die Status (Entwurf, ausgeblendet, reserviert, verkauft) kommen mit dem nächsten Lesen deines Kleiderschranks." },
    a_tout: { fr: "Tout cocher", en: "Tick all", es: "Marcar todo", it: "Seleziona tutto", de: "Alle auswählen" },
    a_lues: { fr: "Dressing lu {quand}", en: "Wardrobe read {quand}", es: "Armario leído {quand}", it: "Guardaroba letto {quand}", de: "Kleiderschrank gelesen {quand}" },
    a_relecture: { fr: "relecture en cours", en: "reading again", es: "releyendo", it: "rilettura in corso", de: "wird neu gelesen" },
    a_aucune: { fr: "Aucune annonce pour ce filtre.", en: "No listing for this filter.", es: "Ningún anuncio para este filtro.", it: "Nessun annuncio per questo filtro.", de: "Keine Anzeige für diesen Filter." },
    c5_article: { fr: "Article", en: "Item", es: "Artículo", it: "Articolo", de: "Artikel" },
    c5_num: { fr: "N°", en: "No.", es: "N.º", it: "N.", de: "Nr." },
    c5_prix: { fr: "Prix", en: "Price", es: "Precio", it: "Prezzo", de: "Preis" },
    c5_mini: { fr: "Prix mini", en: "Lowest price", es: "Precio mínimo", it: "Prezzo minimo", de: "Mindestpreis" },
    c5_achat: { fr: "Acheté", en: "Bought", es: "Comprado", it: "Acquistato", de: "Gekauft" },
    c5_date: { fr: "En ligne", en: "Listed", es: "En línea", it: "Online", de: "Online" },
    c5_vues: { fr: "Vues", en: "Views", es: "Visitas", it: "Visualizzazioni", de: "Aufrufe" },
    c5_favoris: { fr: "Favoris", en: "Favourites", es: "Favoritos", it: "Preferiti", de: "Favoriten" },
    c5_statut: { fr: "Statut", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    au_active: { fr: "Activé", en: "On", es: "Activado", it: "Attivo", de: "Aktiv" },
    au_desactive: { fr: "Désactivé", en: "Off", es: "Desactivado", it: "Disattivato", de: "Aus" },
    au_pas_su: { fr: "Pas su", en: "Not known", es: "No se sabe", it: "Non noto", de: "Unbekannt" },
    au_pas_su_tout: { fr: "Tes réglages n’ont pas pu être lus pour l’instant.", en: "Your settings could not be read for now.", es: "Tus ajustes no se han podido leer por ahora.", it: "Per ora le tue impostazioni non sono state lette.", de: "Deine Einstellungen konnten noch nicht gelesen werden." },
    au_modifier: { fr: "Modifier dans VRM", en: "Change in VRM", es: "Cambiar en VRM", it: "Modifica in VRM", de: "In VRM ändern" },
    au_rythme_perso: { fr: "Tes minutes", en: "Your minutes", es: "Tus minutos", it: "I tuoi minuti", de: "Deine Minuten" },
    au_favoris: { fr: "Messages aux favoris", en: "Messages to favourites", es: "Mensajes a favoritos", it: "Messaggi ai preferiti", de: "Nachrichten an Favoriten" },
    au_messages: { fr: "Messages", en: "Messages", es: "Mensajes", it: "Messaggi", de: "Nachrichten" },
    au_versions: { fr: "{n} version(s), une tirée au hasard", en: "{n} version(s), one picked at random", es: "{n} versión(es), una al azar", it: "{n} versione/i, una a caso", de: "{n} Version(en), eine zufällig" },
    au_pas_de_message: { fr: "Aucun message enregistré", en: "No message saved", es: "Ningún mensaje guardado", it: "Nessun messaggio salvato", de: "Keine Nachricht gespeichert" },
    au_attente: { fr: "Traiter un favori après", en: "Handle a favourite after", es: "Tratar un favorito tras", it: "Gestire un preferito dopo", de: "Favorit bearbeiten nach" },
    au_minutes: { fr: "{a} à {b} min", en: "{a} to {b} min", es: "{a} a {b} min", it: "da {a} a {b} min", de: "{a} bis {b} Min." },
    au_plafonds: { fr: "Au plus", en: "At most", es: "Como máximo", it: "Al massimo", de: "Höchstens" },
    au_par: { fr: "{h} par heure · {j} par jour", en: "{h} per hour · {j} per day", es: "{h} por hora · {j} por día", it: "{h} all’ora · {j} al giorno", de: "{h} pro Stunde · {j} pro Tag" },
    au_horaires: { fr: "Horaires", en: "Hours", es: "Horario", it: "Orari", de: "Uhrzeiten" },
    au_guide: { fr: "Envoyer pas à pas", en: "Send step by step", es: "Enviar paso a paso", it: "Invia passo passo", de: "Schritt für Schritt senden" },
    au_offres: { fr: "Offres automatiques", en: "Automatic offers", es: "Ofertas automáticas", it: "Offerte automatiche", de: "Automatische Angebote" },
    au_minis: { fr: "Prix mini posés", en: "Lowest prices set", es: "Precios mínimos puestos", it: "Prezzi minimi impostati", de: "Mindestpreise gesetzt" },
    au_minis_n: { fr: "{n} article(s)", en: "{n} item(s)", es: "{n} artículo(s)", it: "{n} articolo/i", de: "{n} Artikel" },
    au_refus: { fr: "Message de refus", en: "Decline message", es: "Mensaje de rechazo", it: "Messaggio di rifiuto", de: "Ablehnungsnachricht" },
    au_oui: { fr: "Oui", en: "Yes", es: "Sí", it: "Sì", de: "Ja" },
    au_non: { fr: "Non", en: "No", es: "No", it: "No", de: "Nein" },
    au_baisse: { fr: "Baisse de prix automatique", en: "Automatic price drop", es: "Bajada de precio automática", it: "Ribasso automatico", de: "Automatische Preissenkung" },
    au_baisse_pas_livree: { fr: "Pas encore disponible : la règle (« −5 % tous les 14 jours sans vente, jamais sous le prix mini ») arrive dans VRM.", en: "Not available yet: the rule (“−5% every 14 days without a sale, never below the lowest price”) is coming to VRM.", es: "Aún no disponible: la regla («−5 % cada 14 días sin venta, nunca por debajo del precio mínimo») llega a VRM.", it: "Non ancora disponibile: la regola («−5 % ogni 14 giorni senza vendita, mai sotto il prezzo minimo») arriva in VRM.", de: "Noch nicht verfügbar: die Regel („−5 % alle 14 Tage ohne Verkauf, nie unter dem Mindestpreis“) kommt in VRM." },
    no_pas_su: { fr: "Le journal n’a pas pu être lu pour l’instant.", en: "The log could not be read for now.", es: "El registro no se ha podido leer por ahora.", it: "Per ora il registro non è stato letto.", de: "Das Protokoll konnte noch nicht gelesen werden." },
    no_type: { fr: "Type", en: "Type", es: "Tipo", it: "Tipo", de: "Typ" },
    no_tous_types: { fr: "Tous les types", en: "All types", es: "Todos los tipos", it: "Tutti i tipi", de: "Alle Typen" },
    no_statut: { fr: "Statut", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    no_quand: { fr: "Quand", en: "When", es: "Cuándo", it: "Quando", de: "Wann" },
    no_7j: { fr: "{n} sur 7 jours", en: "{n} over 7 days", es: "{n} en 7 días", it: "{n} in 7 giorni", de: "{n} in 7 Tagen" },
    no_aucune: { fr: "Rien pour ce filtre.", en: "Nothing for this filter.", es: "Nada para este filtro.", it: "Niente per questo filtro.", de: "Nichts für diesen Filter." },
    nt_tous: { fr: "Tous", en: "All", es: "Todos", it: "Tutti", de: "Alle" },
    nt_nouveau: { fr: "Nouveau", en: "New", es: "Nuevo", it: "Nuovo", de: "Neu" },
    nt_vu: { fr: "Vu", en: "Seen", es: "Visto", it: "Visto", de: "Gesehen" },
    ns_refus: { fr: "Vinted a freiné", en: "Vinted slowed down", es: "Vinted ha frenado", it: "Vinted ha rallentato", de: "Vinted hat gebremst" },
    ns_ventes: { fr: "Nouvelle vente", en: "New sale", es: "Venta nueva", it: "Nuova vendita", de: "Neuer Verkauf" },
    ns_codes: { fr: "Code de retrait", en: "Pickup code", es: "Código de recogida", it: "Codice di ritiro", de: "Abholcode" },
    ns_bordereaux: { fr: "Bordereau prêt", en: "Label ready", es: "Etiqueta lista", it: "Etichetta pronta", de: "Etikett bereit" },
    ns_achats: { fr: "Nouvel achat", en: "New purchase", es: "Compra nueva", it: "Nuovo acquisto", de: "Neuer Kauf" },
    ns_offres: { fr: "Offre reçue", en: "Offer received", es: "Oferta recibida", it: "Offerta ricevuta", de: "Angebot erhalten" },
    ns_messages: { fr: "Nouveau message", en: "New message", es: "Mensaje nuevo", it: "Nuovo messaggio", de: "Neue Nachricht" },
    ns_versements: { fr: "Date de versement", en: "Payout date", es: "Fecha de pago", it: "Data di pagamento", de: "Auszahlungsdatum" },
    ns_numerotes: { fr: "Annonce numérotée", en: "Listing numbered", es: "Anuncio numerado", it: "Annuncio numerato", de: "Anzeige nummeriert" },
    ns_annonces: { fr: "Nouvelle annonce", en: "New listing", es: "Anuncio nuevo", it: "Nuovo annuncio", de: "Neue Anzeige" },
    m_ecrire: { fr: "Écrire une réponse…", en: "Write a reply…", es: "Escribe una respuesta…", it: "Scrivi una risposta…", de: "Antwort schreiben…" },
    m_envoyer: { fr: "Envoyer", en: "Send", es: "Enviar", it: "Invia", de: "Senden" },
    m_envoi: { fr: "Envoi…", en: "Sending…", es: "Enviando…", it: "Invio…", de: "Senden…" },
    m_ouvrir_vinted: { fr: "Ouvrir sur Vinted", en: "Open on Vinted", es: "Abrir en Vinted", it: "Apri su Vinted", de: "Auf Vinted öffnen" },
    m_parti: { fr: "Envoyé : Vinted l’a accepté.", en: "Sent: Vinted accepted it.", es: "Enviado: Vinted lo ha aceptado.", it: "Inviato: Vinted l’ha accettato.", de: "Gesendet: Vinted hat es angenommen." },
    m_pas_parti: { fr: "Rien n’est parti : réessaie dans un instant.", en: "Nothing was sent: try again in a moment.", es: "No se ha enviado nada: vuelve a intentarlo.", it: "Non è partito nulla: riprova tra poco.", de: "Nichts wurde gesendet: versuch es gleich noch einmal." },
    p_transporteur: { fr: "Transporteur", en: "Carrier", es: "Transportista", it: "Corriere", de: "Versanddienst" },
    m_repondre: { fr: 'Répondre sur Vinted', en: 'Reply on Vinted', es: 'Responder en Vinted', it: 'Rispondi su Vinted', de: 'Auf Vinted antworten' },
    m_chercher: { fr: 'Rechercher une conversation', en: 'Search a conversation', es: 'Buscar una conversación', it: 'Cerca una conversazione', de: 'Unterhaltung suchen' },
    m_filtre_nonlus: { fr: 'Non lus · {n}', en: 'Unread · {n}', es: 'Sin leer · {n}', it: 'Non letti · {n}', de: 'Ungelesen · {n}' },
    m_choisir: { fr: 'Choisis une conversation', en: 'Choose a conversation', es: 'Elige una conversación', it: 'Scegli una conversazione', de: 'Wähle eine Unterhaltung' },
    m_choisir_note: { fr: 'Touche une conversation dans la liste pour la voir ici.', en: 'Tap a conversation in the list to see it here.', es: 'Toca una conversación de la lista para verla aquí.', it: 'Tocca una conversazione nell’elenco per vederla qui.', de: 'Tippe auf eine Unterhaltung in der Liste, um sie hier zu sehen.' },
    m_aucun_filtre: { fr: 'Aucune conversation ne correspond.', en: 'No conversation matches.', es: 'Ninguna conversación coincide.', it: 'Nessuna conversazione corrisponde.', de: 'Keine Unterhaltung passt.' },
    fr_rythme_normal: { fr: 'Au hasard · 40 à 90 s', en: 'Random · 40 to 90 s', es: 'Al azar · 40 a 90 s', it: 'A caso · da 40 a 90 s', de: 'Zufällig · 40 bis 90 s' },
    fr_rythme_prudent: { fr: 'Plus prudent · 2 à 4 min', en: 'More careful · 2 to 4 min', es: 'Más prudente · 2 a 4 min', it: 'Più prudente · da 2 a 4 min', de: 'Vorsichtiger · 2 bis 4 Min.' },
    // 5.409 — le grand panneau (Messages · Annonces · Favoris · Ventes · Paramètres), la fiche dépliée, le parcours des favoris
    c_messages: { fr: 'Messages', en: 'Messages', es: 'Mensajes', it: 'Messaggi', de: 'Nachrichten' },
    c_parametres: { fr: 'Paramètres', en: 'Settings', es: 'Ajustes', it: 'Impostazioni', de: 'Einstellungen' },
    p_num: { fr: 'N°', en: 'No.', es: 'N.º', it: 'N.', de: 'Nr.' },
    p_prix: { fr: 'Prix', en: 'Price', es: 'Precio', it: 'Prezzo', de: 'Preis' },
    p_mini: { fr: 'Prix mini accepté', en: 'Lowest accepted price', es: 'Precio mínimo aceptado', it: 'Prezzo minimo accettato', de: 'Niedrigster akzeptierter Preis' },
    p_achat: { fr: 'Acheté', en: 'Bought for', es: 'Comprado por', it: 'Acquistato a', de: 'Gekauft für' },
    p_ecart: { fr: 'Prix − achat', en: 'Price − cost', es: 'Precio − compra', it: 'Prezzo − acquisto', de: 'Preis − Einkauf' },
    p_taille: { fr: 'Taille', en: 'Size', es: 'Talla', it: 'Taglia', de: 'Größe' },
    p_marque: { fr: 'Marque', en: 'Brand', es: 'Marca', it: 'Marca', de: 'Marke' },
    p_etat: { fr: 'État', en: 'Condition', es: 'Estado', it: 'Condizioni', de: 'Zustand' },
    p_depuis: { fr: 'En ligne depuis', en: 'Listed for', es: 'En línea desde hace', it: 'Online da', de: 'Online seit' },
    p_jours: { fr: '{n} j', en: '{n} d', es: '{n} d', it: '{n} g', de: '{n} T.' },
    p_favoris: { fr: 'Favoris', en: 'Favourites', es: 'Favoritos', it: 'Preferiti', de: 'Favoriten' },
    p_vues: { fr: 'Vues', en: 'Views', es: 'Visitas', it: 'Visualizzazioni', de: 'Aufrufe' },
    p_ouvrir_vinted: { fr: 'Ouvrir sur Vinted', en: 'Open on Vinted', es: 'Abrir en Vinted', it: 'Apri su Vinted', de: 'Auf Vinted öffnen' },
    p_gerer_vrm: { fr: 'Gérer dans VRM', en: 'Manage in VRM', es: 'Gestionar en VRM', it: 'Gestisci in VRM', de: 'In VRM verwalten' },
    p_etat_vente: { fr: 'État de la vente', en: 'Sale status', es: 'Estado de la venta', it: 'Stato della vendita', de: 'Verkaufsstatus' },
    p_bordereau: { fr: 'Bordereau', en: 'Label', es: 'Etiqueta', it: 'Etichetta', de: 'Etikett' },
    p_pret: { fr: 'prêt', en: 'ready', es: 'lista', it: 'pronta', de: 'bereit' },
    p_pas_la: { fr: 'pas encore là', en: 'not there yet', es: 'aún no está', it: 'non ancora arrivata', de: 'noch nicht da' },
    p_date: { fr: 'Vendue', en: 'Sold', es: 'Vendida', it: 'Venduta', de: 'Verkauft' },
    p_ouvrir_conv: { fr: 'Ouvrir la conversation', en: 'Open the conversation', es: 'Abrir la conversación', it: 'Apri la conversazione', de: 'Unterhaltung öffnen' },
    m_charge: { fr: 'Je lis tes messages…', en: 'Reading your messages…', es: 'Leyendo tus mensajes…', it: 'Leggo i tuoi messaggi…', de: 'Ich lese deine Nachrichten…' },
    m_pas_su: { fr: 'Tes messages n’ont pas pu être lus pour l’instant : rien n’est affiché plutôt qu’une liste fausse.', en: 'Your messages could not be read for now: nothing is shown rather than a wrong list.', es: 'Tus mensajes no se han podido leer por ahora: no se muestra nada antes que una lista falsa.', it: 'Per ora i tuoi messaggi non sono stati letti: meglio niente che un elenco sbagliato.', de: 'Deine Nachrichten konnten noch nicht gelesen werden: lieber nichts als eine falsche Liste.' },
    m_aucun: { fr: 'Aucune conversation lue sur ce compte : ouvre une fois ta boîte de messages Vinted.', en: 'No conversation read on this account: open your Vinted inbox once.', es: 'Ninguna conversación leída en esta cuenta: abre una vez tu buzón de Vinted.', it: 'Nessuna conversazione letta su questo account: apri una volta la tua casella Vinted.', de: 'Keine Unterhaltung auf diesem Konto gelesen: öffne einmal dein Vinted-Postfach.' },
    m_nonlus: { fr: '{n} non lus', en: '{n} unread', es: '{n} sin leer', it: '{n} non letti', de: '{n} ungelesen' },
    m_tous_lus: { fr: 'Tout est lu', en: 'All read', es: 'Todo leído', it: 'Tutto letto', de: 'Alles gelesen' },
    m_site: { fr: 'Sur {site}, tes messages sont dans les pages du site.', en: 'On {site}, your messages are in the site’s pages.', es: 'En {site}, tus mensajes están en las páginas del sitio.', it: 'Su {site}, i tuoi messaggi sono nelle pagine del sito.', de: 'Auf {site} sind deine Nachrichten auf den Seiten der Website.' },
    r_rien: { fr: 'Rien à régler ici.', en: 'Nothing to set here.', es: 'Nada que ajustar aquí.', it: 'Niente da regolare qui.', de: 'Hier gibt es nichts einzustellen.' },
    r_remettre: { fr: 'Remettre le logo en place', en: 'Put the logo back', es: 'Volver a colocar el logo', it: 'Rimetti il logo al suo posto', de: 'Logo zurücksetzen' },
    r_logo: { fr: 'Le logo VRM sur ce site', en: 'The VRM logo on this site', es: 'El logo VRM en este sitio', it: 'Il logo VRM su questo sito', de: 'Das VRM-Logo auf dieser Website' },
    r_logo_note: { fr: 'Glisse le logo où tu veux : sa place est gardée pour ce site. Il ne se pose jamais sur les boutons du site.', en: 'Drag the logo wherever you like: its spot is kept for this site. It never sits on the site’s buttons.', es: 'Arrastra el logo donde quieras: su sitio se guarda para esta web. Nunca tapa los botones del sitio.', it: 'Trascina il logo dove vuoi: la posizione resta per questo sito. Non copre mai i pulsanti del sito.', de: 'Zieh das Logo, wohin du willst: sein Platz bleibt für diese Website. Es liegt nie auf den Schaltflächen der Website.' },
    r_arrivee: { fr: 'Ce qui s’affiche', en: 'What is shown', es: 'Lo que se muestra', it: 'Cosa viene mostrato', de: 'Was angezeigt wird' },
    r_vrm: { fr: 'Réglé dans VRM', en: 'Set in VRM', es: 'Se ajusta en VRM', it: 'Si regola in VRM', de: 'In VRM eingestellt' },
    r_rythme: { fr: 'Rythme des messages aux favoris', en: 'Pace of messages to favourites', es: 'Ritmo de los mensajes a favoritos', it: 'Ritmo dei messaggi ai preferiti', de: 'Tempo der Nachrichten an Favoriten' },
    r_notifs: { fr: 'Notifications', en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', de: 'Benachrichtigungen' },
    r_langue: { fr: 'Langue', en: 'Language', es: 'Idioma', it: 'Lingua', de: 'Sprache' },
    f5_choisir: { fr: 'Choisir', en: 'Choose', es: 'Elegir', it: 'Scegli', de: 'Auswählen' },
    f5_offre: { fr: 'Offre et message', en: 'Offer and message', es: 'Oferta y mensaje', it: 'Offerta e messaggio', de: 'Angebot und Nachricht' },
    f5_rythme: { fr: 'Rythme', en: 'Pace', es: 'Ritmo', it: 'Ritmo', de: 'Tempo' },
    f5_confirmer: { fr: 'Confirmer', en: 'Confirm', es: 'Confirmar', it: 'Conferma', de: 'Bestätigen' },
    f5_suivi: { fr: 'Suivi', en: 'Progress', es: 'Seguimiento', it: 'Avanzamento', de: 'Verlauf' },
    f5_guide_1: { fr: 'Coche les favoris à qui écrire, puis touche le bouton du bas.', en: 'Tick the favourites to write to, then tap the button below.', es: 'Marca los favoritos a los que escribir y toca el botón de abajo.', it: 'Spunta i preferiti a cui scrivere, poi tocca il pulsante in basso.', de: 'Hake die Favoriten an, denen du schreiben willst, und tippe unten auf die Schaltfläche.' },
    f5_guide_2: { fr: 'Vérifie l’offre et le message que l’acheteur verra.', en: 'Check the offer and the message the buyer will see.', es: 'Revisa la oferta y el mensaje que verá el comprador.', it: 'Controlla l’offerta e il messaggio che vedrà l’acquirente.', de: 'Prüfe das Angebot und die Nachricht, die der Käufer sieht.' },
    f5_guide_3: { fr: 'Le rythme est celui de tes réglages : la durée totale est dite.', en: 'The pace is your settings’: the total time is shown.', es: 'El ritmo es el de tus ajustes: se indica la duración total.', it: 'Il ritmo è quello delle tue impostazioni: la durata totale è indicata.', de: 'Das Tempo folgt deinen Einstellungen: die Gesamtdauer wird angezeigt.' },
    f5_guide_4: { fr: 'Relis l’offre, le message et la durée, puis confirme l’envoi.', en: 'Read the offer, message and time again, then confirm sending.', es: 'Relee la oferta, el mensaje y la duración, y confirma el envío.', it: 'Rileggi offerta, messaggio e durata, poi conferma l’invio.', de: 'Lies Angebot, Nachricht und Dauer noch einmal und bestätige dann den Versand.' },
    f5_guide_5: { fr: 'Les messages partent un par un : tu peux arrêter l’envoi en haut.', en: 'Messages go one by one: you can stop sending at the top.', es: 'Los mensajes salen uno a uno: puedes detener el envío arriba.', it: 'I messaggi partono uno alla volta: puoi fermare l’invio in alto.', de: 'Die Nachrichten gehen einzeln raus: oben kannst du den Versand stoppen.' },
    c_normal: { fr: 'Normal', en: 'Normal', es: 'Normal', it: 'Normale', de: 'Normal' },
    c_aucun_compte: { fr: 'Aucun compte connecté', en: 'No account signed in', es: 'Ninguna cuenta conectada', it: 'Nessun account collegato', de: 'Kein Konto angemeldet' },
    c_lu: { fr: 'lu {quand}', en: 'read {quand}', es: 'leído {quand}', it: 'letto {quand}', de: 'gelesen {quand}' },
    c_heure: { fr: '{n}/{max} cette heure', en: '{n}/{max} this hour', es: '{n}/{max} esta hora', it: '{n}/{max} quest’ora', de: '{n}/{max} diese Stunde' },
    c_heure_min: { fr: 'au moins {n}/{max} cette heure', en: 'at least {n}/{max} this hour', es: 'al menos {n}/{max} esta hora', it: 'almeno {n}/{max} quest’ora', de: 'mindestens {n}/{max} diese Stunde' },
    c_jour: { fr: '{n}/{max} aujourd’hui', en: '{n}/{max} today', es: '{n}/{max} hoy', it: '{n}/{max} oggi', de: '{n}/{max} heute' },
    c_maj: { fr: 'Version {v} disponible', en: 'Version {v} available', es: 'Versión {v} disponible', it: 'Versione {v} disponibile', de: 'Version {v} verfügbar' },
    c_maj_b: { fr: 'Mettre à jour', en: 'Update', es: 'Actualizar', it: 'Aggiorna', de: 'Aktualisieren' },
    c_maj_comment: { fr: 'Comment ?', en: 'How?', es: '¿Cómo?', it: 'Come?', de: 'Wie?' },
    c_maj_orion1: { fr: 'Touche « Mettre à jour ».', en: 'Tap “Update”.', es: 'Toca «Actualizar».', it: 'Tocca «Aggiorna».', de: 'Tippe auf „Aktualisieren“.' },
    c_maj_orion2: { fr: 'Orion → Extensions → + → ce fichier.', en: 'Orion → Extensions → + → this file.', es: 'Orion → Extensiones → + → este archivo.', it: 'Orion → Estensioni → + → questo file.', de: 'Orion → Erweiterungen → + → diese Datei.' },
    c_maj_orion3: { fr: 'Recharge cette page.', en: 'Reload this page.', es: 'Recarga esta página.', it: 'Ricarica questa pagina.', de: 'Lade diese Seite neu.' },
    c_maj_chrome1: { fr: 'Ouvre le fichier : il se dézippe.', en: 'Open the file: it unzips.', es: 'Abre el archivo: se descomprime.', it: 'Apri il file: si decomprime.', de: 'Öffne die Datei: sie wird entpackt.' },
    c_maj_chrome2: { fr: 'Remplace l’ancien dossier VRM.', en: 'Replace the old VRM folder.', es: 'Sustituye la carpeta VRM antigua.', it: 'Sostituisci la vecchia cartella VRM.', de: 'Ersetze den alten VRM-Ordner.' },
    c_maj_chrome3: { fr: 'chrome://extensions → ⟳ sur VRM.', en: 'chrome://extensions → ⟳ on VRM.', es: 'chrome://extensions → ⟳ en VRM.', it: 'chrome://extensions → ⟳ su VRM.', de: 'chrome://extensions → ⟳ bei VRM.' },
    c_favoris: { fr: 'Favoris', en: 'Favourites', es: 'Favoritos', it: 'Preferiti', de: 'Favoriten' },
    c_annonces: { fr: 'Annonces', en: 'Listings', es: 'Anuncios', it: 'Annunci', de: 'Anzeigen' },
    c_ventes: { fr: 'Ventes', en: 'Sales', es: 'Ventas', it: 'Vendite', de: 'Verkäufe' },
    c_ce_compte: { fr: 'Ce compte', en: 'This account', es: 'Esta cuenta', it: 'Questo account', de: 'Dieses Konto' },
    c_tous: { fr: 'Tous les comptes', en: 'All accounts', es: 'Todas las cuentas', it: 'Tutti gli account', de: 'Alle Konten' },
    c_details: { fr: 'Détails', en: 'Details', es: 'Detalles', it: 'Dettagli', de: 'Details' },
    c_fermer: { fr: 'Fermer', en: 'Close', es: 'Cerrar', it: 'Chiudi', de: 'Schließen' },
    c_tout_arreter: { fr: 'Tout arrêter', en: 'Stop everything', es: 'Detener todo', it: 'Ferma tutto', de: 'Alles stoppen' },
    c_reprendre: { fr: 'Reprendre', en: 'Resume', es: 'Reanudar', it: 'Riprendi', de: 'Fortsetzen' },
    c_arret_en_cours: { fr: 'Arrêt…', en: 'Stopping…', es: 'Deteniendo…', it: 'Arresto…', de: 'Wird gestoppt…' },
    // ── les messages aux favoris ──
    f_titre: { fr: 'Messages aux favoris', en: 'Messages to favourites', es: 'Mensajes a favoritos', it: 'Messaggi ai preferiti', de: 'Nachrichten an Favoriten' },
    f_sur: { fr: '{n} sur {total}', en: '{n} of {total}', es: '{n} de {total}', it: '{n} su {total}', de: '{n} von {total}' },
    f_prochain: { fr: 'prochain dans {dans}', en: 'next in {dans}', es: 'siguiente en {dans}', it: 'prossimo tra {dans}', de: 'nächste in {dans}' },
    f_part: { fr: 'un message part', en: 'a message is being sent', es: 'se envía un mensaje', it: 'un messaggio sta partendo', de: 'eine Nachricht wird gesendet' },
    f_pas: { fr: '{n} pas envoyé(s)', en: '{n} not sent', es: '{n} no enviado(s)', it: '{n} non inviato/i', de: '{n} nicht gesendet' },
    f_garde: { fr: 'Garde cet onglet ouvert : les messages partent d’ici, un par un.', en: 'Keep this tab open: messages go from here, one by one.', es: 'Deja esta pestaña abierta: los mensajes salen de aquí, uno a uno.', it: 'Tieni aperta questa scheda: i messaggi partono da qui, uno alla volta.', de: 'Lass diesen Tab offen: Die Nachrichten gehen von hier, eine nach der anderen.' },
    q_ouverture: { fr: 'Vinted vient d’être ouvert : VRM attend un peu', en: 'Vinted was just opened: VRM waits a little', es: 'Vinted acaba de abrirse: VRM espera un poco', it: 'Vinted è appena stato aperto: VRM aspetta un po’', de: 'Vinted wurde gerade geöffnet: VRM wartet kurz' },
    q_sorte: { fr: '15 par heure maximum', en: '15 per hour maximum', es: '15 por hora como máximo', it: '15 all’ora al massimo', de: 'höchstens 15 pro Stunde' },
    q_heure: { fr: '50 actions par heure maximum', en: '50 actions per hour maximum', es: '50 acciones por hora como máximo', it: '50 azioni all’ora al massimo', de: 'höchstens 50 Aktionen pro Stunde' },
    q_jour: { fr: 'plafond du jour atteint', en: 'daily limit reached', es: 'límite diario alcanzado', it: 'limite giornaliero raggiunto', de: 'Tageslimit erreicht' },
    q_rythme: { fr: 'ton espacement entre deux messages', en: 'your spacing between two messages', es: 'tu intervalo entre dos mensajes', it: 'il tuo intervallo tra due messaggi', de: 'dein Abstand zwischen zwei Nachrichten' },
    q_autre: { fr: 'un autre compte vient d’agir', en: 'another account just acted', es: 'otra cuenta acaba de actuar', it: 'un altro account ha appena agito', de: 'ein anderes Konto hat gerade gehandelt' },
    q_serie: { fr: 'la même série vient de passer sur un autre compte', en: 'the same series just ran on another account', es: 'la misma serie acaba de pasar en otra cuenta', it: 'la stessa serie è appena passata su un altro account', de: 'dieselbe Serie lief gerade auf einem anderen Konto' },
    q_rodage: { fr: 'compte récent : VRM y va doucement', en: 'new account: VRM goes gently', es: 'cuenta reciente: VRM va despacio', it: 'account recente: VRM va piano', de: 'neues Konto: VRM geht es sanft an' },
    q_espace: { fr: 'pas de rafale', en: 'no bursts', es: 'sin ráfagas', it: 'niente raffiche', de: 'keine Serienschüsse' },
    q_calme: { fr: 'moment calme', en: 'quiet moment', es: 'momento tranquilo', it: 'momento tranquillo', de: 'ruhige Phase' },
    f_en_haut: { fr: 'Les messages partent : suis-les en haut de la carte.', en: 'Messages are being sent: follow them at the top of the card.', es: 'Los mensajes se están enviando: síguelos arriba de la tarjeta.', it: 'I messaggi stanno partendo: seguili in cima alla scheda.', de: 'Die Nachrichten werden gesendet: Verfolge sie oben in der Karte.' },
    f_fin_robot: { fr: 'Arrêté : Vinted demande une vérification. Fais-la sur Vinted, puis relance d’ici.', en: 'Stopped: Vinted asks for a check. Do it on Vinted, then restart from here.', es: 'Detenido: Vinted pide una verificación. Hazla en Vinted y vuelve a lanzar desde aquí.', it: 'Fermato: Vinted chiede una verifica. Falla su Vinted, poi rilancia da qui.', de: 'Gestoppt: Vinted verlangt eine Prüfung. Erledige sie auf Vinted und starte dann hier neu.' },
    f_fin_arret: { fr: 'Arrêté, comme tu l’as demandé. Le reste n’est pas parti.', en: 'Stopped, as you asked. The rest was not sent.', es: 'Detenido, como pediste. El resto no se envió.', it: 'Fermato, come hai chiesto. Il resto non è partito.', de: 'Gestoppt, wie gewünscht. Der Rest wurde nicht gesendet.' },
    f_fin_interrompu: { fr: 'Interrompu : le reste n’est pas parti.', en: 'Interrupted: the rest was not sent.', es: 'Interrumpido: el resto no se envió.', it: 'Interrotto: il resto non è partito.', de: 'Unterbrochen: Der Rest wurde nicht gesendet.' },
    f_fin_interrompu_t: { fr: 'Interrompu : {t}', en: 'Interrupted: {t}', es: 'Interrumpido: {t}', it: 'Interrotto: {t}', de: 'Unterbrochen: {t}' },
    f_envoye_a: { fr: 'envoyé à {n} personne(s)', en: 'sent to {n} person(s)', es: 'enviado a {n} persona(s)', it: 'inviato a {n} persona/e', de: 'an {n} Person(en) gesendet' },
    f_envoyes: { fr: '{n} envoyé(s)', en: '{n} sent', es: '{n} enviado(s)', it: '{n} inviato/i', de: '{n} gesendet' },
    f_ensuite: { fr: 'Ensuite : les réponses arrivent dans tes messages Vinted.', en: 'Next: replies arrive in your Vinted messages.', es: 'Después: las respuestas llegan a tus mensajes de Vinted.', it: 'Poi: le risposte arrivano nei tuoi messaggi Vinted.', de: 'Danach: Antworten kommen in deinen Vinted-Nachrichten an.' },
    f_verifier: { fr: '{n} message(s) à vérifier sur Vinted : regarde la conversation avant de relancer.', en: '{n} message(s) to check on Vinted: look at the conversation before restarting.', es: '{n} mensaje(s) que revisar en Vinted: mira la conversación antes de relanzar.', it: '{n} messaggio/i da controllare su Vinted: guarda la conversazione prima di rilanciare.', de: '{n} Nachricht(en) auf Vinted prüfen: Schau dir das Gespräch an, bevor du neu startest.' },
    fa_tout_arrete: { fr: '« Tout arrêter » est posé : rien ne part. Touche « Reprendre » dans Détails.', en: '“Stop everything” is on: nothing is sent. Tap “Resume” in Details.', es: '«Detener todo» está activado: no sale nada. Toca «Reanudar» en Detalles.', it: '«Ferma tutto» è attivo: non parte nulla. Tocca «Riprendi» in Dettagli.', de: '„Alles stoppen“ ist aktiv: Nichts wird gesendet. Tippe in Details auf „Fortsetzen“.' },
    fa_reseau: { fr: 'Pas de réseau : rien ne part. Ça reprend tout seul.', en: 'No network: nothing is sent. It resumes by itself.', es: 'Sin red: no sale nada. Se reanuda solo.', it: 'Nessuna rete: non parte nulla. Riprende da solo.', de: 'Kein Netz: Nichts wird gesendet. Es geht von selbst weiter.' },
    fa_pause: { fr: 'Vinted demande de ralentir : rien ne part. Ça reprend tout seul après la pause.', en: 'Vinted asks to slow down: nothing is sent. It resumes after the pause.', es: 'Vinted pide ir más despacio: no sale nada. Se reanuda tras la pausa.', it: 'Vinted chiede di rallentare: non parte nulla. Riprende dopo la pausa.', de: 'Vinted bittet um Pause: Nichts wird gesendet. Es geht danach weiter.' },
    fa_autre_compte: { fr: 'Cet onglet est connecté sur un autre compte Vinted : rien ne part. Reviens sur le bon compte.', en: 'This tab is signed in to another Vinted account: nothing is sent. Switch back to the right one.', es: 'Esta pestaña está en otra cuenta de Vinted: no sale nada. Vuelve a la cuenta correcta.', it: 'Questa scheda è su un altro account Vinted: non parte nulla. Torna all’account giusto.', de: 'Dieser Tab ist mit einem anderen Vinted-Konto angemeldet: Nichts wird gesendet. Wechsle zurück.' },
    fa_onglet: { fr: 'Aucun onglet Vinted ouvert sur ce compte : rien ne part. Garde un onglet Vinted ouvert.', en: 'No Vinted tab open on this account: nothing is sent. Keep a Vinted tab open.', es: 'Ninguna pestaña de Vinted abierta en esta cuenta: no sale nada. Deja una abierta.', it: 'Nessuna scheda Vinted aperta su questo account: non parte nulla. Tienine una aperta.', de: 'Kein Vinted-Tab für dieses Konto offen: Nichts wird gesendet. Lass einen Vinted-Tab offen.' },
    fa_vrm: { fr: 'VRM ne répond pas pour l’instant : rien ne part. Ça reprend tout seul.', en: 'VRM is not answering right now: nothing is sent. It resumes by itself.', es: 'VRM no responde ahora: no sale nada. Se reanuda solo.', it: 'VRM non risponde ora: non parte nulla. Riprende da solo.', de: 'VRM antwortet gerade nicht: Nichts wird gesendet. Es geht von selbst weiter.' },
    fa_verification: { fr: 'Vinted demande une vérification : fais-la sur Vinted. Rien ne part avant.', en: 'Vinted asks for a check: do it on Vinted. Nothing is sent until then.', es: 'Vinted pide una verificación: hazla en Vinted. No sale nada antes.', it: 'Vinted chiede una verifica: falla su Vinted. Non parte nulla prima.', de: 'Vinted verlangt eine Prüfung: Erledige sie auf Vinted. Vorher wird nichts gesendet.' },
    fa_garde: { fr: 'Une protection du compte retient la suite : rien ne part. Regarde « Sécurité du compte ».', en: 'An account safeguard holds the rest: nothing is sent. See “Account safety”.', es: 'Una protección de la cuenta retiene el resto: no sale nada. Mira «Seguridad de la cuenta».', it: 'Una protezione dell’account trattiene il resto: non parte nulla. Vedi «Sicurezza dell’account».', de: 'Ein Kontoschutz hält den Rest zurück: Nichts wird gesendet. Siehe „Kontosicherheit“.' },
    // ── l'écran « action en cours » ──
    a_favoris: { fr: 'Envoi des messages aux favoris', en: 'Sending messages to favourites', es: 'Enviando mensajes a favoritos', it: 'Invio dei messaggi ai preferiti', de: 'Nachrichten an Favoriten werden gesendet' },
    a_republier: { fr: 'Republication', en: 'Relisting', es: 'Republicación', it: 'Ripubblicazione', de: 'Neu einstellen' },
    // ── (5.408) la chaîne d'une paire pendant la republication ──
    r_coffre: { fr: 'Coffre', en: 'Vault', es: 'Copia', it: 'Archivio', de: 'Tresor' },
    r_brouillon: { fr: 'Brouillon', en: 'Draft', es: 'Borrador', it: 'Bozza', de: 'Entwurf' },
    r_supprimee: { fr: 'Supprimée', en: 'Deleted', es: 'Eliminado', it: 'Eliminato', de: 'Gelöscht' },
    r_enligne: { fr: 'En ligne', en: 'Online', es: 'Publicado', it: 'Online', de: 'Online' },
    r_enligne_dans: { fr: 'En ligne dans {dans}', en: 'Online in {dans}', es: 'Publicado en {dans}', it: 'Online tra {dans}', de: 'Online in {dans}' },
    r_photos: { fr: 'photo {fait} sur {total}', en: 'photo {fait} of {total}', es: 'foto {fait} de {total}', it: 'foto {fait} di {total}', de: 'Foto {fait} von {total}' },
    r_etapes: { fr: 'Étapes de cette annonce', en: 'Steps for this listing', es: 'Pasos de este anuncio', it: 'Passaggi di questo annuncio', de: 'Schritte für diese Anzeige' },
    a_baisse: { fr: 'Baisse des prix', en: 'Lowering prices', es: 'Bajada de precios', it: 'Ribasso dei prezzi', de: 'Preise senken' },
    a_offres: { fr: 'Réponse aux offres', en: 'Answering offers', es: 'Respuesta a ofertas', it: 'Risposta alle offerte', de: 'Angebote beantworten' },
    a_faites: { fr: '{n} fait(s)', en: '{n} done', es: '{n} hecho(s)', it: '{n} fatto/i', de: '{n} erledigt' },
    a_en_cours: { fr: 'En cours sur Vinted…', en: 'Working on Vinted…', es: 'En curso en Vinted…', it: 'In corso su Vinted…', de: 'Läuft auf Vinted…' },
    a_ensuite: { fr: 'Ensuite dans {dans}', en: 'Next in {dans}', es: 'Después en {dans}', it: 'Poi tra {dans}', de: 'Weiter in {dans}' },
    a_suivants: { fr: 'Ensuite', en: 'Up next', es: 'Después', it: 'Poi', de: 'Als Nächstes' },
    a_en_direct: { fr: 'en cours sur Vinted', en: 'working on Vinted', es: 'en curso en Vinted', it: 'in corso su Vinted', de: 'läuft auf Vinted' },
    a_reduire: { fr: 'Réduire', en: 'Minimise', es: 'Reducir', it: 'Riduci', de: 'Verkleinern' },
    a_agrandir: { fr: 'Afficher', en: 'Show', es: 'Mostrar', it: 'Mostra', de: 'Anzeigen' },
    a_bloque: { fr: 'Vinted est verrouillé pendant que VRM agit. « Réduire » pour continuer à naviguer.', en: 'Vinted is locked while VRM works. “Minimise” to keep browsing.', es: 'Vinted queda bloqueado mientras VRM actúa. «Reducir» para seguir navegando.', it: 'Vinted è bloccato mentre VRM agisce. «Riduci» per continuare a navigare.', de: 'Vinted ist gesperrt, während VRM arbeitet. „Verkleinern“, um weiterzusurfen.' },
    a_arrete: { fr: 'Arrêté. Rien d’autre ne part.', en: 'Stopped. Nothing else is sent.', es: 'Detenido. No sale nada más.', it: 'Fermato. Non parte nient’altro.', de: 'Gestoppt. Nichts weiter wird gesendet.' },
    a_fini: { fr: 'Terminé', en: 'Done', es: 'Terminado', it: 'Finito', de: 'Fertig' },
    a_verif: { fr: 'Vinted demande une vérification : fais-la sur la page. VRM attend, rien ne part.', en: 'Vinted asks for a check: do it on the page. VRM waits, nothing is sent.', es: 'Vinted pide una verificación: hazla en la página. VRM espera, no sale nada.', it: 'Vinted chiede una verifica: falla sulla pagina. VRM aspetta, non parte nulla.', de: 'Vinted verlangt eine Prüfung: Erledige sie auf der Seite. VRM wartet, nichts wird gesendet.' },
    a_verif_robot: { fr: 'Vinted demande une vérification (anti-robot). Fais-la ici sur la page.', en: 'Vinted asks for a check (anti-bot). Do it here on the page.', es: 'Vinted pide una verificación (anti-robot). Hazla aquí en la página.', it: 'Vinted chiede una verifica (anti-robot). Falla qui sulla pagina.', de: 'Vinted verlangt eine Prüfung (Anti-Bot). Erledige sie hier auf der Seite.' },
    a_verif_compte: { fr: '{n} sur {total} envoyés · {reste} en attente', en: '{n} of {total} sent · {reste} waiting', es: '{n} de {total} enviados · {reste} en espera', it: '{n} su {total} inviati · {reste} in attesa', de: '{n} von {total} gesendet · {reste} warten' },
    a_verif_faite: { fr: 'Vérification faite', en: 'Check done', es: 'Verificación hecha', it: 'Verifica fatta', de: 'Prüfung erledigt' },
    a_doucement: { fr: 'On reprend plus doucement pendant 24 h.', en: 'We resume more slowly for 24 h.', es: 'Se reanuda más despacio durante 24 h.', it: 'Si riprende più lentamente per 24 h.', de: 'Es geht 24 h lang langsamer weiter.' },
    a_reprendre: { fr: 'Reprendre', en: 'Resume', es: 'Reanudar', it: 'Riprendi', de: 'Fortsetzen' },
    a_vinted_dit: { fr: 'Vinted affiche un message : lis-le, VRM se met de côté.', en: 'Vinted shows a message: read it, VRM steps aside.', es: 'Vinted muestra un mensaje: léelo, VRM se aparta.', it: 'Vinted mostra un messaggio: leggilo, VRM si fa da parte.', de: 'Vinted zeigt eine Meldung: Lies sie, VRM tritt zur Seite.' },
    // ── messages brefs, bandeaux, alertes ──
    t_ok: { fr: 'C’est fait', en: 'Done', es: 'Hecho', it: 'Fatto', de: 'Erledigt' },
    d_titre: { fr: 'VRM · avant de publier', en: 'VRM · before publishing', es: 'VRM · antes de publicar', it: 'VRM · prima di pubblicare', de: 'VRM · vor dem Veröffentlichen' },
    // ── 5.407 : la liste des favoris à cocher et son récapitulatif ──
    fl_lu: { fr: '{n} favoris · du plus récent au plus ancien', en: '{n} favourites · newest first', es: '{n} favoritos · del más reciente al más antiguo', it: '{n} preferiti · dal più recente al più vecchio', de: '{n} Favoriten · neueste zuerst' },
    fl_coches: { fr: '{n} cochés', en: '{n} selected', es: '{n} marcados', it: '{n} selezionati', de: '{n} ausgewählt' },
    fl_coche1: { fr: '1 coché', en: '1 selected', es: '1 marcado', it: '1 selezionato', de: '1 ausgewählt' },
    fl_max: { fr: '{max} par heure maximum', en: '{max} per hour at most', es: '{max} por hora como máximo', it: 'al massimo {max} all’ora', de: 'höchstens {max} pro Stunde' },
    fl_tout: { fr: 'Tout cocher', en: 'Select all', es: 'Marcar todo', it: 'Seleziona tutto', de: 'Alle auswählen' },
    fl_rien: { fr: 'Rien', en: 'None', es: 'Ninguno', it: 'Nessuno', de: 'Keine' },
    fl_toutes: { fr: 'Toutes les annonces', en: 'All listings', es: 'Todos los anuncios', it: 'Tutti gli annunci', de: 'Alle Anzeigen' },
    fl_annonce: { fr: 'Filtrer par annonce', en: 'Filter by listing', es: 'Filtrar por anuncio', it: 'Filtra per annuncio', de: 'Nach Anzeige filtern' },
    fl_nouveaux: { fr: 'Pas encore contactés', en: 'Not contacted yet', es: 'Aún sin contactar', it: 'Non ancora contattati', de: 'Noch nicht kontaktiert' },
    fl_envoyer: { fr: 'Envoyer à {n} favoris', en: 'Send to {n} favourites', es: 'Enviar a {n} favoritos', it: 'Invia a {n} preferiti', de: 'An {n} Favoriten senden' },
    fl_envoyer1: { fr: 'Envoyer à 1 favori', en: 'Send to 1 favourite', es: 'Enviar a 1 favorito', it: 'Invia a 1 preferito', de: 'An 1 Favoriten senden' },
    fl_aucun: { fr: 'Coche au moins un favori pour lui écrire.', en: 'Select at least one favourite to write to.', es: 'Marca al menos un favorito para escribirle.', it: 'Seleziona almeno un preferito a cui scrivere.', de: 'Wähle mindestens einen Favoriten aus, um ihm zu schreiben.' },
    fl_reste: { fr: 'Les {n} autres restent cochés : ils partiront à l’envoi suivant ({max} par heure maximum).', en: 'The other {n} stay selected: they go with the next send ({max} per hour at most).', es: 'Los otros {n} siguen marcados: saldrán en el siguiente envío ({max} por hora como máximo).', it: 'Gli altri {n} restano selezionati: partiranno con l’invio successivo (al massimo {max} all’ora).', de: 'Die anderen {n} bleiben ausgewählt: Sie gehen mit dem nächsten Versand ({max} pro Stunde höchstens).' },
    fl_suivants: { fr: 'Envoyer les {n} suivants à {h}', en: 'Send the next {n} at {h}', es: 'Enviar los {n} siguientes a las {h}', it: 'Invia i {n} successivi alle {h}', de: 'Die nächsten {n} um {h} senden' },
    fl_mini: { fr: 'mini {p}', en: 'min {p}', es: 'mín. {p}', it: 'min {p}', de: 'min. {p}' },
    fl_mini_rien: { fr: 'mini —', en: 'min —', es: 'mín. —', it: 'min —', de: 'min. —' },
    fl_sans_mini: { fr: '{n} sans prix mini', en: '{n} without a minimum price', es: '{n} sin precio mínimo', it: '{n} senza prezzo minimo', de: '{n} ohne Mindestpreis' },
    fl_fixer: { fr: 'Fixer', en: 'Set', es: 'Fijar', it: 'Imposta', de: 'Festlegen' },
    fr_sous_mini: { fr: 'offre {o} < mini {m}', en: 'offer {o} < min {m}', es: 'oferta {o} < mín. {m}', it: 'offerta {o} < min {m}', de: 'Angebot {o} < min. {m}' },
    fr_sous_n: { fr: '{n} offre(s) sous le prix mini de l’article : décoche-les ou fixe le mini avant d’envoyer.', en: '{n} offer(s) below the item’s minimum price: unselect them or set the minimum before sending.', es: '{n} oferta(s) por debajo del precio mínimo: desmárcalas o fija el mínimo antes de enviar.', it: '{n} offerta/e sotto il prezzo minimo: deselezionale o imposta il minimo prima di inviare.', de: '{n} Angebot(e) unter dem Mindestpreis: abwählen oder Mindestpreis festlegen, bevor du sendest.' },
    fr_decocher: { fr: 'Les décocher', en: 'Unselect them', es: 'Desmarcarlas', it: 'Deselezionale', de: 'Abwählen' },
    fl_voir: { fr: 'Voir les {n} suivants', en: 'Show the next {n}', es: 'Ver los {n} siguientes', it: 'Mostra i {n} successivi', de: 'Die nächsten {n} anzeigen' },
    fl_e_offre: { fr: 'offre déjà envoyée', en: 'offer already sent', es: 'oferta ya enviada', it: 'offerta già inviata', de: 'Angebot bereits gesendet' },
    fl_e_message: { fr: 'message déjà envoyé', en: 'message already sent', es: 'mensaje ya enviado', it: 'messaggio già inviato', de: 'Nachricht bereits gesendet' },
    fl_e_encours: { fr: 'message en cours', en: 'message in progress', es: 'mensaje en curso', it: 'messaggio in corso', de: 'Nachricht läuft' },
    fl_e_verifier: { fr: 'à vérifier sur Vinted', en: 'to check on Vinted', es: 'por comprobar en Vinted', it: 'da verificare su Vinted', de: 'auf Vinted prüfen' },
    fl_e_pas: { fr: 'pas envoyé, pas reproposé', en: 'not sent, not offered again', es: 'no enviado, no se vuelve a proponer', it: 'non inviato, non riproposto', de: 'nicht gesendet, nicht erneut angeboten' },
    fl_e_prouve: { fr: 'destinataire pas encore sûr : ouvre ce favori depuis la cloche de Vinted', en: 'recipient not confirmed yet: open this favourite from the Vinted bell', es: 'destinatario aún no seguro: abre este favorito desde la campana de Vinted', it: 'destinatario non ancora certo: apri questo preferito dalla campanella di Vinted', de: 'Empfänger noch nicht sicher: Öffne diesen Favoriten über die Vinted-Glocke' },
    fl_e_prix: { fr: 'prix de l’offre pas calculable', en: 'offer price can’t be worked out', es: 'precio de la oferta no calculable', it: 'prezzo dell’offerta non calcolabile', de: 'Angebotspreis nicht berechenbar' },
    fl_caches: { fr: '{n} favoris d’articles vendus ou retirés : cachés', en: '{n} favourites of sold or removed items: hidden', es: '{n} favoritos de artículos vendidos o retirados: ocultos', it: '{n} preferiti di articoli venduti o ritirati: nascosti', de: '{n} Favoriten verkaufter oder entfernter Artikel: ausgeblendet' },
    fl_vide: { fr: 'Aucun favori avec ce filtre.', en: 'No favourite with this filter.', es: 'Ningún favorito con este filtro.', it: 'Nessun preferito con questo filtro.', de: 'Kein Favorit mit diesem Filter.' },
    fl_plus: { fr: 'Les {n} plus récents sur {total}.', en: 'The {n} most recent of {total}.', es: 'Los {n} más recientes de {total}.', it: 'I {n} più recenti su {total}.', de: 'Die {n} neuesten von {total}.' },
    fl_personne: { fr: 'Personne à qui écrire pour l’instant : chaque favori ci-dessous a déjà été contacté ou attend.', en: 'No one to write to for now: each favourite below has already been contacted or is waiting.', es: 'Nadie a quien escribir por ahora: cada favorito de abajo ya fue contactado o está en espera.', it: 'Nessuno a cui scrivere per ora: ogni preferito qui sotto è già stato contattato o è in attesa.', de: 'Im Moment niemand zum Anschreiben: Jeder Favorit unten wurde schon kontaktiert oder wartet.' },
    fl_acheteur: { fr: 'Un acheteur', en: 'A buyer', es: 'Un comprador', it: 'Un acquirente', de: 'Ein Käufer' },
    fl_article: { fr: 'Article', en: 'Item', es: 'Artículo', it: 'Articolo', de: 'Artikel' },
    fl_cocher: { fr: 'Écrire à {qui}', en: 'Write to {qui}', es: 'Escribir a {qui}', it: 'Scrivi a {qui}', de: '{qui} schreiben' },
    fr_par: { fr: '{n} favoris', en: '{n} favourites', es: '{n} favoritos', it: '{n} preferiti', de: '{n} Favoriten' },
    fr_par1: { fr: '1 favori', en: '1 favourite', es: '1 favorito', it: '1 preferito', de: '1 Favorit' },
    fr_offre: { fr: 'offre à {p}', en: 'offer at {p}', es: 'oferta a {p}', it: 'offerta a {p}', de: 'Angebot zu {p}' },
    fr_offre_mode: { fr: 'Avec une offre {o}', en: 'With an offer {o}', es: 'Con una oferta {o}', it: 'Con un’offerta {o}', de: 'Mit einem Angebot {o}' },
    fr_sans_offre: { fr: 'Sans offre de prix', en: 'No price offer', es: 'Sin oferta de precio', it: 'Senza offerta di prezzo', de: 'Ohne Preisangebot' },
    fr_arrondi: { fr: 'arrondie à l’euro', en: 'rounded to the euro', es: 'redondeada al euro', it: 'arrotondata all’euro', de: 'auf den Euro gerundet' },
    fr_message: { fr: 'Le message', en: 'The message', es: 'El mensaje', it: 'Il messaggio', de: 'Die Nachricht' },
    fr_versions: { fr: 'une de tes {n} versions, au hasard', en: 'one of your {n} versions, at random', es: 'una de tus {n} versiones, al azar', it: 'una delle tue {n} versioni, a caso', de: 'eine deiner {n} Versionen, zufällig' },
    fr_duree: { fr: 'Environ {d} · {h} par heure maximum', en: 'About {d} · {h} per hour at most', es: 'Unos {d} · {h} por hora como máximo', it: 'Circa {d} · al massimo {h} all’ora', de: 'Etwa {d} · höchstens {h} pro Stunde' },
    fr_rien_avant: { fr: 'Rien ne part avant « Confirmer l’envoi ». Garde cet onglet Vinted ouvert ; tu peux tout arrêter à tout moment.', en: 'Nothing is sent before “Confirm sending”. Keep this Vinted tab open; you can stop everything at any time.', es: 'No sale nada antes de «Confirmar el envío». Deja esta pestaña de Vinted abierta; puedes pararlo todo en cualquier momento.', it: 'Non parte nulla prima di «Conferma l’invio». Tieni aperta questa scheda di Vinted; puoi fermare tutto in qualsiasi momento.', de: 'Nichts wird vor „Senden bestätigen“ gesendet. Lass diesen Vinted-Tab offen; du kannst jederzeit alles stoppen.' },
    fr_confirmer: { fr: 'Confirmer l’envoi', en: 'Confirm sending', es: 'Confirmar el envío', it: 'Conferma l’invio', de: 'Senden bestätigen' },
    fr_retour: { fr: 'Retour à la liste', en: 'Back to the list', es: 'Volver a la lista', it: 'Torna alla lista', de: 'Zurück zur Liste' },
    fr_envoi: { fr: 'Envoi…', en: 'Sending…', es: 'Enviando…', it: 'Invio…', de: 'Wird gesendet…' },
  };
  const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
  const langue = () => {
    let l = '';
    try { l = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || ''; } catch (_) { l = ''; }
    if (!l) { try { l = navigator.language || ''; } catch (_) { l = ''; } }
    l = String(l).slice(0, 2).toLowerCase();
    return LANGUES.includes(l) ? l : 'fr';
  };
  const LANGUE = langue();
  const T = (cle, vars) => {
    const m = MOTS[cle];
    let s = m ? (m[LANGUE] || m.fr) : String(cle);
    return vars ? String(s).replace(/\{(\w+)\}/g, (x, k) => (k in vars ? String(vars[k]) : x)) : s;
  };
  // La durée « 3 min », « 45 s », « 1 h 05 » (unités communes aux cinq langues).
  const duree = (ms) => { const s = Math.max(0, Math.round(Number(ms) / 1000)); if (s < 60) return s + ' s'; const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ══ LA FEUILLE ══════════════════════════════════════════════════════════
  // Les jetons vivent sur `:host` (une shadow root) ET sur `.vu-racine` (un élément de page) :
  // la même feuille sert les deux. Le JOUR par défaut ; la NUIT par le système, ou par le choix
  // fait dans VRM (`data-theme` « sombre » / « clair » posé sur l'hôte, 5.351).
  const JOUR = `--vu-coque-uni:#174C88;--vu-coque:radial-gradient(120% 60% at 12% 0%,rgb(120 180 240/.16) 0%,rgb(120 180 240/0) 55%),linear-gradient(170deg,#1E5DA4 0%,#174C88 45%,#0F2F57 100%);
    --vu-sur:#FFFFFF;--vu-sur-2:#E6EFF9;--vu-plaque:#FFFFFF;--vu-plaque-2:#F4F8FC;--vu-encre:#0C1D30;--vu-muet:#4A5B6D;--vu-filet:rgb(18 52 96/.12);
    --vu-ombre:0 .5px 0 rgb(18 52 96/.06),0 1px 2px rgb(18 52 96/.08),0 10px 24px -14px rgb(18 52 96/.32);
    --vu-plein:#FFFFFF;--vu-plein-appui:#DCE6F1;--vu-plein-encre:#0C1D30;--vu-plein-sur-plaque:#0C1D30;--vu-plein-sur-plaque-encre:#FFFFFF;
    --vu-teinte:rgb(0 96 204/.10);--vu-teinte-appui:rgb(0 96 204/.18);--vu-teinte-encre:#0050A8;--vu-lien:#0050A8;--vu-anneau:0 0 0 3px rgb(0 96 204/.45);
    --vu-ambre:#8A4B00;--vu-ambre-point:#E08A12;--vu-ok:#1F7A3A;--vu-socle:#E3ECF5;--vu-barre:#0060CC;
    --vu-kraft:#E9DCC4;--vu-kraft-encre:#2A2116;--vu-kraft-doux:#6B5A40;--vu-kraft-bord:rgb(42 33 22/.22);
    --vu-voile:rgb(10 22 40/.55);--vu-toast:#0C1D30;--vu-toast-encre:#F2F7FD;`;
  const NUIT = `--vu-coque-uni:#0C2848;--vu-coque:radial-gradient(120% 60% at 12% 0%,rgb(90 150 220/.14) 0%,rgb(90 150 220/0) 60%),linear-gradient(170deg,#133A68 0%,#0C2848 50%,#06142A 100%);
    --vu-sur:#F2F7FD;--vu-sur-2:#C9D8E8;--vu-plaque:#16273C;--vu-plaque-2:#1C2F47;--vu-encre:#F2F7FD;--vu-muet:#A7B8CB;--vu-filet:rgb(255 255 255/.10);
    --vu-ombre:0 0 0 .5px rgb(255 255 255/.06),0 12px 26px -14px rgb(0 0 0/.85);
    --vu-plein:#EAF2FB;--vu-plein-appui:#C9D9EA;--vu-plein-encre:#06111F;--vu-plein-sur-plaque:#EAF2FB;--vu-plein-sur-plaque-encre:#06111F;
    --vu-teinte:rgb(74 163 255/.16);--vu-teinte-appui:rgb(74 163 255/.26);--vu-teinte-encre:#8CC4FF;--vu-lien:#8CC4FF;--vu-anneau:0 0 0 3px rgb(140 196 255/.55);
    --vu-ambre:#F2B65E;--vu-ambre-point:#F2A33A;--vu-ok:#7FD39A;--vu-socle:#24384F;--vu-barre:#8CC4FF;
    --vu-kraft:#3A3226;--vu-kraft-encre:#F3E9D6;--vu-kraft-doux:#CDBB9C;--vu-kraft-bord:rgb(243 233 214/.22);
    --vu-voile:rgb(2 8 18/.66);--vu-toast:#EAF2FB;--vu-toast-encre:#06111F;`;
  const CSS = `
  :host, .vu-racine { ${JOUR} }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])), .vu-racine:not([data-theme="clair"]) { ${NUIT} } }
  :host([data-theme="sombre"]), .vu-racine[data-theme="sombre"] { ${NUIT} }
  :host, .vu-racine { --vu-police: "Inter VRM", Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    --vu-e-appui: 100ms cubic-bezier(.2,.9,.25,1); --vu-e-retour: 200ms cubic-bezier(.32,1.25,.5,1); }
  .vu-racine, .vu-racine * , .vu-coque, .vu-coque * { box-sizing: border-box; }
  .vu-coque { background-color: var(--vu-coque-uni); background-image: var(--vu-coque); color: var(--vu-sur); border: 1px solid rgb(255 255 255/.14); border-radius: 22px;
    box-shadow: 0 1px 2px rgb(0 0 0/.18), 0 30px 60px -24px rgb(8 26 50/.7); font: 400 14px/1.4 var(--vu-police); -webkit-font-smoothing: antialiased; }
  .vu-plaque { background: var(--vu-plaque); color: var(--vu-encre); border-radius: 18px; box-shadow: var(--vu-ombre); }
  .vu-muet { color: var(--vu-muet); }
  .vu-sur-muet { color: var(--vu-sur-2); }
  .vu-chiffres { font-feature-settings: "tnum" 1, "lnum" 1; font-variant-numeric: tabular-nums; }
  /* Les boutons : TROIS formes. Le plein (un seul à l'écran), le secondaire teinté, le lien. */
  .vu-btn { appearance: none; -webkit-appearance: none; margin: 0; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 16px; border-radius: 14px; font: 600 15px/1.2 var(--vu-police); cursor: pointer; text-decoration: none; text-align: center;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none; -webkit-user-select: none;
    transition: transform var(--vu-e-retour), background-color 160ms ease, filter 160ms ease; }
  .vu-btn:active:not(:disabled) { transform: scale(.97); transition: transform var(--vu-e-appui); }
  .vu-btn:focus-visible, .vu-seg button:focus-visible, .vu-lien:focus-visible { outline: none; box-shadow: var(--vu-anneau); }
  .vu-btn:disabled { opacity: .5; cursor: default; }
  .vu-plein { min-height: 50px; width: 100%; font-size: 16px; background: var(--vu-plein); color: var(--vu-plein-encre); box-shadow: 0 1px 2px rgb(0 0 0/.18), 0 10px 22px -12px rgb(12 29 48/.6); }
  .vu-plein:active:not(:disabled) { background: var(--vu-plein-appui); }
  .vu-plaque .vu-plein { background: var(--vu-plein-sur-plaque); color: var(--vu-plein-sur-plaque-encre); }
  .vu-sec { background: var(--vu-teinte); color: var(--vu-teinte-encre); }
  .vu-sec:active:not(:disabled) { background: var(--vu-teinte-appui); }
  .vu-coque > .vu-sec, .vu-sur-coque .vu-sec { background: rgb(255 255 255/.16); color: var(--vu-sur); }
  .vu-lien { appearance: none; border: 0; background: transparent; padding: 0 4px; min-height: 44px; display: inline-flex; align-items: center; color: var(--vu-lien); font: 600 14px/1.2 var(--vu-police); cursor: pointer; text-decoration: none; }
  .vu-sur-coque .vu-lien { color: var(--vu-sur); text-decoration: underline; text-underline-offset: 3px; }
  /* Le contrôle segmenté : une piste, l'onglet choisi en porcelaine. */
  .vu-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0,1fr); gap: 2px; padding: 3px; border-radius: 14px; background: var(--vu-socle); }
  .vu-sur-coque .vu-seg, .vu-coque > .vu-seg { background: rgb(0 0 0/.22); }
  .vu-seg button { appearance: none; border: 0; min-height: 44px; padding: 0 8px; border-radius: 11px; background: transparent; color: var(--vu-muet);
    font: 600 14px/1.2 var(--vu-police); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-tap-highlight-color: transparent; touch-action: manipulation; position: relative; }
  .vu-sur-coque .vu-seg button, .vu-coque > .vu-seg button { color: var(--vu-sur-2); }
  .vu-seg button[aria-selected="true"], .vu-seg button[aria-pressed="true"] { background: var(--vu-plaque); color: var(--vu-encre); box-shadow: 0 1px 2px rgb(0 0 0/.16), 0 3px 8px -4px rgb(0 0 0/.3); }
  /* L'étiquette N° en kraft : coin coupé, œillet, chiffres tabulaires (la signature de VRM). */
  .vu-n { position: relative; display: inline-flex; align-items: baseline; gap: 2px; flex: none; height: 24px; padding: 3px 9px 0 14px; background: var(--vu-kraft); color: var(--vu-kraft-encre);
    clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%); border-radius: 3px; box-shadow: inset 0 0 0 .5px var(--vu-kraft-bord);
    font: 700 14px/18px var(--vu-police); font-feature-settings: "tnum" 1, "lnum" 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vu-n small { font-size: 10px; font-weight: 600; color: var(--vu-kraft-doux); }
  .vu-n::before { content: ''; position: absolute; left: 5px; top: 50%; width: 4px; height: 4px; margin-top: -2px; border-radius: 50%; background: var(--vu-plaque); box-shadow: inset 0 0 0 .5px var(--vu-kraft-bord); }
  .vu-n.vu-grand { height: 40px; padding: 7px 14px 0 22px; font-size: 22px; line-height: 28px; clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%); }
  .vu-n.vu-grand small { font-size: 13px; }
  .vu-n.vu-grand::before { left: 8px; width: 6px; height: 6px; margin-top: -3px; }
  /* La progression : un trait fin. */
  .vu-barre { height: 4px; border-radius: 999px; background: var(--vu-socle); overflow: hidden; }
  .vu-sur-coque .vu-barre { background: rgb(255 255 255/.18); }
  .vu-barre > i { display: block; height: 100%; border-radius: 999px; background: var(--vu-barre); transition: width .4s cubic-bezier(.32,.72,0,1); }
  .vu-sur-coque .vu-barre > i { background: var(--vu-sur); }
  /* Le point d'état : neutre quand tout va bien (§7), ambre pour un geste, creux pour une pause. */
  .vu-point { display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: #7FD39A; flex: none; box-shadow: 0 0 0 3px rgb(127 211 154/.22); }
  .vu-point[data-k="geste"] { background: var(--vu-ambre-point); box-shadow: 0 0 0 3px rgb(224 138 18/.25); }
  .vu-point[data-k="pause"], .vu-point[data-k="prudence"], .vu-point[data-k="attente"], .vu-point[data-k="reseau"], .vu-point[data-k="arrete"] { background: transparent; box-shadow: inset 0 0 0 2px currentColor; }
  /* Le bandeau fin (une nouvelle version) et la ligne secondaire. */
  .vu-bandeau { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 4px 4px 4px 14px; border-radius: 14px; background: rgb(255 255 255/.12); color: var(--vu-sur); font: 600 13px/1.3 var(--vu-police); }
  .vu-bandeau > span { flex: 1; min-width: 0; }
  .vu-sous { font: 500 13px/1.4 var(--vu-police); color: var(--vu-sur-2); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .vu-sous b { color: var(--vu-sur); font-weight: 600; }
  /* Le message bref (en bas, au centre) et le bandeau posés dans la PAGE (hôtes à nous). */
  .vu-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483646; max-width: min(460px, calc(100vw - 32px));
    padding: 12px 16px; border-radius: 14px; background: var(--vu-toast); color: var(--vu-toast-encre); font: 600 14px/1.4 var(--vu-police);
    box-shadow: 0 1px 2px rgb(0 0 0/.25), 0 16px 36px -12px rgb(0 0 0/.55); }
  @media (prefers-reduced-motion: reduce) { .vu-btn, .vu-barre > i { transition: none; } .vu-btn:active:not(:disabled) { transform: none; } }
  `;
  // La même feuille pour un élément de PAGE (bandeaux et messages brefs de lbc.js, vc-depot.js,
  // ebay.js) : un seul <style id="vrm-ui-page"> dans le document, des sélecteurs à nous seuls.
  const CSS_PAGE = `
  [data-vrm-ui] { all: initial; }
  [data-vrm-ui] { ${JOUR} --vu-police: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif; }
  @media (prefers-color-scheme: dark) { [data-vrm-ui] { ${NUIT} } }
  [data-vrm-ui="toast"] { position: fixed !important; left: 50% !important; bottom: 24px !important; transform: translateX(-50%) !important; z-index: 2147483646 !important;
    display: block; max-width: min(460px, calc(100vw - 32px)); padding: 12px 16px; border-radius: 14px; background: var(--vu-toast); color: var(--vu-toast-encre);
    font: 600 14px/1.4 var(--vu-police); box-shadow: 0 1px 2px rgb(0 0 0/.25), 0 16px 36px -12px rgb(0 0 0/.55); transition: opacity .2s ease; }
  [data-vrm-ui="bandeau"] { position: fixed !important; left: 16px !important; bottom: 16px !important; z-index: 2147483645 !important; display: block;
    width: max-content; max-width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 14px 16px; border-radius: 18px;
    background-color: var(--vu-coque-uni); background-image: var(--vu-coque); color: var(--vu-sur); border: 1px solid rgb(255 255 255/.14);
    font: 400 14px/1.45 var(--vu-police); box-shadow: 0 1px 2px rgb(0 0 0/.18), 0 30px 60px -24px rgb(8 26 50/.7); }
  [data-vrm-ui] b, [data-vrm-ui] strong { font-weight: 700; }
  [data-vrm-ui] a { color: inherit; text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
  [data-vrm-ui] button { all: initial; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 8px 8px 0 0; padding: 0 16px;
    border-radius: 14px; background: var(--vu-plein); color: var(--vu-plein-encre); font: 600 14px/1.2 var(--vu-police); cursor: pointer; }
  [data-vrm-ui] button:focus-visible { box-shadow: var(--vu-anneau); }
  [data-vrm-ui] button + button { background: rgb(255 255 255/.16); color: var(--vu-sur); }
  [data-vrm-ui] div, [data-vrm-ui] p, [data-vrm-ui] span, [data-vrm-ui] ul, [data-vrm-ui] li { font: inherit; color: inherit; }
  [data-vrm-ui] div + div, [data-vrm-ui] p { display: block; margin-top: 4px; }
  /* Les anciens gabarits portaient leurs couleurs en ligne (gris sur noir) : sur la coque bleue,
     la feuille commune les reprend (contraste ≥ 4,5:1), sans toucher au texte. */
  [data-vrm-ui="bandeau"] [style*="color:#8A93A3"], [data-vrm-ui="bandeau"] [style*="color:#6B7485"], [data-vrm-ui="bandeau"] [style*="color:#8b95a5"] { color: var(--vu-sur-2) !important; }
  [data-vrm-ui="bandeau"] [style*="color:#E8ECF2"] { color: var(--vu-sur) !important; }
  [data-vrm-ui="bandeau"] [style*="color:#F5A524"] { color: #FFE2A8 !important; }
  [data-vrm-ui] button[style] { border: 0 !important; min-height: 44px !important; padding: 0 16px !important; border-radius: 14px !important; font: 600 14px/1.2 var(--vu-police) !important; }
  [data-vrm-ui] button[style]:first-of-type { background: var(--vu-plein) !important; color: var(--vu-plein-encre) !important; }
  [data-vrm-ui] button[style] ~ button[style] { background: rgb(255 255 255/.16) !important; color: var(--vu-sur) !important; }
  @media (prefers-reduced-motion: reduce) { [data-vrm-ui] { transition: none !important; } }
  `;
  // Pose la feuille dans une shadow root (ou un élément), une fois.
  function monter(racine) {
    try {
      if (!racine || racine.querySelector && racine.querySelector('style[data-vrm-ui-css]')) return;
      const st = document.createElement('style'); st.setAttribute('data-vrm-ui-css', ''); st.textContent = CSS;
      racine.insertBefore ? racine.insertBefore(st, racine.firstChild) : racine.appendChild(st);
    } catch (_) {}
  }
  // Un élément de PAGE (à nous : un id `vrm-…`) habillé par la feuille commune — plus de style en ligne.
  function habiller(el, sorte) {
    try {
      if (!document.getElementById('vrm-ui-page')) { const st = document.createElement('style'); st.id = 'vrm-ui-page'; st.textContent = CSS_PAGE; (document.head || document.documentElement).appendChild(st); }
      el.setAttribute('data-vrm-ui', sorte === 'bandeau' ? 'bandeau' : 'toast');
      el.removeAttribute('style');
      if (sorte !== 'bandeau') { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); }
    } catch (_) {}
    return el;
  }
  // Les pièces, en HTML (valeurs déjà échappées par l'appelant, ou passées par `esc`).
  const etiquette = (n, grand) => (n ? `<span class="vu-n${grand ? ' vu-grand' : ''}" data-num="${esc(n)}"><small>N°</small>${esc(n)}</span>` : '');
  const barre = (pc, attrs) => `<div class="vu-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pc)}"${attrs || ''}><i style="width:${Math.max(0, Math.min(100, Number(pc) || 0))}%"></i></div>`;
  globalThis.VRM_UI = Object.freeze({ T, MOTS, LANGUES, langue: () => LANGUE, duree, esc, CSS, CSS_PAGE, monter, habiller, etiquette, barre });
})();
