---
language: typescript
prefix: TS
version: 1.0.0
---

# TypeScript Review Rules

Rules for `.ts`, `.mts`, `.cts` and `.tsx` files. React-specific rules live in `react.md` and
apply to `.tsx` files as well. Written in this project's own words; follow the source links
for the full background.

### TS-001 — `any` leaks into the code

- **severity**: minor
- **status**: active
- **applies-to**: type annotations, generics, function signatures
- **look-for**: new explicit `any` (including `any[]`, `Record<string, any>`, `as any`) or parameters that are implicitly `any`
- **why**: switches off type checking for everything the value touches, so errors spread silently
- **fix**: use a precise type, a generic, or `unknown` plus narrowing at the boundary
- **sources**: https://refactoring.guru/design-patterns/typescript, https://www.patterns.dev/

```ts
// bad
function total(items: any) { return items.reduce((s: any, i: any) => s + i.price, 0); }
// good
function total(items: ReadonlyArray<{ price: number }>) { return items.reduce((s, i) => s + i.price, 0); }
```

### TS-002 — Non-null assertion hides a possible undefined

- **severity**: minor
- **status**: active
- **applies-to**: values typed as possibly `null` / `undefined`
- **look-for**: new `value!` / `obj!.prop` on values that can really be missing (lookups, `find`, optional props, DOM queries)
- **why**: the compiler stops warning and the code crashes at runtime with "cannot read properties of undefined"
- **fix**: handle the missing case (guard, `??`, early return, throw a clear error)
- **sources**: https://refactoring.guru/introduce-null-object, https://refactoring.guru/design-patterns/typescript

```ts
// bad
const user = users.find((u) => u.id === id)!;
// good
const user = users.find((u) => u.id === id);
if (!user) throw new NotFoundError(`user ${id}`);
```

### TS-003 — Type assertion instead of checking

- **severity**: minor
- **status**: active
- **applies-to**: `as` casts, angle-bracket casts
- **look-for**: `x as T` on values whose type is not known (API responses, `JSON.parse`, events), and especially `as unknown as T`
- **why**: tells the compiler to trust a guess; wrong shapes then fail far from the cause
- **fix**: narrow with type guards or validate with a schema; let inference work instead of casting
- **sources**: https://refactoring.guru/design-patterns/typescript

```ts
// bad
const cfg = JSON.parse(raw) as Config;
// good
const cfg = ConfigSchema.parse(JSON.parse(raw)); // zod/valibot schema, or a hand-written type guard
```

### TS-004 — External data used without runtime validation

- **severity**: major
- **status**: active
- **applies-to**: HTTP responses, request bodies, query params, storage, environment variables
- **look-for**: data from outside the program typed directly with an interface (`await res.json() as User`, `req.body as Dto`) and used without validation
- **why**: types do not exist at runtime; malformed or malicious input reaches business logic
- **fix**: validate at the boundary with a schema and derive the type from it
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md, https://www.patterns.dev/

```ts
// bad
const user: User = await res.json();
// good
const user = UserSchema.parse(await res.json()); // type User = z.infer<typeof UserSchema>
```

### TS-005 — Floating promise

- **severity**: major
- **status**: active
- **applies-to**: calls to async functions
- **look-for**: an async call whose promise is neither awaited, returned, nor handled with `.catch`, outside an intentional `void` fire-and-forget
- **why**: errors become unhandled rejections and the code continues before the work is done
- **fix**: `await` it, return it, or handle errors explicitly; mark deliberate fire-and-forget with `void` and a catch
- **sources**: https://www.patterns.dev/, https://refactoring.guru/design-patterns/typescript

```ts
// bad
saveDraft(doc);
navigate('/next');
// good
await saveDraft(doc);
navigate('/next');
```

### TS-006 — Flags and optional fields instead of a discriminated union

- **severity**: suggestion
- **status**: active
- **applies-to**: state and result types
- **look-for**: types like `{ loading: boolean; error?: string; data?: T }` or several booleans that are only valid in certain combinations
- **why**: allows impossible states (loading and error at once) and forces `!` everywhere
- **fix**: model the states as a union with a `kind`/`status` tag
- **sources**: https://refactoring.guru/replace-type-code-with-state-strategy, https://refactoring.guru/design-patterns/state/typescript/example

```ts
// bad
type Load<T> = { loading: boolean; error?: string; data?: T };
// good
type Load<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; data: T };
```

### TS-007 — Switch over a union is not exhaustive

- **severity**: minor
- **status**: active
- **applies-to**: switch / if-chains over union or enum values
- **look-for**: a switch on a union tag with a silent `default`, or without a `never` check, especially when the union was extended in this diff
- **why**: new variants fall through unnoticed instead of failing to compile
- **fix**: add a `default` that assigns to `never` (`const _exhaustive: never = x`) or use a `Record<Kind, Handler>` map
- **sources**: https://refactoring.guru/smells/switch-statements, https://refactoring.guru/design-patterns/strategy/typescript/example

```ts
// bad
switch (shape.kind) { case 'circle': return area(shape); default: return 0; }
// good
switch (shape.kind) {
  case 'circle': return circleArea(shape);
  case 'square': return squareArea(shape);
  default: { const unhandled: never = shape; throw new Error(`unknown ${unhandled}`); }
}
```

### TS-008 — Numeric or const enum where a union fits

- **severity**: suggestion
- **status**: active
- **applies-to**: new enums
- **look-for**: new numeric `enum`s (values that are only numbers) or `const enum` in library or shared code
- **why**: numeric enums accept any number, print as numbers in logs and payloads, and `const enum` breaks with isolated-module builds
- **fix**: use a string literal union (optionally with an `as const` object for the values)
- **sources**: https://refactoring.guru/design-patterns/typescript

```ts
// bad
enum Role { Admin, Editor, Viewer }
// good
export const Role = { Admin: 'admin', Editor: 'editor', Viewer: 'viewer' } as const;
export type Role = (typeof Role)[keyof typeof Role];
```

### TS-009 — Overly wide types

- **severity**: suggestion
- **status**: active
- **applies-to**: type annotations
- **look-for**: `object`, `{}`, `Function`, `Object`, plain `string` for a known set of values, or `Record<string, unknown>` for a known shape
- **why**: accepts wrong values and gives no help to callers
- **fix**: use the precise shape, a literal union, or a typed function signature
- **sources**: https://refactoring.guru/smells/primitive-obsession

```ts
// bad
function on(event: string, cb: Function) {}
// good
function on<E extends keyof Events>(event: E, cb: (payload: Events[E]) => void) {}
```

### TS-010 — Type check suppressed without reason

- **severity**: minor
- **status**: active
- **applies-to**: compiler directives
- **look-for**: new `// @ts-ignore`, `// @ts-nocheck`, or `// @ts-expect-error` with no explanation
- **why**: hides real errors and keeps hiding them after the code changes
- **fix**: fix the type error; if a suppression is unavoidable, use `@ts-expect-error` with a short reason
- **sources**: https://refactoring.guru/design-patterns/typescript

```ts
// bad
// @ts-ignore
widget.render(props);
// good
// @ts-expect-error legacy widget typings miss `props` (remove after upgrading widget to v5)
widget.render(props);
```

### TS-011 — Exported mutable module state

- **severity**: minor
- **status**: active
- **applies-to**: module-level variables
- **look-for**: `export let`, exported objects or arrays that other modules mutate, or module-level caches used as hidden singletons
- **why**: any importer can change shared state, which causes order-dependent bugs and leaks between tests and server requests
- **fix**: export functions that own the state, or create instances explicitly (factory, dependency injection)
- **sources**: https://www.patterns.dev/vanilla/singleton-pattern, https://refactoring.guru/design-patterns/singleton/typescript/example

```ts
// bad
export let currentUser: User | null = null;
// good
let currentUser: User | null = null;
export const getCurrentUser = () => currentUser;
export const setCurrentUser = (u: User | null) => { currentUser = u; };
```

### TS-012 — Duplicated type definition

- **severity**: suggestion
- **status**: active
- **applies-to**: interfaces and type aliases
- **look-for**: a new type that copies fields from an existing one instead of deriving it
- **why**: the copies drift apart when the original changes
- **fix**: derive with `Pick`, `Omit`, `Partial`, indexed access, `ReturnType` or `z.infer`
- **sources**: https://refactoring.guru/smells/duplicate-code

```ts
// bad
interface UserSummary { id: string; name: string; email: string }
// good
type UserSummary = Pick<User, 'id' | 'name' | 'email'>;
```

### TS-013 — Class used only as a namespace

- **severity**: suggestion
- **status**: active
- **applies-to**: classes
- **look-for**: a new class with only static members, or a class instantiated once just to call stateless methods
- **why**: adds indirection and blocks tree-shaking without giving any benefit
- **fix**: export plain functions from a module
- **sources**: https://refactoring.guru/smells/lazy-class, https://www.patterns.dev/vanilla/module-pattern

```ts
// bad
export class DateUtils { static format(d: Date) { ... } static parse(s: string) { ... } }
// good
export function formatDate(d: Date) { ... }
export function parseDate(s: string) { ... }
```

### TS-014 — Import cycle through barrel files

- **severity**: minor
- **status**: active
- **applies-to**: imports, `index.ts` re-exports
- **look-for**: a module importing from its own feature's `index.ts`, or two modules importing each other directly or through barrels
- **why**: causes `undefined` at import time, slow builds and accidental coupling between features
- **fix**: import from the concrete file inside a feature; keep barrels only as a feature's public API
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md

```ts
// bad (inside features/cart/components/CartItem.tsx)
import { useCart } from '@/features/cart';
// good
import { useCart } from '../hooks/use-cart';
```

### TS-015 — Growing conditional instead of a strategy map

- **severity**: suggestion
- **status**: active
- **applies-to**: if/else or switch selecting behaviour by type, provider or format
- **look-for**: a new branch added to a long conditional that picks an algorithm (payment provider, exporter, formatter)
- **why**: each new option touches the same function and its tests
- **fix**: use a `Record<Key, Strategy>` or separate strategy objects implementing one interface
- **sources**: https://refactoring.guru/design-patterns/strategy/typescript/example

```ts
// bad
if (fmt === 'csv') return toCsv(rows); else if (fmt === 'xlsx') return toXlsx(rows); else if (fmt === 'pdf') ...
// good
const exporters: Record<Format, (rows: Row[]) => Blob> = { csv: toCsv, xlsx: toXlsx, pdf: toPdf };
return exporters[fmt](rows);
```
