/* =============================================
   SafeMap — auth.js
   Validación del formulario de login
   ============================================= */

const form       = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passError  = document.getElementById('passwordError');
const submitBtn  = document.getElementById('submitBtn');
const btnText    = submitBtn.querySelector('.btn-text');
const btnLoader  = submitBtn.querySelector('.btn-loader');
const togglePass = document.getElementById('togglePass');
const eyeIcon    = document.getElementById('eyeIcon');
const googleBtn  = document.getElementById('googleBtn');

// ── Mostrar/ocultar contraseña ──
togglePass.addEventListener('click', () => {
  const isHidden = passInput.type === 'password';
  passInput.type = isHidden ? 'text' : 'password';
  eyeIcon.innerHTML = isHidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// ── Validación en tiempo real ──
emailInput.addEventListener('blur', validateEmail);
passInput.addEventListener('blur', validatePass);

emailInput.addEventListener('input', () => {
  if (emailInput.classList.contains('is-error')) validateEmail();
});

passInput.addEventListener('input', () => {
  if (passInput.classList.contains('is-error')) validatePass();
});

function validateEmail() {
  const val = emailInput.value.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!val) {
    setError(emailInput, emailError, 'Ingresa tu correo electrónico.');
    return false;
  }
  if (!re.test(val)) {
    setError(emailInput, emailError, 'Formato de correo no válido.');
    return false;
  }
  clearError(emailInput, emailError);
  return true;
}

function validatePass() {
  const val = passInput.value;
  if (!val) {
    setError(passInput, passError, 'Ingresa tu contraseña.');
    return false;
  }
  if (val.length < 8) {
    setError(passInput, passError, 'Mínimo 8 caracteres.');
    return false;
  }
  clearError(passInput, passError);
  return true;
}

function setError(input, errorEl, msg) {
  input.classList.add('is-error');
  errorEl.textContent = msg;
}

function clearError(input, errorEl) {
  input.classList.remove('is-error');
  errorEl.textContent = '';
}

// ── Submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const emailOk = validateEmail();
  const passOk  = validatePass();
  if (!emailOk || !passOk) return;

  setLoading(true);

  // Simulación de login — aquí irá la llamada al backend PHP/API
  await sleep(1400);

  // Demo: redirigir al mapa
  window.location.href = 'map.html';
});

// ── Google ──
googleBtn.addEventListener('click', () => {
  // Placeholder para OAuth con Google
  alert('Integración con Google próximamente.');
});

// ── Helpers ──
function setLoading(on) {
  submitBtn.disabled = on;
  btnText.hidden = on;
  btnLoader.hidden = !on;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
