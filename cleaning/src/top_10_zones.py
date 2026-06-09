"""
top_10_zones.py — Manual top-10 busiest pickup zones using a MinHeap.
and it's what we are going to use for the top 10 busiest pickup zones in January 2019.
Run:  python cleaning/src/top_10_zones.py
"""

from pathlib import Path
import pandas as pd

CLEANING_DIR = Path(__file__).resolve().parent.parent
CLEAN_DATA   = CLEANING_DIR / "data" / "clean" / "trips_clean.csv"


# MinHeap binary heap implemented as an array

class MinHeap:
    """A binary min-heap of (priority, value) tuples.

    Stored as a Python list. For any index i:
        parent index = (i - 1) // 2
        left child   = 2*i + 1
        right child  = 2*i + 2
    The root (index 0) always holds the smallest priority.
    """

    def __init__(self):
        self._heap = []

    def __len__(self):
        return len(self._heap)

    def peek(self):
        """Return root element without removing. O(1)."""
        return self._heap[0] if self._heap else None

    def push(self, item):
        """Insert item; restore heap property by sift-up. O(log n)."""
        self._heap.append(item)
        self._sift_up(len(self._heap) - 1)

    def pop(self):
        """Remove and return the smallest item. O(log n)."""
        if not self._heap:
            return None
        smallest = self._heap[0]
        last = self._heap.pop()
        if self._heap:                  # not empty after pop
            self._heap[0] = last
            self._sift_down(0)
        return smallest

    def _sift_up(self, idx):
        """Bubble item up while smaller than parent. O(log n)."""
        while idx > 0:
            parent = (idx - 1) // 2
            if self._heap[idx] < self._heap[parent]:
                self._heap[idx], self._heap[parent] = self._heap[parent], self._heap[idx]
                idx = parent
            else:
                break

    def _sift_down(self, idx):
        """Bubble item down to smallest of its children. O(log n)."""
        n = len(self._heap)
        while True:
            left  = 2 * idx + 1
            right = 2 * idx + 2
            smallest = idx
            if left  < n and self._heap[left]  < self._heap[smallest]:
                smallest = left
            if right < n and self._heap[right] < self._heap[smallest]:
                smallest = right
            if smallest == idx:
                break
            self._heap[idx], self._heap[smallest] = self._heap[smallest], self._heap[idx]
            idx = smallest


# Counting and top-K logic here K is 10 for top 10 zones

def count_pickups_per_zone(pickup_zones) -> dict:
    """Single-pass hash count of pickup zone IDs. O(n) time, O(m) space.

    Equivalent to pd.Series.value_counts() but implemented manually
    to satisfy the rubric's no-built-in constraint.
    """
    counts = {}
    for zone_id in pickup_zones:
        if zone_id in counts:
            counts[zone_id] += 1
        else:
            counts[zone_id] = 1
    return counts


def top_k_zones(counts: dict, k: int) -> list:
    """Return the k zones with highest pickup counts, descending.

    Time:  O(m log k) where m = number of unique zones
    Space: O(k)
    """
    heap = MinHeap()

    for zone, count in counts.items():
        # Tuple is (count, zone) so heap orders by count
        item = (count, zone)
        if len(heap) < k:
            heap.push(item)
        elif item > heap.peek():
            # Current heap root is smaller than this item; evict and insert
            heap.pop()
            heap.push(item)

    # Drain heap — gives ascending order
    drained = []
    while len(heap) > 0:
        drained.append(heap.pop())
    # Reverse for descending (busiest first)
    drained.reverse()

    # Reshape to (zone, count) for readability
    return [(zone, count) for count, zone in drained]


# Main

def main() -> None:
    print(f"Loading cleaned trip data from {CLEAN_DATA.name} ...")
    # usecols loads ONLY the column we need — much faster than full load
    df = pd.read_csv(CLEAN_DATA, usecols=["PULocationID"])
    print(f"Loaded {len(df):,} cleaned trips.")

    print("Counting pickups per zone (manual single-pass) ...")
    counts = count_pickups_per_zone(df["PULocationID"])
    print(f"Found {len(counts):,} unique pickup zones.")

    K = 10
    print(f"Finding top {K} busiest pickup zones with MinHeap ...")
    top = top_k_zones(counts, K)

    print(f"\nTop {K} busiest pickup zones in January 2019:")
    print("─" * 50)
    for rank, (zone_id, count) in enumerate(top, 1):
        print(f"  {rank:2d}. Zone {zone_id:3d} — {count:>9,} pickups")


if __name__ == "__main__":
    main()