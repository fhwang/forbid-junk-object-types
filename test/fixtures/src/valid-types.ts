// @ts-nocheck
// File with valid type patterns that should NOT be flagged

// Valid: Used by multiple functions
interface MultiUseType {
  id: string;
  name: string;
}

function useMulti1(data: MultiUseType) {
  console.log(data.id);
}

function useMulti2(data: MultiUseType) {
  console.log(data.name);
}

// Valid: Exported type (could be used elsewhere)
export interface PublicAPI {
  version: string;
  endpoint: string;
}

function usePublicAPI(api: PublicAPI) {
  console.log(api.version);
}

// Valid: Interface that extends another
interface BaseInterface {
  id: string;
}

interface ExtendedInterface extends BaseInterface {
  name: string;
}

function useExtended(data: ExtendedInterface) {
  console.log(data.id, data.name);
}

// Valid: React Props pattern (ends with Props)
interface ComponentProps {
  title: string;
  onClick: () => void;
}

function MyComponent(props: ComponentProps) {
  return props.title;
}
