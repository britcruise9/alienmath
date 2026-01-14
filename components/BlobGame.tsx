"use client";

import { useEffect, useRef, useState } from 'react';

// Constants
const C_BG = "#050a05";
const C_GRID = "#0f2f0f";
const C_SIGNAL = "#33ff00";
const C_ALERT = "#ff3300";
const C_COMPOSITE = "#33ff00";
const C_PRIME = "#00ffff";

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

export default function BlobGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState("Split the blob to feed the mouths");

  const gameStateRef = useRef({
    blobs: [] as Blob[],
    draggedBlob: null as Blob | null,
    dragStartX: 0,
    dragStartY: 0,
    mouse: { x: 0, y: 0, down: false },
    mouths: [
      { x: 100, y: 380, fed: false },
      { x: 300, y: 380, fed: false },
      { x: 500, y: 380, fed: false }
    ],
    nextId: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const state = gameStateRef.current;

    // Initialize first blob
    if (state.blobs.length === 0) {
      state.blobs.push(createBlob(300, 150, 6));
    }

    // Input handling
    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (cx - r.left) * (canvas.width / r.width),
        y: (cy - r.top) * (canvas.height / r.height)
      };
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      if ('preventDefault' in e) e.preventDefault();
      state.mouse = { ...getPos(e), down: true };

      // Check if clicking on a blob
      for (let i = state.blobs.length - 1; i >= 0; i--) {
        const blob = state.blobs[i];
        const dx = state.mouse.x - blob.x;
        const dy = state.mouse.y - blob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < blob.radius) {
          state.draggedBlob = blob;
          state.dragStartX = blob.x;
          state.dragStartY = blob.y;
          blob.isDragging = true;
          break;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if ('preventDefault' in e && 'touches' in e) e.preventDefault();
      state.mouse = { ...state.mouse, ...getPos(e) };

      if (state.draggedBlob) {
        state.draggedBlob.x = state.mouse.x;
        state.draggedBlob.y = state.mouse.y;
      }
    };

    const handleMouseUp = () => {
      if (state.draggedBlob) {
        const blob = state.draggedBlob;
        const dx = blob.x - state.dragStartX;
        const dy = blob.y - state.dragStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If dragged far enough, try to split
        if (distance > 50 && blob.value > 1) {
          trySplit(blob);
        }

        blob.isDragging = false;
        state.draggedBlob = null;
      }
      state.mouse.down = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);

    function createBlob(x: number, y: number, value: number): Blob {
      const isPrime = checkPrime(value);
      return {
        id: state.nextId++,
        x,
        y,
        vx: 0,
        vy: 0,
        value,
        radius: 20 + value * 3,
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

    function trySplit(blob: Blob) {
      // For now, just split composites in half
      if (blob.isPrime) {
        // Shake and refuse
        setMessage("⚠ CANNOT SPLIT - PRIME RESISTANCE");
        blob.vx = (Math.random() - 0.5) * 10;
        blob.vy = (Math.random() - 0.5) * 10;
        return;
      }

      if (blob.value >= 2) {
        const half = Math.floor(blob.value / 2);
        const remainder = blob.value - half;

        // Remove original
        state.blobs = state.blobs.filter(b => b.id !== blob.id);

        // Create two new blobs
        const blob1 = createBlob(blob.x - 30, blob.y, half);
        const blob2 = createBlob(blob.x + 30, blob.y, remainder);

        // Give them some velocity
        blob1.vx = -3;
        blob2.vx = 3;

        state.blobs.push(blob1, blob2);
        setMessage(`Split ${blob.value} → ${half} + ${remainder}`);
      }
    }

    function updatePhysics() {
      state.blobs.forEach(blob => {
        if (!blob.isDragging) {
          // Apply velocity
          blob.x += blob.vx;
          blob.y += blob.vy;

          // Damping
          blob.vx *= 0.95;
          blob.vy *= 0.95;

          // Gravity (slight)
          blob.vy += 0.2;

          // Bounce off walls
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
        }
      });

      // Blob-blob repulsion
      for (let i = 0; i < state.blobs.length; i++) {
        for (let j = i + 1; j < state.blobs.length; j++) {
          const b1 = state.blobs[i];
          const b2 = state.blobs[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist && dist > 0) {
            const force = (minDist - dist) * 0.5;
            const angle = Math.atan2(dy, dx);

            if (!b1.isDragging) {
              b1.vx -= Math.cos(angle) * force * 0.1;
              b1.vy -= Math.sin(angle) * force * 0.1;
            }
            if (!b2.isDragging) {
              b2.vx += Math.cos(angle) * force * 0.1;
              b2.vy += Math.sin(angle) * force * 0.1;
            }
          }
        }
      }
    }

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

    function drawMouths() {
      state.mouths.forEach(mouth => {
        ctx.strokeStyle = mouth.fed ? C_SIGNAL : C_ALERT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(mouth.x, mouth.y, 25, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      });
    }

    function drawBlobs() {
      state.blobs.forEach(blob => {
        const color = blob.isPrime ? C_PRIME : C_COMPOSITE;

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;

        // Main circle
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Fill
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Value (number)
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.font = "20px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(blob.value.toString(), blob.x, blob.y);

        // Prime indicator (crystalline look)
        if (blob.isPrime) {
          ctx.strokeStyle = C_PRIME;
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
    }

    function draw() {
      updatePhysics();

      ctx.fillStyle = C_BG;
      ctx.fillRect(0, 0, 600, 450);
      drawGrid();
      drawMouths();
      drawBlobs();

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
        className="text-center mb-5 text-lg tracking-[3px] font-bold opacity-90 h-[30px]"
        style={{ textShadow: '0 0 10px var(--phosphor-primary)' }}
      >
        {message}
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

      <div className="mt-4 text-sm text-green-500 opacity-70">
        DRAG BLOB TO SPLIT • FEED THE MOUTHS
      </div>
    </div>
  );
}
