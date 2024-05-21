// #region IMPORTS
require('dotenv').config();
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const store = require("connect-loki");
const PGPersistence = require('./lib/pg-persistence');
const catchError = require('./lib/catch-error');
// #endregion

// #region INIT
const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");
// #endregion

// #region MIDDLEWARE
app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// Create a new datastore
app.use((req, res, next) => {
  res.locals.store = new PGPersistence(req.session);
  next();
});

// Extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Async validation using res.locals.store
const validateData = async (req, res, next) => {
  const store = res.locals.store;

  await Promise.all([
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters.")
      .custom((title) => !store.existsTodoListTitle(title)),
  ]);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors.array().forEach((error) => req.flash('error', error.msg));

  } else {
    next();
  }
};
// #endregion

// #region ROUTE HANDLERS

// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", 
  catchError(async (req, res) => {
    const store = res.locals.store;
    const todoLists = await store.sortedTodoLists();

    const todosInfo = todoLists.map((todoList) => ({
      isDone: store.isDoneTodoList(todoList),
      countAllTodos: todoList.todos.length,
      countDoneTodos: todoList.todos.filter((todo) => todo.done).length,
    }));

    res.render("lists", {
      todoLists,
      todosInfo,
    });
  })
);

// Render new todo list page
app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const store = res.locals.store;
    const title = req.body.todoListTitle;
    let errors = validationResult(req);
    const duplicateExists = await store.existsTodoListTitle(title);
    if (!errors.isEmpty() || duplicateExists) {
      errors.array().forEach(message => req.flash("error", message.msg));

      if (duplicateExists) req.flash('error', 'A todo list with this title already exists');

      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: title,
      });
    } else {
      const added = store.createTodoList(title);
      if (!added) throw new Error('Failed to create list');
      
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  })
);

// Render individual todo list and its todos
app.get("/lists/:todoListId",
  catchError(async (req, res) => {
    const store = res.locals.store;
    const todoListId = req.params.todoListId;
    const todoList = await store.loadTodoList(+todoListId);
    if (todoList === undefined) throw new Error("Not found.");

    todoList.todos = await store.sortedTodos(todoList);
    const todoListInfo = {
      countAllTodos: todoList.todos.length,
      isDone: store.isDoneTodoList(todoList),
    };

    res.render("list", {
      todoList,
      todoListInfo,
    });
  })
);

// Toggle completion status of a todo
app.post("/lists/:todoListId/todos/:todoId/toggle", 
  catchError(async (req, res) => {
    const store = res.locals.store;
    const { todoListId, todoId } = req.params;
    const toggled = await store.toggleDoneTodo(+todoId);
    if (!toggled) throw new Error("Not found.");

    const todo = await store.loadTodo(+todoId);
    if (todo.done) {
      req.flash("success", `"${todo.title}" marked as done.`);
    } else {
      req.flash("success", `"${todo.title}" marked as not done.`);
    }

    res.redirect(`/lists/${todoListId}`);
  })
);

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy", 
  catchError(async (req, res) => {
    let { todoListId, todoId } = { ...req.params };
    const deleted = await res.locals.store.deleteTodo(+todoListId, +todoId);
    if (!deleted) throw new Error("Not found.");

    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  })
);

// Mark all todos as done
app.post("/lists/:todoListId/complete_all", 
  catchError(async (req, res) => {
  const todoListId = req.params.todoListId;
  const marked = await res.locals.store.markAllDone(+todoListId);
  if (!marked) throw new Error("Not found.");

  req.flash("success", "All todos have been marked as done.");
  res.redirect(`/lists/${todoListId}`);
  })
);

// Create a new todo and add it to the specified list
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const store = res.locals.store;
    const todoListId = req.params.todoListId;
    const todoList = await store.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");

    const newTitle = req.body.todoTitle;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));

      const todoListInfo = {
        countAllTodos: store.countAllTodos(todoList),
        isDone: store.isDoneTodoList(todoList),
      };

      res.render("list", {
        flash: req.flash(),
        todoList,
        todos: store.sortedTodos(todoList),
        todoTitle: newTitle,
        todoListInfo,
      });
    } else {
      const created = await store.createTodo(+todoListId,  newTitle);
      if (!created) throw new Error('Not found');

      req.flash("success", "The todo has been created.");
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", 
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    const todoList = await res.locals.store.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");

    res.render("edit-list", { todoList });
  })
);

// Delete todo list
app.post("/lists/:todoListId/destroy",
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    console.log({ todoListId })
    const deleted = await res.locals.store.deleteList(+todoListId);
    if (!deleted) throw new Error("Not found.");

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  })
);

// Edit todo list title
app.post("/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const store = res.locals.store;
    let todoListId = req.params.todoListId;
    const newTitle = req.body.todoListTitle;

    const reRenderEditList = async () => {
      let todoList = await store.loadTodoList(+todoListId);
      if (!todoList) throw new Error("Not found.");

      res.render("edit-list", {
        flash: req.flash(),
        todoListTitle: newTitle,
        todoList: todoList,
      });
    };
    try {
      const errors = validationResult(req);
      const duplicateExists = await store.existsTodoListTitle(newTitle);

      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        await reRenderEditList();
      } else if (duplicateExists) {
        req.flash('error', 'A todo list with this title already exists');
        await reRenderEditList();
      } else {
        const updated = await store.setListTitle(todoListId, newTitle);
        if (!updated) throw new Error('Not found');

        req.flash("success", "Todo list updated.");
        res.redirect(`/lists/${todoListId}`);
      }
    } catch(error) {
      if (store.isUniqueConstraintViolation(error)) {
        req.flash('error', 'A todo list with this title already exists');
        await reRenderEditList();
      } else throw error;
    }
  })
);
// #endregion

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
