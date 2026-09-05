import { describe, it, expect } from 'vitest';
import { registerSchema, createItemSchema, moveStockSchema } from '../schemas/index.js';

describe('Shared Validation Schemas', () => {
  it('validates registration input correctly', () => {
    const valid = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      fullName: 'Test User',
      householdName: 'My Home',
    });
    expect(valid.success).toBe(true);

    const invalidEmail = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      fullName: 'Test User',
    });
    expect(invalidEmail.success).toBe(false);

    const shortPassword = registerSchema.safeParse({
      email: 'user@example.com',
      password: '123',
      fullName: 'Test User',
    });
    expect(shortPassword.success).toBe(false);
  });

  it('validates createItemSchema defaults and required fields', () => {
    const result = createItemSchema.safeParse({
      name: 'Ceramic Coffee Mug',
      totalQuantity: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit).toBe('pcs');
      expect(result.data.condition).toBe('good');
      expect(result.data.status).toBe('active');
    }
  });

  it('enforces moveStock destination XOR rule (location OR container)', () => {
    const validLocation = moveStockSchema.safeParse({
      quantity: 2,
      toLocationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(validLocation.success).toBe(true);

    const validContainer = moveStockSchema.safeParse({
      quantity: 2,
      toContainerItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    });
    expect(validContainer.success).toBe(true);

    const invalidBoth = moveStockSchema.safeParse({
      quantity: 2,
      toLocationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      toContainerItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    });
    expect(invalidBoth.success).toBe(false);

    const invalidNeither = moveStockSchema.safeParse({
      quantity: 2,
    });
    expect(invalidNeither.success).toBe(false);
  });
});
