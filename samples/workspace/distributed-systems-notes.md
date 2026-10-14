# Notes on distributed systems consistency

While reviewing our replication layer I keep running into the same problem:
when two services write the same record concurrently, last-writer-wins loses
data silently. The fix people keep recommending is a coordination-free
approach — either detect concurrency with logical clocks, or avoid the
coordination entirely with conflict-free merge semantics.

Vector clocks let two replicas decide whether events happened in order or are
truly concurrent, but they grow with the number of writers. CRDTs sidestep the
question by making merge idempotent, commutative and associative, so replicas
converge without asking anyone for permission.

Open question for this week: can we keep the audit log readable while still
proving that a merge never discarded a legitimate concurrent write?
