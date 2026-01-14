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
const MODE_GAME_BLOB = 3;
const MODE_GAME_SPACE = 4;
const MODE_GAME_CHANGE = 5;
const MODE_GAME_UNCERTAIN = 6;

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

interface Blob {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  radius: number;
  isDragging: boolean;
  isPrime: boolean;
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
      { id: 2, x: 220, y: 225, r: 25, label: "QUANTITY", complete: false, blink: 0 },
      { id: 3, x: 300, y: 225, r: 25, label: "SPACE", complete: false, blink: 0 },
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
    },
    blob: {
      blobs: [] as Blob[],
      draggedBlob: null as Blob | null,
      dragStartX: 0,
      dragStartY: 0,
      nextId: 0
    },
    change: {
      waterLevel: 1.0,
      draining: false,
      selectedShape: 0, // 0=cylinder, 1=cone_up, 2=cone_down, 3=funnel
      history: [] as {time: number, level: number}[],
      time: 0
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
      // Check for back button in game modes
      if (appState.mode === MODE_GAME_LEVER || appState.mode === MODE_GAME_BLOB ||
          appState.mode === MODE_GAME_CHANGE) {
        const m = appState.mouse;
        if (m.x < 80 && m.y < 40) {
          returnToHub();
          return;
        }
      }

      if (appState.mode === MODE_HUB) handleHubClick();
      else if (appState.mode === MODE_GAME_LEVER) handleLeverDown();
      else if (appState.mode === MODE_GAME_BLOB) handleBlobDown();
      else if (appState.mode === MODE_GAME_CHANGE) handleChangeClick();
    }

    function returnToHub() {
      appState.mode = MODE_HUB;
      setLevelIndicator("");
    }

    function handleInputUp() {
      if (appState.mode === MODE_GAME_LEVER) handleLeverUp();
      else if (appState.mode === MODE_GAME_BLOB) handleBlobUp();
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
          } else if (i === 1) {
            startBlobGame();
          } else if (i === 3) {
            startChangeGame();
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

    // Blob Game Functions
    function startBlobGame() {
      appState.mode = MODE_GAME_BLOB;
      const randomValue = Math.floor(Math.random() * 20) + 1;
      appState.blob.blobs = [createBlob(300, 150, randomValue)];
      setLevelIndicator("CLICK TO SPLIT");
    }

    function createBlob(x: number, y: number, value: number): Blob {
      const isPrime = checkPrime(value);
      return {
        id: appState.blob.nextId++,
        x,
        y,
        vx: 0,
        vy: 0,
        value,
        radius: Math.max(20, 15 + value * 2.5),
        isDragging: false,
        isPrime
      };
    }

    function checkPrime(n: number): boolean {
      if (n < 2) return false;
      if (n === 2) return true;
      if (n % 2 === 0) return false;
      for (let i = 3; i <= Math.sqrt(n); i += 2) {
        if (n % i === 0) return false;
      }
      return true;
    }

    function handleBlobDown() {
      const m = appState.mouse;
      for (let i = appState.blob.blobs.length - 1; i >= 0; i--) {
        const blob = appState.blob.blobs[i];
        const dx = m.x - blob.x;
        const dy = m.y - blob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < blob.radius) {
          trySplit(blob);
          break;
        }
      }
    }

    function handleBlobUp() {
      // Not used anymore - splitting happens on click
    }

    function trySplit(blob: Blob) {
      if (blob.isPrime) {
        setLevelIndicator("⚠ PRIME - CANNOT SPLIT");
        blob.vx = (Math.random() - 0.5) * 10;
        blob.vy = (Math.random() - 0.5) * 10;
        return;
      }

      if (blob.value >= 2) {
        const half = Math.floor(blob.value / 2);
        const remainder = blob.value - half;

        appState.blob.blobs = appState.blob.blobs.filter(b => b.id !== blob.id);

        const blob1 = createBlob(blob.x - 30, blob.y, half);
        const blob2 = createBlob(blob.x + 30, blob.y, remainder);

        blob1.vx = -3;
        blob2.vx = 3;

        appState.blob.blobs.push(blob1, blob2);
        setLevelIndicator("SPLIT");

        // Check if all remaining blobs are prime
        const allPrime = appState.blob.blobs.every(b => b.isPrime);
        if (allPrime) {
          setTimeout(() => {
            const randomValue = Math.floor(Math.random() * 20) + 1;
            const newBlob = createBlob(300, 50, randomValue);
            newBlob.vy = 2;
            appState.blob.blobs.push(newBlob);
            setLevelIndicator("NEW COMPOSITE");
          }, 1000);
        }
      }
    }

    function updateBlobPhysics() {
      appState.blob.blobs.forEach(blob => {
        blob.x += blob.vx;
        blob.y += blob.vy;

        blob.vx *= 0.95;
        blob.vy *= 0.95;

        blob.vy += 0.2;

        if (blob.x - blob.radius < 0) {
          blob.x = blob.radius;
          blob.vx *= -0.5;
        }
        if (blob.x + blob.radius > 600) {
          blob.x = 600 - blob.radius;
          blob.vx *= -0.5;
        }
        if (blob.y - blob.radius < 0) {
          blob.y = blob.radius;
          blob.vy *= -0.5;
        }
        if (blob.y + blob.radius > 450) {
          blob.y = 450 - blob.radius;
          blob.vy *= -0.5;
        }
      });

      for (let i = 0; i < appState.blob.blobs.length; i++) {
        for (let j = i + 1; j < appState.blob.blobs.length; j++) {
          const b1 = appState.blob.blobs[i];
          const b2 = appState.blob.blobs[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist && dist > 0) {
            const force = (minDist - dist) * 0.5;
            const angle = Math.atan2(dy, dx);

            b1.vx -= Math.cos(angle) * force * 0.1;
            b1.vy -= Math.sin(angle) * force * 0.1;
            b2.vx += Math.cos(angle) * force * 0.1;
            b2.vy += Math.sin(angle) * force * 0.1;
          }
        }
      }
    }

    // Change Game Functions
    function startChangeGame() {
      appState.mode = MODE_GAME_CHANGE;
      appState.change.waterLevel = 1.0;
      appState.change.draining = false;
      appState.change.selectedShape = 0;
      appState.change.history = [];
      appState.change.time = 0;
      setLevelIndicator("CLICK SHAPES TO SELECT, CLICK START");
    }

    function handleChangeClick() {
      const m = appState.mouse;
      // Check if clicking on shape selectors (top row)
      const shapes = ['CYL', 'CONE↑', 'CONE↓', 'FUNNEL'];
      for (let i = 0; i < shapes.length; i++) {
        const sx = 80 + i * 120;
        const sy = 50;
        if (Math.abs(m.x - sx) < 50 && Math.abs(m.y - sy) < 20) {
          appState.change.selectedShape = i;
          appState.change.waterLevel = 1.0;
          appState.change.draining = false;
          appState.change.history = [];
          appState.change.time = 0;
          setLevelIndicator("CLICK START TO DRAIN");
          return;
        }
      }

      // Check if clicking start/reset button
      if (m.x > 230 && m.x < 370 && m.y > 390 && m.y < 430) {
        if (!appState.change.draining) {
          appState.change.draining = true;
          appState.change.waterLevel = 1.0;
          appState.change.history = [{time: 0, level: 1.0}];
          appState.change.time = 0;
          setLevelIndicator("DRAINING...");
        } else {
          appState.change.draining = false;
          setLevelIndicator("PAUSED");
        }
      }
    }

    function updateChangeGame() {
      if (!appState.change.draining || appState.change.waterLevel <= 0) {
        if (appState.change.waterLevel <= 0 && appState.change.draining) {
          appState.change.draining = false;
          setLevelIndicator("EMPTY");
        }
        return;
      }

      appState.change.time += 1;

      // Calculate drain rate based on shape
      let drainRate = 0;
      const h = appState.change.waterLevel; // height as fraction 0-1

      switch (appState.change.selectedShape) {
        case 0: // Cylinder - constant rate
          drainRate = 0.002;
          break;
        case 1: // Cone pointing up - slower as it drains (wider at top)
          drainRate = 0.002 * (1 - h) * (1 - h); // quadratic slowdown
          break;
        case 2: // Cone pointing down - faster as it drains (wider at bottom)
          drainRate = 0.002 * h * h; // quadratic speedup
          break;
        case 3: // Funnel - starts slow, then fast
          drainRate = h < 0.3 ? 0.004 : 0.001;
          break;
      }

      appState.change.waterLevel -= drainRate;
      if (appState.change.waterLevel < 0) appState.change.waterLevel = 0;

      // Record history for graph
      if (appState.change.time % 5 === 0) {
        appState.change.history.push({
          time: appState.change.time,
          level: appState.change.waterLevel
        });
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

        // Draw label below dot
        ctx.fillStyle = color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + n.r + 8);
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

      drawBackButton();
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

    function drawBackButton() {
      ctx.fillStyle = C_SIGNAL;
      ctx.strokeStyle = C_SIGNAL;
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 60, 25);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(10, 10, 60, 25);
      ctx.globalAlpha = 1.0;
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BACK", 40, 22.5);
    }

    function drawBlobGame() {
      updateBlobPhysics();

      appState.blob.blobs.forEach(blob => {
        const color = blob.isPrime ? C_MASTERY : C_SIGNAL;

        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.shadowBlur = 0;

        // Draw grid of squares instead of number
        const squareSize = 4;
        const gap = 1;
        const sqPerRow = Math.ceil(Math.sqrt(blob.value));
        const totalWidth = sqPerRow * (squareSize + gap) - gap;
        const startX = blob.x - totalWidth / 2;
        const startY = blob.y - totalWidth / 2;

        ctx.fillStyle = color;
        for (let i = 0; i < blob.value; i++) {
          const col = i % sqPerRow;
          const row = Math.floor(i / sqPerRow);
          const x = startX + col * (squareSize + gap);
          const y = startY + row * (squareSize + gap);
          ctx.fillRect(x, y, squareSize, squareSize);
        }

        if (blob.isPrime) {
          ctx.strokeStyle = C_MASTERY;
          ctx.lineWidth = 1;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x1 = blob.x + Math.cos(angle) * blob.radius;
            const y1 = blob.y + Math.sin(angle) * blob.radius;
            const x2 = blob.x + Math.cos(angle) * (blob.radius + 5);
            const y2 = blob.y + Math.sin(angle) * (blob.radius + 5);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      });
      ctx.shadowBlur = 0;

      drawBackButton();
    }

    function drawChangeGame() {
      updateChangeGame();

      const shapes = ['CYL', 'CONE↑', 'CONE↓', 'FUNNEL'];

      // Draw shape selectors
      shapes.forEach((name, i) => {
        const sx = 80 + i * 120;
        const sy = 50;
        const isSelected = i === appState.change.selectedShape;

        ctx.strokeStyle = isSelected ? C_SIGNAL : C_DIM;
        ctx.fillStyle = isSelected ? C_SIGNAL : C_DIM;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 45, sy - 15, 90, 30);

        if (isSelected) {
          ctx.globalAlpha = 0.3;
          ctx.fillRect(sx - 45, sy - 15, 90, 30);
          ctx.globalAlpha = 1.0;
        }

        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, sx, sy);
      });

      // Draw container with water
      const cx = 180;
      const cy = 300;
      const width = 80;
      const height = 200;
      const waterHeight = appState.change.waterLevel * height;

      ctx.strokeStyle = C_SIGNAL;
      ctx.lineWidth = 2;

      // Draw container shape
      ctx.beginPath();
      switch (appState.change.selectedShape) {
        case 0: // Cylinder
          ctx.moveTo(cx - width/2, cy - height/2);
          ctx.lineTo(cx - width/2, cy + height/2);
          ctx.moveTo(cx + width/2, cy - height/2);
          ctx.lineTo(cx + width/2, cy + height/2);
          break;
        case 1: // Cone up
          ctx.moveTo(cx - width/2, cy - height/2);
          ctx.lineTo(cx, cy + height/2);
          ctx.lineTo(cx + width/2, cy - height/2);
          break;
        case 2: // Cone down
          ctx.moveTo(cx, cy - height/2);
          ctx.lineTo(cx - width/2, cy + height/2);
          ctx.lineTo(cx + width/2, cy + height/2);
          break;
        case 3: // Funnel
          ctx.moveTo(cx - width/2, cy - height/2);
          ctx.lineTo(cx - 15, cy + height*0.6 - height/2);
          ctx.lineTo(cx - 15, cy + height/2);
          ctx.moveTo(cx + width/2, cy - height/2);
          ctx.lineTo(cx + 15, cy + height*0.6 - height/2);
          ctx.lineTo(cx + 15, cy + height/2);
          break;
      }
      ctx.stroke();

      // Draw water level
      if (waterHeight > 0) {
        const waterY = cy + height/2 - waterHeight;
        ctx.fillStyle = C_MASTERY;
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        switch (appState.change.selectedShape) {
          case 0: // Cylinder
            ctx.fillRect(cx - width/2, waterY, width, waterHeight);
            break;
          case 1: // Cone up
            const topWidthConeUp = width * (1 - appState.change.waterLevel);
            ctx.moveTo(cx - topWidthConeUp/2, waterY);
            ctx.lineTo(cx - width/2, cy + height/2);
            ctx.lineTo(cx + width/2, cy + height/2);
            ctx.lineTo(cx + topWidthConeUp/2, waterY);
            ctx.closePath();
            ctx.fill();
            break;
          case 2: // Cone down
            const botWidthConeDown = width * appState.change.waterLevel;
            ctx.moveTo(cx - botWidthConeDown/2, cy + height/2);
            ctx.lineTo(cx + botWidthConeDown/2, cy + height/2);
            ctx.lineTo(cx, cy + height/2 - waterHeight);
            ctx.closePath();
            ctx.fill();
            break;
          case 3: // Funnel
            if (appState.change.waterLevel > 0.6) {
              const funnelWaterHeight = waterHeight;
              const funnelWidth = width - (width - 30) * ((1 - appState.change.waterLevel) / 0.4);
              ctx.fillRect(cx - funnelWidth/2, waterY, funnelWidth, funnelWaterHeight);
            } else {
              ctx.fillRect(cx - 15, waterY, 30, waterHeight);
            }
            break;
        }
        ctx.globalAlpha = 1.0;

        // Water surface line
        ctx.strokeStyle = C_MASTERY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        switch (appState.change.selectedShape) {
          case 0:
            ctx.moveTo(cx - width/2, waterY);
            ctx.lineTo(cx + width/2, waterY);
            break;
          case 1:
            const topWidthUp = width * (1 - appState.change.waterLevel);
            ctx.moveTo(cx - topWidthUp/2, waterY);
            ctx.lineTo(cx + topWidthUp/2, waterY);
            break;
          case 2:
            const botWidthDown = width * appState.change.waterLevel;
            ctx.moveTo(cx - botWidthDown/2, waterY);
            ctx.lineTo(cx + botWidthDown/2, waterY);
            break;
          case 3:
            if (appState.change.waterLevel > 0.6) {
              const funnelWidth = width - (width - 30) * ((1 - appState.change.waterLevel) / 0.4);
              ctx.moveTo(cx - funnelWidth/2, waterY);
              ctx.lineTo(cx + funnelWidth/2, waterY);
            } else {
              ctx.moveTo(cx - 15, waterY);
              ctx.lineTo(cx + 15, waterY);
            }
            break;
        }
        ctx.stroke();
      }

      // Draw graph
      const gx = 370;
      const gy = 150;
      const gw = 200;
      const gh = 180;

      ctx.strokeStyle = C_DIM;
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, gw, gh);

      // Draw history
      if (appState.change.history.length > 1) {
        ctx.strokeStyle = C_SIGNAL;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const maxTime = Math.max(500, appState.change.time);
        appState.change.history.forEach((pt, i) => {
          const x = gx + (pt.time / maxTime) * gw;
          const y = gy + gh - (pt.level * gh);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // Draw start/pause button
      const btnText = appState.change.draining ? "PAUSE" : "START";
      ctx.strokeStyle = C_SIGNAL;
      ctx.fillStyle = C_SIGNAL;
      ctx.lineWidth = 2;
      ctx.strokeRect(230, 390, 140, 40);
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btnText, 300, 410);

      drawBackButton();
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
      } else if (appState.mode === MODE_GAME_BLOB) {
        drawBlobGame();
      } else if (appState.mode === MODE_GAME_CHANGE) {
        drawChangeGame();
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
