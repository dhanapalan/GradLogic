import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import { AppError } from "../middleware/errorHandler.js";
import * as svc from "../services/aiServiceConfig.service.js";

function actorId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || "system";
}

export const list = async (_req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const data = await svc.listAiServices();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getOne = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const data = await svc.getAiService(String(req.params.key));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const data = await svc.createAiService(req.body || {}, actorId(req));
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const data = await svc.updateAiService(String(req.params.key), req.body || {}, actorId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    await svc.deleteAiService(String(req.params.key), actorId(req));
    res.json({ success: true, data: { key: req.params.key, message: "Service deleted" } });
  } catch (error) {
    next(error);
  }
};

export const setKey = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const { value } = req.body as { value?: string };
    if (!value || typeof value !== "string") {
      throw new AppError("value is required", 400);
    }
    await svc.setAiServiceKey(String(req.params.key), value.trim(), actorId(req));
    res.json({ success: true, data: { key: req.params.key, message: "Key saved and applied" } });
  } catch (error) {
    next(error);
  }
};

export const revokeKey = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    await svc.revokeAiServiceKey(String(req.params.key), actorId(req));
    res.json({
      success: true,
      data: { key: req.params.key, message: "Key override removed" },
    });
  } catch (error) {
    next(error);
  }
};

export const test = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const data = await svc.testAiService(String(req.params.key));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const listProviders = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      data: svc.KNOWN_PROVIDERS.map((p) => ({
        id: p,
        label: p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    });
  } catch (error) {
    next(error);
  }
};
