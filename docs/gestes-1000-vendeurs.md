# Tenir 1 000 vendeurs — les gestes de Julien, dans l'ordre (8 nov. 2026)

Prix lus sur les pages officielles le 8 nov. quand le réseau l'a permis ; « à vérifier » sinon. Hors taxes.

1. **`public/legal/editeur.js` + `src/contact.js`** — remplir les 10 champs et l'adresse de contact (Cursor/GitHub → fichier → Modifier). Sans eux personne ne peut payer. **0 €**.
2. **Stripe en mode réel** — dashboard.stripe.com → Produits → prix `vrm_mensuel` à 16,99 € ; Paramètres → Détails publics → adresse des CGV ; Développeurs → clés → `STRIPE_SECRET_KEY` sur Vercel. **0 €/mois**, ~1,5 % + 0,25 € par paiement carte UE (à vérifier).
3. **Migrations 026 puis 027** — supabase.com → projet → SQL Editor, une instruction à la fois (`supabase/migrations/026-charge-ebay-et-id.sql`, `027-abonnement-apercu-et-parrainage.sql`). **0 €**.
4. **Supabase Pro** — supabase.com → Organization → Billing → Upgrade to Pro (connexions, égress, sauvegardes quotidiennes). **25 $/mois** + calcul au-delà du crédit inclus (à vérifier : la page n'a pas pu être lue en clair).
5. **Vercel Pro** — vercel.com → Team → Settings → Billing → Upgrade (fonctions plus longues, plus de 2 crons, plus de 12 fonctions). **20 $/mois par siège** (lu sur vercel.com/pricing).
6. **Domaine d'envoi `vrm.center` (SPF, DKIM, DMARC)** — Brevo → Senders & Domains → Add domain → copier les 3 enregistrements DNS chez le registrar de vrm.center. **0 €** (le domaine est déjà payé).
7. **Fournisseur d'e-mails Brevo** — brevo.com → SMTP & API → clé SMTP ; sur Vercel `RELANCES_SMTP_HOTE` `smtp-relay.brevo.com`, `RELANCES_SMTP_PORT` 587, `RELANCES_SMTP_UTILISATEUR`, `RELANCES_SMTP_MOT_DE_PASSE`, `RELANCES_EXPEDITEUR`. **Gratuit jusqu'à 300 e-mails/jour** (lu sur brevo.com) ; au-delà (1 000 bilans du mois le 1er), offre Starter **dès 9 $/mois**, sans plafond par jour (lu sur brevo.com) — poser alors `VRM_EMAILS_PAR_JOUR`.
8. **Supabase → SMTP personnalisé** — Authentication → Emails → SMTP Settings : les mêmes identifiants Brevo (sinon les e-mails de connexion de Supabase sont limités à quelques par heure). **0 €** de plus.
9. **Migration 016 (mode équipe)** — un soir calme : SQL Editor, puis `node scripts/equipe-sql/essai-annule.cjs --verifier`. **0 €**.
10. **Comptes boutiques d'extension** — Chrome Web Store (developer.chrome.com → Register, **5 $ une fois**, lu sur developer.chrome.com), Edge Add-ons, Firefox AMO et Opera (**0 €**, à vérifier) ; le pas-à-pas : `docs/boutiques-extension.md`.

**Total mensuel fixe à 1 000 vendeurs ≈ 45 $ (Supabase Pro + Vercel Pro) + 9 $ si Brevo Starter**, plus les frais Stripe par paiement.
