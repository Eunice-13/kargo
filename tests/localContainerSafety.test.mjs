import test from "node:test";
import assert from "node:assert/strict";
import { verifyContainers, networkName } from "../scripts/local-staging/container-safety.mjs";
const network = () => ({
  Name: networkName,
  Options: { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" },
  Labels: { "kargo.environment": "local-staging" },
});
const containers = () =>
  ["db", "kong"].map((name) => ({
    Id: `synthetic-${name}`,
    Name: `/supabase_${name}_kargo-local-staging`,
    State: { Running: true },
    HostConfig: { NetworkMode: networkName },
    NetworkSettings: {
      Networks: { [networkName]: {} },
      Ports: name === "db" ? { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "56422" }] } : {},
    },
    Config: { Env: [] },
    Mounts: [],
  }));
test("accepts identified loopback-only local containers", () =>
  assert.equal(verifyContainers(containers(), network()).containers, 2));
for (const [name, mutate] of [
  [
    "public binding",
    (c) => {
      c[0].NetworkSettings.Ports["5432/tcp"][0].HostIp = "0.0.0.0";
    },
  ],
  [
    "wrong database port",
    (c) => {
      c[0].NetworkSettings.Ports["5432/tcp"][0].HostPort = "54322";
    },
  ],
  [
    "hosted upstream",
    (c) => {
      c[1].Config.Env = ["SUPABASE_URL=https://leylmztbknmlwnwgvaud.supabase.co"];
    },
  ],
  [
    "unrelated volume",
    (c) => {
      c[0].Mounts = [{ Type: "volume", Name: "production" }];
    },
  ],
  [
    "privileged container",
    (c) => {
      c[0].HostConfig.Privileged = true;
    },
  ],
  [
    "stopped database",
    (c) => {
      c[0].State.Running = false;
    },
  ],
])
  test(`rejects ${name}`, () => {
    const c = containers();
    mutate(c);
    assert.throws(() => verifyContainers(c, network()));
  });
