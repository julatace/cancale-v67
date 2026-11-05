# 5 nov. — Le récapitulatif au réveil (heures calmes)

**Demande** (amélioration proposée le 5 nov., « vasy fait tout ») : pendant les heures
calmes, une notification était rangée dans la cloche (`etat: 'calme'`) et ne sonnait
JAMAIS ensuite. Avec les heures calmes 22 h → 8 h, même le rappel du matin
(cron de 5 h UTC) restait muet.

**Ce qui est fait**
- `api/_lib/reveil-calme.js` (`resumeReveil`) : à la fin des heures calmes (fenêtre de
  3 h), UNE notification « Pendant tes heures calmes : N notifications » —
  « 2 ventes · 1 offre · 2 colis à poster » — qui ouvre la cloche (`?cloche=1`).
  Seules les entrées `calme` des dernières 24 h, NON LUES ; zéro ⇒ rien ; ce qu'il a
  lu illisible ⇒ rien (« pas su »). Une fois par jour (`push_reveil`, mémo écrit AVANT
  l'envoi ; mémo pas écrit ⇒ rien ne part).
- `api/ship-reminders.js?moment=reveil` : passe par vendeur (son contexte), rien
  d'autre (ni rappels, ni bilan, ni e-mails de l'essai). Pas de nouvelle fonction `api/`.
- Le déclencheur : le plan gratuit de Vercel ne lance un cron qu'une fois par jour ⇒
  `.github/workflows/reveil-notifs.yml` appelle la route à :07 et :37, de 3 h à 11 h UTC.
  **Sans le secret `CRON_SECRET` dans GitHub, rien n'est appelé** (le journal le dit).
- App : `?cloche=1` ouvre la cloche (événement `vrm:centre-notifs` si elle est montée,
  sinon `sessionStorage.vrm_ouvrir_cloche` lu à son montage).

**Preuves** : `scripts/audit-reveil-calme.cjs` exécute la règle et la vraie route
(fausse base à la vraie forme) — 13 verts ; `--muter` (mémo du jour ignoré) 2 rouges.
Voisins verts : relances-essai, notifications, notifs-centre, fonctions-api.

**Geste de Julien** : GitHub → le dépôt → Settings → Secrets and variables → Actions →
« New repository secret » `CRON_SECRET` = la même valeur que la variable `CRON_SECRET`
de Vercel. Puis Actions → « Récapitulatif au réveil » → Run workflow pour l'essayer.
