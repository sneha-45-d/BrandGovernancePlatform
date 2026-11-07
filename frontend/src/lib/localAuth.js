const localAccountsKey = 'brandithm-local-accounts'
const passwordIterations = 210_000

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(localAccountsKey) || '[]')
    return Array.isArray(accounts) ? accounts : []
  } catch {
    return []
  }
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value) {
  return new Uint8Array(value.match(/.{2}/g).map((part) => Number.parseInt(part, 16)))
}

async function passwordDigest(password, salt) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: passwordIterations,
    hash: 'SHA-256',
  }, key, 256)
  return new Uint8Array(bits)
}

function makeSession(account) {
  return {
    token: `local.${crypto.randomUUID()}`,
    localOnly: true,
    user: {
      id: account.id,
      full_name: account.full_name,
      email: account.email,
      localOnly: true,
    },
  }
}

export async function registerLocalAccount({ full_name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = readAccounts()
  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists in this browser.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const digest = await passwordDigest(password, salt)
  const account = {
    id: `local-${crypto.randomUUID()}`,
    full_name: full_name.trim(),
    email: normalizedEmail,
    password_salt: toHex(salt),
    password_digest: toHex(digest),
  }
  localStorage.setItem(localAccountsKey, JSON.stringify([...accounts, account]))
  return makeSession(account)
}

export async function loginLocalAccount({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const account = readAccounts().find((item) => item.email === normalizedEmail)
  if (!account) throw new Error('Email or password is incorrect.')

  const digest = await passwordDigest(password, fromHex(account.password_salt))
  if (toHex(digest) !== account.password_digest) {
    throw new Error('Email or password is incorrect.')
  }
  return makeSession(account)
}

export function updateLocalAccount(user, updates) {
  const accounts = readAccounts()
  const normalizedEmail = updates.email.trim().toLowerCase()
  if (accounts.some((account) => account.id !== user.id && account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists in this browser.')
  }

  const updatedUser = {
    ...user,
    full_name: updates.full_name.trim(),
    email: normalizedEmail,
  }
  const nextAccounts = accounts.map((account) => (
    account.id === user.id
      ? { ...account, full_name: updatedUser.full_name, email: normalizedEmail }
      : account
  ))
  localStorage.setItem(localAccountsKey, JSON.stringify(nextAccounts))
  return updatedUser
}
