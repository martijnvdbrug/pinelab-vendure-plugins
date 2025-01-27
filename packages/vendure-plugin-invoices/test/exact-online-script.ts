import { ExactOnlineStrategy } from '../src/strategies/accounting/exact-online-export-strategy';
import dotenv from 'dotenv';

/**
 * Developer script to test out calls to the Exact Online API using the Exact Online strategy.
 * Run using `npx tsx ./test/exact-online-script.ts`
 *
 * Make sure to set the following environment variables:
 * EXACT_CLIENT_ID
 * EXACT_CLIENT_SECRET
 * EXACT_REDIRECT_URI
 */
(async () => {
  dotenv.config();

  const exact = new ExactOnlineStrategy({
    channelToken: undefined,
    clientId: process.env.EXACT_CLIENT_ID!,
    clientSecret: process.env.EXACT_CLIENT_SECRET!,
    redirectUri: process.env.EXACT_REDIRECT_URI!,
  });
  exact.init();

  // Login ia Browser
  console.log(exact.exactClient.getLoginUrl());

  // Get code from the redirect url. Only valid for 3 minutes
  const redirectCode = 'stampNL0xxxxx';

  // Get access and refresh tokens.
  const tokens = await exact.exactClient.getAccessToken(redirectCode);
  // todo: Save refresh tokens

  // console.log(tokens);

  // const refreshToken = 'stampNL001.g_wC!xxxx';
  // const refreshResult = await exact.exactClient.refreshTokens(refreshToken);
  // console.log(refreshResult);
})();
