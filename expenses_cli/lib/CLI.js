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

  constructor() {
    this.expenseData = new ExpenseData();
  }
  static handleInput() {
    const operation = process.argv[2];
    
    const OPERATION_MAP = {
      list: ExpenseData.listExpenses,
      add: CLI.addExpenseInput,
    }
  
    if (!operation) {
      CLI.showHelp();  
    } else if (operation in OPERATION_MAP) {
      OPERATION_MAP[operation]();
    } else {
      console.log('Argument unrecognized');
    }
  }

  static showHelp() {
    const help = 'An expense recording system \n\nCommands:\n\n' + CLI.COMMANDS.join('\n');
    console.log(help);
  }

  static addExpenseInput() {
    const [amount, memo, date] = process.argv.slice(3, 6);
    if (!amount || !memo) {
      console.log('You must provide an amount and memo.');
    } else {
      ExpenseData.addExpense({ amount, memo, date });
    }
  }
}

module.exports = { CLI };
