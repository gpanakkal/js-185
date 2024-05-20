-- 1
-- 9999.99

INSERT INTO expenses (amount, memo, created_on)
VALUES (9999.99, 'a', NOW());

-- 2
-- -9999.99
INSERT INTO expenses (amount, memo, created_on)
VALUES (-9999.99, 'b', NOW());

-- 3
DELETE FROM expenses;
ALTER TABLE expenses
ADD CHECK (amount > 0);