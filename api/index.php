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

$storageDirs = [
    '/tmp/storage',
    '/tmp/storage/bootstrap',
    '/tmp/storage/bootstrap/cache',
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

@unlink('/tmp/storage/bootstrap/cache/routes-v7.php');
@unlink('/tmp/storage/bootstrap/cache/config.php');

$viewsDir = '/tmp/storage/framework/views';
if (is_dir($viewsDir)) {
    $files = glob("{$viewsDir}/*");
    if ($files) {
        foreach ($files as $f) {
            if (is_file($f)) {
                @unlink($f);
            }
        }
    }
}

if (!getenv('DB_CONNECTION') && empty($_ENV['DB_CONNECTION']) && empty($_SERVER['DB_CONNECTION'])) {
    putenv("DB_CONNECTION=sqlite");
    $_ENV['DB_CONNECTION'] = 'sqlite';
    $_SERVER['DB_CONNECTION'] = 'sqlite';
}

$activeConnection = getenv('DB_CONNECTION') ?: ($_ENV['DB_CONNECTION'] ?? ($_SERVER['DB_CONNECTION'] ?? 'sqlite'));
if ($activeConnection === 'sqlite') {
    // Initialize SQLite database file in /tmp from bundled database if not exists
    $dbPath = '/tmp/database.sqlite';
    $sourceDb = dirname(__DIR__) . '/database/database.sqlite';
    if (!file_exists($dbPath) || filesize($dbPath) < 4096) {
        if (file_exists($sourceDb) && filesize($sourceDb) > 4096) {
            @copy($sourceDb, $dbPath);
        } else {
            @touch($dbPath);
        }
        @chmod($dbPath, 0666);
    }
    if (!getenv('DB_DATABASE') && empty($_ENV['DB_DATABASE']) && empty($_SERVER['DB_DATABASE'])) {
        putenv("DB_DATABASE={$dbPath}");
        $_ENV['DB_DATABASE'] = $dbPath;
        $_SERVER['DB_DATABASE'] = $dbPath;
    }
}

// Pass Authorization header from FastCGI / getallheaders to $_SERVER
if (empty($_SERVER['HTTP_AUTHORIZATION'])) {
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['HTTP_X_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['HTTP_X_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        foreach ($allHeaders as $hdrKey => $hdrVal) {
            if (strcasecmp($hdrKey, 'Authorization') === 0) {
                $_SERVER['HTTP_AUTHORIZATION'] = $hdrVal;
                break;
            }
        }
    }
}

// Normalize SCRIPT_NAME and REQUEST_URI so Laravel routes /api/* and web routes correctly
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = dirname(__DIR__) . '/public/index.php';

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
if (!empty($_SERVER['HTTP_X_MATCHED_PATH']) && $_SERVER['HTTP_X_MATCHED_PATH'] !== '/api/index.php') {
    $requestUri = $_SERVER['HTTP_X_MATCHED_PATH'];
} elseif (!empty($_SERVER['HTTP_X_NOW_PATH']) && $_SERVER['HTTP_X_NOW_PATH'] !== '/api/index.php') {
    $requestUri = $_SERVER['HTTP_X_NOW_PATH'];
}

if (str_starts_with($requestUri, '/api/index.php')) {
    $rest = substr($requestUri, strlen('/api/index.php'));
    $requestUri = ($rest === '' || $rest === false) ? '/' : $rest;
}

if (!str_starts_with($requestUri, '/')) {
    $requestUri = '/' . $requestUri;
}

if (!empty($_SERVER['QUERY_STRING']) && !str_contains($requestUri, '?')) {
    $requestUri .= '?' . $_SERVER['QUERY_STRING'];
}

$_SERVER['REQUEST_URI'] = $requestUri;

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
    header('Content-Type: application/json');
    $prev = $e->getPrevious() ? [
        'message' => $e->getPrevious()->getMessage(),
        'file' => $e->getPrevious()->getFile(),
        'line' => $e->getPrevious()->getLine(),
    ] : null;

    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => explode("\n", $e->getTraceAsString()),
        'previous' => $prev,
        'prev_trace' => $e->getPrevious() ? explode("\n", $e->getPrevious()->getTraceAsString()) : null,
    ]);
}
