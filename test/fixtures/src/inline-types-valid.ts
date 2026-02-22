// @ts-nocheck
// File with valid patterns that should NOT be flagged

// Should NOT flag: generic constraint (exempted)
function withConstraint<T extends { id: string }>(item: T) {
  return item.id;
}

// Should NOT flag: generic constraint with multiple properties
function withComplexConstraint<T extends { id: string; name: string }>(item: T) {
  return item.id + item.name;
}

// Should NOT flag: inline type in return type (return types are exempted)
function getStatus(): { success: boolean; message: string } {
  return { success: true, message: 'ok' };
}

// Ensure file is treated as module
export {};
