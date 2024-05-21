const { createInterface } = require('node:readline/promises');
const { ExpenseData } = require("./ExpenseData");

// const COMMANDS = [
//   'add AMOUNT MEMO [DATE] - record a new expense',
//   'clear - delete all expenses',
//   'list - list all expenses',
//   'delete NUMBER - remove expenses with id NUMBER',
//   'search QUERY - list expenses with a matching memo field',
// ];

class CLI {
  static COMMANDS = [
    'add AMOUNT MEMO [DATE] - record a new expense',
    'clear - delete all expenses',
    'list - list all expenses',
    'delete NUMBER - remove expenses with id NUMBER',
    'search QUERY - list expenses with a matching memo field',
  ];

  static showHelp() {
    const help = 'An expense recording system \n\nCommands:\n\n' + CLI.COMMANDS.join('\n');
    console.log(help);
  }

  constructor() {
    this.expenseData = new ExpenseData();
  }

  static init() {
    
  }

  run(args) {
    const operation = args[2];
    
    const OPERATION_MAP = {
      list: () => this.expenseData.listExpenses(),
      add: () => this.addExpenseInput(),
      search: () => this.expenseData.searchExpenses(args[3]),
      delete: () => this.expenseData.deleteExpense(args[3]),
      clear: () => this.verifyClear(),
    }
  
    if (!operation) {
      CLI.showHelp();  
    } else if (operation in OPERATION_MAP) {
      OPERATION_MAP[operation]();
    } else {
      console.log('Argument unrecognized');
    }
  }

  addExpenseInput() {
    const [amount, memo, date] = process.argv.slice(3, 6);
    if (!amount || !memo) {
      console.log('You must provide an amount and memo.');
    } else {
      this.expenseData.addExpense({ amount, memo, date });
    }
  }

  verifyClear() {
    console.log('This will irreversibly remove all expenses. Enter y to confirm');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      });

    rl.on('line', async (line) => {
      if (line.toLowerCase() === 'y') {
        await this.expenseData.deleteAllExpenses();
      } else {
        console.log('Deletion cancelled.');
      }
      process.exit();
    });
  }
}

module.exports = { CLI };
