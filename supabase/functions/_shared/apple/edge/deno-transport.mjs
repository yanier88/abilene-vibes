import {Buffer} from 'node:buffer';
import {createTransport} from './transport.mjs';
import {demand,Reject} from './ocsp.mjs';
// Exact-IP connections retain DNS pinning. TLS, when selected by the trusted
// responder URL, authenticates that URL's hostname, never the IP as identity.
export function parseHttpResponse(bytes){
 demand(bytes.length<=81920,'RESPONSE_TOO_LARGE');const split=bytes.indexOf('\r\n\r\n');demand(split>=0&&split<=16384,'HTTP_HEADERS');
 const lines=bytes.subarray(0,split).toString('latin1').split('\r\n');const status=/^HTTP\/1\.[01] ([1-5][0-9]{2}) [\x20-\x7e]*$/.exec(lines.shift());demand(status,'HTTP_STATUS');
 const headers={};for(const line of lines){const m=/^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*([^\r\n]*)$/.exec(line);demand(m,'HTTP_HEADERS');const key=m[1].toLowerCase();demand(!Object.hasOwn(headers,key),'HTTP_DUPLICATE_HEADER');headers[key]=m[2].trim();}
 demand(!headers['content-encoding']||headers['content-encoding']==='identity','HTTP_ENCODING');
 const body=bytes.subarray(split+4);let payload;
 if(headers['transfer-encoding']){
  demand(headers['transfer-encoding']==='chunked'&&!headers['content-length'],'HTTP_FRAMING');let offset=0,total=0;const chunks=[];
  while(true){const end=body.indexOf('\r\n',offset);demand(end>=offset&&end-offset<=16,'HTTP_CHUNK');const h=body.subarray(offset,end).toString();demand(/^[0-9a-fA-F]+$/.test(h),'HTTP_CHUNK');const size=parseInt(h,16);demand(Number.isSafeInteger(size)&&size<=65536,'RESPONSE_TOO_LARGE');offset=end+2;
   if(size===0){demand(body.subarray(offset).equals(Buffer.from('\r\n')),'HTTP_TRAILER');break;}
   demand(offset+size+2<=body.length&&body[offset+size]===13&&body[offset+size+1]===10,'HTTP_CHUNK');total+=size;demand(total<=65536,'RESPONSE_TOO_LARGE');chunks.push(body.subarray(offset,offset+size));offset+=size+2;
  }payload=Buffer.concat(chunks);
 }else{if(headers['content-length']!==undefined)demand(/^(0|[1-9][0-9]*)$/.test(headers['content-length'])&&Number(headers['content-length'])===body.length,'HTTP_FRAMING');payload=body;}
 demand(payload.length<=65536,'RESPONSE_TOO_LARGE');return {status:Number(status[1]),headers,stream:[payload]};
}
async function exchangePinned({url,body,address,signal}){
 let socket;const close=()=>{try{socket?.close();}catch{}};signal.addEventListener('abort',close,{once:true});
 try {
  socket=await Deno.connect({hostname:address,port:url.protocol==='https:'?443:80});
  demand(!signal.aborted,'TIMEOUT');
  if(url.protocol==='https:'){socket=await Deno.startTls(socket,{hostname:url.hostname});demand(!signal.aborted,'TIMEOUT');}
  const request=Buffer.concat([Buffer.from(`POST ${url.pathname} HTTP/1.1\r\nHost: ${url.hostname}\r\nContent-Type: application/ocsp-request\r\nAccept: application/ocsp-response\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`),body]);
  let offset=0;while(offset<request.length){demand(!signal.aborted,'TIMEOUT');const n=await socket.write(request.subarray(offset));demand(n>0,'UNAVAILABLE');offset+=n;}
  const chunks=[];let size=0;while(true){const buf=new Uint8Array(8192);const n=await socket.read(buf);if(n===null)break;demand(!signal.aborted,'TIMEOUT');size+=n;demand(size<=81920,'RESPONSE_TOO_LARGE');chunks.push(Buffer.from(buf.subarray(0,n)));}
  return parseHttpResponse(Buffer.concat(chunks));
 }finally{close();signal.removeEventListener('abort',close);}
}
export function createDenoTransport({pairResolver,enabled=false}={}){
 return createTransport({enabled,pairResolver,resolve:async host=>(await Deno.resolveDns(host,'A')).map(address=>({address,family:4})),exchange:exchangePinned});
}
