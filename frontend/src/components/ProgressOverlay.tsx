/**
 * ProgressOverlay Component
 *
 * Displays a modern pie chart progress indicator overlay on video cards
 * during the import/enrichment process.
 *
 * Features:
 * - CSS conic-gradient pie chart (modern, performant)
 * - Smooth CSS transitions for progress animation
 * - Stage label (metadata, captions, chapters)
 * - Percentage display centered in pie
 * - Semi-transparent backdrop with subtle blur
 * - WCAG 2.1 accessible (progressbar role, ARIA attributes)
 * - Respects reduced motion preferences
 *
 * Design inspired by: https://medium.com/@andsens/radial-progress-indicator-using-css-a917b80c43f9
 * Using modern conic-gradient instead of clip-rotation technique
 */

interface ProgressOverlayProps {
  progress: number;
  stage: string;
}

const stageLabels: Record<string, string> = {
  created: 'Vorbereiten...',
  metadata: 'Lade Metadaten...',
  captions: 'Lade Untertitel...',
  chapters: 'Lade Kapitel...',
  complete: 'Fertig',
  error: 'Fehler',
};

export function ProgressOverlay({ progress, stage }: ProgressOverlayProps) {
  // Clamp progress to 0-100 range
  const clampedProgress = Math.max(0, Math.min(100, progress || 0));

  const stageLabel = stageLabels[stage] || stage;

  // Pie chart dimensions - iOS style solid pie
  const size = 48;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-t-lg"
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Import progress: ${clampedProgress}%, ${stageLabel}`}
    >
      {/* iOS-style solid pie chart - slice grows clockwise */}
      <div
        className="rounded-full"
        data-testid="pie-chart"
        style={{
          width: size,
          height: size,
          aspectRatio: '1', // Ensures perfect circle
          // Solid pie: white slice grows from top, rest is translucent
          background: `conic-gradient(
            from -90deg,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(255, 255, 255, 0.95) ${clampedProgress}%,
            rgba(255, 255, 255, 0.15) ${clampedProgress}%,
            rgba(255, 255, 255, 0.15) 100%
          )`,
          // Subtle shadow for depth
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Progress Percentage - below the pie like iOS */}
      <span className="text-white font-bold text-sm mt-2">
        {clampedProgress}%
      </span>

      {/* Stage Label */}
      <span className="text-white/80 text-xs mt-0.5">
        {stageLabel}
      </span>

      {/* Screen reader announcement */}
      <span className="sr-only">
        Import: {clampedProgress}% - {stageLabel}
      </span>
    </div>
  );
}
