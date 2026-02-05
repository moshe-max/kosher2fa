const test = require('node:test');
const assert = require('node:assert/strict');

const { handler } = require('../netlify/functions/set-user');

test('set-user requires POST', async () => {
  const response = await handler({ httpMethod: 'GET', queryStringParameters: {}, headers: {} });
  assert.equal(response.statusCode, 405);
});

test('set-user requires admin auth', async () => {
  process.env.ADMIN_KEY = 'admin';
  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ phone: '0501234567', service: 'gmail', secret: 'JBSWY3DPEHPK3PXP' }),
    headers: { 'content-type': 'application/json' },
    queryStringParameters: {}
  });

  assert.equal(response.statusCode, 401);
});

test('set-user validates fields', async () => {
  process.env.ADMIN_KEY = 'admin';
  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ phone: '', service: 'gmail', secret: 'bad*secret' }),
    headers: { 'content-type': 'application/json', 'x-admin-key': 'admin' },
    queryStringParameters: {}
  });

  assert.equal(response.statusCode, 400);
});
