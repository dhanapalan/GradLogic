import { query } from './server/src/config/database.js';
async function run() {
    const version = await query('SELECT id, snapshot FROM assessment_rule_versions LIMIT 1');
    const college = await query('SELECT id FROM colleges LIMIT 1');
    console.log(JSON.stringify({ version, college }, null, 2));
    process.exit(0);
}
run();
