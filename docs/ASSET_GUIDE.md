# Asset Guide

The first implementation uses procedural Babylon.js geometry so the game is playable without waiting for art purchases. Commercial assets can replace the placeholders without changing the core game loop.

## Purchase Priority

1. Web-ready dinosaur models with animations, ideally GLB/glTF.
2. Jungle vegetation kit with low-poly or mobile-friendly LODs.
3. Sci-fi outpost props: fences, warning lights, platforms, terminals.
4. Rifle or turret model with first-person readability.
5. HUD decals, icons, and loading art.

## Acceptance Criteria

- License allows commercial web use.
- GLB/glTF export is available or conversion is allowed.
- Texture sizes can be reduced to 1K or 2K.
- Dinosaur silhouettes remain readable at long range.
- Style is compatible with bright daytime jungle lighting.
- Assets do not require Unity or Unreal runtime dependencies.

## Integration Strategy

Keep game logic bound to enemy state, not specific meshes. Replace the generated enemy `TransformNode` contents with imported GLB roots while preserving the same root position, weak-point marker, radius, and health values.
