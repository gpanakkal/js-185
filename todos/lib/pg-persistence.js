/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
const bcrypt = require('bcrypt');
const { dbQuery } = require('./db-query');

module.exports = class PGPersistence {
  constructor(session) {
    this.session = session;
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    const listQuery = 'SELECT * FROM todolists WHERE id = $1 AND username = $2';
    const todosQuery = 'SELECT * FROM todos WHERE todolist_id = $1 AND username = $2';

    const resultList = dbQuery(listQuery, todoListId, this.session.username);
    const resultTodos = dbQuery(todosQuery, todoListId, this.session.username);
    const result = await Promise.all([resultList, resultTodos]);

    const todoList = result[0].rows[0];
    if (todoList) todoList.todos = result[1].rows;
    return todoList;
  }

  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  async loadTodo(todoId) {
    const query = 'SELECT * FROM todos WHERE id = $1 AND username = $2';
    const result = await dbQuery(query, todoId, this.session.username);
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
    const ALL_TODOLISTS = 'SELECT * FROM todolists WHERE username = $1 ORDER BY LOWER(title) ASC';
    const FIND_TODOS = 'SELECT * FROM todos WHERE username = $1';

    const listsResult = dbQuery(ALL_TODOLISTS, this.session.username);
    const todosResult = dbQuery(FIND_TODOS, this.session.username);
    const result = await Promise.all([listsResult, todosResult]);
    const [todoLists, todos] = result.map((entry) => entry.rows);
    if (!todoLists || !todos) return undefined;

    todoLists.forEach((list) => {
      list.todos = todos.filter((todo) => todo.todolist_id === list.id);
    });

    return this._partitionTodoLists(todoLists);
  }

  async sortedTodos(todoList) {
    const SORTED_TODOS = 'SELECT * FROM todos '
                       + 'WHERE todolist_id = $1 AND username = $2 '
                       + 'ORDER BY done ASC, LOWER(title) ASC';

    const result = await dbQuery(SORTED_TODOS, todoList.id, this.session.username);
    return result.rows;
  }

  countAllTodos(list) {
    return list.todos.length;
  }

  countDoneTodos(list) {
    return list.todos.filter((todo) => todo.done).length;
  }

  async toggleDoneTodo(todoListId, todoId) {
    const updateQuery = 'UPDATE todos SET done = NOT done WHERE id = $1 AND username = $2';
    const updateResult = await dbQuery(updateQuery, todoId, this.session.username);
    return updateResult.rowCount > 0;
  }

  async deleteTodo(todoListId, todoId) {
    const deleteQuery = 'DELETE FROM todos WHERE id = $1 AND username = $2';
    const result = await dbQuery(deleteQuery, todoId, this.session.username);
    return result.rowCount;
  }

  // marks all todos on a given list as done
  async markAllDone(todoListId) {
    const query = 'UPDATE todos SET done = TRUE WHERE todolist_id = $1 AND NOT done AND username = $2';
    const result = await dbQuery(query, todoListId, this.session.username);
    return result.rowCount > 0;
  }

  async createTodo(todoListId, title) {
    const query = 'INSERT INTO todos (todolist_id, title, username) VALUES ($1, $2, $3)';
    const result = await dbQuery(query, todoListId, title, this.session.username);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(title) {
    const query = 'SELECT 1 FROM todolists WHERE LOWER(title) = LOWER($1) AND username = $2';
    const result = await dbQuery(query, title, this.session.username);
    return result.rowCount > 0;
  }

  async setListTitle(todoListId, newTitle) {
    const query = 'UPDATE todolists SET title = $1 WHERE id = $2 AND username = $3';
    const result = await dbQuery(query, newTitle, todoListId, this.session.username);
    return result.rowCount > 0;
  }

  async deleteList(todoListId) {
    const deleteQuery = 'DELETE FROM todolists WHERE id = $1 AND username = $2';
    const result = await dbQuery(deleteQuery, +todoListId, this.session.username);
    return result.rowCount > 0;
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async createTodoList(title) {
    const query = 'INSERT INTO todolists (title, username) VALUES ($1, $2)';
    try {
      const result = await dbQuery(query, title, this.session.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async validateUser(username, password) {
    const HASHED_PASSWORD_QUERY = 'SELECT password FROM users WHERE username = $1';
    const result = await dbQuery(HASHED_PASSWORD_QUERY, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // beware not to use this on already-hashed passwords!
  // async _hashExistingPasswords() {
  //   try {
  //     const result = await dbQuery('SELECT password FROM users');
  //     const updates = [];
  //     for (const row of result.rows) {
  //       const currentPassword = row.password;
  //       bcrypt.hash(currentPassword, 10, (_, hash) => {
  //         console.log({hash});
  //         const updateQuery = 'UPDATE users SET password = $1 WHERE password = $2';
  //         const updateResult = dbQuery(updateQuery, hash, currentPassword);
  //         updates.push(updateResult);
  //       });
  //     }
  //     await Promise.all(updates);
  //     return true;
  //   } catch(error) {
  //     console.error(error);
  //     return false;
  //   }
  // }
};
