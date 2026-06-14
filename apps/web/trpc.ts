// Compatibility layer replacing @/trpc imports.
// Provides type exports that were previously inferred from tRPC router.
// These types are intentionally loose (using `any`) since the actual
// type safety comes from the API response validation at runtime.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type RouterOutput = Record<string, any>;
export type RouterInput = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */
