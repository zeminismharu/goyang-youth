// Cloudflare Workers 배포용 OpenNext 설정.
//
// 이 파일만 .ts 인 이유: @opennextjs/cloudflare 어댑터가 파일명을
// 'open-next.config.ts' 로 고정해서 찾는다(다른 확장자를 받지 않음).
// 앱 코드는 요청대로 전부 .js/.jsx 그대로다. 이 파일은 빌드 도구 설정일 뿐
// 번들에 들어가는 애플리케이션 코드가 아니다.
//
// 캐싱(ISR/revalidate)을 Cloudflare KV나 R2에 붙이려면 여기서 설정한다.
// https://opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
