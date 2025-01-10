import {
  API_URI,
  TEST_AUTH_EMAIL,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_CODE,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_STATE,
  TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
  TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK,
  TEST_AUTH_PASSWORD,
  TEST_AUTH_SECOND_EMAIL,
  TEST_AUTH_SECOND_PASSWORD,
} from "../src/config";
import { storage } from "../src/core/storage";
import { setupMockServer, setupHolipolyClient } from "./setup";
import { loginWithExternalPlugin } from "./utils";

describe("auth api", () => {
  const holipoly = setupHolipolyClient();
  const mockServer = setupMockServer();

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

  it("can login", async () => {
    const { data } = await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    expect(data?.tokenCreate?.errors).toHaveLength(0);
    expect(data?.tokenCreate?.user?.id).toBeDefined();
    expect(data?.tokenCreate?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(data?.tokenCreate?.token).toBeDefined();
    expect(storage.getAccessToken()).not.toBeNull();
    expect(storage.getRefreshToken()).not.toBeNull();
  });

  it("can login without details", async () => {
    const { data } = await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
      includeDetails: false,
    });
    expect(data?.tokenCreate?.errors).toHaveLength(0);
    expect(data?.tokenCreate?.user?.id).toBeDefined();
    expect(data?.tokenCreate?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(data?.tokenCreate?.token).toBeDefined();
    expect(data?.tokenCreate?.user?.addresses).toBeUndefined();
    expect(data?.tokenCreate?.user?.defaultBillingAddress).toBeUndefined();
    expect(data?.tokenCreate?.user?.defaultShippingAddress).toBeUndefined();
    expect(data?.tokenCreate?.user?.metadata).toBeUndefined();
    expect(storage.getAccessToken()).not.toBeNull();
    expect(storage.getRefreshToken()).not.toBeNull();
  });

  it("login caches user data", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
  });

  it("will throw an error if login credentials are invalid", async () => {
    const { data } = await holipoly.auth.login({
      email: "wrong@example.com",
      password: "wrong",
    });
    expect(data?.tokenCreate?.user).toBeFalsy();
    expect(data?.tokenCreate?.token).toBeFalsy();
    expect(data?.tokenCreate?.errors).not.toHaveLength(0);
  });

  it("manually refreshes auth token", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const state = holipoly.getState();
    const previousToken = storage.getAccessToken();
    expect(state?.authenticated).toBe(true);

    const { data } = await holipoly.auth.refreshToken();
    const newToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(newToken).toBeTruthy();
    expect(data?.tokenRefresh?.token).toEqual(newToken);
    expect(previousToken).not.toEqual(newToken);
  });

  it("can register", async () => {
    const { data } = await holipoly.auth.register({
      email: `register+${Date.now().toString()}@example.com`,
      password: "register",
      redirectUrl: API_URI,
    });
    expect(data?.accountRegister?.errors).toHaveLength(0);
  });

  it("logout clears user cache", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    await holipoly.auth.logout();
    const state = holipoly.getState();
    expect(state?.user).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it("verifies if token is valid", async () => {
    const { data } = await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });

    if (data?.tokenCreate?.token) {
      const { data: result } = await holipoly.auth.verifyToken();
      expect(result?.tokenVerify?.isValid).toBe(true);
    }
  });

  it("sends request to reset password", async () => {
    const { data } = await holipoly.auth.requestPasswordReset({
      email: TEST_AUTH_EMAIL,
      redirectUrl: API_URI,
    });
    expect(data?.requestPasswordReset?.errors).toHaveLength(0);
  });

  it("changes user's password", async () => {
    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    const { data } = await holipoly.auth.changePassword({
      oldPassword: TEST_AUTH_PASSWORD,
      newPassword: TEST_AUTH_PASSWORD,
    });
    expect(data?.passwordChange?.errors).toHaveLength(0);
  });

  it("can login with external plugin", async () => {
    const accessToken = await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    expect(accessToken?.externalObtainAccessTokens?.errors).toHaveLength(0);
    expect(accessToken?.externalObtainAccessTokens?.user?.id).toBeDefined();
    expect(accessToken?.externalObtainAccessTokens?.user?.email).toBe(
      TEST_AUTH_EMAIL
    );
    expect(accessToken?.externalObtainAccessTokens?.token).toBeDefined();
    expect(storage.getAccessToken()).not.toBeNull();
    expect(storage.getRefreshToken()).not.toBeNull();
    expect(storage.getAuthPluginId()).not.toBeNull();
  });

  it("login with external plugin caches user data", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
  });

  it("fail to login with external plugin", async () => {
    const accessToken = await loginWithExternalPlugin(holipoly, {
      code: "wrong",
      state: "wrong",
    });
    expect(accessToken?.externalObtainAccessTokens?.user).toBeFalsy();
    expect(accessToken?.externalObtainAccessTokens?.token).toBeFalsy();
    expect(accessToken?.externalObtainAccessTokens?.errors).not.toHaveLength(0);
  });

  it("logout with external plugin clears user cache", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    await holipoly.auth.logout({
      input: JSON.stringify({
        returnTo: TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK,
      }),
    });
    const state = holipoly.getState();
    expect(state?.user).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it("logout with external plugin returns external logout URL", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const result = await holipoly.auth.logout({
      input: JSON.stringify({
        returnTo: TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK,
      }),
    });
    expect(result?.data?.externalLogout?.errors).toHaveLength(0);
    const logoutUrl = JSON.parse(
      result?.data?.externalLogout?.logoutData || "{}"
    ).logoutUrl;
    expect(logoutUrl).toBeDefined();
    const logoutUrlReturnToQueryParam = decodeURIComponent(logoutUrl as string)
      .split("?")[1]
      .split("=");
    expect(logoutUrlReturnToQueryParam[0]).toBe("returnTo");
    expect(logoutUrlReturnToQueryParam[1]).toBe(
      TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK
    );
  });

  it("manually refresh external access token", async () => {
    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    const state = holipoly.getState();
    const previousToken = storage.getAccessToken();
    expect(state?.authenticated).toBe(true);

    const { data } = await holipoly.auth.refreshExternalToken();

    const newToken = storage.getAccessToken();
    expect(state?.user?.id).toBeDefined();
    expect(state?.authenticated).toBe(true);
    expect(newToken).toBeTruthy();
    expect(data?.externalRefresh?.token).toEqual(newToken);
    expect(previousToken).not.toEqual(newToken);
  });

  it("verifies if external token is valid", async () => {
    const data = await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });

    if (data?.externalObtainAccessTokens?.token) {
      const { data: result } = await holipoly.auth.verifyExternalToken();
      expect(result?.externalVerify?.isValid).toBe(true);
    }
  });

  it("login, logout and login with different credentials", async () => {
    let state;

    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeNull();

    await holipoly.auth.logout();
    state = holipoly.getState();
    expect(state?.user?.id).toBeFalsy();
    expect(state?.user?.email).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getAuthPluginId()).toBeNull();

    await holipoly.auth.login({
      email: TEST_AUTH_SECOND_EMAIL,
      password: TEST_AUTH_SECOND_PASSWORD,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_SECOND_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeNull();
  });

  it("login, logout and login with different credentials with external plugin", async () => {
    let state;

    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeTruthy();

    await holipoly.auth.logout({
      input: JSON.stringify({
        returnTo: TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK,
      }),
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeFalsy();
    expect(state?.user?.email).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getAuthPluginId()).toBeNull();

    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_STATE,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_SECOND_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeTruthy();
  });

  it("caches user data correctly in steps sequence: login, logout, login with external plugin", async () => {
    let state;

    await holipoly.auth.login({
      email: TEST_AUTH_EMAIL,
      password: TEST_AUTH_PASSWORD,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeNull();

    await holipoly.auth.logout();
    state = holipoly.getState();
    expect(state?.user?.id).toBeFalsy();
    expect(state?.user?.email).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getAuthPluginId()).toBeNull();

    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_SECOND_STATE,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_SECOND_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeTruthy();
  });

  it("caches user data correctly in steps sequence: login with external plugin, logout, login", async () => {
    let state;

    await loginWithExternalPlugin(holipoly, {
      code: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_CODE,
      state: TEST_AUTH_EXTERNAL_LOGIN_PLUGIN_RESPONSE_STATE,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeTruthy();

    await holipoly.auth.logout({
      input: JSON.stringify({
        returnTo: TEST_AUTH_EXTERNAL_LOGOUT_CALLBACK,
      }),
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeFalsy();
    expect(state?.user?.email).toBeFalsy();
    expect(state?.authenticated).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getAuthPluginId()).toBeNull();

    await holipoly.auth.login({
      email: TEST_AUTH_SECOND_EMAIL,
      password: TEST_AUTH_SECOND_PASSWORD,
    });
    state = holipoly.getState();
    expect(state?.user?.id).toBeDefined();
    expect(state?.user?.email).toBe(TEST_AUTH_SECOND_EMAIL);
    expect(state?.authenticated).toBe(true);
    expect(storage.getAccessToken()).toBeTruthy();
    expect(storage.getRefreshToken()).toBeTruthy();
    expect(storage.getAuthPluginId()).toBeNull();
  });
});
