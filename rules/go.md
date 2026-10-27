---
language: go
prefix: GO
version: 1.0.0
---

# Go Review Rules

Rules for `.go` files. Written in this project's own words; follow the source links for the
full background.

### GO-001 — Error ignored

- **severity**: major
- **status**: active
- **applies-to**: calls returning `error`
- **look-for**: `_ = f()` or `x, _ := f()` discarding an error, or a call whose error result is not checked at all
- **why**: the program continues with invalid data or silently loses writes
- **fix**: check the error and return it with context, or document why it is safe to ignore
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
data, _ := os.ReadFile(path)
// good
data, err := os.ReadFile(path)
if err != nil {
	return fmt.Errorf("read config %s: %w", path, err)
}
```

### GO-002 — Error returned without context or wrapping

- **severity**: minor
- **status**: active
- **applies-to**: error returns
- **look-for**: `return err` many layers deep with no context, or `fmt.Errorf("...: %v", err)` / `errors.New(err.Error())` that drops the original error
- **why**: logs show "file not found" with no idea which operation failed, and `errors.Is` / `errors.As` stop working
- **fix**: wrap with `fmt.Errorf("doing X: %w", err)`
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
return fmt.Errorf("save failed: %v", err)
// good
return fmt.Errorf("save order %d: %w", id, err)
```

### GO-003 — Error compared with == or by string

- **severity**: minor
- **status**: active
- **applies-to**: error handling
- **look-for**: `err == ErrX`, `err.Error() == "..."` or `strings.Contains(err.Error(), ...)`
- **why**: breaks as soon as the error is wrapped, and string matching breaks on message changes
- **fix**: use `errors.Is(err, ErrX)` or `errors.As(err, &target)`
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
if err == sql.ErrNoRows { ... }
// good
if errors.Is(err, sql.ErrNoRows) { ... }
```

### GO-004 — Panic in library code

- **severity**: major
- **status**: active
- **applies-to**: non-main packages
- **look-for**: `panic(...)`, `log.Fatal` or `os.Exit` used for recoverable errors outside `main` or `init` of a binary
- **why**: callers cannot recover or report the error; one bad input stops the whole service
- **fix**: return an `error`; reserve panics for programmer bugs that must never happen
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
func ParsePort(s string) int { p, err := strconv.Atoi(s); if err != nil { panic(err) }; return p }
// good
func ParsePort(s string) (int, error) { return strconv.Atoi(s) }
```

### GO-005 — Context not propagated

- **severity**: minor
- **status**: active
- **applies-to**: request handlers, I/O functions
- **look-for**: `context.Background()` / `context.TODO()` inside code that already has a request context, or new I/O functions without a `ctx context.Context` first parameter
- **why**: cancellations and deadlines do not reach database and HTTP calls, so abandoned requests keep running
- **fix**: accept `ctx context.Context` as the first parameter and pass it down
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
func (s *Store) Get(id int) (*User, error) { return s.db.QueryRowContext(context.Background(), q, id)... }
// good
func (s *Store) Get(ctx context.Context, id int) (*User, error) { return s.db.QueryRowContext(ctx, q, id)... }
```

### GO-006 — Goroutine that can leak

- **severity**: major
- **status**: active
- **applies-to**: `go` statements, channels
- **look-for**: goroutines blocked forever on a channel nobody reads/closes, loops without a `ctx.Done()` exit, or one goroutine started per item with no limit
- **why**: memory and goroutines grow until the process is killed
- **fix**: give every goroutine an exit path (context, done channel, closed channel) and bound concurrency (worker pool, `errgroup.SetLimit`)
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
go func() { for { work(<-jobs) } }()
// good
go func() {
	for {
		select {
		case <-ctx.Done():
			return
		case j := <-jobs:
			work(j)
		}
	}
}()
```

### GO-007 — Data race on shared variable

- **severity**: major
- **status**: active
- **applies-to**: variables used by several goroutines
- **look-for**: maps, slices, counters or struct fields written from goroutines without a mutex, atomic or channel
- **why**: data races corrupt memory, and concurrent map writes crash the program
- **fix**: protect with `sync.Mutex`, use `sync/atomic`, or hand ownership over a channel; run tests with `-race`
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
for _, u := range users { go func(u User) { results[u.ID] = fetch(u) }(u) }
// good
var mu sync.Mutex
for _, u := range users { go func(u User) { r := fetch(u); mu.Lock(); results[u.ID] = r; mu.Unlock() }(u) }
```

### GO-008 — Mutex copied by value

- **severity**: major
- **status**: active
- **applies-to**: types containing `sync.Mutex`, `sync.WaitGroup`, `sync.Once`
- **look-for**: value receivers on methods of such types, or the struct passed/returned by value
- **why**: each copy has its own lock, so nothing is actually protected
- **fix**: use pointer receivers and pass pointers; `go vet` (copylocks) reports this
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
func (c Counter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() }
// good
func (c *Counter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() }
```

### GO-009 — Large interface defined by the producer

- **severity**: suggestion
- **status**: active
- **applies-to**: interface declarations
- **look-for**: a new interface with many methods declared next to its only implementation, or consumers depending on methods they never call
- **why**: makes testing and swapping implementations hard; Go interfaces work best small and owned by the consumer
- **fix**: declare small interfaces (1–3 methods) where they are used; return concrete types
- **sources**: https://refactoring.guru/design-patterns/adapter/go/example, https://refactoring.guru/smells/refused-bequest

```go
// bad
type UserService interface { Create(); Get(); Update(); Delete(); List(); Export(); Import() }
// good (in the package that needs it)
type userGetter interface { Get(ctx context.Context, id int) (*User, error) }
```

### GO-010 — Side effects in init()

- **severity**: minor
- **status**: active
- **applies-to**: `func init()`
- **look-for**: network or database connections, reading files or env-dependent setup, or registering global state in `init`
- **why**: runs on import, cannot return errors, and makes tests and tools that import the package slow or flaky
- **fix**: do setup in an explicit constructor called from `main`
- **sources**: https://refactoring.guru/design-patterns/singleton/go/example

```go
// bad
var db *sql.DB
func init() { db, _ = sql.Open("postgres", os.Getenv("DSN")) }
// good
func NewStore(dsn string) (*Store, error) { db, err := sql.Open("postgres", dsn); ... }
```

### GO-011 — Package-level mutable state

- **severity**: minor
- **status**: active
- **applies-to**: package variables
- **look-for**: new exported or unexported package-level `var` that is modified at runtime (caches, clients, config)
- **why**: hidden coupling between callers, races, and tests that affect each other
- **fix**: put the state in a struct created by a constructor and pass it where needed
- **sources**: https://refactoring.guru/design-patterns/singleton/go/example

```go
// bad
var cache = map[string]Item{}
func Get(k string) Item { return cache[k] }
// good
type Cache struct { mu sync.RWMutex; items map[string]Item }
func NewCache() *Cache { return &Cache{items: map[string]Item{}} }
```

### GO-012 — Constructor with many parameters

- **severity**: suggestion
- **status**: active
- **applies-to**: `New...` functions
- **look-for**: constructors with many positional parameters, several of the same type, or frequent zero values passed for optional settings
- **why**: call sites are unreadable and every new option breaks all callers
- **fix**: use a config struct or functional options (`New(addr string, opts ...Option)`)
- **sources**: https://refactoring.guru/design-patterns/builder/go/example

```go
// bad
srv := NewServer(":8080", 30, 60, true, false, nil)
// good
srv := NewServer(":8080", WithReadTimeout(30*time.Second), WithTLS(cfg))
```

### GO-013 — defer inside a loop

- **severity**: minor
- **status**: active
- **applies-to**: loops
- **look-for**: `defer f.Close()` (or unlock, cancel) inside a `for` loop in a long-running function
- **why**: deferred calls run only when the function returns, so resources pile up for the whole loop
- **fix**: move the loop body into a helper function, or close explicitly at the end of each iteration
- **sources**: https://refactoring.guru/extract-method

```go
// bad
for _, p := range paths { f, _ := os.Open(p); defer f.Close(); process(f) }
// good
for _, p := range paths { if err := processFile(p); err != nil { return err } }
```

### GO-014 — Write to a nil map

- **severity**: major
- **status**: active
- **applies-to**: maps
- **look-for**: a map declared with `var m map[K]V` or a struct field map that is written before `make` or a literal initialises it
- **why**: writing to a nil map panics at runtime
- **fix**: initialise with `make(map[K]V)` or a literal in the constructor
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
var counts map[string]int
counts["a"]++
// good
counts := make(map[string]int)
counts["a"]++
```

### GO-015 — Typed nil returned as error

- **severity**: major
- **status**: active
- **applies-to**: functions returning `error`
- **look-for**: a function returning a concrete error pointer type (e.g. `*MyError`) that may be nil, assigned to or returned as `error`
- **why**: an interface holding a typed nil is not `nil`, so `err != nil` is true even on success
- **fix**: declare the return type as `error` and return a literal `nil` on success
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
func validate() *ValidationError { return nil }
var err error = validate() // err != nil is true
// good
func validate() error { return nil }
```

### GO-016 — HTTP response body not closed

- **severity**: major
- **status**: active
- **applies-to**: `net/http` client calls
- **look-for**: `http.Get`, `client.Do` without `defer resp.Body.Close()` after the error check, or the body not fully read when connections should be reused
- **why**: leaks connections and file descriptors until the process runs out
- **fix**: check the error, then `defer resp.Body.Close()`; drain with `io.Copy(io.Discard, resp.Body)` if not reading it
- **sources**: https://go.dev/wiki/CodeReviewComments, https://refactoring.guru/design-patterns/go

```go
// bad
resp, err := http.Get(url)
if err != nil { return err }
return json.NewDecoder(resp.Body).Decode(&out)
// good
resp, err := http.Get(url)
if err != nil { return err }
defer resp.Body.Close()
return json.NewDecoder(resp.Body).Decode(&out)
```
