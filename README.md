# 🏎️ Kart Racing

**Alpha 1.4** · Jeu de course en 3D dans le navigateur, par Turbonix Entertainment : adversaires IA, 5 circuits, 4 biomes, 7 véhicules, 10 objets, saut synchro et drift, coupe, contre-la-montre avec fantôme et écran partagé.

Toutes les nouveautés, version par version : [CHANGELOG.md](CHANGELOG.md).

## Jouer

**Double-clique sur `index.html`.** Aucune installation et aucune connexion ne sont nécessaires : tout tient dans ce fichier.

Les commandes sont détaillées dans le jeu, bouton **Commandes**.

## Structure

```
index.html       Le jeu complet, généré par tools/build.py. Ne pas le modifier à la main.
src/             Le code source
  config.js        Stats des véhicules et réglages : le premier fichier à ouvrir pour équilibrer
  tracks.js        Les circuits, décrits par des données
  biomes.js        Les 4 biomes : couleurs et règles de conduite
  decor.js         Le décor et la vie de chaque biome (moulins, neige, oiseaux…)
  items3d.js       Les objets en 3D et leurs animations
  icons.js         Les icônes dessinées en SVG
  models.js        Les véhicules 3D : carrosseries sculptées, roues, animation de la suspension
  turbonix.css     Le style commun des jeux Turbonix (copie exacte, ne pas le modifier ici)
  style.css        Ce qui est propre à Kart Racing
  physics.js       Physique d'un véhicule (sans rendu)
  trackmath.js     Géométrie des circuits : tracé, murs, détection de la piste
  sim.js           Simulation d'une course : tours, les 10 objets, classement (sans rendu)
  ai.js            Pilotes automatiques
  storage.js       Sauvegarde, records, médailles, score
  world.js         Décor 3D
  effects.js       Particules et traces de pneus
  audio.js         Moteur, musiques et effets, tous synthétisés
  input.js         Clavier, manette, tactile
  ui.js            Menu, HUD, résultats
  game.js          Boucle de jeu, caméras, rendu
  preview.js       Aperçu 3D du menu
  main.js          Point d'entrée
tests/           Tests de la logique de jeu
tools/build.py   Génère index.html
vendor/          Three.js r160 (licence MIT) et la police Outfit (licence OFL), en local
archive/         La version d'origine (février 2026), conservée telle quelle
CHANGELOG.md     Le journal des nouveautés, affiché aussi dans le jeu
```

## Développer

Il faut seulement Python. Lance le serveur local depuis la racine du projet :

```bash
python -m http.server 8765
```

- Jeu en développement : <http://localhost:8765/src/index.html>
- Tests : <http://localhost:8765/tests/tests.html>

Le serveur est nécessaire ici, car le navigateur refuse de charger des modules séparés depuis un fichier local.

Une fois les modifications terminées, ajoute-les à `CHANGELOG.md`, puis régénère le fichier jouable :

```bash
python tools/build.py
```

### Ajouter du contenu

- **Un circuit :** ajoute une entrée dans `TRACK_DEFS` et `TRACK_ORDER` (`src/tracks.js`). Les tests vérifient ensuite que l'IA le termine et qu'il ne se chevauche pas.
- **Un véhicule :** ajoute ses stats dans `VEHICLES` (`src/config.js`) et sa fonction de construction dans `BUILDERS` (`src/models.js`).

### Principes à respecter

- La simulation avance par pas fixes de 1/60 s. Le résultat d'une course ne dépend donc jamais de la fréquence de l'écran.
- Les fichiers `physics`, `trackmath`, `sim`, `ai` et `storage` ne dépendent pas du rendu, ce qui permet de tester une course entière à pleine vitesse.
- Le dessin de la piste, la détection hors-piste, les murs et l'IA utilisent le même tracé échantillonné.
