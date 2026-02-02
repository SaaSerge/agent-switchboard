import type { CapabilityPlugin, PluginRegistry as IPluginRegistry } from "./types";

class PluginRegistryImpl implements IPluginRegistry {
  private plugins: Map<string, CapabilityPlugin> = new Map();

  register(plugin: CapabilityPlugin): void {
    if (this.plugins.has(plugin.capabilityType)) {
      console.warn(`Plugin for capability type '${plugin.capabilityType}' already registered. Skipping.`);
      return;
    }
    this.plugins.set(plugin.capabilityType, plugin);
    console.log(`[plugins] Registered plugin: ${plugin.displayName} v${plugin.version} (${plugin.capabilityType})`);
  }

  getPlugin(type: string): CapabilityPlugin | undefined {
    return this.plugins.get(type);
  }

  getAllPlugins(): CapabilityPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginTypes(): string[] {
    return Array.from(this.plugins.keys());
  }
}

export const pluginRegistry = new PluginRegistryImpl();

export async function initializePlugins(): Promise<void> {
  try {
    const { filesystemPlugin } = await import("./builtin/filesystem");
    pluginRegistry.register(filesystemPlugin);
  } catch (e) {
    console.error("[plugins] Failed to load filesystem plugin:", (e as Error).message);
  }

  try {
    const { shellPlugin } = await import("./builtin/shell");
    pluginRegistry.register(shellPlugin);
  } catch (e) {
    console.error("[plugins] Failed to load shell plugin:", (e as Error).message);
  }

  try {
    const { networkPlugin } = await import("./builtin/network");
    pluginRegistry.register(networkPlugin);
  } catch (e) {
    console.error("[plugins] Failed to load network plugin:", (e as Error).message);
  }

  try {
    const { echoPlugin } = await import("./builtin/echo");
    pluginRegistry.register(echoPlugin);
  } catch (e) {
    console.error("[plugins] Failed to load echo plugin:", (e as Error).message);
  }
}
