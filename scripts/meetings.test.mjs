import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {openDatabase,createMeeting} from '../server/meetings.mjs';
const folder=mkdtempSync(join(tmpdir(),'livelayer-test-'));
const file=join(folder,'meetings.sqlite');
const valid={name:'Test guest',company:'Test company',email:'test@example.com',date:'2099-10-10',time:'10:00',details:'Selected ideas: Experience passport',consent:'yes',language:'ar'};
test('Meeting persistence, strict dates, consent and per-email rate limit',()=>{
 let db=openDatabase(file);
 assert.equal(createMeeting(db,{...valid,consent:'no'}).status,400);
 assert.equal(createMeeting(db,{...valid,date:'2099-02-31'}).status,400);
 assert.equal(createMeeting(db,{...valid,date:'2020-01-01'}).status,400);
 assert.equal(createMeeting(db,{...valid,website:'spam'}).status,400);
 const first=createMeeting(db,valid);assert.equal(first.status,201);
 db.close();db=openDatabase(file);
 assert.equal(db.prepare('SELECT details FROM meetings WHERE id=?').get(first.body.reference).details,valid.details);
 assert.equal(createMeeting(db,valid).status,201);assert.equal(createMeeting(db,valid).status,201);
 assert.equal(createMeeting(db,valid).status,429);db.close();
});
test('HTTP boundary, localized pages, compression, real 404 and private storage isolation',async()=>{
 const child=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,PORT:'0',DATA_FILE:file,SITE_ORIGIN:'https://live.asem.work'},stdio:['ignore','pipe','pipe']});
 try{
 const port=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('Start timed out')),10000);child.stdout.on('data',data=>{text+=data;const match=text.match(/port (\d+)/);if(match){clearTimeout(timer);resolve(match[1])}});child.on('error',reject)});
 const root='http://127.0.0.1:'+port;
 const send=(body,headers={})=>fetch(root+'/api/meetings',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://live.asem.work',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 assert.equal((await send({...valid,email:'api@example.com'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await send('{')).status,400);
 assert.equal((await send('x'.repeat(12001))).status,413);
 const accepted=await send({...valid,email:'api@example.com'});assert.equal(accepted.status,201);assert.match((await accepted.json()).reference,/^LL-[A-F0-9]{12}$/);
 for(const [path,lang]of [['/','ar'],['/en/','en']]){const response=await fetch(root+path);assert.equal(response.status,200);assert.match(await response.text(),new RegExp('<html lang="'+lang+'"'));assert.ok(response.headers.get('content-encoding'))}
 for(const path of ['/does-not-exist','/data/meetings.sqlite','/server/server.mjs','/.env'])assert.equal((await fetch(root+path)).status,404);
 assert.equal((await fetch(root+'/en',{redirect:'manual'})).status,301);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.on('exit',resolve));rmSync(folder,{recursive:true,force:true})}
});
