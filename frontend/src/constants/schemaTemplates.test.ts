import { describe, expect, it } from "vitest";
import {
  getTemplateById,
  getTemplatesByCategory,
  SCHEMA_TEMPLATES,
  validateTemplate,
} from "./schemaTemplates";

describe("Schema Templates", () => {
  it("should have 5 predefined templates", () => {
    expect(SCHEMA_TEMPLATES).toHaveLength(5);
  });

  it("should have unique template IDs", () => {
    const ids = SCHEMA_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have all required fields for each template", () => {
    SCHEMA_TEMPLATES.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.icon).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.fields.length).toBeGreaterThan(0);
    });
  });

  it("should have valid field configurations", () => {
    SCHEMA_TEMPLATES.forEach((template) => {
      template.fields.forEach((field) => {
        expect(field.name).toBeTruthy();
        expect(["select", "rating", "text", "boolean"]).toContain(
          field.field_type
        );
        expect(typeof field.display_order).toBe("number");
        expect(field.display_order).toBeGreaterThanOrEqual(0);
        expect(typeof field.show_on_card).toBe("boolean");

        // Type-specific validation
        if (field.field_type === "select") {
          expect(Array.isArray(field.config.options)).toBe(true);
          expect(field.config.options.length).toBeGreaterThan(0);
        }
        if (field.field_type === "rating") {
          expect(field.config.max_rating).toBeDefined();
          expect(field.config.max_rating).toBeGreaterThanOrEqual(1);
          expect(field.config.max_rating).toBeLessThanOrEqual(10);
        }
      });
    });
  });

  it("should respect show_on_card limit (max 3 per template)", () => {
    SCHEMA_TEMPLATES.forEach((template) => {
      const shownOnCard = template.fields.filter((f) => f.show_on_card);
      expect(shownOnCard.length).toBeLessThanOrEqual(3);
    });
  });

  it("should have unique display_order within each template", () => {
    SCHEMA_TEMPLATES.forEach((template) => {
      const orders = template.fields.map((f) => f.display_order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    });
  });

  it("should retrieve template by ID", () => {
    const template = getTemplateById("video-quality-v1");
    expect(template).toBeDefined();
    expect(template?.name).toBe("Video Quality Assessment");
  });

  it("should return undefined for non-existent template ID", () => {
    const template = getTemplateById("non-existent");
    expect(template).toBeUndefined();
  });

  it("should filter templates by category", () => {
    const educationTemplates = getTemplatesByCategory("education");
    expect(educationTemplates.length).toBeGreaterThan(0);
    educationTemplates.forEach((t) => {
      expect(t.category).toBe("education");
    });
  });

  it("should validate templates with Zod", () => {
    SCHEMA_TEMPLATES.forEach((template) => {
      expect(() => validateTemplate(template)).not.toThrow();
    });
  });

  it("should reject invalid template with Zod", () => {
    const invalidTemplate = {
      id: "invalid",
      name: "", // Empty name (invalid)
      description: "Test",
      icon: "Star",
      category: "general",
      fields: [],
    };

    expect(() => validateTemplate(invalidTemplate)).toThrow();
  });
});
