const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:900}});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
await p.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+fs.readFileSync(process.argv[2],'utf8'));
const O=process.argv[3];
for(const [vp,lab] of [["ext",""],["tel",""],["ih",""],["iv",""],["esc",""]]){
  await p.click(`#g-vp button[data-v="${vp}"]`);await p.click('#g-f button[data-v="1"]');
  for(const t of ['claro','oscuro']){await p.click(`#g-t button[data-v="${t}"]`);await p.waitForTimeout(200);
    await p.screenshot({path:`${O}/rev-${vp}-${t}.png`,fullPage:true});}}
console.log('errores',errs.length,errs.slice(0,3));await b.close()})();
