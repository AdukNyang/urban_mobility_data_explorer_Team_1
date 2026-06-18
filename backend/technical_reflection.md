# Reflection and Future Work — Backend & Database

## 5.1 Technical Challenges

### Challenge 1: Aiven Free Tier Storage Limit

The most significant constraint encountered was Aiven's free-tier 5GB
storage cap. The schema was designed to comfortably hold the full 7.28
million cleaned trips, but after loading approximately 1.4 million rows
the database disk usage approached the limit, and Aiven automatically
switched the instance to read-only mode to prevent corruption — any
further `INSERT` failed with a `ReadOnlySqlTransaction` error.

This was resolved by removing a random sample of roughly 470,000 rows to
bring the database back under the limit, restoring write access. The
sample was deliberately random rather than a contiguous date range, so
that the remaining dataset's statistical properties (hourly demand
patterns, fare distributions, zone rankings) stay representative of the
original full dataset. This was treated as an infrastructure constraint
to design around, not a reason to redesign the schema — the table
structure, data types, and indexing strategy remain unchanged and would
scale to the full dataset on a paid tier or self-hosted instance.

### Challenge 2: Undocumented VendorID Value

During the initial bulk load, a foreign key violation revealed that the
cleaned dataset contained `VendorID = 4`, a value not described anywhere
in the official TLC Trip Record User Guide (which only documents 1 and
2). Rather than silently dropping these rows or guessing at a vendor
name, the decision was made to add it to the `vendors` lookup table as
"Unknown Vendor" — preserving the trip records while being transparent
that the vendor identity for these specific rows is not officially
documented.

This highlighted an important lesson: schema design based purely on
official documentation can miss real-world data quality issues that only
surface once actual data is loaded. Validating assumptions against the
real dataset, not just the spec, is necessary before finalizing
constraints.

### Challenge 3: Connection Drops During Bulk Loading

Loading 1.4 million rows in chunks via `psycopg2` initially failed
partway through with `OperationalError: server closed the connection
unexpectedly`. This was caused by Aiven's connection idle/session
timeout being reached during the multi-minute load process.

The fix involved two changes to the loading script: increasing the batch
size from 5,000 to 10,000 rows per `INSERT` to reduce the total number of
round trips to the database, and adding TCP keepalive parameters plus an
automatic reconnect-and-retry mechanism so that if a connection dropped
mid-load, the script would reconnect once and retry the failed chunk
rather than crashing entirely. A resume-from-offset feature was also
added so that if the process did fail completely, the load could
continue from the last successfully inserted row rather than starting
over from zero.

### Challenge 4: Accidental Secret Exposure on GitHub

The `.env` file containing the Aiven database password was committed to
Git before `.gitignore` was properly configured, and GitHub's push
protection blocked the push, flagging the exposed secret. This was
resolved by removing the file from Git tracking, adding `.env` to
`.gitignore`, rewriting Git history to scrub the secret from all previous
commits using `git filter-branch`, and rotating the Aiven database
password as a precaution.

This was a useful reminder that environment files should be excluded
from version control from the very first commit of a project, not added
retroactively.

## 5.2 Team/Process Challenges

Working sequentially — cleaning, then database, then backend, then
frontend — meant that issues discovered late in one stage (such as the
undocumented VendorID, or the storage limit during loading) required
revisiting decisions made earlier without being able to change the
upstream cleaning output, since that stage was already complete and
documented. This reinforced the importance of treating each handoff
point between team members as a checkpoint to verify assumptions, rather
than assuming the previous stage's output requires no further validation.

## 5.3 Suggested Improvements and Next Steps

If this were a real-world production product rather than an academic
assignment, several improvements would be prioritized:

**Upgrade to a paid database tier or self-hosted instance** to remove the
5GB storage constraint entirely and load the full 7.28 million row
dataset rather than a representative sample, since downstream analytics
on the complete dataset would carry more weight for real urban planning
decisions.

**Add database connection pooling** (e.g. via `pgbouncer` or SQLAlchemy's
connection pool) rather than opening a fresh connection per API request,
which would reduce latency and avoid repeatedly hitting Aiven's
connection limits under real user traffic.

**Partition the `trips` table by month** if the dataset were extended
beyond January 2019 to cover a full year or more, since query performance
on a single multi-hundred-million-row table would degrade without
partitioning even with the current indexes in place.

**Add automated data validation tests** that run after each load to
verify row counts, check for unexpected foreign key values (like the
VendorID 4 case), and alert the team automatically rather than relying on
manual discovery during the load process.

**Implement caching at the API layer** (e.g. Redis) for expensive
aggregate queries like the top-10 zones or summary statistics, since
these values do not change between requests and recomputing them from
930,000+ rows on every API call is unnecessary repeated work.