<?php

/**
 * Vercel Serverless Function Entry Point for Laravel
 */

// Fallback APP_KEY if not configured in Vercel Environment Variables
if (!getenv('APP_KEY') && empty($_ENV['APP_KEY']) && empty($_SERVER['APP_KEY'])) {
    $defaultKey = 'base64:WbSgQ7l6e6h7VvJk1i8m8N3p0Q2r4T6v8X0z2B4d6F8=';
    putenv("APP_KEY={$defaultKey}");
    $_ENV['APP_KEY'] = $defaultKey;
    $_SERVER['APP_KEY'] = $defaultKey;
}

if (isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) {
    $storageDirs = [
        '/tmp/storage',
        '/tmp/storage/framework',
        '/tmp/storage/framework/cache',
        '/tmp/storage/framework/cache/data',
        '/tmp/storage/framework/sessions',
        '/tmp/storage/framework/views',
        '/tmp/storage/logs',
        '/tmp/storage/app',
        '/tmp/storage/app/public',
    ];
    foreach ($storageDirs as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }

    // Default SQLite database file in /tmp if external DB is not set
    if (empty($_ENV['DB_DATABASE']) && empty($_SERVER['DB_DATABASE'])) {
        $dbPath = '/tmp/database.sqlite';
        if (!file_exists($dbPath)) {
            @touch($dbPath);
        }
        putenv("DB_DATABASE={$dbPath}");
        $_ENV['DB_DATABASE'] = $dbPath;
        $_SERVER['DB_DATABASE'] = $dbPath;
    }
}

require __DIR__ . '/../public/index.php';
