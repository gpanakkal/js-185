const seedData = require("./seed-data");
const deepCopy = require('./deep-copy');
const { sortTodoLists, sortTodos } = require("./sort");
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(seedData);
    session.todoLists = this._todoLists;
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  loadTodoList(todoListId) {
    return deepCopy(this._findTodoList(todoListId));
  }

  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  loadTodo(todoListId, todoId) {
    const todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  isDoneTodoList(list) {
    return list.todos.length > 0 && list.todos.every((todo) => todo.done);
  }

  hasUndoneTodos(list) {
    return list.todos.some((todo) => !todo.done);
  }

  sortedTodoLists() {
    const todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  sortedTodos(todoList) {
    const undone = todoList.todos.filter((todo) => !todo.done);
    const done = todoList.todos.filter((todo) => todo.done);
    return sortTodos(undone, done);
  }

  countAllTodos(list) {
    return list.todos.length;
  }

  countDoneTodos(list) {
    return list.todos.filter((todo) => todo.done).length;
  }

  _findTodoList(todoListId) {
    return this._todoLists.find((list) => list.id === todoListId);
  }

  _findTodo(todoListId, todoId) {
    const todoList = this._findTodoList(todoListId);
    if (!todoList) return;
    return todoList.todos.find((todo) => todo.id === todoId);
  }

  toggleDoneTodo(todoListId, todoId) {
    const todo = this._findTodo(+todoListId, +todoId);
    if (!todo) return false;
    todo.done = !todo.done;
    return true;
  }

  deleteTodo(todoListId, todoId) {
    const todoList = this._findTodoList(+todoListId);
    if (!todoList) return false;
    const todoIndex = todoList.todos.findIndex((todo) => todo.id === todoId);
    if (todoIndex === -1) return false;
    todoList.todos.splice(todoIndex, 1);
    return true;
  }

  // marks all todos on a given list as done
  markAllDone(todoListId) {
    const todoList = this._findTodoList(+todoListId);
    if (!todoList) return false;
    todoList.todos.forEach((todo) => todo.done = true);
    return true;
  }

  createTodo(todoListId, title) {
    const todoList = this._findTodoList(+todoListId);
    if (!todoList) return false;

    const todo = {
      title,
      id: nextId(),
      done: false,
    }

    todoList.todos.push(todo);
    return true;
  }

  existsTodoListTitle(title) {
    return this._todoLists.some((todoList) => todoList.title.toLowerCase() === title.toLowerCase());
  }

  setListTitle(todoListId, newTitle) {
    const todoList = this._findTodoList(+todoListId);
    if (!todoList) return false;
    todoList.title = newTitle;
    return true;
  }

  deleteList(todoListId) {
    const listIndex = this._todoLists.findIndex((list) => list.id === +todoListId);
    if (listIndex === -1) return false;
    this._todoLists.splice(listIndex, 1);
    return true;
  }

  isUniqueConstraintViolation(_error) {
    return false;
  }

  createTodoList(title) {
    const newList = { title, id: nextId(), todos: [] };
    this._todoLists.push(newList);
    return true;
  }
};
