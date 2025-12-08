import { useMutation, useQuery } from "@tanstack/react-query";

// Mock API responses
const mockFields = [
  {
    id: "1",
    name: "Presentation Quality",
    field_type: "select" as const,
    config: { options: ["bad", "good", "great"] },
    list_id: "list-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Overall Rating",
    field_type: "rating" as const,
    config: { max_rating: 5 },
    list_id: "list-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Difficulty Level",
    field_type: "text" as const,
    config: { max_length: 100 },
    list_id: "list-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Is Tutorial",
    field_type: "boolean" as const,
    config: {},
    list_id: "list-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function useCustomFields(listId: string) {
  return useQuery({
    queryKey: ["custom-fields", listId],
    queryFn: async () => mockFields,
    enabled: !!listId,
  });
}

export function useCheckFieldDuplicate(
  listId: string,
  name: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["field-duplicate", listId, name],
    queryFn: async () => {
      // Simulate 300ms API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const exists = mockFields.some(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );
      return {
        exists,
        field: exists
          ? mockFields.find((f) => f.name.toLowerCase() === name.toLowerCase())
          : null,
      };
    },
    enabled: (options?.enabled ?? true) && name.length > 0,
    staleTime: 30_000, // Cache for 30 seconds
  });
}

export function useCreateField(listId: string) {
  return useMutation({
    mutationFn: async (data: any) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        id: Date.now().toString(),
        ...data,
        list_id: listId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
  });
}
