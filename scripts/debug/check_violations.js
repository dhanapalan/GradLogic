
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "talentsecure",
    password: "secret",
    database: "talentsecure_db",
});

async function checkViolations() {
    try {
        const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'proctoring_violations'
    `);
        console.log("Columns in proctoring_violations table:", JSON.stringify(columns.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkViolations();
