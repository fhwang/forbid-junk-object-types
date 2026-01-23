// @ts-nocheck
// File with intentional inline object type violations

// Function parameter
function processUser(user: { id: string; name: string }) {
  console.log(user.id, user.name);
}

// Function return type
function getConfig(): { timeout: number; retries: number } {
  return { timeout: 5000, retries: 3 };
}

// Variable declaration
const settings: { theme: string; lang: string } = {
  theme: 'dark',
  lang: 'en',
};

// Arrow function parameter
const handler = (opts: { x: number; y: number }) => {
  return opts.x + opts.y;
};

// Nested in type alias
type UserProfile = {
  personal: { firstName: string; lastName: string };
  contact: { email: string };
};

// In array type
const items: Array<{ id: number; label: string }> = [];

// Multiple parameters with inline objects
function merge(
  a: { value: number },
  b: { value: number }
): { value: number } {
  return { value: a.value + b.value };
}

// Index signature (should be flagged)
const map: { [key: string]: number } = {};

// Property declaration in class
class Widget {
  config: { width: number; height: number } = { width: 100, height: 100 };
}

// Type assertion
const data = JSON.parse('{}') as { name: string; age: number };
