import assert from "node:assert/strict";
import test from "node:test";

import { authenticateAccessCode, loadServerConfigFromText } from "./workspace-config.ts";

test("parses user accessCode from server yaml", () => {
  const config = loadServerConfigFromText(`
users:
  - id: admin
    username: admin
    accessCode: admin-123
workspaces:
  - id: demo
    name: Demo
    rootPath: ./workspaces/demo
    users: [admin]
`);

  assert.equal(config.users[0].accessCode, "admin-123");
});

test("authenticates matching username and accessCode", () => {
  const config = loadServerConfigFromText(`
users:
  - id: alice
    username: alice
    accessCode: alice-123
`);

  assert.equal(authenticateAccessCode(config, "alice", "alice-123")?.id, "alice");
  assert.equal(authenticateAccessCode(config, "alice", "wrong"), null);
});
