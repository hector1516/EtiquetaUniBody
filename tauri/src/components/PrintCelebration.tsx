import { useEffect, useState } from 'react';

export default function PrintCelebration({ event, onClose }: { event: any; onClose: () => void }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onClose(); }, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!show) return null;

  const ok = event?.status === 'OK';
  const color = ok ? '#10b981' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Flash */}
      <div className="absolute inset-0 animate-flash" style={{ background: `radial-gradient(circle at center, ${color}33 0%, transparent 70%)` }} />

      {/* Expanding rings */}
      {[0, 1, 2].map(i => (
        <div key={i} className="absolute rounded-full border-2 animate-ring"
          style={{
            borderColor: color,
            width: 120, height: 120,
            animationDelay: `${i * 0.15}s`,
            boxShadow: `0 0 30px ${color}66`,
          }} />
      ))}

      {/* Particles */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = 180 + Math.random() * 120;
        return (
          <div key={i} className="absolute w-2 h-2 rounded-full animate-particle"
            style={{
              background: color,
              boxShadow: `0 0 8px ${color}`,
              '--dx': `${Math.cos(angle) * dist}px`,
              '--dy': `${Math.sin(angle) * dist}px`,
              animationDelay: `${Math.random() * 0.2}s`,
            } as any} />
        );
      })}

      {/* Center card */}
      <div className="relative z-10 flex flex-col items-center gap-3 animate-pop">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl font-bold"
          style={{ background: `${color}22`, border: `3px solid ${color}`, color, boxShadow: `0 0 40px ${color}88` }}>
          {ok ? '✓' : '✕'}
        </div>
        <div className="text-2xl font-bold text-white drop-shadow-lg">
          {ok ? 'Etiqueta impresa' : 'Error de impresión'}
        </div>
        <div className="text-sm text-zinc-300 font-mono">
          {event?.serial ?? '—'} · {event?.batch ?? '—'}
        </div>
      </div>

      <style>{`
        @keyframes flash {
          0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; }
        }
        .animate-flash { animation: flash 1.2s ease-out forwards; }
        @keyframes ring {
          0% { transform: scale(0.2); opacity: 1; }
          100% { transform: scale(4); opacity: 0; }
        }
        .animate-ring { animation: ring 1.2s ease-out forwards; position: absolute; top: 50%; left: 50%; margin-left: -60px; margin-top: -60px; }
        @keyframes particle {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        .animate-particle { animation: particle 1.1s ease-out forwards; position: absolute; top: 50%; left: 50%; margin-left: -4px; margin-top: -4px; }
        @keyframes pop {
          0% { transform: scale(0.6); opacity: 0; }
          40% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
    </div>
  );
}
