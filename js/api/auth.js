import { post } from './client.js';

const AUTH = '/auth';

export function loginUser({ email, password }) {
  return post(`${AUTH}/login`, { email, password });
}

export function createUser({ firstName, lastName, email, password, role = 'athlete' }) {
  return post(`${AUTH}/register`, { firstName, lastName, email, password, role });
}
