import type {
  TimelineDiff,
  TimelineEntry,
  TimelineSnapshot,
} from "./types.js";

export function diffSnapshots(
  earlier: TimelineSnapshot,
  later: TimelineSnapshot,
): TimelineDiff {
  const earlierUrls = new Set(earlier.hits.map((hit) => hit.url));
  const laterUrls = new Set(later.hits.map((hit) => hit.url));

  return {
    earlier,
    later,
    added: later.hits.filter((hit) => !earlierUrls.has(hit.url)),
    persisted: later.hits.filter((hit) => earlierUrls.has(hit.url)),
    dropped: earlier.hits.filter((hit) => !laterUrls.has(hit.url)),
  };
}

export function buildTimeline(snapshots: TimelineSnapshot[]): TimelineEntry[] {
  const ordered = [...snapshots].sort((left, right) =>
    left.asOf.localeCompare(right.asOf),
  );
  const entries = new Map<string, TimelineEntry>();

  for (const snapshot of ordered) {
    for (const hit of snapshot.hits) {
      const existing = entries.get(hit.url);
      if (existing) {
        if (!existing.seenOn.includes(snapshot.asOf)) {
          existing.seenOn.push(snapshot.asOf);
        }
        continue;
      }
      entries.set(hit.url, {
        url: hit.url,
        title: hit.title,
        host: hit.host,
        firstSeen: snapshot.asOf,
        seenOn: [snapshot.asOf],
      });
    }
  }

  return [...entries.values()].sort(
    (left, right) =>
      left.firstSeen.localeCompare(right.firstSeen) ||
      left.host.localeCompare(right.host),
  );
}
