const {
  JWT_ACCESS_SECRET = "change_this_access_secret",
  JWT_REFRESH_SECRET = "change_this_refresh_secret",
  JWT_ACCESS_EXPIRES_IN = "30d",
  JWT_REFRESH_EXPIRES_IN = "7d",
} = process.env;

export const jwtConfig = {
  accessSecret: JWT_ACCESS_SECRET,
  refreshSecret: JWT_REFRESH_SECRET,
  accessExpiry: JWT_ACCESS_EXPIRES_IN,
  refreshExpiry: JWT_REFRESH_EXPIRES_IN,
};
