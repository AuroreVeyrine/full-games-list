# Pixel Memories

Inventaire personnel de jeux vidéo avec authentification Firebase, sauvegarde privée Firestore et catalogue RAWG.

## Pages et identité

- `index.html` : accueil immersif, particules projetées en perspective, parallaxe au défilement et présentation.
- `catalogue.html` : catalogue privé, filtres, pages de 30 jeux et suivi « Vu » / « Joué ».
- `compte.html` : connexion, inscription, déconnexion et réinitialisation du mot de passe.
- `assets/pixel-memories-symbol.svg` : logo vectoriel original, une cartouche de jeu se dispersant en pixels.

La navigation mobile reste en bas de l'écran avec prise en compte de la zone système. Les animations respectent la réduction des mouvements et peuvent être suspendues. Le canvas s'arrête lorsque l'accueil n'est plus visible ou que l'onglet est masqué.

## Architecture

- **Catalogue public partagé** : stocké côté serveur dans Netlify Blobs (store persistant `pixel-memories-catalogue-v1`), servi par `/api/catalogue`. IndexedDB n’est qu’un cache facultatif. Chaque compte télécharge la même liste, sans refaire l’import RAWG.
- **Inventaire privé** : une sous-collection Firestore `users/{uid}/playedGames` par utilisateur.
- **Clé RAWG** : variable Netlify `RAWG_API_KEY`, accessible uniquement à la fonction serveur.

## Configuration requise

1. Activer Firebase Authentication par courriel et mot de passe.
2. Publier le contenu de `firestore.rules` dans la console Firestore.
3. Ajouter `RAWG_API_KEY` dans **Netlify > Project configuration > Environment variables** avec la portée **Functions**, puis redéployer.

Le catalogue commun est chargé à la connexion. « Actualiser le catalogue » ajoute un lot depuis RAWG ; le curseur commun est conservé côté serveur. Les écritures conditionnelles empêchent deux mises à jour simultanées de remplacer une version plus récente. Les statuts privés ne transitent jamais par ce catalogue.

Les données et images du catalogue sont fournies par [RAWG](https://rawg.io/).

## Parcourir son historique

Le catalogue affiche 32 jeux par page. « Noter comme vu » enregistre uniquement les jeux affichés, puis les masque par défaut. « Afficher jeux déjà vus » permet de les retrouver. Le compteur des jeux joués est cliquable et affiche tous les jeux joués, y compris ceux déjà examinés.

Les marqueurs de lecture sont des documents `seen--{gameId}` de type `kind: "seen"` dans la même sous-collection privée que les anciens jeux joués, pour rester compatibles avec les règles Firestore déjà publiées. Ils ne contribuent jamais au compteur joué. La page est masquée uniquement après confirmation du batch Firestore. Les lectures et écritures en cours sont isolées lors d'un changement de compte.

Le catalogue RAWG est commun sur Netlify ; les statuts personnels sont dans Firestore et rechargés à la connexion. Les identifiants techniques Firebase et IndexedDB historiques sont conservés malgré le nouveau nom.

## Vérification

`node --test tests/catalog.test.cjs`

## Direction artistique

Visuel original généré avec l'outil de génération d'images intégré, optimisé en WebP : `assets/pixel-memories-city.webp`.
Prompt : ville cyberpunk nocturne panoramique, tours et circuits lumineux, pixels dispersés, bleu nuit, cyan électrique, magenta et violet, architecture à droite, espace sombre à gauche pour le texte, sans lettrage ni logo.
Les effets CSS respectent la préférence de réduction des animations.
