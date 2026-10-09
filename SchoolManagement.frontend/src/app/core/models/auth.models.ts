export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  userId: number;
  username: string;
  roles: string[];
}

export interface CurrentUser {
  userId: number;
  username: string;
  roles: string[];
}

export interface ProblemDetailsResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
}
