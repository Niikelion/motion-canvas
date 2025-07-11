import {MetaFile} from '../meta';
import {Plugin} from '../plugin';
import DefaultPlugin from '../plugin/DefaultPlugin';
import {Logger} from './Logger';
import {Project, ProjectSettings, Versions} from './Project';
import {ProjectMetadata} from './ProjectMetadata';
import {createSettingsMetadata} from './SettingsMetadata';

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Bootstrap a project.
 *
 * @param name - The name of the project.
 * @param versions - Package versions.
 * @param plugins - Loaded plugins.
 * @param config - Project settings.
 * @param metaFile - The project meta file.
 * @param settingsFile - The settings meta file.
 * @param pluginResolutions - Mapping from the plugin name to the plugin instance.
 * @param logger - An optional logger instance.
 *
 * @internal
 */
export function bootstrap(
  name: string,
  versions: Versions,
  plugins: (Plugin | string)[],
  config: ProjectSettings,
  metaFile: MetaFile<any>,
  settingsFile: MetaFile<any>,
  pluginResolutions: Map<string, Plugin> = new Map<string, Plugin>(),
  logger = config.logger ?? new Logger(),
): Project {
  const settings = createSettingsMetadata();
  settingsFile.attach(settings);

  function resolvePlugin(plugin: Plugin | string): Plugin | undefined {
    if (typeof plugin !== 'string') return plugin;

    const resolvedPlugin = pluginResolutions.get(plugin);
    if (resolvedPlugin) return resolvedPlugin;
  }

  function resolvePluginList(
    plugins: (Plugin | string)[] | undefined,
  ): Plugin[] {
    return plugins?.map(resolvePlugin)?.filter(isDefined) ?? [];
  }

  const allPlugins: Plugin[] = [
    DefaultPlugin(),
    ...resolvePluginList(config.plugins),
    ...resolvePluginList(config.scenes.flatMap(scene => scene.plugins ?? [])),
    ...resolvePluginList(plugins),
  ];

  const pluginSet = new Set<string>();
  const includedPlugins: Plugin[] = [];
  let resolvedConfig = config;

  for (const plugin of allPlugins) {
    if (!plugin || pluginSet.has(plugin.name)) {
      continue;
    }

    pluginSet.add(plugin.name);
    includedPlugins.push(plugin);

    resolvedConfig = {
      ...resolvedConfig,
      ...(plugin.settings?.(resolvedConfig) ?? {}),
    };
  }

  const project = {
    name,
    ...config,
    plugins: includedPlugins,
    versions,
    settings,
    logger,
  } as Project;

  project.meta = new ProjectMetadata(project);
  project.meta.shared.set(settings.defaults.get());
  project.experimentalFeatures ??= false;
  metaFile.attach(project.meta);

  includedPlugins.forEach(plugin => plugin.project?.(project));

  return project;
}

/**
 * Bootstrap a project together with all editor plugins.
 *
 * @param name - The name of the project.
 * @param versions - Package versions.
 * @param plugins - Loaded plugins.
 * @param config - Project settings.
 * @param metaFile - The project meta file.
 * @param settingsFile - The settings meta file.
 *
 * @internal
 */
export async function editorBootstrap(
  name: string,
  versions: Versions,
  plugins: (Plugin | string)[],
  config: ProjectSettings,
  metaFile: MetaFile<any>,
  settingsFile: MetaFile<any>,
): Promise<Project> {
  const logger = config.logger ?? new Logger();
  const pluginResolutions = new Map<string, Plugin>();

  async function resolvePlugin(plugin: Plugin | string) {
    if (typeof plugin !== 'string') return;
    const parsedPlugin = await parsePlugin(plugin, logger);
    if (!parsedPlugin) return;
    pluginResolutions.set(plugin, parsedPlugin);
  }

  async function resolvePluginList(
    plugins: (Plugin | string)[] | undefined,
  ): Promise<void> {
    if (!plugins) return;
    await Promise.all(plugins.map(resolvePlugin));
  }

  await Promise.all([
    resolvePluginList(config.plugins),
    resolvePluginList(config.scenes.flatMap(scene => scene.plugins ?? [])),
    resolvePluginList(plugins),
  ]);

  return bootstrap(
    name,
    versions,
    plugins,
    config,
    metaFile,
    settingsFile,
    pluginResolutions,
    logger,
  );
}

async function parsePlugin(
  plugin: Plugin | string,
  logger: Logger,
): Promise<Plugin | null> {
  if (typeof plugin === 'string') {
    try {
      let url = `/@id/${plugin}`;
      const version = new URL(import.meta.url).searchParams.get('v');
      if (version) {
        url += `?v=${version}`;
      }
      plugin = (await import(/* @vite-ignore */ url)).default() as Plugin;
    } catch (e: any) {
      console.error(e);
      logger.error({
        message: `Failed to load plugin "${plugin}": ${e.message}.`,
        stack: e.stack,
        remarks: e.remarks,
      });
      return null;
    }
  }

  return plugin;
}
