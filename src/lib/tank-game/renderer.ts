import { BASE, CHAPTERS, COLS, HEIGHT, ROWS, SPAWNS, TILE, WIDTH } from "./levels";
import type { Direction, Game, PowerKind, Tank } from "./engine";

const ANGLES: Record<Direction, number> = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const POWER_COLORS: Record<PowerKind, string> = { repair: "#a7cf87", shield: "#8ed6df", fire: "#f1b969", freeze: "#b4c4f3" };
const POWER_GLYPHS: Record<PowerKind, string> = { repair: "+", shield: "S", fire: "F", freeze: "T" };

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function tank(ctx: CanvasRenderingContext2D, unit: Tank, time: number) {
  ctx.save();
  ctx.translate(Math.round(unit.x), Math.round(unit.y)); ctx.rotate(ANGLES[unit.direction]);
  const player = unit.kind === "player";
  const armored = unit.kind === "armor" || unit.kind === "commander";
  const main = player ? "#efc971" : unit.kind === "runner" ? "#e29e77" : unit.kind === "gunner" ? "#bc9cce" : armored ? "#c87965" : "#cf8c79";
  const light = player ? "#fff0a7" : "#f0c2a2";
  rect(ctx, -10, -8, 22, 21, "#1c2521");
  rect(ctx, -10, -10, 5, 21, "#171f1c"); rect(ctx, 5, -10, 5, 21, "#171f1c");
  const offset = Math.floor(unit.move / 3) % 4;
  for (let y = -9 + offset; y < 10; y += 4) {
    rect(ctx, -10, y, 4, 2, "#68716a"); rect(ctx, 6, y, 4, 2, "#68716a");
  }
  rect(ctx, -6, -8, 12, 18, main); rect(ctx, -6, -8, 2, 16, light);
  rect(ctx, -4, -5, 9, 10, "#565445"); rect(ctx, -3, -6, 7, 8, main);
  rect(ctx, -2, -15, 4, 13, light); rect(ctx, -1, -15, 2, 11, main);
  rect(ctx, -3, 6, 6, 2, "#74644a");
  if (armored) { rect(ctx, -5, 2, 10, 2, light); rect(ctx, -4, 7, 8, 2, "#754c40"); }
  if (unit.kind === "commander") { rect(ctx, -6, -7, 12, 2, "#f5d779"); rect(ctx, -2, 0, 4, 4, "#f5d779"); }
  ctx.restore();
  if (unit.shield > 0) {
    ctx.strokeStyle = `rgba(165,225,224,${0.5 + Math.sin(time * 12) * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(Math.round(unit.x) - 14, Math.round(unit.y) - 14, 28, 28);
  }
  if (!player && unit.maxHp > 1) {
    rect(ctx, unit.x - 11, unit.y - 20, 22, 3, "#1d2723");
    rect(ctx, unit.x - 11, unit.y - 20, Math.ceil(22 * unit.hp / unit.maxHp), 3, main);
  }
}

function trees(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  rect(ctx, x + 4, y + 3, 16, 18, "#293f30");
  rect(ctx, x + 2, y + 8, 20, 10, color); rect(ctx, x + 6, y + 2, 12, 20, color);
  rect(ctx, x + 7, y + 4, 6, 3, "#729069"); rect(ctx, x + 3, y + 11, 5, 2, "#729069");
  rect(ctx, x + 15, y + 14, 5, 5, "#344f37"); rect(ctx, x + 10, y + 19, 4, 3, "#47603e");
}

export function drawGame(ctx: CanvasRenderingContext2D, game: Game, reducedMotion = false) {
  const theme = CHAPTERS[game.level.chapter];
  const time = reducedMotion ? 0 : game.time;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, 0, 0, WIDTH, HEIGHT, "#17201b");
  ctx.save();
  if (game.shake > 0 && !reducedMotion) ctx.translate(Math.sin(time * 110) * 2, Math.cos(time * 95) * 2);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const tile = game.tiles[row * COLS + col], x = col * TILE, y = row * TILE;
    rect(ctx, x, y, TILE, TILE, theme.ground);
    rect(ctx, x + (col * 7 + row * 3) % 20, y + (row * 9 + col) % 20, 2, 2, theme.detail);
    if (tile === 1) {
      rect(ctx, x + 1, y + 1, 22, 22, "#5b4638");
      for (let by = 0; by < 3; by++) for (let bx = 0; bx < 2; bx++) {
        const shift = by % 2 ? 5 : 0;
        const left = x + 2 + bx * 11 - shift;
        rect(ctx, Math.max(x + 1, left), y + 2 + by * 7, bx === 0 && shift ? 6 : 10, 5, theme.brick);
        rect(ctx, Math.max(x + 1, left), y + 2 + by * 7, bx === 0 && shift ? 6 : 10, 1, "#d7a679");
      }
      rect(ctx, x + 22, y + 1, 1, 22, "#674a39");
    } else if (tile === 2) {
      const border = row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1;
      rect(ctx, x + 1, y + 1, 22, 22, border ? "#415047" : theme.steel);
      rect(ctx, x + 2, y + 2, 20, 2, border ? "#59675b" : "#c6d0b9");
      rect(ctx, x + 3, y + 4, 2, 16, border ? "#4b5b4d" : "#abb8a6");
      rect(ctx, x + 5, y + 5, 14, 14, border ? "#354238" : "#73847b");
      rect(ctx, x + 6, y + 6, 12, 11, border ? "#3c4a40" : "#92a092");
      if (!border) { rect(ctx, x + 3, y + 3, 2, 2, "#d4dcca"); rect(ctx, x + 19, y + 19, 2, 2, "#4a5c52"); }
    } else if (tile === 3) {
      rect(ctx, x, y, 24, 24, theme.water);
      for (let line = 0; line < 3; line++) {
        const wave = (Math.floor(time * 9) + line * 7 + col * 3) % 14;
        rect(ctx, x + wave, y + 4 + line * 7, 8, 2, "#60949a");
      }
    } else if (tile === 5) {
      rect(ctx, x, y, 24, 24, "#73969b"); rect(ctx, x + 3, y + 5, 9, 2, "#a9c5c2");
      rect(ctx, x + 9, y + 7, 2, 8, "#a9c5c2"); rect(ctx, x + 11, y + 15, 8, 2, "#a9c5c2");
    }
  }
  // Entry markers remain visible so the next wave never appears without warning.
  for (const { col, row } of SPAWNS) {
    const x = col * TILE, y = row * TILE;
    ctx.strokeStyle = "#c8886a"; ctx.lineWidth = 1;
    ctx.strokeRect(x + 2.5, y + 2.5, 19, 19);
    rect(ctx, x + 9, y + 7, 6, 2, "#c8886a"); rect(ctx, x + 10, y + 9, 4, 3, "#c8886a");
  }
  const bx = BASE.col * TILE, by = BASE.row * TILE;
  rect(ctx, bx, by, 24, 24, "#172820"); rect(ctx, bx + 2, by + 2, 20, 20, game.baseHp > 0 ? "#b9c79b" : "#805d50");
  rect(ctx, bx + 4, by + 4, 16, 16, "#374838");
  rect(ctx, bx + 10, by + 6, 4, 13, "#e0d8a2"); rect(ctx, bx + 5, by + 9, 14, 4, "#e0d8a2");
  rect(ctx, bx + 7, by + 13, 10, 2, "#e0d8a2"); rect(ctx, bx + 11, by + 5, 5, 3, "#e0d8a2");

  for (const enemy of game.enemies) tank(ctx, enemy, time);
  if (game.player.hp > 0) tank(ctx, game.player, time);
  if (game.phase === "ready") {
    for (const [i, col] of [1, 12, 23].entries()) {
      tank(ctx, { ...game.player, id: i + 1, x: col * TILE + 12, y: 3 * TILE + 12, direction: "down", kind: i === 1 && game.level.boss ? "commander" : "scout", shield: 0 }, time);
    }
  }
  // Foliage is drawn after tanks: it hides vehicles, never bullets or pickups.
  for (let row = 1; row < ROWS - 1; row++) for (let col = 1; col < COLS - 1; col++) {
    if (game.tiles[row * COLS + col] === 4) trees(ctx, col * TILE, row * TILE, theme.foliage);
  }
  for (const power of game.powers) {
    if (power.life < 4 && Math.floor(time * 7) % 2) continue;
    const x = Math.round(power.x) - 10, y = Math.round(power.y) - 10;
    rect(ctx, x - 2, y - 2, 24, 24, "#152a24"); rect(ctx, x, y, 20, 20, POWER_COLORS[power.kind]);
    ctx.fillStyle = "#20372e"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center";
    ctx.fillText(POWER_GLYPHS[power.kind], x + 10, y + 16);
  }
  for (const bullet of game.bullets) {
    const vertical = bullet.direction === "up" || bullet.direction === "down";
    rect(ctx, bullet.x - 3, bullet.y - 3, vertical ? 4 : 7, vertical ? 7 : 4, bullet.friendly ? "#fff0ac" : "#ff9875");
  }
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.min(1, particle.life * 3);
    rect(ctx, particle.x, particle.y, particle.size, particle.size, particle.color);
  }
  ctx.globalAlpha = 1;
  if (game.freeze > 0) { ctx.strokeStyle = "#a9cbe8"; ctx.lineWidth = 3; ctx.strokeRect(25, 25, WIDTH - 50, HEIGHT - 50); }
  ctx.restore();
}
