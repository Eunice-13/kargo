import { identity } from "./isolation.mjs";

export const networkName = "kargo-local-staging-loopback";

export function verifyContainers(containers, network) {
  if (
    network.Name !== networkName ||
    network.Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1" ||
    network.Labels?.["kargo.environment"] !== "local-staging"
  ) {
    throw new Error("Local network isolation rejected.");
  }
  const db = containers.find((c) => c.Name === `/supabase_db_${identity}`);
  if (!db || containers.length < 2) throw new Error("Local services are not ready.");
  for (const c of containers) {
    if (
      !c.Id ||
      !c.Name.endsWith(`_${identity}`) ||
      !c.State?.Running ||
      c.HostConfig?.Privileged ||
      c.HostConfig?.NetworkMode === "host" ||
      !c.NetworkSettings?.Networks?.[networkName]
    )
      throw new Error("Unexpected local container identity or state.");
    for (const bindings of Object.values(c.NetworkSettings.Ports ?? {})) {
      for (const binding of bindings ?? []) {
        if (binding.HostIp !== "127.0.0.1")
          throw new Error("Non-loopback published port rejected.");
      }
    }
    if (
      (c.Config?.Env ?? []).some((e) =>
        /leylmztbknmlwnwgvaud|https?:\/\/[^\s]*\.supabase\.co|postgres(?:ql)?:\/\/[^\s]*\.supabase\.com/i.test(
          e,
        ),
      )
    )
      throw new Error("Hosted Supabase upstream rejected.");
    for (const mount of c.Mounts ?? []) {
      if (mount.Type === "volume" && !mount.Name?.includes(identity))
        throw new Error("Unrelated volume rejected.");
    }
  }
  const dbBindings = db.NetworkSettings.Ports?.["5432/tcp"] ?? [];
  if (!dbBindings.some((b) => b.HostIp === "127.0.0.1" && b.HostPort === "56422"))
    throw new Error("Local database port identity rejected.");
  return { databaseContainer: db.Id, projectId: identity, containers: containers.length };
}
