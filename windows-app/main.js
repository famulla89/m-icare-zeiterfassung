'use strict';
const {app,BrowserWindow,protocol,net,shell,dialog,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'micare',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const root=path.join(__dirname,'web');
let targetFolder='';
const allowedDirs=new Set(['Backups','Kostenvoranschlaege','Rechnungsentwuerfe','Rechnungen','Angebote','Kundendaten','Termine','Arbeitszeiten','Reporting']);
const configFile=()=>path.join(app.getPath('userData'),'folder-config.json');
async function writeConfig(){await fs.writeFile(configFile(),JSON.stringify({folder:targetFolder}),{encoding:'utf8',mode:0o600})}
function validDocumentName(name){return typeof name==='string'&&name.length<=180&&/^[A-Za-z0-9_\-\.]+\.(?:json|pdf|xlsx|csv)$/i.test(name)&&!name.includes('..')&&path.basename(name)===name}
function validSender(event){return event.sender.getURL().startsWith('micare://app/')}
app.whenReady().then(async()=>{
 try{
  const config=JSON.parse(await fs.readFile(configFile(),'utf8'));
  if(typeof config.folder==='string'&&path.isAbsolute(config.folder)){
   const st=await fs.stat(config.folder).catch(()=>null);
   if(st?.isDirectory())targetFolder=config.folder;
  }
 }catch{}
 ipcMain.handle('micare:getFolder',event=>validSender(event)?targetFolder:null);
 ipcMain.handle('micare:chooseFolder',async event=>{
  if(!validSender(event))throw Error('Unzulässiger Ursprung');
  const {canceled,filePaths}=await dialog.showOpenDialog({title:'M-iCare – Hauptordner für PDFs und Datensicherungen wählen',properties:['openDirectory','createDirectory']});
  if(canceled||!filePaths.length)return '';
  const selected=path.resolve(filePaths[0]);
  const st=await fs.stat(selected);
  if(!st.isDirectory())throw Error('Kein Ordner ausgewählt');
  targetFolder=selected;await writeConfig();return targetFolder;
 });

 ipcMain.handle('micare:composeEmail',async(event,args)=>{
  if(!validSender(event))throw Error('Unzulässiger Ursprung');
  const {recipient,subject,body,name,base64}=args||{};
  if(typeof recipient!=='string'||recipient.length>254||!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(recipient))throw Error('Kunden-E-Mail ungültig');
  if(typeof subject!=='string'||subject.length>250||/[\r\n]/.test(subject))throw Error('Betreff ungültig');
  if(typeof body!=='string'||body.length>5000)throw Error('Nachricht ungültig');
  if(typeof name!=='string'||!/^M-iCare_Rechnung_[A-Za-z0-9_-]+\.pdf$/.test(name))throw Error('PDF-Dateiname ungültig');
  if(typeof base64!=='string'||base64.length>28e6||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('PDF-Anhang ungültig');
  const pdf=Buffer.from(base64,'base64');
  if(pdf.length>20*1024*1024||pdf.subarray(0,5).toString()!=='%PDF-')throw Error('Anhang ist keine gültige PDF-Datei');
  const safeName=name.replace(/\.pdf$/,'');
  const boundary='MiCare_'+Date.now();
  const text64=Buffer.from(body,'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const pdf64=(base64.match(/.{1,76}/g)||[]).join('\r\n');
  const subject64=Buffer.from(subject,'utf8').toString('base64');
  const eml='To: '+recipient+'\r\nSubject: =?UTF-8?B?'+subject64+'?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="'+boundary+'"\r\n\r\n--'+boundary+'\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+text64+'\r\n--'+boundary+'\r\nContent-Type: application/pdf; name="'+name+'"\r\nContent-Disposition: attachment; filename="'+name+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+pdf64+'\r\n--'+boundary+'--\r\n';
  const dir=targetFolder?path.join(targetFolder,'Rechnungen','E-Mail-Entwuerfe'):path.join(app.getPath('userData'),'Email-Entwuerfe');
  await fs.mkdir(dir,{recursive:true});
  const dest=path.join(dir,safeName+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.eml');
  await fs.writeFile(dest,eml,{flag:'wx'});
  const openError=await shell.openPath(dest);
  return {path:dest,opened:openError==='',error:openError||''};
 });
 ipcMain.handle('micare:saveFile',async(event,args)=>{
  if(!validSender(event))throw Error('Unzulässiger Ursprung');
  if(!targetFolder)throw Error('Bitte zuerst einen Speicherordner auswählen');
  if(!args||!allowedDirs.has(args.subdir)||!validDocumentName(args.name)||typeof args.base64!=='string'||args.base64.length>28e6||!/^[A-Za-z0-9+/]*={0,2}$/.test(args.base64))throw Error('Ungültiger Datei-Export');
  const buf=Buffer.from(args.base64,'base64');
  if(buf.length>20*1024*1024)throw Error('Export über 20 MB');
  const dir=path.join(targetFolder,args.subdir);
  await fs.mkdir(dir,{recursive:true});
  const filename=args.name;
  const filepath=path.join(dir,filename);
  // Never silently overwrite an existing PDF export. Snapshots have stable names by design.
  if(!args.overwrite&&await fs.stat(filepath).then(()=>true).catch(()=>false)){
   const e=path.extname(filename),n=filename.slice(0,-e.length),suffix=new Date().toISOString().replace(/[:.]/g,'-');
   const unique=path.join(dir,n+'_'+suffix+e);
   await fs.writeFile(unique,buf,{flag:'wx'});
   return unique;
  }
  await fs.writeFile(filepath,buf);
  return filepath;
 });
 protocol.handle('micare',request=>{
  const url=new URL(request.url);
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const resolved=path.resolve(root,relative);
  if(resolved!==root && !resolved.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
  return net.fetch(pathToFileURL(resolved).toString());
 });
 const win=new BrowserWindow({width:1180,height:820,minWidth:400,minHeight:500,autoHideMenuBar:true,title:'M-iCare – Offline',
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.js')}});
 win.webContents.setWindowOpenHandler(({url})=>{if(url==='about:blank')return {action:'allow',overrideBrowserWindowOptions:{webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('micare://app/')){e.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url)}});
 win.loadURL('micare://app/index.html');
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
