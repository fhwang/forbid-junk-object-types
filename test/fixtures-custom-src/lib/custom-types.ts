// @ts-nocheck

// This fixture simulates a project that keeps .ts files under lib/ instead of src/

interface CustomConfig {
  name: string;
  value: number;
}

function useConfig(config: CustomConfig) {
  return config;
}
