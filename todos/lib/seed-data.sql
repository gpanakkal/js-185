INSERT INTO todolists (title, username)
VALUES ('Work Todos', 'admin'),
       ('Home Todos', 'admin'),
       ('Additional Todos', 'admin'),
       ('social todos', 'admin');

INSERT INTO todos (todolist_id, title, done, username)
VALUES (1, 'Get coffee', TRUE, 'admin'),
       (1, 'Chat with co-workers', TRUE, 'admin'),
       (1, 'Duck out of meeting', FALSE, 'admin'),
       (2, 'Feed the cats', TRUE, 'admin'),
       (2, 'Go to bed', TRUE, 'admin'),
       (2, 'Buy milk', TRUE, 'admin'),
       (2, 'Study for Launch School', TRUE, 'admin'),
       (4, 'Go to Libby''s birthday party', FALSE, 'admin');