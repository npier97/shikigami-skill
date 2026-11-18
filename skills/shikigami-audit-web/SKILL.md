---
name: shikigami-audit-web
description: Audit qualité web d'un site client et de son code source selon le référentiel Opquast V5 (245 règles), avec correspondances accessibilité RGAA 4.1.2 / WCAG 2.2, publié en rapport interactif (Artifact) puis relancé pendant la mission pour suivre les corrections ; peut envoyer le plan d'action dans Jira (via MCP) sous forme de tickets prêts pour le sprint. Déclencher pour : "audit Opquast", "audit qualité web", "audit du site et du code", "audit de début de mission", "état des lieux qualité d'un site client", "relancer / mettre à jour l'audit", "envoyer le plan d'action de l'audit dans Jira", ou quand l'utilisateur colle la commande `/shikigami-audit-web refresh` copiée depuis le rapport. Pour un audit de conformité RGAA à proprement parler (taux de conformité, déclaration d'accessibilité), utiliser un audit RGAA dédié.
---

# Audit web (Opquast + accessibilité)

Ce skill audite un produit client sur les 245 règles Opquast V5 (plus 3 règles V4 retirées en V5), à partir de deux sources : **le site en ligne** et **le code source** du dépôt courant. Il publie un rapport sous forme d'Artifact, puis le met à jour à chaque nouveau passage. Le design du rapport est figé : ne jamais le restyler, seulement remplir ses données.

Fichiers du skill (chemins relatifs à ce SKILL.md) :
- `references/rules-v5.json` : catalogue des règles (id, thème, reformulation FR et EN, où chercher la preuve, correspondances RGAA/WCAG indicatives).
- `references/methode.md` : comment vérifier chaque thème, et les pièges connus. **À lire avant d'évaluer.**
- `references/accessibilite.md` : comment traiter les règles liées à l'accessibilité, ce qu'on reprend de la méthode d'audit RGAA, et les limites.
- `references/schema.md` : format de `config.json` et `audit.json`.
- `references/jira.md` : envoi facultatif du plan d'action dans Jira (types de tickets, gabarits, contrôle qualité, création via MCP).
- `assets/template.html` : la page du rapport. Ne pas la modifier pour un client.
- `scripts/build.py` : validation, enregistrement des passages, comparaison, génération. À lancer avec `python3`.
- `viewer/` : vue animée des sous-agents pendant l'évaluation (voir « Vue en direct des sous-agents » et `viewer/README.md`).

Les données du client vivent dans son dépôt, dossier `.audit-web/` : `config.json` (identité, logo, URL, périmètre, adresse de l'artifact), `audit.json` (résultats et historique), `report.html` (sortie générée, peut être ignorée par git).

`B=<dossier de ce skill>/scripts/build.py` ; lancer toutes les commandes depuis la racine du dépôt client.

## Choisir le mode

- `.audit-web/audit.json` n'existe pas → **premier audit**.
- Il existe, ou l'utilisateur parle de relancer / mettre à jour, ou colle `/shikigami-audit-web refresh` → **relance**.

## Premier audit

1. **Configurer.** Déduire ce qui peut l'être du dépôt (nom du produit dans package.json ou le README, URL de production dans la config ou la doc, routes dans le routeur, présence d'une boutique, de comptes, d'une lettre d'information, de PDF…). Poser avec `AskUserQuestion` uniquement ce qui ne se déduit pas : nom de la société cliente, nom du produit s'il est ambigu, URL du site, logo (facultatif, avec une variante pour le mode sombre), affichage de l'auditeur en pied de page. Écrire `.audit-web/config.json` (voir le schéma). Copier les logos dans `.audit-web/` pour garder des chemins relatifs. Langue du rapport : `fr` par défaut, `en` si le client est anglophone.
2. **Échantillon.** Choisir les pages auditées : accueil, pages représentatives de chaque gabarit, les parcours clés (formulaire de contact, tunnel, espace personnel), et les pages obligatoires (mentions légales, confidentialité, plan du site, aide, recherche s'ils existent). Signaler à l'utilisateur les pages obligatoires absentes.
3. `python3 $B init-audit` crée `audit.json` avec toutes les règles en statut `todo`.
4. **Évaluer chaque règle** selon `references/methode.md`. Faire les vérifications du site en ligne (curl, dig, navigateur) une seule fois et réutiliser les résultats. Pour un audit complet, répartir les thèmes entre 3 ou 4 sous-agents (par exemple : 1–2 + 5 + 10 ; 3–4 + 6–7 ; 8–9 + 11 ; 12–14), en leur donnant la méthode, `accessibilite.md`, la config, la liste des règles et les résultats partagés des tests en ligne. Juste avant de les lancer, proposer la vue en direct (voir « Vue en direct des sous-agents ») et appliquer ses consignes de nommage. Chacun renvoie des entrées JSON `{id, status, finding, fix, impact?, evidence}`. Fusionner dans `audit.json`, puis relire soi-même les non-conformités et les partielles : ce sont elles qui portent le rapport.
5. **Règles liées à l'accessibilité** (celles qui ont un champ `a11y` dans le catalogue) : suivre `references/accessibilite.md`. Renseigner `impact` (profil de handicap et situation de blocage) pour chaque non-conformité ou partielle. Si un skill de référence RGAA est installé, s'en servir pour vérifier l'intitulé et les tests d'un critère RGAA avant de le citer dans un constat.
6. Rédiger `meta.lede` (ce qui a été audité : référentiel, pages, dépôt), `meta.verdict` (4 à 6 phrases simples, lisibles par un non-spécialiste : où en est le site, où sont les écarts, pourquoi tant de N/A, ce que signifie « à vérifier » ici, « Sélectionnez une tuile pour filtrer le registre. ») et `meta.method` (comment on a vérifié, ce qui n'a été qu'échantillonné).
7. Rédiger le **plan d'action** : regrouper les non-conformités et partielles en 8 à 14 chantiers, chacun avec une criticité (`critical` = Bloquant : sécurité, exposition légale ou blocage d'accès pour un profil d'utilisateur ; `high` = Élevé : comportement cassé ou obligation légale ; `medium` = Moyen : écart de qualité visible ; `low` = Faible : finition), un effort (`simple`, `moderate`, `complex`), un titre formulé comme une action, les règles couvertes et 1 à 3 phrases sur quoi faire.
8. `python3 $B validate`, puis `python3 $B snapshot --commit $(git rev-parse HEAD) --branch $(git branch --show-current)`, puis `python3 $B render`.
9. **Publier** `.audit-web/report.html` avec l'outil Artifact (nouvel artifact, icône `checklist`, description qui nomme le client). Enregistrer l'URL renvoyée dans `config.json` (`artifactUrl`).
10. **Proposer Jira (facultatif).** Demander avec `AskUserQuestion` si l'utilisateur veut ajouter les chantiers du plan d'action à son tableau Jira. Si oui, suivre `references/jira.md` : connexion MCP, configuration, choix du type, rédaction, contrôle qualité, aperçu, **accord explicite**, création, puis `render` et republication pour afficher les clés Jira dans le rapport. Si non, s'arrêter là.

## Relance

1. Charger `config.json` et `audit.json`. Montrer ce qui a changé dans le code depuis le dernier commit audité : `git log --oneline <dernier commit>..HEAD` et `git diff --stat <dernier commit>..HEAD`. Si ce commit est inconnu ou inaccessible, le dire et considérer que tout le code a changé.
2. Réévaluer, avec des preuves fraîches (même méthode qu'au premier audit) :
   - toutes les règles `fail`, `partial` et `check` ;
   - les règles `pass` dont les fichiers de preuve ont changé, et toutes celles dont `how` vaut `live` ou `dns` (en-têtes, redirections et DNS changent sans commit) ;
   - un échantillon d'une quinzaine d'autres règles `pass`, réparties sur les thèmes ;
   - les règles `na` seulement si le périmètre a changé (le produit a désormais des comptes, une boutique, une lettre d'information, des PDF…). Mettre `config.scope` à jour le cas échéant.

   Si la réévaluation est répartie entre plusieurs sous-agents, procéder comme au premier audit, vue en direct comprise.
3. **Ne jamais changer un statut sans nouvelle preuve.** Réécrire `finding` pour décrire ce que fait le produit maintenant, vider `fix` et `impact` quand la règle devient conforme, remplacer `evidence`. Si un statut précédent était simplement faux (et non une évolution du produit), l'ajouter à `corrections` plutôt que de le présenter comme un progrès.
4. Mettre à jour le plan : ajouter des chantiers pour les nouvelles non-conformités, ajuster le texte de ceux dont le reste à faire a changé. Ne pas supprimer de chantier : `snapshot` passe un chantier en « terminé » quand toutes ses règles sont conformes ou N/A, et le rouvre en cas de régression.
5. Mettre à jour `meta.verdict` pour qu'il décrive l'état actuel.
6. `python3 $B snapshot --commit … --branch …`, puis `python3 $B render`. Le snapshot affiche la comparaison (corrigées, améliorées, régressions).
7. Lire l'artifact à `artifactUrl` (Artifact `action: "read"`), puis publier `.audit-web/report.html` **à cette même adresse**. Si `artifactUrl` manque, publier un nouvel artifact et enregistrer son URL.
8. Résumer à l'utilisateur en quelques lignes : ce qui est corrigé, ce qui régresse, ce qui reste, et le lien.
9. **Jira (facultatif).** Si `config.jira` existe ou si des chantiers ont un ticket, proposer la mise à jour Jira décrite dans `references/jira.md` § 8 (nouveaux tickets, commentaires sur les chantiers terminés, Bug lié en cas de régression). Sinon, proposer l'envoi comme au premier audit. Rien ne part dans Jira sans accord explicite.

## Vue en direct des sous-agents

Une page locale montre chaque sous-agent comme un personnage à son bureau : ce qu'il fait, où il va (étagère pour les références, fenêtre pour le site en ligne, imprimante pour ses résultats), sa progression, ses erreurs, et le résultat qu'il rend, reporté sur le tableau blanc. La session principale y apparaît aussi, sous le nom de Kantoku, qui coordonne puis fusionne les copies. Un clic sur un personnage ou sur sa ligne ouvre son détail. Elle lit les transcriptions que Claude Code écrit déjà sur le disque : elle ne coûte aucun jeton et ne change rien à l'audit.

1. **Quand** : seulement si l'évaluation est répartie entre au moins 3 sous-agents, **après** les tests partagés du site en ligne et **juste avant** de lancer les sous-agents (sinon l'utilisateur regarde une pièce vide). Pas en session cloud (claude.ai/code) : l'utilisateur ne peut pas ouvrir `localhost`. Dans ce cas, ne rien proposer.
2. **Proposer une fois** avec `AskUserQuestion` : « Ouvrir la vue en direct des agents ? ». Si non, continuer sans.
3. **Lancer** depuis la racine du dépôt client, en tâche de fond : `node <dossier de ce skill>/viewer/server.mjs`. Lire l'adresse dans la ligne `VIEWER_URL=…` de sa sortie. L'ouvrir dans le navigateur intégré de l'application (`preview_start` avec `url`) ou, en ligne de commande, avec `open <url>`.
4. **Nommer et briefer les sous-agents** pour que la vue soit lisible :
   - `description` de l'outil Agent au format `Opquast · <thème>`, avec un mot de thème que la vue reconnaît : chaque paire de thèmes a son personnage, toujours le même d'un passage à l'autre. Contenus / Formulaires → Fumi Kaku, Liens / Médias → Tsuna Hikari, Navigation / Présentation → Michi Iro, Sécurité / Serveur / Structure → Mamo Kumo. Nommer les quatre sous-agents `Opquast · Contenus & formulaires`, `Opquast · Liens & médias`, `Opquast · Navigation & présentation` et `Opquast · Sécurité & serveur`, suivis du nombre de règles du lot entre parenthèses (`Opquast · Navigation & présentation (14)`) : la vue en tire la barre de progression. Un thème inconnu ou un cinquième agent reçoit un personnage de réserve.
   - Leur demander une `description` en français de 6 mots au plus sur **chaque** appel Bash, précédée du numéro de la règle examinée quand l'appel en concerne une (`R228 · Vérifie le charset`, `RV4-25 · Vérifie le lien externe`) : c'est le texte affiché pendant qu'ils travaillent, et la vue compte les règles déjà examinées. Leur demander aussi de terminer en donnant le décompte par statut sous la forme `pass N, partial N, fail N, check N, na N` : il remplit le tableau blanc.
   - Donner soi-même une `description` en français aux appels Bash de la session principale pendant l'audit : Kantoku les affiche.
   - Leur demander d'écrire les fichiers temporaires (pages téléchargées, sorties) **uniquement** dans le dossier de travail temporaire, jamais dans le dépôt client.
5. **Arrêt** : le serveur s'arrête seul 90 s après la fin du dernier sous-agent. Si l'audit est interrompu, arrêter aussi la tâche du serveur.
6. **Garder le passage (facultatif)** : si l'utilisateur veut revoir ou montrer le passage, `node <dossier de ce skill>/viewer/export-replay.mjs --out <fichier>.html` enregistre un fichier HTML autonome, avec lecture, pause, vitesse et barre de temps.

## Rédiger les constats

- Dire ce que fait le produit aujourd'hui, factuellement, puis le correctif. Phrases courtes. Nommer le fichier, l'URL, l'en-tête ou la commande qui le prouve.
- Mettre le code, les en-têtes, les chemins et les sélecteurs entre accents graves : la page les affiche comme du code. Les URL et noms de fichiers courants sont détectés automatiquement.
- Un N/A a toujours une raison en une ligne (« Aucun compte utilisateur. », « Rien n'est vendu : ni panier, ni commande, ni paiement. »). Réutiliser la même phrase pour le bloc e-commerce.
- `check` (« À vérifier ») = la preuve est hors du dépôt et du site (réponse automatique d'une boîte mail, outil d'envoi, entité juridique) ou demande un test humain (lecteur d'écran). Dire précisément quoi vérifier.
- `partial` = la règle est respectée à certains endroits et pas à d'autres ; dire où elle ne l'est pas.
- Pour une règle liée à l'accessibilité, ajouter `impact` : qui est bloqué et comment (« Les personnes aveugles qui utilisent un lecteur d'écran ne savent pas quel champ est en erreur. »).
- Parler d'Opquast pour la qualité web en général ; parler de RGAA et de WCAG uniquement pour les règles liées à l'accessibilité, et toujours comme correspondance, jamais comme verdict de conformité RGAA.
- Pas de ton marketing, pas de félicitations. Les reformulations des règles dans le catalogue sont fixes : ne pas les réécrire pour un client.
- Rédiger les constats dans la langue du rapport (`config.lang`).

## Ce que montre le rapport

Verdict (tuiles qui filtrent le registre, barre de répartition, pourcentage de règles conformes parmi les règles évaluées), un encadré **Accessibilité (RGAA / WCAG)** (résultat des règles Opquast qui recoupent le RGAA, avec l'avertissement « ce n'est pas un audit RGAA »), **Depuis le dernier passage** à partir du deuxième passage (corrigées, améliorées, en régression, restent à corriger, avec chaque règle modifiée), le plan d'action avec criticité et effort et une liste « Terminé » repliée, le registre filtrable (thème, filtre accessibilité, statut, « modifiées depuis le dernier passage », références RGAA/WCAG sous chaque règle concernée, mention « avant : … »), le pied de page (référentiel, méthode, avertissement, corrections, historique des passages, auditeur), et un bouton **Relancer l'audit** qui affiche le dernier passage et la commande `/shikigami-audit-web refresh` à copier. La page ne peut pas lancer l'audit elle-même : les relances se font toujours ici, dans Claude Code.

## Limites à rappeler à l'utilisateur

Ce skill est un assistant IA. Il analyse du code et teste un site, mais ne teste pas avec des technologies d'assistance et ne certifie aucune conformité. Les contrastes et le clavier sont échantillonnés. Pour une conformité RGAA (taux, déclaration d'accessibilité), il faut un audit RGAA complet sur un échantillon de pages, vérifié par un auditeur humain.
