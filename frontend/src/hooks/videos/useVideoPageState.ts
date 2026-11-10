import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function useVideoPageState(selectionKey: string) {
  const [params, setParams] = useSearchParams();
  const [previousSelection, setPreviousSelection] = useState(selectionKey);
  const raw = Number(params.get("page") ?? "1");
  const requested = Number.isSafeInteger(raw) && raw > 0 ? raw - 1 : 0;
  const page = previousSelection === selectionKey ? requested : 0;
  const setPage = (next: number) =>
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        if (next === 0) updated.delete("page");
        else updated.set("page", String(next + 1));
        return updated;
      },
      { replace: true }
    );
  useEffect(() => {
    if (previousSelection !== selectionKey) {
      setPreviousSelection(selectionKey);
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          updated.delete("page");
          return updated;
        },
        { replace: true }
      );
    }
  }, [previousSelection, selectionKey, setParams]);
  return { page, setPage };
}
