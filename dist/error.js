"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IIIFError = void 0;
class IIIFError extends Error {
    constructor(message, opts = {}) {
        super(message);
        this.statusCode = opts.statusCode;
    }
}
exports.IIIFError = IIIFError;
exports.default = IIIFError;
