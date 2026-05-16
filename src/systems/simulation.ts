import type {
  EnemyConfig,
  EnemyKind,
  EnemyState,
  GameTuning,
  LaneId,
  SpawnEvent,
  WeaponConfig,
} from "../app/types";

export function createEnemyState(
  id: number,
  kind: EnemyKind,
  lane: LaneId,
  tuning: GameTuning,
  zOffset = 0,
): EnemyState {
  const config = tuning.enemies[kind];
  return {
    id,
    kind,
    lane,
    x: tuning.lanes[lane],
    z: tuning.enemySpawnZ + zOffset,
    health: config.maxHealth,
    maxHealth: config.maxHealth,
    speed: config.speed,
    damagePerSecond: config.damagePerSecond,
    radius: config.radius,
    height: config.height,
    weakPointHeight: config.weakPointHeight,
    weakPointRadius: config.weakPointRadius,
    state: "approaching",
    staggerSeconds: 0,
  };
}

export function expandSpawnEvent(event: SpawnEvent): SpawnEvent[] {
  const count = event.count ?? 1;
  const spacing = event.spacingSeconds ?? 0;
  return Array.from({ length: count }, (_, index) => ({
    time: event.time + index * spacing,
    kind: event.kind,
    lane: event.lane,
  }));
}

export function flattenedWaves(waves: SpawnEvent[]): SpawnEvent[] {
  return waves.flatMap(expandSpawnEvent).sort((a, b) => a.time - b.time);
}

export function applyWeaponDamage(
  enemy: EnemyState,
  weapon: WeaponConfig,
  isCritical: boolean,
): { damage: number; killed: boolean } {
  if (enemy.state === "dead") {
    return { damage: 0, killed: true };
  }
  const damage = weapon.damage * (isCritical ? weapon.critMultiplier : 1);
  enemy.health = Math.max(0, enemy.health - damage);
  if (isCritical && enemy.health > 0) {
    enemy.state = "staggered";
    enemy.staggerSeconds = 0.65;
  }
  if (enemy.health <= 0) {
    enemy.state = "dead";
  }
  return { damage, killed: enemy.state === "dead" };
}

export function stepEnemy(
  enemy: EnemyState,
  deltaSeconds: number,
  attackLineZ: number,
): { baseDamage: number } {
  if (enemy.state === "dead") {
    return { baseDamage: 0 };
  }
  if (enemy.state === "staggered") {
    enemy.staggerSeconds = Math.max(0, enemy.staggerSeconds - deltaSeconds);
    if (enemy.staggerSeconds === 0) {
      enemy.state = enemy.z <= attackLineZ ? "attacking" : "approaching";
    }
    return { baseDamage: 0 };
  }
  if (enemy.z <= attackLineZ) {
    enemy.state = "attacking";
    return { baseDamage: enemy.damagePerSecond * deltaSeconds };
  }
  enemy.state = "approaching";
  enemy.z = Math.max(attackLineZ, enemy.z - enemy.speed * deltaSeconds);
  return { baseDamage: 0 };
}

export function healthRatio(enemy: EnemyState): number {
  return enemy.maxHealth <= 0 ? 0 : enemy.health / enemy.maxHealth;
}

export function enemyLabel(kind: EnemyKind, configs: Record<EnemyKind, EnemyConfig>): string {
  return configs[kind].label;
}
