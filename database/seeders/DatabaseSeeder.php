<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\ProjectRole;
use App\Models\ProjectCategory;
use App\Models\FinanceCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password123'),
                'role' => 'Admin',
                'status' => 'Active',
                'is_superuser' => true,
            ]
        );

        $defaultRoles = [
            'Product Manager',
            'System Analyst',
            'UI/UX Designer',
            'Frontend Dev',
            'Backend Dev',
            'Fullstack Dev',
            'QA Engineer',
            'DevOps Engineer',
        ];

        foreach ($defaultRoles as $roleName) {
            ProjectRole::firstOrCreate(['name' => $roleName]);
        }

        $defaultCategories = [
            'Web Application',
            'Mobile Application',
            'Enterprise ERP/CRM',
            'Maintenance & Support',
        ];

        foreach ($defaultCategories as $catName) {
            ProjectCategory::firstOrCreate(['name' => $catName]);
        }
    }
}
