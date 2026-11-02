// No diagnostic content is sent to a server. Values always retain their source.
export const RULE_VERSION = '2026.11.03.1';
export const REFERENCES = {
  display: 'https://github.com/gotnull/iphone-diagnostics#known-display-prefixes',
  fields: 'https://github.com/ThatLastGamer/iPhone-sysdiagnose-parser',
  apple: 'https://developer.apple.com/feedback-assistant/profiles-and-logs/?platform=ios',
};
const PANEL_PREFIXES = { G9N: 'Samsung Display', G9P: 'Samsung Display', G9Q: 'Samsung Display', GH3: 'LG Display', GVC: 'LG Display' };
const MODELS = {
  'iPhone13,1':'iPhone 12 mini','iPhone13,2':'iPhone 12','iPhone13,3':'iPhone 12 Pro','iPhone13,4':'iPhone 12 Pro Max',
  'iPhone14,2':'iPhone 13 Pro','iPhone14,3':'iPhone 13 Pro Max','iPhone14,4':'iPhone 13 mini','iPhone14,5':'iPhone 13','iPhone14,6':'iPhone SE (3세대)',
  'iPhone14,7':'iPhone 14','iPhone14,8':'iPhone 14 Plus','iPhone15,2':'iPhone 14 Pro','iPhone15,3':'iPhone 14 Pro Max',
  'iPhone15,4':'iPhone 15','iPhone15,5':'iPhone 15 Plus','iPhone16,1':'iPhone 15 Pro','iPhone16,2':'iPhone 15 Pro Max',
  'iPhone17,1':'iPhone 16 Pro','iPhone17,2':'iPhone 16 Pro Max','iPhone17,3':'iPhone 16','iPhone17,4':'iPhone 16 Plus',
};
export const COMPONENTS = [
  { id:'display',label:'디스플레이',icon:'display',color:'display',note:'패널 코드 기반 제조사 식별은 공개 커뮤니티 매핑을 사용합니다. 정품 여부나 품질 등급을 판정하지 않습니다.' },
  { id:'battery',label:'배터리',icon:'battery',color:'battery',note:'배터리 건강도는 로그에 기록된 값 또는 설계 용량 대비 충전 용량으로 계산한 값입니다. 설정 앱의 수치와 다를 수 있습니다.' },
  { id:'storage',label:'저장장치',icon:'storage',color:'storage',note:'NAND 제조사와 저장장치 컨트롤러 제조사는 다릅니다. 컨트롤러 이름만으로 NAND 제조사를 추정하지 않습니다.' },
  { id:'memory',label:'메모리',icon:'chip',color:'memory',note:'DRAM 제조사와 용량은 파일에 포함된 식별값만 표시합니다. 모델의 기본 사양을 실제 탑재 부품으로 대체하지 않습니다.' },
  { id:'frontCamera',label:'전면 카메라',icon:'camera',color:'camera',note:'카메라 모듈 공급업체와 이미지 센서 제조사는 다를 수 있습니다. 여기서는 모듈에 명시된 공급업체만 표시합니다.' },
  { id:'rearCamera',label:'후면 카메라',icon:'camera',color:'wifi',note:'파일에서 카메라 모듈 공급업체가 확인될 때만 표시합니다.' },
  { id:'telephoto',label:'망원 카메라',icon:'camera',color:'memory',note:'망원 모듈이 없는 기기 또는 식별값이 없는 로그는 확인 불가로 표시합니다.' },
  { id:'ultraWide',label:'초광각 카메라',icon:'camera',color:'camera',note:'초광각 모듈의 식별값이 파일에 있을 때만 표시합니다.' },
  { id:'wifi',label:'Wi-Fi 모듈',icon:'wifi',color:'wifi',note:'파일에 명시된 모듈 공급업체 정보입니다. 무선 칩 설계사와 다를 수 있습니다.' },
];
const norm = value => String(value).toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^(?:lastvalue|currentvalue)/,'');
const clean = value => String(value).replace(/\0/g,'').trim().slice(0,180);
const number = value => { const n = typeof value === 'number' ? value : Number(String(value).replace(/(?:mAh|bytes|%|,)/gi,'').trim()); return Number.isFinite(n) && n >= 0 ? n : null; };
const hexBytes = text => Uint8Array.from((text.match(/[a-f\d]{2}/gi) || []).map(v=>parseInt(v,16)));
function decodeValue(value) {
  if (value instanceof Uint8Array) {
    const ascii = new TextDecoder().decode(value).replace(/\0+$/,'');
    if (/^[\x20-\x7e]+$/.test(ascii)) return ascii;
    if (value.length <= 8) {
      let n = 0n; for(let i=value.length-1;i>=0;i--) n=(n<<8n)|BigInt(value[i]);
      if(n<=BigInt(Number.MAX_SAFE_INTEGER)) return Number(n);
    }
    return null;
  }
  if(typeof value === 'string' && /^<[\da-f\s]+>$/i.test(value)) return decodeValue(hexBytes(value));
  return value;
}
const isVendor = value => typeof value==='string' && /^[\p{L}\p{N} .,&()_+/-]{2,90}$/u.test(value) && /[\p{L}]/u.test(value) && !/^(unknown|n\/a|none|null|not available|0x|true|false)$/i.test(value);
function contextComponent(context) {
  const s=norm(context);
  if(/ultrawide|ultrawidecamera/.test(s))return 'ultraWide';
  if(/telephoto|telecamera/.test(s))return 'telephoto';
  if(/frontcamera|frontfacing|true.?depth/.test(s))return 'frontCamera';
  if(/rearcamera|backcamera|widecamera|backfacing/.test(s))return 'rearCamera';
  if(/applesmartbattery|gasgauge|battery|batterybdc/.test(s))return 'battery';
  if(/dram|memory|raminfo/.test(s))return 'memory';
  if(/nand|storage|controllercharacteristics|aspstorage|applenand/.test(s))return 'storage';
  if(/display|panel|appleclcd|appledcp/.test(s))return 'display';
  if(/wifi|wlan|airport|witi/.test(s))return 'wifi';
  return null;
}
export function createAnalysis() {
  const candidates=new Map();
  const stats={filesSeen:0,filesParsed:0,filesSkipped:0,parseErrors:0};
  const warnings=[];const sources=[];
  function put(path,value,entry,status='direct',rule=null) {
    if(value===null||value===undefined||value===''||typeof value==='object')return;
    const field={value:typeof value==='string'?clean(value):value,status,source:entry.source,key:entry.key,raw:clean(entry.raw??entry.value),rule,sampledAt:entry.timestamp||null};
    const arr=candidates.get(path)||[];
    if(!arr.some(v=>v.value===field.value&&v.source===field.source&&v.key===field.key))arr.push(field);
    // Keep the report bounded even with years of Analytics events.
    // Keep the newest dated records even when older CSV files are read later.
    if(arr.length>30)arr.sort((a,b)=>(Date.parse(a.sampledAt)||0)-(Date.parse(b.sampledAt)||0));
    candidates.set(path,arr.slice(-30));
  }
  function consume(original) {
    const value=decodeValue(original.value);if(value===null||value===undefined||typeof value==='object')return;
    const entry={...original,value};const k=norm(entry.key);let c=contextComponent(entry.context||'');
    const directComponent=COMPONENTS.find(x=>norm(x.id+'Manufacturer')===k||norm(x.id+'Vendor')===k);
    if(directComponent&&isVendor(value)) {put(`${directComponent.id}.manufacturer`,value,entry);return;}
    const text=clean(value);
    if(['productdescription','devicename','marketingname'].includes(k)&&/^(?:Apple )?(?:iPhone|iPad)\b/i.test(text)&&!/,\d/.test(text))put('device.model',text,entry);
    if(['producttype','hwmodel','hardwaremodel','modelcode','machine','fdrproducttype','subproducttype','model'].includes(k)&&/^(?:iPhone|iPad)\d+,\d+$/.test(text))put('device.identifier',text,entry);
    if(['productversion','osversion','systemversion','osversionstring'].includes(k)&&/^(?:(?:iPhone OS|iOS|iPadOS) )?\d{1,2}\.\d/.test(text))put('device.os',text.replace(/^(?:iPhone OS|iOS|iPadOS) /,''),entry);
    if(['serialnumber','deviceserialnumber','ioplatformserialnumber'].includes(k)&&!c&&/^[a-z\d]{8,20}$/i.test(text))put('device.serial',text,entry);
    if(['mlbserialnumber','boardserialnumber','mlbserial'].includes(k))put('device.boardSerial',text,entry);
    if(['modelnumber','regulatorymodelnumber'].includes(k)&&/^(?:A\d{4}|[A-Z0-9]{5,10}(?:[A-Z]{1,3}\/A)?)$/.test(text))put('device.modelNumber',text,entry);
    if(['regioninfo','salesregion','regioncode'].includes(k)&&/^[A-Z]{1,3}(?:\/A)?$/.test(text))put('device.region',text,entry);
    if(['rawpanelserialnumber','panelserialnumber','displayserialnumber','panelid'].includes(k)){
      if(!/^[a-z\d_-]{3,60}$/i.test(text))return;
      put('display.serial',text,entry);
      const prefix=text.slice(0,3).toUpperCase();
      if(PANEL_PREFIXES[prefix])put('display.manufacturer',PANEL_PREFIXES[prefix],entry,'inferred',`패널 접두사 ${prefix} · 커뮤니티 매핑`);
    }
    if(['dramvendor','memorymanufacturer','rammanufacturer'].includes(k)&&isVendor(value))put('memory.manufacturer',value,entry);
    if(['dramtype','memorytype','ramtype'].includes(k)&&/^(LP)?DDR[\dX ]+$/i.test(text))put('memory.type',text,entry);
    if(['dramsize','physicalmemory','hwmemsize','memorysizebytes','ramsizebytes'].includes(k)){
      const n=number(value);if(n>=256*1024**2&&n<=1024**4)put('memory.capacity',Math.round(n/1024**3*10)/10,entry);
    }
    if(['memorygb','ramgb','ramgib'].includes(k)){const n=number(value);if(n>0&&n<=1024)put('memory.capacity',n,entry);}
    if(['witimodulevendor','wifimodulevendor'].includes(k)&&isVendor(value))put('wifi.manufacturer',value,entry);
    if(['batterymanufacturer','batterymfg'].includes(k)&&isVendor(value))put('battery.manufacturer',value,entry);
    if(/(?:^|battery)(?:cyclecount)$/.test(k)||k==='batterycyclecount'){
      const n=number(value);if(n!==null&&n<=100000)put('battery.cycles',n,entry);
    }
    if(['designcapacity','batterydesigncapacity'].includes(k)) {const n=number(value);if(n>=100&&n<=50000)put('battery.design',n,entry);}
    if(['nominalchargecapacity','applemaxcapacity','fullchargecapacity','batterynominalchargecapacity'].includes(k)) {const n=number(value);if(n>=100&&n<=50000)put('battery.full',n,entry);}
    if(['maximumcapacitypercent','maxcapacitypercent','batteryhealthmetric','batteryhealthpercent'].includes(k)) {const n=number(value);if(n!==null&&n>0&&n<=150)put('battery.health',n,entry);}
    if(['currentcapacity','stateofcharge','batterylevel'].includes(k)&&c==='battery'){const n=number(value);if(n!==null&&n<=100)put('battery.charge',n,entry);}
    if(['storagesize','storagecapacitybytes','totaldiskcapacity','totaldiskspace'].includes(k)) {const n=number(value);if(n>=1e9)put('storage.capacity',Math.round(n/1e9*10)/10,entry);}
    if(['storagegb','diskcapacitygb'].includes(k)){const n=number(value);if(n>0&&n<=16000)put('storage.capacity',n,entry);}
    if(['nandvendor','nandmanufacturer'].includes(k)&&isVendor(value))put('storage.manufacturer',value,entry);
    if(['nandtype','nandmarketingname'].includes(k)) {const m=text.match(/(?:^|[^a-z])(SLC|MLC|TLC|QLC)(?:[^a-z]|$)/i);if(m)put('storage.type',m[1].toUpperCase(),entry);}
    if(k==='defaultbitspercell'&&c==='storage'){const type={1:'SLC',2:'MLC',3:'TLC',4:'QLC'}[value];if(type)put('storage.type',type,entry,'computed','셀당 비트 수를 NAND 유형으로 변환');}
    if(['manufacturer','manufacturername','vendor','vendorname','modulevendor','mfgname'].includes(k)&&c&&isVendor(value)){
      if(c==='storage'&&/^Apple(?: Inc\.?)?$/i.test(text))put('storage.controllerVendor',text,entry);
      else put(`${c}.manufacturer`,value,entry);
    }
    if(k==='capacity'&&c==='storage'){const n=number(value);if(n>=1e9)put('storage.capacity',Math.round(n/1e9*10)/10,entry);}
    if(['serialnumber','serial','serialstring'].includes(k)&&c&&/^[a-z\d_-]{5,60}$/i.test(text))put(`${c}.serial`,text,entry);
    if(k==='modelnumber'&&c==='storage')put('storage.controller',text,entry);
  }
  function pick(path) {
    const all=candidates.get(path)||[];if(!all.length)return null;
    const priority={direct:3,computed:2,inferred:1};const bestPriority=Math.max(...all.map(v=>priority[v.status]));
    let best=all.filter(v=>priority[v.status]===bestPriority);
    const dated=best.filter(v=>v.sampledAt&&Number.isFinite(Date.parse(v.sampledAt)));
    if(dated.length){const newest=Math.max(...dated.map(v=>Date.parse(v.sampledAt)));best=dated.filter(v=>Date.parse(v.sampledAt)===newest);}
    const unique=[...new Set(best.map(v=>v.value))];
    if(unique.length>1)return {...best[0],value:null,status:'conflict',alternatives:best.map(v=>({...v})).slice(0,5)};
    return best.at(-1);
  }
  function finish(isDemo=false) {
    const device={};for(const key of ['model','identifier','os','serial','boardSerial','modelNumber','region'])device[key]=pick('device.'+key);
    if(!device.model&&device.identifier?.value&&MODELS[device.identifier.value])device.model={...device.identifier,value:MODELS[device.identifier.value],status:'inferred',rule:'모델 식별자와 제품명 대조'};
    const specKeys={display:['serial'],battery:['health','cycles','design','full','charge','serial'],storage:['capacity','type','controller','controllerVendor','serial'],memory:['capacity','type'],frontCamera:['serial'],rearCamera:['serial'],telephoto:['serial'],ultraWide:['serial'],wifi:['serial']};
    const components=COMPONENTS.map(def=>({...def,manufacturer:pick(def.id+'.manufacturer'),fields:Object.fromEntries(specKeys[def.id].map(key=>[key,pick(def.id+'.'+key)]))}));
    const battery=components.find(c=>c.id==='battery');
    if(!battery.fields.health&&battery.fields.design?.value>0&&battery.fields.full?.value>0){
      const d=battery.fields.design,f=battery.fields.full;
      const health=Math.round(f.value/d.value*10000)/100;
      if(health>0&&health<=150)battery.fields.health={value:health,status:'computed',source:f.source,key:`${f.key} / ${d.key}`,raw:`${f.value} mAh / ${d.value} mAh`,rule:'충전 용량 ÷ 설계 용량 × 100',inputs:[f,d]};
    }
    return {schemaVersion:1,ruleVersion:RULE_VERSION,id:globalThis.crypto.randomUUID(),createdAt:new Date().toISOString(),isDemo,device,components,stats:{...stats},sourceFiles:[...sources],warnings:[...warnings]};
  }
  return {consume,finish,stats,warnings,sources};
}

export function parseText(text,source,analysis) {
  text=text.replace(/^\uFEFF/,'');
  let count=0;
  const emit=(key,value,context='',timestamp=null)=>{count++;analysis.consume({key,value,context,source,timestamp,raw:decodeValue(value)});};
  function walk(obj,path='',depth=0,timestamp=null){
    if(depth>40||count>150000)return;
    if(Array.isArray(obj)){for(const value of obj)walk(value,path,depth+1,timestamp);return;}
    if(obj&&typeof obj==='object'&&!(obj instanceof Uint8Array)){
      const name=obj.IORegistryEntryName||obj.IOName||obj.name||'';
      const ctx=path+'.'+(typeof name==='string'?name:'');
      const time=obj.TimeStamp||obj.timestamp||timestamp;
      for(const [key,value] of Object.entries(obj)){if(value&&typeof value==='object'&&!(value instanceof Uint8Array))walk(value,ctx+'.'+key,depth+1,time);else emit(key,value,ctx,time);}
    }
  }
  let json=false;
  try {walk(JSON.parse(text));json=true;}catch{}
  if(!json&&/^\s*<\?xml|^\s*<plist/.test(text)){
    try{walk(parseXMLPlist(text));json=true;}catch{analysis.warnings.push(`${shortSource(source)}: XML plist를 읽지 못했습니다.`);}
  }
  if(!json&&/\.csv$/i.test(source)){
    const rows=parseCSV(text);const header=rows.shift()||[];
    let latest=null;for(const row of rows){const record=Object.fromEntries(header.map((key,i)=>[key,row[i]]));if(!latest||Date.parse(record.TimeStamp||'')>=Date.parse(latest.TimeStamp||'')||!latest.TimeStamp)latest=record;}
    if(latest)walk(latest,source);json=true;
  }
  if(!json){
    const stack=[];
    const regex=/"([^"\n]+)"\s*[=:]\s*(<"[^"\n]*">|<[\da-f\s]+>|"(?:\\.|[^"\\\n])*"|[-+]?\d+(?:\.\d+)?|true|false)/gi;
    for(const line of text.split(/\r?\n/)){
      if(count>150000)break;
      // ioreg ancestry constrains generic Manufacturer keys to their own node.
      const node=line.match(/^(.*?)\+-o\s+([^<\n]+)/);
      if(node){const indent=node[1].length;while(stack.length&&stack.at(-1).indent>=indent)stack.pop();stack.push({indent,name:node[2].trim()});}
      const base=stack.map(v=>v.name).join('.');
      const context=base+(line.includes('Controller Characteristics')?'.storage.Controller Characteristics':'');
      regex.lastIndex=0;let match;
      while((match=regex.exec(line))){let value=match[2];if(value.startsWith('<"'))value=value.slice(2,-2);else if(value.startsWith('"')){try{value=JSON.parse(value);}catch{value=value.slice(1,-1);}}emit(match[1],value,context);}
      // sysctl and simple key-value diagnostic text.
      const simple=line.match(/^\s*([a-zA-Z][a-zA-Z0-9_. -]{1,64})\s*[:=]\s*([^{}\[\]\n]{1,180})\s*$/);
      if(simple)emit(simple[1],simple[2].replace(/^["']|["',;]$/g,''),context);
    }
    // Analytics .ips files commonly contain a JSON header and one JSON body.
    if(/^\s*\{/.test(text))for(const line of text.split(/\r?\n/)){if(line.trim().startsWith('{')){try{walk(JSON.parse(line));}catch{}}}
  }
  analysis.stats.filesParsed++;
  return count;
}

export function parseBinaryPlist(bytes) {
  if(bytes.length<40||new TextDecoder().decode(bytes.subarray(0,8))!=='bplist00')throw new Error('지원하지 않는 binary plist');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const uint=(at,size)=>{if(![1,2,4,8].includes(size)||at<0||at+size>bytes.length)throw new Error('손상된 plist 범위');let n=0n;for(let i=0;i<size;i++)n=(n<<8n)|BigInt(bytes[at+i]);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('plist 정수 범위 초과');return Number(n);};
  const trailer=bytes.length-32,offsetSize=bytes[trailer+6],refSize=bytes[trailer+7];
  const total=uint(trailer+8,8),top=uint(trailer+16,8),table=uint(trailer+24,8);
  if(total>100000||top>=total||table<8||table+total*offsetSize>trailer)throw new Error('손상된 plist 인덱스');
  const cache=new Map(),active=new Set();
  function read(id,depth=0){
    if(depth>40||id>=total)throw new Error('plist 중첩 범위 초과');if(cache.has(id))return cache.get(id);if(active.has(id))throw new Error('순환 plist');active.add(id);
    const at=uint(table+id*offsetSize,offsetSize);if(at<8||at>=table)throw new Error('손상된 plist 오프셋');
    const type=bytes[at]>>4,info=bytes[at]&15;let start=at+1,len=info;
    if([4,5,6,10,12,13].includes(type)&&len===15){const marker=bytes[start++];if((marker>>4)!==1)throw new Error('손상된 plist 길이');const size=2**(marker&15);len=uint(start,size);start+=size;}
    if(len>1e7)throw new Error('plist 객체가 너무 큽니다.');
    const ensure=n=>{if(start+n>table)throw new Error('잘린 plist');};let result;
    if(type===0)result=info===9?true:info===8?false:null;
    else if(type===1){
      const size=2**info;if(size>16)throw new Error('plist 정수 크기 초과');ensure(size);
      let n=0n;for(let i=0;i<size;i++)n=(n<<8n)|BigInt(bytes[start+i]);
      if(size>=8&&(bytes[start]&128))n-=1n<<BigInt(size*8);
      result=n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):String(n);
    }
    else if(type===2){ensure(2**info);result=info===2?view.getFloat32(start):info===3?view.getFloat64(start):null;}
    else if(type===3){ensure(8);result=new Date((view.getFloat64(start)+978307200)*1000).toISOString();}
    else if(type===4){ensure(len);result=bytes.slice(start,start+len);}
    else if(type===5){ensure(len);result=new TextDecoder().decode(bytes.subarray(start,start+len));}
    else if(type===6){ensure(len*2);result=new TextDecoder('utf-16be').decode(bytes.subarray(start,start+len*2));}
    else if(type===8)result=uint(start,info+1);
    else if(type===10||type===12){ensure(len*refSize);result=Array.from({length:len},(_,i)=>read(uint(start+i*refSize,refSize),depth+1));}
    else if(type===13){ensure(len*refSize*2);result=Object.create(null);for(let i=0;i<len;i++){const key=read(uint(start+i*refSize,refSize),depth+1);if(typeof key!=='string')throw new Error('plist 키 오류');result[key]=read(uint(start+(len+i)*refSize,refSize),depth+1);}}
    else throw new Error('지원하지 않는 plist 객체');
    active.delete(id);cache.set(id,result);return result;
  }
  return read(top);
}
export function parseBinary(bytes,source,analysis){
  const object=parseBinaryPlist(bytes);
  const walk=(value,path='',depth=0)=>{if(depth>40)return;if(value instanceof Uint8Array)return;if(value&&typeof value==='object'){const name=value.IORegistryEntryName||value.IOName||'';const context=path+'.'+name;for(const [key,v] of Object.entries(value)){if(v&&typeof v==='object'&&!(v instanceof Uint8Array))walk(v,context+'.'+key,depth+1);else analysis.consume({key,value:v,source,context,raw:decodeValue(v)});}}};
  walk(object);analysis.stats.filesParsed++;
}
function parseXMLPlist(text){
  if(/<!ENTITY/i.test(text))throw new Error('XML entities are unsupported');
  const tokens=text.match(/<[^>]+>|[^<]+/g)||[];let i=0,nodes=0;
  const entities=s=>s.replace(/&(amp|lt|gt|quot|apos);/g,(_,v)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v]));
  function read(depth=0){
    if(depth>40||++nodes>100000)throw new Error('plist 크기 초과');while(i<tokens.length&&(!tokens[i].startsWith('<')||/^<\?|^<!/.test(tokens[i])))i++;
    const tag=tokens[i++]||'';if(/^<plist\b/.test(tag))return read(depth+1);
    if(tag==='<dict/>')return {};if(tag==='<array/>')return [];
    if(tag==='<dict>'){const obj=Object.create(null);while(i<tokens.length){if(tokens[i].trim()===''){i++;continue;}if(tokens[i]==='</dict>'){i++;return obj;}const key=read(depth+1);if(typeof key!=='string')throw new Error('plist key');obj[key]=read(depth+1);}throw new Error('잘린 dict');}
    if(tag==='<array>'){const arr=[];while(i<tokens.length){if(tokens[i].trim()===''){i++;continue;}if(tokens[i]==='</array>'){i++;return arr;}arr.push(read(depth+1));}throw new Error('잘린 array');}
    if(/^<true\s*\/>$/.test(tag))return true;if(/^<false\s*\/>$/.test(tag))return false;
    const m=tag.match(/^<(key|string|integer|real|data|date)(\s*\/)?\s*>$/);if(!m)throw new Error('plist tag');if(m[2])return '';
    let value='';while(i<tokens.length&&tokens[i]!==`</${m[1]}>`)value+=tokens[i++];if(i>=tokens.length)throw new Error('잘린 plist');i++;
    if(m[1]==='integer'||m[1]==='real')return Number(value);
    if(m[1]==='data'){return Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0));}
    return entities(value);
  }
  return read();
}
export function parseCSV(text){
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(value);value='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value='';}else value+=ch;}
  if(value||row.length){row.push(value);rows.push(row);}return rows;
}
export function shortSource(source){return source.split('/').slice(-3).join('/').slice(-180);}
export function maskSerial(value){const s=String(value??'');return s.length>7?s.slice(0,3)+'•'.repeat(Math.min(s.length-6,8))+s.slice(-3):'••••••';}
export function redactReport(report){
  const copy=structuredClone(report);
  function walk(obj){if(!obj||typeof obj!=='object')return;for(const [key,v]of Object.entries(obj)){if(/serial/i.test(key)&&v&&typeof v==='object'&&'value'in v){v.value=v.value?maskSerial(v.value):null;v.raw='일련번호 숨김';if(v.alternatives)for(const a of v.alternatives){a.value=maskSerial(a.value);a.raw='일련번호 숨김';}}else walk(v);}if(obj.key&&/serial|panelid/i.test(obj.key)){obj.raw='일련번호 숨김';if(obj.status!=='inferred'&&typeof obj.value==='string')obj.value=maskSerial(obj.value);}}
  walk(copy);return copy;
}
