import { query } from './server/src/config/database.js';
async function check() {
    const res = await query("SELECT eligibility_status, count(*) FROM drive_students ds JOIN assessment_drives d ON ds.drive_id = d.id WHERE d.name = 'Test Eligibility Drive' GROUP BY eligibility_status");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
check();
