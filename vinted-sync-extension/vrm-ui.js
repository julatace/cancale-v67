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
