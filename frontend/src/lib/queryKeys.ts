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
    byResource: (resourceType: string, horizon: number) =>
      ['predictions', resourceType, horizon] as const,
  },
  analytics: {
    summary: (params: Record<string, unknown>) => ['analytics', 'summary', params] as const,
  },
} as const
