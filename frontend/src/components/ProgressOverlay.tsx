/**
 * ProgressOverlay Component
 *
 * Displays a circular progress indicator overlay on video cards
 * during the import/enrichment process.
 *
 * Features:
 * - SVG circular progress indicator
 * - Stage label (metadata, captions, chapters)
 * - Percentage display
 * - Semi-transparent backdrop
 * - WCAG 2.1 accessible (progressbar role, ARIA attributes)
 * - Respects reduced motion preferences
 */

interface ProgressOverlayProps {
  progress: number;
  stage: string;
}

const stageLabels: Record<string, string> = {
  created: 'Erstellt',
  metadata: 'Metadata',
  captions: 'Untertitel',
  chapters: 'Kapitel',
  complete: 'Fertig',
  error: 'Fehler',
};

export function ProgressOverlay({ progress, stage }: ProgressOverlayProps) {
  // Clamp progress to 0-100 range
  const clampedProgress = Math.max(0, Math.min(100, progress || 0));

  // SVG circular progress calculations
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const stageLabel = stageLabels[stage] || stage;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-t-lg"
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Import progress: ${clampedProgress}%, ${stageLabel}`}
    >
      {/* SVG Circular Progress */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="motion-safe:transition-all motion-safe:duration-300 motion-reduce:transition-none"
        />
      </svg>

      {/* Progress Percentage */}
      <span className="text-white font-bold text-sm mt-2">
        {clampedProgress}%
      </span>

      {/* Stage Label */}
      <span className="text-white/80 text-xs mt-1">
        {stageLabel}
      </span>

      {/* Screen reader announcement */}
      <span className="sr-only">
        Import: {clampedProgress}% - {stageLabel}
      </span>
    </div>
  );
}
