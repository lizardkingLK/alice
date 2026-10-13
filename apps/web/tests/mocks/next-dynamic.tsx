import { useSyncExternalStore, type ComponentType } from 'react';

type DynamicLoaderResult =
  | ComponentType<Record<string, unknown>>
  | { default: ComponentType<Record<string, unknown>> };

type Loader = () => Promise<DynamicLoaderResult>;

type LoaderEntry = {
  readonly listeners: Set<() => void>;
  value: ComponentType<Record<string, unknown>> | null;
  started: boolean;
};

const loaderEntries = new WeakMap<Loader, LoaderEntry>();

/**
 * Sync next/dynamic stub for Vitest (re-renders when the loader resolves).
 * Use via: vi.mock('next/dynamic', () => import('../mocks/next-dynamic'))
 */
export default function dynamic(
  loader: Loader
): ComponentType<Record<string, unknown>> {
  return function DynamicStub(props: Record<string, unknown>) {
    const Comp = useSyncExternalStore(
      (onStoreChange) => subscribeLoader(loader, onStoreChange),
      () => readLoaderValue(loader),
      () => null
    );

    if (!Comp) {
      return (
        <div data-testid="workflow-designer-loading">
          Loading workflow designer…
        </div>
      );
    }

    return <Comp {...props} />;
  };
}

function getLoaderEntry(loader: Loader): LoaderEntry {
  const existing = loaderEntries.get(loader);
  if (existing) {
    return existing;
  }

  const created: LoaderEntry = {
    listeners: new Set(),
    value: null,
    started: false,
  };
  loaderEntries.set(loader, created);
  return created;
}

function subscribeLoader(
  loader: Loader,
  onStoreChange: () => void
): () => void {
  const entry = getLoaderEntry(loader);
  entry.listeners.add(onStoreChange);
  startLoader(loader, entry);
  return function unsubscribe() {
    entry.listeners.delete(onStoreChange);
  };
}

function readLoaderValue(
  loader: Loader
): ComponentType<Record<string, unknown>> | null {
  return getLoaderEntry(loader).value;
}

function startLoader(loader: Loader, entry: LoaderEntry): void {
  if (entry.started) {
    return;
  }
  entry.started = true;
  resolveLoader(loader)
    .then((component) => {
      entry.value = component;
      notifyLoader(entry);
    })
    .catch(() => undefined);
}

function notifyLoader(entry: LoaderEntry): void {
  for (const listener of entry.listeners) {
    listener();
  }
}

async function resolveLoader(
  loader: Loader
): Promise<ComponentType<Record<string, unknown>>> {
  const loaded = await loader();
  if (typeof loaded === 'function') {
    return loaded;
  }
  return loaded.default;
}
