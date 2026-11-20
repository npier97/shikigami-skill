# Format des données

Les deux fichiers vivent dans `.audit-web/` à la racine du dépôt client. `scripts/build.py validate` les contrôle.

## config.json

```jsonc
{
  "client": "Acme SAS",                 // obligatoire : nom de la société
  "product": "Acme Réservation",        // obligatoire : nom du produit ou du site (titre et intertitres)
  "title": "Audit web Acme",            // facultatif : titre de la page
  "logo": "logo.svg",                   // facultatif : chemin relatif à .audit-web/ (SVG ou PNG), intégré en data URI
  "logoDark": "logo-sombre.svg",        // facultatif : variante affichée en mode sombre
  "auditor": { "name": "Studio Exemple", "logo": "studio.svg", "url": "https://studio.example" }, // facultatif, pied de page
  "urls": { "site": "https://acme.example", "pages": ["/", "/reservation", "/compte", "/mentions-legales"] },
  "scope": {                            // ce qui existe ; init-audit en déduit les règles N/A
    "shop": false, "accounts": true, "newsletter": false,
    "publicSpaces": false, "pdfs": true, "dataTables": false, "video": true
  },
  "lang": "fr",                         // langue du rapport : "fr" (par défaut) ou "en"
  "artifactUrl": null,                  // renseigné après la première publication ; chaque relance met à jour cette adresse
  "jira": {                             // facultatif : présent seulement si le plan a été envoyé dans Jira
    "site": "https://acme.atlassian.net",
    "project": "ACME",                  // clé du projet
    "epic": { "key": "ACME-40", "url": "https://acme.atlassian.net/browse/ACME-40" },
    "labels": ["audit-web", "opquast", "accessibilite", "securite", "seo", "performance", "contenu", "legal"],
    "dod": "https://acme.atlassian.net/wiki/…/Definition+of+Done",
    "estimateField": "customfield_10016", // champ des points, s'il existe ; null sinon
    "splitThreshold": 8                 // au-delà, l'estimation signale un redécoupage
  }
}
```

Logos : moins de 100 Ko. Éviter les URL distantes : l'artifact publié bloque la plupart des images externes ; télécharger le fichier dans `.audit-web/`.

## audit.json

```jsonc
{
  "schema": 1,
  "meta": {
    "lede": "Ce qui a été audité : référentiel, pages, dépôt.",
    "verdict": "4 à 6 phrases sur l'état actuel, lisibles par un non-spécialiste.",
    "method": "Comment on a vérifié, et ce qui n'a été qu'échantillonné.",
    "eyebrow": "facultatif, remplace « Audit qualité web · Référentiel Opquast V5 (2025) »",
    "title": "facultatif, remplace « <produit> au regard des règles Opquast »"
  },
  "runs": [
    { "id": 1, "date": "2026-11-11", "commit": "3f2a…", "branch": "main",
      "counts": { "pass": 102, "partial": 29, "fail": 21, "check": 10, "na": 83 } }
  ],
  "rules": [
    {
      "id": 182,                        // nombre pour les règles V5, "V4-25" pour les 3 règles V4 retirées
      "status": "fail",                 // pass | partial | fail | check | na   ("todo" seulement avant le premier snapshot)
      "finding": "Ce que fait le produit aujourd'hui. `code` entre accents graves.",
      "fix": "Quoi faire. Obligatoire pour fail et partial ; vide si conforme.",
      "impact": "Pour les règles liées à l'accessibilité : qui est bloqué et comment.",
      "evidence": ["contraste #8a93a6 sur #ffffff = 3,1:1 (thème clair)", "apps/web/src/styles/tokens.css:14"],
      "history": [ { "run": 1, "status": "fail" } ],   // écrit par `snapshot`, ne pas modifier à la main
      "rule": "facultatif : remplace la reformulation du catalogue (à éviter)"
    }
  ],
  "plan": [
    { "severity": "critical",           // critical (Bloquant) | high (Élevé) | medium (Moyen) | low (Faible)
      "effort": "moderate",             // facultatif : simple | moderate | complex
      "title": "Servir le site uniquement en HTTPS",
      "rules": [27, 197, 199],
      "body": "1 à 3 phrases : quoi faire.",
      "state": "open",                  // open | done, tenu à jour par `snapshot`
      "log": [ { "run": 2, "date": "2026-12-02", "state": "done" } ],
      "jira": [                         // facultatif : tickets créés pour ce chantier (affichés dans le rapport)
        { "key": "ACME-41", "url": "https://acme.atlassian.net/browse/ACME-41", "type": "Bug" },
        { "key": "ACME-42", "url": "https://acme.atlassian.net/browse/ACME-42", "type": "Task" }
      ] }
  ],
  "corrections": [
    { "date": "2026-11-11", "text": "règle 182 passée de partielle à conforme : la première mesure mélangeait les couleurs des deux thèmes." }
  ]
}
```

Les références RGAA/WCAG ne sont pas saisies dans `audit.json` : elles viennent du catalogue (`rules-v5.json`, champ `a11y`).

## Passages et historique

- `snapshot` ajoute un passage, calcule les comptes (règles V5 seulement), ajoute `{run, status}` à l'historique de chaque règle et fixe l'état de chaque chantier (`done` quand toutes ses règles sont conformes ou N/A).
- La page compare le statut actuel au statut du passage **précédent** : c'est ce qui alimente « Depuis le dernier passage », les mentions « avant : … » et le filtre « Modifiées depuis le dernier passage ».
- Ordre utilisé pour comparer : non conforme < partiel = à vérifier < conforme. Un passage vers ou depuis N/A compte comme « modifiée », pas comme un progrès.
- Pourcentage affiché : conformes / (conformes + partielles + non conformes), sur les règles V5. Les règles à vérifier et N/A en sont exclues. Ce n'est pas un taux de conformité RGAA.
- Lancer `snapshot` une seule fois par passage, après toutes les modifications et avant `render`. Pour corriger une donnée après un snapshot dans la même session : supprimer le dernier passage de `runs` et la dernière entrée de chaque `history`, corriger, puis relancer `snapshot`.
