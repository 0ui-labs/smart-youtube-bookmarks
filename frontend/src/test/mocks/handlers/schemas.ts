import { http, HttpResponse } from 'msw'
import type {
  FieldSchemaResponse,
  FieldSchemaCreate,
  FieldSchemaUpdate,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaFieldResponse,
  ApiErrorResponse,
} from '@/types/schema'

// Mock data
const mockSchemas: FieldSchemaResponse[] = [
  {
    id: 'schema-1',
    name: 'Video Quality',
    description: 'Standard quality metrics',
    list_id: 'list-1',
    created_at: '2025-11-07T10:00:00Z',
    updated_at: '2025-11-07T10:00:00Z',
    schema_fields: [
      {
        field_id: 'field-1',
        schema_id: 'schema-1',
        display_order: 0,
        show_on_card: true,
        field: {
          id: 'field-1',
          name: 'Presentation',
          field_type: 'rating',
          config: { max_rating: 10 },
          list_id: 'list-1',
          created_at: '2025-11-07T09:00:00Z',
          updated_at: '2025-11-07T09:00:00Z',
        },
      },
      {
        field_id: 'field-2',
        schema_id: 'schema-1',
        display_order: 1,
        show_on_card: true,
        field: {
          id: 'field-2',
          name: 'Content Rating',
          field_type: 'rating',
          config: { max_rating: 10 },
          list_id: 'list-1',
          created_at: '2025-11-07T09:00:00Z',
          updated_at: '2025-11-07T09:00:00Z',
        },
      },
    ],
  },
]

export const schemasHandlers = [
  // GET /lists/{listId}/schemas
  http.get('/api/lists/:listId/schemas', ({ params }) => {
    const { listId } = params
    const schemas = mockSchemas.filter((s) => s.list_id === listId)
    return HttpResponse.json(schemas)
  }),

  // GET /lists/{listId}/schemas/{schemaId}
  http.get('/api/lists/:listId/schemas/:schemaId', ({ params }) => {
    const { schemaId } = params
    const schema = mockSchemas.find((s) => s.id === schemaId)
    if (!schema) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: 'Schema not found' },
        { status: 404 }
      )
    }
    return HttpResponse.json(schema)
  }),

  // POST /lists/{listId}/schemas
  http.post('/api/lists/:listId/schemas', async ({ request, params }) => {
    const { listId } = params
    const body = (await request.json()) as FieldSchemaCreate

    // Check duplicate name
    const exists = mockSchemas.some(
      (s) => s.list_id === listId && s.name.toLowerCase() === body.name.toLowerCase()
    )
    if (exists) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: `Schema '${body.name}' already exists` },
        { status: 409 }
      )
    }

    const newSchema: FieldSchemaResponse = {
      id: `schema-${Date.now()}`,
      name: body.name,
      description: body.description ?? null,
      list_id: listId as string,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      schema_fields: body.fields?.map((f, index) => ({
        field_id: f.field_id,
        schema_id: `schema-${Date.now()}`,
        display_order: f.display_order ?? index,
        show_on_card: f.show_on_card ?? false,
        field: {
          id: f.field_id,
          name: 'Mock Field',
          field_type: 'rating',
          config: { max_rating: 10 },
          list_id: listId as string,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })) ?? [],
    }

    mockSchemas.push(newSchema)
    return HttpResponse.json(newSchema, { status: 201 })
  }),

  // PUT /lists/{listId}/schemas/{schemaId}
  http.put('/api/lists/:listId/schemas/:schemaId', async ({ request, params }) => {
    const { schemaId } = params
    const body = (await request.json()) as FieldSchemaUpdate

    const schemaIndex = mockSchemas.findIndex((s) => s.id === schemaId)
    if (schemaIndex === -1) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: 'Schema not found' },
        { status: 404 }
      )
    }

    const updatedSchema = {
      ...mockSchemas[schemaIndex],
      name: body.name ?? mockSchemas[schemaIndex].name,
      description: body.description ?? mockSchemas[schemaIndex].description,
      updated_at: new Date().toISOString(),
    }

    mockSchemas[schemaIndex] = updatedSchema
    return HttpResponse.json(updatedSchema)
  }),

  // DELETE /lists/{listId}/schemas/{schemaId}
  http.delete('/api/lists/:listId/schemas/:schemaId', ({ params }) => {
    const { schemaId } = params
    const schemaIndex = mockSchemas.findIndex((s) => s.id === schemaId)

    if (schemaIndex === -1) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: 'Schema not found' },
        { status: 404 }
      )
    }

    // Simulate 409 Conflict if schema used by tags (implement tag check if needed)
    // For now, always allow deletion in tests

    mockSchemas.splice(schemaIndex, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /lists/{listId}/schemas/{schemaId}/fields
  http.post(
    '/api/lists/:listId/schemas/:schemaId/fields',
    async ({ request, params }) => {
      const { schemaId } = params
      const body = (await request.json()) as SchemaFieldCreate

      const schema = mockSchemas.find((s) => s.id === schemaId)
      if (!schema) {
        return HttpResponse.json<ApiErrorResponse>(
          { detail: 'Schema not found' },
          { status: 404 }
        )
      }

      // Check duplicate field
      const exists = schema.schema_fields.some((sf) => sf.field_id === body.field_id)
      if (exists) {
        return HttpResponse.json<ApiErrorResponse>(
          { detail: 'Field already in schema' },
          { status: 409 }
        )
      }

      // Check max 3 show_on_card
      const showOnCardCount = schema.schema_fields.filter((sf) => sf.show_on_card).length
      if (body.show_on_card && showOnCardCount >= 3) {
        return HttpResponse.json<ApiErrorResponse>(
          { detail: 'Max 3 fields can have show_on_card=true' },
          { status: 409 }
        )
      }

      const newSchemaField: SchemaFieldResponse = {
        field_id: body.field_id,
        schema_id: schemaId as string,
        display_order: body.display_order,
        show_on_card: body.show_on_card ?? false,
        field: {
          id: body.field_id,
          name: 'Mock Field',
          field_type: 'rating',
          config: { max_rating: 10 },
          list_id: schema.list_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }

      schema.schema_fields.push(newSchemaField)
      return HttpResponse.json(newSchemaField, { status: 201 })
    }
  ),

  // PUT /lists/{listId}/schemas/{schemaId}/fields/{fieldId}
  http.put(
    '/api/lists/:listId/schemas/:schemaId/fields/:fieldId',
    async ({ request, params }) => {
      const { schemaId, fieldId } = params
      const body = (await request.json()) as SchemaFieldUpdate

      const schema = mockSchemas.find((s) => s.id === schemaId)
      if (!schema) {
        return HttpResponse.json<ApiErrorResponse>(
          { detail: 'Schema not found' },
          { status: 404 }
        )
      }

      const fieldIndex = schema.schema_fields.findIndex((sf) => sf.field_id === fieldId)
      if (fieldIndex === -1) {
        return HttpResponse.json<ApiErrorResponse>(
          { detail: 'Field not in schema' },
          { status: 404 }
        )
      }

      // Check max 3 show_on_card if toggling
      if (body.show_on_card !== undefined) {
        const showOnCardCount = schema.schema_fields.filter(
          (sf) => sf.show_on_card && sf.field_id !== fieldId
        ).length
        if (body.show_on_card && showOnCardCount >= 3) {
          return HttpResponse.json<ApiErrorResponse>(
            { detail: 'Max 3 fields can have show_on_card=true' },
            { status: 409 }
          )
        }
      }

      const updatedField = {
        ...schema.schema_fields[fieldIndex],
        display_order: body.display_order ?? schema.schema_fields[fieldIndex].display_order,
        show_on_card: body.show_on_card ?? schema.schema_fields[fieldIndex].show_on_card,
      }

      schema.schema_fields[fieldIndex] = updatedField
      return HttpResponse.json(updatedField)
    }
  ),

  // DELETE /lists/{listId}/schemas/{schemaId}/fields/{fieldId}
  http.delete('/api/lists/:listId/schemas/:schemaId/fields/:fieldId', ({ params }) => {
    const { schemaId, fieldId } = params

    const schema = mockSchemas.find((s) => s.id === schemaId)
    if (!schema) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: 'Schema not found' },
        { status: 404 }
      )
    }

    const fieldIndex = schema.schema_fields.findIndex((sf) => sf.field_id === fieldId)
    if (fieldIndex === -1) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: 'Field not in schema' },
        { status: 404 }
      )
    }

    schema.schema_fields.splice(fieldIndex, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
