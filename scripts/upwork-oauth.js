const { createHash, randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, renameSync, chmodSync } = require('node:fs');
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const dotenv = require('dotenv');

const envPath = resolve(process.cwd(), '.env');
dotenv.config({ path: envPath, quiet: true });

const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token';
const authorizeUrl = 'https://www.upwork.com/ab/account-security/oauth2/authorize';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required in .env`);
  return value;
}

function writeTokens(tokens) {
  if (!tokens || typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
    throw new Error('Upwork did not return both OAuth tokens');
  }
  let contents = readFileSync(envPath, 'utf8');
  for (const [name, value] of Object.entries({
    UPWORK_ACCESS_TOKEN: tokens.access_token,
    UPWORK_REFRESH_TOKEN: tokens.refresh_token,
  })) {
    const line = `${name}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
  }
  const tempPath = `${envPath}.tmp`;
  writeFileSync(tempPath, contents, { mode: 0o600 });
  chmodSync(tempPath, 0o600);
  renameSync(tempPath, envPath);
  console.log('OAuth tokens saved to .env (mode 600). Restart the API to load them.');
}

async function exchange(form) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Upwork OAuth returned HTTP ${response.status}`);
  return response.json();
}

async function refresh() {
  const tokens = await exchange({
    grant_type: 'refresh_token',
    client_id: required('UPWORK_CLIENT_ID'),
    client_secret: required('UPWORK_CLIENT_SECRET'),
    refresh_token: required('UPWORK_REFRESH_TOKEN'),
  });
  writeTokens(tokens);
}

async function authorize() {
  const clientId = required('UPWORK_CLIENT_ID');
  const clientSecret = required('UPWORK_CLIENT_SECRET');
  const redirectUri = new URL(required('UPWORK_REDIRECT_URI'));
  if (redirectUri.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(redirectUri.hostname)) {
    throw new Error('UPWORK_REDIRECT_URI must use localhost HTTP for this local setup command');
  }
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(32).toString('base64url');
  const url = new URL(authorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri.toString(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString();

  const server = createServer(async (request, response) => {
    const callback = new URL(request.url || '/', redirectUri);
    if (callback.pathname !== redirectUri.pathname) {
      response.writeHead(404).end('Not found');
      return;
    }
    if (callback.searchParams.get('state') !== state || !callback.searchParams.get('code')) {
      response.writeHead(400).end('Invalid OAuth callback');
      return;
    }
    try {
      const tokens = await exchange({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: callback.searchParams.get('code'),
        redirect_uri: redirectUri.toString(),
        code_verifier: verifier,
      });
      writeTokens(tokens);
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end('Upwork connected. You may close this tab.');
      server.close();
    } catch (error) {
      response.writeHead(502).end('OAuth exchange failed; check the terminal.');
      console.error(error.message);
      server.close();
    }
  });

  server.listen(Number(redirectUri.port || 80), redirectUri.hostname, () => {
    console.log('Open this URL to authorize your Upwork account:');
    console.log(url.toString());
  });
  setTimeout(() => server.close(), 5 * 60 * 1000).unref();
}

(process.argv[2] === 'refresh' ? refresh() : authorize()).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
