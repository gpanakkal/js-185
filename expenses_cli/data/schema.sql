CREATE TABLE expenses (
  id serial 
    PRIMARY KEY,
  amount decimal(6, 2) 
    NOT NULL
    CHECK (amount > 0),
  memo text
    NOT NULL,
  created_on date 
    NOT NULL
);