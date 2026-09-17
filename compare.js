/* Pure comparison logic: unknown empty cells are never classified as free. */
(function(root){
 function cell(people,day,period){
  const rows=people.map(p=>{const slot=p.Slots.find(s=>s.Day===day&&s.Period===period);return {person:p,slot,status:slot?'busy':p.ConfirmedAt?'free':'unknown'};});
  const busy=rows.filter(r=>r.status==='busy').length,unknown=rows.filter(r=>r.status==='unknown').length,free=rows.length-busy-unknown;
  return {rows,busy,unknown,free,total:rows.length,state:unknown?'unknown':busy===0?'free':free===0?'busy':'partial'};
 }
 function windows(people,length){
  if(!people.length||!Number.isInteger(length)||length<1||length>12)return [];
  const out=[];for(let d=1;d<=6;d++)for(let p=1;p<=13-length;p++)if(Array.from({length},(_,i)=>cell(people,d,p+i)).every(c=>c.free===people.length))out.push({day:d,start:p,end:p+length-1});return out;
 }
 root.P126Compare={cell,windows};
 if(typeof module!=='undefined')module.exports=root.P126Compare;
})(typeof window==='undefined'?globalThis:window);
