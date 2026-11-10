import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { VideoThumbnail } from "./VideoThumbnail";

it("renders standalone without mounting video page queries", () => {
  render(
    <VideoThumbnail
      fallbackUrl="https://example.test/fallback.jpg"
      title="Synthetic"
      useFullWidth
      youtubeId="aaaaaaaaaaa"
    />
  );
  expect(screen.getByAltText("Synthetic")).toHaveClass("w-full");
});

it("uses the fallback after an image error", () => {
  render(
    <VideoThumbnail
      fallbackUrl="https://example.test/fallback.jpg"
      title="Synthetic"
      youtubeId="aaaaaaaaaaa"
    />
  );
  fireEvent.error(screen.getByAltText("Synthetic"));
  expect(screen.getByAltText("Synthetic")).toHaveAttribute(
    "src",
    "https://example.test/fallback.jpg"
  );
});
