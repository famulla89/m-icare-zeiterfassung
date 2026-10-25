'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('MiCareDesktopFiles',Object.freeze({
 getFolder:()=>ipcRenderer.invoke('micare:getFolder'),
 chooseFolder:()=>ipcRenderer.invoke('micare:chooseFolder'),
 saveFile:(args)=>ipcRenderer.invoke('micare:saveFile',args),
 composeEmail:(args)=>ipcRenderer.invoke('micare:composeEmail',args)
}));
