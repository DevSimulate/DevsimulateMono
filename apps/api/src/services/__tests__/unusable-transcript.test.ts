import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnusableTranscript } from "../transcript-confidence";

/**
 * These decide whether a recording failure is charged to the candidate. Every
 * case below is taken from a real transcript that scored 0-3/10 and cost
 * someone up to 20 points.
 */

const usable = (s: string) => assert.equal(isUnusableTranscript(s).unusable, false, `expected usable: ${s}`);
const unusable = (s: string) => assert.equal(isUnusableTranscript(s).unusable, true, `expected unusable: ${s}`);

test("Whisper's silence hallucination is not an answer", () => {
  // Real transcript from a candidate whose mic captured nothing. Whisper is
  // trained on captioned video and emits sign-offs when handed silence.
  unusable("Thank you for watching!");
  unusable("Thanks for watching, please subscribe");
  unusable("[Music]");
});

test("a transcript in the wrong script is a recogniser failure, not a bad answer", () => {
  // Real transcript from an Urdu-speaking candidate: Devanagari syllables.
  unusable("पड़पर पड़पर समना पड़पर पड़पर पड़पर पड़पर पड़पर पड़पर पड़पर पड़पर");
});

test("a couple of words after a minute of speaking means the mic dropped", () => {
  unusable("I'll switch.");
  unusable("yes");
  unusable("");
  unusable("   ");
});

test("a short but complete answer is still scored", () => {
  // The guard must not become a way to dodge a bad answer by being brief.
  usable("The coordinates were swapped, longitude was being read as latitude, so every marker mirrored.");
});

test("a clear 'I don't know' is scored as the failing answer it is", () => {
  // Explicitly NOT an equipment failure — this is a real answer that deserves
  // its low score. Confusing the two would let anyone escape a verdict.
  usable("Honestly I do not remember why I made that change, I would have to look at the code again to tell you.");
});

test("technical notation does not make a transcript unusable", () => {
  usable("GeoJSON stores coordinates as [longitude, latitude] but Leaflet expects [latitude, longitude] so I swapped them.");
});

test("the reason explains the failure in plain terms", () => {
  const r = isUnusableTranscript("Thank you for watching!");
  assert.match(r.reason ?? "", /silent/i);
  const s = isUnusableTranscript("ok");
  assert.match(s.reason ?? "", /word/i);
});
