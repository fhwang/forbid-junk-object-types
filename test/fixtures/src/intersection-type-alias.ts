// @ts-nocheck
// Reproduction for GitHub issue #10:
// A type referenced inside the type literal portion of an intersection
// type alias should be counted as a usage.

export interface ApiSubscription {
  id: number;
  plan: string;
  active: boolean;
}

export interface Visitor {
  sessionId: string;
}

// ApiSubscription is used as a field inside this intersection type alias.
// The tool should count this as a usage of ApiSubscription.
export type ApiUser = Visitor & {
  id: number;
  email: string;
  subscription?: ApiSubscription;
};
