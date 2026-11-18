"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Play, RotateCcw } from "lucide-react";

const WIDTH = 480;
const HEIGHT = 240;
const GROUND = 198;
const ROUND_LENGTH = 30;
const PLAYER_X = 62;
const PLAYER_WIDTH = 22;
const PLAYER_HEIGHT = 25;
const BEST_SCORE_KEY = "foaier-pixel-runner-best";

type Phase = "ready" | "playing" | "over";
type Obstacle = { x: number; variant: number };
type Pickup = { x: number; y: number; spin: number };

type GameState = {
  elapsed: number;
  lift: number;
  velocity: number;
  world: number;
  obstacleDelay: number;
  pickupDelay: number;
  obstacles: Obstacle[];
  pickups: Pickup[];
  score: number;
  frame: number;
};

function freshGame(): GameState {
  return {
    elapsed: 0,
    lift: 0,
    velocity: 0,
    world: 0,
    obstacleDelay: 1.3,
    pickupDelay: 0.8,
    obstacles: [{ x: 360, variant: 0 }],
    pickups: [{ x: 275, y: 140, spin: 0 }],
    score: 0,
    frame: 0,
  };
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function drawRobot(ctx: CanvasRenderingContext2D, y: number, frame: number, airborne: boolean) {
  pixel(ctx, PLAYER_X + 2, GROUND + 2, 19, 3, "#15302b");
  pixel(ctx, PLAYER_X + 5, y + 5, 14, 16, "#d7ecc4");
  pixel(ctx, PLAYER_X + 3, y + 8, 18, 11, "#a9d99a");
  pixel(ctx, PLAYER_X + 4, y + 3, 16, 5, "#f1f0d1");
  pixel(ctx, PLAYER_X + 7, y + 4, 3, 3, "#ec805c");
  pixel(ctx, PLAYER_X + 13, y + 4, 3, 3, "#ec805c");
  pixel(ctx, PLAYER_X + 6, y + 10, 11, 5, "#31574b");
  pixel(ctx, PLAYER_X + 8, y + 11, 2, 2, "#f4d879");
  pixel(ctx, PLAYER_X + 14, y + 11, 2, 2, "#f4d879");
  pixel(ctx, PLAYER_X + 10, y, 3, 3, "#f1f0d1");
  pixel(ctx, PLAYER_X + 11, y - 3, 2, 3, "#ec805c");

  if (airborne) {
    pixel(ctx, PLAYER_X + 5, y + 21, 5, 4, "#ec805c");
    pixel(ctx, PLAYER_X + 15, y + 21, 5, 4, "#ec805c");
  } else {
    const step = frame % 2 === 0 ? 0 : 3;
    pixel(ctx, PLAYER_X + 5 + step, y + 21, 5, 4, "#ec805c");
    pixel(ctx, PLAYER_X + 14 - step, y + 21, 5, 4, "#ec805c");
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, variant: number) {
  const height = variant === 0 ? 26 : 34;
  const top = GROUND - height;
  pixel(ctx, x + 7, top, 7, height, "#83bf83");
  pixel(ctx, x + 4, top + 6, 3, 8, "#83bf83");
  pixel(ctx, x, top + 6, 4, 4, "#83bf83");
  pixel(ctx, x + 14, top + 12, 3, 8, "#83bf83");
  pixel(ctx, x + 17, top + 12, 4, 4, "#83bf83");
  pixel(ctx, x + 7, GROUND - 3, 7, 3, "#d6a66a");
}

function drawChip(ctx: CanvasRenderingContext2D, pickup: Pickup, elapsed: number) {
  const bob = Math.round(Math.sin(elapsed * 7 + pickup.spin) * 2);
  const y = pickup.y + bob;
  pixel(ctx, pickup.x + 4, y, 6, 3, "#f4d879");
  pixel(ctx, pickup.x + 2, y + 3, 10, 6, "#f4d879");
  pixel(ctx, pickup.x + 4, y + 9, 6, 3, "#f4d879");
  pixel(ctx, pickup.x + 5, y + 4, 4, 4, "#427864");
  pixel(ctx, pickup.x + 6, y + 5, 2, 2, "#e7f0cf");
}

function drawScene(ctx: CanvasRenderingContext2D, game: GameState, phase: Phase) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  pixel(ctx, 0, 0, WIDTH, HEIGHT, "#173b36");

  const stars = [
    [26, 24], [76, 47], [128, 20], [182, 42], [230, 17], [284, 34], [334, 16], [402, 40], [448, 22],
    [52, 74], [154, 62], [320, 70], [430, 76],
  ];
  for (let i = 0; i < stars.length; i += 1) {
    const [x, y] = stars[i];
    pixel(ctx, x, y, i % 3 === 0 ? 3 : 2, 2, (Math.floor(game.elapsed * 2 + i) % 4 === 0) ? "#83bf83" : "#c4d9a8");
  }

  pixel(ctx, 364, 30, 18, 18, "#f4d879");
  pixel(ctx, 360, 34, 26, 10, "#f4d879");
  pixel(ctx, 370, 26, 12, 26, "#f4d879");
  pixel(ctx, 369, 35, 4, 3, "#dca969");
  pixel(ctx, 378, 42, 4, 3, "#dca969");

  const skylineOffset = Math.floor(game.world * 0.18) % 64;
  const buildings = [
    { x: 8, w: 30, h: 45 }, { x: 50, w: 22, h: 64 }, { x: 82, w: 38, h: 38 },
    { x: 133, w: 26, h: 54 }, { x: 171, w: 38, h: 70 }, { x: 220, w: 28, h: 46 },
    { x: 259, w: 34, h: 59 }, { x: 304, w: 25, h: 41 }, { x: 339, w: 39, h: 63 },
    { x: 390, w: 26, h: 48 }, { x: 428, w: 36, h: 66 },
  ];
  for (const building of buildings) {
    const x = ((building.x - skylineOffset + WIDTH) % (WIDTH + 64)) - 32;
    const top = GROUND - building.h;
    pixel(ctx, x, top, building.w, building.h, "#204a40");
    pixel(ctx, x + 3, top - 4, Math.max(4, building.w - 6), 4, "#285747");
    for (let row = top + 9; row < GROUND - 8; row += 12) {
      for (let col = x + 5; col < x + building.w - 4; col += 10) {
        pixel(ctx, col, row, 3, 4, (Math.floor(col + row) % 3 === 0) ? "#d09a62" : "#718e68");
      }
    }
  }

  pixel(ctx, 0, GROUND - 1, WIDTH, 5, "#537d5d");
  pixel(ctx, 0, GROUND + 4, WIDTH, HEIGHT - GROUND - 4, "#315c4c");
  pixel(ctx, 0, GROUND + 4, WIDTH, 3, "#739064");
  const roadOffset = Math.floor(game.world) % 40;
  for (let x = -40 + roadOffset; x < WIDTH; x += 40) {
    pixel(ctx, x, GROUND + 17, 18, 3, "#6b8760");
  }
  pixel(ctx, 0, HEIGHT - 7, WIDTH, 7, "#264d41");

  for (const pickup of game.pickups) drawChip(ctx, pickup, game.elapsed);
  for (const obstacle of game.obstacles) drawCactus(ctx, obstacle.x, obstacle.variant);

  const playerY = GROUND - PLAYER_HEIGHT - game.lift;
  drawRobot(ctx, playerY, game.frame, game.lift > 0);

  if (phase !== "playing") {
    pixel(ctx, 0, 0, WIDTH, HEIGHT, "rgba(10, 28, 26, 0.52)");
  }
}

export function PixelRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(freshGame());
  const phaseRef = useRef<Phase>("ready");
  const bestRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(ROUND_LENGTH);
  const [best, setBest] = useState(0);
  const [announcement, setAnnouncement] = useState("准备就绪");

  useEffect(() => {
    try {
      const savedBest = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
      if (Number.isFinite(savedBest) && savedBest > 0) {
        bestRef.current = savedBest;
        setBest(savedBest);
      }
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }, []);

  const jump = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const game = gameRef.current;
    if (game.lift > 0) return;
    game.velocity = 575;
  }, []);

  const start = useCallback(() => {
    gameRef.current = freshGame();
    phaseRef.current = "playing";
    setScore(0);
    setRemaining(ROUND_LENGTH);
    setAnnouncement("游戏开始");
    setPhase("playing");
  }, []);

  const triggerAction = useCallback(() => {
    if (phaseRef.current === "playing") jump();
    else start();
  }, [jump, start]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    let rafId = 0;
    let lastTime = 0;
    let lastTimerUpdate = 0;
    let lastAnnouncedSecond = ROUND_LENGTH;

    const finish = (reason: "撞到障碍" | "时间到") => {
      phaseRef.current = "over";
      setPhase("over");
      setAnnouncement(`${reason}，本轮收集 ${gameRef.current.score} 个数据碎片`);
    };

    const update = (dt: number, now: number) => {
      const game = gameRef.current;
      game.frame += 1;
      game.elapsed += dt;
      game.world += (170 + Math.min(85, game.elapsed * 2.8)) * dt;

      game.velocity -= 1700 * dt;
      game.lift += game.velocity * dt;
      if (game.lift < 0) {
        game.lift = 0;
        game.velocity = 0;
      }

      const speed = 170 + Math.min(85, game.elapsed * 2.8);
      game.obstacleDelay -= dt;
      if (game.obstacleDelay <= 0) {
        game.obstacles.push({ x: WIDTH + 12, variant: Math.random() > 0.65 ? 1 : 0 });
        game.obstacleDelay = 1.05 + Math.random() * 0.55;
      }

      game.pickupDelay -= dt;
      if (game.pickupDelay <= 0) {
        game.pickups.push({
          x: WIDTH + 12,
          y: GROUND - 38 - Math.floor(Math.random() * 43),
          spin: Math.random() * Math.PI,
        });
        game.pickupDelay = 0.95 + Math.random() * 0.45;
      }

      for (const obstacle of game.obstacles) obstacle.x -= speed * dt;
      for (const pickup of game.pickups) pickup.x -= speed * dt;
      game.obstacles = game.obstacles.filter((obstacle) => obstacle.x > -32);
      game.pickups = game.pickups.filter((pickup) => pickup.x > -20);

      const playerY = GROUND - PLAYER_HEIGHT - game.lift;
      const player = { left: PLAYER_X + 3, right: PLAYER_X + PLAYER_WIDTH - 2, top: playerY + 5, bottom: playerY + PLAYER_HEIGHT };
      const hit = game.obstacles.some((obstacle) => {
        const height = obstacle.variant === 0 ? 26 : 34;
        const left = obstacle.x;
        const right = obstacle.x + 21;
        const top = GROUND - height;
        return player.right > left + 2 && player.left < right - 2 && player.bottom > top + 3;
      });
      if (hit) {
        finish("撞到障碍");
        return;
      }

      const collected = game.pickups.filter((pickup) => {
        const bob = Math.round(Math.sin(game.elapsed * 7 + pickup.spin) * 2);
        return player.right > pickup.x + 2 && player.left < pickup.x + 12 && player.bottom > pickup.y + bob && player.top < pickup.y + bob + 12;
      });
      if (collected.length > 0) {
        game.score += collected.length;
        game.pickups = game.pickups.filter((pickup) => !collected.includes(pickup));
        setScore(game.score);
        setAnnouncement(`收集到数据碎片，当前 ${game.score} 个`);
        if (game.score > bestRef.current) {
          bestRef.current = game.score;
          setBest(game.score);
          try {
            window.localStorage.setItem(BEST_SCORE_KEY, String(game.score));
          } catch {
            // A private browsing session may disallow storage writes.
          }
        }
      }

      const secondsLeft = Math.max(0, Math.ceil(ROUND_LENGTH - game.elapsed));
      if (secondsLeft !== lastAnnouncedSecond && now - lastTimerUpdate > 350) {
        lastAnnouncedSecond = secondsLeft;
        lastTimerUpdate = now;
        setRemaining(secondsLeft);
      }
      if (game.elapsed >= ROUND_LENGTH) finish("时间到");
    };

    const animate = (now: number) => {
      const dt = lastTime === 0 ? 0 : Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (phaseRef.current === "playing") update(dt, now);
      drawScene(ctx, gameRef.current, phaseRef.current);
      rafId = window.requestAnimationFrame(animate);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
      event.preventDefault();
      jump();
    };

    window.addEventListener("keydown", onKeyDown);
    rafId = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [jump]);

  const actionLabel = phase === "ready" ? "开始游戏" : phase === "over" ? "再玩一次" : "跳跃";
  const ActionIcon = phase === "ready" ? Play : phase === "over" ? RotateCcw : ArrowUp;

  return (
    <section className="pixel-game" aria-labelledby="pixel-game-title">
      <div className="pixel-game-heading">
        <div>
          <p className="pixel-game-label">MINI ARCADE</p>
          <h2 id="pixel-game-title">像素夜行</h2>
        </div>
        <dl className="pixel-game-stats" aria-label="游戏成绩">
          <div><dt>DATA</dt><dd>{score.toString().padStart(2, "0")}</dd></div>
          <div><dt>TIME</dt><dd>{remaining.toString().padStart(2, "0")}</dd></div>
          <div><dt>BEST</dt><dd>{best.toString().padStart(2, "0")}</dd></div>
        </dl>
      </div>
      <div className={`pixel-game-screen is-${phase}`}>
        <canvas
          ref={canvasRef}
          className="pixel-game-canvas"
          width={WIDTH}
          height={HEIGHT}
          aria-label="像素夜城跑酷场景"
          onPointerDown={() => { if (phaseRef.current === "playing") jump(); }}
        />
        {phase !== "playing" && (
          <div className="pixel-game-curtain">
            <small className="pixel-game-eyebrow">{phase === "ready" ? "30 SEC RUN" : "RUN COMPLETE"}</small>
            <strong>{phase === "ready" ? "夜城开始运转" : `收集到 ${score.toString().padStart(2, "0")} 个碎片`}</strong>
            <p>{phase === "ready" ? "收集数据碎片，避开仙人掌" : "夜色还长，再跑一趟"}</p>
          </div>
        )}
      </div>
      <div className="pixel-game-controls">
        <p><kbd>SPACE</kbd><span>跳跃</span></p>
        <button className="pixel-game-button" type="button" onClick={triggerAction} aria-label={actionLabel}>
          <ActionIcon aria-hidden="true" size={17} />
          <span>{actionLabel}</span>
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </section>
  );
}
