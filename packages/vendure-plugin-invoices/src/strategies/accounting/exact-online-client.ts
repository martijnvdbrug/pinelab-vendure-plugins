import querystring from 'querystring';

/**
 * Thrown when Exact returns a 401, meaning:
 * 1. the access token is expired, or
 * 2. we are trying to get a new access token to early
 */
export class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface TokenSet {
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
    private redirectUri: string,
    private division: number
  ) {}

  async getCustomerId(
    accessToken: string,
    emailAddress: string
  ): Promise<string> {
    const response = await fetch(
      `${this.url}/v1/${
        this.division
      }/crm/Accounts?$select=ID,Code,Name&$filter=Email eq ${encodeURIComponent(
        emailAddress
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    const customer = await this.throwIfError<{ id: string }>(response);
    console.log('=======', customer);
    return customer.id;
  }

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
  async getAccessToken(redirectCode: string): Promise<TokenSet> {
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
    return await this.throwIfError<TokenSet>(response);
  }

  /**
   * Get new access token and refresh token using the current refresh token.
   */
  async renewTokens(refreshToken: string): Promise<TokenSet> {
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
    return await this.throwIfError<TokenSet>(response);
  }

  /**
   * Throws if the response is not ok. Returns the json body as T if ok.
   */
  async throwIfError<T>(response: Response): Promise<T> {
    if (response.ok) {
      return (await response.json()) as T;
    }
    const body = await response.text();
    if (response.status === 401) {
      throw new AuthenticationRequiredError(`${body}`);
    } else {
      throw new Error(`${response.status} - ${response.statusText}: ${body}`);
    }
  }

  async isAccessTokenValid(accessToken?: string): Promise<boolean> {
    if (!accessToken) {
      return false;
    }
    const response = await fetch(
      `${this.url}/v1/current/Me?$select=AccountingDivision`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (response.ok) {
      return true;
    } else if (response.status === 401) {
      return false;
    } else {
      throw Error(
        `Error checking access token: [${
          response.status
        }] ${await response.text()}`
      );
    }
  }
}
