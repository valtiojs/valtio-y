/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';

async function waitMicrotask() {
  await Promise.resolve();
}

describe('Nested Deletion and Replacement: Elements with Children', () => {
  describe('Array Element Deletion with Nested Children', () => {
    it('should properly delete array element containing nested object with children', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any[]>(doc1, {
        getRoot: (d) => d.getArray('items'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any[]>(doc2, {
        getRoot: (d) => d.getArray('items'),
        debug: false
      });
      
      // Initialize with nested structure
      bootstrap([
        {
          id: 'item1',
          title: 'First Item',
          metadata: {
            tags: ['urgent', 'important'],
            stats: { views: 10, likes: 5 },
            nested: {
              deep: {
                value: 'deep-value-1',
                list: [1, 2, 3]
              }
            }
          }
        },
        {
          id: 'item2', 
          title: 'Second Item',
          metadata: {
            tags: ['normal'],
            stats: { views: 20, likes: 15 },
            nested: {
              deep: {
                value: 'deep-value-2',
                list: [4, 5, 6]
              }
            }
          }
        },
        {
          id: 'item3',
          title: 'Third Item',
          metadata: {
            tags: ['low-priority'],
            stats: { views: 5, likes: 1 },
            nested: {
              deep: {
                value: 'deep-value-3',
                list: [7, 8, 9]
              }
            }
          }
        }
      ]);
      
      await waitMicrotask();
      
      // Sync documents
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);
      await waitMicrotask();
      
      // Verify initial sync
      expect(proxy1.length).toBe(3);
      expect(proxy2.length).toBe(3);
      expect(proxy1[1].id).toBe('item2');
      expect(proxy2[1].id).toBe('item2');
      expect(proxy1[1].metadata.nested.deep.value).toBe('deep-value-2');
      expect(proxy2[1].metadata.nested.deep.value).toBe('deep-value-2');
      
      // Delete the middle element (with complex nested children)
      proxy1.splice(1, 1); // Remove 'item2'
      await waitMicrotask();
      
      // Sync the deletion
      const update2 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update2);
      await waitMicrotask();
      
      // Verify deletion worked correctly
      expect(proxy1.length).toBe(2);
      expect(proxy2.length).toBe(2);
      expect(proxy1[0].id).toBe('item1');
      expect(proxy1[1].id).toBe('item3');
      expect(proxy2[0].id).toBe('item1');
      expect(proxy2[1].id).toBe('item3');
      
      // Verify nested structures remain intact on remaining elements
      expect(proxy1[0].metadata.nested.deep.list).toEqual([1, 2, 3]);
      expect(proxy1[1].metadata.nested.deep.list).toEqual([7, 8, 9]);
      expect(proxy2[0].metadata.nested.deep.list).toEqual([1, 2, 3]);
      expect(proxy2[1].metadata.nested.deep.list).toEqual([7, 8, 9]);
    });

    it('should handle deletion of element with nested arrays containing objects', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray('data'),
        debug: false
      });
      
      bootstrap([
        {
          name: 'Container A',
          items: [
            { id: 1, value: 'a1' },
            { id: 2, value: 'a2' },
            { id: 3, value: 'a3' }
          ]
        },
        {
          name: 'Container B', 
          items: [
            { id: 4, value: 'b1' },
            { id: 5, value: 'b2' }
          ]
        }
      ]);
      
      await waitMicrotask();
      
      // Verify initial structure
      expect(proxy.length).toBe(2);
      expect(proxy[0].items.length).toBe(3);
      expect(proxy[1].items.length).toBe(2);
      
      // Delete container with nested array of objects
      proxy.splice(0, 1);
      await waitMicrotask();
      
      // Verify deletion
      expect(proxy.length).toBe(1);
      expect(proxy[0].name).toBe('Container B');
      expect(proxy[0].items).toEqual([
        { id: 4, value: 'b1' },
        { id: 5, value: 'b2' }
      ]);
    });
  });

  describe('Array Element Replacement with Nested Children', () => {
    it('should replace array element containing nested structure', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any[]>(doc1, {
        getRoot: (d) => d.getArray('tasks'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any[]>(doc2, {
        getRoot: (d) => d.getArray('tasks'),
        debug: false
      });
      
      // Initialize with nested task structure
      bootstrap([
        {
          id: 'task1',
          title: 'Original Task',
          subtasks: [
            { id: 'sub1', title: 'Subtask 1', completed: false },
            { id: 'sub2', title: 'Subtask 2', completed: true }
          ],
          metadata: {
            priority: 'high',
            labels: ['work', 'urgent'],
            assignee: { name: 'Alice', team: 'dev' }
          }
        }
      ]);
      
      await waitMicrotask();
      
      // Sync documents
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);
      await waitMicrotask();
      
      // Verify initial sync
      expect(proxy1[0].subtasks.length).toBe(2);
      expect(proxy2[0].subtasks.length).toBe(2);
      expect(proxy1[0].metadata.assignee.name).toBe('Alice');
      expect(proxy2[0].metadata.assignee.name).toBe('Alice');
      
      // Replace entire task with new nested structure
      const newTask = {
        id: 'task1-updated',
        title: 'Completely New Task',
        subtasks: [
          { id: 'newsub1', title: 'New Subtask 1', completed: false },
          { id: 'newsub2', title: 'New Subtask 2', completed: false },
          { id: 'newsub3', title: 'New Subtask 3', completed: true }
        ],
        metadata: {
          priority: 'medium',
          labels: ['research', 'planning'],
          assignee: { name: 'Bob', team: 'design' }
        }
      };
      
      proxy1[0] = newTask;
      await waitMicrotask();
      
      // Sync the replacement
      const update2 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update2);
      await waitMicrotask();
      
      // Verify replacement worked correctly
      expect(proxy1[0].id).toBe('task1-updated');
      expect(proxy1[0].title).toBe('Completely New Task');
      expect(proxy1[0].subtasks.length).toBe(3);
      expect(proxy1[0].metadata.assignee.name).toBe('Bob');
      
      expect(proxy2[0].id).toBe('task1-updated');
      expect(proxy2[0].title).toBe('Completely New Task');
      expect(proxy2[0].subtasks.length).toBe(3);
      expect(proxy2[0].metadata.assignee.name).toBe('Bob');
      
      // Verify nested structures are fully replaced, not merged
      expect(proxy1[0].subtasks.map((s: any) => s.id)).toEqual(['newsub1', 'newsub2', 'newsub3']);
      expect(proxy2[0].subtasks.map((s: any) => s.id)).toEqual(['newsub1', 'newsub2', 'newsub3']);
      expect(proxy1[0].metadata.labels).toEqual(['research', 'planning']);
      expect(proxy2[0].metadata.labels).toEqual(['research', 'planning']);
    });

    it('should handle splice replacement of complex nested element', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray('components'),
        debug: false
      });
      
      bootstrap([
        {
          type: 'header',
          props: { title: 'Welcome' },
          children: [
            { type: 'text', content: 'Hello' },
            { type: 'link', href: '#', content: 'Click here' }
          ]
        },
        {
          type: 'content',
          props: { className: 'main' },
          children: [
            { type: 'paragraph', content: 'Some content' },
            { type: 'list', items: ['item1', 'item2', 'item3'] }
          ]
        }
      ]);
      
      await waitMicrotask();
      
      // Replace the content component using splice
      const newContent = {
        type: 'sidebar',
        props: { position: 'right', width: 300 },
        children: [
          { type: 'widget', name: 'calendar' },
          { type: 'widget', name: 'notifications' },
          { 
            type: 'nested-list', 
            structure: {
              level1: [
                { level2: ['a', 'b'] },
                { level2: ['c', 'd'] }
              ]
            }
          }
        ]
      };
      
      proxy.splice(1, 1, newContent);
      await waitMicrotask();
      
      // Verify replacement
      expect(proxy.length).toBe(2);
      expect(proxy[0].type).toBe('header');
      expect(proxy[1].type).toBe('sidebar');
      expect(proxy[1].props.position).toBe('right');
      expect(proxy[1].children.length).toBe(3);
      expect(proxy[1].children[2].structure.level1.length).toBe(2);
      expect(proxy[1].children[2].structure.level1[0].level2).toEqual(['a', 'b']);
    });
  });

  describe('Map Key Deletion/Replacement with Nested Children', () => {
    it('should delete map keys containing nested structures', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any>(doc1, {
        getRoot: (d) => d.getMap('state'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any>(doc2, {
        getRoot: (d) => d.getMap('state'),
        debug: false
      });
      
      // Initialize with complex nested state
      bootstrap({
        users: {
          'user1': {
            profile: { name: 'Alice', avatar: 'avatar1.jpg' },
            permissions: ['read', 'write', 'admin'],
            projects: {
              'proj1': { name: 'Project Alpha', tasks: [1, 2, 3] },
              'proj2': { name: 'Project Beta', tasks: [4, 5] }
            }
          },
          'user2': {
            profile: { name: 'Bob', avatar: 'avatar2.jpg' },
            permissions: ['read'],
            projects: {
              'proj3': { name: 'Project Gamma', tasks: [6, 7, 8, 9] }
            }
          }
        },
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            preferences: {
              frequency: 'daily',
              types: ['mentions', 'updates']
            }
          }
        }
      });
      
      await waitMicrotask();
      
      // Sync documents
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);
      await waitMicrotask();
      
      // Verify initial state
      expect(proxy1.users.user1.projects.proj1.name).toBe('Project Alpha');
      expect(proxy2.users.user1.projects.proj1.name).toBe('Project Alpha');
      expect(Object.keys(proxy1.users)).toEqual(['user1', 'user2']);
      expect(Object.keys(proxy2.users)).toEqual(['user1', 'user2']);
      
      // Delete user with all nested data
      delete proxy1.users.user1;
      await waitMicrotask();
      
      // Sync deletion
      const update2 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update2);
      await waitMicrotask();
      
      // Verify deletion
      expect(Object.keys(proxy1.users)).toEqual(['user2']);
      expect(Object.keys(proxy2.users)).toEqual(['user2']);
      expect(proxy1.users.user1).toBeUndefined();
      expect(proxy2.users.user1).toBeUndefined();
      
      // Verify remaining user data is intact
      expect(proxy1.users.user2.profile.name).toBe('Bob');
      expect(proxy2.users.user2.profile.name).toBe('Bob');
      expect(proxy1.users.user2.projects.proj3.tasks).toEqual([6, 7, 8, 9]);
      expect(proxy2.users.user2.projects.proj3.tasks).toEqual([6, 7, 8, 9]);
    });

    it('should replace map value containing deeply nested structures', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap('app'),
        debug: false
      });
      
      bootstrap({
        config: {
          database: {
            connections: [
              { host: 'db1.example.com', port: 5432, pools: { read: 5, write: 3 } },
              { host: 'db2.example.com', port: 5432, pools: { read: 10, write: 5 } }
            ],
            settings: {
              timeout: 30000,
              retries: 3,
              ssl: { enabled: true, cert: '/path/to/cert' }
            }
          },
          cache: {
            redis: {
              clusters: ['redis1', 'redis2', 'redis3'],
              config: { ttl: 3600, maxMemory: '2gb' }
            }
          }
        }
      });
      
      await waitMicrotask();
      
      // Verify initial nested structure
      expect(proxy.config.database.connections.length).toBe(2);
      expect(proxy.config.cache.redis.clusters.length).toBe(3);
      
      // Replace entire config with new nested structure
      proxy.config = {
        api: {
          endpoints: [
            { path: '/api/v1/users', methods: ['GET', 'POST'] },
            { path: '/api/v1/projects', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
          ],
          middleware: {
            auth: { enabled: true, provider: 'jwt' },
            rate_limit: { requests: 100, window: '1m' },
            logging: {
              level: 'info',
              destinations: ['console', 'file'],
              format: { timestamp: true, json: true }
            }
          }
        }
      };
      
      await waitMicrotask();
      
      // Verify replacement worked
      expect(proxy.config.database).toBeUndefined();
      expect(proxy.config.cache).toBeUndefined();
      expect(proxy.config.api).toBeDefined();
      expect(proxy.config.api.endpoints.length).toBe(2);
      expect(proxy.config.api.middleware.logging.destinations).toEqual(['console', 'file']);
    });
  });

  describe('Multi-Client Nested Operations', () => {
    it('should sync nested deletions across multiple clients correctly', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const doc3 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any[]>(doc1, {
        getRoot: (d) => d.getArray('workspace'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any[]>(doc2, {
        getRoot: (d) => d.getArray('workspace'),
        debug: false
      });
      const { proxy: proxy3 } = createYjsProxy<any[]>(doc3, {
        getRoot: (d) => d.getArray('workspace'),
        debug: false
      });
      
      // Initialize shared workspace with nested project structure
      bootstrap([
        {
          name: 'Project Alpha',
          teams: [
            {
              name: 'Backend Team',
              members: [
                { name: 'Alice', role: 'lead', skills: ['node', 'postgres'] },
                { name: 'Bob', role: 'developer', skills: ['python', 'redis'] }
              ],
              repositories: {
                'api': { url: 'git@example.com:api.git', branch: 'main' },
                'worker': { url: 'git@example.com:worker.git', branch: 'develop' }
              }
            },
            {
              name: 'Frontend Team',
              members: [
                { name: 'Carol', role: 'lead', skills: ['react', 'typescript'] },
                { name: 'Dave', role: 'designer', skills: ['figma', 'css'] }
              ],
              repositories: {
                'web': { url: 'git@example.com:web.git', branch: 'main' }
              }
            }
          ]
        }
      ]);
      
      await waitMicrotask();
      
      // Sync all documents
      let update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      Y.applyUpdate(doc3, update);
      await waitMicrotask();
      
      // Verify initial sync across all clients
      expect(proxy1[0].teams.length).toBe(2);
      expect(proxy2[0].teams.length).toBe(2);
      expect(proxy3[0].teams.length).toBe(2);
      
      // Client 1: Delete backend team (with all nested data)
      proxy1[0].teams.splice(0, 1);
      await waitMicrotask();
      
      // Sync deletion to other clients
      update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      Y.applyUpdate(doc3, update);
      await waitMicrotask();
      
      // Verify deletion propagated
      expect(proxy1[0].teams.length).toBe(1);
      expect(proxy2[0].teams.length).toBe(1);
      expect(proxy3[0].teams.length).toBe(1);
      
      expect(proxy1[0].teams[0].name).toBe('Frontend Team');
      expect(proxy2[0].teams[0].name).toBe('Frontend Team');
      expect(proxy3[0].teams[0].name).toBe('Frontend Team');
      
      // Client 2: Modify remaining team's nested structure
      proxy2[0].teams[0].members.push({
        name: 'Eve',
        role: 'developer',
        skills: ['vue', 'node']
      });
      await waitMicrotask();
      
      // Sync addition to other clients
      update = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc1, update);
      Y.applyUpdate(doc3, update);
      await waitMicrotask();
      
      // Verify addition propagated
      expect(proxy1[0].teams[0].members.length).toBe(3);
      expect(proxy2[0].teams[0].members.length).toBe(3);
      expect(proxy3[0].teams[0].members.length).toBe(3);
      
      expect(proxy1[0].teams[0].members[2].name).toBe('Eve');
      expect(proxy2[0].teams[0].members[2].name).toBe('Eve');
      expect(proxy3[0].teams[0].members[2].name).toBe('Eve');
    });
  });

  describe('Complex Nested Operations in Same Microtask', () => {
    it('should handle multiple nested operations in same microtask', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any>(doc1, {
        getRoot: (d) => d.getMap('document'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any>(doc2, {
        getRoot: (d) => d.getMap('document'),
        debug: false
      });
      
      // Initialize with document structure
      bootstrap({
        pages: [
          {
            id: 'page1',
            title: 'Introduction',
            sections: [
              { id: 'sec1', title: 'Overview', paragraphs: ['p1', 'p2'] },
              { id: 'sec2', title: 'Details', paragraphs: ['p3', 'p4', 'p5'] }
            ]
          },
          {
            id: 'page2',
            title: 'Conclusion',
            sections: [
              { id: 'sec3', title: 'Summary', paragraphs: ['p6'] }
            ]
          }
        ],
        metadata: {
          author: 'John Doe',
          tags: ['technical', 'documentation'],
          revision: { number: 1, date: '2024-01-15' }
        }
      });
      
      await waitMicrotask();
      
      // Sync documents
      let update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Perform multiple nested operations in same microtask
      // 1. Delete a page
      proxy1.pages.splice(0, 1);
      // 2. Replace remaining page's nested structure
      proxy1.pages[0] = {
        id: 'page2-revised',
        title: 'Enhanced Conclusion',
        sections: [
          { id: 'sec3-new', title: 'Enhanced Summary', paragraphs: ['p6-revised', 'p7-new'] },
          { id: 'sec4-new', title: 'Next Steps', paragraphs: ['p8', 'p9'] }
        ]
      };
      // 3. Update metadata
      proxy1.metadata.revision.number = 2;
      proxy1.metadata.tags.push('revised');
      
      await waitMicrotask();
      
      // Sync all changes
      update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Verify all operations worked
      expect(proxy1.pages.length).toBe(1);
      expect(proxy2.pages.length).toBe(1);
      
      expect(proxy1.pages[0].id).toBe('page2-revised');
      expect(proxy2.pages[0].id).toBe('page2-revised');
      
      expect(proxy1.pages[0].sections.length).toBe(2);
      expect(proxy2.pages[0].sections.length).toBe(2);
      
      expect(proxy1.metadata.revision.number).toBe(2);
      expect(proxy2.metadata.revision.number).toBe(2);
      
      expect(proxy1.metadata.tags).toEqual(['technical', 'documentation', 'revised']);
      expect(proxy2.metadata.tags).toEqual(['technical', 'documentation', 'revised']);
    });
  });

  describe('Edge Cases: Rapid Nested Operations', () => {
    it('should handle rapid deletion and insertion of nested elements', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any[]>(doc1, {
        getRoot: (d) => d.getArray('items'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any[]>(doc2, {
        getRoot: (d) => d.getArray('items'),
        debug: false
      });
      
      // Initialize with items containing nested data
      const createItem = (id: number) => ({
        id: `item${id}`,
        data: {
          content: `Content ${id}`,
          metadata: {
            created: `2024-01-${id.toString().padStart(2, '0')}`,
            tags: [`tag${id}`, `category${id % 3}`],
            relations: {
              parent: id > 1 ? `item${id - 1}` : null,
              children: id < 5 ? [`item${id + 1}`] : []
            }
          }
        }
      });
      
      bootstrap([createItem(1), createItem(2), createItem(3)]);
      await waitMicrotask();
      
      // Sync
      let update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Rapid operations without microtask waits
      proxy1.splice(1, 1); // Delete item2
      proxy1.push(createItem(4)); // Add item4
      proxy1[0] = createItem(10); // Replace item1 with item10
      proxy1.splice(1, 0, createItem(20), createItem(21)); // Insert multiple items
      
      await waitMicrotask();
      
      // Sync all rapid changes
      update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Verify final state
      expect(proxy1.length).toBe(5); // item10, item20, item21, item3, item4
      expect(proxy2.length).toBe(5);
      
      expect(proxy1[0].id).toBe('item10');
      expect(proxy1[1].id).toBe('item20');
      expect(proxy1[2].id).toBe('item21');
      expect(proxy1[3].id).toBe('item3');
      expect(proxy1[4].id).toBe('item4');
      
      expect(proxy2[0].id).toBe('item10');
      expect(proxy2[1].id).toBe('item20');
      expect(proxy2[2].id).toBe('item21');
      expect(proxy2[3].id).toBe('item3');
      expect(proxy2[4].id).toBe('item4');
      
      // Verify nested structures are intact
      expect(proxy1[0].data.metadata.relations.children).toEqual([]);
      expect(proxy2[0].data.metadata.relations.children).toEqual([]);
      expect(proxy1[3].data.metadata.tags).toEqual(['tag3', 'category0']);
      expect(proxy2[3].data.metadata.tags).toEqual(['tag3', 'category0']);
    });

    it('should handle deletion of nested array elements containing maps', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap('game'),
        debug: false
      });
      
      bootstrap({
        levels: [
          {
            id: 1,
            name: 'Forest Level',
            entities: [
              {
                type: 'player',
                position: { x: 10, y: 20 },
                inventory: {
                  weapons: [{ name: 'sword', damage: 10 }, { name: 'bow', damage: 8 }],
                  items: [{ name: 'potion', count: 3 }, { name: 'key', count: 1 }]
                },
                stats: { health: 100, mana: 50, experience: 1250 }
              },
              {
                type: 'enemy',
                position: { x: 50, y: 30 },
                ai: {
                  behavior: 'aggressive',
                  patrol: { path: [[40, 30], [60, 30], [50, 40]], speed: 2 },
                  combat: { attack_range: 5, damage: 15 }
                }
              }
            ]
          }
        ]
      });
      
      await waitMicrotask();
      
      // Verify complex nested structure
      expect(proxy.levels[0].entities.length).toBe(2);
      expect(proxy.levels[0].entities[0].inventory.weapons.length).toBe(2);
      expect(proxy.levels[0].entities[1].ai.patrol.path.length).toBe(3);
      
      // Delete enemy entity with complex nested AI data
      proxy.levels[0].entities.splice(1, 1);
      await waitMicrotask();
      
      // Verify deletion of nested structure
      expect(proxy.levels[0].entities.length).toBe(1);
      expect(proxy.levels[0].entities[0].type).toBe('player');
      expect(proxy.levels[0].entities[0].inventory.weapons.length).toBe(2);
      
      // Add new entity with different nested structure
      proxy.levels[0].entities.push({
        type: 'npc',
        position: { x: 25, y: 25 },
        dialogue: {
          lines: ['Hello there!', 'Need any help?', 'Good luck!'],
          triggers: {
            proximity: 3,
            conditions: ['has_key', 'level_complete']
          }
        },
        shop: {
          items: [
            { name: 'better_sword', price: 50, stock: 1 },
            { name: 'shield', price: 30, stock: 2 }
          ]
        }
      });
      await waitMicrotask();
      
      // Verify new nested structure
      expect(proxy.levels[0].entities.length).toBe(2);
      expect(proxy.levels[0].entities[1].type).toBe('npc');
      expect(proxy.levels[0].entities[1].dialogue.lines.length).toBe(3);
      expect(proxy.levels[0].entities[1].shop.items.length).toBe(2);
    });
  });

  describe('Stress Testing: Large Nested Structures', () => {
    it('should handle deletion of elements with very deep nesting', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray('deep'),
        debug: false
      });
      
      // Create deeply nested structure
      const createDeepStructure = (depth: number): any => {
        if (depth === 0) {
          return { value: 'leaf', timestamp: Date.now() };
        }
        return {
          level: depth,
          children: [
            createDeepStructure(depth - 1),
            createDeepStructure(depth - 1),
          ],
          metadata: {
            depth,
            created: `level-${depth}`,
            properties: Array.from({ length: depth }, (_, i) => ({ key: `prop${i}`, value: i * depth }))
          }
        };
      };
      
      bootstrap([
        createDeepStructure(5),
        { simple: 'element' },
        createDeepStructure(4)
      ]);
      
      await waitMicrotask();
      
      // Verify deep structure exists
      expect(proxy.length).toBe(3);
      expect(proxy[0].level).toBe(5);
      expect(proxy[0].children[0].children[0].children[0].children[0].children[0].value).toBe('leaf');
      expect(proxy[2].level).toBe(4);
      
      // Delete deeply nested element
      proxy.splice(0, 1);
      await waitMicrotask();
      
      // Verify deletion
      expect(proxy.length).toBe(2);
      expect(proxy[0].simple).toBe('element');
      expect(proxy[1].level).toBe(4);
      
      // Verify remaining deep structure is intact
      expect(proxy[1].children[0].children[0].children[0].children[0].value).toBe('leaf');
    });

    it('should handle replacement with different nested structure complexity', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray('components'),
        debug: false
      });
      
      bootstrap([
        {
          type: 'simple',
          data: 'simple string'
        },
        {
          type: 'complex',
          data: {
            nested: {
              arrays: [
                [1, 2, [3, 4, [5, 6]]],
                [7, 8, [9, 10]]
              ],
              objects: {
                a: { b: { c: { d: 'deep' } } },
                x: { y: { z: [1, 2, 3] } }
              }
            }
          }
        }
      ]);
      
      await waitMicrotask();
      
      // Replace simple with complex
      proxy[0] = {
        type: 'mega-complex',
        data: {
          matrix: [
            [{ cell: [1, 2] }, { cell: [3, 4] }],
            [{ cell: [5, 6] }, { cell: [7, 8] }]
          ],
          tree: {
            root: {
              value: 'root',
              left: { value: 'left', children: [{ value: 'left-1' }, { value: 'left-2' }] },
              right: { value: 'right', children: [{ value: 'right-1' }] }
            }
          }
        }
      };
      
      // Replace complex with simple
      proxy[1] = {
        type: 'ultra-simple',
        data: 42
      };
      
      await waitMicrotask();
      
      // Verify replacements
      expect(proxy[0].type).toBe('mega-complex');
      expect(proxy[0].data.matrix[0][0].cell).toEqual([1, 2]);
      expect(proxy[0].data.tree.root.left.children.length).toBe(2);
      
      expect(proxy[1].type).toBe('ultra-simple');
      expect(proxy[1].data).toBe(42);
    });
  });

  describe('Memory and Reference Management', () => {
    it('should properly cleanup references when deleting nested structures', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap('app'),
        debug: false
      });
      
      // Track some references to ensure they get cleaned up
      bootstrap({
        activeSession: {
          user: { id: 'user123', name: 'Test User' },
          workspace: {
            projects: [
              { id: 'proj1', tasks: [{ id: 'task1', subtasks: ['sub1', 'sub2'] }] },
              { id: 'proj2', tasks: [{ id: 'task2', subtasks: ['sub3'] }] }
            ]
          }
        },
        cache: {
          recent: ['item1', 'item2', 'item3'],
          favorites: { 'fav1': { name: 'Favorite 1', data: [1, 2, 3] } }
        }
      });
      
      await waitMicrotask();
      
      // Store reference to nested object before deletion
      const originalWorkspace = proxy.activeSession.workspace;
      expect(originalWorkspace.projects.length).toBe(2);
      
      // Delete the entire activeSession
      delete proxy.activeSession;
      await waitMicrotask();
      
      // Verify deletion
      expect(proxy.activeSession).toBeUndefined();
      expect(proxy.cache).toBeDefined();
      expect(proxy.cache.recent.length).toBe(3);
      
      // Replace cache with completely new structure
      proxy.cache = {
        strategy: 'lru',
        maxSize: 1000,
        storage: {
          backend: 'redis',
          config: { host: 'localhost', port: 6379 }
        }
      };
      await waitMicrotask();
      
      // Verify replacement
      expect(proxy.cache.recent).toBeUndefined();
      expect(proxy.cache.strategy).toBe('lru');
      expect(proxy.cache.storage.backend).toBe('redis');
    });
  });

  describe('Cross-Reference Scenarios', () => {
    it('should handle deletion when elements reference each other', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const { proxy: proxy1, bootstrap } = createYjsProxy<any>(doc1, {
        getRoot: (d) => d.getMap('system'),
        debug: false
      });
      const { proxy: proxy2 } = createYjsProxy<any>(doc2, {
        getRoot: (d) => d.getMap('system'),
        debug: false
      });
      
      // Create structure with cross-references
      bootstrap({
        nodes: [
          {
            id: 'node1',
            data: { value: 'First Node' },
            connections: ['node2', 'node3']
          },
          {
            id: 'node2', 
            data: { value: 'Second Node' },
            connections: ['node1', 'node3']
          },
          {
            id: 'node3',
            data: { value: 'Third Node' },
            connections: ['node1', 'node2']
          }
        ],
        edges: {
          'node1->node2': { weight: 1.5, type: 'strong' },
          'node1->node3': { weight: 0.8, type: 'weak' },
          'node2->node3': { weight: 2.0, type: 'strong' }
        }
      });
      
      await waitMicrotask();
      
      // Sync
      let update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Verify initial cross-references
      expect(proxy1.nodes[0].connections).toEqual(['node2', 'node3']);
      expect(proxy2.nodes[0].connections).toEqual(['node2', 'node3']);
      expect(Object.keys(proxy1.edges)).toHaveLength(3);
      
      // Delete node2 and its related edges
      proxy1.nodes.splice(1, 1); // Remove node2
      delete proxy1.edges['node1->node2'];
      delete proxy1.edges['node2->node3'];
      
      await waitMicrotask();
      
      // Sync changes
      update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();
      
      // Verify cleanup
      expect(proxy1.nodes.length).toBe(2);
      expect(proxy2.nodes.length).toBe(2);
      expect(proxy1.nodes.map((n: any) => n.id)).toEqual(['node1', 'node3']);
      expect(proxy2.nodes.map((n: any) => n.id)).toEqual(['node1', 'node3']);
      
      expect(Object.keys(proxy1.edges)).toEqual(['node1->node3']);
      expect(Object.keys(proxy2.edges)).toEqual(['node1->node3']);
      expect(proxy1.edges['node1->node3'].weight).toBe(0.8);
      expect(proxy2.edges['node1->node3'].weight).toBe(0.8);
    });
  });

  describe('Error Handling in Nested Operations', () => {
    it('should handle errors gracefully when nested structures contain invalid data', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray('data'),
        debug: false
      });
      
      // Initialize with valid nested structure
      bootstrap([
        {
          id: 'valid1',
          content: {
            text: 'Valid content',
            metadata: { created: '2024-01-15', tags: ['test'] }
          }
        }
      ]);
      
      await waitMicrotask();
      
      // Try to replace with structure containing undefined (should be handled)
      // Per the new architecture, undefined should be rejected
      expect(() => {
        proxy[0] = {
          id: 'invalid',
          content: {
            text: 'Invalid content',
            metadata: { created: '2024-01-15', invalid: undefined }
          }
        };
      }).toThrow('[valtio-yjs] undefined is not allowed');
      
      // Verify original structure remains
      expect(proxy[0].id).toBe('valid1');
      expect(proxy[0].content.text).toBe('Valid content');
    });
  });
});
