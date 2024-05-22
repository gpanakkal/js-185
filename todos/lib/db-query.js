const { Client } = require('pg');

const logQuery = (statement, params) => {
  const timestamp = new Date();
  const formattedTimeStamp = timestamp.toString().substring(4, 24);
  console.log(formattedTimeStamp, statement, params);
};

module.exports = {
  async dbQuery(statement, ...params) {
    const client = new Client();
    await client.connect();
    logQuery(statement, params);
    const data = await client.query(statement, params);
    await client.end();
    return data;
  },
};
