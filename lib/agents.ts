export async function loadAgentsConfig() {
  const res = await fetch("/agents_config.json");
  if (!res.ok) throw new Error("Impossible de charger la config agents");
  return res.json();
}
