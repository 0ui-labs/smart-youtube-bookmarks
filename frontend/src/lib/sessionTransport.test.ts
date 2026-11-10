import { HttpResponse, http } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { api } from "./api";
import {
  authorizedFetch,
  clearSessionTransport,
  configureSessionTransport,
  prepareSessionRequest,
} from "./sessionTransport";

afterEach(clearSessionTransport);

it("asks for a current token for each API request", async () => {
  const seen: (string | null)[] = [];
  server.use(
    http.get("/api/session-probe", ({ request }) => {
      seen.push(request.headers.get("Authorization"));
      return HttpResponse.json({ ok: true });
    })
  );
  const getter = vi
    .fn()
    .mockResolvedValueOnce("synthetic-a")
    .mockResolvedValueOnce("synthetic-b");
  configureSessionTransport(getter);
  await api.get("/session-probe");
  await api.get("/session-probe");
  expect(seen).toEqual(["Bearer synthetic-a", "Bearer synthetic-b"]);
  expect(localStorage.getItem("token")).toBeNull();
});

it("refreshes once after 401 and does not retry without limit", async () => {
  let calls = 0;
  server.use(
    http.get("/api/session-probe", () => {
      calls += 1;
      return HttpResponse.json({}, { status: 401 });
    })
  );
  const getter = vi.fn().mockResolvedValue("synthetic-a");
  configureSessionTransport(getter);
  await expect(api.get("/session-probe")).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(calls).toBe(2);
  expect(getter.mock.calls.map((args) => args[0])).toEqual([
    { skipCache: false },
    { skipCache: true },
  ]);
});

it("discards a token resolving after a user change", async () => {
  let resolve: (value: string) => void = () => {};
  configureSessionTransport(
    () =>
      new Promise((value) => {
        resolve = value;
      })
  );
  const request = prepareSessionRequest();
  configureSessionTransport(async () => "synthetic-b");
  resolve("synthetic-a");
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
});

it("aborts outstanding work on logout", async () => {
  configureSessionTransport(async () => "synthetic-a");
  const request = await prepareSessionRequest();
  clearSessionTransport();
  expect(request.signal.aborted).toBe(true);
  request.release();
});

it("uses the same current credentials for fetch callers", async () => {
  configureSessionTransport(async () => "synthetic-a");
  server.use(
    http.get("http://localhost/api/session-probe", ({ request }) =>
      HttpResponse.json({ authorization: request.headers.get("Authorization") })
    )
  );
  expect(
    await (await authorizedFetch("http://localhost/api/session-probe")).json()
  ).toEqual({ authorization: "Bearer synthetic-a" });
});
