import {
  TEST_AUTH_EMAIL,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
  TEST_AUTH_PASSWORD,
} from "../src/config";
import { HolipolyClient } from "../src/core";
import { storage } from "../src/core/storage";
import { setupMockServer, setupHolipolyClient } from "./setup";
import { loginWithExternalPlugin } from "./utils";

interface RefreshTokenOnDelayedExample {
  previousToken: string | null;
  newToken: string | null;
}

const testRefreshTokenOnDelayedExampleRequests = async (
  holipoly: HolipolyClient,
  delayInSeconds: number
): Promise<RefreshTokenOnDelayedExample> => {
  // Check if initially logged in
  const state = holipoly.getState();
  const previousToken = storage.getAccessToken();
  expect(state?.user?.id).toBeDefined();
  expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
  expect(state?.authenticated).toBe(true);

  // Wait until token can be refreshed
  await new Promise(r => setTimeout(r, delayInSeconds * 1000));

  // Check that token was not refreshed before making another request
  const unchangedPreviousToken = storage.getAccessToken();
  expect(previousToken).toEqual(unchangedPreviousToken);

  // Make another requests
  const firstUpdateAccountPromise = holipoly.user.updateAccount({
    input: {
      firstName: state?.user?.firstName,
      lastName: state?.user?.lastName,
    },
  });
  const secondUpdateAccountPromise = holipoly.user.updateAccount({
    input: {
      firstName: state?.user?.firstName,
      lastName: state?.user?.lastName,
    },
  });

  // Check that token was refreshed with first another request which did not return errors
  const firstUpdateAccount = await firstUpdateAccountPromise;
  expect(firstUpdateAccount.data?.accountUpdate?.errors).toHaveLength(0);
  const newFirstToken = storage.getAccessToken();
  expect(state?.user?.id).toBeDefined();
  expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
  expect(state?.authenticated).toBe(true);
  expect(newFirstToken).toBeTruthy();
  const secondUpdateAccount = await secondUpdateAccountPromise;
  expect(secondUpdateAccount.data?.accountUpdate?.errors).toHaveLength(0);
  const newSecondToken = storage.getAccessToken();
  expect(state?.user?.id).toBeDefined();
  expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
  expect(state?.authenticated).toBe(true);
  expect(newFirstToken).toBeTruthy();

  // Check if tokenRefresh mutation only executes once on first request,
  // and the rest awaits the initial promise instead of creating a new one
  expect(newFirstToken).toEqual(newSecondToken);

  return {
    previousToken,
    newToken: newFirstToken,
  };
};

jest.setTimeout(15000);

describe("auth api auto token refresh", () => {
  const tokenExpirationPeriod = 6;
  const tokenExpirationPeriodCheckWait = tokenExpirationPeriod + 0.1;
  const tokenRefreshTimeSkew = 3;
  const tokenRefreshTimeSkewCheckWait = tokenRefreshTimeSkew + 0.1;
  const noCheckWait = 0;

  const holipoly = setupHolipolyClient({
    tokenRefreshTimeSkew,
  });
  const mockServer = setupMockServer({
    tokenExpirationPeriod,
  });

  beforeAll(() => mockServer.listen());

  afterEach(() => {
    mockServer.resetHandlers();
    storage.clear();
    /*
      Clear cache to avoid legacy state persistance between tests:
      https://github.com/apollographql/apollo-client/issues/3766#issuecomment-578075556
    */
    holipoly._internal.apolloClient.stop();
    holipoly._internal.apolloClient.clearStore();
  });

  afterAll(() => mockServer.close());

  it("does not refresh access token before another request when refresh time skew not reached", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(holipoly, noCheckWait);
    expect(previousToken).toEqual(newToken);
  });

  it("does not refresh external access token before another request when refresh time skew not reached", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(holipoly, noCheckWait);
    expect(previousToken).toEqual(newToken);
  });

  it("automatically refresh access token before another request when refresh time skew reached", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(
      holipoly,
      tokenRefreshTimeSkewCheckWait
    );
    expect(previousToken).not.toEqual(newToken);
  });

  it("automatically refresh external access token before another request when refresh time skew reached", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(
      holipoly,
      tokenRefreshTimeSkewCheckWait
    );
    expect(previousToken).not.toEqual(newToken);
  });

  it("automatically refresh access token before another request when expiration period reached", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(
      holipoly,
      tokenExpirationPeriodCheckWait
    );
    expect(previousToken).not.toEqual(newToken);
  });

  it("automatically refresh external access token before another request when expiration period reached", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const {
      previousToken,
      newToken,
    } = await testRefreshTokenOnDelayedExampleRequests(
      holipoly,
      tokenExpirationPeriodCheckWait
    );
    expect(previousToken).not.toEqual(newToken);
  });

  it("check if another request has been called, no matter if automatically refresh access token fails", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });

    // Check if initially logged in
    const state = holipoly.getState();
    const previousToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);

    // Wait until token can be refreshed
    await new Promise(r => setTimeout(r, tokenRefreshTimeSkewCheckWait * 1000));

    // Check that token was not refreshed before making another request
    const unchangedPreviousToken = storage.getAccessToken();
    expect(previousToken).toEqual(unchangedPreviousToken);

    // Remove csrf token to fail next automatically refresh access token
    storage.setRefreshToken(null);

    // Make another requests
    const updateAccount = await holipoly.user.updateAccount({
      input: {
        firstName: state?.user?.firstName,
        lastName: state?.user?.lastName,
      },
    });

    // Check that token is still in use and another request did not return errors
    expect(updateAccount.data?.accountUpdate?.errors).toHaveLength(0);
    const newToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBeDefined();
    expect(state?.authenticated).toBe(true);
    expect(newToken).toBeTruthy();

    // Check if token failed to refresh
    expect(previousToken).toEqual(newToken);
  });

  it("check if another request has been called, no matter if automatically refresh external access token fails", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });

    // Check if initially logged in
    const state = holipoly.getState();
    const previousToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);

    // Wait until token can be refreshed
    await new Promise(r => setTimeout(r, tokenRefreshTimeSkewCheckWait * 1000));

    // Check that token was not refreshed before making another request
    const unchangedPreviousToken = storage.getAccessToken();
    expect(previousToken).toEqual(unchangedPreviousToken);

    // Remove csrf token to fail next automatically refresh access token
    storage.setRefreshToken(null);

    // Make another requests
    const updateAccount = await holipoly.user.updateAccount({
      input: {
        firstName: state?.user?.firstName,
        lastName: state?.user?.lastName,
      },
    });

    // Check that token is still in use and another request did not return errors
    expect(updateAccount.data?.accountUpdate?.errors).toHaveLength(0);
    const newToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBeDefined();
    expect(state?.authenticated).toBe(true);
    expect(newToken).toBeTruthy();

    // Check if token failed to refresh
    expect(previousToken).toEqual(newToken);
  });
});
