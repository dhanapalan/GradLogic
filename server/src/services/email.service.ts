// =============================================================================
// GradLogic — Email Service
// Nodemailer + all transactional email templates
// =============================================================================

import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { queryOne } from "../config/database.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================================
// CORE SEND + AUDIT LOG
// =============================================================================

export async function sendEmail({
  to,
  subject,
  text,
  html,
  template = "generic",
  recipientId,
  refId,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  recipientId?: string;
  refId?: string;
}) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    logger.info("── SIMULATED EMAIL ──");
    logger.info(`To:      ${to}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`Body:    ${text}`);
    logger.info("─────────────────────");
    // Audit log with simulated status
    try {
      await queryOne(
        `INSERT INTO email_logs (recipient_id, to_email, subject, template, ref_id, status)
         VALUES ($1, $2, $3, $4, $5, 'simulated') ON CONFLICT DO NOTHING`,
        [recipientId || null, to, subject, template, refId || null]
      );
    } catch { /* table may not exist yet in older deploys */ }
    return;
  }

  let status = "sent";
  let errorMsg: string | null = null;

  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent [${template}]: ${info.messageId}`);
    // Audit log after successful send
    try {
      await queryOne(
        `INSERT INTO email_logs (recipient_id, to_email, subject, template, ref_id, status)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [recipientId || null, to, subject, template, refId || null, status]
      );
    } catch { /* best-effort */ }
    return info;
  } catch (error) {
    status = "failed";
    errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to send email [${template}] to ${to}:`, error);
    // Audit log the failure with error detail
    try {
      await queryOne(
        `INSERT INTO email_logs (recipient_id, to_email, subject, template, ref_id, status, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [recipientId || null, to, subject, template, refId || null, status, errorMsg]
      );
    } catch { /* best-effort */ }
  }
}

// =============================================================================
// SHARED HTML WRAPPER
// =============================================================================

function emailHtml(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;">${ctaLabel || "Open Portal"}</a>`
    : "";
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#1e293b;">
  <div style="margin-bottom:20px;">
    <span style="font-size:22px;font-weight:800;color:#4f46e5;">GradLogic</span>
  </div>
  <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h2>
  ${body}
  ${cta}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 16px;">
  <p style="font-size:12px;color:#94a3b8;margin:0;">
    You're receiving this because you're registered on GradLogic.
    Log in at <a href="${env.CLIENT_URL}" style="color:#4f46e5;">${env.CLIENT_URL}</a>
  </p>
</div>`.trim();
}

// =============================================================================
// PASSWORD RESET
// =============================================================================

export async function sendPasswordResetEmail({
  name, email, resetUrl, otp,
}: { name: string; email: string; resetUrl: string; otp?: string }) {
  const subject = "Reset your GradLogic password";
  const otpLine = otp
    ? ` Your verification code is ${otp}.`
    : "";
  const text = `Hi ${name}, we received a request to reset your password.${otpLine} Use this link (valid for a limited time): ${resetUrl}. If you didn't request this, you can ignore this email.`;
  const otpHtml = otp
    ? `<p style="font-size:22px;letter-spacing:4px;font-weight:700;color:#312e81;margin:16px 0;">${esc(otp)}</p>
       <p>Enter this 6-digit code in the app, or use the button below.</p>`
    : `<p>Click the button below to choose a new password. This link expires shortly for your security.</p>`;
  const html = emailHtml(
    "Reset your password",
    `<p>Hi <strong>${esc(name)}</strong>,</p>
     <p>We received a request to reset the password for your GradLogic account.</p>
     ${otpHtml}
     <p style="font-size:13px;color:#64748b;">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>`,
    resetUrl, "Reset Password"
  );
  return sendEmail({ to: email, subject, text, html, template: "password_reset" });
}

// =============================================================================
// CAMPUS ADMIN INVITATION (existing)
// =============================================================================

export async function sendCampusAdminInvitation({
  adminName, adminEmail, campusName, temporaryPassword,
}: { adminName: string; adminEmail: string; campusName: string; temporaryPassword: string }) {
  const loginUrl = `${env.CLIENT_URL}/login`;
  const subject = `Welcome to GradLogic — ${campusName}`;
  const text = `Hi ${adminName}, you have been appointed Campus Admin for ${campusName}. Email: ${adminEmail}, Password: ${temporaryPassword}. Login: ${loginUrl}`;
  const html = emailHtml(
    `Welcome to GradLogic`,
    `<p>Hi <strong>${esc(adminName)}</strong>,</p>
     <p>You have been appointed as the Campus Admin for <strong>${esc(campusName)}</strong>.</p>
     <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
       <p style="margin:0;font-size:13px;color:#64748b;">Login credentials:</p>
       <p style="margin:8px 0 0;"><strong>Email:</strong> ${esc(adminEmail)}</p>
       <p style="margin:4px 0 0;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${esc(temporaryPassword)}</code></p>
     </div>
     <p style="font-size:13px;color:#64748b;">You will be asked to change your password on first login.</p>`,
    loginUrl, "Access Campus Portal"
  );
  return sendEmail({ to: adminEmail, subject, text, html, template: "campus_admin_invite" });
}

// =============================================================================
// PLATFORM USER INVITATION (superadmin "Invite user" — any role)
// =============================================================================

export async function sendUserInvitationEmail({
  name, email, role, temporaryPassword,
}: { name: string; email: string; role: string; temporaryPassword: string }) {
  const loginUrl = `${env.CLIENT_URL}/login`;
  const roleLabel = role.replace(/_/g, " ");
  const subject = `Welcome to GradLogic — your ${roleLabel} account`;
  const text = `Hi ${name}, an account has been created for you on GradLogic as ${roleLabel}. Email: ${email}, Temporary Password: ${temporaryPassword}. Login: ${loginUrl}. You will be asked to set a new password on first login.`;
  const html = emailHtml(
    `Welcome to GradLogic`,
    `<p>Hi <strong>${esc(name)}</strong>,</p>
     <p>An account has been created for you as <strong>${esc(roleLabel)}</strong>.</p>
     <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
       <p style="margin:0;font-size:13px;color:#64748b;">Login credentials:</p>
       <p style="margin:8px 0 0;"><strong>Email:</strong> ${esc(email)}</p>
       <p style="margin:4px 0 0;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${esc(temporaryPassword)}</code></p>
     </div>
     <p style="font-size:13px;color:#64748b;">You will be asked to change your password on first login.</p>`,
    loginUrl, "Sign In"
  );
  return sendEmail({ to: email, subject, text, html, template: "user_invite" });
}

// =============================================================================
// DRIVE INVITE
// =============================================================================

export async function sendDriveInviteEmail({
  studentName, studentEmail, studentId,
  driveName, driveDate, companyName, driveId,
}: {
  studentName: string; studentEmail: string; studentId: string;
  driveName: string; driveDate?: string; companyName?: string; driveId: string;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal`;
  const subject = `You're invited: ${driveName}`;
  const text = `Hi ${studentName}, you have been invited to participate in "${driveName}"${companyName ? ` by ${companyName}` : ""}${driveDate ? ` scheduled for ${driveDate}` : ""}. Log in to your portal to view details: ${portalUrl}`;
  const html = emailHtml(
    `Assessment Invite: ${esc(driveName)}`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>You have been selected to participate in an upcoming assessment drive.</p>
     <div style="background:#f0f4ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #4f46e5;">
       <p style="margin:0;font-weight:600;font-size:16px;">${esc(driveName)}</p>
       ${companyName ? `<p style="margin:6px 0 0;color:#4f46e5;">📋 ${esc(companyName)}</p>` : ""}
       ${driveDate ? `<p style="margin:6px 0 0;color:#64748b;">📅 ${new Date(driveDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
     </div>
     <p>Log in to your student portal to view the drive details, instructions, and prepare accordingly.</p>`,
    portalUrl, "Go to My Portal"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "drive_invite", recipientId: studentId, refId: driveId });
}

// =============================================================================
// SHORTLIST NOTIFICATION
// =============================================================================

export async function sendShortlistEmail({
  studentName, studentEmail, studentId,
  driveName, companyName, driveId,
}: {
  studentName: string; studentEmail: string; studentId: string;
  driveName: string; companyName?: string; driveId: string;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal`;
  const subject = `Congratulations! You've been shortlisted — ${driveName}`;
  const text = `Hi ${studentName}, great news! You have been shortlisted for ${driveName}${companyName ? ` at ${companyName}` : ""}. Log in to your portal for next steps: ${portalUrl}`;
  const html = emailHtml(
    `You've been Shortlisted! 🎉`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>Congratulations! You have been <strong>shortlisted</strong> for the following drive:</p>
     <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #22c55e;">
       <p style="margin:0;font-weight:600;font-size:16px;">${esc(driveName)}</p>
       ${companyName ? `<p style="margin:6px 0 0;color:#22c55e;">🏢 ${esc(companyName)}</p>` : ""}
     </div>
     <p>Keep an eye on your portal for interview scheduling and further updates.</p>`,
    portalUrl, "View My Status"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "shortlist", recipientId: studentId, refId: driveId });
}

// =============================================================================
// INTERVIEW SCHEDULED
// =============================================================================

export async function sendInterviewScheduledEmail({
  studentName, studentEmail, studentId,
  driveName, companyName, interviewDate, driveId,
}: {
  studentName: string; studentEmail: string; studentId: string;
  driveName: string; companyName?: string; interviewDate: string; driveId: string;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal`;
  const subject = `Interview Scheduled — ${companyName || driveName}`;
  const text = `Hi ${studentName}, your interview for ${driveName}${companyName ? ` at ${companyName}` : ""} has been scheduled for ${interviewDate}. Log in to your portal for details: ${portalUrl}`;
  const html = emailHtml(
    `Interview Scheduled 📅`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>Your interview has been scheduled. Here are the details:</p>
     <div style="background:#fffbeb;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #f59e0b;">
       <p style="margin:0;font-weight:600;">${esc(driveName)}</p>
       ${companyName ? `<p style="margin:6px 0 0;">🏢 ${esc(companyName)}</p>` : ""}
       <p style="margin:6px 0 0;font-size:15px;font-weight:600;color:#d97706;">📅 ${esc(interviewDate)}</p>
     </div>
     <p>Make sure to prepare well. Check your portal for any additional instructions.</p>`,
    portalUrl, "Prepare Now"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "interview_scheduled", recipientId: studentId, refId: driveId });
}

// =============================================================================
// OFFER RELEASED
// =============================================================================

export async function sendOfferEmail({
  studentName, studentEmail, studentId,
  driveName, companyName, driveId,
}: {
  studentName: string; studentEmail: string; studentId: string;
  driveName: string; companyName?: string; driveId: string;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal`;
  const subject = `Offer Released — ${companyName || driveName} 🎊`;
  const text = `Hi ${studentName}, congratulations! An offer has been released for you from ${companyName || driveName}. Log in to your portal to view details: ${portalUrl}`;
  const html = emailHtml(
    `Offer Released — Congratulations! 🎊`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>We are thrilled to inform you that an <strong>offer has been released</strong> for you!</p>
     <div style="background:#fdf4ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #a855f7;">
       ${companyName ? `<p style="margin:0;font-weight:700;font-size:18px;color:#7e22ce;">🏢 ${esc(companyName)}</p>` : ""}
       <p style="margin:6px 0 0;">${esc(driveName)}</p>
     </div>
     <p>Please log in to your portal to view the full offer details and next steps.</p>
     <p style="font-size:13px;color:#64748b;">Congratulations on this achievement — your hard work paid off!</p>`,
    portalUrl, "View My Offer"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "offer_released", recipientId: studentId, refId: driveId });
}

// =============================================================================
// PLACEMENT CONFIRMED
// =============================================================================

export async function sendPlacementConfirmedEmail({
  studentName, studentEmail, studentId,
  companyName, roleTitle, packageLpa, placementId,
}: {
  studentName: string; studentEmail: string; studentId: string;
  companyName: string; roleTitle?: string; packageLpa?: number; placementId: string;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal`;
  const subject = `Placement Confirmed — ${companyName} 🎓`;
  const text = `Hi ${studentName}, your placement at ${companyName}${roleTitle ? ` as ${roleTitle}` : ""}${packageLpa ? ` with a package of ₹${packageLpa} LPA` : ""} has been recorded. Congratulations!`;
  const html = emailHtml(
    `Placement Confirmed 🎓`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>Congratulations! Your placement has been officially confirmed and recorded.</p>
     <div style="background:#f0fdf4;padding:20px;border-radius:8px;margin:16px 0;border-left:4px solid #16a34a;text-align:center;">
       <p style="margin:0;font-size:22px;font-weight:800;color:#15803d;">🎊 ${esc(companyName)}</p>
       ${roleTitle ? `<p style="margin:8px 0 0;font-size:15px;color:#166534;">${esc(roleTitle)}</p>` : ""}
       ${packageLpa ? `<p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#16a34a;">₹${esc(packageLpa)}</p>` : ""}
     </div>
     <p>Wishing you the very best in your new role. Keep in touch!</p>`,
    portalUrl, "My Portal"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "placement_confirmed", recipientId: studentId, refId: placementId });
}

// =============================================================================
// BADGE EARNED
// =============================================================================

export async function sendBadgeEarnedEmail({
  studentName, studentEmail, studentId,
  badgeName, badgeIcon, badgeDescription, xpReward,
}: {
  studentName: string; studentEmail: string; studentId: string;
  badgeName: string; badgeIcon: string; badgeDescription: string; xpReward: number;
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal/gamification`;
  const subject = `New Badge Unlocked: ${badgeName} ${badgeIcon}`;
  const text = `Hi ${studentName}, you just earned the "${badgeName}" badge! ${badgeDescription}${xpReward > 0 ? ` You received +${xpReward} XP.` : ""} View your achievements: ${portalUrl}`;
  const html = emailHtml(
    `New Badge Unlocked! ${esc(badgeIcon)}`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>You just earned a new badge on GradLogic — keep it up!</p>
     <div style="background:#f5f3ff;padding:24px;border-radius:12px;margin:16px 0;text-align:center;border:2px solid #e0d9ff;">
       <div style="font-size:48px;">${esc(badgeIcon)}</div>
       <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#4f46e5;">${esc(badgeName)}</p>
       <p style="margin:6px 0 0;color:#64748b;font-size:13px;">${esc(badgeDescription)}</p>
       ${xpReward > 0 ? `<p style="margin:10px 0 0;font-size:15px;font-weight:600;color:#7c3aed;">+${esc(xpReward)} XP Bonus</p>` : ""}
     </div>`,
    portalUrl, "View Achievements"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "badge_earned", recipientId: studentId });
}

// =============================================================================
// MENTOR FEEDBACK
// =============================================================================

export async function sendMentorFeedbackEmail({
  studentName, studentEmail, studentId,
  mentorName, feedback, actionItems,
}: {
  studentName: string; studentEmail: string; studentId: string;
  mentorName: string; feedback: string; actionItems?: { task: string; due_date?: string }[];
}) {
  const portalUrl = `${env.CLIENT_URL}/app/student-portal/development`;
  const subject = `Session Feedback from ${mentorName}`;
  const actionHtml = actionItems?.length
    ? `<div style="margin-top:12px;"><p style="margin:0;font-weight:600;font-size:13px;color:#374151;">Action Items:</p><ul style="margin:8px 0 0;padding-left:20px;">${actionItems.map(a => `<li style="margin:4px 0;font-size:13px;">${esc(a.task)}${a.due_date ? ` <span style="color:#94a3b8;">(by ${esc(a.due_date)})</span>` : ""}</li>`).join("")}</ul></div>`
    : "";
  const text = `Hi ${studentName}, your mentor ${mentorName} shared feedback: ${feedback}${actionItems?.length ? ` Action items: ${actionItems.map(a => a.task).join(", ")}` : ""}`;
  const html = emailHtml(
    `Mentor Feedback`,
    `<p>Hi <strong>${esc(studentName)}</strong>,</p>
     <p>Your mentor <strong>${esc(mentorName)}</strong> has shared feedback from your recent session.</p>
     <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #4f46e5;">
       <p style="margin:0;font-style:italic;color:#374151;">"${esc(feedback)}"</p>
       ${actionHtml}
     </div>
     <p style="font-size:13px;color:#64748b;">Keep working on the action items to stay on track!</p>`,
    portalUrl, "View My Development Plan"
  );
  return sendEmail({ to: studentEmail, subject, text, html, template: "mentor_feedback", recipientId: studentId });
}
