import { AnySchema } from 'ajv';
import getAjv from './get-ajv';
import { AjvValidationError } from './erros/AjvValidationError';

export default function (schema: unknown): void {
  const ajv = getAjv();

  const isStructuralValid = ajv.validateSchema(schema as AnySchema);
  if (!isStructuralValid) throw new AjvValidationError(ajv.errors);

  try {
    ajv.compile(schema as AnySchema);
  } catch (error: any) {
    throw new AjvValidationError(error.message);
  }

  return;
}
