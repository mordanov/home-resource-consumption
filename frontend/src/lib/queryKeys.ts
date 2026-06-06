export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bills: {
    all: ['bills'] as const,
    list: (params: Record<string, unknown>) => ['bills', 'list', params] as const,
    detail: (id: string) => ['bills', 'detail', id] as const,
  },
  predictions: {
    all: ['predictions'] as const,
    byResource: (resourceType: string, horizon: number, params?: object) =>
      ['predictions', resourceType, horizon, params] as const,
  },
  analytics: {
    summary: (params: Record<string, unknown>) => ['analytics', 'summary', params] as const,
  },
} as const
