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

/**
 * Parses a string input as a non-negative integer.
 * Returns the parsed number if valid, or null if empty/invalid.
 */
function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * Validates form inputs and returns error messages if any.
 */
function validateForm(form: FormState): string[] {
  const errors: string[] = [];

  // Validate duration_min
  if (form.duration_min.trim() !== "") {
    const min = parseNonNegativeInt(form.duration_min);
    if (min === null) {
      errors.push("Minimale Videodauer muss eine positive Zahl sein.");
    }
  }

  // Validate duration_max
  if (form.duration_max.trim() !== "") {
    const max = parseNonNegativeInt(form.duration_max);
    if (max === null) {
      errors.push("Maximale Videodauer muss eine positive Zahl sein.");
    }
  }

  // Validate min <= max when both are present
  if (form.duration_min.trim() !== "" && form.duration_max.trim() !== "") {
    const min = parseNonNegativeInt(form.duration_min);
    const max = parseNonNegativeInt(form.duration_max);
    if (min !== null && max !== null && min > max) {
      errors.push(
        "Minimale Videodauer darf nicht größer als maximale Dauer sein."
      );
    }
  }

  // Validate min_views
  if (form.min_views.trim() !== "") {
    const views = parseNonNegativeInt(form.min_views);
    if (views === null) {
      errors.push("Mindest-Aufrufe muss eine positive Zahl sein.");
    }
  }

  return errors;
}

export function EditSubscriptionModal({
  subscription,
  open,
  onClose,
}: EditSubscriptionModalProps) {
  const updateSubscription = useUpdateSubscription();
  const [newKeyword, setNewKeyword] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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
      // Safely extract filters with runtime validation
      const filters =
        subscription.filters &&
        typeof subscription.filters === "object" &&
        !Array.isArray(subscription.filters)
          ? (subscription.filters as {
              duration?: { min_seconds?: unknown; max_seconds?: unknown };
              views?: { min_views?: unknown };
            })
          : null;

      // Helper to safely convert to minutes (returns empty string if invalid)
      const toMinutesString = (seconds: unknown): string => {
        const num = typeof seconds === "string" ? Number(seconds) : seconds;
        if (typeof num === "number" && Number.isFinite(num) && num > 0) {
          return String(Math.floor(num / 60));
        }
        return "";
      };

      // Helper to safely convert views to string (returns empty string if invalid)
      const toViewsString = (views: unknown): string => {
        const num = typeof views === "string" ? Number(views) : views;
        if (typeof num === "number" && Number.isFinite(num) && num >= 0) {
          return String(Math.floor(num));
        }
        return "";
      };

      setForm({
        name: subscription.name || "",
        keywords: subscription.keywords || [],
        poll_interval: subscription.poll_interval || "daily",
        duration_min: toMinutesString(filters?.duration?.min_seconds),
        duration_max: toMinutesString(filters?.duration?.max_seconds),
        min_views: toViewsString(filters?.views?.min_views),
      });
      setValidationErrors([]);
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

    // Validate form inputs
    const errors = validateForm(form);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    // Build filters object using validated parsing
    const filters: {
      duration?: { min_seconds?: number; max_seconds?: number };
      views?: { min_views?: number };
    } = {};

    const durationMin = parseNonNegativeInt(form.duration_min);
    const durationMax = parseNonNegativeInt(form.duration_max);

    if (durationMin !== null || durationMax !== null) {
      filters.duration = {};
      if (durationMin !== null) {
        filters.duration.min_seconds = durationMin * 60;
      }
      if (durationMax !== null) {
        filters.duration.max_seconds = durationMax * 60;
      }
    }

    const minViews = parseNonNegativeInt(form.min_views);
    if (minViews !== null) {
      filters.views = { min_views: minViews };
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

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <ul className="list-inside list-disc space-y-1 text-destructive text-sm">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

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
