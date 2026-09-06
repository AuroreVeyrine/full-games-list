# Pixel Memories

Inventaire personnel de jeux vidéo avec authentification Firebase, sauvegarde privée Firestore et catalogue RAWG.

## Architecture

- **Catalogue public** : importé depuis RAWG par une fonction Netlify et conservé dans IndexedDB pour supporter 10 000 jeux et plus.
- **Inventaire privé** : une sous-collection Firestore `users/{uid}/playedGames` par utilisateur.
- **Clé RAWG** : variable Netlify `RAWG_API_KEY`, accessible uniquement à la fonction serveur.

## Configuration requise

1. Activer Firebase Authentication par courriel et mot de passe.
2. Publier le contenu de `firestore.rules` dans la console Firestore.
3. Ajouter `RAWG_API_KEY` dans **Netlify > Project configuration > Environment variables** avec la portée **Functions**, puis redéployer.

Le catalogue reprend automatiquement son import à la prochaine connexion. Le bouton d'import permet d'arrêter proprement le processus; la page RAWG suivante est mémorisée.

Les données et images du catalogue sont fournies par [RAWG](https://rawg.io/).

## Parcourir son historique

Le catalogue affiche 30 jeux par page. « Noter comme vu » enregistre uniquement les jeux affichés, puis les masque par défaut. « Afficher jeux déjà vus » permet de les retrouver. Le compteur des jeux joués est indépendant.

Les marqueurs de lecture sont des documents `seen--{gameId}` de type `kind: "seen"` dans la même sous-collection privée que les anciens jeux joués, pour rester compatibles avec les règles Firestore déjà publiées. Ils ne contribuent jamais au compteur joué. La page est masquée uniquement après confirmation du batch Firestore. Les lectures et écritures en cours sont isolées lors d'un changement de compte.

Le catalogue RAWG reste un cache local ; les statuts personnels sont dans Firestore et rechargés à la connexion. Les identifiants techniques Firebase et IndexedDB historiques sont conservés malgré le nouveau nom.

## Vérification

`node --test tests/catalog.test.cjs`

## Direction artistique

Visuel original généré avec l'outil de génération d'images intégré, optimisé en WebP : `assets/pixel-memories-city.webp`.
Prompt : ville cyberpunk nocturne panoramique, tours et circuits lumineux, pixels dispersés, bleu nuit, cyan électrique, magenta et violet, architecture à droite, espace sombre à gauche pour le texte, sans lettrage ni logo.
Les effets CSS respectent la préférence de réduction des animations.
