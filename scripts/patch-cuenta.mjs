import fs from 'node:fs';
const p='assets/js/cuenta.js';
let s=fs.readFileSync(p,'utf8');

const old = `  function registerForm() {
    return '<form id="register-form" class="stack"><div class="field"><label for="reg-name">Nombre y apellidos</label><input class="input" id="reg-name" name="name" autocomplete="name" required maxlength="90"></div>' +
      '<div class="field"><label for="reg-email">Correo electrónico</label><input class="input" id="reg-email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="reg-phone">WhatsApp / teléfono (opcional)</label><input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" maxlength="24"></div>' +
      '<div class="field"><label for="reg-password">Contraseña</label><input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">Mínimo 8 caracteres. No uses la misma contraseña de otros servicios.</p></div>' +
      '<div class="check-inline"><input type="checkbox" id="reg-terms" required><span>Acepto el <a href="privacidad.html" style="color:var(--gx-cyan)">aviso de privacidad</a> y el uso de mis datos para gestionar mi cuenta y pedidos.</span></div>' +
      '<div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Crear cuenta</button></form>';
  }`;

const neu = `  function registerForm() {
    return '<form id="register-form" class="stack"><div class="grid grid-2"><div class="field"><label for="reg-name">Nombre *</label><input class="input" id="reg-name" name="name" autocomplete="given-name" required maxlength="60"></div><div class="field"><label for="reg-lastname">Apellidos *</label><input class="input" id="reg-lastname" name="lastName" autocomplete="family-name" required maxlength="80"></div></div>' +
      '<div class="field"><label for="reg-email">Correo electrónico *</label><input class="input" id="reg-email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="reg-phone">WhatsApp / teléfono (opcional)</label><input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" maxlength="24"></div>' +
      '<div class="field"><label for="reg-password">Contraseña *</label><input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="8"><p class="hint">Mínimo 8 caracteres. No uses la misma contraseña de otros servicios.</p></div>' +
      '<div class="field"><label for="reg-password2">Confirmar contraseña *</label><input class="input" id="reg-password2" name="password2" type="password" autocomplete="new-password" required minlength="8"></div>' +
      '<div class="check-inline"><input type="checkbox" id="reg-terms" required><span>Acepto el <a href="privacidad.html" style="color:var(--gx-cyan)">aviso de privacidad</a> y el uso de mis datos para gestionar mi cuenta y pedidos.</span></div>' +
      '<div class="form-message" id="auth-message" role="alert"></div><button class="btn btn-primary btn-block" type="submit">Crear cuenta</button></form>' +
      '<div class="flex flex-wrap mt-2"><button class="btn btn-ghost btn-sm" type="button" id="resend-confirmation">Reenviar correo de confirmación</button></div>';
  }`;

if(!s.includes(old)){ console.error('registerForm old not found'); process.exit(1);}
s=s.replace(old,neu);

// Update register submit handler.
const oldHandler = `      try {
        const data = await GALAX.cloud.signUp({
          email: $('#reg-email').value.trim(),
          password: $('#reg-password').value,
          name: $('#reg-name').value.trim(),
          phone: $('#reg-phone').value.trim()
        });`;
const newHandler = `      const name = $('#reg-name').value.trim();
      const lastName = $('#reg-lastname').value.trim();
      const password = $('#reg-password').value;
      const password2 = $('#reg-password2').value;
      if (name.length < 2) { setAuthMessage('Escribe tu nombre.', 'error'); state.busy = false; return; }
      if (lastName.length < 2) { setAuthMessage('Escribe tus apellidos.', 'error'); state.busy = false; return; }
      if (password !== password2) { setAuthMessage('Las contraseñas no coinciden.', 'error'); state.busy = false; return; }
      try {
        const data = await GALAX.cloud.signUp({
          email: $('#reg-email').value.trim(),
          password: password,
          nombre: name,
          apellidos: lastName,
          phone: $('#reg-phone').value.trim()
        });`;
if(!s.includes(oldHandler)){ console.error('handler old not found'); process.exit(1);}
s=s.replace(oldHandler,newHandler);

// Add resend confirmation handler in bindAuth after register binding. Insert before login handler? Instead insert after bindAuth function? We'll add near end of bindAuth by replacing a marker.
const marker = `    const updatePwd = $('#update-password-form');`;
const resend = `    const resendBtn = $('#resend-confirmation');
    if (resendBtn) resendBtn.addEventListener('click', async () => {
      const email = ($('#reg-email') && $('#reg-email').value.trim()) || '';
      if (!email) { setAuthMessage('Escribe tu correo para reenviar la confirmación.', 'error'); return; }
      resendBtn.disabled = true;
      try {
        await GALAX.cloud.resendConfirmation(email);
        setAuthMessage('Si la cuenta existe y no está confirmada, se envió un nuevo correo. Revisa spam.', 'ok');
      } catch (error) { setAuthMessage(error.message, 'error'); }
      finally { resendBtn.disabled = false; }
    });
`;
if(!s.includes(marker)){ console.error('marker not found'); process.exit(1);}
s=s.replace(marker, resend + marker);

fs.writeFileSync(p,s);
console.log('OK cuenta');
