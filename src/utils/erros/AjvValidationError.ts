export class AjvValidationError extends Error {
  constructor(private _details?: any) {
    super(
      'Invalid Input: The provided object does not follow the structural specification of JSON Schema.'
    );
  }

  public get details(): any {
    return this._details;
  }
}
