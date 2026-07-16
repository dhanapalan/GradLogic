import { Request, Response, NextFunction } from "express";
import * as ruleService from "../services/assessmentRule.service.js";
import { ApiResponse } from "../types/index.js";

// GET /api/assessment-rules
export const list = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const { status, skill } = req.query;
        const rules = await ruleService.listRules({
            status: status as string | undefined,
            skill: skill as string | undefined,
        });
        res.json({ success: true, data: rules });
    } catch (err) { next(err); }
};

// POST /api/assessment-rules/seed-phase1
export const seedPhase1 = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const data = await ruleService.seedPhase1PlacementTemplates(userId);
        res.status(201).json({
            success: true,
            data,
            message:
                data.created_count > 0
                    ? `Seeded ${data.created_count} Placement Preparation templates`
                    : "Placement Preparation templates already present",
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/assessment-rules/:id
export const getById = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const rule = await ruleService.getRuleById(req.params.id as string);
        if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });
        res.json({ success: true, data: rule });
    } catch (err) { next(err); }
};

// POST /api/assessment-rules
export const create = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const rule = await ruleService.createRule({ ...req.body, created_by: userId });
        res.status(201).json({ success: true, data: rule, message: "Rule created" });
    } catch (err) { next(err); }
};

// PUT /api/assessment-rules/:id
export const update = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const rule = await ruleService.updateRule(req.params.id as string, req.body);
        res.json({ success: true, data: rule, message: "Rule updated" });
    } catch (err) { next(err); }
};

// POST /api/assessment-rules/:id/clone
export const clone = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const rule = await ruleService.cloneRule(req.params.id as string, userId);
        if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });
        res.status(201).json({ success: true, data: rule, message: "Rule cloned" });
    } catch (err) { next(err); }
};

// GET /api/assessment-rules/:id/versions
export const getVersions = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const versions = await ruleService.listVersions(req.params.id as string);
        res.json({ success: true, data: versions });
    } catch (err) { next(err); }
};

// POST /api/assessment-rules/:id/versions
export const createVersion = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const version = await ruleService.createVersion(req.params.id as string, req.body.change_notes, userId);
        if (!version) return res.status(404).json({ success: false, error: "Rule not found" });
        res.status(201).json({ success: true, data: version, message: "Version created" });
    } catch (err) { next(err); }
};
// POST /api/assessment-rules/:id/archive
export const archive = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
        const rule = await ruleService.archiveRule(req.params.id as string);
        if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });
        res.json({ success: true, data: rule, message: "Rule archived" });
    } catch (err) { next(err); }
};
