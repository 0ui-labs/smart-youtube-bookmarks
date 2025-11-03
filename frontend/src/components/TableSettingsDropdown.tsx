// frontend/src/components/TableSettingsDropdown.tsx
/**
 * TableSettingsDropdown Component
 *
 * Provides UI controls for table display settings (thumbnail size, column visibility).
 * Connected to tableSettingsStore for state management and localStorage persistence.
 *
 * Settings apply immediately - no save button needed due to automatic store persistence.
 *
 * @example
 * ```tsx
 * <TableSettingsDropdown />
 * ```
 */
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TableSettingsDropdown = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Einstellungen"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]" // REF MCP Improvement #7: Responsive width
      >
        {/* Content will be added in next tasks */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
