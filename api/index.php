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

    if (empty($_ENV['DB_CONNECTION']) && empty($_SERVER['DB_CONNECTION'])) {
        putenv("DB_CONNECTION=sqlite");
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_SERVER['DB_CONNECTION'] = 'sqlite';
    }

    // Initialize SQLite database file in /tmp from bundled database if not exists
    $dbPath = '/tmp/database.sqlite';
    if (!file_exists($dbPath) || filesize($dbPath) === 0) {
        $sourceDb = dirname(__DIR__) . '/database/database.sqlite';
        if (file_exists($sourceDb) && is_readable($sourceDb) && filesize($sourceDb) > 0) {
            @copy($sourceDb, $dbPath);
        } else {
            @touch($dbPath);
        }
        @chmod($dbPath, 0666);
    }
    putenv("DB_DATABASE={$dbPath}");
    $_ENV['DB_DATABASE'] = $dbPath;
    $_SERVER['DB_DATABASE'] = $dbPath;

    // Normalize SCRIPT_NAME and REQUEST_URI so Laravel routes /api/* and web routes correctly
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = dirname(__DIR__) . '/public/index.php';

    if (!empty($_SERVER['HTTP_X_MATCHED_PATH'])) {
        $_SERVER['REQUEST_URI'] = $_SERVER['HTTP_X_MATCHED_PATH'] . (!empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '');
    } elseif (!empty($_SERVER['HTTP_X_NOW_PATH'])) {
        $_SERVER['REQUEST_URI'] = $_SERVER['HTTP_X_NOW_PATH'] . (!empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '');
    } elseif (isset($_SERVER['REQUEST_URI']) && str_starts_with($_SERVER['REQUEST_URI'], '/api/index.php')) {
        $rest = substr($_SERVER['REQUEST_URI'], strlen('/api/index.php'));
        $_SERVER['REQUEST_URI'] = ($rest === '' || $rest === false) ? '/' : $rest;
    }
}

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

putenv('APP_DEBUG=true');
$_ENV['APP_DEBUG'] = 'true';
$_SERVER['APP_DEBUG'] = 'true';

try {
    require __DIR__ . '/../public/index.php';
} catch (\Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo "<div style='font-family: sans-serif; padding: 24px; background: #fff5f5; color: #9b1c1c; border: 1px solid #f8b4b4; border-radius: 8px; margin: 20px;'>";
    echo "<h2 style='margin-top:0;'>⚠️ Laravel Deployment Error on Vercel</h2>";
    echo "<p><strong>Message:</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p><strong>File:</strong> " . htmlspecialchars($e->getFile()) . " : <strong>Line " . $e->getLine() . "</strong></p>";
    echo "<details><summary style='cursor: pointer; font-weight: bold;'>Stack Trace</summary><pre style='background: #fdf2f2; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin-top: 8px;'>" . htmlspecialchars($e->getTraceAsString()) . "</pre></details>";
    echo "</div>";
}
