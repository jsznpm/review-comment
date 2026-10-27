---
language: csharp
prefix: CS
version: 1.0.0
---

# C# Review Rules

Rules for `.cs` files. Written in this project's own words; follow the source links for the
full background.

### CS-001 — Async void method

- **severity**: major
- **status**: active
- **applies-to**: async methods, lambdas
- **look-for**: `async void` methods or lambdas that are not UI/event handlers (`object sender, EventArgs e`)
- **why**: callers cannot await them, and an exception inside crashes the process instead of reaching a catch block
- **fix**: return `Task` (or `ValueTask`); keep `async void` only for event handlers and wrap their body in try/catch
- **sources**: https://medium.com/@dgallivan23/the-10-most-common-c-code-smells-and-how-to-fix-them-6d58e57419aa, https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
public async void SaveOrder(Order o) { await _repo.AddAsync(o); }
// good
public async Task SaveOrderAsync(Order o) { await _repo.AddAsync(o); }
```

### CS-002 — Blocking on async code

- **severity**: major
- **status**: active
- **applies-to**: calls to Task-returning APIs
- **look-for**: `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` on tasks inside code that could be async, especially in ASP.NET request paths
- **why**: blocks a thread-pool thread, hurts throughput and can deadlock under a synchronization context
- **fix**: make the calling chain async and `await` the task ("async all the way")
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
var user = _client.GetUserAsync(id).Result;
// good
var user = await _client.GetUserAsync(id);
```

### CS-003 — CancellationToken not accepted or passed on

- **severity**: minor
- **status**: active
- **applies-to**: async public APIs, controllers, background services
- **look-for**: new async methods doing I/O without a `CancellationToken` parameter, or receiving one but calling async APIs without passing it
- **why**: cancelled requests and shutdowns keep working on abandoned operations, wasting resources
- **fix**: add `CancellationToken cancellationToken = default` and pass it to every awaited call that accepts one
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
public async Task<Order?> FindAsync(int id) => await _db.Orders.FindAsync(id);
// good
public async Task<Order?> FindAsync(int id, CancellationToken ct = default) => await _db.Orders.FindAsync(new object[] { id }, ct);
```

### CS-004 — Disposable object not disposed

- **severity**: major
- **status**: active
- **applies-to**: `IDisposable` / `IAsyncDisposable` instances (streams, connections, readers, timers, `CancellationTokenSource`)
- **look-for**: a disposable created with `new` or a factory and not wrapped in `using` / `await using`, nor owned and disposed by the containing class
- **why**: leaks file handles, sockets and connections until the GC finalizer runs, which may be never under load
- **fix**: use a `using` declaration or block; if a field owns it, implement `IDisposable` on the owner
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
var stream = File.OpenRead(path);
return Parse(stream);
// good
using var stream = File.OpenRead(path);
return Parse(stream);
```

### CS-005 — Catching Exception and continuing

- **severity**: major
- **status**: active
- **applies-to**: try/catch blocks
- **look-for**: `catch (Exception)` or bare `catch` that logs and continues, returns a default, or is empty, outside a top-level handler
- **why**: hides programming errors and unexpected failures, so bugs surface later as corrupted state
- **fix**: catch the specific exception types you can handle; let others propagate to a central handler
- **sources**: https://medium.com/@dgallivan23/the-10-most-common-c-code-smells-and-how-to-fix-them-6d58e57419aa

```csharp
// bad
try { _payments.Charge(order); } catch (Exception) { return false; }
// good
try { _payments.Charge(order); } catch (PaymentDeclinedException ex) { _log.LogWarning(ex, "Declined {Order}", order.Id); return false; }
```

### CS-006 — Rethrow with `throw ex`

- **severity**: minor
- **status**: active
- **applies-to**: catch blocks
- **look-for**: `throw ex;` (or `throw e;`) inside a catch for the same exception variable
- **why**: resets the stack trace, so the original failure location is lost
- **fix**: use `throw;` to rethrow, or wrap with a new exception passing the original as `innerException`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
catch (IOException ex) { _log.LogError(ex, "read failed"); throw ex; }
// good
catch (IOException ex) { _log.LogError(ex, "read failed"); throw; }
```

### CS-007 — Exceptions used for normal control flow

- **severity**: minor
- **status**: active
- **applies-to**: parsing, lookups, validation
- **look-for**: try/catch around `int.Parse`, dictionary indexers, `First()` or similar where failure is an expected outcome
- **why**: exceptions are slow and make the happy path hard to read; expected outcomes should be values
- **fix**: use `TryParse`, `TryGetValue`, `FirstOrDefault` or a result type
- **sources**: https://medium.com/@dgallivan23/the-10-most-common-c-code-smells-and-how-to-fix-them-6d58e57419aa

```csharp
// bad
try { qty = int.Parse(input); } catch (FormatException) { qty = 0; }
// good
if (!int.TryParse(input, out var qty)) qty = 0;
```

### CS-008 — Primitive obsession

- **severity**: suggestion
- **status**: active
- **applies-to**: domain models, method signatures
- **look-for**: ids, money, email addresses, currencies or units passed around as raw `string` / `decimal` / `int`, with the same validation repeated in several places
- **why**: values are easy to swap by mistake (a customer id passed as an order id) and rules are scattered
- **fix**: introduce small value types (`record struct OrderId(Guid Value)`, `Money`) that validate once
- **sources**: https://refactoring.guru/smells/primitive-obsession, https://medium.com/@dgallivan23/the-10-most-common-c-code-smells-and-how-to-fix-them-6d58e57419aa

```csharp
// bad
void Refund(string orderId, decimal amount, string currency) { ... }
// good
void Refund(OrderId orderId, Money amount) { ... }
```

### CS-009 — Growing switch on type or kind

- **severity**: suggestion
- **status**: active
- **applies-to**: switch statements/expressions, if-else chains
- **look-for**: a new `case` added to a switch on an enum, string or type that selects behaviour, when the same switch exists in several places
- **why**: every new kind requires editing all switches; one missed place becomes a bug
- **fix**: move the behaviour into polymorphic classes or a strategy registered per kind
- **sources**: https://refactoring.guru/smells/switch-statements, https://refactoring.guru/design-patterns/strategy/csharp/example

```csharp
// bad
decimal Fee(Shipping s) => s.Kind switch { "dhl" => 5, "ups" => 7, "fedex" => 9, _ => 0 };
// good
interface IShippingFee { decimal For(Shipment s); }   // DhlFee, UpsFee, FedexFee registered in DI
```

### CS-010 — Dependencies created inside the class

- **severity**: minor
- **status**: active
- **applies-to**: services, controllers, handlers
- **look-for**: `new SomeService()`, `new HttpClient()`, static `ServiceLocator.Get<T>()` or `IServiceProvider.GetService` inside business classes
- **why**: hides dependencies, prevents replacing them in tests and bypasses lifetime management
- **fix**: inject an abstraction through the constructor and register it in the DI container
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert, https://refactoring.guru/design-patterns/factory-method/csharp/example

```csharp
// bad
public class OrderService { private readonly EmailSender _mail = new EmailSender(); }
// good
public class OrderService(IEmailSender mail) { private readonly IEmailSender _mail = mail; }
```

### CS-011 — Mutable static state

- **severity**: minor
- **status**: active
- **applies-to**: static fields, hand-written singletons
- **look-for**: new `static` non-readonly fields, static collections that are modified, or a hand-rolled singleton holding state
- **why**: shared across requests and tests, causes race conditions and order-dependent tests
- **fix**: register the type as a singleton in DI and keep state in an instance; use concurrent or immutable types if sharing is required
- **sources**: https://refactoring.guru/design-patterns/singleton/csharp/example

```csharp
// bad
public static class Cache { public static Dictionary<string, User> Users = new(); }
// good
services.AddSingleton<IUserCache, UserCache>();   // UserCache uses ConcurrentDictionary internally
```

### CS-012 — Public mutable fields or setters on domain types

- **severity**: suggestion
- **status**: active
- **applies-to**: entities, value objects, DTOs used inside the domain
- **look-for**: public fields, or public setters on properties that must keep an invariant (status, totals, collections)
- **why**: any code can put the object into an invalid state; invariants spread to callers
- **fix**: use `init` or private setters and methods that enforce the rule; expose collections as `IReadOnlyList<T>`
- **sources**: https://refactoring.guru/encapsulate-field, https://refactoring.guru/encapsulate-collection

```csharp
// bad
public List<OrderLine> Lines { get; set; } = new();
// good
private readonly List<OrderLine> _lines = new();
public IReadOnlyList<OrderLine> Lines => _lines;
public void AddLine(OrderLine line) { ... }
```

### CS-013 — IEnumerable enumerated more than once

- **severity**: minor
- **status**: active
- **applies-to**: LINQ queries, `IEnumerable<T>` parameters
- **look-for**: the same deferred `IEnumerable` used with `Count()`, `Any()`, `foreach` or `ToList()` several times
- **why**: each enumeration re-runs the query (database call, file read, heavy computation) and may return different results
- **fix**: materialise once with `ToList()` / `ToArray()`, or accept `IReadOnlyCollection<T>`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
var active = users.Where(u => u.IsActive);
if (active.Any()) Notify(active.Count(), active);
// good
var active = users.Where(u => u.IsActive).ToList();
if (active.Count > 0) Notify(active.Count, active);
```

### CS-014 — String concatenation in a loop

- **severity**: suggestion
- **status**: active
- **applies-to**: loops building text
- **look-for**: `s += ...` or `s = s + ...` on a string inside a loop with many iterations
- **why**: creates a new string each time, giving quadratic time and memory churn
- **fix**: use `StringBuilder`, `string.Join` or `string.Concat`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
foreach (var l in lines) csv += l.ToCsv() + "\n";
// good
var csv = string.Join("\n", lines.Select(l => l.ToCsv()));
```

### CS-015 — Null-forgiving operator hides a real null

- **severity**: minor
- **status**: active
- **applies-to**: nullable reference types
- **look-for**: new uses of `!` (null-forgiving) or `#nullable disable` to silence warnings on values that can actually be null
- **why**: turns a compile-time warning into a `NullReferenceException` at runtime
- **fix**: handle the null case (guard, `??`, pattern matching) or change the type so it cannot be null
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
var name = user.Profile!.DisplayName!;
// good
var name = user.Profile?.DisplayName ?? user.Email;
```

### CS-016 — N+1 database queries

- **severity**: major
- **status**: active
- **applies-to**: Entity Framework / ORM code
- **look-for**: a query or lazy-loaded navigation property executed inside a loop over results of another query
- **why**: one request turns into hundreds of round-trips and slows down as data grows
- **fix**: load related data in one query with `Include`, a projection (`Select`), or a single `Where(x => ids.Contains(x.Id))`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
foreach (var o in orders) o.Customer = await _db.Customers.FindAsync(o.CustomerId);
// good
var orders = await _db.Orders.Include(o => o.Customer).Where(...).ToListAsync(ct);
```

### CS-017 — HttpClient created per call

- **severity**: major
- **status**: active
- **applies-to**: HTTP calls
- **look-for**: `new HttpClient()` inside a method, often in a `using` block
- **why**: exhausts sockets under load and ignores DNS changes when held forever
- **fix**: inject `HttpClient` via `IHttpClientFactory` / typed clients (`services.AddHttpClient<T>()`)
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
using var http = new HttpClient();
var json = await http.GetStringAsync(url);
// good
public class RatesClient(HttpClient http) { public Task<string> GetAsync() => http.GetStringAsync("rates"); }
```

### CS-018 — Constructor with too many dependencies or parameters

- **severity**: suggestion
- **status**: active
- **applies-to**: constructors
- **look-for**: a constructor that now takes more than about five services, or many optional configuration parameters
- **why**: signals a class with too many responsibilities, or objects that are hard to create correctly
- **fix**: split the class by responsibility; for complex object creation use a builder or an options object
- **sources**: https://refactoring.guru/design-patterns/builder/csharp/example, https://refactoring.guru/smells/large-class

```csharp
// bad
public ReportService(IDb db, IMail mail, ISms sms, IPdf pdf, ICsv csv, IClock clock, ILogger log) { }
// good
public ReportService(IReportData data, IReportExporter exporter, IReportNotifier notifier) { }
```

### CS-019 — Configuration read with magic string keys

- **severity**: suggestion
- **status**: active
- **applies-to**: configuration access
- **look-for**: `_configuration["Section:Key"]` or `GetValue<T>("...")` scattered in business code
- **why**: typos fail silently at runtime and settings are not validated at startup
- **fix**: bind a settings class with the options pattern (`services.Configure<T>()` / `AddOptions<T>().ValidateOnStart()`) and inject `IOptions<T>`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert, https://medium.com/@dgallivan23/the-10-most-common-c-code-smells-and-how-to-fix-them-6d58e57419aa

```csharp
// bad
var limit = int.Parse(_config["Orders:MaxItems"]);
// good
public class OrderOptions { public int MaxItems { get; init; } }   // injected as IOptions<OrderOptions>
```

### CS-020 — Unsafe locking

- **severity**: major
- **status**: active
- **applies-to**: `lock` statements, shared state across threads
- **look-for**: `lock (this)`, `lock (typeof(X))`, locking on a string or public object, or `await` used to wait while holding a lock (via `Monitor`)
- **why**: outside code can take the same lock and deadlock; async code cannot run inside `lock`
- **fix**: lock on a private `readonly object`; for async code use `SemaphoreSlim.WaitAsync`
- **sources**: https://mcpmarket.com/tools/skills/net-c-development-expert

```csharp
// bad
lock (this) { _count++; }
// good
private readonly object _gate = new();
lock (_gate) { _count++; }
```
