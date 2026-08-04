import * as userRepository from "../../infrastructure/db/userRepository.js";
import { verifyPassword } from "../../infrastructure/auth/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../infrastructure/auth/jwt.js";
import { UnauthorizedError } from "../../domain/errors.js";
import type { AuthenticatedUser, LoginInput, LoginResult } from "../../domain/auth.js";

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await userRepository.findByEmail(input.email);
  if (!user) throw new UnauthorizedError("E-mail ou senha inválidos");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("E-mail ou senha inválidos");

  const payload = { sub: user.id, role: user.role };
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Sessão expirada, faça login novamente");
  }
  const user = await userRepository.findById(payload.sub);
  if (!user) throw new UnauthorizedError("Sessão expirada, faça login novamente");
  return { accessToken: signAccessToken({ sub: user.id, role: user.role }) };
}

export async function me(userId: string): Promise<AuthenticatedUser> {
  const user = await userRepository.findById(userId);
  if (!user) throw new UnauthorizedError("Sessão expirada, faça login novamente");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
