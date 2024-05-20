import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;

const logQuery = async (queryText) => {
  const client = new Client();
  await client.connect();
  const data = await client.query(queryText);
  console.log(data.rows);
  client.end();
};

// examples
logQuery('SELECT * FROM directors');
logQuery('SELECT * FROM films');
