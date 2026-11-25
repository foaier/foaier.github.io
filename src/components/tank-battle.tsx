"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Crosshair, Flag, Heart, LockKeyhole, Map as MapIcon, Maximize2, Minimize2, Pause, Play, Shield, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createGame, EMPTY_PROGRESS, POWER_NAMES, readProgress, recordWin, stepGame, type Direction, type Game, type Progress, type Sound } from "@/lib/tank-game/engine";
import { CHAPTERS, HEIGHT, LEVELS, WIDTH } from "@/lib/tank-game/levels";
import { drawGame } from "@/lib/tank-game/renderer";
import "./tank-battle.css";

const SAVE_KEY = "foaier-tank-battle-v1";
const KEYS: Record<string, Direction> = { ArrowUp: "up", KeyW: "up", ArrowRight: "right", KeyD: "right", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left" };
const pad = (n: number) => n.toString().padStart(2, "0");
function snapshot(game: Game) {
  return { phase: game.phase, level: game.level.id, score: game.score, kills: game.kills, lives: game.lives, hp: game.player.hp, baseHp: game.baseHp, time: Math.floor(game.time), spawned: game.spawned, shield: Math.ceil(game.player.shield), fire: Math.ceil(game.firePower), freeze: Math.ceil(game.freeze), notice: game.noticeTime > 0 ? game.notice : "" };
}

function TankMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M3 9h6v20H3zm20 0h6v20h-6zM10 8h12v20H10zm4-7h4v15h-4z" /><path d="M12 17h8v6h-8z" fill="#374333" /><path d="M4 12h4v2H4zm0 5h4v2H4zm0 5h4v2H4zm20-10h4v2h-4zm0 5h4v2h-4zm0 5h4v2h-4z" fill="#64705a" /></svg>;
}

export function TankBattle() {
  const game = useRef<Game>(createGame());
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const keyboard = useRef(new Map<string, Direction>());
  const pointers = useRef(new Map<number, Direction | "fire">());
  const firing = useRef(new Set<string>());
  const progressRef = useRef<Progress>(EMPTY_PROGRESS);
  const audio = useRef<AudioContext | null>(null);
  const visible = useRef(true);
  const previousPhase = useRef(game.current.phase);
  const [hud, setHud] = useState(() => snapshot(game.current));
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [mapOpen, setMapOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState("选择关卡，准备保卫基地。");
  const [storageWarning, setStorageWarning] = useState(false);
  const [canvasError, setCanvasError] = useState(false);
  const mapRef = useRef<HTMLDialogElement>(null);
  const mapButton = useRef<HTMLButtonElement>(null);

  const clearInput = useCallback(() => { keyboard.current.clear(); pointers.current.clear(); firing.current.clear(); }, []);
  const save = useCallback((next: Progress) => {
    progressRef.current = next; setProgress(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  }, []);
  const sync = useCallback(() => setHud(snapshot(game.current)), []);

  const playSound = useCallback((sound: Sound) => {
    const ctx = audio.current;
    if (ctx?.state !== "running" || progressRef.current.muted) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const tones: Record<Sound, [number, number, number]> = { shot: [260, 80, 0.07], hit: [120, 55, 0.12], explosion: [85, 25, 0.2], pickup: [540, 960, 0.15], win: [440, 880, 0.4], lose: [240, 65, 0.45] };
    const [start, end, duration] = tones[sound];
    oscillator.type = sound === "explosion" ? "sawtooth" : "square";
    oscillator.frequency.setValueAtTime(start, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + duration);
    gain.gain.setValueAtTime(sound === "shot" ? 0.018 : 0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, []);

  const unlockAudio = useCallback(() => {
    if (progressRef.current.muted) return;
    try { audio.current ??= new AudioContext(); void audio.current.resume().catch(() => {}); }
    catch { /* Audio is optional; gameplay never depends on it. */ }
  }, []);

  const start = useCallback((levelId = game.current.level.id) => {
    clearInput();
    game.current = createGame(levelId); game.current.phase = "playing";
    previousPhase.current = "playing";
    sync(); unlockAudio();
    setAnnouncement(`第 ${levelId} 关 ${game.current.level.name}，击退 ${game.current.level.enemies} 辆敌军并保卫基地。`);
    field.current?.focus({ preventScroll: true });
  }, [clearInput, sync, unlockAudio]);

  const pause = useCallback(() => {
    if (game.current.phase !== "playing") return;
    game.current.phase = "paused"; clearInput(); sync(); setAnnouncement("游戏已暂停");
  }, [clearInput, sync]);

  const resume = useCallback(() => {
    game.current.phase = "playing"; clearInput(); sync(); unlockAudio();
    field.current?.focus({ preventScroll: true }); setAnnouncement("继续战斗");
  }, [clearInput, sync, unlockAudio]);

  useEffect(() => {
    let restored = { ...EMPTY_PROGRESS, cleared: [] } as Progress;
    try { restored = readProgress(localStorage.getItem(SAVE_KEY)); } catch { setStorageWarning(true); }
    progressRef.current = restored; setProgress(restored);
    game.current = createGame(restored.unlocked); sync();
    return () => { void audio.current?.close().catch(() => {}); audio.current = null; };
  }, [sync]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) { setCanvasError(true); return; }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, accumulated = 0, nextHud = 0;
    let lastDrawn: Game | null = null;
    let drawnPhase = "";
    const render = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (visible.current && !document.hidden) {
        if (game.current.phase === "playing") {
          accumulated += delta;
          const touchDirections = [...pointers.current.values()].filter((value): value is Direction => value !== "fire");
          const directions = [...keyboard.current.values(), ...touchDirections];
          const input = { direction: directions.at(-1) ?? null, fire: firing.current.size > 0 || [...pointers.current.values()].includes("fire") };
          while (accumulated >= 1 / 60) { stepGame(game.current, input, 1 / 60); accumulated -= 1 / 60; }
        } else accumulated = 0;
        if (game.current.phase === "playing" || lastDrawn !== game.current || drawnPhase !== game.current.phase) {
          drawGame(ctx, game.current, media.matches); lastDrawn = game.current; drawnPhase = game.current.phase;
        }
        for (const sound of game.current.sounds.splice(0)) playSound(sound);
        if (game.current.phase !== previousPhase.current) {
          previousPhase.current = game.current.phase;
          if (game.current.phase === "won" || game.current.phase === "complete") {
            save(recordWin(progressRef.current, game.current)); clearInput();
            setAnnouncement(game.current.phase === "complete" ? "恭喜，50 关全部通关！" : `第 ${game.current.level.id} 关完成，获得 ${game.current.score} 分，下一关已解锁。`);
          } else if (game.current.phase === "lost") { clearInput(); setAnnouncement(`${game.current.reason}，可以重试本关。`); }
          sync();
        }
        if (game.current.phase === "playing" && now >= nextHud) { sync(); nextHud = now + 100; }
      } else accumulated = 0;
      frame = requestAnimationFrame(render);
    };
    const hide = () => { if (document.hidden) pause(); };
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; if (!entry.isIntersecting) pause(); }, { threshold: 0.1 });
    if (field.current) observer.observe(field.current);
    document.addEventListener("visibilitychange", hide); window.addEventListener("blur", pause);
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", hide); window.removeEventListener("blur", pause); };
  }, [clearInput, pause, playSound, save, sync]);

  useEffect(() => {
    if (mapOpen) mapRef.current?.showModal();
    else if (mapRef.current?.open) mapRef.current.close();
  }, [mapOpen]);

  useEffect(() => {
    if (!expanded) return;
    const panel = root.current;
    if (!panel) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    const siblings: [HTMLElement, boolean][] = [];
    // Keep the blog behind the expanded cabinet out of keyboard navigation.
    for (let node: HTMLElement | null = panel; node?.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== node) {
          siblings.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      if (node.parentElement === document.body) break;
    }
    document.body.style.overflow = "hidden";
    field.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || mapRef.current?.open) return;
      if (event.key === "Escape") { event.preventDefault(); pause(); setExpanded(false); }
      if (event.key !== "Tab") return;
      const controls = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0'], summary")].filter((item) => item.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      for (const [sibling, wasInert] of siblings) sibling.inert = wasInert;
      document.removeEventListener("keydown", handleKey);
      returnFocus?.focus({ preventScroll: true });
    };
  }, [expanded, pause]);

  const closeMap = () => { setMapOpen(false); mapButton.current?.focus(); };
  const touch = (event: PointerEvent<HTMLButtonElement>, action: Direction | "fire") => {
    if (game.current.phase !== "playing") return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, action); field.current?.focus({ preventScroll: true });
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => { pointers.current.delete(event.pointerId); };
  const level = LEVELS[hud.level - 1], chapter = CHAPTERS[level.chapter];
  const enemySlots = level.roster.map((kind, slot) => ({ kind, slot, id: `${level.id}-${slot}` }));
  const settled = hud.phase === "won" || hud.phase === "complete";
  const overlayTitle = hud.phase === "ready" ? "守住你的阵地" : hud.phase === "paused" ? "休整一下，再出发" : hud.phase === "lost" ? hud.baseHp <= 0 ? "基地失守" : "再来一次，指挥官" : hud.phase === "complete" ? "五十关，全部拿下！" : "阵地守住了！";
  const action = () => {
    if (hud.phase === "paused") resume();
    else if (hud.phase === "won") start(Math.min(50, hud.level + 1));
    else start();
  };
  const actionText = hud.phase === "ready" ? "出发，保卫基地" : hud.phase === "paused" ? "继续战斗" : hud.phase === "won" ? `进入第 ${pad(hud.level + 1)} 关` : hud.phase === "complete" ? "再战最终关" : "重试本关";

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal is only present with role=dialog in expanded mode.
    <section ref={root} className={`tank-arcade${expanded ? " is-expanded" : ""}`} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-labelledby="tank-title" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pause(); }}>
      <div className="tank-heading">
        <div><p className="tank-kicker"><span /> FOAIER ARCADE <span className="tank-heading-divider">/</span> VOL. 02</p><h2 id="tank-title">坦克大战<span>守卫最后的基地</span></h2></div>
        <div className="tank-heading-tools">
          <button type="button" aria-label={progress.muted ? "开启游戏音效" : "关闭游戏音效"} aria-pressed={!progress.muted} onClick={() => { save({ ...progressRef.current, muted: !progressRef.current.muted }); unlockAudio(); }}>{progress.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
          <button type="button" aria-label={expanded ? "退出大屏" : "大屏游玩"} aria-pressed={expanded} onClick={() => { pause(); setExpanded(!expanded); }}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        </div>
      </div>

      <div className="tank-cabinet">
        <div className="tank-mission-bar"><span><i /> {chapter.name}<b> / {pad(hud.level)}—50</b></span><span className="tank-live-status">{hud.phase === "playing" ? "● 战斗进行中" : hud.phase === "paused" ? "Ⅱ 已暂停" : settled ? "✓ 任务完成" : "● 等待出击"}</span></div>
        <div className="tank-console">
          <div className="tank-field-column">
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: This canvas application requires keyboard focus for scoped game controls. */}
            <div ref={field} className="tank-field" role="application" tabIndex={0} aria-label="坦克大战战场" aria-describedby="tank-instructions"
              onPointerDown={() => field.current?.focus({ preventScroll: true })}
              onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) pause(); else clearInput(); }}
              onKeyDown={(event) => {
                if (event.target !== field.current) return;
                if (event.code === "Escape") { event.preventDefault(); pause(); if (expanded) setExpanded(false); return; }
                if (event.code === "KeyP") { event.preventDefault(); if (!event.repeat) hud.phase === "playing" ? pause() : hud.phase === "paused" ? resume() : undefined; return; }
                if (game.current.phase !== "playing") return;
                if (KEYS[event.code]) { event.preventDefault(); if (!event.repeat) keyboard.current.set(event.code, KEYS[event.code]); }
                if (["Space", "KeyJ"].includes(event.code)) { event.preventDefault(); firing.current.add(event.code); }
              }}
              onKeyUp={(event) => { keyboard.current.delete(event.code); firing.current.delete(event.code); }}>
              <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={`${level.name}，黄色坦克保卫底部基地，敌军从顶部三个入口进攻`} />
              {hud.phase === "playing" && <><span className="tank-stage-tag">{pad(hud.level)} <span>{level.name}</span></span>{hud.notice && <div className="tank-battle-notice">{hud.notice}</div>}</>}
              {(hud.phase !== "playing" || canvasError) && <div className={`tank-overlay${hud.phase === "ready" ? " is-intro" : ""}`}>
                <div className="tank-overlay-emblem"><TankMark /><span>{settled ? "MISSION CLEAR" : hud.phase === "lost" ? "TRY AGAIN" : hud.phase === "paused" ? "TAKE A BREAK" : "BATTLE CITY"}</span></div>
                <h3>{canvasError ? "当前浏览器无法显示战场" : overlayTitle}</h3>
                <p>{hud.phase === "ready" ? "一辆坦克，一座基地。穿过硝烟，打到第 50 关。" : hud.phase === "paused" ? "战场已暂停，准备好再继续。" : hud.phase === "lost" ? "这一关的地图不变，换条路线再试试。" : `击毁 ${hud.kills} 辆敌军 · 本关获得 ${hud.score.toLocaleString()} 分`}</p>
                {hud.phase === "ready" && <div className="tank-intro-tags"><span><Flag size={12} /> 50 关战役</span><span><Shield size={12} /> 基地防守</span><span><Zap size={12} /> 补给升级</span></div>}
                {!canvasError && <button className="tank-primary" type="button" onClick={action}><Play size={15} fill="currentColor" />{actionText}<ArrowRight size={15} /></button>}
                <small>{hud.phase === "ready" ? `第 ${pad(hud.level)} 关 · ${level.name}` : settled ? "通关进度已记录，可以随时回来继续" : "WASD / 方向键移动 · 空格 / J 开火"}</small>
              </div>}
            </div>
            <div className="tank-terrain-key"><span><i className="is-brick" />砖墙可破坏</span><span><i className="is-steel" />钢墙挡炮弹</span><span><i className="is-water" />水域不可通行</span><span><i className="is-forest" />树林可隐蔽</span>{level.chapter === 2 && <span><i className="is-ice" />冰面加速</span>}</div>
          </div>

          <aside className="tank-dashboard" aria-label="战场状态">
            <div className="tank-level-number"><span>STAGE / 关卡</span><strong>{pad(hud.level)}<small>/ 50</small></strong><h3>{level.name}</h3><div className="tank-difficulty" role="img" aria-label={`难度 ${level.chapter + 1} 星`}>{CHAPTERS.map((item, index) => <i key={item.name} className={index <= level.chapter ? "is-on" : ""} />)}<span>{level.boss ? "指挥车关卡" : ["新兵试炼", "机动突袭", "装甲交锋", "火力压制", "最终防线"][level.chapter]}</span></div></div>
            <div className="tank-health-panel"><div><span><Heart size={12} /> 我方坦克</span><strong>{hud.lives} <small>辆</small></strong></div><div className="tank-meter" role="img" aria-label={`装甲 ${hud.hp}/3`}>{[1, 2, 3].map((n) => <i key={n} className={hud.hp >= n ? "is-on" : ""} />)}<span>装甲 {Math.max(0, hud.hp)}/3</span></div><div><span><Shield size={12} /> 基地耐久</span><strong className={hud.baseHp === 1 ? "is-danger" : ""}>{hud.baseHp}<small> / 3</small></strong></div><div className="tank-base-meter"><span style={{ width: `${hud.baseHp / 3 * 100}%` }} /></div></div>
            <div className="tank-enemies"><div><span>敌军剩余</span><b>{pad(level.enemies - hud.kills)}<small> / {pad(level.enemies)}</small></b></div><div className="tank-enemy-icons" aria-hidden="true">{enemySlots.map(({ kind, slot, id }) => <TankMark key={id} className={slot < hud.kills ? "is-defeated" : kind === "commander" ? "is-commander" : ""} />)}</div></div>
            <div className="tank-score"><span>本关得分</span><strong>{hud.score.toString().padStart(5, "0")}</strong><div><span>最高单关 {progress.best.toLocaleString()}</span><span>{pad(Math.floor(hud.time / 60))}:{pad(hud.time % 60)}</span></div></div>
            <div className="tank-effects"><span>战场补给</span><div><span className={hud.shield > 0 ? "is-active" : ""} title="护盾：短时间免伤"><Shield size={14} />{hud.shield > 0 ? `${hud.shield}s` : "护盾"}</span><span className={hud.fire > 0 ? "is-active" : ""} title="火力：连射加速，击穿钢墙"><Zap size={14} />{hud.fire > 0 ? `${hud.fire}s` : "火力"}</span><span className={hud.freeze > 0 ? "is-active" : ""} title="冻结：敌军暂时停止行动"><Pause size={14} />{hud.freeze > 0 ? `${hud.freeze}s` : "冻结"}</span></div></div>
          </aside>
        </div>

        <div className="tank-command-bar"><p id="tank-instructions"><kbd>W A S D</kbd><span>/ 方向键移动</span><kbd>SPACE</kbd><span>/ J 开火</span><kbd>P</kbd><span>暂停</span></p><div><button ref={mapButton} type="button" onClick={() => { pause(); setMapOpen(true); }}><MapIcon size={14} />选关<span>{progress.cleared.length}/50</span></button><button type="button" disabled={hud.phase !== "playing" && hud.phase !== "paused"} onClick={() => hud.phase === "playing" ? pause() : resume()} aria-label={hud.phase === "paused" ? "继续游戏" : "暂停游戏"}>{hud.phase === "paused" ? <Play size={15} /> : <Pause size={15} />}</button></div></div>
        <fieldset className="tank-touch-controls" aria-label="触屏游戏控制"><div className="tank-dpad">{([{ direction: "up", Icon: ArrowUp }, { direction: "left", Icon: ArrowLeft }, { direction: "down", Icon: ArrowDown }, { direction: "right", Icon: ArrowRight }] as const).map(({ direction, Icon }) => <button type="button" key={direction} className={`tank-direction is-${direction}`} aria-label={{ up: "向上移动", left: "向左移动", down: "向下移动", right: "向右移动" }[direction]} onPointerDown={(event) => touch(event, direction)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><Icon size={21} /></button>)}<span /></div><p>按住移动<br />按住连续射击</p><button className="tank-fire-button" type="button" aria-label="开火" onPointerDown={(event) => touch(event, "fire")} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><Crosshair size={25} /><span>开火</span></button></fieldset>
      </div>
      <div className="tank-footnote"><p><span>战地提示</span>{level.tip}</p><small>{storageWarning ? "浏览器未允许保存，本次进度仅在当前页面保留" : "通关自动存档 · 随时回来继续"}</small></div>

      <dialog ref={mapRef} className="tank-map-dialog" onCancel={(event) => { event.preventDefault(); closeMap(); }} onClose={() => setMapOpen(false)} aria-labelledby="tank-map-title">
        <header><div><span>CAMPAIGN SELECT</span><h3 id="tank-map-title">五大战区 · 五十次出击</h3><p>已完成 {progress.cleared.length} / 50 关。通关解锁下一关，已解锁关卡可反复挑战。</p></div><button type="button" aria-label="关闭关卡选择" onClick={closeMap}><X size={20} /></button></header>
        {CHAPTERS.map((zone, index) => <div className="tank-map-zone" key={zone.name}><h4><span>0{index + 1}</span>{zone.name}<small>{zone.subtitle}</small></h4><div className="tank-level-grid">{LEVELS.slice(index * 10, index * 10 + 10).map((item) => <button type="button" key={item.id} disabled={item.id > progress.unlocked} className={`${item.id === hud.level ? "is-selected " : ""}${progress.cleared.includes(item.id) ? "is-cleared" : ""}`} aria-label={`第 ${item.id} 关 ${item.name}${progress.cleared.includes(item.id) ? "，已通关" : item.id > progress.unlocked ? "，未解锁" : ""}`} onClick={() => { clearInput(); game.current = createGame(item.id); previousPhase.current = "ready"; sync(); closeMap(); setAnnouncement(`已选择第 ${item.id} 关 ${item.name}`); }}><span>{pad(item.id)}</span>{item.id > progress.unlocked ? <LockKeyhole size={10} /> : progress.cleared.includes(item.id) ? <Check size={11} /> : item.boss ? <Flag size={11} /> : null}</button>)}</div></div>)}
        <footer><Shield size={14} />每关补满坦克和基地耐久，失败可以直接重试。</footer>
      </dialog>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
      <details className="tank-rules"><summary>作战手册 · 操作与补给说明</summary><p>点击“出发”后，使用方向键或 WASD 移动，空格或 J 连续开火；P 暂停，Esc 暂停并退出大屏。键盘只在战场获得焦点时控制游戏，离开页面或滚出战场会自动暂停。手机使用下方方向键和开火键，可以同时按住。</p><p>击毁全部敌军并守住基地即可过关。每关有 3 辆坦克，每辆 3 点装甲；基地有 3 点耐久，我方炮弹不会伤到基地。红色敌军从顶部出现，十关一次重装指挥车。水域不可通过，树林只遮挡视线，冰面会提高移动速度。</p><div>{Object.entries(POWER_NAMES).map(([kind, name]) => <span key={kind}><b>{name}</b>{({ repair: "修满装甲，基地恢复 1 点", shield: "9 秒免伤", fire: "14 秒连射强化，可碎钢墙", freeze: "敌军冻结 7 秒" })[kind as keyof typeof POWER_NAMES]}</span>)}</div><p>每击毁 4 辆敌军掉落一次补给，18 秒内驶过拾取。进度保存在当前浏览器，清除网站数据会清除存档。音效默认关闭，可在右上角开启。</p></details>
    </section>
  );
}
