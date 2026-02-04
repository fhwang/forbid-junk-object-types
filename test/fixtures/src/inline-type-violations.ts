// @ts-nocheck
// File with inline object types that should be flagged

// Should flag: inline type in parameter
function withParam(opts: { name: string; count: number }) {
  console.log(opts.name, opts.count);
}

// Should flag: inline type in return type
function withReturn(): { success: boolean; message: string } {
  return { success: true, message: 'ok' };
}

// Should flag: inline type in variable declaration
const config: { timeout: number; retries: number } = { timeout: 5000, retries: 3 };

// Should flag: inline type in type assertion
declare const response: unknown;
const data = response as { id: string; value: number };

// Should flag: inline type in generic argument
const map: Map<string, { count: number }> = new Map();

// Should flag: inline type in destructured parameter
function withDestructure({ x, y }: { x: number; y: number }) {
  return x + y;
}

// Should flag: inline type in interface property
interface Parent {
  nested: { value: string };
}

// Ensure file is treated as module
export {};
