import querystring from 'querystring';

interface Tokens {
  /**
   * Valid for 10 minutes. If expired, use refresh token to get a new one
   */
  access_token: string;
  expires_in: string;
  /**
   * Valid for 30 days. After that, the user needs to login again
   */
  refresh_token: string;
}

export class ExactOnlineClient {
  readonly url = 'https://start.exactonline.nl/api';

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  getLoginUrl() {
    return `${this.url}/oauth2/auth?client_id=${
      this.clientId
    }&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&force_login=0`;
  }

  /**
   * Get access and refresh tokens using code gotten by the Exact login redirect.
   * redirectCode can be found in the url: `?code=stampNL001.xxxxx` stampNL001.xxxxx is the rawCode we need here
   */
  async getAccessToken(redirectCode: string): Promise<Tokens> {
    const data = querystring.stringify({
      code: decodeURIComponent(redirectCode),
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const response = await fetch(`${this.url}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });
    await this.throwIfError(response);
    return (await response.json()) as Tokens;
  }

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    const data = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const response = await fetch(`${this.url}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });
    await this.throwIfError(response);
    return (await response.json()) as Tokens;
  }

  async throwIfError(response: Response): Promise<void> {
    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body: { error_description: string } =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await response.json()) as any;
      throw new Error(`${response.status}: ${body.error_description}`);
    }
  }
}
