import { useCallback, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export interface SmartSuggestion {
  field: {
    id: string;
    name: string;
    field_type: "select" | "rating" | "text" | "boolean";
    config: Record<string, any>;
  };
  score: number;
  similarity_type: "exact" | "levenshtein" | "semantic" | "no_match";
  explanation: string;
}

export interface SmartDuplicateCheckResult {
  exists: boolean;
  suggestions: SmartSuggestion[];
  mode: "basic" | "smart";
}

export interface UseSmartDuplicateCheckOptions {
  listId: string;
  mode?: "basic" | "smart";
  debounceMs?: number;
  enabled?: boolean;
}

export function useSmartDuplicateCheck(options: UseSmartDuplicateCheckOptions) {
  const { listId, mode = "smart", debounceMs = 500, enabled = true } = options;

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDuplicate = useCallback(
    async (fieldName: string) => {
      if (!(enabled && fieldName.trim())) {
        setSuggestions([]);
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/lists/${listId}/custom-fields/check-duplicate?mode=${mode}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fieldName }),
          }
        );

        if (!response.ok) {
          throw new Error(`Check failed: ${response.statusText}`);
        }

        const data: SmartDuplicateCheckResult = await response.json();

        // In basic mode, convert to suggestions format
        if (data.mode === "basic") {
          const basicResponse = data as any;
          if (basicResponse.exists && basicResponse.field) {
            setSuggestions([
              {
                field: basicResponse.field,
                score: 1.0,
                similarity_type: "exact",
                explanation: `Exact match: '${basicResponse.field.name}'`,
              },
            ]);
          } else {
            setSuggestions([]);
          }
        } else {
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setSuggestions([]);
      } finally {
        setIsChecking(false);
      }
    },
    [listId, mode, enabled]
  );

  // Debounced version for real-time input
  const debouncedCheck = useDebouncedCallback(checkDuplicate, debounceMs);

  return {
    suggestions,
    isChecking,
    error,
    checkDuplicate,
    debouncedCheck,
    hasExactMatch: suggestions.some((s) => s.similarity_type === "exact"),
    hasTypoMatch: suggestions.some((s) => s.similarity_type === "levenshtein"),
    hasSemanticMatch: suggestions.some((s) => s.similarity_type === "semantic"),
  };
}
