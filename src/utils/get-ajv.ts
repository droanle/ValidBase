import Ajv from 'ajv';
import ajvKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';

export default function (): Ajv {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajvKeywords(ajv);
  addFormats(ajv);

  return ajv;
}
