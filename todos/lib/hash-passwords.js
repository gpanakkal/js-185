require('dotenv').config();
const PGPersistence = require('./pg-persistence');

(async () => {
  const store = new PGPersistence();
  const hashSuccessful = await store._hashExistingPasswords();
  console.log({ hashSuccessful });
})();
