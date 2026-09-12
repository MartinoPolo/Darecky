import { expect } from 'vitest';

interface DrizzleExpression {
	op: string;
	args: unknown[];
}

function expressionTreeContains(value: unknown, expected: DrizzleExpression): boolean {
	if (JSON.stringify(value) === JSON.stringify(expected)) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some((child) => expressionTreeContains(child, expected));
	}
	if (value !== null && typeof value === 'object') {
		return Object.values(value).some((child) => expressionTreeContains(child, expected));
	}
	return false;
}

export function expression(op: string, ...args: unknown[]): DrizzleExpression {
	return { op, args };
}

export function expressionTreeReferences(
	value: unknown,
	expected: string | number | boolean | null,
): boolean {
	if (value === expected) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some((child) => expressionTreeReferences(child, expected));
	}
	if (value !== null && typeof value === 'object') {
		return Object.values(value).some((child) => expressionTreeReferences(child, expected));
	}
	return false;
}

export function expectWhereToContain(wherePayload: unknown, op: string, ...args: unknown[]): void {
	expect(expressionTreeContains(wherePayload, expression(op, ...args))).toBe(true);
}

export function expectWhereNotToContain(
	wherePayload: unknown,
	op: string,
	...args: unknown[]
): void {
	expect(expressionTreeContains(wherePayload, expression(op, ...args))).toBe(false);
}

export function findWhereContaining(
	wherePayloads: readonly unknown[],
	op: string,
	...args: unknown[]
): unknown {
	const payload = wherePayloads.find((candidate) =>
		expressionTreeContains(candidate, expression(op, ...args)),
	);
	expect(payload).toBeDefined();
	return payload;
}
