/** Session credentials stay in memory; generation changes invalidate late work. */
export type SessionTokenGetter = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;
let getToken: SessionTokenGetter | undefined;
let generation = 0;
const requests = new Set<AbortController>();

export function clearSessionTransport() {
  generation += 1;
  getToken = undefined;
  for (const controller of requests) controller.abort();
  requests.clear();
}

export function configureSessionTransport(getter: SessionTokenGetter) {
  clearSessionTransport();
  getToken = getter;
  const configuredGeneration = generation;
  return () => {
    if (generation === configuredGeneration) clearSessionTransport();
  };
}

export async function prepareSessionRequest(
  refresh = false,
  signal?: AbortSignal | null
) {
  const startedGeneration = generation;
  const getter = getToken;
  const controller = new AbortController();
  requests.add(controller);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const release = () => {
    requests.delete(controller);
    signal?.removeEventListener("abort", abort);
  };
  try {
    const token = getter ? await getter({ skipCache: refresh }) : null;
    if (generation !== startedGeneration || controller.signal.aborted)
      throw new DOMException("Session changed", "AbortError");
    if (getter && !token) throw new Error("Authentication required");
    return {
      token,
      signal: controller.signal,
      release,
      isCurrent: () =>
        generation === startedGeneration && !controller.signal.aborted,
    };
  } catch (error) {
    release();
    throw error;
  }
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const request = await prepareSessionRequest(false, init?.signal);
  try {
    const headers = new Headers(init?.headers);
    if (request.token) headers.set("Authorization", `Bearer ${request.token}`);
    const response = await fetch(input, {
      ...init,
      headers,
      signal: request.signal,
    });
    if (!request.isCurrent())
      throw new DOMException("Session changed", "AbortError");
    if (response.status === 401 && request.token) {
      request.release();
      const refreshed = await prepareSessionRequest(true, init?.signal);
      try {
        headers.set("Authorization", `Bearer ${refreshed.token}`);
        return await fetch(input, {
          ...init,
          headers,
          signal: refreshed.signal,
        });
      } finally {
        refreshed.release();
      }
    }
    return response;
  } finally {
    request.release();
  }
}
