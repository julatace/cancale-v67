# RESELL AI — Assistant de revente (assistance humaine, jamais d'automatisation)

Assistant IA pour vendeurs d'occasion (type Vinted) : **aide à la décision**,
**suggestions de réponses**, **optimisation de prix**, **amélioration d'annonces**.

> ⚠️ **Principe non négociable — assistance seule.**
> Ce système **n'agit jamais** sur une plateforme externe : il ne poste rien,
> n'envoie aucun message, ne republie rien. Il **propose**, l'humain **valide et
> exécute lui-même**. Pas d'auto-reply, pas d'auto-post, pas de tâche planifiée
> qui agit à ta place. Chaque sortie est déclenchée par un clic de l'utilisateur.

## Architecture

```
resell-ai/
├─ core/
│  ├─ scoring-system/        Note d'annonce 0–100 (calcul déterministe)
│  └─ decision-engine/       Décide : améliorer / baisser le prix / ne rien faire
├─ services/
│  ├─ messaging/             Analyse d'un message acheteur → intention + réponses
│  ├─ pricing/               Prix recommandé + raisonnement + urgence
│  ├─ visibility/            Amélioration titre + description (+ mots-clés)
│  ├─ market-intelligence/   Demande / fourchette de prix / tendance (simulé)
│  └─ api/                   API Express qui expose tout (+ Prisma optionnel)
├─ apps/
│  ├─ extension/             Extension Chrome ASSISTIVE (panneau sur la page)
│  └─ dashboard/             Tableau de bord React (perf + suggestions)
├─ data/prisma/              Schéma Prisma (PostgreSQL)
├─ scripts/                  Seed de démo
├─ docker-compose.yml        PostgreSQL local
├─ .env.example
└─ package.json              Workspaces + scripts
```

**Séparation des responsabilités** : les *moteurs* (`core/`, `services/*` hors
api) sont des fonctions pures TypeScript, **sans I/O**, testables isolément. L'API
ne fait que les câbler + persister. L'extension et le dashboard ne font que
présenter les suggestions — jamais d'action externe.

## Démarrage

```bash
cd resell-ai
cp .env.example .env               # renseigne DATABASE_URL et (optionnel) ANTHROPIC_API_KEY
npm install
docker compose up -d               # PostgreSQL local (optionnel : sans base, l'API marche en mémoire)
npm run prisma:push                # crée les tables
npm run seed                       # données de démo
npm run dev                        # lance l'API (http://localhost:8787)
npm run dashboard                  # lance le dashboard (http://localhost:5177)
```

L'**IA** (réponses/rédaction en langage naturel) est **optionnelle** : sans
`ANTHROPIC_API_KEY`, tout fonctionne avec la logique déterministe (les suggestions
de réponses passent alors par des gabarits variés au lieu du LLM). Avec la clé,
les réponses sont générées par Claude (modèle Haiku par défaut, `AI_MODEL`).

## Extension (assistive)

`apps/extension/` se charge en mode développeur (`chrome://extensions` → « Charger
l'extension non empaquetée »). Elle détecte un champ de message sur la page,
affiche un petit panneau avec **réponses suggérées** + **conseil de prix**, et tu
**cliques pour insérer** — jamais d'envoi automatique. Elle appelle l'API locale
(`API_BASE`, `http://localhost:8787` par défaut).

## Endpoints API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/messaging/analyze` | message acheteur → `{intent, confidence, suggestions[]}` |
| POST | `/pricing/recommend` | métriques → `{recommendedPrice, reasoning, urgency}` |
| POST | `/listing/improve` | annonce → `{title, description, keywords[]}` |
| POST | `/decision` | métriques → `{action, reason}` |
| GET  | `/market/:brand` | insight marché simulé |
| GET  | `/items` | items + métriques + dernière suggestion (dashboard) |

Tout est **idempotent et sans effet de bord externe**.
