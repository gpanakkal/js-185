const { Client } = require('pg');

const MIN_WIDTHS = {
  id: 1,
  amount: 12,
  memo: 12,
  created_on: 15,
}
const COLUMN_SEPARATOR = ' | ';

function logAndExit(rejectedPromise) {
  console.error(rejectedPromise);
  process.exit(1);
}

class ExpenseData {
  static getColumnWidths(data) {
    // for each column, get the width of the widest cell
    return Object.keys(data.rows[0]).reduce((acc, key) => {
      // reduce over column, returning the max length
      const maxWidth = data.rows
      .reduce((max, current) => {
        const value = key === 'created_on' 
          ? new Date(current[key]).toDateString() 
          : current[key];
        const currentLength = String(value).length;
        const lengthToUse = Math.max(MIN_WIDTHS[key], currentLength);
        return max < lengthToUse ? lengthToUse : max;
      }, '');
        return Object.assign(acc, { [key]: maxWidth });
    }, {});
  }

  static normalizeCellWidths(data) {
    const columnWidths = ExpenseData.getColumnWidths(data);
    Object.keys(data.rows[0]).map((key) => {
      // pad the start of all column cells to match the widest
      data.rows.forEach((row) => {
        row[key] = String(row[key]).padStart(columnWidths[key], ' ');
      });
    });
  }

  static formattedRows(data) {
    // transform rows into formatted strings
    ExpenseData.normalizeCellWidths(data);
    // order fields and concatenate row values
    const displayRows = data.rows.map((row) => {
      const formattedDate = new Date(row.created_on).toDateString();
      const formattedAmount = row.amount.padStart(MIN_WIDTHS.amount, ' ');
      const orderedRow = [row.id, formattedDate, row.amount, row.memo];    
      return orderedRow.join(COLUMN_SEPARATOR);
    });
  
    return displayRows;
  }

  static _logFormattedRows(data) {
    if (data.rows.length === 0) return;
    const displayRows = ExpenseData.formattedRows(data);
    displayRows.forEach((displayRow) => console.log(displayRow));
  }

  static displayTotal(data) {
    const total = data.rows.reduce((sum, current) => sum + Number(current.amount), 0.0);
    const columnWidths = ExpenseData.getColumnWidths(data);
    
    const allColumnWidth = Object.values(columnWidths)
      .reduce((sum, current) => sum + current, 0);
    const separatorWidth = (Object.keys(columnWidths).length - 1) * COLUMN_SEPARATOR.length;
    const totalWidth = allColumnWidth + separatorWidth;
    const totalPrefix = 'Total';
    const amountOffset = columnWidths.id + columnWidths.created_on + columnWidths.amount + 2 * COLUMN_SEPARATOR.length - String(total).length - totalPrefix.length;
    const spaces = ' '.repeat(amountOffset); // placeholder for the dynamically generated width
    console.log('-'.repeat(totalWidth));
    console.log(`${totalPrefix}${spaces}${total}`);
  }

  static displayExpenses(data) {
    const length = data.rows.length ? data.rows.length : 'no';
    const template = length === 1 ? 'There is 1 expense.' : `There are ${length} expenses.`;
    console.log(template);
    this._logFormattedRows(data);
    if (length > 0) this.displayTotal(data);
  }

  async _setupSchema(client) {
    const tableExistsQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses'"
    const result = await client.query(tableExistsQuery).catch(logAndExit);
    const tableExists = result.rows[0].count === '1';
    // console.log({tableExists: tableExists})
    if (!tableExists) {
      await client.query('CREATE TABLE expenses (id serial PRIMARY KEY, amount decimal(6, 2) NOT NULL CHECK (amount > 0), memo text NOT NULL, created_on date NOT NULL)');
    }
  }

  async _execQuery(queryString, queryParams = undefined) {
    const client = new Client();
    await client.connect().catch(logAndExit);
    await this._setupSchema(client);
    const data = await client.query(queryString, queryParams).catch(logAndExit);
    await client.end().catch(logAndExit);
    return data;
  }

  async listExpenses() {
    const data = await this._execQuery('SELECT * FROM expenses ORDER BY created_on ASC');
    ExpenseData.displayExpenses(data);
  }

  async searchExpenses(term) {
    const queryString = 'SELECT * FROM expenses WHERE memo ILIKE $1 ORDER BY created_on ASC';
    const data = await this._execQuery(queryString, [`%${term}%`]);
    ExpenseData.displayExpenses(data);
  }

  async addExpense({ amount, memo, date = new Date() }) {
    const formattedDate = new Date(date).toLocaleDateString();
    const queryString = 'INSERT INTO expenses (amount, memo, created_on) VALUES ($1, $2, $3)';
    const success = await this._execQuery(queryString, [amount, memo, formattedDate]);
    console.log(`Expense added with amount ${amount}, memo ${memo}, and date ${formattedDate}`);
  }

  async deleteExpense(id) {
    const selectQuery = 'SELECT * FROM expenses WHERE id = $1';
    const matches = await this._execQuery(selectQuery, [id]);
    if (!matches.rowCount) {
      console.log(`There is no expense with ID '${id}'.`);
      return;
    }
    const deleteQuery = 'DELETE FROM expenses WHERE id = $1';
    const success = await this._execQuery(deleteQuery, [id]);
    if (success.rowCount) {
      console.log('The following expense has been deleted:');
      this._logFormattedRows(matches);
    }
  }

  async deleteAllExpenses() {
    // console.log('beginning deletion');
    this._execQuery('DELETE FROM expenses');
    console.log('All expenses have been deleted.');
  }
}

module.exports = { ExpenseData };
