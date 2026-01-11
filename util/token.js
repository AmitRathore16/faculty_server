import crypto from "crypto";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.js";

export const generateAccessToken = (payload) =>
  jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiry,
  });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiry,
  });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, jwtConfig.refreshSecret);

export const verifyAccessToken = (token) =>
  jwt.verify(token, jwtConfig.accessSecret);

export const decodeToken = (token) => jwt.decode(token);

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
