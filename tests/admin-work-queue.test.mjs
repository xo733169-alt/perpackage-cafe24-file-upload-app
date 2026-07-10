import test from "node:test";
import assert from "node:assert/strict";

import {
  isPendingReviewFileWorkItem,
  isReuploadReadyForReview,
  isUnlinkedFileWorkItem,
  isWebhookAttentionStatus
} from "../src/lib/admin/admin-work-queue.ts";

test("only active unlinked files are added to the order-link queue", () => {
  assert.equal(isUnlinkedFileWorkItem({ order_id: null, status: "uploaded_pending" }), true);
  assert.equal(isUnlinkedFileWorkItem({ order_id: "20260710-0000001", status: "uploaded_pending" }), false);
  assert.equal(isUnlinkedFileWorkItem({ order_id: null, status: "archived" }), false);
  assert.equal(isUnlinkedFileWorkItem({ order_id: null, status: "replaced" }), false);
});

test("pending review queue requires a linked uploaded_pending file", () => {
  assert.equal(isPendingReviewFileWorkItem({ order_id: "20260710-0000001", status: "uploaded_pending" }), true);
  assert.equal(isPendingReviewFileWorkItem({ order_id: null, status: "uploaded_pending" }), false);
  assert.equal(isPendingReviewFileWorkItem({ order_id: "20260710-0000001", status: "reviewing" }), false);
});

test("reupload review queue requires an uploaded request with a new file", () => {
  assert.equal(isReuploadReadyForReview({ status: "uploaded", new_file_id: "new-file", new_file_status: "uploaded_pending" }), true);
  assert.equal(isReuploadReadyForReview({ status: "uploaded", new_file_id: "new-file", new_file_status: "reviewing" }), true);
  assert.equal(isReuploadReadyForReview({ status: "requested", new_file_id: "new-file", new_file_status: "uploaded_pending" }), false);
  assert.equal(isReuploadReadyForReview({ status: "uploaded", new_file_id: null, new_file_status: "uploaded_pending" }), false);
  assert.equal(isReuploadReadyForReview({ status: "uploaded", new_file_id: "new-file", new_file_status: "approved" }), false);
});

test("only successful webhook outcomes are excluded from attention", () => {
  assert.equal(isWebhookAttentionStatus("auto_linked"), false);
  assert.equal(isWebhookAttentionStatus("already_linked"), false);
  assert.equal(isWebhookAttentionStatus("no_file_id"), true);
  assert.equal(isWebhookAttentionStatus("conflict_order_id"), true);
  assert.equal(isWebhookAttentionStatus("failed"), true);
});
