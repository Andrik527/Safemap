@extends('layouts.app')
@section('title', 'SafeMap — Iniciar sesión')

@section('fonts')
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet"/>
@endsection

@section('styles')
<link rel="stylesheet" href="{{ secure_asset('css/auth.css') }}">
@endsection

@section('content')
<div class="map-blur-bg"></div>
<div class="street-lines"></div>
<div class="pulse-dot pd-1"></div>
<div class="pulse-dot pd-2"></div>
<div class="pulse-dot pd-3"></div>

<div class="page">
  <div class="brand">
    <div class="brand-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
      </svg>
    </div>
    <span class="brand-name">SafeMap<span class="brand-loc">Xalapa</span></span>
  </div>

  <h1 class="hero-title">Xalapa,<br><strong>en tiempo real.</strong></h1>
  <p class="hero-sub">Reporta incidentes y sigue alertas activas en la zona de Xalapa</p>

  <div class="live-row">
    <span class="live-badge"><span class="live-dot"></span>En vivo</span>
    <span class="live-stats"><b>3</b> reportes activos ahora</span>
  </div>

  <a href="{{ route('mapa') }}" class="btn-guest-full">
    <span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      Explorar sin cuenta
    </span>
    <span class="btn-guest-arrow">›</span>
  </a>

  <div class="divider"><span>o inicia sesión</span></div>

  @if ($errors->any())
    <div style="background:rgba(232,72,85,.12);border:1px solid rgba(232,72,85,.3);border-radius:8px;padding:.75rem 1rem;font-size:.82rem;color:#E84855;margin-bottom:.5rem;">
      {{ $errors->first() }}
    </div>
  @endif

  <form class="form" id="loginForm" method="POST" action="{{ route('login.store') }}" novalidate>
    @csrf
    <div class="field">
      <label for="email">Correo</label>
      <input type="email" id="email" name="email" placeholder="tu@correo.com"
             autocomplete="email" value="{{ old('email') }}" required/>
      <span class="field-err" id="emailErr">{{ $errors->first('email') }}</span>
    </div>
    <div class="field">
      <label for="password">Contraseña <a href="#" class="field-forgot">¿La olvidaste?</a></label>
      <div class="pw-wrap">
        <input type="password" id="password" name="password" placeholder="Mínimo 8 caracteres"
               autocomplete="current-password" required/>
        <button type="button" class="pw-toggle" id="pwToggle" aria-label="Mostrar contraseña">
          <svg id="eyeIco" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <span class="field-err" id="passErr">{{ $errors->first('password') }}</span>
    </div>
    <button type="submit" class="btn-main" id="submitBtn">
      <span class="btn-main-text">Entrar</span>
      <svg id="spinIco" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin" hidden>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    </button>
    <button type="button" class="btn-google" id="gBtn">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continuar con Google
    </button>
  </form>

  <p class="register-link">¿No tienes cuenta? <a href="{{ route('register') }}">Crea una gratis</a></p>
</div>
@endsection

@section('scripts')
<script>
document.getElementById('pwToggle').addEventListener('click', () => {
  const p = document.getElementById('password');
  const ico = document.getElementById('eyeIco');
  const h = p.type === 'password';
  p.type = h ? 'text' : 'password';
  ico.innerHTML = h
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
  const email  = document.getElementById('email').value.trim();
  const pass   = document.getElementById('password').value;
  const emailE = document.getElementById('emailErr');
  const passE  = document.getElementById('passErr');
  let ok = true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailE.textContent = email ? 'Formato inválido' : 'Ingresa tu correo';
    document.getElementById('email').classList.add('err');
    ok = false;
  } else {
    emailE.textContent = '';
    document.getElementById('email').classList.remove('err');
  }

  if (!pass) {
    passE.textContent = 'Ingresa tu contraseña';
    document.getElementById('password').classList.add('err');
    ok = false;
  } else {
    passE.textContent = '';
    document.getElementById('password').classList.remove('err');
  }

  if (!ok) { e.preventDefault(); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.querySelector('.btn-main-text').textContent = 'Entrando...';
  document.getElementById('spinIco').hidden = false;
});

document.getElementById('gBtn').addEventListener('click', () => alert('Google próximamente.'));
</script>
@endsection
