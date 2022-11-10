class IIIFError extends Error {
  constructor (message, opts = {}) {
    super(message, opts);
    this.statusCode = opts.statusCode;
  }
}

module.exports = IIIFError;
