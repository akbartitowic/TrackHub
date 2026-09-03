<?php

namespace App\Support;

use App\Models\Module;
use App\Models\Permission;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PermissionCatalog
{
    /**
     * Menu permissions aligned to available API endpoints.
     *
     * @return array<string, list<string>>
     */
    public static function menuActionMap(): array
    {
        return [
            'Dashboard' => ['read'],
            'Presales' => ['create', 'read', 'update', 'delete'],
            'Sales' => ['create', 'read', 'update', 'delete'],
            'List Company' => ['create', 'read', 'update', 'delete'],
            'Category Project' => ['create', 'read', 'update', 'delete'],
            'Sales Category Project' => ['create', 'read', 'update', 'delete'],
            'List Project' => ['create', 'read', 'update', 'delete'],
            'Project Board' => ['create', 'read', 'update', 'edit_last_update'],
            'Load' => ['read'],
            'Review' => ['create', 'read', 'update', 'delete', 'view_all'],
            'Reports' => ['read'],
            'Generate Report' => ['create', 'read'],
            'Finance Monitoring' => ['create', 'read', 'update', 'delete'],
            'Finance Categories' => ['create', 'read', 'update', 'delete'],
            'Finance Report' => ['create', 'read', 'delete'],
            'Realization Report' => ['read'],
            'Integrasi' => ['read'],
            'Teams & Users' => ['create', 'read', 'update', 'delete'],
            'Access Control' => ['create', 'read', 'update', 'delete'],
            'Project Roles' => ['create', 'read', 'update', 'delete'],
            'System Log' => ['read', 'delete'],
            'Settings' => ['read', 'update', 'reset'],
            'Announcements' => ['create', 'read', 'update', 'delete'],
            'Profile' => ['read', 'update'],
            'Notification Center' => ['read', 'update'],
            'Modules Management' => ['create', 'read', 'update', 'delete'],
        ];
    }

    /** @return list<string> */
    public static function boardMemberPermissionSlugs(): array
    {
        return [
            'project_board.read',
            'project_board.create',
            'project_board.update',
            'profile.read',
            'profile.update',
            'notification_center.read',
            'notification_center.update',
        ];
    }

    /** Freelance: board visibility and status updates only (no manhour logging). */
    public static function freelancePermissionSlugs(): array
    {
        return [
            'project_board.read',
            'project_board.update',
            'profile.read',
            'profile.update',
            'notification_center.read',
            'notification_center.update',
        ];
    }

    /**
     * Operation — team capacity / Load menu (all projects, all assignees).
     * Grant via Access Control; not included on board-member or freelance defaults.
     *
     * @return list<string>
     */
    public static function teamLoadPermissionSlugs(): array
    {
        return ['load.read'];
    }

    /**
     * Some migrations older than the `modules` table call sync() while
     * bootstrapping a fresh install (before that table/column exist yet).
     * These flags let sync() degrade gracefully in that narrow window —
     * the next sync() call, once the schema has caught up, self-heals
     * anything left unlinked here.
     */
    public static function sync(): void
    {
        $actionLabels = [
            'create' => 'Create',
            'read' => 'Read',
            'update' => 'Update',
            'delete' => 'Delete',
            'edit_last_update' => 'Update Date Task Manual',
            'view_all' => 'View All Projects',
        ];

        $sortOrder = 0;
        $modulesTableExists = Schema::hasTable('modules');
        $permissionsHaveModuleId = true;
        $permissionsHaveModuleString = false;

        if ($modulesTableExists) {
            try {
                $driver = \Illuminate\Support\Facades\DB::getDriverName();
                if ($driver === 'sqlite') {
                    $cols = \Illuminate\Support\Facades\DB::select('PRAGMA table_info(permissions)');
                    $colNames = array_map(fn ($c) => (string) (is_object($c) ? $c->name : ($c['name'] ?? '')), $cols);
                    $permissionsHaveModuleId = in_array('module_id', $colNames, true);
                    $permissionsHaveModuleString = in_array('module', $colNames, true);
                } else {
                    $permissionsHaveModuleId = Schema::hasColumn('permissions', 'module_id');
                    $permissionsHaveModuleString = Schema::hasColumn('permissions', 'module');
                }
            } catch (\Throwable) {
                $permissionsHaveModuleId = true;
                $permissionsHaveModuleString = false;
            }
        }

        foreach (self::menuActionMap() as $module => $moduleActions) {
            $moduleSlug = Str::slug($module, '_');

            $moduleModel = $modulesTableExists
                ? Module::firstOrCreate(
                    ['slug' => $moduleSlug],
                    [
                        'name' => $module,
                        'sort_order' => $sortOrder,
                        'is_active' => true,
                    ]
                )
                : null;
            $sortOrder++;

            $allowedSlugs = [];

            foreach ($moduleActions as $actionKey) {
                $actionLabel = $actionLabels[$actionKey] ?? ucfirst($actionKey);
                $slug = "{$moduleSlug}.{$actionKey}";
                $allowedSlugs[] = $slug;

                $attributes = ['name' => "{$actionLabel} {$module}"];
                if ($permissionsHaveModuleString) {
                    $attributes['module'] = $module;
                }
                if ($moduleModel && $permissionsHaveModuleId) {
                    $attributes['module_id'] = $moduleModel->id;
                }

                Permission::firstOrCreate(['slug' => $slug], $attributes);
            }

            if (!$moduleModel || !$permissionsHaveModuleId) {
                continue;
            }

            // Backfill rows created by an older sync() call before module_id existed.
            Permission::where('slug', 'like', "{$moduleSlug}.%")
                ->whereNull('module_id')
                ->update(['module_id' => $moduleModel->id]);

            Permission::where('module_id', $moduleModel->id)
                ->whereNotIn('slug', $allowedSlugs)
                ->delete();
        }
    }

    /** @return list<int> */
    public static function permissionIdsForSlugs(array $slugs): array
    {
        return Permission::whereIn('slug', $slugs)->pluck('id')->all();
    }
}
