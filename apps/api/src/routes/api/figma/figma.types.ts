export type { FigmaConnectionStatusDto } from '@repo/types/api/v1';

export type FigmaOAuthTokenResponse = {
  user_id_string?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  message?: string;
};

export type FigmaFileMetadataResponse = {
  file?: {
    name?: string;
  };
  err?: string;
  message?: string;
};

export class FigmaOAuthStateError extends Error {
  constructor(message = 'Invalid or already used Figma OAuth state.') {
    super(message);
    this.name = 'FigmaOAuthStateError';
  }
}

export class FigmaFileAccessError extends Error {
  constructor(message = 'Figma cannot access the saved design link.') {
    super(message);
    this.name = 'FigmaFileAccessError';
  }
}
