<?php

use App\Support\AppBranding;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()
        ->view('welcome', AppBranding::toArray())
        ->header('Clear-Site-Data', '"cookies"');
})->name('login');

Route::get('/storage/{path}', function (string $path) {
    $disk = \Illuminate\Support\Facades\Storage::disk('public');
    if ($disk->exists($path)) {
        return response()->file($disk->path($path));
    }
    abort(404);
})->where('path', '.*');

Route::get('/{any}', function () {
    return response()
        ->view('welcome', AppBranding::toArray())
        ->header('Clear-Site-Data', '"cookies"');
})->where('any', '^(?!api|storage).*$');
