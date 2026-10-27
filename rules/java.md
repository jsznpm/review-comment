---
language: java
prefix: JAVA
version: 1.0.0
---

# Java Review Rules

Rules for `.java` files. Written in this project's own words; follow the source links for the
full background.

### JAVA-001 — Resource not closed

- **severity**: major
- **status**: active
- **applies-to**: `AutoCloseable` resources (streams, readers, connections, statements, result sets)
- **look-for**: a resource opened without try-with-resources, or closed only on the success path
- **why**: exceptions skip the `close()` call and leak file handles or pooled connections
- **fix**: use try-with-resources
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
BufferedReader r = new BufferedReader(new FileReader(path));
String first = r.readLine();
r.close();
// good
try (BufferedReader r = Files.newBufferedReader(path)) {
    return r.readLine();
}
```

### JAVA-002 — Returning null for "not found"

- **severity**: minor
- **status**: active
- **applies-to**: public method return values
- **look-for**: new methods that return `null` to mean absence of a value
- **why**: every caller must remember a null check; one missed check becomes a NullPointerException
- **fix**: return `Optional<T>` for single values and an empty collection for lists
- **sources**: https://refactoring.guru/introduce-null-object

```java
// bad
public User findByEmail(String email) { ... return null; }
// good
public Optional<User> findByEmail(String email) { ... return Optional.empty(); }
```

### JAVA-003 — Optional misused

- **severity**: minor
- **status**: active
- **applies-to**: `java.util.Optional`
- **look-for**: `optional.get()` without a presence check, `Optional` used as a field or parameter type, or `Optional.of(x)` where `x` may be null
- **why**: brings the null problem back in another form and adds overhead
- **fix**: use `orElse`, `orElseThrow`, `map`, `ifPresent`; keep `Optional` for return values only
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
String name = repo.findById(id).get().getName();
// good
String name = repo.findById(id).map(User::getName).orElseThrow(() -> new UserNotFound(id));
```

### JAVA-004 — equals without hashCode

- **severity**: major
- **status**: active
- **applies-to**: classes overriding `equals` or `hashCode`
- **look-for**: a class that overrides only one of `equals` / `hashCode`, or uses different fields in each
- **why**: objects that are equal land in different buckets, so `HashMap` / `HashSet` lookups fail
- **fix**: override both using the same fields, or use a `record`
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
@Override public boolean equals(Object o) { ... compares id ... }
// good
@Override public boolean equals(Object o) { ... compares id ... }
@Override public int hashCode() { return Objects.hash(id); }
```

### JAVA-005 — Catching Exception or Throwable

- **severity**: major
- **status**: active
- **applies-to**: catch blocks
- **look-for**: `catch (Exception e)` or `catch (Throwable t)` outside a top-level handler, especially when the catch only logs or returns a default
- **why**: hides bugs such as NullPointerException and catches errors the code cannot handle
- **fix**: catch specific exceptions; let the rest reach a central handler
- **sources**: https://refactoring.guru/replace-error-code-with-exception

```java
// bad
try { gateway.charge(order); } catch (Exception e) { log.warn("charge failed"); }
// good
try { gateway.charge(order); } catch (PaymentDeclinedException e) { order.markDeclined(e.reason()); }
```

### JAVA-006 — InterruptedException swallowed

- **severity**: major
- **status**: active
- **applies-to**: code calling `sleep`, `wait`, `join`, blocking queues, futures
- **look-for**: a catch of `InterruptedException` that neither rethrows nor calls `Thread.currentThread().interrupt()`
- **why**: the thread loses its interrupt flag, so shutdowns and cancellations hang
- **fix**: restore the flag with `Thread.currentThread().interrupt()` and stop the work, or propagate the exception
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
try { Thread.sleep(1000); } catch (InterruptedException e) { }
// good
try { Thread.sleep(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
```

### JAVA-007 — Mutable static state

- **severity**: minor
- **status**: active
- **applies-to**: static fields
- **look-for**: new non-final static fields or static collections modified at runtime
- **why**: shared by all threads and tests; leads to races and order-dependent tests
- **fix**: move state into an instance managed by the container (e.g. a Spring singleton bean) and use thread-safe types
- **sources**: https://refactoring.guru/design-patterns/singleton/java/example

```java
// bad
public static Map<String, User> CACHE = new HashMap<>();
// good
@Component class UserCache { private final Map<String, User> users = new ConcurrentHashMap<>(); }
```

### JAVA-008 — Broken lazy singleton

- **severity**: major
- **status**: active
- **applies-to**: hand-written singletons
- **look-for**: lazy initialisation with `if (instance == null) instance = new X()` without synchronisation, or double-checked locking without `volatile`
- **why**: two threads can create two instances or see a half-built object
- **fix**: use an enum singleton, the holder-class idiom, or let the DI container manage the lifetime
- **sources**: https://refactoring.guru/design-patterns/singleton/java/example

```java
// bad
private static Config instance;
public static Config get() { if (instance == null) instance = new Config(); return instance; }
// good
private static class Holder { static final Config INSTANCE = new Config(); }
public static Config get() { return Holder.INSTANCE; }
```

### JAVA-009 — Telescoping constructors

- **severity**: suggestion
- **status**: active
- **applies-to**: constructors
- **look-for**: several overloaded constructors forwarding to each other, or one constructor with many parameters of the same type
- **why**: call sites are unreadable and arguments are easy to swap
- **fix**: use a builder (or a record plus static factory methods for common variants)
- **sources**: https://refactoring.guru/design-patterns/builder/java/example

```java
// bad
new Pizza(30, true, false, true, false);
// good
Pizza.builder().size(30).cheese().pepperoni().build();
```

### JAVA-010 — instanceof chain selecting behaviour

- **severity**: suggestion
- **status**: active
- **applies-to**: if-else chains, switch on types
- **look-for**: a new branch added to a chain of `instanceof` checks or a switch on a type code that decides what to do
- **why**: every new subtype requires editing every chain; easy to miss one
- **fix**: move the behaviour into the subtypes (polymorphism), a strategy, or a sealed hierarchy with an exhaustive switch
- **sources**: https://refactoring.guru/replace-conditional-with-polymorphism, https://refactoring.guru/design-patterns/strategy/java/example

```java
// bad
if (shape instanceof Circle c) area = PI * c.r() * c.r(); else if (shape instanceof Square s) area = s.a() * s.a();
// good
double area = shape.area();
```

### JAVA-011 — Field injection

- **severity**: minor
- **status**: active
- **applies-to**: Spring / CDI beans
- **look-for**: `@Autowired` or `@Inject` on fields
- **why**: dependencies are hidden, fields cannot be final, and the class cannot be built in a plain unit test
- **fix**: use constructor injection with `final` fields
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
@Autowired private OrderRepository repo;
// good
private final OrderRepository repo;
public OrderService(OrderRepository repo) { this.repo = repo; }
```

### JAVA-012 — Stream with side effects

- **severity**: minor
- **status**: active
- **applies-to**: `java.util.stream`
- **look-for**: `forEach` / `map` / `peek` that modify external collections or state, or parallel streams writing to shared non-thread-safe objects
- **why**: hard to reason about and unsafe in parallel streams
- **fix**: express the result with `collect`, `toList()`, `groupingBy` and similar collectors
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
List<String> names = new ArrayList<>();
users.stream().filter(User::active).forEach(u -> names.add(u.name()));
// good
List<String> names = users.stream().filter(User::active).map(User::name).toList();
```

### JAVA-013 — String compared with ==

- **severity**: major
- **status**: active
- **applies-to**: `String` and boxed types
- **look-for**: `==` or `!=` between `String`, `Integer`, `Long` or other boxed values
- **why**: compares references, so it works for some values (interned, cached) and fails for others
- **fix**: use `equals`, `Objects.equals`, or compare primitives
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
if (status == "ACTIVE") { ... }
// good
if ("ACTIVE".equals(status)) { ... }
```

### JAVA-014 — Getter exposes internal mutable collection

- **severity**: minor
- **status**: active
- **applies-to**: getters returning collections, arrays, dates
- **look-for**: a getter returning a field of type `List`, `Map`, `Set`, array or `Date` directly
- **why**: callers can modify the object's internal state without going through its rules
- **fix**: return an unmodifiable view or copy (`List.copyOf`, `Collections.unmodifiableList`) and add explicit mutator methods
- **sources**: https://refactoring.guru/encapsulate-collection

```java
// bad
public List<Item> getItems() { return items; }
// good
public List<Item> getItems() { return List.copyOf(items); }
```

### JAVA-015 — Money as double or new BigDecimal(double)

- **severity**: major
- **status**: active
- **applies-to**: monetary and exact decimal values
- **look-for**: `double` / `float` used for prices, totals or balances, or `new BigDecimal(0.1)`
- **why**: binary floating point cannot represent most decimal fractions, so totals drift by cents
- **fix**: use `BigDecimal` created from strings or `BigDecimal.valueOf`, with explicit scale and rounding, or a money type
- **sources**: https://refactoring.guru/smells/primitive-obsession

```java
// bad
double total = price * qty;
// good
BigDecimal total = price.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
```

### JAVA-016 — Wrapped exception loses its cause

- **severity**: minor
- **status**: active
- **applies-to**: catch blocks that throw a new exception
- **look-for**: `throw new SomeException(e.getMessage())` or a new exception without passing the caught one as the cause
- **why**: the original stack trace and type are lost, making production failures hard to diagnose
- **fix**: pass the caught exception as the cause: `throw new SomeException("context", e)`
- **sources**: https://refactoring.guru/design-patterns/java

```java
// bad
catch (SQLException e) { throw new RepositoryException(e.getMessage()); }
// good
catch (SQLException e) { throw new RepositoryException("load order " + id, e); }
```
