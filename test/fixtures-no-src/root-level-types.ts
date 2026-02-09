// @ts-nocheck

// This fixture simulates a project that keeps .ts files at the root level
// rather than under a src/ directory (e.g., Deno projects)

interface SingleUseConfig {
  host: string;
  port: number;
}

function startServer(config: SingleUseConfig) {
  return config;
}
