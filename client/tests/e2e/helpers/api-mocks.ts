import { Page } from '@playwright/test';
import {
    CAMPUS, CAMPUS_2, ASSESSMENT_RULE, DRIVE, DRIVE_PUBLISHED, DRIVE_COMPLETED,
    QUESTION_MCQ, QUESTION_CODING, STUDENTS_LIST, EXAM_SESSION, EXAM_RESULT, USERS,
} from './test-data';

const API = process.env.API_URL || 'http://localhost:5050/api';

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function mockLoginSuccess(page: Page, role: 'admin' | 'campusAdmin' | 'student') {
    const user = role === 'admin' ? USERS.admin : role === 'campusAdmin' ? USERS.campusAdmin : USERS.student;
    await page.route('**/api/auth/login', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { accessToken: `mock-token-${role}`, user } }),
        })
    );
}

export async function mockLoginFailure(page: Page, message = 'Invalid credentials') {
    await page.route('**/api/auth/login', (route) =>
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: message }) })
    );
}

// ── Campus / College ───────────────────────────────────────────────────────────

export async function mockCampusList(page: Page, campuses = [CAMPUS, CAMPUS_2]) {
    await page.route('**/api/campuses**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: campuses }) })
    );
}

export async function mockCampusCreate(page: Page, overrides = {}) {
    await page.route('**/api/campuses', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...CAMPUS, ...overrides } }) });
        else route.continue();
    });
}

export async function mockCampusDetail(page: Page, campus = CAMPUS) {
    await page.route(`**/api/campuses/${campus.id}**`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: campus }) })
    );
}

// ── Users ──────────────────────────────────────────────────────────────────────

export async function mockUsersList(page: Page) {
    const users = [USERS.admin, USERS.hr, USERS.campusAdmin, USERS.campusStaff];
    await page.route('**/api/users**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: users }) })
    );
}

export async function mockUserCreate(page: Page) {
    await page.route('**/api/users', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: USERS.campusAdmin }) });
        else route.continue();
    });
}

export async function mockUserCreateConflict(page: Page) {
    await page.route('**/api/users', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Email already exists' }) });
        else route.continue();
    });
}

// ── Assessment Rules ───────────────────────────────────────────────────────────

export async function mockAssessmentRulesList(page: Page) {
    await page.route('**/api/assessment-rules**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [ASSESSMENT_RULE] }) })
    );
}

export async function mockAssessmentRuleCreate(page: Page) {
    await page.route('**/api/assessment-rules', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: ASSESSMENT_RULE }) });
        else route.continue();
    });
}

export async function mockAssessmentRuleDetail(page: Page, rule = ASSESSMENT_RULE) {
    await page.route(`**/api/assessment-rules/${rule.id}**`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: rule }) })
    );
}

// ── Question Bank ──────────────────────────────────────────────────────────────

export async function mockQuestionsList(page: Page) {
    await page.route('**/api/question-bank**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [QUESTION_MCQ, QUESTION_CODING] }) })
    );
}

export async function mockQuestionCreate(page: Page) {
    await page.route('**/api/question-bank', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: QUESTION_MCQ }) });
        else route.continue();
    });
}

// ── Drives ─────────────────────────────────────────────────────────────────────

export async function mockDrivesList(page: Page, drives = [DRIVE]) {
    await page.route('**/api/drives**', (route) => {
        if (route.request().method() === 'GET')
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: drives }) });
        else route.continue();
    });
}

export async function mockDriveCreate(page: Page) {
    await page.route('**/api/drives', (route) => {
        if (route.request().method() === 'POST')
            route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: DRIVE }) });
        else route.continue();
    });
}

export async function mockDriveDetail(page: Page, drive = DRIVE) {
    await page.route(`**/api/drives/${drive.id}**`, (route) => {
        if (route.request().method() === 'GET')
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: drive }) });
        else route.continue();
    });
}

export async function mockDrivePoolGenerate(page: Page, status: 'success' | 'insufficient' = 'success') {
    await page.route(`**/api/drives/*/generate`, (route) =>
        route.fulfill({
            status: status === 'success' ? 200 : 422,
            contentType: 'application/json',
            body: JSON.stringify(status === 'success'
                ? { success: true, data: { status: 'PENDING', total_generated: 50 } }
                : { success: false, error: 'Insufficient questions in bank for the requested distribution' }),
        })
    );
}

export async function mockDrivePoolApprove(page: Page) {
    await page.route('**/api/drives/*/pool/approve', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { status: 'READY' } }) })
    );
}

export async function mockDrivePublish(page: Page) {
    await page.route('**/api/drives/*/publish', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: DRIVE_PUBLISHED }) })
    );
}

export async function mockDriveCancel(page: Page) {
    await page.route('**/api/drives/*/cancel', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: DRIVE_COMPLETED }) })
    );
}

export async function mockDriveStudents(page: Page, students = STUDENTS_LIST) {
    await page.route('**/api/drives/*/students**', (route) => {
        if (route.request().method() === 'GET')
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: students }) });
        else route.continue();
    });
}

// ── Campus Drives (college admin view) ────────────────────────────────────────

export async function mockCampusDrivesList(page: Page, drives = [DRIVE_PUBLISHED]) {
    await page.route('**/api/campus-drives**', (route) => {
        if (route.request().method() === 'GET')
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: drives }) });
        else route.continue();
    });
}

export async function mockCampusDriveResults(page: Page) {
    const results = STUDENTS_LIST.map((s, i) => ({
        ...s, final_score: 70 + i * 5, passed: true, integrity_score: 90 + i,
    }));
    await page.route('**/api/campus-drives/*/results**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: results }) })
    );
}

export async function mockCampusStudents(page: Page, students = STUDENTS_LIST) {
    await page.route('**/api/colleges/students**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: students }) })
    );
}

// ── Exam Session ───────────────────────────────────────────────────────────────

export async function mockExamStart(page: Page) {
    await page.route('**/api/exam-sessions/*/start', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: EXAM_SESSION }) })
    );
}

export async function mockExamSubmit(page: Page) {
    await page.route('**/api/exam-sessions/*/submit', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: EXAM_RESULT }) })
    );
}

export async function mockMyDrives(page: Page, drives = [DRIVE_PUBLISHED]) {
    await page.route('**/api/exam-sessions/my-drives**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: drives }) })
    );
}

// ── Auth injection helper ──────────────────────────────────────────────────────

export async function injectAuth(page: Page, role: 'admin' | 'campusAdmin' | 'student') {
    const user = role === 'admin' ? USERS.admin : role === 'campusAdmin' ? USERS.campusAdmin : USERS.student;
    await page.context().addInitScript(({ token, u }) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(u));
    }, { token: `mock-token-${role}`, u: user });
}
