<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\ProjectRoleController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskHistoryController;
use App\Http\Controllers\TaskNoteController;
use App\Http\Controllers\ManhourController;
use App\Http\Controllers\PresaleController;
use App\Http\Controllers\StatController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\MenuItemController;
use App\Http\Controllers\SystemController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\TeamLoadController;
use App\Http\Controllers\ProjectNoteController;
use App\Http\Controllers\ReportScheduleController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ProjectReviewController;
use App\Http\Controllers\ReviewTokenController;
use App\Http\Controllers\PublicReviewController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AnnouncementController;

// Public review submission — no auth required
Route::middleware('throttle:30,1')->prefix('public')->group(function () {
    Route::get('/review/{token}', [PublicReviewController::class, 'show']);
    Route::post('/review/{token}/submit', [PublicReviewController::class, 'submit']);
});

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/signup', [AuthController::class, 'signup'])
    ->middleware(['throttle:5,1', 'signup.enabled']);
Route::get('/branding', [SettingController::class, 'branding']);
Route::get('/announcements/active', [AnnouncementController::class, 'active']);

Route::middleware(['auth:sanctum', 'token.lifetime', 'throttle:api'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile'])->middleware('permission:profile.update');
    Route::post('/profile/avatar', [AuthController::class, 'uploadAvatar'])->middleware('permission:profile.update');
    Route::delete('/profile/avatar', [AuthController::class, 'removeAvatar'])->middleware('permission:profile.update');
    Route::post('/force-password-change', [AuthController::class, 'forcePasswordChange']);
    Route::get('/notification-preferences', [AuthController::class, 'notificationPreferences'])->middleware('permission:notification_center.read');
    Route::put('/notification-preferences', [AuthController::class, 'updateNotificationPreferences'])->middleware('permission:notification_center.update');

    Route::get('/announcements', [AnnouncementController::class, 'index'])->middleware('permission:announcements.read');
    Route::post('/announcements', [AnnouncementController::class, 'store'])->middleware('permission:announcements.create');
    Route::put('/announcements/{id}', [AnnouncementController::class, 'update'])->middleware('permission:announcements.update');
    Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy'])->middleware('permission:announcements.delete');
    Route::post('/announcements/{id}/attachment', [AnnouncementController::class, 'uploadAttachment'])->middleware('permission:announcements.update');
    Route::delete('/announcements/{id}/attachment', [AnnouncementController::class, 'removeAttachment'])->middleware('permission:announcements.update');

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // 1. Projects Routes
    Route::get('/projects', [ProjectController::class, 'index'])->middleware('permission:project_board.read');
    Route::post('/projects', [ProjectController::class, 'store'])->middleware('permission:list_project.create');
    Route::delete('/projects', [ProjectController::class, 'destroy'])->middleware('permission:list_project.delete');
    Route::get('/projects/{id}/quotas', [ProjectController::class, 'quotas'])->middleware('permission:project_board.read');
    Route::get('/projects/{id}/balance', [ProjectController::class, 'balance'])->middleware('permission:project_board.read');
    Route::get('/projects/{id}/members', [ProjectController::class, 'members'])->middleware('permission:project_board.read');
    Route::get('/projects/{id}/notes', [ProjectNoteController::class, 'index'])->middleware('permission:project_board.read');
    Route::post('/projects/{id}/notes', [ProjectNoteController::class, 'store'])->middleware('permission:project_board.read');
    Route::put('/projects/{id}/notes/{noteId}', [ProjectNoteController::class, 'update'])->middleware('permission:project_board.read');
    Route::delete('/projects/{id}/notes/{noteId}', [ProjectNoteController::class, 'destroy'])->middleware('permission:project_board.read');
    Route::get('/projects/{id}/assignment-options', [ProjectController::class, 'assignmentOptions'])->middleware('permission:list_project.update');
    Route::put('/projects/{id}/members', [ProjectController::class, 'syncMembers'])->middleware('permission:list_project.update');
    Route::patch('/projects/{id}/status', [ProjectController::class, 'updateStatus'])->middleware('permission:project_board.update');
    Route::post('/projects/{id}/favorite', [ProjectController::class, 'favorite'])->middleware('permission:project_board.read');
    Route::delete('/projects/{id}/favorite', [ProjectController::class, 'unfavorite'])->middleware('permission:project_board.read');
    Route::put('/projects/{id}/review-client-emails', [ProjectController::class, 'updateReviewClientEmails'])->middleware('permission:review.update');

    // 1.5 System Log Routes
    Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:system_log.read');
    Route::post('/activity-logs/cleanup', [ActivityLogController::class, 'cleanup'])
        ->middleware(['permission:system_log.delete', 'throttle:5,1']);

    // 2. Users Routes
    Route::get('/users', [UserController::class, 'index'])->middleware('permission:teams_users.read');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:teams_users.create');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:teams_users.update');
    Route::patch('/users/{user}', [UserController::class, 'update'])->middleware('permission:teams_users.update');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:teams_users.delete');

    // 3. Roles Routes
    Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:access_control.read');
    Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:access_control.create');
    Route::put('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:access_control.update');
    Route::patch('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:access_control.update');
    Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:access_control.delete');

    // 3.2 Menu Items Routes
    Route::get('/menu-items', [MenuItemController::class, 'index'])->middleware('permission:modules_management.read');
    Route::post('/menu-items', [MenuItemController::class, 'store'])->middleware('permission:modules_management.create');
    Route::put('/menu-items/{menuItem}', [MenuItemController::class, 'update'])->middleware('permission:modules_management.update');
    Route::patch('/menu-items/{menuItem}', [MenuItemController::class, 'update'])->middleware('permission:modules_management.update');
    Route::delete('/menu-items/{menuItem}', [MenuItemController::class, 'destroy'])->middleware('permission:modules_management.delete');

    // 3.5 Project Roles Routes
    Route::get('/project-roles', [ProjectRoleController::class, 'index'])->middleware('permission:project_roles.read');
    Route::post('/project-roles', [ProjectRoleController::class, 'store'])->middleware('permission:project_roles.create');
    Route::put('/project-roles/{project_role}', [ProjectRoleController::class, 'update'])->middleware('permission:project_roles.update');
    Route::patch('/project-roles/{project_role}', [ProjectRoleController::class, 'update'])->middleware('permission:project_roles.update');
    Route::delete('/project-roles/{project_role}', [ProjectRoleController::class, 'destroy'])->middleware('permission:project_roles.delete');

    Route::get('/team-load', [TeamLoadController::class, 'index'])->middleware('permission:load.read');
    Route::post('/team-load/excluded-dates', [TeamLoadController::class, 'storeExcludedDate'])->middleware('permission:load.read');
    Route::delete('/team-load/excluded-dates/{id}', [TeamLoadController::class, 'destroyExcludedDate'])->middleware('permission:load.read');

    // 4. Tasks Routes
    Route::get('/tasks', [TaskController::class, 'index'])->middleware('permission:project_board.read');
    Route::get('/tasks/template', [TaskController::class, 'downloadTemplate'])->middleware('permission:project_board.read');
    Route::get('/tasks/backlog', [TaskController::class, 'backlog'])->middleware('permission:project_board.read');
    Route::post('/tasks/import', [TaskController::class, 'import'])->middleware('permission:project_board.create');
    Route::post('/tasks/description-images', [TaskController::class, 'uploadDescriptionImage'])->middleware('permission:project_board.read');
    Route::post('/tasks', [TaskController::class, 'store'])->middleware('permission:project_board.create');
    Route::post('/tasks/{id}/duplicate', [TaskController::class, 'duplicate'])->middleware('permission:project_board.create');
    Route::put('/tasks/bulk-edit', [TaskController::class, 'bulkEditManhours'])->middleware('permission:project_board.update');
    Route::delete('/tasks/bulk-delete', [TaskController::class, 'bulkDestroy'])->middleware('permission:project_board.update');
    Route::get('/tasks/{taskId}/notes', [TaskNoteController::class, 'index'])->middleware('permission:project_board.read');
    Route::post('/tasks/{taskId}/notes', [TaskNoteController::class, 'store'])->middleware('permission:project_board.read');
    Route::delete('/tasks/{taskId}/notes/{noteId}', [TaskNoteController::class, 'destroy'])->middleware('permission:project_board.read');
    Route::get('/tasks/{taskId}/history', [TaskHistoryController::class, 'index'])->middleware('permission:project_board.read');
    Route::put('/tasks/{id}', [TaskController::class, 'update'])->middleware('permission:project_board.update');
    Route::delete('/tasks/{id}', [TaskController::class, 'destroy'])->middleware('permission:project_board.update');
    Route::put('/tasks/{id}/status', [TaskController::class, 'updateStatus'])->middleware('permission:project_board.update');
    Route::put('/tasks/{id}/assignees', [TaskController::class, 'updateAssignees'])->middleware('permission:project_board.update');
    Route::post('/tasks/{id}/promote', [TaskController::class, 'promote'])->middleware('permission:project_board.update');
    Route::post('/tasks/{id}/send-to-backlog', [TaskController::class, 'sendToBacklog'])->middleware('permission:project_board.update');

    // 4. Manhours Routes
    Route::get('/manhours', [ManhourController::class, 'index'])->middleware('permission:project_board.read');
    Route::post('/manhours', [ManhourController::class, 'store'])->middleware('permission:project_board.create');

    // 5. Presales Routes
    Route::get('/presales', [PresaleController::class, 'index'])->middleware('permission:presales.read');
    Route::post('/presales', [PresaleController::class, 'store'])->middleware('permission:presales.create');
    Route::put('/presales/{presale}', [PresaleController::class, 'update'])->middleware('permission:presales.update');
    Route::patch('/presales/{presale}', [PresaleController::class, 'update'])->middleware('permission:presales.update');
    Route::delete('/presales/{presale}', [PresaleController::class, 'destroy'])->middleware('permission:presales.delete');
    Route::put('/presales/{id}/business', [PresaleController::class, 'updateBusiness'])->middleware('permission:presales.update');
    Route::post('/presales/{id}/business/acknowledge', [PresaleController::class, 'acknowledgeBusiness'])->middleware('permission:presales.update');
    Route::put('/presales/{id}/development', [PresaleController::class, 'updateDevelopment'])->middleware('permission:presales.update');
    Route::post('/presales/{id}/development/acknowledge', [PresaleController::class, 'acknowledgeDevelopment'])->middleware('permission:presales.update');
    Route::put('/presales/{id}/operation', [PresaleController::class, 'updateOperation'])->middleware('permission:presales.update');
    Route::post('/presales/{id}/operation/acknowledge', [PresaleController::class, 'acknowledgeOperation'])->middleware('permission:presales.update');
    Route::post('/presales/{id}/proceed-project', [PresaleController::class, 'proceedToProject'])->middleware('permission:presales.update');

    // 8. Analytics
    Route::get('/stats', [StatController::class, 'stats'])->middleware('permission:reports.read');
    Route::get('/dashboard/overview', [StatController::class, 'dashboardOverview'])->middleware('permission:dashboard.read');
    Route::get('/stats/recent', [StatController::class, 'recentLogs'])->middleware('permission:dashboard.read');
    Route::get('/reports/efficiency', [StatController::class, 'efficiency'])->middleware('permission:reports.read');
    Route::get('/reports/revenue-trend', [StatController::class, 'revenueTrend'])->middleware('permission:reports.read');
    Route::get('/reports/company-projects', [StatController::class, 'companyProjects'])->middleware('permission:reports.read');
    Route::get('/reports/company-financials', [StatController::class, 'companyFinancials'])->middleware('permission:reports.read');
    Route::get('/reports/expense-payment-breakdown', [StatController::class, 'expensePaymentBreakdown'])->middleware('permission:reports.read');

    Route::get('/reports/projects', [ReportController::class, 'getProjects'])->middleware('permission:generate_report.read');
    Route::post('/reports/generate', [ReportController::class, 'generate'])->middleware('permission:generate_report.create');
    Route::post('/reports/send-email', [ReportController::class, 'sendEmail'])->middleware('permission:generate_report.create');

    // Report Schedules
    Route::get('/report-schedules', [ReportScheduleController::class, 'index'])->middleware('permission:generate_report.read');
    Route::post('/report-schedules', [ReportScheduleController::class, 'store'])->middleware('permission:generate_report.create');
    Route::put('/report-schedules/{id}', [ReportScheduleController::class, 'update'])->middleware('permission:generate_report.create');
    Route::patch('/report-schedules/{id}/toggle', [ReportScheduleController::class, 'toggle'])->middleware('permission:generate_report.create');
    Route::delete('/report-schedules/{id}', [ReportScheduleController::class, 'destroy'])->middleware('permission:generate_report.create');

    // 9. Roles & Permissions (Deprecated duplication, keeping for safety if referenced)
    Route::get('/permissions', [PermissionController::class, 'index'])->middleware('permission:access_control.read');

    // 10. System Management
    Route::get('/settings/all', [SettingController::class, 'getSettings'])->middleware('permission:settings.read');
    Route::post('/settings/update', [SettingController::class, 'updateSettings'])
        ->middleware(['permission:settings.update', 'throttle:20,1']);
    Route::post('/settings/branding/logo', [SettingController::class, 'uploadLogo'])
        ->middleware(['permission:settings.update', 'throttle:20,1']);
    Route::delete('/settings/branding/logo', [SettingController::class, 'removeLogo'])
        ->middleware(['permission:settings.update', 'throttle:20,1']);
    Route::post('/settings/branding/favicon', [SettingController::class, 'uploadFavicon'])
        ->middleware(['permission:settings.update', 'throttle:20,1']);
    Route::delete('/settings/branding/favicon', [SettingController::class, 'removeFavicon'])
        ->middleware(['permission:settings.update', 'throttle:20,1']);
    Route::post('/settings/test-smtp', [SettingController::class, 'testSmtp'])
        ->middleware(['permission:settings.update', 'throttle:10,1']);
    Route::post('/system/reset', [SystemController::class, 'resetData'])
        ->middleware(['permission:settings.reset', 'throttle:3,1']);
    Route::get('/system/backup/sql', [SystemController::class, 'backupSql'])
        ->middleware(['permission:settings.update', 'throttle:10,1']);
    Route::get('/system/backup/csv', [SystemController::class, 'backupCsv'])
        ->middleware(['permission:settings.update', 'throttle:10,1']);

    // 14. Review — evaluations & questions configuration
    Route::get('/review/projects', [ProjectReviewController::class, 'eligibleProjects'])->middleware('permission:review.read');
    Route::patch('/review/projects/{id}/eligibility', [ProjectReviewController::class, 'updateEligibility'])->middleware('permission:review.update');
    Route::get('/review/evaluations', [ReviewController::class, 'evaluations'])->middleware('permission:review.read');
    Route::post('/review/evaluations', [ReviewController::class, 'store'])->middleware('permission:review.create');
    Route::put('/review/evaluations/{id}', [ReviewController::class, 'updateEvaluation'])->middleware('permission:review.update');
    Route::delete('/review/evaluations/{id}', [ReviewController::class, 'destroyEvaluation'])->middleware('permission:review.delete');
    Route::post('/review/evaluations/{id}/questions', [ReviewController::class, 'storeQuestion'])->middleware('permission:review.update');
    Route::put('/review/questions/{id}', [ReviewController::class, 'updateQuestion'])->middleware('permission:review.update');
    Route::delete('/review/questions/{id}', [ReviewController::class, 'deleteQuestion'])->middleware('permission:review.delete');

    // 15. Project Review Submissions
    Route::get('/review/radar', [ProjectReviewController::class, 'radar'])->middleware('permission:review.read');
    Route::get('/projects/{id}/reviews/summary', [ProjectReviewController::class, 'summary'])->middleware('permission:review.read');
    Route::get('/projects/{id}/reviews/trigger-status', [ProjectReviewController::class, 'triggerStatus'])->middleware('permission:review.read');
    Route::get('/projects/{id}/reviews', [ProjectReviewController::class, 'index'])->middleware('permission:review.read');
    Route::get('/projects/{id}/reviews/{reviewId}', [ProjectReviewController::class, 'show'])->middleware('permission:review.read');
    Route::patch('/projects/{id}/reviews/{reviewId}/exclusion', [ProjectReviewController::class, 'updateExclusion'])->middleware('permission:review.update');
    Route::post('/projects/{id}/evaluations/{evalId}/reviews', [ProjectReviewController::class, 'store'])->middleware('permission:review.create');

    // 16. Review Tokens (shareable links)
    Route::get('/projects/{projectId}/evaluations/{evalId}/tokens', [ReviewTokenController::class, 'index'])->middleware('permission:review.update');
    Route::post('/projects/{projectId}/evaluations/{evalId}/tokens', [ReviewTokenController::class, 'store'])->middleware('permission:review.update');
    Route::delete('/review/tokens/{id}', [ReviewTokenController::class, 'destroy'])->middleware('permission:review.update');
    Route::patch('/review/tokens/{id}/emails', [ReviewTokenController::class, 'updateEmails'])->middleware('permission:review.update');
    Route::get('/review/tokens/{id}/email-preview', [ReviewTokenController::class, 'emailPreview'])->middleware('permission:review.update');
    Route::post('/review/tokens/{id}/send-email', [ReviewTokenController::class, 'sendEmail'])->middleware('permission:review.update');
});
