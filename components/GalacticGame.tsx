"use client";

import { useEffect, useRef, useState } from 'react';

// Constants
const C_BG = "#050a05";
const C_GRID = "#0f2f0f";
const C_SIGNAL = "#33ff00";
const C_MASTERY = "#00ffff";
const C_NOISE = "#ffcc00";
const C_DIM = "#1a4a1a";
const C_ALERT = "#ff3300";

const MODE_BOOT = 0;
const MODE_HUB = 1;
const MODE_GAME_LEVER = 2;

interface Node {
  id: number;
  x: number;
  y: number;
  r: number;
  label: string;
  complete: boolean;
  blink: number;
}

interface Block {
  x: number;
  y: number;
  slot: number | null;
  w: number;
  c: string;
  fixed: boolean;
}

interface LeverLevel {
  id: number;
  targets: any[];
  inventory: { w: number }[];
}

const LEVER_LEVELS: LeverLevel[] = [
  { id: 1, targets: [], inventory: [{w:1}, {w:1}] },
  { id: 2, targets: [], inventory: [{w:1}, {w:2}] },
  { id: 3, targets: [], inventory: [{w:2}, {w:2}, {w:1}, {w:1}] },
  { id: 4, targets: [], inventory: [{w:2}, {w:2}, {w:1}, {w:1}, {w:1}, {w:1}] }
];

export default function GalacticGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [levelIndicator, setLevelIndicator] = useState("");

  const appStateRef = useRef({
    mode: MODE_BOOT,
    frame: 0,
    bootTimer: 0,
    mouse: {x: 0, y: 0, down: false},
    nodes: [
      { id: 1, x: 140, y: 225, r: 25, label: "STRUCTURE", complete: false, blink: 0 },
      { id: 2, x: 220, y: 225, r: 25, label: "SPACE", complete: false, blink: 0 },
      { id: 3, x: 300, y: 225, r: 25, label: "QUANTITY", complete: false, blink: 0 },
      { id: 4, x: 380, y: 225, r: 25, label: "CHANGE", complete: false, blink: 0 },
      { id: 5, x: 460, y: 225, r: 25, label: "UNCERTAINTY", complete: false, blink: 0 }
    ] as Node[],
    lever: {
      levelIdx: 0,
      blocks: [] as Block[],
      drag: null as Block | null,
      bal: false,
      ang: 0,
      tgtAng: 0,
      winT: 0
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const appState = appStateRef.current;

    // Input handling
    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (cx-r.left)*(canvas.width/r.width),
        y: (cy-r.top)*(canvas.height/r.height)
      };
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      if ('preventDefault' in e) e.preventDefault();
      appState.mouse = {...getPos(e), down: true};
      handleInputDown();
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if ('preventDefault' in e && 'touches' in e) e.preventDefault();
      appState.mouse = {...appState.mouse, ...getPos(e)};
    };

    const handleMouseUp = () => {
      appState.mouse.down = false;
      handleInputUp();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);

    // Game logic functions
    function handleInputDown() {
      if (appState.mode === MODE_HUB) handleHubClick();
      else if (appState.mode === MODE_GAME_LEVER) handleLeverDown();
    }

    function handleInputUp() {
      if (appState.mode === MODE_GAME_LEVER) handleLeverUp();
    }

    function handleHubClick() {
      const m = appState.mouse;
      appState.nodes.forEach((n, i) => {
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < n.r + 10) {
          if (n.complete) {
            n.blink = 20;
          } else if (i === 0) {
            startLeverGame();
          } else {
            n.blink = 20;
          }
        }
      });
    }

    function startLeverGame() {
      appState.mode = MODE_GAME_LEVER;
      appState.lever.levelIdx = 0;
      appState.lever.winT = 0;
      loadLeverLevel(0);
    }

    function loadLeverLevel(idx: number) {
      if (idx >= LEVER_LEVELS.length) {
        appState.nodes[0].complete = true;
        appState.mode = MODE_HUB;
        setLevelIndicator("");
        return;
      }
      appState.lever.levelIdx = idx;
      appState.lever.blocks = [];
      appState.lever.bal = false;
      appState.lever.ang = 0;
      appState.lever.tgtAng = 0;
      appState.lever.winT = 0;

      const lvl = LEVER_LEVELS[idx];
      let dots = "";
      for(let i=0; i<=idx; i++) dots += "•";
      for(let i=idx+1; i<LEVER_LEVELS.length; i++) dots += "◦";
      setLevelIndicator(dots);

      lvl.inventory.forEach((item, i) => {
        appState.lever.blocks.push({
          x: 100 + (i%6 * 80),
          y: 380 + (Math.floor(i/6)*50),
          slot: null,
          w: item.w,
          c: C_SIGNAL,
          fixed: false
        });
      });
      checkLeverBalance();
    }

    function handleLeverDown() {
      const m = appState.mouse;
      for (let i = appState.lever.blocks.length - 1; i >= 0; i--) {
        const b = appState.lever.blocks[i];
        if (b.fixed || b.slot !== null) continue;
        if (Math.abs(m.x - b.x) < 20 && Math.abs(m.y - b.y) < (b.w*40)/2) {
          appState.lever.drag = b;
          checkLeverBalance();
          return;
        }
      }

      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;
      const dx = m.x - FULCRUM_X, dy = m.y - FULCRUM_Y;
      const rad = -appState.lever.ang * Math.PI/180;
      const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
      const ly = dx*Math.sin(rad) + dy*Math.cos(rad);
      if (ly > 10) return;
      const slot = Math.round(lx/CELL);
      if (Math.abs(slot) <= 5 && slot !== 0 && Math.abs(lx - slot*CELL) < 20) {
        const inSlot = appState.lever.blocks.filter(b => b.slot === slot);
        if (inSlot.length > 0) {
          const top = inSlot[inSlot.length-1];
          if (!top.fixed) {
            appState.lever.drag = top;
            top.slot = null;
            checkLeverBalance();
          }
        }
      }
    }

    function handleLeverUp() {
      if (!appState.lever.drag) return;
      const b = appState.lever.drag;
      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;

      if (appState.mouse.y < 350) {
        let bestS = 0, minD = Infinity;
        for (let s = -5; s <= 5; s++) {
          if (s === 0) continue;
          const rad = appState.lever.ang * Math.PI/180;
          const px = FULCRUM_X + Math.cos(rad)*s*CELL;
          const py = FULCRUM_Y + Math.sin(rad)*s*CELL - 25;
          const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
          if (d < minD) { minD = d; bestS = s; }
        }
        appState.lever.blocks = appState.lever.blocks.filter(i => i !== b);
        appState.lever.blocks.push(b);
        b.slot = bestS;
      } else {
        b.slot = null;
        b.y = 380;
        b.x = Math.max(50, Math.min(550, appState.mouse.x));
      }
      appState.lever.drag = null;
      checkLeverBalance();
    }

    function checkLeverBalance() {
      let L = 0, R = 0, hand = false;
      appState.lever.blocks.forEach(b => {
        if (b.slot === null) {
          if (!b.fixed) hand = true;
          return;
        }
        const t = Math.abs(b.slot) * b.w;
        b.slot < 0 ? L += t : R += t;
      });

      if (hand) {
        appState.lever.bal = false;
        appState.lever.tgtAng = L > R ? -20 : (R > L ? 20 : 0);
      } else {
        if (L === R) {
          appState.lever.bal = true;
          appState.lever.tgtAng = 0;
        } else {
          appState.lever.bal = false;
          appState.lever.tgtAng = L > R ? -20 : 20;
        }
      }
    }

    // Drawing functions
    function drawGrid() {
      ctx.strokeStyle = C_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 600; i += 40) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 450);
      }
      for (let i = 0; i < 450; i += 40) {
        ctx.moveTo(0, i);
        ctx.lineTo(600, i);
      }
      ctx.stroke();
    }

    function drawBootSequence() {
      appState.bootTimer++;

      appState.nodes.forEach((n, i) => {
        const activationTime = i * 30;
        let isActive = appState.bootTimer > activationTime;

        let brightness = 0;
        if (isActive) {
          let age = appState.bootTimer - activationTime;
          if (age < 10) brightness = 1;
          else brightness = 0.5;
        } else {
          brightness = 0.1;
        }

        ctx.strokeStyle = C_SIGNAL;
        ctx.globalAlpha = brightness;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });

      if (appState.bootTimer > 180) {
        appState.mode = MODE_HUB;
        setLevelIndicator("");
      }
    }

    function drawHub() {
      if (appState.nodes[0].complete) {
        ctx.fillStyle = C_SIGNAL;
        ctx.font = "20px monospace";
        ctx.textAlign = "center";
        ctx.fillText("END DEMO", 300, 100);
      }

      appState.nodes.forEach((n, i) => {
        let color = C_SIGNAL;
        if (n.blink > 0) {
          color = C_ALERT;
          n.blink--;
        } else if (n.complete) {
          color = C_SIGNAL;
        } else if (i > 0) {
          color = C_DIM;
        }

        let glow = 0;
        let fillAlpha = 0;
        if (n.complete) {
          fillAlpha = 0.3;
          glow = 20;
        }

        ctx.shadowBlur = glow;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
        ctx.stroke();

        if (fillAlpha > 0) {
          ctx.fillStyle = color;
          ctx.globalAlpha = fillAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });
      ctx.shadowBlur = 0;
    }

    function drawLeverGame() {
      if (appState.lever.drag) {
        appState.lever.drag.x = appState.mouse.x;
        appState.lever.drag.y = appState.mouse.y;
      }
      appState.lever.ang += (appState.lever.tgtAng - appState.lever.ang) * 0.1;

      if (appState.lever.bal && Math.abs(appState.lever.ang) < 1) {
        appState.lever.winT++;
        if (appState.lever.winT > 60) {
          loadLeverLevel(appState.lever.levelIdx + 1);
        }
      } else {
        appState.lever.winT = 0;
      }

      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;

      // Fulcrum
      ctx.fillStyle = C_DIM;
      ctx.beginPath();
      ctx.moveTo(FULCRUM_X, FULCRUM_Y);
      ctx.lineTo(FULCRUM_X - 15, FULCRUM_Y + 30);
      ctx.lineTo(FULCRUM_X + 15, FULCRUM_Y + 30);
      ctx.fill();

      // Lever
      ctx.save();
      ctx.translate(FULCRUM_X, FULCRUM_Y);
      ctx.rotate(appState.lever.ang * Math.PI/180);

      let color = C_SIGNAL;
      ctx.shadowBlur = (appState.lever.bal && appState.lever.winT > 10) ? 15 : 0;
      ctx.shadowColor = color;
      ctx.fillStyle = (appState.lever.bal && appState.lever.winT > 10) ? color : C_DIM;
      ctx.fillRect(-210, -5, 420, 10);
      ctx.shadowBlur = 0;

      // Slots
      ctx.fillStyle = C_BG;
      for (let s = -5; s <= 5; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      // Blocks on Lever
      let hMap: {[key: number]: number} = {};
      appState.lever.blocks.forEach(b => {
        if (b.slot !== null && b !== appState.lever.drag) {
          let s = b.slot;
          if (!hMap[s]) hMap[s] = 0;
          let h = b.w * CELL;
          drawBlock(ctx, s*CELL, -5 - hMap[s] - h/2, b.w, b.c);
          hMap[s] += h;
        }
      });
      ctx.restore();

      // Blocks off Lever
      appState.lever.blocks.forEach(b => {
        if (b.slot === null || b === appState.lever.drag) {
          drawBlock(ctx, b.x, b.y, b.w, b.c);
        }
      });

      // Win Bar
      if (appState.lever.winT > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 445, 600*(appState.lever.winT/60), 5);
      }
    }

    function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: string) {
      let h = w*40 - 8, wid = 32;
      ctx.shadowBlur = 15;
      ctx.shadowColor = c;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.strokeRect(x-wid/2, y-h/2, wid, h);
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x-wid/2, y-h/2, wid, h);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = c;
      if (w > 1) {
        for (let i = 1; i < w; i++) {
          ctx.fillRect(x-wid/2+4, y-h/2+i*40-1, wid-8, 2);
        }
      }
      ctx.fillRect(x-2, y-2, 4, 4);
      ctx.shadowBlur = 0;
    }

    // Main draw loop
    function draw() {
      appState.frame++;
      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, 600, 450);
      drawGrid();

      if (appState.mode === MODE_BOOT) {
        drawBootSequence();
      } else if (appState.mode === MODE_HUB) {
        drawHub();
      } else if (appState.mode === MODE_GAME_LEVER) {
        drawLeverGame();
      }

      requestAnimationFrame(draw);
    }

    const animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div
        className="text-center mb-5 text-2xl tracking-[5px] font-bold opacity-90 h-[30px]"
        style={{ textShadow: '0 0 10px var(--phosphor-primary)' }}
      >
        {levelIndicator}
      </div>

      <div className="relative p-5 bg-black">
        <div id="game-container">
          <canvas
            ref={canvasRef}
            width="600"
            height="450"
          />
          <div id="crt-overlay" />
        </div>
      </div>
    </div>
  );
}
