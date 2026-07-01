import {
  AbstractMesh,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  MirrorTexture,
  PhotoDome,
  Plane,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Texture,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { AimTarget, EnemyKind, EnemyState, LaneId, MissionPhase, MissionState, WeaponConfig, WeaponId, WeaponState } from "./types";
import { tuning, visualTheme } from "./config";
import { applyWeaponDamage, createEnemyState, enemyLabel, flattenedWaves, healthRatio, stepEnemy } from "../systems/simulation";

interface EnemyView {
  root: TransformNode;
  bodyMaterial: StandardMaterial;
  weakMaterial: StandardMaterial;
  weakMeshes: AbstractMesh[];
  shadow: AbstractMesh;
}

interface HudRefs {
  phase: HTMLElement;
  timer: HTMLElement;
  base: HTMLElement;
  baseFill: HTMLElement;
  ammo: HTMLElement;
  weaponLabel: HTMLElement;
  kills: HTMLElement;
  hostiles: HTMLElement;
  score: HTMLElement;
  streak: HTMLElement;
  progressFill: HTMLElement;
  target: HTMLElement;
  weak: HTMLElement;
  notice: HTMLElement;
  hitMarker: HTMLElement;
  damagePops: HTMLElement;
  minimapBlips: HTMLElement;
  nextWave: HTMLElement;
  enemyHealthbar: HTMLElement;
  enemyHealthbarFill: HTMLElement;
  overlay: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  action: HTMLButtonElement;
  restart: HTMLButtonElement;
  debug?: HTMLElement;
}

interface WeaponRigParts {
  receiver: AbstractMesh;
  barrel: AbstractMesh;
  muzzle: AbstractMesh;
  handguard: AbstractMesh;
  stock: AbstractMesh;
  magazine: AbstractMesh;
  scopeBody: AbstractMesh;
  scopeFront: AbstractMesh;
  scopeLens: AbstractMesh;
  sight: AbstractMesh;
}

const expandedWaves = flattenedWaves(tuning.waves);
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const habitatRootUrl = assetUrl("assets/models/polyhaven/dino-habitat/");
const polyhavenUpgradeRootUrl = assetUrl("assets/models/polyhaven/game-upgrade/");
const dinoRootUrl = assetUrl("assets/models/quaternius/animated-dinosaur-bundle/");
const natureKitRootUrl = assetUrl("assets/models/quaternius/stylized-nature-megakit/");
const survivalKitRootUrl = assetUrl("assets/models/quaternius/survival-pack/");
const medievalKitRootUrl = assetUrl("assets/models/quaternius/medieval-village-pack/");

export class DinoOutpostGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly glow: GlowLayer;
  private readonly hud: HudRefs;
  private readonly enemyViews = new Map<number, EnemyView>();

  private mission: MissionState = this.createMission("briefing");
  private weapon: WeaponState = this.createWeapon();
  private nextEnemyId = 1;
  private lastTimestamp = performance.now();
  private yaw = 0;
  private pitch = 0;
  private isFiring = false;
  private noticeSeconds = 0;
  private baseFlashSeconds = 0;
  private weaponKickSeconds = 0;
  private weaponRoot?: TransformNode;
  private weaponParts?: WeaponRigParts;
  private weaponGlbContainers: Partial<Record<WeaponId, TransformNode>> = {};
  private weaponGlbLoaded = false;
  private minimapBlipNodes = new Map<number, HTMLElement>();
  private currentAimTarget?: AimTarget;
  private readonly moveKeys = new Set<string>();
  private readonly cameraHome = new Vector3(0, 2.25, -14);
  private playerOffset = new Vector3(0, 0, 0);
  private playerVelocity = new Vector3(0, 0, 0);
  private cameraRoll = 0;
  private cameraShakeSeconds = 0;
  private cameraShakeAmplitude = 0;
  private movementBob = 0;
  private audio?: AudioContext;
  private richHabitatLoaded = false;
  private threatPulseSeconds = 0;
  private combo = 1;
  private comboSeconds = 0;
  private bestCombo = 1;
  private hitMarkerSeconds = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hudRoot: HTMLElement,
  ) {
    this.engine = new Engine(canvas, true, {
      antialias: true,
      adaptToDeviceRatio: true,
      powerPreference: "high-performance",
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString(`${visualTheme.skyTop}ff`);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = visualTheme.fogDensity;
    this.scene.fogColor = Color3.FromHexString(visualTheme.skyHorizon);
    this.camera = new UniversalCamera("defender-camera", new Vector3(0, 2.25, -14), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 160;
    this.camera.fov = 0.78;
    this.camera.setTarget(new Vector3(0, 1.7, 9));
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.glow = new GlowLayer("impact-glow", this.scene, { blurKernelSize: 48 });
    this.glow.intensity = 0.52;
    this.hud = this.createHud(hudRoot);
  }

  boot(): void {
    this.createScene();
    this.bindInput();
    this.showBriefing();
    this.engine.runRenderLoop(() => this.tick());
    window.addEventListener("resize", () => this.engine.resize());
  }

  private createMission(phase: MissionPhase): MissionState {
    return {
      phase,
      elapsedSeconds: 0,
      baseIntegrity: tuning.baseIntegrity,
      kills: 0,
      score: 0,
      spawnedEvents: new Set<number>(),
      activeEnemies: [],
    };
  }

  private createWeapon(): WeaponState {
    const weapon = tuning.weapons[tuning.defaultWeapon];
    return {
      id: weapon.id,
      ammo: weapon.magazineSize,
      cooldownSeconds: 0,
      reloadSecondsRemaining: 0,
      isReloading: false,
      isScoped: false,
    };
  }

  private currentWeapon(): WeaponConfig {
    return tuning.weapons[this.weapon.id];
  }

  private createHud(root: HTMLElement): HudRefs {
    root.innerHTML = `
      <div class="rain" aria-hidden="true"></div>
      <div class="ash" aria-hidden="true"></div>
      <div class="vignette" aria-hidden="true"></div>
      <div class="scanlines" aria-hidden="true"></div>
      <aside class="mission-panel">
        <strong class="wave-label">Wave <span data-hud="phase">0/10</span></strong>
        <span class="count-label">Countdown</span>
        <strong class="countdown" data-hud="timer">--</strong>
        <span class="base-label">Base HP</span>
        <strong class="base-number" data-hud="base">100%</strong>
        <div class="base-bar"><i data-hud="baseFill"></i></div>
        <span class="next-wave-label" data-hud="nextWave">All clear</span>
      </aside>
      <div class="compass" aria-hidden="true">
        <span>NW</span><b>330</b><b>345</b><strong>N</strong><b>15</b><b>30</b><span>NE</span><b>60</b><b>75</b><strong>E</strong>
      </div>
      <div class="mission-progress" aria-hidden="true"><i data-hud="progressFill"></i></div>
      <div class="reticle" aria-hidden="true"><span></span></div>
      <div class="hit-marker" data-hud="hitMarker" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="scope" aria-hidden="true"></div>
      <div class="damage-flash" aria-hidden="true"></div>
      <div class="threat-edge" aria-hidden="true"></div>
      <div class="damage-pop-layer" data-hud="damagePops" aria-hidden="true"></div>
      <div class="enemy-healthbar" data-hud="enemyHealthbar" aria-hidden="true">
        <span class="enemy-healthbar-fill" data-hud="enemyHealthbarFill"></span>
      </div>
      <aside class="minimap" aria-hidden="true">
        <i class="sweep"></i>
        <b class="player"></b>
        <div class="minimap-blips" data-hud="minimapBlips"></div>
      </aside>
      <aside class="target-panel">
        <div class="scope-lens"><span></span></div>
        <div>Weak Point</div>
        <strong data-hud="target">No target</strong>
        <span data-hud="weak">Weak point: none</span>
      </aside>
      <aside class="weapon-panel">
        <span data-hud="hostiles">0</span>
        <strong data-hud="ammo">28/28</strong>
        <em data-hud="weapon">${tuning.weapon.label}</em>
        <small>Kills <b data-hud="kills">0</b></small>
        <small>Score <b data-hud="score">0</b></small>
        <small>Streak <b data-hud="streak">x1</b></small>
      </aside>
      <div class="notice" data-hud="notice"></div>
      <section class="overlay" data-hud="overlay">
        <div class="briefing">
          <p class="eyebrow">Jungle perimeter emergency</p>
          <h1 data-hud="title">Dino Outpost</h1>
          <p data-hud="body">Hold the jungle perimeter for under two minutes. Aim, scope, hit weak points, and keep the base alive.</p>
          <div class="briefing-stats" aria-hidden="true">
            <span><b>110s</b><small>Hold</small></span>
            <span><b>6</b><small>Species</small></span>
            <span><b>3</b><small>Lanes</small></span>
          </div>
          <ul class="briefing-controls" aria-hidden="true">
            <li><kbd>WASD</kbd><span>Move</span></li>
            <li><kbd>Mouse</kbd><span>Aim</span></li>
            <li><kbd>LMB</kbd><span>Fire</span></li>
            <li><kbd>RMB</kbd><span>Scope</span></li>
            <li><kbd>R</kbd><span>Reload</span></li>
            <li><kbd>1 2 3</kbd><span>Swap weapon</span></li>
            <li><kbd>Esc</kbd><span>Release pointer</span></li>
          </ul>
          <div class="briefing-signal" aria-hidden="true"><i></i><span>Perimeter online</span></div>
          <div class="briefing-actions">
            <button data-hud="action">Start Mission</button>
            <button data-hud="restart" class="secondary">Restart</button>
          </div>
        </div>
      </section>
    `;
    const get = (name: string) => {
      const element = root.querySelector<HTMLElement>(`[data-hud="${name}"]`);
      if (!element) {
        throw new Error(`Missing HUD element: ${name}`);
      }
      return element;
    };
    const action = get("action") as HTMLButtonElement;
    const restart = get("restart") as HTMLButtonElement;
    action.addEventListener("click", () => this.startMission());
    restart.addEventListener("click", () => this.startMission());
    const debug = new URLSearchParams(location.search).has("debug") ? this.createDebugPanel(root) : undefined;
    return {
      phase: get("phase"),
      timer: get("timer"),
      base: get("base"),
      baseFill: get("baseFill"),
      ammo: get("ammo"),
      weaponLabel: get("weapon"),
      kills: get("kills"),
      hostiles: get("hostiles"),
      score: get("score"),
      streak: get("streak"),
      progressFill: get("progressFill"),
      target: get("target"),
      weak: get("weak"),
      notice: get("notice"),
      hitMarker: get("hitMarker"),
      damagePops: get("damagePops"),
      minimapBlips: get("minimapBlips"),
      nextWave: get("nextWave"),
      enemyHealthbar: get("enemyHealthbar"),
      enemyHealthbarFill: get("enemyHealthbarFill"),
      overlay: get("overlay"),
      title: get("title"),
      body: get("body"),
      action,
      restart,
      debug,
    };
  }

  private createDebugPanel(root: HTMLElement): HTMLElement {
    const debug = document.createElement("aside");
    debug.className = "debug-panel";
    debug.innerHTML = `
      <strong>AI tweak surface</strong>
      <label>Raptor speed <input data-debug="raptorSpeed" type="range" min="1.2" max="4" step="0.1" value="${tuning.enemies.raptor.speed}"></label>
      <label>Weapon damage <input data-debug="damage" type="range" min="20" max="80" step="1" value="${tuning.weapon.damage}"></label>
      <label>Light intensity <input data-debug="light" type="range" min="0.7" max="2.2" step="0.05" value="${visualTheme.lightIntensity}"></label>
      <p>Use this panel in ?debug to show how feedback becomes fast visual/parameter edits.</p>
    `;
    root.append(debug);
    debug.querySelector<HTMLInputElement>('[data-debug="raptorSpeed"]')?.addEventListener("input", (event) => {
      tuning.enemies.raptor.speed = Number((event.target as HTMLInputElement).value);
    });
    debug.querySelector<HTMLInputElement>('[data-debug="damage"]')?.addEventListener("input", (event) => {
      tuning.weapon.damage = Number((event.target as HTMLInputElement).value);
    });
    debug.querySelector<HTMLInputElement>('[data-debug="light"]')?.addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      this.scene.lights.forEach((light) => {
        light.intensity = value;
      });
    });
    return debug;
  }

  private createScene(): void {
    const hemi = new HemisphericLight("soft-jungle-fill", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = visualTheme.lightIntensity * 0.9;
    const sun = new HemisphericLight("warm-sun-bounce", new Vector3(-0.65, 0.85, -0.35), this.scene);
    sun.diffuse = Color3.FromHexString(visualTheme.sun);
    sun.groundColor = Color3.FromHexString(visualTheme.foliageDark);
    sun.intensity = visualTheme.lightIntensity * 0.62;
    const key = new DirectionalLight("jungle-sun-key", new Vector3(-0.42, -0.78, 0.36), this.scene);
    key.diffuse = Color3.FromHexString("#fff1c8");
    key.specular = Color3.FromHexString("#d5e2ff");
    key.intensity = 1.35;
    this.scene.imageProcessingConfiguration.contrast = 1.18;
    this.scene.imageProcessingConfiguration.exposure = 1.08;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;

    const sky = new PhotoDome("blue-grotto-hdri-dome", assetUrl("assets/hdris/polyhaven/blue_grotto_tonemapped.jpg"), {
      resolution: 32,
      size: 1000,
    }, this.scene);
    sky.mesh.rotation.y = Math.PI * 0.18;
    sky.mesh.isPickable = false;

    const ground = MeshBuilder.CreateGround("wet-jungle-ground", { width: 64, height: 96, subdivisions: 24 }, this.scene);
    ground.material = this.createTexturedGroundMaterial(
      "ground-material",
      assetUrl("assets/textures/polyhaven/dino-habitat/brown_mud_leaves_01/brown_mud_leaves_01_diff_1k.jpg"),
      assetUrl("assets/textures/polyhaven/dino-habitat/brown_mud_leaves_01/brown_mud_leaves_01_nor_gl_1k.jpg"),
      8,
      12,
    );
    ground.position.z = 18;

    this.createWetlandChannel();
    void this.createMountainBackdrop();
    this.createBackdropCanopy();
    void this.createDistantPineRing();
    this.createOutpostForeground();
    void this.createOutpostProps();
    this.createLaneGuides();
    this.createWeaponRig();
    void this.createOutpost();
    void this.createJungle();
    void this.createForestDetails();
    void this.loadRichHabitat();
  }

  private createBackdropCanopy(): void {
    const canopyMat = this.makeMaterial("distant-canopy", visualTheme.foliageDark, 0.02);
    canopyMat.alpha = 0.74;
    const trunkMat = this.makeMaterial("distant-trunks", "#332719", 0.01);
    trunkMat.alpha = 0.74;
    const mistMat = this.makeMaterial("valley-mist", visualTheme.skyHorizon, 0.04);
    mistMat.alpha = 0.18;

    // Procedural canopy reduced from 34 to 18, lowered, spread wider so it reads as a tree line.
    for (let index = 0; index < 18; index += 1) {
      const x = -36 + index * 4.05 + Math.sin(index * 1.91) * 1.4;
      const z = 38 + Math.sin(index * 0.77) * 11 + (index % 4) * 1.6;
      const height = 2.6 + (index % 5) * 0.3;
      const trunk = MeshBuilder.CreateCylinder(`backdrop-trunk-${index}`, { height, diameter: 0.18 + (index % 3) * 0.04 }, this.scene);
      trunk.position = new Vector3(x, height / 2, z);
      trunk.rotation.z = Math.sin(index) * 0.12;
      trunk.material = trunkMat;
      trunk.isPickable = false;

      const crown = MeshBuilder.CreateSphere(`backdrop-crown-${index}`, { diameter: 2.2 + (index % 4) * 0.4, segments: 8 }, this.scene);
      crown.position = new Vector3(x + Math.sin(index * 0.5) * 0.25, height + 0.2, z - 0.25);
      crown.scaling = new Vector3(1.15, 0.58, 0.86);
      crown.material = canopyMat;
      crown.isPickable = false;
    }

    for (let layer = 0; layer < 3; layer += 1) {
      const mist = MeshBuilder.CreatePlane(`mist-sheet-${layer}`, { width: 96, height: 6 + layer * 2 }, this.scene);
      mist.position = new Vector3(0, 2.6 + layer * 1.3, 32 + layer * 10);
      mist.rotation.x = Math.PI / 2;
      mist.material = mistMat;
      mist.isPickable = false;
    }
  }

  private async createDistantPineRing(): Promise<void> {
    // Pine variants (low-poly stylized) break up the procedural lollipop silhouette.
    // Placed at mid-far range so fog softens edges and they read as a forest skyline.
    const pineFiles = [
      "Pine.glb",
      "Pine-699sFuLCN2.glb",
      "Pine-79gmlLnweB.glb",
      "Pine-Zt62gceKXZ.glb",
      "Pine-rfnxJv0Rqa.glb",
    ];
    const placements: Array<{ x: number; z: number; scale: number; rotationY: number }> = [
      { x: -42, z: 42, scale: 3.4, rotationY: 0.2 },
      { x: -34, z: 50, scale: 3.0, rotationY: 1.1 },
      { x: -22, z: 55, scale: 2.6, rotationY: 0.4 },
      { x: -10, z: 58, scale: 2.8, rotationY: 2.1 },
      { x: 4, z: 56, scale: 2.4, rotationY: 0.7 },
      { x: 18, z: 58, scale: 2.9, rotationY: 1.6 },
      { x: 30, z: 54, scale: 3.1, rotationY: 0.3 },
      { x: 42, z: 46, scale: 3.3, rotationY: -0.8 },
      { x: -50, z: 26, scale: 2.6, rotationY: 1.2 },
      { x: 48, z: 22, scale: 2.7, rotationY: -1.3 },
      { x: -28, z: 30, scale: 2.4, rotationY: 0.9 },
      { x: 28, z: 34, scale: 2.5, rotationY: -0.5 },
    ];
    for (const [index, placement] of placements.entries()) {
      const file = pineFiles[index % pineFiles.length];
      try {
        await this.placeGlb(natureKitRootUrl, file, new Vector3(placement.x, 0.04, placement.z), placement.scale, placement.rotationY);
      } catch (error) {
        console.warn(`Failed to load pine ${file}`, error);
      }
    }
  }

  private async createMountainBackdrop(): Promise<void> {
    const placements: Array<{ file: string; position: Vector3; scale: number; rotationY: number }> = [
      // Distant forward ring — fog softens edges; scales restrained to avoid iter02 "giant slab" regression.
      { file: "mountainside.glb", position: new Vector3(-32, 0.1, 70), scale: 1.6, rotationY: 0.3 },
      { file: "mountainside.glb", position: new Vector3(-12, 0.1, 88), scale: 2.1, rotationY: 0.95 },
      { file: "mountainside.glb", position: new Vector3(8, 0.1, 96), scale: 2.4, rotationY: 1.18 },
      { file: "mountainside.glb", position: new Vector3(32, 0.1, 78), scale: 1.7, rotationY: -0.45 },
      // Far ring fillers (replaces the iter-15 rock_face banners that read as floating signs).
      { file: "mountainside.glb", position: new Vector3(-22, 0.1, 92), scale: 1.5, rotationY: 0.7 },
      { file: "mountainside.glb", position: new Vector3(22, 0.1, 90), scale: 1.4, rotationY: -0.6 },
      // Back-of-player ridge — closes the valley so a 180° rotation does not reveal an empty horizon.
      { file: "mountainside.glb", position: new Vector3(-22, 0.1, -34), scale: 1.5, rotationY: Math.PI + 0.3 },
      { file: "mountainside.glb", position: new Vector3(22, 0.1, -38), scale: 1.6, rotationY: Math.PI - 0.4 },
      { file: "mountainside.glb", position: new Vector3(0, 0.1, -52), scale: 2.0, rotationY: Math.PI },
    ];

    for (const placement of placements) {
      try {
        await this.placeGlb(habitatRootUrl, placement.file, placement.position, placement.scale, placement.rotationY);
      } catch (error) {
        console.warn(`Failed to load mountain backdrop ${placement.file}`, error);
      }
    }
  }

  private createOutpostForeground(): void {
    // Keep procedural lamps as a cheap warm-light cue; everything else comes from GLBs in createOutpostProps.
    const lightMat = this.makeMaterial("outpost-lamp", "#ffe08a", 1.25);
    for (const side of [-1, 1]) {
      const lamp = MeshBuilder.CreateSphere(`foreground-lamp-${side}`, { diameter: 0.22, segments: 10 }, this.scene);
      lamp.position = new Vector3(side * 7.15, 0.98, -8.68);
      lamp.material = lightMat;
      lamp.isPickable = false;
    }
  }

  private async createOutpostProps(): Promise<void> {
    // Replace procedural rails with a real wooden fence GLB along the perimeter,
    // plus survival-kit props as outpost identity.
    const fenceY = 0.04;
    const fenceZ = -8.6;
    const fencePlacements: Array<{ x: number; rotationY: number; scale: number }> = [
      { x: -7.2, rotationY: 0, scale: 1.6 },
      { x: -4.8, rotationY: 0, scale: 1.6 },
      { x: -2.4, rotationY: 0, scale: 1.6 },
      { x: 2.4, rotationY: 0, scale: 1.6 },
      { x: 4.8, rotationY: 0, scale: 1.6 },
      { x: 7.2, rotationY: 0, scale: 1.6 },
    ];
    for (const placement of fencePlacements) {
      try {
        await this.placeGlb(
          medievalKitRootUrl,
          "Fence.glb",
          new Vector3(placement.x, fenceY, fenceZ),
          placement.scale,
          placement.rotationY,
        );
      } catch (error) {
        console.warn("Failed to load fence GLB", error);
      }
    }

    const props: Array<{ rootUrl: string; file: string; position: Vector3; scale: number; rotationY?: number }> = [
      // Outpost identity props clustered behind/beside the player
      { rootUrl: survivalKitRootUrl, file: "Radio.glb", position: new Vector3(-6.6, 0.5, -11.6), scale: 1.6, rotationY: 0.4 },
      { rootUrl: survivalKitRootUrl, file: "Gas Can.glb", position: new Vector3(6.5, 0.04, -11.4), scale: 1.5, rotationY: -0.6 },
      // Log row barricade — all on the ground (y=0.04) so no float risk regardless of GLB dims.
      { rootUrl: survivalKitRootUrl, file: "Wood Log.glb", position: new Vector3(-4.6, 0.04, -10.9), scale: 1.4, rotationY: 1.2 },
      { rootUrl: survivalKitRootUrl, file: "Wood Log.glb", position: new Vector3(-3.4, 0.04, -10.7), scale: 1.4, rotationY: 1.35 },
      { rootUrl: survivalKitRootUrl, file: "Wood Log.glb", position: new Vector3(3.4, 0.04, -10.7), scale: 1.4, rotationY: -1.05 },
      { rootUrl: survivalKitRootUrl, file: "Wood Log.glb", position: new Vector3(4.6, 0.04, -10.9), scale: 1.4, rotationY: -1.2 },
      { rootUrl: survivalKitRootUrl, file: "First Aid Kit.glb", position: new Vector3(5.6, 0.04, -10.4), scale: 1.4, rotationY: 0.2 },
      { rootUrl: survivalKitRootUrl, file: "Tent.glb", position: new Vector3(8.6, 0.04, -11.0), scale: 1.4, rotationY: -0.3 },
      { rootUrl: survivalKitRootUrl, file: "Wooden Torch.glb", position: new Vector3(-8.2, 0.04, -10.6), scale: 1.6, rotationY: 0.1 },
      { rootUrl: medievalKitRootUrl, file: "Barrel.glb", position: new Vector3(-7.0, 0.04, -10.0), scale: 1.2, rotationY: 0.5 },
      { rootUrl: medievalKitRootUrl, file: "Crate.glb", position: new Vector3(7.0, 0.04, -10.0), scale: 1.2, rotationY: -0.5 },
    ];
    for (const prop of props) {
      try {
        await this.placeGlb(prop.rootUrl, prop.file, prop.position, prop.scale, prop.rotationY ?? 0);
      } catch (error) {
        console.warn(`Failed to load outpost prop ${prop.file}`, error);
      }
    }
  }

  private createLaneGuides(): void {
    const guideMat = this.makeMaterial("lane-guide-amber", "#d7b75f", 0.95);
    guideMat.alpha = 0.58;
    const dangerMat = this.makeMaterial("lane-guide-danger", visualTheme.hudDanger, 1.15);
    dangerMat.alpha = 0.72;
    const laneIds: LaneId[] = ["left", "center", "right"];

    laneIds.forEach((lane, laneIndex) => {
      const x = tuning.lanes[lane];
      const start = new Vector3(x, 0.08, tuning.attackLineZ + 1.4);
      const end = new Vector3(x, 0.08, tuning.enemySpawnZ + 5);
      const line = MeshBuilder.CreateTube(`lane-guide-${lane}`, { path: [start, end], radius: lane === "center" ? 0.035 : 0.022, tessellation: 6 }, this.scene);
      line.material = lane === "center" ? dangerMat : guideMat;
      line.isPickable = false;

      for (let index = 0; index < 6; index += 1) {
        const beacon = MeshBuilder.CreateCylinder(`lane-beacon-${lane}-${index}`, { height: 0.04, diameter: lane === "center" ? 0.34 : 0.24, tessellation: 12 }, this.scene);
        beacon.position = new Vector3(x + Math.sin(index + laneIndex) * 0.16, 0.1, tuning.attackLineZ + 3.2 + index * 2.9);
        beacon.material = index % 2 === 0 ? guideMat : dangerMat;
        beacon.isPickable = false;
      }
    });
  }

  private createWeaponRig(): void {
    const root = new TransformNode("first-person-weapon", this.scene);
    root.parent = this.camera;
    root.scaling = new Vector3(0.68, 0.68, 0.68);
    const metal = this.makeMaterial("weapon-gunmetal", "#1f282b", 0.04);
    const dark = this.makeMaterial("weapon-rubber", "#090d0f", 0.02);
    const trim = this.makeMaterial("weapon-trim", "#6f623f", 0.12);
    const lens = this.makeMaterial("weapon-lens", "#211a38", 0.22);
    const glove = this.makeMaterial("weapon-support-glove", "#373d39", 0.045);
    const sleeve = this.makeMaterial("weapon-support-sleeve", "#26352f", 0.025);
    const glow = this.makeMaterial("weapon-sight-glow", visualTheme.hudDanger, 1.2);

    const receiver = MeshBuilder.CreateBox("weapon-receiver", { width: 0.24, height: 0.14, depth: 0.62 }, this.scene);
    receiver.parent = root;
    receiver.position = new Vector3(0, 0, 0);
    receiver.material = metal;

    const barrel = MeshBuilder.CreateCylinder("weapon-barrel", { height: 1.08, diameter: 0.048 }, this.scene);
    barrel.parent = root;
    barrel.position = new Vector3(0, 0.025, 0.78);
    barrel.rotation.x = Math.PI / 2;
    barrel.material = metal;

    const muzzle = MeshBuilder.CreateCylinder("weapon-muzzle", { height: 0.08, diameter: 0.068, tessellation: 14 }, this.scene);
    muzzle.parent = root;
    muzzle.position = new Vector3(0, 0.025, 1.34);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.material = dark;

    const handguard = MeshBuilder.CreateBox("weapon-handguard", { width: 0.2, height: 0.1, depth: 0.5 }, this.scene);
    handguard.parent = root;
    handguard.position = new Vector3(0, -0.02, 0.38);
    handguard.material = trim;

    const stock = MeshBuilder.CreateBox("weapon-stock", { width: 0.2, height: 0.12, depth: 0.34 }, this.scene);
    stock.parent = root;
    stock.position = new Vector3(0, -0.02, -0.36);
    stock.rotation.x = -0.12;
    stock.material = dark;

    const grip = MeshBuilder.CreateBox("weapon-grip", { width: 0.11, height: 0.28, depth: 0.13 }, this.scene);
    grip.parent = root;
    grip.position = new Vector3(0, -0.18, -0.06);
    grip.rotation.x = 0.28;
    grip.material = dark;

    const magazine = MeshBuilder.CreateBox("weapon-magazine", { width: 0.13, height: 0.24, depth: 0.12 }, this.scene);
    magazine.parent = root;
    magazine.position = new Vector3(0, -0.18, 0.12);
    magazine.rotation.x = -0.12;
    magazine.material = trim;

    const scopeBody = MeshBuilder.CreateCylinder("weapon-scope-body", { height: 0.54, diameter: 0.13, tessellation: 16 }, this.scene);
    scopeBody.parent = root;
    scopeBody.position = new Vector3(0, 0.19, 0.16);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.material = dark;

    const scopeFront = MeshBuilder.CreateCylinder("weapon-scope-front", { height: 0.05, diameter: 0.18, tessellation: 18 }, this.scene);
    scopeFront.parent = root;
    scopeFront.position = new Vector3(0, 0.19, 0.46);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.material = dark;

    const scopeLens = MeshBuilder.CreateCylinder("weapon-scope-lens", { height: 0.012, diameter: 0.15, tessellation: 18 }, this.scene);
    scopeLens.parent = root;
    scopeLens.position = new Vector3(0, 0.19, 0.49);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.material = lens;

    for (const z of [-0.04, 0.26]) {
      const mount = MeshBuilder.CreateBox(`weapon-scope-mount-${z}`, { width: 0.06, height: 0.08, depth: 0.035 }, this.scene);
      mount.parent = root;
      mount.position = new Vector3(0, 0.1, z);
      mount.material = metal;
    }

    const sight = MeshBuilder.CreateTorus("weapon-sight", { diameter: 0.14, thickness: 0.014, tessellation: 16 }, this.scene);
    sight.parent = root;
    sight.position = new Vector3(0, 0.19, 0.49);
    sight.rotation.x = Math.PI / 2;
    sight.material = glow;

    const supportForearm = MeshBuilder.CreateCylinder("weapon-support-forearm", { height: 0.62, diameter: 0.13, tessellation: 12 }, this.scene);
    supportForearm.parent = root;
    supportForearm.position = new Vector3(-0.28, -0.3, 0.2);
    supportForearm.rotation.x = Math.PI / 2.8;
    supportForearm.rotation.z = -0.34;
    supportForearm.material = sleeve;

    const supportPalm = MeshBuilder.CreateSphere("weapon-support-palm", { diameter: 0.22, segments: 12 }, this.scene);
    supportPalm.parent = root;
    supportPalm.position = new Vector3(-0.14, -0.08, 0.46);
    supportPalm.scaling = new Vector3(1.18, 0.68, 0.88);
    supportPalm.rotation.z = -0.18;
    supportPalm.material = glove;

    for (let finger = 0; finger < 4; finger += 1) {
      const digit = MeshBuilder.CreateCylinder(`weapon-support-finger-${finger}`, { height: 0.22, diameter: 0.038, tessellation: 8 }, this.scene);
      digit.parent = root;
      digit.position = new Vector3(-0.19 + finger * 0.055, 0.035, 0.42 + Math.sin(finger) * 0.015);
      digit.rotation.x = Math.PI / 2.15;
      digit.rotation.z = -0.18;
      digit.material = glove;
    }

    const triggerHand = MeshBuilder.CreateSphere("weapon-trigger-hand", { diameter: 0.2, segments: 12 }, this.scene);
    triggerHand.parent = root;
    triggerHand.position = new Vector3(0.08, -0.19, -0.08);
    triggerHand.scaling = new Vector3(0.88, 0.65, 1.05);
    triggerHand.rotation.z = 0.22;
    triggerHand.material = glove;

    root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = false;
    });
    this.weaponRoot = root;
    this.weaponParts = {
      receiver,
      barrel,
      muzzle,
      handguard,
      stock,
      magazine,
      scopeBody,
      scopeFront,
      scopeLens,
      sight,
    };
    this.applyWeaponVisual();
    void this.loadWeaponGlbs(root);
  }

  private async loadWeaponGlbs(root: TransformNode): Promise<void> {
    // Each weapon gets a real rifle GLB layered over the procedural rig.
    // Per-weapon transform compensates for varying GLB pivots/orientations from Poly Pizza.
    // Each GLB is bounds-centered (XZ centroid + Y bottom) into its container so the container
    // position controls where the visible body sits. rot.y = π/2 turns the Quaternius pack's
    // native -X-forward into Babylon's +Z-forward.
    // Per inspect-weapon spec: model native sizes (X extent / Y / Z):
    //   marksman 7.29 / 1.48 / 0.46 — barrel along -X
    //   carbine  7.24 / 1.20 / 0.45 — barrel along -X
    //   shotgun  11.82 / 2.51 / 1.26 — barrel along -X (Kar98k is biggest natively)
    // rot.y = π/2 turns model's -X-forward into Babylon's +Z-forward.
    // Scales pick visible rifle ~0.5–0.9 units long after weaponRoot.scaling=0.68.
    const configs: Record<WeaponId, { file: string; pos: Vector3; rot: Vector3; scale: number }> = {
      marksman: {
        file: "sniper_quaternius.glb",
        pos: new Vector3(-0.05, 0.05, 0.4),
        rot: new Vector3(0, Math.PI / 2, 0),
        scale: 0.45,
      },
      carbine: {
        file: "sniper_quaternius_alt.glb",
        pos: new Vector3(-0.05, 0.05, 0.4),
        rot: new Vector3(0, Math.PI / 2, 0),
        scale: 0.45,
      },
      shotgun: {
        file: "kar98k.glb",
        pos: new Vector3(-0.05, 0.1, 0.4),
        rot: new Vector3(0, Math.PI / 2, 0),
        scale: 0.26,
      },
    };
    const rootUrl = assetUrl("assets/models/polypizza/weapons/");
    await Promise.all(
      (Object.entries(configs) as Array<[WeaponId, (typeof configs)[WeaponId]]>).map(async ([id, cfg]) => {
        try {
          const result = await SceneLoader.ImportMeshAsync("", rootUrl, cfg.file, this.scene);
          // Outer node carries all the controlled transforms (pos / rot / scale).
          const outer = new TransformNode(`weapon-glb-${id}`, this.scene);
          outer.parent = root;
          outer.position = cfg.pos;
          outer.rotation = cfg.rot;
          outer.scaling = new Vector3(cfg.scale, cfg.scale, cfg.scale);
          // Inner node carries ONLY the bounds-centering offset, no rotation/scale.
          // Direct `mesh.parent = inner` (NOT setParent) keeps the glTF loader's natural local
          // transform and lets the outer's rotation/scale apply cleanly without compensation.
          const inner = new TransformNode(`weapon-glb-inner-${id}`, this.scene);
          inner.parent = outer;
          const bounds = this.getImportedBounds(result.meshes);
          if (bounds) {
            inner.position = new Vector3(
              -(bounds.min.x + bounds.max.x) / 2,
              -(bounds.min.y + bounds.max.y) / 2,
              -(bounds.min.z + bounds.max.z) / 2,
            );
          }
          result.meshes.forEach((mesh) => {
            if (!mesh.parent) {
              mesh.parent = inner;
            }
            mesh.isPickable = false;
          });
          result.animationGroups.forEach((g) => g.stop());
          this.weaponGlbContainers[id] = outer;
          outer.setEnabled(false);
        } catch (error) {
          console.warn(`Failed to load weapon GLB ${cfg.file}`, error);
        }
      }),
    );
    if (Object.keys(this.weaponGlbContainers).length === 0) {
      return;
    }
    this.weaponGlbLoaded = true;
    // Hide procedural meshes now that real GLBs are available.
    if (this.weaponParts) {
      const parts = this.weaponParts;
      [parts.receiver, parts.barrel, parts.muzzle, parts.handguard, parts.stock, parts.magazine, parts.scopeBody, parts.scopeFront, parts.scopeLens, parts.sight]
        .forEach((m) => { m.isVisible = false; });
      root.getChildMeshes().forEach((m) => {
        if (m.name.startsWith("weapon-support") || m.name === "weapon-trigger-hand") {
          m.isVisible = false;
        }
      });
    }
    this.applyWeaponVisual();
  }

  private applyWeaponVisual(): void {
    const id = this.weapon.id;

    // GLB rifles: swap which container is enabled. Procedural rig stays hidden.
    if (this.weaponGlbLoaded) {
      (Object.entries(this.weaponGlbContainers) as Array<[WeaponId, TransformNode]>).forEach(([glbId, container]) => {
        container.setEnabled(glbId === id);
      });
      return;
    }

    if (!this.weaponParts) {
      return;
    }
    const parts = this.weaponParts;
    const hasScope = id !== "shotgun";

    parts.scopeBody.isVisible = hasScope;
    parts.scopeFront.isVisible = hasScope;
    parts.scopeLens.isVisible = hasScope;
    parts.sight.isVisible = hasScope;

    if (id === "marksman") {
      parts.receiver.scaling = new Vector3(1, 1, 1.08);
      parts.barrel.position.z = 0.82;
      parts.barrel.scaling = new Vector3(1, 1.18, 1);
      parts.muzzle.position.z = 1.42;
      parts.muzzle.scaling = new Vector3(1, 1, 1);
      parts.handguard.position.z = 0.42;
      parts.handguard.scaling = new Vector3(1, 1, 1.08);
      parts.magazine.scaling = new Vector3(1, 0.82, 1);
      parts.scopeBody.scaling = new Vector3(1, 1.2, 1);
      parts.scopeFront.scaling = new Vector3(1.12, 1, 1.12);
    } else if (id === "carbine") {
      parts.receiver.scaling = new Vector3(1, 1, 0.94);
      parts.barrel.position.z = 0.72;
      parts.barrel.scaling = new Vector3(1, 0.88, 1);
      parts.muzzle.position.z = 1.18;
      parts.muzzle.scaling = new Vector3(0.9, 0.9, 0.9);
      parts.handguard.position.z = 0.34;
      parts.handguard.scaling = new Vector3(0.95, 1, 0.88);
      parts.magazine.scaling = new Vector3(1, 1.1, 1);
      parts.scopeBody.scaling = new Vector3(0.92, 0.86, 0.92);
      parts.scopeFront.scaling = new Vector3(0.95, 0.9, 0.95);
    } else {
      parts.receiver.scaling = new Vector3(1.12, 1.04, 0.9);
      parts.barrel.position.z = 0.62;
      parts.barrel.scaling = new Vector3(1.35, 0.74, 1.35);
      parts.muzzle.position.z = 1;
      parts.muzzle.scaling = new Vector3(1.65, 0.72, 1.65);
      parts.handguard.position.z = 0.3;
      parts.handguard.scaling = new Vector3(1.25, 1.08, 0.8);
      parts.magazine.scaling = new Vector3(0.75, 0.55, 1);
    }
  }

  private createTexturedGroundMaterial(name: string, diffuseUrl: string, normalUrl: string, uScale: number, vScale: number): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    const diffuse = new Texture(diffuseUrl, this.scene);
    diffuse.uScale = uScale;
    diffuse.vScale = vScale;
    const normal = new Texture(normalUrl, this.scene);
    normal.uScale = uScale;
    normal.vScale = vScale;
    mat.diffuseTexture = diffuse;
    mat.bumpTexture = normal;
    mat.diffuseColor = Color3.FromHexString("#b99672").scale(0.82);
    mat.specularColor = new Color3(0.2, 0.19, 0.15);
    return mat;
  }

  private createWetlandChannel(): void {
    const waterMat = this.makeMaterial("shallow-river-water", "#356e6a", 0.04);
    waterMat.alpha = 0.5;
    waterMat.specularColor = Color3.FromHexString("#cfeae3");
    waterMat.specularPower = 96;
    waterMat.backFaceCulling = false;

    const pools = [
      { x: -0.2, z: 1.8, width: 3.4, length: 5.4 },
      { x: 0.35, z: 7.2, width: 4.7, length: 7.2 },
      { x: -0.15, z: 13.8, width: 5.4, length: 8.6 },
      { x: 0.2, z: 21.2, width: 5.8, length: 9.4 },
      { x: -0.45, z: 29.4, width: 5.1, length: 8.4 },
      { x: 0.3, z: 37.2, width: 4.6, length: 7.5 },
      { x: -0.1, z: 45.2, width: 3.8, length: 6.8 },
    ];

    // Largest mid-field pool gets a sky reflection mirror; others share the cheap translucent material.
    const reflectiveIndex = 3;
    const reflectivePoolPlaneY = 0.052 + reflectiveIndex * 0.0005;
    const reflectiveMat = this.createReflectiveWaterMaterial(reflectivePoolPlaneY);

    pools.forEach((pool, index) => {
      const water = MeshBuilder.CreateDisc(`shallow-river-pool-${index}`, { radius: 1, tessellation: 48 }, this.scene);
      water.position = new Vector3(pool.x, 0.052 + index * 0.0005, pool.z);
      water.rotation.x = Math.PI / 2;
      water.rotation.z = Math.sin(index * 1.7) * 0.14;
      water.scaling = new Vector3(pool.width, pool.length, 1);
      water.material = index === reflectiveIndex ? reflectiveMat : waterMat;
      water.isPickable = false;
    });

    // Subtle alpha breathing on reflective pool to imply moving water (mirror reflection
    // already updates with camera breathing/recoil, so we don't need UV scrolling).
    let waterT = 0;
    const baseAlpha = reflectiveMat.alpha;
    this.scene.onBeforeRenderObservable.add(() => {
      waterT += this.engine.getDeltaTime() / 1000;
      reflectiveMat.alpha = baseAlpha + Math.sin(waterT * 0.9) * 0.04;
    });

    const bankMat = this.makeMaterial("wet-mud-bank", "#20362c", 0.01);
    bankMat.alpha = 0.42;
    bankMat.specularColor = Color3.FromHexString("#789487").scale(0.24);

    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const bank = MeshBuilder.CreateDisc(`wet-bank-${side}-${index}`, { radius: 1, tessellation: 28 }, this.scene);
        bank.position = new Vector3(side * (4.1 + (index % 2) * 0.8), 0.053, 8 + index * 10.5);
        bank.rotation.x = Math.PI / 2;
        bank.rotation.z = side * 0.2 + index * 0.35;
        bank.scaling = new Vector3(1.4 + index * 0.12, 3.2 + (index % 2) * 0.9, 1);
        bank.material = bankMat;
        bank.isPickable = false;
      }
    }

    const rockMat = this.makeMaterial("river-edge-rocks", "#39443d", 0.04);
    rockMat.specularColor = Color3.FromHexString("#7d8f86").scale(0.26);
    const rockPositions = [
      new Vector3(-5.1, 0.16, 2.4),
      new Vector3(5.4, 0.14, 4.8),
      new Vector3(-6.2, 0.18, 10.5),
      new Vector3(5.8, 0.15, 14.2),
      new Vector3(-5.6, 0.14, 24.6),
      new Vector3(5.8, 0.16, 35.5),
    ];

    // Damp ground patches scattered outside the river channel — implies rain/humidity
    // and breaks up the uniform brown ground texture.
    const dampMat = this.makeMaterial("ground-damp-patch", "#1f1d18", 0.01);
    dampMat.alpha = 0.55;
    dampMat.specularColor = Color3.FromHexString("#5a6358").scale(0.22);
    const dampPatches: Array<{ x: number; z: number; w: number; l: number; rot: number }> = [
      { x: -9.2, z: 5, w: 2.4, l: 3.1, rot: 0.3 },
      { x: 9.4, z: 11, w: 2.8, l: 3.6, rot: -0.5 },
      { x: -10.8, z: 19, w: 3.1, l: 3.4, rot: 0.7 },
      { x: 10.6, z: 26, w: 2.6, l: 3.8, rot: -0.2 },
      { x: -7.4, z: 32, w: 2.3, l: 3.0, rot: 1.2 },
      { x: 8.8, z: 38, w: 2.7, l: 3.3, rot: 0.6 },
      { x: -11.2, z: 44, w: 2.4, l: 3.2, rot: -0.8 },
      { x: 11.0, z: 48, w: 2.5, l: 3.0, rot: 0.4 },
      { x: -3.8, z: -4, w: 1.6, l: 2.2, rot: 0.9 },
      { x: 4.2, z: -3, w: 1.4, l: 2.0, rot: -1.1 },
    ];
    dampPatches.forEach((patch, index) => {
      const disc = MeshBuilder.CreateDisc(`ground-damp-${index}`, { radius: 1, tessellation: 24 }, this.scene);
      disc.position = new Vector3(patch.x, 0.04, patch.z);
      disc.rotation.x = Math.PI / 2;
      disc.rotation.z = patch.rot;
      disc.scaling = new Vector3(patch.w, patch.l, 1);
      disc.material = dampMat;
      disc.isPickable = false;
    });

    rockPositions.forEach((position, index) => {
      const rock = MeshBuilder.CreateSphere(`river-edge-rock-${index}`, { diameter: 1, segments: 8 }, this.scene);
      rock.position = position;
      rock.scaling = new Vector3(0.75 + (index % 3) * 0.2, 0.16 + (index % 2) * 0.04, 0.48 + (index % 4) * 0.14);
      rock.rotation.y = index * 0.57;
      rock.material = rockMat;
      rock.isPickable = false;
    });
  }

  private createReflectiveWaterMaterial(planeY: number): StandardMaterial {
    const mat = new StandardMaterial("reflective-river-water", this.scene);
    mat.diffuseColor = Color3.FromHexString("#356e6a");
    mat.alpha = 0.7;
    mat.specularColor = Color3.FromHexString("#cfeae3");
    mat.specularPower = 96;
    mat.backFaceCulling = false;

    const mirror = new MirrorTexture("water-mirror", 256, this.scene, true);
    mirror.mirrorPlane = new Plane(0, -1, 0, planeY);
    mirror.level = 0.55;
    mirror.renderList = null;
    mat.reflectionTexture = mirror;
    mat.useReflectionFresnelFromSpecular = true;
    return mat;
  }

  private async loadRichHabitat(): Promise<void> {
    if (this.richHabitatLoaded) {
      return;
    }
    this.richHabitatLoaded = true;
    const placements: Array<{ file: string; position: Vector3; scale: number; rotationY?: number }> = [
      { file: "modular_fort_01.glb", position: new Vector3(-18, 0.1, -6.4), scale: 0.08, rotationY: Math.PI * 0.82 },
      { file: "modular_fort_01.glb", position: new Vector3(18, 0.1, -5.6), scale: 0.075, rotationY: -Math.PI * 0.82 },
      { file: "modular_wooden_pier.glb", position: new Vector3(14, 0.04, -10.5), scale: 0.1, rotationY: -0.28 },
      { file: "boulder_01.glb", position: new Vector3(-23.5, 0.04, 7), scale: 1.05, rotationY: 0.45 },
      { file: "boulder_01.glb", position: new Vector3(23.5, 0.04, 17), scale: 0.95, rotationY: -0.9 },
      { file: "tree_stump_01.glb", position: new Vector3(-17, 0.03, 8), scale: 1.2, rotationY: -0.4 },
      { file: "dead_tree_trunk.glb", position: new Vector3(16.5, 0.05, 7), scale: 1.6, rotationY: 2.3 },
      { file: "dry_branches_medium_01.glb", position: new Vector3(-15.5, 0.04, 18), scale: 1.45, rotationY: 1.8 },
      { file: "single_root.glb", position: new Vector3(15, 0.05, 23), scale: 1.3, rotationY: -1.2 },
      { file: "pachira_aquatica_01.glb", position: new Vector3(-20, 0.04, 14), scale: 2.4, rotationY: 0.8 },
      { file: "pachira_aquatica_01.glb", position: new Vector3(20, 0.04, 20), scale: 2.1, rotationY: -0.35 },
      { file: "calathea_orbifolia_01.glb", position: new Vector3(-8.5, 0.04, 13), scale: 1.35, rotationY: 0.5 },
      { file: "calathea_orbifolia_01.glb", position: new Vector3(8.5, 0.04, 24), scale: 1.2, rotationY: -0.9 },
      { file: "anthurium_botany_01.glb", position: new Vector3(-12, 0.04, 31), scale: 1.5, rotationY: 1.4 },
      { file: "shrub_02.glb", position: new Vector3(13, 0.04, 12), scale: 1.55, rotationY: 0.2 },
      { file: "shrub_03.glb", position: new Vector3(-13, 0.04, 45), scale: 1.7, rotationY: -0.7 },
      { file: "shrub_04.glb", position: new Vector3(12, 0.04, 48), scale: 1.65, rotationY: 0.9 },
      { file: "fern_02.glb", position: new Vector3(-5.4, 0.04, 20), scale: 1.7, rotationY: 0.1 },
      { file: "fern_02.glb", position: new Vector3(5.4, 0.04, 35), scale: 1.55, rotationY: 2.2 },
      { file: "grass_bermuda_01.glb", position: new Vector3(-4.4, 0.04, 46), scale: 1.7, rotationY: -0.6 },
      { file: "moss_01.glb", position: new Vector3(4.5, 0.04, 52), scale: 1.55, rotationY: 1.5 },
    ];

    for (const placement of placements) {
      try {
        await this.placeGlb(habitatRootUrl, placement.file, placement.position, placement.scale, placement.rotationY ?? 0);
      } catch (error) {
        console.warn(`Failed to load habitat asset ${placement.file}`, error);
      }
    }
  }

  private async placeGlb(rootUrl: string, fileName: string, position: Vector3, scale: number, rotationY = 0): Promise<TransformNode> {
    const result = await SceneLoader.ImportMeshAsync("", rootUrl, fileName, this.scene);
    const root = new TransformNode(`asset-${fileName}-${Math.round(Math.random() * 100000)}`, this.scene);
    const topLevelMeshes = result.meshes.filter((mesh) => !mesh.parent);
    const bounds = this.getImportedBounds(result.meshes);
    const offset = bounds
      ? new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2)
      : Vector3.Zero();

    topLevelMeshes.forEach((mesh) => {
      mesh.setParent(root);
      mesh.position.subtractInPlace(offset);
    });
    result.meshes.forEach((mesh) => {
      mesh.isPickable = false;
    });
    result.animationGroups.forEach((group) => group.stop());
    root.position = position;
    root.rotation.y = rotationY;
    root.scaling = new Vector3(scale, scale, scale);
    return root;
  }

  private getImportedBounds(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } | undefined {
    const renderMeshes = meshes.filter((mesh) => mesh.getTotalVertices() > 0);
    if (renderMeshes.length === 0) {
      return undefined;
    }
    const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    renderMeshes.forEach((mesh) => {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(bounds.minimumWorld);
      max.maximizeInPlace(bounds.maximumWorld);
    });
    return { min, max };
  }

  private async createOutpost(): Promise<void> {
    const outpostAssets: Array<{ rootUrl: string; file: string; position: Vector3; scale: number; rotationY?: number }> = [
      { rootUrl: habitatRootUrl, file: "modular_fort_01.glb", position: new Vector3(-10.2, 0.04, -5.2), scale: 0.08, rotationY: Math.PI * 0.8 },
      { rootUrl: habitatRootUrl, file: "modular_fort_01.glb", position: new Vector3(10.2, 0.04, -5.2), scale: 0.08, rotationY: -Math.PI * 0.8 },
      { rootUrl: habitatRootUrl, file: "modular_wooden_pier.glb", position: new Vector3(0, 0.02, -10.4), scale: 0.13, rotationY: Math.PI / 2 },
      { rootUrl: habitatRootUrl, file: "modular_wooden_pier.glb", position: new Vector3(-7.4, 0.02, -9.1), scale: 0.1, rotationY: 0.2 },
      { rootUrl: habitatRootUrl, file: "modular_wooden_pier.glb", position: new Vector3(7.4, 0.02, -9.1), scale: 0.1, rotationY: -0.2 },
      { rootUrl: `${polyhavenUpgradeRootUrl}wooden_crate_01/`, file: "wooden_crate_01_1k.gltf", position: new Vector3(-5.8, 0.04, -11.4), scale: 1.8, rotationY: -0.35 },
      { rootUrl: `${polyhavenUpgradeRootUrl}wooden_crate_02/`, file: "wooden_crate_02_1k.gltf", position: new Vector3(5.7, 0.04, -11.2), scale: 1.6, rotationY: 0.42 },
      { rootUrl: `${polyhavenUpgradeRootUrl}machete/`, file: "machete_1k.gltf", position: new Vector3(-4.1, 0.72, -11.1), scale: 2.2, rotationY: 1.2 },
      { rootUrl: `${polyhavenUpgradeRootUrl}service_pistol/`, file: "service_pistol_1k.gltf", position: new Vector3(4.2, 0.6, -10.9), scale: 3.0, rotationY: -1.15 },
    ];

    for (const asset of outpostAssets) {
      try {
        await this.placeGlb(asset.rootUrl, asset.file, asset.position, asset.scale, asset.rotationY ?? 0);
      } catch (error) {
        console.warn(`Failed to load outpost asset ${asset.file}`, error);
      }
    }
  }

  private async createJungle(): Promise<void> {
    const grassAssets = ["grass_bermuda_01.glb", "fern_02.glb", "shrub_02.glb", "shrub_03.glb"];
    for (let index = 0; index < Math.round(34 * visualTheme.vegetationDensity); index += 1) {
      const x = -14 + ((index * 7.7) % 28);
      const z = 1 + ((index * 11.3) % 48);
      if (Math.abs(x) < 3.2 && z < 36) {
        continue;
      }
      const file = grassAssets[index % grassAssets.length];
      try {
        await this.placeGlb(habitatRootUrl, file, new Vector3(x, 0.04, z), 0.8 + (index % 5) * 0.18, index * 0.63);
      } catch (error) {
        console.warn(`Failed to load undergrowth asset ${file}`, error);
      }
    }

    const treePlacements = [
      new Vector3(-23, 0.03, 4),
      new Vector3(22, 0.03, 8),
      new Vector3(-27, 0.03, 22),
      new Vector3(27, 0.03, 28),
      new Vector3(-21, 0.03, 43),
      new Vector3(21, 0.03, 49),
      new Vector3(-31, 0.03, 62),
      new Vector3(31, 0.03, 65),
    ];
    for (const [index, position] of treePlacements.entries()) {
      try {
        const useIslandTree = index % 3 === 0;
        await this.placeGlb(
          useIslandTree ? `${polyhavenUpgradeRootUrl}island_tree_02/` : habitatRootUrl,
          useIslandTree ? "island_tree_02_1k.gltf" : "pachira_aquatica_01.glb",
          position,
          useIslandTree ? 1.45 : 2.45,
          index * 0.74,
        );
      } catch (error) {
        console.warn("Failed to load jungle tree asset", error);
      }
    }
  }

  private async createForestDetails(): Promise<void> {
    const detailAssets: Array<{ rootUrl: string; file: string; position: Vector3; scale: number; rotationY?: number }> = [
      { rootUrl: habitatRootUrl, file: "pachira_aquatica_01.glb", position: new Vector3(-12.8, 0.04, 6.8), scale: 2.1, rotationY: 0.7 },
      { rootUrl: habitatRootUrl, file: "pachira_aquatica_01.glb", position: new Vector3(12.6, 0.04, 9.2), scale: 1.9, rotationY: -0.45 },
      { rootUrl: `${polyhavenUpgradeRootUrl}grass_medium_01/`, file: "grass_medium_01_1k.gltf", position: new Vector3(-4.6, 0.04, 7.4), scale: 5.8, rotationY: 0.1 },
      { rootUrl: `${polyhavenUpgradeRootUrl}grass_medium_02/`, file: "grass_medium_02_1k.gltf", position: new Vector3(4.8, 0.04, 10.8), scale: 5.0, rotationY: 2.1 },
      { rootUrl: habitatRootUrl, file: "fern_02.glb", position: new Vector3(-6.4, 0.04, 14.2), scale: 1.65, rotationY: 0.4 },
      { rootUrl: habitatRootUrl, file: "fern_02.glb", position: new Vector3(6.6, 0.04, 18.5), scale: 1.55, rotationY: -0.6 },
      { rootUrl: `${polyhavenUpgradeRootUrl}shrub_01/`, file: "shrub_01_1k.gltf", position: new Vector3(-8.2, 0.04, 20.5), scale: 2.2, rotationY: 0.9 },
      { rootUrl: `${polyhavenUpgradeRootUrl}shrub_01/`, file: "shrub_01_1k.gltf", position: new Vector3(8.4, 0.04, 23.2), scale: 2.1, rotationY: -0.7 },
      { rootUrl: `${polyhavenUpgradeRootUrl}coast_rocks_01/`, file: "coast_rocks_01_1k.gltf", position: new Vector3(-18.5, 0.04, 8.4), scale: 0.62, rotationY: 0.4 },
      { rootUrl: `${polyhavenUpgradeRootUrl}coast_rocks_01/`, file: "coast_rocks_01_1k.gltf", position: new Vector3(18.8, 0.04, 17.2), scale: 0.54, rotationY: 1.8 },
      { rootUrl: habitatRootUrl, file: "tree_stump_01.glb", position: new Vector3(-16.5, 0.04, 11), scale: 1.25, rotationY: -0.4 },
      { rootUrl: habitatRootUrl, file: "dead_tree_trunk.glb", position: new Vector3(16.5, 0.05, 9), scale: 1.6, rotationY: 2.3 },
      { rootUrl: habitatRootUrl, file: "dry_branches_medium_01.glb", position: new Vector3(-15.5, 0.04, 19), scale: 1.45, rotationY: 1.8 },
      { rootUrl: habitatRootUrl, file: "single_root.glb", position: new Vector3(15, 0.05, 24), scale: 1.3, rotationY: -1.2 },
      { rootUrl: `${polyhavenUpgradeRootUrl}shrub_01/`, file: "shrub_01_1k.gltf", position: new Vector3(-9.4, 0.04, 15), scale: 2.6, rotationY: 0.5 },
      { rootUrl: `${polyhavenUpgradeRootUrl}shrub_01/`, file: "shrub_01_1k.gltf", position: new Vector3(9.2, 0.04, 25), scale: 2.2, rotationY: -0.9 },
      { rootUrl: `${polyhavenUpgradeRootUrl}grass_medium_01/`, file: "grass_medium_01_1k.gltf", position: new Vector3(-5.2, 0.04, 21), scale: 5.4, rotationY: 0.2 },
      { rootUrl: `${polyhavenUpgradeRootUrl}grass_medium_02/`, file: "grass_medium_02_1k.gltf", position: new Vector3(5.7, 0.04, 35), scale: 4.8, rotationY: 2.2 },
      { rootUrl: habitatRootUrl, file: "anthurium_botany_01.glb", position: new Vector3(-12, 0.04, 33), scale: 1.5, rotationY: 1.4 },
      { rootUrl: habitatRootUrl, file: "calathea_orbifolia_01.glb", position: new Vector3(12, 0.04, 39), scale: 1.35, rotationY: -0.6 },
    ];

    for (const detail of detailAssets) {
      try {
        await this.placeGlb(detail.rootUrl, detail.file, detail.position, detail.scale, detail.rotationY ?? 0);
      } catch (error) {
        console.warn(`Failed to load forest detail ${detail.file}`, error);
      }
    }
  }

  private updateWeaponView(time: number, deltaSeconds: number): void {
    if (!this.weaponRoot) {
      return;
    }
    this.weaponKickSeconds = Math.max(0, this.weaponKickSeconds - deltaSeconds);
    const kick = this.weaponKickSeconds / 0.09;
    const swayX = Math.sin(time * 1.6) * 0.012;
    const swayY = Math.sin(time * 1.1 + 0.8) * 0.008;
    const weapon = this.currentWeapon();
    const scopedOffset = this.weapon.isScoped ? -0.16 : 0;
    const shotgunOffset = weapon.id === "shotgun" ? 0.07 : 0;
    this.weaponRoot.position = new Vector3(0.3 + scopedOffset + shotgunOffset + swayX, -0.55 + swayY - kick * 0.02, 1.02 - kick * 0.08);
    this.weaponRoot.rotation = new Vector3(-0.075 - kick * 0.08, -0.2 + swayX * 0.45, 0.025 + swayY * 0.45);
  }

  private makeMaterial(name: string, color: string, emissive = 0): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = new Color3(0.15, 0.16, 0.14);
    if (emissive > 0) {
      mat.emissiveColor = Color3.FromHexString(color).scale(emissive);
    }
    return mat;
  }

  private bindInput(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.mission.phase !== "playing") {
        return;
      }
      this.requestPointerLock();
      this.ensureAudio();
      if (event.button === 0) {
        this.isFiring = true;
        this.fire();
      }
      if (event.button === 2) {
        if (this.currentWeapon().id === "shotgun") {
          this.notice("Shotgun uses bead sights.", 0.7);
        } else {
          this.weapon.isScoped = !this.weapon.isScoped;
        }
      }
    });
    window.addEventListener("pointerup", (event) => {
      if (event.button === 0) {
        this.isFiring = false;
      }
    });
    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas || this.mission.phase !== "playing") {
        return;
      }
      const sensitivity = this.weapon.isScoped ? 0.00115 : 0.00185;
      this.yaw += event.movementX * sensitivity;
      this.pitch = Math.max(-0.58, Math.min(0.36, this.pitch + event.movementY * sensitivity));
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    });
    window.addEventListener("keydown", (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.code)) {
        this.moveKeys.add(event.code);
        event.preventDefault();
      }
      if (event.code === "Digit1") {
        this.switchWeapon("carbine");
      }
      if (event.code === "Digit2") {
        this.switchWeapon("marksman");
      }
      if (event.code === "Digit3") {
        this.switchWeapon("shotgun");
      }
      if (event.code === "KeyR") {
        this.reload();
      }
      if (event.code === "Escape") {
        this.weapon.isScoped = false;
        this.isFiring = false;
      }
    });
    window.addEventListener("keyup", (event: KeyboardEvent) => {
      this.moveKeys.delete(event.code);
    });
  }

  private startMission(): void {
    this.enemyViews.forEach((view) => view.root.dispose());
    this.enemyViews.clear();
    this.mission = this.createMission("playing");
    this.weapon = this.createWeapon();
    this.playerOffset = new Vector3(0, 0, 0);
    this.movementBob = 0;
    this.moveKeys.clear();
    this.camera.position = this.cameraHome.clone();
    this.applyWeaponVisual();
    this.nextEnemyId = 1;
    this.combo = 1;
    this.comboSeconds = 0;
    this.bestCombo = 1;
    this.hitMarkerSeconds = 0;
    this.notice("Hold the line. Weak points glow under scope.", 2.2);
    this.hud.overlay.classList.remove("visible");
    this.requestPointerLock();
    this.ensureAudio();
    this.updateHud();
  }

  private switchWeapon(id: WeaponId): void {
    if (this.mission.phase !== "playing" || this.weapon.id === id) {
      return;
    }
    const config = tuning.weapons[id];
    this.weapon = {
      id,
      ammo: config.magazineSize,
      cooldownSeconds: 0.18,
      reloadSecondsRemaining: 0,
      isReloading: false,
      isScoped: this.weapon.isScoped && id !== "shotgun",
    };
    this.applyWeaponVisual();
    this.notice(`${config.shortLabel} ready`, 0.9);
    this.playTone(id === "shotgun" ? 165 : id === "marksman" ? 260 : 220, 0.05, "triangle");
  }

  private requestPointerLock(): void {
    void this.canvas.requestPointerLock().catch(() => undefined);
  }

  private showBriefing(): void {
    this.camera.position = this.cameraHome.clone();
    this.hud.overlay.classList.add("visible");
    this.hud.title.textContent = "Dino Outpost";
    this.hud.body.textContent =
      "Rain is cutting through the perimeter lights. Hold the center lane, chain clean shots, and keep the outpost standing until extraction.";
    this.hud.action.textContent = "Start Mission";
    this.hud.restart.style.display = "none";
    this.updateHud();
  }

  private finishMission(phase: "won" | "lost"): void {
    this.mission.phase = phase;
    this.isFiring = false;
    this.weapon.isScoped = false;
    this.moveKeys.clear();
    document.exitPointerLock?.();
    this.playTone(phase === "won" ? 520 : 130, phase === "won" ? 0.35 : 0.6, phase === "won" ? "triangle" : "sawtooth");
    this.hud.overlay.classList.add("visible");
    this.hud.title.textContent = phase === "won" ? "Extraction Secured" : "Outpost Breached";
    this.hud.body.textContent =
      phase === "won"
        ? `Mission complete: ${this.mission.kills} hostiles neutralized, score ${this.mission.score}, best streak x${this.bestCombo}.`
        : `The perimeter failed after ${Math.floor(this.mission.elapsedSeconds)} seconds. Score ${this.mission.score}, best streak x${this.bestCombo}.`;
    this.hud.action.textContent = "Run Again";
    this.hud.restart.style.display = "inline-flex";
  }

  private tick(): void {
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    if (this.mission.phase === "playing") {
      this.updatePlayerMovement(deltaSeconds);
      this.updateMission(deltaSeconds);
    }
    this.camera.fov += ((this.weapon.isScoped ? 0.38 : 0.78) - this.camera.fov) * Math.min(1, deltaSeconds * 12);
    this.updateWeaponView(now / 1000, deltaSeconds);
    this.updateAimTarget();
    this.updateEnemyViews(now / 1000);
    this.updateHud();
    this.scene.render();
  }

  private updatePlayerMovement(deltaSeconds: number): void {
    let inputX = 0;
    let inputZ = 0;
    if (this.moveKeys.has("KeyA") || this.moveKeys.has("ArrowLeft")) inputX -= 1;
    if (this.moveKeys.has("KeyD") || this.moveKeys.has("ArrowRight")) inputX += 1;
    if (this.moveKeys.has("KeyW") || this.moveKeys.has("ArrowUp")) inputZ += 1;
    if (this.moveKeys.has("KeyS") || this.moveKeys.has("ArrowDown")) inputZ -= 1;
    const inputLen = Math.hypot(inputX, inputZ);

    const targetSpeed = this.weapon.isScoped ? 1.2 : 3.2;
    let targetVx = 0;
    let targetVz = 0;
    if (inputLen > 0) {
      targetVx = (inputX / inputLen) * targetSpeed;
      targetVz = (inputZ / inputLen) * targetSpeed;
    }
    // Asymmetric ease: faster to start moving than to stop — feels deliberate, not floaty.
    const accelRate = inputLen > 0 ? 14 : 9;
    const accelLerp = Math.min(1, deltaSeconds * accelRate);
    this.playerVelocity.x += (targetVx - this.playerVelocity.x) * accelLerp;
    this.playerVelocity.z += (targetVz - this.playerVelocity.z) * accelLerp;

    this.playerOffset.x = Math.max(-3.2, Math.min(3.2, this.playerOffset.x + this.playerVelocity.x * deltaSeconds));
    this.playerOffset.z = Math.max(-1.35, Math.min(1.85, this.playerOffset.z + this.playerVelocity.z * deltaSeconds));

    const actualSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const bobScale = Math.min(1, actualSpeed / targetSpeed);
    // Step cycle frequency tied to speed; 2 steps/sec at full run.
    this.movementBob += deltaSeconds * (0.6 + actualSpeed * 3.6);
    // Vertical bob = step frequency; lateral bob = half (one sway per 2 steps).
    const bobY = Math.sin(this.movementBob) * 0.04 * bobScale + Math.sin(this.movementBob * 0.32) * 0.006;
    const bobX = Math.sin(this.movementBob * 0.5) * 0.022 * bobScale;

    // Camera shake driven by combat events (fire / hit / kill).
    this.cameraShakeSeconds = Math.max(0, this.cameraShakeSeconds - deltaSeconds);
    const shakePhase = this.cameraShakeSeconds > 0 ? this.cameraShakeSeconds / 0.25 : 0;
    const shake = this.cameraShakeAmplitude * shakePhase;
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    this.camera.position = new Vector3(
      this.cameraHome.x + this.playerOffset.x + bobX + shakeX,
      this.cameraHome.y + bobY + shakeY,
      this.cameraHome.z + this.playerOffset.z,
    );

    // Strafe roll — camera leans slightly into lateral motion (max ~2.3°).
    const targetRoll = -(this.playerVelocity.x / Math.max(targetSpeed, 0.1)) * 0.04;
    this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, deltaSeconds * 8);
    this.camera.rotation.z = this.cameraRoll;
  }

  private triggerCameraShake(amplitude: number, seconds: number): void {
    // Layered shakes use max amplitude / max remaining time, so multiple events stack cleanly.
    this.cameraShakeAmplitude = Math.max(this.cameraShakeAmplitude * (this.cameraShakeSeconds / 0.25 || 0), amplitude);
    this.cameraShakeSeconds = Math.max(this.cameraShakeSeconds, seconds);
  }

  private updateMission(deltaSeconds: number): void {
    this.mission.elapsedSeconds += deltaSeconds;
    this.weapon.cooldownSeconds = Math.max(0, this.weapon.cooldownSeconds - deltaSeconds);
    if (this.weapon.isReloading) {
      this.weapon.reloadSecondsRemaining = Math.max(0, this.weapon.reloadSecondsRemaining - deltaSeconds);
      if (this.weapon.reloadSecondsRemaining === 0) {
        this.weapon.isReloading = false;
        this.weapon.ammo = this.currentWeapon().magazineSize;
        this.notice("Magazine ready.", 0.8);
      }
    }
    this.spawnDueEnemies();
    let incomingDamage = 0;
    let nearestThreatZ = Number.POSITIVE_INFINITY;
    this.mission.activeEnemies.forEach((enemy) => {
      const result = stepEnemy(enemy, deltaSeconds, tuning.attackLineZ);
      incomingDamage += result.baseDamage;
      if (enemy.state !== "dead" && enemy.z < nearestThreatZ) {
        nearestThreatZ = enemy.z;
      }
    });
    const threatWindow = tuning.attackLineZ + 6;
    if (nearestThreatZ <= threatWindow) {
      this.threatPulseSeconds = 0.4;
    }
    if (incomingDamage > 0) {
      this.mission.baseIntegrity = Math.max(0, this.mission.baseIntegrity - incomingDamage);
      this.baseFlashSeconds = 0.18;
      if (Math.random() < 0.18) {
        this.playTone(95, 0.05, "sawtooth");
      }
    }
    this.baseFlashSeconds = Math.max(0, this.baseFlashSeconds - deltaSeconds);
    this.noticeSeconds = Math.max(0, this.noticeSeconds - deltaSeconds);
    this.threatPulseSeconds = Math.max(0, this.threatPulseSeconds - deltaSeconds);
    this.hitMarkerSeconds = Math.max(0, this.hitMarkerSeconds - deltaSeconds);
    this.comboSeconds = Math.max(0, this.comboSeconds - deltaSeconds);
    if (this.comboSeconds === 0) {
      this.combo = 1;
    }
    if (this.isFiring && this.weapon.cooldownSeconds === 0) {
      this.fire();
    }
    this.mission.activeEnemies = this.mission.activeEnemies.filter((enemy) => enemy.state !== "dead");
    if (this.mission.baseIntegrity <= 0) {
      this.finishMission("lost");
    } else if (this.mission.elapsedSeconds >= tuning.missionSeconds) {
      this.finishMission("won");
    }
  }

  private spawnDueEnemies(): void {
    expandedWaves.forEach((event, index) => {
      if (this.mission.spawnedEvents.has(index) || event.time > this.mission.elapsedSeconds) {
        return;
      }
      this.mission.spawnedEvents.add(index);
      this.spawnEnemy(event.kind, event.lane, index * 0.45);
    });
  }

  private spawnEnemy(kind: EnemyKind, lane: LaneId, zOffset = 0): void {
    const enemy = createEnemyState(this.nextEnemyId, kind, lane, tuning, zOffset);
    this.nextEnemyId += 1;
    this.mission.activeEnemies.push(enemy);
    this.enemyViews.set(enemy.id, this.createEnemyView(enemy));
    this.notice(`${enemyLabel(kind, tuning.enemies)} entering ${lane} lane`, 1.4);
  }

  private createEnemyView(enemy: EnemyState): EnemyView {
    const config = tuning.enemies[enemy.kind];
    const root = new TransformNode(`enemy-${enemy.id}`, this.scene);
    root.position = new Vector3(enemy.x, 0, enemy.z);
    const bodyMaterial = this.makeMaterial(`enemy-body-${enemy.id}`, config.bodyColor, 0.05);
    const weakMaterial = this.makeMaterial(`enemy-weak-${enemy.id}`, config.weakColor, 0.95);
    weakMaterial.alpha = 0.42;
    const weakMeshes: AbstractMesh[] = [];
    const shadow = MeshBuilder.CreateDisc(`enemy-shadow-${enemy.id}`, { radius: enemy.radius * 0.92, tessellation: 28 }, this.scene);
    const shadowMaterial = this.makeMaterial(`enemy-shadow-mat-${enemy.id}`, "#050606", 0);
    shadowMaterial.alpha = 0.38;
    shadow.parent = root;
    shadow.position = new Vector3(0, 0.065, 0.18);
    shadow.rotation.x = Math.PI / 2;
    shadow.scaling.z = 0.52;
    shadow.material = shadowMaterial;
    shadow.isPickable = false;

    if (config.bodyStyle === "runner") {
      const body = MeshBuilder.CreateSphere(`raptor-body-${enemy.id}`, { diameter: 1.7, segments: 12 }, this.scene);
      body.parent = root;
      body.scaling = new Vector3(1.42, 0.78, 2);
      body.position = new Vector3(0, 1.16, 0);
      body.material = bodyMaterial;
      const head = MeshBuilder.CreateSphere(`raptor-head-${enemy.id}`, { diameter: 0.8, segments: 12 }, this.scene);
      head.parent = root;
      head.position = new Vector3(0, 1.75, -1.22);
      head.scaling = new Vector3(0.95, 0.72, 1.12);
      head.material = bodyMaterial;
      const weak = MeshBuilder.CreateSphere(`raptor-weak-${enemy.id}`, { diameter: config.weakPointRadius * 0.95, segments: 10 }, this.scene);
      weak.parent = root;
      weak.position = new Vector3(0, config.weakPointHeight, -config.weakPointForwardOffset);
      weak.material = weakMaterial;
      weak.isVisible = false;
      weakMeshes.push(weak);
      const marker = MeshBuilder.CreateTorus(`raptor-marker-${enemy.id}`, { diameter: 0.86, thickness: 0.035, tessellation: 24 }, this.scene);
      marker.parent = root;
      marker.position = new Vector3(0, config.height + 0.52, -0.25);
      marker.rotation.x = Math.PI / 2;
      marker.material = weakMaterial;
      marker.isVisible = false;
      weakMeshes.push(marker);
      const eyeMaterial = this.makeMaterial(`raptor-eyes-${enemy.id}`, "#f2c84b", 1.5);
      for (let eye = 0; eye < 2; eye += 1) {
        const mesh = MeshBuilder.CreateSphere(`raptor-eye-${enemy.id}-${eye}`, { diameter: 0.16, segments: 8 }, this.scene);
        mesh.parent = root;
        mesh.position = new Vector3(eye === 0 ? -0.22 : 0.22, 1.88, -1.6);
        mesh.material = eyeMaterial;
      }
      const jaw = MeshBuilder.CreateBox(`raptor-jaw-${enemy.id}`, { width: 0.78, height: 0.12, depth: 0.42 }, this.scene);
      jaw.parent = root;
      jaw.position = new Vector3(0, 1.42, -1.78);
      jaw.rotation.x = -0.28;
      jaw.material = this.makeMaterial(`raptor-jaw-mat-${enemy.id}`, "#141716", 0.04);
      for (let tooth = 0; tooth < 5; tooth += 1) {
        const mesh = MeshBuilder.CreateCylinder(`raptor-tooth-${enemy.id}-${tooth}`, { height: 0.2, diameterTop: 0.02, diameterBottom: 0.06 }, this.scene);
        mesh.parent = root;
        mesh.position = new Vector3(-0.28 + tooth * 0.14, 1.34, -1.96);
        mesh.material = this.makeMaterial(`tooth-mat-${enemy.id}-${tooth}`, "#e8e1cd", 0.35);
      }
      const tail = MeshBuilder.CreateCylinder(`raptor-tail-${enemy.id}`, { height: 1.8, diameterTop: 0.05, diameterBottom: 0.32 }, this.scene);
      tail.parent = root;
      tail.position = new Vector3(0, 1.2, 1.78);
      tail.rotation.x = Math.PI / 2.35;
      tail.material = bodyMaterial;
      for (let leg = 0; leg < 2; leg += 1) {
        const mesh = MeshBuilder.CreateBox(`raptor-leg-${enemy.id}-${leg}`, { width: 0.22, height: 0.95, depth: 0.22 }, this.scene);
        mesh.parent = root;
        mesh.position = new Vector3(leg === 0 ? -0.58 : 0.58, 0.54, 0.15);
        mesh.rotation.x = leg === 0 ? 0.18 : -0.18;
        mesh.material = bodyMaterial;
      }
    } else {
      const body = MeshBuilder.CreateSphere(`brute-body-${enemy.id}`, { diameter: 2.4, segments: 14 }, this.scene);
      body.parent = root;
      body.position = new Vector3(0, 1.15, 0);
      body.scaling = new Vector3(1.45, 0.72, 1.8);
      body.material = bodyMaterial;
      const head = MeshBuilder.CreateSphere(`brute-head-${enemy.id}`, { diameter: 1.2, segments: 12 }, this.scene);
      head.parent = root;
      head.position = new Vector3(0, 1.22, -1.95);
      head.scaling = new Vector3(1.1, 0.72, 0.9);
      head.material = bodyMaterial;
      const weak = MeshBuilder.CreateSphere(`brute-weak-${enemy.id}`, { diameter: config.weakPointRadius * 0.95, segments: 10 }, this.scene);
      weak.parent = root;
      weak.position = new Vector3(0, config.weakPointHeight, -config.weakPointForwardOffset);
      weak.material = weakMaterial;
      weak.isVisible = false;
      weakMeshes.push(weak);
      const marker = MeshBuilder.CreateTorus(`brute-marker-${enemy.id}`, { diameter: 1.05, thickness: 0.04, tessellation: 24 }, this.scene);
      marker.parent = root;
      marker.position = new Vector3(0, config.height + 0.5, -0.25);
      marker.rotation.x = Math.PI / 2;
      marker.material = weakMaterial;
      marker.isVisible = false;
      weakMeshes.push(marker);
      for (let horn = 0; horn < 2; horn += 1) {
        const mesh = MeshBuilder.CreateCylinder(`brute-horn-${enemy.id}-${horn}`, { height: 0.9, diameterTop: 0.04, diameterBottom: 0.18 }, this.scene);
        mesh.parent = root;
        mesh.position = new Vector3(horn === 0 ? -0.38 : 0.38, 1.45, -2.45);
        mesh.rotation.x = Math.PI / 2.15;
        mesh.material = bodyMaterial;
      }
      for (let leg = 0; leg < 4; leg += 1) {
        const mesh = MeshBuilder.CreateBox(`brute-leg-${enemy.id}-${leg}`, { width: 0.34, height: 0.9, depth: 0.34 }, this.scene);
        mesh.parent = root;
        mesh.position = new Vector3(leg % 2 === 0 ? -0.82 : 0.82, 0.42, leg < 2 ? -0.8 : 0.95);
        mesh.material = bodyMaterial;
      }
    }
    root.getChildMeshes().forEach((mesh) => {
      if (!weakMeshes.includes(mesh)) {
        mesh.isVisible = false;
      }
    });
    void this.decorateEnemyWithModel(root, enemy);
    return { root, bodyMaterial, weakMaterial, weakMeshes, shadow };
  }

  private async decorateEnemyWithModel(root: TransformNode, enemy: EnemyState): Promise<void> {
    const config = tuning.enemies[enemy.kind];
    try {
      const result = await SceneLoader.ImportMeshAsync("", dinoRootUrl, config.modelFileName, this.scene);
      if (root.isDisposed()) {
        result.meshes.forEach((mesh) => mesh.dispose());
        result.animationGroups.forEach((group) => group.dispose());
        result.lights.forEach((light) => light.dispose());
        return;
      }
      root.getChildMeshes().forEach((mesh) => {
        if (!mesh.name.includes("weak")) {
          mesh.isVisible = false;
        }
      });
      const modelRoot = new TransformNode(`enemy-model-${enemy.id}`, this.scene);
      modelRoot.parent = root;

      const topLevelMeshes = result.meshes.filter((mesh) => !mesh.parent);
      const bounds = this.getImportedBounds(result.meshes);
      const offset = bounds
        ? new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2)
        : Vector3.Zero();
      topLevelMeshes.forEach((mesh) => {
        mesh.setParent(modelRoot);
        mesh.position.subtractInPlace(offset);
      });
      modelRoot.rotation.y = config.modelYaw;
      modelRoot.scaling = new Vector3(config.modelScale, config.modelScale, config.modelScale);
      result.meshes.forEach((mesh) => {
        mesh.isPickable = false;
        if (mesh.getTotalVertices() > 0) {
          mesh.renderOverlay = true;
          mesh.overlayColor = Color3.FromHexString(config.bodyColor);
          mesh.overlayAlpha = 0.16;
        }
      });
      result.lights.forEach((light) => light.dispose());

      const animation =
        result.animationGroups.find((group) => group.name.toLowerCase().includes(config.animationName)) ?? result.animationGroups[0];
      result.animationGroups.forEach((group) => group.stop());
      animation?.start(true, config.animationSpeed);
    } catch (error) {
      console.warn(`Failed to load dinosaur model ${config.modelFileName}`, error);
    }
  }

  private updateEnemyViews(time: number): void {
    const liveIds = new Set(this.mission.activeEnemies.map((enemy) => enemy.id));
    this.enemyViews.forEach((view, id) => {
      if (!liveIds.has(id)) {
        view.root.dispose();
        this.enemyViews.delete(id);
      }
    });
    this.mission.activeEnemies.forEach((enemy) => {
      const view = this.enemyViews.get(enemy.id);
      if (!view) {
        return;
      }
      view.root.position.x = enemy.x;
      view.root.position.z = enemy.z;
      const stanceLift = 0.42;
      view.root.position.y =
        stanceLift + (enemy.state === "staggered" ? Math.sin(time * 24) * 0.09 : Math.sin(time * 7 + enemy.id) * 0.045);
      view.root.rotation.y = Math.sin(time * 1.7 + enemy.id) * 0.08;
      view.shadow.scaling.x = 1 + Math.sin(time * 8 + enemy.id) * 0.035;
      view.shadow.scaling.y = 0.52 + Math.cos(time * 7 + enemy.id) * 0.02;
      if (enemy.state === "approaching" && Math.random() < 0.018) {
        this.createDustPuff(new Vector3(enemy.x + (Math.random() - 0.5) * enemy.radius * 0.55, 0.1, enemy.z + enemy.radius * 0.3));
      }
      const isAimedTarget = this.currentAimTarget?.enemy.id === enemy.id;
      const showWeakPoint = isAimedTarget || this.weapon.isScoped;
      view.weakMeshes.forEach((mesh) => {
        mesh.isVisible = showWeakPoint;
      });
      const flash = enemy.state === "staggered" ? 0.65 : 0.18;
      view.bodyMaterial.emissiveColor = Color3.FromHexString(tuning.enemies[enemy.kind].bodyColor).scale(flash);
      view.weakMaterial.alpha = this.weapon.isScoped && isAimedTarget ? 0.62 : 0.28;
      view.weakMaterial.emissiveColor = Color3.FromHexString(tuning.enemies[enemy.kind].weakColor).scale(
        showWeakPoint ? 1.7 : 0.65,
      );
    });
  }

  private fire(): void {
    const weapon = this.currentWeapon();
    if (this.mission.phase !== "playing" || this.weapon.cooldownSeconds > 0 || this.weapon.isReloading) {
      return;
    }
    if (this.weapon.ammo <= 0) {
      this.reload();
      this.playTone(80, 0.06, "square");
      return;
    }
    this.weapon.ammo -= 1;
    this.weapon.cooldownSeconds = weapon.fireIntervalSeconds;
    this.weaponKickSeconds = 0.09;
    this.pitch = Math.max(-0.58, this.pitch - weapon.recoil * (this.weapon.isScoped ? 0.35 : 1));
    // Per-shot camera shake — heavier weapons shake more. Scope dampens it.
    const fireShake = (weapon.id === "shotgun" ? 0.045 : weapon.id === "marksman" ? 0.028 : 0.018) * (this.weapon.isScoped ? 0.4 : 1);
    this.triggerCameraShake(fireShake, 0.12);
    this.camera.rotation.x = this.pitch;
    this.playTone((weapon.id === "shotgun" ? 150 : weapon.id === "marksman" ? 215 : 255) + Math.random() * 45, 0.04, "square");

    const ray = this.camera.getForwardRay(weapon.range);
    const target = this.findAimTarget(ray.origin, ray.direction);
    const end = target
      ? new Vector3(target.enemy.x, target.enemy.weakPointHeight, target.enemy.z)
      : ray.origin.add(ray.direction.scale(weapon.range));
    this.createMuzzleFlash(ray.origin.add(ray.direction.scale(1.05)));
    this.createTracer(ray.origin.add(ray.direction.scale(1.2)), end, target?.weakPoint === "locked");

    if (target) {
      const isCritical = target.weakPoint === "locked" && this.weapon.isScoped;
      const result = applyWeaponDamage(target.enemy, weapon, isCritical);
      this.hitMarkerSeconds = isCritical ? 0.32 : 0.24;
      this.comboSeconds = Math.max(this.comboSeconds, 2.4);
      this.createImpact(end, isCritical);
      this.spawnDamagePop(end, result.damage, isCritical);
      this.playTone(isCritical ? 680 : 360, isCritical ? 0.08 : 0.045, isCritical ? "triangle" : "square");
      this.notice(isCritical ? "CRITICAL STAGGER" : "Hit confirmed", isCritical ? 0.85 : 0.45);
      if (result.killed) {
        this.combo = Math.min(9, this.combo + 1);
        this.comboSeconds = 3.4;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const score = tuning.enemies[target.enemy.kind].score;
        const comboBonus = (this.combo - 1) * 35;
        this.mission.kills += 1;
        this.mission.score += score + comboBonus;
        this.createEliminationBurst(end, isCritical);
        this.playTone(740, 0.12, "triangle");
        this.notice(`Neutralized +${score + comboBonus} x${this.combo}`, 1);
        // Kill shake — heavier when crit or against a big enemy.
        const heavy = tuning.enemies[target.enemy.kind].bodyStyle === "heavy";
        this.triggerCameraShake(isCritical ? 0.06 : heavy ? 0.05 : 0.035, 0.22);
      }
    }
  }

  private reload(): void {
    const weapon = this.currentWeapon();
    if (this.weapon.isReloading || this.weapon.ammo === weapon.magazineSize || this.mission.phase !== "playing") {
      return;
    }
    this.weapon.isReloading = true;
    this.weapon.reloadSecondsRemaining = weapon.reloadSeconds;
    this.notice("Reloading...", 0.9);
    this.playTone(155, 0.08, "triangle");
  }

  private updateAimTarget(): void {
    if (this.mission.phase !== "playing") {
      this.currentAimTarget = undefined;
      return;
    }
    const ray = this.camera.getForwardRay(this.currentWeapon().range);
    this.currentAimTarget = this.findAimTarget(ray.origin, ray.direction);
  }

  private findAimTarget(origin: Vector3, direction: Vector3): AimTarget | undefined {
    let best: AimTarget | undefined;
    this.mission.activeEnemies.forEach((enemy) => {
      if (enemy.state === "dead") {
        return;
      }
      const center = new Vector3(enemy.x, enemy.height * 0.54, enemy.z);
      const toCenter = center.subtract(origin);
      const alongRay = Vector3.Dot(toCenter, direction);
      if (alongRay < 0 || alongRay > this.currentWeapon().range) {
        return;
      }
      const closest = origin.add(direction.scale(alongRay));
      const bodyDistance = Vector3.Distance(closest, center);
      const hitRadius = enemy.radius * (this.weapon.isScoped ? 0.92 : 1.16);
      if (bodyDistance > hitRadius) {
        return;
      }
      const weakPoint = new Vector3(enemy.x, enemy.weakPointHeight, enemy.z - tuning.enemies[enemy.kind].weakPointForwardOffset);
      const weakDistance = Vector3.Distance(closest, weakPoint);
      const weakState = weakDistance < enemy.weakPointRadius ? "locked" : weakDistance < enemy.weakPointRadius * 1.8 ? "near" : "none";
      if (!best || alongRay < best.distance) {
        best = { enemy, distance: alongRay, weakPoint: weakState };
      }
    });
    return best;
  }

  private spawnDamagePop(worldPos: Vector3, damage: number, isCritical: boolean): void {
    if (damage <= 0) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const viewport = this.camera.viewport.toGlobal(rect.width, rect.height);
    const screen = Vector3.Project(
      worldPos,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      viewport,
    );
    if (screen.z < 0 || screen.z > 1) {
      return;
    }
    const pop = document.createElement("span");
    pop.className = isCritical ? "damage-pop crit" : "damage-pop";
    pop.textContent = isCritical ? `${Math.round(damage)}!` : `${Math.round(damage)}`;
    pop.style.left = `${screen.x.toFixed(1)}px`;
    pop.style.top = `${screen.y.toFixed(1)}px`;
    this.hud.damagePops.appendChild(pop);
    requestAnimationFrame(() => pop.classList.add("rise"));
    window.setTimeout(() => pop.remove(), 900);
  }

  private createTracer(start: Vector3, end: Vector3, critical: boolean): void {
    const color = critical ? Color3.FromHexString("#ffe066") : Color3.FromHexString("#fff1c8");
    const line = MeshBuilder.CreateLines("tracer", { points: [start, end] }, this.scene);
    line.color = color.scale(visualTheme.tracerIntensity * 1.4);
    const beam = MeshBuilder.CreateTube(
      "tracer-beam",
      { path: [start, end], radius: critical ? 0.045 : 0.028, tessellation: 8 },
      this.scene,
    );
    const beamMaterial = this.makeMaterial(`tracer-beam-${performance.now()}`, critical ? "#ffe066" : "#fff1c8", critical ? 1.95 : 1.35);
    beamMaterial.alpha = critical ? 0.85 : 0.62;
    beam.material = beamMaterial;
    // Outer wider halo for extra punch — fades faster than the core beam.
    const halo = MeshBuilder.CreateTube(
      "tracer-halo",
      { path: [start, end], radius: critical ? 0.11 : 0.075, tessellation: 8 },
      this.scene,
    );
    const haloMaterial = this.makeMaterial(`tracer-halo-${performance.now()}`, critical ? "#ffd36a" : "#ffe7c2", critical ? 1.3 : 0.85);
    haloMaterial.alpha = critical ? 0.32 : 0.18;
    halo.material = haloMaterial;
    setTimeout(() => line.dispose(), critical ? 130 : 90);
    setTimeout(() => beam.dispose(), critical ? 140 : 95);
    setTimeout(() => halo.dispose(), critical ? 90 : 60);
  }

  private createMuzzleFlash(position: Vector3): void {
    const flash = MeshBuilder.CreateSphere("muzzle-flash", { diameter: 0.28, segments: 8 }, this.scene);
    flash.position = position;
    flash.material = this.makeMaterial(`muzzle-flash-${performance.now()}`, "#ffd36a", 1.9);
    this.hudRoot.classList.add("firing");
    window.setTimeout(() => this.hudRoot.classList.remove("firing"), 80);
    setTimeout(() => flash.dispose(), 55);
  }

  private createDustPuff(position: Vector3): void {
    const puff = MeshBuilder.CreateSphere("footstep-dust", { diameter: 0.18 + Math.random() * 0.14, segments: 6 }, this.scene);
    const material = this.makeMaterial(`footstep-dust-${performance.now()}`, "#8b7b61", 0.08);
    material.alpha = 0.32;
    puff.position = position;
    puff.material = material;
    puff.isPickable = false;
    const drift = new Vector3((Math.random() - 0.5) * 0.18, 0.18 + Math.random() * 0.12, (Math.random() - 0.5) * 0.18);
    const startedAt = performance.now();
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / 420);
      puff.position = position.add(drift.scale(progress));
      puff.scaling = new Vector3(1 + progress * 2.4, 0.7 + progress * 1.4, 1 + progress * 2.4);
      material.alpha = 0.32 * (1 - progress);
      if (progress >= 1) {
        this.scene.onBeforeRenderObservable.remove(observer);
        puff.dispose();
      }
    });
  }

  private createImpact(position: Vector3, critical: boolean): void {
    const flash = MeshBuilder.CreateSphere("hit-flash", { diameter: critical ? 1.0 : 0.5, segments: 10 }, this.scene);
    flash.position = position;
    flash.material = this.makeMaterial(`hit-flash-${performance.now()}`, critical ? "#ffe066" : "#fff1c8", 1.7);
    setTimeout(() => flash.dispose(), critical ? 180 : 105);

    // Smoke puff — lingers ~3× longer than the flash so the eye registers an impact volume.
    const smoke = MeshBuilder.CreateSphere("hit-smoke", { diameter: critical ? 0.55 : 0.35, segments: 8 }, this.scene);
    smoke.position = position.clone();
    const smokeMat = this.makeMaterial(`hit-smoke-${performance.now()}`, "#3c3a36", 0);
    smokeMat.alpha = 0.5;
    smoke.material = smokeMat;
    const smokeStart = performance.now();
    const smokeDuration = critical ? 380 : 260;
    const smokeObs = this.scene.onBeforeRenderObservable.add(() => {
      const p = Math.min(1, (performance.now() - smokeStart) / smokeDuration);
      smoke.scaling.setAll(1 + p * 2.4);
      smokeMat.alpha = 0.5 * (1 - p);
      smoke.position.y = position.y + p * 0.45;
      if (p >= 1) {
        this.scene.onBeforeRenderObservable.remove(smokeObs);
        smoke.dispose();
      }
    });

    const sparkMaterial = this.makeMaterial(`spark-${performance.now()}`, critical ? "#ffe066" : visualTheme.hudPrimary, 1.35);
    const sparkCount = critical ? 18 : 11;
    for (let index = 0; index < sparkCount; index += 1) {
      const spark = MeshBuilder.CreateSphere(`spark-${index}`, { diameter: critical ? 0.11 : 0.075, segments: 6 }, this.scene);
      spark.position = position.clone();
      spark.material = sparkMaterial;
      const direction = new Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize();
      const distance = critical ? 1.1 : 0.6;
      const startedAt = performance.now();
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / (critical ? 200 : 130));
        spark.position = position.add(direction.scale(distance * progress));
        spark.scaling.scaleInPlace(0.88);
        if (progress >= 1) {
          this.scene.onBeforeRenderObservable.remove(observer);
          spark.dispose();
        }
      });
    }
    const ring = MeshBuilder.CreateTorus("impact-ring", { diameter: critical ? 1.4 : 0.85, thickness: 0.03, tessellation: 28 }, this.scene);
    ring.position = position;
    ring.rotation.x = Math.PI / 2;
    ring.material = this.makeMaterial(`impact-ring-${performance.now()}`, critical ? "#ffe066" : "#dce9ee", critical ? 1.4 : 0.85);
    setTimeout(() => ring.dispose(), critical ? 180 : 110);
  }

  private createEliminationBurst(position: Vector3, critical: boolean): void {
    const burstMaterial = this.makeMaterial(`elimination-burst-${performance.now()}`, critical ? "#ffe066" : visualTheme.hudDanger, 1.65);
    const ring = MeshBuilder.CreateTorus("elimination-ring", { diameter: critical ? 2.1 : 1.55, thickness: 0.04, tessellation: 32 }, this.scene);
    ring.position = position.add(new Vector3(0, 0.15, 0));
    ring.rotation.x = Math.PI / 2;
    ring.material = burstMaterial;
    setTimeout(() => ring.dispose(), 240);

    for (let index = 0; index < 18; index += 1) {
      const shard = MeshBuilder.CreateSphere(`elimination-shard-${index}`, { diameter: 0.07 + (index % 3) * 0.025, segments: 6 }, this.scene);
      shard.position = position.clone();
      shard.material = burstMaterial;
      const angle = (index / 18) * Math.PI * 2;
      const direction = new Vector3(Math.cos(angle) * 0.8, 0.35 + (index % 4) * 0.1, Math.sin(angle) * 0.8).normalize();
      const startedAt = performance.now();
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / 260);
        shard.position = position.add(direction.scale(progress * (critical ? 1.55 : 1.1)));
        shard.scaling.scaleInPlace(0.93);
        if (progress >= 1) {
          this.scene.onBeforeRenderObservable.remove(observer);
          shard.dispose();
        }
      });
    }
  }

  private updateHud(): void {
    const weapon = this.currentWeapon();
    const remaining = Math.max(0, tuning.missionSeconds - this.mission.elapsedSeconds);
    const waveNumber = Math.min(10, Math.max(1, Math.ceil((this.mission.elapsedSeconds / tuning.missionSeconds) * 10)));
    this.hud.phase.textContent = this.mission.phase === "playing" ? `${waveNumber}/10` : "0/10";
    this.hud.timer.textContent = `${Math.ceil(remaining)}s`;
    this.hud.base.textContent = `${Math.ceil(this.mission.baseIntegrity)}%`;
    this.hud.baseFill.style.width = `${Math.max(0, Math.min(100, this.mission.baseIntegrity))}%`;
    this.hud.base.style.color = this.mission.baseIntegrity < 30 ? visualTheme.hudDanger : "";
    this.hud.ammo.textContent = this.weapon.isReloading
      ? `RLD ${this.weapon.reloadSecondsRemaining.toFixed(1)}`
      : `${this.weapon.ammo}/${weapon.magazineSize}`;
    this.hud.weaponLabel.textContent = `${weapon.shortLabel} [1/2/3]`;
    this.hud.kills.textContent = `${this.mission.kills}`;
    this.hud.hostiles.textContent = `${this.mission.activeEnemies.length}`;
    this.hud.score.textContent = `${this.mission.score}`;
    this.hud.streak.textContent = `x${this.combo}`;
    this.hud.progressFill.style.width = `${Math.max(0, Math.min(100, (this.mission.elapsedSeconds / tuning.missionSeconds) * 100))}%`;
    this.hudRoot.classList.toggle("scoped", this.weapon.isScoped);
    this.hudRoot.classList.toggle("base-hit", this.baseFlashSeconds > 0);
    this.hudRoot.classList.toggle("targeting", Boolean(this.currentAimTarget));
    this.hudRoot.classList.toggle("hit", this.hitMarkerSeconds > 0);
    this.hudRoot.classList.toggle("comboing", this.combo > 1 && this.comboSeconds > 0);
    this.hudRoot.classList.toggle("threat", this.threatPulseSeconds > 0);
    this.hudRoot.style.setProperty("--hud-primary", visualTheme.hudPrimary);
    this.hudRoot.style.setProperty("--hud-danger", visualTheme.hudDanger);
    this.hud.notice.classList.toggle("visible", this.noticeSeconds > 0);
    if (this.currentAimTarget) {
      const target = this.currentAimTarget.enemy;
      this.hud.target.textContent = `${enemyLabel(target.kind, tuning.enemies)} ${Math.round(this.currentAimTarget.distance)}m`;
      this.hud.weak.textContent = `Weak point: ${this.currentAimTarget.weakPoint.toUpperCase()} | HP ${Math.ceil(healthRatio(target) * 100)}%`;
      this.hud.weak.className = this.currentAimTarget.weakPoint;
    } else {
      this.hud.target.textContent = "No target";
      this.hud.weak.textContent = "Weak point: none";
      this.hud.weak.className = "";
    }

    this.updateMinimap();
    this.updateNextWave();
    this.updateEnemyHealthbar();
  }

  private updateMinimap(): void {
    const camera = this.camera.position;
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    const scale = 1.25; // px per world unit (range ~45 units)
    const center = 64; // minimap is 128px
    const radius = 56;
    const seen = new Set<number>();

    for (const enemy of this.mission.activeEnemies) {
      if (enemy.state === "dead") {
        continue;
      }
      const dx = enemy.x - camera.x;
      const dz = enemy.z - camera.z;
      const relForward = dx * sinYaw + dz * cosYaw;
      const relRight = dx * cosYaw - dz * sinYaw;
      let mapX = relRight * scale;
      let mapY = -relForward * scale;
      const dist = Math.sqrt(mapX * mapX + mapY * mapY);
      if (dist > radius) {
        const clamp = radius / dist;
        mapX *= clamp;
        mapY *= clamp;
      }
      let node = this.minimapBlipNodes.get(enemy.id);
      if (!node) {
        node = document.createElement("b");
        node.className = "minimap-blip";
        this.hud.minimapBlips.appendChild(node);
        this.minimapBlipNodes.set(enemy.id, node);
      }
      const isHeavy = tuning.enemies[enemy.kind].bodyStyle === "heavy";
      const cls = isHeavy ? "minimap-blip heavy" : "minimap-blip";
      if (node.className !== cls) {
        node.className = cls;
      }
      node.style.transform = `translate(${(center + mapX).toFixed(1)}px, ${(center + mapY).toFixed(1)}px)`;
      seen.add(enemy.id);
    }

    for (const [id, node] of this.minimapBlipNodes) {
      if (!seen.has(id)) {
        node.remove();
        this.minimapBlipNodes.delete(id);
      }
    }
  }

  private updateNextWave(): void {
    if (this.mission.phase !== "playing") {
      this.hud.nextWave.textContent = "";
      return;
    }
    let nextTime = Number.POSITIVE_INFINITY;
    let nextKind: EnemyKind | undefined;
    for (let i = 0; i < expandedWaves.length; i += 1) {
      const event = expandedWaves[i];
      if (this.mission.spawnedEvents.has(i)) {
        continue;
      }
      if (event.time > this.mission.elapsedSeconds && event.time < nextTime) {
        nextTime = event.time;
        nextKind = event.kind;
      }
    }
    if (!nextKind) {
      this.hud.nextWave.textContent = "Final hold";
      return;
    }
    const delta = Math.max(0, Math.ceil(nextTime - this.mission.elapsedSeconds));
    const label = tuning.enemies[nextKind].label;
    this.hud.nextWave.textContent = `Next: ${label} ${delta}s`;
  }

  private updateEnemyHealthbar(): void {
    const showWhen = this.currentAimTarget && this.weapon.isScoped;
    if (!showWhen || !this.currentAimTarget) {
      this.hud.enemyHealthbar.classList.remove("visible");
      return;
    }
    const enemy = this.currentAimTarget.enemy;
    const headPos = new Vector3(enemy.x, enemy.height + 0.4, enemy.z);
    const rect = this.canvas.getBoundingClientRect();
    const viewport = this.camera.viewport.toGlobal(rect.width, rect.height);
    const screen = Vector3.Project(headPos, Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
    if (screen.z < 0 || screen.z > 1) {
      this.hud.enemyHealthbar.classList.remove("visible");
      return;
    }
    const ratio = Math.max(0, Math.min(1, healthRatio(enemy)));
    this.hud.enemyHealthbar.classList.add("visible");
    this.hud.enemyHealthbar.style.transform = `translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px)`;
    this.hud.enemyHealthbarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.hud.enemyHealthbarFill.style.background =
      ratio > 0.6 ? "#71f5a1" : ratio > 0.3 ? "#ffd36a" : "#ff4438";
  }

  private notice(message: string, seconds: number): void {
    this.hud.notice.textContent = message;
    this.noticeSeconds = seconds;
  }

  private ensureAudio(): void {
    if (!this.audio) {
      this.audio = new AudioContext();
    }
    if (this.audio.state === "suspended") {
      void this.audio.resume();
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (!this.audio) {
      return;
    }
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audio.currentTime + duration);
    oscillator.stop(this.audio.currentTime + duration);
  }
}
