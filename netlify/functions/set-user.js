const { normalizePhone, loadUsersConfig, saveUsersConfig } = require('./lib/config-store');

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

function parseFormBody(rawBody = '') {
  return Object.fromEntries(new URLSearchParams(rawBody));
}

function parseRequestInput(event) {
  const query = event.queryStringParameters || {};

  if (event.httpMethod === 'POST' && event.body) {
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';

    if (contentType.includes('application/json')) {
      return { ...query, ...JSON.parse(event.body) };
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      return { ...query, ...parseFormBody(event.body) };
    }
  }

  return query;
}

function normalizeSecret(secret = '') {
  return String(secret).toUpperCase().replace(/\s+/g, '');
}

function isBase32(value) {
  return /^[A-Z2-7]+=*$/.test(value);
}

function isAuthorized(event, input) {
  const suppliedKey = event.headers?.['x-admin-key'] || event.headers?.['X-Admin-Key'] || input.adminKey;
  return Boolean(process.env.ADMIN_KEY) && suppliedKey === process.env.ADMIN_KEY;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return buildResponse(405, { error: 'Method not allowed. Use POST.' });
    }

    const input = parseRequestInput(event);

    if (!isAuthorized(event, input)) {
      return buildResponse(401, { error: 'Unauthorized. Set ADMIN_KEY and send x-admin-key.' });
    }

    const phone = normalizePhone(input.phone);
    const service = String(input.service || '').trim();
    const secret = normalizeSecret(input.secret);

    if (!phone || !service || !secret) {
      return buildResponse(400, { error: 'phone, service, and secret are required' });
    }

    if (!isBase32(secret)) {
      return buildResponse(400, { error: 'secret must be valid Base32' });
    }

    const users = await loadUsersConfig();
    const existing = users[phone] || {};
    users[phone] = { ...existing, [service]: secret };

    await saveUsersConfig(users);

    return buildResponse(200, {
      ok: true,
      phone,
      service,
      message: 'Value saved successfully'
    });
  } catch (error) {
    return buildResponse(500, { error: error.message || 'Unexpected server error' });
  }
};
