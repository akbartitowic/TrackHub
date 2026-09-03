<?php

namespace Tests\Feature;

use App\Models\MenuItem;
use App\Models\Module;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Support\PermissionCatalog;
use App\Support\UserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::sync();
    }

    public function test_sync_provisions_modules_and_permissions_from_menu_action_map(): void
    {
        $this->assertSame(count(PermissionCatalog::menuActionMap()), Module::count());
        $this->assertGreaterThan(0, Permission::count());
        $this->assertSame(0, Permission::whereNull('module_id')->count());

        $dashboard = Module::where('slug', 'dashboard')->first();
        $this->assertNotNull($dashboard);
        $this->assertTrue(
            Permission::where('slug', 'dashboard.read')->where('module_id', $dashboard->id)->exists()
        );
    }

    public function test_sync_is_idempotent(): void
    {
        $moduleCountBefore = Module::count();
        $permissionCountBefore = Permission::count();

        PermissionCatalog::sync();

        $this->assertSame($moduleCountBefore, Module::count());
        $this->assertSame($permissionCountBefore, Permission::count());
    }

    public function test_role_permission_grants_and_revokes_middleware_access(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);

        Sanctum::actingAs($user);
        $this->getJson('/api/dashboard/overview')->assertForbidden();

        $dashboardRead = Permission::where('slug', 'dashboard.read')->firstOrFail();
        $role->permissions()->sync([$dashboardRead->id]);

        $this->getJson('/api/dashboard/overview')->assertOk();

        $role->permissions()->sync([]);

        $this->getJson('/api/dashboard/overview')->assertForbidden();
    }

    public function test_deactivating_module_blocks_access_even_with_permission_granted(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 2']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $dashboardRead = Permission::where('slug', 'dashboard.read')->firstOrFail();
        $role->permissions()->sync([$dashboardRead->id]);

        Sanctum::actingAs($user);
        $this->getJson('/api/dashboard/overview')->assertOk();

        $module = Module::where('slug', 'dashboard')->firstOrFail();
        $module->update(['is_active' => false]);

        $this->getJson('/api/dashboard/overview')->assertForbidden();

        $module->update(['is_active' => true]);
        $this->getJson('/api/dashboard/overview')->assertOk();
    }

    public function test_non_admin_role_cannot_update_menu_items_even_with_permission(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 3']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $role->permissions()->sync(
            Permission::whereIn('slug', ['modules_management.read', 'modules_management.update'])->pluck('id')
        );
        $item = MenuItem::first();

        Sanctum::actingAs($user);
        // Middleware permission check passes, but MenuItemController::update()
        // additionally requires UserAccess::isPrivileged() (role literally "admin").
        $this->putJson("/api/menu-items/{$item->id}", ['label' => 'Unauthorized Change'])
            ->assertForbidden();
    }

    public function test_user_without_permission_cannot_list_menu_items(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 4']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);

        Sanctum::actingAs($user);
        $this->getJson('/api/menu-items')->assertForbidden();
    }

    /**
     * Regression test for a bug found while writing this suite: `users` has
     * both a `role` string column and a `role()` relation of the same name,
     * so `$user->role` (magic property) always resolved to the stale string
     * instead of the real role_id relation. UserAccess must use the relation
     * as the source of truth, not whatever the legacy string column says.
     */
    public function test_privilege_is_based_on_role_id_relation_not_stale_role_string(): void
    {
        $regularRole = Role::firstOrCreate(['name' => 'RBAC Test Role 5']);
        // Deliberately desynced: role_id points to a non-admin role, but the
        // legacy `role` string column still says "Admin".
        $user = User::factory()->create(['role_id' => $regularRole->id, 'role' => 'Admin']);

        $this->assertFalse(UserAccess::isPrivileged($user));
        $this->assertSame('rbac test role 5', UserAccess::roleName($user));
    }

    /**
     * The `is_superuser` flag (formerly a hardcoded email check) must bypass
     * both permission checks and privilege checks, regardless of role.
     */
    public function test_superuser_flag_bypasses_permission_and_privilege_checks(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 6']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        // `is_superuser` is deliberately not mass-assignable (not in $fillable);
        // set it directly to bypass that, same as a migration/tinker would.
        $user->is_superuser = true;
        $user->save();

        $this->assertTrue($user->fresh()->hasPermission('nonexistent.slug'));
        $this->assertTrue(UserAccess::isPrivileged($user->fresh()));

        $regularUser = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $this->assertFalse($regularUser->hasPermission('nonexistent.slug'));
        $this->assertFalse(UserAccess::isPrivileged($regularUser));
    }

    /**
     * Overriding a task's `updated_at` (shown as "Diperbarui" on the board)
     * is gated behind its own permission, separate from project_board.update.
     */
    public function test_editing_task_last_update_requires_dedicated_permission(): void
    {
        $project = Project::factory()->create();
        $projectRole = \App\Models\ProjectRole::firstOrCreate(['name' => 'RBAC Test Project Role']);
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 11']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $role->permissions()->sync(
            Permission::whereIn('slug', ['project_board.read', 'project_board.update'])->pluck('id')
        );
        DB::table('project_members')->insert([
            'project_id' => $project->id, 'user_id' => $user->id, 'project_role_id' => $projectRole->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $task = Task::factory()->create(['project_id' => $project->id]);

        Sanctum::actingAs($user);

        $payload = [
            'title' => $task->title,
            'feature_title' => $task->feature_title,
            'status' => $task->status,
            'priority' => $task->priority,
            'updated_at' => '2020-01-01',
        ];

        // project_board.update alone is not enough to override the timestamp.
        $this->putJson("/api/tasks/{$task->id}", $payload)->assertStatus(403);

        $role->permissions()->attach(
            Permission::where('slug', 'project_board.edit_last_update')->value('id')
        );
        $this->putJson("/api/tasks/{$task->id}", $payload)->assertOk();

        $this->assertSame('2020-01-01', $task->fresh()->updated_at->toDateString());
    }

    public function test_admin_can_crud_menu_items(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'modules_management.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $create = $this->postJson('/api/menu-items', [
            'permission_slug' => 'dashboard.read',
            'section' => 'Business',
            'path' => '/test-item',
            'label' => 'Test Item',
            'icon' => 'Star',
        ])->assertOk()->json('data');

        $this->putJson("/api/menu-items/{$create['id']}", ['label' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('data.label', 'Renamed');

        $this->deleteJson("/api/menu-items/{$create['id']}")->assertOk();
        $this->assertNull(MenuItem::find($create['id']));
    }

    public function test_menu_item_creation_rejects_unknown_permission_slug(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'modules_management.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $this->postJson('/api/menu-items', [
            'permission_slug' => 'does_not_exist.read',
            'path' => '/x',
            'label' => 'X',
            'icon' => 'Star',
        ])->assertStatus(422);
    }

    public function test_non_admin_cannot_delete_menu_items_even_with_permission(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 7']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $role->permissions()->sync(
            Permission::where('slug', 'like', 'modules_management.%')->pluck('id')
        );
        $item = MenuItem::first();

        Sanctum::actingAs($user);
        $this->deleteJson("/api/menu-items/{$item->id}")->assertForbidden();
        $this->assertNotNull(MenuItem::find($item->id));
    }

    public function test_privileged_user_can_crud_roles(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'access_control.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/roles', ['name' => 'QA Tester'])->assertOk()->json();

        $this->putJson("/api/roles/{$created['id']}", ['name' => 'QA Tester Renamed'])->assertOk();

        $this->deleteJson("/api/roles/{$created['id']}")->assertOk();
        $this->assertNull(Role::find($created['id']));
    }

    public function test_non_privileged_user_cannot_create_role_even_with_permission(): void
    {
        $role = Role::firstOrCreate(['name' => 'RBAC Test Role 8']);
        $user = User::factory()->create(['role_id' => $role->id, 'role' => $role->name]);
        $role->permissions()->sync(
            Permission::where('slug', 'like', 'access_control.%')->pluck('id')
        );

        Sanctum::actingAs($user);
        // Middleware permission check passes, but RoleController::store()
        // additionally requires UserAccess::isPrivileged().
        $this->postJson('/api/roles', ['name' => 'Should Not Exist'])->assertForbidden();
        $this->assertTrue(Role::where('name', 'Should Not Exist')->doesntExist());
    }

    public function test_admin_role_cannot_be_renamed_or_deleted(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'access_control.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $this->putJson("/api/roles/{$adminRole->id}", ['name' => 'Renamed Admin'])->assertStatus(422);
        $this->deleteJson("/api/roles/{$adminRole->id}")->assertStatus(422);

        $this->assertSame('Admin', $adminRole->fresh()->name);
    }

    public function test_non_privileged_user_cannot_assign_admin_role_to_a_new_user(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $regularRole = Role::firstOrCreate(['name' => 'RBAC Test Role 9']);
        $actor = User::factory()->create(['role_id' => $regularRole->id, 'role' => $regularRole->name]);
        $regularRole->permissions()->sync(
            Permission::where('slug', 'like', 'teams_users.%')->pluck('id')
        );
        Sanctum::actingAs($actor);

        $this->postJson('/api/users', [
            'name' => 'New Guy',
            'role_id' => $adminRole->id,
            'email' => 'newguy-rbac-test@example.com',
            'password' => 'password123',
            'status' => 'Active',
        ])->assertStatus(403);

        $this->assertTrue(User::where('email', 'newguy-rbac-test@example.com')->doesntExist());
    }

    public function test_privileged_user_can_assign_admin_role_to_a_new_user(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'teams_users.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/users', [
            'name' => 'New Admin',
            'role_id' => $adminRole->id,
            'email' => 'newadmin-rbac-test@example.com',
            'password' => 'password123',
            'status' => 'Active',
        ])->assertOk()->json();

        // ->role() (relation), not ->role (magic property, which shadows to
        // the legacy string column) — see test_privilege_is_based_on_role_id...
        $this->assertSame('Admin', User::find($created['id'])->role()->first()->name);
    }

    public function test_non_privileged_actor_cannot_modify_a_privileged_users_account(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $targetAdmin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);

        $regularRole = Role::firstOrCreate(['name' => 'RBAC Test Role 10']);
        $actor = User::factory()->create(['role_id' => $regularRole->id, 'role' => $regularRole->name]);
        $regularRole->permissions()->sync(
            Permission::where('slug', 'like', 'teams_users.%')->pluck('id')
        );
        Sanctum::actingAs($actor);

        $this->putJson("/api/users/{$targetAdmin->id}", [
            'name' => 'Hacked Name',
            'role_id' => $regularRole->id,
            'email' => $targetAdmin->email,
            'status' => 'Active',
        ])->assertStatus(403);

        $this->assertSame($targetAdmin->name, $targetAdmin->fresh()->name);
    }

    public function test_user_cannot_delete_their_own_account(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'Admin']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'role' => $adminRole->name]);
        $adminRole->permissions()->sync(
            Permission::where('slug', 'like', 'teams_users.%')->pluck('id')
        );
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$admin->id}")->assertStatus(422);
        $this->assertNotNull(User::find($admin->id));
    }
}
