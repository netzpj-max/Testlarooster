import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
let runtime;
try{runtime=await import('playwright');}
catch{
 const bundled=process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright','index.mjs');
 runtime=await import(pathToFileURL(bundled).href);
}
export const chromium=runtime.chromium;
export function browserOptions(){
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 return {headless:true,...(existsSync(chrome)?{executablePath:chrome}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']};
}
