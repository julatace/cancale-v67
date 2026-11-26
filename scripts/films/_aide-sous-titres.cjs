// ════════════════════════════════════════════════════════════════════════════
//  LES SOUS-TITRES DES VIDÉOS DU « ? » EN 5 LANGUES (17 nov., lot aide-videos)
//  La piste française (`<id>.vtt`) est écrite au tournage (aide-videos.cjs) avec les
//  titres incrustés. Les quatre autres langues : la MÊME piste (mêmes instants), chaque
//  ligne traduite par CETTE table (clé = la ligne française, espaces normaux).
//  Une ligne absente de la table ⇒ scripts/films/aide-sous-titres.cjs refuse d'écrire
//  (jamais une piste à moitié française) et l'audit le dit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const T = {
  'Ta journée : le plus pressé en haut.': ['Your day: most urgent at the top.', 'Tu día: lo más urgente arriba.', 'La tua giornata: il più urgente in alto.', 'Dein Tag: das Dringendste oben.'],
  'Un geste par ligne, dans l’ordre.': ['One action per line, in order.', 'Un gesto por línea, en orden.', 'Un gesto per riga, in ordine.', 'Ein Schritt pro Zeile, der Reihe nach.'],
  'Ventes : en haut, ce qui part.': ['Sales: what ships, at the top.', 'Ventas: arriba, lo que sale.', 'Vendite: in alto, ciò che parte.', 'Verkäufe: oben, was rausgeht.'],
  'Les colis à envoyer, de tous tes sites.': ['Parcels to send, from all your sites.', 'Los paquetes por enviar, de todos tus sitios.', 'I pacchi da spedire, da tutti i tuoi siti.', 'Die Pakete zum Versenden, von all deinen Seiten.'],
  'Tes colis à retirer, par point relais.': ['Your parcels to collect, by pickup point.', 'Tus paquetes por recoger, por punto de recogida.', 'I tuoi pacchi da ritirare, per punto di ritiro.', 'Deine Pakete zum Abholen, nach Abholstelle.'],
  'Le code de chacun, sans fouiller tes messages.': ['Each one’s code, without digging through messages.', 'El código de cada uno, sin buscar en tus mensajes.', 'Il codice di ognuno, senza frugare nei messaggi.', 'Der Code von jedem, ohne in Nachrichten zu suchen.'],
  'Tes achats Vinted arrivent seuls.': ['Your Vinted purchases arrive on their own.', 'Tus compras de Vinted llegan solas.', 'I tuoi acquisti Vinted arrivano da soli.', 'Deine Vinted-Käufe kommen von selbst.'],
  'Une brocante, un magasin ? Tu l’ajoutes.': ['A flea market, a shop? You add it.', '¿Un mercadillo, una tienda? Lo añades.', 'Un mercatino, un negozio? Lo aggiungi.', 'Ein Flohmarkt, ein Laden? Du fügst ihn hinzu.'],
  'Tes annonces, chacune avec son N°.': ['Your listings, each with its No.', 'Tus anuncios, cada uno con su N.º', 'I tuoi annunci, ognuno con il suo N°.', 'Deine Anzeigen, jede mit ihrer Nr.'],
  'Le même N° que sur sa boîte.': ['The same No. as on its box.', 'El mismo N.º que en su caja.', 'Lo stesso N° della sua scatola.', 'Dieselbe Nr. wie auf seinem Karton.'],
  'Où est rangée une paire ?': ['Where is a pair stored?', '¿Dónde está guardado un par?', 'Dov’è riposto un paio?', 'Wo liegt ein Paar?'],
  'Tape son N° : VRM dit le meuble et la case.': ['Type its No.: VRM shows the unit and the slot.', 'Escribe su N.º: VRM dice el mueble y la casilla.', 'Digita il suo N°: VRM dice il mobile e la casella.', 'Tippe seine Nr.: VRM zeigt Möbel und Fach.'],
  'Ton argent : vendu, reçu, gagné.': ['Your money: sold, received, earned.', 'Tu dinero: vendido, recibido, ganado.', 'I tuoi soldi: venduto, ricevuto, guadagnato.', 'Dein Geld: verkauft, erhalten, verdient.'],
  'Et ce qu’il te reste à déclarer.': ['And what you still have to declare.', 'Y lo que te queda por declarar.', 'E ciò che ti resta da dichiarare.', 'Und was du noch melden musst.'],
  'Tes messages, de tous tes sites.': ['Your messages, from all your sites.', 'Tus mensajes, de todos tus sitios.', 'I tuoi messaggi, da tutti i tuoi siti.', 'Deine Nachrichten, von all deinen Seiten.'],
  'Les non lus portent un point bleu.': ['Unread ones have a blue dot.', 'Los no leídos llevan un punto azul.', 'I non letti hanno un punto blu.', 'Ungelesene haben einen blauen Punkt.'],
  'Les e-mails de tes plateformes, rangés.': ['Emails from your platforms, sorted.', 'Los correos de tus plataformas, ordenados.', 'Le e-mail delle tue piattaforme, ordinate.', 'Die E-Mails deiner Plattformen, sortiert.'],
  'Codes, bordereaux, ventes, offres.': ['Codes, labels, sales, offers.', 'Códigos, etiquetas, ventas, ofertas.', 'Codici, etichette, vendite, offerte.', 'Codes, Etiketten, Verkäufe, Angebote.'],
  'Tes réglages : comptes, e-mails, extension.': ['Your settings: accounts, emails, extension.', 'Tus ajustes: cuentas, correos, extensión.', 'Le tue impostazioni: account, e-mail, estensione.', 'Deine Einstellungen: Konten, E-Mails, Erweiterung.'],
  'Un réglage, une phrase.': ['One setting, one sentence.', 'Un ajuste, una frase.', 'Un’impostazione, una frase.', 'Eine Einstellung, ein Satz.'],
  'Ce que tu as vendu, reçu, gagné.': ['What you sold, received, earned.', 'Lo que has vendido, recibido, ganado.', 'Ciò che hai venduto, ricevuto, guadagnato.', 'Was du verkauft, erhalten, verdient hast.'],
  'Puis la suite : un geste par ligne.': ['Then the rest: one action per line.', 'Luego lo demás: un gesto por línea.', 'Poi il resto: un gesto per riga.', 'Dann der Rest: ein Schritt pro Zeile.'],
  'Colis à retirer, messages, prix à baisser.': ['Parcels to collect, messages, prices to lower.', 'Paquetes por recoger, mensajes, precios por bajar.', 'Pacchi da ritirare, messaggi, prezzi da abbassare.', 'Pakete zum Abholen, Nachrichten, Preise zum Senken.'],
  'Touche une ligne : son geste s’ouvre.': ['Tap a line: its action opens.', 'Toca una línea: se abre su gesto.', 'Tocca una riga: si apre il suo gesto.', 'Tippe auf eine Zeile: ihr Schritt öffnet sich.'],
  'Tes colis à envoyer, prêts à imprimer.': ['Your parcels to send, ready to print.', 'Tus paquetes por enviar, listos para imprimir.', 'I tuoi pacchi da spedire, pronti da stampare.', 'Deine Pakete zum Versenden, druckbereit.'],
  'Coche ce qui part.': ['Tick what ships.', 'Marca lo que sale.', 'Spunta ciò che parte.', 'Hake ab, was rausgeht.'],
  'Le N° et la place de chaque paire.': ['Each pair’s No. and spot.', 'El N.º y el sitio de cada par.', 'Il N° e il posto di ogni paio.', 'Nr. und Platz jedes Paares.'],
  'Un geste : imprimer.': ['One action: print.', 'Un gesto: imprimir.', 'Un gesto: stampa.', 'Ein Schritt: drucken.'],
  'Ton imprimante, une seule fois.': ['Your printer, just once.', 'Tu impresora, una sola vez.', 'La tua stampante, una volta sola.', 'Dein Drucker, nur einmal.'],
  'VRM la garde pour la suite.': ['VRM keeps it for next time.', 'VRM la guarda para después.', 'VRM la tiene per le prossime volte.', 'VRM merkt ihn sich.'],
  'Le N° est tamponné sur chaque bordereau.': ['The No. is stamped on each label.', 'El N.º va sellado en cada etiqueta.', 'Il N° è timbrato su ogni etichetta.', 'Die Nr. ist auf jedes Etikett gestempelt.'],
  'Tu emballes la bonne paire.': ['You pack the right pair.', 'Empaquetas el par correcto.', 'Imballi il paio giusto.', 'Du packst das richtige Paar.'],
  'Touche un colis : son code en grand.': ['Tap a parcel: its code, large.', 'Toca un paquete: su código en grande.', 'Tocca un pacco: il suo codice in grande.', 'Tippe auf ein Paket: sein Code, groß.'],
  'Il se lit de loin, au comptoir.': ['Readable from afar, at the counter.', 'Se lee de lejos, en el mostrador.', 'Si legge da lontano, al banco.', 'Am Schalter von Weitem lesbar.'],
  'Copier le code, ou l’itinéraire.': ['Copy the code, or get directions.', 'Copiar el código, o el itinerario.', 'Copia il codice, o l’itinerario.', 'Code kopieren oder Route.'],
  '« + Ajouter » un achat.': ['“+ Add” a purchase.', '«+ Añadir» una compra.', '«+ Aggiungi» un acquisto.', '„+ Hinzufügen“: ein Kauf.'],
  'Ce que tu as acheté, et son prix.': ['What you bought, and its price.', 'Lo que compraste, y su precio.', 'Cosa hai comprato, e il prezzo.', 'Was du gekauft hast, und der Preis.'],
  'Son N° de rangement : c’est rangé.': ['Its storage No.: it’s stored.', 'Su N.º de almacén: está guardado.', 'Il suo N° di posto: è riposto.', 'Seine Lagernummer: verstaut.'],
  'Son prix devient le coût de la paire.': ['Its price becomes the pair’s cost.', 'Su precio pasa a ser el coste del par.', 'Il suo prezzo diventa il costo del paio.', 'Sein Preis wird zu den Kosten des Paares.'],
  'Ajouté à tes achats.': ['Added to your purchases.', 'Añadido a tus compras.', 'Aggiunto ai tuoi acquisti.', 'Zu deinen Käufen hinzugefügt.'],
  'Touche la flèche : ses détails.': ['Tap the arrow: its details.', 'Toca la flecha: sus detalles.', 'Tocca la freccia: i dettagli.', 'Tippe auf den Pfeil: die Details.'],
  'Prix d’achat, marge : ce que tu gagnes.': ['Purchase price, margin: what you earn.', 'Precio de compra, margen: lo que ganas.', 'Prezzo d’acquisto, margine: ciò che guadagni.', 'Einkaufspreis, Marge: was du verdienst.'],
  'Le prix d’achat se change d’un toucher.': ['The purchase price changes in one tap.', 'El precio de compra se cambia de un toque.', 'Il prezzo d’acquisto si cambia con un tocco.', 'Der Einkaufspreis ändert sich mit einem Tipp.'],
  'Et ses gestes : prix, stock, ailleurs.': ['And its actions: price, stock, elsewhere.', 'Y sus gestos: precio, stock, en otros sitios.', 'E i suoi gesti: prezzo, stock, altrove.', 'Und ihre Schritte: Preis, Lager, anderswo.'],
  'N°7 : Couloir, rangée 2, colonne 3.': ['No. 7: Hallway, row 2, column 3.', 'N.º 7: Pasillo, fila 2, columna 3.', 'N° 7: Corridoio, fila 2, colonna 3.', 'Nr. 7: Flur, Reihe 2, Spalte 3.'],
  'Une paire à ranger ?': ['A pair to store?', '¿Un par por guardar?', 'Un paio da riporre?', 'Ein Paar zum Verstauen?'],
  'Touche-la, puis une case libre.': ['Tap it, then a free slot.', 'Tócalo y luego una casilla libre.', 'Toccalo, poi una casella libera.', 'Tippe darauf, dann auf ein freies Fach.'],
  'Le montant du mois.': ['The month’s amount.', 'El importe del mes.', 'L’importo del mese.', 'Der Betrag des Monats.'],
  'Daté au jour du versement.': ['Dated by payout day.', 'Fechado el día del pago.', 'Datato al giorno del versamento.', 'Datiert am Auszahlungstag.'],
  'Déclaré sur l’URSSAF ? Note-le ici.': ['Declared on URSSAF? Note it here.', '¿Declarado en la URSSAF? Anótalo aquí.', 'Dichiarato all’URSSAF? Annotalo qui.', 'Bei der URSSAF gemeldet? Hier notieren.'],
  'Rien n’est envoyé : tu déclares sur son site.': ['Nothing is sent: you declare on its site.', 'No se envía nada: declaras en su web.', 'Non si invia nulla: dichiari sul suo sito.', 'Nichts wird gesendet: du meldest auf ihrer Seite.'],
  'Le mois est rangé.': ['The month is filed.', 'El mes queda archivado.', 'Il mese è archiviato.', 'Der Monat ist abgelegt.'],
  'Ouvre une conversation.': ['Open a conversation.', 'Abre una conversación.', 'Apri una conversazione.', 'Öffne eine Unterhaltung.'],
  'La paire, son N°, où elle est rangée.': ['The pair, its No., where it’s stored.', 'El par, su N.º, dónde está guardado.', 'Il paio, il suo N°, dov’è riposto.', 'Das Paar, seine Nr., wo es liegt.'],
  'Une offre ? VRM dit si tu y perds.': ['An offer? VRM says if you lose out.', '¿Una oferta? VRM dice si pierdes.', 'Un’offerta? VRM dice se ci perdi.', 'Ein Angebot? VRM sagt, ob du verlierst.'],
  'Ton prix d’achat, les frais : le seuil est là.': ['Your purchase price, the fees: there’s the threshold.', 'Tu precio de compra, los gastos: ahí está el umbral.', 'Il tuo prezzo d’acquisto, le spese: ecco la soglia.', 'Dein Einkaufspreis, die Gebühren: da ist die Schwelle.'],
  'Tu réponds sur ton clic, depuis ton navigateur.': ['You reply with your click, from your browser.', 'Respondes con tu clic, desde tu navegador.', 'Rispondi con il tuo clic, dal tuo browser.', 'Du antwortest per Klick, aus deinem Browser.'],
  'Un code de retrait ? Copié d’un geste.': ['A pickup code? Copied in one tap.', '¿Un código de recogida? Copiado de un gesto.', 'Un codice di ritiro? Copiato con un gesto.', 'Ein Abholcode? Mit einem Tipp kopiert.'],
  'Trie d’un toucher : les codes seulement.': ['Filter in one tap: codes only.', 'Filtra de un toque: solo los códigos.', 'Filtra con un tocco: solo i codici.', 'Filtern mit einem Tipp: nur Codes.'],
  'Touche un e-mail : l’essentiel en haut.': ['Tap an email: the key info on top.', 'Toca un correo: lo esencial arriba.', 'Tocca un’e-mail: l’essenziale in alto.', 'Tippe auf eine E-Mail: das Wichtigste oben.'],
  'Le code, le lieu, la date limite.': ['The code, the place, the deadline.', 'El código, el lugar, la fecha límite.', 'Il codice, il luogo, la scadenza.', 'Code, Ort, Frist.'],
  'Cherche-le par son nom.': ['Search it by name.', 'Búscalo por su nombre.', 'Cercala per nome.', 'Suche sie nach Namen.'],
  'Touche-le : il s’ouvre.': ['Tap it: it opens.', 'Tócalo: se abre.', 'Toccala: si apre.', 'Tippe darauf: sie öffnet sich.'],
  'Ici : tes comptes en pause pendant ton absence.': ['Here: your accounts paused while you’re away.', 'Aquí: tus cuentas en pausa durante tu ausencia.', 'Qui: i tuoi account in pausa mentre sei via.', 'Hier: deine Konten pausiert, während du weg bist.'],
};
const LANGUES = ['en', 'es', 'it', 'de'];
// La clé d'une ligne : espaces insécables rendus normaux.
const cleLigne = (s) => String(s || '').replace(/[  ]/g, ' ').trim();
function traduire(ligne, langue) {
  const i = LANGUES.indexOf(langue);
  const t = T[cleLigne(ligne)];
  return i >= 0 && t && t[i] ? t[i] : null;
}
module.exports = { T, LANGUES, traduire, cleLigne };
