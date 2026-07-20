import { query, queryOne } from './server/src/config/database.js';
import { startSession } from './server/src/services/examSession.service.js';

async function verify() {
    try {
        console.log("--- Verifying Examination Engine Block Logic ---");

        // 1. Get a test drive and student with 'missing' status
        const testCase = await queryOne(`
            SELECT ds.drive_id, ds.student_id, ds.eligibility_status
            FROM drive_students ds
            WHERE ds.eligibility_status = 'missing'
            LIMIT 1
        `);

        if (!testCase) {
            console.log("No student with 'missing' status found. Creating one...");
            // Link to previous drive if possible
            const drive = await queryOne('SELECT id FROM assessment_drives LIMIT 1');
            const student = await queryOne('SELECT id FROM users WHERE role = \'student\' LIMIT 1');

            await query('UPDATE drive_students SET eligibility_status = \'missing\' WHERE drive_id = $1 AND student_id = $2', [drive.id, student.id]);
            testCase.drive_id = drive.id;
            testCase.student_id = student.id;
            testCase.eligibility_status = 'missing';
        }

        console.log(`Testing drive: ${testCase.drive_id}, student: ${testCase.student_id}, status: ${testCase.eligibility_status}`);

        // 2. Attempt to start session
        try {
            await startSession(testCase.drive_id, testCase.student_id);
            console.error("FAIL: startSession should have thrown an error but succeeded.");
        } catch (err: any) {
            console.log("SUCCESS: Caught expected error:", err.message);
            if (err.message.includes("incomplete") || err.message.includes("profile")) {
                console.log("Verified: Correct error message for 'missing' status.");
            } else {
                console.error("FAIL: Error message does not match expectations:", err.message);
            }
        }

        // 3. Test 'ineligible' status
        await query('UPDATE drive_students SET eligibility_status = \'ineligible\' WHERE drive_id = $1 AND student_id = $2', [testCase.drive_id, testCase.student_id]);
        console.log("Changed status to 'ineligible'. Testing again...");

        try {
            await startSession(testCase.drive_id, testCase.student_id);
            console.error("FAIL: startSession should have thrown an error but succeeded.");
        } catch (err: any) {
            console.log("SUCCESS: Caught expected error:", err.message);
            if (err.message.includes("minimum eligibility criteria")) {
                console.log("Verified: Correct error message for 'ineligible' status.");
            } else {
                console.error("FAIL: Error message does not match expectations:", err.message);
            }
        }

    } catch (err) {
        console.error("Verification script failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
