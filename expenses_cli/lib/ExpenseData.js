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

  async _initializeTable() {
    const tableExistsQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test'"
    const tableExists = await this.client.query(tableExistsQuery);
    if (!tableExists) {
      await this.client.query('CREATE TABLE expenses (id serial PRIMARY KEY, amount decimal(6, 2) NOT NULL CHECK (amount > 0), memo text NOT NULL, created_on date NOT NULL)');
    }
  }

  async _execQuery(queryString, queryParams = undefined) {
    await this.client.connect().catch(logAndExit);
    const data = await this.client.query(queryString, queryParams).catch(logAndExit);
    await this.client.end().catch(logAndExit);
    return data;
  }

  _logFormattedRows(data) {
    if (data.rows.length === 0) return;
    const displayRows = ExpenseData.getFormattedRows(data);
    displayRows.forEach((displayRow) => console.log(displayRow));
  }

  displayExpenses(data) {
    const length = data.rows.length ? data.rows.length : 'no';
    const template = length === 1 ? 'There is 1 expense.' : `There are ${length} expenses.`;
    console.log(template);
    this._logFormattedRows(data);
  }

  displayTotal(data) {
    const total = data.rows.reduce((sum, current) => sum + Number(current.amount), 0.0);
    console.log('-'.repeat(49));
    const spaces = ' '.repeat(25); // placeholder for the dynamically generated width
    console.log(`Total${spaces}${total}`);
  }

  async listExpenses() {
    const data = await this._execQuery('SELECT * FROM expenses ORDER BY created_on ASC');
    this.displayExpenses(data);
    this.displayTotal(data);
  }

  async searchExpenses(term) {
    const queryString = 'SELECT * FROM expenses WHERE memo ILIKE $1 ORDER BY created_on ASC';
    const data = await this._execQuery(queryString, [`%${term}%`]);
    this.displayExpenses(data);
    this.displayTotal(data);
  }

  async addExpense({ amount, memo, date = new Date() }) {
    const formattedDate = date.toLocaleDateString();
    await this.client.connect().catch(logAndExit);
    const success = await this.client.query(
      'INSERT INTO expenses (amount, memo, created_on) VALUES ($1, $2, $3)',
      [amount, memo, formattedDate]
    ).catch(logAndExit);
    console.log(`Expense added with amount ${amount}, memo ${memo}, and date ${formattedDate}`);
    await this.client.end().catch(logAndExit);
  }

  async deleteExpense(id) {
    await this.client.connect().catch(logAndExit);
    const matches = await this.client.query('SELECT * FROM expenses WHERE id = $1', [id])
    .catch(logAndExit);
    if (!matches.rowCount) {
      console.log(`There is no expense with ID '${id}'.`);
    } else {
      const success = await this.client.query('DELETE FROM expenses WHERE id = $1', [id])
        .catch(logAndExit);
      if (success.rowCount) {
        console.log('The following expense has been deleted:');
        this._logFormattedRows(matches);
      }
    }
    await this.client.end().catch(logAndExit);
  }

  async deleteAllExpenses() {
    await this.client.connect().catch(logAndExit);
    console.log('beginning deletion');
    await this.client.query('DELETE FROM expenses').catch(logAndExit);
    console.log('All expenses have been deleted');
    await this.client.end().catch(logAndExit);
  }
}

module.exports = { ExpenseData };
