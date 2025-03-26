const Logger = require('pizza-logger');
const config = require('./config');
const logger = new Logger(config);

module.exports = { logger };