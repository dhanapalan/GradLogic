import { env } from "../config/env.js";
import { pool } from "../config/database.js";
import { generateDrive } from "../services/drive.service.js";

// Force mock generation for seeding to avoid real Groq API costs
(env as any).GROQ_API_KEY = "";

async function run() {
    console.log("🌊 Starting Pool Generation (FORCED MOCK MODE)...");

    try {
        const drives = await pool.query("SELECT id, name, status FROM assessment_drives WHERE status IN ('ACTIVE', 'GENERATING_POOL', 'DRAFT')");

        for (const drive of drives.rows) {
            console.log(`\n🔍 Processing drive: ${drive.name} (Status: ${drive.status})`);

            const poolCheck = await pool.query("SELECT COUNT(*) as cnt FROM drive_pool_questions dpq JOIN drive_question_pool dqp ON dpq.pool_id = dqp.id WHERE dqp.drive_id = $1", [drive.id]);
            const qCount = parseInt(poolCheck.rows[0].cnt);

            if (qCount === 0) {
                console.log("   🚀 No questions found. (Re)triggering generation...");
                await generateDrive(drive.id);
            } else {
                console.log(`   ⏳ Questions already exist (${qCount}). Monitoring...`);
            }

            // Poll for up to 120 seconds
            let attempts = 0;
            while (attempts < 120) {
                const check = await pool.query("SELECT status FROM assessment_drives WHERE id = $1", [drive.id]);
                const currentStatus = check.rows[0].status;

                const res = await pool.query(
                    "SELECT COUNT(*) FROM drive_pool_questions dpq " +
                    "JOIN drive_question_pool dqp ON dpq.pool_id = dqp.id " +
                    "WHERE dqp.drive_id = $1",
                    [drive.id]
                );
                const count = parseInt(res.rows[0].count);

                process.stdout.write(`\r   📊 Progress: Status=${currentStatus}, Questions=${count} (${attempts}s)`);

                if (currentStatus === 'PENDING_APPROVAL' || currentStatus === 'POOL_READY' || currentStatus === 'LIVE') {
                    console.log("\n   ✅ Pool generation complete.");
                    break;
                }

                if (currentStatus === 'DRAFT' && attempts > 5) {
                    // If it reverted to DRAFT, it might have failed
                    console.log("\n   ❌ Generation failed (reverted to DRAFT).");
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts += 2;
            }

            if (attempts >= 120) {
                console.log("\n   ⚠️ Polling timed out.");
            }
        }
    } catch (err) {
        console.error("Error during pool generation:", err);
    } finally {
        await pool.end();
        console.log("\n👋 Done.");
    }
}

run();
