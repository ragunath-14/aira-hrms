import { randomBytes } from "crypto";

// Video rooms are hosted by Jitsi Meet (free, no account needed). Point
// MEETING_BASE_URL at your own Jitsi server to keep calls in-house.
export function meetingBaseUrl() {
  return (process.env.MEETING_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
}

// Anyone with the link can join the room, so the name is long and random.
export function newRoomName() {
  return `aira-${randomBytes(9).toString("hex")}`;
}

export function joinUrl(room: string) {
  return `${meetingBaseUrl()}/${room}`;
}

// A room can be joined from 10 minutes before the start until it ends.
export function isJoinable(startsAt: Date, durationMinutes: number, now = Date.now()) {
  const start = startsAt.getTime();
  return now >= start - 10 * 60_000 && now <= start + durationMinutes * 60_000;
}
