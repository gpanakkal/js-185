const { Client } = require('pg');

const AMOUNT_MIN_WIDTH = 12;
const COLUMN_SEPARATOR = ' | ';

class ExpenseData {
  static logAndExit(rejectedPromise) {
    console.error(rejectedPromise);
    process.exit(1);
  }

  static normalizeCellWidths(data) {
    // for each column, get the width of the widest cell
    Object.keys(data.rows[0]).map((key) => {
      // reduce over column, returning the max length
      const maxWidth = data.rows
      .reduce((max, current) => max < current[key].length ? current[key].length : max, '');
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

  static async _logQuery(queryString) {
    let data;
    await this.client.connect().catch(ExpenseData.logAndExit);
    data = await this.client.query(queryString).catch(ExpenseData.logAndExit);
    await this.client.end().catch(ExpenseData.logAndExit);
  
    const displayRows = ExpenseData.getFormattedRows(data);
    displayRows.forEach((displayRow) => console.log(displayRow));
    await this.client.end();
  }

  static listExpenses() {
    ExpenseData._logQuery('SELECT * FROM expenses ORDER BY created_on ASC');
  }

  static async addExpense({ amount, memo, date = new Date() }) {
    const formattedDate = date.toLocaleDateString();
    await this.client.connect().catch(ExpenseData.logAndExit);
    const success = await this.client.query(
      'INSERT INTO expenses (amount, memo, created_on) VALUES ($1, $2, $3)',
      [amount, memo, formattedDate]
    ).catch(ExpenseData.logAndExit);
    // console.log({ success: Array.isArray(success.rows) });
    await this.client.end().catch(ExpenseData.logAndExit);
  }


}

module.exports = { ExpenseData };
