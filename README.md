# GameVault

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
