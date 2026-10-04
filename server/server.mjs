import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase,createMeeting} from './meetings.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(base,'public');
const db=openDatabase(process.env.DATA_FILE||resolve(base,'data/meetings.sqlite'));
const origin=process.env.SITE_ORIGIN||'https://live.asem.work';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const ipLimits=new Map();
const cleanup=setInterval(()=>{for(const [ip,limit]of ipLimits)if(limit.until<Date.now())ipLimits.delete(ip)},60000);cleanup.unref();
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
 const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/meetings'){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(405,{error:'Method not allowed'})}
  if(req.headers.origin!==origin)return json(403,{error:'Invalid origin'});
  if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Invalid origin'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'JSON required'});
  // Trust X-Real-IP only when Nginx is configured to overwrite it; service binds to loopback.
  const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
  const old=ipLimits.get(ip);const limit=old&&old.until>Date.now()?old:{count:0,until:Date.now()+3600000};
  if(++limit.count>30)return json(429,{error:'Too many requests'});ipLimits.set(ip,limit);
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12000){json(413,{error:'Too large'});return}chunks.push(chunk)}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(400,{error:'Invalid JSON'})}
  const result=createMeeting(db,body);return json(result.status,result.body);
 }
 if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed'});
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return json(400,{error:'Invalid URL'})}
 if(pathname==='/en'){res.writeHead(301,{Location:'/en/'});return res.end()}
 if(pathname==='/index.html'){res.writeHead(301,{Location:'/'});return res.end()}
 if(pathname==='/en/index.html'){res.writeHead(301,{Location:'/en/'});return res.end()}
 if(pathname.split('/').some(p=>p.startsWith('.')||p.includes('\\')))return json(404,{error:'Not found'});
 const file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+'/'))return json(404,{error:'Not found'});
 try{if(!(await stat(file)).isFile())throw new Error('missing')}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':await readFile(resolve(root,'404.html')))}
 let encoded=file,encoding;const accept=req.headers['accept-encoding']||'';
 if(/\bbr\b/.test(accept)){try{await stat(file+'.br');encoded=file+'.br';encoding='br'}catch{}}
 if(!encoding&&/\bgzip\b/.test(accept)){try{await stat(file+'.gz');encoded=file+'.gz';encoding='gzip'}catch{}}
 const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=604800':'public, max-age=0, must-revalidate','Vary':'Accept-Encoding'};
 if(encoding)headers['Content-Encoding']=encoding;
 res.writeHead(200,headers);res.end(req.method==='HEAD'?'':await readFile(encoded));
 }catch(error){console.error('Request failed:',error.code||error.name);if(!res.headersSent)json(500,{error:'Unable to complete request'});else res.end()}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||3080),'127.0.0.1',()=>console.log('LiveLayer listening on loopback port '+server.address().port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));
