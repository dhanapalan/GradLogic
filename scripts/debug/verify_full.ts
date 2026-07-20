import { query, queryOne } from './server/src/config/database.js';
import { addStudentsByCampus } from './server/src/services/drive.service.js';

async function verify() {
    try {
        console.log("--- Starting Verification ---");

        // 1. Create a dummy rule version with specific targeting
        const targetingConfig = {
            min_cgpa: 7.5,
            min_percentage: 60
        };
        const snapshot = {
            name: "Test Eligibility Rule",
            targeting_config: targetingConfig
        };

        const ruleTemplate = await queryOne('INSERT INTO assessment_rule_templates (name, status) VALUES ($1, $2) RETURNING id', ['Test Rule', 'active']);
        const ruleId = ruleTemplate.id;

        const version = await queryOne(
            'INSERT INTO assessment_rule_versions (rule_id, version_number, snapshot) VALUES ($1, 1, $2) RETURNING id',
            [ruleId, JSON.stringify(snapshot)]
        );
        const versionId = version.id;
        console.log("Created test rule version:", versionId);

        // 2. Create a test drive
        const drive = await queryOne(
            'INSERT INTO assessment_drives (name, rule_id, rule_version_id, status, scheduled_start, scheduled_end) VALUES ($1, $2, $3, $4, NOW(), NOW() + interval \'1 day\') RETURNING id',
            ['Test Eligibility Drive', ruleId, versionId, 'active']
        );
        const driveId = drive.id;
        console.log("Created test drive:", driveId);

        // 3. Setup test students in the college
        const collegeId = '2b05a53f-8ed0-4729-b71b-98ac05160d50';

        // Let's find or create students
        const students = [
            { name: 'Eligible', cgpa: 8.0, pct: 70 },
            { name: 'Partial_CGPA_Fail', cgpa: 7.0, pct: 70 },
            { name: 'Partial_Pct_Fail', cgpa: 8.0, pct: 50 },
            { name: 'Missing_CGPA', cgpa: 0, pct: 70 },
            { name: 'Ineligible', cgpa: 6.0, pct: 50 }
        ];

        const ts = Date.now();
        for (const s of students) {
            const user = await queryOne(
                'INSERT INTO users (email, name, role, college_id, password) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [`${s.name.toLowerCase()}_${ts}@test.com`, s.name, 'student', collegeId, 'dummy_pass']
            );
            await query(
                'INSERT INTO student_details (user_id, cgpa, percentage, college_id) VALUES ($1, $2, $3, $4)',
                [user.id, s.cgpa || null, s.pct || null, collegeId]
            );
        }
        console.log("Created 5 test students with different profiles");

        // 4. Run addStudentsByCampus
        console.log("Running addStudentsByCampus...");
        const result = await addStudentsByCampus(driveId, collegeId);
        console.log("Added students count:", result.added);

        // 5. Verify eligibility_status in database
        const rows = await query(`
            SELECT u.name, ds.eligibility_status, sd.cgpa, sd.percentage
            FROM drive_students ds
            JOIN users u ON ds.student_id = u.id
            JOIN student_details sd ON u.id = sd.user_id
            WHERE ds.drive_id = $1
            ORDER BY u.name
        `, [driveId]);

        console.log("\nResults:");
        console.table(rows);

        // Cleanup (optional, but good for testing environment)
        // await query('DELETE FROM drive_students WHERE drive_id = $1', [driveId]);
        // await query('DELETE FROM assessment_drives WHERE id = $1', [driveId]);

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit(0);
    }
}

verify();
