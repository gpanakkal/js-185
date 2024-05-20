const { Client } = require('pg');

const AMOUNT_MIN_WIDTH = 12;
const COLUMN_SEPARATOR = ' | ';

function logAndExit(rejectedPromise) {
  console.error(rejectedPromise);
  process.exit(1);
}

class ExpenseData {
  static normalizeCellWidths(data) {
    // for each column, get the width of the widest cell
    Object.keys(data.rows[0]).map((key) => {
      // reduce over column, returning the max length
      const maxWidth = data.rows
      .reduce((max, current) => {
        const currentLength = String(current[key]).length;
        return max < currentLength ? currentLength : max;
      }, '');
      console.log({ key, maxWidth })
      // pad the start of all column cells to match the widest
      data.rows.forEach((row) => {
        row[key] = String(row[key]).padStart(maxWidth, ' ');
      });
    });
  }

  static getFormattedRows(data) {
    // transform rows into formatted strings
    ExpenseData.normalizeCellWidths(data);
    // order fields and concatenate row values
    const displayRows = data.rows.map((row) => {
      const formattedDate = new Date(row.created_on).toDateString();
      const formattedAmount = row.amount.padStart(AMOUNT_MIN_WIDTH, ' ');
      const orderedRow = [row.id, formattedDate, formattedAmount, row.memo];    
      return orderedRow.join(COLUMN_SEPARATOR);
    });
  
    return displayRows;
  }

  constructor() {
    this.client = new Client();
  }

  async _logQuery(queryString) {
    await this.client.connect().catch(logAndExit);
    const data = await this.client.query(queryString).catch(logAndExit);
    await this.client.end().catch(logAndExit);
  
    const displayRows = ExpenseData.getFormattedRows(data);
    displayRows.forEach((displayRow) => console.log(displayRow));
    await this.client.end();
  }

  listExpenses() {
    this._logQuery('SELECT * FROM expenses ORDER BY created_on ASC');
  }

  async addExpense({ amount, memo, date = new Date() }) {
    const formattedDate = date.toLocaleDateString();
    await this.client.connect().catch(logAndExit);
    const success = await this.client.query(
      'INSERT INTO expenses (amount, memo, created_on) VALUES ($1, $2, $3)',
      [amount, memo, formattedDate]
    ).catch(logAndExit);
    // console.log({ success: Array.isArray(success.rows) });
    await this.client.end().catch(logAndExit);
  }


}

module.exports = { ExpenseData };
