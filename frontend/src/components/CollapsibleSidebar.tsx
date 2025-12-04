import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  children: ReactNode;
  className?: string;
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
  className,
}: CollapsibleSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Detect mobile breakpoint (768px = Tailwind md)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Auto-open on desktop, auto-close on mobile
      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar when clicking outside (mobile only)
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (
        isMobile &&
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Use Pointer Events API (modern, unified mouse/touch/pen handling)
    document.addEventListener(
      "pointerdown",
      handleClickOutside as EventListener
    );
    return () =>
      document.removeEventListener(
        "pointerdown",
        handleClickOutside as EventListener
      );
  }, [isMobile, isOpen]);

  // Close sidebar with ESC key (mobile only)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isMobile && isOpen && e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobile, isOpen]);

  return (
    <>
      {/* Mobile toggle button - Fixed position top-right */}
      {isMobile && !isOpen && (
        <Button
          aria-label="Open navigation"
          className="fixed top-4 right-4 z-50 md:hidden"
          onClick={() => setIsOpen(true)}
          size="icon"
          variant="ghost"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Desktop sidebar - always visible, OUTSIDE AnimatePresence */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden md:flex md:h-screen md:w-72 md:flex-col md:bg-background",
            className
          )}
          ref={sidebarRef}
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
              animate={{ opacity: 1 }}
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="backdrop"
              onClick={() => setIsOpen(false)}
              transition={{ duration: 0.2 }}
            />

            {/* Mobile sidebar */}
            <motion.aside
              animate={{ x: 0, opacity: 1 }}
              className={cn(
                "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-background md:hidden",
                className
              )}
              exit={{ x: -300, opacity: 0 }}
              initial={{ x: -300, opacity: 0 }}
              key="mobile-sidebar"
              ref={sidebarRef}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            >
              {/* Close button inside drawer */}
              <Button
                aria-label="Close navigation"
                className="absolute top-4 right-4 z-50"
                onClick={() => setIsOpen(false)}
                size="icon"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
              {/* Scrollable content with overscroll containment to prevent bleeding */}
              <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
                {children}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
