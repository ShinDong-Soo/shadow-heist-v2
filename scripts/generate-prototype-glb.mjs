import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const faces = [
  { n: [1,0,0], v: [[.75,-.75,-.75],[.75,-.75,.75],[.75,.75,.75],[.75,.75,-.75]] },
  { n: [-1,0,0], v: [[-.75,-.75,.75],[-.75,-.75,-.75],[-.75,.75,-.75],[-.75,.75,.75]] },
  { n: [0,1,0], v: [[-.75,.75,-.75],[.75,.75,-.75],[.75,.75,.75],[-.75,.75,.75]] },
  { n: [0,-1,0], v: [[-.75,-.75,.75],[.75,-.75,.75],[.75,-.75,-.75],[-.75,-.75,-.75]] },
  { n: [0,0,1], v: [[.75,-.75,.75],[-.75,-.75,.75],[-.75,.75,.75],[.75,.75,.75]] },
  { n: [0,0,-1], v: [[-.75,-.75,-.75],[.75,-.75,-.75],[.75,.75,-.75],[-.75,.75,-.75]] },
];
const positions = new Float32Array(faces.flatMap(face => face.v.flat()));
const normals = new Float32Array(faces.flatMap(face => Array.from({ length: 4 }, () => face.n).flat()));
const indices = new Uint16Array(faces.flatMap((_, face) => {
  const start = face * 4;
  return [start,start+1,start+2,start,start+2,start+3];
}));
const binary = Buffer.alloc(positions.byteLength + normals.byteLength + indices.byteLength);
Buffer.from(positions.buffer).copy(binary, 0);
Buffer.from(normals.buffer).copy(binary, positions.byteLength);
Buffer.from(indices.buffer).copy(binary, positions.byteLength + normals.byteLength);

const gltf = {
  asset: { version: '2.0', generator: 'Shadow Heist V2 prototype GLB generator' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'BlenderPipelineTestCube', translation: [0, .75, 0] }],
  meshes: [{ name: 'PrototypeGLBCube', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'PrototypeBronze', pbrMetallicRoughness: { baseColorFactor: [.58,.38,.16,1], metallicFactor: .62, roughnessFactor: .34 } }],
  buffers: [{ byteLength: binary.byteLength }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
    { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength, target: 34962 },
    { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-.75,-.75,-.75], max: [.75,.75,.75] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
  ],
};
const json = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - json.length % 4) % 4;
const binPadding = (4 - binary.length % 4) % 4;
const paddedJson = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const paddedBin = Buffer.concat([binary, Buffer.alloc(binPadding)]);
const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(paddedJson.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(paddedBin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const output = resolve('public/models/prototype/test-cube.glb');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, jsonHeader, paddedJson, binHeader, paddedBin]));
console.log(`Generated ${output} (${totalLength} bytes)`);
