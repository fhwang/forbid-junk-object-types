// @ts-nocheck
// Reproduction for GitHub issue #7:
// A type used as a function parameter AND as a field in another interface
// should NOT be flagged as single-use.

export interface ApiOrder {
  id: string;
  createdAt: string;
  total: string;
}

export interface Order {
  id: string;
  createdAt: Date;
  total: number;
}

export const deserializeOrder = (apiOrder: ApiOrder): Order => ({
  ...apiOrder,
  createdAt: new Date(apiOrder.createdAt),
  total: parseFloat(apiOrder.total),
});
