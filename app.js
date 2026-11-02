import {COMPONENTS,REFERENCES,createAnalysis,parseText,maskSerial,redactReport} from './lib/parser.js';

const paths={
  home:'m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
  report:'M8 3H5v18h14V7l-4-4H8Zm6 0v5h5M8 12h8M8 16h5',
  history:'M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2',
  guide:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm9 3a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2',
  upload:'M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6',
  file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8M8 17h5',
  shield:'m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6',
  display:'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm3 3h4m-3 14h2',
  battery:'M3 7h16v10H3V7Zm18 3v4M6 10v4m3-4v4m3-4v4',
  storage:'M4 4h16v16H4V4Zm0 11h16M8 18h1m3 0h1M8 8h8',
  chip:'M6 6h12v12H6V6Zm3-4v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M9 9h6v6H9V9Z',
  camera:'M3 7h4l2-3h6l2 3h4v13H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01',
  arrow:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',
  moon:'M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z',
  sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  check:'m5 12 4 4L19 6',sparkle:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  lock:'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 5v2',
  info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10h.01',
  folder:'M3 6h7l2 3h9v11H3V6Z',
  download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  save:'M4 3h14l3 3v15H3V3Zm4 0v6h8V3M7 21v-8h10v8',
  trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:'m3 3 18 18M9 5a11 11 0 0 1 3 0c6 0 10 7 10 7a20 20 0 0 1-3 4M6 6a24 24 0 0 0-4 6s4 7 10 7a12 12 0 0 0 6-2',
  share:'M12 16V2m-4 4 4-4 4 4M7 10H4v12h16V10h-3',
  close:'m6 6 12 12M6 18 18 6',
};
const icon=(name,cls='')=>`<svg ${cls?`class="${cls}"`:''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=document.querySelector('#main'),fileInput=document.querySelector('#file-input'),folderInput=document.querySelector('#folder-input');
const state={report:null,tab:'overview',error:'',busy:false,progress:null,reveal:false,worker:null};
const STORAGE='enjoy-device-reports-v1';
const formatDate=value=>new Date(value).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
const fieldValue=field=>field?.status==='conflict'?'값이 서로 다름':field?.value??null;
const known=field=>field?.value!==null&&field?.value!==undefined;
const fieldLabels={serial:'부품 일련번호',capacity:'용량',type:'유형',health:'배터리 건강도',cycles:'충전 사이클',design:'설계 용량',full:'충전 용량',charge:'기록 당시 잔량',controller:'컨트롤러',controllerVendor:'컨트롤러 제조사'};
const units={cycles:'회',design:' mAh',full:' mAh',charge:'%',health:'%'};
const statusLabels={direct:'파일에서 확인',inferred:'코드 기반 추정',computed:'계산값',conflict:'정보 불일치'};
function badge(field){if(!field)return '<span class="badge">정보 없음</span>';const color=field.status==='direct'?'green':field.status==='conflict'?'orange':'blue';return `<span class="badge ${color}">${esc(statusLabels[field.status]||'참고 정보')}</span>`;}
function displayField(field,key,component,masked=true){
  if(!field)return '확인 불가';if(field.status==='conflict')return '정보 불일치';
  const value=field.value;if(/serial/i.test(key))return masked?maskSerial(value):String(value);
  if(key==='capacity')return `${value}${component==='memory'?' GB (GiB)':' GB'}`;
  return `${value}${units[key]||''}`;
}
function reportName(report){return fieldValue(report.device.model)||fieldValue(report.device.identifier)||'Apple 기기';}
function readHistory(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(data)?data.filter(v=>v&&v.schemaVersion===1&&typeof v.id==='string'&&v.device&&Array.isArray(v.components)&&v.components.every(c=>c&&typeof c.id==='string'&&c.fields&&typeof c.fields==='object')).slice(0,20):[];}catch{return [];}}
function writeHistory(reports){try{localStorage.setItem(STORAGE,JSON.stringify(reports));return true;}catch{toast('보관함을 저장하지 못했어요. 리포트 파일로 내려받아 주세요.');return false;}}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.hidden=true,3500);}
function heading(title,description){return `<div class="page-heading"><h1>${title}</h1><p>${description}</p></div>`;}
function empty(title,description){return `<section class="panel empty-state"><div class="upload-symbol">${icon('report')}</div><h2>${title}</h2><p>${description}</p><button class="button primary" data-action="upload">${icon('upload')} 진단 파일 가져오기</button><button class="text-button blue" data-action="demo">예시 리포트 먼저 보기 ${icon('arrow')}</button></section>`;}
function home(){return `
  <section class="hero"><div><div class="eyebrow">${icon('sparkle')} 내 기기 속 작은 발견</div><h1>내 아이폰 속 부품,<br><em>어디서 만들었을까?</em></h1><p>디스플레이부터 배터리, 메모리까지.<br>진단 파일 하나로 내 기기를 더 자세히 알아보세요.</p></div>
    <div class="hero-art" aria-hidden="true"><div class="phone-orbit"></div><div class="phone"></div><span class="floating-icon chip">${icon('chip')}</span><span class="floating-icon battery">${icon('battery')}</span></div></section>
  ${state.error?`<div class="upload-error" role="alert">${icon('info')}<div><strong>파일을 확인해 주세요</strong><p>${esc(state.error)}</p></div></div>`:''}
  ${state.busy?analysisView():`<section class="panel upload-panel"><div class="drop-zone" id="drop-zone"><div class="upload-symbol">${icon('upload')}</div><h2>내 기기 리포트 만들기</h2><p>진단 파일을 선택하거나 여기에 놓아주세요.</p><button class="button primary" data-action="upload">${icon('folder')} 진단 파일 가져오기</button><div class="upload-meta"><span>sysdiagnose · .tar.gz · .zip · Analytics</span><span>최대 1.5 GB</span></div><button class="text-button" data-action="folder">압축을 푼 폴더 가져오기 ${icon('arrow')}</button></div><p class="privacy-note">${icon('shield')} 파일은 서버로 전송되지 않고 이 기기에서만 분석돼요.</p></section>`}
  <div class="section-heading"><h2>이런 부품을 알아볼 수 있어요</h2><span>파일에 포함된 정보 기준</span></div>
  <div class="component-grid">${COMPONENTS.slice(0,4).map(c=>`<div class="component-preview"><span class="component-icon ${c.color}-color">${icon(c.icon)}</span><div><strong>${c.label}</strong><small>${({display:'패널 제조사',battery:'제조사 · 건강도',storage:'제조사 · NAND 유형',memory:'제조사 · 용량'})[c.id]}</small></div></div>`).join('')}</div>
  <div class="helper-row"><a href="#guide" class="helper-card"><span class="helper-icon">${icon('guide')}</span><span><strong>진단 파일은 어떻게 만드나요?</strong><small>아이폰 · 아이패드에서 준비하는 방법</small></span>${icon('arrow')}</a><button class="helper-card" data-action="demo"><span class="helper-icon">${icon('report')}</span><span><strong>리포트 먼저 둘러보기</strong><small>예시 데이터로 분석 결과 미리 보기</small></span>${icon('arrow')}</button></div>
  <p class="fine-print">Apple의 공식 진단 서비스가 아니에요.<br>기기 모델, OS 버전, 파일 내용에 따라 확인할 수 있는 정보가 달라져요.</p>`;}
function analysisView(){return `<section class="panel analysis-panel" role="status" aria-live="polite"><div class="spinner"></div><h2>내 기기를 알아보고 있어요</h2><p>파일을 읽고 부품 정보를 찾고 있어요.</p><div class="progress-track"><span id="progress-bar" style="width:${state.progress?.percent||0}%"></span></div><p class="progress-file" id="progress-label">${esc(state.progress?.name||'파일 준비 중')}</p><button class="text-button" data-action="cancel">분석 취소</button></section>`;}
function summary(c){const f=c.fields;const specs=Object.entries(f).filter(([k,v])=>known(v)&&['capacity','type','health','cycles'].includes(k)).map(([k,v])=>displayField(v,k,c.id)).slice(0,2).join(' · ');if(specs)return specs;if(c.id==='display'&&known(f.serial))return '패널 코드 '+String(f.serial.value).slice(0,3);if(/Camera|telephoto|ultraWide/.test(c.id))return '카메라 모듈 공급업체';return known(c.manufacturer)?'파일에 기록된 제조사':'식별 정보 없음';}
function componentRow(c){const value=fieldValue(c.manufacturer);return `<button class="component-row" data-component="${esc(c.id)}"><span class="component-icon ${esc(c.color)}-color">${icon(c.icon)}</span><span class="row-title"><strong>${esc(c.label)}</strong><small>${esc(summary(c))}</small></span><span class="row-value"><strong class="${!value?'unknown-value':''}">${esc(value||'확인 불가')}</strong>${badge(c.manufacturer)}</span>${icon('arrow')}</button>`;}
function batteryCard(report){const battery=report.components.find(c=>c.id==='battery'),f=battery?.fields||{};const health=known(f.health)?Number(f.health.value):null;return `<section class="panel report-card"><div class="card-heading"><h2>배터리 한눈에</h2><span>${health!==null?'기록 당시 기준':'파일 정보 기준'}</span></div><div class="battery-health"><div class="health-ring" style="--health:${health===null?0:Math.max(0,Math.min(100,health))}%"><span>${health===null?'—':esc(health)+'<small>%</small>'}</span></div><div><strong>${health===null?'건강도 정보 없음':'배터리 건강도'}</strong><p>${health===null?'배터리 로그가 필요해요':f.health.status==='computed'?'설계 용량 대비 계산값':'로그에 기록된 값이에요'}</p></div></div><dl class="metric-list">${['cycles','design','full'].map(key=>`<div><dt>${fieldLabels[key]}</dt><dd>${esc(displayField(f[key],key,'battery'))}</dd></div>`).join('')}</dl></section>`;}
function legendCard(){return `<section class="panel report-card"><h2>결과는 이렇게 읽어요</h2><div class="legend"><div><span class="badge green">파일에서 확인</span><p>가져온 파일에 직접 적힌 정보예요.</p></div><div><span class="badge blue">코드 기반 추정</span><p>부품 코드를 공개 매핑과 대조했어요.</p></div><div><span class="badge">정보 없음</span><p>식별값이 없거나 아직 지원하지 않는 형식이에요.</p></div></div><p class="info-text" style="margin-top:18px">확인된 정보도 부품 정품 여부나 교체 이력을 보증하지 않아요.</p></section>`;}
function reportView(){const r=state.report;if(!r)return heading('기기 리포트','내 기기 속 부품 정보를 한곳에서 확인하세요.')+empty('아직 리포트가 없어요','진단 파일을 가져오면 부품 제조사와 분석 근거를 볼 수 있어요.');
  const d=r.device;const tabs=[['overview','전체'],['display','디스플레이'],['battery','배터리'],['camera','카메라'],['storage','저장장치'],['memory','메모리']];
  const visible=r.components.filter(c=>state.tab==='overview'||c.id===state.tab||state.tab==='camera'&&/Camera|telephoto|ultraWide/.test(c.id));
  const identified=r.components.filter(c=>known(c.manufacturer)).length;
  return `<div class="report-topline"><a class="back-link" href="#home">${icon('back')} 새로 분석하기</a><span class="badge ${r.isDemo?'orange':'green'}">${icon(r.isDemo?'info':'check')}${r.isDemo?'예시 리포트':'분석 완료'}</span></div>
  ${r.isDemo?'<div class="sample-notice">'+icon('info')+'화면을 둘러보기 위한 가상 데이터예요. 내 기기의 분석 결과가 아니에요.</div>':''}
  <section class="panel report-device"><div class="device-mini ${/^iPad/.test(reportName(r))?'ipad':''}" aria-hidden="true"></div><div class="device-description"><div class="eyebrow">MY DEVICE REPORT</div><h1>${esc(reportName(r))}</h1><div class="device-tags">${d.os?`<span class="badge">${/^iPad/.test(reportName(r))?'iPadOS':'iOS'} ${esc(fieldValue(d.os))}</span>`:''}${r.components.find(c=>c.id==='storage')?.fields.capacity?.value?`<span class="badge">${esc(r.components.find(c=>c.id==='storage').fields.capacity.value)} GB</span>`:''}${d.region?`<span class="badge">판매 코드 ${esc(fieldValue(d.region))}</span>`:''}</div><p>${esc([fieldValue(d.identifier),fieldValue(d.modelNumber)].filter(Boolean).join(' · ')||'모델 식별 정보가 파일에 없어요')}</p><dl class="serial-grid">${[['serial','기기 일련번호'],['boardSerial','보드 일련번호']].map(([k,label])=>`<div><dt>${label} <button data-action="serial" aria-label="일련번호 ${state.reveal?'숨기기':'표시'}">${icon(state.reveal?'eye':'eyeOff')}</button></dt><dd>${esc(d[k]?displayField(d[k],k,'device',!state.reveal):'확인 불가')}</dd></div>`).join('')}</dl></div></section>
  <div class="report-summary">${icon('sparkle')}<div><strong>${r.isDemo?'예시 부품 리포트':`부품 ${identified}개의 제조사 정보를 찾았어요`}</strong><p>${esc(formatDate(r.createdAt))} · ${r.stats.filesParsed}개 파일 분석</p></div><span class="badge blue">${r.isDemo?'DEMO':'기기 내 분석'}</span></div>
  <nav class="tabs" aria-label="부품 필터">${tabs.map(([id,label])=>`<button class="${state.tab===id?'active':''}" data-tab="${id}" aria-pressed="${state.tab===id}">${label}</button>`).join('')}</nav>
  <div class="report-layout"><section class="panel report-card"><div class="card-heading"><h2>${tabs.find(t=>t[0]===state.tab)?.[1]||'전체'} 부품 정보</h2><span>눌러서 근거 보기</span></div>${visible.map(componentRow).join('')}${state.tab!=='overview'?visible.map(c=>detailFields(c)).join(''):''}</section><aside class="aside-stack">${state.tab==='overview'||state.tab==='battery'?batteryCard(r):''}${legendCard()}</aside></div>
  ${r.warnings.length?`<div class="report-note">${r.warnings.map(v=>`<p>${esc(v)}</p>`).join('')}</div>`:''}
  <div class="report-actions"><button class="button primary" data-action="save">${icon('save')} 보관함에 저장</button><button class="button secondary" data-action="export">${icon('share')} 리포트 내보내기</button></div><p class="fine-print">보관함과 내보낸 리포트에는 일련번호가 가려져요.<br>일부 정보만 보인다면 전체 sysdiagnose 파일로 다시 분석해 보세요.</p>`;
}
function detailFields(c,showNote=true){const entries=Object.entries(c.fields).filter(([,v])=>v);return `<div class="detail-fields">${entries.length?`<dl class="metric-list">${entries.map(([key,v])=>`<div><dt>${esc(fieldLabels[key]||key)}</dt><dd>${esc(displayField(v,key,c.id))}</dd></div>`).join('')}</dl>`:'<p class="no-data">이 파일에서 추가 정보를 찾지 못했어요.</p>'}${showNote?`<p class="info-text" style="margin-top:18px">${esc(c.note)}</p>`:''}</div>`;}
function historyView(){const reports=readHistory();return heading('내 기기 보관함','이 브라우저에 저장한 리포트예요. 일련번호는 가려져 있어요.')+(reports.length?`<div class="history-list">${reports.map(r=>`<article class="history-item"><span class="component-icon">${icon(/^iPad/.test(reportName(r))?'report':'display')}</span><button class="history-open" data-history="${esc(r.id)}"><strong>${esc(reportName(r))} ${r.isDemo?'<span class="badge orange">예시</span>':''}</strong><small>${esc(formatDate(r.createdAt))} · 제조사 ${r.components.filter(c=>known(c.manufacturer)).length}개 확인</small></button><button class="icon-button" data-delete="${esc(r.id)}" aria-label="${esc(reportName(r))} 리포트 삭제">${icon('trash')}</button></article>`).join('')}</div><p class="fine-print">리포트는 최대 20개까지 보관해요.<br>브라우저의 사이트 데이터를 지우면 보관함도 삭제돼요.</p>`:empty('저장한 리포트가 없어요','분석 후 ‘보관함에 저장’을 누르면 나중에 다시 볼 수 있어요.'));}
function guideView(){return heading('진단 파일 준비하기','아이폰과 아이패드에서 한 번만 준비하면 돼요.')+`<div class="guide-layout"><section class="panel guide-steps">
  <article class="guide-step"><span class="step-number">1</span><div><h2>시스템 진단 파일을 만들어요</h2><p>Apple의 기기별 sysdiagnose 생성 안내에 따라 진단 파일을 만들어 주세요. 버튼 조합은 기기에 따라 다르니 공식 안내를 먼저 확인해 주세요.</p><a class="button soft" href="${REFERENCES.apple}" target="_blank" rel="noopener">Apple 공식 안내 ${icon('arrow')}</a><p class="guide-tip">안내 페이지의 ‘Sysdiagnose for iOS/iPadOS’를 확인해 주세요. 일부 문서는 Apple 계정 로그인이 필요해요.</p></div></article>
  <article class="guide-step"><span class="step-number">2</span><div><h2>분석 데이터에서 파일을 찾아요</h2><p>파일 생성이 끝나면 설정 앱에서 다음 경로로 이동해 주세요. 생성에는 몇 분 정도 걸릴 수 있어요.</p><div class="settings-path">설정 › 개인정보 보호 및 보안<br>› 분석 및 향상 › 분석 데이터</div><p><strong>sysdiagnose_</strong>로 시작하는 파일을 선택하고 공유 버튼을 눌러 <strong>‘파일에 저장’</strong>해 주세요.</p><p class="guide-tip">메뉴 이름은 OS 버전에 따라 조금 다를 수 있어요. 일반 Analytics 파일은 배터리 등 일부 정보만 포함할 수 있어요.</p></div></article>
  <article class="guide-step"><span class="step-number">3</span><div><h2>저장한 파일을 가져오면 끝!</h2><p>이 사이트로 돌아와 파일을 선택해 주세요. 압축을 풀지 않은 .tar.gz도 바로 분석해요. 여러 개의 개별 로그를 함께 선택할 수도 있어요.</p><button class="button primary" data-action="upload">${icon('folder')} 진단 파일 가져오기</button></div></article></section>
  <aside class="aside-stack"><section class="panel report-card"><div class="upload-symbol" style="margin:0 0 16px">${icon('shield')}</div><h2>내 파일은 내 기기 안에</h2><p class="info-text" style="margin-top:12px">진단 파일에는 개인 정보가 포함될 수 있어요. 엔조이 기기는 파일을 서버로 전송하지 않고 브라우저 안에서 분석해요. 원본 파일은 저장하지 않아요.</p><p class="info-text" style="margin-top:12px">원할 때만 가려진 리포트를 보관함에 저장하거나 내려받을 수 있어요.</p></section>${legendCard()}</aside></div>
  <section class="panel guide-faq"><h2>자주 묻는 질문</h2><details><summary>모든 제조사를 확인할 수 있나요?</summary><p>아니요. 기기와 OS, 파일에 따라 식별값이 없거나 형식이 달라요. 확인할 수 없는 제조사는 추측해서 채우지 않아요. 현재 패널 접두사 일부와 파일에 명시된 제조사 필드, 배터리·저장장치·DRAM 정보를 지원해요.</p></details><details><summary>‘코드 기반 추정’은 얼마나 정확한가요?</summary><p>디스플레이 일련번호의 접두사를 커뮤니티 공개 매핑과 대조한 결과예요. Apple이 공개한 공식 해독 규칙이 아니며, 정품 인증이나 부품 품질 등급을 의미하지 않아요. 모르는 접두사는 확인 불가로 표시해요.</p></details><details><summary>파일이 크거나 분석이 멈추면 어떻게 하나요?</summary><p>최신 Safari 또는 Chrome을 이용해 주세요. 휴대 기기 메모리가 부족하다면 PC에서 압축을 풀고 ioreg 폴더의 IODeviceTree.txt, IOService.txt, IOPower.txt와 logs/BatteryBDC의 CSV 파일만 선택해 주세요. 개별 파일은 24 MB, 분석 텍스트는 총 128 MB까지 읽어요.</p></details><details><summary>일반 웹사이트에서 기기를 자동 스캔하나요?</summary><p>기기를 자동 스캔하지 않아요. 직접 선택한 진단 파일의 내용을 분석해요. 다른 기기의 파일을 선택하면 그 파일에 해당하는 기기의 결과가 나와요.</p></details><details><summary>카메라 제조사는 센서 제조사인가요?</summary><p>카메라 모듈 공급업체와 이미지 센서 제조사는 다를 수 있어요. 파일에 모듈 공급업체만 적혀 있으면 모듈 정보로 표시하며, 센서 제조사로 바꿔서 표시하지 않아요.</p></details></section>`;}
function render(){const route=location.hash.slice(1)||'home';document.querySelectorAll('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===route);if(el.dataset.nav===route)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});main.innerHTML=({home,report:reportView,history:historyView,guide:guideView}[route]||home)();bindDrop();}
function navigate(route){if(location.hash==='#'+route)render();else location.hash=route;}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);main.focus({preventScroll:true});});
function bindDrop(){const drop=document.querySelector('#drop-zone');if(!drop)return;for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');});for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');});drop.addEventListener('drop',e=>analyze([...e.dataTransfer.files]));}
function analyze(files){
  if(!files.length)return;if(state.busy){toast('현재 파일의 분석이 끝난 뒤 다시 가져와 주세요.');return;}
  state.busy=true;state.error='';state.progress=null;navigate('home');
  try{
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});state.worker=worker;
    worker.onmessage=({data})=>{
      if(data.type==='progress'){state.progress=data.progress;const bar=document.querySelector('#progress-bar'),label=document.querySelector('#progress-label');if(bar)bar.style.width=data.progress.percent+'%';if(label)label.textContent=`${data.progress.name} · ${data.progress.filesParsed}개 파일 확인`;}
      else if(data.type==='result'){worker.terminate();state.worker=null;state.busy=false;state.report=data.report;state.tab='overview';state.reveal=false;navigate('report');toast('기기 리포트가 준비됐어요.');}
      else if(data.type==='error')fail(data.message);
    };
    worker.onerror=()=>fail('분석 작업을 실행하지 못했습니다. 최신 브라우저에서 다시 열어 주세요. 파일을 직접 열었다면 로컬 서버로 실행해 주세요.');
    worker.postMessage({files});
  }catch{fail('이 브라우저에서 분석 작업을 시작하지 못했어요. 최신 Safari 또는 Chrome을 이용해 주세요.');}
}
function fail(message){state.worker?.terminate();state.worker=null;state.busy=false;state.error=message;navigate('home');}
fileInput.addEventListener('change',()=>{analyze([...fileInput.files]);fileInput.value='';});folderInput.addEventListener('change',()=>{analyze([...folderInput.files]);folderInput.value='';});
function showDemo(){
  const a=createAnalysis();const demo={ProductType:'iPhone15,3',ProductVersion:'26.0',SerialNumber:'DEMO00000001',MLBSerialNumber:'BOARD0000001',ModelNumber:'A2894',RegionInfo:'KH/A',Display:{'raw-panel-serial-number':'G9NDEMO000001'},Battery:{Manufacturer:'Desay',CycleCount:486,DesignCapacity:4323,NominalChargeCapacity:3735,MaximumCapacityPercent:86.39},Storage:{'vendor-name':'Kioxia',capacity:256000000000,'nand-type':'TLC'},Memory:{'dram-vendor':'Samsung','dram-size':6442450944,'dram-type':'LPDDR5'},FrontCamera:{Manufacturer:'LG Innotek'},RearCamera:{Manufacturer:'LG Innotek'},Telephoto:{Manufacturer:'LG Innotek'},UltraWide:{Manufacturer:'Sharp'}};
  a.sources.push('가상 예시 데이터');a.stats.filesSeen=1;parseText(JSON.stringify(demo),'가상 예시 데이터',a);state.report=a.finish(true);state.tab='overview';state.reveal=false;navigate('report');
}
function openDialog(html){document.querySelector('#dialog-content').innerHTML=html;document.querySelector('#detail-dialog').showModal();}
function evidence(field){if(!field)return '';return `<div class="evidence-box"><strong>${esc(field.source)}</strong><code>${esc(field.key)} = ${esc(/serial|panelid/i.test(field.key)?'일련번호 숨김':field.raw)}</code>${field.sampledAt?`<p>기록 시점: ${esc(field.sampledAt)}</p>`:''}${field.rule?`<p>${esc(field.rule)}</p>`:''}</div>`;}
function componentDetail(id){const c=state.report?.components.find(c=>c.id===id);if(!c)return;const f=c.manufacturer;openDialog(`<span class="component-icon ${esc(c.color)}-color">${icon(c.icon)}</span><h2 id="dialog-title">${esc(c.label)}</h2><p class="info-text">${esc(c.note)}</p><div class="card-heading"><strong>${esc(fieldValue(f)||'제조사 확인 불가')}</strong>${badge(f)}</div>${f?evidence(f):'<p class="info-text" style="margin-top:15px">이 파일에서 지원하는 제조사 식별값을 찾지 못했어요. 전체 sysdiagnose 또는 관련 IORegistry 파일로 다시 분석해 보세요.</p>'}${f?.status==='conflict'?f.alternatives.map(evidence).join(''):''}${detailFields(c,false)}${Object.entries(c.fields).filter(([,v])=>v).map(([key,v])=>`<h3 style="font-size:12px;margin-top:18px">${esc(fieldLabels[key]||key)} ${badge(v)}</h3>${evidence(v)}${v.status==='conflict'?v.alternatives.map(evidence).join(''):''}`).join('')}<div class="dialog-links"><a href="${REFERENCES.fields}" target="_blank" rel="noopener">로그 필드 참고 자료 ↗</a>${c.id==='display'?`<a href="${REFERENCES.display}" target="_blank" rel="noopener">패널 코드 매핑 출처 ↗</a>`:''}</div>`);}
function exportDialog(){if(!state.report)return;openDialog(`<h2 id="dialog-title">리포트 내보내기</h2><p class="info-text">일련번호를 가린 리포트만 내보내요. 원본 진단 파일은 포함하지 않아요.</p><div style="display:grid;gap:10px;margin:20px 0"><button class="button primary full" data-action="png">${icon('download')} 이미지로 저장</button><button class="button secondary full" data-action="json">${icon('file')} 분석 결과 JSON 저장</button><button class="button secondary full" data-action="print">${icon('report')} 인쇄 · PDF로 저장</button></div>`);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportPNG(){
  const r=redactReport(state.report);if(!r)return;const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1510;const ctx=canvas.getContext('2d');
  const box=(x,y,w,h,fill,radius=24)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();};
  const text=(s,x,y,size=24,color='#191f28',weight=500)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, sans-serif`;ctx.fillText(String(s),x,y);};
  ctx.fillStyle='#f2f2f7';ctx.fillRect(0,0,1000,1510);text('엔조이 기기',60,80,28,'#3182f6',750);text(r.isDemo?'예시 리포트 · 가상 데이터':'내 기기 부품 리포트',60,153,38,'#191f28',800);text(formatDate(r.createdAt),60,197,20,'#8b95a1');
  box(40,237,920,212,'#ffffff');text(reportName(r),75,298,34,'#191f28',750);text([r.device.os?.value?`OS ${r.device.os.value}`:'',r.device.identifier?.value].filter(Boolean).join(' · '),75,342,22,'#6b7684');text('일련번호  '+(r.device.serial?.value||'확인 불가'),75,395,21,'#8b95a1');
  box(40,474,920,828,'#ffffff');text('부품별 제조사',75,528,28,'#191f28',750);
  r.components.forEach((c,i)=>{const y=594+i*78;text(c.label,75,y,23,'#6b7684');const specs=Object.entries(c.fields).filter(([k,v])=>known(v)&&['capacity','type','health','cycles'].includes(k)).map(([k,v])=>displayField(v,k,c.id)).slice(0,2).join(' · ');if(specs)text(specs,75,y+25,16,'#8b95a1');ctx.textAlign='right';text(fieldValue(c.manufacturer)||'확인 불가',925,y,24,c.manufacturer?'#191f28':'#8b95a1',650);text(c.manufacturer?statusLabels[c.manufacturer.status]:'정보 없음',925,y+24,15,c.manufacturer?.status==='direct'?'#168568':'#6b7684');ctx.textAlign='left';if(i<r.components.length-1){ctx.strokeStyle='#f2f4f6';ctx.beginPath();ctx.moveTo(75,y+42);ctx.lineTo(925,y+42);ctx.stroke();}});
  text('기기 모델 · OS · 파일 내용에 따라 결과가 달라질 수 있어요.',60,1370,20,'#8b95a1');text('정품 여부와 교체 이력을 보증하는 공식 진단 결과가 아닙니다.',60,1407,20,'#8b95a1');text(r.isDemo?'DEMO DATA':'ENJOY DEVICE · LOCAL ANALYSIS',60,1470,17,'#8b95a1',600);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('이미지 생성 실패');download(blob,`enjoy-device-${r.isDemo?'demo':'report'}.png`);toast('리포트 이미지를 저장했어요.');
}
document.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;render();return;}
  const component=e.target.closest('[data-component]');if(component){componentDetail(component.dataset.component);return;}
  const history=e.target.closest('[data-history]');if(history){state.report=readHistory().find(r=>r.id===history.dataset.history);state.tab='overview';state.reveal=false;navigate('report');return;}
  const del=e.target.closest('[data-delete]');if(del){const id=del.dataset.delete;openDialog(`<h2 id="dialog-title">이 리포트를 삭제할까요?</h2><p class="info-text">이 브라우저의 보관함에서 삭제돼요.</p><button class="button primary full" data-confirm-delete="${esc(id)}" style="margin-bottom:10px">리포트 삭제</button>`);return;}
  const confirm=e.target.closest('[data-confirm-delete]');if(confirm){if(writeHistory(readHistory().filter(r=>r.id!==confirm.dataset.confirmDelete))){document.querySelector('#detail-dialog').close();render();toast('리포트를 삭제했어요.');}return;}
  const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='upload'){if(state.busy)return toast('현재 파일을 분석하고 있어요.');fileInput.click();}
  if(action==='folder'){if(state.busy)return;folderInput.click();}
  if(action==='cancel'){state.worker?.terminate();state.worker=null;state.busy=false;state.progress=null;render();toast('분석을 취소했어요.');}
  if(action==='demo'){if(state.busy)return toast('분석이 끝난 뒤 예시를 볼 수 있어요.');showDemo();}
  if(action==='serial'){state.reveal=!state.reveal;render();}
  if(action==='save'&&state.report){const saved=redactReport(state.report),history=readHistory().filter(r=>r.id!==saved.id);if(writeHistory([saved,...history].slice(0,20)))toast('일련번호를 가려 보관함에 저장했어요.');}
  if(action==='export')exportDialog();
  if(action==='json'&&state.report)download(new Blob([JSON.stringify(redactReport(state.report),null,2)],{type:'application/json'}),'enjoy-device-report.json');
  if(action==='png'&&state.report){try{await exportPNG();}catch{toast('이미지를 만들지 못했어요. JSON 또는 PDF로 저장해 주세요.');}}
  if(action==='print'){document.querySelector('#detail-dialog').close();state.reveal=false;state.tab='overview';render();requestAnimationFrame(()=>window.print());}
});
document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#detail-dialog').close());
document.querySelector('#detail-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}});
function currentTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function themeIcon(){const dark=currentTheme()==='dark';document.querySelector('#theme-toggle').innerHTML=icon(dark?'sun':'moon');document.querySelector('#theme-toggle').setAttribute('aria-label',dark?'밝은 테마로 변경':'어두운 테마로 변경');document.querySelector('meta[name="theme-color"]').content=dark?'#000000':'#f2f2f7';}
try{const theme=localStorage.getItem('enjoy-device-theme');if(['dark','light'].includes(theme))document.documentElement.dataset.theme=theme;}catch{}
document.querySelector('#theme-toggle').addEventListener('click',()=>{const next=currentTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('enjoy-device-theme',next);}catch{}themeIcon();});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',themeIcon);
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));themeIcon();render();
