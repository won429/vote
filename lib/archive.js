import {parseText,parseBinary,shortSource} from './parser.js?v=20261103-3';
const MiB=1024**2;
export const LIMITS={input:1536*MiB,entry:24*MiB,totalText:128*MiB,expanded:4*1024**3,entries:100000,parsed:800};
const decoder=new TextDecoder();
const textExtensions=/\.(?:ips|json|jsonl|ndjson|plist|xml|txt|log|csv)(?:\.gz)?$/i;
const eligible=name=>!/(?:^|\/)\._|__MACOSX|\.logarchive\//i.test(name)&&(textExtensions.test(name)||/\/(?:IODeviceTree|IOService|IOPower)$/.test(name));
// A network UUID cache has a CUEN header despite its .plist suffix; it contains
// app/network identities, not component data. ProxiedDevice is a paired device.
const unrelated=name=>/(?:^|\/)ProxiedDevice\//i.test(name)||/(?:^|\/)Networking\/com\.apple\.networkextension\.uuidcache\.plist$/i.test(name);
const relevant=name=>eligible(name)&&!unrelated(name)&&(/ioreg|battery|gasgauge|systemversion|systeminfo|sysctl|analytics|aggregated|log-aggregated|disk|storage|hardware|device|display|camera|memory|gestalt/i.test(name)||/\.(json|plist|ips)$/i.test(name));

class Cursor{
  constructor(stream,onBytes=()=>{}){this.reader=stream.getReader();this.chunk=new Uint8Array();this.offset=0;this.total=0;this.onBytes=onBytes;}
  async take(size,keep=true,allowEOF=false){
    const result=keep?new Uint8Array(size):null;let done=0;
    while(done<size){
      if(this.offset===this.chunk.length){const part=await this.reader.read();if(part.done){if(allowEOF&&done===0)return null;throw new Error('압축 파일이 중간에 잘렸습니다. 원본 파일을 다시 가져와 주세요.');}this.chunk=part.value;this.offset=0;}
      const n=Math.min(size-done,this.chunk.length-this.offset);if(keep)result.set(this.chunk.subarray(this.offset,this.offset+n),done);this.offset+=n;done+=n;this.total+=n;
      if(this.total>LIMITS.expanded)throw new Error('압축 해제 데이터가 4 GB를 초과합니다. ioreg 파일만 따로 가져와 주세요.');
      this.onBytes(this.total);
    }
    return result;
  }
  async close(){try{await this.reader.cancel();}catch{}}
  async drain(){
    this.total+=this.chunk.length-this.offset;this.offset=this.chunk.length;
    while(true){const {done,value}=await this.reader.read();if(done)break;this.total+=value.length;if(this.total>LIMITS.expanded)throw new Error('압축 해제 데이터가 4 GB를 초과합니다.');}
  }
}
function octal(bytes){
  if(bytes[0]&128)throw new Error('지원하지 않는 대용량 TAR 숫자 형식입니다.');
  const s=decoder.decode(bytes).replace(/\0/g,'').trim();if(!/^[0-7]*$/.test(s))throw new Error('손상된 TAR 크기입니다.');return parseInt(s||'0',8);
}
const cstring=bytes=>decoder.decode(bytes).split('\0')[0];
function tarChecksum(header){const expected=octal(header.subarray(148,156));let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:header[i];return sum===expected;}
function isTar(header){try{return header.length>=512&&header.some(Boolean)&&tarChecksum(header);}catch{return false;}}
async function decompress(bytes,format){
  if(!globalThis.DecompressionStream)throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다. 최신 Safari 또는 Chrome을 이용하거나 압축을 푼 파일을 가져와 주세요.');
  let transform;try{transform=new DecompressionStream(format);}catch{throw new Error('이 브라우저에서 ZIP 압축 방식을 지원하지 않습니다. 압축을 푼 ioreg 파일이나 원본 .tar.gz 파일을 가져와 주세요.');}
  const reader=new Blob([bytes]).stream().pipeThrough(transform).getReader();const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMITS.entry)throw new Error('압축 해제한 개별 파일이 24 MB를 초과합니다.');chunks.push(value);}}finally{try{await reader.cancel();}catch{}}
  const out=new Uint8Array(size);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return out;
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export async function analyzeFiles(files,analysis,onProgress=()=>{}){
  if(!files.length)throw new Error('분석할 파일을 선택해 주세요.');
  const totalInput=files.reduce((n,f)=>n+f.size,0);if(totalInput>LIMITS.input)throw new Error('선택한 파일이 1.5 GB를 초과합니다. 압축을 푼 뒤 ioreg 폴더와 BatteryBDC 폴더만 가져와 주세요.');
  let textBytes=0,doneInput=0,lastUpdate=0,lastPercent=0,budgetNotice=false;
  function progress(name,bytes=0,force=false){const now=Date.now();if(force||now-lastUpdate>120){lastUpdate=now;lastPercent=Math.max(lastPercent,Math.min(98,Math.round((doneInput+bytes)/Math.max(totalInput,1)*98)));onProgress({name:shortSource(name),percent:lastPercent,...analysis.stats});}}
  function seen(){analysis.stats.filesSeen++;if(analysis.stats.filesSeen>LIMITS.entries)throw new Error('압축 파일의 항목 수가 너무 많습니다. ioreg 폴더만 따로 가져와 주세요.');}
  function canRead(name,size,archive=false){
    // Unrelated large logs must not report a component-analysis limit failure.
    if(!(archive?relevant(name):eligible(name))){analysis.stats.filesSkipped++;return false;}
    if(size>LIMITS.entry||textBytes+size>LIMITS.totalText||analysis.stats.filesParsed>=LIMITS.parsed){analysis.stats.filesSkipped++;if(!budgetNotice){analysis.warnings.push('일부 큰 파일 또는 분석 한도를 넘은 파일은 건너뛰었습니다. 빠진 부품은 ioreg 파일을 따로 가져와 확인해 주세요.');budgetNotice=true;}return false;}
    return true;
  }
  async function consume(bytes,name){
    if(/\.gz$/i.test(name)){bytes=await decompress(bytes,'gzip');name=name.slice(0,-3);}
    textBytes+=bytes.length;if(textBytes>LIMITS.totalText)throw new Error('분석 대상 텍스트가 128 MB를 초과했습니다. 필요한 로그만 가져와 주세요.');
    try{
      if(decoder.decode(bytes.subarray(0,8))==='bplist00')parseBinary(bytes,name,analysis);
      else if(!bytes.subarray(0,1024).includes(0))parseText(decoder.decode(bytes),name,analysis);
      else {analysis.stats.filesSkipped++;analysis.warnings.push(`${shortSource(name)}: 지원하지 않는 바이너리 형식입니다.`);}
    }catch(error){analysis.stats.parseErrors++;analysis.warnings.push(`${shortSource(name)}: ${error.message}`);}
  }
  async function tar(stream,file){
    const cursor=new Cursor(stream);let longName=null,paxName=null,archiveRead=0;
    try{
      while(true){
        const h=await cursor.take(512,true,true);if(!h)throw new Error('TAR 종료 헤더가 없습니다. 파일이 잘렸을 수 있습니다.');
        if(h.every(v=>v===0)){const end=await cursor.take(512,true,true);if(!end||end.some(Boolean))throw new Error('TAR 종료 헤더가 손상되었습니다.');await cursor.drain();break;}
        if(!tarChecksum(h))throw new Error('TAR 헤더 검증에 실패했습니다. 정상적인 sysdiagnose 파일을 선택해 주세요.');
        seen();const size=octal(h.subarray(124,136));if(size>LIMITS.expanded)throw new Error('TAR 항목이 허용 크기를 초과합니다.');
        const type=String.fromCharCode(h[156]);const prefix=cstring(h.subarray(345,500));
        const name=longName||paxName||((prefix?prefix+'/':'')+cstring(h.subarray(0,100)));longName=null;paxName=null;
        const padded=Math.ceil(size/512)*512;
        if(type==='L'||type==='x'||type==='g'){
          if(size>MiB)throw new Error('TAR 메타데이터가 너무 큽니다.');const meta=decoder.decode(await cursor.take(size));
          if(type==='L')longName=meta.replace(/\0.*$/s,'');
          if(type==='x')paxName=meta.match(/(?:^|\n)\d+ path=([^\n]+)/)?.[1]||null;
        }else if((type==='0'||type==='\0')&&canRead(name,size,true)){await consume(await cursor.take(size),name);}
        else await cursor.take(size,false);
        await cursor.take(padded-size,false);archiveRead++;progress(name,Math.min(file.size*.95,cursor.total/4));
      }
      if(!archiveRead)throw new Error('압축 파일에 읽을 수 있는 항목이 없습니다.');
    }finally{await cursor.close();}
  }
  async function zip(file){
    const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());const tailView=new DataView(tail.buffer);let eocd=-1;
    for(let i=tail.length-22;i>=0;i--){if(tailView.getUint32(i,true)===0x06054b50&&i+22+tailView.getUint16(i+20,true)===tail.length){eocd=i;break;}}
    if(eocd<0)throw new Error('ZIP 중앙 디렉터리를 찾지 못했습니다. 파일이 잘렸을 수 있습니다.');
    if(tailView.getUint16(eocd+4,true)!==0||tailView.getUint16(eocd+6,true)!==0)throw new Error('분할 ZIP 파일은 지원하지 않습니다.');
    const count=tailView.getUint16(eocd+10,true),cdSize=tailView.getUint32(eocd+12,true),cdAt=tailView.getUint32(eocd+16,true);
    if(count===65535||cdAt===0xffffffff||cdSize===0xffffffff)throw new Error('ZIP64는 지원하지 않습니다. 원본 .tar.gz 또는 압축을 푼 파일을 가져와 주세요.');
    if(cdSize>24*MiB||cdAt+cdSize>file.size)throw new Error('ZIP 디렉터리가 손상되었거나 너무 큽니다.');
    const cd=new Uint8Array(await file.slice(cdAt,cdAt+cdSize).arrayBuffer()),v=new DataView(cd.buffer);let at=0,expanded=0;
    for(let i=0;i<count;i++){
      seen();if(at+46>cd.length||v.getUint32(at,true)!==0x02014b50)throw new Error('손상된 ZIP 항목입니다.');
      const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),compressed=v.getUint32(at+20,true),size=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
      if(at+46+nl+extra+comment>cd.length)throw new Error('잘린 ZIP 항목입니다.');const name=decoder.decode(cd.subarray(at+46,at+46+nl));at+=46+nl+extra+comment;expanded+=size;
      if(expanded>LIMITS.expanded)throw new Error('압축 해제 크기가 4 GB를 초과합니다.');progress(name,file.size*i/Math.max(count,1));
      if(name.endsWith('/')||!canRead(name,size,true))continue;
      if(flags&1)throw new Error('암호로 보호된 ZIP 파일은 지원하지 않습니다.');
      if(![0,8].includes(method))throw new Error('지원하지 않는 ZIP 압축 방식입니다. 압축을 풀어 가져와 주세요.');
      if(compressed>LIMITS.entry) {analysis.stats.filesSkipped++;continue;}
      const localHeader=new DataView(await file.slice(local,local+30).arrayBuffer());if(localHeader.byteLength!==30||localHeader.getUint32(0,true)!==0x04034b50)throw new Error('잘못된 ZIP 로컬 헤더입니다.');
      const start=local+30+localHeader.getUint16(26,true)+localHeader.getUint16(28,true);if(start+compressed>cdAt)throw new Error('ZIP 데이터 범위가 잘못되었습니다.');
      const data=new Uint8Array(await file.slice(start,start+compressed).arrayBuffer());const bytes=method===0?data:await decompress(data,'deflate-raw');
      if(bytes.length!==size||crc32(bytes)!==crc)throw new Error('ZIP 파일의 무결성 검증에 실패했습니다. 원본을 다시 가져와 주세요.');await consume(bytes,name);
    }
  }
  for(const file of files){
    const name=file.webkitRelativePath||file.name;analysis.sources.push(shortSource(name));progress(name,0,true);
    const head=new Uint8Array(await file.slice(0,512).arrayBuffer());
    if(head[0]===0x50&&head[1]===0x4b)await zip(file);
    else if(head[0]===0x1f&&head[1]===0x8b&&/\.(tar\.gz|tgz)$/i.test(name)){
      if(!globalThis.DecompressionStream)throw new Error('압축 해제를 지원하는 최신 Safari 또는 Chrome에서 열어 주세요.');
      let read=0;const meter=new TransformStream({transform(chunk,controller){read+=chunk.length;progress(name,read);controller.enqueue(chunk);}});
      await tar(file.stream().pipeThrough(meter).pipeThrough(new DecompressionStream('gzip')),file);
    }else if(isTar(head))await tar(file.stream(),file);
    else {seen();if(!eligible(name))throw new Error('지원하지 않는 파일입니다. sysdiagnose(.tar.gz), ZIP, Analytics(.ips), JSON, plist, 텍스트 로그를 선택해 주세요.');if(canRead(name,file.size))await consume(new Uint8Array(await file.arrayBuffer()),name);}
    doneInput+=file.size;
  }
  const report=analysis.finish();
  const meaningful=Object.values(report.device).some(v=>v?.value!==null&&v?.value!==undefined)||report.components.some(c=>c.manufacturer||Object.values(c.fields).some(Boolean));
  if(!meaningful)throw new Error('이 파일에서 지원하는 기기·부품 정보를 찾지 못했습니다. 전체 sysdiagnose 또는 ioreg/IODeviceTree.txt와 BatteryBDC 로그를 가져와 주세요.');
  report.warnings=[...new Set(report.warnings)].slice(0,25);onProgress({name:'분석 완료',percent:100,...analysis.stats});return report;
}
