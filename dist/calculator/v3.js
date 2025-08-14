"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calculator = void 0;
const base_1 = require("./base");
class Calculator extends base_1.Base {
    static _matchers() {
        const result = { ...super._matchers() };
        result.size = [...result.size].reduce((sizes, pattern) => {
            if (pattern !== 'full')
                sizes.push(`\\^?${pattern}`);
            return sizes;
        }, []);
        return result;
    }
    constructor(dims, opts = {}) {
        super(dims, opts);
        this._canonicalInfo.size = 'max';
        this._parsedInfo.upscale = false;
    }
    size(v) {
        if (v[0] === '^') {
            this._parsedInfo.upscale = true;
            v = v.slice(1, v.length);
        }
        return super.size(v);
    }
}
exports.Calculator = Calculator;
__exportStar(require("./base"), exports);
exports.default = { Calculator };
