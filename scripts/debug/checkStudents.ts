import { query } from './server/src/db';

async function check() {
    const students = await query(`
        SELECT sd.user_id, u.name, sd.cgpa, sd.specialization, c.name as college_name, u.college_id
        FROM student_details sd
        JOIN users u ON u.id = sd.user_id
        LEFT JOIN colleges c ON c.id = u.college_id
        ORDER BY sd.cgpa DESC
        LIMIT 10
    `);
    console.log(JSON.stringify(students.rows, null, 2));
    process.exit(0);
}

check();
