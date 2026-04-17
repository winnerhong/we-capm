#!/bin/bash
# 캐시 정리 + 서버 재시작 스크립트
pid=$(netstat -ano 2>/dev/null | grep ":1000" | grep "LISTEN" | awk '{print $5}' | head -1)
if [ -n "$pid" ]; then
  taskkill //PID $pid //F 2>/dev/null
  echo "killed PID $pid"
fi
sleep 1
rm -rf .next
echo "cache cleared"
npm run dev
