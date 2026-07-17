import { Request, Response, NextFunction } from "express";
import * as studentService from "../services/student.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { effectiveCollegeId } from "../middleware/collegeIsolation.js";
import { ApiResponse } from "../types/index.js";

/**
 * POST /api/students/register
 * Multipart form: name, email, password, college_id, webcam_photo (file)
 *
 * College-scoped callers can only provision into their own college — the
 * body's college_id is ignored for them. Platform admins may target any.
 */
export const register = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { name, email, password, college_id } = req.body;
    const webcamPhoto = req.file; // multer single("webcam_photo")

    const targetCollegeId = await effectiveCollegeId(req, college_id);
    if (!targetCollegeId) {
      throw new AppError("college_id is required", 400);
    }

    const result = await studentService.registerStudent({
      name,
      email,
      password,
      college_id: targetCollegeId,
      webcamPhoto,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Student registered successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/:studentId/exams
 * Returns the exam schedule (all active exams) for a given student.
 */
export const getExamSchedule = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const studentId = req.params.studentId as string;
    const exams = await studentService.getExamScheduleForStudent(studentId);
    res.json({ success: true, data: exams });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students
 * List all students (HR/Admin)
 */
export const list = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 50;
    const offset = (page - 1) * limit;

    const collegeId = req.user?.college_id;
    const isCentral = ["super_admin", "admin", "hr"].includes(req.user?.role || "");

    const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
    const placementStatus = typeof req.query.placementStatus === "string" ? req.query.placementStatus.trim() : undefined;
    const riskLevel = typeof req.query.riskLevel === "string" ? req.query.riskLevel.trim() : undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;

    const { data: students, total } = await studentService.listStudents(
      limit,
      offset,
      isCentral ? undefined : (collegeId || undefined),
      { search, placementStatus, riskLevel, status },
    );
    res.json({
      success: true,
      data: students,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/analytics
 * Analytics summary for students
 */
export const getAnalytics = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    const isCentral = ["super_admin", "admin", "hr"].includes(req.user?.role || "");

    const analytics = await studentService.getStudentAnalytics(isCentral ? undefined : (collegeId || undefined));
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/:id
 * Get a specific student by ID
 */
export const getById = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const student = await studentService.getStudentById(id as string);
    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    // Ensure central admins or college-specific staff can only view properly.
    const isCentral = ["super_admin", "admin", "hr"].includes(req.user?.role || "");
    if (!isCentral && req.user?.college_id && student.college_id !== req.user.college_id) {
      return res.status(403).json({ success: false, error: "Not authorized to access this student" });
    }

    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/students/:id
 * Update student / profile (HR/Admin/Student)
 */
export const update = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const role = req.user?.role ?? "";

    // Students can only update their own profile
    if (role === "student" && req.user?.userId !== id) {
      return res.status(403).json({ success: false, error: "Not authorized to update this profile" });
    }

    // College admins can only update students belonging to their own college
    if (["college_admin", "college", "college_staff"].includes(role)) {
      const student = await studentService.getStudentById(id as string);
      if (!student) {
        return res.status(404).json({ success: false, error: "Student not found" });
      }
      if (student.college_id !== req.user?.college_id) {
        return res.status(403).json({ success: false, error: "Not authorized to update this student" });
      }
    }

    const result = await studentService.updateStudent(id as string, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/students/:id
 * Delete student (HR/Admin)
 */
export const deleteStudent = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const result = await studentService.deleteStudent(id as string);
    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/me
 */
export const getMeProfile = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { getStudentMe } = await import("../services/studentPortalProfile.service.js");
    const data = await getStudentMe(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/students/profile
 */
export const updateMyProfile = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { updateStudentProfile } = await import("../services/studentPortalProfile.service.js");
    const files = req.files as
      | { profile_photo?: Express.Multer.File[]; resume?: Express.Multer.File[] }
      | undefined;
    const data = await updateStudentProfile(req.user!.userId, req.body, {
      profilePhoto: files?.profile_photo?.[0],
      resumeFile: files?.resume?.[0],
    });
    res.json({ success: true, data, message: "Profile updated" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/students/photo
 */
export const uploadPhoto = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { uploadStudentPhoto } = await import("../services/studentPortalProfile.service.js");
    const file = req.file;
    if (!file) throw new AppError("Photo file is required", 400);
    const data = await uploadStudentPhoto(req.user!.userId, file);
    res.json({ success: true, data, message: "Photo uploaded" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/students/resume
 */
export const uploadResume = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { uploadStudentResume } = await import("../services/studentPortalProfile.service.js");
    const file = req.file;
    if (!file) throw new AppError("Resume file is required", 400);
    const data = await uploadStudentResume(req.user!.userId, file);
    res.json({ success: true, data, message: "Resume uploaded" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/profile-completion
 */
export const profileCompletion = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { getProfileCompletion } = await import("../services/studentPortalProfile.service.js");
    const data = await getProfileCompletion(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/students/accept-policy
 */
export const acceptPolicy = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { acceptPolicy: accept } = await import("../services/studentPortalProfile.service.js");
    const data = await accept(req.user!.userId, req.ip);
    res.json({ success: true, data, message: "Policy accepted" });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/students/me/onboarding
 * Student first-login onboarding profile completion.
 */
export const completeOnboarding = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const files = req.files as
      | {
        profile_photo?: Express.Multer.File[];
        resume?: Express.Multer.File[];
      }
      | undefined;

    const result = await studentService.updateStudent(
      req.user!.userId,
      {
        ...req.body,
        profilePhoto: files?.profile_photo?.[0],
        resumeFile: files?.resume?.[0],
      },
    );

    res.json({
      success: true,
      data: result,
      message: "Student profile completed successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/students/bulk
 * Bulk register students.
 */
export const bulkRegister = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, error: "students mapping is required and must be an array" });
    }

    const collegeId = req.user?.college_id;
    const isCentral = ["super_admin", "admin", "hr"].includes(req.user?.role || "");

    const result = await studentService.bulkRegisterStudents(isCentral ? undefined : (collegeId || undefined), students);
    res.status(201).json({
      success: true,
      data: result,
      message: `${result.count} students registered successfully`,
    });
  } catch (err) {
    next(err);
  }
};
