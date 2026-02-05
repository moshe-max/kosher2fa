const crypto = require('crypto');

const TIME_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function normalizePhone(phoneNumber = '') {
  return String(phoneNumber).replace(/\D/g, '');
}

function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(base32).toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');

  let bits = '';
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotp(secret, timestamp = Date.now(), digits = DEFAULT_DIGITS) {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(timestamp / 1000 / TIME_STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hash = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binaryCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const code = (binaryCode % 10 ** digits).toString().padStart(digits, '0');
  const secondsRemaining = TIME_STEP_SECONDS - (Math.floor(timestamp / 1000) % TIME_STEP_SECONDS);

  return { code, secondsRemaining };
}

function loadUsersConfig() {
  const raw = process.env.USERS_CONFIG;
  if (!raw) {
    throw new Error('USERS_CONFIG environment variable is missing.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('USERS_CONFIG is not valid JSON.');
  }

  return Object.entries(parsed).reduce((acc, [phone, services]) => {
    acc[normalizePhone(phone)] = services;
    return acc;
  }, {});
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const suppliedKey = event.headers?.['x-api-key'] || query.key;

    if (process.env.API_KEY && suppliedKey !== process.env.API_KEY) {
      return buildResponse(401, { error: 'Unauthorized' });
    }

    const phone = normalizePhone(query.phone);
    if (!phone) {
      return buildResponse(400, { error: 'Missing required query parameter: phone' });
    }

    const users = loadUsersConfig();
    const userServices = users[phone];
    if (!userServices) {
      return buildResponse(404, { error: 'Phone number is not configured' });
    }

    const requestedService = query.service;
    const entries = Object.entries(userServices).filter(([service]) => {
      return !requestedService || service === requestedService;
    });

    if (entries.length === 0) {
      return buildResponse(404, { error: `Service '${requestedService}' is not configured for this phone` });
    }

    const codes = Object.fromEntries(
      entries.map(([service, secret]) => {
        const totp = generateTotp(secret);
        return [service, totp];
      })
    );

    return buildResponse(200, {
      phone,
      codes,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return buildResponse(500, { error: error.message || 'Unexpected server error' });
  }
};

exports._internal = {
  base32ToBuffer,
  generateTotp,
  normalizePhone,
  loadUsersConfig
};
