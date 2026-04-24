"use client";

import { type ReactNode } from "react";

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  confirm?: string;
  children: ReactNode;
  className?: string;
}

/**
 * 서버 액션을 실행하는 form.
 * confirm prop이 있으면 submit 전에 window.confirm으로 확인한다.
 */
export function ConfirmForm({ action, confirm, children, className }: Props) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm) return;
        if (!window.confirm(confirm)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
