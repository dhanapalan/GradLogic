import { query, queryOne } from './server/src/config/database.js';
import { startSession } from './server/src/services/examSession.service.js';

async function verifyMissingBlock() {
    try {
        console.log("--- Verifying 'Missing' Eligibility Block ---");

        // 1. Find or create a student with 'missing' status in a drive
        let testCase = await queryOne(`
            SELECT drive_id, student_id 
            FROM drive_students 
            WHERE eligibility_status = 'missing' 
            LIMIT 1
        `);

        if (!testCase) {
            console.log("No student with 'missing' status found. Setting up test data...");
            // Get any drive and any student
            const drive = await queryOne('SELECT id FROM assessment_drives LIMIT 1');
            const student = await queryOne('SELECT id FROM users WHERE role = \'student\' LIMIT 1');

            if (!drive || !student) {
                console.error("Could not find drive or student to setup test Case.");
                return;
            }

            // Upsert with status 'missing'
            await query(`
                INSERT INTO drive_students (drive_id, student_id, status, eligibility_status)
                VALUES ($1, $2, 'registered', 'missing')
                ON CONFLICT (drive_id, student_id) 
                DO UPDATE SET eligibility_status = 'missing'
            `, [drive.id, student.id]);

            testCase = { drive_id: drive.id, student_id: student.id };
        }

        console.log(`Testing Block for: Drive[${testCase.drive_id}] Student[${testCase.student_id}] Status[missing]`);

        // 2. Attempt to start session
        try {
            await startSession(testCase.drive_id, testCase.student_id);
            console.error("FAIL: Exam session started effectively. Block FAILED.");
        } catch (err: any) {
            console.log("SUCCESS: Blocked successfully.");
            console.log("Error Message:", err.message);
            if (err.message.includes("profile is incomplete")) {
                console.log("Verified: Correct error message was thrown for 'missing' status.");
            } else {
                console.warn("Manual check: Error thrown but message might be different than expected:", err.message);
            }
        }

    } catch (err) {
        console.error("Verification script error:", err);
    } finally {
        process.exit(0);
    }
}

verifyMissingBlock();
