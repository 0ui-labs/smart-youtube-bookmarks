import type { QueryClient } from "@tanstack/react-query";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import { useImportDropStore } from "@/stores/importDropStore";
import { useImportProgressStore } from "@/stores/importProgressStore";
import { useSubscriptionChatStore } from "@/stores/subscriptionChatStore";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import { useTagStore } from "@/stores/tagStore";
import { clearSessionTransport } from "./sessionTransport";

export async function resetUserSession(client: QueryClient) {
  clearSessionTransport();
  const cancellation = client.cancelQueries();
  client.clear();
  useImportProgressStore.getState().clearAllProgress();
  useTagStore.setState(useTagStore.getInitialState(), true);
  useFieldFilterStore.setState(useFieldFilterStore.getInitialState(), true);
  useImportDropStore.setState(useImportDropStore.getInitialState(), true);
  useSubscriptionChatStore.setState(
    useSubscriptionChatStore.getInitialState(),
    true
  );
  useTableSettingsStore.setState(useTableSettingsStore.getInitialState(), true);
  for (const key of [
    "tag-filter-selection",
    "field-filter-state",
    "video-table-settings",
    "token",
  ]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  await cancellation;
}
