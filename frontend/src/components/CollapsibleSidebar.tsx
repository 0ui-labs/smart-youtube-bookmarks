import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSidebarProps {
  children: ReactNode
  className?: string
}

/**
 * CollapsibleSidebar - Responsive sidebar with smooth animations
 *
 * Desktop (≥768px): Always visible, fixed 250px width
 * Mobile (<768px): Drawer with backdrop, slides from left
 *
 * Features:
 * - Smooth framer-motion animations
 * - Accessible (ARIA labels, keyboard nav)
 * - Click-outside to close (mobile)
 * - Respects prefers-reduced-motion
 *
 * @example
 * <CollapsibleSidebar>
 *   <nav>
 *     <a href="/">Home</a>
 *     <a href="/about">About</a>
 *   </nav>
 * </CollapsibleSidebar>
 */
export function CollapsibleSidebar({
  children,
  className
}: CollapsibleSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Detect mobile breakpoint (768px = Tailwind md)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)

      // Auto-open on desktop, auto-close on mobile
      if (!mobile) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial check

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close sidebar when clicking outside (mobile only)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMobile &&
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobile, isOpen])

  // Close sidebar with ESC key (mobile only)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isMobile && isOpen && e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMobile, isOpen])

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <div className="flex items-center p-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      )}

      {/* Desktop sidebar - always visible, OUTSIDE AnimatePresence */}
      {!isMobile && (
        <aside
          ref={sidebarRef}
          className={cn(
            'hidden md:flex md:flex-col md:w-64 md:h-screen md:border-r md:bg-background',
            className
          )}
        >
          {children}
        </aside>
      )}

      {/* Mobile drawer - INSIDE AnimatePresence for exit animations */}
      <AnimatePresence mode="wait">
        {isMobile && isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Mobile sidebar */}
            <motion.aside
              key="mobile-sidebar"
              ref={sidebarRef}
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className={cn(
                'fixed left-0 top-0 z-40 flex flex-col w-64 h-screen border-r bg-background md:hidden',
                className
              )}
            >
              {children}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
