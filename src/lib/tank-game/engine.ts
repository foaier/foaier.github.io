import { BASE, COLS, HEIGHT, LEVELS, PLAYER_SPAWN, ROWS, SPAWNS, TILE, WIDTH, type EnemyKind, type Level, type Tile } from "./levels";

export type Direction = "up" | "right" | "down" | "left";
export type Phase = "ready" | "playing" | "paused" | "won" | "lost" | "complete";
export type PowerKind = "repair" | "shield" | "fire" | "freeze";
export type Sound = "shot" | "hit" | "explosion" | "pickup" | "win" | "lose";
export type Tank = {
  id: number; x: number; y: number; direction: Direction; hp: number; maxHp: number;
  kind: EnemyKind | "player"; cooldown: number; shield: number; move: number;
  target: { x: number; y: number } | null; intent: "base" | "player";
};
export type Bullet = { id: number; x: number; y: number; direction: Direction; owner: number; friendly: boolean; power: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
export type Power = { x: number; y: number; kind: PowerKind; life: number };
export type Input = { direction: Direction | null; fire: boolean };
export type Game = {
  level: Level; phase: Phase; tiles: Tile[]; player: Tank; enemies: Tank[]; bullets: Bullet[];
  particles: Particle[]; powers: Power[]; score: number; kills: number; spawned: number;
  baseHp: number; lives: number; time: number; spawnIn: number; spawnLane: number;
  nextId: number; rng: number; freeze: number; firePower: number; shake: number;
  notice: string; noticeTime: number; reason: string; sounds: Sound[];
};
const VECTORS: Record<Direction, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];
export const POWER_NAMES: Record<PowerKind, string> = { repair: "装甲修复", shield: "无敌护盾", fire: "强化火力", freeze: "时间冻结" };
const HALF = 9;
const center = (n: number) => n * TILE + TILE / 2;
const cell = (n: number) => Math.floor(n / TILE);
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

function rng(game: Game) {
  game.rng = (Math.imul(game.rng, 1664525) + 1013904223) >>> 0;
  return game.rng / 4294967296;
}

function newPlayer(): Tank {
  return { id: 0, x: center(PLAYER_SPAWN.col), y: center(PLAYER_SPAWN.row), direction: "up", hp: 3, maxHp: 3, kind: "player", cooldown: 0, shield: 3, move: 0, target: null, intent: "base" };
}

export function createGame(levelId = 1): Game {
  const level = LEVELS[clamp(Math.floor(levelId) || 1, 1, 50) - 1];
  return {
    level, phase: "ready", tiles: [...level.tiles], player: newPlayer(), enemies: [], bullets: [],
    particles: [], powers: [], score: 0, kills: 0, spawned: 0, baseHp: 3, lives: 3, time: 0,
    spawnIn: 1.2, spawnLane: 0, nextId: 1, rng: level.id * 104729,
    freeze: 0, firePower: 0, shake: 0, notice: "守住基地，击退全部敌军", noticeTime: 3, reason: "", sounds: [],
  };
}

export function blocksTank(tile: Tile) { return tile === 1 || tile === 2 || tile === 3; }

function terrainClear(game: Game, x: number, y: number) {
  if (x - HALF < TILE || y - HALF < TILE || x + HALF > WIDTH - TILE || y + HALF > HEIGHT - TILE) return false;
  if (Math.abs(x - center(BASE.col)) < HALF + 10 && Math.abs(y - center(BASE.row)) < HALF + 10) return false;
  for (const dx of [-HALF + 1, HALF - 1]) for (const dy of [-HALF + 1, HALF - 1]) {
    if (blocksTank(game.tiles[cell(y + dy) * COLS + cell(x + dx)])) return false;
  }
  return true;
}

function canMove(game: Game, tank: Tank, x: number, y: number) {
  if (!terrainClear(game, x, y)) return false;
  return [game.player, ...game.enemies].every((other) => other.id === tank.id || other.hp <= 0 || Math.abs(other.x - x) >= 18 || Math.abs(other.y - y) >= 18);
}

function move(game: Game, tank: Tank, direction: Direction, amount: number) {
  tank.direction = direction;
  const [dx, dy] = VECTORS[direction];
  let x = tank.x;
  let y = tank.y;
  // Assist a turn into a one-tile lane without allowing a jump through walls.
  if (dx && Math.abs(center(cell(y)) - y) <= 5) y = center(cell(y));
  if (dy && Math.abs(center(cell(x)) - x) <= 5) x = center(cell(x));
  if (canMove(game, tank, x + dx * amount, y + dy * amount)) {
    tank.x = x + dx * amount; tank.y = y + dy * amount; tank.move += amount;
    return true;
  }
  return false;
}

function burst(game: Game, x: number, y: number, color: string, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = rng(game) * Math.PI * 2;
    const speed = 20 + rng(game) * 65;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + rng(game) * 0.4, color, size: 2 + Math.floor(rng(game) * 3) });
  }
}

function notice(game: Game, text: string) { game.notice = text; game.noticeTime = 2.5; }

function fire(game: Game, tank: Tank) {
  if (tank.cooldown > 0 || tank.hp <= 0) return;
  const friendly = tank.kind === "player";
  const ownBullets = game.bullets.filter((bullet) => bullet.owner === tank.id).length;
  if (ownBullets >= (friendly ? 5 : 2)) return;
  const [dx, dy] = VECTORS[tank.direction];
  game.bullets.push({ id: game.nextId++, x: tank.x + dx * 12, y: tank.y + dy * 12, direction: tank.direction, owner: tank.id, friendly, power: friendly && game.firePower > 0 ? 2 : 1 });
  tank.cooldown = friendly ? (game.firePower > 0 ? 0.18 : 0.32) : game.level.fireDelay * (tank.kind === "gunner" ? 0.6 : tank.kind === "commander" ? 0.7 : 1) * (0.85 + rng(game) * 0.3);
  if (friendly) game.sounds.push("shot");
}

// A shortest route through breakable walls; steel, water and the base stay impassable.
export function findDirection(game: Game, tank: Tank): Direction | null {
  const start = cell(tank.y) * COLS + cell(tank.x);
  const target = tank.intent === "player" ? cell(game.player.y) * COLS + cell(game.player.x) : 17 * COLS + BASE.col;
  if (start === target) {
    if (tank.intent === "base") return "down";
    return null;
  }
  const queue = [start];
  const seen = new Set([start]);
  const first = new Map<number, Direction>();
  const order = tank.id % 2 ? DIRECTIONS : ["down", "right", "left", "up"] as Direction[];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const row = Math.floor(current / COLS), col = current % COLS;
    for (const direction of order) {
      const [dx, dy] = VECTORS[direction];
      const nc = col + dx, nr = row + dy, next = nr * COLS + nc;
      if (nc < 1 || nc >= COLS - 1 || nr < 1 || nr >= ROWS - 1 || seen.has(next) || (nc === BASE.col && nr === BASE.row)) continue;
      if (game.tiles[next] === 2 || game.tiles[next] === 3) continue;
      if (next !== target && game.enemies.some((other) => other.id !== tank.id && cell(other.x) === nc && cell(other.y) === nr)) continue;
      first.set(next, current === start ? direction : first.get(current) as Direction);
      if (next === target) return first.get(next) ?? null;
      seen.add(next); queue.push(next);
    }
  }
  return null;
}

function updateEnemy(game: Game, tank: Tank, dt: number) {
  tank.cooldown = Math.max(0, tank.cooldown - dt);
  tank.shield = Math.max(0, tank.shield - dt);
  if (game.freeze > 0 || tank.shield > 0) return;
  if (tank.intent === "base" && Math.abs(tank.x - center(BASE.col)) < 1 && cell(tank.y) >= 17 && !tank.target) {
    tank.direction = "down"; tank.target = null; fire(game, tank); return;
  }
  if (!tank.target) {
    const direction = findDirection(game, tank);
    if (direction) {
      tank.direction = direction;
      const [dx, dy] = VECTORS[direction];
      tank.target = { x: center(cell(tank.x) + dx), y: center(cell(tank.y) + dy) };
    }
  }
  if (tank.target) {
    const speed = game.level.speed * (tank.kind === "runner" ? 1.45 : tank.kind === "armor" ? 0.8 : tank.kind === "commander" ? 0.85 : 1);
    const distance = Math.abs(tank.target.x - tank.x) + Math.abs(tank.target.y - tank.y);
    const moved = move(game, tank, tank.direction, Math.min(distance, speed * dt));
    if (distance <= speed * dt + 0.01) tank.target = null;
    if (!moved && Math.abs(tank.x - center(cell(tank.x))) < 1 && Math.abs(tank.y - center(cell(tank.y))) < 1 && game.tiles[cell(tank.target?.y ?? tank.y) * COLS + cell(tank.target?.x ?? tank.x)] !== 1 && rng(game) < dt) {
      // Replan when another tank is blocking the lane; never teleport through it.
      tank.target = null;
      if (tank.intent === "player") tank.intent = "base";
    }
  }
  fire(game, tank);
}

function spawnEnemy(game: Game) {
  if (game.spawned >= game.level.enemies || game.enemies.length >= game.level.active) return false;
  for (let i = 0; i < SPAWNS.length; i++) {
    const spawn = SPAWNS[(game.spawnLane + i) % SPAWNS.length];
    const x = center(spawn.col), y = center(spawn.row);
    if ([game.player, ...game.enemies].some((tank) => Math.abs(tank.x - x) < 25 && Math.abs(tank.y - y) < 25)) continue;
    const kind = game.level.roster[game.spawned];
    const hp = kind === "commander" ? 4 + game.level.chapter : kind === "armor" ? 3 : kind === "gunner" ? 2 : 1;
    game.enemies.push({ id: game.nextId++, x, y, direction: "down", hp, maxHp: hp, kind, cooldown: 1.5, shield: 0.8, move: 0, target: null, intent: game.spawned % 3 === 1 ? "player" : "base" });
    game.spawnLane = (game.spawnLane + i + 1) % SPAWNS.length;
    game.spawned++;
    if (kind === "commander") notice(game, "重装指挥车进入战场");
    return true;
  }
  return false;
}

function defeatEnemy(game: Game, enemy: Tank) {
  game.kills++; game.score += enemy.kind === "commander" ? 1000 : enemy.kind === "armor" ? 300 : enemy.kind === "gunner" ? 200 : 100;
  burst(game, enemy.x, enemy.y, "#ffbe72", 20); game.shake = 0.15; game.sounds.push("explosion");
  if (game.kills % 4 === 0 || enemy.kind === "commander") {
    const kinds: PowerKind[] = ["repair", "shield", "fire", "freeze"];
    game.powers.push({ x: enemy.x, y: enemy.y, kind: kinds[(Math.floor(game.kills / 4) - 1 + game.level.chapter) % 4], life: 18 });
    notice(game, "补给已掉落，驶过去即可拾取");
  }
}

export function collectPower(game: Game, kind: PowerKind) {
  if (kind === "repair") { game.player.hp = 3; game.baseHp = Math.min(3, game.baseHp + 1); }
  if (kind === "shield") game.player.shield = 9;
  if (kind === "fire") game.firePower = 14;
  if (kind === "freeze") game.freeze = 7;
  game.score += 50; game.sounds.push("pickup"); notice(game, `${POWER_NAMES[kind]}已生效`);
}

function lose(game: Game, reason: string) {
  game.phase = "lost"; game.reason = reason; game.sounds.push("lose");
}

function damagePlayer(game: Game, damage: number) {
  if (game.player.shield > 0) return;
  game.player.hp -= damage; game.player.shield = 1; game.shake = 0.18; game.sounds.push("hit");
  if (game.player.hp <= 0) {
    burst(game, game.player.x, game.player.y, "#efc86a", 22);
    game.lives--;
    if (game.lives <= 0) lose(game, "我方坦克全部损失");
    else {
      game.player = newPlayer(); game.player.shield = 3; game.firePower = 0;
      // A tank occupying the default spawn must not trap the replacement tank.
      if (!canMove(game, game.player, game.player.x, game.player.y)) {
        const candidates = Array.from({ length: COLS * ROWS }, (_, index) => ({ x: center(index % COLS), y: center(Math.floor(index / COLS)) }))
          .sort((a, b) => Math.abs(a.x - game.player.x) + Math.abs(a.y - game.player.y) - Math.abs(b.x - game.player.x) - Math.abs(b.y - game.player.y));
        const spawn = candidates.find((position) => canMove(game, game.player, position.x, position.y));
        if (spawn) { game.player.x = spawn.x; game.player.y = spawn.y; }
      }
      // Clear nearby projectiles while the replacement's spawn shield activates.
      game.bullets = game.bullets.filter((b) => Math.abs(b.x - game.player.x) > 30 || Math.abs(b.y - game.player.y) > 30);
      notice(game, `坦克已补充，剩余 ${game.lives} 辆`);
    }
  }
}

function updateBullets(game: Game, dt: number) {
  const removed = new Set<number>();
  for (const bullet of game.bullets) {
    if (removed.has(bullet.id)) continue;
    const [dx, dy] = VECTORS[bullet.direction];
    const distance = (bullet.friendly ? 250 : 145 + game.level.id * 1.1) * dt;
    const steps = Math.max(1, Math.ceil(distance / 2));
    for (let step = 0; step < steps; step++) {
      bullet.x += dx * distance / steps; bullet.y += dy * distance / steps;
      const col = cell(bullet.x), row = cell(bullet.y);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) { removed.add(bullet.id); break; }
      const index = row * COLS + col, tile = game.tiles[index];
      if (tile === 1 || tile === 2) {
        if (tile === 1 || (bullet.power === 2 && col > 0 && col < COLS - 1 && row > 0 && row < ROWS - 1)) {
          game.tiles[index] = 0; burst(game, bullet.x, bullet.y, tile === 1 ? "#b48361" : "#b5c5bb", 5);
        } else burst(game, bullet.x, bullet.y, "#ebd297", 3);
        removed.add(bullet.id); break;
      }
      if (Math.abs(bullet.x - center(BASE.col)) < 11 && Math.abs(bullet.y - center(BASE.row)) < 11) {
        // Friendly fire never damages the base, including shots after a ricochet lane is opened.
        if (!bullet.friendly) {
          game.baseHp--; game.shake = 0.25; game.sounds.push("hit");
          burst(game, bullet.x, bullet.y, "#ffad73");
          notice(game, `基地受到攻击，耐久 ${game.baseHp}/3`);
          if (game.baseHp <= 0) lose(game, "基地失守");
        }
        removed.add(bullet.id); break;
      }
      const opponent = game.bullets.find((other) => other.friendly !== bullet.friendly && !removed.has(other.id) && Math.abs(other.x - bullet.x) < 5 && Math.abs(other.y - bullet.y) < 5);
      if (opponent) { removed.add(opponent.id); removed.add(bullet.id); burst(game, bullet.x, bullet.y, "#fff1b1", 4); break; }
      const target = bullet.friendly ? game.enemies.find((enemy) => enemy.hp > 0 && Math.abs(enemy.x - bullet.x) < 11 && Math.abs(enemy.y - bullet.y) < 11) : Math.abs(game.player.x - bullet.x) < 11 && Math.abs(game.player.y - bullet.y) < 11 ? game.player : null;
      if (target) {
        if (target.kind === "player") damagePlayer(game, bullet.power);
        else if (target.shield <= 0) {
          target.hp -= bullet.power;
          if (target.hp <= 0) defeatEnemy(game, target);
          else { burst(game, target.x, target.y, "#ffdfa5", 5); game.sounds.push("hit"); }
        }
        removed.add(bullet.id); break;
      }
    }
    if (game.phase === "lost") break;
  }
  game.bullets = game.bullets.filter((bullet) => !removed.has(bullet.id));
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
}

export function stepGame(game: Game, input: Input, dt: number) {
  if (game.phase !== "playing") return;
  dt = clamp(dt, 0, 1 / 30);
  game.time += dt;
  for (const field of ["freeze", "firePower", "shake", "noticeTime"] as const) game[field] = Math.max(0, game[field] - dt);
  game.player.shield = Math.max(0, game.player.shield - dt);
  game.player.cooldown = Math.max(0, game.player.cooldown - dt);
  if (input.direction) {
    const tile = game.tiles[cell(game.player.y) * COLS + cell(game.player.x)];
    move(game, game.player, input.direction, (tile === 5 ? 112 : 91) * dt);
  }
  if (input.fire) fire(game, game.player);
  game.spawnIn -= dt;
  if (game.spawnIn <= 0 && spawnEnemy(game)) game.spawnIn = game.level.interval;
  for (const enemy of game.enemies) updateEnemy(game, enemy, dt);
  updateBullets(game, dt);
  if (game.baseHp <= 0 || game.lives <= 0) return;
  for (const power of game.powers) {
    power.life -= dt;
    if (Math.abs(game.player.x - power.x) < 18 && Math.abs(game.player.y - power.y) < 18) { collectPower(game, power.kind); power.life = 0; }
  }
  game.powers = game.powers.filter((power) => power.life > 0);
  for (const particle of game.particles) { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; }
  game.particles = game.particles.filter((particle) => particle.life > 0).slice(-160);
  if (game.kills === game.level.enemies) {
    game.phase = game.level.id === 50 ? "complete" : "won";
    game.score += game.baseHp * 200 + game.lives * 100;
    game.sounds.push("win");
  }
}

export type Progress = { unlocked: number; cleared: number[]; best: number; muted: boolean };
export const EMPTY_PROGRESS: Progress = { unlocked: 1, cleared: [], best: 0, muted: true };
export function readProgress(value: string | null): Progress {
  try {
    const data = JSON.parse(value ?? "null");
    if (!data || typeof data !== "object") return { ...EMPTY_PROGRESS, cleared: [] };
    const cleared = Array.isArray(data.cleared) ? [...new Set<number>(data.cleared.filter((n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 50))].sort((a, b) => a - b) : [];
    return { unlocked: Math.min(50, Math.max(1, ...cleared.map((n) => n + 1))), cleared, best: Number.isFinite(data.best) ? clamp(Math.floor(data.best), 0, 9999999) : 0, muted: data.muted !== false };
  } catch { return { ...EMPTY_PROGRESS, cleared: [] }; }
}

export function recordWin(progress: Progress, game: Game): Progress {
  if (game.phase !== "won" && game.phase !== "complete") return progress;
  return { ...progress, cleared: [...new Set([...progress.cleared, game.level.id])].sort((a, b) => a - b), unlocked: Math.max(progress.unlocked, Math.min(50, game.level.id + 1)), best: Math.max(progress.best, game.score) };
}
