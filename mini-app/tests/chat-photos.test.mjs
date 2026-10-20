import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChatPhotos, chatBody } from "../src/shared/api/chat-photos.ts";
import { planReturn } from "../src/shared/api/plan-return.ts";

test("plan returns to originating apartment chat and rejects external or malformed destinations", () => {
  assert.deepEqual(planReturn("/messages/15"), { href: "/messages/15", label: "В чат с квартирой 15" });
  for (const value of [undefined, ["/messages/1"], "//example.com", "https://example.com", "/messages/0", "/messages/1?next=/", "/messages/999999999999999999"]) {
    assert.equal(planReturn(value).href, "/house");
  }
});

test("chat photos accept only private API paths and preserve old text-only messages", () => {
  assert.deepEqual(parseChatPhotos(undefined), []);
  assert.deepEqual(parseChatPhotos([{ id: 1, url: "/api/v1/chat-photos/1" }]), [{ id: 1, url: "/api/v1/chat-photos/1" }]);
  for (const value of [null, {}, [{ id: 0, url: "/api/v1/chat-photos/1" }], [{ id: 1, url: "https://example.com/private" }]]) {
    assert.throws(() => parseChatPhotos(value));
  }
});

test("multipart keeps request ID and ordered files including a photo-only message", () => {
  const data = { text: "", request_id: "retry-key" };
  const file = new File(["photo"], "test.png", { type: "image/png" });
  assert.equal(chatBody(data, []), data);
  const form = chatBody(data, [{ id: "draft-1", file }]);
  assert.ok(form instanceof FormData);
  assert.deepEqual(JSON.parse(form.get("data")), data);
  assert.equal(form.get("photos").name, "test.png");
});
