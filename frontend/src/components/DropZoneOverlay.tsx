import { Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface DropZoneOverlayProps {
  /** Whether the drop is valid (affects border color) */
  isValid?: boolean
  /** Custom message to display */
  message?: string
  /** Additional className */
  className?: string
}

/**
 * Overlay shown when dragging files/URLs over a drop zone
 */
export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  isValid = true,
  message = 'Videos hier ablegen',
  className,
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'absolute inset-0 z-50 flex items-center justify-center bg-primary/5 backdrop-blur-sm',
          className
        )}
        role="region"
        aria-label="Drop zone for video import"
      >
        <div
          data-testid="drop-zone-overlay"
          className={cn(
            'border-2 border-dashed rounded-lg p-12 bg-background/80',
            isValid ? 'border-primary' : 'border-destructive'
          )}
        >
          <Download
            data-testid="drop-zone-icon"
            className={cn(
              'w-12 h-12 mx-auto mb-4',
              isValid ? 'text-primary' : 'text-destructive'
            )}
          />
          <p className="text-lg font-medium text-center">{message}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
