// 세션 쿠키를 서명 없이 쓰는 자리가 남아 있는지 검사한다.
//
// 왜 필요한가: 미들웨어(src/proxy.ts)가 서명 없는 campnic_* 쿠키를 버린다.
//   그래서 쿠키를 쓰는 자리에서 seal() 을 빠뜨리면 컴파일은 통과하는데
//   "로그인을 해도 로그인이 안 된다" 로 나타난다 — 그 경로를 직접 눌러보기 전엔 모른다.
//   여기서 잡는다.
//
// 실행: node scripts/check-session-cookies.mjs

import fs from "fs";
import path from "path";

const ROOT = "src";
const COOKIE = /campnic_|USER_COOKIE/;
const bad = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) check(p);
  }
}

function check(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    // (a) 한 줄: .set("campnic_x", JSON.stringify(
    if (/\.set\(/.test(L) && COOKIE.test(L) && L.includes("JSON.stringify(")) {
      bad.push(`${file}:${i + 1}  ${L.trim()}`);
    }
    // (b) 여러 줄: .set( / "campnic_x", / JSON.stringify(
    if (/\.set\($/.test(L.trimEnd())) {
      const name = lines[i + 1] ?? "";
      const val = lines[i + 2] ?? "";
      if (COOKIE.test(name) && val.includes("JSON.stringify(")) {
        bad.push(`${file}:${i + 3}  ${val.trim()}`);
      }
    }
  }
}

walk(ROOT);

if (bad.length) {
  console.error("❌ 서명 없이 세션 쿠키를 쓰는 자리:\n");
  for (const b of bad) console.error("   " + b);
  console.error("\n   JSON.stringify(...) → await seal(...) 로 바꾸세요.");
  console.error('   import { seal } from "@/lib/session-cookie";');
  process.exit(1);
}
console.log("✅ 세션 쿠키 쓰기 자리 전부 서명됨");
