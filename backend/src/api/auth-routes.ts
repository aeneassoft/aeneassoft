// AeneasSoft Auth Routes — Register, Login, Password Reset, Me
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID, randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  createUser,
  findUserByEmail,
  findUserById,
  createApiKey,
  createPasswordReset,
  findPasswordReset,
  markPasswordResetUsed,
  updateUser,
} from '../db/clickhouse';
import { sendWelcomeEmail, sendResetPasswordEmail } from '../emails';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.LOCAL_MODE !== 'true') {
    throw new Error('JWT_SECRET must be set in production. Set LOCAL_MODE=true for development.');
  }
  return secret || 'local-mode-not-used';
}
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId: string, orgId: string, email: string): string {
  return jwt.sign({ userId, orgId, email }, getJwtSecret(), {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256',
  });
}

function setTokenCookie(reply: FastifyReply, token: string): void {
  reply.header('Set-Cookie',
    `token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );
}

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /auth/register (stricter rate limit: 3/10min)
  fastify.post('/auth/register', { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, name } = request.body as { email?: string; password?: string; name?: string };

    if (!email || !EMAIL_RE.test(email)) {
      return reply.status(400).send({ error: 'Invalid email format' });
    }
    if (!password || password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }

    // Check for existing user
    const existing = await findUserByEmail(CLICKHOUSE_URL, email);
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    // Create user
    const userId = randomUUID();
    const orgId = randomUUID();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await createUser(CLICKHOUSE_URL, userId, email, passwordHash, orgId, name);

    // Create first API key
    const rawKey = `aw_${randomBytes(32).toString('hex')}`;
    await createApiKey(CLICKHOUSE_URL, rawKey, orgId, 'default');

    // Sign JWT
    const token = signToken(userId, orgId, email);
    setTokenCookie(reply, token);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, rawKey).catch(err =>
      fastify.log.error({ err }, 'AeneasSoft Failed to send welcome email'));

    return reply.status(201).send({
      id: userId, email, name: name || null, org_id: orgId, plan: 'free',
      token,
      api_key: rawKey,
      message: 'Account created. Store your API key securely — it cannot be retrieved again.',
    });
  });

  // POST /auth/login
  fastify.post('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const user = await findUserByEmail(CLICKHOUSE_URL, email);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = signToken(user.id, user.org_id, user.email);
    setTokenCookie(reply, token);

    return reply.send({
      user: { id: user.id, email: user.email, org_id: user.org_id, plan: user.plan },
      token,
    });
  });

  // POST /auth/forgot-password
  fastify.post('/auth/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };

    // Always return 200 to prevent email enumeration
    if (!email) {
      return reply.send({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = await findUserByEmail(CLICKHOUSE_URL, email);
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        .toISOString().replace('T', ' ').substring(0, 19);

      await createPasswordReset(CLICKHOUSE_URL, tokenHash, email, expiresAt);

      // Send reset email (non-blocking)
      sendResetPasswordEmail(email, rawToken).catch(err =>
        fastify.log.error({ err }, 'AeneasSoft Failed to send reset email'));
      fastify.log.info(`AeneasSoft Password reset requested for ${email}`);
    }

    return reply.send({ message: 'If that email exists, a reset link has been sent.' });
  });

  // POST /auth/reset-password
  fastify.post('/auth/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password } = request.body as { token?: string; password?: string };

    if (!token || !password || password.length < 8) {
      return reply.status(400).send({ error: 'Token and password (min 8 chars) required' });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetEntry = await findPasswordReset(CLICKHOUSE_URL, tokenHash);

    if (!resetEntry) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await updateUser(CLICKHOUSE_URL, resetEntry.email, { password_hash: newHash });
    await markPasswordResetUsed(CLICKHOUSE_URL, tokenHash);

    return reply.send({ message: 'Password reset successful. You can now log in.' });
  });

  // GET /auth/me — requires JWT
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const user = await findUserById(CLICKHOUSE_URL, request.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Return user properties at top level (frontend expects flat { email, name, plan })
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name || null,
      plan: user.plan,
      org_id: user.org_id,
      stripe_customer_id: user.stripe_customer_id,
      created_at: user.created_at,
    });
  });

  // POST /auth/logout — clear cookie
  fastify.post('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0');
    return reply.send({ message: 'Logged out' });
  });
}
