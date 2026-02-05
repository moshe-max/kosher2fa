const test = require('node:test');
const assert = require('node:assert/strict');

const { _internal, handler } = require('../netlify/functions/2fa-code');

test('normalizePhone strips non-digits', () => {
  assert.equal(_internal.normalizePhone('+972-50-123-4567'), '972501234567');
});

test('phoneCandidates supports IL local and international variants', () => {
  assert.deepEqual(_internal.phoneCandidates('050-123-4567'), ['0501234567', '972501234567']);
  assert.deepEqual(_internal.phoneCandidates('+972-50-123-4567'), ['972501234567', '0501234567']);
});

test('generateTotp returns RFC 6238 known vector', () => {
  const result = _internal.generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000, 8);
  assert.equal(result.code, '94287082');
});

test('handler returns code for configured user with international caller format', async () => {
  process.env.USERS_CONFIG = JSON.stringify({
    '0501234567': { gmail: 'JBSWY3DPEHPK3PXP' }
  });
  process.env.API_KEY = 'secret';

  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { phone: '972501234567' },
    headers: { 'x-api-key': 'secret' }
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.phone, '0501234567');
  assert.ok(body.codes.gmail.code.match(/^\d{6}$/));
});

test('handler supports text mode for telephony', async () => {
  process.env.USERS_CONFIG = JSON.stringify({
    '972501234567': { gmail: 'JBSWY3DPEHPK3PXP' }
  });
  process.env.API_KEY = 'secret';

  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { phone: '972501234567', service: 'gmail', response: 'text', speak: 'true' },
    headers: { 'x-api-key': 'secret' }
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /^\d( \d){5}$/);
});

test('handler blocks invalid key', async () => {
  process.env.USERS_CONFIG = JSON.stringify({
    '972501234567': { gmail: 'JBSWY3DPEHPK3PXP' }
  });
  process.env.API_KEY = 'secret';

  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { phone: '972501234567' },
    headers: { 'x-api-key': 'wrong' }
  });

  assert.equal(response.statusCode, 401);
});
