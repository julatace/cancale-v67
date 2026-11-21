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
  // <logos-transporteurs> — COPIE de src/transporteursVisuels.js (scripts/recopier-logos-extension.cjs). Ne pas modifier ici.
  const LOGOS_TRANSP = {"chronopost":{"nom":"Chronopost","fond":"#FFFFFF","svg":"<g transform=\"translate(5 4.4) scale(.55)\"><path fill=\"#009BDE\" d=\"M20 0L40 11V30.5L20 42L0 30.5V11Z\"/><path fill=\"#006FB1\" d=\"M0 11.2L20 21.8V42L0 30.5Z\"/><path d=\"M0 11.2L20 21.8V42M20 21.8L31.6 15.4\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3.8\"/></g>"},"mondialrelay":{"nom":"Mondial Relay","fond":"#C8105F","svg":"<circle cx=\"15.2\" cy=\"7.7\" r=\"2.5\" fill=\"#FFFFFF\"/><path d=\"M10 28.8V19.6A7 7 0 0 1 17 12.6H19.6V17.2H17.4A2.6 2.6 0 0 0 14.8 19.8V26.6Z\" fill=\"#FFFFFF\"/><rect x=\"19.6\" y=\"12.6\" width=\"4.8\" height=\"4.6\" fill=\"#F4B9CC\"/>"},"colissimo":{"nom":"Colissimo","fond":"#FFFFFF","svg":"<g stroke=\"#FFFFFF\" stroke-width=\".9\" stroke-linejoin=\"round\"><path d=\"M16 4.5 27 10.6 16 16.7 5 10.6Z\" fill=\"#FFC627\"/><path d=\"M5 10.6 16 16.7V28.2L5 22.1Z\" fill=\"#F25C19\"/><path d=\"M16 16.7 27 10.6V22.1L16 28.2Z\" fill=\"#F8A017\"/></g>"},"vinted":{"nom":"Vinted Go","fond":"#007782","svg":"<g transform=\"translate(5 5) scale(.92)\"><path fill=\"#FFFFFF\" d=\"M19.316 0c-.258 0-.571.217-1.415.953-.3.108-.627.027-1.008.613-2.15 3.09-3.825 14.648-5.255 17.984-.286-1.444-.885-10.837-1.116-13.41-.028-.477.027-1.076.027-1.43 0-2.368-.516-3.567-2.886-3.567-1.198 0-2.382.436-3.008 1.226-.299.408-.409.708-.409 1.443 0 4.915 1.171 12.973 2.478 18.228C7.132 23.688 8.603 24 9.99 24c.654 0 1.307-.081 2.233-.544 3.212-1.567 4.07-5.84 4.9-9.993.15-.749.899-4.37 1.253-6.275.476-2.6 1.02-5.54 1.347-6.617C19.833.245 19.63 0 19.317 0z\"/></g>"},"relaiscolis":{"nom":"Relais Colis","fond":"#FFFFFF","svg":"<text x=\"16\" y=\"14.6\" text-anchor=\"middle\" fill=\"#1D1D1F\" font-family=\"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif\" font-weight=\"800\" font-size=\"8.8\" letter-spacing=\"-0.3\" textLength=\"22\" lengthAdjust=\"spacingAndGlyphs\">Relais</text><text x=\"16\" y=\"24.4\" text-anchor=\"middle\" fill=\"#1D1D1F\" font-family=\"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif\" font-weight=\"800\" font-size=\"8.8\" letter-spacing=\"-0.3\" textLength=\"20\" lengthAdjust=\"spacingAndGlyphs\">Colis</text>"},"dpd":{"nom":"DPD","fond":"#FFFFFF","svg":"<g transform=\"translate(4.5 4.5) scale(.96)\"><path fill=\"#414042\" d=\"M16.01 10.71a.364.364 0 01-.343-.006l-.558-.331a.43.43 0 01-.182-.312l-.014-.65a.363.363 0 01.165-.3l6.7-3.902L12.377.085A.799.799 0 0012 0a.798.798 0 00-.377.085l-9.4 5.124 10.53 6.13c.098.054.172.181.172.295v8.944c0 .112-.08.241-.178.294l-.567.315c-.171.062-.256.043-.361 0l-.569-.315a.362.362 0 01-.175-.294v-7.973a.223.223 0 00-.095-.156L1.702 7.048v10.579c0 .236.167.528.371.648l9.556 5.636c.102.06.237.09.371.089a.745.745 0 00.371-.09l9.557-5.635a.835.835 0 00.37-.648V7.047Z\"/></g>"},"ups":{"nom":"UPS","fond":"#351C15","svg":"<g transform=\"translate(4.6 4) scale(1)\"><path fill=\"#FFB500\" d=\"M11.668 14.544l-.028-5.226c.138-.055.387-.111.608-.111.995 0 1.41.774 1.41 2.682 0 1.853-.47 2.765-1.438 2.765-.22 0-.441-.055-.552-.11zM3.124 7.438c4.203-3.843 9.29-4.866 14.018-4.866 1.3 0 2.544.083 3.76.194h-.028v11.253c0 2.184-.774 3.926-2.295 5.171-1.355 1.134-5.447 2.959-6.581 3.456-1.161-.525-5.253-2.378-6.581-3.456-1.493-1.244-2.295-3.014-2.295-5.171V7.438zm12.664 2.599c.028.912.276 1.576 1.687 2.406.747.442 1.051.747 1.051 1.272 0 .581-.387.94-1.023.94-.553 0-1.189-.304-1.631-.691v1.576c.553.304 1.217.525 1.88.525 1.687 0 2.433-1.189 2.461-2.267.028-.995-.249-1.742-1.659-2.571-.608-.387-1.134-.636-1.106-1.244 0-.581.525-.802.995-.802.581 0 1.161.332 1.521.691V8.378c-.304-.221-.94-.581-1.88-.553-1.135.028-2.296.829-2.296 2.212zm-5.834 9.484h1.714l-.028-3.594c.166.028.415.083.774.083 1.908 0 2.986-1.687 2.986-4.175 0-2.461-1.106-4.009-3.152-4.009-.94 0-1.687.221-2.295.608v11.087zm-5.945-6.166c0 1.797.829 2.71 2.516 2.71 1.051 0 1.908-.249 2.571-.691V7.991H7.41v6.387c-.194.138-.47.221-.802.221-.774 0-.885-.719-.885-1.189V7.991H4.009v5.364zM22.12 2.295v11.723c0 2.516-.94 4.645-2.765 6.111-1.549 1.3-6.332 3.429-7.355 3.871-1.023-.442-5.806-2.571-7.355-3.843-1.797-1.465-2.765-3.594-2.765-6.111V2.295C4.756.747 8.074 0 12 0s7.244.747 10.12 2.295zm-.304.221c-2.71-1.465-6-2.184-9.788-2.184s-7.079.746-9.788 2.184v11.502c0 2.433.912 4.452 2.627 5.862 1.576 1.3 6.581 3.484 7.161 3.76.581-.249 5.585-2.433 7.161-3.733 1.714-1.41 2.627-3.429 2.627-5.862V2.516z\"/></g>"},"gls":{"nom":"GLS","fond":"#061AB1","svg":"<text x=\"16\" y=\"20.4\" text-anchor=\"middle\" fill=\"#FFD100\" font-family=\"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif\" font-weight=\"900\" font-size=\"12.5\" letter-spacing=\"-0.4\" textLength=\"22\" lengthAdjust=\"spacingAndGlyphs\">GLS</text>"},"colisprive":{"nom":"Colis Privé","fond":"#EE7203","svg":"<text x=\"16\" y=\"14.6\" text-anchor=\"middle\" fill=\"#FFFFFF\" font-family=\"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif\" font-weight=\"800\" font-size=\"8.8\" letter-spacing=\"-0.3\" textLength=\"20\" lengthAdjust=\"spacingAndGlyphs\">Colis</text><text x=\"16\" y=\"24.4\" text-anchor=\"middle\" fill=\"#FFFFFF\" font-family=\"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif\" font-weight=\"800\" font-size=\"8.8\" letter-spacing=\"-0.3\" textLength=\"20\" lengthAdjust=\"spacingAndGlyphs\">Privé</text>"},"shop2shop":{"nom":"Chronopost Shop2Shop","fond":"#FFFFFF","svg":"<g transform=\"translate(5 4.4) scale(.55)\"><path fill=\"#009BDE\" d=\"M20 0L40 11V30.5L20 42L0 30.5V11Z\"/><path fill=\"#006FB1\" d=\"M0 11.2L20 21.8V42L0 30.5Z\"/><path d=\"M0 11.2L20 21.8V42M20 21.8L31.6 15.4\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3.8\"/></g>"},"laposte":{"nom":"La Poste","fond":"#FFCD00","svg":"<path d=\"M4.5 19.5 27.5 8.5 15.6 21.4Z\" fill=\"#003DA5\"/><path d=\"M15.6 21.4 27.5 8.5 19.4 25Z\" fill=\"#39A8E5\"/>"},"inpost":{"nom":"Mondial Relay","fond":"#C8105F","svg":"<circle cx=\"15.2\" cy=\"7.7\" r=\"2.5\" fill=\"#FFFFFF\"/><path d=\"M10 28.8V19.6A7 7 0 0 1 17 12.6H19.6V17.2H17.4A2.6 2.6 0 0 0 14.8 19.8V26.6Z\" fill=\"#FFFFFF\"/><rect x=\"19.6\" y=\"12.6\" width=\"4.8\" height=\"4.6\" fill=\"#F4B9CC\"/>"},"dhl":{"nom":"DHL","fond":"#FFCC00","svg":"<g transform=\"translate(3.04 3.04) scale(1.08)\"><path fill=\"#1D1D1B\" d=\"M4.22 10.303l-.767 1.043h4.18c.21 0 .208.078.105.218-.105.142-.28.39-.386.534-.054.073-.154.207.171.207h1.71l.505-.69c.314-.426.028-1.312-1.095-1.312H4.22zm7.204 0l-1.475 2.002h5.39l1.473-2.002H14.61l-.843 1.146h-.985l.846-1.146h-2.203zm6.105 0l-1.474 2.002h2.334l1.472-2.002H17.53zm-12.845 1.3l-1.54 2.094h3.754c1.24 0 1.932-.844 2.145-1.136h-2.56c-.326 0-.226-.133-.172-.207.107-.143.283-.388.388-.53.104-.14.107-.22-.105-.22h-1.91zM0 12.562v.242h3.398l.176-.242H0zm9.762 0l-.836 1.136h2.203l.836-1.136H9.762zm3.185 0l-.836 1.136h2.203l.836-1.136h-2.203zm2.918 0s-.159.22-.238.326c-.276.374-.033.81.87.81h3.538l.834-1.136h-5.004zm5.408 0l-.177.242H24v-.242h-2.727zM0 13.01v.24h3.068l.178-.24H0zm20.943 0l-.175.24H24v-.24h-3.057zM0 13.457v.24h2.74l.176-.24H0zm20.615 0l-.177.24H24v-.24h-3.385z\"/></g>"},"fedex":{"nom":"FedEx","fond":"#FFFFFF","svg":"<svg x=\"3\" y=\"11.9\" width=\"26\" height=\"8.2\" viewBox=\"0 8.6 21.95 6.9\" overflow=\"hidden\"><path fill=\"#1D1D1F\" d=\"M22.498 14.298c-.016-.414.345-.751.75-.755a.745.745 0 0 1 .752.755.755.755 0 0 1-.751.745c-.395.002-.759-.346-.751-.745zm.759-.083c.067-.02.164-.042.162-.13.007-.09-.086-.133-.162-.134h-.163v.263c0 .001.165-.002.163.001zm-.163.107v.418h-.14v-.91h.327c.156-.021.294.092.286.253a.218.218 0 0 1-.156.19c.162.083.108.322.173.467h-.156a2.355 2.355 0 0 1-.04-.205c-.018-.093-.047-.229-.17-.213h-.124zm.76-.024a.603.603 0 0 0-.605-.632c-.338-.012-.62.302-.605.632a.619.619 0 0 0 .605.622.61.61 0 0 0 .605-.622zm-5.052-.579l-.878 1.008h-1.306l1.559-1.745-1.56-1.75h1.355l.902.997.878-.998h1.306l-1.543 1.743 1.559 1.753h-1.371l-.901-1.008zm-4.703-.352v-.827h1.904v-1.506l1.724 1.948-1.724 1.941v-1.556h-1.904zm1.56 1.36h-3.2V9.044h3.224v1.024H13.77v1.163h1.888v.958h-1.904v1.522h1.904v1.016zm-5.705-.655c-.54.017-.878-.552-.877-1.04-.01-.507.307-1.123.878-1.105.579-.025.871.6.845 1.103.023.501-.29 1.062-.846 1.042zM4.743 12.41c.076-.358.403-.67.78-.663a.788.788 0 0 1 .803.663H4.743zm15.182.564l1.815-2.047h-2.125l-.74.844-.763-.844h-4.037v-.548h1.912V8.741H10.84v2.58c-.362-.448-.981-.559-1.526-.492-.782.123-1.427.762-1.634 1.514-.254-.958-1.179-1.588-2.157-1.554-.781.009-1.6.365-1.987 1.071v-.818h-1.87v-.9h2.043v-1.4H0v6.287h1.666v-2.644h1.666a7.59 7.59 0 0 0-.082.622c-.013 1.232 1.042 2.27 2.274 2.236a2.204 2.204 0 0 0 2.157-1.432H6.254c-.14.268-.441.38-.73.36-.457.009-.83-.417-.829-.86h2.914c.083 1.027.988 1.966 2.043 1.947a1.53 1.53 0 0 0 1.19-.639v.41h7.215l.754-.86.754.86h2.192l-1.832-2.055z\"/></svg>"}};
  const LISERE_TRANSP = "<rect x=\".5\" y=\".5\" width=\"31\" height=\"31\" rx=\"7.6\" fill=\"none\" stroke=\"#7F7F7F\" stroke-opacity=\".3\" stroke-width=\"1\" vector-effect=\"non-scaling-stroke\"/>";
  // </logos-transporteurs>
  const MOTS = {
    // 5.410 — panneau comme Vintex
    au6_retour: { fr: 'Automatisations', en: 'Automations', es: 'Automatizaciones', it: 'Automazioni', de: 'Automatisierungen' },
    li_titre: { fr: "Intéressés sur Leboncoin · {n}", en: "Interested on Leboncoin · {n}", es: "Interesados en Leboncoin · {n}", it: "Interessati su Leboncoin · {n}", de: "Interessenten auf Leboncoin · {n}" },
    li_n: { fr: "{n} intéressé(s) · {a} attendent ta réponse", en: "{n} interested · {a} waiting for your reply", es: "{n} interesado(s) · {a} esperan tu respuesta", it: "{n} interessato/i · {a} aspettano la tua risposta", de: "{n} Interessent(en) · {a} warten auf deine Antwort" },
    li_voir: { fr: "Voir", en: "View", es: "Ver", it: "Vedi", de: "Ansehen" },
    li_personne: { fr: "Une personne · {n} message(s) de sa part", en: "One person · {n} message(s) from them", es: "Una persona · {n} mensaje(s) suyo(s)", it: "Una persona · {n} messaggio/i suo/i", de: "Eine Person · {n} Nachricht(en) von ihr" },
    li_attend: { fr: "attend ta réponse", en: "waiting for your reply", es: "espera tu respuesta", it: "aspetta la tua risposta", de: "wartet auf deine Antwort" },
    li_deja: { fr: "déjà écrit par VRM", en: "already written by VRM", es: "ya escrito por VRM", it: "già scritto da VRM", de: "schon von VRM geschrieben" },
    li_pas_appris: { fr: "VRM n’a pas encore appris l’envoi sur Leboncoin : écris une fois à la main dans une conversation, puis reviens.", en: "VRM hasn’t learned how to send on Leboncoin yet: write once by hand in a conversation, then come back.", es: "VRM aún no aprendió el envío en Leboncoin: escribe una vez a mano en una conversación y vuelve.", it: "VRM non ha ancora imparato l’invio su Leboncoin: scrivi una volta a mano in una conversazione, poi torna.", de: "VRM hat das Senden auf Leboncoin noch nicht gelernt: schreib einmal von Hand in einem Gespräch und komm zurück." },
    li_conf: { fr: "Écrire à {n} personne(s) ? Un message à la fois, {a} à {b} s au hasard entre deux, {m} au plus par toucher.", en: "Write to {n} person(s)? One message at a time, {a}–{b} s at random between two, {m} at most per tap.", es: "¿Escribir a {n} persona(s)? Un mensaje a la vez, {a}–{b} s al azar entre dos, {m} como máximo por toque.", it: "Scrivere a {n} persona/e? Un messaggio alla volta, {a}–{b} s a caso tra due, {m} al massimo per tocco.", de: "An {n} Person(en) schreiben? Eine Nachricht nach der anderen, {a}–{b} s zufällig dazwischen, höchstens {m} pro Tipp." },
    li_oui: { fr: "Oui, leur écrire", en: "Yes, write to them", es: "Sí, escribirles", it: "Sì, scrivi loro", de: "Ja, ihnen schreiben" },
    li_ecrire: { fr: "Leur écrire ({n})", en: "Write to them ({n})", es: "Escribirles ({n})", it: "Scrivi loro ({n})", de: "Ihnen schreiben ({n})" },
    li_parti: { fr: "La série est partie : un message à la fois.", en: "The series has started: one message at a time.", es: "La serie ha empezado: un mensaje a la vez.", it: "La serie è partita: un messaggio alla volta.", de: "Die Serie läuft: eine Nachricht nach der anderen." },
    li_serie: { fr: "Série en cours · {n} restant(s)", en: "Series in progress · {n} left", es: "Serie en curso · {n} restante(s)", it: "Serie in corso · {n} rimanente/i", de: "Serie läuft · {n} übrig" },
    li_aucun: { fr: "Aucun intéressé lu pour ce compte.", en: "No interested people read for this account.", es: "Ningún interesado leído para esta cuenta.", it: "Nessun interessato letto per questo account.", de: "Keine Interessenten für dieses Konto gelesen." },
    g6_vc_date: { fr: "Vestiaire : la date de mise en ligne est lue quand Vestiaire la dit ; sinon VRM compte depuis le jour où il l’a vue en ligne (au moins) — jamais plus tôt.", en: "Vestiaire: the listing date is read when Vestiaire gives it; otherwise VRM counts from the day it first saw it online (at least) — never earlier.", es: "Vestiaire: la fecha se lee cuando Vestiaire la da; si no, VRM cuenta desde el día en que lo vio en línea (al menos), nunca antes.", it: "Vestiaire: la data viene letta quando Vestiaire la indica; altrimenti VRM conta dal giorno in cui l’ha visto online (almeno), mai prima.", de: "Vestiaire: Das Datum wird gelesen, wenn Vestiaire es nennt; sonst zählt VRM ab dem Tag, an dem es online gesehen wurde (mindestens) – nie früher." },
    g6_monter_q: { fr: "Monter à {p} ? (prix vu {avant})", en: "Raise to {p}? (price seen {avant})", es: "¿Subir a {p}? (precio visto {avant})", it: "Aumentare a {p}? (prezzo visto {avant})", de: "Auf {p} erhöhen? (gesehener Preis {avant})" },
    g6_monter_oui: { fr: "Oui, monter", en: "Yes, raise", es: "Sí, subir", it: "Sì, aumenta", de: "Ja, erhöhen" },
    g6_au_moins: { fr: "au moins depuis {d}", en: "since at least {d}", es: "desde al menos {d}", it: "almeno dal {d}", de: "mindestens seit {d}" },
    g6_au_moins_note: { fr: "Vestiaire ne dit pas la date : VRM l’a vu en ligne pour la première fois ce jour-là.", en: "Vestiaire does not give the date: VRM first saw it online that day.", es: "Vestiaire no da la fecha: VRM lo vio en línea por primera vez ese día.", it: "Vestiaire non dà la data: VRM l’ha visto online per la prima volta quel giorno.", de: "Vestiaire nennt kein Datum: VRM hat es an diesem Tag zuerst online gesehen." },
    g6_verif_cours: { fr: "Vérification de chaque annonce chez Vinted…", en: "Checking each listing on Vinted…", es: "Comprobando cada anuncio en Vinted…", it: "Verifica di ogni annuncio su Vinted…", de: "Jede Anzeige wird bei Vinted geprüft…" },
    g6_verif_recap: { fr: "{v} vérifiée(s) · {c} corrigée(s) seule(s) · {a} à corriger avant de lancer", en: "{v} checked · {c} fixed automatically · {a} to fix before starting", es: "{v} comprobado(s) · {c} corregido(s) solo(s) · {a} por corregir antes de lanzar", it: "{v} verificato/i · {c} corretto/i da solo · {a} da correggere prima di avviare", de: "{v} geprüft · {c} selbst korrigiert · {a} vor dem Start zu korrigieren" },
    g6_verif_absentes: { fr: "{n} absente(s) chez Vinted (ne partiront pas)", en: "{n} missing on Vinted (won’t go)", es: "{n} ausente(s) en Vinted (no saldrán)", it: "{n} assente/i su Vinted (non partiranno)", de: "{n} bei Vinted nicht mehr da (gehen nicht raus)" },
    g6_verif_pas: { fr: "{n} pas vérifiée(s) maintenant (vérifiées au départ)", en: "{n} not checked now (checked at start)", es: "{n} sin comprobar ahora (se comprobarán al salir)", it: "{n} non verificato/i ora (verificati alla partenza)", de: "{n} jetzt nicht geprüft (beim Start geprüft)" },
    g6_v_ok: { fr: "Prête", en: "Ready", es: "Lista", it: "Pronta", de: "Bereit" },
    g6_v_corrige: { fr: "Corrigée seule", en: "Fixed automatically", es: "Corregida sola", it: "Corretta da sola", de: "Selbst korrigiert" },
    g6_v_a_corriger: { fr: "À corriger", en: "To fix", es: "Por corregir", it: "Da correggere", de: "Zu korrigieren" },
    g6_v_absente: { fr: "Absente chez Vinted", en: "Missing on Vinted", es: "Ausente en Vinted", it: "Assente su Vinted", de: "Bei Vinted nicht da" },
    g6_v_pas_verifie: { fr: "Vérifiée au départ", en: "Checked at start", es: "Se comprobará al salir", it: "Verificata alla partenza", de: "Beim Start geprüft" },
    g6_manque: { fr: "Manque : {m}", en: "Missing: {m}", es: "Falta: {m}", it: "Manca: {m}", de: "Fehlt: {m}" },
    g6_choisir: { fr: "Choisir : {nom}", en: "Choose: {nom}", es: "Elegir: {nom}", it: "Scegli: {nom}", de: "Wählen: {nom}" },
    g6_retirer: { fr: "Retirer de la file", en: "Remove from the queue", es: "Quitar de la cola", it: "Togli dalla coda", de: "Aus der Liste nehmen" },
    g6_lancer_ferme: { fr: "« Lancer » reste fermé : {n} annonce(s) à corriger.", en: "“Start” stays closed: {n} listing(s) to fix.", es: "«Lanzar» sigue cerrado: {n} anuncio(s) por corregir.", it: "«Avvia» resta chiuso: {n} annuncio/i da correggere.", de: "„Starten“ bleibt gesperrt: {n} Anzeige(n) zu korrigieren." },
    g6_toutes_absentes: { fr: "Toutes ces annonces sont absentes chez Vinted.", en: "All these listings are missing on Vinted.", es: "Todos estos anuncios faltan en Vinted.", it: "Tutti questi annunci mancano su Vinted.", de: "Alle diese Anzeigen fehlen bei Vinted." },
    g6_ecrire_message: { fr: "Écris d’abord ton message (Automatisations)", en: "Write your message first (Automations)", es: "Escribe primero tu mensaje (Automatizaciones)", it: "Scrivi prima il tuo messaggio (Automazioni)", de: "Schreib zuerst deine Nachricht (Automatisierungen)" },
    ac_publier: { fr: "Publier sur…", en: "Publish on…", es: "Publicar en…", it: "Pubblica su…", de: "Veröffentlichen auf…" },
    g6_prix_titre: { fr: "Changer le prix · {n} annonce(s)", en: "Change price · {n} listing(s)", es: "Cambiar precio · {n} anuncio(s)", it: "Cambia prezzo · {n} annuncio/i", de: "Preis ändern · {n} Anzeige(n)" },
    g6_prix_vu: { fr: "Prix vu {p}", en: "Price seen {p}", es: "Precio visto {p}", it: "Prezzo visto {p}", de: "Gesehener Preis {p}" },
    g6_plancher_mini: { fr: "plancher : ton prix mini {p}", en: "floor: your minimum price {p}", es: "mínimo: tu precio mínimo {p}", it: "soglia: il tuo prezzo minimo {p}", de: "Untergrenze: dein Mindestpreis {p}" },
    g6_plancher_achat: { fr: "plancher : achat + 10 % = {p}", en: "floor: purchase + 10% = {p}", es: "mínimo: compra + 10 % = {p}", it: "soglia: acquisto + 10 % = {p}", de: "Untergrenze: Einkauf + 10 % = {p}" },
    g6_plancher_pas_su: { fr: "plancher pas su (ni prix mini ni achat)", en: "floor unknown (no minimum or purchase price)", es: "mínimo desconocido", it: "soglia non nota", de: "Untergrenze unbekannt" },
    g6_nouveau_prix: { fr: "Nouveau prix", en: "New price", es: "Nuevo precio", it: "Nuovo prezzo", de: "Neuer Preis" },
    g6_confirmer: { fr: "Confirmer", en: "Confirm", es: "Confirmar", it: "Conferma", de: "Bestätigen" },
    g6_prix_vide: { fr: "Écris au moins un nouveau prix.", en: "Enter at least one new price.", es: "Escribe al menos un precio nuevo.", it: "Scrivi almeno un nuovo prezzo.", de: "Gib mindestens einen neuen Preis ein." },
    g6_prix_resultat: { fr: "{n} prix envoyé(s), {r} refusé(s)", en: "{n} price(s) sent, {r} refused", es: "{n} precio(s) enviado(s), {r} rechazado(s)", it: "{n} prezzo/i inviato/i, {r} rifiutato/i", de: "{n} Preis(e) gesendet, {r} abgelehnt" },
    g6_sous_plancher: { fr: "sous le plancher {p}", en: "below the floor {p}", es: "bajo el mínimo {p}", it: "sotto la soglia {p}", de: "unter der Untergrenze {p}" },
    g6_hausse: { fr: "une hausse demande ta confirmation", en: "a raise needs your confirmation", es: "una subida necesita tu confirmación", it: "un aumento richiede la tua conferma", de: "eine Erhöhung braucht deine Bestätigung" },
    g6_atelier_titre: { fr: "Republier · {n} annonce(s)", en: "Relist · {n} listing(s)", es: "Republicar · {n} anuncio(s)", it: "Ripubblica · {n} annuncio/i", de: "Neu einstellen · {n} Anzeige(n)" },
    g6_atelier_ordre: { fr: "Dans cet ordre : coffre → brouillon → suppression → mise en ligne, une à la fois.", en: "In this order: vault → draft → deletion → back online, one at a time.", es: "En este orden: copia → borrador → eliminación → publicación, una a una.", it: "In quest’ordine: copia → bozza → eliminazione → pubblicazione, una alla volta.", de: "In dieser Reihenfolge: Sicherung → Entwurf → Löschen → online, eine nach der anderen." },
    g6_monter: { fr: "Monter", en: "Move up", es: "Subir", it: "Sposta su", de: "Nach oben" },
    g6_descendre: { fr: "Descendre", en: "Move down", es: "Bajar", it: "Sposta giù", de: "Nach unten" },
    g6_espacement: { fr: "Espacement", en: "Spacing", es: "Intervalo", it: "Intervallo", de: "Abstand" },
    g6_fixe: { fr: "Fixe", en: "Fixed", es: "Fijo", it: "Fisso", de: "Fest" },
    g6_aleatoire: { fr: "Au hasard", en: "Random", es: "Aleatorio", it: "Casuale", de: "Zufällig" },
    g6_toutes: { fr: "Toutes les", en: "Every", es: "Cada", it: "Ogni", de: "Alle" },
    g6_entre: { fr: "Entre", en: "Between", es: "Entre", it: "Tra", de: "Zwischen" },
    g6_luminosite: { fr: "Luminosité", en: "Brightness", es: "Brillo", it: "Luminosità", de: "Helligkeit" },
    g6_contraste: { fr: "Contraste", en: "Contrast", es: "Contraste", it: "Contrasto", de: "Kontrast" },
    g6_saturation: { fr: "Saturation", en: "Saturation", es: "Saturación", it: "Saturazione", de: "Sättigung" },
    g6_zoom: { fr: "Zoom", en: "Zoom", es: "Zoom", it: "Zoom", de: "Zoom" },
    g6_rotation: { fr: "Rotation", en: "Rotation", es: "Rotación", it: "Rotazione", de: "Drehung" },
    g6_lettre: { fr: "Une lettre au hasard en bas de la description", en: "A random letter at the end of the description", es: "Una letra al azar al final de la descripción", it: "Una lettera a caso in fondo alla descrizione", de: "Ein zufälliger Buchstabe am Ende der Beschreibung" },
    g6_lancer: { fr: "Lancer", en: "Start", es: "Lanzar", it: "Avvia", de: "Starten" },
    g6_atelier_suivi: { fr: "Republier en cours · {i}/{n}", en: "Relisting · {i}/{n}", es: "Republicando · {i}/{n}", it: "Ripubblicazione · {i}/{n}", de: "Neu einstellen · {i}/{n}" },
    g6_e_attente: { fr: "En attente", en: "Waiting", es: "En espera", it: "In attesa", de: "Wartet" },
    g6_e_cours: { fr: "En cours", en: "In progress", es: "En curso", it: "In corso", de: "Läuft" },
    g6_e_fait: { fr: "Fait", en: "Done", es: "Hecho", it: "Fatto", de: "Erledigt" },
    g6_e_planifiee: { fr: "Mise en ligne prévue", en: "Going online soon", es: "Publicación prevista", it: "Pubblicazione prevista", de: "Online geplant" },
    g6_e_arret: { fr: "Arrêtée", en: "Stopped", es: "Detenida", it: "Fermata", de: "Gestoppt" },
    g6_reprendre: { fr: "Reprendre", en: "Resume", es: "Reanudar", it: "Riprendi", de: "Fortsetzen" },
    // 5.422 (`repubprogramme`) : « Lancer maintenant » ou « Programmer à … » — SON heure, confirmée.
    g6_quand: { fr: "Quand", en: "When", es: "Cuándo", it: "Quando", de: "Wann" },
    g6_maintenant: { fr: "Lancer maintenant", en: "Start now", es: "Lanzar ahora", it: "Avvia ora", de: "Jetzt starten" },
    g6_programmer: { fr: "Programmer à…", en: "Schedule for…", es: "Programar a las…", it: "Programma alle…", de: "Planen für…" },
    g6_programmer_btn: { fr: "Programmer", en: "Schedule", es: "Programar", it: "Programma", de: "Planen" },
    g6_prog_heure: { fr: "Date et heure", en: "Date and time", es: "Fecha y hora", it: "Data e ora", de: "Datum und Uhrzeit" },
    g6_prog_ouvert: { fr: "Garde ce navigateur ouvert, avec l’onglet vinted.fr de ce compte : sinon rien ne part.", en: "Keep this browser open, with this account’s vinted.fr tab: otherwise nothing starts.", es: "Deja este navegador abierto, con la pestaña vinted.fr de esta cuenta: si no, no sale nada.", it: "Tieni aperto questo browser, con la scheda vinted.fr di questo account: altrimenti non parte nulla.", de: "Lass diesen Browser offen, mit dem vinted.fr-Tab dieses Kontos: sonst startet nichts." },
    g6_prog_heure_ko: { fr: "Choisis une heure au moins 2 min plus tard, dans les 7 prochains jours.", en: "Pick a time at least 2 min from now, within the next 7 days.", es: "Elige una hora al menos 2 min más tarde, en los próximos 7 días.", it: "Scegli un orario almeno 2 min più tardi, entro 7 giorni.", de: "Wähle eine Uhrzeit mindestens 2 Min. später, in den nächsten 7 Tagen." },
    g6_q_soir: { fr: "ce soir à {h}", en: "tonight at {h}", es: "esta noche a las {h}", it: "stasera alle {h}", de: "heute Abend um {h}" },
    g6_q_auj: { fr: "aujourd’hui à {h}", en: "today at {h}", es: "hoy a las {h}", it: "oggi alle {h}", de: "heute um {h}" },
    g6_q_demain: { fr: "demain à {h}", en: "tomorrow at {h}", es: "mañana a las {h}", it: "domani alle {h}", de: "morgen um {h}" },
    g6_q_le: { fr: "le {j} à {h}", en: "on {j} at {h}", es: "el {j} a las {h}", it: "il {j} alle {h}", de: "am {j} um {h}" },
    g6_paire: { fr: "1 paire", en: "1 pair", es: "1 par", it: "1 paio", de: "1 Paar" },
    g6_paires: { fr: "{n} paires", en: "{n} pairs", es: "{n} pares", it: "{n} paia", de: "{n} Paare" },
    g6_prog_esp: { fr: "espacées de {a} à {b} min", en: "{a} to {b} min apart", es: "separados de {a} a {b} min", it: "a {a}–{b} min l’uno dall’altro", de: "im Abstand von {a} bis {b} Min." },
    g6_prog_esp_fixe: { fr: "espacées de {a} min", en: "{a} min apart", es: "separados {a} min", it: "a {a} min l’uno dall’altro", de: "im Abstand von {a} Min." },
    g6_prog_conf: { fr: "Republier {p} {quand}, {e} ?", en: "Relist {p} {quand}, {e}?", es: "¿Republicar {p} {quand}, {e}?", it: "Ripubblicare {p} {quand}, {e}?", de: "{p} {quand} neu einstellen, {e}?" },
    g6_prog_conf_un: { fr: "Republier {p} {quand} ?", en: "Relist {p} {quand}?", es: "¿Republicar {p} {quand}?", it: "Ripubblicare {p} {quand}?", de: "{p} {quand} neu einstellen?" },
    g6_prog_titre: { fr: "Republication programmée", en: "Scheduled relisting", es: "Republicación programada", it: "Ripubblicazione programmata", de: "Geplantes Neueinstellen" },
    g6_prog_attente: { fr: "{p} {quand}, {e}, dans ton ordre.", en: "{p} {quand}, {e}, in your order.", es: "{p} {quand}, {e}, en tu orden.", it: "{p} {quand}, {e}, nel tuo ordine.", de: "{p} {quand}, {e}, in deiner Reihenfolge." },
    g6_prog_attente_un: { fr: "{p} {quand}.", en: "{p} {quand}.", es: "{p} {quand}.", it: "{p} {quand}.", de: "{p} {quand}." },
    g6_prog_annuler: { fr: "Annuler la programmation", en: "Cancel the schedule", es: "Cancelar la programación", it: "Annulla la programmazione", de: "Planung abbrechen" },
    g6_prog_pas: { fr: "Pas partie {quand}", en: "Did not start {quand}", es: "No salió {quand}", it: "Non partita {quand}", de: "Nicht gestartet {quand}" },
    g6_prog_r_ferme: { fr: "Le navigateur était fermé (ou endormi) à l’heure dite : rien n’est parti.", en: "The browser was closed (or asleep) at that time: nothing was sent.", es: "El navegador estaba cerrado (o en reposo) a esa hora: no salió nada.", it: "Il browser era chiuso (o in sospensione) a quell’ora: non è partito nulla.", de: "Der Browser war zu der Zeit geschlossen (oder im Ruhezustand): nichts wurde gestartet." },
    g6_prog_r_onglet: { fr: "Aucun onglet vinted.fr n’était ouvert à l’heure dite : rien n’est parti.", en: "No vinted.fr tab was open at that time: nothing was sent.", es: "No había ninguna pestaña vinted.fr abierta a esa hora: no salió nada.", it: "Nessuna scheda vinted.fr era aperta a quell’ora: non è partito nulla.", de: "Zu der Zeit war kein vinted.fr-Tab offen: nichts wurde gestartet." },
    g6_prog_r_compte: { fr: "L’onglet vinted.fr n’était pas sur ce compte à l’heure dite : rien n’est parti.", en: "The vinted.fr tab was not on this account at that time: nothing was sent.", es: "La pestaña vinted.fr no estaba en esta cuenta a esa hora: no salió nada.", it: "La scheda vinted.fr non era su questo account a quell’ora: non è partito nulla.", de: "Der vinted.fr-Tab war zu der Zeit nicht auf diesem Konto: nichts wurde gestartet." },
    g6_prog_r_en_cours: { fr: "Un autre atelier tournait déjà à l’heure dite : rien n’est parti.", en: "Another relisting was already running at that time: nothing was sent.", es: "Otra republicación ya estaba en curso a esa hora: no salió nada.", it: "Un’altra ripubblicazione era già in corso a quell’ora: non è partito nulla.", de: "Zu der Zeit lief schon ein anderes Neueinstellen: nichts wurde gestartet." },
    g6_prog_r_stockage: { fr: "Le stockage de l’extension ne répondait pas : rien n’est parti. Recharge l’extension.", en: "The extension’s storage did not respond: nothing was sent. Reload the extension.", es: "El almacenamiento de la extensión no respondía: no salió nada. Recarga la extensión.", it: "La memoria dell’estensione non rispondeva: non è partito nulla. Ricarica l’estensione.", de: "Der Speicher der Erweiterung antwortete nicht: nichts wurde gestartet. Lade die Erweiterung neu." },
    g6_prog_effacer: { fr: "Effacer", en: "Clear", es: "Borrar", it: "Cancella", de: "Entfernen" },
    g6_prog_relancer: { fr: "Relancer maintenant", en: "Start again now", es: "Relanzar ahora", it: "Riavvia ora", de: "Jetzt neu starten" },
    g6_arreter: { fr: "Arrêter", en: "Stop", es: "Detener", it: "Ferma", de: "Stoppen" },
    g6_publier_titre: { fr: "Publier", en: "Publish", es: "Publicar", it: "Pubblica", de: "Veröffentlichen" },
    g6_publier_sur: { fr: "Sur", en: "On", es: "En", it: "Su", de: "Auf" },
    g6_publier: { fr: "Publier", en: "Publish", es: "Publicar", it: "Pubblica", de: "Veröffentlichen" },
    g6_publier_quand_meme: { fr: "Publier quand même", en: "Publish anyway", es: "Publicar igualmente", it: "Pubblica comunque", de: "Trotzdem veröffentlichen" },
    g6_publie: { fr: "Envoyé : le dépôt s’ouvre sur le site.", en: "Sent: the listing form opens on the site.", es: "Enviado: el formulario se abre en el sitio.", it: "Inviato: il modulo si apre sul sito.", de: "Gesendet: das Formular öffnet sich auf der Seite." },
    g6_questions: { fr: "À préciser avant de publier :", en: "To clarify before publishing:", es: "Por precisar antes de publicar:", it: "Da precisare prima di pubblicare:", de: "Vor dem Veröffentlichen zu klären:" },
    g6_verifier: { fr: "À vérifier avant de publier :", en: "To check before publishing:", es: "Por revisar antes de publicar:", it: "Da verificare prima di pubblicare:", de: "Vor dem Veröffentlichen prüfen:" },
    g6_q_categorie: { fr: "Catégorie", en: "Category", es: "Categoría", it: "Categoria", de: "Kategorie" },
    g6_q_etat: { fr: "État", en: "Condition", es: "Estado", it: "Condizione", de: "Zustand" },
    g6_q_pointure: { fr: "Pointure", en: "Size", es: "Talla", it: "Taglia", de: "Größe" },
    g6_q_marque: { fr: "Marque", en: "Brand", es: "Marca", it: "Marca", de: "Marke" },
    g6_q_autre: { fr: "À préciser", en: "To clarify", es: "Por precisar", it: "Da precisare", de: "Zu klären" },
    g6_offres: { fr: "Offres en attente · {n}", en: "Pending offers · {n}", es: "Ofertas pendientes · {n}", it: "Offerte in attesa · {n}", de: "Offene Angebote · {n}" },
    g6_accepter: { fr: "Accepter", en: "Accept", es: "Aceptar", it: "Accetta", de: "Annehmen" },
    g6_refuser: { fr: "Refuser", en: "Decline", es: "Rechazar", it: "Rifiuta", de: "Ablehnen" },
    g6_contre: { fr: "Contre-offre", en: "Counter-offer", es: "Contraoferta", it: "Controfferta", de: "Gegenangebot" },
    g6_contre_prix: { fr: "Ton prix", en: "Your price", es: "Tu precio", it: "Il tuo prezzo", de: "Dein Preis" },
    g6_accepter_q: { fr: "Accepter {p} ? Ça vend la paire.", en: "Accept {p}? This sells the item.", es: "¿Aceptar {p}? Esto vende el artículo.", it: "Accettare {p}? Questo vende l’articolo.", de: "{p} annehmen? Damit ist der Artikel verkauft." },
    g6_refuser_q: { fr: "Refuser {p} ?", en: "Decline {p}?", es: "¿Rechazar {p}?", it: "Rifiutare {p}?", de: "{p} ablehnen?" },
    g6_verifie_accepter: { fr: "J’ai vérifié, accepter", en: "I checked, accept", es: "Lo he comprobado, aceptar", it: "Ho verificato, accetta", de: "Geprüft, annehmen" },
    g6_accepte_ok: { fr: "Offre acceptée.", en: "Offer accepted.", es: "Oferta aceptada.", it: "Offerta accettata.", de: "Angebot angenommen." },
    g6_refuse_ok: { fr: "Offre refusée.", en: "Offer declined.", es: "Oferta rechazada.", it: "Offerta rifiutata.", de: "Angebot abgelehnt." },
    g6_contre_ok: { fr: "Contre-offre envoyée.", en: "Counter-offer sent.", es: "Contraoferta enviada.", it: "Controfferta inviata.", de: "Gegenangebot gesendet." },
    ac_supprimer: { fr: "Supprimer de Leboncoin", en: "Delete from Leboncoin", es: "Eliminar de Leboncoin", it: "Elimina da Leboncoin", de: "Von Leboncoin löschen" },
    a_supprime_ok: { fr: "Supprimée de Leboncoin.", en: "Deleted from Leboncoin.", es: "Eliminado de Leboncoin.", it: "Eliminato da Leboncoin.", de: "Von Leboncoin gelöscht." },
    rf_mode_auto: { fr: "Mode automatique", en: "Automatic mode", es: "Modo automático", it: "Modalità automatica", de: "Automatikmodus" },
    rf_mode_auto_note: { fr: "VRM écrit seul à qui met en favori, dans tes horaires et tes plafonds.", en: "VRM writes on its own to whoever favourites, within your hours and limits.", es: "VRM escribe solo a quien marca como favorito, en tus horarios y límites.", it: "VRM scrive da solo a chi mette nei preferiti, nei tuoi orari e limiti.", de: "VRM schreibt selbst an alle, die favorisieren – in deinen Zeiten und Grenzen." },
    rf_version: { fr: "Version {n}", en: "Version {n}", es: "Versión {n}", it: "Versione {n}", de: "Version {n}" },
    cb_titre: { fr: "Méthode de republication", en: "Relisting method", es: "Método de republicación", it: "Metodo di ripubblicazione", de: "Methode zum Neueinstellen" },
    cb_formulaire: { fr: "Par le formulaire de Vinted (comme Bleam)", en: "Through Vinted’s form (like Bleam)", es: "Con el formulario de Vinted (como Bleam)", it: "Con il modulo di Vinted (come Bleam)", de: "Über das Vinted-Formular (wie Bleam)" },
    cb_formulaire_note: { fr: "VRM remplit le vrai formulaire dans un onglet vinted.fr en arrière-plan : photos, champs un par un, brouillon, suppression, mise en ligne. Environ 3 min par article. Vinted voit des clics faits par l’extension.", en: "VRM fills in the real form in a background vinted.fr tab: photos, fields one by one, draft, deletion, going live. About 3 min per item. Vinted sees clicks made by the extension.", es: "VRM rellena el formulario real en una pestaña de vinted.fr en segundo plano: fotos, campos uno a uno, borrador, eliminación, publicación. Unos 3 min por artículo. Vinted ve clics hechos por la extensión.", it: "VRM compila il vero modulo in una scheda vinted.fr in background: foto, campi uno per uno, bozza, eliminazione, pubblicazione. Circa 3 min per articolo. Vinted vede clic fatti dall’estensione.", de: "VRM füllt das echte Formular in einem vinted.fr-Tab im Hintergrund aus: Fotos, Felder einzeln, Entwurf, Löschen, Veröffentlichen. Etwa 3 Min. pro Artikel. Vinted sieht Klicks der Erweiterung." },
    cb_seule: { fr: "C’est la seule méthode : tout passe par la page de Vinted, aucune requête envoyée par VRM.", en: "It is the only method: everything goes through Vinted’s page, no request sent by VRM.", es: "Es el único método: todo pasa por la página de Vinted, VRM no envía ninguna petición.", it: "È l’unico metodo: tutto passa dalla pagina di Vinted, VRM non invia alcuna richiesta.", de: "Das ist die einzige Methode: alles läuft über die Vinted-Seite, VRM sendet keine Anfrage." },
    cb_directe_ignoree: { fr: "L’ancienne méthode « directe » enregistrée est ignorée : elle a été retirée.", en: "The saved former “direct” method is ignored: it has been removed.", es: "El antiguo método «directo» guardado se ignora: se ha retirado.", it: "Il vecchio metodo «diretto» salvato è ignorato: è stato rimosso.", de: "Die gespeicherte frühere „direkte“ Methode wird ignoriert: sie wurde entfernt." },
    cb_favoris_titre: { fr: "Messages aux favoris", en: "Messages to favourites", es: "Mensajes a favoritos", it: "Messaggi ai preferiti", de: "Nachrichten an Favoriten" },
    cb_sequence: { fr: "Message d’abord, puis l’offre (comme Bleam)", en: "Message first, then the offer (like Bleam)", es: "Primero el mensaje, luego la oferta (como Bleam)", it: "Prima il messaggio, poi l’offerta (come Bleam)", de: "Erst die Nachricht, dann das Angebot (wie Bleam)" },
    cb_lot: { fr: "Message « lot » (la personne aime 2 articles ou plus de ce compte)", en: "“Bundle” message (the person likes 2 or more items of this account)", es: "Mensaje «lote» (la persona tiene 2 o más artículos de esta cuenta en favoritos)", it: "Messaggio «lotto» (la persona ha 2 o più articoli di questo account nei preferiti)", de: "„Bündel“-Nachricht (die Person mag 2 oder mehr Artikel dieses Kontos)" },
    cb_lot_note: { fr: "{username} = son pseudo. Envoyé une fois par personne, à la place du message choisi.", en: "{username} = their username. Sent once per person, instead of the chosen message.", es: "{username} = su usuario. Se envía una vez por persona, en lugar del mensaje elegido.", it: "{username} = il suo nome utente. Inviato una volta per persona, al posto del messaggio scelto.", de: "{username} = der Benutzername. Einmal pro Person gesendet, statt der gewählten Nachricht." },
    cb_offre: { fr: "Offre après le message : entre {a} et {b} s", en: "Offer after the message: between {a} and {b} s", es: "Oferta tras el mensaje: entre {a} y {b} s", it: "Offerta dopo il messaggio: tra {a} e {b} s", de: "Angebot nach der Nachricht: zwischen {a} und {b} s" },
    cb_offre_note: { fr: "Au prix de ta règle, jamais sous ton prix mini (sinon achat + 10 %). Sans l’un ni l’autre, pas d’offre.", en: "At your rule’s price, never below your minimum price (otherwise purchase + 10%). With neither, no offer.", es: "Al precio de tu regla, nunca por debajo de tu precio mínimo (si no, compra + 10 %). Sin ninguno, no hay oferta.", it: "Al prezzo della tua regola, mai sotto il tuo prezzo minimo (altrimenti acquisto + 10%). Senza nessuno dei due, nessuna offerta.", de: "Zum Preis deiner Regel, nie unter deinem Mindestpreis (sonst Einkauf + 10 %). Ohne beides kein Angebot." },
    cb_onglet: { fr: "VRM travaille dans un onglet vinted.fr en arrière-plan", en: "VRM is working in a background vinted.fr tab", es: "VRM trabaja en una pestaña de vinted.fr en segundo plano", it: "VRM lavora in una scheda vinted.fr in background", de: "VRM arbeitet in einem vinted.fr-Tab im Hintergrund" },
    cb_onglet_libre: { fr: "Onglet de travail de VRM (au repos)", en: "VRM’s work tab (idle)", es: "Pestaña de trabajo de VRM (en reposo)", it: "Scheda di lavoro di VRM (a riposo)", de: "Arbeits-Tab von VRM (in Ruhe)" },
    cb_voir: { fr: "Voir l’onglet", en: "Show the tab", es: "Ver la pestaña", it: "Mostra la scheda", de: "Tab anzeigen" },
    // 5.420 : bordereaux en un PDF, mode vacances, santé des comptes, parcours en étapes, ventes obtenues.
    imp_un_pdf_en_cours: { fr: "Assemblage de {n} bordereaux en un PDF…", en: "Combining {n} labels into one PDF…", es: "Uniendo {n} etiquetas en un PDF…", it: "Unione di {n} etichette in un PDF…", de: "{n} Etiketten werden zu einem PDF zusammengefügt…" },
    imp_un_pdf: { fr: "Un PDF de {n} bordereaux ({p} pages) ouvert dans un onglet : imprime-le de là.", en: "One PDF with {n} labels ({p} pages) opened in a tab: print it from there.", es: "Un PDF con {n} etiquetas ({p} páginas) abierto en una pestaña: imprímelo desde allí.", it: "Un PDF con {n} etichette ({p} pagine) aperto in una scheda: stampalo da lì.", de: "Ein PDF mit {n} Etiketten ({p} Seiten) in einem Tab geöffnet: von dort drucken." },
    imp_un_pdf_telecharge: { fr: "Un PDF de {n} bordereaux ({p} pages) téléchargé : ouvre-le pour l’imprimer.", en: "One PDF with {n} labels ({p} pages) downloaded: open it to print.", es: "Un PDF con {n} etiquetas ({p} páginas) descargado: ábrelo para imprimir.", it: "Un PDF con {n} etichette ({p} pagine) scaricato: aprilo per stampare.", de: "Ein PDF mit {n} Etiketten ({p} Seiten) heruntergeladen: zum Drucken öffnen." },
    imp_illisibles: { fr: "{n} bordereau(x) illisible(s) gardé(s) à part, ouvert(s) seul(s).", en: "{n} unreadable label(s) kept apart, opened on their own.", es: "{n} etiqueta(s) ilegible(s) aparte, abierta(s) sola(s).", it: "{n} etichetta/e illeggibile/i tenuta/e a parte, aperta/e da sola/e.", de: "{n} unlesbare(s) Etikett(en) separat geöffnet." },
    imp_un_pdf_absent: { fr: "Ce navigateur n’a pas pu assembler un seul PDF : les bordereaux sont ouverts un par un.", en: "This browser couldn’t make a single PDF: labels are opened one by one.", es: "Este navegador no pudo crear un solo PDF: las etiquetas se abren una a una.", it: "Questo browser non ha potuto creare un solo PDF: le etichette si aprono una per una.", de: "Dieser Browser konnte kein einzelnes PDF erstellen: Etiketten werden einzeln geöffnet." },
    va_titre: { fr: "Mode vacances", en: "Holiday mode", es: "Modo vacaciones", it: "Modalità vacanza", de: "Urlaubsmodus" },
    va_etat: { fr: "Ce compte", en: "This account", es: "Esta cuenta", it: "Questo account", de: "Dieses Konto" },
    va_note: { fr: "Lu sur ton profil Vinted. VRM touche l’interrupteur des réglages de Vinted dans l’onglet de travail.", en: "Read from your Vinted profile. VRM taps the switch in Vinted’s settings in the work tab.", es: "Leído en tu perfil de Vinted. VRM pulsa el interruptor de los ajustes de Vinted en la pestaña de trabajo.", it: "Letto dal tuo profilo Vinted. VRM tocca l’interruttore nelle impostazioni di Vinted nella scheda di lavoro.", de: "Aus deinem Vinted-Profil gelesen. VRM tippt den Schalter in den Vinted-Einstellungen im Arbeits-Tab." },
    va_on: { fr: "En vacances", en: "On holiday", es: "De vacaciones", it: "In vacanza", de: "Im Urlaub" },
    va_off: { fr: "Ouvert", en: "Open", es: "Abierta", it: "Aperto", de: "Geöffnet" },
    va_mettre: { fr: "Mettre en vacances", en: "Turn on holiday mode", es: "Activar vacaciones", it: "Attiva vacanza", de: "Urlaubsmodus an" },
    va_rouvrir: { fr: "Rouvrir le compte", en: "Reopen the account", es: "Reabrir la cuenta", it: "Riapri l’account", de: "Konto wieder öffnen" },
    va_q_on: { fr: "Mettre ce compte en vacances ? Tes annonces seront cachées tant que le mode est actif.", en: "Put this account on holiday? Your listings stay hidden while it is on.", es: "¿Poner esta cuenta de vacaciones? Tus anuncios quedan ocultos mientras esté activo.", it: "Mettere questo account in vacanza? I tuoi annunci restano nascosti finché è attivo.", de: "Dieses Konto in den Urlaub setzen? Deine Anzeigen bleiben verborgen, solange er aktiv ist." },
    va_q_off: { fr: "Rouvrir ce compte ? Tes annonces redeviennent visibles.", en: "Reopen this account? Your listings become visible again.", es: "¿Reabrir esta cuenta? Tus anuncios vuelven a verse.", it: "Riaprire questo account? I tuoi annunci tornano visibili.", de: "Dieses Konto wieder öffnen? Deine Anzeigen werden wieder sichtbar." },
    va_oui_on: { fr: "Oui, mettre en vacances", en: "Yes, turn on", es: "Sí, activar", it: "Sì, attiva", de: "Ja, einschalten" },
    va_oui_off: { fr: "Oui, rouvrir", en: "Yes, reopen", es: "Sí, reabrir", it: "Sì, riapri", de: "Ja, öffnen" },
    va_en_cours: { fr: "VRM ouvre les réglages de Vinted…", en: "VRM is opening Vinted’s settings…", es: "VRM abre los ajustes de Vinted…", it: "VRM apre le impostazioni di Vinted…", de: "VRM öffnet die Vinted-Einstellungen…" },
    va_deja: { fr: "Déjà dans cet état : rien n’a été touché.", en: "Already in this state: nothing was touched.", es: "Ya está así: no se ha tocado nada.", it: "Già in questo stato: non è stato toccato nulla.", de: "Bereits so: nichts wurde verändert." },
    va_fait_on: { fr: "Fait : Vinted montre le compte en vacances.", en: "Done: Vinted shows the account on holiday.", es: "Hecho: Vinted muestra la cuenta de vacaciones.", it: "Fatto: Vinted mostra l’account in vacanza.", de: "Erledigt: Vinted zeigt das Konto im Urlaub." },
    va_fait_off: { fr: "Fait : Vinted montre le compte ouvert.", en: "Done: Vinted shows the account open.", es: "Hecho: Vinted muestra la cuenta abierta.", it: "Fatto: Vinted mostra l’account aperto.", de: "Erledigt: Vinted zeigt das Konto geöffnet." },
    va_manque: { fr: "Vinted a changé sa page (élément « {m} » introuvable) : rien n’a été touché. Fais-le sur vinted.fr (Paramètres) une fois : VRM retiendra la page.", en: "Vinted changed its page (element “{m}” not found): nothing was touched. Do it once on vinted.fr (Settings): VRM will remember the page.", es: "Vinted cambió su página (elemento «{m}» no encontrado): no se tocó nada. Hazlo una vez en vinted.fr (Ajustes): VRM recordará la página.", it: "Vinted ha cambiato pagina (elemento «{m}» non trovato): nulla è stato toccato. Fallo una volta su vinted.fr (Impostazioni): VRM ricorderà la pagina.", de: "Vinted hat seine Seite geändert (Element „{m}“ nicht gefunden): nichts wurde verändert. Mach es einmal auf vinted.fr (Einstellungen): VRM merkt sich die Seite." },
    sa_titre: { fr: "Santé", en: "Health", es: "Salud", it: "Salute", de: "Zustand" },
    sa_lecture: { fr: "Lecture…", en: "Reading…", es: "Leyendo…", it: "Lettura…", de: "Wird gelesen…" },
    sa_pas_su: { fr: "pas su : l’extension n’a pas pu lire l’état des comptes.", en: "unknown: the extension couldn’t read the accounts’ state.", es: "desconocido: la extensión no pudo leer el estado de las cuentas.", it: "non noto: l’estensione non ha potuto leggere lo stato degli account.", de: "unbekannt: die Erweiterung konnte den Kontostatus nicht lesen." },
    sa_aucun: { fr: "Aucun compte Vinted relié dans ce navigateur.", en: "No Vinted account linked in this browser.", es: "Ninguna cuenta de Vinted vinculada en este navegador.", it: "Nessun account Vinted collegato in questo browser.", de: "Kein Vinted-Konto in diesem Browser verbunden." },
    sa_ici: { fr: "· ouvert ici", en: "· open here", es: "· abierta aquí", it: "· aperto qui", de: "· hier geöffnet" },
    sa_e_bon: { fr: "Bon", en: "Good", es: "Bien", it: "Buono", de: "Gut" },
    sa_e_attention: { fr: "Attention", en: "Caution", es: "Atención", it: "Attenzione", de: "Achtung" },
    sa_e_pause: { fr: "Pause", en: "Paused", es: "Pausa", it: "Pausa", de: "Pause" },
    sa_e_passu: { fr: "—", en: "—", es: "—", it: "—", de: "—" },
    sa_r_bon: { fr: "Rien à signaler.", en: "Nothing to report.", es: "Nada que señalar.", it: "Niente da segnalare.", de: "Nichts zu melden." },
    sa_r_passu: { fr: "Le compteur d’actions n’a pas pu être lu.", en: "The action counter couldn’t be read.", es: "No se pudo leer el contador de acciones.", it: "Il contatore delle azioni non è stato letto.", de: "Der Aktionszähler konnte nicht gelesen werden." },
    sa_r_bloque: { fr: "Vinted a bloqué ce compte.", en: "Vinted blocked this account.", es: "Vinted bloqueó esta cuenta.", it: "Vinted ha bloccato questo account.", de: "Vinted hat dieses Konto gesperrt." },
    sa_r_captcha: { fr: "Vinted a demandé une vérification : VRM s’est arrêté.", en: "Vinted asked for a check: VRM stopped.", es: "Vinted pidió una verificación: VRM se detuvo.", it: "Vinted ha chiesto una verifica: VRM si è fermato.", de: "Vinted hat eine Prüfung verlangt: VRM hat angehalten." },
    sa_r_moderation: { fr: "Vinted a modéré ce compte : VRM s’est arrêté.", en: "Vinted moderated this account: VRM stopped.", es: "Vinted moderó esta cuenta: VRM se detuvo.", it: "Vinted ha moderato questo account: VRM si è fermato.", de: "Vinted hat dieses Konto moderiert: VRM hat angehalten." },
    sa_r_deconnecte: { fr: "Ce compte n’est plus connecté sur vinted.fr.", en: "This account is no longer signed in on vinted.fr.", es: "Esta cuenta ya no está conectada en vinted.fr.", it: "Questo account non è più connesso su vinted.fr.", de: "Dieses Konto ist auf vinted.fr nicht mehr angemeldet." },
    sa_r_pause_vinted: { fr: "Vinted a demandé de ralentir : pause jusqu’à {h}.", en: "Vinted asked to slow down: paused until {h}.", es: "Vinted pidió ir más despacio: pausa hasta las {h}.", it: "Vinted ha chiesto di rallentare: pausa fino alle {h}.", de: "Vinted bat um Verlangsamung: Pause bis {h}." },
    sa_r_plafond_heure: { fr: "Plafond de l’heure atteint.", en: "Hourly limit reached.", es: "Límite por hora alcanzado.", it: "Limite orario raggiunto.", de: "Stundenlimit erreicht." },
    sa_r_plafond_jour: { fr: "Plafond du jour atteint.", en: "Daily limit reached.", es: "Límite diario alcanzado.", it: "Limite giornaliero raggiunto.", de: "Tageslimit erreicht." },
    sa_r_prudence: { fr: "Prudence après un refus de Vinted, jusqu’à {h}.", en: "Careful mode after a Vinted refusal, until {h}.", es: "Prudencia tras un rechazo de Vinted, hasta las {h}.", it: "Prudenza dopo un rifiuto di Vinted, fino alle {h}.", de: "Vorsicht nach einer Ablehnung von Vinted, bis {h}." },
    sa_r_refus: { fr: "Vinted a refusé une demande ces dernières 24 h.", en: "Vinted refused a request in the last 24 h.", es: "Vinted rechazó una petición en las últimas 24 h.", it: "Vinted ha rifiutato una richiesta nelle ultime 24 h.", de: "Vinted hat in den letzten 24 h eine Anfrage abgelehnt." },
    sa_r_verification_recente: { fr: "Une vérification de Vinted ces dernières 24 h.", en: "A Vinted check in the last 24 h.", es: "Una verificación de Vinted en las últimas 24 h.", it: "Una verifica di Vinted nelle ultime 24 h.", de: "Eine Vinted-Prüfung in den letzten 24 h." },
    sa_r_pas_vu: { fr: "Un geste n’a pas été vu à l’écran ces dernières 24 h.", en: "An action wasn’t seen on screen in the last 24 h.", es: "Un gesto no se vio en pantalla en las últimas 24 h.", it: "Un’azione non è stata vista sullo schermo nelle ultime 24 h.", de: "Eine Aktion war in den letzten 24 h nicht auf dem Bildschirm zu sehen." },
    sa_r_presque_plafond: { fr: "Près du plafond (80 %).", en: "Close to the limit (80%).", es: "Cerca del límite (80 %).", it: "Vicino al limite (80%).", de: "Nahe am Limit (80 %)." },
    sa_g_bloque: { fr: "Regarde la question « compte bloqué » dans VRM.", en: "Check the “blocked account” question in VRM.", es: "Mira la pregunta «cuenta bloqueada» en VRM.", it: "Guarda la domanda «account bloccato» in VRM.", de: "Sieh dir die Frage „Konto gesperrt“ in VRM an." },
    sa_g_verification: { fr: "Fais la vérification sur vinted.fr, puis touche « Reprendre » dans VRM.", en: "Do the check on vinted.fr, then tap “Resume” in VRM.", es: "Haz la verificación en vinted.fr y pulsa «Reanudar» en VRM.", it: "Fai la verifica su vinted.fr, poi tocca «Riprendi» in VRM.", de: "Mach die Prüfung auf vinted.fr und tippe dann in VRM auf „Fortsetzen“." },
    sa_g_regarder: { fr: "Regarde Ma journée dans VRM, puis touche « Reprendre ».", en: "Check My day in VRM, then tap “Resume”.", es: "Mira Mi día en VRM y pulsa «Reanudar».", it: "Guarda La mia giornata in VRM, poi tocca «Riprendi».", de: "Sieh dir Mein Tag in VRM an und tippe auf „Fortsetzen“." },
    sa_g_reconnecter: { fr: "Reconnecte-toi sur vinted.fr.", en: "Sign in again on vinted.fr.", es: "Vuelve a conectarte en vinted.fr.", it: "Accedi di nuovo su vinted.fr.", de: "Melde dich auf vinted.fr wieder an." },
    sa_g_attendre: { fr: "Rien à faire : VRM reprend seul.", en: "Nothing to do: VRM resumes on its own.", es: "Nada que hacer: VRM se reanuda solo.", it: "Niente da fare: VRM riprende da solo.", de: "Nichts zu tun: VRM macht von selbst weiter." },
    sa_g_demain: { fr: "Rien à faire : VRM reprend demain.", en: "Nothing to do: VRM resumes tomorrow.", es: "Nada que hacer: VRM sigue mañana.", it: "Niente da fare: VRM riprende domani.", de: "Nichts zu tun: VRM macht morgen weiter." },
    sa_g_ralentir: { fr: "Laisse VRM ralentir ; évite les envois en série pour l’instant.", en: "Let VRM slow down; avoid batch sends for now.", es: "Deja que VRM vaya despacio; evita envíos en serie por ahora.", it: "Lascia rallentare VRM; evita invii in serie per ora.", de: "Lass VRM langsamer werden; vermeide vorerst Serienversand." },
    sa_g_regarder_onglet: { fr: "Regarde l’onglet de travail : la page de Vinted a peut-être changé.", en: "Look at the work tab: Vinted’s page may have changed.", es: "Mira la pestaña de trabajo: la página de Vinted quizá cambió.", it: "Guarda la scheda di lavoro: la pagina di Vinted forse è cambiata.", de: "Sieh dir den Arbeits-Tab an: die Vinted-Seite hat sich vielleicht geändert." },
    sa_l_heure: { fr: "Actions cette heure", en: "Actions this hour", es: "Acciones esta hora", it: "Azioni in quest’ora", de: "Aktionen diese Stunde" },
    sa_l_jour: { fr: "Actions aujourd’hui", en: "Actions today", es: "Acciones hoy", it: "Azioni oggi", de: "Aktionen heute" },
    sa_l_favoris: { fr: "Favoris contactés", en: "Favourites contacted", es: "Favoritos contactados", it: "Preferiti contattati", de: "Kontaktierte Favoriten" },
    sa_l_refus: { fr: "Refus de Vinted (24 h)", en: "Vinted refusals (24 h)", es: "Rechazos de Vinted (24 h)", it: "Rifiuti di Vinted (24 h)", de: "Vinted-Ablehnungen (24 h)" },
    sa_l_verifs: { fr: "Vérifications (24 h)", en: "Checks (24 h)", es: "Verificaciones (24 h)", it: "Verifiche (24 h)", de: "Prüfungen (24 h)" },
    sa_l_pasvu: { fr: "Gestes « pas vus » (24 h)", en: "Actions “not seen” (24 h)", es: "Gestos «no vistos» (24 h)", it: "Azioni «non viste» (24 h)", de: "Aktionen „nicht gesehen“ (24 h)" },
    sa_l_derniere: { fr: "Dernière vérification", en: "Last check", es: "Última verificación", it: "Ultima verifica", de: "Letzte Prüfung" },
    sa_l_pause: { fr: "Pause en cours", en: "Current pause", es: "Pausa en curso", it: "Pausa in corso", de: "Laufende Pause" },
    sa_l_bloque: { fr: "Compte bloqué", en: "Account blocked", es: "Cuenta bloqueada", it: "Account bloccato", de: "Konto gesperrt" },
    sa_sur: { fr: "{a} sur {b}", en: "{a} of {b}", es: "{a} de {b}", it: "{a} su {b}", de: "{a} von {b}" },
    sa_au_moins: { fr: "au moins (autres navigateurs pas lus)", en: "at least (other browsers not read)", es: "al menos (otros navegadores sin leer)", it: "almeno (altri browser non letti)", de: "mindestens (andere Browser nicht gelesen)" },
    sa_fav: { fr: "{h} cette heure · {j} aujourd’hui", en: "{h} this hour · {j} today", es: "{h} esta hora · {j} hoy", it: "{h} in quest’ora · {j} oggi", de: "{h} diese Stunde · {j} heute" },
    sa_refus: { fr: "403 : {a} · 429 : {b}", en: "403: {a} · 429: {b}", es: "403: {a} · 429: {b}", it: "403: {a} · 429: {b}", de: "403: {a} · 429: {b}" },
    sa_jusqua: { fr: "jusqu’à {h}", en: "until {h}", es: "hasta las {h}", it: "fino alle {h}", de: "bis {h}" },
    sa_prudence: { fr: "prudence jusqu’à {h}", en: "careful until {h}", es: "prudencia hasta las {h}", it: "prudenza fino alle {h}", de: "Vorsicht bis {h}" },
    sa_oui: { fr: "Oui", en: "Yes", es: "Sí", it: "Sì", de: "Ja" },
    sa_non: { fr: "Non", en: "No", es: "No", it: "No", de: "Nein" },
    sa_note: { fr: "Lu dans ce navigateur, sans rien demander à Vinted. « — » : pas su.", en: "Read in this browser, without asking Vinted anything. “—”: unknown.", es: "Leído en este navegador, sin pedir nada a Vinted. «—»: desconocido.", it: "Letto in questo browser, senza chiedere nulla a Vinted. «—»: non noto.", de: "In diesem Browser gelesen, ohne Vinted etwas zu fragen. „—“: unbekannt." },
    fp_st_rep: { fr: "{r} réponses sur {l} relus ({p} %)", en: "{r} replies of {l} re-read ({p}%)", es: "{r} respuestas de {l} releídos ({p} %)", it: "{r} risposte su {l} riletti ({p}%)", de: "{r} Antworten von {l} erneut gelesen ({p} %)" },
    fp_st_rep_passu: { fr: "réponses : fils pas encore relus", en: "replies: threads not re-read yet", es: "respuestas: hilos aún no releídos", it: "risposte: conversazioni non ancora rilette", de: "Antworten: Verläufe noch nicht erneut gelesen" },
    fp_st_oa: { fr: "{n} offres acceptées", en: "{n} offers accepted", es: "{n} ofertas aceptadas", it: "{n} offerte accettate", de: "{n} Angebote angenommen" },
    e10_etapes: { fr: "Étapes de l’envoi", en: "Sending steps", es: "Pasos del envío", it: "Passaggi dell’invio", de: "Versandschritte" },
    e10_selection: { fr: "Sélection", en: "Selection", es: "Selección", it: "Selezione", de: "Auswahl" },
    e10_reduction: { fr: "Réduction", en: "Discount", es: "Descuento", it: "Sconto", de: "Rabatt" },
    e10_message: { fr: "Message", en: "Message", es: "Mensaje", it: "Messaggio", de: "Nachricht" },
    e10_lancer: { fr: "Lancer", en: "Send", es: "Lanzar", it: "Avvia", de: "Starten" },
    e10_enregistrer: { fr: "Enregistrer", en: "Save", es: "Guardar", it: "Salva", de: "Speichern" },
    e10_pas: { fr: "Étape {n} sur 4 · {t}", en: "Step {n} of 4 · {t}", es: "Paso {n} de 4 · {t}", it: "Passo {n} di 4 · {t}", de: "Schritt {n} von 4 · {t}" },
    e10_suivant: { fr: "Suivant", en: "Next", es: "Siguiente", it: "Avanti", de: "Weiter" },
    e10_retour: { fr: "Retour", en: "Back", es: "Atrás", it: "Indietro", de: "Zurück" },
    e10_valider_taux: { fr: "Valider la réduction", en: "Confirm the discount", es: "Validar el descuento", it: "Conferma lo sconto", de: "Rabatt bestätigen" },
    e10_valider_msg: { fr: "Valider le message", en: "Confirm the message", es: "Validar el mensaje", it: "Conferma il messaggio", de: "Nachricht bestätigen" },
    e10_lancer_n: { fr: "Lancer l’envoi ({n})", en: "Start sending ({n})", es: "Lanzar el envío ({n})", it: "Avvia l’invio ({n})", de: "Versand starten ({n})" },
    e10_retirer: { fr: "Retirer", en: "Remove", es: "Quitar", it: "Togli", de: "Entfernen" },
    e10_retirer_aria: { fr: "Retirer {qui} de l’envoi", en: "Remove {qui} from the send", es: "Quitar a {qui} del envío", it: "Togli {qui} dall’invio", de: "{qui} aus dem Versand entfernen" },
    e10_compte: { fr: "{n} favoris choisis · {max} au plus maintenant", en: "{n} favourites chosen · {max} at most now", es: "{n} favoritos elegidos · {max} como máximo ahora", it: "{n} preferiti scelti · {max} al massimo ora", de: "{n} Favoriten gewählt · höchstens {max} jetzt" },
    e10_sautes: { fr: "{n} favoris seront sautés (voir pourquoi)", en: "{n} favourites will be skipped (see why)", es: "{n} favoritos se saltarán (ver por qué)", it: "{n} preferiti saranno saltati (vedi perché)", de: "{n} Favoriten werden übersprungen (warum ansehen)" },
    e10_remontees: { fr: "{n} offre(s) remontée(s) à ton plancher (prix mini, sinon achat + 10 %).", en: "{n} offer(s) raised to your floor (minimum price, else purchase + 10%).", es: "{n} oferta(s) subida(s) a tu mínimo (precio mínimo, si no compra + 10 %).", it: "{n} offerta/e alzata/e al tuo minimo (prezzo minimo, altrimenti acquisto + 10%).", de: "{n} Angebot(e) auf deine Untergrenze angehoben (Mindestpreis, sonst Einkauf + 10 %)." },
    e10_favori_n: { fr: "Favori {i} sur {n} · {qui}", en: "Favourite {i} of {n} · {qui}", es: "Favorito {i} de {n} · {qui}", it: "Preferito {i} di {n} · {qui}", de: "Favorit {i} von {n} · {qui}" },
    e10_prec: { fr: "Favori précédent", en: "Previous favourite", es: "Favorito anterior", it: "Preferito precedente", de: "Vorheriger Favorit" },
    e10_suiv: { fr: "Favori suivant", en: "Next favourite", es: "Favorito siguiente", it: "Preferito successivo", de: "Nächster Favorit" },
    e10_versions: { fr: "Choisir une autre version", en: "Pick another version", es: "Elegir otra versión", it: "Scegli un’altra versione", de: "Andere Version wählen" },
    e10_version_auto: { fr: "Laisser VRM choisir", en: "Let VRM choose", es: "Dejar elegir a VRM", it: "Lascia scegliere a VRM", de: "VRM wählen lassen" },
    e10_versions_gardees: { fr: "Tes versions enregistrées", en: "Your saved versions", es: "Tus versiones guardadas", it: "Le tue versioni salvate", de: "Deine gespeicherten Versionen" },
    e10_r_favoris: { fr: "Favoris", en: "Favourites", es: "Favoritos", it: "Preferiti", de: "Favoriten" },
    e10_r_taux: { fr: "−{t} % (jamais sous ton plancher)", en: "−{t}% (never below your floor)", es: "−{t} % (nunca bajo tu mínimo)", it: "−{t}% (mai sotto il tuo minimo)", de: "−{t} % (nie unter deiner Untergrenze)" },
    e10_r_rythme: { fr: "Rythme", en: "Pace", es: "Ritmo", it: "Ritmo", de: "Tempo" },
    e10_r_tous: { fr: "{k} maintenant, le 1er tout de suite", en: "{k} now, the 1st right away", es: "{k} ahora, el 1.º enseguida", it: "{k} ora, il 1° subito", de: "{k} jetzt, der 1. sofort" },
    e10_r_plafond: { fr: "{k} maintenant, les {r} autres à {h}", en: "{k} now, the other {r} at {h}", es: "{k} ahora, los otros {r} a las {h}", it: "{k} ora, gli altri {r} alle {h}", de: "{k} jetzt, die anderen {r} um {h}" },
    e10_premier: { fr: "Rien n’est parti. « Lancer » envoie le 1er message tout de suite, les suivants au hasard toutes les 20 à 60 s.", en: "Nothing has been sent. “Send” sends the 1st message right away, the next ones at random every 20 to 60 s.", es: "No se ha enviado nada. «Lanzar» envía el 1.er mensaje enseguida y los siguientes al azar cada 20 a 60 s.", it: "Non è partito nulla. «Avvia» invia subito il 1° messaggio, i successivi a caso ogni 20–60 s.", de: "Noch nichts gesendet. „Starten“ sendet die 1. Nachricht sofort, die nächsten zufällig alle 20 bis 60 s." },
    e10_plancher: { fr: "Plancher", en: "Floor", es: "Mínimo", it: "Minimo", de: "Untergrenze" },
    e10_exemple: { fr: "Message (exemple)", en: "Message (example)", es: "Mensaje (ejemplo)", it: "Messaggio (esempio)", de: "Nachricht (Beispiel)" },
    e10_auto_on: { fr: "Automatique : allumé", en: "Automatic: on", es: "Automático: activado", it: "Automatico: acceso", de: "Automatisch: an" },
    e10_auto_off: { fr: "Automatique : éteint", en: "Automatic: off", es: "Automático: apagado", it: "Automatico: spento", de: "Automatisch: aus" },
    e10_auto_note_on: { fr: "Les nouveaux favoris reçoivent le message avec tes réglages enregistrés, sans passer par les étapes.", en: "New favourites get the message with your saved settings, without the steps.", es: "Los nuevos favoritos reciben el mensaje con tus ajustes guardados, sin pasos.", it: "I nuovi preferiti ricevono il messaggio con le impostazioni salvate, senza passaggi.", de: "Neue Favoriten erhalten die Nachricht mit deinen gespeicherten Einstellungen, ohne Schritte." },
    e10_auto_note_off: { fr: "Rien ne part sans « Lancer ».", en: "Nothing is sent without “Send”.", es: "Nada sale sin «Lanzar».", it: "Nulla parte senza «Avvia».", de: "Nichts wird ohne „Starten“ gesendet." },
    e10_modifier: { fr: "Modifier", en: "Edit", es: "Editar", it: "Modifica", de: "Ändern" },
    e10_n_versions: { fr: "{n} versions", en: "{n} versions", es: "{n} versiones", it: "{n} versioni", de: "{n} Versionen" },
    e10_par_h: { fr: "{n}/h", en: "{n}/h", es: "{n}/h", it: "{n}/h", de: "{n}/h" },
    e10_auto_rien: { fr: "Rien n’est envoyé ici : ces réglages servent aux prochains envois automatiques.", en: "Nothing is sent here: these settings apply to the next automatic sends.", es: "Aquí no se envía nada: estos ajustes sirven para los próximos envíos automáticos.", it: "Qui non si invia nulla: queste impostazioni valgono per i prossimi invii automatici.", de: "Hier wird nichts gesendet: diese Einstellungen gelten für die nächsten automatischen Sendungen." },
    e10_stats: { fr: "Statistiques", en: "Statistics", es: "Estadísticas", it: "Statistiche", de: "Statistik" },
    e10_stats_titre: { fr: "Ventes obtenues par les messages", en: "Sales won by messages", es: "Ventas logradas con mensajes", it: "Vendite ottenute con i messaggi", de: "Durch Nachrichten erzielte Verkäufe" },
    e10_periode: { fr: "Période", en: "Period", es: "Periodo", it: "Periodo", de: "Zeitraum" },
    e10_jours: { fr: "{n} j", en: "{n} d", es: "{n} d", it: "{n} g", de: "{n} T" },
    e10_c_contactes: { fr: "Contactés", en: "Contacted", es: "Contactados", it: "Contattati", de: "Kontaktiert" },
    e10_c_reponses: { fr: "Réponses", en: "Replies", es: "Respuestas", it: "Risposte", de: "Antworten" },
    e10_c_offresAcceptees: { fr: "Offres acceptées", en: "Offers accepted", es: "Ofertas aceptadas", it: "Offerte accettate", de: "Angebote angenommen" },
    e10_c_ventes: { fr: "Ventes", en: "Sales", es: "Ventas", it: "Vendite", de: "Verkäufe" },
    e10_taux_rep: { fr: "Taux de réponse {p} (sur {l} fils relus)", en: "Reply rate {p} (of {l} re-read threads)", es: "Tasa de respuesta {p} (de {l} hilos releídos)", it: "Tasso di risposta {p} (su {l} conversazioni rilette)", de: "Antwortquote {p} (von {l} erneut gelesenen Verläufen)" },
    e10_taux_vente: { fr: "vendus après contact {p}", en: "sold after contact {p}", es: "vendidos tras contacto {p}", it: "venduti dopo il contatto {p}", de: "nach Kontakt verkauft {p}" },
    e10_dont_auto: { fr: "dont {n} automatiques", en: "{n} of them automatic", es: "{n} de ellos automáticos", it: "di cui {n} automatici", de: "davon {n} automatisch" },
    e10_par_compte: { fr: "Par compte", en: "By account", es: "Por cuenta", it: "Per account", de: "Pro Konto" },
    e10_par_version: { fr: "Par version du message", en: "By message version", es: "Por versión del mensaje", it: "Per versione del messaggio", de: "Pro Nachrichtenversion" },
    e10_version_inconnue: { fr: "Version d’avant", en: "Earlier version", es: "Versión anterior", it: "Versione precedente", de: "Frühere Version" },
    e10_ventes_attribuees: { fr: "Les ventes, et ce qui les a amenées", en: "Sales, and what led to them", es: "Las ventas y lo que las trajo", it: "Le vendite e cosa le ha portate", de: "Verkäufe und was dazu führte" },
    e10_cat_message_seul: { fr: "Message seul", en: "Message only", es: "Solo mensaje", it: "Solo messaggio", de: "Nur Nachricht" },
    e10_cat_message_offre: { fr: "Message + ton offre acceptée", en: "Message + your offer accepted", es: "Mensaje + tu oferta aceptada", it: "Messaggio + la tua offerta accettata", de: "Nachricht + dein Angebot angenommen" },
    e10_cat_offre_acheteur: { fr: "Offre de l’acheteur après le message", en: "Buyer’s offer after the message", es: "Oferta del comprador tras el mensaje", it: "Offerta dell’acquirente dopo il messaggio", de: "Angebot des Käufers nach der Nachricht" },
    e10_cat_sans_contact: { fr: "Vente sans contact (pour comparer)", en: "Sale without contact (to compare)", es: "Venta sin contacto (para comparar)", it: "Vendita senza contatto (per confronto)", de: "Verkauf ohne Kontakt (zum Vergleich)" },
    e10_incertaines: { fr: "+ au moins {n} vente(s) d’une annonce contactée, date pas sûre (dans aucune période).", en: "+ at least {n} sale(s) of a contacted listing, date unsure (in no period).", es: "+ al menos {n} venta(s) de un anuncio contactado, fecha no segura (en ningún periodo).", it: "+ almeno {n} vendita/e di un annuncio contattato, data incerta (in nessun periodo).", de: "+ mindestens {n} Verkauf/Verkäufe einer kontaktierten Anzeige, Datum unsicher (in keinem Zeitraum)." },
    e10_delai: { fr: "Délai moyen contact → vente", en: "Average time contact → sale", es: "Plazo medio contacto → venta", it: "Tempo medio contatto → vendita", de: "Durchschnitt Kontakt → Verkauf" },
    e10_j: { fr: "{n} j", en: "{n} d", es: "{n} d", it: "{n} g", de: "{n} T" },
    e10_stats_note: { fr: "Reliées par l’annonce (et l’acheteur quand il est lu), 14 jours au plus. « — » sous 3 cas. Chiffre d’affaires et bénéfice : dans VRM, Statistiques.", en: "Linked by the listing (and the buyer when read), 14 days at most. “—” under 3 cases. Revenue and profit: in VRM, Statistics.", es: "Vinculadas por el anuncio (y el comprador si se lee), 14 días como máximo. «—» con menos de 3 casos. Facturación y beneficio: en VRM, Estadísticas.", it: "Collegate dall’annuncio (e dall’acquirente se letto), al massimo 14 giorni. «—» sotto i 3 casi. Fatturato e utile: in VRM, Statistiche.", de: "Über die Anzeige verknüpft (und den Käufer, wenn gelesen), höchstens 14 Tage. „—“ unter 3 Fällen. Umsatz und Gewinn: in VRM, Statistik." },
    cd_titre: { fr: "Cadence de ce compte", en: "Pace for this account", es: "Ritmo de esta cuenta", it: "Ritmo di questo account", de: "Tempo dieses Kontos" },
    cd_fav_h: { fr: "Messages aux favoris par heure", en: "Messages to favourites per hour", es: "Mensajes a favoritos por hora", it: "Messaggi ai preferiti all’ora", de: "Nachrichten an Favoriten pro Stunde" },
    cd_act_h: { fr: "Actions par heure", en: "Actions per hour", es: "Acciones por hora", it: "Azioni all’ora", de: "Aktionen pro Stunde" },
    cd_jour: { fr: "Plafond par jour", en: "Daily limit", es: "Límite diario", it: "Limite giornaliero", de: "Tageslimit" },
    cd_pause_min: { fr: "Pause entre deux messages : au moins", en: "Pause between two messages: at least", es: "Pausa entre dos mensajes: como mínimo", it: "Pausa tra due messaggi: almeno", de: "Pause zwischen zwei Nachrichten: mindestens" },
    cd_pause_max: { fr: "Pause entre deux messages : au plus", en: "Pause between two messages: at most", es: "Pausa entre dos mensajes: como máximo", it: "Pausa tra due messaggi: al massimo", de: "Pause zwischen zwei Nachrichten: höchstens" },
    cd_par_heure: { fr: "{n} / h", en: "{n} / h", es: "{n} / h", it: "{n} / h", de: "{n} / Std." },
    cd_par_jour: { fr: "{n} / jour", en: "{n} / day", es: "{n} / día", it: "{n} / giorno", de: "{n} / Tag" },
    cd_secondes: { fr: "{n} s", en: "{n} s", es: "{n} s", it: "{n} s", de: "{n} s" },
    cd_risque: { fr: "Plus vite = plus de risque que Vinted restreigne le compte.", en: "Faster = more risk that Vinted restricts the account.", es: "Más rápido = más riesgo de que Vinted restrinja la cuenta.", it: "Più veloce = più rischio che Vinted limiti l’account.", de: "Schneller = mehr Risiko, dass Vinted das Konto einschränkt." },
    cd_confirme_q: { fr: "Aller plus vite que le réglage par défaut sur ce compte ?", en: "Go faster than the default on this account?", es: "¿Ir más rápido que el ajuste predeterminado en esta cuenta?", it: "Andare più veloce dell’impostazione predefinita su questo account?", de: "Auf diesem Konto schneller als die Standardeinstellung arbeiten?" },
    cd_oui: { fr: "Oui, aller plus vite", en: "Yes, go faster", es: "Sí, ir más rápido", it: "Sì, più veloce", de: "Ja, schneller" },
    cd_defaut: { fr: "Revenir aux valeurs par défaut", en: "Back to defaults", es: "Volver a los valores predeterminados", it: "Torna ai valori predefiniti", de: "Standardwerte wiederherstellen" },
    ra_etat: { fr: "État", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    ra_confirme_note: { fr: "Allumer demande ta confirmation ; éteindre est immédiat.", en: "Turning on asks for your confirmation; turning off is immediate.", es: "Activar pide tu confirmación; desactivar es inmediato.", it: "Attivare chiede la tua conferma; spegnere è immediato.", de: "Einschalten braucht deine Bestätigung; Ausschalten wirkt sofort." },
    ra_allumer: { fr: "Allumer", en: "Turn on", es: "Activar", it: "Attiva", de: "Einschalten" },
    ra_eteindre: { fr: "Éteindre", en: "Turn off", es: "Desactivar", it: "Disattiva", de: "Ausschalten" },
    ra_confirme_q: { fr: "Allumer « {nom} » ? VRM agira seul sur ce compte, dans tes plafonds.", en: "Turn on “{nom}”? VRM will act on its own on this account, within your limits.", es: "¿Activar «{nom}»? VRM actuará solo en esta cuenta, dentro de tus límites.", it: "Attivare «{nom}»? VRM agirà da solo su questo account, entro i tuoi limiti.", de: "„{nom}“ einschalten? VRM handelt auf diesem Konto selbst, innerhalb deiner Grenzen." },
    // (20 nov., intégration 5.410) Allumer l'acceptation automatique AVERTIT : VRM accepte à ta place, une offre acceptée vend la paire, risque nommé (audit-offres-auto).
    ra_confirme_offres: { fr: "Allumer les offres automatiques ? VRM accepte à ta place les offres au-dessus de ton prix mini : une offre acceptée vend la paire, et Vinted peut voir un robot — un risque pour le compte.", en: "Turn on automatic offers? VRM accepts offers above your minimum price on your behalf: an accepted offer sells the item, and Vinted may spot a robot — a risk for the account.", es: "¿Activar las ofertas automáticas? VRM acepta en tu lugar las ofertas por encima de tu precio mínimo: una oferta aceptada vende el artículo, y Vinted puede detectar un robot: un riesgo para la cuenta.", it: "Attivare le offerte automatiche? VRM accetta al posto tuo le offerte sopra il tuo prezzo minimo: un'offerta accettata vende l'articolo, e Vinted può accorgersi di un robot — un rischio per l'account.", de: "Automatische Angebote einschalten? VRM nimmt an deiner Stelle Angebote über deinem Mindestpreis an: Ein angenommenes Angebot verkauft den Artikel, und Vinted kann einen Roboter erkennen — ein Risiko für das Konto." },
    ra_oui: { fr: "Oui, allumer", en: "Yes, turn on", es: "Sí, activar", it: "Sì, attiva", de: "Ja, einschalten" },
    ra_annuler: { fr: "Annuler", en: "Cancel", es: "Cancelar", it: "Annulla", de: "Abbrechen" },
    ra_ok: { fr: "Enregistré : les moteurs liront ce réglage.", en: "Saved: the engines will read this setting.", es: "Guardado: los motores leerán este ajuste.", it: "Salvato: i motori leggeranno questa impostazione.", de: "Gespeichert: die Automatik liest diese Einstellung." },
    ra_ko: { fr: "Rien n’a changé : réessaie.", en: "Nothing changed: try again.", es: "Nada ha cambiado: inténtalo de nuevo.", it: "Non è cambiato nulla: riprova.", de: "Nichts geändert: versuche es erneut." },
    ra_rien: { fr: "Rien à enregistrer.", en: "Nothing to save.", es: "Nada que guardar.", it: "Niente da salvare.", de: "Nichts zu speichern." },
    ra_refus_msg: { fr: "Message de refus", en: "Decline message", es: "Mensaje de rechazo", it: "Messaggio di rifiuto", de: "Ablehnungsnachricht" },
    ra_refus_note: { fr: "Envoyé avec un refus automatique ; vide = aucun message.", en: "Sent with an automatic decline; empty = no message.", es: "Se envía con un rechazo automático; vacío = ningún mensaje.", it: "Inviato con un rifiuto automatico; vuoto = nessun messaggio.", de: "Wird bei automatischer Ablehnung gesendet; leer = keine Nachricht." },
    ra_paliers_pcts: { fr: "Paliers (% vers le plancher)", en: "Steps (% toward the floor)", es: "Escalones (% hacia el mínimo)", it: "Scaglioni (% verso la soglia)", de: "Stufen (% zur Untergrenze)" },
    ra_paliers_note: { fr: "Par exemple 50, 80, 100 — six au plus.", en: "For example 50, 80, 100 — six at most.", es: "Por ejemplo 50, 80, 100 — seis como máximo.", it: "Per esempio 50, 80, 100 — sei al massimo.", de: "Zum Beispiel 50, 80, 100 — höchstens sechs." },
    ra_remise: { fr: "Remise maximale (%)", en: "Maximum discount (%)", es: "Descuento máximo (%)", it: "Sconto massimo (%)", de: "Maximaler Rabatt (%)" },
    ra_remise_note: { fr: "Vide : le prix mini posé à côté du N° sert de plancher.", en: "Empty: the minimum price next to the number is the floor.", es: "Vacío: el precio mínimo junto al N.º es el mínimo.", it: "Vuoto: il prezzo minimo accanto al N° fa da soglia.", de: "Leer: der Mindestpreis neben der Nr. ist die Untergrenze." },
    ra_pct: { fr: "Baisse", en: "Reduction", es: "Bajada", it: "Ribasso", de: "Senkung" },
    ra_jours: { fr: "Après, sans vente", en: "After, without a sale", es: "Después, sin venta", it: "Dopo, senza vendita", de: "Danach, ohne Verkauf" },
    ra_reinit: { fr: "Réinitialiser", en: "Reset", es: "Restablecer", it: "Reimposta", de: "Zurücksetzen" },
    ra_enregistrer: { fr: "Enregistrer", en: "Save", es: "Guardar", it: "Salva", de: "Speichern" },
    v6_accueil: { fr: "Accueil", en: "Home", es: "Inicio", it: "Home", de: "Start" },
    v6_articles: { fr: "Articles", en: "Items", es: "Artículos", it: "Articoli", de: "Artikel" },
    v6_commandes: { fr: "Commandes", en: "Orders", es: "Pedidos", it: "Ordini", de: "Bestellungen" },
    v6_messagerie: { fr: "Messagerie", en: "Inbox", es: "Mensajes", it: "Messaggi", de: "Postfach" },
    v6_general: { fr: "Général", en: "General", es: "General", it: "Generale", de: "Allgemein" },
    v6_plateforme: { fr: "Plateforme", en: "Platform", es: "Plataforma", it: "Piattaforma", de: "Plattform" },
    v6_reduire: { fr: "Réduire la barre latérale", en: "Collapse the sidebar", es: "Contraer la barra lateral", it: "Comprimi la barra laterale", de: "Seitenleiste einklappen" },
    v6_plus: { fr: "Plus", en: "More", es: "Más", it: "Altro", de: "Mehr" },
    v6_plus_titre: { fr: "Autres pages", en: "Other pages", es: "Otras páginas", it: "Altre pagine", de: "Weitere Seiten" },
    v6_mis_a_jour: { fr: "Mis à jour {quand}", en: "Updated {quand}", es: "Actualizado {quand}", it: "Aggiornato {quand}", de: "Aktualisiert {quand}" },
    v6_mettre_a_jour: { fr: "Mettre à jour", en: "Update", es: "Actualizar", it: "Aggiorna", de: "Aktualisieren" },
    v6_comptes: { fr: "Comptes détectés", en: "Accounts detected", es: "Cuentas detectadas", it: "Account rilevati", de: "Erkannte Konten" },
    v6_compte_onglet: { fr: "Compte de cet onglet", en: "Account in this tab", es: "Cuenta de esta pestaña", it: "Account di questa scheda", de: "Konto in diesem Tab" },
    v6_lie: { fr: "Lié à VRM", en: "Linked to VRM", es: "Vinculada a VRM", it: "Collegato a VRM", de: "Mit VRM verbunden" },
    v6_pas_lie: { fr: "Pas encore lu par VRM", en: "Not read by VRM yet", es: "Aún no leída por VRM", it: "Non ancora letto da VRM", de: "Noch nicht von VRM gelesen" },
    v6_compte_vrm: { fr: "Compte VRM", en: "VRM account", es: "Cuenta VRM", it: "Account VRM", de: "VRM-Konto" },
    v6_aujourdhui: { fr: "Aujourd’hui", en: "Today", es: "Hoy", it: "Oggi", de: "Heute" },
    v6_ventes_jour: { fr: "Ventes du jour", en: "Sales today", es: "Ventas de hoy", it: "Vendite di oggi", de: "Verkäufe heute" },
    v6_a_expedier: { fr: "À expédier", en: "To ship", es: "Por enviar", it: "Da spedire", de: "Zu versenden" },
    v6_non_lus: { fr: "Messages non lus", en: "Unread messages", es: "Mensajes no leídos", it: "Messaggi non letti", de: "Ungelesene Nachrichten" },
    v6_en_vente: { fr: "En vente", en: "For sale", es: "En venta", it: "In vendita", de: "Im Verkauf" },
    v6_capte: { fr: "Capté depuis ta dernière visite", en: "Picked up since your last visit", es: "Captado desde tu última visita", it: "Rilevato dalla tua ultima visita", de: "Seit deinem letzten Besuch erfasst" },
    v6_rien_capte: { fr: "Rien de nouveau depuis ta dernière visite.", en: "Nothing new since your last visit.", es: "Nada nuevo desde tu última visita.", it: "Niente di nuovo dalla tua ultima visita.", de: "Nichts Neues seit deinem letzten Besuch." },
    a_n_articles: { fr: "{n} article(s)", en: "{n} item(s)", es: "{n} artículo(s)", it: "{n} articolo/i", de: "{n} Artikel" },
    a_plus: { fr: "Plus d’options", en: "More options", es: "Más opciones", it: "Altre opzioni", de: "Weitere Optionen" },
    v_chercher: { fr: "Rechercher une commande…", en: "Search an order…", es: "Buscar un pedido…", it: "Cerca un ordine…", de: "Bestellung suchen…" },
    v_n_commandes: { fr: "{n} commande(s)", en: "{n} order(s)", es: "{n} pedido(s)", it: "{n} ordine/i", de: "{n} Bestellung(en)" },
    c6_prix: { fr: "Prix", en: "Price", es: "Precio", it: "Prezzo", de: "Preis" },
    c6_date: { fr: "Date", en: "Date", es: "Fecha", it: "Data", de: "Datum" },
    c6_transporteur: { fr: "Transporteur", en: "Carrier", es: "Transportista", it: "Corriere", de: "Versanddienst" },
    c6_statut: { fr: "Statut", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    v_action: { fr: "À expédier", en: "To ship", es: "Por enviar", it: "Da spedire", de: "Zu versenden" },
    v_rien: { fr: "En route", en: "On the way", es: "En camino", it: "In viaggio", de: "Unterwegs" },
    v_terminee: { fr: "Terminée", en: "Completed", es: "Finalizado", it: "Completato", de: "Abgeschlossen" },
    v_annulee: { fr: "Annulée", en: "Cancelled", es: "Cancelado", it: "Annullato", de: "Storniert" },
    v_pas_su: { fr: "Pas su", en: "Unknown", es: "Sin saber", it: "Non noto", de: "Unbekannt" },
    au6_messages: { fr: "Messages", en: "Messages", es: "Mensajes", it: "Messaggi", de: "Nachrichten" },
    au6_messages_note: { fr: "Un texte est tiré au hasard ; jamais deux fois de suite le même.", en: "One text is picked at random; never the same one twice in a row.", es: "Se elige un texto al azar; nunca dos veces seguidas el mismo.", it: "Un testo viene scelto a caso; mai lo stesso due volte di fila.", de: "Ein Text wird zufällig gewählt; nie zweimal hintereinander derselbe." },
    au6_ciblage: { fr: "Ciblage", en: "Targeting", es: "Segmentación", it: "Destinatari", de: "Zielgruppe" },
    au6_rythme_note: { fr: "Temps au hasard entre deux messages.", en: "Random time between two messages.", es: "Tiempo aleatorio entre dos mensajes.", it: "Tempo casuale tra due messaggi.", de: "Zufällige Zeit zwischen zwei Nachrichten." },
    au6_delais: { fr: "Délais", en: "Timing", es: "Plazos", it: "Tempi", de: "Zeiten" },
    au6_attente_note: { fr: "Attente au hasard avant le premier envoi.", en: "Random wait before the first send.", es: "Espera aleatoria antes del primer envío.", it: "Attesa casuale prima del primo invio.", de: "Zufällige Wartezeit vor dem ersten Versand." },
    au6_regle: { fr: "Règle", en: "Rule", es: "Regla", it: "Regola", de: "Regel" },
    au6_minis_note: { fr: "Seules les annonces avec un prix mini sont concernées.", en: "Only listings with a minimum price are affected.", es: "Solo los anuncios con precio mínimo.", it: "Solo gli annunci con un prezzo minimo.", de: "Nur Anzeigen mit Mindestpreis." },
    au6_offres_delai: { fr: "3 à 20 min, au hasard", en: "3 to 20 min, at random", es: "De 3 a 20 min, al azar", it: "Da 3 a 20 min, a caso", de: "3 bis 20 Min., zufällig" },
    au6_apercu: { fr: "Aperçu", en: "Preview", es: "Vista previa", it: "Anteprima", de: "Vorschau" },
    au6_plancher: { fr: "exemple sur 100 €, prix mini {p} €", en: "example on €100, minimum price €{p}", es: "ejemplo con 100 €, precio mínimo {p} €", it: "esempio su 100 €, prezzo minimo {p} €", de: "Beispiel bei 100 €, Mindestpreis {p} €" },
    au6_demarrer: { fr: "Démarrer", en: "Start", es: "Iniciar", it: "Avvia", de: "Starten" },
    // 5.410.4 — « comme Bleam », la suite (panneau, écran d’action, dressing amélioré).
    a_apresvente: { fr: "Après-vente", en: "After-sale", es: "Posventa", it: "Post-vendita", de: "Nach dem Verkauf" },
    a_deposer: { fr: 'Dépôt de brouillons préparés', en: 'Posting prepared drafts', es: 'Publicación de borradores preparados', it: 'Deposito di bozze preparate', de: 'Vorbereitete Entwürfe einstellen' },
    a_supprimer: { fr: "Suppression d’annonces", en: "Deleting listings", es: "Eliminación de anuncios", it: "Eliminazione di annunci", de: "Anzeigen löschen" },
    bm_apresvente: { fr: "Après-vente", en: "After-sale", es: "Posventa", it: "Post-vendita", de: "Nach dem Verkauf" },
    bm_apresvente_sous: { fr: "Bordereau, messages à l’acheteur, évaluation", en: "Label, buyer messages, review", es: "Etiqueta, mensajes al comprador, valoración", it: "Etichetta, messaggi all’acquirente, recensione", de: "Etikett, Käufernachrichten, Bewertung" },
    bm_stockauto: { fr: "Stock auto", en: "Auto stock", es: "Stock automático", it: "Stock automatico", de: "Auto-Bestand" },
    bm_stockauto_sous: { fr: "Remet en ligne quand il en reste plusieurs", en: "Relists when several are left", es: "Vuelve a publicar si quedan varios", it: "Ripubblica se ne restano diversi", de: "Stellt neu ein, wenn mehrere übrig sind" },
    bm_cycle: { fr: "Cycle de vie", en: "Life cycle", es: "Ciclo de vida", it: "Ciclo di vita", de: "Lebenszyklus" },
    bm_cycle_sous: { fr: "Baisses et republications selon l’âge", en: "Price drops and relisting by age", es: "Bajadas y republicaciones según la antigüedad", it: "Ribassi e ripubblicazioni in base all’età", de: "Preissenkungen und Neueinstellen nach Alter" },
    bm_favfiltres: { fr: "Favoris · filtres et analyse", en: "Favourites · filters and analysis", es: "Favoritos · filtros y análisis", it: "Preferiti · filtri e analisi", de: "Favoriten · Filter und Analyse" },
    bm_favfiltres_sous: { fr: "Qui reçoit un message, et qui répond", en: "Who gets a message, and who replies", es: "Quién recibe un mensaje y quién responde", it: "Chi riceve un messaggio e chi risponde", de: "Wer eine Nachricht bekommt und wer antwortet" },
    bm_sauvegarde: { fr: "Sauvegarde automatique", en: "Automatic backup", es: "Copia automática", it: "Backup automatico", de: "Automatische Sicherung" },
    bm_sauvegarde_sous: { fr: "Tes annonces gardées chaque heure", en: "Your listings saved every hour", es: "Tus anuncios guardados cada hora", it: "I tuoi annunci salvati ogni ora", de: "Deine Anzeigen stündlich gesichert" },
    bm_dressing: { fr: "Dressing amélioré", en: "Enhanced wardrobe", es: "Armario mejorado", it: "Guardaroba migliorato", de: "Erweiterter Kleiderschrank" },
    bm_dressing_sous: { fr: "N° et barre d’actions sur ton profil Vinted", en: "Number and action bar on your Vinted profile", es: "N.º y barra de acciones en tu perfil de Vinted", it: "N° e barra delle azioni sul tuo profilo Vinted", de: "Nr. und Aktionsleiste auf deinem Vinted-Profil" },
    bm_s_bordereau: { fr: "Commander le bordereau dès la vente", en: "Order the label as soon as it sells", es: "Pedir la etiqueta al vender", it: "Ordinare l’etichetta alla vendita", de: "Etikett direkt beim Verkauf bestellen" },
    bm_s_msgVente: { fr: "Message après la vente", en: "Message after the sale", es: "Mensaje tras la venta", it: "Messaggio dopo la vendita", de: "Nachricht nach dem Verkauf" },
    bm_s_msgFinalise: { fr: "Message après la finalisation", en: "Message once completed", es: "Mensaje tras la finalización", it: "Messaggio dopo la conclusione", de: "Nachricht nach Abschluss" },
    bm_s_msgRelais: { fr: "Rappel : colis au point relais", en: "Reminder: parcel at the pick-up point", es: "Recordatorio: paquete en el punto de recogida", it: "Promemoria: pacco al punto di ritiro", de: "Erinnerung: Paket im Paketshop" },
    bm_s_msgEvaluation: { fr: "Demande d’évaluation", en: "Review request", es: "Solicitud de valoración", it: "Richiesta di recensione", de: "Bitte um Bewertung" },
    bm_s_eval5: { fr: "Évaluation 5 étoiles à l’acheteur", en: "5-star review for the buyer", es: "Valoración de 5 estrellas al comprador", it: "Recensione a 5 stelle all’acquirente", de: "5-Sterne-Bewertung für den Käufer" },
    bm_s_stockAuto: { fr: "Stock auto", en: "Auto stock", es: "Stock automático", it: "Stock automatico", de: "Auto-Bestand" },
    bm_s_cycle: { fr: "Cycle de vie", en: "Life cycle", es: "Ciclo de vida", it: "Ciclo di vita", de: "Lebenszyklus" },
    bm_s_favoris: { fr: "Filtres des favoris", en: "Favourite filters", es: "Filtros de favoritos", it: "Filtri dei preferiti", de: "Favoritenfilter" },
    bm_s_sauvegarde: { fr: "Sauvegarde automatique", en: "Automatic backup", es: "Copia automática", it: "Backup automatico", de: "Automatische Sicherung" },
    bm_s_dressing: { fr: "Dressing amélioré", en: "Enhanced wardrobe", es: "Armario mejorado", it: "Guardaroba migliorato", de: "Erweiterter Kleiderschrank" },
    bm_colissimo: { fr: "Colissimo", en: "Colissimo", es: "Colissimo", it: "Colissimo", de: "Colissimo" },
    bm_colissimo_note: { fr: "Où tu déposes le colis", en: "Where you drop off the parcel", es: "Dónde dejas el paquete", it: "Dove lasci il pacco", de: "Wo du das Paket abgibst" },
    bm_relais: { fr: "Point relais", en: "Pick-up point", es: "Punto de recogida", it: "Punto di ritiro", de: "Paketshop" },
    bm_boite: { fr: "Boîte aux lettres", en: "Letterbox", es: "Buzón", it: "Cassetta postale", de: "Briefkasten" },
    bm_ebay_jamais: { fr: "Vinted seulement : sur eBay, l’acheteur paie l’étiquette, VRM n’en achète jamais.", en: "Vinted only: on eBay the buyer pays for the label, VRM never buys one.", es: "Solo Vinted: en eBay el comprador paga la etiqueta, VRM nunca compra una.", it: "Solo Vinted: su eBay l’acquirente paga l’etichetta, VRM non ne compra mai.", de: "Nur Vinted: Bei eBay zahlt der Käufer das Etikett, VRM kauft nie eines." },
    bm_bordereau_note: { fr: "Boîte aux lettres : commande-en un à la main une fois, VRM retient ton choix.", en: "Letterbox: order one by hand once, VRM remembers your choice.", es: "Buzón: pide una a mano una vez, VRM recuerda tu elección.", it: "Cassetta postale: ordinane una a mano una volta, VRM ricorda la tua scelta.", de: "Briefkasten: einmal von Hand bestellen, VRM merkt sich deine Wahl." },
    bm_versions: { fr: "Tes versions", en: "Your versions", es: "Tus versiones", it: "Le tue versioni", de: "Deine Versionen" },
    bm_versions_note: { fr: "Une version par ligne, tirée au hasard (5 au plus).", en: "One version per line, picked at random (5 max).", es: "Una versión por línea, elegida al azar (5 como máximo).", it: "Una versione per riga, scelta a caso (massimo 5).", de: "Eine Version pro Zeile, zufällig gewählt (höchstens 5)." },
    bm_heures: { fr: "Après (heures)", en: "After (hours)", es: "Después de (horas)", it: "Dopo (ore)", de: "Nach (Stunden)" },
    bm_relais_note: { fr: "Envoyé une fois, 24 h après l’arrivée au point relais.", en: "Sent once, 24 h after it reaches the pick-up point.", es: "Se envía una vez, 24 h después de llegar al punto.", it: "Inviato una volta, 24 h dopo l’arrivo al punto.", de: "Einmal gesendet, 24 Std. nach Ankunft im Paketshop." },
    bm_litige_note: { fr: "Rien n’est envoyé si la vente est en litige.", en: "Nothing is sent if the sale is disputed.", es: "No se envía nada si la venta está en disputa.", it: "Non viene inviato nulla se la vendita è contestata.", de: "Bei einem Streitfall wird nichts gesendet." },
    bm_eval_appris: { fr: "VRM reprend la forme de ta propre évaluation : laisse-en une à la main une fois.", en: "VRM reuses the format of your own review: leave one by hand once.", es: "VRM reutiliza el formato de tu propia valoración: deja una a mano una vez.", it: "VRM riprende il formato della tua recensione: lasciane una a mano una volta.", de: "VRM übernimmt das Format deiner eigenen Bewertung: gib einmal eine von Hand ab." },
    bm_quantites: { fr: "Quantités par N°", en: "Quantities by number", es: "Cantidades por N.º", it: "Quantità per N°", de: "Mengen pro Nr." },
    bm_quantites_note: { fr: "Une ligne par N° : « 12 = 3 » (3 exemplaires identiques).", en: "One line per number: “12 = 3” (3 identical items).", es: "Una línea por N.º: «12 = 3» (3 artículos idénticos).", it: "Una riga per N°: «12 = 3» (3 articoli identici).", de: "Eine Zeile pro Nr.: „12 = 3“ (3 identische Artikel)." },
    bm_stock_identite: { fr: "Par N° seulement, jamais par ressemblance. L’annonce vendue n’est jamais supprimée.", en: "By number only, never by resemblance. The sold listing is never deleted.", es: "Solo por N.º, nunca por parecido. El anuncio vendido nunca se elimina.", it: "Solo per N°, mai per somiglianza. L’annuncio venduto non viene mai eliminato.", de: "Nur per Nr., nie nach Ähnlichkeit. Die verkaufte Anzeige wird nie gelöscht." },
    bm_strategie: { fr: "Stratégie", en: "Strategy", es: "Estrategia", it: "Strategia", de: "Strategie" },
    bm_anti: { fr: "Anti-stagnation", en: "Anti-stagnation", es: "Antiestancamiento", it: "Anti-stagnazione", de: "Gegen Stillstand" },
    bm_destock: { fr: "Déstockage", en: "Clearance", es: "Liquidación", it: "Svuota magazzino", de: "Abverkauf" },
    bm_vierge: { fr: "Vierge", en: "Blank", es: "En blanco", it: "Vuota", de: "Leer" },
    bm_anti_note: { fr: "Après 7 j sans vente −10 %, republie 3 j plus tard, recommence tous les 7 j jusqu’à −20 % au total.", en: "After 7 days unsold −10%, relist 3 days later, repeat every 7 days up to −20% in total.", es: "Tras 7 días sin venta −10 %, republica 3 días después, repite cada 7 días hasta −20 % en total.", it: "Dopo 7 giorni senza vendita −10%, ripubblica 3 giorni dopo, ripeti ogni 7 giorni fino a −20% in totale.", de: "Nach 7 Tagen ohne Verkauf −10 %, 3 Tage später neu einstellen, alle 7 Tage wiederholen bis insgesamt −20 %." },
    bm_destock_note: { fr: "Après 3 j −10 %, encore −10 % tous les 3 j, republie, recommence tous les 12 j jusqu’à −20 %, puis republie tous les 7 j.", en: "After 3 days −10%, again −10% every 3 days, relist, repeat every 12 days up to −20%, then relist every 7 days.", es: "Tras 3 días −10 %, otra vez −10 % cada 3 días, republica, repite cada 12 días hasta −20 %, luego republica cada 7 días.", it: "Dopo 3 giorni −10%, ancora −10% ogni 3 giorni, ripubblica, ripeti ogni 12 giorni fino a −20%, poi ripubblica ogni 7 giorni.", de: "Nach 3 Tagen −10 %, alle 3 Tage weitere −10 %, neu einstellen, alle 12 Tage bis −20 %, danach alle 7 Tage neu einstellen." },
    bm_vierge_note: { fr: "Tes propres étapes.", en: "Your own steps.", es: "Tus propios pasos.", it: "I tuoi passaggi.", de: "Deine eigenen Schritte." },
    bm_etapes: { fr: "Étapes", en: "Steps", es: "Pasos", it: "Passaggi", de: "Schritte" },
    bm_etapes_note: { fr: "Une par ligne : « 7 baisse 10 » ou « 10 republier » (jours depuis la mise en ligne).", en: "One per line: “7 baisse 10” or “10 republier” (days since listing).", es: "Una por línea: «7 baisse 10» o «10 republier» (días desde la publicación).", it: "Una per riga: «7 baisse 10» o «10 republier» (giorni dalla pubblicazione).", de: "Eine pro Zeile: „7 baisse 10“ oder „10 republier“ (Tage seit dem Einstellen)." },
    bm_repeter: { fr: "Recommencer après (jours)", en: "Repeat after (days)", es: "Repetir después de (días)", it: "Ripeti dopo (giorni)", de: "Wiederholen nach (Tagen)" },
    bm_plafond: { fr: "Baisse totale au plus (%)", en: "Maximum total drop (%)", es: "Bajada total máxima (%)", it: "Ribasso totale massimo (%)", de: "Höchste Gesamtsenkung (%)" },
    bm_rythme: { fr: "Rythme", en: "Pace", es: "Ritmo", it: "Ritmo", de: "Tempo" },
    bm_repub_jour: { fr: "Republications par jour (min – max)", en: "Relists per day (min – max)", es: "Republicaciones al día (mín – máx)", it: "Ripubblicazioni al giorno (min – max)", de: "Neueinstellungen pro Tag (min – max)" },
    bm_prix_jour: { fr: "Changements de prix par jour (min – max)", en: "Price changes per day (min – max)", es: "Cambios de precio al día (mín – máx)", it: "Cambi di prezzo al giorno (min – max)", de: "Preisänderungen pro Tag (min – max)" },
    bm_jours: { fr: "Jours", en: "Days", es: "Días", it: "Giorni", de: "Tage" },
    bm_j0: { fr: "D", en: "Su", es: "D", it: "D", de: "So" },
    bm_j1: { fr: "L", en: "Mo", es: "L", it: "L", de: "Mo" },
    bm_j2: { fr: "M", en: "Tu", es: "M", it: "M", de: "Di" },
    bm_j3: { fr: "M", en: "We", es: "X", it: "M", de: "Mi" },
    bm_j4: { fr: "J", en: "Th", es: "J", it: "G", de: "Do" },
    bm_j5: { fr: "V", en: "Fr", es: "V", it: "V", de: "Fr" },
    bm_j6: { fr: "S", en: "Sa", es: "S", it: "S", de: "Sa" },
    bm_heures_plage: { fr: "Plage horaire (heure de Paris)", en: "Time window (Paris time)", es: "Franja horaria (hora de París)", it: "Fascia oraria (ora di Parigi)", de: "Zeitfenster (Pariser Zeit)" },
    bm_cycle_plancher: { fr: "Jamais sous ton prix mini, sinon ton achat + 10 %. Sans l’un ni l’autre : aucune baisse.", en: "Never below your minimum price, otherwise your purchase price + 10%. Without either: no drop.", es: "Nunca por debajo de tu precio mínimo, si no tu compra + 10 %. Sin ninguno: ninguna bajada.", it: "Mai sotto il tuo prezzo minimo, altrimenti il tuo acquisto + 10%. Senza nessuno dei due: nessun ribasso.", de: "Nie unter deinem Mindestpreis, sonst Einkauf + 10 %. Ohne beides: keine Senkung." },
    bm_note_min: { fr: "Note de l’acheteur au moins (0 = tous)", en: "Buyer rating at least (0 = all)", es: "Valoración del comprador mínima (0 = todos)", it: "Valutazione dell’acquirente almeno (0 = tutti)", de: "Käuferbewertung mindestens (0 = alle)" },
    bm_par_article: { fr: "Messages par article au plus (0 = sans limite)", en: "Messages per item at most (0 = no limit)", es: "Mensajes por artículo como máximo (0 = sin límite)", it: "Messaggi per articolo al massimo (0 = nessun limite)", de: "Nachrichten pro Artikel höchstens (0 = ohne Limit)" },
    bm_periode: { fr: "Favoris des N derniers jours (0 = tous)", en: "Favourites from the last N days (0 = all)", es: "Favoritos de los últimos N días (0 = todos)", it: "Preferiti degli ultimi N giorni (0 = tutti)", de: "Favoriten der letzten N Tage (0 = alle)" },
    bm_apres_min: { fr: "Attendre après le favori (minutes)", en: "Wait after the favourite (minutes)", es: "Esperar tras el favorito (minutos)", it: "Attendi dopo il preferito (minuti)", de: "Nach dem Favorisieren warten (Minuten)" },
    bm_reecrire: { fr: "Réécrire au même acheteur après (jours)", en: "Write to the same buyer again after (days)", es: "Volver a escribir al mismo comprador tras (días)", it: "Riscrivere allo stesso acquirente dopo (giorni)", de: "Demselben Käufer erneut schreiben nach (Tagen)" },
    bm_filtres_note: { fr: "Un acheteur sans note est écarté si une note minimale est posée.", en: "A buyer without a rating is skipped if a minimum is set.", es: "Un comprador sin valoración se descarta si hay un mínimo.", it: "Un acquirente senza valutazione viene escluso se è impostato un minimo.", de: "Ein Käufer ohne Bewertung wird übersprungen, wenn ein Minimum gesetzt ist." },
    bm_analyse: { fr: "Réponses à tes messages", en: "Replies to your messages", es: "Respuestas a tus mensajes", it: "Risposte ai tuoi messaggi", de: "Antworten auf deine Nachrichten" },
    bm_analyse_note: { fr: "Par version : envoyés, réponses sur les conversations relues. Une conversation pas relue n’est pas « sans réponse ».", en: "Per version: sent, replies among conversations read. An unread conversation is not “no reply”.", es: "Por versión: enviados, respuestas en las conversaciones leídas. Una conversación no leída no es «sin respuesta».", it: "Per versione: inviati, risposte nelle conversazioni lette. Una conversazione non letta non è «senza risposta».", de: "Pro Version: gesendet, Antworten in gelesenen Unterhaltungen. Eine ungelesene Unterhaltung ist nicht „ohne Antwort“." },
    bm_version: { fr: "Version", en: "Version", es: "Versión", it: "Versione", de: "Version" },
    bm_envoyes: { fr: "Envoyés", en: "Sent", es: "Enviados", it: "Inviati", de: "Gesendet" },
    bm_reponses: { fr: "Réponses / relues", en: "Replies / read", es: "Respuestas / leídas", it: "Risposte / lette", de: "Antworten / gelesen" },
    bm_taux: { fr: "Taux", en: "Rate", es: "Tasa", it: "Tasso", de: "Quote" },
    bm_analyse_vide: { fr: "Aucun message envoyé depuis cette version de l’extension.", en: "No message sent since this extension version.", es: "Ningún mensaje enviado desde esta versión de la extensión.", it: "Nessun messaggio inviato da questa versione dell’estensione.", de: "Seit dieser Erweiterungsversion keine Nachricht gesendet." },
    bm_analyser: { fr: "Analyser", en: "Analyse", es: "Analizar", it: "Analizza", de: "Analysieren" },
    bm_sauve_derniere: { fr: "Dernière sauvegarde {quand} · {n} annonces", en: "Last backup {quand} · {n} listings", es: "Última copia {quand} · {n} anuncios", it: "Ultimo backup {quand} · {n} annunci", de: "Letzte Sicherung {quand} · {n} Anzeigen" },
    bm_sauve_jamais: { fr: "Pas encore de sauvegarde automatique.", en: "No automatic backup yet.", es: "Aún no hay copia automática.", it: "Ancora nessun backup automatico.", de: "Noch keine automatische Sicherung." },
    bm_sauve_note: { fr: "Depuis la dernière lecture de ton dressing ; rien n’est demandé à Vinted.", en: "From the last read of your wardrobe; nothing is asked of Vinted.", es: "Desde la última lectura de tu armario; no se pide nada a Vinted.", it: "Dall’ultima lettura del tuo guardaroba; nulla viene chiesto a Vinted.", de: "Aus dem letzten Lesen deines Kleiderschranks; Vinted wird nichts gefragt." },
    bm_tri: { fr: "Trier", en: "Sort", es: "Ordenar", it: "Ordina", de: "Sortieren" },
    bm_tri_recentes: { fr: "Plus récentes", en: "Newest", es: "Más recientes", it: "Più recenti", de: "Neueste" },
    bm_tri_anciennes: { fr: "Plus anciennes", en: "Oldest", es: "Más antiguas", it: "Più vecchi", de: "Älteste" },
    bm_tri_vues_plus: { fr: "Plus vues", en: "Most viewed", es: "Más vistas", it: "Più visti", de: "Meistgesehen" },
    bm_tri_vues_moins: { fr: "Moins vues", en: "Least viewed", es: "Menos vistas", it: "Meno visti", de: "Am wenigsten gesehen" },
    bm_tri_favoris: { fr: "Plus de favoris", en: "Most favourites", es: "Más favoritos", it: "Più preferiti", de: "Meiste Favoriten" },
    bm_tri_prix_bas: { fr: "Prix croissant", en: "Price ascending", es: "Precio ascendente", it: "Prezzo crescente", de: "Preis aufsteigend" },
    bm_tri_prix_haut: { fr: "Prix décroissant", en: "Price descending", es: "Precio descendente", it: "Prezzo decrescente", de: "Preis absteigend" },
    bm_tri_republiees: { fr: "Plus republiées", en: "Most relisted", es: "Más republicadas", it: "Più ripubblicati", de: "Am häufigsten neu eingestellt" },
    bm_filtre: { fr: "Afficher", en: "Show", es: "Mostrar", it: "Mostra", de: "Anzeigen" },
    bm_f_toutes: { fr: "Toutes", en: "All", es: "Todas", it: "Tutti", de: "Alle" },
    bm_f_sauve: { fr: "Sauvegardées", en: "Saved", es: "Guardadas", it: "Salvati", de: "Gesichert" },
    bm_f_non: { fr: "Pas sauvegardées", en: "Not saved", es: "No guardadas", it: "Non salvati", de: "Nicht gesichert" },
    bm_dressing_note: { fr: "Sur ton profil seulement (le compte connecté). Chaque action demande ta confirmation.", en: "On your profile only (the signed-in account). Each action asks for your confirmation.", es: "Solo en tu perfil (la cuenta conectada). Cada acción pide tu confirmación.", it: "Solo sul tuo profilo (l’account connesso). Ogni azione chiede la tua conferma.", de: "Nur auf deinem Profil (das angemeldete Konto). Jede Aktion fragt nach deiner Bestätigung." },
    pp_exemple: { fr: "Article à {p} € : {b} € au plus bas", en: "Item at €{p}: €{b} at the lowest", es: "Artículo a {p} €: {b} € como mínimo", it: "Articolo a {p} €: {b} € al minimo", de: "Artikel zu {p} €: {b} € am niedrigsten" },
    pp_exemple_vide: { fr: "Ajoute une tranche pour voir l’exemple.", en: "Add a range to see the example.", es: "Añade un tramo para ver el ejemplo.", it: "Aggiungi una fascia per vedere l’esempio.", de: "Füge einen Bereich hinzu, um das Beispiel zu sehen." },
    pp_tranches: { fr: "Par tranche de prix", en: "By price range", es: "Por tramo de precio", it: "Per fascia di prezzo", de: "Nach Preisbereich" },
    pp_tranches_l: { fr: "Tranches", en: "Ranges", es: "Tramos", it: "Fasce", de: "Bereiche" },
    pp_tranches_note: { fr: "Une par ligne : « 20-40:6 » = de 20 € à 40 €, baisse max 6 €.", en: "One per line: “20-40:6” = from €20 to €40, max drop €6.", es: "Una por línea: «20-40:6» = de 20 € a 40 €, bajada máx. 6 €.", it: "Una per riga: «20-40:6» = da 20 € a 40 €, ribasso max 6 €.", de: "Eine pro Zeile: „20-40:6“ = von 20 € bis 40 €, max. 6 € Senkung." },
    pp_flexible: { fr: "Rester flexible", en: "Stay flexible", es: "Ser flexible", it: "Restare flessibile", de: "Flexibel bleiben" },
    pp_flexible_note: { fr: "Accepter si l’offre est à peine sous ton prochain prix.", en: "Accept if the offer is just below your next price.", es: "Aceptar si la oferta está justo por debajo de tu próximo precio.", it: "Accetta se l’offerta è appena sotto il tuo prossimo prezzo.", de: "Annehmen, wenn das Angebot knapp unter deinem nächsten Preis liegt." },
    pp_oui: { fr: "Oui", en: "Yes", es: "Sí", it: "Sì", de: "Ja" },
    pp_non: { fr: "Non", en: "No", es: "No", it: "No", de: "Nein" },
    pp_ecart: { fr: "Écart accepté (€)", en: "Accepted gap (€)", es: "Diferencia aceptada (€)", it: "Scarto accettato (€)", de: "Akzeptierte Abweichung (€)" },
    pp_arrondi: { fr: "Arrondi du contre-prix", en: "Counter-price rounding", es: "Redondeo de la contraoferta", it: "Arrotondamento della controfferta", de: "Rundung des Gegenpreises" },
    pp_bonus: { fr: "Bonus de lot (%)", en: "Bundle bonus (%)", es: "Bonificación por lote (%)", it: "Bonus lotto (%)", de: "Paketbonus (%)" },
    pp_bonus_note: { fr: "Baisse élargie si l’acheteur prend plusieurs articles.", en: "Wider drop if the buyer takes several items.", es: "Bajada mayor si el comprador lleva varios artículos.", it: "Ribasso maggiore se l’acquirente prende più articoli.", de: "Größere Senkung, wenn der Käufer mehrere Artikel nimmt." },
    pp_messages: { fr: "Messages par étape", en: "Messages per step", es: "Mensajes por etapa", it: "Messaggi per fase", de: "Nachrichten pro Schritt" },
    pp_messages_note: { fr: "Une version par ligne, tirée au hasard ; {price} = le prix.", en: "One version per line, picked at random; {price} = the price.", es: "Una versión por línea, al azar; {price} = el precio.", it: "Una versione per riga, a caso; {price} = il prezzo.", de: "Eine Version pro Zeile, zufällig; {price} = der Preis." },
    pp_msgAccepte: { fr: "Offre acceptée", en: "Offer accepted", es: "Oferta aceptada", it: "Offerta accettata", de: "Angebot angenommen" },
    pp_msgContre: { fr: "Contre-offre", en: "Counter-offer", es: "Contraoferta", it: "Controfferta", de: "Gegenangebot" },
    pp_msgFinale: { fr: "Offre finale", en: "Final offer", es: "Oferta final", it: "Offerta finale", de: "Letztes Angebot" },
    pp_delais: { fr: "Délai avant de répondre (minutes, au hasard)", en: "Delay before replying (minutes, random)", es: "Espera antes de responder (minutos, al azar)", it: "Attesa prima di rispondere (minuti, a caso)", de: "Wartezeit vor der Antwort (Minuten, zufällig)" },
    pp_plancher_absolu: { fr: "Plancher absolu : ton prix mini, sinon ton achat + 10 %. Jamais en dessous.", en: "Absolute floor: your minimum price, otherwise your purchase + 10%. Never below.", es: "Mínimo absoluto: tu precio mínimo, si no tu compra + 10 %. Nunca por debajo.", it: "Soglia assoluta: il tuo prezzo minimo, altrimenti il tuo acquisto + 10%. Mai sotto.", de: "Absolute Untergrenze: dein Mindestpreis, sonst Einkauf + 10 %. Nie darunter." },
    dp_sauvegardes: { fr: "Sauvegardes", en: "Backups", es: "Copias", it: "Backup", de: "Sicherungen" },
    dp_planifications: { fr: "Planifications", en: "Schedules", es: "Planificaciones", it: "Pianificazioni", de: "Planungen" },
    dp_stock: { fr: "Stock auto", en: "Auto stock", es: "Stock automático", it: "Stock automatico", de: "Auto-Bestand" },
    dp_planifier: { fr: "Planifier", en: "Schedule", es: "Planificar", it: "Pianifica", de: "Planen" },
    dp_modifier: { fr: "Modifier", en: "Edit", es: "Editar", it: "Modifica", de: "Bearbeiten" },
    dp_republier: { fr: "Republier", en: "Relist", es: "Republicar", it: "Ripubblica", de: "Neu einstellen" },
    dp_supprimer: { fr: "Supprimer", en: "Delete", es: "Eliminar", it: "Elimina", de: "Löschen" },
    dp_choisies: { fr: "{n} choisie(s)", en: "{n} selected", es: "{n} elegida(s)", it: "{n} selezionato/i", de: "{n} ausgewählt" },
    dp_confirme_sup: { fr: "Supprimer {n} annonce(s) sur Vinted ? C’est définitif.", en: "Delete {n} listing(s) on Vinted? This is permanent.", es: "¿Eliminar {n} anuncio(s) en Vinted? Es definitivo.", it: "Eliminare {n} annuncio/i su Vinted? È definitivo.", de: "{n} Anzeige(n) auf Vinted löschen? Das ist endgültig." },
    dp_confirme_rep: { fr: "Republier {n} annonce(s) (coffre, brouillon, suppression, mise en ligne) ?", en: "Relist {n} listing(s) (vault, draft, deletion, publishing)?", es: "¿Republicar {n} anuncio(s) (copia, borrador, eliminación, publicación)?", it: "Ripubblicare {n} annuncio/i (copia, bozza, eliminazione, pubblicazione)?", de: "{n} Anzeige(n) neu einstellen (Sicherung, Entwurf, Löschen, Veröffentlichen)?" },
    dp_quantite: { fr: "Quantité (exemplaires identiques)", en: "Quantity (identical items)", es: "Cantidad (artículos idénticos)", it: "Quantità (articoli identici)", de: "Menge (identische Artikel)" },
    dp_confirmer: { fr: "Confirmer", en: "Confirm", es: "Confirmar", it: "Conferma", de: "Bestätigen" },
    dp_annuler: { fr: "Annuler", en: "Cancel", es: "Cancelar", it: "Annulla", de: "Abbrechen" },
    dp_choisir: { fr: "Choisir", en: "Select", es: "Elegir", it: "Seleziona", de: "Auswählen" },
    dp_ok: { fr: "C’est fait.", en: "Done.", es: "Hecho.", it: "Fatto.", de: "Erledigt." },
    dp_ko: { fr: "Rien n’est parti : {r}", en: "Nothing was sent: {r}", es: "No se envió nada: {r}", it: "Non è partito nulla: {r}", de: "Nichts wurde gesendet: {r}" },
    dp_sauve_oui: { fr: "Sauvegardée", en: "Saved", es: "Guardada", it: "Salvato", de: "Gesichert" },
    au6_favoris_sous: { fr: "Une offre puis un message à qui met en favori", en: "An offer then a message to whoever favourites", es: "Una oferta y un mensaje a quien marca como favorito", it: "Un’offerta e poi un messaggio a chi mette nei preferiti", de: "Ein Angebot, dann eine Nachricht an alle, die favorisieren" },
    au6_offres_sous: { fr: "Accepte les offres au-dessus de ton prix mini", en: "Accepts offers above your minimum price", es: "Acepta ofertas por encima de tu precio mínimo", it: "Accetta le offerte sopra il tuo prezzo minimo", de: "Nimmt Angebote über deinem Mindestpreis an" },
    au6_paliers_sous: { fr: "Contre-offres par paliers, jamais sous le plancher", en: "Tiered counter-offers, never below the floor", es: "Contraofertas por escalones, nunca bajo el mínimo", it: "Controfferte a scaglioni, mai sotto la soglia", de: "Gegenangebote in Stufen, nie unter der Untergrenze" },
    au6_baisse_sous: { fr: "Baisse le prix après quelques jours sans vente", en: "Lowers the price after a few days without a sale", es: "Baja el precio tras unos días sin venta", it: "Abbassa il prezzo dopo alcuni giorni senza vendita", de: "Senkt den Preis nach einigen Tagen ohne Verkauf" },
    // ── la carte ──
    c_notifications: { fr: "Notifications", en: "Notifications", es: "Notificaciones", it: "Notifiche", de: "Benachrichtigungen" },
    c_automatisations: { fr: "Automatisations", en: "Automations", es: "Automatizaciones", it: "Automazioni", de: "Automatisierungen" },
    s_tous: { fr: "Toutes", en: "All", es: "Todos", it: "Tutti", de: "Alle" },
    s_en_vente: { fr: "En vente", en: "For sale", es: "En venta", it: "In vendita", de: "Zum Verkauf" },
    s_brouillon: { fr: "Brouillon", en: "Draft", es: "Borrador", it: "Bozza", de: "Entwurf" },
    s_masque: { fr: "Masqué", en: "Hidden", es: "Oculto", it: "Nascosto", de: "Ausgeblendet" },
    s_reserve: { fr: "Réservé", en: "Reserved", es: "Reservado", it: "Riservato", de: "Reserviert" },
    s_vendu: { fr: "Vendu", en: "Sold", es: "Vendido", it: "Venduto", de: "Verkauft" },
    s_a_confirmer: { fr: "Pas revue récemment", en: "Not checked recently", es: "Sin revisar hace tiempo", it: "Non ricontrollato di recente", de: "Länger nicht geprüft" },
    s_pas_revue: { fr: "Pas revue récemment", en: "Not checked recently", es: "Sin revisar hace tiempo", it: "Non ricontrollato di recente", de: "Länger nicht geprüft" },
    s_pas_revues: { fr: "Pas revues récemment", en: "Not checked recently", es: "Sin revisar hace tiempo", it: "Non ricontrollati di recente", de: "Länger nicht geprüft" },
    s_pas_revue_j: { fr: "Pas revue depuis {n} j", en: "Not checked for {n} d", es: "Sin revisar desde hace {n} d", it: "Non ricontrollato da {n} g", de: "Seit {n} T. nicht geprüft" },
    s_pas_revue_lu: { fr: "Pas revues depuis la lecture {d}", en: "Not checked since the reading {d}", es: "Sin revisar desde la lectura {d}", it: "Non ricontrollati dalla lettura {d}", de: "Seit dem Lesen {d} nicht geprüft" },
    s_longtemps: { fr: "il y a longtemps", en: "a long time ago", es: "hace tiempo", it: "tempo fa", de: "vor langer Zeit" },
    s_ouvre_compte: { fr: "Ouvre ce compte sur Vinted pour mettre à jour.", en: "Open this account on Vinted to update.", es: "Abre esta cuenta en Vinted para actualizar.", it: "Apri questo account su Vinted per aggiornare.", de: "Öffne dieses Konto auf Vinted, um zu aktualisieren." },
    s_relecture: { fr: "VRM relit ton dressing en ce moment : la liste se met à jour seule.", en: "VRM is re-reading your wardrobe now: the list updates by itself.", es: "VRM está releyendo tu armario: la lista se actualiza sola.", it: "VRM sta rileggendo il tuo armadio: l’elenco si aggiorna da solo.", de: "VRM liest deinen Kleiderschrank gerade neu: die Liste aktualisiert sich selbst." },
    c6_limite: { fr: "Date limite", en: "Deadline", es: "Fecha límite", it: "Scadenza", de: "Frist" },
    c6_bordereau: { fr: "Bordereau", en: "Label", es: "Etiqueta", it: "Etichetta", de: "Etikett" },
    p_suivi: { fr: "N° de suivi", en: "Tracking no.", es: "N.º de seguimiento", it: "N. di tracciamento", de: "Sendungsnr." },
    v_avant: { fr: "Avant le {d}", en: "Before {d}", es: "Antes del {d}", it: "Entro il {d}", de: "Bis {d}" },
    imp_un: { fr: "Imprimer le bordereau", en: "Print the label", es: "Imprimir la etiqueta", it: "Stampa l’etichetta", de: "Etikett drucken" },
    imp_n: { fr: "Imprimer les {n} bordereaux", en: "Print the {n} labels", es: "Imprimir las {n} etiquetas", it: "Stampa le {n} etichette", de: "Die {n} Etiketten drucken" },
    imp_court: { fr: "Imprimer", en: "Print", es: "Imprimir", it: "Stampa", de: "Drucken" },
    imp_pas_note: { fr: "Vinted ne l’a pas encore fourni : VRM le récupère seul à ta prochaine visite sur Vinted.", en: "Vinted hasn’t provided it yet: VRM fetches it by itself on your next visit to Vinted.", es: "Vinted aún no la ha dado: VRM la recupera sola en tu próxima visita a Vinted.", it: "Vinted non l’ha ancora fornita: VRM la recupera da solo alla tua prossima visita su Vinted.", de: "Vinted hat es noch nicht geliefert: VRM holt es beim nächsten Besuch auf Vinted selbst." },
    imp_pas: { fr: "Pas encore de bordereau", en: "No label yet", es: "Aún sin etiqueta", it: "Ancora nessuna etichetta", de: "Noch kein Etikett" },
    imp_en_cours: { fr: "Ouverture du bordereau…", en: "Opening the label…", es: "Abriendo la etiqueta…", it: "Apertura dell’etichetta…", de: "Etikett wird geöffnet…" },
    imp_ouvert: { fr: "Bordereau ouvert dans un onglet : imprime-le de là.", en: "Label opened in a tab: print it from there.", es: "Etiqueta abierta en una pestaña: imprímela desde allí.", it: "Etichetta aperta in una scheda: stampala da lì.", de: "Etikett in einem Tab geöffnet: von dort drucken." },
    imp_telecharges: { fr: "{n} bordereau(x) téléchargé(s) : ouvre-les pour les imprimer.", en: "{n} label(s) downloaded: open them to print.", es: "{n} etiqueta(s) descargada(s): ábrelas para imprimir.", it: "{n} etichetta/e scaricata/e: aprile per stampare.", de: "{n} Etikett(en) heruntergeladen: zum Drucken öffnen." },
    imp_manque: { fr: "{n} sans bordereau : Vinted ne l’a pas encore fourni, VRM le récupère seul.", en: "{n} without a label: Vinted hasn’t provided it yet, VRM fetches it by itself.", es: "{n} sin etiqueta: Vinted aún no la ha dado, VRM la recupera sola.", it: "{n} senza etichetta: Vinted non l’ha ancora fornita, VRM la recupera da solo.", de: "{n} ohne Etikett: Vinted hat es noch nicht geliefert, VRM holt es selbst." },
    imp_passu: { fr: "La base VRM n’a pas répondu : réessaie dans un moment.", en: "The VRM database didn’t answer: try again in a moment.", es: "La base de VRM no respondió: inténtalo en un momento.", it: "Il database VRM non ha risposto: riprova tra poco.", de: "Die VRM-Datenbank hat nicht geantwortet: gleich noch einmal versuchen." },
    a_choisir: { fr: "Choisir une action", en: "Choose an action", es: "Elegir una acción", it: "Scegli un’azione", de: "Aktion wählen" },
    a_choisir_n: { fr: "Choisir une action ({n})", en: "Choose an action ({n})", es: "Elegir una acción ({n})", it: "Scegli un’azione ({n})", de: "Aktion wählen ({n})" },
    ac_republier: { fr: "Republier dans VRM", en: "Relist in VRM", es: "Volver a publicar en VRM", it: "Ripubblica in VRM", de: "In VRM neu einstellen" },
    ac_baisser: { fr: "Baisser le prix dans VRM", en: "Lower the price in VRM", es: "Bajar el precio en VRM", it: "Abbassa il prezzo in VRM", de: "Preis in VRM senken" },
    ac_masquer: { fr: 'Masquer sur Vinted', en: 'Hide on Vinted', es: 'Ocultar en Vinted', it: 'Nascondi su Vinted', de: 'Auf Vinted ausblenden' },
    ac_afficher: { fr: 'Afficher sur Vinted', en: 'Show on Vinted', es: 'Mostrar en Vinted', it: 'Mostra su Vinted', de: 'Auf Vinted einblenden' },
    a_conf_masquer: { fr: 'Masquer {n} annonce(s) sur Vinted ? Elles restent à toi, invisibles des acheteurs.', en: 'Hide {n} listing(s) on Vinted? They stay yours, invisible to buyers.', es: '¿Ocultar {n} anuncio(s) en Vinted? Siguen siendo tuyos, invisibles para los compradores.', it: 'Nascondere {n} annuncio/i su Vinted? Restano tuoi, invisibili agli acquirenti.', de: '{n} Anzeige(n) auf Vinted ausblenden? Sie bleiben deine, unsichtbar für Käufer.' },
    a_conf_afficher: { fr: 'Remettre {n} annonce(s) en vue sur Vinted ?', en: 'Show {n} listing(s) again on Vinted?', es: '¿Volver a mostrar {n} anuncio(s) en Vinted?', it: 'Mostrare di nuovo {n} annuncio/i su Vinted?', de: '{n} Anzeige(n) auf Vinted wieder einblenden?' },
    a_annuler: { fr: 'Annuler', en: 'Cancel', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen' },
    a_masque_ok: { fr: '{n} masquée(s) : Vinted l’a accepté.', en: '{n} hidden: Vinted accepted.', es: '{n} oculto(s): Vinted lo ha aceptado.', it: '{n} nascosto/i: Vinted l’ha accettato.', de: '{n} ausgeblendet: Vinted hat es angenommen.' },
    a_affiche_ok: { fr: '{n} remise(s) en vue : Vinted l’a accepté.', en: '{n} shown again: Vinted accepted.', es: '{n} visible(s) de nuevo: Vinted lo ha aceptado.', it: '{n} di nuovo visibile/i: Vinted l’ha accettato.', de: '{n} wieder eingeblendet: Vinted hat es angenommen.' },
    a_masque_ko: { fr: 'Arrêté après {n} : rien d’autre n’est parti.', en: 'Stopped after {n}: nothing else was sent.', es: 'Detenido tras {n}: no salió nada más.', it: 'Fermato dopo {n}: non è partito altro.', de: 'Nach {n} gestoppt: sonst wurde nichts gesendet.' },
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
    c5_place: { fr: 'Place', en: 'Spot', es: 'Ubicación', it: 'Posto', de: 'Platz' },
    p_place: { fr: 'Place au stock (rangée-colonne)', en: 'Stock spot (row-column)', es: 'Ubicación en stock (fila-columna)', it: 'Posto in magazzino (riga-colonna)', de: 'Lagerplatz (Reihe-Spalte)' },
    c5_statut: { fr: "Statut", en: "Status", es: "Estado", it: "Stato", de: "Status" },
    au_active: { fr: "Activé", en: "On", es: "Activado", it: "Attivo", de: "Aktiv" },
    au_desactive: { fr: "Désactivé", en: "Off", es: "Desactivado", it: "Disattivato", de: "Aus" },
    au_bientot: { fr: 'Bientôt', en: 'Coming soon', es: 'Próximamente', it: 'In arrivo', de: 'Demnächst' },
    au_paliers: { fr: 'Négocier par paliers', en: 'Negotiate in steps', es: 'Negociar por escalones', it: 'Negoziare a gradini', de: 'Stufenweise verhandeln' },
    au_paliers_pcts: { fr: 'Paliers vers le plancher', en: 'Steps to the floor', es: 'Escalones hacia el suelo', it: 'Gradini verso la soglia', de: 'Stufen zum Boden' },
    au_paliers_plancher: { fr: 'Plancher', en: 'Floor', es: 'Suelo', it: 'Soglia', de: 'Boden' },
    au_plancher_mini: { fr: 'Le prix mini du N°', en: 'The item’s lowest price', es: 'El precio mínimo del n.º', it: 'Il prezzo minimo del n.', de: 'Der Mindestpreis der Nr.' },
    au_plancher_remise: { fr: 'Prix mini, sinon −{r} %', en: 'Lowest price, otherwise −{r}%', es: 'Precio mínimo o, si no, −{r} %', it: 'Prezzo minimo, altrimenti −{r} %', de: 'Mindestpreis, sonst −{r} %' },
    au_site_lbc: { fr: 'Leboncoin ne dit pas qui a mis une annonce en favori et n’a pas d’offres : pas de messages aux favoris ni de négociation ici. Tes intéressés sont dans Articles ; la baisse par règle de ce compte se règle ci-dessous, jamais sous le plancher.', en: 'Leboncoin does not say who saved a listing and has no offers: no messages to favourites or negotiation here. Your interested buyers are in Items; this account’s rule-based price drop is set below, never under the floor.', es: 'Leboncoin no dice quién guardó un anuncio y no tiene ofertas: aquí no hay mensajes a favoritos ni negociación. Tus interesados están en Artículos; la bajada por regla de esta cuenta se ajusta abajo, nunca bajo el mínimo.', it: 'Leboncoin non dice chi ha salvato un annuncio e non ha offerte: qui niente messaggi ai preferiti né negoziazione. I tuoi interessati sono in Articoli; il ribasso a regola di questo account si imposta qui sotto, mai sotto la soglia.', de: 'Leboncoin sagt nicht, wer eine Anzeige gemerkt hat, und hat keine Angebote: hier keine Nachrichten an Favoriten und keine Verhandlung. Deine Interessenten stehen unter Artikel; die Preissenkung nach Regel für dieses Konto stellst du unten ein, nie unter der Untergrenze.' },
    au_site_vc: { fr: 'Vestiaire : les offres à ceux qui ont « aimé » tes articles partent du parcours Favoris. La baisse par règle de ce compte se règle ci-dessous ; pas encore de négociation par paliers ici.', en: 'Vestiaire: offers to people who “liked” your items start from the Favourites flow. This account’s rule-based price drop is set below; no tiered negotiation here yet.', es: 'Vestiaire: las ofertas a quienes «les gusta» tus artículos salen del recorrido Favoritos. La bajada por regla de esta cuenta se ajusta abajo; aún no hay negociación por escalones aquí.', it: 'Vestiaire: le offerte a chi ha messo «mi piace» partono dal percorso Preferiti. Il ribasso a regola di questo account si imposta qui sotto; qui ancora nessuna negoziazione a scaglioni.', de: 'Vestiaire: Angebote an alle, die deine Artikel „geliked“ haben, starten im Favoriten-Ablauf. Die Preissenkung nach Regel für dieses Konto stellst du unten ein; hier noch keine Verhandlung in Stufen.' },
    f_vc_aimes: { fr: 'Les personnes qui ont aimé tes articles se voient dans le panneau ouvert sur l’onglet vestiairecollective.com (Favoris).', en: 'People who liked your items are shown in the panel opened on the vestiairecollective.com tab (Favourites).', es: 'Las personas a las que les gustaron tus artículos se ven en el panel abierto en la pestaña vestiairecollective.com (Favoritos).', it: 'Le persone a cui sono piaciuti i tuoi articoli si vedono nel pannello aperto sulla scheda vestiairecollective.com (Preferiti).', de: 'Personen, denen deine Artikel gefallen, siehst du im Panel auf dem Tab vestiairecollective.com (Favoriten).' },
    a_sans_compte: { fr: '{n} annonce(s) lue(s) sans compte : pas montrées ici (jamais attribuées au hasard).', en: '{n} listing(s) read without an account: not shown here (never guessed).', es: '{n} anuncio(s) leído(s) sin cuenta: no se muestran aquí (nunca se adivina).', it: '{n} annuncio/i letto/i senza account: non mostrati qui (mai attribuiti a caso).', de: '{n} Anzeige(n) ohne Konto gelesen: hier nicht gezeigt (nie geraten).' },
    au_baisse_regle: { fr: 'Règle', en: 'Rule', es: 'Regla', it: 'Regola', de: 'Regel' },
    au_baisse_pct: { fr: '−{p} % tous les {j} jours sans vente', en: '−{p}% every {j} days without a sale', es: '−{p} % cada {j} días sin venta', it: '−{p} % ogni {j} giorni senza vendita', de: '−{p} % alle {j} Tage ohne Verkauf' },
    au_baisse_plancher: { fr: 'Jamais sous le prix mini (sinon l’achat + 10 %) ; sans l’un ni l’autre, pas de baisse.', en: 'Never below the lowest price (otherwise cost + 10%); with neither, no drop.', es: 'Nunca por debajo del precio mínimo (si no, compra + 10 %); sin ninguno, no hay bajada.', it: 'Mai sotto il prezzo minimo (altrimenti acquisto + 10 %); senza nessuno dei due, nessun ribasso.', de: 'Nie unter dem Mindestpreis (sonst Einkauf + 10 %); ohne beides keine Senkung.' },
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
    m_site_nonlus: { fr: '{n} message(s) non lu(s) sur ce compte : les conversations s’affichent ici une fois ouvertes sur le site.', en: '{n} unread message(s) on this account: conversations appear here once opened on the site.', es: '{n} mensaje(s) sin leer en esta cuenta: las conversaciones aparecen aquí una vez abiertas en el sitio.', it: '{n} messaggio/i non letto/i su questo account: le conversazioni compaiono qui dopo averle aperte sul sito.', de: '{n} ungelesene Nachricht(en) auf diesem Konto: Unterhaltungen erscheinen hier, sobald du sie auf der Website geöffnet hast.' },
    m_site_rien: { fr: 'Aucune conversation lue sur ce compte : ouvre ta messagerie sur le site une fois.', en: 'No conversation read on this account: open your inbox on the site once.', es: 'Ninguna conversación leída en esta cuenta: abre tu mensajería en el sitio una vez.', it: 'Nessuna conversazione letta su questo account: apri una volta i messaggi sul sito.', de: 'Keine Unterhaltung auf diesem Konto gelesen: öffne einmal dein Postfach auf der Website.' },
    // 5.412 — Vestiaire : le fil, l'envoi par l'interface de la page, les personnes qui ont aimé.
    vc_parti: { fr: 'Envoyé : le message est apparu dans la conversation sur Vestiaire.', en: 'Sent: the message appeared in the conversation on Vestiaire.', es: 'Enviado: el mensaje apareció en la conversación de Vestiaire.', it: 'Inviato: il messaggio è comparso nella conversazione su Vestiaire.', de: 'Gesendet: Die Nachricht ist in der Unterhaltung auf Vestiaire erschienen.' },
    vc_fil_pas_su: { fr: 'Lecture impossible pour l’instant — rien n’est perdu, réessaie dans un moment.', en: 'Could not read it for now — nothing is lost, try again in a moment.', es: 'No se puede leer por ahora — no se pierde nada, vuelve a intentarlo.', it: 'Lettura impossibile per ora — non si perde nulla, riprova tra poco.', de: 'Gerade nicht lesbar — nichts geht verloren, versuch es gleich noch einmal.' },
    vc_fil_jamais: { fr: 'Pas encore lue : ouvre cette conversation une fois sur Vestiaire.', en: 'Not read yet: open this conversation once on Vestiaire.', es: 'Aún no leída: abre esta conversación una vez en Vestiaire.', it: 'Non ancora letta: apri questa conversazione una volta su Vestiaire.', de: 'Noch nicht gelesen: öffne diese Unterhaltung einmal auf Vestiaire.' },
    vc_ouvrir_conv: { fr: 'Ouvrir la conversation', en: 'Open the conversation', es: 'Abrir la conversación', it: 'Apri la conversazione', de: 'Unterhaltung öffnen' },
    vc_pas_ouverte: { fr: 'Pour envoyer, ouvre d’abord cette conversation dans l’onglet : VRM tape ton message dans le champ de Vestiaire puis touche « Envoyer », et vérifie qu’il apparaît.', en: 'To send, first open this conversation in the tab: VRM types your message in Vestiaire’s box, taps “Send”, and checks it appears.', es: 'Para enviar, abre primero esta conversación en la pestaña: VRM escribe tu mensaje en el campo de Vestiaire, pulsa «Enviar» y comprueba que aparece.', it: 'Per inviare, apri prima questa conversazione nella scheda: VRM scrive il messaggio nel campo di Vestiaire, tocca «Invia» e verifica che compaia.', de: 'Zum Senden öffne zuerst diese Unterhaltung im Tab: VRM tippt deine Nachricht in das Feld von Vestiaire, tippt auf „Senden“ und prüft, dass sie erscheint.' },
    vc_toi: { fr: 'Toi', en: 'You', es: 'Tú', it: 'Tu', de: 'Du' },
    vc_lui: { fr: 'L’autre personne', en: 'The other person', es: 'La otra persona', it: 'L’altra persona', de: 'Die andere Person' },
    vc_auteur_passu: { fr: 'Auteur non dit par Vestiaire', en: 'Author not given by Vestiaire', es: 'Autor no indicado por Vestiaire', it: 'Autore non indicato da Vestiaire', de: 'Absender von Vestiaire nicht angegeben' },
    vc_depuis_vrm: { fr: 'envoyé depuis VRM', en: 'sent from VRM', es: 'enviado desde VRM', it: 'inviato da VRM', de: 'aus VRM gesendet' },
    vc_aimes_note: { fr: 'Les personnes qui ont aimé tes articles (Vestiaire les annonce dans ses notifications). Pour leur écrire : ouvre SA conversation, puis écris-lui dans Messages — une personne à la fois, rien ne part tout seul.', en: 'People who liked your items (Vestiaire shows them in its notifications). To write to them: open THEIR conversation, then write in Messages — one person at a time, nothing is sent on its own.', es: 'Las personas a las que les gustaron tus artículos (Vestiaire las anuncia en sus notificaciones). Para escribirles: abre SU conversación y luego escribe en Mensajes — una persona cada vez, nada se envía solo.', it: 'Le persone a cui sono piaciuti i tuoi articoli (Vestiaire le annuncia nelle notifiche). Per scrivere: apri la SUA conversazione, poi scrivi in Messaggi — una persona alla volta, nulla parte da solo.', de: 'Personen, denen deine Artikel gefallen (Vestiaire zeigt sie in seinen Mitteilungen). Zum Schreiben: öffne IHRE Unterhaltung und schreib dann in Nachrichten — eine Person nach der anderen, nichts geht von allein raus.' },
    vc_pas_appris: { fr: 'Avant le premier envoi depuis VRM : réponds UNE fois toi-même à un message sur Vestiaire, dans ce Chrome (VRM retient le champ et le bouton, jamais ton texte).', en: 'Before the first send from VRM: reply ONCE yourself to a message on Vestiaire, in this Chrome (VRM remembers the box and the button, never your text).', es: 'Antes del primer envío desde VRM: responde UNA vez tú mismo a un mensaje en Vestiaire, en este Chrome (VRM recuerda el campo y el botón, nunca tu texto).', it: 'Prima del primo invio da VRM: rispondi UNA volta tu stesso a un messaggio su Vestiaire, in questo Chrome (VRM ricorda il campo e il pulsante, mai il tuo testo).', de: 'Vor dem ersten Senden aus VRM: antworte EINMAL selbst auf eine Nachricht auf Vestiaire, in diesem Chrome (VRM merkt sich Feld und Knopf, nie deinen Text).' },
    vc_aimes_aucun: { fr: 'Personne n’a encore été vu : ouvre tes notifications sur Vestiaire dans ce Chrome.', en: 'Nobody seen yet: open your notifications on Vestiaire in this Chrome.', es: 'Aún no se ha visto a nadie: abre tus notificaciones en Vestiaire en este Chrome.', it: 'Nessuno visto finora: apri le notifiche su Vestiaire in questo Chrome.', de: 'Noch niemand gesehen: öffne deine Mitteilungen auf Vestiaire in diesem Chrome.' },
    vc_aimes_sans_article: { fr: 'Des personnes ont aimé des articles pas encore lus : ouvre « Mes articles » sur Vestiaire (VRM doit savoir à quel compte ils sont).', en: 'People liked items not read yet: open “My items” on Vestiaire (VRM must know which account they belong to).', es: 'Hay personas a las que les gustaron artículos aún no leídos: abre «Mis artículos» en Vestiaire (VRM debe saber de qué cuenta son).', it: 'Ad alcune persone sono piaciuti articoli non ancora letti: apri «I miei articoli» su Vestiaire (VRM deve sapere di quale account sono).', de: 'Personen mögen Artikel, die noch nicht gelesen wurden: öffne „Meine Artikel“ auf Vestiaire (VRM muss wissen, zu welchem Konto sie gehören).' },
    vc_aimes_n: { fr: '{n} personne(s) · {e} déjà écrite(s) depuis VRM', en: '{n} person(s) · {e} already written to from VRM', es: '{n} persona(s) · {e} ya escrita(s) desde VRM', it: '{n} persona/e · {e} già contattata/e da VRM', de: '{n} Person(en) · {e} schon aus VRM angeschrieben' },
    vc_aime_ecrire: { fr: 'Personne {n} : ouvrir', en: 'Person {n}: open', es: 'Persona {n}: abrir', it: 'Persona {n}: apri', de: 'Person {n}: öffnen' },
    vc_aime_ecrit: { fr: 'Personne {n} : déjà écrit', en: 'Person {n}: already written', es: 'Persona {n}: ya escrito', it: 'Persona {n}: già scritto', de: 'Person {n}: schon geschrieben' },
    m_ouvrir_site: { fr: 'Ouvrir sur le site', en: 'Open on the site', es: 'Abrir en el sitio', it: 'Apri sul sito', de: 'Auf der Website öffnen' },
    m_repondre: { fr: 'Répondre sur Vinted', en: 'Reply on Vinted', es: 'Responder en Vinted', it: 'Rispondi su Vinted', de: 'Auf Vinted antworten' },
    m_chercher: { fr: 'Rechercher une conversation', en: 'Search a conversation', es: 'Buscar una conversación', it: 'Cerca una conversazione', de: 'Unterhaltung suchen' },
    m_filtre_nonlus: { fr: 'Non lus · {n}', en: 'Unread · {n}', es: 'Sin leer · {n}', it: 'Non letti · {n}', de: 'Ungelesen · {n}' },
    m_choisir: { fr: 'Choisis une conversation', en: 'Choose a conversation', es: 'Elige una conversación', it: 'Scegli una conversazione', de: 'Wähle eine Unterhaltung' },
    m_choisir_note: { fr: 'Touche une conversation dans la liste pour la voir ici.', en: 'Tap a conversation in the list to see it here.', es: 'Toca una conversación de la lista para verla aquí.', it: 'Tocca una conversazione nell’elenco per vederla qui.', de: 'Tippe auf eine Unterhaltung in der Liste, um sie hier zu sehen.' },
    m_aucun_filtre: { fr: 'Aucune conversation ne correspond.', en: 'No conversation matches.', es: 'Ninguna conversación coincide.', it: 'Nessuna conversazione corrisponde.', de: 'Keine Unterhaltung passt.' },
    e9_taux: { fr: "Réduction sur chaque article", en: "Discount on each item", es: "Descuento en cada artículo", it: "Sconto su ogni articolo", de: "Rabatt auf jeden Artikel" },
    e9_autre: { fr: "Autre", en: "Other", es: "Otro", it: "Altro", de: "Andere" },
    e9_autre_aria: { fr: "Autre taux de réduction, en %", en: "Other discount rate, in %", es: "Otro porcentaje de descuento", it: "Altra percentuale di sconto", de: "Anderer Rabatt in %" },
    e9_autre_mode: { fr: "Ton offre est réglée en euros : choisis un taux pour la remplacer, ou laisse-la.", en: "Your offer is set in euros: pick a rate to replace it, or keep it.", es: "Tu oferta está en euros: elige un porcentaje para cambiarla o déjala.", it: "La tua offerta è in euro: scegli una percentuale per sostituirla o lasciala.", de: "Dein Angebot ist in Euro: wähle einen Satz, um es zu ersetzen, oder lass es." },
    e9_sans_taux: { fr: "Aucune offre réglée : choisis un taux pour faire une offre à chacun.", en: "No offer set: pick a rate to make each person an offer.", es: "Sin oferta: elige un porcentaje para hacer una oferta a cada uno.", it: "Nessuna offerta: scegli una percentuale per fare un'offerta a ciascuno.", de: "Kein Angebot: wähle einen Satz, um jedem ein Angebot zu machen." },
    e9_plancher: { fr: "Jamais sous ton prix mini (sinon achat + 10 %) : l’offre est remontée et c’est dit. Ce taux est gardé pour ce compte.", en: "Never below your minimum price (or purchase + 10 %): the offer is raised and it says so. This rate is kept for this account.", es: "Nunca por debajo de tu precio mínimo (o compra + 10 %): la oferta se sube y se indica. Este porcentaje se guarda para esta cuenta.", it: "Mai sotto il tuo prezzo minimo (o acquisto + 10 %): l'offerta viene alzata e viene detto. Questa percentuale resta per questo account.", de: "Nie unter deinem Mindestpreis (sonst Einkauf + 10 %): das Angebot wird angehoben und es wird gesagt. Dieser Satz bleibt für dieses Konto." },
    e9_message: { fr: "Message · ce que recevra {qui}", en: "Message · what {qui} will receive", es: "Mensaje · lo que recibirá {qui}", it: "Messaggio · cosa riceverà {qui}", de: "Nachricht · was {qui} erhält" },
    e9_modifie: { fr: "modifié pour cet envoi", en: "changed for this send", es: "cambiado para este envío", it: "modificato per questo invio", de: "für diesen Versand geändert" },
    e9_charge: { fr: "Préparation du message…", en: "Preparing the message…", es: "Preparando el mensaje…", it: "Preparazione del messaggio…", de: "Nachricht wird vorbereitet…" },
    e9_msg_variable: { fr: "Ton message demande une information que VRM ne connaît pas pour ce favori : modifie-le pour cet envoi.", en: "Your message needs information VRM doesn't have for this favourite: change it for this send.", es: "Tu mensaje pide un dato que VRM no conoce para este favorito: cámbialo para este envío.", it: "Il tuo messaggio chiede un'informazione che VRM non conosce per questo preferito: modificalo per questo invio.", de: "Deine Nachricht braucht eine Angabe, die VRM für diesen Favoriten nicht kennt: ändere sie für diesen Versand." },
    e9_msg_aucun: { fr: "Aucun message écrit pour ce compte : écris-en un (« Modifier pour cet envoi »).", en: "No message written for this account: write one (“Change for this send”).", es: "Ningún mensaje para esta cuenta: escribe uno («Cambiar para este envío»).", it: "Nessun messaggio per questo account: scrivine uno («Modifica per questo invio»).", de: "Keine Nachricht für dieses Konto: schreib eine („Für diesen Versand ändern“)." },
    e9_msg_refuse: { fr: "Ce message serait refusé par Vinted : modifie-le pour cet envoi.", en: "Vinted would refuse this message: change it for this send.", es: "Vinted rechazaría este mensaje: cámbialo para este envío.", it: "Vinted rifiuterebbe questo messaggio: modificalo per questo invio.", de: "Vinted würde diese Nachricht ablehnen: ändere sie für diesen Versand." },
    e9_modele: { fr: "Le message de cet envoi", en: "The message for this send", es: "El mensaje de este envío", it: "Il messaggio di questo invio", de: "Die Nachricht für diesen Versand" },
    e9_vars: { fr: "{prénom}, {article} et {prix} sont remplacés pour chaque personne.", en: "{prénom}, {article} and {prix} are filled in for each person.", es: "{prénom}, {article} y {prix} se rellenan para cada persona.", it: "{prénom}, {article} e {prix} vengono compilati per ogni persona.", de: "{prénom}, {article} und {prix} werden für jede Person ausgefüllt." },
    e9_garder: { fr: "Enregistrer comme modèle", en: "Save as template", es: "Guardar como plantilla", it: "Salva come modello", de: "Als Vorlage speichern" },
    e9_mes_messages: { fr: "Revenir à mes messages", en: "Back to my messages", es: "Volver a mis mensajes", it: "Torna ai miei messaggi", de: "Zurück zu meinen Nachrichten" },
    e9_modifier: { fr: "Modifier pour cet envoi", en: "Change for this send", es: "Cambiar para este envío", it: "Modifica per questo invio", de: "Für diesen Versand ändern" },
    e9_garde_ok: { fr: "Enregistré dans tes messages.", en: "Saved to your messages.", es: "Guardado en tus mensajes.", it: "Salvato nei tuoi messaggi.", de: "In deinen Nachrichten gespeichert." },
    e9_a_lenvoi: { fr: "Offre calculée à l’envoi (jamais sous ton plancher)", en: "Offer worked out when sending (never below your floor)", es: "Oferta calculada al enviar (nunca bajo tu mínimo)", it: "Offerta calcolata all'invio (mai sotto il tuo minimo)", de: "Angebot wird beim Senden berechnet (nie unter deiner Untergrenze)" },
    e9_calcul: { fr: "Calcul de l’offre…", en: "Working out the offer…", es: "Calculando la oferta…", it: "Calcolo dell'offerta…", de: "Angebot wird berechnet…" },
    e9_sans_plancher: { fr: "Pas d’offre : ton plancher atteint le prix.", en: "No offer: your floor reaches the price.", es: "Sin oferta: tu mínimo alcanza el precio.", it: "Nessuna offerta: il tuo minimo raggiunge il prezzo.", de: "Kein Angebot: deine Untergrenze erreicht den Preis." },
    e9_sans_prix: { fr: "Pas d’offre : prix de l’annonce pas lu.", en: "No offer: listing price not read.", es: "Sin oferta: precio del anuncio no leído.", it: "Nessuna offerta: prezzo dell'annuncio non letto.", de: "Kein Angebot: Preis der Anzeige nicht gelesen." },
    e9_remontee_mini: { fr: "Remontée à ton prix mini : {p} (au lieu de {b})", en: "Raised to your minimum price: {p} (instead of {b})", es: "Subida a tu precio mínimo: {p} (en vez de {b})", it: "Alzata al tuo prezzo minimo: {p} (invece di {b})", de: "Auf deinen Mindestpreis angehoben: {p} (statt {b})" },
    e9_remontee_achat: { fr: "Remontée à achat + 10 % : {p} (au lieu de {b})", en: "Raised to purchase + 10 %: {p} (instead of {b})", es: "Subida a compra + 10 %: {p} (en vez de {b})", it: "Alzata ad acquisto + 10 %: {p} (invece di {b})", de: "Auf Einkauf + 10 % angehoben: {p} (statt {b})" },
    v9_filtres: { fr: "Filtrer les commandes", en: "Filter orders", es: "Filtrar pedidos", it: "Filtra gli ordini", de: "Bestellungen filtern" },
    v9_f_tous: { fr: "Toutes", en: "All", es: "Todos", it: "Tutti", de: "Alle" },
    v9_f_sans_bord: { fr: "À expédier · sans bordereau", en: "To ship · no label", es: "Por enviar · sin etiqueta", it: "Da spedire · senza etichetta", de: "Zu versenden · ohne Etikett" },
    v9_f_bord_pret: { fr: "Bordereau prêt", en: "Label ready", es: "Etiqueta lista", it: "Etichetta pronta", de: "Etikett bereit" },
    v9_f_en_route: { fr: "En route", en: "On the way", es: "En camino", it: "In viaggio", de: "Unterwegs" },
    v9_f_terminees: { fr: "Terminées", en: "Finished", es: "Terminados", it: "Concluse", de: "Abgeschlossen" },
    v9_tout: { fr: "Tout sélectionner (commandes montrées)", en: "Select all (orders shown)", es: "Seleccionar todo (pedidos mostrados)", it: "Seleziona tutto (ordini mostrati)", de: "Alle auswählen (angezeigte Bestellungen)" },
    v9_choisir: { fr: "Choisir la commande {t}", en: "Select order {t}", es: "Elegir el pedido {t}", it: "Scegli l'ordine {t}", de: "Bestellung {t} wählen" },
    v9_sel1: { fr: "1 commande choisie", en: "1 order selected", es: "1 pedido elegido", it: "1 ordine scelto", de: "1 Bestellung gewählt" },
    v9_sel: { fr: "{n} commandes choisies", en: "{n} orders selected", es: "{n} pedidos elegidos", it: "{n} ordini scelti", de: "{n} Bestellungen gewählt" },
    v9_sans1: { fr: "1 sans bordereau : elle ne sera pas imprimée", en: "1 without a label: it won't be printed", es: "1 sin etiqueta: no se imprimirá", it: "1 senza etichetta: non verrà stampata", de: "1 ohne Etikett: wird nicht gedruckt" },
    v9_sans: { fr: "{n} sans bordereau : elles ne seront pas imprimées", en: "{n} without a label: they won't be printed", es: "{n} sin etiqueta: no se imprimirán", it: "{n} senza etichetta: non verranno stampate", de: "{n} ohne Etikett: werden nicht gedruckt" },
    v9_imp: { fr: "Imprimer {n} bordereaux", en: "Print {n} labels", es: "Imprimir {n} etiquetas", it: "Stampa {n} etichette", de: "{n} Etiketten drucken" },
    v9_copier: { fr: "Copier {n} n° de suivi", en: "Copy {n} tracking no.", es: "Copiar {n} n.º de seguimiento", it: "Copia {n} n. di tracciamento", de: "{n} Sendungsnr. kopieren" },
    v9_ouvrir: { fr: "Ouvrir sur Vinted", en: "Open on Vinted", es: "Abrir en Vinted", it: "Apri su Vinted", de: "Auf Vinted öffnen" },
    v9_cmd1: { fr: "Commander le bordereau", en: "Order the label", es: "Pedir la etiqueta", it: "Richiedi l'etichetta", de: "Etikett anfordern" },
    v9_cmd: { fr: "Commander {n} bordereaux", en: "Order {n} labels", es: "Pedir {n} etiquetas", it: "Richiedi {n} etichette", de: "{n} Etiketten anfordern" },
    v9_cmd_conf: { fr: "Demander {n} bordereau(x) à Vinted pour ces ventes ? Vinted les prépare ; VRM ne paie rien.", en: "Ask Vinted for {n} label(s) for these sales? Vinted prepares them; VRM pays nothing.", es: "¿Pedir {n} etiqueta(s) a Vinted para estas ventas? Vinted las prepara; VRM no paga nada.", it: "Chiedere a Vinted {n} etichetta/e per queste vendite? Vinted le prepara; VRM non paga nulla.", de: "{n} Etikett(en) bei Vinted für diese Verkäufe anfordern? Vinted bereitet sie vor; VRM zahlt nichts." },
    v9_cmd_oui: { fr: "Commander", en: "Order", es: "Pedir", it: "Richiedi", de: "Anfordern" },
    v9_non: { fr: "Annuler", en: "Cancel", es: "Cancelar", it: "Annulla", de: "Abbrechen" },
    v9_cmd_en_cours: { fr: "Demande des bordereaux à Vinted…", en: "Asking Vinted for the labels…", es: "Pidiendo las etiquetas a Vinted…", it: "Richiesta delle etichette a Vinted…", de: "Etiketten werden bei Vinted angefordert…" },
    v9_cmd_ok: { fr: "{n} demandé(s) : le PDF arrive dans un instant", en: "{n} requested: the PDF arrives shortly", es: "{n} pedida(s): el PDF llega en un momento", it: "{n} richiesta/e: il PDF arriva a breve", de: "{n} angefordert: das PDF kommt gleich" },
    v9_cmd_ko: { fr: "{n} pas demandé(s) : {r}", en: "{n} not requested: {r}", es: "{n} no pedida(s): {r}", it: "{n} non richiesta/e: {r}", de: "{n} nicht angefordert: {r}" },
    v9_copies: { fr: "{n} n° de suivi copiés", en: "{n} tracking no. copied", es: "{n} n.º de seguimiento copiados", it: "{n} n. di tracciamento copiati", de: "{n} Sendungsnr. kopiert" },
    v9_sans_suivi: { fr: "{n} sans n° de suivi", en: "{n} without tracking no.", es: "{n} sin n.º de seguimiento", it: "{n} senza n. di tracciamento", de: "{n} ohne Sendungsnr." },
    v9_copie_ko: { fr: "Copie refusée par le navigateur", en: "The browser refused to copy", es: "El navegador rechazó copiar", it: "Il browser ha rifiutato la copia", de: "Der Browser hat das Kopieren verweigert" },
    v9_ouverts: { fr: "{n} ouverte(s) dans un onglet", en: "{n} opened in a tab", es: "{n} abierta(s) en una pestaña", it: "{n} aperta/e in una scheda", de: "{n} in einem Tab geöffnet" },
    v9_bloques: { fr: "{n} bloquée(s) par le navigateur : autorise les fenêtres pour vinted.fr", en: "{n} blocked by the browser: allow pop-ups for vinted.fr", es: "{n} bloqueada(s) por el navegador: permite ventanas para vinted.fr", it: "{n} bloccata/e dal browser: consenti le finestre per vinted.fr", de: "{n} vom Browser blockiert: erlaube Pop-ups für vinted.fr" },
    fr_rythme_normal: { fr: 'Au hasard · 20 à 60 s', en: 'Random · 20 to 60 s', es: 'Al azar · 20 a 60 s', it: 'A caso · da 20 a 60 s', de: 'Zufällig · 20 bis 60 s' },
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
    f_a_heure: { fr: '(à {h})', en: '(at {h})', es: '(a las {h})', it: '(alle {h})', de: '(um {h})' },
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
    a_bloque_form: { fr: 'Vinted est verrouillé pendant que VRM remplit le formulaire. « Tout arrêter » pour reprendre la main.', en: 'Vinted is locked while VRM fills in the form. “Stop everything” to take back control.', es: 'Vinted queda bloqueado mientras VRM rellena el formulario. «Detener todo» para recuperar el control.', it: 'Vinted è bloccato mentre VRM compila il modulo. «Ferma tutto» per riprendere il controllo.', de: 'Vinted ist gesperrt, während VRM das Formular ausfüllt. „Alles stoppen“, um die Kontrolle zurückzuholen.' },
    a_bloque: { fr: 'Vinted est verrouillé pendant que VRM agit. « Réduire » pour continuer à naviguer.', en: 'Vinted is locked while VRM works. “Minimise” to keep browsing.', es: 'Vinted queda bloqueado mientras VRM actúa. «Reducir» para seguir navegando.', it: 'Vinted è bloccato mentre VRM agisce. «Riduci» per continuare a navigare.', de: 'Vinted ist gesperrt, während VRM arbeitet. „Verkleinern“, um weiterzusurfen.' },
    a_arrete: { fr: 'Arrêté. Rien d’autre ne part.', en: 'Stopped. Nothing else is sent.', es: 'Detenido. No sale nada más.', it: 'Fermato. Non parte nient’altro.', de: 'Gestoppt. Nichts weiter wird gesendet.' },
    a_fini: { fr: 'Terminé', en: 'Done', es: 'Terminado', it: 'Finito', de: 'Fertig' },
    a_verif: { fr: 'Vinted demande une vérification : fais-la sur la page. VRM attend, rien ne part.', en: 'Vinted asks for a check: do it on the page. VRM waits, nothing is sent.', es: 'Vinted pide una verificación: hazla en la página. VRM espera, no sale nada.', it: 'Vinted chiede una verifica: falla sulla pagina. VRM aspetta, non parte nulla.', de: 'Vinted verlangt eine Prüfung: Erledige sie auf der Seite. VRM wartet, nichts wird gesendet.' },
    a_verif_robot: { fr: 'Vinted demande une vérification (anti-robot). Fais-la ici sur la page.', en: 'Vinted asks for a check (anti-bot). Do it here on the page.', es: 'Vinted pide una verificación (anti-robot). Hazla aquí en la página.', it: 'Vinted chiede una verifica (anti-robot). Falla qui sulla pagina.', de: 'Vinted verlangt eine Prüfung (Anti-Bot). Erledige sie hier auf der Seite.' },
    a_verif_compte: { fr: '{n} sur {total} envoyés · {reste} en attente', en: '{n} of {total} sent · {reste} waiting', es: '{n} de {total} enviados · {reste} en espera', it: '{n} su {total} inviati · {reste} in attesa', de: '{n} von {total} gesendet · {reste} warten' },
    a_verif_page: { fr: 'Vinted demande une vérification : fais-la sur la page, puis touche Reprendre.', en: 'Vinted asks for a check: do it on the page, then tap Resume.', es: 'Vinted pide una verificación: hazla en la página y luego toca Reanudar.', it: 'Vinted chiede una verifica: falla sulla pagina, poi tocca Riprendi.', de: 'Vinted verlangt eine Prüfung: Erledige sie auf der Seite und tippe dann auf Fortsetzen.' },
    a_refus_robot: { fr: 'Vinted a refusé l’envoi (protection anti-robot) : le message n’est pas parti, on attend.', en: 'Vinted refused the send (anti-bot protection): the message was not sent, we are waiting.', es: 'Vinted rechazó el envío (protección anti-robot): el mensaje no salió, esperamos.', it: 'Vinted ha rifiutato l’invio (protezione anti-robot): il messaggio non è partito, aspettiamo.', de: 'Vinted hat das Senden abgelehnt (Anti-Bot-Schutz): Die Nachricht ist nicht raus, wir warten.' },
    a_verif_faite_q: { fr: 'Vérification faite — Reprendre ?', en: 'Check done — Resume?', es: 'Verificación hecha — ¿Reanudar?', it: 'Verifica fatta — Riprendere?', de: 'Prüfung erledigt — Fortsetzen?' },
    a_onglet_travail: { fr: 'VRM · onglet de travail — ne le ferme pas', en: 'VRM · work tab — do not close it', es: 'VRM · pestaña de trabajo — no la cierres', it: 'VRM · scheda di lavoro — non chiuderla', de: 'VRM · Arbeitstab — nicht schließen' },
    a_ouvrir_vrm: { fr: 'Ouvrir VRM', en: 'Open VRM', es: 'Abrir VRM', it: 'Apri VRM', de: 'VRM öffnen' },
    a_verif_faite: { fr: 'Vérification faite', en: 'Check done', es: 'Verificación hecha', it: 'Verifica fatta', de: 'Prüfung erledigt' },
    a_doucement: { fr: 'On reprend plus doucement pendant 24 h.', en: 'We resume more slowly for 24 h.', es: 'Se reanuda más despacio durante 24 h.', it: 'Si riprende più lentamente per 24 h.', de: 'Es geht 24 h lang langsamer weiter.' },
    a_reprendre: { fr: 'Reprendre', en: 'Resume', es: 'Reanudar', it: 'Riprendi', de: 'Fortsetzen' },
    a_vinted_dit: { fr: 'Vinted affiche un message : lis-le, VRM se met de côté.', en: 'Vinted shows a message: read it, VRM steps aside.', es: 'Vinted muestra un mensaje: léelo, VRM se aparta.', it: 'Vinted mostra un messaggio: leggilo, VRM si fa da parte.', de: 'Vinted zeigt eine Meldung: Lies sie, VRM tritt zur Seite.' },
    // ── messages brefs, bandeaux, alertes ──
    t_ok: { fr: 'C’est fait', en: 'Done', es: 'Hecho', it: 'Fatto', de: 'Erledigt' },
    d_titre: { fr: 'VRM · avant de publier', en: 'VRM · before publishing', es: 'VRM · antes de publicar', it: 'VRM · prima di pubblicare', de: 'VRM · vor dem Veröffentlichen' },
    // ── 5.407 : la liste des favoris à cocher et son récapitulatif ──
    fl_lu: { fr: '{n} favoris · du plus récent au plus ancien', en: '{n} favourites · newest first', es: '{n} favoritos · del más reciente al más antiguo', it: '{n} preferiti · dal più recente al più vecchio', de: '{n} Favoriten · neueste zuerst' },
    f6_file_active: { fr: 'Une file d’envoi est restée ouverte chez VRM : {n} en attente', en: 'A send queue was left open in VRM: {n} waiting', es: 'Una cola de envío quedó abierta en VRM: {n} en espera', it: 'Una coda di invio è rimasta aperta in VRM: {n} in attesa', de: 'Eine Sendewarteschlange ist in VRM offen geblieben: {n} wartend' },
    f6_file_pause: { fr: 'Une file d’envoi est en pause : {n} en attente', en: 'A send queue is paused: {n} waiting', es: 'Una cola de envío está en pausa: {n} en espera', it: 'Una coda di invio è in pausa: {n} in attesa', de: 'Eine Sendewarteschlange ist pausiert: {n} wartend' },
    f6_file_note: { fr: 'Reprends-la d’ici, ou annule-la pour en envoyer une autre.', en: 'Resume it from here, or cancel it to send another one.', es: 'Reanúdala desde aquí o anúlala para enviar otra.', it: 'Riprendila da qui, o annullala per inviarne un’altra.', de: 'Setze sie hier fort oder brich sie ab, um eine andere zu senden.' },
    f6_annuler_file: { fr: 'Annuler la file', en: 'Cancel the queue', es: 'Anular la cola', it: 'Annulla la coda', de: 'Warteschlange abbrechen' },
    f6_remplacer: { fr: 'Annuler l’ancienne file et envoyer à {n}', en: 'Cancel the old queue and send to {n}', es: 'Anular la cola anterior y enviar a {n}', it: 'Annulla la vecchia coda e invia a {n}', de: 'Alte Warteschlange abbrechen und an {n} senden' },
    f6_r_trop_ancien: { fr: 'favori trop ancien pour Vinted', en: 'favourite too old for Vinted', es: 'favorito demasiado antiguo para Vinted', it: 'preferito troppo vecchio per Vinted', de: 'Favorit zu alt für Vinted' },
    f6_travail_voile: { fr: 'VRM travaille dans cet onglet — ne le ferme pas', en: 'VRM is working in this tab — do not close it', es: 'VRM trabaja en esta pestaña — no la cierres', it: 'VRM lavora in questa scheda — non chiuderla', de: 'VRM arbeitet in diesem Tab — nicht schließen' },
    f6_travail_note: { fr: 'Tout se fait ici, seul : rien à toucher. Tu peux tout arrêter.', en: 'Everything happens here on its own: nothing to touch. You can stop everything.', es: 'Todo ocurre aquí solo: nada que tocar. Puedes detenerlo todo.', it: 'Tutto avviene qui da solo: niente da toccare. Puoi fermare tutto.', de: 'Alles läuft hier von selbst: nichts anfassen. Du kannst alles stoppen.' },
    f6_offre_remontee: { fr: 'offre {p} (remontée au prix mini)', en: 'offer {p} (raised to the minimum)', es: 'oferta {p} (subida al mínimo)', it: 'offerta {p} (alzata al minimo)', de: 'Angebot {p} (auf Mindestpreis angehoben)' },
    f6_arrete: { fr: 'Arrêté', en: 'Stopped', es: 'Detenido', it: 'Fermato', de: 'Gestoppt' },
    f6_seg_tous: { fr: 'Tous', en: 'All', es: 'Todos', it: 'Tutti', de: 'Alle' },
    f6_seg_nouveaux: { fr: 'Pas encore contactés', en: 'Not contacted yet', es: 'Aún sin contactar', it: 'Non ancora contattati', de: 'Noch nicht kontaktiert' },
    f6_seg_envoyes: { fr: 'Envoyés', en: 'Sent', es: 'Enviados', it: 'Inviati', de: 'Gesendet' },
    f6_seg_ignores: { fr: 'Ignorés', en: 'Skipped', es: 'Omitidos', it: 'Ignorati', de: 'Übersprungen' },
    f6_c_prix: { fr: 'Prix', en: 'Price', es: 'Precio', it: 'Prezzo', de: 'Preis' },
    f6_c_acheteur: { fr: 'Acheteur', en: 'Buyer', es: 'Comprador', it: 'Acquirente', de: 'Käufer' },
    f6_c_date: { fr: 'Favori le', en: 'Liked on', es: 'Favorito el', it: 'Preferito il', de: 'Favorisiert am' },
    f6_c_etat: { fr: 'État', en: 'Status', es: 'Estado', it: 'Stato', de: 'Status' },
    f6_e_nouveau: { fr: 'Pas encore contacté', en: 'Not contacted yet', es: 'Aún sin contactar', it: 'Non ancora contattato', de: 'Noch nicht kontaktiert' },
    f6_e_attente: { fr: 'En attente', en: 'Waiting', es: 'En espera', it: 'In attesa', de: 'Wartet' },
    f6_e_attente_h: { fr: 'En attente · {h}', en: 'Waiting · {h}', es: 'En espera · {h}', it: 'In attesa · {h}', de: 'Wartet · {h}' },
    f6_e_encours: { fr: 'Envoi en cours', en: 'Sending', es: 'Enviando', it: 'Invio in corso', de: 'Wird gesendet' },
    f6_e_envoye: { fr: 'Message envoyé', en: 'Message sent', es: 'Mensaje enviado', it: 'Messaggio inviato', de: 'Nachricht gesendet' },
    f6_e_offre: { fr: 'Offre faite', en: 'Offer made', es: 'Oferta hecha', it: 'Offerta fatta', de: 'Angebot gemacht' },
    f6_e_ignore: { fr: 'Ignoré', en: 'Skipped', es: 'Omitido', it: 'Ignorato', de: 'Übersprungen' },
    f6_e_verifier: { fr: 'À vérifier sur Vinted', en: 'Check on Vinted', es: 'Comprobar en Vinted', it: 'Da verificare su Vinted', de: 'Auf Vinted prüfen' },
    f6_e_refus: { fr: 'Pas parti', en: 'Not sent', es: 'No enviado', it: 'Non inviato', de: 'Nicht gesendet' },
    f6_offre: { fr: 'offre {p}', en: 'offer {p}', es: 'oferta {p}', it: 'offerta {p}', de: 'Angebot {p}' },
    f6_sans_offre: { fr: 'sans offre', en: 'no offer', es: 'sin oferta', it: 'senza offerta', de: 'ohne Angebot' },
    f6_sous_plancher: { fr: 'sans offre : prix mini au prix de l’annonce', en: 'no offer: minimum equals the listing price', es: 'sin oferta: el mínimo iguala el precio', it: 'senza offerta: il minimo eguaglia il prezzo', de: 'ohne Angebot: Mindestpreis gleich Anzeigenpreis' },
    f6_r_vendu: { fr: 'article vendu', en: 'item sold', es: 'artículo vendido', it: 'articolo venduto', de: 'Artikel verkauft' },
    f6_r_deja: { fr: 'déjà contacté', en: 'already contacted', es: 'ya contactado', it: 'già contattato', de: 'bereits kontaktiert' },
    f6_r_sous_mini: { fr: 'offre sous le prix mini', en: 'offer below minimum price', es: 'oferta por debajo del precio mínimo', it: 'offerta sotto il prezzo minimo', de: 'Angebot unter Mindestpreis' },
    f6_r_conv: { fr: 'conversation refusée par Vinted', en: 'conversation refused by Vinted', es: 'conversación rechazada por Vinted', it: 'conversazione rifiutata da Vinted', de: 'Unterhaltung von Vinted abgelehnt' },
    f6_r_texte: { fr: 'texte refusé', en: 'text refused', es: 'texto rechazado', it: 'testo rifiutato', de: 'Text abgelehnt' },
    f6_r_robot: { fr: 'vérification de Vinted', en: 'Vinted check', es: 'verificación de Vinted', it: 'verifica di Vinted', de: 'Vinted-Prüfung' },
    f6_r_frein: { fr: 'Vinted demande de ralentir', en: 'Vinted asks to slow down', es: 'Vinted pide ir más despacio', it: 'Vinted chiede di rallentare', de: 'Vinted bittet um Pause' },
    f6_r_offre_refusee: { fr: 'offre refusée par Vinted', en: 'offer refused by Vinted', es: 'oferta rechazada por Vinted', it: 'offerta rifiutata da Vinted', de: 'Angebot von Vinted abgelehnt' },
    f6_r_non_prouve: { fr: 'acheteur pas encore confirmé', en: 'buyer not confirmed yet', es: 'comprador aún sin confirmar', it: 'acquirente non ancora confermato', de: 'Käufer noch nicht bestätigt' },
    f6_r_offre_prix: { fr: 'prix de l’offre inconnu', en: 'offer price unknown', es: 'precio de la oferta desconocido', it: 'prezzo dell’offerta sconosciuto', de: 'Angebotspreis unbekannt' },
    f6_r_filtre: { fr: 'écarté par tes filtres', en: 'left out by your filters', es: 'descartado por tus filtros', it: 'escluso dai tuoi filtri', de: 'durch deine Filter ausgeschlossen' },
    f6_r_pas: { fr: 'pas parti', en: 'not sent', es: 'no enviado', it: 'non inviato', de: 'nicht gesendet' },
    f6_r_annule: { fr: 'arrêté avant son tour', en: 'stopped before its turn', es: 'detenido antes de su turno', it: 'fermato prima del suo turno', de: 'vor seiner Reihe gestoppt' },
    f6_r_autre: { fr: 'refusé', en: 'refused', es: 'rechazado', it: 'rifiutato', de: 'abgelehnt' },
    f6_chercher: { fr: 'Chercher un article ou un acheteur', en: 'Search an item or a buyer', es: 'Buscar un artículo o un comprador', it: 'Cerca un articolo o un acquirente', de: 'Artikel oder Käufer suchen' },
    f6_reglages: { fr: 'Réglages', en: 'Settings', es: 'Ajustes', it: 'Impostazioni', de: 'Einstellungen' },
    f6_n: { fr: '{n} favoris', en: '{n} favourites', es: '{n} favoritos', it: '{n} preferiti', de: '{n} Favoriten' },
    f6_n1: { fr: '1 favori', en: '1 favourite', es: '1 favorito', it: '1 preferito', de: '1 Favorit' },
    f6_tout: { fr: 'Cocher tous les pas encore contactés', en: 'Select all not contacted yet', es: 'Marcar todos los aún sin contactar', it: 'Seleziona tutti i non ancora contattati', de: 'Alle noch nicht kontaktierten auswählen' },
    // 5.417 (favorisperso2) — l’éditeur des messages aux favoris
    fp_v_prenom: { fr: "Prénom", en: "First name", es: "Nombre", it: "Nome", de: "Vorname" },
    fp_v_article: { fr: "Article", en: "Item", es: "Artículo", it: "Articolo", de: "Artikel" },
    fp_v_marque: { fr: "Marque", en: "Brand", es: "Marca", it: "Marca", de: "Marke" },
    fp_v_taille: { fr: "Taille", en: "Size", es: "Talla", it: "Taglia", de: "Größe" },
    fp_v_prix: { fr: "Prix", en: "Price", es: "Precio", it: "Prezzo", de: "Preis" },
    fp_v_prix_offre: { fr: "Prix de l'offre", en: "Offer price", es: "Precio de la oferta", it: "Prezzo dell'offerta", de: "Angebotspreis" },
    fp_v_remise: { fr: "Remise", en: "Discount", es: "Descuento", it: "Sconto", de: "Rabatt" },
    fp_err_vide: { fr: "Message vide : écris-le ou retire-le.", en: "Empty message: write it or remove it.", es: "Mensaje vacío: escríbelo o quítalo.", it: "Messaggio vuoto: scrivilo o toglilo.", de: "Leere Nachricht: schreibe sie oder entferne sie." },
    fp_err_long: { fr: "Trop long : 2 000 caractères au plus (la limite de Vinted).", en: "Too long: 2,000 characters at most (Vinted’s limit).", es: "Demasiado largo: 2000 caracteres como máximo (límite de Vinted).", it: "Troppo lungo: al massimo 2000 caratteri (limite di Vinted).", de: "Zu lang: höchstens 2.000 Zeichen (Grenze von Vinted)." },
    fp_err_variable: { fr: "Variable inconnue : utilise les boutons « + » ci-dessous.", en: "Unknown variable: use the “+” buttons below.", es: "Variable desconocida: usa los botones «+» de abajo.", it: "Variabile sconosciuta: usa i pulsanti «+» qui sotto.", de: "Unbekannte Variable: nutze die „+“-Tasten unten." },
    fp_err_accolade: { fr: "Une accolade n’est pas fermée.", en: "A brace is not closed.", es: "Falta cerrar una llave.", it: "Una parentesi graffa non è chiusa.", de: "Eine geschweifte Klammer ist nicht geschlossen." },
    fp_risque: { fr: "Vinted refuserait ce message — {quoi} : « {mot} ». Il ne partira pas.", en: "Vinted would refuse this message — {quoi}: “{mot}”. It will not be sent.", es: "Vinted rechazaría este mensaje — {quoi}: «{mot}». No se enviará.", it: "Vinted rifiuterebbe questo messaggio — {quoi}: «{mot}». Non partirà.", de: "Vinted würde diese Nachricht ablehnen — {quoi}: „{mot}“. Sie wird nicht gesendet." },
    fp_r_telephone: { fr: "un numéro de téléphone", en: "a phone number", es: "un número de teléfono", it: "un numero di telefono", de: "eine Telefonnummer" },
    fp_r_email: { fr: "une adresse e-mail", en: "an email address", es: "una dirección de correo", it: "un indirizzo e-mail", de: "eine E-Mail-Adresse" },
    fp_r_lien: { fr: "un lien vers un autre site", en: "a link to another site", es: "un enlace a otro sitio", it: "un link a un altro sito", de: "ein Link zu einer anderen Seite" },
    fp_r_paiement: { fr: "un paiement hors plateforme", en: "a payment outside the platform", es: "un pago fuera de la plataforma", it: "un pagamento fuori piattaforma", de: "eine Zahlung außerhalb der Plattform" },
    fp_r_messagerie: { fr: "une autre messagerie", en: "another messaging app", es: "otra mensajería", it: "un'altra app di messaggi", de: "ein anderer Messenger" },
    fp_r_hors: { fr: "une vente hors plateforme", en: "a sale outside the platform", es: "una venta fuera de la plataforma", it: "una vendita fuori piattaforma", de: "ein Verkauf außerhalb der Plattform" },
    fp_r_mainpropre: { fr: "une remise en main propre", en: "a hand-to-hand meeting", es: "una entrega en mano", it: "una consegna a mano", de: "eine persönliche Übergabe" },
    fp_r_contrefacon: { fr: "un mot de contrefaçon", en: "a counterfeit word", es: "una palabra de falsificación", it: "una parola di contraffazione", de: "ein Fälschungswort" },
    fp_st_non: { fr: "✈ {n} · non mesuré", en: "✈ {n} · not measured", es: "✈ {n} · sin medir", it: "✈ {n} · non misurato", de: "✈ {n} · nicht gemessen" },
    fp_st: { fr: "✈ {n} · {o} avec offre · {v} vendus en 14 j", en: "✈ {n} · {o} with offer · {v} sold within 14 d", es: "✈ {n} · {o} con oferta · {v} vendidos en 14 d", it: "✈ {n} · {o} con offerta · {v} venduti in 14 g", de: "✈ {n} · {o} mit Angebot · {v} in 14 T verkauft" },
    fp_st_sans_date: { fr: "+ {n} vendus sans date", en: "+ {n} sold, no date", es: "+ {n} vendidos sin fecha", it: "+ {n} venduti senza data", de: "+ {n} verkauft ohne Datum" },
    fp_message_n: { fr: "Message {n}", en: "Message {n}", es: "Mensaje {n}", it: "Messaggio {n}", de: "Nachricht {n}" },
    fp_retirer: { fr: "Retirer le message {n}", en: "Remove message {n}", es: "Quitar el mensaje {n}", it: "Togli il messaggio {n}", de: "Nachricht {n} entfernen" },
    fp_inserer: { fr: "Insérer", en: "Insert", es: "Insertar", it: "Inserisci", de: "Einfügen" },
    fp_ajouter: { fr: "Ajouter un message", en: "Add a message", es: "Añadir un mensaje", it: "Aggiungi un messaggio", de: "Nachricht hinzufügen" },
    fp_regle_n: { fr: "Règle {n}", en: "Rule {n}", es: "Regla {n}", it: "Regola {n}", de: "Regel {n}" },
    fp_cond1: { fr: "1 condition", en: "1 condition", es: "1 condición", it: "1 condizione", de: "1 Bedingung" },
    fp_condn: { fr: "{n} conditions", en: "{n} conditions", es: "{n} condiciones", it: "{n} condizioni", de: "{n} Bedingungen" },
    fp_monter: { fr: "Monter la règle", en: "Move rule up", es: "Subir la regla", it: "Sposta su", de: "Regel nach oben" },
    fp_descendre: { fr: "Descendre la règle", en: "Move rule down", es: "Bajar la regla", it: "Sposta giù", de: "Regel nach unten" },
    fp_regle_retirer: { fr: "Retirer la règle", en: "Remove rule", es: "Quitar la regla", it: "Togli la regola", de: "Regel entfernen" },
    fp_c_heures: { fr: "Heures (Paris)", en: "Hours (Paris)", es: "Horas (París)", it: "Ore (Parigi)", de: "Uhrzeit (Paris)" },
    fp_de: { fr: "de", en: "from", es: "de", it: "da", de: "von" },
    fp_a: { fr: "à", en: "to", es: "a", it: "a", de: "bis" },
    fp_c_prix: { fr: "Prix de l'article", en: "Item price", es: "Precio del artículo", it: "Prezzo dell'articolo", de: "Artikelpreis" },
    fp_c_jours: { fr: "Jours", en: "Days", es: "Días", it: "Giorni", de: "Tage" },
    fp_c_marques: { fr: "Marques (séparées par des virgules)", en: "Brands (comma-separated)", es: "Marcas (separadas por comas)", it: "Marche (separate da virgole)", de: "Marken (durch Kommas getrennt)" },
    fp_marques_ex: { fr: "Nike, Adidas", en: "Nike, Adidas", es: "Nike, Adidas", it: "Nike, Adidas", de: "Nike, Adidas" },
    fp_regle_ajouter: { fr: "Ajouter une règle", en: "Add a rule", es: "Añadir una regla", it: "Aggiungi una regola", de: "Regel hinzufügen" },
    fp_ap_aucun: { fr: "Aucun favori lu pour ce compte : l’aperçu viendra avec le premier.", en: "No favourite read for this account yet: the preview comes with the first one.", es: "Ningún favorito leído en esta cuenta: la vista previa llegará con el primero.", it: "Nessun preferito letto per questo account: l’anteprima arriverà con il primo.", de: "Noch kein Favorit für dieses Konto gelesen: die Vorschau kommt mit dem ersten." },
    fp_ap_sur: { fr: "Sur le favori", en: "On the favourite", es: "En el favorito", it: "Sul preferito", de: "Für den Favoriten" },
    fp_ap_calcul: { fr: "calcul…", en: "working…", es: "calculando…", it: "calcolo…", de: "wird berechnet…" },
    fp_ap_rien_variable: { fr: "aucun message possible", en: "no message possible", es: "ningún mensaje posible", it: "nessun messaggio possibile", de: "keine Nachricht möglich" },
    fp_ap_rien_texte: { fr: "aucun message accepté par Vinted", en: "no message Vinted would accept", es: "ningún mensaje aceptado por Vinted", it: "nessun messaggio accettato da Vinted", de: "keine Nachricht, die Vinted annimmt" },
    fp_ap_rien_note: { fr: "Rien ne partirait à ce favori : il manque une information (marque, taille, prix) ou chaque message serait refusé.", en: "Nothing would be sent to this favourite: some information is missing (brand, size, price) or every message would be refused.", es: "No se enviaría nada a este favorito: falta un dato (marca, talla, precio) o cada mensaje sería rechazado.", it: "Non partirebbe nulla a questo preferito: manca un’informazione (marca, taglia, prezzo) o ogni messaggio verrebbe rifiutato.", de: "An diesen Favoriten würde nichts gesendet: eine Angabe fehlt (Marke, Größe, Preis) oder jede Nachricht würde abgelehnt." },
    fp_ap_regle: { fr: "règle {n}", en: "rule {n}", es: "regla {n}", it: "regola {n}", de: "Regel {n}" },
    fp_ap_defaut: { fr: "message 1 article", en: "single-item message", es: "mensaje de 1 artículo", it: "messaggio 1 articolo", de: "Nachricht für 1 Artikel" },
    fp_ap_hasard: { fr: "une version au hasard parmi {n}", en: "one version at random out of {n}", es: "una versión al azar entre {n}", it: "una versione a caso tra {n}", de: "eine zufällige von {n} Versionen" },
    fp_ap_sans_offre: { fr: "Sans offre (aucune réduction réglée, ou prix illisible).", en: "No offer (no discount set, or price unreadable).", es: "Sin oferta (sin descuento o precio ilegible).", it: "Senza offerta (nessuno sconto impostato, o prezzo illeggibile).", de: "Kein Angebot (kein Rabatt eingestellt oder Preis unlesbar)." },
    fp_ap_sous_plancher: { fr: "Pas d’offre : ton plancher atteint le prix de l’annonce.", en: "No offer: your floor reaches the listing price.", es: "Sin oferta: tu mínimo alcanza el precio del anuncio.", it: "Nessuna offerta: il tuo minimo raggiunge il prezzo dell’annuncio.", de: "Kein Angebot: deine Untergrenze erreicht den Anzeigenpreis." },
    fp_ap_offre: { fr: "Offre {p}.", en: "Offer {p}.", es: "Oferta {p}.", it: "Offerta {p}.", de: "Angebot {p}." },
    fp_ap_offre_pct: { fr: "Offre {p} (−{pct} %), envoyée avec le message.", en: "Offer {p} (−{pct}%), sent with the message.", es: "Oferta {p} (−{pct} %), enviada con el mensaje.", it: "Offerta {p} (−{pct}%), inviata con il messaggio.", de: "Angebot {p} (−{pct} %), mit der Nachricht gesendet." },
    fp_ap_offre_mini: { fr: "Offre {p} : remontée à ton prix mini.", en: "Offer {p}: raised to your minimum price.", es: "Oferta {p}: subida a tu precio mínimo.", it: "Offerta {p}: alzata al tuo prezzo minimo.", de: "Angebot {p}: auf deinen Mindestpreis angehoben." },
    fp_ap_offre_achat: { fr: "Offre {p} : remontée à ton achat + 10 %.", en: "Offer {p}: raised to your purchase price + 10%.", es: "Oferta {p}: subida a tu compra + 10 %.", it: "Offerta {p}: alzata al tuo acquisto + 10%.", de: "Angebot {p}: auf deinen Einkaufspreis + 10 % angehoben." },
    fp_ap_lot: { fr: "S’il a aimé plusieurs de tes articles (une fois par personne) :", en: "If they liked several of your items (once per person):", es: "Si le gustaron varios de tus artículos (una vez por persona):", it: "Se ha apprezzato più tuoi articoli (una volta per persona):", de: "Wenn mehrere deiner Artikel gefallen (einmal pro Person):" },
    fp_ap_recevrait: { fr: "Ce favori recevrait", en: "This favourite would receive", es: "Este favorito recibiría", it: "Questo preferito riceverebbe", de: "Dieser Favorit bekäme" },
    fp_sur: { fr: "Sur {c}", en: "On {c}", es: "En {c}", it: "Su {c}", de: "Auf {c}" },
    fp_sur_note: { fr: " · le compte de cet onglet", en: " · the account of this tab", es: " · la cuenta de esta pestaña", it: " · l’account di questa scheda", de: " · das Konto dieses Tabs" },
    fp_sure_ko: { fr: "Garde au moins un message 1 article sans {marque}, {taille}, {prix_offre} ni {remise} : il part quand l’information manque.", en: "Keep at least one single-item message without {marque}, {taille}, {prix_offre} or {remise}: it is sent when the information is missing.", es: "Deja al menos un mensaje de 1 artículo sin {marque}, {taille}, {prix_offre} ni {remise}: se envía cuando falta el dato.", it: "Tieni almeno un messaggio 1 articolo senza {marque}, {taille}, {prix_offre} né {remise}: parte quando manca l’informazione.", de: "Behalte mindestens eine Nachricht für 1 Artikel ohne {marque}, {taille}, {prix_offre} oder {remise}: sie geht raus, wenn die Angabe fehlt." },
    fp_offre_autre: { fr: "Offre réglée aujourd’hui : {o}. Un pourcentage ci-dessous la remplace.", en: "Offer set today: {o}. A percentage below replaces it.", es: "Oferta actual: {o}. Un porcentaje abajo la sustituye.", it: "Offerta attuale: {o}. Una percentuale qui sotto la sostituisce.", de: "Aktuelles Angebot: {o}. Ein Prozentsatz unten ersetzt es." },
    fp_t_un: { fr: "Message par défaut (1 article)", en: "Default message (1 item)", es: "Mensaje por defecto (1 artículo)", it: "Messaggio predefinito (1 articolo)", de: "Standardnachricht (1 Artikel)" },
    fp_un_note: { fr: "Une version tirée au hasard à chaque envoi, jamais deux fois de suite la même à la même personne.", en: "One version picked at random for each send, never the same one twice in a row to the same person.", es: "Una versión al azar en cada envío, nunca dos veces seguidas la misma a la misma persona.", it: "Una versione a caso a ogni invio, mai la stessa due volte di fila alla stessa persona.", de: "Bei jedem Versand eine zufällige Version, nie zweimal hintereinander dieselbe an dieselbe Person." },
    fp_t_lot: { fr: "Message lot (plusieurs articles aimés)", en: "Bundle message (several liked items)", es: "Mensaje lote (varios artículos)", it: "Messaggio lotto (più articoli)", de: "Bündelnachricht (mehrere Artikel)" },
    fp_lot_note: { fr: "Quand la personne a aimé au moins 2 de tes articles : une fois par personne, avec la séquence « comme Bleam ».", en: "When the person liked at least 2 of your items: once per person, with the “like Bleam” sequence.", es: "Cuando la persona marcó al menos 2 de tus artículos: una vez por persona, con la secuencia «como Bleam».", it: "Quando la persona ha apprezzato almeno 2 tuoi articoli: una volta per persona, con la sequenza «come Bleam».", de: "Wenn die Person mindestens 2 deiner Artikel mag: einmal pro Person, mit der „wie Bleam“-Abfolge." },
    fp_t_regles: { fr: "Messages conditionnels", en: "Conditional messages", es: "Mensajes condicionales", it: "Messaggi condizionali", de: "Bedingte Nachrichten" },
    fp_regles_note: { fr: "Un message différent selon l’heure, le jour, le prix ou la marque. Une seule règle s’applique : la plus précise, puis la plus haute.", en: "A different message depending on the time, day, price or brand. Only one rule applies: the most specific, then the highest.", es: "Un mensaje distinto según la hora, el día, el precio o la marca. Solo se aplica una regla: la más precisa y, luego, la más alta.", it: "Un messaggio diverso secondo l’ora, il giorno, il prezzo o la marca. Si applica una sola regola: la più precisa, poi la più in alto.", de: "Eine andere Nachricht je nach Uhrzeit, Tag, Preis oder Marke. Es gilt nur eine Regel: die genaueste, dann die oberste." },
    fp_t_offre: { fr: "Offre automatique", en: "Automatic offer", es: "Oferta automática", it: "Offerta automatica", de: "Automatisches Angebot" },
    fp_offre_note: { fr: "Toujours envoyée avec le message ; jamais sous ton plancher : prix mini, sinon achat + 10 % (elle y est remontée).", en: "Always sent with the message; never below your floor: minimum price, otherwise purchase + 10% (raised to it).", es: "Siempre enviada con el mensaje; nunca bajo tu mínimo: precio mínimo, si no compra + 10 % (se sube).", it: "Sempre inviata con il messaggio; mai sotto il tuo minimo: prezzo minimo, altrimenti acquisto + 10% (alzata).", de: "Immer mit der Nachricht gesendet; nie unter deiner Untergrenze: Mindestpreis, sonst Einkauf + 10 % (angehoben)." },
    fp_offre_pct: { fr: "Réduction", en: "Discount", es: "Descuento", it: "Sconto", de: "Rabatt" },
    fp_arrondi: { fr: "Arrondi", en: "Rounding", es: "Redondeo", it: "Arrotondamento", de: "Rundung" },
    fp_arrondi_non: { fr: "Au centime", en: "To the cent", es: "Al céntimo", it: "Al centesimo", de: "Auf den Cent" },
    fp_arrondi_oui: { fr: "À l'euro inférieur", en: "Down to the euro", es: "Al euro inferior", it: "All'euro inferiore", de: "Auf den Euro abgerundet" },
    fp_t_delai: { fr: "Délai avant envoi et filtres", en: "Delay before sending and filters", es: "Espera antes del envío y filtros", it: "Attesa prima dell’invio e filtri", de: "Wartezeit vor dem Senden und Filter" },
    fp_delai_note: { fr: "Appliqués à la liste ET au moment de l’envoi.", en: "Applied to the list AND at send time.", es: "Aplicados a la lista Y en el envío.", it: "Applicati alla lista E al momento dell’invio.", de: "Gelten für die Liste UND beim Senden." },
    fp_delai: { fr: "Attendre (minutes après le favori)", en: "Wait (minutes after the favourite)", es: "Esperar (minutos tras el favorito)", it: "Attendere (minuti dopo il preferito)", de: "Warten (Minuten nach dem Favoriten)" },
    fp_t_apercu: { fr: "Aperçu", en: "Preview", es: "Vista previa", it: "Anteprima", de: "Vorschau" },
    fp_stats_note: { fr: "Statistiques sur {n} envois notés dans ce navigateur ; « non mesuré » sous 10 envois ; vendu = l’annonce du message vendue dans les 14 jours.", en: "Statistics on {n} sends recorded in this browser; “not measured” under 10 sends; sold = the message’s listing sold within 14 days.", es: "Estadísticas de {n} envíos anotados en este navegador; «sin medir» por debajo de 10; vendido = el anuncio del mensaje vendido en 14 días.", it: "Statistiche su {n} invii registrati in questo browser; «non misurato» sotto 10 invii; venduto = l’annuncio del messaggio venduto entro 14 giorni.", de: "Statistik über {n} in diesem Browser erfasste Sendungen; „nicht gemessen“ unter 10; verkauft = Anzeige der Nachricht innerhalb von 14 Tagen verkauft." },
    fp_stats_sans_ventes: { fr: "Statistiques sur {n} envois ; les ventes n’ont pas pu être relues (« vendus » non compté).", en: "Statistics on {n} sends; sales could not be read (“sold” not counted).", es: "Estadísticas de {n} envíos; no se pudieron leer las ventas («vendidos» no contado).", it: "Statistiche su {n} invii; le vendite non sono state rilette («venduti» non contati).", de: "Statistik über {n} Sendungen; Verkäufe konnten nicht gelesen werden („verkauft“ nicht gezählt)." },
    fp_stats_ko: { fr: "Statistiques pas lues (réessaie plus tard).", en: "Statistics not read (try again later).", es: "Estadísticas no leídas (vuelve a intentarlo).", it: "Statistiche non lette (riprova più tardi).", de: "Statistik nicht gelesen (später erneut versuchen)." },
    fp_stats_charge: { fr: "Statistiques en lecture…", en: "Reading statistics…", es: "Leyendo estadísticas…", it: "Lettura delle statistiche…", de: "Statistik wird gelesen…" },
    f6_reglages_titre: { fr: 'Messages aux favoris', en: 'Messages to favourites', es: 'Mensajes a favoritos', it: 'Messaggi ai preferiti', de: 'Nachrichten an Favoriten' },
    f6_offre_regle: { fr: 'Offre : {o}, toujours faite. Remontée au prix mini (sinon achat + 10 %) si elle tombe dessous.', en: 'Offer: {o}, always made. Raised to the minimum price (else purchase + 10%) if it falls below.', es: 'Oferta: {o}, siempre hecha. Subida al precio mínimo (si no compra + 10 %) si queda por debajo.', it: 'Offerta: {o}, sempre fatta. Alzata al prezzo minimo (altrimenti acquisto + 10 %) se scende sotto.', de: 'Angebot: {o}, immer gemacht. Auf den Mindestpreis (sonst Einkauf + 10 %) angehoben, wenn es darunter fällt.' },
    f6_offre_vrm: { fr: 'L’offre se règle dans VRM (Messages → Favoris).', en: 'The offer is set in VRM (Messages → Favourites).', es: 'La oferta se ajusta en VRM (Mensajes → Favoritos).', it: 'L’offerta si imposta in VRM (Messaggi → Preferiti).', de: 'Das Angebot wird in VRM eingestellt (Nachrichten → Favoriten).' },
    f6_sans_offre_regle: { fr: 'Sans offre de prix.', en: 'No price offer.', es: 'Sin oferta de precio.', it: 'Senza offerta di prezzo.', de: 'Ohne Preisangebot.' },
    f6_fermer: { fr: 'Fermer', en: 'Close', es: 'Cerrar', it: 'Chiudi', de: 'Schließen' },
    f6_reglages_charge: { fr: 'Je lis tes réglages…', en: 'Reading your settings…', es: 'Leyendo tus ajustes…', it: 'Leggo le tue impostazioni…', de: 'Deine Einstellungen werden gelesen…' },
    f6_vide: { fr: 'Aucun favori dans ce filtre.', en: 'No favourite in this filter.', es: 'Ningún favorito en este filtro.', it: 'Nessun preferito in questo filtro.', de: 'Kein Favorit in diesem Filter.' },
    f6_fin_travail: { fr: 'L’onglet de travail VRM a été fermé : l’envoi s’est arrêté, rien de plus n’est parti.', en: 'The VRM work tab was closed: sending stopped, nothing more was sent.', es: 'La pestaña de trabajo de VRM se cerró: el envío se detuvo, no se envió nada más.', it: 'La scheda di lavoro VRM è stata chiusa: l’invio si è fermato, nient’altro è partito.', de: 'Der VRM-Arbeitstab wurde geschlossen: das Senden wurde gestoppt, nichts weiter gesendet.' },
    f6_rythme_note: { fr: 'Le temps entre deux messages est tiré au hasard à chaque fois.', en: 'The time between two messages is random every time.', es: 'El tiempo entre dos mensajes es aleatorio cada vez.', it: 'Il tempo tra due messaggi è casuale ogni volta.', de: 'Die Zeit zwischen zwei Nachrichten ist jedes Mal zufällig.' },
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
    // ── (5.423, `modifavantapres`) avant / pendant / après d'une modification d'annonce ──
    m3_avant: { fr: 'Avant', en: 'Before', es: 'Antes', it: 'Prima', de: 'Vorher' },
    m3_apres: { fr: 'Après', en: 'After', es: 'Después', it: 'Dopo', de: 'Nachher' },
    m3_photo: { fr: 'Photo', en: 'Photo', es: 'Foto', it: 'Foto', de: 'Foto' },
    m3_titre: { fr: 'Titre', en: 'Title', es: 'Título', it: 'Titolo', de: 'Titel' },
    m3_prix: { fr: 'Prix', en: 'Price', es: 'Precio', it: 'Prezzo', de: 'Preis' },
    m3_etat: { fr: 'État', en: 'Status', es: 'Estado', it: 'Stato', de: 'Status' },
    m3_depuis: { fr: 'En ligne depuis', en: 'Online since', es: 'Publicado desde', it: 'Online da', de: 'Online seit' },
    m3_num: { fr: 'N°', en: 'No.', es: 'N.º', it: 'N.', de: 'Nr.' },
    m3_champs: { fr: 'Champs recopiés', en: 'Fields copied', es: 'Campos copiados', it: 'Campi copiati', de: 'Übernommene Felder' },
    m3_maintenant: { fr: 'maintenant', en: 'now', es: 'ahora', it: 'adesso', de: 'jetzt' },
    m3_il_y_a: { fr: 'il y a {n} j', en: '{n} d ago', es: 'hace {n} d', it: '{n} g fa', de: 'vor {n} T.' },
    m3_aujourdhui: { fr: 'aujourd’hui', en: 'today', es: 'hoy', it: 'oggi', de: 'heute' },
    m3_garde: { fr: '{v} (gardé)', en: '{v} (kept)', es: '{v} (se mantiene)', it: '{v} (mantenuto)', de: '{v} (bleibt)' },
    m3_memes_photos: { fr: 'mêmes photos', en: 'same photos', es: 'mismas fotos', it: 'stesse foto', de: 'gleiche Fotos' },
    m3_nouvelle: { fr: 'nouvelle annonce', en: 'new listing', es: 'anuncio nuevo', it: 'nuovo annuncio', de: 'neue Anzeige' },
    m3_s_en_vente: { fr: 'En ligne', en: 'Online', es: 'Publicado', it: 'Online', de: 'Online' },
    m3_s_masque: { fr: 'Masquée', en: 'Hidden', es: 'Oculto', it: 'Nascosto', de: 'Ausgeblendet' },
    m3_s_brouillon: { fr: 'Brouillon', en: 'Draft', es: 'Borrador', it: 'Bozza', de: 'Entwurf' },
    m3_s_reserve: { fr: 'Réservée', en: 'Reserved', es: 'Reservado', it: 'Riservato', de: 'Reserviert' },
    m3_s_vendu: { fr: 'Vendue', en: 'Sold', es: 'Vendido', it: 'Venduto', de: 'Verkauft' },
    m3_s_a_confirmer: { fr: 'À confirmer', en: 'To confirm', es: 'Por confirmar', it: 'Da confermare', de: 'Zu bestätigen' },
    m3_c_categorie: { fr: 'catégorie', en: 'category', es: 'categoría', it: 'categoria', de: 'Kategorie' },
    m3_c_marque: { fr: 'marque', en: 'brand', es: 'marca', it: 'marca', de: 'Marke' },
    m3_c_taille: { fr: 'taille', en: 'size', es: 'talla', it: 'taglia', de: 'Größe' },
    m3_c_etat: { fr: 'état', en: 'condition', es: 'estado', it: 'condizioni', de: 'Zustand' },
    m3_c_couleurs: { fr: 'couleurs', en: 'colours', es: 'colores', it: 'colori', de: 'Farben' },
    m3_c_colis: { fr: 'colis', en: 'parcel', es: 'paquete', it: 'pacco', de: 'Paket' },
    m3_c_description: { fr: 'description', en: 'description', es: 'descripción', it: 'descrizione', de: 'Beschreibung' },
    m3_c_corrige: { fr: 'corrigé', en: 'corrected', es: 'corregido', it: 'corretto', de: 'korrigiert' },
    m3_c_manque: { fr: 'à corriger', en: 'to fix', es: 'por corregir', it: 'da correggere', de: 'zu korrigieren' },
    m3_c_absent: { fr: 'aucun sur l’annonce', en: 'none on the listing', es: 'ninguno en el anuncio', it: 'nessuno sull’annuncio', de: 'keins in der Anzeige' },
    m3_c_pas_verifie: { fr: 'vérifiés au départ de l’annonce (rien ne part incomplet)', en: 'checked when the listing starts (nothing incomplete is sent)', es: 'se comprueban al salir el anuncio (no sale nada incompleto)', it: 'verificati alla partenza dell’annuncio (non parte nulla di incompleto)', de: 'beim Start der Anzeige geprüft (nichts Unvollständiges wird gesendet)' },
    m3_total: { fr: '{n} annonces', en: '{n} listings', es: '{n} anuncios', it: '{n} annunci', de: '{n} Anzeigen' },
    m3_total_1: { fr: '1 annonce', en: '1 listing', es: '1 anuncio', it: '1 annuncio', de: '1 Anzeige' },
    m3_t_baisse: { fr: '{n} prix baissés', en: '{n} prices lowered', es: '{n} precios bajados', it: '{n} prezzi ribassati', de: '{n} Preise gesenkt' },
    m3_t_baisse_1: { fr: '1 prix baissé', en: '1 price lowered', es: '1 precio bajado', it: '1 prezzo ribassato', de: '1 Preis gesenkt' },
    m3_t_hausse: { fr: '{n} prix montés', en: '{n} prices raised', es: '{n} precios subidos', it: '{n} prezzi aumentati', de: '{n} Preise erhöht' },
    m3_t_hausse_1: { fr: '1 prix monté', en: '1 price raised', es: '1 precio subido', it: '1 prezzo aumentato', de: '1 Preis erhöht' },
    m3_t_republier: { fr: '{n} republiées', en: '{n} relisted', es: '{n} republicados', it: '{n} ripubblicati', de: '{n} neu eingestellt' },
    m3_t_republier_1: { fr: '1 republiée', en: '1 relisted', es: '1 republicado', it: '1 ripubblicato', de: '1 neu eingestellt' },
    m3_t_masquer: { fr: '{n} masquées', en: '{n} hidden', es: '{n} ocultos', it: '{n} nascosti', de: '{n} ausgeblendet' },
    m3_t_masquer_1: { fr: '1 masquée', en: '1 hidden', es: '1 oculto', it: '1 nascosto', de: '1 ausgeblendet' },
    m3_t_afficher: { fr: '{n} affichées', en: '{n} shown', es: '{n} visibles', it: '{n} visibili', de: '{n} eingeblendet' },
    m3_t_afficher_1: { fr: '1 affichée', en: '1 shown', es: '1 visible', it: '1 visibile', de: '1 eingeblendet' },
    m3_feuille: { fr: 'Avant / après — relis avant de lancer', en: 'Before / after — check before you start', es: 'Antes / después — revisa antes de lanzar', it: 'Prima / dopo — controlla prima di avviare', de: 'Vorher / nachher — vor dem Start prüfen' },
    m3_vert: { fr: 'En vert : ce qui change. En gris : ce qui reste pareil. « — » : VRM ne le sait pas.', en: 'Green: what changes. Grey: what stays the same. “—”: VRM doesn’t know it.', es: 'En verde: lo que cambia. En gris: lo que no cambia. «—»: VRM no lo sabe.', it: 'In verde: ciò che cambia. In grigio: ciò che resta uguale. «—»: VRM non lo sa.', de: 'Grün: was sich ändert. Grau: was gleich bleibt. „—“: VRM weiß es nicht.' },
    m3_revoir: { fr: 'Voir l’avant / après', en: 'See before / after', es: 'Ver antes / después', it: 'Vedi prima / dopo', de: 'Vorher / nachher ansehen' },
    m3_lancer: { fr: 'Lancer', en: 'Start', es: 'Lanzar', it: 'Avvia', de: 'Starten' },
    m3_retour: { fr: 'Modifier', en: 'Edit', es: 'Editar', it: 'Modifica', de: 'Ändern' },
    m3_e_coffre: { fr: 'Coffre', en: 'Vault', es: 'Copia', it: 'Archivio', de: 'Tresor' },
    m3_e_brouillon: { fr: 'Brouillon relu', en: 'Draft checked', es: 'Borrador revisado', it: 'Bozza verificata', de: 'Entwurf geprüft' },
    m3_e_supprimee: { fr: 'Supprimée', en: 'Deleted', es: 'Eliminado', it: 'Eliminato', de: 'Gelöscht' },
    m3_e_enligne: { fr: 'En ligne', en: 'Online', es: 'Publicado', it: 'Online', de: 'Online' },
    m3_e_lu: { fr: 'Prix lu', en: 'Price read', es: 'Precio leído', it: 'Prezzo letto', de: 'Preis gelesen' },
    m3_e_tape: { fr: 'Nouveau prix tapé', en: 'New price typed', es: 'Nuevo precio escrito', it: 'Nuovo prezzo digitato', de: 'Neuer Preis getippt' },
    m3_e_enregistre: { fr: 'Enregistré', en: 'Saved', es: 'Guardado', it: 'Salvato', de: 'Gespeichert' },
    m3_e_verifie: { fr: 'Vérifié', en: 'Checked', es: 'Comprobado', it: 'Verificato', de: 'Geprüft' },
    m3_e_lu_m: { fr: 'Annonce lue', en: 'Listing read', es: 'Anuncio leído', it: 'Annuncio letto', de: 'Anzeige gelesen' },
    m3_en_cours: { fr: 'en cours', en: 'in progress', es: 'en curso', it: 'in corso', de: 'läuft' },
    m3_a_reprendre: { fr: 'arrêtée ici', en: 'stopped here', es: 'detenido aquí', it: 'fermato qui', de: 'hier gestoppt' },
    m3_ecoule: { fr: 'Écoulé {e} · environ {r} restant', en: 'Elapsed {e} · about {r} left', es: 'Transcurrido {e} · unos {r} restantes', it: 'Trascorso {e} · circa {r} rimanenti', de: 'Vergangen {e} · noch etwa {r}' },
    m3_ecoule_seul: { fr: 'Écoulé {e}', en: 'Elapsed {e}', es: 'Transcurrido {e}', it: 'Trascorso {e}', de: 'Vergangen {e}' },
    m3_bilan: { fr: 'Faites : {ok} · à reprendre : {ko}', en: 'Done: {ok} · to resume: {ko}', es: 'Hechas: {ok} · por retomar: {ko}', it: 'Fatte: {ok} · da riprendere: {ko}', de: 'Erledigt: {ok} · fortzusetzen: {ko}' },
    m3_bilan_ok: { fr: 'Faites : {ok}', en: 'Done: {ok}', es: 'Hechas: {ok}', it: 'Fatte: {ok}', de: 'Erledigt: {ok}' },
    m3_voir: { fr: 'Voir sur Vinted', en: 'See on Vinted', es: 'Ver en Vinted', it: 'Vedi su Vinted', de: 'Auf Vinted ansehen' },
    m3_ouvrir: { fr: 'Ouvrir sur Vinted', en: 'Open on Vinted', es: 'Abrir en Vinted', it: 'Apri su Vinted', de: 'Auf Vinted öffnen' },
    m3_reprendre: { fr: 'Reprendre', en: 'Resume', es: 'Retomar', it: 'Riprendi', de: 'Fortsetzen' },
    m3_fermer: { fr: 'Fermer', en: 'Close', es: 'Cerrar', it: 'Chiudi', de: 'Schließen' },
    m3_lien_nouveau: { fr: 'Nouveau lien', en: 'New link', es: 'Enlace nuevo', it: 'Nuovo link', de: 'Neuer Link' },
    m3_a_masquer: { fr: 'Masquer / afficher', en: 'Hide / show', es: 'Ocultar / mostrar', it: 'Nascondi / mostra', de: 'Ausblenden / einblenden' },
    m3_suivi: { fr: 'Modifications en cours · {i} sur {n}', en: 'Changes in progress · {i} of {n}', es: 'Cambios en curso · {i} de {n}', it: 'Modifiche in corso · {i} di {n}', de: 'Änderungen laufen · {i} von {n}' },
    m3_suivi_fin: { fr: 'Modifications terminées', en: 'Changes finished', es: 'Cambios terminados', it: 'Modifiche terminate', de: 'Änderungen fertig' },
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
  // 5.419 (Julien, 21 nov. : « on a un style assez simple et après des couleurs bleu vif qui ne vont pas ensemble ») :
  //    la palette SOBRE « façon Vintex » — fond gris clair / noir, plaques blanches / #1C1C1E, filets gris fins, l'ENCRE
  //    pour le bouton plein, liens à l'encre, un accent VERT SAPIN rare (onglet actif, interrupteurs, cases), ambre =
  //    geste à faire. Plus aucun bleu (audit-couleur-panneau).
  const JOUR = `--vu-coque-uni:#F2F2F7;--vu-coque:#F2F2F7;
    --vu-sur:#111114;--vu-sur-2:#6C6C70;--vu-plaque:#FFFFFF;--vu-plaque-2:#F7F7F8;--vu-encre:#111114;--vu-muet:#6C6C70;--vu-filet:rgb(60 60 67/.16);
    --vu-ombre:0 .5px 0 rgb(0 0 0/.05),0 1px 2px rgb(0 0 0/.06),0 10px 24px -14px rgb(0 0 0/.22);
    --vu-plein:#111114;--vu-plein-appui:#2C2C2E;--vu-plein-encre:#FFFFFF;--vu-plein-sur-plaque:#111114;--vu-plein-sur-plaque-encre:#FFFFFF;
    --vu-teinte:rgb(118 118 128/.12);--vu-teinte-appui:rgb(118 118 128/.22);--vu-teinte-encre:#111114;--vu-lien:#111114;--vu-anneau:0 0 0 3px rgb(15 107 76/.35);
    --vu-ambre:#8A4B00;--vu-ambre-point:#E08A12;--vu-ok:#1F7A3A;--vu-socle:#E5E5EA;--vu-barre:#0F6B4C;
    --vu-kraft:#E9DCC4;--vu-kraft-encre:#2A2116;--vu-kraft-doux:#6B5A40;--vu-kraft-bord:rgb(42 33 22/.22);
    --vu-voile:rgb(0 0 0/.42);--vu-toast:#111114;--vu-toast-encre:#F2F2F7;
    --vu-chg:#E6F4EA;--vu-chg-encre:#1F5A33;--vu-ambre-fond:#FFF4DD;`;
  const NUIT = `--vu-coque-uni:#000000;--vu-coque:#000000;
    --vu-sur:#F2F2F7;--vu-sur-2:#98989F;--vu-plaque:#1C1C1E;--vu-plaque-2:#2C2C2E;--vu-encre:#F2F2F7;--vu-muet:#98989F;--vu-filet:rgb(84 84 88/.55);
    --vu-ombre:0 0 0 .5px rgb(255 255 255/.06),0 12px 26px -14px rgb(0 0 0/.85);
    --vu-plein:#F2F2F7;--vu-plein-appui:#D1D1D6;--vu-plein-encre:#111114;--vu-plein-sur-plaque:#F2F2F7;--vu-plein-sur-plaque-encre:#111114;
    --vu-teinte:rgb(118 118 128/.24);--vu-teinte-appui:rgb(118 118 128/.34);--vu-teinte-encre:#F2F2F7;--vu-lien:#F2F2F7;--vu-anneau:0 0 0 3px rgb(63 212 154/.45);
    --vu-ambre:#FFB340;--vu-ambre-point:#F2A33A;--vu-ok:#7FD39A;--vu-socle:#2C2C2E;--vu-barre:#3FD49A;
    --vu-kraft:#3A3226;--vu-kraft-encre:#F3E9D6;--vu-kraft-doux:#CDBB9C;--vu-kraft-bord:rgb(243 233 214/.22);
    --vu-voile:rgb(0 0 0/.62);--vu-toast:#F2F2F7;--vu-toast-encre:#111114;
    --vu-chg:rgb(48 209 88/.16);--vu-chg-encre:#7FD39A;--vu-ambre-fond:rgb(255 179 64/.16);`;
  const CSS = `
  :host, .vu-racine { ${JOUR} }
  @media (prefers-color-scheme: dark) { :host(:not([data-theme="clair"])), .vu-racine:not([data-theme="clair"]) { ${NUIT} } }
  :host([data-theme="sombre"]), .vu-racine[data-theme="sombre"] { ${NUIT} }
  :host, .vu-racine { --vu-police: "Inter VRM", Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    --vu-e-appui: 100ms cubic-bezier(.2,.9,.25,1); --vu-e-retour: 200ms cubic-bezier(.32,1.25,.5,1); }
  .vu-racine, .vu-racine * , .vu-coque, .vu-coque * { box-sizing: border-box; }
  .vu-coque { background-color: var(--vu-coque-uni); background-image: var(--vu-coque); color: var(--vu-sur); border: 1px solid var(--vu-filet); border-radius: 22px;
    box-shadow: 0 1px 2px rgb(0 0 0/.18), 0 30px 60px -24px rgb(0 0 0/.7); font: 400 14px/1.4 var(--vu-police); -webkit-font-smoothing: antialiased; }
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
  .vu-coque > .vu-sec, .vu-sur-coque .vu-sec { background: var(--vu-teinte); color: var(--vu-sur); }
  .vu-lien { appearance: none; border: 0; background: transparent; padding: 0 4px; min-height: 44px; display: inline-flex; align-items: center; color: var(--vu-lien); font: 600 14px/1.2 var(--vu-police); cursor: pointer; text-decoration: none; }
  .vu-sur-coque .vu-lien { color: var(--vu-sur); text-decoration: underline; text-underline-offset: 3px; }
  /* Le contrôle segmenté : une piste, l'onglet choisi en porcelaine. */
  .vu-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0,1fr); gap: 2px; padding: 3px; border-radius: 14px; background: var(--vu-socle); }
  .vu-sur-coque .vu-seg, .vu-coque > .vu-seg { background: var(--vu-teinte); }
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
  .vu-sur-coque .vu-barre { background: var(--vu-teinte-appui); }
  .vu-barre > i { display: block; height: 100%; border-radius: 999px; background: var(--vu-barre); transition: width .4s cubic-bezier(.32,.72,0,1); }
  .vu-sur-coque .vu-barre > i { background: var(--vu-sur); }
  /* Le point d'état : neutre quand tout va bien (§7), ambre pour un geste, creux pour une pause. */
  .vu-point { display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: #7FD39A; flex: none; box-shadow: 0 0 0 3px rgb(127 211 154/.22); }
  .vu-point[data-k="geste"] { background: var(--vu-ambre-point); box-shadow: 0 0 0 3px rgb(224 138 18/.25); }
  .vu-point[data-k="pause"], .vu-point[data-k="prudence"], .vu-point[data-k="attente"], .vu-point[data-k="reseau"], .vu-point[data-k="arrete"] { background: transparent; box-shadow: inset 0 0 0 2px currentColor; }
  /* Le bandeau fin (une nouvelle version) et la ligne secondaire. */
  .vu-bandeau { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 4px 4px 4px 14px; border-radius: 14px; background: var(--vu-teinte); color: var(--vu-sur); font: 600 13px/1.3 var(--vu-police); }
  .vu-bandeau > span { flex: 1; min-width: 0; }
  .vu-sous { font: 500 13px/1.4 var(--vu-police); color: var(--vu-sur-2); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .vu-sous b { color: var(--vu-sur); font-weight: 600; }
  /* Le message bref (en bas, au centre) et le bandeau posés dans la PAGE (hôtes à nous). */
  .vu-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483646; max-width: min(460px, calc(100vw - 32px));
    padding: 12px 16px; border-radius: 14px; background: var(--vu-toast); color: var(--vu-toast-encre); font: 600 14px/1.4 var(--vu-police);
    box-shadow: 0 1px 2px rgb(0 0 0/.25), 0 16px 36px -12px rgb(0 0 0/.55); }
  @media (prefers-reduced-motion: reduce) { .vu-btn, .vu-barre > i { transition: none; } .vu-btn:active:not(:disabled) { transform: none; } }
  /* 5.423 (\`modifavantapres\`) : la FRISE des étapes d'une modification d'annonce (une étape = une preuve) et la feuille
     AVANT | APRÈS (ce qui change en vert pastel, ce qui reste en gris, « — » quand VRM ne sait pas). */
  .vu-frise { list-style: none; margin: 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px;
    font: 500 12px/1.25 var(--vu-police); color: var(--n-encre-2, var(--vu-muet)); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .vu-frise li { position: relative; display: grid; justify-items: center; align-content: start; text-align: center; gap: 6px; min-width: 0; }
  .vu-frise li + li::before { content: ''; position: absolute; top: 15px; left: calc(-50% + 20px); right: calc(50% + 20px); height: 2px; border-radius: 2px; background: var(--n-trait, var(--vu-filet)); }
  .vu-frise li[data-etat="faite"] + li::before { background: var(--vu-barre); }
  .vu-fr-i { width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; background: var(--n-neutre, var(--vu-teinte)); color: var(--n-encre-2, var(--vu-muet)); }
  .vu-fr-i svg { width: 17px; height: 17px; display: block; }
  .vu-frise [data-etat="faite"] .vu-fr-i { background: var(--vu-chg); color: var(--vu-chg-encre); }
  .vu-frise [data-etat="encours"] .vu-fr-i { background: var(--n-carte, var(--vu-plaque)); color: var(--n-encre, var(--vu-encre)); box-shadow: 0 0 0 2px var(--vu-barre); animation: vu-fr-pouls 1.6s ease-in-out infinite; }
  .vu-frise [data-etat="erreur"] .vu-fr-i { background: var(--vu-ambre-fond); color: var(--vu-ambre); box-shadow: 0 0 0 2px var(--vu-ambre-point); }
  .vu-fr-t { min-width: 0; overflow-wrap: anywhere; }
  .vu-fr-t b { display: block; font-weight: 600; }
  .vu-frise [data-etat="faite"] .vu-fr-t b, .vu-frise [data-etat="encours"] .vu-fr-t b { color: var(--n-encre, currentColor); }
  .vu-frise [data-etat="erreur"] .vu-fr-t { color: var(--vu-ambre); }
  .vu-fr-t small { display: block; font-size: 11px; font-weight: 500; }
  @keyframes vu-fr-pouls { 0%, 100% { box-shadow: 0 0 0 2px var(--vu-barre); } 50% { box-shadow: 0 0 0 5px rgb(15 107 76/.12); } }
  .vu-aa, .vu-bl { max-width: 880px; }
  .vu-aa { display: grid; gap: 10px; font: 400 14px/1.35 var(--vu-police); color: var(--n-encre, var(--vu-encre)); }
  .vu-aa-tot { font: 650 15px/1.3 var(--vu-police); }
  .vu-aa-note { margin: 0; font-size: 13px; color: var(--n-encre-2, var(--vu-muet)); }
  .vu-aa-l { border: 1px solid var(--n-trait, var(--vu-filet)); border-radius: 14px; background: var(--n-carte, var(--vu-plaque)); color: var(--n-encre, var(--vu-encre)); overflow: hidden; }
  .vu-aa-l > summary { list-style: none; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto 10px; gap: 10px; align-items: center; min-height: 60px; padding: 8px 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .vu-aa-l > summary::-webkit-details-marker { display: none; }
  .vu-aa-l > summary::after { content: ''; width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); opacity: .4; justify-self: center; }
  .vu-aa-l[open] > summary::after { transform: rotate(225deg); }
  .vu-aa-l > summary:focus-visible { outline: none; box-shadow: inset var(--vu-anneau); }
  .vu-aa-img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; display: block; background: var(--n-neutre, var(--vu-socle)); }
  .vu-aa-ti { min-width: 0; display: grid; gap: 2px; }
  .vu-aa-ti b { font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
  .vu-aa-ti small { display: flex; gap: 6px; align-items: center; color: var(--n-encre-2, var(--vu-muet)); font-size: 12px; }
  .vu-aa-d { font: 600 13px/1.2 var(--vu-police); white-space: normal; max-width: 48vw; text-align: center; justify-self: end; padding: 3px 8px; border-radius: 6px; background: var(--vu-chg); color: var(--vu-chg-encre); font-variant-numeric: tabular-nums; }
  .vu-aa-d[data-ton="ambre"] { background: var(--vu-ambre-fond); color: var(--vu-ambre); }
  .vu-aa-t { display: grid; grid-template-columns: minmax(78px, .7fr) minmax(0, 1fr) minmax(0, 1fr); border-top: 1px solid var(--n-trait, var(--vu-filet)); font-variant-numeric: tabular-nums; }
  .vu-aa-t > div { padding: 8px 10px; min-width: 0; border-top: 1px solid var(--n-trait, var(--vu-filet)); overflow-wrap: anywhere; }
  .vu-aa-t > .h { border-top: 0; font: 600 12px/1.3 var(--vu-police); color: var(--n-encre-2, var(--vu-muet)); }
  .vu-aa-t > .k { color: var(--n-encre-2, var(--vu-muet)); font-size: 13px; }
  .vu-aa-t > [data-v="meme"] { color: var(--n-encre-2, var(--vu-muet)); }
  .vu-aa-t > [data-v="chg"] { background: var(--vu-chg); color: var(--vu-chg-encre); font-weight: 600; }
  .vu-aa-t > [data-v="inconnu"] { color: var(--n-encre-2, var(--vu-muet)); }
  .vu-aa-t .vu-aa-img { width: 56px; height: 56px; }
  .vu-aa-t > .plein { grid-column: 2 / -1; }
  .vu-aa-champs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .vu-aa-champs li { padding: 2px 8px; border-radius: 6px; background: var(--n-neutre, var(--vu-teinte)); color: var(--n-encre-2, var(--vu-muet)); font-size: 12px; line-height: 20px; }
  .vu-aa-champs li[data-c="corrige"] { background: var(--vu-chg); color: var(--vu-chg-encre); }
  .vu-aa-champs li[data-c="manque"] { background: var(--vu-ambre-fond); color: var(--vu-ambre); font-weight: 600; }
  .vu-bl { display: grid; gap: 8px; }
  .vu-bl-tot { font: 650 15px/1.3 var(--vu-police); color: inherit; }
  .vu-bl-l { font: 400 14px/1.35 var(--vu-police); }
  .vu-bl-c { display: grid; gap: 10px; padding: 0 12px 12px; }
  .vu-bl-c > .vu-aa-t { border: 1px solid var(--n-trait, var(--vu-filet)); border-radius: 10px; overflow: hidden; }
  .vu-bl-c > .vu-frise { padding-top: 4px; }
  .vu-bl-r { margin: 0; color: var(--vu-ambre); font-size: 13px; }
  .vu-bl-g { display: flex; flex-wrap: wrap; gap: 8px; }
  .vu-bl-g .vu-btn, .vu-bl-g .vu-lien { min-height: 44px; }
  .vu-bl-g a.vu-btn { width: auto; }
  @media (prefers-reduced-motion: reduce) { .vu-frise [data-etat="encours"] .vu-fr-i { animation: none; } }
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
    background-color: var(--vu-coque-uni); background-image: var(--vu-coque); color: var(--vu-sur); border: 1px solid var(--vu-filet);
    font: 400 14px/1.45 var(--vu-police); box-shadow: 0 1px 2px rgb(0 0 0/.18), 0 30px 60px -24px rgb(0 0 0/.7); }
  [data-vrm-ui] b, [data-vrm-ui] strong { font-weight: 700; }
  [data-vrm-ui] a { color: inherit; text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
  [data-vrm-ui] button { all: initial; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 8px 8px 0 0; padding: 0 16px;
    border-radius: 14px; background: var(--vu-plein); color: var(--vu-plein-encre); font: 600 14px/1.2 var(--vu-police); cursor: pointer; }
  [data-vrm-ui] button:focus-visible { box-shadow: var(--vu-anneau); }
  [data-vrm-ui] button + button { background: var(--vu-teinte); color: var(--vu-sur); }
  [data-vrm-ui] div, [data-vrm-ui] p, [data-vrm-ui] span, [data-vrm-ui] ul, [data-vrm-ui] li { font: inherit; color: inherit; }
  [data-vrm-ui] div + div, [data-vrm-ui] p { display: block; margin-top: 4px; }
  /* Les anciens gabarits portaient leurs couleurs en ligne (gris sur noir) : sur la coque bleue,
     la feuille commune les reprend (contraste ≥ 4,5:1), sans toucher au texte. */
  [data-vrm-ui="bandeau"] [style*="color:#8A93A3"], [data-vrm-ui="bandeau"] [style*="color:#6B7485"], [data-vrm-ui="bandeau"] [style*="color:#8b95a5"] { color: var(--vu-sur-2) !important; }
  [data-vrm-ui="bandeau"] [style*="color:#E8ECF2"] { color: var(--vu-sur) !important; }
  [data-vrm-ui="bandeau"] [style*="color:#F5A524"] { color: var(--vu-ambre) !important; }
  [data-vrm-ui] button[style] { border: 0 !important; min-height: 44px !important; padding: 0 16px !important; border-radius: 14px !important; font: 600 14px/1.2 var(--vu-police) !important; }
  [data-vrm-ui] button[style]:first-of-type { background: var(--vu-plein) !important; color: var(--vu-plein-encre) !important; }
  [data-vrm-ui] button[style] ~ button[style] { background: var(--vu-teinte) !important; color: var(--vu-sur) !important; }
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
  // 5.410 : le logo d'un transporteur (la tuile de l'app, copie refabriquée) ; clé inconnue ⇒ '' (jamais une marque devinée).
  const logoTransp = (cle, taille) => { const m = LOGOS_TRANSP[cle]; const t = Number(taille) || 20; return m ? `<span class="vu-transp" aria-hidden="true" style="width:${t}px;height:${t}px"><svg viewBox="0 0 32 32" width="100%" height="100%" focusable="false"><rect width="32" height="32" fill="${m.fond}"/>${m.svg}${LISERE_TRANSP}</svg></span>` : ''; };
  const nomTransp = (cle) => (LOGOS_TRANSP[cle] ? LOGOS_TRANSP[cle].nom : '');
  // ══ 5.423 (`modifavantapres`, Julien 21 nov. : « pour la modification qui est en place dans l'extension, tu peux faire
  //    l'avant / après et un meilleur processus visuel ») — UNE MODIFICATION D'ANNONCE, AVANT / PENDANT / APRÈS ═════════
  //  Une seule règle pour le panneau (vrm-badge.js) et l'écran plein (vrm-action.js). Rien ici n'agit : on DESSINE ce que
  //  le service worker a lu (avant) et ce qu'il a PROUVÉ (pendant, après). Une valeur absente s'écrit « — ».
  // <frise-modif-regle> Les étapes de chaque sorte, dans l'ordre où le service worker les PROUVE :
  //   republier : coffre (annonce enregistrée dans VRM) · brouillon (rendu par la page ET relu conforme à la fiche) ·
  //               supprimée (Vinted a accepté la suppression) · en ligne (Vinted a rendu l'identifiant de la nouvelle) ;
  //   baisse    : prix lu (relu chez Vinted = le prix vu) · nouveau prix tapé (la page le dit dans le champ) ·
  //               enregistré (Vinted a répondu oui) · vérifié (le prix RELU est le nouveau) ;
  //   masquer   : annonce lue (dans le dressing de CE compte) · enregistré (réponse de Vinted) · vérifié (le bouton inverse vu).
  // Une étape est « faite » SEULEMENT si sa preuve est datée (`preuves[k]`, posée par le fond au moment de la preuve) ;
  // jamais déduite de l'étape suivante ni du temps passé. La première sans preuve : « en cours » pendant l'action, en
  // AMBRE (« arrêtée ici ») si l'action s'est arrêtée dessus, sinon « en attente ».
  const Tn = (cle, n) => T(Number(n) === 1 && MOTS[cle + '_1'] ? cle + '_1' : cle, { n });   // « 1 annonce » / « 3 annonces »
  const ETAPES_MODIF = Object.freeze({ republier: Object.freeze(['coffre', 'brouillon', 'supprimee', 'enligne']), baisse: Object.freeze(['lu', 'tape', 'enregistre', 'verifie']), masquer: Object.freeze(['lu', 'enregistre', 'verifie']) });
  function friseModif(m) {
    const sorte = m && typeof m === 'object' && Object.prototype.hasOwnProperty.call(ETAPES_MODIF, m.sorte) ? m.sorte : '';
    if (!sorte) return [];
    const pr = m.preuves && typeof m.preuves === 'object' ? m.preuves : {};
    const err = !!(m.erreur && typeof m.erreur === 'object'), fini = !!m.fin;
    let premier = true;
    return ETAPES_MODIF[sorte].map((k) => {
      const at = Number(pr[k]);
      if (Number.isFinite(at) && at > 0) return { k, etat: 'faite', at };
      const etat = premier ? (err ? 'erreur' : fini ? 'attente' : 'encours') : 'attente';
      premier = false;
      return { k, etat, at: null };
    });
  }
  // </frise-modif-regle>
  const ICONES_MODIF = {
    coffre: '<path d="M4 6h16v4H4zM5 10v9h14v-9M10 14h4"/>',
    brouillon: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 14l2 2 3.5-4"/>',
    supprimee: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    enligne: '<path d="M12 18V6M7 11l5-5 5 5M5 21h14"/>',
    lu: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    tape: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    enregistre: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
    verifie: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
  };
  const icone = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES_MODIF[k] || ''}</svg>`;
  const nomEtape = (sorte, k) => T(sorte === 'masquer' && k === 'lu' ? 'm3_e_lu_m' : 'm3_e_' + k);
  const heure = (t) => { try { return new Date(Number(t)).toLocaleTimeString(LANGUE, { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  // La frise : <ol data-frise> ; chaque <li data-etape data-etat data-preuve> (la date de SA preuve, vide sinon).
  function friseHtml(m) {
    const f = friseModif(m);
    if (!f.length) return '';
    return `<ol class="vu-frise" data-frise="${esc(m.sorte)}" aria-label="${esc(T('r_etapes'))}">${f.map((e) => `<li data-etape="${e.k}" data-etat="${e.etat}" data-preuve="${e.at ? Math.round(e.at) : ''}"><span class="vu-fr-i">${e.etat === 'faite' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 12.5l4 4L18 8"/></svg>' : icone(e.k)}</span><span class="vu-fr-t"><b>${esc(nomEtape(m.sorte, e.k))}</b><small>${e.etat === 'faite' ? esc(heure(e.at)) : e.etat === 'encours' ? esc(T('m3_en_cours')) : e.etat === 'erreur' ? esc(T('m3_a_reprendre')) : '&nbsp;'}</small></span></li>`).join('')}</ol>`;
  }
  // ── AVANT | APRÈS ─────────────────────────────────────────────────────────────────────────────────────────────
  const euro = (n) => (Number(n) > 0 ? (Math.round(Number(n) * 100) % 100 ? (Math.round(Number(n) * 100) / 100).toLocaleString(LANGUE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(Number(n)))) + ' €' : '');
  const STATUTS_MODIF = ['en_vente', 'masque', 'brouillon', 'reserve', 'vendu', 'a_confirmer'];
  const statutTxt = (s) => (STATUTS_MODIF.includes(s) ? T('m3_s_' + s) : '');
  const depuisTxt = (v, maintenant) => {
    if (v === 'maintenant') return T('m3_maintenant');
    const t = Number(v); if (!(t > 0)) return '';
    const j = Math.floor((maintenant - t) / 864e5);
    return j <= 0 ? (maintenant - t < 12 * 36e5 ? `${T('m3_aujourdhui')} · ${heure(t)}` : T('m3_aujourdhui')) : T('m3_il_y_a', { n: j });
  };
  const CHAMPS_MODIF = ['categorie', 'marque', 'taille', 'etat', 'couleurs', 'colis', 'description'];
  // Ce qui change, pour UNE ligne (une annonce) : des valeurs LUES — `avant` (le dressing rangé), `apres` (ce que le geste
  // posera : son nouveau prix, « maintenant », « masquée ») ; aucun champ absent n'est rempli.
  function cellules(l, maintenant) {
    const a = l.avant || {}, p = l.apres || {};
    const v = (x) => (x == null || x === '' ? null : x);
    const lig = [];
    const ajout = (k, av, ap, opts = {}) => { const A = v(av), P = v(ap); lig.push({ k, av: A, ap: P, chg: opts.chg != null ? opts.chg : (A != null && P != null && A !== P), garde: !!opts.garde }); };
    ajout('prix', euro(a.prix), euro(p.prix != null ? p.prix : a.prix));
    ajout('etat', statutTxt(a.statut), statutTxt(p.statut != null ? p.statut : a.statut), l.sorte === 'republier' ? { chg: !!statutTxt(p.statut) } : {});   // republier : une NOUVELLE annonce (même état, autre identifiant)
    ajout('depuis', depuisTxt(a.depuis, maintenant), depuisTxt(p.depuis != null ? p.depuis : a.depuis, maintenant));
    ajout('num', l.num ? String(l.num) : null, l.num ? T('m3_garde', { v: String(l.num) }) : null, { chg: false, garde: true });
    return lig;
  }
  const photoAa = (u) => (/^https:\/\/[\w.-]+\//.test(String(u || '')) ? `<img class="vu-aa-img" src="${esc(u)}" alt="" referrerpolicy="no-referrer" decoding="async" loading="lazy">` : '<span class="vu-aa-img" aria-hidden="true"></span>');
  function tableAaHtml(l, maintenant, opts = {}) {
    const lig = cellules(l, maintenant);
    const val = (x) => (x == null ? '—' : esc(x));
    const etat = (c, cote) => (cote === 'av' ? (c.av == null ? 'inconnu' : 'meme') : (c.ap == null ? 'inconnu' : c.chg ? 'chg' : 'meme'));
    let h = `<div class="vu-aa-t" data-aa-table="${esc(l.id)}"><div class="h"></div><div class="h">${esc(T('m3_avant'))}</div><div class="h">${esc(T('m3_apres'))}</div>`;
    if (opts.photo !== false) h += `<div class="k">${esc(T('m3_photo'))}</div><div data-v="meme">${photoAa(l.photo)}</div><div data-v="meme" data-aa-photo-apres>${photoAa(l.photo)}${l.sorte === 'republier' ? `<small>${esc(T('m3_memes_photos'))}</small>` : ''}</div>`;
    for (const c of lig) {
      if (c.k === 'titre' && opts.titre === false) continue;
      if (opts.compact && c.k === 'etat' && !c.chg) continue;
      if (c.av == null && c.ap == null && c.k !== 'prix') continue;
      h += `<div class="k">${esc(T('m3_' + c.k))}</div><div data-aa="${c.k}" data-cote="avant" data-v="${etat(c, 'av')}">${val(c.av)}</div><div data-aa="${c.k}" data-cote="apres" data-v="${etat(c, 'ap')}">${val(c.ap)}${c.k === 'etat' && l.sorte === 'republier' ? ` · ${esc(T('m3_nouvelle'))}` : ''}</div>`;
    }
    if (l.sorte === 'republier' && !opts.compact) {
      const ch = Array.isArray(l.champs) ? l.champs : null;
      h += `<div class="k">${esc(T('m3_champs'))}</div><div class="plein" data-aa="champs" data-v="${ch ? 'meme' : 'inconnu'}">${ch ? `<ul class="vu-aa-champs">${CHAMPS_MODIF.map((k) => { const c = ch.find((x) => x && x.k === k); const e = c && ['copie', 'corrige', 'manque', 'absent'].includes(c.etat) ? c.etat : null; return `<li data-champ="${k}" data-c="${e || 'inconnu'}">${e === 'copie' ? '✓ ' : ''}${esc(T('m3_c_' + k))}${e === 'corrige' ? ' · ' + esc(T('m3_c_corrige')) : e === 'manque' ? ' · ' + esc(T('m3_c_manque')) : e === 'absent' ? ' · ' + esc(T('m3_c_absent')) : e ? '' : ' · —'}</li>`; }).join('')}</ul>` : esc(T('m3_c_pas_verifie'))}</div>`;
    }
    return h + '</div>';
  }
  // Le résumé d'une ligne (sa rangée repliée) : « 59 € → 53 € », « il y a 12 j → maintenant », « En ligne → Masquée ».
  function resumeLigne(l, maintenant) {
    const a = l.avant || {}, p = l.apres || {};
    if (l.sorte === 'baisse' && Number(a.prix) > 0 && Number(p.prix) > 0) return `${euro(a.prix)} → ${euro(p.prix)}`;
    if (l.sorte === 'baisse' && Number(p.prix) > 0) return `— → ${euro(p.prix)}`;
    if (l.sorte === 'republier') return `${depuisTxt(a.depuis, maintenant) || '—'} → ${T('m3_maintenant')}`;
    if (l.sorte === 'masquer' || l.sorte === 'afficher') return `${statutTxt(a.statut) || '—'} → ${statutTxt(p.statut) || '—'}`;
    return '';
  }
  // Le total d'un lot : « 6 annonces · 4 prix baissés · 2 republiées » (comptés sur les lignes, rien d'autre).
  function totalModifs(lignes) {
    const L = Array.isArray(lignes) ? lignes : [];
    const n = { baisse: 0, hausse: 0, republier: 0, masquer: 0, afficher: 0 };
    for (const l of L) {
      if (l.sorte === 'baisse') { const a = Number(l.avant && l.avant.prix), p = Number(l.apres && l.apres.prix); if (a > 0 && p > a) n.hausse++; else n.baisse++; }
      else if (n[l.sorte] != null) n[l.sorte]++;
    }
    return [Tn('m3_total', L.length), ...['baisse', 'hausse', 'republier', 'masquer', 'afficher'].filter((k) => n[k]).map((k) => Tn('m3_t_' + k, n[k]))].join(' · ');
  }
  // La feuille AVANT | APRÈS, avant de lancer : une rangée repliable par annonce (la 1re ouverte), le total du lot.
  function avantApresHtml(lignes, opts = {}) {
    const L = (Array.isArray(lignes) ? lignes : []).filter((l) => l && l.id);
    if (!L.length) return '';
    const t = Number(opts.maintenant) || Date.now();
    return `<div class="vu-aa" data-avant-apres="${L.length}"><div class="vu-aa-tot" data-aa-total>${esc(totalModifs(L))}</div><p class="vu-aa-note">${esc(T('m3_vert'))}</p>${L.map((l, i) => {
      const r = resumeLigne(l, t);
      return `<details class="vu-aa-l" data-aa-ligne="${esc(l.id)}" data-sorte="${esc(l.sorte)}"${i === 0 || L.length === 1 ? ' open' : ''}><summary>${photoAa(l.photo)}<span class="vu-aa-ti"><b>${esc(l.titre || '—')}</b><small>${l.num ? etiquette(l.num) : ''}</small></span>${r ? `<span class="vu-aa-d" data-aa-resume>${esc(r)}</span>` : '<span></span>'}</summary>${tableAaHtml(l, t, { photo: true })}</details>`; }).join('')}</div>`;
  }
  // ── APRÈS : le bilan, annonce par annonce (Avant | Après ; nouveau lien, nouveau prix, nouvelle date ; ce qui a échoué) ──
  //  `b` : une entrée du bilan rangée par le fond (`a.bilan`) — ses valeurs sont celles qu'il a LUES ou PROUVÉES.
  function bilanHtml(bilan, opts = {}) {
    const B = (Array.isArray(bilan) ? bilan : []).filter((b) => b && b.id && ETAPES_MODIF[b.sorte]);
    if (!B.length) return '';
    const t = Number(opts.maintenant) || Date.now();
    const dom = /^[\w.-]*vinted\.(fr|com|it|de)$/.test(String(opts.domaine || '')) ? String(opts.domaine) : 'www.vinted.fr';
    const nOk = B.filter((b) => b.ok === true).length, nKo = B.length - nOk;
    const lien = (id) => (/^\d{4,15}$/.test(String(id || '')) ? `https://${dom}/items/${id}` : '');
    // Une rangée par annonce : le résumé (ce qui a changé, ou l'étape où elle s'est arrêtée, en ambre) ; dépliée, le
    // tableau Avant | Après (seulement ce qui compte : prix, mise en ligne, état s'il change, N°) ou la frise et SA phrase.
    return `<div class="vu-bl" data-bilan="${B.length}" data-bilan-ok="${nOk}"><div class="vu-bl-tot">${esc(nKo ? T('m3_bilan', { ok: nOk, ko: nKo }) : T('m3_bilan_ok', { ok: nOk }))}</div>${B.map((b) => {
      const av = b.avant || {}, ap = b.apres || {}, ok = b.ok === true;
      const sorte = b.sorte === 'masquer' ? (ap.statut === 'en_vente' ? 'afficher' : 'masquer') : b.sorte;
      const l = { id: b.id, sorte, titre: b.titre, photo: b.photo, num: b.num, avant: av, apres: ok ? ap : { prix: av.prix, statut: av.statut, depuis: av.depuis } };
      const voir = ok ? lien(ap.id || b.id) : lien(b.id);
      const fr = friseModif({ sorte: b.sorte, preuves: b.preuves, erreur: b.erreur || { raison: '' }, fin: 1 });
      const ou = fr.find((e) => e.etat === 'erreur');
      const resume = ok ? (sorte === 'republier' ? `${depuisTxt(av.depuis, t) || '—'} → ${depuisTxt(ap.depuis, t) || '—'}` : resumeLigne(l, t)) : `${ou ? nomEtape(b.sorte, ou.k) + ' · ' : ''}${T('m3_a_reprendre')}`;
      const ouvert = !ok || B.length === 1;
      return `<details class="vu-aa-l vu-bl-l" data-bilan-ligne="${esc(b.id)}" data-ok="${ok ? '1' : '0'}"${ouvert ? ' open' : ''}><summary>${photoAa(b.photo)}<span class="vu-aa-ti"><b>${esc(b.titre || '—')}</b><small>${b.num ? etiquette(b.num) : ''}${ok && b.sorte === 'republier' && ap.id && String(ap.id) !== String(b.id) ? `<span data-bilan-nouveau="${esc(ap.id)}">${esc(T('m3_lien_nouveau'))} · ${esc(ap.id)}</span>` : ''}</small></span><span class="vu-aa-d"${ok ? '' : ' data-ton="ambre"'} data-bilan-resume>${esc(resume)}</span></summary><div class="vu-bl-c">`
        + (ok ? tableAaHtml(l, t, { photo: false, titre: false, compact: true }) : friseHtml({ sorte: b.sorte, preuves: b.preuves, erreur: b.erreur || { raison: '' }, fin: 1 }) + (b.erreur && b.erreur.raison ? `<p class="vu-bl-r" data-bilan-raison>${esc(b.erreur.raison)}</p>` : ''))
        + `<div class="vu-bl-g">${!ok && b.erreur && b.erreur.geste === 'reprendre' ? `<button type="button" class="vu-btn vu-sec" data-modif-reprendre="${esc(b.id)}">${esc(T('m3_reprendre'))}</button>` : ''}${voir ? `<a class="vu-btn vu-sec" href="${esc(voir)}" target="_blank" rel="noopener" data-modif-voir="${esc(ok ? (ap.id || b.id) : b.id)}">${esc(T(ok ? 'm3_voir' : 'm3_ouvrir'))}</a>` : ''}</div></div></details>`; }).join('')}</div>`;
  }
  const MODIF = Object.freeze({ ETAPES: ETAPES_MODIF, frise: friseModif, friseHtml, avantApresHtml, bilanHtml, totalModifs, resumeLigne, euro });
  globalThis.VRM_UI = Object.freeze({ T, MOTS, LANGUES, langue: () => LANGUE, duree, esc, CSS, CSS_PAGE, monter, habiller, etiquette, barre, logoTransp, nomTransp, MODIF });
})();
