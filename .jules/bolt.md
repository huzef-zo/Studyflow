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
