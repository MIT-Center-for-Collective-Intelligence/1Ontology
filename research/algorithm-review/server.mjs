import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectCapture,canonical} from './public/model.mjs';
export async function createServer({port=0}={}) {
 const bytes=await readFile(new URL('./data/capture.json',import.meta.url));const capture=JSON.parse(bytes);const errors=inspectCapture(capture);
 if(errors.length)throw Error('Capture conformance failed: '+errors.join('; '));
 for(const a of capture.algorithms)if(createHash('sha256').update(canonical(a.procedure)).digest('hex')!==a.procedureHash)throw Error('Captured procedure digest mismatch');
 const hash=createHash('sha256').update(bytes).digest('hex');
 const files=new Map([['/','index.html'],['/app.mjs','app.mjs'],['/model.mjs','model.mjs'],['/style.css','style.css']]);
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
  if(req.method!=='GET'){res.writeHead(405,headers);res.end('Read-only capture service');return;}
  if(req.url==='/api/capture'){res.writeHead(200,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify({captureHash:hash,capture}));return;}
  const name=files.get(req.url);if(!name){res.writeHead(404,headers);res.end('Not found');return;}
  try{const data=await readFile(new URL('./public/'+name,import.meta.url));res.writeHead(200,{...headers,'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript'});res.end(data);}catch{res.writeHead(500,headers);res.end('Asset unavailable');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,url:`http://127.0.0.1:${server.address().port}`,captureHash:hash};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||0);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
 const {server,url}=await createServer({port});console.log('Captured review app: '+url);
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
}
