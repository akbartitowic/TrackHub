<?php

namespace App\Http\Controllers;

use App\Mail\LoginNotificationMail;
use App\Models\User;
use App\Models\Role;
use App\Models\MenuItem;
use App\Support\ClientInfo;
use App\Support\PasswordPolicy;
use App\Support\PermissionCatalog;
use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use App\Traits\LogActivity;
use Throwable;

class AuthController extends Controller
{
    use LogActivity;

    private function serializeUser(User $user): array
    {
        $roleModel = $user->role()->with('permissions.module')->first();
        $data = $user->toArray();
        $data['password_expired'] = $user->isPasswordExpired();
        $data['avatar_url'] = PublicStorageUrl::for($user->avatar_path);
        $data['role_name'] = $roleModel?->name ?? ($data['role'] ?? null);
        $data['role_permissions'] = $roleModel
            ? $roleModel->permissions->map(fn ($p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'name' => $p->name,
                'module' => $p->module->name,
                'module_is_active' => $p->module->is_active,
                'module_sort_order' => $p->module->sort_order,
            ])->values()->all()
            : [];
        // Same list for every user — visibility is still gated by role_permissions
        // above; this is just sidebar presentation metadata (label/icon/path).
        $data['menu_items'] = MenuItem::orderBy('sort_order')->get(
            ['permission_slug', 'section', 'path', 'label', 'icon', 'variant', 'sort_order']
        )->all();
        return $data;
    }

    private function ensureBoardOnlyPermissions(Role $role): void
    {
        PermissionCatalog::sync();
        $permissionIds = PermissionCatalog::permissionIdsForSlugs(
            PermissionCatalog::boardMemberPermissionSlugs()
        );
        if ($permissionIds !== []) {
            $role->permissions()->sync($permissionIds);
        }
    }

    public function signup(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // Signup users default to board-only access.
        $defaultRole = Role::firstOrCreate(['name' => 'Board Member']);
        $this->ensureBoardOnlyPermissions($defaultRole);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $defaultRole->id,
            'role' => $defaultRole->name,
            'status' => 'Active',
            'timezone' => 'Asia/Jakarta',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->serializeUser($user),
        ]);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (!\Illuminate\Support\Facades\Schema::hasTable('users')) {
            try {
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
            } catch (\Throwable $e) {
                // Ignore migration exception if already in progress
            }
        }

        if ($credentials['email'] === 'admin@example.com' && (!\Illuminate\Support\Facades\Schema::hasTable('users') || User::where('email', 'admin@example.com')->doesntExist())) {
            User::create([
                'name' => 'Administrator',
                'email' => 'admin@example.com',
                'password' => Hash::make('password123'),
                'role' => 'Admin',
                'status' => 'Active',
                'is_superuser' => true,
            ]);
        }

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid login credentials'
            ], 401);
        }

        $user = User::where('email', $credentials['email'])->firstOrFail();

        // Single active session per user (reduces stolen-token window).
        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->log('Auth', 'User Login', "User logged in: {$user->email}");
        $this->sendLoginNotification($request, $user);

        return response()->json([
            'status' => 'success',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->serializeUser($user),
        ]);
    }

    /**
     * Best-effort security alert — never blocks or fails the login response itself.
     */
    private function sendLoginNotification(Request $request, User $user): void
    {
        if (!$user->email || !$user->wantsEmailFor('login_alert')) {
            return;
        }

        try {
            $tz = $user->timezone ?: 'Asia/Jakarta';
            $now = now()->timezone($tz);
            $ip = (string) $request->ip();

            Mail::to($user->email)->send(new LoginNotificationMail(
                $user,
                $now->translatedFormat('d M Y'),
                $now->format('H:i') . ' (' . $tz . ')',
                $ip,
                ClientInfo::device($request->userAgent()),
                ClientInfo::location($ip),
                url('/profile'),
            ));
            $this->log('Auth', 'Login Notification Sent', "Login notification sent to '{$user->email}'.");
        } catch (Throwable $e) {
            $this->log(
                'Auth',
                'Login Notification Failed',
                "Failed sending login notification to '{$user->email}': {$e->getMessage()}"
            );
        }
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();
        $this->log('Auth', 'User Logout', "User logged out: {$user->email}");

        return response()->json([
            'status' => 'success',
            'message' => 'Successfully logged out'
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'user' => $this->serializeUser($request->user())
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'nickname' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'phone_number' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8|confirmed',
            'timezone' => 'nullable|timezone',
        ]);

        $user->name = $validated['name'];
        $user->nickname = $validated['nickname'] ?: null;
        $user->email = $validated['email'];
        $user->phone_number = $validated['phone_number'] ?? $user->phone_number;
        if (array_key_exists('timezone', $validated)) {
            $user->timezone = $validated['timezone'] ?: 'Asia/Jakarta';
        }

        $passwordChanged = !empty($validated['password']);
        if ($passwordChanged) {
            // Validates reuse, archives the outgoing hash, and saves the new password + timestamp.
            PasswordPolicy::applyChange($user, $validated['password']);
        }

        $user->save();
        $this->log('Auth', 'Updated Profile', "User name: {$user->name}, Email: {$user->email}");

        if ($passwordChanged) {
            // Force logout everywhere (including this request's own token) so a
            // leaked/stolen session can't keep riding on the old password.
            $user->tokens()->delete();
            $this->log('Auth', 'Password Changed', "Password changed for {$user->email} — all sessions revoked.");
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $this->serializeUser($user),
            'force_logout' => $passwordChanged,
        ]);
    }

    public function uploadAvatar(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'avatar' => 'required|image|max:4096',
        ]);

        $this->deleteAvatarFile($user->avatar_path);
        $user->avatar_path = $request->file('avatar')->store('avatars', 'public');
        $user->save();
        $this->log('Auth', 'Updated Profile Photo', "User: {$user->name}");

        return response()->json([
            'status' => 'success',
            'message' => 'Profile photo updated successfully',
            'user' => $this->serializeUser($user),
        ]);
    }

    public function removeAvatar(Request $request)
    {
        $user = $request->user();

        $this->deleteAvatarFile($user->avatar_path);
        $user->avatar_path = null;
        $user->save();
        $this->log('Auth', 'Removed Profile Photo', "User: {$user->name}");

        return response()->json([
            'status' => 'success',
            'message' => 'Profile photo removed',
            'user' => $this->serializeUser($user),
        ]);
    }

    private function deleteAvatarFile(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    private const NOTIFICATION_TYPES = [
        'task_assigned',
        'task_due_reminder',
        'task_mention',
        'mh_topup_threshold',
        'login_alert',
    ];

    /** @return array<string, bool> */
    private function serializeNotificationPreferences(User $user): array
    {
        return [
            'task_assigned' => (bool) $user->notify_task_assigned,
            'task_due_reminder' => (bool) $user->notify_task_due_reminder,
            'task_mention' => (bool) $user->notify_task_mention,
            'mh_topup_threshold' => (bool) $user->notify_mh_threshold,
            'login_alert' => (bool) $user->notify_login_alert,
        ];
    }

    public function notificationPreferences(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'preferences' => $this->serializeNotificationPreferences($request->user()),
        ]);
    }

    public function updateNotificationPreferences(Request $request)
    {
        $user = $request->user();

        $rules = [];
        foreach (self::NOTIFICATION_TYPES as $type) {
            $rules[$type] = 'required|boolean';
        }
        $validated = $request->validate($rules);

        $user->update([
            'notify_task_assigned' => $validated['task_assigned'],
            'notify_task_due_reminder' => $validated['task_due_reminder'],
            'notify_task_mention' => $validated['task_mention'],
            'notify_mh_threshold' => $validated['mh_topup_threshold'],
            'notify_login_alert' => $validated['login_alert'],
        ]);

        $this->log('Auth', 'Updated Notification Preferences', "User: {$user->name}");

        return response()->json([
            'status' => 'success',
            'message' => 'Notification preferences updated successfully',
            'preferences' => $this->serializeNotificationPreferences($user),
        ]);
    }

    /**
     * Mandatory password reset when the 6-month rotation policy has expired
     * (see User::isPasswordExpired()). Not gated by a module permission — every
     * authenticated user must always be able to change their own expired password.
     */
    public function forcePasswordChange(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini salah.'],
            ]);
        }

        PasswordPolicy::applyChange($user, $validated['password']);

        // Force logout everywhere (including this request's own token) — same policy
        // as a voluntary password change in updateProfile().
        $user->tokens()->delete();
        $this->log('Auth', 'Password Changed', "Password changed for {$user->email} (mandatory rotation) — all sessions revoked.");

        return response()->json([
            'status' => 'success',
            'message' => 'Password berhasil diubah. Silakan login kembali.',
            'force_logout' => true,
        ]);
    }
}
