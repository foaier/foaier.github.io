import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(path.join(os.tmpdir(), "foaier-tank-check-"));
const require = createRequire(import.meta.url);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }

try {
  for (const name of ["levels", "engine"]) {
    const source = readFileSync(new URL(`../src/lib/tank-game/${name}.ts`, import.meta.url), "utf8");
    writeFileSync(path.join(directory, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  const { LEVELS, COLS, ROWS, TILE, SPAWNS, BASE } = require(path.join(directory, "levels.js"));
  const { createGame, stepGame, blocksTank, collectPower, recordWin, readProgress, EMPTY_PROGRESS } = require(path.join(directory, "engine.js"));
  const center = (n) => n * TILE + TILE / 2;
  const idle = { direction: null, fire: false };
  function run(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(game, input, 1 / 60); }
  function sandbox(id = 1) {
    const game = createGame(id); game.phase = "playing"; game.spawnIn = 10000;
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) game.tiles[r * COLS + c] = 0;
    return game;
  }
  function bullet(game, x, y, friendly = true, power = 1, direction = "up") {
    game.bullets.push({ id: game.nextId++, x, y, direction, owner: friendly ? 0 : 99, friendly, power });
  }

  check("50 distinct deterministic maps, progressive waves and connected roads", () => {
    assert.equal(LEVELS.length, 50);
    assert.equal(new Set(LEVELS.map((l) => l.tiles.join(""))).size, 50);
    for (const [index, level] of LEVELS.entries()) {
      assert.equal(level.id, index + 1); assert.equal(level.tiles.length, COLS * ROWS);
      assert.equal(level.roster.length, level.enemies);
      if (index > 0) {
        assert.ok(level.enemies >= LEVELS[index - 1].enemies);
        assert.ok(level.speed >= LEVELS[index - 1].speed);
        assert.ok(level.interval <= LEVELS[index - 1].interval);
      }
      assert.equal(level.roster.includes("commander"), level.id % 10 === 0);
      for (const spawn of SPAWNS) {
        const queue = [spawn.row * COLS + spawn.col], seen = new Set(queue);
        for (let i = 0; i < queue.length; i++) for (const delta of [-COLS, 1, COLS, -1]) {
          const next = queue[i] + delta;
          if (next < 0 || next >= COLS * ROWS || seen.has(next) || blocksTank(level.tiles[next])) continue;
          queue.push(next); seen.add(next);
        }
        assert.ok(seen.has(17 * COLS + BASE.col), `Level ${level.id} spawn must reach siege lane`);
        assert.ok(seen.has(19 * COLS + 10), `Level ${level.id} player must reach spawn`);
      }
    }
  });
  check("wall collisions stop movement; open road permits turning", () => {
    const g = sandbox(); g.player.x = center(8); g.player.y = center(8);
    g.tiles[7 * COLS + 8] = 2;
    run(g, 1, { direction: "up", fire: false });
    assert.ok(g.player.y >= 8 * TILE + 8);
    const x = g.player.x;
    run(g, 0.5, { direction: "right", fire: false });
    assert.ok(g.player.x > x + 30);
  });
  check("bricks break, standard shots stop on steel, upgraded shots break interior steel", () => {
    for (const [tile, power, expected] of [[1, 1, 0], [2, 1, 2], [2, 2, 0]]) {
      const g = sandbox(); g.tiles[8 * COLS + 8] = tile;
      bullet(g, center(8), center(9), true, power); run(g, 0.15);
      assert.equal(g.tiles[8 * COLS + 8], expected); assert.equal(g.bullets.length, 0);
    }
    const g = sandbox(); bullet(g, center(8), center(1), true, 2); run(g, 0.2);
    assert.equal(g.tiles[8], 2);
  });
  check("friendly shots spare base; enemy hits end the stage at zero durability", () => {
    const g = sandbox(); bullet(g, center(BASE.col), center(BASE.row) - 18, true, 1, "down"); run(g, 0.1);
    assert.equal(g.baseHp, 3);
    for (let i = 0; i < 3; i++) { bullet(g, center(BASE.col), center(BASE.row) - 18, false, 1, "down"); run(g, 0.1); }
    assert.equal(g.baseHp, 0); assert.equal(g.phase, "lost");
  });
  check("spawn shield, armor damage, respawn and final player loss", () => {
    const g = sandbox();
    bullet(g, g.player.x, g.player.y - 15, false, 1, "down"); run(g, 0.1); assert.equal(g.player.hp, 3);
    for (let i = 0; i < 9; i++) {
      g.player.shield = 0; bullet(g, g.player.x, g.player.y - 15, false, 1, "down"); run(g, 0.1);
    }
    assert.equal(g.lives, 0); assert.equal(g.phase, "lost");
  });
  check("pickups restore health, grant temporary power and expire", () => {
    const g = sandbox(); g.player.hp = 1; g.baseHp = 1;
    collectPower(g, "repair"); assert.equal(g.player.hp, 3); assert.equal(g.baseHp, 2);
    for (const kind of ["shield", "fire", "freeze"]) collectPower(g, kind);
    assert.equal(g.freeze, 7); assert.equal(g.firePower, 14); assert.equal(g.player.shield, 9);
    run(g, 15); assert.equal(g.freeze, 0); assert.equal(g.firePower, 0); assert.equal(g.player.shield, 0);
  });
  check("an occupied respawn tile never traps the replacement tank", () => {
    const g = sandbox();
    g.enemies.push({ ...g.player, id: 99, kind: "scout", shield: 0 });
    g.freeze = 5;
    g.player.x = center(7); g.player.y = center(19); g.player.hp = 1; g.player.shield = 0;
    bullet(g, g.player.x, g.player.y - 15, false, 1, "down"); run(g, 0.1);
    assert.equal(g.lives, 2);
    assert.ok(g.enemies.every((e) => Math.abs(g.player.x - e.x) >= 18 || Math.abs(g.player.y - e.y) >= 18));
    const y = g.player.y; run(g, 0.2, { direction: "up", fire: false });
    assert.ok(g.player.y < y - 10);
  });
  check("actual projectile hit defeats enemies, awards points and completes the level", () => {
    const g = sandbox(); g.kills = g.level.enemies - 1; g.spawned = g.level.enemies;
    g.enemies.push({ id: 10, x: center(8), y: center(8), direction: "down", hp: 1, maxHp: 1, kind: "scout", cooldown: 100, shield: 0, move: 0, target: null, intent: "base" });
    g.freeze = 1; bullet(g, center(8), center(9)); run(g, 0.2);
    assert.equal(g.kills, g.level.enemies); assert.equal(g.phase, "won"); assert.equal(g.enemies.length, 0);
    assert.equal(g.score, 1000); assert.equal(g.powers.length, 1);
  });
  check("pause is inert and enemy population never exceeds the stage cap", () => {
    const g = createGame(50); g.phase = "paused"; const before = JSON.stringify(g); run(g, 1);
    assert.equal(JSON.stringify(g), before);
    g.phase = "playing"; run(g, 10); assert.ok(g.enemies.length <= g.level.active); assert.ok(g.spawned <= g.level.enemies);
  });
  check("unopposed AI can reach and attack the base on every map", () => {
    for (const level of LEVELS) {
      const g = createGame(level.id); g.phase = "playing"; g.player.shield = 10000;
      // Keep a stationary player out of the siege lane, test real waves and navigation.
      run(g, 140);
      assert.equal(g.phase, "lost", `AI stuck in stage ${level.id}`);
      assert.equal(g.baseHp, 0, `AI should attack the base in stage ${level.id}`);
    }
  });
  check("all 50 clears unlock sequentially, the final stage completes the campaign", () => {
    let progress = { ...EMPTY_PROGRESS, cleared: [] };
    for (let id = 1; id <= 50; id++) {
      const g = sandbox(id); g.kills = g.level.enemies; stepGame(g, idle, 1 / 60);
      assert.equal(g.phase, id === 50 ? "complete" : "won");
      progress = recordWin(progress, g); assert.equal(progress.unlocked, Math.min(50, id + 1));
    }
    assert.equal(progress.cleared.length, 50);
    assert.deepEqual(readProgress(JSON.stringify(progress)), progress);
    assert.deepEqual(readProgress("broken-json"), EMPTY_PROGRESS);
    assert.equal(readProgress('{"cleared":[-1,0,51,"50"],"best":-100}').unlocked, 1);
    assert.equal(readProgress('{"cleared":[1,1,2],"best":100}').cleared.length, 2);
  });
  console.log(`${checks} tank game checks passed.`);
} finally { rmSync(directory, { recursive: true, force: true }); }
