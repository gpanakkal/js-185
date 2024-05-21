const { dbQuery } = require("./db-query");

module.exports = class PGPersistence {
  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    const listQuery = 'SELECT * FROM todolists WHERE id = $1';
    const todosQuery = 'SELECT * FROM todos WHERE todolist_id = $1';

    const resultList = dbQuery(listQuery, todoListId);
    const resultTodos = dbQuery(todosQuery, todoListId);
    const result = await Promise.all([resultList, resultTodos]);

    const todoList = result[0].rows[0];
    if (todoList) todoList.todos = result[1].rows;
    return todoList;
  }

  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  async loadTodo(todoId) {
    const result = await dbQuery('SELECT * FROM todos WHERE id = $1', todoId);
    return result.rows[0];
  }

  isDoneTodoList(list) {
    return list.todos.length > 0 && list.todos.every((todo) => todo.done);
  }

  hasUndoneTodos(list) {
    return list.todos.some((todo) => !todo.done);
  }

  _partitionTodoLists(lists) {
    return lists
      .toSorted((a, b) => this.isDoneTodoList(a) - this.isDoneTodoList(b));
  }

  async sortedTodoLists() {
    const ALL_TODOLISTS = 'SELECT * FROM todolists ORDER BY LOWER(title) ASC';
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1';

    const listsResult = await dbQuery(ALL_TODOLISTS);
    const todoLists = listsResult.rows;

    for (const list of todoLists) {
      const todos = await dbQuery(FIND_TODOS, list.id);
      // console.log({rows: todos.rows });
      list.todos = todos.rows;
    }

    return this._partitionTodoLists(todoLists);
  }

  async sortedTodos(todoList) {
    const SORTED_TODOS = 'SELECT * FROM todos' +
                       '  WHERE todolist_id = $1' +
                       '  ORDER BY done ASC, LOWER(title) ASC';

    const result = await dbQuery(SORTED_TODOS, todoList.id)
    return result.rows;
  }

  countAllTodos(list) {
    return list.todos.length;
  }

  countDoneTodos(list) {
    return list.todos.filter((todo) => todo.done).length;
  }

  async toggleDoneTodo(todoId) {
    const updateQuery = 'UPDATE todos SET done = NOT done WHERE id = $1'
    const updateResult = await dbQuery(updateQuery, todoId);
    return updateResult.rowCount > 0;
  }

  async deleteTodo(todoId) {
    const deleteQuery = 'DELETE FROM todos WHERE id = $1';
    const result = await dbQuery(deleteQuery, todoId);
    return result.rowCount;
  }

  // marks all todos on a given list as done
  async markAllDone(todoListId) {
    const query = 'UPDATE todos SET done = TRUE WHERE todolist_id = $1 AND NOT done';
    const result = await dbQuery(query, todoListId);
    return result.rowCount > 0;
  }

  async createTodo(todoListId, title) {
    const query = 'INSERT INTO todos (todolist_id, title) VALUES ($1, $2)';
    const result = await dbQuery(query, todoListId, title);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(title) {
    const query = 'SELECT 1 FROM todolists WHERE LOWER(title) = LOWER($1)';
    const result = await dbQuery(query, title);
    return result.rowCount > 0;
  }

  async setListTitle(todoListId, newTitle) {
    const query = 'UPDATE todolists SET title = $1 WHERE id = $2';
    const result = await dbQuery(query, newTitle, todoListId);
    return result.rowCount > 0;
  }

  async deleteList(todoListId) {
    const deleteQuery = 'DELETE FROM todolists WHERE id = $1';
    const result = await dbQuery(deleteQuery, +todoListId);
    return result.rowCount > 0;
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async createTodoList(title) {
    const query = 'INSERT INTO todolists (title) VALUES ($1)';
    try {
      const result = await dbQuery(query, title);
      return result.rowCount > 0;
    } catch(error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
};
