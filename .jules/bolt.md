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
