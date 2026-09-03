<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class ApiFeatureTest extends TestCase
{
    use RefreshDatabase;
    
    protected $seed = true;
    /**
     * A basic feature test example.
     */
    public function test_protected_api_endpoints_require_authentication(): void
    {
        $endpoints = [
            '/api/users',
            '/api/roles',
            '/api/project-roles',
            '/api/projects',
            '/api/tasks',
            '/api/manhours',
            '/api/presales',
            '/api/menu-items',
            '/api/tasks/template',
            '/api/stats',
            '/api/reports/efficiency',
            '/api/reports/revenue-trend',
            '/api/reports/company-projects',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $response->assertUnauthorized();
        }
    }
}
