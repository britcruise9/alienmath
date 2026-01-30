"use client";

import { useEffect, useRef, useState } from 'react';

// Constants
const C_BG = "#050a05";
const C_GRID = "#0f2f0f";
const C_SIGNAL = "#33ff00";
const C_MASTERY = "#00ffff";
const C_ALERT = "#ff3300";
const C_DIM = "#1a4a1a";

const MODE_HUB = 0;
const MODE_PATTERN = 1;
const MODE_SIMPLE_BALANCE = 2;
const MODE_COLOR_BALANCE = 3;
const MODE_NESTED_BALANCE = 4;
const MODE_DRAIN_RACE = 5;

interface Block {
  x: number;
  y: number;
  slot: number | null;
  w: number;
  c: string;
  fixed: boolean;
}

interface PatternLevel {
  sequence: string[];
  numBlanks: number;
}

interface LeverLevel {
  inventory: { w: number; c?: string }[];
}

const PATTERN_LEVELS: PatternLevel[] = [
  { sequence: ['A', 'B', 'A', 'B', 'A', 'B'], numBlanks: 2 },
  { sequence: ['A', 'A', 'B', 'A', 'A', 'B'], numBlanks: 2 },
  { sequence: ['A', 'B', 'B', 'A', 'B', 'B'], numBlanks: 2 }
];

const LEVER_LEVELS: LeverLevel[] = [
  { inventory: [{w:1}, {w:1}] },
  { inventory: [{w:1}, {w:2}] },
  { inventory: [{w:2}, {w:2}, {w:1}, {w:1}] }
];

const COLOR_LEVELS: LeverLevel[] = [
  {
    inventory: [
      {w:2, c:C_ALERT},   // Red = weight 2
      {w:1, c:C_MASTERY}, // Cyan = weight 1
      {w:1, c:C_MASTERY}  // Cyan = weight 1
    ]
  },
  {
    inventory: [
      {w:2, c:C_ALERT},   // Red = weight 2
      {w:2, c:C_ALERT},   // Red = weight 2
      {w:1, c:C_MASTERY}, // Cyan = weight 1
      {w:1, c:C_MASTERY}, // Cyan = weight 1
      {w:1, c:C_MASTERY}, // Cyan = weight 1
      {w:1, c:C_MASTERY}  // Cyan = weight 1
    ]
  }
];

const NESTED_LEVEL: LeverLevel = {
  inventory: [
    {w:1}, {w:1}, {w:2}
  ]
};

// Drain Race levels: h1 = ▽ height, h2 = △ height
// Crossover happens when heights are equal during drain
interface DrainRaceLevel {
  h1: number;  // ▽ (point down) vessel height
  h2: number;  // △ (point up) vessel height
  duration: number; // drain time in frames (60fps)
}

const DRAIN_RACE_LEVELS: DrainRaceLevel[] = [
  { h1: 100, h2: 200, duration: 300 },  // 5 seconds, crossover ~36% through
  { h1: 140, h2: 200, duration: 360 },  // 6 seconds, crossover earlier
  { h1: 160, h2: 200, duration: 420 },  // 7 seconds, very subtle crossover
];

export default function GalacticGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [levelIndicator, setLevelIndicator] = useState("");

  const appStateRef = useRef({
    mode: MODE_PATTERN,
    mouse: {x: 0, y: 0, down: false},
    completed: {
      pattern: false,
      simple: false,
      color: false,
      nested: false,
      drainRace: false
    },
    pattern: {
      levelIdx: 0,
      sequence: [] as string[],
      userAnswer: [] as string[],
      numBlanks: 0,
      selectedColor: 'A' as string
    },
    lever: {
      levelIdx: 0,
      blocks: [] as Block[],
      drag: null as Block | null,
      bal: false,
      ang: 0,
      tgtAng: 0,
      winT: 0
    },
    colorBalance: {
      levelIdx: 0,
      blocks: [] as Block[],
      drag: null as Block | null,
      bal: false,
      ang: 0,
      tgtAng: 0,
      winT: 0
    },
    nested: {
      mainAng: 0,
      mainTgtAng: 0,
      miniAng: 0,
      miniSmoothTilt: 0,
      blocks: [] as Block[],
      drag: null as Block | null,
      winT: 0
    },
    drainRace: {
      levelIdx: 0,
      time: 0,           // current frame in animation
      running: false,    // is animation playing
      tapped: false,     // has user tapped
      tapTime: -1,       // frame when user tapped
      crossTime: 0,      // frame when levels actually cross
      showResult: false, // showing result feedback
      resultTimer: 0,    // countdown for result display
      winT: 0
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
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

    // Initialize - start with first pattern level
    loadPatternLevel(0);

    // Input routing
    function handleInputDown() {
      // Check completion dots at top (always visible)
      const m = appState.mouse;
      const dotY = 20;
      const dots = [
        { x: 120, completed: appState.completed.pattern, mode: MODE_PATTERN, start: startPatternGame },
        { x: 210, completed: appState.completed.simple, mode: MODE_SIMPLE_BALANCE, start: startSimpleBalance },
        { x: 300, completed: appState.completed.color, mode: MODE_COLOR_BALANCE, start: startColorBalance },
        { x: 390, completed: appState.completed.nested, mode: MODE_NESTED_BALANCE, start: startNestedBalance },
        { x: 480, completed: appState.completed.drainRace, mode: MODE_DRAIN_RACE, start: startDrainRace }
      ];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        if (Math.hypot(m.x - dot.x, m.y - dotY) < 15) {
          // Allow clicking any dot for testing/navigation
          dot.start();
          return;
        }
      }

      if (appState.mode === MODE_PATTERN) handlePatternClick();
      else if (appState.mode === MODE_SIMPLE_BALANCE) handleLeverDown();
      else if (appState.mode === MODE_COLOR_BALANCE) handleColorDown();
      else if (appState.mode === MODE_NESTED_BALANCE) handleNestedDown();
      else if (appState.mode === MODE_DRAIN_RACE) handleDrainRaceDown();
    }

    function handleInputUp() {
      if (appState.mode === MODE_SIMPLE_BALANCE) handleLeverUp();
      else if (appState.mode === MODE_COLOR_BALANCE) handleColorUp();
      else if (appState.mode === MODE_NESTED_BALANCE) handleNestedUp();
    }

    // ========== PATTERN GAME ==========
    function startPatternGame() {
      appState.mode = MODE_PATTERN;
      appState.pattern.levelIdx = 0;
      loadPatternLevel(0);
    }

    function loadPatternLevel(idx: number) {
      if (idx >= PATTERN_LEVELS.length) {
        appState.completed.pattern = true;
        startSimpleBalance();
        return;
      }

      const level = PATTERN_LEVELS[idx];
      appState.pattern.levelIdx = idx;
      appState.pattern.sequence = [...level.sequence];
      appState.pattern.numBlanks = level.numBlanks;
      appState.pattern.userAnswer = [];

      let dots = "";
      for(let i=0; i<=idx; i++) dots += "•";
      for(let i=idx+1; i<PATTERN_LEVELS.length; i++) dots += "◦";
      setLevelIndicator(dots);
    }

    function handlePatternClick() {
      const m = appState.mouse;
      const paletteX = 50;
      const paletteY1 = 150;
      const paletteY2 = 300;

      // Check palette circles first
      if (Math.hypot(m.x - paletteX, m.y - paletteY1) < 25) {
        appState.pattern.selectedColor = 'A';
        return;
      }
      if (Math.hypot(m.x - paletteX, m.y - paletteY2) < 25) {
        appState.pattern.selectedColor = 'B';
        return;
      }

      // Check blank cells
      const cellSize = 60;
      const startX = 100;
      const seqY = 225;

      for (let i = 0; i < appState.pattern.numBlanks; i++) {
        const cellIdx = appState.pattern.sequence.length + i;
        const cx = startX + cellIdx * cellSize;
        if (Math.abs(m.x - cx) < cellSize/2 && Math.abs(m.y - seqY) < cellSize/2) {
          // Paint with selected color, or clear if clicking same color
          if (appState.pattern.userAnswer[i] === appState.pattern.selectedColor) {
            appState.pattern.userAnswer[i] = '';
          } else {
            appState.pattern.userAnswer[i] = appState.pattern.selectedColor;
          }
          checkPatternAnswer();
          return;
        }
      }
    }

    function checkPatternAnswer() {
      if (appState.pattern.userAnswer.filter(a => a).length < appState.pattern.numBlanks) {
        return;
      }

      const seqLen = appState.pattern.sequence.length;
      let patternLen = 2;
      if (appState.pattern.sequence[0] === appState.pattern.sequence[1]) {
        patternLen = 3;
      }

      const expected: string[] = [];
      for (let i = 0; i < appState.pattern.numBlanks; i++) {
        expected.push(appState.pattern.sequence[(seqLen + i) % patternLen]);
      }

      const correct = appState.pattern.userAnswer.every((ans, i) => ans === expected[i]);

      if (correct) {
        setTimeout(() => {
          loadPatternLevel(appState.pattern.levelIdx + 1);
        }, 500);
      }
    }

    // ========== SIMPLE BALANCE ==========
    function startSimpleBalance() {
      appState.mode = MODE_SIMPLE_BALANCE;
      appState.lever.levelIdx = 0;
      loadLeverLevel(0);
    }

    function loadLeverLevel(idx: number) {
      if (idx >= LEVER_LEVELS.length) {
        appState.completed.simple = true;
        startColorBalance();
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
          c: item.c || C_SIGNAL,
          fixed: false
        });
      });
      checkLeverBalance();
    }

    function handleLeverDown() {
      const m = appState.mouse;

      // Try to pick up block from inventory
      for (let i = appState.lever.blocks.length - 1; i >= 0; i--) {
        const b = appState.lever.blocks[i];
        if (b.fixed || b.slot !== null) continue;
        if (Math.abs(m.x - b.x) < 30 && Math.abs(m.y - b.y) < 30 + (b.w*20)) {
          appState.lever.drag = b;
          checkLeverBalance();
          return;
        }
      }

      // Try to pick up block from lever
      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;
      const dx = m.x - FULCRUM_X, dy = m.y - FULCRUM_Y;
      const rad = -appState.lever.ang * Math.PI/180;
      const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
      const ly = dx*Math.sin(rad) + dy*Math.cos(rad);
      if (ly > 200) return; // Allow clicking on very tall stacks
      const slot = Math.round(lx/CELL);
      if (Math.abs(slot) <= 5 && slot !== 0 && Math.abs(lx - slot*CELL) < 30) {
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
        // Calculate existing stack heights for all slots
        let hMap: {[key: number]: number} = {};
        appState.lever.blocks.forEach(block => {
          if (block.slot !== null && block !== b) {
            const s = block.slot;
            if (!hMap[s]) hMap[s] = 0;
            hMap[s] += block.w * CELL;
          }
        });

        let bestS = 0, minD = Infinity;
        for (let s = -5; s <= 5; s++) {
          if (s === 0) continue;
          const rad = appState.lever.ang * Math.PI/180;
          const stackHeight = hMap[s] || 0;
          const px = FULCRUM_X + Math.cos(rad)*s*CELL;
          const py = FULCRUM_Y + Math.sin(rad)*s*CELL - 25 - stackHeight;
          const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
          if (d < minD) { minD = d; bestS = s; }
        }
        if (minD < 60) {
          appState.lever.blocks = appState.lever.blocks.filter(i => i !== b);
          appState.lever.blocks.push(b);
          b.slot = bestS;
        } else {
          b.slot = null;
          b.y = 380;
          b.x = Math.max(50, Math.min(550, appState.mouse.x));
        }
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

    // ========== COLOR BALANCE ==========
    function startColorBalance() {
      appState.mode = MODE_COLOR_BALANCE;
      appState.colorBalance.levelIdx = 0;
      loadColorLevel(0);
    }

    function loadColorLevel(idx: number) {
      if (idx >= COLOR_LEVELS.length) {
        appState.completed.color = true;
        startNestedBalance();
        return;
      }

      appState.colorBalance.levelIdx = idx;
      appState.colorBalance.blocks = [];
      appState.colorBalance.bal = false;
      appState.colorBalance.ang = 0;
      appState.colorBalance.tgtAng = 0;
      appState.colorBalance.winT = 0;

      const lvl = COLOR_LEVELS[idx];
      let dots = "";
      for(let i=0; i<=idx; i++) dots += "•";
      for(let i=idx+1; i<COLOR_LEVELS.length; i++) dots += "◦";
      setLevelIndicator(dots + " RED = 2x CYAN");

      lvl.inventory.forEach((item, i) => {
        appState.colorBalance.blocks.push({
          x: 100 + (i%6 * 80),
          y: 380 + (Math.floor(i/6)*50),
          slot: null,
          w: item.w,
          c: item.c || C_SIGNAL,
          fixed: false
        });
      });
      checkColorBalance();
    }

    function handleColorDown() {
      const m = appState.mouse;

      for (let i = appState.colorBalance.blocks.length - 1; i >= 0; i--) {
        const b = appState.colorBalance.blocks[i];
        if (b.fixed || b.slot !== null) continue;
        if (Math.abs(m.x - b.x) < 30 && Math.abs(m.y - b.y) < 30) {
          appState.colorBalance.drag = b;
          checkColorBalance();
          return;
        }
      }

      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;
      const dx = m.x - FULCRUM_X, dy = m.y - FULCRUM_Y;
      const rad = -appState.colorBalance.ang * Math.PI/180;
      const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
      const ly = dx*Math.sin(rad) + dy*Math.cos(rad);
      if (ly > 200) return; // Allow clicking on very tall stacks
      const slot = Math.round(lx/CELL);
      if (Math.abs(slot) <= 5 && slot !== 0 && Math.abs(lx - slot*CELL) < 30) {
        const inSlot = appState.colorBalance.blocks.filter(b => b.slot === slot);
        if (inSlot.length > 0) {
          const top = inSlot[inSlot.length-1];
          if (!top.fixed) {
            appState.colorBalance.drag = top;
            top.slot = null;
            checkColorBalance();
          }
        }
      }
    }

    function handleColorUp() {
      if (!appState.colorBalance.drag) return;
      const b = appState.colorBalance.drag;
      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;

      if (appState.mouse.y < 350) {
        // Calculate existing stack heights for all slots
        let hMap: {[key: number]: number} = {};
        appState.colorBalance.blocks.forEach(block => {
          if (block.slot !== null && block !== b) {
            const s = block.slot;
            if (!hMap[s]) hMap[s] = 0;
            hMap[s] += 32; // All blocks same size in color balance
          }
        });

        let bestS = 0, minD = Infinity;
        for (let s = -5; s <= 5; s++) {
          if (s === 0) continue;
          const rad = appState.colorBalance.ang * Math.PI/180;
          const stackHeight = hMap[s] || 0;
          const px = FULCRUM_X + Math.cos(rad)*s*CELL;
          const py = FULCRUM_Y + Math.sin(rad)*s*CELL - 25 - stackHeight;
          const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
          if (d < minD) { minD = d; bestS = s; }
        }
        if (minD < 60) {
          appState.colorBalance.blocks = appState.colorBalance.blocks.filter(i => i !== b);
          appState.colorBalance.blocks.push(b);
          b.slot = bestS;
        } else {
          b.slot = null;
          b.y = 380;
          b.x = Math.max(50, Math.min(550, appState.mouse.x));
        }
      } else {
        b.slot = null;
        b.y = 380;
        b.x = Math.max(50, Math.min(550, appState.mouse.x));
      }

      appState.colorBalance.drag = null;
      checkColorBalance();
    }

    function checkColorBalance() {
      let L = 0, R = 0, hand = false;
      appState.colorBalance.blocks.forEach(b => {
        if (b.slot === null) {
          if (!b.fixed) hand = true;
          return;
        }
        const t = Math.abs(b.slot) * b.w;
        b.slot < 0 ? L += t : R += t;
      });

      if (hand) {
        appState.colorBalance.bal = false;
        appState.colorBalance.tgtAng = L > R ? -20 : (R > L ? 20 : 0);
      } else {
        if (L === R) {
          appState.colorBalance.bal = true;
          appState.colorBalance.tgtAng = 0;
        } else {
          appState.colorBalance.bal = false;
          appState.colorBalance.tgtAng = L > R ? -20 : 20;
        }
      }
    }

    // ========== NESTED BALANCE ==========
    function startNestedBalance() {
      appState.mode = MODE_NESTED_BALANCE;
      appState.nested.mainAng = 0;
      appState.nested.mainTgtAng = 0;
      appState.nested.miniAng = 0;
      appState.nested.miniSmoothTilt = 0;
      appState.nested.blocks = [];
      appState.nested.winT = 0;

      NESTED_LEVEL.inventory.forEach((item, i) => {
        appState.nested.blocks.push({
          x: 100 + i * 80,
          y: 380,
          slot: null,
          w: item.w,
          c: item.c || C_SIGNAL,
          fixed: false
        });
      });
      setLevelIndicator("BALANCE MINI, THEN MAIN");
      checkNestedBalance();
    }

    function handleNestedDown() {
      const m = appState.mouse;

      // Pick up from inventory
      for (let i = appState.nested.blocks.length - 1; i >= 0; i--) {
        const b = appState.nested.blocks[i];
        if (b.fixed || b.slot !== null) continue;
        if (Math.abs(m.x - b.x) < 20 && Math.abs(m.y - b.y) < 20) {
          appState.nested.drag = b;
          checkNestedBalance();
          return;
        }
      }

      const MAIN_X = 300, MAIN_Y = 280, MAIN_CELL = 40;
      const MINI_CELL = 30, MINI_POS = 4;

      // Calculate mini lever position in world space
      const mainRad = appState.nested.mainAng * Math.PI/180;
      const miniWorldX = MAIN_X + Math.cos(mainRad) * MINI_POS * MAIN_CELL;
      const miniWorldY = MAIN_Y + Math.sin(mainRad) * MINI_POS * MAIN_CELL - 20;

      // Try mini lever first (transformed by both main and mini rotation)
      let dx = m.x - miniWorldX;
      let dy = m.y - miniWorldY;
      const totalRad = -(appState.nested.mainAng + appState.nested.miniAng) * Math.PI/180;
      let lx = dx*Math.cos(totalRad) - dy*Math.sin(totalRad);
      let ly = dx*Math.sin(totalRad) + dy*Math.cos(totalRad);

      if (Math.abs(ly) < 30) {
        const slot = Math.round(lx/MINI_CELL);
        if (Math.abs(slot) <= 3 && slot !== 0 && Math.abs(lx - slot*MINI_CELL) < 20) {
          const inSlot = appState.nested.blocks.filter(b => b.slot === (100 + slot));
          if (inSlot.length > 0) {
            const top = inSlot[inSlot.length-1];
            if (!top.fixed) {
              appState.nested.drag = top;
              top.slot = null;
              checkNestedBalance();
              return;
            }
          }
        }
      }

      // Try main lever
      dx = m.x - MAIN_X;
      dy = m.y - MAIN_Y;
      const rad = -appState.nested.mainAng * Math.PI/180;
      lx = dx*Math.cos(rad) - dy*Math.sin(rad);
      ly = dx*Math.sin(rad) + dy*Math.cos(rad);
      if (ly > 200) return; // Allow clicking on very tall stacks
      const slot = Math.round(lx/MAIN_CELL);
      if (Math.abs(slot) <= 5 && slot !== 0 && Math.abs(lx - slot*MAIN_CELL) < 30) {
        const inSlot = appState.nested.blocks.filter(b => b.slot === slot);
        if (inSlot.length > 0) {
          const top = inSlot[inSlot.length-1];
          if (!top.fixed) {
            appState.nested.drag = top;
            top.slot = null;
            checkNestedBalance();
          }
        }
      }
    }

    function handleNestedUp() {
      if (!appState.nested.drag) return;
      const b = appState.nested.drag;

      const MAIN_X = 300, MAIN_Y = 280, MAIN_CELL = 40;
      const MINI_CELL = 30, MINI_POS = 4;

      // Calculate existing stack heights for mini lever
      let miniHMap: {[key: number]: number} = {};
      appState.nested.blocks.forEach(block => {
        if (block.slot !== null && block.slot >= 97 && block.slot <= 103 && block.slot !== 100 && block !== b) {
          const localSlot = block.slot - 100;
          if (!miniHMap[localSlot]) miniHMap[localSlot] = 0;
          miniHMap[localSlot] += block.w * MINI_CELL;
        }
      });

      // Calculate existing stack heights for main lever
      let mainHMap: {[key: number]: number} = {};
      appState.nested.blocks.forEach(block => {
        if (block.slot !== null && block.slot < 97 && block !== b) {
          const s = block.slot;
          if (!mainHMap[s]) mainHMap[s] = 0;
          mainHMap[s] += block.w * MAIN_CELL;
        }
      });

      // Calculate mini lever world position
      const mainRad = appState.nested.mainAng * Math.PI/180;
      const miniWorldX = MAIN_X + Math.cos(mainRad) * MINI_POS * MAIN_CELL;
      const miniWorldY = MAIN_Y + Math.sin(mainRad) * MINI_POS * MAIN_CELL - 20;

      // Try mini lever slots
      let bestS = 0, minD = Infinity;
      for (let s = -3; s <= 3; s++) {
        if (s === 0) continue;
        const totalRad = (appState.nested.mainAng + appState.nested.miniAng) * Math.PI/180;
        const stackHeight = miniHMap[s] || 0;
        const px = miniWorldX + Math.cos(totalRad)*s*MINI_CELL;
        const py = miniWorldY + Math.sin(totalRad)*s*MINI_CELL - 15 - stackHeight;
        const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
        if (d < minD) { minD = d; bestS = s; }
      }

      if (minD < 60) {
        appState.nested.blocks = appState.nested.blocks.filter(i => i !== b);
        appState.nested.blocks.push(b);
        b.slot = 100 + bestS;
        appState.nested.drag = null;
        checkNestedBalance();
        return;
      }

      // Try main lever slots
      minD = Infinity;
      for (let s = -5; s <= 5; s++) {
        if (s === 0) continue;
        const rad = appState.nested.mainAng * Math.PI/180;
        const stackHeight = mainHMap[s] || 0;
        const px = MAIN_X + Math.cos(rad)*s*MAIN_CELL;
        const py = MAIN_Y + Math.sin(rad)*s*MAIN_CELL - 25 - stackHeight;
        const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
        if (d < minD) { minD = d; bestS = s; }
      }

      if (minD < 60) {
        appState.nested.blocks = appState.nested.blocks.filter(i => i !== b);
        appState.nested.blocks.push(b);
        b.slot = bestS;
        appState.nested.drag = null;
        checkNestedBalance();
        return;
      }

      // Return to inventory
      b.slot = null;
      b.y = 380;
      b.x = Math.max(50, Math.min(550, appState.mouse.x));
      appState.nested.drag = null;
      checkNestedBalance();
    }

    function checkNestedBalance() {
      // Check mini lever balance (slots 97-99 left, 101-103 right)
      let miniL = 0, miniR = 0, miniTotalWeight = 0;
      appState.nested.blocks.forEach(b => {
        if (b.slot !== null && b.slot >= 97 && b.slot <= 103 && b.slot !== 100) {
          const localSlot = b.slot - 100;
          const t = Math.abs(localSlot) * b.w;
          localSlot < 0 ? miniL += t : miniR += t;
          miniTotalWeight += b.w; // Sum the weights, not the torques!
        }
      });

      // Mini lever tilts based on its own balance
      // Set the tilt directly (no smoothing) so it instantly responds to balance changes
      appState.nested.miniSmoothTilt = miniL === miniR ? 0 : (miniL > miniR ? -15 : 15);

      // Check main lever balance (exclude mini lever slots 97-103)
      let mainL = 0, mainR = 0;
      appState.nested.blocks.forEach(b => {
        if (b.slot !== null && b.slot < 97) {
          // Only slots below 97 count on main lever
          const t = Math.abs(b.slot) * b.w;
          b.slot < 0 ? mainL += t : mainR += t;
        }
      });

      // Add mini lever total weight as point mass at position +4 on right side
      mainR += miniTotalWeight * 4;

      // Main lever tilts based on its balance
      appState.nested.mainTgtAng = mainL === mainR ? 0 : (mainL > mainR ? -15 : 15);

      // Win condition - all blocks must be placed and both levers balanced
      const allPlaced = appState.nested.blocks.every(b => b.slot !== null);
      if (allPlaced && miniL === miniR && mainL === mainR && miniTotalWeight > 0) {
        appState.nested.winT++;
        if (appState.nested.winT > 30) {
          appState.completed.nested = true;
          startDrainRace();  // Auto-advance to drain race
        }
      } else {
        appState.nested.winT = 0;
      }
    }

    // ========== DRAIN RACE ==========
    function startDrainRace() {
      appState.mode = MODE_DRAIN_RACE;
      appState.drainRace.levelIdx = 0;
      loadDrainRaceLevel(0);
    }

    function loadDrainRaceLevel(idx: number) {
      if (idx >= DRAIN_RACE_LEVELS.length) {
        appState.completed.drainRace = true;
        setLevelIndicator("✓ CHANGE COMPLETE");
        return;
      }

      const level = DRAIN_RACE_LEVELS[idx];
      appState.drainRace.levelIdx = idx;
      appState.drainRace.time = 0;
      appState.drainRace.running = true;
      appState.drainRace.tapped = false;
      appState.drainRace.tapTime = -1;
      appState.drainRace.showResult = false;
      appState.drainRace.resultTimer = 0;
      appState.drainRace.winT = 0;

      // Calculate crossover time
      // ▽: h1(t) = H1 * sqrt(1 - t/T)
      // △: h2(t) = H2 * (1 - sqrt(t/T))
      // Cross when: H1 * sqrt(1-t/T) = H2 * (1 - sqrt(t/T))
      // Let u = sqrt(t/T), r = H1/H2
      // r * sqrt(1-u²) = 1-u
      // Solving: u = (1 - r²) / (1 + r²)
      const r = level.h1 / level.h2;
      const u = (1 - r*r) / (1 + r*r);
      appState.drainRace.crossTime = level.duration * u * u;

      let dots = "";
      for(let i=0; i<=idx; i++) dots += "•";
      for(let i=idx+1; i<DRAIN_RACE_LEVELS.length; i++) dots += "◦";
      setLevelIndicator(dots + " TAP WHEN EQUAL");
    }

    function handleDrainRaceDown() {
      const dr = appState.drainRace;

      // If showing result, tap to continue
      if (dr.showResult) {
        if (dr.winT > 0) {
          // Won - advance to next level
          loadDrainRaceLevel(dr.levelIdx + 1);
        } else {
          // Lost - retry same level
          loadDrainRaceLevel(dr.levelIdx);
        }
        return;
      }

      // If running and not yet tapped, register tap
      if (dr.running && !dr.tapped) {
        dr.tapped = true;
        dr.tapTime = dr.time;
      }
    }

    function getWaterLevels(time: number, level: DrainRaceLevel) {
      const t = Math.min(time / level.duration, 1);
      // ▽ (point down): starts lower, drains slow then fast
      const h1 = level.h1 * Math.sqrt(Math.max(0, 1 - t));
      // △ (point up): starts higher, drains fast then slow
      const h2 = level.h2 * (1 - Math.sqrt(t));
      return { h1, h2 };
    }

    // ========== DRAWING ==========
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

    function drawCompletionDots() {
      const dotY = 20;
      const dots = [
        { x: 120, completed: appState.completed.pattern, current: appState.mode === MODE_PATTERN },
        { x: 210, completed: appState.completed.simple, current: appState.mode === MODE_SIMPLE_BALANCE },
        { x: 300, completed: appState.completed.color, current: appState.mode === MODE_COLOR_BALANCE },
        { x: 390, completed: appState.completed.nested, current: appState.mode === MODE_NESTED_BALANCE },
        { x: 480, completed: appState.completed.drainRace, current: appState.mode === MODE_DRAIN_RACE }
      ];

      dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dotY, 8, 0, Math.PI * 2);

        if (dot.completed) {
          // Filled dot for completed
          ctx.fillStyle = C_SIGNAL;
          ctx.fill();
        } else if (dot.current) {
          // Outlined dot for current
          ctx.strokeStyle = C_SIGNAL;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Dim dot for not yet reached
          ctx.strokeStyle = C_DIM;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    function drawBlock(x: number, y: number, w: number, c: string, sameSize: boolean = false) {
      let h = sameSize ? 32 : (w*40 - 8);
      let wid = 32;
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
      if (!sameSize && w > 1) {
        for (let i = 1; i < w; i++) {
          ctx.fillRect(x-wid/2+4, y-h/2+i*40-1, wid-8, 2);
        }
      }
      ctx.fillRect(x-2, y-2, 4, 4);
      ctx.shadowBlur = 0;
    }


    function drawPattern() {
      const cellSize = 60;
      const startX = 100;
      const seqY = 225;

      appState.pattern.sequence.forEach((color, i) => {
        const cx = startX + i * cellSize;
        const fillColor = color === 'A' ? C_MASTERY : C_ALERT;

        ctx.strokeStyle = fillColor;
        ctx.fillStyle = fillColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - cellSize/2 + 5, seqY - cellSize/2 + 5, cellSize - 10, cellSize - 10);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - cellSize/2 + 5, seqY - cellSize/2 + 5, cellSize - 10, cellSize - 10);
        ctx.globalAlpha = 1.0;
      });

      for (let i = 0; i < appState.pattern.numBlanks; i++) {
        const cellIdx = appState.pattern.sequence.length + i;
        const cx = startX + cellIdx * cellSize;

        const userAns = appState.pattern.userAnswer[i];
        if (userAns) {
          const fillColor = userAns === 'A' ? C_MASTERY : C_ALERT;
          ctx.strokeStyle = fillColor;
          ctx.fillStyle = fillColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - cellSize/2 + 5, seqY - cellSize/2 + 5, cellSize - 10, cellSize - 10);
          ctx.globalAlpha = 0.5;
          ctx.fillRect(cx - cellSize/2 + 5, seqY - cellSize/2 + 5, cellSize - 10, cellSize - 10);
          ctx.globalAlpha = 1.0;
        } else {
          ctx.strokeStyle = C_DIM;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - cellSize/2 + 5, seqY - cellSize/2 + 5, cellSize - 10, cellSize - 10);
        }
      }

      // Draw palette circles on left
      const paletteX = 50;
      const paletteY1 = 150;
      const paletteY2 = 300;

      // Cyan circle
      ctx.fillStyle = C_MASTERY;
      ctx.beginPath();
      ctx.arc(paletteX, paletteY1, 20, 0, Math.PI * 2);
      ctx.fill();
      if (appState.pattern.selectedColor === 'A') {
        ctx.strokeStyle = C_SIGNAL;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(paletteX, paletteY1, 25, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Red circle
      ctx.fillStyle = C_ALERT;
      ctx.beginPath();
      ctx.arc(paletteX, paletteY2, 20, 0, Math.PI * 2);
      ctx.fill();
      if (appState.pattern.selectedColor === 'B') {
        ctx.strokeStyle = C_SIGNAL;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(paletteX, paletteY2, 25, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawLever() {
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

      // Blocks on lever
      let hMap: {[key: number]: number} = {};
      appState.lever.blocks.forEach(b => {
        if (b.slot !== null && b !== appState.lever.drag) {
          let s = b.slot;
          if (!hMap[s]) hMap[s] = 0;
          let h = b.w * CELL;
          const bx = s*CELL;
          const by = -5 - hMap[s] - h/2;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(-appState.lever.ang * Math.PI/180);
          drawBlock(0, 0, b.w, b.c);
          ctx.restore();
          hMap[s] += h;
        }
      });
      ctx.restore();

      // Blocks off lever
      appState.lever.blocks.forEach(b => {
        if (b.slot === null || b === appState.lever.drag) {
          drawBlock(b.x, b.y, b.w, b.c);
        }
      });

      // Win bar
      if (appState.lever.winT > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 445, 600*(appState.lever.winT/60), 5);
      }
    }

    function drawColorBalance() {
      if (appState.colorBalance.drag) {
        appState.colorBalance.drag.x = appState.mouse.x;
        appState.colorBalance.drag.y = appState.mouse.y;
      }
      appState.colorBalance.ang += (appState.colorBalance.tgtAng - appState.colorBalance.ang) * 0.1;

      if (appState.colorBalance.bal && Math.abs(appState.colorBalance.ang) < 1) {
        appState.colorBalance.winT++;
        if (appState.colorBalance.winT > 60) {
          loadColorLevel(appState.colorBalance.levelIdx + 1);
        }
      } else {
        appState.colorBalance.winT = 0;
      }

      const FULCRUM_X = 300, FULCRUM_Y = 280, CELL = 40;

      ctx.fillStyle = C_DIM;
      ctx.beginPath();
      ctx.moveTo(FULCRUM_X, FULCRUM_Y);
      ctx.lineTo(FULCRUM_X - 15, FULCRUM_Y + 30);
      ctx.lineTo(FULCRUM_X + 15, FULCRUM_Y + 30);
      ctx.fill();

      ctx.save();
      ctx.translate(FULCRUM_X, FULCRUM_Y);
      ctx.rotate(appState.colorBalance.ang * Math.PI/180);

      let color = C_SIGNAL;
      ctx.shadowBlur = (appState.colorBalance.bal && appState.colorBalance.winT > 10) ? 15 : 0;
      ctx.shadowColor = color;
      ctx.fillStyle = (appState.colorBalance.bal && appState.colorBalance.winT > 10) ? color : C_DIM;
      ctx.fillRect(-210, -5, 420, 10);
      ctx.shadowBlur = 0;

      ctx.fillStyle = C_BG;
      for (let s = -5; s <= 5; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      let hMap: {[key: number]: number} = {};
      appState.colorBalance.blocks.forEach(b => {
        if (b.slot !== null && b !== appState.colorBalance.drag) {
          let s = b.slot;
          if (!hMap[s]) hMap[s] = 0;
          let h = 32; // All blocks same size
          const bx = s*CELL;
          const by = -5 - hMap[s] - h/2;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(-appState.colorBalance.ang * Math.PI/180);
          drawBlock(0, 0, b.w, b.c, true);
          ctx.restore();
          hMap[s] += h;
        }
      });
      ctx.restore();

      appState.colorBalance.blocks.forEach(b => {
        if (b.slot === null || b === appState.colorBalance.drag) {
          drawBlock(b.x, b.y, b.w, b.c, true);
        }
      });

      if (appState.colorBalance.winT > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 445, 600*(appState.colorBalance.winT/60), 5);
      }
    }

    function drawNested() {
      if (appState.nested.drag) {
        appState.nested.drag.x = appState.mouse.x;
        appState.nested.drag.y = appState.mouse.y;
      }
      // Smooth main lever angle
      appState.nested.mainAng += (appState.nested.mainTgtAng - appState.nested.mainAng) * 0.1;

      // Mini lever uses absolute gravity: counter-rotate main angle + smooth tilt
      // This ensures mini lever stays horizontal on screen when balanced, regardless of main lever angle
      appState.nested.miniAng = -appState.nested.mainAng + appState.nested.miniSmoothTilt;

      const MAIN_X = 300, MAIN_Y = 280, MAIN_CELL = 40;
      const MINI_CELL = 30;
      const MINI_POS = 4; // Mini lever sits at +4 position on main lever

      // Draw main fulcrum
      ctx.fillStyle = C_DIM;
      ctx.beginPath();
      ctx.moveTo(MAIN_X, MAIN_Y);
      ctx.lineTo(MAIN_X - 15, MAIN_Y + 30);
      ctx.lineTo(MAIN_X + 15, MAIN_Y + 30);
      ctx.fill();

      // Draw main lever (and everything on it)
      ctx.save();
      ctx.translate(MAIN_X, MAIN_Y);
      ctx.rotate(appState.nested.mainAng * Math.PI/180);

      // Main lever bar
      ctx.fillStyle = C_DIM;
      ctx.fillRect(-210, -5, 420, 10);

      // Main lever slots
      ctx.fillStyle = C_BG;
      for (let s = -5; s <= 5; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*MAIN_CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      // Draw blocks on main lever (excluding mini lever slots 97-103)
      let mainHMap: {[key: number]: number} = {};
      appState.nested.blocks.forEach(b => {
        if (b.slot !== null && b.slot < 97 && b !== appState.nested.drag) {
          let s = b.slot;
          if (!mainHMap[s]) mainHMap[s] = 0;
          let h = b.w * MAIN_CELL;
          const bx = s*MAIN_CELL;
          const by = -5 - mainHMap[s] - h/2;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(-appState.nested.mainAng * Math.PI/180);
          drawBlock(0, 0, b.w, b.c);
          ctx.restore();
          mainHMap[s] += h;
        }
      });

      // Now draw mini lever sitting ON the main lever at position +4
      // Mini lever fulcrum sits ON the main lever surface at slot +4
      ctx.save();
      ctx.translate(MINI_POS * MAIN_CELL, -5); // Position at slot +4, on top of lever

      // Mini fulcrum (small triangle)
      ctx.fillStyle = C_DIM;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -15);
      ctx.lineTo(8, -15);
      ctx.fill();

      // Mini lever rotates around its own center
      ctx.translate(0, -15);
      ctx.rotate(appState.nested.miniAng * Math.PI/180);

      // Mini lever bar
      ctx.fillStyle = C_DIM;
      ctx.fillRect(-100, -3, 200, 6);

      // Mini lever slots
      ctx.fillStyle = C_BG;
      for (let s = -3; s <= 3; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*MINI_CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      // Draw blocks on mini lever
      let miniHMap: {[key: number]: number} = {};
      appState.nested.blocks.forEach(b => {
        if (b.slot !== null && b.slot >= 97 && b.slot <= 103 && b.slot !== 100 && b !== appState.nested.drag) {
          let localSlot = b.slot - 100;
          if (!miniHMap[localSlot]) miniHMap[localSlot] = 0;
          let h = b.w * MINI_CELL;
          const bx = localSlot*MINI_CELL;
          const by = -3 - miniHMap[localSlot] - h/2;
          ctx.save();
          ctx.translate(bx, by);
          // Blocks stay upright relative to gravity, not the lever
          // Need to counter-rotate by BOTH main and mini angles to stay vertical
          ctx.rotate(-(appState.nested.miniAng + appState.nested.mainAng) * Math.PI/180);
          drawBlock(0, 0, b.w, b.c);
          ctx.restore();
          miniHMap[localSlot] += h;
        }
      });

      ctx.restore(); // End mini lever
      ctx.restore(); // End main lever

      // Draw blocks in inventory
      appState.nested.blocks.forEach(b => {
        if (b.slot === null || b === appState.nested.drag) {
          drawBlock(b.x, b.y, b.w, b.c);
        }
      });

      if (appState.nested.winT > 0) {
        ctx.fillStyle = C_SIGNAL;
        ctx.fillRect(0, 445, 600*(appState.nested.winT/30), 5);
      }
    }

    function drawDrainRace() {
      const dr = appState.drainRace;
      const level = DRAIN_RACE_LEVELS[dr.levelIdx];
      if (!level) return;

      // Update animation
      if (dr.running && !dr.showResult) {
        dr.time++;

        // Check if tapped
        if (dr.tapped && !dr.showResult) {
          dr.showResult = true;
          dr.running = false;

          // Check accuracy - within 20 frames (0.33 sec) is a win
          const accuracy = Math.abs(dr.tapTime - dr.crossTime);
          if (accuracy < 20) {
            dr.winT = 1;
          }
        }

        // If animation complete without tap, show failure
        if (dr.time >= level.duration && !dr.tapped) {
          dr.showResult = true;
          dr.running = false;
          dr.winT = 0;
        }
      }

      // Result display timer
      if (dr.showResult) {
        dr.resultTimer++;
      }

      const { h1, h2 } = getWaterLevels(dr.time, level);

      // Vessel positions
      const V1_X = 180;  // ▽ center
      const V2_X = 420;  // △ center
      const BASE_Y = 380; // bottom of vessels
      const MAX_WIDTH = 100;

      // Draw ▽ (point down) vessel - left side
      const v1Height = level.h1;
      const v1TopWidth = MAX_WIDTH;

      ctx.strokeStyle = C_SIGNAL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Left edge
      ctx.moveTo(V1_X - v1TopWidth/2, BASE_Y - v1Height);
      ctx.lineTo(V1_X, BASE_Y);
      // Right edge
      ctx.lineTo(V1_X + v1TopWidth/2, BASE_Y - v1Height);
      // Top edge
      ctx.lineTo(V1_X - v1TopWidth/2, BASE_Y - v1Height);
      ctx.stroke();

      // Water in ▽ - width at height h is proportional to h
      if (h1 > 0) {
        const waterWidth = (h1 / v1Height) * v1TopWidth;
        ctx.fillStyle = C_MASTERY;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(V1_X, BASE_Y);
        ctx.lineTo(V1_X - waterWidth/2, BASE_Y - h1);
        ctx.lineTo(V1_X + waterWidth/2, BASE_Y - h1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Water surface line
        ctx.strokeStyle = C_MASTERY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(V1_X - waterWidth/2, BASE_Y - h1);
        ctx.lineTo(V1_X + waterWidth/2, BASE_Y - h1);
        ctx.stroke();
      }

      // Draw △ (point up) vessel - right side
      const v2Height = level.h2;
      const v2BottomWidth = MAX_WIDTH;

      ctx.strokeStyle = C_SIGNAL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Left edge
      ctx.moveTo(V2_X - v2BottomWidth/2, BASE_Y);
      ctx.lineTo(V2_X, BASE_Y - v2Height);
      // Right edge
      ctx.lineTo(V2_X + v2BottomWidth/2, BASE_Y);
      // Bottom edge
      ctx.lineTo(V2_X - v2BottomWidth/2, BASE_Y);
      ctx.stroke();

      // Water in △ - width at height h is proportional to (H-h)
      if (h2 > 0) {
        const waterTopWidth = ((v2Height - h2) / v2Height) * v2BottomWidth;
        ctx.fillStyle = C_MASTERY;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(V2_X - v2BottomWidth/2, BASE_Y);
        ctx.lineTo(V2_X - waterTopWidth/2, BASE_Y - h2);
        ctx.lineTo(V2_X + waterTopWidth/2, BASE_Y - h2);
        ctx.lineTo(V2_X + v2BottomWidth/2, BASE_Y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Water surface line
        ctx.strokeStyle = C_MASTERY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(V2_X - waterTopWidth/2, BASE_Y - h2);
        ctx.lineTo(V2_X + waterTopWidth/2, BASE_Y - h2);
        ctx.stroke();
      }

      // Draw horizontal reference lines at tap moment if showing result
      if (dr.showResult && dr.tapped) {
        const tapLevels = getWaterLevels(dr.tapTime, level);
        const crossLevels = getWaterLevels(dr.crossTime, level);

        // Show tap position lines
        ctx.strokeStyle = dr.winT > 0 ? C_SIGNAL : C_ALERT;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Line at tap time for both vessels
        ctx.beginPath();
        ctx.moveTo(100, BASE_Y - tapLevels.h1);
        ctx.lineTo(500, BASE_Y - tapLevels.h1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(100, BASE_Y - tapLevels.h2);
        ctx.lineTo(500, BASE_Y - tapLevels.h2);
        ctx.stroke();

        ctx.setLineDash([]);

        // Show actual crossover line
        ctx.strokeStyle = C_SIGNAL;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(100, BASE_Y - crossLevels.h1);
        ctx.lineTo(500, BASE_Y - crossLevels.h1);
        ctx.stroke();
      }

      // Show result message
      if (dr.showResult) {
        ctx.font = "24px monospace";
        ctx.textAlign = "center";
        if (dr.winT > 0) {
          ctx.fillStyle = C_SIGNAL;
          ctx.shadowBlur = 15;
          ctx.shadowColor = C_SIGNAL;
          ctx.fillText("SYNCHRONIZED", 300, 100);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = C_ALERT;
          ctx.fillText(dr.tapped ? "MISSED" : "TOO SLOW", 300, 100);
        }

        ctx.font = "14px monospace";
        ctx.fillStyle = C_DIM;
        ctx.fillText("tap to continue", 300, 130);
      }

      // Labels
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = C_DIM;
      ctx.fillText("▽", V1_X, BASE_Y + 25);
      ctx.fillText("△", V2_X, BASE_Y + 25);

      // Win bar
      if (dr.winT > 0 && dr.showResult) {
        dr.winT++;
        ctx.fillStyle = C_SIGNAL;
        ctx.fillRect(0, 445, 600 * Math.min(dr.winT / 60, 1), 5);
        if (dr.winT > 90) {
          loadDrainRaceLevel(dr.levelIdx + 1);
        }
      }
    }

    function draw() {
      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, 600, 450);
      drawGrid();
      drawCompletionDots();

      if (appState.mode === MODE_PATTERN) drawPattern();
      else if (appState.mode === MODE_SIMPLE_BALANCE) drawLever();
      else if (appState.mode === MODE_COLOR_BALANCE) drawColorBalance();
      else if (appState.mode === MODE_NESTED_BALANCE) drawNested();
      else if (appState.mode === MODE_DRAIN_RACE) drawDrainRace();

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <canvas
        ref={canvasRef}
        width={600}
        height={450}
        className="border-2 border-green-500"
        style={{ imageRendering: 'pixelated' }}
      />
      {levelIndicator && (
        <div className="mt-4 text-green-500 font-mono text-sm">
          {levelIndicator}
        </div>
      )}
    </div>
  );
}
