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

interface Block {
  x: number;
  y: number;
  slot: number | null;
  w: number;
  c: string;
  fixed: boolean;
}

export default function GalacticGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [levelIndicator, setLevelIndicator] = useState("");

  const appStateRef = useRef({
    mode: MODE_HUB,
    mouse: {x: 0, y: 0, down: false},
    debugSteps: [
      { id: 1, x: 150, y: 225, r: 20, label: "PATTERN" },
      { id: 2, x: 250, y: 225, r: 20, label: "SIMPLE" },
      { id: 3, x: 350, y: 225, r: 20, label: "COLOR" },
      { id: 4, x: 450, y: 225, r: 20, label: "NESTED" }
    ],
    pattern: {
      sequence: ['A', 'B', 'A', 'B', 'A', 'B'] as string[],
      userAnswer: [] as string[],
      numBlanks: 2
    },
    balance: {
      blocks: [] as Block[],
      drag: null as Block | null,
      ang: 0,
      tgtAng: 0,
      winT: 0
    },
    colorBalance: {
      blocks: [] as Block[],
      drag: null as Block | null,
      ang: 0,
      tgtAng: 0,
      winT: 0
    },
    nestedBalance: {
      mainLever: { ang: 0, tgtAng: 0 },
      leftMini: { ang: 0, tgtAng: 0, pos: -4 },
      rightMini: { ang: 0, tgtAng: 0, pos: 4 },
      blocks: [] as Block[],
      drag: null as Block | null,
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

    // Input routing
    function handleInputDown() {
      if (appState.mode !== MODE_HUB) {
        const m = appState.mouse;
        if (m.x < 80 && m.y < 40) {
          appState.mode = MODE_HUB;
          setLevelIndicator("");
          return;
        }
      }

      if (appState.mode === MODE_HUB) {
        const m = appState.mouse;
        appState.debugSteps.forEach((step, i) => {
          const d = Math.hypot(m.x - step.x, m.y - step.y);
          if (d < step.r + 10) {
            if (i === 0) startPattern();
            else if (i === 1) startSimpleBalance();
            else if (i === 2) startColorBalance();
            else if (i === 3) startNestedBalance();
          }
        });
      } else if (appState.mode === MODE_PATTERN) {
        handlePatternClick();
      } else if (appState.mode === MODE_SIMPLE_BALANCE) {
        handleBalanceDown(appState.balance);
      } else if (appState.mode === MODE_COLOR_BALANCE) {
        handleColorBalanceDown();
      } else if (appState.mode === MODE_NESTED_BALANCE) {
        handleNestedDown();
      }
    }

    function handleInputUp() {
      if (appState.mode === MODE_SIMPLE_BALANCE) {
        handleBalanceUp(appState.balance);
      } else if (appState.mode === MODE_COLOR_BALANCE) {
        handleColorBalanceUp();
      } else if (appState.mode === MODE_NESTED_BALANCE) {
        handleNestedUp();
      }
    }

    // PATTERN GAME
    function startPattern() {
      appState.mode = MODE_PATTERN;
      appState.pattern.sequence = ['A', 'B', 'A', 'B', 'A', 'B'];
      appState.pattern.userAnswer = [];
      appState.pattern.numBlanks = 2;
      setLevelIndicator("CLICK BLANKS TO FILL");
    }

    function handlePatternClick() {
      const m = appState.mouse;
      const cellSize = 60;
      const startX = 100;
      const seqY = 225;

      for (let i = 0; i < appState.pattern.numBlanks; i++) {
        const cellIdx = appState.pattern.sequence.length + i;
        const cx = startX + cellIdx * cellSize;
        if (Math.abs(m.x - cx) < cellSize/2 && Math.abs(m.y - seqY) < cellSize/2) {
          if (!appState.pattern.userAnswer[i]) {
            appState.pattern.userAnswer[i] = 'A';
          } else if (appState.pattern.userAnswer[i] === 'A') {
            appState.pattern.userAnswer[i] = 'B';
          } else {
            appState.pattern.userAnswer[i] = '';
          }
          checkPattern();
          return;
        }
      }
    }

    function checkPattern() {
      if (appState.pattern.userAnswer.filter(a => a).length < appState.pattern.numBlanks) {
        return;
      }
      const seqLen = appState.pattern.sequence.length;
      const expected = ['A', 'B']; // AB pattern continues
      const correct = appState.pattern.userAnswer.every((ans, i) =>
        ans === appState.pattern.sequence[(seqLen + i) % 2]
      );
      if (correct) {
        setLevelIndicator("✓ CORRECT");
      }
    }

    // SIMPLE BALANCE
    function startSimpleBalance() {
      appState.mode = MODE_SIMPLE_BALANCE;
      appState.balance.blocks = [
        {x: 100, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false},
        {x: 180, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false}
      ];
      appState.balance.ang = 0;
      appState.balance.winT = 0;
      setLevelIndicator("BALANCE THE LEVER");
    }

    function handleBalanceDown(bal: any) {
      const m = appState.mouse;
      for (let i = bal.blocks.length - 1; i >= 0; i--) {
        const b = bal.blocks[i];
        if (b.slot === null && Math.abs(m.x - b.x) < 20 && Math.abs(m.y - b.y) < 20) {
          bal.drag = b;
          return;
        }
      }
    }

    function handleBalanceUp(bal: any) {
      if (!bal.drag) return;
      const b = bal.drag;
      const FULCRUM_X = 300, FULCRUM_Y = 250, CELL = 40;

      if (appState.mouse.y < 300) {
        let bestS = 0, minD = Infinity;
        for (let s = -5; s <= 5; s++) {
          if (s === 0) continue;
          const px = FULCRUM_X + s*CELL;
          const py = FULCRUM_Y - 25;
          const d = Math.hypot(px - appState.mouse.x, py - appState.mouse.y);
          if (d < minD) { minD = d; bestS = s; }
        }
        b.slot = bestS;
      } else {
        b.slot = null;
        b.x = appState.mouse.x;
        b.y = 400;
      }
      bal.drag = null;
      checkBalance(bal);
    }

    function checkBalance(bal: any) {
      let L = 0, R = 0, hand = false;
      bal.blocks.forEach((b: Block) => {
        if (b.slot === null) { hand = true; return; }
        const t = Math.abs(b.slot) * b.w;
        b.slot < 0 ? L += t : R += t;
      });

      if (hand) {
        bal.tgtAng = L > R ? -20 : (R > L ? 20 : 0);
      } else {
        bal.tgtAng = L === R ? 0 : (L > R ? -20 : 20);
      }

      if (!hand && L === R) {
        bal.winT++;
        if (bal.winT > 30) setLevelIndicator("✓ BALANCED");
      } else {
        bal.winT = 0;
      }
    }

    // COLOR BALANCE
    function startColorBalance() {
      appState.mode = MODE_COLOR_BALANCE;
      appState.colorBalance.blocks = [
        {x: 100, y: 400, slot: null, w: 2, c: C_ALERT, fixed: false},
        {x: 180, y: 400, slot: null, w: 1, c: C_MASTERY, fixed: false},
        {x: 260, y: 400, slot: null, w: 1, c: C_MASTERY, fixed: false}
      ];
      appState.colorBalance.ang = 0;
      appState.colorBalance.winT = 0;
      setLevelIndicator("RED = 2x BLUE");
    }

    function handleColorBalanceDown() {
      handleBalanceDown(appState.colorBalance);
    }

    function handleColorBalanceUp() {
      handleBalanceUp(appState.colorBalance);
    }

    // NESTED BALANCE
    function startNestedBalance() {
      appState.mode = MODE_NESTED_BALANCE;
      appState.nestedBalance.blocks = [
        {x: 100, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false},
        {x: 180, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false},
        {x: 260, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false},
        {x: 340, y: 400, slot: null, w: 1, c: C_SIGNAL, fixed: false}
      ];
      appState.nestedBalance.mainLever = { ang: 0, tgtAng: 0 };
      appState.nestedBalance.leftMini = { ang: 0, tgtAng: 0, pos: -4 };
      appState.nestedBalance.rightMini = { ang: 0, tgtAng: 0, pos: 4 };
      appState.nestedBalance.winT = 0;
      setLevelIndicator("BALANCE ALL LEVERS");
    }

    function handleNestedDown() {
      const m = appState.mouse;
      const blocks = appState.nestedBalance.blocks;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (b.slot === null && Math.abs(m.x - b.x) < 20 && Math.abs(m.y - b.y) < 20) {
          appState.nestedBalance.drag = b;
          return;
        }
      }
    }

    function handleNestedUp() {
      const drag = appState.nestedBalance.drag;
      if (!drag) return;

      const m = appState.mouse;
      const CELL = 30;
      const mainY = 250;
      const leftMiniY = 150;
      const rightMiniY = 150;
      const leftMiniX = 300 + appState.nestedBalance.leftMini.pos * 40;
      const rightMiniX = 300 + appState.nestedBalance.rightMini.pos * 40;

      let placed = false;

      // Try left mini lever
      if (Math.abs(m.y - leftMiniY) < 40) {
        for (let s = -3; s <= 3; s++) {
          if (s === 0) continue;
          const px = leftMiniX + s*CELL;
          if (Math.abs(m.x - px) < 30) {
            drag.slot = 1000 + s; // Encode: 1000 = left mini
            placed = true;
            break;
          }
        }
      }

      // Try right mini lever
      if (!placed && Math.abs(m.y - rightMiniY) < 40) {
        for (let s = -3; s <= 3; s++) {
          if (s === 0) continue;
          const px = rightMiniX + s*CELL;
          if (Math.abs(m.x - px) < 30) {
            drag.slot = 2000 + s; // Encode: 2000 = right mini
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        drag.slot = null;
        drag.x = m.x;
        drag.y = 400;
      }

      appState.nestedBalance.drag = null;
      checkNestedBalance();
    }

    function checkNestedBalance() {
      const blocks = appState.nestedBalance.blocks;

      // Calculate mini lever balances
      let leftL = 0, leftR = 0;
      let rightL = 0, rightR = 0;

      blocks.forEach(b => {
        if (b.slot === null) return;
        if (b.slot >= 1000 && b.slot < 2000) {
          const s = b.slot - 1000;
          const t = Math.abs(s);
          s < 0 ? leftL += t : leftR += t;
        } else if (b.slot >= 2000) {
          const s = b.slot - 2000;
          const t = Math.abs(s);
          s < 0 ? rightL += t : rightR += t;
        }
      });

      // Update mini lever angles
      appState.nestedBalance.leftMini.tgtAng = leftL === leftR ? 0 : (leftL > leftR ? -15 : 15);
      appState.nestedBalance.rightMini.tgtAng = rightL === rightR ? 0 : (rightL > rightR ? -15 : 15);

      // Calculate main lever torque
      const leftTotal = leftL + leftR;
      const rightTotal = rightL + rightR;
      const mainL = leftTotal * Math.abs(appState.nestedBalance.leftMini.pos);
      const mainR = rightTotal * Math.abs(appState.nestedBalance.rightMini.pos);

      appState.nestedBalance.mainLever.tgtAng = mainL === mainR ? 0 : (mainL > mainR ? -15 : 15);

      // Smooth angle updates
      appState.nestedBalance.leftMini.ang += (appState.nestedBalance.leftMini.tgtAng - appState.nestedBalance.leftMini.ang) * 0.1;
      appState.nestedBalance.rightMini.ang += (appState.nestedBalance.rightMini.tgtAng - appState.nestedBalance.rightMini.ang) * 0.1;
      appState.nestedBalance.mainLever.ang += (appState.nestedBalance.mainLever.tgtAng - appState.nestedBalance.mainLever.ang) * 0.1;

      // Check win
      if (leftL === leftR && rightL === rightR && mainL === mainR && leftTotal > 0 && rightTotal > 0) {
        appState.nestedBalance.winT++;
        if (appState.nestedBalance.winT > 30) {
          setLevelIndicator("✓ ALL BALANCED");
        }
      } else {
        appState.nestedBalance.winT = 0;
      }
    }

    // DRAW FUNCTIONS
    function drawGrid() {
      ctx.strokeStyle = C_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 600; i += 40) {
        ctx.moveTo(i, 0); ctx.lineTo(i, 450);
      }
      for (let i = 0; i < 450; i += 40) {
        ctx.moveTo(0, i); ctx.lineTo(600, i);
      }
      ctx.stroke();
    }

    function drawHub() {
      appState.debugSteps.forEach((step, i) => {
        ctx.strokeStyle = C_SIGNAL;
        ctx.fillStyle = C_SIGNAL;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(step.x, step.y, step.r, 0, Math.PI*2);
        ctx.stroke();

        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(step.label, step.x, step.y);
      });
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

      drawBackButton();
    }

    function drawBlock(x: number, y: number, w: number, c: string) {
      let h = w*30, wid = 25;
      ctx.shadowBlur = 10;
      ctx.shadowColor = c;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.strokeRect(x-wid/2, y-h/2, wid, h);
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x-wid/2, y-h/2, wid, h);
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    }

    function drawBalance(bal: any) {
      bal.ang += (bal.tgtAng - bal.ang) * 0.1;

      const FULCRUM_X = 300, FULCRUM_Y = 250, CELL = 40;

      // Update dragging
      if (bal.drag) {
        bal.drag.x = appState.mouse.x;
        bal.drag.y = appState.mouse.y;
      }

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
      ctx.rotate(bal.ang * Math.PI/180);

      ctx.fillStyle = Math.abs(bal.tgtAng) < 1 ? C_SIGNAL : C_DIM;
      ctx.fillRect(-210, -5, 420, 10);

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
      bal.blocks.forEach((b: Block) => {
        if (b.slot !== null && b !== bal.drag) {
          drawBlock(b.slot*CELL, -20, b.w, b.c);
        }
      });
      ctx.restore();

      // Blocks off lever
      bal.blocks.forEach((b: Block) => {
        if (b.slot === null || b === bal.drag) {
          drawBlock(b.x, b.y, b.w, b.c);
        }
      });

      drawBackButton();
    }

    function drawNestedBalance() {
      const nest = appState.nestedBalance;
      const CELL = 30;
      const mainY = 250;
      const miniY = 150;

      // Update angles
      nest.leftMini.ang += (nest.leftMini.tgtAng - nest.leftMini.ang) * 0.1;
      nest.rightMini.ang += (nest.rightMini.tgtAng - nest.rightMini.ang) * 0.1;
      nest.mainLever.ang += (nest.mainLever.tgtAng - nest.mainLever.ang) * 0.1;

      // Update drag
      if (nest.drag) {
        nest.drag.x = appState.mouse.x;
        nest.drag.y = appState.mouse.y;
      }

      // Draw main lever
      ctx.save();
      ctx.translate(300, mainY);
      ctx.rotate(nest.mainLever.ang * Math.PI/180);
      ctx.fillStyle = Math.abs(nest.mainLever.tgtAng) < 1 ? C_SIGNAL : C_DIM;
      ctx.fillRect(-240, -5, 480, 10);
      ctx.restore();

      // Draw mini levers
      const leftMiniX = 300 + nest.leftMini.pos * 40;
      const rightMiniX = 300 + nest.rightMini.pos * 40;

      // Left mini
      ctx.save();
      ctx.translate(leftMiniX, miniY);
      ctx.rotate(nest.leftMini.ang * Math.PI/180);
      ctx.fillStyle = Math.abs(nest.leftMini.tgtAng) < 1 ? C_SIGNAL : C_DIM;
      ctx.fillRect(-120, -3, 240, 6);

      // Slots on left mini
      ctx.fillStyle = C_BG;
      for (let s = -3; s <= 3; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      // Blocks on left mini
      nest.blocks.forEach((b: Block) => {
        if (b.slot !== null && b.slot >= 1000 && b.slot < 2000 && b !== nest.drag) {
          const s = b.slot - 1000;
          drawBlock(s*CELL, -15, b.w, b.c);
        }
      });
      ctx.restore();

      // Right mini
      ctx.save();
      ctx.translate(rightMiniX, miniY);
      ctx.rotate(nest.rightMini.ang * Math.PI/180);
      ctx.fillStyle = Math.abs(nest.rightMini.tgtAng) < 1 ? C_SIGNAL : C_DIM;
      ctx.fillRect(-120, -3, 240, 6);

      // Slots on right mini
      ctx.fillStyle = C_BG;
      for (let s = -3; s <= 3; s++) {
        if (s !== 0) {
          ctx.beginPath();
          ctx.arc(s*CELL, 0, 2, 0, 6.28);
          ctx.fill();
        }
      }

      // Blocks on right mini
      nest.blocks.forEach((b: Block) => {
        if (b.slot !== null && b.slot >= 2000 && b !== nest.drag) {
          const s = b.slot - 2000;
          drawBlock(s*CELL, -15, b.w, b.c);
        }
      });
      ctx.restore();

      // Fulcrums
      ctx.fillStyle = C_DIM;
      ctx.beginPath();
      ctx.moveTo(300, mainY);
      ctx.lineTo(290, mainY + 20);
      ctx.lineTo(310, mainY + 20);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(leftMiniX, miniY);
      ctx.lineTo(leftMiniX - 8, miniY + 15);
      ctx.lineTo(leftMiniX + 8, miniY + 15);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rightMiniX, miniY);
      ctx.lineTo(rightMiniX - 8, miniY + 15);
      ctx.lineTo(rightMiniX + 8, miniY + 15);
      ctx.fill();

      // Blocks off levers
      nest.blocks.forEach((b: Block) => {
        if (b.slot === null || b === nest.drag) {
          drawBlock(b.x, b.y, b.w, b.c);
        }
      });

      drawBackButton();
    }

    // Main draw loop
    function draw() {
      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, 600, 450);
      drawGrid();

      if (appState.mode === MODE_HUB) {
        drawHub();
      } else if (appState.mode === MODE_PATTERN) {
        drawPattern();
      } else if (appState.mode === MODE_SIMPLE_BALANCE) {
        drawBalance(appState.balance);
      } else if (appState.mode === MODE_COLOR_BALANCE) {
        drawBalance(appState.colorBalance);
      } else if (appState.mode === MODE_NESTED_BALANCE) {
        drawNestedBalance();
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
