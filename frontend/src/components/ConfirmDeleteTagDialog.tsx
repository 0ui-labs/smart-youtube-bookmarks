import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTag } from "@/hooks/useTags";
import type { Tag } from "@/types/tag";

interface ConfirmDeleteTagDialogProps {
  tag: Tag;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for deleting a tag
 *
 * Features:
 * - Shows warning icon (AlertTriangle)
 * - Displays tag name in warning message
 * - Warns that tag will be removed from all videos
 * - Uses destructive button variant for delete action
 * - Shows loading state while deleting
 *
 * @example
 * ```tsx
 * <ConfirmDeleteTagDialog
 *   tag={selectedTag}
 *   open={deleteDialogOpen}
 *   onConfirm={() => {
 *     setDeleteDialogOpen(false)
 *     setSelectedTag(null)
 *   }}
 *   onCancel={() => {
 *     setDeleteDialogOpen(false)
 *     setSelectedTag(null)
 *   }}
 * />
 * ```
 */
export function ConfirmDeleteTagDialog({
  tag,
  open,
  onConfirm,
  onCancel,
}: ConfirmDeleteTagDialogProps) {
  const deleteTag = useDeleteTag();

  const handleConfirm = async () => {
    try {
      await deleteTag.mutateAsync(tag.id);
      onConfirm();
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  return (
    <AlertDialog onOpenChange={(open) => !open && onCancel()} open={open}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Tag
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the tag{" "}
                <strong className="font-semibold text-foreground">
                  "{tag.name}"
                </strong>
                ?
              </p>
              <p>This will remove the tag from all videos.</p>
              <p className="text-muted-foreground text-sm">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTag.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              disabled={deleteTag.isPending}
              onClick={(e) => {
                e.preventDefault(); // Prevents auto-close during mutation
                handleConfirm();
              }}
              variant="destructive"
            >
              {deleteTag.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
