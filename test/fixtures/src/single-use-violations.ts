// @ts-nocheck
// File with intentional single-use type violations

// Should be flagged: interface used by only one function
interface SingleUseInterface {
  name: string;
  value: number;
}

function useSingleInterface(data: SingleUseInterface) {
  console.log(data.name, data.value);
}

// Should be flagged: type alias used by only one function
type SingleUseType = {
  id: string;
  count: number;
};

const useSingleType = (params: SingleUseType) => {
  return params.id + params.count;
};

// Should be flagged: another single-use type
interface BadOptions {
  timeout: number;
  retries: number;
}

function processWithOptions(opts: BadOptions) {
  console.log(opts.timeout, opts.retries);
}
