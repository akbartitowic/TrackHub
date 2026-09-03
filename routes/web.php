<?php

use App\Support\AppBranding;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()
        ->view('welcome', AppBranding::toArray())
        ->header('Clear-Site-Data', '"cookies"');
})->name('login');

Route::get('/{any}', function () {
    return response()
        ->view('welcome', AppBranding::toArray())
        ->header('Clear-Site-Data', '"cookies"');
})->where('any', '^(?!api).*$');
