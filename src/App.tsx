import { useEffect, useRef, useState } from 'react';
import { Game, type Hud } from './game';

export function App() {
  const mount = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [fail, setFail] = useState(false);
  const [scale, setScale] = useState(1);
  const [stamp, setStamp] = useState('DEC 21 1996  3:07:00 AM');

  // ── iOS: kill the loupe from JS too (SKILL §3c — CSS alone isn't enough) ──
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', stop);
    document.addEventListener('contextmenu', stop);
    return () => { document.removeEventListener('selectstart', stop); document.removeEventListener('contextmenu', stop); };
  }, []);

  // ── boot the Three.js engine into the mount div ──
  useEffect(() => {
    if (!mount.current) return;
    let g: Game;
    let last = 0, lastScale = -1;
    try {
      g = new Game(mount.current, (h: Hud) => {
        const now = performance.now();
        if (now - last > 90 && Math.abs(h.scale - lastScale) > 0.001) {
          last = now; lastScale = h.scale; setScale(h.scale);
        }
      });
      if (!g.ok) { setFail(true); return; }
    } catch { setFail(true); return; }
    game.current = g;
    if (stick.current) g.bindStick(stick.current);
    return () => g.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ticking found-footage clock ──
  useEffect(() => {
    let secs = 7 * 60;
    const id = setInterval(() => {
      secs++;
      const hh = 3 + (Math.floor(secs / 3600) % 12), mm = Math.floor(secs / 60) % 60, ss = secs % 60;
      setStamp(`DEC 21 1996  ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} AM`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const enter = () => { setStarted(true); game.current?.begin(); };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (!started && (e.key === ' ' || e.key === 'Enter')) enter(); };
    addEventListener('keydown', kd);
    return () => removeEventListener('keydown', kd);
  }, [started]);

  if (fail) {
    return (
      <div className="fail"><div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>NO SIGNAL</h1>
        WARPZONE needs WebGL. Try Chrome, Safari 15+, or Firefox.
      </div></div>
    );
  }

  return (
    <>
      <div ref={mount} className="mount" />
      <div className="vig" />
      <div className="vhs">
        <div className="hud">
          <div className="top">
            <div className="rec"><span className="dot" /> REC</div>
            <div className="sp">SP</div>
          </div>
          <div />
          <div className="bot">
            <div className="scale-tag">SCALE {scale.toFixed(2)}×</div>
            <div className="stamp">{stamp}</div>
          </div>
        </div>
      </div>

      <div ref={stick} className="stick"><div className="nub" /></div>

      {!started && (
        <div className="veil" onPointerDown={enter}>
          <h1>WARPZONE</h1>
          <p>A sealed loop of Backrooms hallways that don't add up. Walk through a
            doorway and you <b>shrink</b> — so the stone pelican grows. It never
            ends. You only get smaller.</p>
          <p style={{ opacity: 0.6, fontSize: 12 }}>
            desktop: mouse to look · WASD to walk &nbsp;·&nbsp; mobile: left stick + drag to look
          </p>
          <div className="go">▸ enter the footage</div>
        </div>
      )}
    </>
  );
}
