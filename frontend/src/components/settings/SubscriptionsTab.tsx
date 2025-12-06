/**
 * SubscriptionsTab
 *
 * Settings tab for managing video subscriptions.
 * Shows list of existing subscriptions with edit/delete/toggle actions.
 */
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import type { SubscriptionResponse } from "@/api/generated/model";
import { NewSubscriptionButton } from "@/components/subscriptions/NewSubscriptionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteSubscription,
  useSubscriptions,
  useSyncSubscription,
  useToggleSubscription,
} from "@/hooks/useSubscriptions";

export function SubscriptionsTab() {
  const { data: subscriptions = [], isLoading, error } = useSubscriptions();
  const deleteSubscription = useDeleteSubscription();
  const toggleSubscription = useToggleSubscription();
  const syncSubscription = useSyncSubscription();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncSubscription.mutateAsync(id);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSubscription.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleSubscription.mutateAsync({ id, currentIsActive: isActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 text-destructive">Fehler beim Laden der Abos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">Abonnements</h2>
          <p className="text-muted-foreground">
            Automatisch neue Videos von Kanälen und Themen importieren
          </p>
        </div>
        <NewSubscriptionButton variant="default" />
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-medium text-lg">Keine Abos vorhanden</h3>
          <p className="mt-2 text-muted-foreground">
            Erstelle dein erstes Abo, um automatisch neue Videos zu importieren
          </p>
          <div className="mt-6">
            <NewSubscriptionButton variant="default" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <SubscriptionCard
              isExpanded={expandedId === sub.id}
              isSyncing={syncingId === sub.id}
              key={sub.id}
              onDeleteCancel={() => setDeleteConfirmId(null)}
              onDeleteConfirm={() => handleDelete(sub.id)}
              onDeleteRequest={() => setDeleteConfirmId(sub.id)}
              onSync={() => handleSync(sub.id)}
              onToggle={() => handleToggle(sub.id, sub.is_active)}
              onToggleExpand={() =>
                setExpandedId(expandedId === sub.id ? null : sub.id)
              }
              showDeleteConfirm={deleteConfirmId === sub.id}
              subscription={sub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubscriptionCardProps {
  subscription: SubscriptionResponse;
  isExpanded: boolean;
  isSyncing: boolean;
  showDeleteConfirm: boolean;
  onToggleExpand: () => void;
  onSync: () => void;
  onToggle: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function SubscriptionCard({
  subscription,
  isExpanded,
  isSyncing,
  showDeleteConfirm,
  onToggleExpand,
  onSync,
  onToggle,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: SubscriptionCardProps) {
  const { name, is_active, channel_ids, keywords, poll_interval, filters } =
    subscription;

  const isChannelSub = channel_ids && channel_ids.length > 0;
  const isKeywordSub = keywords && keywords.length > 0;

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={onToggleExpand}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{name}</span>
              <Badge variant={is_active ? "default" : "secondary"}>
                {is_active ? "Aktiv" : "Pausiert"}
              </Badge>
              {isChannelSub && (
                <Badge variant="outline">{channel_ids!.length} Kanäle</Badge>
              )}
              {isKeywordSub && (
                <Badge variant="outline">{keywords!.length} Keywords</Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-muted-foreground text-sm">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatPollInterval(poll_interval)}
              </span>
              {subscription.last_polled_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Zuletzt: {formatDate(subscription.last_polled_at)}
                </span>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            disabled={isSyncing || !is_active}
            onClick={onSync}
            size="sm"
            title="Jetzt synchronisieren"
            variant="ghost"
          >
            <RefreshCw
              className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
            />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggle}>
                {is_active ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pausieren
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Aktivieren
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDeleteRequest}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-4 border-t px-4 py-4">
          {isChannelSub && (
            <div>
              <h4 className="mb-2 font-medium text-sm">Kanäle</h4>
              <div className="flex flex-wrap gap-2">
                {channel_ids!.map((id) => (
                  <Badge key={id} variant="secondary">
                    {id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {isKeywordSub && (
            <div>
              <h4 className="mb-2 font-medium text-sm">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {keywords!.map((kw) => (
                  <Badge key={kw} variant="secondary">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {filters && (
            <div>
              <h4 className="mb-2 font-medium text-sm">Filter</h4>
              <div className="space-y-1 text-muted-foreground text-sm">
                {filters.duration && (
                  <p>
                    Dauer:{" "}
                    {formatDurationFilter(
                      filters.duration as {
                        min_seconds?: number;
                        max_seconds?: number;
                      }
                    )}
                  </p>
                )}
                {filters.views && (
                  <p>
                    Min. Views:{" "}
                    {(
                      filters.views as { min_views?: number }
                    ).min_views?.toLocaleString("de-DE")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="border-t bg-destructive/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              Dieses Abo wirklich löschen? Diese Aktion kann nicht rückgängig
              gemacht werden.
            </p>
            <div className="flex gap-2">
              <Button onClick={onDeleteCancel} size="sm" variant="ghost">
                Abbrechen
              </Button>
              <Button onClick={onDeleteConfirm} size="sm" variant="destructive">
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPollInterval(interval: string): string {
  const labels: Record<string, string> = {
    hourly: "Stündlich",
    twice_daily: "2x täglich",
    daily: "Täglich",
  };
  return labels[interval] || interval;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationFilter(filter: {
  min_seconds?: number;
  max_seconds?: number;
}): string {
  const min = filter.min_seconds ? Math.round(filter.min_seconds / 60) : null;
  const max = filter.max_seconds ? Math.round(filter.max_seconds / 60) : null;

  if (min && max) return `${min} - ${max} Minuten`;
  if (min) return `≥ ${min} Minuten`;
  if (max) return `≤ ${max} Minuten`;
  return "Beliebig";
}
