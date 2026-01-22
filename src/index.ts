function greet(name: string): string {
  return `Hello, ${name}!`;
}

function main(): void {
  const message = greet('TypeScript World');
  console.log(message);
  console.log('🎉 Custom TypeScript linter project initialized successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { greet, main };