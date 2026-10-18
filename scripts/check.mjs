import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const files=(await readdir(new URL('src/',root))).filter(f=>f.endsWith('.js'));
let imports=0;
for(const name of files){const url=new URL('src/'+name,root);execFileSync(process.execPath,['--check',fileURLToPath(url)]);const code=await readFile(url,'utf8');for(const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g)){let path=m[1];if(path==='three')path='../vendor/three/three.module.js';else if(path.startsWith('three/addons/'))path='../vendor/three/addons/'+path.slice(13);assert.ok((await stat(new URL(path,url))).isFile());imports++;}}
for(const name of ['index.html','styles.css','START-GAME.cmd','vendor/three/LICENSE'])assert.ok((await stat(new URL(name,root))).size>0);
console.log(`Checked ${files.length} source modules and ${imports} imports; static game package is ready.`);
