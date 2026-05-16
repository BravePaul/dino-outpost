export type MissionPhase = "briefing" | "playing" | "won" | "lost";

export type LaneId = "left" | "center" | "right";

export type EnemyKind = "raptor" | "parasaur" | "rex" | "brute" | "stego" | "sauropod";

export type WeaponId = "carbine" | "marksman" | "shotgun";

export type WeakPointState = "none" | "near" | "locked";

export interface VisualTheme {
  skyTop: string;
  skyHorizon: string;
  sun: string;
  mud: string;
  foliage: string;
  foliageDark: string;
  metal: string;
  warning: string;
  hudPrimary: string;
  hudDanger: string;
  fogDensity: number;
  lightIntensity: number;
  vegetationDensity: number;
  tracerIntensity: number;
}

export interface WeaponConfig {
  id: WeaponId;
  label: string;
  shortLabel: string;
  magazineSize: number;
  damage: number;
  critMultiplier: number;
  fireIntervalSeconds: number;
  reloadSeconds: number;
  range: number;
  recoil: number;
  spread: number;
}

export interface EnemyConfig {
  label: string;
  maxHealth: number;
  speed: number;
  damagePerSecond: number;
  radius: number;
  height: number;
  bodyColor: string;
  weakColor: string;
  weakPointHeight: number;
  weakPointRadius: number;
  weakPointForwardOffset: number;
  modelFileName: string;
  modelScale: number;
  modelYaw: number;
  animationName: "run" | "walk";
  animationSpeed: number;
  bodyStyle: "runner" | "heavy";
  score: number;
}

export interface SpawnEvent {
  time: number;
  kind: EnemyKind;
  lane: LaneId;
  count?: number;
  spacingSeconds?: number;
}

export interface GameTuning {
  missionSeconds: number;
  baseIntegrity: number;
  attackLineZ: number;
  enemySpawnZ: number;
  lanes: Record<LaneId, number>;
  enemies: Record<EnemyKind, EnemyConfig>;
  weapon: WeaponConfig;
  defaultWeapon: WeaponId;
  weapons: Record<WeaponId, WeaponConfig>;
  waves: SpawnEvent[];
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  lane: LaneId;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  speed: number;
  damagePerSecond: number;
  radius: number;
  height: number;
  weakPointHeight: number;
  weakPointRadius: number;
  state: "approaching" | "attacking" | "staggered" | "dead";
  staggerSeconds: number;
}

export interface WeaponState {
  id: WeaponId;
  ammo: number;
  cooldownSeconds: number;
  reloadSecondsRemaining: number;
  isReloading: boolean;
  isScoped: boolean;
}

export interface MissionState {
  phase: MissionPhase;
  elapsedSeconds: number;
  baseIntegrity: number;
  kills: number;
  score: number;
  spawnedEvents: Set<number>;
  activeEnemies: EnemyState[];
}

export interface AimTarget {
  enemy: EnemyState;
  distance: number;
  weakPoint: WeakPointState;
}
