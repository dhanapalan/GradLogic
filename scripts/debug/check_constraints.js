
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "talentsecure",
    password: "secret",
    database: "talentsecure_db",
});

async function checkConstraints() {
    try {
        const res = await pool.query(`
        SELECT column_name, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'campuses'
    `);
        console.log("Nullability in campuses table:", JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkConstraints();
