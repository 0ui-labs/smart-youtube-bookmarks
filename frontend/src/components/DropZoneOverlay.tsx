import { AnimatePresence, motion } from "framer-motion";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropZoneOverlayProps {
  /** Whether the drop is valid (affects border color) */
  isValid?: boolean;
  /** Custom message to display */
  message?: string;
  /** Additional className */
  className?: string;
}

/**
 * Overlay shown when dragging files/URLs over a drop zone
 */
export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  isValid = true,
  message = "Videos hier ablegen",
  className,
}) => (
  <AnimatePresence>
    <motion.div
      animate={{ opacity: 1 }}
      aria-label="Drop zone for video import"
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-primary/5 backdrop-blur-sm",
        className
      )}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      role="region"
      transition={{ duration: 0.15 }}
    >
      <div
        className={cn(
          "rounded-lg border-2 border-dashed bg-background/80 p-12",
          isValid ? "border-primary" : "border-destructive"
        )}
        data-testid="drop-zone-overlay"
      >
        <Download
          className={cn(
            "mx-auto mb-4 h-12 w-12",
            isValid ? "text-primary" : "text-destructive"
          )}
          data-testid="drop-zone-icon"
        />
        <p className="text-center font-medium text-lg">{message}</p>
      </div>
    </motion.div>
  </AnimatePresence>
);
