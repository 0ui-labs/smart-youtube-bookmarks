import { render, screen } from "@testing-library/react";
import { ReadyState } from "react-use-websocket";
import { describe, expect, it } from "vitest";
import { ConnectionStatusBanner } from "./ConnectionStatusBanner";

describe("ConnectionStatusBanner", () => {
  it("shows connecting state", () => {
    render(
      <ConnectionStatusBanner
        readyState={ReadyState.CONNECTING}
        reconnecting={false}
      />
    );
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it("shows connected state", () => {
    render(
      <ConnectionStatusBanner
        readyState={ReadyState.OPEN}
        reconnecting={false}
      />
    );
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it("shows reconnecting state", () => {
    render(
      <ConnectionStatusBanner
        readyState={ReadyState.CLOSED}
        reconnecting={true}
      />
    );
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it("shows disconnected state", () => {
    render(
      <ConnectionStatusBanner
        readyState={ReadyState.CLOSED}
        reconnecting={false}
      />
    );
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  it("hides when uninstantiated", () => {
    const { container } = render(
      <ConnectionStatusBanner
        readyState={ReadyState.UNINSTANTIATED}
        reconnecting={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
