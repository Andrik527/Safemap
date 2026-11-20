<?php

namespace App\Http\Controllers;

class MapaController extends Controller
{
    public function login()
    {
        return view('auth.login');
    }

    public function register()
    {
        return view('auth.register');
    }

    public function mapa()
    {
        return view('mapa.index');
    }
}