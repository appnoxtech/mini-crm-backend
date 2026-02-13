export const slackConfig = {
  clientId: process.env.SLACK_CLIENT_ID || '',
  clientSecret: process.env.SLACK_CLIENT_SECRET || '',
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  redirectUri: process.env.SLACK_REDIRECT_URI || '',
  scopes: [
    'chat:write',
    'channels:read',
    'groups:read',
    'im:read',
    'mpim:read',
    'users:read',
    'team:read',
  ],
  apiBaseUrl: 'https://slack.com/api',
  oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize',
};

export const isSlackConfigured = (): boolean => {
  return !!(
    slackConfig.clientId &&
    slackConfig.clientSecret &&
    slackConfig.signingSecret &&
    slackConfig.redirectUri
  );
};
