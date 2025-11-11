import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

type TodoSeed = {
  text: string;
  completed: boolean;
  children?: TodoSeed[];
};

// Reset the room every 30 minutes in production, or every minute in dev mode
const CLEANUP_INTERVAL_MS = import.meta.env.DEV ? 60 * 1000 : 30 * 60 * 1000;

const INITIAL_TODOS: TodoSeed[] = [
  {
    text: "Welcome to valtio-y collaborative todos! ⚡",
    completed: false,
    children: [
      {
        text: "Real-time synchronization powered by Valtio + Yjs CRDTs",
        completed: false,
      },
      {
        text: "Open this page in 2+ browser tabs to see instant sync!",
        completed: false,
      },
    ],
  },
  {
    text: "Try editing and organizing",
    completed: false,
    children: [
      { text: "Double-click any todo to edit it", completed: false },
      { text: "Drag todos to reorder them", completed: false },
      { text: "Check/uncheck items to mark complete", completed: false },
    ],
  },
  {
    text: "Add nested subtasks",
    completed: false,
    children: [
      {
        text: "Click the + button next to any todo to add a subtask",
        completed: false,
      },
      { text: "Build deep hierarchies for complex projects", completed: false },
      {
        text: "All nesting syncs perfectly in real-time",
        completed: false,
      },
    ],
  },
  {
    text: "Use rooms for privacy 🔒",
    completed: false,
    children: [
      {
        text: "Add #room-name to the URL to create a private room",
        completed: false,
      },
      {
        text: "Example: localhost:5173#my-team-tasks",
        completed: false,
      },
      { text: "Each room is completely separate", completed: false },
    ],
  },
  {
    text: "Bulk operations",
    completed: false,
    children: [
      {
        text: "Toggle selection mode with the checkbox icon",
        completed: false,
      },
      { text: "Select multiple todos", completed: false },
      { text: "Delete them all at once with the trash icon", completed: false },
    ],
  },
  {
    text: "Demo mode - all rooms reset every 30 minutes ⏰",
    completed: false,
    children: [
      {
        text: "This keeps all rooms clean for demonstrations",
        completed: false,
      },
      {
        text: "All changes will be deleted after 30 minutes",
        completed: false,
      },
      { text: "Feel free to experiment!", completed: false },
    ],
  },
];

export class YDocServer extends YServer<Env> {
  static options = {
    hibernate: true,
  };

  /**
   * Initialize document with sample todos if empty
   * Called once when a client connects to the server
   */
  async onLoad(): Promise<void> {
    const sharedState = this.document.getMap("root");
    if (sharedState.size === 0) {
      this.createInitialTodos(sharedState);
    }

    // Schedule the first alarm to clean the room
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }

  onError(error: unknown): void {
    console.error("[YDocServer] connection error", error);
  }

  /**
   * Alarm handler that cleans the room and creates fresh todos
   * This is called automatically by the Durable Objects runtime
   */
  async alarm(): Promise<void> {
    const sharedState = this.document.getMap("root");
    // Create fresh initial todos
    this.createInitialTodos(sharedState);

    // Schedule the next alarm
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }

  /**
   * Create fresh initial todos in the shared state
   * This is called on initial load and every 30 minutes via alarm
   */
  private createInitialTodos(sharedState: Y.Map<unknown>): void {
    this.document.transact(() => {
      sharedState.delete("todos");
      const todos = new Y.Array<Y.Map<unknown>>();
      INITIAL_TODOS.forEach((todo) => {
        todos.push([this.createTodo(todo)]);
      });
      sharedState.set("todos", todos);
    });
  }

  private createTodo(seed: TodoSeed): Y.Map<unknown> {
    const map = new Y.Map<unknown>();
    map.set("id", crypto.randomUUID());
    map.set("text", seed.text);
    map.set("completed", seed.completed);

    if (seed.children && seed.children.length > 0) {
      const childrenArray = new Y.Array<Y.Map<unknown>>();
      seed.children.forEach((child) => {
        childrenArray.push([this.createTodo(child)]);
      });
      map.set("children", childrenArray);
    }

    return map;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routePartykitRequest(
      request,
      env as unknown as Record<string, unknown>,
    );
    if (response) {
      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
