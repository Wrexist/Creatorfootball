import * as T from 'three';

/**
 * Releasing a loaded model's GPU memory.
 *
 * `geometry.dispose()` and `material.dispose()` free buffers and shader
 * programs, but a material does not own its textures: each one is a separate
 * GPU upload that stays resident until it is disposed itself. The viewer is
 * rebuilt on every lighting or finish change, so a texture missed here is
 * leaked once per tap, and on a phone that ends in a lost WebGL context.
 */

/**
 * Every texture a material holds, in whichever slot — the standard maps
 * (`map`, `normalMap`, `roughnessMap`, `metalnessMap`, `emissiveMap`, `aoMap`,
 * ...), the physical extensions, an environment map, or a shader uniform.
 * Scanning the material rather than listing slots means a slot added by a
 * newer exporter or three.js release is not silently skipped.
 */
export function texturesOf(material: T.Material): T.Texture[] {
  const found = new Set<T.Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof T.Texture) found.add(value);
  }
  const uniforms = (material as Partial<T.ShaderMaterial>).uniforms;
  if (uniforms) {
    for (const uniform of Object.values(uniforms)) {
      const value: unknown = uniform?.value;
      if (value instanceof T.Texture) found.add(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof T.Texture) found.add(item);
    }
  }
  return [...found];
}

type Drawable = T.Mesh | T.Line | T.Points;

const isDrawable = (node: T.Object3D): node is Drawable =>
  node instanceof T.Mesh || node instanceof T.Line || node instanceof T.Points;

/**
 * Dispose every geometry, material and texture under `object`. Each resource
 * is released once even when the model shares it between meshes, as glTF
 * models routinely do.
 */
export function disposeObject(object: T.Object3D): void {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  object.traverse((node) => {
    if (!isDrawable(node)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
    }
  });
  const textures = new Set<T.Texture>();
  for (const material of materials) for (const texture of texturesOf(material)) textures.add(texture);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
