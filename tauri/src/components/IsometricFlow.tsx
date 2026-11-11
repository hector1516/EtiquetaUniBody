

// Isometric flow animation: PLC -> PC -> Printer, PC -> SQL Server
// Isometric projection: (x,y,z) -> screen
function iso(x: number, y: number, z: number) {
  return { x: (x - y) * 14, y: (x + y) * 7 - z * 14 };
}

function poly(points: { x: number; y: number }[]) {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

// Build an isometric box given origin (x,y,z) and size (w,d,h)
function box(x: number, y: number, z: number, w: number, d: number, h: number, fill: string, stroke = '#1f2937') {
  const top = [
    iso(x, y, z + h),
    iso(x + w, y, z + h),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  ];
  const left = [
    iso(x, y, z),
    iso(x, y, z + h),
    iso(x, y + d, z + h),
    iso(x, y + d, z),
  ];
  const right = [
    iso(x, y + d, z),
    iso(x, y + d, z + h),
    iso(x + w, y + d, z + h),
    iso(x + w, y + d, z),
  ];
  const front = [
    iso(x + w, y, z),
    iso(x + w, y, z + h),
    iso(x + w, y + d, z + h),
    iso(x + w, y + d, z),
  ];
  return (
    <g>
      <polygon points={poly(left)} fill={fill} stroke={stroke} strokeWidth={0.8} opacity={0.85} />
      <polygon points={poly(right)} fill={fill} stroke={stroke} strokeWidth={0.8} opacity={0.7} />
      <polygon points={poly(front)} fill={fill} stroke={stroke} strokeWidth={0.8} opacity={0.9} />
      <polygon points={poly(top)} fill={fill} stroke={stroke} strokeWidth={0.8} opacity={1} />
    </g>
  );
}

export default function IsometricFlow() {
  // positions
  const plc = { x: 2, y: 2, z: 0 };
  const pc = { x: 9, y: 2, z: 0 };
  const printer = { x: 16, y: 2, z: 0 };
  const sql = { x: 23, y: 2, z: 0 };

  const plcCenter = iso(plc.x + 1.5, plc.y + 1, plc.z + 2.2);
  const pcCenter = iso(pc.x + 1, pc.y + 1, pc.z + 4.2);
  const printerCenter = iso(printer.x + 1.5, printer.y + 1, printer.z + 2.2);
  const sqlCenter = iso(sql.x + 1, sql.y + 1, sql.z + 5.2);

  return (
    <div className="card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-zinc-200">Flujo de trabajo en vivo</h3>
        <span className="text-xs text-zinc-500">PLC → PC → Impresora / SQL Server</span>
      </div>
      <svg viewBox="-20 -120 420 260" className="w-full h-64" style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)', borderRadius: 12 }}>
        <defs>
          <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ground plane */}
        <polygon points={poly([iso(0,0,0), iso(28,0,0), iso(28,6,0), iso(0,6,0)])} fill="#0b1220" stroke="#1e293b" strokeWidth={0.5} opacity={0.6} />

        {/* PLC */}
        {box(plc.x, plc.y, plc.z, 3, 2, 2, '#064e3b')}
        {/* PLC led */}
        <circle cx={plcCenter.x} cy={plcCenter.y} r={3} fill="#10b981" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <text x={plcCenter.x} y={plcCenter.y + 16} textAnchor="middle" fontSize="9" fill="#6ee7b7" fontWeight="bold">PLC</text>

        {/* PC tower */}
        {box(pc.x, pc.y, pc.z, 2, 2, 4, '#1e3a8a')}
        {/* monitor */}
        {box(pc.x - 0.5, pc.y - 1.5, pc.z + 4, 3, 0.5, 2.2, '#0f172a')}
        <rect x={iso(pc.x - 0.5, pc.y - 1.5, pc.z + 4).x + 2} y={iso(pc.x - 0.5, pc.y - 1.5, pc.z + 4).y + 2} width={28} height={16} fill="#0ea5e9" opacity={0.8} rx={2}>
          <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite" />
        </rect>
        <text x={pcCenter.x} y={pcCenter.y + 16} textAnchor="middle" fontSize="9" fill="#93c5fd" fontWeight="bold">PC</text>

        {/* Printer */}
        {box(printer.x, printer.y, printer.z, 3, 2, 2, '#374151')}
        {/* paper output */}
        <rect x={iso(printer.x + 0.5, printer.y + 2, printer.z + 0.6).x} y={iso(printer.x + 0.5, printer.y + 2, printer.z + 0.6).y} width={24} height={6} fill="#f8fafc" opacity={0.9} rx={2} />
        <text x={printerCenter.x} y={printerCenter.y + 16} textAnchor="middle" fontSize="9" fill="#d1d5db" fontWeight="bold">Impresora</text>

        {/* SQL server rack */}
        {box(sql.x, sql.y, sql.z, 2, 2, 5, '#4c1d95')}
        {/* rack lights */}
        {[0,1,2,3].map(i => (
          <circle key={i} cx={sqlCenter.x + (i % 2 === 0 ? -4 : 4)} cy={sqlCenter.y - 8 + i * 4} r={1.5} fill="#a78bfa">
            <animate attributeName="opacity" values="1;0.2;1" dur={`${0.8 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <text x={sqlCenter.x} y={sqlCenter.y + 16} textAnchor="middle" fontSize="9" fill="#c4b5fd" fontWeight="bold">SQL Server</text>

        {/* Connection lines (data flow) */}
        {/* PLC -> PC */}
        <line x1={plcCenter.x} y1={plcCenter.y} x2={pcCenter.x} y2={pcCenter.y} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6}>
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
        </line>
        {/* PC -> Printer */}
        <line x1={pcCenter.x} y1={pcCenter.y} x2={printerCenter.x} y2={printerCenter.y} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6}>
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
        </line>
        {/* PC -> SQL */}
        <line x1={pcCenter.x} y1={pcCenter.y} x2={sqlCenter.x} y2={sqlCenter.y} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6}>
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1.2s" repeatCount="indefinite" />
        </line>

        {/* Moving data particles */}
        <circle r={2.5} fill="#10b981" filter="url(#glow)">
          <animateMotion dur="1.6s" repeatCount="indefinite" path={`M${plcCenter.x},${plcCenter.y} L${pcCenter.x},${pcCenter.y}`} />
        </circle>
        <circle r={2.5} fill="#3b82f6" filter="url(#glow)">
          <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.5s" path={`M${pcCenter.x},${pcCenter.y} L${printerCenter.x},${printerCenter.y}`} />
        </circle>
        <circle r={2.5} fill="#a78bfa" filter="url(#glow)">
          <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.3s" path={`M${pcCenter.x},${pcCenter.y} L${sqlCenter.x},${sqlCenter.y}`} />
        </circle>
      </svg>
    </div>
  );
}
