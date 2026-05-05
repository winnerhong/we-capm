"use client";

import { useState } from "react";
import { CoverImagePicker } from "@/components/cover-image-picker";

/**
 * 서버 컴포넌트 폼 안에서 CoverImagePicker 를 쓸 수 있게 해주는 thin wrapper.
 * - 자체 상태 관리 + hidden input 으로 FormData 전송
 * - URL 직접 입력 필요 없이 사진 업로드 + 복붙 + 드래그 모두 지원
 */
export function CoverImageField({
  name,
  defaultValue = "",
  pathPrefix = "covers",
  hint,
  compact = false,
}: {
  name: string;
  defaultValue?: string;
  pathPrefix?: string;
  hint?: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  return (
    <CoverImagePicker
      value={value}
      onChange={setValue}
      name={name}
      pathPrefix={pathPrefix}
      hint={hint}
      compact={compact}
    />
  );
}
