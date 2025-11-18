// Mock custom fields handlers for testing
// No default handlers - tests define their own via server.use()
// MSW configured with onUnhandledRequest: 'warn' to allow this pattern
export const customFieldsHandlers: never[] = []
