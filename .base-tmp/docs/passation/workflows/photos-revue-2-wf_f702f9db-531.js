export const meta = {
  name: 'photos-revue-2',
  description: 'Second tour adverse sur le correctif photos Vinted (74eec0e, fusionné en c7efee0) : trois lentilles qui reproduisent, deux sceptiques par défaut, puis correction prouvée',
  phases: [
    { title: 'Relire', detail: 'trois lentilles, chaque défaut reproduit au rendu ou dans un vm' },
    { title: 'Réfuter', detail: 'deux sceptiques indépendants par défaut' },
    { title: 'Corriger', detail: 'worktree photos-r2 depuis c7efee0, rouge avant / vert après / rouge sous mutation' },
  ],
}

const CONTEXTE = `Contexte : VRM, dépôt /home/user/cancale-v67. La branche d'intégration est le worktree /home/user/cancale-v67/.claude/worktrees/integ-11oct, commit c7efee0 (NE PAS y écrire : un autre processus y lance build et bancs en ce moment).
Julien (11 octobre) : « quand je suis dans VRM, je n'ai plus les photos des paires de chaussures, plus les photos de mes annonces, ni dans les bordereaux, ni dans les ventes ». Les données sont intactes (photo.url = https://images1.vinted.net/t/…/f800/….jpeg?s=…) ; la cause dans SON navigateur n'est pas mesurée (CORP, anti-hotlink sur le référent, protection locale ou réseau).
Le correctif à relire : c02ffcf (construction) puis 74eec0e (onze défauts de revue corrigés), fusionnés dans c7efee0. Il a posé : src/photosVinted.js (règle, cache LRU 300, file de 3, témoin de nouvel essai 20 s → 5 min, sonde de cause à deux erreurs espacées, décision de la phrase), le composant PhotoVinted dans src/App.jsx (49 <img> remplacées, referrerPolicy no-referrer, secours par le pont extension vmrPhoto/vmrPhotoIssue → Blob URL), app_data.diag_photos (bilan sans URL), la phrase unique PhotosBloquees (data-photos-bloquees, sans couleur, sous l'île sur ordinateur), scripts/audit-photos-vinted.cjs, scripts/bancs/photos-vinted.cjs (vrai serveur HTTPS local sous images1.vinted.net, ports 5741/5742). La section « JE N'AI PLUS LES PHOTOS DE MES PAIRES » de CLAUDE.md dit ce qui a été fait et ce qui n'est PAS mesuré.

MÉTHODE OBLIGATOIRE :
- Travaille dans TA copie : D=/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/photos-r2/<ton-label> ; mkdir -p $D && cd /home/user/cancale-v67 && git archive c7efee0 | tar -x -C $D ; ln -s /home/user/cancale-v67/node_modules $D/node_modules ; cd $D && npm run build. Pour comparer à l'avant, une autre copie depuis 219150e (avant le chantier) ou c02ffcf.
- CHANGE LES PORTS dans tes copies des bancs (sed sur PORT/PORT_CDN, ex. 59xx propre à toi) : d'autres bancs tournent en même temps sur 5741/5742. Chromium : /opt/pw-browsers/chromium-1194/chrome-linux/chrome (--use-angle=swiftshader --no-sandbox). La machine est chargée : un banc chronométré qui rate une fois se relance SEUL avant de conclure.
- Un défaut ne compte que s'il est REPRODUIT (rendu Playwright avec un vrai serveur HTTPS local comme le banc, ou exécution de la vraie règle dans un vm), avec le scénario exact et ce qui est observé vs attendu. Données inventées uniquement ; aucun appel au vrai CDN Vinted, à la base de production, à Vinted/eBay/Leboncoin.
- Pas d'avis de style, pas de « on pourrait ». Seulement ce qui fait voir à Julien une photo fausse, une absence de photo évitable, une phrase fausse ou inutile, une charge excessive, une régression d'un écran, une fuite de données (URL signée, titre) dans diag_photos, ou un écart aux règles de CLAUDE.md (§4.6 TDZ, §7 une cause une phrase, §11, « pas su ne vaut pas oui », trois états).
- Rends au plus 8 défauts, les plus graves d'abord ; zéro est une réponse valable.`

const DEFAUTS = {
  type: 'object',
  properties: {
    defauts: { type: 'array', items: { type: 'object', properties: {
      titre: { type: 'string' }, gravite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
      scenario: { type: 'string' }, observe: { type: 'string' }, attendu: { type: 'string' },
      preuve: { type: 'string', description: 'commande/fichier de reproduction et sortie' },
      fichiers: { type: 'string' } }, required: ['titre', 'gravite', 'scenario', 'observe', 'attendu', 'preuve'] } },
    notes: { type: 'string' },
  },
  required: ['defauts'],
}
const VERDICT = { type: 'object', properties: { refute: { type: 'boolean' }, raison: { type: 'string' }, reproduit: { type: 'boolean' } }, required: ['refute', 'raison', 'reproduit'] }

const LENTILLES = [
  { k: 'ecrans', p: `LENTILLE : les écrans et la justesse. Rends chaque écran qui affiche une photo Vinted (Annonces, Ventes, Achats, Colis/bordereaux, Ma journée, Messagerie, Garage, saisie des prix, eBay, recherche, passeport, sélecteurs) aux deux tailles, CDN qui marche ET CDN qui refuse, avec et sans pont extension simulé (rejoue le vrai dialogue du pont comme le banc). Cherche : une photo qui disparaît alors qu'elle s'affichait avant 219150e ; une mauvaise photo (cache par URL mal clé, Blob d'une autre photo, URL objet révoquée encore affichée) ; onError appelé à tort ou jamais (imgMortes/noterImgMorte) ; un écran qui tombe (TDZ, React #31) ; un débordement à 390 px ; un SVG/une adresse non Vinted passée au secours ; la mémoire (URL objet jamais révoquées en naviguant longtemps).` },
  { k: 'phrase', p: `LENTILLE : la phrase et la mesure. La phrase PhotosBloquees et diag_photos doivent dire VRAI dans tous les états. Rejoue : PWA qui se réveille (réseau coupé puis revenu), CDN qui revient, téléphone (isMobile+hasTouch, pas de secours possible), extension muette, deux extensions, extension présente mais pont refusé, extension lente (> 30 s), quelques liens morts au milieu de photos qui marchent, onglet caché, changement d'écran rapide. Cherche : une phrase qui affirme une cause non mesurée, qui dit « recharge » quand recharger ne change rien, qui se répète (§7) ou double une voix existante (bandeau extension), qui scintille, qui reste après que les photos sont revenues ; un diag_photos écrit sur une lecture ratée, trop souvent, avec une URL/signature/titre, ou qui écrase le bilan d'un autre navigateur.` },
  { k: 'charge', p: `LENTILLE : la charge et les garde-fous. Mesure ce que le correctif envoie : au CDN (témoin de nouvel essai, toutes les photos qui réessaient quand une revient, online), au pont de l'extension (vmrPhoto : file de 3, plafond 30 s, ce qui arrive avec 300+ annonces qui défilent, deux extensions qui répondent), à Supabase (diag_photos : fréquence, relecture). Lis vinted-sync-extension/background.js côté photoBytes/photo du pont (sans le modifier) : le secours respecte-t-il la pause « Vinted demande de ralentir » (vrmPauseVinted) et la file requeteVinted ? Une rafale de lectures du CDN par le service worker peut-elle déclencher un frein Vinted ou concurrencer les actions (§3) ? Cherche aussi les fuites de timers/observers (IntersectionObserver jamais déconnecté, témoin qui tourne onglet caché).` },
]

phase('Relire')
const resultats = await pipeline(
  LENTILLES,
  (l) => agent(`${CONTEXTE}\n\n${l.p}`, { label: `relire:${l.k}`, phase: 'Relire', schema: DEFAUTS }),
  (r, l) => parallel((r && r.defauts || []).map((d, i) => () =>
    parallel([0, 1].map(j => () => agent(`${CONTEXTE}\n\nUn relecteur affirme ce défaut du correctif photos. Ton rôle : le RÉFUTER si tu peux. Reproduis-le toi-même dans TA copie (label refuter-${l.k}-${i}-${j}), avec les mêmes règles. Refute=true si tu ne le reproduis pas, si ce n'est pas un défaut au sens de CLAUDE.md, si c'est du style, ou si le comportement était identique avant le chantier (219150e) ET sans rapport avec la plainte. En cas de doute, refute=true.\n\nDÉFAUT : ${JSON.stringify(d)}`,
      { label: `refuter:${l.k}:${i}:${j}`, phase: 'Réfuter', schema: VERDICT })))
      .then(vs => ({ ...d, lentille: l.k, votes: vs.filter(Boolean), survit: vs.filter(Boolean).filter(v => !v.refute && v.reproduit).length >= 1 && vs.filter(Boolean).filter(v => v.refute).length < 2 }))))
)
const tous = resultats.filter(Boolean).flat().filter(Boolean)
const confirmes = tous.filter(d => d.survit)
log(`${tous.length} défauts rapportés, ${confirmes.length} survivent à la réfutation`)
if (!confirmes.length) return { confirmes: [], rejetes: tous.map(d => ({ titre: d.titre, votes: d.votes })) }

phase('Corriger')
const fix = await agent(`${CONTEXTE}\n\nCORRIGE ces défauts confirmés (chacun reproduit par un relecteur et non réfuté par deux sceptiques) :\n${JSON.stringify(confirmes.map(({votes, survit, ...d}) => d), null, 1)}\n\nOÙ : crée un worktree git dédié : cd /home/user/cancale-v67 && git worktree add /home/user/cancale-v67/.claude/worktrees/photos-r2 -b photos-r2 c7efee0 ; travaille et commite LÀ (jamais dans integ-11oct, ne pousse rien). node_modules : lien symbolique vers /home/user/cancale-v67/node_modules (ignoré par git). Ports des bancs : utilise 59xx dans tes lancements (variable ou copie), d'autres bancs tournent sur 5741/5742.\nPREUVES (§6) : pour chaque défaut, un contrôle ajouté à scripts/bancs/photos-vinted.cjs ou scripts/audit-photos-vinted.cjs qui est ROUGE sur c7efee0 (copie git archive, lancé depuis cette copie), vert après, et rouge sous une mutation qui réaffaiblit TA correction. npm run build ; tous les scripts/audit-*.cjs à 0 (sauf audit-renum-b, migration inchangée) ; bancs voisins un par un (annonces-carte, ventes-bordereau, messagerie, premierjour, statuts-colis, enligne). Mets à jour la section photos de CLAUDE.md (ce qui change, les preuves chiffrées). L'extension ne change PAS dans ce chantier : si un défaut exige une modification de vinted-sync-extension/, ne la fais pas, décris-la précisément dans nonFait.\nSi un défaut te paraît finalement faux en le reproduisant, ne le corrige pas et dis pourquoi.`,
  { label: 'corriger', phase: 'Corriger', schema: { type: 'object', properties: {
    worktree: { type: 'string' }, commit: { type: 'string' }, fait: { type: 'string' }, preuves: { type: 'string' }, nonFait: { type: 'string' } }, required: ['commit', 'fait', 'preuves', 'nonFait'] } })
return { confirmes: confirmes.map(({votes, ...d}) => d), rejetes: tous.filter(d => !d.survit).map(d => ({ titre: d.titre, votes: d.votes })), fix }
