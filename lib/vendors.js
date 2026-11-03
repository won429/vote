// Curated public evidence. A supplier list for a model is never an installed-part
// identification rule. Keep serial-prefix mappings separate from observations.
export const VENDOR_DATA_VERSION='2026.11.03.1';
const checkedAt='2026-11-03';
const sources={
  batteryGuide:{id:'juda-battery-2019',title:'주다 리튬전지 · 배터리 식별 안내',url:'https://m.juda.cn/news/56692.html',kind:'배터리 업체 기술 안내',publishedAt:'2019-01-10',checkedAt},
  batteryOwner:{id:'macrumors-battery-2022',title:'배터리 F8Y · 선워다 사용자 실측 기록',url:'https://forums.macrumors.com/threads/iphone-13-pro-parts-serials-cameras-battery-display.2314093/',kind:'사용자 기기 기록',publishedAt:'2022-01-16',checkedAt},
  cameraOwner:{id:'macrumors-camera-2025',title:'후면 카메라 DN8 · 엘지 사용자 실측 기록',url:'https://forums.macrumors.com/threads/issues-with-proraw-48-and-stock-camera-app.2437958/page-22',kind:'사용자 기기 기록',publishedAt:'2025-11-24',checkedAt},
  cameraCodes:{id:'macrumors-camera-2021',title:'카메라 DNM·F0W 사용자 실측 기록',url:'https://forums.macrumors.com/threads/iphone-13-pro-parts-serials-cameras-battery-display.2314093/',kind:'사용자 기기 기록',publishedAt:'2021-09-27',checkedAt},
};
export const VENDOR_RULES=[
  {id:'iphone-battery-f8y',components:['battery'],family:'iPhone',prefix:'F8Y',manufacturer:'Sunwoda',references:[sources.batteryGuide,sources.batteryOwner],caveat:'배터리 팩 조립업체에 대한 문헌 추정이에요. 전지 셀 제조사나 정품 여부를 뜻하지 않아요. 구형 기기의 자료를 사용하므로 현재 기기의 제조사가 직접 확인된 값은 아니에요.'},
  {id:'iphone-battery-f5d',components:['battery'],family:'iPhone',prefix:'F5D',manufacturer:'Desay',references:[sources.batteryGuide],caveat:'배터리 업체가 공개한 구형 아이폰 식별 안내를 적용했어요. 현재 기기에서 제조사 이름을 직접 읽은 결과가 아니며, 전지 셀 제조사와 다를 수 있어요.'},
  {id:'iphone-rear-dn8',components:['rearCamera'],models:['iPhone 16 Pro Max','iPhone 17 Pro Max'],prefix:'DN8',manufacturer:'LG',references:[sources.cameraOwner],caveat:'해당 기종 후면 카메라에 대한 사용자 실측 사례를 대조했어요. 애플의 공식 코드표가 아니며, 다른 기종이나 다른 카메라에는 적용하지 않아요. 이미지 센서 제조사를 뜻하지 않아요.'},
];
export function supplierResearch(component,serial,device){
  const prefix=String(serial||'').trim().slice(0,3).toUpperCase();
  if(!/^[A-Z0-9]{3}$/.test(prefix))return null;
  const model=device.model?.value||'',identifier=device.identifier?.value||'';
  const family=/^iPhone/.test(model)||/^iPhone\d+,\d+$/.test(identifier)?'iPhone':/^iPad/.test(model)||/^iPad\d+,\d+$/.test(identifier)?'iPad':null;
  const rule=VENDOR_RULES.find(r=>r.components.includes(component)&&r.prefix===prefix&&(!r.family||r.family===family)&&(!r.models||r.models.includes(model)));
  if(rule)return {version:VENDOR_DATA_VERSION,checkedAt,prefix,status:'inferred',ruleId:rule.id,manufacturer:rule.manufacturer,references:rule.references,caveat:rule.caveat};
  if(['frontCamera','rearCamera','telephoto','ultraWide'].includes(component)&&['DNM','F0W'].includes(prefix))return {version:VENDOR_DATA_VERSION,checkedAt,prefix,status:'observed',references:[sources.cameraCodes],caveat:'동일 접두사가 구형 아이폰의 사용자 실측 기록에 있어요. 해당 기록에는 코드와 제조사의 대응 관계가 없어, 이 기기의 모듈 제조사로 확장하지 않았어요.'};
  if(['battery','frontCamera','rearCamera','telephoto','ultraWide'].includes(component))return {version:VENDOR_DATA_VERSION,checkedAt,prefix,status:'unmapped',references:[],caveat:'현재 조사 자료에 이 기종·부품·코드 조합을 식별할 수 있는 제조사 규칙이 없어요. 다른 부품의 코드나 기종별 공급사 목록으로 대신 판정하지 않아요.'};
  return null;
}
