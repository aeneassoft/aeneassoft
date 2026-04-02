"use client";

interface ScoreRingProps {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  size?: number;
}

export function ScoreRing({ score, level, size = 120 }: ScoreRingProps) {
  const safeScore = Number(score) || 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;

  const color =
    level === "HIGH"
      ? "#F0A500"
      : level === "MEDIUM"
      ? "#00B4FF"
      : "#EF4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{safeScore}</span>
          <span className="text-xs text-slate-gray">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color }}>
          {level}
        </p>
        <p className="text-xs text-slate-gray">EU AI Act Readiness</p>
      </div>
    </div>
  );
}
