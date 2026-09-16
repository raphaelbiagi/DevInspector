const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({ 
    width: 512, 
    height: 512, 
    show: false,
    useContentSize: true,
    frame: false,
    transparent: false
  });
  
  const html = `
    <html>
      <body style="margin:0; background:#09090b; display:flex; align-items:center; justify-content:center; width:512px; height:512px; overflow:hidden;">
        <svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 24 24"><g fill="none" stroke="#3B82F6" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 20v-9m2-4a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4zm.12-3.12L16 2"/><path d="M21 21a4 4 0 0 0-3.81-4M21 5a4 4 0 0 1-3.55 3.97M22 13h-4M3 21a4 4 0 0 1 3.81-4M3 5a4 4 0 0 0 3.55 3.97M6 13H2M8 2l1.88 1.88M9 7.13V6a3 3 0 1 1 6 0v1.13"/></g></svg>
      </body>
    </html>
  `;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  
  win.webContents.on('did-finish-load', async () => {
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        const buildDir = path.join(__dirname, 'build');
        if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
        const pngPath = path.join(buildDir, 'icon.png');
        const icoPath = path.join(buildDir, 'icon.ico');
        fs.writeFileSync(pngPath, image.toPNG());
        
        const pngToIco = require('png-to-ico');
        const fn = pngToIco.default || pngToIco;
        const icoBuffer = await fn(pngPath);
        fs.writeFileSync(icoPath, icoBuffer);
        
        console.log('Icon PNG and ICO generated successfully!');
      } catch (err) {
        console.error('Error generating icon:', err);
      } finally {
        app.quit();
      }
    }, 1000);
  });
});
