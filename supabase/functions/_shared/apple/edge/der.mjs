// Shared bounded DER traversal; independent of certificate trust.
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
// Strict bounded TLV traversal, including encapsulated BasicOCSPResponse below.
export function derTree(b){
 let count=0;
 function read(start,end,depth){
  demand(depth<32&&++count<4096&&start+2<=end,'REJECT_PARSE');
  let p=start,tag=b[p++],len=b[p++];demand((tag&31)!==31,'REJECT_PARSE');
  if(len&128){const n=len&127;demand(n>0&&n<=4&&p+n<=end&&b[p]!==0,'REJECT_PARSE');len=0;for(let i=0;i<n;i++)len=len*256+b[p++];demand(len>=128,'REJECT_PARSE');}
  demand(p+len<=end,'REJECT_PARSE');const out={tag,start,value:p,end:p+len,children:[]};
  if(tag&32){let k=p;while(k<out.end){const c=read(k,out.end,depth+1);out.children.push(c);k=c.end;}demand(k===out.end,'REJECT_PARSE');}
  if(tag===1)demand(len===1&&(b[p]===0||b[p]===255),'REJECT_PARSE');
  if(tag===2||tag===10)demand(len>0&&!(len>1&&((b[p]===0&&b[p+1]<128)||(b[p]===255&&b[p+1]>=128))),'REJECT_PARSE');
  if(tag===3)demand(len>0&&b[p]<=7&&(len>1||b[p]===0)&&(b[out.end-1]&((1<<b[p])-1))===0,'REJECT_PARSE');
  if(tag===5)demand(len===0,'REJECT_PARSE');
  return out;
 }
 const t=read(0,b.length,0);demand(t.end===b.length,'REJECT_PARSE');return t;
}
