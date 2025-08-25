export class IIIFError extends Error {
  statusCode?: number;

  constructor (message: string, opts: { statusCode?: number } = {}) {
    super(message);
    this.statusCode = opts.statusCode;
  }
}

export default IIIFError;
