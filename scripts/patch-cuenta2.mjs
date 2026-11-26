import fs from 'node:fs';
const p='assets/js/cuenta.js';
let s=fs.readFileSync(p,'utf8');
const old = `      } catch (error) {
        setAuthMessage(/invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos. Verifica tus datos.' : error.message, 'error');
      } finally { state.busy = false; }`;
const neu = `      } catch (error) {
        const msg = String(error && error.message || '');
        if (/email.*not.*confirmed|not.*confirmed/i.test(msg)) {
          setAuthMessage('Tu correo aún no está confirmado. Revisa tu bandeja de entrada y spam, o usa "Reenviar correo de confirmación".', 'error');
        } else if (/invalid login/i.test(msg)) {
          setAuthMessage('Correo o contraseña incorrectos. Verifica tus datos. Si olvidaste la contraseña, usa recuperar.', 'error');
        } else {
          setAuthMessage(msg || 'No se pudo iniciar sesión.', 'error');
        }
      } finally { state.busy = false; }`;
if(!s.includes(old)){ console.error('NOT FOUND'); process.exit(1);}
s=s.replace(old,neu);
fs.writeFileSync(p,s);
console.log('OK');
