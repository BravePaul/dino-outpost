import { describe, expect, it } from "vitest";
import { tuning } from "../src/app/config";
import { applyWeaponDamage, createEnemyState, flattenedWaves, stepEnemy } from "../src/systems/simulation";

describe("simulation rules", () => {
  it("expands multi-count wave entries into ordered spawn times", () => {
    const waves = flattenedWaves([{ time: 5, kind: "raptor", lane: "left", count: 3, spacingSeconds: 1.5 }]);
    expect(waves.map((wave) => wave.time)).toEqual([5, 6.5, 8]);
  });

  it("critical weapon hits stagger living enemies and apply a multiplier", () => {
    const enemy = createEnemyState(1, "brute", "center", tuning);
    const weapon = tuning.weapons.carbine;
    const result = applyWeaponDamage(enemy, weapon, true);
    expect(result.damage).toBeCloseTo(weapon.damage * weapon.critMultiplier);
    expect(enemy.state).toBe("staggered");
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });

  it("enemies damage the base only after reaching the attack line", () => {
    const enemy = createEnemyState(1, "raptor", "center", tuning);
    const approach = stepEnemy(enemy, 1, tuning.attackLineZ);
    expect(approach.baseDamage).toBe(0);
    enemy.z = tuning.attackLineZ;
    const attack = stepEnemy(enemy, 1, tuning.attackLineZ);
    expect(attack.baseDamage).toBeGreaterThan(0);
    expect(enemy.state).toBe("attacking");
  });

  it("uses differentiated dinosaur speeds from a distant spawn line", () => {
    expect(tuning.enemySpawnZ).toBeGreaterThan(20);
    expect(tuning.enemies.raptor.speed).toBeGreaterThan(tuning.enemies.rex.speed);
    expect(tuning.enemies.rex.speed).toBeGreaterThan(tuning.enemies.sauropod.speed);
  });

  it("defines three switchable weapons with distinct ranges and magazine sizes", () => {
    expect(Object.keys(tuning.weapons).sort()).toEqual(["carbine", "marksman", "shotgun"]);
    expect(tuning.weapons.marksman.range).toBeGreaterThan(tuning.weapons.shotgun.range);
    expect(tuning.weapons.carbine.magazineSize).toBeGreaterThan(tuning.weapons.marksman.magazineSize);
  });
});
