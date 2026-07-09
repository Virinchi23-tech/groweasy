import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RegisterSchema, LoginSchema } from '@groweasy/shared';

describe('Authentication Flow & Unit Tests', () => {
  const jwtSecret = 'test_secret_key_123456';
  
  test('Register Schema validation checks', () => {
    const valid = RegisterSchema.safeParse({
      name: 'John Doe',
      email: 'john@groweasy.com',
      password: 'password123',
      role: 'USER',
    });
    expect(valid.success).toBe(true);

    const invalidEmail = RegisterSchema.safeParse({
      name: 'John Doe',
      email: 'invalid-email',
      password: 'password123',
      role: 'USER',
    });
    expect(invalidEmail.success).toBe(false);

    const shortPassword = RegisterSchema.safeParse({
      name: 'John Doe',
      email: 'john@groweasy.com',
      password: '123',
      role: 'USER',
    });
    expect(shortPassword.success).toBe(false);
  });

  test('Login Schema validation checks', () => {
    const valid = LoginSchema.safeParse({
      email: 'john@groweasy.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);
  });

  test('Password Hashing & Verification', async () => {
    const password = 'mySuperSecretPassword123';
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);

    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);

    const mismatch = await bcrypt.compare('wrongPassword', hash);
    expect(mismatch).toBe(false);
  });

  test('JWT Signature and Payload Verification', () => {
    const payload = { userId: 'user-uuid-123', role: 'ADMIN', name: 'Admin User' };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, jwtSecret) as any;
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.name).toBe(payload.name);
  });
});
