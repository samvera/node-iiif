const { Base, ...passThrough } = require('./base');

class Calculator extends Base {}

module.exports = { Calculator, ...passThrough };
