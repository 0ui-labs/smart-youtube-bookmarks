import { Moon, Plus, Sun } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteTagDialog } from "@/components/ConfirmDeleteTagDialog";
import { CreateTagDialog } from "@/components/CreateTagDialog";
import { EditTagDialog } from "@/components/EditTagDialog";
import { SubscriptionsTab } from "@/components/settings/SubscriptionsTab";
import { TagsList } from "@/components/settings/TagsList";
import { WorkspaceFieldsCard } from "@/components/settings/WorkspaceFieldsCard";
import { WorkspaceFieldsEditor } from "@/components/settings/WorkspaceFieldsEditor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList as TabsListUI,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useLists } from "@/hooks/useLists";
import { useTags } from "@/hooks/useTags";
import { useThemeStore } from "@/stores";
import type { Tag } from "@/types/tag";

/**
 * SettingsPage - Centralized settings management
 *
 * Provides tabbed interface for:
 * - Kategorien: Manage categories, labels and their fields
 * - Design: Theme settings (dark/light mode)
 *
 * Architecture:
 * - Uses shadcn/ui Tabs for navigation
 * - Fetches data via TanStack Query hooks
 * - Uses useLists() to get listId dynamically
 *
 * Route: /settings
 */
export function SettingsPage() {
  // Tabs: Kategorien, Abos and Design
  const [activeTab, setActiveTab] = useState<"kategorien" | "abos" | "design">(
    "kategorien"
  );

  // Theme store for dark/light mode
  const { theme, setTheme } = useThemeStore();

  // Fetch lists dynamically instead of hardcoded listId
  const {
    data: lists,
    isLoading: isListsLoading,
    isError: isListsError,
  } = useLists();
  const listId = lists?.[0]?.id || "";

  // Fetch tags for current user
  const {
    data: tags = [],
    isLoading: isTagsLoading,
    isError: isTagsError,
    refetch: refetchTags,
  } = useTags();

  // Tag dialog state
  const [editTagDialogOpen, setEditTagDialogOpen] = useState(false);
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Workspace fields editor state
  const [workspaceEditorOpen, setWorkspaceEditorOpen] = useState(false);

  // Tag edit handler
  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setEditTagDialogOpen(true);
  };

  // Tag delete handler
  const handleDeleteTag = (tag: Tag) => {
    setSelectedTag(tag);
    setDeleteTagDialogOpen(true);
  };

  // Show loading state
  if (isListsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl text-foreground">
              Einstellungen
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <p className="text-lg text-muted-foreground">Lade Daten...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-2xl text-foreground">
              Einstellungen
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs
          onValueChange={(v) =>
            setActiveTab(v as "kategorien" | "abos" | "design")
          }
          value={activeTab}
        >
          <TabsListUI className="mb-6">
            <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
            <TabsTrigger value="abos">Abos</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
          </TabsListUI>

          {isListsError && (
            <div role="alert">Listen konnten nicht geladen werden.</div>
          )}
          {/* Kategorien Tab */}
          <TabsContent value="kategorien">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-2xl tracking-tight">
                    Kategorien & Labels
                  </h2>
                  <p className="text-muted-foreground">
                    Verwalte Kategorien, Labels und deren Felder
                  </p>
                </div>
                <Button onClick={() => setCreateTagDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Kategorie
                </Button>
              </div>

              {/* Workspace Fields Card */}
              {listId && (
                <WorkspaceFieldsCard
                  defaultSchemaId={lists?.[0]?.default_schema_id ?? null}
                  listId={listId}
                  onEdit={() => setWorkspaceEditorOpen(true)}
                />
              )}

              {isTagsError ? (
                <div role="alert">
                  Kategorien konnten nicht geladen werden.{" "}
                  <Button onClick={() => void refetchTags()}>
                    Erneut versuchen
                  </Button>
                </div>
              ) : isTagsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Lade Kategorien...</p>
                </div>
              ) : (
                <TagsList
                  onDelete={handleDeleteTag}
                  onEdit={handleEditTag}
                  tags={tags}
                />
              )}
            </div>
          </TabsContent>

          {/* Abos Tab */}
          <TabsContent value="abos">
            <SubscriptionsTab />
          </TabsContent>

          {/* Design Tab - Theme Settings */}
          <TabsContent value="design">
            <div className="space-y-6">
              <div>
                <h2 className="font-bold text-2xl tracking-tight">Design</h2>
                <p className="text-muted-foreground">
                  Passe das Erscheinungsbild der Anwendung an
                </p>
              </div>

              {/* Dark Mode Toggle */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      {theme === "dark" ? (
                        <Moon className="h-5 w-5" />
                      ) : (
                        <Sun className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label
                        className="font-medium text-base"
                        htmlFor="dark-mode"
                      >
                        Dark Mode
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Aktiviere den dunklen Modus für eine augenfreundlichere
                        Darstellung
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    id="dark-mode"
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "dark" : "light")
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Tag Dialogs */}
      {selectedTag && (
        <>
          <EditTagDialog
            listId={listId}
            onClose={() => {
              setEditTagDialogOpen(false);
              setSelectedTag(null);
            }}
            open={editTagDialogOpen}
            tag={selectedTag}
          />

          <ConfirmDeleteTagDialog
            onCancel={() => {
              setDeleteTagDialogOpen(false);
              setSelectedTag(null);
            }}
            onConfirm={() => {
              setDeleteTagDialogOpen(false);
              setSelectedTag(null);
            }}
            open={deleteTagDialogOpen}
            tag={selectedTag}
          />
        </>
      )}

      {/* Workspace Fields Editor */}
      <WorkspaceFieldsEditor
        defaultSchemaId={lists?.[0]?.default_schema_id ?? null}
        listId={listId}
        onOpenChange={setWorkspaceEditorOpen}
        open={workspaceEditorOpen}
      />

      {/* Create Tag Dialog */}
      <CreateTagDialog
        listId={listId}
        onOpenChange={setCreateTagDialogOpen}
        open={createTagDialogOpen}
      />
    </div>
  );
}
