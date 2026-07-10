import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllowedFileStatusTransitions,
  isFileStatusTransitionAllowed
} from "../src/lib/files/file-status.ts";
import { getFileOrderLinkDecision } from "../src/lib/files/file-order-link-policy.ts";
import { isActiveReuploadRequest } from "../src/lib/files/reupload-request-policy.ts";
import {
  getFileOrderRpcErrorKind,
  getFileStatusRpcErrorKind
} from "../src/lib/files/file-admin-rpc-policy.ts";

test("an unlinked file can be linked and the same order is idempotent", () => {
  assert.equal(getFileOrderLinkDecision(null, "20260710-0000001"), "link");
  assert.equal(getFileOrderLinkDecision("20260710-0000001", "20260710-0000001"), "same");
});

test("an existing different order cannot be overwritten", () => {
  assert.equal(getFileOrderLinkDecision("20260710-0000001", "20260710-0000002"), "conflict");
});

test("file status only follows the approved workflow", () => {
  assert.equal(isFileStatusTransitionAllowed("uploaded_pending", "reviewing"), true);
  assert.equal(isFileStatusTransitionAllowed("reviewing", "approved"), true);
  assert.equal(isFileStatusTransitionAllowed("need_reupload", "replaced"), true);
  assert.equal(isFileStatusTransitionAllowed("replaced", "approved"), false);
  assert.equal(isFileStatusTransitionAllowed("archived", "reviewing"), false);
  assert.deepEqual(getAllowedFileStatusTransitions("archived"), []);
});

test("selecting the current status is an allowed no-op", () => {
  assert.equal(isFileStatusTransitionAllowed("approved", "approved"), true);
});

test("only an unused, unexpired requested reupload is active", () => {
  const now = Date.parse("2026-07-10T00:00:00.000Z");
  const activeRequest = {
    status: "requested",
    expires_at: "2026-07-11T00:00:00.000Z",
    used_at: null,
    new_file_id: null
  };

  assert.equal(isActiveReuploadRequest(activeRequest, now), true);
  assert.equal(isActiveReuploadRequest({ ...activeRequest, status: "uploaded" }, now), false);
  assert.equal(isActiveReuploadRequest({ ...activeRequest, used_at: "2026-07-10T01:00:00.000Z" }, now), false);
  assert.equal(isActiveReuploadRequest({ ...activeRequest, new_file_id: "new-file" }, now), false);
  assert.equal(isActiveReuploadRequest({ ...activeRequest, expires_at: "2026-07-09T00:00:00.000Z" }, now), false);
});

test("database status RPC errors map to the existing admin conflict states", () => {
  assert.equal(getFileStatusRpcErrorKind("file_status_file_not_found"), "not_found");
  assert.equal(getFileStatusRpcErrorKind("RPC failed: file_status_conflict"), "conflict");
  assert.equal(getFileStatusRpcErrorKind("file_status_transition_not_allowed"), "transition");
  assert.equal(getFileStatusRpcErrorKind("unexpected"), "unknown");
});

test("database order-link RPC errors preserve no-overwrite handling", () => {
  assert.equal(getFileOrderRpcErrorKind("file_order_file_not_found"), "not_found");
  assert.equal(getFileOrderRpcErrorKind("RPC failed: file_order_conflict"), "conflict");
  assert.equal(getFileOrderRpcErrorKind("unexpected"), "unknown");
});
