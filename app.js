import {COMPONENTS,REFERENCES,createAnalysis,parseText,maskSerial,redactReport} from './lib/parser.js';
import DEVICE_IMAGES from './assets/devices.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// All icon paths come from Phosphor's MIT-licensed duotone collection.
const icon=(name,cls='')=>`<svg class="${esc(cls)}" viewBox="0 0 256 256" aria-hidden="true"><use href="./assets/icons.svg#${esc(name)}"/></svg>`;
const main=document.querySelector('#main');
const fileInput=document.querySelector('#file-input');
const folderInput=document.querySelector('#folder-input');
const dialog=document.querySelector('#detail-dialog');
const state={report:null,tab:'all',error:'',busy:false,progress:null,reveal:false,worker:null};
const STORAGE='device-reports-v2';
const known=f=>f?.value!==null&&f?.value!==undefined;
const value=f=>f?.status==='conflict'?'정보 불일치':f?.value??null;
const date=s=>new Date(s).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const statuses={direct:'파일 확인',inferred:'코드 추정',computed:'계산값',conflict:'정보 불일치'};
const vendors={'Samsung Display':'삼성디스플레이','Samsung':'삼성전자','Samsung Electronics':'삼성전자','LG Display':'엘지디스플레이','LG Innotek':'엘지이노텍','LG':'엘지','Kioxia':'키옥시아','Toshiba':'도시바','Desay':'데사이','Sunwoda':'선워다','SK hynix':'에스케이하이닉스','SK Hynix':'에스케이하이닉스','Micron':'마이크론','SanDisk':'샌디스크','Sharp':'샤프','Apple':'애플','Sony':'소니','BOE':'비오이','ATL':'에이티엘'};
const labels={serial:'일련번호',capacity:'용량',type:'규격',health:'배터리 성능',cycles:'충전 횟수',design:'설계 용량',full:'충전 용량',charge:'기록 당시 잔량',controller:'컨트롤러',controllerVendor:'컨트롤러 제조사'};
const componentNames={display:'디스플레이',battery:'배터리',storage:'저장 공간',memory:'메모리',frontCamera:'전면 카메라',rearCamera:'후면 카메라',telephoto:'망원 카메라',ultraWide:'초광각 카메라',wifi:'와이파이'};
function koreanModel(s){return String(s||'기기 정보').replace(/iPhone/g,'아이폰').replace(/iPad/g,'아이패드').replace(/Pro/g,'프로').replace(/Max/g,'맥스').replace(/Plus/g,'플러스').replace(/mini/gi,'미니').replace(/Air/g,'에어').replace(/Duo/g,'듀오').replace(/inch/g,'인치').replace(/SE/g,'에스이').replace(/(\d+)(?:st|nd|rd|th) generation/g,'$1세대');}
function reportName(r){const name=value(r.device.model);if(name)return koreanModel(name);const code=value(r.device.identifier)||'';return code.startsWith('iPad')?'아이패드':code.startsWith('iPhone')?'아이폰':'기기 정보';}
function maker(f){const v=value(f);return v?(vendors[v]||v):'확인 불가';}
function metric(f,key,component,showSerial=false){
  if(!f)return '정보 없음';if(f.status==='conflict')return '정보 불일치';
  if(key==='serial')return showSerial?String(f.value):maskSerial(f.value);
  if(key==='capacity')return f.value+'기가';
  if(key==='health'||key==='charge')return f.value+'%';
  if(key==='cycles')return f.value+'회';
  if(key==='design'||key==='full')return f.value+'밀리암페어시';
  if(key==='type'&&component==='storage')return ({SLC:'셀당 1비트',MLC:'셀당 2비트',TLC:'셀당 3비트',QLC:'셀당 4비트'})[f.value]||String(f.value);
  return vendors[f.value]||String(f.value);
}
function imageFor(r){
  const model=String(value(r.device.model)||'').replace('(3세대)','(3rd generation)').trim();
  const normalize=s=>s.toLowerCase().replace(/[() .-]/g,'');return DEVICE_IMAGES.find(item=>normalize(item.model)===normalize(model))||null;
}
function photo(image,extra=''){
  if(!image)return `<span class="unknown-photo ${extra}">${icon('display')}</span>`;
  return `<span class="product-photo ${image.model.startsWith('iPad')?'tablet':''} ${extra}"><img src="${esc(image.file)}" alt="${esc(koreanModel(image.model))}" decoding="async"></span>`;
}
function readHistory(){
  try{const data=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('enjoy-device-reports-v1')||'[]');return Array.isArray(data)?data.filter(r=>r?.schemaVersion===1&&typeof r.id==='string'&&r.device&&Array.isArray(r.components)&&r.components.every(c=>c&&typeof c.id==='string'&&c.fields)).slice(0,20):[];}catch{return [];}
}
function writeHistory(reports){try{localStorage.setItem(STORAGE,JSON.stringify(reports));return true;}catch{toast('보관함이 가득 찼어요. 파일로 저장해 주세요.');return false;}}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,2800);}
function route(){return location.hash.slice(1)||'home';}
function navigate(to){if(route()===to)render();else location.hash=to;}
function header(){
  const page=route();const titles={home:'기기 확인',report:'분석 결과',history:'보관함',guide:'파일 준비하기'};
  document.querySelector('#topbar').innerHTML=`<div class="topbar-left">${page==='guide'?`<button class="icon-button" data-action="back" aria-label="뒤로 가기">${icon('back')}</button>`:''}<a class="topbar-title" href="#${page==='guide'?'home':page}">${titles[page]||'기기 확인'}</a></div><div class="topbar-actions">${page==='report'&&state.report?`<button class="icon-button" data-action="report-info" aria-label="기기 상세 정보">${icon('info')}</button><button class="icon-button" data-action="export" aria-label="결과 내보내기">${icon('share')}</button>`:`<button class="icon-button" data-action="theme" aria-label="${currentTheme()==='dark'?'밝은 화면으로 변경':'어두운 화면으로 변경'}">${icon(currentTheme()==='dark'?'sun':'moon')}</button><a href="#guide" class="icon-button" aria-label="파일 준비 안내">${icon('guide')}</a>`}</div>`;
}
function actionRow(label,sub,ico,action){return `<button class="list-link" data-action="${action}"><span class="icon-wrap">${icon(ico)}</span><span class="label">${label}${sub?`<small>${sub}</small>`:''}</span>${icon('arrow')}</button>`;}
function home(){
  if(state.busy)return analysisView();
  const recent=readHistory()[0];
  const front=DEVICE_IMAGES.find(i=>i.model==='iPhone 14 Pro Max');
  const back=DEVICE_IMAGES.find(i=>i.model==='iPhone 16');
  return `${state.error?`<div class="error-state" role="alert"><strong>파일을 다시 확인해 주세요</strong>${esc(state.error)}</div>`:''}
  <section class="home-intro"><h1 class="screen-title">내 기기 속 부품을<br>확인해 보세요</h1><p class="screen-sub">디스플레이부터 배터리, 메모리까지</p></section>
  <div class="home-devices" id="drop-zone" aria-label="진단 파일을 놓는 곳">${photo(back,'behind')}${photo(front)}<span class="home-device-label">아이폰 · 아이패드</span></div>
  <section class="home-import"><button class="button primary full" data-action="upload">파일 가져오기</button><p class="quiet-note">${icon('lock')} 파일은 이 기기 안에서만 분석해요</p></section>
  <section class="home-tools">${actionRow('파일 준비하는 방법','','guide','guide')}${actionRow('예시 결과 보기','','report','demo')}${actionRow('압축을 푼 폴더 선택','','folder','folder')}</section>
  ${recent?`<section class="home-recent"><h2>최근 확인한 기기</h2><button class="mini-device" data-history="${esc(recent.id)}">${photo(imageFor(recent))}<span class="mini-title">${esc(reportName(recent))}<small>${esc(date(recent.createdAt))}${recent.isDemo?' · 예시':''}</small></span>${icon('arrow')}</button></section>`:''}`;
}
function analysisView(){return `<section class="analysis-screen" role="status" aria-live="polite"><div class="analysis-spinner" aria-hidden="true"></div><h1>기기 정보를<br>확인하고 있어요</h1><p>잠시만 기다려 주세요</p><div class="progress-track"><span id="progress-bar" style="width:${state.progress?.percent||0}%"></span></div><div id="progress-label" class="analysis-stage">파일을 준비하고 있어요</div><button class="button secondary full" data-action="cancel">분석 취소</button></section>`;}
function empty(title,description){return `<section class="empty-state"><div class="empty-icon">${icon('report')}</div><h1>${title}</h1><p>${description}</p><button class="button primary full" data-action="upload">파일 가져오기</button><button class="text-button" data-action="demo">예시 결과 보기 ${icon('arrow')}</button></section>`;}
function componentSummary(c){
  const f=c.fields;
  if(c.id==='battery')return [known(f.health)?metric(f.health,'health'):null,known(f.cycles)?metric(f.cycles,'cycles'):null].filter(Boolean).join(' · ');
  if(c.id==='storage')return [known(f.capacity)?metric(f.capacity,'capacity'):null,known(f.type)?metric(f.type,'type','storage'):null].filter(Boolean).join(' · ');
  if(c.id==='memory')return known(f.capacity)?metric(f.capacity,'capacity'):'';
  if(/Camera|telephoto|ultraWide/.test(c.id))return '카메라 모듈';
  return '';
}
function componentRow(c){return `<button class="component-row" data-component="${esc(c.id)}"><span class="component-icon color-${esc(c.color)}">${icon(c.icon)}</span><span class="component-copy"><strong>${componentNames[c.id]||esc(c.label)}</strong>${componentSummary(c)?`<small>${esc(componentSummary(c))}</small>`:''}</span><span class="component-value"><strong class="${known(c.manufacturer)?'':'unknown'}">${esc(maker(c.manufacturer))}</strong>${c.manufacturer?`<small class="${esc(c.manufacturer.status)}">${statuses[c.manufacturer.status]||'참고 정보'}</small>`:''}</span>${icon('arrow','chevron')}</button>`;}
function reportView(){
  const r=state.report;if(!r)return empty('아직 확인한 기기가 없어요','진단 파일을 가져오면<br>부품 정보를 볼 수 있어요');
  const battery=r.components.find(c=>c.id==='battery');const storage=r.components.find(c=>c.id==='storage');
  const confirmed=r.components.filter(c=>known(c.manufacturer)).length;
  const filters=[['all','전체'],['display','화면'],['battery','배터리'],['camera','카메라'],['storage','저장 공간'],['memory','메모리']];
  const components=r.components.filter(c=>state.tab==='all'||state.tab===c.id||state.tab==='camera'&&/Camera|telephoto|ultraWide/.test(c.id));
  return `${r.isDemo?'<div class="example-banner"><span>예시 데이터로 만든 결과예요</span><button data-action="upload">내 파일 가져오기</button></div>':''}
  <section class="device-overview"><div class="device-top"><div><h1>${esc(reportName(r))}</h1><p class="device-meta">${esc([known(storage?.fields.capacity)?metric(storage.fields.capacity,'capacity'):null,r.device.os?.value?'운영체제 '+r.device.os.value:null].filter(Boolean).join(' · '))}</p></div>${photo(imageFor(r))}</div><div class="device-status">${icon('check')}<span>${r.isDemo?'예시 결과':`부품 ${confirmed}개 제조사 확인`}</span><span>${esc(date(r.createdAt))}</span></div><dl class="device-stats"><div><dt>배터리 성능</dt><dd>${known(battery?.fields.health)?`${esc(battery.fields.health.value)}<small>%</small>`:'—'}</dd></div><div><dt>충전 횟수</dt><dd>${known(battery?.fields.cycles)?`${esc(battery.fields.cycles.value)}<small>회</small>`:'—'}</dd></div></dl></section>
  <section class="report-section"><div class="section-head"><h2>어디서 만들었을까요?</h2><button class="text-button" data-action="reading" aria-label="분석 결과 읽는 방법">${icon('info')}</button></div><div class="filter-row" aria-label="부품 선택">${filters.map(([id,title])=>`<button data-tab="${id}" class="${state.tab===id?'active':''}" aria-pressed="${state.tab===id}">${title}</button>`).join('')}</div><div class="component-list">${components.map(componentRow).join('')}</div></section>
  ${state.tab==='battery'?batterySection(battery):''}
  ${r.warnings?.length?`<div class="report-warning">일부 파일을 읽지 못했어요. <button data-action="warnings" style="color:inherit;text-decoration:underline">내용 보기</button></div>`:''}
  <div class="report-actions"><button class="button primary" data-action="save">보관함에 저장</button><button class="button secondary" data-action="export">내보내기</button></div><p class="report-footnote">저장할 때 일련번호를 가려요</p>`;
}
function batterySection(c){const f=c?.fields||{};const health=known(f.health)?Number(f.health.value):null;return `<section class="battery-section"><h2>배터리 정보</h2><div class="battery-reading"><strong>${health??'—'}</strong>${health!==null?'<span>%</span>':''}<small>${f.health?.status==='computed'?'설계 용량 대비 계산값':'기록 당시 기준'}</small></div><div class="meter"><span style="width:${Math.max(0,Math.min(100,health||0))}%"></span></div>${metrics(c,['cycles','design','full','charge'])}</section>`;}
function metrics(c,keys){return `<dl class="metrics">${keys.filter(k=>c?.fields[k]).map(k=>`<div><dt>${labels[k]||k}</dt><dd>${esc(metric(c.fields[k],k,c.id))}</dd></div>`).join('')}</dl>`;}
function historyView(){const list=readHistory();if(!list.length)return empty('저장한 결과가 없어요','기기를 분석한 뒤<br>보관함에 저장해 보세요');return `<div class="history-intro"><h1>저장한 결과 ${list.length}개</h1></div><div class="history-list">${list.map(r=>`<article class="history-item">${photo(imageFor(r))}<button class="history-open" data-history="${esc(r.id)}"><strong>${esc(reportName(r))}</strong><small>${esc(date(r.createdAt))}${r.isDemo?' · 예시':''}<br>제조사 ${r.components.filter(c=>known(c.manufacturer)).length}개 확인</small></button><button class="icon-button" data-delete="${esc(r.id)}" aria-label="${esc(reportName(r))} 삭제">${icon('trash')}</button></article>`).join('')}</div><p class="history-note">이 브라우저에 최대 20개까지 저장해요.<br>사이트 데이터를 지우면 함께 삭제돼요.</p>`;}
function guideView(){return `<div class="page-pad"><h1 class="screen-title">진단 파일만<br>준비해 주세요</h1></div><section class="guide-steps"><article class="guide-step"><span class="step-number">1</span><div><h2>진단 파일 만들기</h2><p>애플 공식 안내에 따라 기기에서 시스템 진단 파일을 만들어 주세요.</p><a class="text-button blue" href="${REFERENCES.apple}" target="_blank" rel="noopener">애플 공식 안내 ${icon('arrow')}</a><p class="quiet-note">기기에 맞는 시스템 진단 안내를 확인해 주세요.</p></div></article><article class="guide-step"><span class="step-number">2</span><div><h2>파일에 저장하기</h2><p>설정 앱에서 분석 데이터를 열어주세요.</p><div class="settings-path">개인정보 보호 및 보안<br>› 분석 및 향상 › 분석 데이터</div><p><strong>sysdiagnose_</strong>로 시작하는 파일을 선택한 뒤, 공유 버튼을 눌러 ‘파일에 저장’해요.</p><p class="quiet-note">진단 파일이 나타나기까지 몇 분 걸릴 수 있어요.</p></div></article><article class="guide-step"><span class="step-number">3</span><div><h2>저장한 파일 가져오기</h2><p>압축을 풀지 않아도 돼요.</p><button class="text-button blue" data-action="upload">파일 가져오기 ${icon('arrow')}</button></div></article></section><section class="faq"><h2>궁금한 점이 있나요?</h2><details><summary>제조사가 안 나와요</summary><p>파일에 식별 정보가 없거나 아직 지원하지 않는 형식이에요. 전체 시스템 진단 파일이나 압축을 푼 기기 목록 파일을 가져와 주세요. 확인되지 않은 제조사는 임의로 채우지 않아요.</p></details><details><summary>파일이 크거나 분석이 멈춰요</summary><p>최신 브라우저를 이용해 주세요. 계속 멈춘다면 컴퓨터에서 압축을 풀고 기기 목록과 배터리 기록 파일만 선택해 주세요. 입력은 총 1.5기가, 개별 파일은 24메가까지 읽어요.</p></details><details><summary>정품 여부도 확인할 수 있나요?</summary><p>정품 인증이나 교체 이력을 판정하는 서비스는 아니에요. 파일에 남은 정보와 공개된 코드 규칙을 바탕으로 제조사를 알려드려요.</p></details>${actionRow('파일과 개인정보 처리','','shield','privacy')}${actionRow('이미지·아이콘 출처','','info','credits')}</section>`;}
function render(){
  const page=route();header();main.innerHTML=({home,report:reportView,history:historyView,guide:guideView}[page]||home)();
  document.body.dataset.route=page;
  document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===page);if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});bindDrop();
}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);main.focus({preventScroll:true});});
function bindDrop(){const el=document.querySelector('#drop-zone');if(!el)return;for(const type of ['dragenter','dragover'])el.addEventListener(type,e=>{e.preventDefault();el.classList.add('dragging');});for(const type of ['dragleave','drop'])el.addEventListener(type,e=>{e.preventDefault();el.classList.remove('dragging');});el.addEventListener('drop',e=>analyze([...e.dataTransfer.files]));}
function analyze(files){
  if(!files.length)return;if(state.busy)return toast('현재 파일을 확인하고 있어요');
  closeSheet();state.busy=true;state.error='';state.progress=null;navigate('home');
  try{
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});state.worker=worker;
    worker.onmessage=({data})=>{
      if(data.type==='progress'){
        state.progress=data.progress;const bar=document.querySelector('#progress-bar'),label=document.querySelector('#progress-label');
        if(bar)bar.style.width=data.progress.percent+'%';
        if(label)label.textContent=data.progress.filesParsed?`${data.progress.filesParsed}개 파일에서 정보를 찾고 있어요`:'압축을 풀고 있어요';
      }else if(data.type==='result'){
        worker.terminate();state.worker=null;state.busy=false;state.report=data.report;state.tab='all';state.reveal=false;navigate('report');toast('기기 정보를 확인했어요');
      }else if(data.type==='error')fail(data.message);
    };
    worker.onerror=()=>fail('분석을 시작하지 못했어요. 최신 브라우저에서 다시 열어주세요.');worker.postMessage({files});
  }catch{fail('분석을 시작하지 못했어요. 최신 브라우저에서 다시 열어주세요.');}
}
function fail(message){state.worker?.terminate();state.worker=null;state.busy=false;state.error=message;navigate('home');}
fileInput.addEventListener('change',()=>{analyze([...fileInput.files]);fileInput.value='';});
folderInput.addEventListener('change',()=>{analyze([...folderInput.files]);folderInput.value='';});
function showDemo(){
  const a=createAnalysis();
  const sample={ProductType:'iPhone15,3',ProductVersion:'26.0',SerialNumber:'DEMO00000001',MLBSerialNumber:'BOARD0000001',ModelNumber:'A2894',RegionInfo:'KH/A',Display:{'raw-panel-serial-number':'G9NDEMO000001'},Battery:{Manufacturer:'Desay',CycleCount:486,DesignCapacity:4323,NominalChargeCapacity:3735,MaximumCapacityPercent:86.39},Storage:{'vendor-name':'Kioxia',capacity:256000000000,'nand-type':'TLC'},Memory:{'dram-vendor':'Samsung','dram-size':6442450944,'dram-type':'LPDDR5'},FrontCamera:{Manufacturer:'LG Innotek'},RearCamera:{Manufacturer:'LG Innotek'},Telephoto:{Manufacturer:'LG Innotek'},UltraWide:{Manufacturer:'Sharp'}};
  a.sources.push('가상 예시 데이터');a.stats.filesSeen=1;parseText(JSON.stringify(sample),'가상 예시 데이터',a);
  state.report=a.finish(true);state.tab='all';state.reveal=false;navigate('report');
}
function openSheet(html){document.querySelector('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();document.documentElement.classList.add('sheet-lock');}
function closeSheet(){if(dialog.open)dialog.close();}
dialog.addEventListener('close',()=>document.documentElement.classList.remove('sheet-lock'));
document.querySelector('#close-dialog').addEventListener('click',closeSheet);
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();});
let dragStart=null;
dialog.querySelector('.sheet-handle').addEventListener('pointerdown',e=>{dragStart=e.clientY;e.target.setPointerCapture(e.pointerId);});
dialog.querySelector('.sheet-handle').addEventListener('pointerup',e=>{if(dragStart!==null&&e.clientY-dragStart>45)closeSheet();dragStart=null;});
function evidence(f){return `<div class="evidence"><strong>${esc(f.source)}</strong><code>${esc(f.key)} = ${esc(/serial|panelid/i.test(f.key)?'일련번호 숨김':f.raw)}</code>${f.rule?`<p>${esc(f.rule)}</p>`:''}${f.sampledAt?`<p>${esc(f.sampledAt)}</p>`:''}</div>`;}
function componentDetail(id){
  const c=state.report?.components.find(c=>c.id===id);if(!c)return;const f=c.manufacturer;
  const explanatory={display:'패널 코드는 공개된 제조사 규칙과 대조해요. 정품 여부나 품질 등급을 뜻하지 않아요.',battery:'기록 당시의 값이에요. 설정 앱에 표시되는 배터리 성능과 다를 수 있어요.',storage:'저장장치 제어 부품과 실제 저장용 반도체는 제조사가 다를 수 있어요.',memory:'파일에 기록된 메모리 제조사와 용량이에요.',frontCamera:'카메라 모듈 공급업체예요. 이미지 센서 제조사와 다를 수 있어요.',rearCamera:'카메라 모듈 공급업체예요. 이미지 센서 제조사와 다를 수 있어요.',telephoto:'망원 카메라 모듈 공급업체예요.',ultraWide:'초광각 카메라 모듈 공급업체예요.',wifi:'무선 모듈 공급업체예요. 내부 반도체 제조사와 다를 수 있어요.'};
  openSheet(`<div class="sheet-manufacturer"><span class="component-icon color-${esc(c.color)}">${icon(c.icon)}</span><div><small>${componentNames[c.id]||esc(c.label)}</small><strong id="dialog-title">${esc(maker(f))}</strong></div></div><p class="sheet-sub">${explanatory[id]||''}</p>${id==='battery'?batterySection(c):`<section class="sheet-section">${metrics(c,Object.keys(c.fields).filter(k=>k!=='serial'))}</section>`}<section class="sheet-section"><h3>어떻게 확인했나요?</h3><p class="sheet-sub">${!f?'이 파일에는 제조사 식별 정보가 없어요.':f.status==='inferred'?'부품 코드와 공개 제조사 규칙을 대조했어요.':f.status==='conflict'?'파일 안에서 서로 다른 정보가 발견됐어요.':'파일에 기록된 제조사를 확인했어요.'}</p>${f?evidence(f):''}${f?.status==='conflict'?f.alternatives.map(evidence).join(''):''}</section><details style="margin-top:17px"><summary>기록된 세부 정보</summary>${Object.entries(c.fields).filter(([,v])=>v).map(([key,v])=>`<h3 style="font-size:13px;margin:16px 0 6px">${labels[key]||key} · ${esc(metric(v,key,c.id))}</h3>${evidence(v)}`).join('')||'<p>추가 정보가 없어요.</p>'}</details><div class="sheet-links"><a href="${id==='display'?REFERENCES.display:REFERENCES.fields}" target="_blank" rel="noopener">식별 규칙 출처 보기 ${icon('arrow')}</a></div>`);
}
function reportInfo(){const r=state.report;if(!r)return;const d=r.device;openSheet(`<h2 class="sheet-title" id="dialog-title">기기 상세 정보</h2><section class="sheet-section"><dl class="metrics"><div><dt>기기</dt><dd>${esc(reportName(r))}</dd></div><div><dt>운영체제</dt><dd>${esc(value(d.os)||'정보 없음')}</dd></div><div><dt>모델 번호</dt><dd>${esc(value(d.modelNumber)||'정보 없음')}</dd></div><div><dt>기기 일련번호</dt><dd class="serial-value"><span>${esc(d.serial?metric(d.serial,'serial','device',state.reveal):'정보 없음')}</span><button class="icon-button" data-action="serial" aria-label="일련번호 ${state.reveal?'숨기기':'보기'}">${icon(state.reveal?'eye':'eyeOff')}</button></dd></div><div><dt>보드 일련번호</dt><dd>${esc(d.boardSerial?metric(d.boardSerial,'serial','device',state.reveal):'정보 없음')}</dd></div><div><dt>읽은 파일</dt><dd>${r.stats.filesParsed}개</dd></div></dl></section><p class="file-detail">${(r.sourceFiles||[]).map(esc).join('<br>')}</p>`);}
function reading(){openSheet('<h2 class="sheet-title" id="dialog-title">결과는 이렇게 읽어요</h2><section class="sheet-section"><h3>파일 확인</h3><p class="sheet-sub">파일에 직접 적힌 제조사예요.</p></section><section class="sheet-section"><h3>코드 추정</h3><p class="sheet-sub">부품 코드를 공개된 제조사 규칙과 대조했어요.</p></section><section class="sheet-section"><h3>확인 불가</h3><p class="sheet-sub">식별 정보가 없거나 아직 읽을 수 없는 형식이에요.</p></section><section class="sheet-section"><h3>정보 불일치</h3><p class="sheet-sub">같은 항목에 서로 다른 값이 있어요. 부품을 눌러 근거를 확인해 주세요.</p></section><p class="sheet-sub" style="margin-top:25px">정품 여부나 교체 이력을 보증하는 결과는 아니에요.</p>');}
function privacy(){openSheet('<h2 class="sheet-title" id="dialog-title">파일은 기기 밖으로<br>보내지 않아요</h2><section class="sheet-section"><h3>이 기기에서만 분석해요</h3><p class="sheet-sub">선택한 진단 파일은 브라우저 안에서 읽어요. 서버로 전송하거나 원본 파일을 저장하지 않아요.</p></section><section class="sheet-section"><h3>저장할 때 일련번호를 가려요</h3><p class="sheet-sub">보관함에 저장하거나 파일로 내보낼 때 기기와 부품 일련번호를 가려요. 보관함은 이 브라우저에만 남아요.</p></section>');}
function credits(){openSheet('<h2 class="sheet-title" id="dialog-title">이미지·아이콘 출처</h2><p class="sheet-sub">기기 사진은 애플의 공식 모델 식별 자료를 사용해요. 제품 사진의 색상은 실제 기기의 색상과 다를 수 있어요.</p><div class="sheet-links"><a href="https://support.apple.com/en-us/108044" target="_blank" rel="noopener">아이폰 이미지</a><a href="https://support.apple.com/en-us/108043" target="_blank" rel="noopener">아이패드 이미지</a></div><p class="sheet-sub">아이콘과 글꼴은 공개 라이선스 자료를 사용해요.</p><div class="sheet-links"><a href="https://github.com/phosphor-icons/core" target="_blank" rel="noopener">아이콘 출처</a><a href="https://github.com/orioncactus/pretendard" target="_blank" rel="noopener">글꼴 출처</a></div>');}
function exportDialog(){if(!state.report)return;openSheet(`<h2 class="sheet-title" id="dialog-title">어떻게 저장할까요?</h2><p class="sheet-sub">일련번호는 가리고 저장해요.</p><section class="sheet-section"><button class="export-option" data-action="png">${icon('download')}<span>이미지로 저장<small>사진처럼 보관하고 공유해요</small></span>${icon('arrow')}</button><button class="export-option" data-action="json">${icon('file')}<span>데이터 파일로 저장<small>분석 근거를 함께 보관해요</small></span>${icon('arrow')}</button><button class="export-option" data-action="print">${icon('report')}<span>문서로 저장·인쇄</span>${icon('arrow')}</button></section>`);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportPNG(){
  const r=redactReport(state.report);if(!r)return;await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1530;const ctx=canvas.getContext('2d');
  const text=(s,x,y,size=25,color='#191f28',weight=500)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px Pretendard, sans-serif`;ctx.fillText(String(s),x,y);};
  ctx.fillStyle='#fff';ctx.fillRect(0,0,900,1530);text('기기 확인',55,70,24,'#6b7684',650);text(reportName(r),55,145,36,'#191f28',750);text(r.isDemo?'예시 데이터로 만든 결과예요':date(r.createdAt),55,190,21,'#8b95a1');
  const image=imageFor(r);if(image){try{const img=new Image();img.src=image.file;await img.decode();const h=175,w=h*.48,sw=img.height*.48;ctx.drawImage(img,img.width-sw,0,sw,img.height,730-w,75,w,h);}catch{}}
  ctx.fillStyle='#f2f4f6';ctx.fillRect(55,274,790,1);text('부품별 제조사',55,327,25,'#191f28',700);
  r.components.forEach((c,i)=>{const y=395+i*105;text(componentNames[c.id]||c.label,55,y,24,'#4e5968');text(componentSummary(c),55,y+30,18,'#8b95a1');ctx.textAlign='right';text(maker(c.manufacturer),845,y,25,c.manufacturer?'#191f28':'#b0b8c1',650);text(c.manufacturer?statuses[c.manufacturer.status]:'',845,y+30,17,c.manufacturer?.status==='inferred'?'#3182f6':'#8b95a1');ctx.textAlign='left';ctx.fillStyle='#f2f4f6';ctx.fillRect(55,y+55,790,1);});
  text('일련번호는 가려진 상태예요',55,1410,19,'#8b95a1');text('정품 여부나 교체 이력을 보증하지 않아요',55,1448,19,'#8b95a1');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('이미지 생성 실패');download(blob,'기기-분석-결과.png');toast('이미지를 저장했어요');
}
function currentTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function setTheme(){const next=currentTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('device-theme',next);}catch{}document.querySelector('meta[name="theme-color"]').content=next==='dark'?'#17171c':'#ffffff';header();}
try{const theme=localStorage.getItem('device-theme');if(['dark','light'].includes(theme))document.documentElement.dataset.theme=theme;}catch{}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',header);
document.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;const y=window.scrollY;render();window.scrollTo(0,y);return;}
  const c=e.target.closest('[data-component]');if(c){componentDetail(c.dataset.component);return;}
  const saved=e.target.closest('[data-history]');if(saved){state.report=readHistory().find(r=>r.id===saved.dataset.history)||null;state.tab='all';state.reveal=false;navigate('report');return;}
  const del=e.target.closest('[data-delete]');if(del){openSheet(`<h2 class="sheet-title" id="dialog-title">저장한 결과를<br>삭제할까요?</h2><p class="sheet-sub">이 브라우저의 보관함에서 삭제해요.</p><div class="sheet-actions"><button class="button primary full" data-confirm-delete="${esc(del.dataset.delete)}">삭제하기</button><button class="button secondary full" data-action="close-sheet">닫기</button></div>`);return;}
  const confirmed=e.target.closest('[data-confirm-delete]');if(confirmed){if(writeHistory(readHistory().filter(r=>r.id!==confirmed.dataset.confirmDelete))){closeSheet();render();toast('저장한 결과를 삭제했어요');}return;}
  const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='upload'){if(state.busy)return toast('현재 파일을 확인하고 있어요');fileInput.click();}
  if(action==='folder'){if(!state.busy)folderInput.click();}
  if(action==='guide')navigate('guide');
  if(action==='back')navigate('home');
  if(action==='cancel'){state.worker?.terminate();state.worker=null;state.busy=false;state.progress=null;render();toast('분석을 취소했어요');}
  if(action==='demo'){if(!state.busy)showDemo();}
  if(action==='theme')setTheme();
  if(action==='report-info')reportInfo();
  if(action==='serial'){state.reveal=!state.reveal;reportInfo();}
  if(action==='reading')reading();
  if(action==='privacy')privacy();
  if(action==='credits')credits();
  if(action==='close-sheet')closeSheet();
  if(action==='warnings')openSheet(`<h2 class="sheet-title" id="dialog-title">읽지 못한 파일이 있어요</h2>${(state.report?.warnings||[]).map(w=>`<p class="sheet-sub">${esc(w)}</p>`).join('')}`);
  if(action==='save'&&state.report){const safe=redactReport(state.report);if(writeHistory([safe,...readHistory().filter(r=>r.id!==safe.id)].slice(0,20)))toast('보관함에 저장했어요');}
  if(action==='export')exportDialog();
  if(action==='json'&&state.report)download(new Blob([JSON.stringify(redactReport(state.report),null,2)],{type:'application/json'}),'기기-분석-결과.json');
  if(action==='png'&&state.report){try{await exportPNG();}catch{toast('이미지를 저장하지 못했어요. 문서로 저장해 주세요.');}}
  if(action==='print'){closeSheet();state.reveal=false;state.tab='all';render();requestAnimationFrame(()=>window.print());}
});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement){const holder=e.target.closest('.product-photo');if(holder){holder.className='unknown-photo';holder.innerHTML=icon('display');}}},true);
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));render();
