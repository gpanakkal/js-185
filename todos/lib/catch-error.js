/**
 * Wrapper to abstract away try/catch blocks in Express middleware
 * @param {*} handler async middleware
 * @returns new middleware
 */
const catchError = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

module.exports = catchError;
