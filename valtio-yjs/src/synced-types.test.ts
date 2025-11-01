/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { syncedText } from './synced-types';

describe('syncedText()', () => {
  it('creates a Y.Text instance', () => {
    const text = syncedText();
    expect(text).toBeInstanceOf(Y.Text);
  });

  it('creates empty Y.Text when no initial content provided', () => {
    const doc = new Y.Doc();
    const text = syncedText();
    // Y.Text needs to be attached to a document to be read
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe('');
    expect(text.length).toBe(0);
  });

  it('creates Y.Text with initial content when provided', () => {
    const doc = new Y.Doc();
    const text = syncedText('Hello World');
    // Y.Text needs to be attached to a document to be read
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe('Hello World');
    expect(text.length).toBe(11);
  });

  it('creates Y.Text with empty string when explicitly provided', () => {
    const doc = new Y.Doc();
    const text = syncedText('');
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe('');
    expect(text.length).toBe(0);
  });

  it('creates Y.Text with unicode content', () => {
    const doc = new Y.Doc();
    const content = '你好世界 🌍 émojis';
    const text = syncedText(content);
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe(content);
  });

  it('creates Y.Text with multiline content', () => {
    const doc = new Y.Doc();
    const content = 'Line 1\nLine 2\nLine 3';
    const text = syncedText(content);
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe(content);
  });

  it('creates Y.Text with special characters', () => {
    const doc = new Y.Doc();
    const content = 'Special: \t\n\r\b\f\v';
    const text = syncedText(content);
    doc.getArray('test').insert(0, [text]);
    expect(text.toString()).toBe(content);
  });

  it('allows mutations on created Y.Text', () => {
    const doc = new Y.Doc();
    const text = syncedText('Hello');
    doc.getArray('test').insert(0, [text]);
    text.insert(5, ' World');
    expect(text.toString()).toBe('Hello World');
  });

  it('can be inserted into Y.Array', () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray<Y.Text>('arr');
    const text = syncedText('test content');
    
    yArr.insert(0, [text]);
    expect(yArr.length).toBe(1);
    expect(yArr.get(0)).toBeInstanceOf(Y.Text);
    expect(yArr.get(0).toString()).toBe('test content');
  });

  it('can be set in Y.Map', () => {
    const doc = new Y.Doc();
    const yMap = doc.getMap<Y.Text>('map');
    const text = syncedText('test content');
    
    yMap.set('text', text);
    expect(yMap.has('text')).toBe(true);
    expect(yMap.get('text')).toBeInstanceOf(Y.Text);
    expect(yMap.get('text')!.toString()).toBe('test content');
  });

  it('creates independent Y.Text instances', () => {
    const doc = new Y.Doc();
    const text1 = syncedText('text1');
    const text2 = syncedText('text2');
    
    // Attach both to the document
    const arr = doc.getArray('test');
    arr.insert(0, [text1, text2]);
    
    expect(text1).not.toBe(text2);
    expect(text1.toString()).toBe('text1');
    expect(text2.toString()).toBe('text2');
    
    text1.insert(5, ' modified');
    expect(text1.toString()).toBe('text1 modified');
    expect(text2.toString()).toBe('text2'); // unaffected
  });

  it('can be used in nested structures', () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap('root');
    const yContainer = new Y.Map();
    const text = syncedText('nested text');
    
    yContainer.set('text', text);
    yRoot.set('container', yContainer);
    
    const retrievedContainer = yRoot.get('container') as Y.Map<Y.Text>;
    expect(retrievedContainer.get('text')).toBeInstanceOf(Y.Text);
    expect(retrievedContainer.get('text')!.toString()).toBe('nested text');
  });
});

