import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateThumbnailWidth,
  getQualityForWidth,
  getThumbnailUrls,
  THUMBNAIL_DIMENSIONS,
} from "./thumbnailUrl";

describe("getQualityForWidth", () => {
  beforeEach(() => {
    // Mock devicePixelRatio to 1 (non-Retina)
    Object.defineProperty(window, "devicePixelRatio", {
      value: 1,
      writable: true,
    });
  });

  it('returns "default" for width <= 120', () => {
    expect(getQualityForWidth(100)).toBe("default");
    expect(getQualityForWidth(120)).toBe("default");
  });

  it('returns "mq" for width 121-320', () => {
    expect(getQualityForWidth(128)).toBe("mq");
    expect(getQualityForWidth(320)).toBe("mq");
  });

  it('returns "hq" for width 321-480', () => {
    expect(getQualityForWidth(380)).toBe("hq");
    expect(getQualityForWidth(480)).toBe("hq");
  });

  it('returns "sd" for width 481-640', () => {
    expect(getQualityForWidth(500)).toBe("sd");
    expect(getQualityForWidth(640)).toBe("sd");
  });

  it('returns "maxres" for width > 640', () => {
    expect(getQualityForWidth(800)).toBe("maxres");
    expect(getQualityForWidth(1280)).toBe("maxres");
  });

  describe("with Retina display (devicePixelRatio > 1)", () => {
    beforeEach(() => {
      Object.defineProperty(window, "devicePixelRatio", {
        value: 2,
        writable: true,
      });
    });

    it("applies 1.5x multiplier to target width", () => {
      // 128px * 1.5 = 192px → still mq (320)
      expect(getQualityForWidth(128)).toBe("mq");
      // 320px * 1.5 = 480px → hq (480)
      expect(getQualityForWidth(320)).toBe("hq");
      // 500px * 1.5 = 750px → maxres (1280)
      expect(getQualityForWidth(500)).toBe("maxres");
    });
  });
});

describe("getThumbnailUrls", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      value: 1,
      writable: true,
    });
  });

  it("generates correct WebP URL", () => {
    const urls = getThumbnailUrls("dQw4w9WgXcQ", 128);
    expect(urls.webp).toBe(
      "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/mqdefault.webp"
    );
  });

  it("generates correct JPEG URL", () => {
    const urls = getThumbnailUrls("dQw4w9WgXcQ", 128);
    expect(urls.jpeg).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("uses correct quality for different widths", () => {
    expect(getThumbnailUrls("abc", 100).webp).toContain("default.webp");
    expect(getThumbnailUrls("abc", 200).webp).toContain("mqdefault.webp");
    expect(getThumbnailUrls("abc", 400).webp).toContain("hqdefault.webp");
    expect(getThumbnailUrls("abc", 600).webp).toContain("sddefault.webp");
    expect(getThumbnailUrls("abc", 800).webp).toContain("maxresdefault.webp");
  });

  it("handles special characters in youtube_id", () => {
    const urls = getThumbnailUrls("a-B_c123", 200);
    expect(urls.webp).toBe(
      "https://i.ytimg.com/vi_webp/a-B_c123/mqdefault.webp"
    );
    expect(urls.jpeg).toBe("https://i.ytimg.com/vi/a-B_c123/mqdefault.jpg");
  });
});

describe("calculateThumbnailWidth", () => {
  describe("list view", () => {
    it("returns 128 for small thumbnails", () => {
      expect(calculateThumbnailWidth("list", "small", 3)).toBe(128);
    });

    it("returns 160 for medium thumbnails", () => {
      expect(calculateThumbnailWidth("list", "medium", 3)).toBe(160);
    });

    it("returns 192 for large thumbnails", () => {
      expect(calculateThumbnailWidth("list", "large", 3)).toBe(192);
    });

    it("returns 500 for xlarge thumbnails", () => {
      expect(calculateThumbnailWidth("list", "xlarge", 3)).toBe(500);
    });

    it("ignores gridColumns in list view", () => {
      expect(calculateThumbnailWidth("list", "small", 2)).toBe(128);
      expect(calculateThumbnailWidth("list", "small", 5)).toBe(128);
    });
  });

  describe("grid view", () => {
    it("returns 200 for 5 columns", () => {
      expect(calculateThumbnailWidth("grid", "small", 5)).toBe(200);
    });

    it("returns 280 for 4 columns", () => {
      expect(calculateThumbnailWidth("grid", "small", 4)).toBe(280);
    });

    it("returns 380 for 3 columns", () => {
      expect(calculateThumbnailWidth("grid", "small", 3)).toBe(380);
    });

    it("returns 580 for 2 columns", () => {
      expect(calculateThumbnailWidth("grid", "small", 2)).toBe(580);
    });

    it("ignores thumbnailSize in grid view", () => {
      expect(calculateThumbnailWidth("grid", "xlarge", 5)).toBe(200);
    });
  });
});

describe("THUMBNAIL_DIMENSIONS", () => {
  it("contains all quality levels with correct dimensions", () => {
    expect(THUMBNAIL_DIMENSIONS.default).toEqual({ width: 120, height: 90 });
    expect(THUMBNAIL_DIMENSIONS.mq).toEqual({ width: 320, height: 180 });
    expect(THUMBNAIL_DIMENSIONS.hq).toEqual({ width: 480, height: 360 });
    expect(THUMBNAIL_DIMENSIONS.sd).toEqual({ width: 640, height: 480 });
    expect(THUMBNAIL_DIMENSIONS.maxres).toEqual({ width: 1280, height: 720 });
  });
});
