INSERT INTO todolists (title)
VALUES ('Work Todos'),
       ('Home Todos'),
       ('Additional Todos'),
       ('social todos');

INSERT INTO todos (todolist_id, title, done)
VALUES (1, 'Get coffee', TRUE),
       (1, 'Chat with co-workers', TRUE),
       (1, 'Duck out of meeting', FALSE),
       (2, 'Feed the cats', TRUE),
       (2, 'Go to bed', TRUE),
       (2, 'Buy milk', TRUE),
       (2, 'Study for Launch School', TRUE),
       (4, 'Go to Libby''s birthday party', FALSE);