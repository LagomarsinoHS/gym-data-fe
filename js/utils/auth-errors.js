import { ui } from './labels.js';

/** User-facing auth error from HTTP status (ignore raw backend English). */
export function authErrorMessage(err, mode) {
  const status = err?.status;

  if (mode === 'login' && (status === 401 || status === 403)) {
    return ui('invalidCredentials');
  }
  if (mode === 'register' && status === 409) {
    return ui('emailTaken');
  }

  return ui(mode === 'login' ? 'loginFail' : 'registerFail');
}
