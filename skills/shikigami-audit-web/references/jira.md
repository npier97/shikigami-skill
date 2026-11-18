# Envoi du plan d'action dans Jira (facultatif)

À la fin d'un premier audit ou d'une relance, proposer d'envoyer les chantiers du plan d'action dans le Jira du client. C'est **facultatif** : si l'utilisateur refuse, ou si aucune connexion Jira n'est disponible, l'audit est terminé quand même.

Créer un ticket publie du contenu chez le client : **rien n'est créé, modifié, commenté ou déplacé dans Jira sans un « oui » explicite de l'utilisateur dans la conversation**, après qu'il a vu l'aperçu. Un accord vaut pour le lot montré, pas pour les suivants.

## 1. Trouver la connexion Jira

1. Chercher les outils Jira de la session : `ToolSearch` avec les mots-clés `jira`, `atlassian`, puis charger ceux qui permettent de lister les projets, lire les types de tickets et leurs champs, créer un ticket, lier deux tickets, lire les transitions, commenter, modifier un ticket. Les noms exacts dépendent du serveur MCP (connecteur Atlassian officiel ou autre) : ne pas les supposer.
2. Aucun outil Jira : le dire en une phrase et proposer deux voies :
   - connecter Jira (connecteur Atlassian, via les connecteurs de l'application ; s'ils sont disponibles, `mcp__mcp-registry__suggest_connectors`), puis relancer cette étape ;
   - ou produire seulement l'aperçu Markdown (`.audit-web/jira-apercu.md`), prêt à copier dans Jira à la main.
3. Ne jamais appeler l'API Jira par un script, curl ou un jeton de l'utilisateur : uniquement via les outils MCP.

## 2. Configurer (une fois par client)

Lire `config.jira` s'il existe. Sinon, récupérer ce qui se lit dans Jira (projets visibles, types de tickets du projet, champs disponibles, composants), puis poser **au plus 3 questions** avec `AskUserQuestion` :

1. Quel projet (clé) reçoit les tickets ?
2. Regrouper les tickets sous un Epic « Audit web <produit> » (recommandé) ou sous un Epic existant ?
3. Quelle liste d'étiquettes est autorisée, et quel lien vers la Definition of Done de l'équipe ? (proposer par défaut : `audit-web`, `opquast`, `accessibilite`, `securite`, `seo`, `performance`, `contenu`, `legal`)

Le reste se suppose et se note dans la section « Hypothèses » des tickets. Enregistrer les réponses dans `config.jira` (voir `schema.md`) : à la relance, on ne repose pas ces questions.

Vérifier dans les métadonnées du projet quels types existent vraiment (certains projets n'ont ni Spike ni Sous-tâche, l'Epic peut s'appeler autrement, les points d'estimation sont un champ personnalisé). Si un type manque, utiliser le plus proche (Spike → Task avec l'étiquette `spike`) et le dire dans l'aperçu.

## 3. Choisir le type de chaque ticket

Un chantier du plan donne en général un ticket. Choisir le type **avant** d'écrire :

| Type | Quand | Exemples tirés d'un audit |
|---|---|---|
| **Epic** | objectif qui couvre plusieurs sprints | l'Epic « Audit web » qui regroupe tout ; un chantier trop gros pour un sprint |
| **Story** | tranche de valeur utilisateur démontrable, 1 à 5 jours | ajouter une page de mentions légales ; transcription de la vidéo ; page 404 personnalisée ; bouton afficher le mot de passe |
| **Task** | travail technique sans valeur directe visible, ≤ 3 jours | activer HSTS ; appliquer la CSP ; enregistrement DMARC ; charset dans Content-Type ; styles d'impression |
| **Bug** | comportement qui s'écarte de ce qui est attendu (norme, spec, comportement documenté) | le site répond en HTTP sans rediriger ; une URL inconnue renvoie 200 ; le focus clavier disparaît ; l'erreur n'est pas annoncée au lecteur d'écran |
| **Spike** | recherche limitée dans le temps qui aboutit à une décision | indexer ou non les pages marketing ; choisir l'outil de lettre d'information |
| **Sous-tâche** | découpage facultatif à l'intérieur d'une Story | une sous-tâche par langue pour la transcription |

- Chantier trop gros pour un sprint : en faire un Epic et proposer un **découpage vertical** (tranches de bout en bout qui livrent chacune quelque chose de testable), jamais « ticket back / ticket front ».
- **Un ticket = un problème qu'on peut corriger, tester et livrer seul.** La taille ne suffit pas : une demande qui regroupe des défauts indépendants (contraste d'un badge, erreurs de formulaire, symboles lus au lecteur d'écran, style des liens) donne un ticket par défaut ou par zone, même si l'ensemble tiendrait dans un sprint. Pourquoi : un ticket fourre-tout ne se ferme que quand tout est fini, se teste mal en QA, mélange des Bugs (écart à une norme) et des Stories (nouvelle valeur), et ne se relie pas proprement aux règles de l'audit lors des relances. Regrouper ces tickets sous un Epic (ou l'Epic de l'audit) quand ils sont trois ou plus.
- **Quand l'utilisateur demande « un seul ticket »** pour des problèmes indépendants : proposer quand même le découpage en expliquant pourquoi en une phrase, et offrir l'alternative (un ticket unique) comme option dans la question finale. L'aperçu montre le découpage recommandé ; on ne crée la version fusionnée que si l'utilisateur la redemande après avoir vu l'explication.
- Les règles déjà conformes citées dans une demande ne donnent pas de travail : les mentionner comme critères de non-régression dans les tickets concernés, pas comme tickets.
- Un chantier qui mélange plusieurs types (une config serveur et une page visible) se coupe en deux tickets liés.
- « En tant que développeur, je veux… » n'est pas une Story : c'est une Task.

## 4. Rédiger le ticket

Règles communes :

- **Titre** : commence par un verbe d'action ou dit ce que fait l'utilisateur ; pour un Bug, `<Zone> : <symptôme>` ; 80 caractères au plus ; jamais vague (« Corriger un bug », « Page de connexion »).
- **Le quoi et le pourquoi, pas le comment.** Les détails d'implémentation ne vont que dans « Notes techniques », et seulement s'il y a une vraie contrainte. Le correctif proposé par l'audit sert de piste, pas de solution imposée : reformuler d'abord le problème.
- Le **pourquoi** cite l'audit : la règle Opquast (numéro et intitulé du catalogue), et pour les règles qui ont une correspondance accessibilité, les critères RGAA et WCAG (champ `a11y` du catalogue), plus l'impact utilisateur (`impact`).
- Les preuves de l'audit (`evidence`, constat) vont dans le ticket en texte, jamais en capture seule.
- Ne pas recopier la Definition of Done : y faire référence (lien de `config.jira.dod`).
- Écrire dans la langue du rapport (`config.lang`).
- Ajouter un lien vers le rapport (artifactUrl) dans « Références ».

### Story

**Contexte / Pourquoi** : qui a le problème, ce qu'on y gagne. Citer la ou les règles de l'audit.
**User story** : En tant que <persona>, je veux <capacité> afin de <bénéfice>.
**Critères d'acceptation** : testables, en Étant donné / Quand / Alors ou en liste à cocher. Couvrir le cas nominal, les cas d'erreur, l'accessibilité (clavier, annonces au lecteur d'écran), la sécurité et la confidentialité, et les événements de mesure d'audience s'il y en a. **Chaque critère qui touche l'accessibilité nomme dans sa propre ligne le critère RGAA et WCAG qu'il vérifie** (« Le texte du badge atteint 4,5:1 dans les deux thèmes — RGAA 3.2, WCAG 1.4.3 »), même si le Contexte les cite déjà : la QA teste à partir des critères d'acceptation, pas du contexte.
**Hors périmètre**
**Design / Références** : Figma, spec d'API, ADR, tickets liés, rapport d'audit.
**Notes techniques** (facultatif) : contraintes, services touchés, migration, feature flag.
**Hypothèses** (s'il y en a)

### Bug

**Environnement** : environnement, version ou build (commit audité), navigateur / OS / appareil.
**Étapes pour reproduire** : numérotées. Les reconstruire à partir des preuves de l'audit (commande curl, URL, parcours clavier). Si les preuves ne suffisent pas à reproduire, le dire et poser la question plutôt qu'inventer.
**Résultat attendu** (avec la règle Opquast et, pour l'accessibilité, le critère RGAA / WCAG qui le fonde)
**Critères d'acceptation** (facultatif pour un Bug, utile pour la QA) : même règle que pour la Story, chaque critère d'accessibilité nomme son critère RGAA / WCAG.
**Résultat obtenu**
**Fréquence** : toujours / intermittent (x/10)
**Impact** : qui est touché, existe-t-il un contournement ?
**Preuves** : sortie de commande, extrait de code avec fichier et ligne, URL, mesures.
**Gravité** (impact technique) et **Priorité** (urgence métier), données séparément.

### Task

**Objectif / Pourquoi**, **Périmètre**, **Terminé quand** (liste à cocher), **Risques / Dépendances**.

### Spike

**Question à trancher**, **Durée maximale** (time box), **Livrable attendu** (décision, PoC, recommandation, tickets de suite).

## 5. Champs

- **Étiquettes / composants** : uniquement dans la liste autorisée (`config.jira.labels`) et les composants qui existent dans le projet. Ne jamais en inventer. Toujours `audit-web`.
- **Liens** : relations Jira (`blocks`, `is blocked by`, `relates to`), pas de la prose. Parent = l'Epic de l'audit. Exemple : la Task HSTS `blocks` le Bug « HTTP servi en clair ».
- **Estimation** : proposer des points (Fibonacci). Au-dessus du seuil de l'équipe (par défaut > 8), signaler qu'il faut redécouper. Si le projet n'a pas de champ de points, l'indiquer dans la description.
- **Priorité** : partir de la criticité du chantier (Bloquant → Highest, Élevé → High, Moyen → Medium, Faible → Low) en utilisant les valeurs qui existent dans le projet.
- **Branche suggérée** : `<type>/<KEY>-<slug-court>` (`feature/`, `fix/`, `chore/`, `spike/`). La clé n'existe qu'après création : dans l'aperçu, écrire `<KEY>` ; après création, compléter la description si l'outil permet de modifier le ticket, sinon donner les noms dans le résumé final.

## 6. Contrôle qualité (avant l'aperçu)

Pour chaque ticket, vérifier et corriger (ou signaler le manque) :

1. Un coéquipier le comprendrait-il sans poser de question ?
2. Le pourquoi est-il explicite ?
3. La QA peut-elle tester chaque critère d'acceptation (pas de « fonctionne correctement ») ?
4. Tient-il dans un sprint, et ne traite-t-il qu'un seul problème indépendant ?
5. Les designs, specs et dépendances sont-ils référencés ?
6. Le périmètre est-il borné (« Hors périmètre » présent) ?

**Definition of Ready** (tout doit être vrai pour marquer « prêt pour le sprint ») : titre et contexte clairs, critères d'acceptation testables, designs ou contrats joints si nécessaire, dépendances liées, estimé, tient dans un sprint. Un ticket qui n'est pas prêt est créé quand même si l'utilisateur le veut, avec ce qui manque écrit dans la description, et l'étiquette ou le statut que l'équipe utilise pour « à affiner » s'il existe.

Anti-patterns à refuser ou réécrire :
- Story « En tant que développeur… » → Task.
- Critères vagues → résultats observables.
- Solution imposée sans le problème → énoncer d'abord le problème.
- Description faite d'une capture seule → ajouter le texte.
- Ajout de périmètre à un ticket existant → nouveau ticket lié.
- Ticket fourre-tout (« Améliorer l'accessibilité », « Corriger les points de l'audit ») → un ticket par problème indépendant, sous un Epic.

## 7. Aperçu, accord, création

1. Écrire tous les tickets dans `.audit-web/jira-apercu.md`, au format ci-dessous, et montrer à l'utilisateur un tableau récapitulatif (titre, type, estimation, chantier d'origine, résultat du contrôle qualité). Lui donner le chemin du fichier pour la lecture complète.
2. Demander l'accord (« Créer ces N tickets dans <PROJET> ? ») avec la possibilité d'en retirer ou d'en modifier. Attendre un oui explicite.
3. Créer dans cet ordre : l'Epic, puis les tickets enfants, puis les liens, puis les sous-tâches. Ne fixer que des champs qui existent dans le projet. Ne pas déplacer les tickets dans un sprint ni changer leur statut : ils arrivent dans le statut initial du workflow.
4. Enregistrer chaque ticket créé dans le chantier correspondant de `audit.json` (`plan[i].jira`, voir `schema.md`) et l'Epic dans `config.jira.epic`. Relancer `render` puis republier le rapport : chaque chantier affiche alors sa clé Jira.
5. Résumer : tickets créés (clé, titre, lien), liens posés, ce qui a échoué et pourquoi.

Format de chaque ticket dans l'aperçu (Markdown prêt pour Jira) :

```markdown
## <Titre>
**Type** : Story | Task | Bug | Spike | Epic | Sous-tâche · **Chantier** : <titre du chantier> · **Règles** : 197, 199

### Description
<sections du gabarit du type>

### Champs
- Étiquettes : audit-web, securite
- Composants : <s'il y en a>
- Parent : <Epic>
- Liens : blocks <titre ou clé>, relates to <…>
- Estimation : 3 points
- Priorité : High
- Branche : fix/<KEY>-http-redirection-https

### Contrôle qualité
OK sur les 6 points. | Échecs : 5 (pas de maquette pour la page 404 : à fournir par le design).
```

## 8. À la relance

- Chantier nouveau → proposer de nouveaux tickets (même processus, même Epic).
- Chantier passé « terminé » et lié à un ticket → proposer un commentaire sur le ticket (« Vérifié par l'audit du <date> : règles 197, 199 conformes ») et, seulement si l'utilisateur le veut, une transition. Lire les transitions disponibles et proposer celles qui existent ; ne jamais forcer un statut, ne jamais sauter d'étape du workflow.
- Règle en régression sur un ticket déjà fermé → proposer un **nouveau Bug lié** (`relates to` l'ancien), plutôt que de rouvrir ou d'élargir l'ancien ticket.
- Chantier dont le reste à faire a changé, ticket encore ouvert → proposer un commentaire, pas une réécriture de la description.
- Tout cela passe par le même aperçu et le même accord explicite.
