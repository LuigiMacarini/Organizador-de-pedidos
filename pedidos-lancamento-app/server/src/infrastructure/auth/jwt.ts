import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../domain/auth.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado (veja server/.env.example)");
}
const SECRET: string = process.env.JWT_SECRET;

type Expiry = NonNullable<jwt.SignOptions["expiresIn"]>;

const ACCESS_TOKEN_TTL: Expiry = "2h";
const REFRESH_TOKEN_TTL: Expiry = "30d";

type TokenType = "access" | "refresh";

function sign(payload: JwtPayload, type: TokenType, expiresIn: Expiry): string {
  return jwt.sign({ ...payload, type }, SECRET, { expiresIn });
}

function verify(token: string, expectedType: TokenType): JwtPayload {
  const decoded = jwt.verify(token, SECRET) as unknown as JwtPayload & { type: TokenType };
  if (decoded.type !== expectedType) throw new Error("Token inválido");
  return decoded;
}

export function signAccessToken(payload: JwtPayload): string {
  return sign(payload, "access", ACCESS_TOKEN_TTL);
}

export function signRefreshToken(payload: JwtPayload): string {
  return sign(payload, "refresh", REFRESH_TOKEN_TTL);
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, "access");
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, "refresh");
}
