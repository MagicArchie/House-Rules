# House Rules

A first-person browser game built with A-Frame. You play as a thief inside a virtual casino — collect as much loot as possible and escape before the ten-minute timer runs out.

**Live demo:** https://magicarchie.github.io/House-Rules/

---

## How to Run

Open `index.html` in Google Chrome. No installation or server required.

> For best performance use a desktop or laptop with a dedicated GPU.

---

## Features

- First-person movement with sprint and crouch
- Collectibles: cash bundles, gold bars, diamonds, casino chips
- Slot machines with limited uses and animated reels
- Wheel of Fortune activated by a Casino Token
- Vault accessible by elevator, protected by a laser security system
- Countdown timer — escape before it hits zero or you lose everything
- Custom HUD: money counter, timer, token status, interaction prompts, notifications
- Loading screen with progress bar
- End screen with final score and Play Again button

---

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| Mouse | Look around |
| Shift | Sprint |
| C | Crouch |
| E / Click | Interact |
| Esc | Release mouse |

---

## Technologies Used

- [A-Frame 1.7.0](https://aframe.io/) — WebXR / 3D scene framework
- [Three.js](https://threejs.org/) — underlying 3D renderer
- Blender — 3D modelling and GLB export
- HTML, CSS, JavaScript — game logic and HUD

---

## Project Structure

```
index.html          — scene, assets, HUD markup
js/game.js          — all game logic
css/hud.css         — HUD and UI styles
materials/          — 3D models, textures, audio, images
```

---

## Known Limitations

- Tested on keyboard and mouse only; VR controllers not yet supported
- Performance may vary on lower-end hardware due to the number of 3D models
- Designed for desktop Chrome; other browsers may have reduced compatibility

---

## Author

Αργύρης Σάββας — Τμήμα Τεχνών Ήχου και Εικόνας, Ιόνιο Πανεπιστήμιο
