# QuizNest Architecture Notes

## Why split frontend/backend this way?

Three.js is a browser library — WebGL only runs client-side. There's no
"Python Three.js." So Python's role here is a JSON API: question banks,
XP, leaderboard. If you later want true multiplayer (live boss challenges
with friends), this same FastAPI backend can grow WebSocket routes without
restructuring anything on the 3D side.

## Scene graph overview

```
CityScene (THREE.Scene)
├── Lighting (ambient + directional "moon" + neon point lights)
├── Ground (circular platform + holographic grid)
├── Buildings[] (6x) — each has tower mesh, glow ring, label sprite, hit mesh
├── Drones[] — orbiting ambient life
└── Particles (floating dust, additive blending)
```

`QuizRoomScene` (not yet built in the scaffold — your next step) should
follow the same pattern: its own lighting rig, a "room" of transparent
floating panels, and it swaps in when `CameraController` finishes its
fly-in tween. Two options for how to actually swap scenes:

1. **Two full THREE.Scene objects**, toggle which one the renderer draws
   (simplest, what the scaffold assumes).
2. **One scene, disable/hide city objects** when entering a quiz room
   (better if you want to see the city fading in the background through
   the holographic room walls — more cinematic, more complex).

Start with option 1. Upgrade to option 2 once the core loop works.

## Click → zoom → quiz flow

```
User clicks building
  → CityScene raycasts, finds Building
  → onBuildingClick(categoryId, building) fires
  → CameraController.flyToBuilding() runs a GSAP tween on camera.position
  → on tween complete, QuizPanel.open(categoryId) fetches questions
    and shows the DOM-overlay panel
  → user answers → XPSystem awards XP → HUD updates → particle burst
    or glitch effect fires depending on correct/incorrect
  → after all questions, exitToCity() tweens the camera back out
```

## Where each requested feature lives

| Feature | File |
|---|---|
| Neon buildings | `entities/Building.js` |
| Drones | `entities/Drone.js` |
| Floating particles | `systems/ParticleSystem.js` |
| Dynamic weather | `systems/WeatherSystem.js` (stub — extend with rain/fog) |
| Bloom / cinematic lighting | `systems/PostProcessing.js` |
| Camera transitions | `utils/CameraController.js` |
| Quiz panels + answer cards | `ui/QuizPanel.js` + CSS in `index.html` |
| Correct-answer energy burst | `systems/ParticleSystem.js` → `spawnEnergyBurst()` |
| Wrong-answer glitch | `systems/PostProcessing.js` → `triggerWrongAnswerGlitch()` |
| XP / leveling | `game/GameState.js` |
| Achievements | `game/Achievements.js` (stub — pattern matches GameState) |
| Daily missions | `game/DailyMissions.js` (stub) |
| Boss challenges | `game/BossChallenge.js` (stub — a timed multi-question gauntlet) |
| Avatar customization | `entities/Avatar.js` (stub — start with swappable color/accessory meshes) |
| Leaderboard | backend `routes/leaderboard.py` + a frontend `ui/Leaderboard.js` you'll add |
| Sound | `systems/AudioManager.js` (stub — wrap Howler.js) |

Stubs are intentionally left as "next things to build" rather than filled
in, so the scaffold stays runnable without over-committing to designs
you haven't decided on yet (e.g., what a boss challenge actually feels
like is a creative choice worth prototyping in-engine).

## Suggested build order (see README roadmap) — do NOT build all 6
categories and every system before you have one working end-to-end loop.
Get: city → click building → fly camera → see one question → answer it →
XP bar moves. That loop, working badly, is worth more than 20 polished
files that don't connect yet.
