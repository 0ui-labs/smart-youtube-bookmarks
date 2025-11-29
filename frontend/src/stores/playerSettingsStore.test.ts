import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_SETTINGS } from "@/types/player";
import { usePlayerSettingsStore } from "./playerSettingsStore";

describe("playerSettingsStore", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    usePlayerSettingsStore.getState().reset();
  });

  describe("initial state", () => {
    it("has default values", () => {
      const state = usePlayerSettingsStore.getState();

      expect(state.volume).toBe(DEFAULT_PLAYER_SETTINGS.volume);
      expect(state.muted).toBe(DEFAULT_PLAYER_SETTINGS.muted);
      expect(state.playbackRate).toBe(DEFAULT_PLAYER_SETTINGS.playbackRate);
    });
  });

  describe("setVolume", () => {
    it("updates volume", () => {
      usePlayerSettingsStore.getState().setVolume(0.5);

      expect(usePlayerSettingsStore.getState().volume).toBe(0.5);
    });

    it("clamps volume to 0-1 range (max)", () => {
      usePlayerSettingsStore.getState().setVolume(1.5);

      expect(usePlayerSettingsStore.getState().volume).toBe(1);
    });

    it("clamps volume to 0-1 range (min)", () => {
      usePlayerSettingsStore.getState().setVolume(-0.5);

      expect(usePlayerSettingsStore.getState().volume).toBe(0);
    });
  });

  describe("setMuted", () => {
    it("updates muted state to true", () => {
      usePlayerSettingsStore.getState().setMuted(true);

      expect(usePlayerSettingsStore.getState().muted).toBe(true);
    });

    it("updates muted state to false", () => {
      usePlayerSettingsStore.getState().setMuted(true);
      usePlayerSettingsStore.getState().setMuted(false);

      expect(usePlayerSettingsStore.getState().muted).toBe(false);
    });
  });

  describe("setPlaybackRate", () => {
    it("updates playback rate with valid value", () => {
      usePlayerSettingsStore.getState().setPlaybackRate(1.5);

      expect(usePlayerSettingsStore.getState().playbackRate).toBe(1.5);
    });

    it("defaults to 1 for invalid playback rate", () => {
      usePlayerSettingsStore.getState().setPlaybackRate(3); // Invalid - not in PLAYBACK_SPEED_OPTIONS

      expect(usePlayerSettingsStore.getState().playbackRate).toBe(1);
    });

    it("accepts all valid playback rates", () => {
      const validRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

      validRates.forEach((rate) => {
        usePlayerSettingsStore.getState().setPlaybackRate(rate);
        expect(usePlayerSettingsStore.getState().playbackRate).toBe(rate);
      });
    });
  });

  describe("reset", () => {
    it("resets all values to defaults", () => {
      // Change all values
      usePlayerSettingsStore.getState().setVolume(0.3);
      usePlayerSettingsStore.getState().setMuted(true);
      usePlayerSettingsStore.getState().setPlaybackRate(2);

      // Reset
      usePlayerSettingsStore.getState().reset();

      const state = usePlayerSettingsStore.getState();
      expect(state.volume).toBe(DEFAULT_PLAYER_SETTINGS.volume);
      expect(state.muted).toBe(DEFAULT_PLAYER_SETTINGS.muted);
      expect(state.playbackRate).toBe(DEFAULT_PLAYER_SETTINGS.playbackRate);
    });
  });
});
