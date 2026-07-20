import { query } from './server/src/config/database.js';
async function run() {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
run();
