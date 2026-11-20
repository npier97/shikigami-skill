# Méthode de vérification

Chaque règle est vérifiée sur deux sources : le **site en ligne** (ce que reçoivent les utilisateurs) et le **dépôt** (pourquoi, et où corriger). Un constat cite les deux quand les deux comptent. Le champ `how` de `rules-v5.json` indique où se trouve d'habitude la preuve : `code`, `live`, `dns`, `external`, `live+code`.

## Tests du site en ligne (une seule fois, réutilisés pour tous les thèmes)

`scripts/live_checks.py` fait tous les tests ci-dessous et `assets/browser-checks.js` les mesures du navigateur : les lancer plutôt que de refaire ces commandes à la main. Cette liste dit ce qu'ils couvrent et ce qu'il reste à regarder soi-même.

Remplacer `$SITE` par le domaine, et répéter pour l'accueil et chaque page de `config.urls.pages`.

```bash
curl -sI "http://$SITE/"                 # HTTP en clair : doit rediriger en 301/308 vers https
curl -sI "http://www.$SITE/"             # www en http
curl -sI "https://www.$SITE/"            # redirection www ↔ domaine nu
curl -sI "https://$SITE/"                # en-têtes : HSTS, CSP, CSP-Report-Only, X-Content-Type-Options,
                                         # X-Frame-Options, Referrer-Policy, charset du Content-Type,
                                         # Cache-Control, ETag, Server, X-Powered-By, content-encoding
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://$SITE/page-inexistante-$(date +%s)"   # doit renvoyer 404
curl -s "https://$SITE/robots.txt"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://$SITE/sitemap.xml"
curl -sI -H "Accept-Encoding: br, gzip" "https://$SITE/"     # compression
curl -sI "https://$SITE/<une ressource trouvée dans le HTML>" # cache des ressources versionnées, type MIME
curl -s -o /dev/null -w "%{http_code}\n" "https://$SITE/assets/"   # pas de liste de répertoire
echo | openssl s_client -connect $SITE:443 -servername $SITE 2>/dev/null | openssl x509 -noout -issuer -dates
dig +short TXT $SITE; dig +short TXT _dmarc.$SITE; dig +short MX $SITE
```

Ouvrir ensuite chaque page dans un navigateur (navigateur intégré ou Chrome) et relever : l'arbre d'accessibilité, le titre, `lang`, la meta description, le plan des titres, les identifiants en double, chaque lien (intitulé, cible, rel, hreflang), les formulaires (étiquettes, types, autocomplete, champs obligatoires, gestion des erreurs), les images et médias (alternatives, sous-titres, transcription, lecture automatique, durée), les liens d'évitement, la visibilité du focus, un échantillon de contrastes. Vérifier aussi la largeur mobile (320 et 375 px) et le zoom à 200 %.

## Thème par thème

1. **Contenus (1–14)** : meta description par route, formats de date, abréviations à la première occurrence, glossaire, publicité signalée, règles des espaces publics, graphiques accompagnés des chiffres, nombre de résultats de recherche, caractères détournés pour la mise en forme.
2. **Données personnelles (15–29)** : politique de confidentialité liée depuis **chaque** page (y compris les pages applicatives et celles où l'on saisit des données), droits décrits (accès, effacement, opposition, réclamation auprès de la CNIL), règles de compte (N/A sans compte), en-tête Referrer-Policy, données sensibles uniquement en HTTPS, aucun secret dans les URL, finalités des cookies et effet d'un refus.
3. **E-commerce (30–68)** : si rien n'est vendu, N/A avec une raison commune. La règle 46 (conditions d'utilisation) s'applique quand même à tout service public en ligne.
4. **Formulaires (69–98)** : étiquettes dans le code, `aria-describedby` pour les aides et erreurs, champs obligatoires signalés, formats indiqués, sensibilité à la casse, bouton afficher/masquer sur les champs secrets, erreur signalée sur le bon champ, valeurs conservées après erreur, `type` adapté, `autocomplete` sur les données personnelles, collage non bloqué.
5. **Identification et contact (99–115)** : ce que propose le site et pour qui, éditeur identifié, mentions légales (en France, la LCEN impose l'éditeur, un contact et l'hébergeur avec nom, adresse et téléphone), SIREN si c'est une entreprise, deux moyens de contact, délai de réponse, accusé de réception (souvent `check` : boîte mail).
6. **Images et médias (116–127)** : alternatives des images décoratives, liens et informatives ; vignettes surdimensionnées (taille réelle comparée à la taille affichée) ; transcriptions ; sous-titres (incrustés : à signaler) ; durée indiquée ; pas de lecture automatique ; animations pouvant être mises en pause ; `prefers-reduced-motion`.
7. **Internationalisation (128–135)** : `lang` sur chaque page, `hreflang`/`lang` sur les liens vers d'autres langues, sélecteur de langue qui mène à la même page, noms des langues dans leur propre langue, ordre des langues du navigateur.
8. **Liens (136–152)** : intitulés accessibles, intitulés distincts pour des destinations distinctes, liens visibles (pas seulement par la couleur), `:visited`, signalement des liens externes et des nouvelles fenêtres, `rel="noopener"`, format et poids des téléchargements, liens internes et ancres cassés.
9. **Navigation (153–172)** : lien vers l'accueil partout, page active signalée, blocs cohérents, icônes avec intitulé, fenêtres de dialogue (bouton fermer, Échap, focus piégé dans la modale), liens d'évitement, focus visible et jamais supprimé, tout au clavier, recherche interne, URL des résultats, plan du site ou pied de page complet sur chaque page, limites de temps indiquées.
10. **Lettre d'information (173–179)** : souvent `check` ou `fail` selon qu'une inscription existe sur le site ; l'outil d'envoi est hors du dépôt.
11. **Présentation (180–196)** : identité cohérente, pas d'information par la couleur seule, contrastes, sens conservé sans CSS, cibles de 24 × 24 px minimum, pas de texte en image, police générique en dernier recours, pas de texte justifié, zoom non bloqué, adaptation mobile, styles d'impression qui masquent la navigation.
12. **Sécurité (197–217)** : HTTPS partout avec redirection, certificat valide, HSTS, pas de contenu mixte, règles de mot de passe (N/A sans mot de passe), `nosniff`, types MIME, pas de liste de répertoire, CSP (appliquée ou seulement en report-only), protection contre l'intégration en cadre, pas de version logicielle exposée, SRI sur les scripts tiers, SPF/DKIM/DMARC.
13. **Serveur et performances (218–230)** : www et domaine nu fonctionnent, robots.txt, sitemap, vrai code 404, pages 404/403 personnalisées avec navigation, compression, cache, charset dans Content-Type, CSS et JS minifiés.
14. **Structure et code (231–245)** : `<time datetime>`, meta charset, UTF-8, hiérarchie des titres, listes balisées, identifiants uniques, copie et menu contextuel non bloqués, pas de redirection côté client, PDF, tableaux de données.

Pour les règles liées à l'accessibilité, voir aussi `accessibilite.md`.

## Pièges (appris sur de vrais audits)

- **Contrastes** : mesurer texte et fond **du même thème**. Mélanger le gris du thème clair avec le fond du thème sombre donne une fausse non-conformité. Donner le ratio pour chaque thème.
- **Applications monopage** : elles renvoient souvent 200 et la page d'accueil pour une URL inconnue (`not_found_handling: single-page-application`, route attrape-tout, repli history API). Cela fait échouer 222, 223 et 225, et masque les liens cassés (152). Toujours demander une URL aléatoire.
- **HTTP** : un site peut servir HTTPS correctement et répondre quand même 200 en HTTP. Toujours tester `http://` explicitement, sur le domaine nu, `www` et l'API.
- **CSP** : `Content-Security-Policy-Report-Only` ne protège pas ; seul l'en-tête appliqué compte.
- **robots + noindex contre canonical/hreflang** : signaler la contradiction et demander si le client veut être indexé avant de déclarer le sitemap non conforme.
- **« À vérifier » n'est pas « inconnu »** : à réserver aux preuves situées hors du site et du dépôt, ou aux tests humains (technologies d'assistance). Toujours dire quoi vérifier.
- **Pages rendues en JavaScript** : vérifier le DOM rendu, pas seulement les gabarits sources.
- **Échantillonner honnêtement** : si les contrastes ou le clavier n'ont été vérifiés que sur un échantillon, l'écrire dans `meta.method`. Ce n'est pas un audit WCAG ou RGAA complet.
