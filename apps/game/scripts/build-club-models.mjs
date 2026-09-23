/* global Buffer, console, URL */
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { validateBytes } from 'gltf-validator';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildCampus } from './campus-model.mjs';

// Node exporter support. No browser, provider, texture downloads or paid jobs.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(data => { this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`; this.onloadend?.(); }); }
};
const out = new URL('../public/models/', import.meta.url);
await mkdir(out, { recursive: true });
const mats = {
  stone: new T.MeshStandardMaterial({ color: '#293734', roughness: .85 }),
  edge: new T.MeshStandardMaterial({ color: '#172622', roughness: .65 }),
  grass: new T.MeshStandardMaterial({ color: '#347650', roughness: 1 }),
  turf: new T.MeshStandardMaterial({ color: '#244f39', roughness: 1 }),
  line: new T.MeshStandardMaterial({ color: '#e4eee2', roughness: .65 }),
  primary: new T.MeshStandardMaterial({ color: '#beff1f', roughness: .55 }),
  secondary: new T.MeshStandardMaterial({ color: '#f2bf4c', roughness: .6 }),
  glass: new T.MeshStandardMaterial({ color: '#78a1aa', metalness: .65, roughness: .23 }),
  gold: new T.MeshStandardMaterial({ color: '#e6b847', metalness: .82, roughness: .26 }),
  light: new T.MeshStandardMaterial({ color: '#f4eccd', emissive: '#e9dba4', emissiveIntensity: .9 }),
};
for (const [name, mat] of Object.entries(mats)) mat.name = name;
function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const node = new T.Mesh(geometry, mats[material]); node.position.set(x,y,z); parent.add(node); return node;
}
function box(parent, w, h, d, material, x, y, z) { return mesh(parent, new T.BoxGeometry(w,h,d), material, x,y,z); }
function group(parent, name) { const g = new T.Group(); g.name = name; parent.add(g); return g; }
function trophy() {
  const root=new T.Group(); const g=group(root,'trophy');
  box(g,1.5,.25,1.25,'edge',0,.12,0); box(g,1.25,.14,1,'stone',0,.3,0);
  box(g,.54,.16,.024,'gold',0,.32,.51);
  const points=[[.42,0],[.45,.1],[.2,.18],[.11,.28],[.1,.72],[.26,.87],[.53,1],[.65,1.35],[.69,1.64],[.65,1.7],[.61,1.63],[.55,1.34],[.4,1.14],[.1,1.05]].map(([x,y])=>new T.Vector2(x,y));
  mesh(g,new T.LatheGeometry(points,40),'gold',0,.4,0);
  for(const sign of [-1,1]) { const h=mesh(g,new T.TorusGeometry(.38,.055,8,30,Math.PI*1.7),'gold',sign*.62,1.53,0); h.rotation.z=sign>0 ? -Math.PI*.85:Math.PI*.15; }
  return root;
}
function football() {
  const root=new T.Group(); const g=group(root,'football');
  mesh(g,new T.SphereGeometry(1,40,24),'line',0,1.12,0);
  const verts=new T.IcosahedronGeometry(1,0).getAttribute('position'); const seen=new Set();
  for(let i=0;i<verts.count;i++) {const normal=new T.Vector3().fromBufferAttribute(verts,i).normalize(); const key=normal.toArray().map(v=>v.toFixed(3)).join(','); if(seen.has(key)) continue; seen.add(key);
    const panel=mesh(g,new T.CircleGeometry(.24,5),'edge'); panel.position.copy(normal.multiplyScalar(1.006)); panel.position.y+=1.12; panel.lookAt(panel.position.clone().add(normal));
  }
  mesh(g,new T.CylinderGeometry(.74,.85,.12,40),'stone',0,.06,0);
  return root;
}
function kit(pattern) {
  const root=new T.Group(); const g=group(root,'kit');
  const shape=new T.Shape(); const coords=[[-.6,0],[.6,0],[.64,1.35],[.99,1.2],[1.22,1.71],[.65,2.08],[.33,2.2],[.2,2.04],[-.2,2.04],[-.33,2.2],[-.65,2.08],[-1.22,1.71],[-.99,1.2],[-.64,1.35]];
  coords.forEach(([x,y],i)=> i===0?shape.moveTo(x,y):shape.lineTo(x,y)); shape.closePath();
  mesh(g,new T.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.03}),'primary',0,.36,0);
  box(g,1.18,.07,.018,'secondary',0,.48,.2);
  if(pattern==='sash') {const sash=box(g,.16,1.93,.025,'secondary',0,1.35,.2); sash.rotation.z=-.39;}
  if(pattern==='hoops') for(let i=0;i<5;i++) box(g,1.16,.12,.025,'secondary',0,.7+i*.3,.2);
  if(pattern==='pinstripe') for(let i=0;i<7;i++) box(g,.022,1.55,.025,'secondary',-.48+i*.16,1.22,.2);
  const crest=mesh(g,new T.CircleGeometry(.095,5),'gold',.34,2.03,.235); crest.rotation.z=Math.PI;
  box(g,1.35,.09,.7,'stone',0,.05,.05); box(g,.04,2.15,.04,'edge',0,1.12,-.09);
  return root;
}
// Batch each independently visible facility by material before export.
function batch(root) {
  root.updateMatrixWorld(true);
  for(const group of [...root.children]) {
    const byMaterial=new Map();
    group.traverse(node=>{ if(node.isMesh) { const source=node.geometry; const geometry=(source.index ? source.toNonIndexed() : source.clone()).applyMatrix4(node.matrixWorld); const key=node.material.name; if(!byMaterial.has(key)) byMaterial.set(key,[]); byMaterial.get(key).push(geometry); } });
    group.clear(); group.position.set(0,0,0); group.rotation.set(0,0,0); group.scale.set(1,1,1);
    for(const [key,geometries] of byMaterial) {
      // These authored materials have no textures, so UVs only waste mobile memory.
      const merged=mergeGeometries(geometries).deleteAttribute('uv');
      group.add(new T.Mesh(mergeVertices(merged),mats[key])); merged.dispose();
      for(const geometry of geometries) geometry.dispose();
    }
  }
  return root;
}
const definitions = { campus:()=>buildCampus({mats,mesh,box,group}), trophy, football, 'kit-classic':()=>kit('classic'), 'kit-sash':()=>kit('sash'), 'kit-hoops':()=>kit('hoops'), 'kit-pinstripe':()=>kit('pinstripe') };
const sources=await Promise.all(['build-club-models.mjs','campus-model.mjs'].map(async name=>({path:`apps/game/scripts/${name}`,sha256:createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex')})));
const source=JSON.stringify(sources);
const manifest={version:2, sources, provenance:'Original source-authored procedural meshes. No external models, images or textures.', license:'Project-owned original assets; see repository licence. No third-party asset restrictions.', source:'apps/game/scripts/build-club-models.mjs', sourceSha256:createHash('sha256').update(source).digest('hex'), models:{}};
for(const [id,build] of Object.entries(definitions)) {
  const root=batch(build());
  let triangles=0,draws=0;
  root.traverse(node=>{if(node.isMesh) {draws++; triangles+=(node.geometry.index?.count ?? node.geometry.getAttribute('position').count)/3;}});
  const bytes=new Uint8Array(await new GLTFExporter().parseAsync(root,{binary:true}));
  const report=await validateBytes(bytes,{uri:`${id}.glb`});
  if(report.issues.numErrors || report.issues.numWarnings || triangles>50000 || draws>90 || bytes.length>1500000) throw new Error(`${id} fails model budget/validation: ${triangles} triangles, ${draws} draws, ${bytes.length} bytes; ${JSON.stringify(report.issues)}`);
  await writeFile(new URL(`${id}.glb`,out),bytes);
  manifest.models[id]={src:`/models/${id}.glb`,bytes:bytes.length,triangles,draws,sha256:createHash('sha256').update(bytes).digest('hex'),validation:{errors:report.issues.numErrors,warnings:report.issues.numWarnings}};
  console.log(`${id}: ${triangles} triangles, ${draws} draws, ${bytes.length} bytes; validated`);
}
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
