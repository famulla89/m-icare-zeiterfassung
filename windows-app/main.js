const {app, BrowserWindow, protocol, net, shell} = require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'micare',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const root=path.join(__dirname,'web');
app.whenReady().then(()=>{
  protocol.handle('micare',request=>{
    const url=new URL(request.url);
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const resolved=path.resolve(root,relative);
    if(resolved!==root && !resolved.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(resolved).toString());
  });
  const win=new BrowserWindow({width:1180,height:820,minWidth:400,minHeight:500,autoHideMenuBar:true,title:'M-iCare – Offline',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{if(url==='about:blank')return {action:'allow',overrideBrowserWindowOptions:{webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('micare://app/')){e.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url)}});
  win.loadURL('micare://app/index.html');
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});