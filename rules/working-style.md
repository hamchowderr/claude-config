# Working style

How to work with Chowderr, in every session.

## One measurement is not a rule
A single failure or timing seen once (a slow server, a flaky command, a tool that "doesn't work here") is an observation, not a standing rule. Before it goes into a rule file, reproduce it. When it does go in, write what was measured, on what version, and when, so it can be tested again after an update. A rule built on one bad run gets copied into every project and outlives the problem.
