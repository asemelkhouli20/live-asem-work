import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDatabase(file){
 mkdirSync(dirname(file),{recursive:true,mode:0o700});
 const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY,name TEXT NOT NULL,company TEXT NOT NULL,email TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,details TEXT NOT NULL,language TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'requested');
 CREATE INDEX IF NOT EXISTS meetings_email_created ON meetings(email,created_at);`);return db;
}
export function createMeeting(db,b,now=new Date()){
 if(!b||typeof b!=='object'||Array.isArray(b))return {status:400,body:{error:'Invalid fields'}};
 const field=k=>typeof b[k]==='string'?b[k].trim():'';
 const name=field('name'),company=field('company'),email=field('email').toLowerCase(),date=field('date'),time=field('time'),details=field('details');
 const parsed=new Date(date+'T00:00:00Z');
 if(field('website')||!name||name.length>120||!company||company.length>160||email.length>200||!/^\S+@\S+\.\S+$/.test(email)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||!['09:00','10:00','11:00','13:00','14:00','15:00','16:00'].includes(time)||new Date(date+'T'+time+':00+03:00')<=now||details.length>2000||b.consent!=='yes')return {status:400,body:{error:'Invalid fields'}};
 const recent=db.prepare('SELECT COUNT(*) AS n FROM meetings WHERE email=? AND created_at>=?').get(email,new Date(now.getTime()-3600000).toISOString());
 if(recent.n>=3)return {status:429,body:{error:'Too many requests'}};
 const id='LL-'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
 db.prepare('INSERT INTO meetings(id,name,company,email,date,time,details,language,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,name,company,email,date,time,details,b.language==='en'?'en':'ar',now.toISOString(),'requested');
 return {status:201,body:{reference:id,status:'requested'}};
}
