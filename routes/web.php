<?php

use App\Support\AppBranding;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome', AppBranding::toArray());
})->name('login');

Route::get('/{any}', function () {
    return view('welcome', AppBranding::toArray());
})->where('any', '^(?!api).*$');
