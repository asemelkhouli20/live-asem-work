import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
const db=new DatabaseSync(process.env.DATA_FILE||resolve('data/meetings.sqlite'),{readOnly:true});
const rows=db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all();
const columns=['id','name','company','email','date','time','details','language','created_at','status'];
const csv=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
console.log('\uFEFF'+columns.map(csv).join(','));for(const row of rows)console.log(columns.map(k=>csv(row[k])).join(','));db.close();
