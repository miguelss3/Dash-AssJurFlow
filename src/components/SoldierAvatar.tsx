import { cn } from "@/lib/utils";

interface SoldierAvatarProps {
  size?: number;
  className?: string;
  /** Cor do capacete (padrão: lime do tema) */
  helmetClassName?: string;
  /** Cor do rosto */
  faceClassName?: string;
}

/**
 * Ícone vetorial de um soldado com capacete militar.
 * Usado como avatar do usuário em substituição ao círculo com inicial.
 * Cores via Tailwind (currentColor / classes utilitárias) para integrar ao tema.
 */
export function SoldierAvatar({
  size = 40,
  className,
  helmetClassName = "fill-[oklch(0.88_0.18_130)]",
  faceClassName = "fill-[oklch(0.78_0.08_60)]",
}: SoldierAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Avatar de soldado"
    >
      {/* Fundo circular sutil */}
      <circle cx="32" cy="32" r="32" className="fill-[oklch(0.22_0.05_258)]" />

      {/* Pescoço */}
      <rect x="26" y="40" width="12" height="8" rx="2" className={faceClassName} />

      {/* Rosto */}
      <ellipse cx="32" cy="34" rx="10" ry="11" className={faceClassName} />

      {/* Sombra do capacete sobre o rosto */}
      <path
        d="M22 28 Q32 32 42 28 L42 32 Q32 35 22 32 Z"
        className="fill-black/15"
      />

      {/* Capacete - calota principal */}
      <path
        d="M18 30 Q18 16 32 14 Q46 16 46 30 L46 31 Q32 34 18 31 Z"
        className={helmetClassName}
      />

      {/* Aba lateral do capacete */}
      <path
        d="M16 28 Q16 32 18 33 L46 33 Q48 32 48 28 Q48 30 46 31 L18 31 Q16 30 16 28 Z"
        className={helmetClassName}
      />

      {/* Faixa central (estrela / divisa) */}
      <rect
        x="30"
        y="14"
        width="4"
        height="18"
        className="fill-[oklch(0.22_0.05_258)]/40"
      />

      {/* Estrela militar */}
      <polygon
        points="32,18 33.2,21 36.4,21 33.8,23 34.8,26 32,24.2 29.2,26 30.2,23 27.6,21 30.8,21"
        className="fill-[oklch(0.22_0.05_258)]"
      />

      {/* Olhos */}
      <circle cx="28.5" cy="35" r="1.1" className="fill-[oklch(0.22_0.05_258)]" />
      <circle cx="35.5" cy="35" r="1.1" className="fill-[oklch(0.22_0.05_258)]" />

      {/* Boca */}
      <path
        d="M29.5 39 Q32 40.5 34.5 39"
        stroke="oklch(0.22 0.05 258)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Queixo / sombra */}
      <path
        d="M24 38 Q32 46 40 38"
        stroke="oklch(0.22 0.05 258 / 0.25)"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}
