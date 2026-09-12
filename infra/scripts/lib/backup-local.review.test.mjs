import fs from 'node:fs';
import test, { after } from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register, syncBuiltinESMExports } from 'node:module';

const impl = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = fs.mkdtempSync(path.join(tmpdir(), 'mt-backup-local-review-'));
const root = fixture;
const originalSpawn = cp.spawn;
const hash = x => createHash('sha256').update(x).digest('hex');
const databases = ['applicant','assessor','assistant','designer','gatherer','investigator','manager','scholar'];
const source = { systemIdentifier:'1234567890123456', serverVersion:160014,
  dataDirectory:'/var/lib/postgresql/data', configFile:'/var/lib/postgresql/data/postgresql.conf',
  hbaFile:'/var/lib/postgresql/data/pg_hba.conf', identFile:'/var/lib/postgresql/data/pg_ident.conf',
  databaseTime:'2026-09-12T10:00:00.000Z', totalDatabaseBytes:100,
  containerId:'a'.repeat(64), image:{reference:'docker.io/pgvector/pgvector@sha256:'+'b'.repeat(64),platform:'linux/amd64'} };
fs.writeFileSync(path.join(root,'source.mjs'), `export async function inspectBackupSource(){return ${JSON.stringify(source)}}\n`);
fs.writeFileSync(path.join(root,'loader.mjs'), `export async function resolve(spec,ctx,next){if(spec==='./backup-source.mjs'&&ctx.parentURL?.endsWith('/backup-local.mjs'))return {url:${JSON.stringify(pathToFileURL(path.join(root,'source.mjs')).href)},shortCircuit:true};return next(spec,ctx)}\n`);
register(pathToFileURL(path.join(root,'loader.mjs')).href);

const originalWrite = fs.writeFileSync;
let state = new Map(), calls = [], faults = {}, writes = [];
fs.writeFileSync = function(file, ...args) {
  writes.push(String(file));
  if(faults.failReceipt && path.basename(String(file)).startsWith('attempt-')) throw Object.assign(new Error('injected receipt write failure'),{code:'ENOSPC'});
  return originalWrite(file,...args);
};
function metadata(kind,name) { const item=state.get(kind+':'+name);return item?{Id:item.id,Labels:item.labels,Config:{Labels:item.labels}}:null; }
function response(args,input) {
  calls.push([...args]);
  let [kind,command] = args;
  if(kind==='pull')return [faults.failPull?1:0,'pulled'];
  if(kind==='image'&&command==='inspect')return [0,JSON.stringify({os:'linux',architecture:'amd64'})];
  if(command==='inspect') { const m=metadata(kind,args.at(-1));return m?[0,JSON.stringify([m])]:[1,'']; }
  if(command==='ls') {
    const filter=args[args.indexOf('--filter')+1]?.slice(5);
    return [0,[...state.entries()].filter(([k,v])=>k.startsWith(kind+':')&&v.name.includes(filter)).map(([,v])=>v.name).join('\n')];
  }
  if((kind==='volume'||kind==='network')&&command==='create'){
    const name=args.at(-1),label=args[args.indexOf('--label')+1],idx=label.indexOf('=');
    if(!state.has(kind+':'+name))state.set(kind+':'+name,{name,id:randomBytes(8).toString('hex'),labels:{[label.slice(0,idx)]:label.slice(idx+1)}});
    return [0,name];
  }
  if(kind==='run'){
    const name=args[args.indexOf('--name')+1],label=args[args.indexOf('--label')+1],idx=label.indexOf('=');
    if(state.has('container:'+name))return [1,''];
    const mounts=args.flatMap((s,i)=>s==='--mount'?[args[i+1].match(/source=([^,]+)/)?.[1]]:[]);
    state.set('container:'+name,{name,id:randomBytes(8).toString('hex'),labels:{[label.slice(0,idx)]:label.slice(idx+1)},mounts});return [0,name];
  }
  if(kind==='rm'||command==='rm'){
    const name=args.at(-1);if(kind==='rm')kind='container';
    if(faults.failWorkerRemoval&&kind==='container'&&name.endsWith('-worker'))return [1,''];
    if(kind==='volume'&&[...state.entries()].some(([k,v])=>k.startsWith('container:')&&v.mounts?.includes(name)))return [1,''];
    state.delete(kind+':'+name);return [0,name];
  }
  if(kind==='exec') {
    if(args.includes('df'))return [0,'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/mock 10000000 0 10000000 0% /data'];
    if(args.includes('psql')) {
      const sql=input.toString('utf8');
      if(sql.includes('NOT pg_is_in_recovery'))return [0,'t'];
      if(sql.includes('system_identifier'))return [0,source.systemIdentifier];
      if(sql.includes("'memberships'"))return [0,JSON.stringify({databases:[{name:'postgres',owner:'postgres',encoding:'UTF8'},...databases.map(name=>({name,owner:'postgres',encoding:'UTF8'}))],roles:[{rolname:'postgres',rolsuper:true}],memberships:[]})];
      if(sql.includes('FROM pg_extension'))return [0,'[]'];
      throw new Error('unhandled query');
    }
    if(args.includes('cat')) {
      const file=path.posix.basename(args.at(-1));
      if(file==='backup_manifest')return [0,JSON.stringify({'WAL-Ranges':[{'Timeline':1,'Start-LSN':'0/1','End-LSN':'0/2'}]})];
      return [faults.failProducer&&file==='base.tar'?1:0,'controlled '+file+' content'];
    }
    return [0,''];
  }
  throw new Error('unhandled docker command '+kind+' '+command);
}
cp.spawn = function(command,args) {
  assert.equal(command,'docker');const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
  const input=[];let closed=false;
  child.stdin.on('data',chunk=>input.push(chunk));
  const close=code=>{if(closed)return;closed=true;child.stdout.end();child.stderr.end();child.emit('close',code)};
  child.kill=()=>{child.stdin.destroy();close(137);return true};
  child.stdin.on('finish',()=>setImmediate(()=>{if(closed)return;try{const [code,out]=response(args,Buffer.concat(input));if(out)child.stdout.write(out);close(code)}catch(error){child.emit('error',error);close(1)}}));
  return child;
};
syncBuiltinESMExports();
const {createBackup,restoreBackup,verifyBackup}=await import(pathToFileURL(path.join(impl,'lib/backup-local.mjs')).href);
const {BackupResources}=await import(pathToFileURL(path.join(impl,'lib/backup-docker.mjs')).href);
const {signBackupManifest}=await import(pathToFileURL(path.join(impl,'lib/backup-crypto.mjs')).href);
function reset(){state=new Map();calls=[];faults={};writes=[]}
function setup(name){const dir=path.join(fixture,name);fs.mkdirSync(dir,{recursive:true});const keyFile=path.join(dir,'private.key'),credentialsFile=path.join(dir,'private.json');fs.writeFileSync(keyFile,randomBytes(32));fs.writeFileSync(credentialsFile,JSON.stringify({schema:'magictools-backup-credentials/1',user:'postgres',password:randomBytes(20).toString('hex')}));return {directory:path.join(dir,'store'),keyFile,credentialsFile,sourceContainer:'controlled-source',databases};}
const attempts=dir=>fs.readdirSync(dir).filter(n=>n.startsWith('attempt-')).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
async function check(name,fn){await test(name,async()=>{reset();await fn();});}

await check('create-valid-and-private-bytes-preserved',async()=>{
  const o=setup('valid'),key=fs.readFileSync(o.keyFile),credentials=fs.readFileSync(o.credentialsFile);
  const b=await createBackup(o);assert.equal(b.manifest.status,'complete');assert.equal(state.size,0);assert.equal(attempts(o.directory)[0].success,true);assert.equal(fs.existsSync(path.join(o.directory,'.lock')),false);assert.deepEqual(fs.readFileSync(o.keyFile),key);assert.deepEqual(fs.readFileSync(o.credentialsFile),credentials);
  const result=await verifyBackup({backupDirectory:b.directory,keyFile:o.keyFile});assert.equal(result.cleanup,'passed');assert.equal(state.size,0);
});
await check('cached-fixed-digest-allows-backup-when-registry-is-unavailable',async()=>{
  const o=setup('offline-cache');faults.failPull=true;
  const backup=await createBackup(o);assert.equal(backup.manifest.status,'complete');
  assert.equal(calls.some(args=>args[0]==='pull'),false);assert.equal(state.size,0);
});
await check('create-applies-retention-under-the-same-store-lock',async()=>{
  const o=setup('automatic-retention');const first=await createBackup({...o,keep:1});const second=await createBackup({...o,keep:1});
  assert.equal(fs.existsSync(first.directory),false);assert.equal(fs.existsSync(second.directory),true);
  assert.deepEqual(second.retention.removed,[first.backupId]);assert.equal(state.size,0);
});
await check('existing-targets-not-covered-or-removed',async()=>{
  const o=setup('existing'),b=await createBackup(o);
  for(const kind of ['container','network','volume']){state.clear();calls=[];const target='review-existing-'+kind,name=kind==='container'?target:target+(kind==='network'?'-net':'-data');state.set(kind+':'+name,{name,id:'foreign',labels:{owner:'someone-else'}});await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:target}),/目标已存在/);assert.equal(state.size,1);assert.equal(state.get(kind+':'+name).id,'foreign');assert.ok(!calls.some(a=>a[0]==='run'||a.includes('create')||a.includes('rm')))}
  assert.equal(attempts(o.directory).filter(x=>x.operation==='restore').length,3);assert.ok(attempts(o.directory).filter(x=>x.operation==='restore').every(x=>x.success===false));
});
await check('wrong-key-and-authenticated-manifest-tamper-rejected-before-docker',async()=>{
  const o=setup('wrong-key'),b=await createBackup(o),wrong=path.join(path.dirname(o.keyFile),'wrong.key');fs.writeFileSync(wrong,randomBytes(32));calls=[];await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:wrong,targetName:'review-wrong-key'}),/清单认证失败/);assert.equal(calls.length,0);assert.equal(state.size,0);
  const file=path.join(b.directory,'backup.json'),m=JSON.parse(fs.readFileSync(file));m.source.configFile='/etc/elsewhere';fs.writeFileSync(file,JSON.stringify(m));await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-tampered'}),/清单认证失败/);assert.equal(calls.length,0);
});
await check('ciphertext-corruption-rejects-cleans-and-records-failure',async()=>{
  const o=setup('corrupt'),b=await createBackup(o),file=path.join(b.directory,'base.tar.enc'),bytes=fs.readFileSync(file);bytes[0]^=1;fs.writeFileSync(file,bytes);
  await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-corruption'}));assert.equal(state.size,0);assert.equal(fs.existsSync(path.join(o.directory,'.lock')),false);const r=attempts(o.directory).find(x=>x.operation==='restore');assert.equal(r.success,false);assert.equal(r.stage,'decrypt');
});
await check('missing-wal-file-rejects-before-docker-and-records-failure',async()=>{
  const o=setup('missing-wal'),b=await createBackup(o);fs.unlinkSync(path.join(b.directory,'pg_wal.tar.enc'));calls=[];
  await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-missing-wal'}));assert.equal(calls.length,0);assert.equal(state.size,0);assert.equal(fs.existsSync(path.join(o.directory,'.lock')),false);const r=attempts(o.directory).find(x=>x.operation==='restore');assert.equal(r.success,false);assert.equal(r.stage,'preflight');
});
await check('producer-failure-no-complete-and-resources-clean',async()=>{
  const o=setup('producer');faults.failProducer=true;await assert.rejects(createBackup(o));assert.equal(state.size,0);assert.equal(fs.readdirSync(o.directory).filter(n=>n.startsWith('backup-')).length,0);const r=attempts(o.directory)[0];assert.equal(r.success,false);assert.equal(r.stage,'encrypt');assert.equal(fs.existsSync(path.join(o.directory,'.lock')),false);
});
await check('cleanup-failure-never-publishes-success',async()=>{
  const o=setup('cleanup');faults.failWorkerRemoval=true;await assert.rejects(createBackup(o),/清理失败/);assert.equal(fs.readdirSync(o.directory).filter(n=>n.startsWith('backup-')).length,0);const r=attempts(o.directory)[0];assert.equal(r.success,false);assert.equal(r.stage,'cleanup');assert.ok(r.cleanupError);assert.equal(fs.existsSync(path.join(o.directory,'.lock')),false);
});
await check('foreign-resource-ownership-protected',async()=>{
  const owner=new BackupResources('1234567890123456');await owner.create('volume','review-owned',['volume','create','--label',owner.label,'review-owned']);state.get('volume:review-owned').labels={'magictools.backup.operation':'foreign'};calls=[];await assert.rejects(owner.cleanup(),/清理失败/);assert.ok(state.has('volume:review-owned'));assert.ok(!calls.some(a=>a.includes('rm')));
});
await check('store-alias-must-not-allow-private-key-inside-store',async()=>{
  const o=setup('alias'),b=await createBackup(o),insideKey=path.join(o.directory,'misplaced.key');fs.copyFileSync(o.keyFile,insideKey);const alias=path.join(path.dirname(o.keyFile),'store-alias');fs.symlinkSync(o.directory,alias,'junction');calls=[];
  await assert.rejects(createBackup({...o,directory:alias,keyFile:insideKey}),/私有文件必须独立/);
});
await check('receipt-failure-must-not-leave-unreported-restored-targets',async()=>{
  const o=setup('receipt'),b=await createBackup(o);faults.failReceipt=true;await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-receipt-failure'}),error=>{assert.match(error.message,/receipt write failure/);assert.match(error.operationId,/^[a-f0-9]{16}$/);assert.deepEqual(error.resources,[]);return true});assert.equal(state.size,0,'restore rejects but retained resources: '+[...state.keys()].join(','));
});
await check('store-alias-rejects-private-credentials-inside-store',async()=>{
  const o=setup('credentials-alias');await createBackup(o);const misplaced=path.join(o.directory,'misplaced-credentials.json');fs.copyFileSync(o.credentialsFile,misplaced);const alias=path.join(path.dirname(o.keyFile),'credentials-store-alias');fs.symlinkSync(o.directory,alias,'junction');calls=[];
  await assert.rejects(createBackup({...o,directory:alias,credentialsFile:misplaced}),/私有文件必须独立/);assert.equal(calls.length,0);assert.equal(state.size,0);
});
await check('new-store-under-existing-ancestor-alias-is-canonical-and-valid',async()=>{
  const o=setup('ancestor-alias'),parent=path.dirname(o.keyFile),alias=path.join(fixture,'new-ancestor-alias');fs.symlinkSync(parent,alias,'junction');const result=await createBackup({...o,directory:path.join(alias,'new-store')});assert.equal(path.dirname(result.directory),path.join(parent,'new-store'));assert.equal(state.size,0);
});
await check('signed-manifest-schema-boundaries-reject-before-docker',async()=>{
  const o=setup('manifest-schema'),b=await createBackup(o),key=fs.readFileSync(o.keyFile),file=path.join(b.directory,'backup.json');
  const changes=[m=>m.status='pending',m=>m.files.pop(),m=>m.files[0].fileName='../base.tar',m=>m.files[1].nonce=m.files[0].nonce,m=>m.files[0].plainBytes=0,m=>m.files[0].plainBytes=32*1024**3+1,m=>m.files[0].encryptedBytes++,m=>m.files[0].sha256='invalid',m=>m.source.image.platform='windows/amd64',m=>m.source.image.reference='repo:latest',m=>m.source.dataDirectory='/',m=>m.databases=[],m=>m.databases=['manager;drop'],m=>m.walRanges=[],m=>m.catalogSha256='invalid'];
  for(const change of changes){const manifest=structuredClone(b.manifest);change(manifest);fs.writeFileSync(file,JSON.stringify(signBackupManifest(manifest,key)));calls=[];await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-bad-schema'}));assert.equal(calls.length,0);assert.equal(state.size,0)}
});
await check('signed-ciphertext-hash-mismatch-cleans-and-records-failure',async()=>{
  const o=setup('manifest-hash'),b=await createBackup(o),m=structuredClone(b.manifest);m.files[0].sha256='0'.repeat(64);fs.writeFileSync(path.join(b.directory,'backup.json'),JSON.stringify(signBackupManifest(m,fs.readFileSync(o.keyFile))));
  await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-wrong-hash'}),/摘要不匹配/);assert.equal(state.size,0);const report=attempts(o.directory).find(x=>x.operation==='restore');assert.equal(report.success,false);assert.equal(report.stage,'decrypt');
});
await check('truncated-ciphertext-rejects-before-docker-and-preserves-backup',async()=>{
  const o=setup('truncated'),b=await createBackup(o),file=path.join(b.directory,'pg_wal.tar.enc'),bytes=fs.readFileSync(file);fs.writeFileSync(file,bytes.subarray(1));calls=[];
  await assert.rejects(restoreBackup({backupDirectory:b.directory,keyFile:o.keyFile,targetName:'review-truncated'}),/大小错误/);assert.equal(calls.length,0);assert.ok(fs.existsSync(path.join(b.directory,'backup.json')));assert.equal(state.size,0);
});
await check('actual-cli-error-json-includes-operation-and-residual-identities',async()=>{
  const o=setup('cli-finalization'),b=await createBackup(o),oldArgv=process.argv,oldError=console.error,oldExit=process.exitCode;let timeout;
  try{
    const output=new Promise((resolve,reject)=>{console.error=value=>resolve(String(value));timeout=setTimeout(()=>reject(new Error('CLI output timed out')),5000)});
    faults.failReceipt=true;faults.failWorkerRemoval=true;
    process.argv=[process.execPath,path.join(impl,'backup.mjs'),'restore','--backup',b.directory,'--key-file',o.keyFile,'--target','review-cli-finalization'];
    await import(pathToFileURL(path.join(impl,'backup.mjs')).href);const text=await output,body=JSON.parse(text);
    assert.equal(process.exitCode,1);assert.equal(body.success,false);assert.match(body.operationId,/^[a-f0-9]{16}$/);assert.ok(body.resources.length>0);assert.deepEqual(body.resources.map(x=>x.kind+':'+x.name).sort(),[...state.keys()].sort());
    for(const item of state.values())assert.equal(item.labels['magictools.backup.operation'],body.operationId);
    assert.ok(!text.includes(fs.readFileSync(o.keyFile).toString('hex')));assert.ok(!text.includes(JSON.parse(fs.readFileSync(o.credentialsFile,'utf8')).password));
    assert.ok(!state.has('container:review-cli-finalization'));assert.ok(!state.has('network:review-cli-finalization-net'));
  }finally{clearTimeout(timeout);console.error=oldError;process.argv=oldArgv;process.exitCode=oldExit}
});

await check('automatic-retention-protects-new-backup-during-clock-rollback', async()=>{
  const o=setup('clock-rollback'); const first=await createBackup({...o,keep:1});
  const manifest=structuredClone(first.manifest); manifest.completedAt='2099-01-01T00:00:00.000Z';
  fs.writeFileSync(path.join(first.directory,'backup.json'),JSON.stringify(signBackupManifest(manifest,fs.readFileSync(o.keyFile))));
  const second=await createBackup({...o,keep:1});
  assert.ok(fs.existsSync(second.directory)); assert.deepEqual(second.retention.kept,[second.backupId]); assert.deepEqual(second.retention.removed,[first.backupId]);
});

// 所有Docker与源检查都使用受控边界；真实数据库链路由backup:validate另行执行。
after(() => {
  fs.writeFileSync = originalWrite; cp.spawn = originalSpawn; syncBuiltinESMExports();
  const resolved = path.resolve(fixture);
  if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep + 'mt-backup-local-review-') || fs.lstatSync(fixture).isSymbolicLink()) throw new Error('Unexpected fixture cleanup path');
  fs.rmSync(fixture, { recursive: true });
});
