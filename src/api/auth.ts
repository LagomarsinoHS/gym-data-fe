import { post } from "@/api/request";

const AUTH = "/auth";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: "athlete" | "coach";
};

export type AuthResponse = {
  accessToken: string;
};

export function loginUser(payload: LoginPayload) {
  return post(AUTH + "/login", payload) as Promise<AuthResponse>;
}

export function createUser(payload: RegisterPayload) {
  return post(AUTH + "/register", {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    password: payload.password,
    role: payload.role ?? "athlete",
  }) as Promise<AuthResponse>;
}
