import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { disposeObject, texturesOf } from './dispose';

const watched = <R extends { addEventListener: (type: 'dispose', fn: () => void) => void }>(resource: R) => {
  const disposed = vi.fn();
  resource.addEventListener('dispose', disposed);
  return disposed;
};

describe('disposing a loaded model', () => {
  it('finds a texture in every standard material slot', () => {
    const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap',
      'alphaMap', 'bumpMap', 'displacementMap', 'lightMap', 'envMap'] as const;
    const material = new T.MeshStandardMaterial();
    const textures = slots.map((slot) => {
      const texture = new T.Texture();
      material[slot] = texture;
      return texture;
    });
    expect(new Set(texturesOf(material))).toEqual(new Set(textures));
  });

  it('finds physical-extension and shader-uniform textures too', () => {
    const clearcoat = new T.Texture(), sheen = new T.Texture();
    const physical = new T.MeshPhysicalMaterial({ clearcoatMap: clearcoat, sheenColorMap: sheen });
    expect(texturesOf(physical)).toEqual(expect.arrayContaining([clearcoat, sheen]));
    const uniform = new T.Texture();
    const shader = new T.ShaderMaterial({ uniforms: { tDiffuse: { value: uniform }, tint: { value: 1 } } });
    expect(texturesOf(shader)).toEqual([uniform]);
  });

  it('disposes geometry, materials and their textures, each exactly once', () => {
    const shared = new T.Texture(), normal = new T.Texture();
    const body = new T.MeshStandardMaterial({ map: shared, normalMap: normal });
    const trim = new T.MeshStandardMaterial({ map: shared, emissiveMap: new T.Texture() });
    const geometry = new T.BoxGeometry();
    const root = new T.Group();
    root.add(new T.Mesh(geometry, [body, trim]));
    root.add(new T.Mesh(geometry, body)); // glTF reuses buffers between nodes
    root.add(new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial()));

    const sharedDisposed = watched(shared), normalDisposed = watched(normal);
    const emissiveDisposed = watched(trim.emissiveMap!);
    const geometryDisposed = watched(geometry);
    const bodyDisposed = watched(body), trimDisposed = watched(trim);

    disposeObject(root);

    expect(sharedDisposed).toHaveBeenCalledTimes(1);
    expect(normalDisposed).toHaveBeenCalledTimes(1);
    expect(emissiveDisposed).toHaveBeenCalledTimes(1);
    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(bodyDisposed).toHaveBeenCalledTimes(1);
    expect(trimDisposed).toHaveBeenCalledTimes(1);
  });
});
