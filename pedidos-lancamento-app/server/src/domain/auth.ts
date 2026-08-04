import { z } from "zod";
import type { Role } from "@prisma/client";

export const loginInputSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export type JwtPayload = {
  sub: string;
  role: Role;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type LoginResult = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};
