import type { QueryClient } from "@tanstack/react-query";
import { videoKeys } from "@/lib/videoKeys";

/** Server-owned membership/order/totals; inactive variants become stale too. */
export function invalidateVideoViews(client: QueryClient, listId?: string) {
  return Promise.all([
    client.invalidateQueries({
      queryKey: listId ? videoKeys.list(listId) : videoKeys.all,
    }),
    client.invalidateQueries({ queryKey: ["lists"] }),
    client.invalidateQueries({ queryKey: ["channels"] }),
    client.invalidateQueries({ queryKey: ["analytics"] }),
  ]);
}
