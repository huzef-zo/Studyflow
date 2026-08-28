## 2025-05-02 - [Single-Pass Statistics Optimization]
**Learning:** Consolidating multiple filtered array traversals into a single `forEach` loop with multiple accumulators yields ~60-70% performance gains for dashboard metrics when datasets grow to thousands of items (e.g., 5000+ tasks). Reusing a single `Date` instance per iteration instead of re-instantiating it for timestamp comparisons and date formatting (e.g., in `formatDate`) significantly reduces GC pressure and execution time.
**Action:** Always look for opportunities to compute multiple derived metrics in a single pass over storage arrays and reuse object instances (like `Date`) within hot loops.

## 2026-05-16 - [O(Days) Repeating Task Expansion]
**Learning:** Expanding repeating tasks by iterating through every day for every task ($O(N \times D)$) is a significant bottleneck for long-term analytics. Grouping tasks by day-of-week once and then doing a single pass over the date range ($O(D + \text{Occurrences})$) reduces execution time by >90% for a typical user history (1 year).
**Action:** When mapping entities to a timeline, group entities by their recurrence pattern (e.g., day of week) first, then iterate once through the timeline.

## 2026-05-23 - [Numeric Date Math & Bypassing defensive copies]
**Learning:** While ISO string comparisons (e.g., `t.completedAt.startsWith(todayStr)`) are fast, they often introduce timezone regressions because `toISOString()` is always UTC. Standardizing on `Date.parse()` for numeric timestamp comparisons allows for high performance while maintaining local-time correctness when combined with `reusableDate.setTime()` and `formatDate()`. Additionally, bypassing defensive array copies (like those returned by public getters) when performing internal library-wide aggregations can reduce execution time by an additional 15-20% in high-item environments.
**Action:** Use numeric `getTime()` or `Date.parse()` for range checks to preserve local time logic. Use direct access to raw data (e.g., `loadData`) instead of public getters inside performance-critical aggregation loops to avoid redundant array clones.

## 2026-05-30 - [Calendar Grouping Optimization]
**Learning:** Expanding repeating tasks in the calendar by iterating over every day for every task ((Tasks \times Days)$) is inefficient. Grouping repeating tasks by day-of-week once and then doing a single pass over the month ((Days + \text{Occurrences})$) improves performance by ~40%.
**Action:** Use bucket-based grouping for recurrence patterns before expanding them into a timeline or grid. Always use public APIs (e.g., `Storage.getTasks()`) instead of reaching into module internals for micro-optimizations to maintain architectural safety.

## 2026-06-06 - [Logarithmic Session Retrieval]
**Learning:** For append-only chronological datasets like focus sessions, replacing linear filters ($O(N)$) with binary search ($O(\log N)$) to find start indices yields massive performance gains (e.g., 9ms to 0.01ms for 20k entries). Additionally, refactoring higher-level getters (e.g., `getTodaySessions`) to share this optimized utility ensures these wins propagate through the dashboard and analytics.
**Action:** Implement binary search for any range-based retrieval on sorted datasets. Ensure time-windowed getters (Today/Week) consume the optimized search utility.

## 2026-06-12 - [Multi-Index Optimization for Chronological Data]
**Learning:** In complex aggregations like `getStats` that require multiple time windows (Today/Week/Year), performing multiple binary searches to find all boundary indices *before* entering the loop is significantly faster than calculating timestamps or formatting dates inside the loop. Combining this with ISO string slicing (`.slice(0, 10)`) for date extraction avoids redundant object instantiation and reduced `getStats` execution time by ~81% (12.8ms to 2.4ms for 20k sessions).
**Action:** For multi-window metrics on chronological data, pre-calculate all relevant indices via binary search and use index-based logic inside the loop. Use string slicing for fast date comparisons when data is in ISO format.

## 2026-06-19 - [O(N+M) Subject Mastery Calculation]
**Learning:** Calculating subject mastery stats by iterating through tasks and checking completions using `Object.keys(completions).some()` results in $O(N \times M)$ complexity. Pre-calculating a `Set` of task IDs from completion keys once reduces lookup to $O(1)$ and overall complexity to $O(N + M)$, yielding ~99% performance improvement (760ms to 1.5ms for 2k tasks/5k completions).
**Action:** Always avoid nested loops or hidden traversals (like `some()` on large arrays) inside high-frequency aggregation functions. Use `Set` for fast existence checks.

## 2026-07-03 - [Loop Consolidation & Allocation Reduction]
**Learning:** Consolidating 'taskIds' Set creation into the main task loop and using 'for...in' loops (with 'hasOwnProperty' checks) instead of 'Object.keys().forEach' for large objects like 'repeating_completions' further reduces execution time by ~31% (~3.1ms to ~2.1ms for 20k sessions). String-based activity lookups using 'YYYY-MM-DD' keys remain highly performant when coupled with fast string slicing for date extraction.
**Action:** Consolidate data structure preparation into existing traversals and prefer 'for...in' for object iteration in high-frequency aggregation paths to minimize intermediate array allocations.

## 2026-07-17 - [Date.UTC & Substring parsing for Streak Calculation]
**Learning:** Mutating local `Date` objects via `setFullYear()` and `setHours()` inside hot loops (e.g. `calculateBestStreak`) causes significant timezone translation overhead and memory allocation pressure. Parsing standard `"YYYY-MM-DD"` date strings using static `.substring()` extractions and passing them to `Date.UTC()` avoids timezone lookups entirely and ensures that a day is exactly `86400000` milliseconds, yielding a ~58% (2.4x) speedup.
**Action:** For string-based date comparisons and day-difference math, use static substring parsing and UTC representation (`Date.UTC`) instead of local `Date` object instances and mutating methods.

## 2026-07-24 - [Guaranteed Chronological Sorting & Two-Boundary Binary Search]
**Learning:** Assuming that chronological arrays always remain sorted is dangerous when testing frameworks, manual imports, or data corruption push data out of order, causing binary search algorithm logic to fail. Enforcing sorted data guarantees lexicographically on save operations is extremely lightweight and makes all binary search getters robust. Furthermore, pre-calculating today's end boundary index (`todayEndIndex`) in addition to `todayIndex` using binary search allows checking today's sessions inside a chronological loop with a simple `i >= todayIndex && i < todayEndIndex` comparison, eliminating redundant `Date.parse()` and date validation overhead entirely.
**Action:** Enforce sorted data guarantees during writes when downstream readers rely on binary search. Pre-calculate end boundaries via binary search to completely avoid date parsing within loops.

## 2026-07-31 - [Lexicographical Date/ISO String Sorting]
**Learning:** Parsing date or ISO strings using `new Date()` inside an `Array.prototype.sort` comparator loop creates severe performance bottlenecks and massive GC pressure. For $N$ items, the sort comparator is called $O(N \log N)$ times, repeatedly instantiating and garbage-collecting `Date` objects. Standard `"YYYY-MM-DD"` or ISO-8601 strings are lexicographically sortable, meaning string comparison (e.g. `a < b ? -1 : 1`) is 100% equivalent to date value comparison while running ~16x faster.
**Action:** Never parse standard format date strings (such as YYYY-MM-DD or ISO strings) with `new Date()` within sorting comparator callbacks. Use fast, zero-allocation lexicographical string comparison instead.

## 2026-08-07 - [Avoiding Callback Iterations & Date Formatter GC Overhead]
**Learning:** Standard callback-based array iterators such as `forEach` carry function-invocation overhead that becomes prominent in hot paths, such as aggregating over large arrays (e.g., 1000+ tasks in `getStats()`). Traditional `for` loops eliminate this overhead entirely, rendering loop execution ~65% faster. Additionally, in highly nested loops (such as the 365-day back-tracking inside `calculateStreak()`), invoking a general-purpose, validation-heavy date formatter creates excessive string allocation and garbage collection pressure. Creating date string segments inline (`y + '-' + ...`) using local date component getters significantly reduces CPU time and heap memory overhead.
**Action:** Replace `forEach` with traditional `for` loops in hot aggregation paths. Avoid general-purpose validation date formatters inside high-frequency loops; instead format date components inline with a single reusable Date object.

## 2026-08-14 - [Binary Search Range Lookups for Duration Aggregation]
**Learning:** In functions aggregating chronological duration metrics (e.g., `getTotalMinutesToday` and `getTotalMinutesWeek`), calling `getSessionsSince` and chaining array `.filter()` and `.reduce()` operations causes unnecessary array slice allocations, repeated `Date` instantiations, and string formatting in hot paths. Using `loadData` directly with binary search (`_findSessionIndex`) to find exact start/end indices and summing durations in a simple `for` loop yields a ~7x performance improvement while eliminating GC allocations.
**Action:** For chronological window aggregation, always locate start and end boundaries using binary search and sum metrics with a direct indexed `for` loop over the raw array.

## 2026-08-21 - [Time-Bounded Binary Search for UI Daily Progress]
**Learning:** UI modules displaying daily or weekly progress (like `Goals.renderDailyProgress()`) often fall into the trap of querying all historical records via `Storage.getSessions()` and scanning tens of thousands of past sessions with `new Date()` allocations and date formatting inside `.forEach()` callbacks. Leveraging `Storage.getSessionsSince(weekStartStr)` via binary search reduces search space from $O(N)$ to $O(\log N)$ and limits processing to only current-week sessions, yielding a ~24x speedup (15.6ms down to 0.6ms) when paired with string slicing (`.slice(0, 10)`) and indexed `for` loops.
**Action:** Never retrieve full historical arrays in view-layer progress renderers; scope data queries to the active time window using binary search utilities and extract ISO date keys with string slicing.

## 2026-08-28 - [Targeted Item Lookup vs Full Collection Mapping]
**Learning:** Calling high-level list getters (like `Storage.getTasks()`) inside single-item lookups (such as `Storage.getTaskById()`) creates severe unnecessary overhead when `getTasks()` transforms or resolves state across every item in storage (e.g. resolving repeating task completions for all tasks). Querying raw storage via `loadData` and matching the specific target ID *before* performing item-specific dynamic resolutions reduces lookup execution time by ~91% (~11.5x speedup).
**Action:** In single-entity lookup methods, perform the identity search on raw collection data before executing any expensive item-level dynamic state resolutions.
