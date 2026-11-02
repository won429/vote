import {createAnalysis} from './lib/parser.js?v=20261103-2';
import {analyzeFiles} from './lib/archive.js?v=20261103-2';
self.onmessage=async event=>{
  try {const report=await analyzeFiles(event.data.files,createAnalysis(),progress=>self.postMessage({type:'progress',progress}));self.postMessage({type:'result',report});}
  catch(error){self.postMessage({type:'error',message:error.message||'분석 중 오류가 발생했습니다. 파일을 다시 선택해 주세요.'});}
};
