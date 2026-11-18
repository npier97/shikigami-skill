# Règles Opquast et accessibilité (RGAA / WCAG)

## Ce que couvre ce skill, et ce qu'il ne couvre pas

57 règles du catalogue portent un champ `a11y` : elles recoupent un ou plusieurs critères du **RGAA 4.1.2** et critères de succès des **WCAG 2.2**. Ces correspondances sont **indicatives** :

- une règle Opquast n'équivaut pas à un critère RGAA (périmètre, tests et cas particuliers diffèrent) ;
- la correspondance sert à repérer les sujets d'accessibilité dans le rapport, à les prioriser et à orienter vers le bon critère ;
- elle ne permet **pas** de calculer un taux de conformité RGAA ni de rédiger une déclaration d'accessibilité.

Le rapport l'affiche explicitement. Ne jamais écrire qu'un site « est conforme RGAA » à partir de cet audit.

Pour un audit de conformité RGAA (13 thématiques, 106 critères, échantillon de pages, taux C / (C + NC)), il faut un audit RGAA dédié, appuyé sur le texte officiel du RGAA comme source de vérité.

## Ce qu'on reprend de la méthode d'audit RGAA

1. **Intégrité normative.** Avant de citer un critère RGAA dans un constat (son numéro, son intitulé, un test), le vérifier dans le texte officiel du RGAA (ou un skill de référence RGAA s'il est installé). Ne jamais citer un critère de mémoire. Les numéros présents dans `rules-v5.json` ont été vérifiés contre le texte officiel du RGAA 4.1.2.
2. **Impact utilisateur.** Chaque non-conformité ou partielle liée à l'accessibilité indique dans `impact` le profil concerné et la situation de blocage : déficience visuelle (lecteur d'écran, zoom), handicap moteur (clavier seul, commande vocale), déficience auditive, troubles cognitifs, photosensibilité.
3. **Niveaux de certitude.** Les audits a11y distinguent non-conformités certaines, probables, et contrôles manuels requis. Ici :
   - certaine → `fail` ou `partial` avec la preuve (code, mesure) ;
   - probable (fort indice, à confirmer en test) → `partial` ou `fail` en écrivant « à confirmer avec un lecteur d'écran » dans le constat ;
   - contrôle manuel requis (rien de concluant sans test humain) → `check`, en disant quel test faire et avec quelle technologie d'assistance.
4. **Criticité.** Même échelle qu'un audit RGAA pour le plan d'action : Bloquant, Élevé, Moyen, Faible (`critical`, `high`, `medium`, `low`). Un défaut d'accessibilité qui empêche un profil d'utilisateur d'accomplir une tâche essentielle (se connecter, payer, envoyer un formulaire) est Bloquant.
5. **Complexité de correction.** Champ `effort` des chantiers : `simple`, `moderate`, `complex`.
6. **Résumé non technique.** Le verdict doit être lisible par une direction ou un chef de projet.
7. **Échantillon.** Pages représentatives des gabarits, des parcours clés, et pages obligatoires (accueil, plan du site, aide, recherche, mentions légales). Signaler celles qui manquent.
8. **Avertissement.** Les résultats d'accessibilité doivent être vérifiés par un auditeur humain avec des technologies d'assistance. Le rapport le dit dans l'encadré Accessibilité et dans le pied de page ; le redire à l'utilisateur à la fin d'un audit.

## Correspondances utilisées (rappel)

| Opquast | Sujet | RGAA 4.1.2 | WCAG 2.2 |
|---|---|---|---|
| 12 | Graphiques et données | 1.6 | 1.1.1 |
| 14 | Caractères détournés pour la mise en forme | 10.1 | 1.3.1 |
| 69 | Étiquettes de champs | 11.1, 11.2 | 1.3.1, 3.3.2, 4.1.2 |
| 70 | Aide reliée au champ | — | 1.3.1 |
| 71, 72 | Champs obligatoires, formats | 11.10 | 3.3.2 |
| 77 | Étiquette accolée au champ | 11.4 | 3.3.2 |
| 79 | Champs en erreur signalés | 11.10 | 3.3.1 |
| 80 | Raisons de l'erreur | 11.11 | 3.3.3 |
| 83 | Récapitulatif avant envoi | 11.12 | 3.3.4 |
| 85 | Message de succès ou d'échec | 7.5 | 4.1.3 |
| 93 | Regroupement d'options | 11.8 | 1.3.1 |
| 97 | Autocomplétion | 11.13 | 1.3.5 |
| 102, 103 | Titre de page | 8.5, 8.6 | 2.4.2 |
| 116–118 | Alternatives des images | 1.1, 1.2, 1.3, 1.6, 6.1 | 1.1.1, 2.4.4 |
| 120 | Objets intégrés | 4.8 | 1.1.1 |
| 121, 122 | Transcription, sous-titres | 4.1, 4.3 | 1.2.1, 1.2.2, 1.2.3 |
| 125 | Son automatique | 4.10 | 1.4.2 |
| 126 | Animations, clignotements | 13.7, 13.8 | 2.2.2, 2.3.1 |
| 130, 132 | Langue, changements de langue | 8.3, 8.4, 8.7, 8.8 | 3.1.1, 3.1.2 |
| 136, 137 | Intitulé et pertinence des liens | 6.1, 6.2 | 2.4.4, 4.1.2 |
| 140 | Liens visibles dans le texte | 10.6 | 1.4.1 |
| 154 | Pas de nouvelle fenêtre sans action | 13.2 | 3.2.1 |
| 158 | Navigation au même endroit | 12.2 | 3.2.3 |
| 164 | Liens d'évitement | 12.7 | 2.4.1 |
| 165 | Focus visible | 10.7 | 2.4.7 |
| 166 | Clavier, pièges au clavier | 7.3, 12.9 | 2.1.1, 2.1.2 |
| 167 | Ordre de tabulation | 12.8 | 2.4.3 |
| 168, 171 | Recherche, plan du site | 12.1, 12.3, 12.4, 12.5 | 2.4.5 |
| 172, 239 | Limites de temps, redirections | 13.1 | 2.2.1, 3.2.5 |
| 181 | Pas d'information par la couleur seule | 3.1 | 1.4.1 |
| 182 | Contrastes | 3.2, 3.3 | 1.4.3, 1.4.11 |
| 183, 188 | Sans styles, contenus CSS | 10.2, 10.3 | 1.3.1, 1.3.2 |
| 184 | Forme, taille, position | 10.9, 10.10 | 1.3.3 |
| 185 | Contenus cachés | 10.8 | 1.3.1, 4.1.2 |
| 186 | Taille des cibles | — | 2.5.8 |
| 187 | Texte en image | 1.8 | 1.4.5 |
| 189 | Symboles, contenus cryptiques | 13.5 | 1.1.1 |
| 193 | Zoom | 10.4 | 1.4.4 |
| 194 | Adaptation mobile, reflow | 10.11 | 1.4.10 |
| 234, 235 | Titres, listes | 9.1, 9.3 | 1.3.1, 2.4.6 |
| 236 | Identifiants uniques | 8.2 | 4.1.1 (WCAG 2.1, retiré en 2.2) |
| 240, 241 | PDF | 13.3 | — |
| 242–244 | Tableaux | 5.3–5.8 | 1.3.1, 1.3.2 |

Si une correspondance paraît fausse pour un cas précis, la vérifier dans le texte officiel du RGAA et, si besoin, corriger `rules-v5.json` (le catalogue est partagé par tous les audits).

## Seuils et mesures à connaître

- Contraste du texte : 4,5:1, ou 3:1 pour le texte de grande taille (24 px, ou 18,5 px en gras). Composants d'interface et graphiques porteurs d'information : 3:1.
- Cible cliquable : 24 × 24 px minimum (WCAG 2.2 critère 2.5.8, sans équivalent dans le RGAA 4.1.2).
- Zoom : texte lisible à 200 % ; reflow sans défilement horizontal à 320 px de large.
- Toujours mesurer texte et fond **du même thème** (clair ou sombre), et donner le ratio pour chaque thème.
