const assert = require("assert");
const {
  READ_QUERY,
  WRITE_OR_STRUCTURE_QUERY,
  classifySql,
  hasMultipleStatements,
  hasSelectLimit
} = require("../src/main/queryClassifier");

assert.strictEqual(classifySql("SELECT * FROM customers LIMIT 100"), READ_QUERY);
assert.strictEqual(classifySql("-- comment\nSHOW DATABASES"), READ_QUERY);
assert.strictEqual(classifySql("DESCRIBE customers"), READ_QUERY);
assert.strictEqual(classifySql("EXPLAIN SELECT * FROM orders"), READ_QUERY);
assert.strictEqual(classifySql("WITH recent AS (SELECT * FROM orders) SELECT * FROM recent"), READ_QUERY);
assert.strictEqual(classifySql("UPDATE customers SET city = 'Delhi'"), WRITE_OR_STRUCTURE_QUERY);
assert.strictEqual(classifySql("DROP TABLE customers"), WRITE_OR_STRUCTURE_QUERY);
assert.strictEqual(classifySql("CALL rebuild_report()"), WRITE_OR_STRUCTURE_QUERY);
assert.strictEqual(hasMultipleStatements("SELECT ';' AS value;"), false);
assert.strictEqual(hasMultipleStatements("SELECT 1; SELECT 2"), true);
assert.strictEqual(hasSelectLimit("select * from customers limit 100"), true);
assert.strictEqual(hasSelectLimit("select * from customers"), false);

console.log("queryClassifier tests passed");
