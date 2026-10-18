import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT||4188);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const name=decodeURIComponent(url.pathname);
  const file=resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+sep)||name.includes('\0')){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(file)).isFile())throw new Error('Not a file');
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Testla Rooster ready: http://127.0.0.1:${port}`));
