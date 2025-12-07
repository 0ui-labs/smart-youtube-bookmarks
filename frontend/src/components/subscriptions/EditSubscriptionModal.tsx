/**
 * EditSubscriptionModal - Modal for editing existing subscriptions
 *
 * Allows users to modify subscription settings:
 * - Name
 * - Keywords (for keyword-based subscriptions)
 * - Poll interval
 * - Duration filter
 * - Views filter
 *
 * Note: Channel IDs are not editable as they require channel resolution.
 * Users should create a new subscription for different channels.
 */

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  SubscriptionResponse,
  SubscriptionUpdatePollInterval,
} from "@/api/generated/model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateSubscription } from "@/hooks/useSubscriptions";

interface EditSubscriptionModalProps {
  subscription: SubscriptionResponse | null;
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  keywords: string[];
  poll_interval: string;
  duration_min: string;
  duration_max: string;
  min_views: string;
}

const POLL_INTERVALS: {
  value: Exclude<SubscriptionUpdatePollInterval, null>;
  label: string;
}[] = [
  { value: "twice_daily", label: "2x täglich" },
  { value: "daily", label: "Täglich" },
];

export function EditSubscriptionModal({
  subscription,
  open,
  onClose,
}: EditSubscriptionModalProps) {
  const updateSubscription = useUpdateSubscription();
  const [newKeyword, setNewKeyword] = useState("");
  const [form, setForm] = useState<FormState>({
    name: "",
    keywords: [],
    poll_interval: "daily",
    duration_min: "",
    duration_max: "",
    min_views: "",
  });

  // Initialize form when subscription changes
  useEffect(() => {
    if (subscription) {
      const filters = subscription.filters as {
        duration?: { min_seconds?: number; max_seconds?: number };
        views?: { min_views?: number };
      } | null;

      setForm({
        name: subscription.name || "",
        keywords: subscription.keywords || [],
        poll_interval: subscription.poll_interval || "daily",
        duration_min: filters?.duration?.min_seconds
          ? String(Math.floor(filters.duration.min_seconds / 60))
          : "",
        duration_max: filters?.duration?.max_seconds
          ? String(Math.floor(filters.duration.max_seconds / 60))
          : "",
        min_views: filters?.views?.min_views
          ? String(filters.views.min_views)
          : "",
      });
    }
  }, [subscription]);

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim();
    if (keyword && !form.keywords.includes(keyword)) {
      setForm((prev) => ({
        ...prev,
        keywords: [...prev.keywords, keyword],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setForm((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subscription) return;

    // Build filters object
    const filters: {
      duration?: { min_seconds?: number; max_seconds?: number };
      views?: { min_views?: number };
    } = {};

    if (form.duration_min || form.duration_max) {
      filters.duration = {};
      if (form.duration_min) {
        filters.duration.min_seconds =
          Number.parseInt(form.duration_min, 10) * 60;
      }
      if (form.duration_max) {
        filters.duration.max_seconds =
          Number.parseInt(form.duration_max, 10) * 60;
      }
    }

    if (form.min_views) {
      filters.views = { min_views: Number.parseInt(form.min_views, 10) };
    }

    await updateSubscription.mutateAsync({
      id: subscription.id,
      data: {
        name: form.name,
        keywords: form.keywords.length > 0 ? form.keywords : undefined,
        poll_interval: form.poll_interval as SubscriptionUpdatePollInterval,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      },
    });

    onClose();
  };

  const isKeywordSub =
    subscription?.keywords && subscription.keywords.length > 0;
  const isChannelSub =
    subscription?.channel_ids && subscription.channel_ids.length > 0;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abo bearbeiten</DialogTitle>
          <DialogDescription>
            Ändere die Einstellungen für dieses Abonnement.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Abo-Name"
              value={form.name}
            />
          </div>

          {/* Keywords (only for keyword subscriptions) */}
          {isKeywordSub && (
            <div className="space-y-2">
              <Label>Keywords</Label>
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Neues Keyword"
                  value={newKeyword}
                />
                <Button
                  onClick={handleAddKeyword}
                  type="button"
                  variant="secondary"
                >
                  +
                </Button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.keywords.map((kw) => (
                    <Badge
                      className="cursor-pointer gap-1"
                      key={kw}
                      onClick={() => handleRemoveKeyword(kw)}
                      variant="secondary"
                    >
                      {kw}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Channel info (read-only) */}
          {isChannelSub && (
            <div className="space-y-2">
              <Label>Kanäle</Label>
              <p className="text-muted-foreground text-sm">
                {subscription?.channel_ids?.length} Kanal
                {subscription?.channel_ids?.length !== 1 ? "e" : ""} abonniert
              </p>
              <p className="text-muted-foreground text-xs">
                Kanäle können nicht bearbeitet werden. Erstelle ein neues Abo
                für andere Kanäle.
              </p>
            </div>
          )}

          {/* Poll Interval */}
          <div className="space-y-2">
            <Label htmlFor="poll_interval">Aktualisierungsintervall</Label>
            <Select
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, poll_interval: value }))
              }
              value={form.poll_interval}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLL_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration Filter */}
          <div className="space-y-2">
            <Label>Videodauer (Minuten)</Label>
            <div className="flex items-center gap-2">
              <Input
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, duration_min: e.target.value }))
                }
                placeholder="Min"
                type="number"
                value={form.duration_min}
              />
              <span className="text-muted-foreground">bis</span>
              <Input
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, duration_max: e.target.value }))
                }
                placeholder="Max"
                type="number"
                value={form.duration_max}
              />
            </div>
          </div>

          {/* Min Views Filter */}
          <div className="space-y-2">
            <Label htmlFor="min_views">Mindest-Aufrufe</Label>
            <Input
              id="min_views"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, min_views: e.target.value }))
              }
              placeholder="z.B. 10000"
              type="number"
              value={form.min_views}
            />
          </div>

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="ghost">
              Abbrechen
            </Button>
            <Button disabled={updateSubscription.isPending} type="submit">
              {updateSubscription.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
