import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

interface Env extends Record<string, unknown> {
  YDocServer: DurableObjectNamespace<YDocServer>;
}

type TodoSeed = {
  text: string;
  completed: boolean;
  children?: TodoSeed[];
};

const INITIAL_TODOS: TodoSeed[] = [
  {
    text: "Plan project architecture",
    completed: true,
    children: [
      { text: "Research technologies", completed: true },
      { text: "Design data model", completed: true },
    ],
  },
  {
    text: "Connect with your team",
    completed: false,
    children: [
      { text: "Share this room link with a teammate", completed: false },
      {
        text: "Open the app in a second browser or device to see live sync",
        completed: false,
      },
    ],
  },
  {
    text: "Explore collaboration features",
    completed: false,
    children: [
      { text: "Drag todos to reorder them", completed: false },
      { text: "Add nested subtasks with the + button", completed: false },
      { text: "Toggle selection mode for bulk actions", completed: false },
    ],
  },
];

export class YDocServer extends YServer<Env> {
  async onLoad(): Promise<void> {
    const sharedState = this.document.getMap("sharedState");
    if (sharedState.size === 0) {
      this.createInitialTodos(sharedState);
    }
  }

  onError(error: unknown): void {
    console.error("[YDocServer] connection error", error);
  }

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
