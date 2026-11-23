// ════════════════════════════════════════════════════════════════════════════
//  LES LISTES QUE CHAQUE SITE SERT (19 nov. 2026, chantier publier-agent)
// ════════════════════════════════════════════════════════════════════════════
// Recopiées TELLES QUELLES des réponses des sites, captées par l'extension dans SON
// navigateur et rangées dans la base (lecture seule, 19 nov.) :
//   · Leboncoin : `lbc_catalogue` → fdata v7 (relue le 19 nov.) → `features.shoe_brand_a`
//     (« Marque », chaussures) : 793 libellés, dans l'ordre du site ;
//   · Vestiaire : `vc_catalogue.deposit_catalog` (28 oct.) : le catalogue de DÉPÔT complet
//     (5 univers, 15 catégories, leurs sous-catégories) — l'ancienne table n'en avait relevé
//     qu'une partie (src/correspondances.js, `VC_CATALOGUE`) ;
//   · Vestiaire : `vc_catalogue.deposit_brands` (28 oct.) : 17 183 marques, dont 3 486
//     « banned ». Trop lourde pour l'app : on garde ici le résultat de la vérification des
//     marques présentes dans SON stock (lues sur ses annonces Vinted), et l'EXTENSION
//     revérifie toute marque contre la liste entière au moment de l'envoi
//     (`marqueVcListee`, background.js).
// Aucun nombre ni donnée personnelle : seulement les taxonomies publiques des sites.
// Rien ici n'est deviné : une valeur absente de ces listes ne part jamais.

export const LISTES_LUES = Object.freeze({
  lbcMarques: 'lbc_catalogue · fdata v7 · shoe_brand_a (19 nov. 2026)',
  vcDepot: 'vc_catalogue · deposit_catalog (28 oct. 2026)',
  vcMarques: 'vc_catalogue · deposit_brands (28 oct. 2026), vérifiée pour les marques de ton stock',
});

// ── LEBONCOIN : « Marque » des chaussures (793 libellés exacts) ─────────────
export const LBC_MARQUES_CHAUSSURES = Object.freeze(('A Bathing Ape (BAPE)|Abercrombie & Fitch|Accessoires|Accessorize|AC/DC|Acne Studios|Adidas|Aerosoles|Aigle|Aigner|Airstep|Akira|Aldi|Aldo|Alex|Alexander McQueen|Allsaints|Alma en Pena|Alohas|Alpe|Alpina|Alpinestars|Amazon|Amisu|Anaki|AND1|Andre|Animal|Anna Field|Apart|A.P.C.|Apple|Ara|Arena|Ariane|Arizona|Arket|Armani|Artengo|A.S.98|Ash|Asics|ASOS|Atlas|Atmosphere|Autre|Avenue|Azzaro|Ba&sh|Babolat|Balenciaga|Bally|Balmain|Balzac Paris|Banned|Barbie|Barbour|Barker|Bata|BCBGMAXAZRIA|Belle Women|Bellissima|Belstaff|Ben Sherman|Bench|Benetton|Bensimon|Berluti|Bershka|Bestelle|Betty Barclay|Bexley|Bianca|Bianco|Bikkembergs|Bimba y Lola|Birkenstock|Bisgaard|Björn Borg|Blauer|Blend|Blink|Bloch|Blue Motion|BMW|Bobbies|Bocage|Boden|Bodyflirt|Bogner|Bonita|Bonprix|Bons Baisers de Paname|Boohoo|Bottega Veneta|B.P.C|Brax|Bronx|Brooks|Bruno Banani|Bruno Premi|Buffalo|Bugatti|Bullboxer|Bunker|Burberry|Burton|Butterfly|By Far|C&A|Cafénoir|Calvin Klein|Camel Active|Camp David|Camper|Canda|Caprice|Carel Paris|Caroll|Carrera|Carvela|Casa|Casadei|Castaner|Caterpillar|Catwalk|Cayler & Sons|Céline|Celio|Cesare Paciotti|Champion|Chanel|Charles Jourdan|Chiara Ferragni|Chie Mihara|Chiemsee|Chloé|Christian Louboutin|Church\'s|Cinque|Clae|Clarks|Claudia Ghizzani|Claudie Pierlot|Clergerie|Clockhouse|Closed|CMP|Coach|Collection|Colloseum|Colmar|Columbia|Comma|Comme des garçons|Comptoir des Cotonniers|Converse|Coolway|Coq Sportif|COS|Cosmoparis|Cox|Crane|Creeks|Crivit|Crocs|Cross|Cube|Cypres|Dainese|Damart|Daniel Hechter|D.A.T.E.|Daytona|DC Shoes|Decathlon|Deerberg|Deichmann|Demonia|Depeche|Derby|Desigual|Diadora|Diamant|Dickies|Diesel|Digel|Dior|Disney|Diverse|DKNY|Dkode|Dockers|Dogo|Dolce Vita|Dolce & Gabbana|Dolomite|Donna|Donna Carolina|Donnay|Doodogs|Dorothee Schumacher|Dorothy Perkins|Dr. Scholl\'s|Dr. Martens|Dsquared2|Dune|Dunlop|DVS|Ecco|Ed Hardy|edc|Eddie Bauer|Eden|Ego|El Naturalista|Element|Elite|Ella|Ella Cruz|Elle|Ellesse|Eltern|EMP|Emporio Armani|EMU|Engbers|Engelbert Strauss|Eram|Ernstings Family|Escada|Esmara|Espadrilles|Esprit|Etnies|Even&Odd|Evita|Fabiani|Faguo|Faith|Fantasy|Fashion Nova|Fashy|Felmini|Fendi|FILA|Find|Finsbury|Firefly|Fischer|Fitflop|Five|Flamenco|Floris van Bommel|Fly|Fly London|Footjoy|Forever 21|Fornarina|Fratelli Rossetti|Fred|Fred de la Bretoniere|Fred Perry|Freeflex|Free Lance|French Connection|Fresh|Friis & Company|Frye|Furla|Gaastra|Gabor|Gadea|Gaimo|Galliano|Ganni|GANT|Garcia|Geox|Gerry Weber|Gianmarco Lorenzi|Gianni|Gianni Gregori|Gianvito Rossi|Giesswein|Gina|Gina Benotti|Gino Rossi|Gino Ventori|Giorgio|Gios Eppo|Giuseppe Zanotti|Givenchy|Glamorous|Globe|Goby|Gola|Golden Goose|Goodyear|Graceland|Grendha|Görtz|G-Star|Gucci|Gudrun Sjöden|Guess|Haglöfs|Hailys|Haix|Hallhuber|Hanna White|Hanwag|Harley Davidson|Havaianas|Head|Heelys|Heine|Helen Billkrantz|Helly Hansen|Hermès|Hess Natur|Högl|High Colorado|Hilfiger Denim|HIP|Hippie|Hirsch|Hispanitas|Hi-Tec|HKM|H&M|Hogan|Hoka One One|Hollister|Hotic|HUB|Hudson|Hugo|Hugo Boss|Hummel|Hunkemöller|Hunter|Hush|Hush Puppies|Icepeak|Ideal|Ikks|Ilse Jacobsen|Impressionen|Inblu|Indigo|Infinity|Inuikii|Inuovo|Ipanema|IRO|Iron Fist|Irregular Choice|Isabel Marant|Isotoner|Italia|Jack|Jack & Jones|Jack Wolfskin|Jacquemus|Jana|Jane|Jane Klain|Janet D.|Janet & Janet|JB Martin|Jeffrey Campbell|Jennifer|Jennika|Jessica|Jette Joop|Jil Sander|Jimmy Choo|J.M. Weston|Joe Sanchez|John Baner|Jonak|Joop!|Jordan|Josef Seibel|Juicy Couture|Juliet|Jumelles|Jumex|Justfab|K1X|K2|Kalenji|Kamik|Kangaroos|Kanna|Kappa|Karen Millen|Karhu|Karl Kani|Karl Lagerfeld|Karrimor|Kate Spade|Kayla|Kazar|Keds|Keen|Kempa|Kennel & Schmenger|Kenneth Cole|Kenzo|Kiabi|Kickers|Killah|Killstar|Kiomi|Kipsta|Klett|KMB|Konstantin Starke|K-Swiss|Kurt Geiger|L.A. Gear|La Martina|La Sportiva|La Strada|Lacoste|Lands\' End|Lanvin|Lascana|Lasocki|L\'atelier Tropezien|Laura|Laura Biagiotti|Laura Vita|Laurel|Lavorazione Artigiana|Le Coq Sportif|Lemaitre|Les Tropéziennes|Le Temps Des Cerises|Levi\'s|Lico|Lidl|Liebeskind|Linea|Liu Jo|Livergy|LK Bennett|Lloyd|Lodi|Loding|Lola|Lola Cruz|Lolita|Look|Lorenzo|Louis Vuitton|Lowa|Lurchi|Madeleine|Magnum|Maison Martin Margiela|Maje|Mammut|Manas|Manfield|Mango|Manguun|Manolo Blahnik|Marc Cain|Marc O´Polo|Marc Jacobs|Marco Tozzi|Maripe|Mark Adam|Marni|Massimo Dutti|Max|Max Mara|Mckinley|MCM|Meindl|Melissa|Mellow Yellow|Melrose|Melvin & Hamilton|Menbur|Mephisto|Merrell|Mexx|Michael Kors|Milano|Millet|Minelli|Minnetonka|Mint&Berry|Miss Sixty|Missoni|Miu Miu|Mizuno|Mjus|Méliné|Moda|Mode|Moncler|Monki|Monoprix|Moon|Moon Boot|More&More|Moschino|Musier|Mustang|NA-KD|Napapijri|Natura|Natural World|Naturalizer|Navy|Navyboot|Nebulus|Neosens|Nero Giardini|Never 2 Hot|New Look|New Rock|New Yorker|New Balance|Newfeel|Next|Nike|Nina|Nina Fiarucci|Nine West|Nitro|Northwave|Nubikk|Oasis|Office|O\'Neill|Only|Original Vintage|Orsay|Otto|Otto Kern|Ovyé|Oxford|Oxitaly|Oxypas|Oysho|P448|Pablo|Palladium|Panama Jack|Paraboot|Parfois|Pataugas|Patrick|Paul Green|Paul Smith|Pedro Miralles|Pepe Jeans|Perlato|Peter Hahn|Peter Kaiser|Petrol|Philippe Model|Philipp Plein|Pieces|Pier One|Pierre Cardin|Pikolinos|Pimkie|Pleaser|Poelman|Pollini|Pons Quintana|Prada|Premium|Pretty Ballerinas|Primark|Pro Touch|Progetto|Project|Promod|Public Desire|Pull & Bear|Puma|Pura Lopez|Quechua|Queentina|Quicksilver|Raid|Ralph Lauren|RAS|RAW|Rebel|Red Wing|Redskins|Reebok|Reef|Refresh|Regatta|Remonte|Rene Lezard|Repetto|Replay|Reserved|Reusch|Richmond|Richter|Rick Owens|Ricosta|Rieker|River Island|Roberto Cavalli|Rocket Dog|Rockport|Roger Vivier|Rohde|Roland|Romika|Rossignol|Rouje|Route 66|Roxy|Ruby|Rundholz|Rylko|Sacha|Salamander|Salewa|Salomon|Salvatore Ferragamo|Sam|Sandro|San Marina|Santoni|Saucony|Scapa|Scholl|Scotch & Soda|Scott|Sebago|See by Chloé|Selected|Sendra|Sergio Todzi|Sergio Rossi|Sezane|Sheego|Shimano|Sixtyseven|Skechers|Sketchers|Slazenger|Snipes|Snoopy|Soccx|S.Oliver|Sorel|Sparco|Stella Mccartney|Stephane Kélian|Steve Madden|Stradivarius|Street|Street One|Strellson|Strenesse|Stuart Weitzman|Style|Super Mode|Superdry|Superfit|Superga|Superstar|Supra|Supreme|Swarovski|Tally Weijl|Tamaris|Taylor|Tbs|Tchibo|Tchibo TCM|Tecnica|Ted Baker|Teva|Tex|The Art Company|The North Face|The Kooples|Think!|Tiger|Timberland|Tod\'s|Tom Tailor|Tom Ford|Tommy Hilfiger|Toms|Toni Pons|Topshop|Tory Burch|Tosca Blu|Trippen|True Religion|Truffle|Trussardi|TUK|Tulipano|Ugg|Ulla Popken|Umbro|Uncle Sam|Under Armour|Undercover|Underground|Unikat|Unisa|United Nude|Unützer|Urban Classics|U.S. Polo Assn.|Uterque|Uvex|Vagabond|Valentino|Valentino Garavani|Valleverde|Vanessa Bruno|Vanessa Wu|Vans|Vanucci|Varese|Vaude|Veja|Venezia|Venice Beach|Venturini|Vera Gomma|Vera Pelle|Vero Cuoio|Vero Moda|Versace|Via|Via Milano|Via Uno|Vibram|Vic Matié|Victoria|Victoria Delef|Victory|Viking|Viktory|Vince|Vince Camuto|Vitaform|Viva|Vivobarefoot|Voltan|VTY|Walbusch|Waldläufer|Walkmaxx|Walter Steiger|Waschbär|Werner Kern|Weston|Wilson|Windsor|Wolky|Wonders|Woody|Woolrich|Wrangler|Y-3|Yeezy|Yellow Cab|Yessica|Yonex|Young Spirit|Yourturn|Yves Saint Laurent|Zadig & Voltaire|Zalando|Zanon & Zago|Zara|Zebra|Zign|Zinda|Zumba').split('|'));

// ── VESTIAIRE : LE CATALOGUE DE DÉPÔT COMPLET (univers › catégorie › sous-catégories) ──
// Libellés exacts (y compris « Robes » suivi d'une espace chez « Mode fille », tel que servi).
const L = (s) => Object.freeze(s.split('|'));
export const VC_DEPOT = Object.freeze({
  'Mode femme': Object.freeze({
    'Accessoires': L('Carrés|Ceintures|Chapeaux|Foulards|Gants|Lunettes|Montres|Petite maroquinerie|Portefeuilles'),
    'Bijoux': L('Bagues|Bijoux de portable|Bijoux de sac|Bijoux de tête|Boucles d\'oreilles|Bracelets|Broches|Colliers|Parures|Pendentifs|Sautoirs'),
    'Chaussures': L('Ballerines|Baskets|Boots|Bottes|Derbies|Escarpins|Espadrilles|Mocassins|Sabots|Sandales'),
    'Sacs': L('Pochettes|Sacs à dos|Sacs à main|Sacs de voyage'),
    'Vêtements': L('Bain|Blousons|Combinaisons|Jeans|Jupes|Lingerie|Manteaux|Pantalons|Pulls & Gilets|Robes|Shorts|Tops|Trenchs|Vestes'),
  }),
  'Mode fille': Object.freeze({
    'Accessoires': L('Bijoux|Ceintures & Bretelles|Chapeaux, Bonnets & Gants|Foulards & Echarpes|Lunettes|Sacs & Trousses'),
    'Chaussures': L('A lacets|Ballerines|Baskets|Bottes & Bottines|Chaussons|Mocassins|Premiers pas|Sandales'),
    'Vêtements': L('Blousons & Manteaux|Jupes|Les ensembles|Pantalons|Pulls & Gilets|Pyjamas, Bodies|Robes |Shorts|Tops'),
  }),
  'Mode garçon': Object.freeze({
    'Accessoires': L('Bijoux|Ceintures & Bretelles|Chapeaux, Bonnets & Gants|Foulards & Echarpes|Lunettes|Sacs & Trousses'),
    'Chaussures': L('A lacets|Ballerines|Baskets|Bottes & Bottines|Chaussons|Mocassins|Premiers pas|Sandales'),
    'Vêtements': L('Blousons & Manteaux|Les ensembles|Pantalons|Pulls & Gilets|Pyjamas, Bodies|Shorts|Tops'),
  }),
  'Mode homme': Object.freeze({
    'Accessoires': L('Bijoux|Boutons de manchette|Ceintures|Chapeaux & Bonnets|Chèches & Echarpes|Cravates|Gants|Lunettes|Montres'),
    'Chaussures': L('Baskets|Bottes & Boots|Derbies|Espadrilles|Mocassins|Sandales'),
    'Sacs': L('Petite maroquinerie|Sacs|Sacs banane'),
    'Vêtements': L('Bain|Chemises|Costumes|Jeans|Manteaux|Pantalons|Polos|Pulls, Gilets & Sweats|Shorts|Tee shirts|Vestes & Blousons'),
  }),
});

// ── VESTIAIRE : LES MARQUES DE SON STOCK, VÉRIFIÉES DANS LA LISTE DU SITE ──
// `presentes` : le libellé EXACT de Vestiaire (non « banned ») ; `absentes` : le nom tel que
// Vinted l'écrit, introuvable dans la liste de Vestiaire (aucune n'y est « banned »).
// Une marque qui n'est dans aucune des deux : l'extension la cherche dans la liste entière.
export const VC_MARQUES_RELEVEES = Object.freeze({
  presentes: L('Adidas|Asics|Autry|Brooks|Crime London|Dr. Martens|JORDAN|LUMBERJACK|Mizuno|New Balance|Nike|Nike x Nocta|Nike x Travis Scott|Onitsuka Tiger|Paraboot|Philippe Model|Puma|Salomon|Saucony|Timberland'),
  absentes: L('Nike SB|On Cloud|no marque|Nike x sacai x UNDERCOVER|Nike x Sacai|Nike x Patta|Nike x Sacai x Fragment Design|J.M. Weston|adidas Stan Smith'),
});
