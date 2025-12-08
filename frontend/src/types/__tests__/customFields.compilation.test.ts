import { describe, expectTypeOf, it } from "vitest";
import type {
  BooleanConfig,
  CustomField,
  CustomFieldCreate,
  CustomFieldUpdate,
  FieldConfig,
  FieldSchemaCreate,
  FieldSchemaResponse,
  FieldSchemaUpdate,
  FieldType,
  RatingConfig,
  SchemaFieldInput,
  SelectConfig,
  TextConfig,
  VideoFieldValue,
} from "../customFields";

/**
 * Compilation tests for custom fields types
 *
 * These tests verify type-level correctness and ensure TypeScript inference works correctly.
 * REF MCP Improvement #3: Better compilation tests with expectTypeOf
 */

describe("Type-level tests", () => {
  describe("FieldType", () => {
    it("should only accept valid field types", () => {
      // Valid types
      expectTypeOf<FieldType>().toMatchTypeOf<"select">();
      expectTypeOf<FieldType>().toMatchTypeOf<"rating">();
      expectTypeOf<FieldType>().toMatchTypeOf<"text">();
      expectTypeOf<FieldType>().toMatchTypeOf<"boolean">();

      // Invalid types should not match
      expectTypeOf<FieldType>().not.toMatchTypeOf<"invalid">();
      expectTypeOf<FieldType>().not.toMatchTypeOf<string>();
      expectTypeOf<FieldType>().not.toMatchTypeOf<number>();
    });
  });

  describe("SelectConfig", () => {
    it("should require options array with at least 1 element", () => {
      const validConfig: SelectConfig = { options: ["option1"] };
      expectTypeOf(validConfig).toMatchTypeOf<SelectConfig>();

      const validConfig2: SelectConfig = { options: ["option1", "option2"] };
      expectTypeOf(validConfig2).toMatchTypeOf<SelectConfig>();

      // Empty array should fail at type level (non-empty tuple)
      // @ts-expect-error - Empty array is not assignable to non-empty tuple
      const _invalidConfig: SelectConfig = { options: [] };
    });
  });

  describe("RatingConfig", () => {
    it("should require max_rating number", () => {
      const validConfig: RatingConfig = { max_rating: 5 };
      expectTypeOf(validConfig).toMatchTypeOf<RatingConfig>();

      // Missing max_rating should fail
      // @ts-expect-error - max_rating is required
      const _invalidConfig: RatingConfig = {};
    });
  });

  describe("TextConfig", () => {
    it("should allow optional max_length", () => {
      const validConfig1: TextConfig = { max_length: 500 };
      expectTypeOf(validConfig1).toMatchTypeOf<TextConfig>();

      const validConfig2: TextConfig = {};
      expectTypeOf(validConfig2).toMatchTypeOf<TextConfig>();
    });
  });

  describe("BooleanConfig", () => {
    it("should only accept empty object", () => {
      const validConfig: BooleanConfig = {};
      expectTypeOf(validConfig).toMatchTypeOf<BooleanConfig>();

      // Non-empty object should fail
      // @ts-expect-error - BooleanConfig must be empty
      const _invalidConfig: BooleanConfig = { foo: "bar" };
    });
  });

  describe("FieldConfig", () => {
    it("should accept all config types", () => {
      const selectConfig: SelectConfig = { options: ["option1"] };
      expectTypeOf(selectConfig).toMatchTypeOf<FieldConfig>();

      const ratingConfig: RatingConfig = { max_rating: 5 };
      expectTypeOf(ratingConfig).toMatchTypeOf<FieldConfig>();

      const textConfig: TextConfig = { max_length: 500 };
      expectTypeOf(textConfig).toMatchTypeOf<FieldConfig>();

      const booleanConfig: BooleanConfig = {};
      expectTypeOf(booleanConfig).toMatchTypeOf<FieldConfig>();
    });
  });

  describe("CustomField", () => {
    it("should have all required fields", () => {
      const field: CustomField = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        list_id: "987fcdeb-51a2-43d1-9012-345678901234",
        name: "Overall Rating",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-11-06T10:30:00Z",
        updated_at: "2025-11-06T10:30:00Z",
      };

      expectTypeOf(field).toMatchTypeOf<CustomField>();
      expectTypeOf(field.id).toBeString();
      expectTypeOf(field.list_id).toBeString();
      expectTypeOf(field.name).toBeString();
      expectTypeOf(field.field_type).toMatchTypeOf<FieldType>();
      expectTypeOf(field.config).toMatchTypeOf<FieldConfig>();
      expectTypeOf(field.created_at).toBeString();
      expectTypeOf(field.updated_at).toBeString();
    });

    it("should not allow missing required fields", () => {
      // @ts-expect-error - Missing required fields
      const _invalidField: CustomField = {
        name: "Overall Rating",
        field_type: "rating",
      };
    });
  });

  describe("CustomFieldCreate", () => {
    it("should have required fields for creation", () => {
      const request: CustomFieldCreate = {
        name: "Overall Rating",
        field_type: "rating",
        config: { max_rating: 5 },
      };

      expectTypeOf(request).toMatchTypeOf<CustomFieldCreate>();
      expectTypeOf(request.name).toBeString();
      expectTypeOf(request.field_type).toMatchTypeOf<FieldType>();
      expectTypeOf(request.config).toMatchTypeOf<FieldConfig>();
    });

    it("should not have id or timestamps", () => {
      const request: CustomFieldCreate = {
        name: "Overall Rating",
        field_type: "rating",
        config: { max_rating: 5 },
      };

      // @ts-expect-error - id should not exist on CustomFieldCreate
      expectTypeOf(request.id).toBeNever();

      // @ts-expect-error - created_at should not exist on CustomFieldCreate
      expectTypeOf(request.created_at).toBeNever();

      // @ts-expect-error - updated_at should not exist on CustomFieldCreate
      expectTypeOf(request.updated_at).toBeNever();
    });
  });

  describe("CustomFieldUpdate", () => {
    it("should have all fields optional", () => {
      const nameOnly: CustomFieldUpdate = { name: "Updated Name" };
      expectTypeOf(nameOnly).toMatchTypeOf<CustomFieldUpdate>();

      const configOnly: CustomFieldUpdate = { config: { max_rating: 10 } };
      expectTypeOf(configOnly).toMatchTypeOf<CustomFieldUpdate>();

      const empty: CustomFieldUpdate = {};
      expectTypeOf(empty).toMatchTypeOf<CustomFieldUpdate>();
    });
  });

  describe("SchemaFieldInput", () => {
    it("should have required fields", () => {
      const input: SchemaFieldInput = {
        field_id: "123e4567-e89b-12d3-a456-426614174000",
        display_order: 0,
        show_on_card: true,
      };

      expectTypeOf(input).toMatchTypeOf<SchemaFieldInput>();
      expectTypeOf(input.field_id).toBeString();
      expectTypeOf(input.display_order).toBeNumber();
      expectTypeOf(input.show_on_card).toBeBoolean();
    });

    it("should not allow missing required fields", () => {
      // @ts-expect-error - Missing required fields
      const _invalidInput: SchemaFieldInput = {
        field_id: "123e4567-e89b-12d3-a456-426614174000",
      };
    });
  });

  describe("FieldSchemaCreate", () => {
    it("should have required name and optional description/fields", () => {
      const minimal: FieldSchemaCreate = {
        name: "Video Quality",
      };
      expectTypeOf(minimal).toMatchTypeOf<FieldSchemaCreate>();

      const withFields: FieldSchemaCreate = {
        name: "Video Quality",
        description: "Standard quality metrics",
        fields: [
          {
            field_id: "123e4567-e89b-12d3-a456-426614174000",
            display_order: 0,
            show_on_card: true,
          },
        ],
      };
      expectTypeOf(withFields).toMatchTypeOf<FieldSchemaCreate>();
    });

    it("should not allow missing name", () => {
      // @ts-expect-error - name is required
      const _invalid: FieldSchemaCreate = {
        description: "Standard quality metrics",
      };
    });
  });

  describe("FieldSchemaUpdate", () => {
    it("should have all fields optional", () => {
      const nameOnly: FieldSchemaUpdate = { name: "Updated Name" };
      expectTypeOf(nameOnly).toMatchTypeOf<FieldSchemaUpdate>();

      const descriptionOnly: FieldSchemaUpdate = {
        description: "Updated description",
      };
      expectTypeOf(descriptionOnly).toMatchTypeOf<FieldSchemaUpdate>();

      const empty: FieldSchemaUpdate = {};
      expectTypeOf(empty).toMatchTypeOf<FieldSchemaUpdate>();
    });
  });

  describe("FieldSchemaResponse", () => {
    it("should have all required fields including schema_fields", () => {
      const response: FieldSchemaResponse = {
        id: "987fcdeb-51a2-43d1-9012-345678901234",
        list_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Video Quality",
        description: "Standard quality metrics",
        schema_fields: [],
        created_at: "2025-11-06T09:00:00Z",
        updated_at: "2025-11-06T09:00:00Z",
      };

      expectTypeOf(response).toMatchTypeOf<FieldSchemaResponse>();
      expectTypeOf(response.id).toBeString();
      expectTypeOf(response.list_id).toBeString();
      expectTypeOf(response.name).toBeString();
      expectTypeOf(response.schema_fields).toBeArray();
    });
  });

  describe("VideoFieldValue", () => {
    it("should have all required fields", () => {
      const value: VideoFieldValue = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        video_id: "987fcdeb-51a2-43d1-9012-345678901234",
        field_id: "111e4567-e89b-12d3-a456-426614174000",
        value_text: null,
        value_numeric: 4.5,
        value_boolean: null,
        updated_at: "2025-11-06T10:30:00Z",
      };

      expectTypeOf(value).toMatchTypeOf<VideoFieldValue>();
      expectTypeOf(value.id).toBeString();
      expectTypeOf(value.video_id).toBeString();
      expectTypeOf(value.field_id).toBeString();
      expectTypeOf(value.value_text).toMatchTypeOf<string | null>();
      expectTypeOf(value.value_numeric).toMatchTypeOf<number | null>();
      expectTypeOf(value.value_boolean).toMatchTypeOf<boolean | null>();
      expectTypeOf(value.updated_at).toBeString();
    });

    it("should not have created_at field", () => {
      const value: VideoFieldValue = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        video_id: "987fcdeb-51a2-43d1-9012-345678901234",
        field_id: "111e4567-e89b-12d3-a456-426614174000",
        value_text: null,
        value_numeric: 4.5,
        value_boolean: null,
        updated_at: "2025-11-06T10:30:00Z",
      };

      // @ts-expect-error - created_at should not exist on VideoFieldValue
      expectTypeOf(value.created_at).toBeNever();
    });
  });
});
