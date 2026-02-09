// @ts-nocheck
import { ApiOrder } from './interface-field-usage';

// Uses ApiOrder as a field — this is a type alias, not an interface.
// The tool should still count this as a usage of ApiOrder.
export type ApiUser = {
  name: string;
  lastOrder?: ApiOrder;
};
