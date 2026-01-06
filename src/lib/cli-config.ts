import Conf from "conf";

interface CliConfig {
  destinationWorkspace?: string;
  destinationParentId?: string;
  destinationType?: "workspace" | "parent";
}

const store = new Conf<CliConfig>({
  projectName: "lumifyhub-cli",
  configName: "cli-state",
  defaults: {},
});

export function getCliConfig(): CliConfig {
  return {
    destinationWorkspace: store.get("destinationWorkspace"),
    destinationParentId: store.get("destinationParentId"),
    destinationType: store.get("destinationType"),
  };
}

export function setCliConfig(config: Partial<CliConfig>): void {
  if (config.destinationWorkspace !== undefined) {
    store.set("destinationWorkspace", config.destinationWorkspace);
  }
  if (config.destinationParentId !== undefined) {
    store.set("destinationParentId", config.destinationParentId);
  }
  if (config.destinationType !== undefined) {
    store.set("destinationType", config.destinationType);
  }
}

export function clearCliConfig(): void {
  store.delete("destinationWorkspace");
  store.delete("destinationParentId");
  store.delete("destinationType");
}
