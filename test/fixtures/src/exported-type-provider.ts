// @ts-nocheck
// File that exports types - some are imported elsewhere, some are not

// This type IS imported by exported-type-consumer.ts - should NOT be flagged
export interface ImportedElsewhere {
  id: string;
  data: string;
}

function useImportedElsewhere(data: ImportedElsewhere) {
  console.log(data.id);
}

// This type is NOT imported anywhere else - SHOULD be flagged
export interface ExportedButLocalOnly {
  name: string;
  value: number;
}

function useExportedButLocalOnly(data: ExportedButLocalOnly) {
  console.log(data.name);
}
