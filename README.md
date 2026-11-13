# 🏎️ TurboKart

**Alpha 1.5** · Jeu de course en 3D dans le navigateur, par Turbonix Entertainment : 10 pilotes avec leur talent, 4 à 8 pilotes par course, 10 circuits, 8 biomes (dont une montagne en relief), 7 véhicules, 3 types de roues, 10 objets, saut synchro et drift, coupe, contre-la-montre avec fantôme et écran partagé.

En ligne : <https://turbonix-x.github.io/kart-racing/> (anciennement Kart Racing).

Toutes les nouveautés, version par version : [CHANGELOG.md](CHANGELOG.md).

## Jouer

**Double-clique sur `index.html`.** Aucune installation et aucune connexion ne sont nécessaires : tout tient dans ce fichier.

Les commandes sont détaillées dans le jeu, bouton **Commandes**. Les polices Russo One et Exo 2 viennent de Google Fonts quand on est connecté ; hors ligne, le jeu utilise Outfit, fournie dans `vendor/`.

## Structure

```
index.html       Le jeu complet, généré par tools/build.py. Ne pas le modifier à la main.
src/             Le code source
  config.js        Stats des véhicules, des 10 pilotes et des roues : le premier fichier à ouvrir pour équilibrer
  tracks.js        Les circuits, décrits par des données
  biomes.js        Les 8 biomes : couleurs et règles de conduite
  terrain.js       Le relief de la montagne : hauteur de la piste et du terrain (sans rendu)
  decor.js         Le décor et la vie de chaque biome (moulins, neige, oiseaux…)
  items3d.js       Les objets en 3D et leurs animations
  icons.js         Les icônes dessinées en SVG
  models.js        Les véhicules 3D : carrosseries sculptées, 3 types de roues, suspension
  characters3d.js  Les 10 pilotes en 3D et leurs apparences (classique, nuit, or massif)
  geometry.js      Outils de géométrie partagés (surfaces lissées, fusion)
  turbonix.css     Le style commun des jeux Turbonix (copie exacte, ne pas le modifier ici)
  style.css        Ce qui est propre à TurboKart
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
  preview.js       Aperçu 3D du menu et portraits des pilotes
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
- **Un pilote :** ajoute-le dans `CHARACTERS` (`src/config.js`), avec ses couleurs et sa fonction de construction dans `src/characters3d.js`.
- **Un biome :** ajoute ses données dans `BIOMES` (`src/biomes.js`) et son décor dans `src/decor.js`. Un champ `elevation` lui donne du relief.

### Principes à respecter

- La simulation avance par pas fixes de 1/60 s. Le résultat d'une course ne dépend donc jamais de la fréquence de l'écran.
- Les fichiers `physics`, `trackmath`, `terrain`, `sim`, `ai` et `storage` ne dépendent pas du rendu, ce qui permet de tester une course entière à pleine vitesse.
- Le dessin de la piste, la détection hors-piste, les murs et l'IA utilisent le même tracé échantillonné.
