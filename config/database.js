const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("❌ Erro inesperado no pool do PostgreSQL:", err);
  process.exit(-1);
});

// Helper: query com log em desenvolvimento
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === "development") {
    const duration = Date.now() - start;
    console.log(`🔍 Query [${duration}ms]:`, text.substring(0, 80));
  }
  return res;
};

// Helper: transação
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };
