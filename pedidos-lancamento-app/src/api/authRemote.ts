import { apiRequest } from "./httpClient";
import type { AuthUser } from "../types";

export type LoginResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export function remoteLogin(email: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>("/v1/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function remoteMe(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/v1/auth/me");
}
