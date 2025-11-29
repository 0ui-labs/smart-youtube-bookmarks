import { useMemo } from "react";
import type { CategoryFilters } from "@/types/filterSettings";
import { useCustomFields } from "./useCustomFields";
import { useSchema } from "./useSchemas";
import { useTags } from "./useTags";

/**
 * Hook to get custom fields grouped by category
 *
 * @param listId - List ID to fetch fields for
 * @param selectedTagIds - Selected category tag IDs
 * @returns Array of category filters with fields
 */
export function useFiltersByCategory(
  listId: string,
  selectedTagIds: string[]
): CategoryFilters[] {
  const { data: allFields = [] } = useCustomFields(listId);
  const { data: allTags = [] } = useTags();

  // Filter only selected tags that are categories (is_video_type=true)
  const selectedCategories = useMemo(
    () =>
      allTags.filter(
        (tag) => selectedTagIds.includes(tag.id) && tag.is_video_type
      ),
    [allTags, selectedTagIds]
  );

  // Load schemas for each selected category
  // Note: Using conditional hooks is OK here because we always call them,
  // just with undefined schemaId which makes useSchema return early
  const schema1 = useSchema(
    listId,
    selectedCategories[0]?.schema_id || undefined
  );
  const schema2 = useSchema(
    listId,
    selectedCategories[1]?.schema_id || undefined
  );
  const schema3 = useSchema(
    listId,
    selectedCategories[2]?.schema_id || undefined
  );
  const schema4 = useSchema(
    listId,
    selectedCategories[3]?.schema_id || undefined
  );
  const schema5 = useSchema(
    listId,
    selectedCategories[4]?.schema_id || undefined
  );

  const schemas = [schema1, schema2, schema3, schema4, schema5];

  return useMemo(() => {
    // Fallback: No categories selected - show all fields
    if (selectedTagIds.length === 0) {
      return [
        {
          categoryId: "all",
          categoryName: "Alle Felder",
          schemaId: null,
          fields: allFields,
        },
      ];
    }

    // Build CategoryFilters for each selected category
    return selectedCategories.map((category, index) => {
      const schema = schemas[index]?.data;
      const fields = schema?.schema_fields?.map((sf) => sf.field) || [];

      return {
        categoryId: category.id,
        categoryName: category.name,
        schemaId: category.schema_id ?? null, // Convert undefined to null
        fields,
      };
    });
  }, [selectedTagIds, allFields, selectedCategories, schemas]);
}
