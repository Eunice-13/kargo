import { createHmac } from "node:crypto";
import { identity } from "../../scripts/local-staging/isolation.mjs";
import { networkName } from "../../scripts/local-staging/container-safety.mjs";
export const testSecret = "synthetic-local-test-secret-not-a-real-credential";
export function token(payload) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", testSecret).update(`${head}.${body}`).digest("base64url")}`;
}
export const localKey = token({ iss: "supabase-demo", role: "anon", exp: 9999999999 });
export function runtimeFixture() {
  const env = {
    SUPABASE_URL: "http://kong:8000",
    SUPABASE_ANON_KEY: localKey,
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@db:5432/postgres",
    SUPABASE_INTERNAL_PUBLISHABLE_KEY: "synthetic-publishable",
    SUPABASE_INTERNAL_SECRET_KEY: "synthetic-secret",
    SUPABASE_INTERNAL_JWT_SECRET: "synthetic-internal",
    SUPABASE_JWKS: '{"keys":[]}',
    SUPABASE_INTERNAL_HOST_PORT: "56421",
    SUPABASE_INTERNAL_FUNCTIONS_CONFIG: "{}",
  };
  const containers = ["db", "auth", "edge_runtime"].map((service) => ({
    Id: `synthetic-${service}`,
    Name: `/supabase_${service}_${identity}`,
    State: { Running: true, Health: { Status: "healthy" } },
    HostConfig: { NetworkMode: networkName },
    NetworkSettings: {
      Networks: { [networkName]: {} },
      Ports: service === "db" ? { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "56422" }] } : {},
    },
    Config: {
      Env:
        service === "edge_runtime"
          ? Object.entries(env).map(([k, v]) => `${k}=${v}`)
          : service === "auth"
            ? [`GOTRUE_JWT_SECRET=${testSecret}`]
            : [],
    },
    Mounts: [],
  }));
  return {
    containers,
    network: {
      Name: networkName,
      Options: { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" },
      Labels: { "kargo.environment": "local-staging" },
    },
    verifiedAt: new Date().toISOString(),
  };
}
