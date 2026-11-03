# 제조사 대조 자료 · 2026-11-03

제조사 이름의 직접 기록을 우선한다. 외부 접두사 대조는 `inferred`로 표시하고, 실제 기종의 탑재 부품 확인이나 정품 판정으로 취급하지 않는다. 원본 진단 파일과 일련번호는 자료집에 포함하지 않는다.

## 채택한 규칙

| 부품 | 코드 | 결과 | 적용 범위 | 근거와 제한 |
| --- | --- | --- | --- | --- |
| 배터리 팩 | F8Y | Sunwoda | 아이폰 | 배터리 업체의 2019년 기술 안내와 2022년 사용자의 기기 기록. 신형 기기에서 직접 검증한 제조사 값은 아님. 전지 셀 제조사와 구별. |
| 배터리 팩 | F5D | Desay | 아이폰 | 같은 업체의 기술 안내. 구형 기기 기반 문헌 추정. |
| 후면 카메라 모듈 | DN8 | LG | 아이폰 16 프로 맥스·17 프로 맥스 | 2025-11-24 사용자 기기 실측 게시물에서 3uTools의 LG 표시를 보고함. 이 기종의 후면에만 적용. |

출처:

- 주다 리튬전지, 배터리 식별 안내: https://m.juda.cn/news/56692.html
- 사용자 배터리 F8Y/Sunwoda 기록: https://forums.macrumors.com/threads/iphone-13-pro-parts-serials-cameras-battery-display.2314093/
- 사용자 후면 DN8/LG 기록: https://forums.macrumors.com/threads/issues-with-proraw-48-and-stock-camera-app.2437958/page-22

## 제조사 규칙으로 채택하지 않은 자료

- 카메라 DNM·F0W: 위 2021년 사용자의 원자료에는 접두사만 있으며 제조사 표는 없다. 동일 코드 관측 사실과 링크만 표시한다.
- 인터넷 재가공 표에는 DNM을 LG 또는 Cowell로 서로 다르게 분류하는 사례가 있다. 원자료로 검증할 수 없어 제조사 대응표에 넣지 않는다.
- `https://post.smzdm.com/p/apqp0de7/` 는 본문에 AI 생성 표시가 있고 카메라 코드를 디스플레이로 분류하는 등 오류가 있어 제외했다.
- `https://wap.zol.com.cn/ask/x_35803912.html` 의 익명 답변은 기종·원자료·제조사 대조 방법을 확인할 수 없어 판정 근거로 사용하지 않았다.
- TechInsights 아이폰 17 프로 맥스 분해 자료의 Sony IMX914/IMX973 식별은 센서에 대한 것이다. 카메라 모듈 제조사나 다른 기종의 실제 부품으로 대신 넣지 않는다: https://www.techinsights.com/blog/apple-iphone-17-pro-max-teardown-a19-pro-new-mmwave-system-bom-analysis

## 동작과 확인

대조표는 `lib/vendors.js`에 출처 종류, 게시일, 확인일, 부품·기종 적용 범위와 함께 보관한다. 브라우저가 표를 내려받아 로컬에서 대조하며 진단 파일이나 일련번호를 검색 사이트에 보내지 않는다. 보관 및 내보내기에는 접두사와 공개 자료 링크만 추가한다. 파일의 제조사와 코드표가 다르면 파일 기록을 우선하고 불일치를 알린다.
