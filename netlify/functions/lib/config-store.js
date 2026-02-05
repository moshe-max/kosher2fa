function normalizePhone(phoneNumber = '') {
  return String(phoneNumber).replace(/\D/g, '');
}

function normalizeUsers(rawUsers = {}) {
  return Object.entries(rawUsers).reduce((acc, [phone, services]) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !services || typeof services !== 'object') {
      return acc;
    }

    acc[normalizedPhone] = services;
    return acc;
  }, {});
}

function loadUsersFromEnv() {
  const raw = process.env.USERS_CONFIG;
  if (!raw) {
    return {};
  }

  try {
    return normalizeUsers(JSON.parse(raw));
  } catch {
    throw new Error('USERS_CONFIG is not valid JSON.');
  }
}

async function loadUsersConfig() {
  if (globalThis.__kosher2faUsersConfig) {
    return normalizeUsers(globalThis.__kosher2faUsersConfig);
  }

  return loadUsersFromEnv();
}

async function saveUsersConfig(users) {
  globalThis.__kosher2faUsersConfig = normalizeUsers(users);
}

module.exports = {
  loadUsersConfig,
  normalizePhone,
  normalizeUsers,
  saveUsersConfig
};
