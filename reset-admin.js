require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./config/database");

async function reset() {
  const hash = await bcrypt.hash("Admin@123", 12);
  await pool.query(
    "UPDATE users SET password = $1 WHERE email = 'admin@consultoria.com'",
    [hash],
  );
  console.log("Senha do admin redefinida para: Admin@123");
  console.log(hash);
  await pool.end();
}

reset().catch(console.error);
