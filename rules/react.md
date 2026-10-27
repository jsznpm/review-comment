---
language: react
prefix: REACT
version: 1.0.0
---

# React Review Rules

Rules for `.jsx` and `.tsx` files, applied together with the JavaScript or TypeScript rules.
Written in this project's own words; follow the source links for the full background.

### REACT-001 — Effect used to compute derived state

- **severity**: minor
- **status**: active
- **applies-to**: `useEffect` / `useLayoutEffect`
- **look-for**: an effect whose only job is to `setState` from other props or state (filtering, totals, formatting, copying a prop)
- **why**: causes an extra render with stale values first, and the two pieces of state can drift apart
- **fix**: compute the value during render (with `useMemo` only if it is expensive)
- **sources**: https://react.dev/learn/you-might-not-need-an-effect, https://www.patterns.dev/react/hooks-pattern

```tsx
// bad
const [visible, setVisible] = useState<Todo[]>([]);
useEffect(() => { setVisible(todos.filter((t) => !t.done)); }, [todos]);
// good
const visible = todos.filter((t) => !t.done);
```

### REACT-002 — Effect used to respond to a user action

- **severity**: minor
- **status**: active
- **applies-to**: `useEffect`
- **look-for**: state set in an event handler only so that an effect can react to it (send request, show toast, navigate)
- **why**: indirect, runs again on unrelated re-renders or remounts, and makes the action hard to follow
- **fix**: do the work directly in the event handler
- **sources**: https://react.dev/learn/you-might-not-need-an-effect

```tsx
// bad
const [submitted, setSubmitted] = useState(false);
useEffect(() => { if (submitted) post(form); }, [submitted]);
// good
const onSubmit = () => post(form);
```

### REACT-003 — Missing or wrong effect dependencies

- **severity**: major
- **status**: active
- **applies-to**: `useEffect`, `useMemo`, `useCallback`
- **look-for**: values from props, state or the component body used inside a hook but missing from its dependency array, or a lint suppression for `react-hooks/exhaustive-deps`
- **why**: the hook keeps reading stale values and misses updates
- **fix**: list every reactive value; move stable helpers outside the component or use a functional state update
- **sources**: https://react.dev/learn/you-might-not-need-an-effect, https://www.patterns.dev/react/hooks-pattern

```tsx
// bad
useEffect(() => { fetchResults(query, page); }, [query]);
// good
useEffect(() => { fetchResults(query, page); }, [query, page]);
```

### REACT-004 — Effect without cleanup

- **severity**: major
- **status**: active
- **applies-to**: `useEffect`
- **look-for**: effects that subscribe, add listeners, start timers or intervals, open sockets, or fetch, without returning a cleanup function
- **why**: leaks, duplicated handlers in Strict Mode, and state updates from requests that finished after the user moved on
- **fix**: return a cleanup that unsubscribes / clears / aborts (`AbortController` for fetch)
- **sources**: https://www.patterns.dev/react/hooks-pattern

```tsx
// bad
useEffect(() => { const id = setInterval(tick, 1000); }, []);
// good
useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
```

### REACT-005 — Missing or unstable list keys

- **severity**: minor
- **status**: active
- **applies-to**: rendering arrays
- **look-for**: `.map(...)` returning elements without `key`, keys from array index on lists that can be reordered, filtered or inserted into, or random keys (`Math.random()`, `crypto.randomUUID()` during render)
- **why**: React reuses the wrong components, so input values and local state jump between rows
- **fix**: use a stable unique id from the data
- **sources**: https://www.patterns.dev/react

```tsx
// bad
{items.map((item, i) => <Row key={i} item={item} />)}
// good
{items.map((item) => <Row key={item.id} item={item} />)}
```

### REACT-006 — State mutated directly

- **severity**: major
- **status**: active
- **applies-to**: `useState`, `useReducer`, external stores
- **look-for**: `state.push(...)`, `state.x = ...`, `sort()` / `splice()` on state arrays, then calling the setter with the same object
- **why**: React compares by reference, so the UI does not update or updates unpredictably
- **fix**: create new arrays and objects (`[...items, x]`, `{ ...obj, x }`, `toSorted`)
- **sources**: https://www.patterns.dev/react

```tsx
// bad
items.push(newItem); setItems(items);
// good
setItems((prev) => [...prev, newItem]);
```

### REACT-007 — Hook called conditionally

- **severity**: blocker
- **status**: active
- **applies-to**: hooks
- **look-for**: hooks called inside `if`, loops, after an early `return`, inside callbacks, or from non-component functions
- **why**: breaks the rules of hooks; state gets attached to the wrong hook and the app crashes or misbehaves
- **fix**: call hooks unconditionally at the top level of the component or custom hook; branch inside them
- **sources**: https://www.patterns.dev/react/hooks-pattern

```tsx
// bad
if (!user) return null;
const [tab, setTab] = useState('info');
// good
const [tab, setTab] = useState('info');
if (!user) return null;
```

### REACT-008 — Component defined inside another component

- **severity**: major
- **status**: active
- **applies-to**: component declarations
- **look-for**: a function returning JSX declared inside another component's body and used as `<Inner />`
- **why**: a new component type is created on every render, so it remounts, loses state and focus, and re-runs effects
- **fix**: move it to module level and pass what it needs as props
- **sources**: https://www.patterns.dev/react

```tsx
// bad
function List({ items }) { const Item = ({ it }) => <li>{it.name}</li>; return <ul>{items.map((it) => <Item key={it.id} it={it} />)}</ul>; }
// good
const Item = ({ it }) => <li>{it.name}</li>;
function List({ items }) { return <ul>{items.map((it) => <Item key={it.id} it={it} />)}</ul>; }
```

### REACT-009 — Props drilled through many layers

- **severity**: suggestion
- **status**: active
- **applies-to**: component trees
- **look-for**: a prop passed through three or more components that do not use it themselves
- **why**: intermediate components change for unrelated reasons and become hard to reuse
- **fix**: use composition (pass children/slots), the compound component pattern, or context for truly shared values
- **sources**: https://www.patterns.dev/react/compound-pattern, https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md

```tsx
// bad
<Page user={user} />  →  <Layout user={user} />  →  <Sidebar user={user} />  →  <Avatar user={user} />
// good
<Layout sidebar={<Sidebar avatar={<Avatar user={user} />} />} />
```

### REACT-010 — Component mixes data fetching, logic and UI

- **severity**: suggestion
- **status**: active
- **applies-to**: components
- **look-for**: a component that grows past ~150 lines or combines fetching, data transformation, business rules and large JSX
- **why**: hard to test and reuse; any change touches everything
- **fix**: move logic into custom hooks and split presentational parts into smaller components
- **sources**: https://www.patterns.dev/react/hooks-pattern, https://www.patterns.dev/react/presentational-container-pattern, https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md

```tsx
// bad
function OrdersPage() { /* 200 lines: fetch, filter, sort, totals, table, modals */ }
// good
function OrdersPage() { const orders = useOrders(filters); return <OrdersTable orders={orders} onOpen={openOrder} />; }
```

### REACT-011 — Server data fetched by hand in effects

- **severity**: minor
- **status**: active
- **applies-to**: data fetching
- **look-for**: `useEffect` + `useState` pairs that fetch API data inside components, with hand-written loading/error flags, in a project that has (or should have) a data-fetching layer
- **why**: no caching, deduplication, race-condition handling or retries; the same request logic is copied everywhere
- **fix**: put API calls in the API layer and use the project's query library (e.g. TanStack Query) through a hook
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md, https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md

```tsx
// bad
useEffect(() => { setLoading(true); fetch(`/api/users/${id}`).then((r) => r.json()).then(setUser).finally(() => setLoading(false)); }, [id]);
// good
const { data: user, isPending } = useUser(id); // useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) })
```

### REACT-012 — Import across feature boundaries

- **severity**: minor
- **status**: active
- **applies-to**: imports in feature-based projects
- **look-for**: `features/a/...` importing internal files from `features/b/...`, or shared code (`components/`, `lib/`) importing from a feature
- **why**: features become entangled, so one cannot change or be removed without breaking others
- **fix**: compose features at the app/route level; move truly shared code to shared folders; import only a feature's public API
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md

```tsx
// bad (in features/comments/)
import { DiscussionCard } from '@/features/discussions/components/discussion-card';
// good (in app/routes/discussion.tsx)
<DiscussionView discussionId={id} comments={<CommentsList discussionId={id} />} />
```

### REACT-013 — Global store used for local or server state

- **severity**: suggestion
- **status**: active
- **applies-to**: Redux, Zustand, context stores
- **look-for**: form input, modal open flags or fetched API data put into a global store when only one component tree uses it
- **why**: every update touches global state, causes broad re-renders and duplicates the server cache
- **fix**: keep UI state local (`useState`, lifted to the nearest common parent), server state in the query cache, and only truly global state in the store
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md

```tsx
// bad
dispatch(setNewCommentText(e.target.value));
// good
const [text, setText] = useState('');
```

### REACT-014 — Props copied into state

- **severity**: minor
- **status**: active
- **applies-to**: `useState` initialisers
- **look-for**: `useState(props.something)` where the component should keep following later prop changes
- **why**: state keeps the first value and ignores updates, showing stale data
- **fix**: use the prop directly; if a reset is intended, give the component a `key` or name the prop `initialX`
- **sources**: https://react.dev/learn/you-might-not-need-an-effect

```tsx
// bad
function Price({ amount }) { const [value] = useState(amount); return <span>{value}</span>; }
// good
function Price({ amount }) { return <span>{amount}</span>; }
```

### REACT-015 — dangerouslySetInnerHTML with untrusted content

- **severity**: blocker
- **status**: active
- **applies-to**: JSX
- **look-for**: `dangerouslySetInnerHTML` with user, CMS or API content that is not sanitised
- **why**: cross-site scripting
- **fix**: render text normally, or sanitise with a vetted library (e.g. DOMPurify) right before rendering
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/security.md

```tsx
// bad
<div dangerouslySetInnerHTML={{ __html: comment.body }} />
// good
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body) }} />
```

### REACT-016 — Auth token stored in localStorage

- **severity**: major
- **status**: active
- **applies-to**: authentication code
- **look-for**: access or refresh tokens written to `localStorage` / `sessionStorage` or kept in readable cookies set from JavaScript
- **why**: any XSS can read and steal the token
- **fix**: prefer `HttpOnly`, `Secure`, `SameSite` cookies set by the server; keep short-lived tokens in memory if needed
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/security.md

```tsx
// bad
localStorage.setItem('token', res.accessToken);
// good
// server sets: Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

### REACT-017 — Inaccessible interactive element

- **severity**: minor
- **status**: active
- **applies-to**: JSX markup
- **look-for**: `onClick` on `div`/`span` without role and keyboard support, images without `alt`, inputs without a label, icon-only buttons without `aria-label`
- **why**: keyboard and screen-reader users cannot use the feature
- **fix**: use semantic elements (`button`, `a`, `label`), add `alt` text and accessible names
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md

```tsx
// bad
<div onClick={remove}><TrashIcon /></div>
// good
<button type="button" onClick={remove} aria-label="Remove item"><TrashIcon aria-hidden /></button>
```

### REACT-018 — New object or function props break memoised children

- **severity**: suggestion
- **status**: active
- **applies-to**: props passed to `memo` components or hook dependency arrays
- **look-for**: inline objects, arrays or arrow functions passed to a `React.memo` child or used as hook dependencies, in a component that re-renders often
- **why**: a new reference each render defeats memoisation and re-runs effects
- **fix**: hoist constants out of the component, or wrap with `useMemo` / `useCallback` where it matters
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/performance.md

```tsx
// bad
<Chart options={{ animate: true }} onSelect={(p) => select(p.id)} />
// good
const CHART_OPTIONS = { animate: true };
const onSelect = useCallback((p) => select(p.id), [select]);
<Chart options={CHART_OPTIONS} onSelect={onSelect} />
```

### REACT-019 — Input switches between controlled and uncontrolled

- **severity**: minor
- **status**: active
- **applies-to**: form inputs
- **look-for**: `value={x}` where `x` can be `undefined` or `null`, or both `value` and `defaultValue` on the same input
- **why**: React warns and the field stops reflecting state correctly
- **fix**: always pass a defined value (`value={x ?? ''}`) or use an uncontrolled input with `defaultValue`
- **sources**: https://www.patterns.dev/react

```tsx
// bad
<input value={user.nickname} onChange={onChange} />
// good
<input value={user.nickname ?? ''} onChange={onChange} />
```

### REACT-020 — Feature has no error boundary

- **severity**: suggestion
- **status**: active
- **applies-to**: routes, feature roots
- **look-for**: a new route or major feature area that renders data-dependent UI with no error boundary around it
- **why**: one rendering error blanks the whole app instead of only the broken part
- **fix**: wrap the feature (or route) in an error boundary with a useful fallback
- **sources**: https://github.com/alan2207/bulletproof-react/blob/master/docs/error-handling.md

```tsx
// bad
<Route path="/reports" element={<ReportsPage />} />
// good
<Route path="/reports" element={<ErrorBoundary fallback={<ReportsError />}><ReportsPage /></ErrorBoundary>} />
```
