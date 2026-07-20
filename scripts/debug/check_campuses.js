
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "talentsecure",
    password: "secret",
    database: "talentsecure_db",
});

async function checkCampuses() {
    try {
        const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'campuses'
    `);
        console.log("Columns in campuses table:", JSON.stringify(columns.rows, null, 2));

        const rows = await pool.query("SELECT * FROM campuses");
        console.log("Existing campuses:", JSON.stringify(rows.rows, null, 2));

    } catch (err) {
        console.error("Error connecting to DB:", err);
    } finally {
        await pool.end();
    }
}

checkCampuses();
