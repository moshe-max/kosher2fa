const crypto = require('crypto');
const { loadUsersConfig, normalizePhone } = require('./lib/config-store');

const TIME_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function phoneCandidates(phoneNumber = '') {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    return [];
  }

  const candidates = new Set([normalized]);

  if (normalized.startsWith('972')) {
    candidates.add(`0${normalized.slice(3)}`);
  }

  if (normalized.startsWith('0')) {
    candidates.add(`972${normalized.slice(1)}`);
  }

  return Array.from(candidates);
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

function buildResponse(statusCode, body, contentType = 'application/json; charset=utf-8') {
  const isObject = typeof body === 'object';
  const payload = isObject ? JSON.stringify(body) : String(body);

  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    },
    body: payload
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

function findUserByPhone(users, phoneInput) {
  for (const candidate of phoneCandidates(phoneInput)) {
    if (users[candidate]) {
      return { normalizedPhone: candidate, services: users[candidate] };
    }
  }

  return null;
}

function authorize(event, input) {
  const suppliedKey =
    event.headers?.['x-api-key'] ||
    event.headers?.['X-API-Key'] ||
    input.key;

  if (process.env.API_KEY && suppliedKey !== process.env.API_KEY) {
    return false;
  }

  return true;
}

function codeToSpeakable(code) {
  return String(code).split('').join(' ');
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return buildResponse(204, '', 'text/plain; charset=utf-8');
    }

    const input = parseRequestInput(event);

    if (!authorize(event, input)) {
      return buildResponse(401, { error: 'Unauthorized' });
    }

    const phone = input.phone;
    if (!normalizePhone(phone)) {
      return buildResponse(400, { error: 'Missing required parameter: phone' });
    }

    const users = await loadUsersConfig();
    const match = findUserByPhone(users, phone);

    if (!match) {
      return buildResponse(404, { error: 'Phone number is not configured' });
    }

    const requestedService = input.service;
    const entries = Object.entries(match.services).filter(([service]) => !requestedService || service === requestedService);

    if (entries.length === 0) {
      return buildResponse(404, { error: `Service '${requestedService}' is not configured for this phone` });
    }

    const codes = Object.fromEntries(entries.map(([service, secret]) => [service, generateTotp(secret)]));
    const responseMode = input.response || 'json';

    if (responseMode === 'text') {
      if (entries.length !== 1) {
        return buildResponse(400, { error: 'Text response requires exactly one service. Add ?service=...' });
      }

      const [serviceName] = entries[0];
      const code = codes[serviceName].code;
      const sayCode = String(input.speak).toLowerCase() === 'true' ? codeToSpeakable(code) : code;
      return buildResponse(200, sayCode, 'text/plain; charset=utf-8');
    }

    return buildResponse(200, {
      phone: match.normalizedPhone,
      codes,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return buildResponse(500, { error: error.message || 'Unexpected server error' });
  }
};

exports._internal = {
  base32ToBuffer,
  codeToSpeakable,
  findUserByPhone,
  generateTotp,
  normalizePhone,
  parseRequestInput,
  phoneCandidates
};
