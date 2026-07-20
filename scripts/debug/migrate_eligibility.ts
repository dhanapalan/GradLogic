import { query } from './server/src/config/database.js';
async function migrate() {
    try {
        await query(`ALTER TABLE drive_students ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(20) DEFAULT 'eligible'`);
        console.log('Migration successful: eligibility_status column added');
    } catch (err) {
        console.error('Migration failed:', err);
    }
    process.exit(0);
}
migrate();
