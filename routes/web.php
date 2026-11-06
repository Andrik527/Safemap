<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MapaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\IncidentVoteController;
use App\Http\Controllers\Api\ReputationController;

// Vistas
Route::get('/', [MapaController::class, 'login'])->name('login');
Route::get('/register', [MapaController::class, 'register'])->name('register');
Route::get('/mapa', [MapaController::class, 'mapa'])->name('mapa');

// Procesar formularios
Route::post('/login',    [AuthController::class, 'store'])->name('login.store');
Route::post('/register', [AuthController::class, 'create'])->name('register.store');
Route::post('/logout',   [AuthController::class, 'destroy'])->name('logout');

// API de incidentes
Route::prefix('api')->group(function () {
    Route::get('/incidents', [IncidentController::class, 'index'])->name('incidents.index');

    // Máx. 10 reportes por minuto por usuario/IP
    Route::post('/incidents', [IncidentController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('incidents.store');

    // Validación comunitaria: máx. 30 votos por minuto
    Route::post('/incidents/{incident}/vote', [IncidentVoteController::class, 'store'])
        ->middleware('throttle:30,1')
        ->name('incidents.vote');

    // Reputación del usuario con sesión (puntos, nivel, racha, insignias)
    Route::get('/me/reputation', [ReputationController::class, 'show'])
        ->middleware('auth')
        ->name('me.reputation');


    Route::get('/instalar-bd', function () {
    \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    return '¡Base de datos de PostgreSQL migrada con éxito!';
});    

});
