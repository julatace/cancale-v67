# 11 novembre 2026 — Relecture indépendante : connexions-oauth et suppression-oauth

Branches relues : `claude/connexions-oauth` (A), `claude/suppression-oauth` (B).
Corrections : `claude/relecture-suppression-oauth` (partie de B) et `claude/relecture-oauth`
(partie de A, B fusionnée dedans, conflits résolus). Aucune PR, aucune fusion sur `main`,
aucune écriture en base (journaux d'auth lus seulement).

## Défauts trouvés et corrigés
1. **Deux connexions lancées en parallèle (deux onglets)** — A, moyen. Le retour de la
   première effaçait de l'appareil TOUS les vérificateurs ; la seconde, revenue dans une
   autre fenêtre (app installée, nouvel onglet du téléphone), échouait (« a commencé sur un
   autre appareil »). Désormais `prendreEssais` lit sans effacer, `oterEssai` efface CE
   vérificateur et CETTE tentative (réussie ou morte) ; les autres expirent en 10 min.
   Preuve : `scripts/tests/pkce-deux-onglets.test.mjs` rouge en remettant l'effacement
   d'avant (mutation), vert après ; audit K1 et `connexion-session` suivent la règle.
2. **« Délier » la seule liaison conseillait « ajoute d'abord un mot de passe »** — A, faible.
   Supabase compte les IDENTITÉS (`single_identity_not_deletable`) ; un mot de passe n'en
   ajoute aucune : le conseil menait au même refus. ⇒ « Relie d'abord Discord/Google, puis
   délie … ». Même test, rouge avant.
3. **`connexion-session.test.mjs` rouge sur B** (le bac à sable ignorait `lireReconnexion`,
   `reconnexionPermise`, `lireIntentionOAuth`). Test seul, pas l'app.
4. **A et B se contredisent à la fusion** (App.jsx ×6, Reglages.jsx, CLAUDE.md, historique).
   Résolu sur `claude/relecture-oauth` : la reconnexion garde SON identifiant de tentative
   (`RETOUR_RECONNEXION&vrm_essai=…`) ; refus d'un autre compte AVANT `writeSession` ;
   reconnexion jamais « compte neuf » ni « relié automatiquement » ; tout refus pendant une
   reconnexion rouvre « Supprimer mon compte » ; « fermer » ouvert sous Compte ;
   `audit-suppression-oauth` S5 lit la phrase dans `src/auth/erreursOAuth.js`.
   CLAUDE.md remis sous 60 Ko (5 lignes du §9 déplacées telles quelles).

## Observé, non corrigé
- Extension : « Continuer avec … » sur un compte créé par une INSCRIPTION Discord/Google
  il y a moins de 2 min et encore vide est annulé (même règle que l'app, DJ6). Le serveur
  exige un compte vide : rien n'est perdu, mais le compte voulu disparaît. Rare.
- Supabase : `?vrm_essai=` dans l'adresse de retour suppose Site URL `https://vrm.center`
  ou `https://vrm.center/**` dans les Redirect URLs (geste déjà listé) ; sinon retour sur la
  Site URL, et le repli « sans identifiant » marche (banc P14).
- Bancs `discord-compte` et `connexions-reglages` rouges aussi sur `main` (périmés) ;
  `agenda-appareil` G 1512-sombre : aléa de timing du banc (vert au 2e passage, comme `main`).
