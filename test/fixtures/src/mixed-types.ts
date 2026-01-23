// @ts-nocheck
// File with both violations and valid patterns

// Should be flagged
interface BadConfig {
  timeout: number;
}

function configure(config: BadConfig) {
  console.log(config.timeout);
}

// Valid: multiple uses
interface GoodUser {
  id: string;
  email: string;
}

function createUser(user: GoodUser) {
  return user.id;
}

function updateUser(user: GoodUser) {
  return user.email;
}

// Should be flagged
type SingleParam = {
  value: string;
};

const processSingle = (p: SingleParam) => p.value;
