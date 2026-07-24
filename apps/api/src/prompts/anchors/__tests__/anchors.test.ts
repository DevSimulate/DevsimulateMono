import { test } from "node:test";
import assert from "node:assert/strict";
import { CALIBRATION, calibrationBlock, liveAnchors, hasLiveAnchors } from "../index";

test("every dimension declares bands covering its full range", () => {
  for (const dim of CALIBRATION) {
    assert.ok(dim.bands.length >= 4, `${dim.label} should have 4 bands, has ${dim.bands.length}`);

    const bounds = dim.bands.map((b) => b.band.split("-").map(Number));
    const top = Math.max(...bounds.map(([, hi]) => hi));
    const bottom = Math.min(...bounds.map(([lo]) => lo));
    assert.equal(top, dim.max, `${dim.label} top band must reach ${dim.max}`);
    assert.equal(bottom, 0, `${dim.label} bottom band must start at 0`);
  }
});

test("anchor scores fall inside the band they claim", () => {
  for (const dim of CALIBRATION) {
    for (const a of dim.anchors) {
      const [lo, hi] = a.band.split("-").map(Number);
      assert.ok(
        a.score >= lo && a.score <= hi,
        `${dim.label} anchor scored ${a.score} but claims band ${a.band}`
      );
      assert.ok(a.score <= dim.max, `${dim.label} anchor exceeds max ${dim.max}`);
    }
  }
});

test("placeholder anchors are never rendered into the prompt", () => {
  const block = calibrationBlock();
  assert.ok(!block.includes("TODO"), "placeholder TODO content leaked into the scoring prompt");

  for (const dim of CALIBRATION) {
    for (const a of liveAnchors(dim)) {
      assert.notEqual(a.placeholder, true);
    }
  }
});

test("band descriptors ARE live even while anchors are still placeholders", () => {
  const block = calibrationBlock();
  assert.ok(block.includes("CALIBRATION EXAMPLES"), "heading missing");
  for (const dim of CALIBRATION) {
    assert.ok(block.includes(dim.key), `${dim.key} missing from calibration block`);
    for (const b of dim.bands) {
      assert.ok(block.includes(b.band), `band ${b.band} missing for ${dim.label}`);
    }
  }
});

test("hasLiveAnchors reports false until real excerpts are pasted in", () => {
  // Flips to true once the DevFest excerpts land — at which point RUBRIC_VERSION
  // must be bumped (see config/scoring.ts).
  assert.equal(hasLiveAnchors(), CALIBRATION.some((d) => liveAnchors(d).length > 0));
});
