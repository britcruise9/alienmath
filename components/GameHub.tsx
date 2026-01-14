"use client";

import { useState } from 'react';
import GalacticGame from './GalacticGame';
import BlobGame from './BlobGame';

export default function GameHub() {
  const [activeGame, setActiveGame] = useState<'menu' | 'lever' | 'blob'>('menu');

  if (activeGame === 'lever') {
    return <GalacticGame />;
  }

  if (activeGame === 'blob') {
    return <BlobGame />;
  }

  // Menu screen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="relative p-8">
        <div
          className="border-2 border-[#1a6600] bg-[#050a05] p-12"
          style={{
            boxShadow: '0 0 10px #1a6600, inset 0 0 20px rgba(0,0,0,0.8)'
          }}
        >
          {/* CRT Overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
              backgroundSize: '100% 2px, 3px 100%'
            }}
          />

          {/* Title */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl font-bold mb-4 tracking-wider"
              style={{
                color: '#33ff00',
                textShadow: '0 0 20px #33ff00'
              }}
            >
              GALACTIC CAPTCHA
            </h1>
            <p
              className="text-sm tracking-[3px] opacity-70"
              style={{ color: '#33ff00' }}
            >
              PROTOCOL VERIFICATION SYSTEM
            </p>
          </div>

          {/* Menu Options */}
          <div className="flex flex-col gap-6 min-w-[400px]">
            <button
              onClick={() => setActiveGame('lever')}
              className="group relative border-2 border-[#33ff00] bg-transparent py-4 px-6 text-left transition-all hover:bg-[#33ff00] hover:bg-opacity-10"
              style={{
                boxShadow: '0 0 5px #33ff00'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-lg font-bold tracking-wider mb-1"
                    style={{ color: '#33ff00' }}
                  >
                    01. STRUCTURE
                  </div>
                  <div
                    className="text-xs opacity-60"
                    style={{ color: '#33ff00' }}
                  >
                    Equilibrium Protocol • Balance Test
                  </div>
                </div>
                <div
                  className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#33ff00' }}
                >
                  →
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveGame('blob')}
              className="group relative border-2 border-[#00ffff] bg-transparent py-4 px-6 text-left transition-all hover:bg-[#00ffff] hover:bg-opacity-10"
              style={{
                boxShadow: '0 0 5px #00ffff'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-lg font-bold tracking-wider mb-1"
                    style={{ color: '#00ffff' }}
                  >
                    02. QUANTITY
                  </div>
                  <div
                    className="text-xs opacity-60"
                    style={{ color: '#00ffff' }}
                  >
                    Prime Detection • Sharing Protocol
                  </div>
                </div>
                <div
                  className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#00ffff' }}
                >
                  →
                </div>
              </div>
            </button>

            {/* Locked options */}
            {['SPACE', 'CHANGE', 'UNCERTAINTY'].map((name, idx) => (
              <div
                key={name}
                className="relative border-2 border-[#1a4a1a] bg-transparent py-4 px-6 text-left opacity-40 cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="text-lg font-bold tracking-wider mb-1"
                      style={{ color: '#1a4a1a' }}
                    >
                      0{idx + 3}. {name}
                    </div>
                    <div
                      className="text-xs opacity-60"
                      style={{ color: '#1a4a1a' }}
                    >
                      OFFLINE
                    </div>
                  </div>
                  <div
                    className="text-2xl"
                    style={{ color: '#1a4a1a' }}
                  >
                    ✕
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="text-center mt-12 text-xs tracking-[2px] opacity-40"
            style={{ color: '#33ff00' }}
          >
            AWAITING INPUT
          </div>
        </div>
      </div>
    </div>
  );
}
