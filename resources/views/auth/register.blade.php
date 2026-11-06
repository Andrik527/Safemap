@extends('layouts.app')
@section('title', 'SafeMap — Crear cuenta')

@section('fonts')
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet"/>
@endsection

@section('styles')
<link rel="stylesheet" href="{{ secure_asset('css/auth.css') }}">
@endsection

@section('content')
<div class="bg"></div>
<div class="grid"></div>
<div class="pd"></div>

<div class="page">
  <div class="brand">
    <div class="brand-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
      </svg>
    </div>
    <span class="brand-name">SafeMap<span class="brand-sep"></span><span class="brand-loc">Xalapa</span></span>
  </div>

  <div class="steps">
    <div class="step-dot act"></div>
    <div class="step-dot pend"></div>
    <div class="step-dot pend"></div>
  </div>

  <div class="head">
    <h1>Únete a<br><strong>tu comunidad.</strong></h1>
    <p>Crea tu cuenta para publicar reportes y recibir alertas de tu zona.</p>
  </div>

  <div class="perks">
    <div class="perk"><span>📍 Reporta incidentes</span></div>
    <div class="perk"><span>🔔 Alertas en tu zona</span></div>
    <div class="perk"><span>🛡️ Gratis siempre</span></div>
  </div>

  @if ($errors->any())
    <div style="background:rgba(232,72,85,.12);border:1px solid rgba(232,72,85,.3);border-radius:8px;padding:.75rem 1rem;font-size:.82rem;color:#E84855;margin-bottom:.5rem;">
      {{ $errors->first() }}
    </div>
  @endif

  <form class="form" id="regForm" method="POST" action="{{ route('register.store') }}" novalidate>
    @csrf
    <div class="field">
      <label for="name">Nombre completo</label>
      <input type="text" id="name" name="name" placeholder="Tu nombre"
             autocomplete="name" value="{{ old('name') }}" required/>
      <span class="field-err" id="nameErr">{{ $errors->first('name') }}</span>
    </div>
    <div class="field">
      <label for="email">Correo electrónico</label>
      <input type="email" id="email" name="email" placeholder="tu@correo.com"
             autocomplete="email" value="{{ old('email') }}" required/>
      <span class="field-err" id="emailErr">{{ $errors->first('email') }}</span>
    </div>
    <div class="field">
      <label for="pass">Contraseña</label>
      <div class="pw-wrap">
        <input type="password" id="pass" name="password" placeholder="Mínimo 8 caracteres"
               autocomplete="new-password" required/>
        <button type="button" class="pw-tog" id="pwTog">
          <svg id="eyeIco" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <span class="field-err" id="passErr">{{ $errors->first('password') }}</span>
    </div>
    <div class="terms-row">
      <input type="checkbox" id="terms" name="terms"/>
      <label for="terms">Acepto los <a href="#">Términos de uso</a> y el <a href="#">Aviso de privacidad</a> de SafeMap.</label>
    </div>
    <button type="submit" class="btn-main" id="submitBtn">
      <span id="btnTxt">Crear cuenta</span>
      <svg id="spinIco" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin" hidden>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    </button>
    <div class="divider"><span>o regístrate con</span></div>
    <button type="button" class="btn-google">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Google
    </button>
  </form>

  <p class="login-link">¿Ya tienes cuenta? <a href="{{ route('login') }}">Inicia sesión</a></p>
</div>
@endsection

@section('scripts')
<script>
document.getElementById('pwTog').addEventListener('click', () => {
  const i = document.getElementById('pass');
  i.type = i.type === 'password' ? 'text' : 'password';
});

document.getElementById('regForm').addEventListener('submit', function(e) {
  const name   = document.getElementById('name').value.trim();
  const email  = document.getElementById('email').value.trim();
  const pass   = document.getElementById('pass').value;
  const terms  = document.getElementById('terms').checked;
  let ok = true;

  const nameE  = document.getElementById('nameErr');
  const emailE = document.getElementById('emailErr');
  const passE  = document.getElementById('passErr');

  if (!name) {
    nameE.textContent = 'Ingresa tu nombre';
    document.getElementById('name').classList.add('err');
    ok = false;
  } else {
    nameE.textContent = '';
    document.getElementById('name').classList.remove('err');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailE.textContent = email ? 'Formato inválido' : 'Ingresa tu correo';
    document.getElementById('email').classList.add('err');
    ok = false;
  } else {
    emailE.textContent = '';
    document.getElementById('email').classList.remove('err');
  }

  if (!pass || pass.length < 8) {
    passE.textContent = 'Mínimo 8 caracteres';
    document.getElementById('pass').classList.add('err');
    ok = false;
  } else {
    passE.textContent = '';
    document.getElementById('pass').classList.remove('err');
  }

  if (!terms) {
    alert('Acepta los términos para continuar.');
    ok = false;
  }

  if (!ok) { e.preventDefault(); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  document.getElementById('btnTxt').textContent = 'Creando...';
  document.getElementById('spinIco').hidden = false;
});
</script>
@endsection
