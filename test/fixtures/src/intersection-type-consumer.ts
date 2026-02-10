// @ts-nocheck
import { ApiSubscription } from './intersection-type-alias';

export function cancelSubscription(sub: ApiSubscription): void {
  console.log(sub.id);
}
