import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types/index.js";
import { AppError } from "../middleware/errorHandler.js";
import * as profile from "../services/studentProfileModule.service.js";

function uid(req: Request) {
  return req.user!.userId;
}

function fileOf(req: Request, field = "file"): Express.Multer.File | undefined {
  if (req.file) return req.file;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (!files) return undefined;
  return files[field]?.[0] || files.certificate?.[0] || files.document?.[0] || files.resume?.[0];
}

export async function getProfile(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.getFullProfile(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putProfile(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const files = req.files as
      | { profile_photo?: Express.Multer.File[]; resume?: Express.Multer.File[] }
      | undefined;
    const data = await profile.saveProfile(uid(req), req.body, {
      profilePhoto: files?.profile_photo?.[0],
      resumeFile: files?.resume?.[0],
    });
    res.json({ success: true, data, message: "Profile saved" });
  } catch (err) {
    next(err);
  }
}

export async function deletePhoto(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deletePhoto(uid(req));
    res.json({ success: true, data, message: "Photo removed" });
  } catch (err) {
    next(err);
  }
}

export async function deleteResume(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deleteResume(uid(req));
    res.json({ success: true, data, message: "Resume removed" });
  } catch (err) {
    next(err);
  }
}

export async function getResume(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.getResume(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSkills(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.listSkills(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putSkills(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const skills = Array.isArray(req.body) ? req.body : req.body?.skills;
    const data = await profile.replaceSkills(uid(req), skills || []);
    res.json({ success: true, data, message: "Skills updated" });
  } catch (err) {
    next(err);
  }
}

export async function getCertifications(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.listCertifications(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postCertification(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.createCertification(uid(req), req.body, fileOf(req, "certificate"));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putCertification(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.updateCertification(
      uid(req),
      String(req.params.id),
      req.body,
      fileOf(req, "certificate")
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteCertification(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deleteCertification(uid(req), String(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProjects(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.listProjects(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postProject(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.createProject(uid(req), req.body, fileOf(req, "document"));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putProject(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.updateProject(
      uid(req),
      String(req.params.id),
      req.body,
      fileOf(req, "document")
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deleteProject(uid(req), String(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getExperience(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.listExperience(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postExperience(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.createExperience(uid(req), req.body, fileOf(req, "certificate"));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putExperience(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.updateExperience(
      uid(req),
      String(req.params.id),
      req.body,
      fileOf(req, "certificate")
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteExperience(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deleteExperience(uid(req), String(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPreferences(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.getPreferences(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function putPreferences(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.savePreferences(uid(req), req.body);
    res.json({ success: true, data, message: "Preferences saved" });
  } catch (err) {
    next(err);
  }
}

export async function getDocuments(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.listDocuments(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postDocument(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const docType = String(req.body.doc_type || req.query.doc_type || "");
    const file = req.file;
    if (!file) throw new AppError("File is required", 400);
    const data = await profile.uploadDocument(uid(req), docType, file);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.deleteDocument(uid(req), String(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCompletion(req: Request, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await profile.getSectionCompletion(uid(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
