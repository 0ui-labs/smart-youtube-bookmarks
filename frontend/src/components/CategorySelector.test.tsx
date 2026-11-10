import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { VideoFieldValue } from "@/types/video";
import { CategorySelector } from "./CategorySelector";

const state = vi.hoisted(() => ({
  loading: false,
  pending: false,
  mutate: vi.fn(),
}));
const categories = [
  { id: "a", name: "Keto", color: "#ff0000" },
  { id: "b", name: "Vegan", color: null },
];
vi.mock("@/hooks/useTags", () => ({
  useCategories: () => ({ data: categories, isLoading: state.loading }),
}));
vi.mock("@/hooks/useVideos", () => ({
  useSetVideoCategory: () => ({
    mutateAsync: state.mutate,
    isPending: state.pending,
  }),
}));
beforeEach(() => {
  state.loading = false;
  state.pending = false;
  state.mutate.mockReset().mockResolvedValue({});
});
const fields = [
  { id: "v1", field_id: "f1", field_name: "Kalorien", value: 500 },
] as VideoFieldValue[];
const show = (
  props: Partial<React.ComponentProps<typeof CategorySelector>> = {}
) =>
  render(
    <CategorySelector currentCategoryId={null} videoId="video" {...props} />
  );
const choose = async (name: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name }));
};
it("labels the category selector accessibly", () => {
  show();
  expect(screen.getByLabelText("Kategorie auswählen")).toHaveRole("combobox");
});
it("shows an empty selection", () => {
  show();
  expect(screen.getByRole("combobox")).toHaveTextContent("Keine Kategorie");
});
it("shows the selected category", () => {
  show({ currentCategoryId: "a" });
  expect(screen.getByRole("combobox")).toHaveTextContent("Keto");
});
it("disables the selector during category loading", () => {
  state.loading = true;
  show();
  expect(screen.getByRole("combobox")).toBeDisabled();
});
it("disables the selector during a mutation", () => {
  state.pending = true;
  show();
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByText("Speichert...")).toBeVisible();
});
it("respects explicit disabled state", () => {
  show({ disabled: true });
  expect(screen.getByRole("combobox")).toBeDisabled();
});
it("assigns the first category without a backup warning", async () => {
  const change = vi.fn();
  show({ onCategoryChange: change });
  await choose("Keto");
  await waitFor(() => expect(change).toHaveBeenCalledWith("a"));
  expect(state.mutate).toHaveBeenCalledWith({
    videoId: "video",
    categoryId: "a",
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not mutate when choosing the existing category", async () => {
  show({ currentCategoryId: "a" });
  await choose("Keto");
  expect(state.mutate).not.toHaveBeenCalled();
});
it("changes an empty category without a warning", async () => {
  show({ currentCategoryId: "a" });
  await choose("Vegan");
  await waitFor(() =>
    expect(state.mutate).toHaveBeenCalledWith({
      videoId: "video",
      categoryId: "b",
    })
  );
});
it("removes a category without field values directly", async () => {
  show({ currentCategoryId: "a" });
  await choose("Keine Kategorie");
  await waitFor(() =>
    expect(state.mutate).toHaveBeenCalledWith({
      videoId: "video",
      categoryId: null,
    })
  );
});
it("warns before changing a category with stored field values", async () => {
  show({ currentCategoryId: "a", fieldValues: fields });
  await choose("Vegan");
  expect(screen.getByRole("dialog")).toHaveTextContent("Kalorien");
  expect(state.mutate).not.toHaveBeenCalled();
});
it("warns before removing a category with stored values", async () => {
  show({ currentCategoryId: "a", fieldValues: fields });
  await choose("Keine Kategorie");
  expect(screen.getByRole("dialog")).toHaveTextContent("Kategorie entfernen");
  expect(state.mutate).not.toHaveBeenCalled();
});
it("confirms a category change before notifying the parent", async () => {
  const change = vi.fn();
  show({
    currentCategoryId: "a",
    fieldValues: fields,
    onCategoryChange: change,
  });
  await choose("Vegan");
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: /Kategorie ändern/i,
    })
  );
  await waitFor(() => expect(change).toHaveBeenCalledWith("b"));
  expect(state.mutate).toHaveBeenCalledWith({
    videoId: "video",
    categoryId: "b",
    restoreBackup: false,
  });
});
it("cancels a category change without changing server state", async () => {
  show({ currentCategoryId: "a", fieldValues: fields });
  await choose("Vegan");
  await userEvent.click(screen.getByRole("button", { name: /Abbrechen/i }));
  expect(state.mutate).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not notify the parent after a failed mutation", async () => {
  const change = vi.fn();
  state.mutate.mockRejectedValueOnce(new Error("offline"));
  show({ onCategoryChange: change });
  await choose("Keto");
  await waitFor(() => expect(state.mutate).toHaveBeenCalled());
  expect(change).not.toHaveBeenCalled();
});
it("treats null field values as empty when changing categories", async () => {
  show({
    currentCategoryId: "a",
    fieldValues: [{ ...fields[0], value: null }] as VideoFieldValue[],
  });
  await choose("Vegan");
  await waitFor(() => expect(state.mutate).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
