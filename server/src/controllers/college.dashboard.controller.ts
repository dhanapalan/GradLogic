import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ApiResponse } from "../types/index.js";
import * as campusDash from "../services/collegeDashboard.service.js";

// Ensure college ID exists in the request
const getCollegeId = (req: Request): string => {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
        throw new AppError("Access denied. No college associated with this user.", 403);
    }
    return collegeId;
};

async function dashCtx(req: Request) {
    return campusDash.buildContext(
        req.user!.userId,
        req.user?.college_id,
        req.user?.role
    );
}

/** Phase 2 Module 01 — expanded summary KPIs + role projection */
export const getSummary = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const ctx = await dashCtx(req);
        const data = await campusDash.getDashboardSummary(ctx, req.query as Record<string, unknown>);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getCharts = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const ctx = await dashCtx(req);
        const data = await campusDash.getDashboardCharts(ctx, req.query as Record<string, unknown>);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getActivities = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const ctx = await dashCtx(req);
        const data = await campusDash.getDashboardActivities(ctx, req.query as Record<string, unknown>);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getPendingActions = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const ctx = await dashCtx(req);
        const data = await campusDash.getPendingActions(ctx, req.query as Record<string, unknown>);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getFilterOptions = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);
        const data = await campusDash.getFilterOptions(collegeId);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getDrives = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);

        let upcomingDrivesRows: any[] = [];
        let participationSnapshot = {
            assigned: 0, appeared: 0, absent: 0,
            completion_percentage: 0, avg_integrity: "0.0"
        };

        try {
            const upcomingDrives = await pool.query(
                `SELECT 
                    d.id,
                    d.name as drive_name,
                    d.scheduled_start as date,
                    rt.duration_minutes as duration,
                    d.status
                 FROM assessment_drives d
                 JOIN drive_assignments da ON da.drive_id = d.id
                 LEFT JOIN assessment_rule_templates rt ON d.rule_id = rt.id
                 WHERE da.college_id = $1 AND d.status IN ('scheduled', 'active')
                 ORDER BY d.scheduled_start ASC
                 LIMIT 5`,
                [collegeId]
            );
            upcomingDrivesRows = upcomingDrives.rows;

            const participationStats = await pool.query(
                `SELECT 
                    COUNT(*) as assigned_students,
                    SUM(CASE WHEN ds.status IN ('in_progress', 'completed', 'submitted') THEN 1 ELSE 0 END) as appeared,
                    SUM(CASE WHEN ds.status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN ds.status IN ('assigned', 'not_started') AND d.status = 'completed' THEN 1 ELSE 0 END) as absent,
                    COALESCE(AVG(ds.integrity_score), 100) as avg_integrity
                 FROM drive_students ds
                 JOIN assessment_drives d ON ds.drive_id = d.id
                 JOIN student_details sd ON ds.student_id = sd.user_id
                 WHERE sd.college_id = $1`,
                [collegeId]
            );

            const partData = participationStats.rows[0] || {};
            const assigned = parseInt(partData.assigned_students || 0);
            const appeared = parseInt(partData.appeared || 0);
            const completed = parseInt(partData.completed || 0);
            participationSnapshot = {
                assigned,
                appeared,
                absent: parseInt(partData.absent || 0),
                completion_percentage: assigned > 0 ? parseFloat(((completed / assigned) * 100).toFixed(1)) : 0,
                avg_integrity: parseFloat(partData.avg_integrity || 100).toFixed(1)
            };
        } catch { /* drives tables may not exist yet */ }

        res.json({
            success: true,
            data: {
                upcoming_drives: upcomingDrivesRows,
                participation_snapshot: participationSnapshot
            }
        });
    } catch (error) {
        next(error);
    }
};


export const getPerformance = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);

        // 1. Score Distribution Histogram
        const distribution = await pool.query(
            `SELECT 
                CASE
                    WHEN final_score <= 50 THEN '0-50'
                    WHEN final_score <= 60 THEN '51-60'
                    WHEN final_score <= 70 THEN '61-70'
                    WHEN final_score <= 80 THEN '71-80'
                    WHEN final_score <= 90 THEN '81-90'
                    ELSE '91-100'
                END as range,
                COUNT(*) as count
             FROM marks_scored ms
             JOIN student_details sd ON ms.student_id = sd.user_id
             WHERE sd.college_id = $1
             GROUP BY range
             ORDER BY range`,
            [collegeId]
        );

        // Initialize empty bins
        const formattedDistribution = [
            { range: '0-50', count: 0 },
            { range: '51-60', count: 0 },
            { range: '61-70', count: 0 },
            { range: '71-80', count: 0 },
            { range: '81-90', count: 0 },
            { range: '91-100', count: 0 },
        ];

        distribution.rows.forEach(row => {
            const index = formattedDistribution.findIndex(d => d.range === row.range);
            if (index !== -1) formattedDistribution[index].count = parseInt(row.count);
        });

        // 2. Skill Heatmap (Mocked properly based on schema - would require joining specific question attempts for real data, 
        // using mock averages based on overall score for demonstration as question-level marks parsing is heavy)
        const avgOverall = await pool.query(
            `SELECT COALESCE(AVG(final_score), 0) as avg FROM marks_scored ms JOIN student_details sd ON ms.student_id = sd.user_id WHERE sd.college_id = $1`,
            [collegeId]
        );
        const baseScore = parseFloat(avgOverall.rows[0]?.avg || 65);

        const skillHeatmap = [
            { skill: 'Aptitude', avg_score: Math.round(baseScore * 1.05), strength: baseScore * 1.05 > 75 ? 'Strong' : 'Average' },
            { skill: 'Programming', avg_score: Math.round(baseScore * 1.15), strength: baseScore * 1.15 > 75 ? 'Strong' : 'Average' },
            { skill: 'Reasoning', avg_score: Math.round(baseScore * 0.9), strength: baseScore * 0.9 > 75 ? 'Strong' : 'Needs Improvement' },
            { skill: 'Communication', avg_score: Math.round(baseScore * 0.95), strength: baseScore * 0.95 > 75 ? 'Strong' : 'Average' },
        ];

        res.json({
            success: true,
            data: {
                score_distribution: formattedDistribution,
                skill_heatmap: skillHeatmap
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getIntegrity = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);

        // Use student_details avg_integrity_score (set by seed) as fallback when no drives exist
        let trend: any[] = [];
        let highRiskStudents = 0;
        let totalViolations = 0;

        try {
            const trendResult = await pool.query(
                `SELECT 
                    d.name as drive_name,
                    COALESCE(AVG(ds.integrity_score), 100)::float as avg_integrity
                 FROM assessment_drives d
                 JOIN drive_students ds ON ds.drive_id = d.id
                 JOIN student_details sd ON ds.student_id = sd.user_id
                 WHERE sd.college_id = $1 AND d.status = 'completed'
                 GROUP BY d.id, d.name, d.actual_end
                 ORDER BY d.actual_end DESC
                 LIMIT 5`,
                [collegeId]
            );
            trend = trendResult.rows.reverse();

            const riskResult = await pool.query(
                `SELECT 
                    COUNT(DISTINCT CASE WHEN ds.integrity_score < 70 THEN ds.student_id END)::int as high_risk_students,
                    COALESCE(SUM(ds.violations), 0)::int as total_violations
                 FROM drive_students ds
                 JOIN student_details sd ON ds.student_id = sd.user_id
                 WHERE sd.college_id = $1`,
                [collegeId]
            );
            highRiskStudents = parseInt(riskResult.rows[0]?.high_risk_students || 0);
            totalViolations = parseInt(riskResult.rows[0]?.total_violations || 0);
        } catch { /* assessment_drives may not exist yet */ }

        // Optional fallback: some deployments carry per-student integrity columns on
        // student_details. Only use them if present — never fail the request if absent.
        if (highRiskStudents === 0 && totalViolations === 0) {
            try {
                const fallback = await pool.query(
                    `SELECT
                        COUNT(CASE WHEN avg_integrity_score < 70 THEN 1 END)::int as high_risk,
                        COALESCE(SUM(total_violations), 0)::int as total_violations
                     FROM student_details WHERE college_id = $1`,
                    [collegeId]
                );
                highRiskStudents = parseInt(fallback.rows[0]?.high_risk || 0);
                totalViolations = parseInt(fallback.rows[0]?.total_violations || 0);
            } catch { /* integrity columns not present in this deployment */ }
        }

        res.json({
            success: true,
            data: {
                trend,
                risk_summary: {
                    high_risk_students: highRiskStudents,
                    total_violations: totalViolations,
                    terminations: 0
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getPlacement = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);

        // Placement-outcome tracking is optional; degrade to zeros when the columns
        // aren't present so the pipeline still reports real exam participation.
        let total = 0;
        let shortlisted = 0;
        let offered = 0;
        let joined = 0;
        let avgPackage = 0;
        try {
            const funnel = await pool.query(
                `SELECT
                    COUNT(*) as total_students,
                    SUM(CASE WHEN placement_status IN ('Shortlisted', 'Offered', 'Accepted', 'Joined') THEN 1 ELSE 0 END) as shortlisted,
                    SUM(CASE WHEN placement_status IN ('Offered', 'Accepted', 'Joined') THEN 1 ELSE 0 END) as offered,
                    SUM(CASE WHEN placement_status = 'Joined' THEN 1 ELSE 0 END) as joined,
                    AVG(placement_package) as avg_package
                 FROM student_details
                 WHERE college_id = $1 AND eligible_for_hiring = true`,
                [collegeId]
            );
            total = parseInt(funnel.rows[0]?.total_students || 0);
            shortlisted = parseInt(funnel.rows[0]?.shortlisted || 0);
            offered = parseInt(funnel.rows[0]?.offered || 0);
            joined = parseInt(funnel.rows[0]?.joined || 0);
            avgPackage = parseFloat(funnel.rows[0]?.avg_package || 0);
        } catch { /* placement columns not present in this deployment */ }

        // 'Appeared' / 'Passed' come from real exam data (marks_scored).
        const stats = await pool.query(
            `SELECT
                COUNT(DISTINCT ms.student_id) as appeared,
                COUNT(DISTINCT CASE WHEN ms.final_score >= 60 THEN ms.student_id END) as passed
             FROM marks_scored ms
             JOIN student_details sd ON ms.student_id = sd.user_id
             WHERE sd.college_id = $1`,
            [collegeId]
        );
        const appeared = parseInt(stats.rows[0]?.appeared || 0);
        const passed = parseInt(stats.rows[0]?.passed || 0);

        res.json({
            success: true,
            data: {
                funnel: {
                    appeared: appeared,
                    passed: passed,
                    shortlisted: shortlisted,
                    offered: offered,
                    joined: joined
                },
                conversion_percentage: total > 0 ? parseFloat(((offered / total) * 100).toFixed(1)) : 0,
                avg_package: parseFloat((avgPackage || 0).toFixed(2))
            }
        });

    } catch (error) {
        next(error);
    }
};

export const getTopPerformers = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);

        const topPerformers = await pool.query(
            `SELECT 
                u.name as student,
                sd.user_id as id,
                sd.cgpa,
                COALESCE((SELECT AVG(final_score) FROM marks_scored WHERE student_id = sd.user_id), 0) as avg_score,
                COALESCE((SELECT AVG(integrity_score) FROM drive_students WHERE student_id = sd.user_id), 100) as integrity
             FROM student_details sd
             JOIN users u ON sd.user_id = u.id
             WHERE sd.college_id = $1
             ORDER BY avg_score DESC, cgpa DESC
             LIMIT 5`,
            [collegeId]
        );

        // Add rank
        const ranked = topPerformers.rows.map((r, i) => ({
            rank: i + 1,
            student: r.student,
            id: r.id,
            cgpa: parseFloat(parseFloat(r.cgpa || 0).toFixed(2)),
            avg_score: parseFloat(parseFloat(r.avg_score || 0).toFixed(1)),
            integrity: parseFloat(parseFloat(r.integrity || 100).toFixed(1))
        }));

        res.json({
            success: true,
            data: ranked
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/college/dashboard/daily-target
 * The college's configured daily practice target for its students.
 */
export const getDailyTarget = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);
        const result = await pool.query(
            `SELECT COALESCE(daily_practice_target, 1) AS daily_practice_target
             FROM colleges WHERE id = $1`,
            [collegeId]
        );
        res.json({
            success: true,
            data: { daily_practice_target: parseInt(result.rows[0]?.daily_practice_target ?? 1, 10) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/college/dashboard/daily-target
 * Scoped setter — a college admin sets ONLY the daily practice target for
 * their own college. { daily_practice_target: 0..20 }.
 */
export const updateDailyTarget = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const collegeId = getCollegeId(req);
        const raw = Number((req.body ?? {}).daily_practice_target);
        if (!Number.isInteger(raw) || raw < 0 || raw > 20) {
            throw new AppError("daily_practice_target must be an integer between 0 and 20.", 400);
        }
        const result = await pool.query(
            `UPDATE colleges SET daily_practice_target = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING COALESCE(daily_practice_target, 1) AS daily_practice_target`,
            [raw, collegeId]
        );
        res.json({
            success: true,
            data: { daily_practice_target: parseInt(result.rows[0]?.daily_practice_target ?? raw, 10) },
            message: "Daily target updated",
        });
    } catch (error) {
        next(error);
    }
};
