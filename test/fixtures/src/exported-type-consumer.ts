// @ts-nocheck
// File that imports a type from another file

import { ImportedElsewhere } from './exported-type-provider.js';

function consumeImportedType(data: ImportedElsewhere) {
  console.log(data.data);
}
