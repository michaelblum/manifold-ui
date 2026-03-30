import { describe, it, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import { createManifold } from './manifold.svelte';

describe('createManifold', () => {
  it('initializes values from group config', () => {
    const m = createManifold({
      groups: [
        { id: 'pos', members: ['x', 'y', 'z'], initial: { x: 1, y: 2, z: 3 } }
      ]
    });
    expect(m.values.pos).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('defaults members to 0 when no initial provided', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    expect(m.values.pos).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('uses external values by reference when provided', () => {
    const external = $state({ pos: { x: 10, y: 20, z: 30 } });
    const m = createManifold({
      values: external,
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    expect(m.values).toBe(external);
    expect(m.values.pos.x).toBe(10);
  });

  it('set() performs partial updates', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    m.set('pos', { x: 5 });
    expect(m.values.pos.x).toBe(5);
    expect(m.values.pos.y).toBe(0);
    expect(m.values.pos.z).toBe(0);
  });

  it('reset() restores initial values for a group', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'], initial: { x: 1, y: 2, z: 3 } }]
    });
    m.set('pos', { x: 99, y: 99, z: 99 });
    m.reset('pos');
    expect(m.values.pos).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('tracks active group', () => {
    const m = createManifold({
      groups: [
        { id: 'pos', members: ['x', 'y', 'z'] },
        { id: 'rot', members: ['x', 'y', 'z'] }
      ]
    });
    expect(m.activeGroup).toBe('pos');
    m.setActiveGroup('rot');
    expect(m.activeGroup).toBe('rot');
  });

  it('tracks modifier state', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    expect(m.modifier).toBe('base');
    m.setModifier('shift');
    expect(m.modifier).toBe('shift');
  });
});

describe('undo/redo', () => {
  it('undo reverts the last committed change', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    m.set('pos', { x: 5 });
    m.commit();
    m.set('pos', { x: 10 });
    m.commit();
    m.undo();
    expect(m.values.pos.x).toBe(5);
  });

  it('redo restores an undone change', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    m.set('pos', { x: 5 });
    m.commit();
    m.set('pos', { x: 10 });
    m.commit();
    m.undo();
    m.redo();
    expect(m.values.pos.x).toBe(10);
  });

  it('undo does nothing with no history', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    m.undo();
    expect(m.values.pos.x).toBe(0);
  });

  it('respects historySize limit', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x'] }],
      historySize: 3
    });
    for (let i = 1; i <= 5; i++) {
      m.set('pos', { x: i });
      m.commit();
    }
    m.undo();
    m.undo();
    m.undo();
    expect(m.values.pos.x).toBeLessThanOrEqual(3);
  });
});

describe('events', () => {
  it('onChange fires on set()', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    const handler = vi.fn();
    m.onChange(handler);
    m.set('pos', { x: 5 });
    expect(handler).toHaveBeenCalledWith({
      groupId: 'pos',
      member: 'x',
      oldValue: 0,
      newValue: 5
    });
  });

  it('onChange fires for each member changed', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    const handler = vi.fn();
    m.onChange(handler);
    m.set('pos', { x: 5, y: 10 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('destroy() cleans up event listeners', () => {
    const m = createManifold({
      groups: [{ id: 'pos', members: ['x', 'y', 'z'] }]
    });
    const handler = vi.fn();
    m.onChange(handler);
    m.destroy();
    m.set('pos', { x: 5 });
    expect(handler).not.toHaveBeenCalled();
  });
});
