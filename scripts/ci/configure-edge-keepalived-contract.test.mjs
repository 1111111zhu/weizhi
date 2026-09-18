import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const script = fs.readFileSync(path.join(root, "scripts/ci/configure-edge-keepalived.sh"), "utf8");
const template = fs.readFileSync(path.join(root, "deploy/edge-ha/keepalived.conf.template"), "utf8");

test("Keepalived setup is private, unicast, and health tracked", () => {
  assert.match(template, /unicast_src_ip/);
  assert.match(template, /unicast_peer/);
  assert.match(template, /track_script/);
  assert.match(template, /authentication/);
  assert.match(template, /nopreempt/);
  assert.doesNotMatch(template, /0\.0\.0\.0|120\.\d+\.\d+\.\d+/);
});

test("template contains only placeholders rendered by setup", () => {
  const placeholders = [...template.matchAll(/__[A-Z0-9_]+__/g)].map(([value]) => value);
  assert.deepEqual([...new Set(placeholders)].sort(), [
    "__KEEPALIVED_ADVERT_INT__",
    "__KEEPALIVED_AUTH_PASS__",
    "__KEEPALIVED_CHECK_FALL__",
    "__KEEPALIVED_CHECK_INTERVAL__",
    "__KEEPALIVED_CHECK_RISE__",
    "__KEEPALIVED_CHECK_TIMEOUT__",
    "__KEEPALIVED_CHECK_WEIGHT__",
    "__KEEPALIVED_INTERFACE__",
    "__KEEPALIVED_PEER_IP__",
    "__KEEPALIVED_PRIORITY__",
    "__KEEPALIVED_ROUTER_ID__",
    "__KEEPALIVED_SOURCE_IP__",
    "__KEEPALIVED_STATE__",
    "__KEEPALIVED_TRACK_SCRIPT__",
    "__PROJECTWING_HAVIP__",
  ]);
});

test("setup accepts only the two Edge peers and an eight-character VRRP secret", () => {
  assert.match(script, /172\\\.19\\\.143\\\.\(157\|158\)/);
  assert.match(script, /exactly 8 alphanumeric/);
  assert.match(script, /source IP is absent from the selected interface/);
  assert.doesNotMatch(script, /ip -4 address show[^\n]+grep -Fq/);
});

test("configuration is tested before atomic installation and service activation", () => {
  assert.ok(script.indexOf("--config-test") < script.indexOf('install -m 600 "${temporary}" "${config_target}"'));
  assert.ok(script.indexOf("render_config") < script.indexOf("activate"));
  assert.match(script, /systemctl is-active --quiet keepalived\.service/);
  assert.match(script, /\/usr\/local\/libexec\/projectwing\/edge-ha-health\.sh/);
  assert.match(script, /install -d -o root -g root -m 755/);
  assert.doesNotMatch(template, /track_interface/);
  assert.match(template, /timeout __KEEPALIVED_CHECK_TIMEOUT__/);
});

test("bootstrap publishes a non-secret runtime marker for deployment checks", () => {
  assert.match(script, /\/opt\/projectwing\/edge\/keepalived\.env/);
  assert.match(script, /PROJECTWING_HAVIP_ADDRESS=%s/);
  assert.match(script, /chmod 644/);
  assert.doesNotMatch(script, /PROJECTWING_KEEPALIVED_AUTH_PASS=%s/);
});

test("host bootstrap requires swap and persists the shared paging policy", () => {
  assert.match(script, /PROJECTWING_MIN_SWAP_KIB:-4194304/);
  assert.match(script, /\/proc\/swaps/);
  assert.match(script, /99-projectwing-swap\.conf/);
  assert.match(script, /vm\.swappiness=10/);
  assert.ok(script.lastIndexOf("configure_swap_policy") < script.lastIndexOf("install_keepalived"));
});

test("setup artifacts stay within file limits", () => {
  assert.ok(script.split("\n").length <= 300);
  assert.ok(template.split("\n").length <= 300);
});
