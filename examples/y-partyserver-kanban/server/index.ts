import * as Y from 'yjs';
import { YPartyKitProvider } from 'y-partyserver/provider';

export interface Env {
  KANBAN_DO: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomName = url.pathname.slice(1) || 'default';

    // Get or create the Durable Object instance
    const id = env.KANBAN_DO.idFromName(roomName);
    const stub = env.KANBAN_DO.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  }
};

export class KanbanDurableObject implements DurableObject {
  private ydoc: Y.Doc;
  private provider: YPartyKitProvider;

  constructor(private state: DurableObjectState) {
    this.ydoc = new Y.Doc();
    this.provider = new YPartyKitProvider(this.ydoc, {
      party: this.state,
      load: this.loadDoc.bind(this),
      save: this.saveDoc.bind(this)
    });

    // Initialize with seed data if document is empty
    this.initializeSeedData();
  }

  private async loadDoc(): Promise<Uint8Array | undefined> {
    const stored = await this.state.storage.get<Uint8Array>('ydoc');
    return stored;
  }

  private async saveDoc(update: Uint8Array): Promise<void> {
    await this.state.storage.put('ydoc', update);
  }

  private initializeSeedData(): void {
    const columns = this.ydoc.getArray('columns');
    const cards = this.ydoc.getMap('cards');

    // Only seed if empty
    if (columns.length === 0) {
      columns.push([
        { id: 'todo', title: 'To Do' },
        { id: 'in-progress', title: 'In Progress' },
        { id: 'done', title: 'Done' }
      ]);

      cards.set('card-1', { id: 'card-1', columnId: 'todo', title: 'Design Kanban UI', description: 'Create wireframes and mockups' });
      cards.set('card-2', { id: 'card-2', columnId: 'todo', title: 'Setup Durable Objects', description: 'Configure wrangler and DO' });
      cards.set('card-3', { id: 'card-3', columnId: 'in-progress', title: 'Implement drag-and-drop', description: 'Use dnd-kit for card movement' });
      cards.set('card-4', { id: 'card-4', columnId: 'done', title: 'Initialize project', description: 'Set up Vite + React + valtio-y' });
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.provider.handleRequest(request);
  }
}
