// #region IMPORTS
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist");
const store = require("connect-loki");
const SessionPersistence = require('./lib/session-persistence');
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
  res.locals.store = new SessionPersistence(req.session);
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
app.get("/lists", (req, res) => {
  const store = res.locals.store;
  const todosInfo = store.sortedTodoLists().map((todoList) => ({
    isDone: store.isDoneTodoList(todoList),
    countAllTodos: todoList.todos.length,
    countDoneTodos: todoList.todos.filter((todo) => todo.done).length,
  }));

  res.render("lists", {
    todoLists: res.locals.store.sortedTodoLists(),
    todosInfo,
  });
});

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
  (req, res) => {
    const title = req.body.todoListTitle;
    let errors = validationResult(req);
    const duplicateExists = res.locals.store.existsTodoListTitle(title);
    if (!errors.isEmpty() || duplicateExists) {
      errors.array().forEach(message => req.flash("error", message.msg));

      if (duplicateExists) req.flash('error', 'A todo list with this title already exists');

      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: title,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  }
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", (req, res, next) => {
  const todoListId = req.params.todoListId;
  const todoList = res.locals.store.loadTodoList(+todoListId);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    const todoListInfo = {
      countAllTodos: todoList.todos.length,
      isDone: res.locals.store.isDoneTodoList(todoList),
    };

    res.render("list", {
      todoList: todoList,
      todos: res.locals.store.sortedTodos(todoList),
      todoListInfo,
    });
  }
});

// Toggle completion status of a todo
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  const toggled = res.locals.store.toggleDoneTodo(+todoListId, +todoId);
  if (!toggled) {
    next(new Error("Not found."));
  } else {
    const todo = res.locals.store.loadTodo(+todoListId, +todoId);
    if (todo.done) {
      req.flash("success", `"${todo.title}" marked as done.`);
    } else {
      req.flash("success", `"${todo.title}" marked as not done.`);
    }

    res.redirect(`/lists/${todoListId}`);
  }
});

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  const deleted = res.locals.store.deleteTodo(+todoListId, +todoId);
  if (!deleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  }
});

// Mark all todos as done
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let marked = res.locals.store.markAllDone(+todoListId);
  if (!marked) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  }
});

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
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = res.locals.store.loadTodoList(+todoListId);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let newTitle = req.body.todoTitle;
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));

        const todoListInfo = {
          countAllTodos: res.locals.store.countAllTodos(todoList),
          isDone: res.locals.store.isDoneTodoList(todoList),
        };

        res.render("list", {
          flash: req.flash(),
          todoList,
          todos: res.locals.store.sortedTodos(todoList),
          todoTitle: newTitle,
          todoListInfo,
        });
      } else {
        const created = res.locals.store.createTodo(+todoListId,  newTitle);
        if (!created) {
          next(new Error('Not found'));
        } else {
          req.flash("success", "The todo has been created.");
          res.redirect(`/lists/${todoListId}`);
        }
      }
    }
  }
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = res.locals.store.loadTodoList(+todoListId);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Delete todo list
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let todoListId = +req.params.todoListId;
  const deleted = res.locals.store.deleteList(todoListId);
  if (!deleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

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
  (req, res, next) => {
    const store = res.locals.store;
    let todoListId = req.params.todoListId;
    const newTitle = req.body.todoListTitle;

    const reRenderEditList = () => {
      let todoList = store.loadTodoList(+todoListId);
      if (!todoList) {
        next(new Error("Not found."));
      } else {
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle: newTitle,
          todoList: todoList,
        });
      }
    };

    const errors = validationResult(req);
    const duplicateExists = store.existsTodoListTitle(newTitle);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      reRenderEditList();
    } else if (duplicateExists) {
      req.flash('error', 'A todo list with this title already exists');
      reRenderEditList();
    } else if (!store.setListTitle(todoListId, newTitle)) {
      next(new Error('Not found'));
    } else {      
      req.flash("success", "Todo list updated.");
      res.redirect(`/lists/${todoListId}`);
    }
});
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
