
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
    connectionString: "postgresql://talentsecure:secret@127.0.0.1:5432/talentsecure_db"
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Adding columns...");
        await client.query("ALTER TABLE exams ADD COLUMN IF NOT EXISTS questions_per_student INTEGER;");
        await client.query("ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS question_ids UUID[];");
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
