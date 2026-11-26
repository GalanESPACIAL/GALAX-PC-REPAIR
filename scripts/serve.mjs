import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const host = '127.0.0.1';
const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'
};

http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(root, url.replace(/^\//,''));
  if (!file.startsWith(root)) { res.statusCode=403; res.end('Forbidden'); return; }
  fs.readFile(file,(err,data)=>{
    if(err){ res.statusCode=404; res.end('Not found: '+url); return; }
    res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');
    res.end(data);
  });
}).listen(port,host,()=>{ console.log(`GALAX static server: http://${host}:${port}/`); });