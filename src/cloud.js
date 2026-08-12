// @ts-check
import { applyRemoteEvent, guid, syncManagedItems, syncProductDefaults, syncQueryBindings } from './core.js';
import { createSyncIdentity, SyncClient } from './sync.js';
import { loadCloudRuntime, saveCloudRuntime, vaultExportSnapshot } from './storage.js';

/** @typedef {{version:number,identity:Awaited<ReturnType<typeof createSyncIdentity>>,client:ReturnType<SyncClient['exportRuntime']>,syncedEventIds:string[],genesisSent:boolean}} CloudRuntime */

/** @param {Location} location */
export function relayBaseForLocation(location) {
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') return `${location.origin}/api/relay/spaces`;
  const configured = document.querySelector('meta[name="sonatory-relay"]')?.getAttribute('content')?.trim() || '';
  if (!configured) throw new Error('Automatic encrypted storage is temporarily unavailable. Your local changes remain safe.');
  return configured.replace(/\/$/, '');
}

/** Managed definitions are restored at load time and never consume a Vault's hosted storage allocation. @param {import('./core.js').AppState} state */
export function cloudGenesis(state) {
  const snapshot = vaultExportSnapshot(state);
  const retained = Object.fromEntries(Object.entries(snapshot.entities).filter(([, entity]) => !entity.managed));
  const retainedIds = new Set(Object.keys(retained));
  for (const entity of Object.values(retained)) entity.tags = entity.tags.filter(tag => tag === 'Tag' || retainedIds.has(tag));
  snapshot.entities = retained;
  snapshot.containerLinks = snapshot.containerLinks.filter(link => retainedIds.has(link.a) && retainedIds.has(link.b));
  snapshot.history = { events: [], undoStack: [], redoStack: [], branches: [] };
  snapshot.recentTabs = [];
  snapshot.cloud = { enabled: true, status: 'Automatic' };
  return snapshot;
}

export class AutomaticCloudReplica {
  /** @param {import('./core.js').AppState} state @param {string} relayBase */
  constructor(state, relayBase) {
    this.state = state;
    this.relayBase = relayBase.replace(/\/$/, '');
    /** @type {CloudRuntime|null} */ this.runtime = null;
    /** @type {SyncClient|null} */ this.client = null;
    this.ready = false;
  }

  async open() {
    if (this.ready) return false;
    let changed = false;
    let runtime = /** @type {CloudRuntime|null} */(await loadCloudRuntime(this.state.vault.id));
    if (!runtime) {
      const identity = await createSyncIdentity('vault', this.state.vault.id, this.state.vault.id, guid());
      runtime = { version: 1, identity, client: { actorCounter: 0, priorDeviceEventHash: '0'.repeat(64), canonicalSequence: 0, canonicalHash: '0'.repeat(64) }, syncedEventIds: [], genesisSent: false };
      await saveCloudRuntime(this.state.vault.id, runtime);
    }
    if (runtime.version !== 1 || runtime.identity.boundaryGuid !== this.state.vault.id) throw new Error('Encrypted cloud identity does not match this Vault.');
    const endpoint = `${this.relayBase}/vault/${encodeURIComponent(this.state.vault.id)}`;
    const client = new SyncClient({ endpoint, identity: runtime.identity }).restoreRuntime(runtime.client);
    this.runtime = runtime; this.client = client;
    const status = await client.initialize(25_000_000);
    if (!status.head && !runtime.genesisSent) {
      await client.push({ kind: 'genesis', state: cloudGenesis(this.state) }, { operationId: `genesis-${this.state.vault.id}`, eventSchemaId: 'vault.genesis' });
      runtime.genesisSent = true;
    } else if (Number(status.head || 0) > client.canonicalSequence) changed = await this.pull();
    runtime.client = client.exportRuntime();
    await saveCloudRuntime(this.state.vault.id, runtime);
    this.ready = true;
    return changed;
  }

  async pull() {
    if (!this.client || !this.runtime) return false;
    const received = await this.client.pull(this.client.canonicalSequence);
    let changed = false;
    for (const item of received) {
      if (item.payload?.kind !== 'event' || !item.payload.event) continue;
      changed = applyRemoteEvent(this.state, item.payload.event) || changed;
      if (!this.runtime.syncedEventIds.includes(item.payload.event.id)) this.runtime.syncedEventIds.push(item.payload.event.id);
    }
    if (changed) { syncProductDefaults(this.state); syncManagedItems(this.state); syncQueryBindings(this.state); }
    this.runtime.client = this.client.exportRuntime();
    await saveCloudRuntime(this.state.vault.id, this.runtime);
    return changed;
  }

  async sync() {
    let changed = await this.open();
    if (!this.client || !this.runtime) return false;
    changed = await this.pull() || changed;
    const synced = new Set(this.runtime.syncedEventIds);
    for (const event of this.state.history.events) {
      if (synced.has(event.id)) continue;
      await this.client.push({ kind: 'event', event }, { operationId: event.id, eventSchemaId: 'history.event' });
      synced.add(event.id);
      this.runtime.syncedEventIds.push(event.id);
      this.runtime.client = this.client.exportRuntime();
      await saveCloudRuntime(this.state.vault.id, this.runtime);
    }
    return changed;
  }

  async purge() {
    await this.open();
    if (!this.client) throw new Error('The encrypted hosted copy could not be reached. Nothing was deleted.');
    await this.client.purge();
  }
}
