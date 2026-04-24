"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TEMPLATE_VARS,
  type ArticleSection,
  type TemplatedDocType,
  type TemplateJson,
} from "@/lib/org-documents/template-json-schema";
import { getBaseTemplate } from "@/lib/org-documents/templates/base";
import type { TemplateData } from "@/lib/org-documents/template-data";
import { JsonTemplateRenderer } from "@/lib/org-documents/templates/json-renderer";
import {
  resetTemplateSectionsAction,
  saveTemplateSectionsAction,
} from "../../actions";

interface Props {
  docType: TemplatedDocType;
  initial: TemplateJson;
  previewData: TemplateData;
  hasSavedSections: boolean;
}

function newArticleId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `art-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `art-${Math.random().toString(36).slice(2, 10)}`;
}

export function TemplateSectionEditor({
  docType,
  initial,
  previewData,
  hasSavedSections,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<TemplateJson>(initial);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const articleCount = state.articles.length;

  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial]
  );

  function updateArticle(id: string, patch: Partial<ArticleSection>) {
    setState((prev) => ({
      ...prev,
      articles: prev.articles.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    }));
  }

  function addArticleAt(index: number) {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(index, prev.articles.length));
      // 끝에 추가하는 경우에만 번호 자동 제안 (중간 삽입 시 수동 입력)
      const isAppend = clamped === prev.articles.length;
      const defaultNo = isAppend ? String(prev.articles.length + 1) : "";
      const inserted: ArticleSection = {
        id: newArticleId(),
        no: defaultNo,
        title: "",
        body: "",
      };
      const copy = [...prev.articles];
      copy.splice(clamped, 0, inserted);
      return { ...prev, articles: copy };
    });
  }

  function deleteArticle(id: string) {
    if (!confirm("이 조문을 삭제할까요?")) return;
    setState((prev) => ({
      ...prev,
      articles: prev.articles.filter((a) => a.id !== id),
    }));
  }

  function moveArticle(id: string, dir: -1 | 1) {
    setState((prev) => {
      const idx = prev.articles.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const to = idx + dir;
      if (to < 0 || to >= prev.articles.length) return prev;
      const copy = [...prev.articles];
      const [target] = copy.splice(idx, 1);
      copy.splice(to, 0, target);
      return { ...prev, articles: copy };
    });
  }

  function resetToBase() {
    if (!confirm("편집 중인 내용이 사라지고 토리로 기본 양식으로 돌아가요. 계속할까요?")) {
      return;
    }
    setState(getBaseTemplate(docType));
    setMsg("기본 양식을 불러왔어요. 저장해야 반영됩니다.");
  }

  function handleSave() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await saveTemplateSectionsAction(docType, state);
        setMsg("✅ 저장됐어요. 기관 고객이 다운로드할 때 편집한 버전을 보게 돼요.");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "저장 실패");
      }
    });
  }

  function handleDeleteSaved() {
    if (!hasSavedSections) return;
    if (!confirm("서버에 저장된 편집본을 삭제하고 기본 양식으로 돌아갈까요?")) {
      return;
    }
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await resetTemplateSectionsAction(docType);
        setMsg("저장본을 삭제했어요. 토리로 기본 양식으로 돌아갔어요.");
        setState(getBaseTemplate(docType));
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  function insertVarToBody(articleId: string, token: string) {
    const el = document.getElementById(`body-${articleId}`) as
      | HTMLTextAreaElement
      | null;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    updateArticle(articleId, { body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* === 실시간 프리뷰 (좌) === */}
      {showPreview && (
        <aside className="hidden lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-5rem)] overflow-auto rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#D4E4BC] bg-white/95 px-3 py-2 backdrop-blur">
              <span className="text-xs font-semibold text-[#6B6560]">
                👁 실시간 프리뷰
              </span>
              <span className="text-[10px] text-[#8B7F75]">
                (기관명·주소는 예시값)
              </span>
            </div>
            <div className="bg-white p-6 font-serif text-[11pt] leading-relaxed text-black">
              <JsonTemplateRenderer
                docType={docType}
                tmpl={state}
                data={previewData}
              />
            </div>
          </div>
        </aside>
      )}

      {/* === 편집 폼 (우) === */}
      <div className="space-y-5">
        {/* 액션 */}
        <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4E4BC] bg-white/95 p-3 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !isDirty}
            className="rounded-xl bg-[#2D5A3D] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3A7A52] disabled:opacity-50"
          >
            {pending ? "저장 중…" : "💾 저장"}
          </button>
          <button
            type="button"
            onClick={resetToBase}
            disabled={pending}
            className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#2D5A3D] hover:bg-[#E8F0E4] disabled:opacity-50"
          >
            🔄 기본으로 되돌리기
          </button>
          {hasSavedSections && (
            <button
              type="button"
              onClick={handleDeleteSaved}
              disabled={pending}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              🗑 저장본 삭제
            </button>
          )}
          <Link
            href="/partner/settings/doc-templates"
            className="rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0]"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="ml-auto rounded-xl border border-[#D4E4BC] bg-white px-3 py-2 text-xs font-semibold text-[#6B6560] hover:bg-[#FFF8F0] lg:hidden"
          >
            {showPreview ? "📋 편집만" : "👁 프리뷰"}
          </button>
          {isDirty && (
            <span className="text-[10px] font-semibold text-amber-700">
              * 변경됨
            </span>
          )}
        </div>

        {msg && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {msg}
          </div>
        )}
        {err && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            ⚠️ {err}
          </div>
        )}

        {/* 변수 안내 */}
        <details className="rounded-2xl border border-[#D4E4BC] bg-[#FFF8F0] p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-[#2D5A3D]">
            💡 사용 가능한 변수 & 특수 표기
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-[#6B6560]">
              본문에 아래 변수를 입력하면 자동으로 치환됩니다. 3개 이상의
              언더스코어(<code className="rounded bg-white px-1">___</code>)는
              기입용 빈칸으로 렌더링돼요.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map((v) => (
                <code
                  key={v.token}
                  className="rounded-md border border-[#D4E4BC] bg-white px-2 py-0.5 text-[11px] text-[#2D5A3D]"
                  title={v.desc}
                >
                  {v.token}
                </code>
              ))}
            </div>
          </div>
        </details>

        {/* 문서 제목 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
            문서 제목
          </label>
          <input
            type="text"
            value={state.title}
            onChange={(e) =>
              setState((p) => ({ ...p, title: e.target.value }))
            }
            className="w-full rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-lg font-bold text-[#2D5A3D] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </section>

        {/* 도입부 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
            도입부 (당사자 소개·목적 문단)
          </label>
          <textarea
            value={state.intro}
            onChange={(e) =>
              setState((p) => ({ ...p, intro: e.target.value }))
            }
            rows={4}
            className="w-full resize-y rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </section>

        {/* 조문 리스트 */}
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-[#6B6560]">
            📑 조문 ({articleCount})
          </h2>
          {state.articles.length === 0 ? (
            <div className="space-y-2">
              <p className="rounded-xl border border-dashed border-[#D4E4BC] bg-[#FFF8F0] p-4 text-center text-xs text-[#6B6560]">
                조문이 없어요. 아래 버튼으로 첫 조문을 만들어 주세요.
              </p>
              <InsertArticleBtn onClick={() => addArticleAt(0)} label="첫 조문 추가" />
            </div>
          ) : (
            state.articles.map((a, idx) => (
              <Fragment key={a.id}>
                {/* 첫 조문 앞 삽입 포인트 */}
                {idx === 0 && (
                  <InsertArticleBtn onClick={() => addArticleAt(0)} />
                )}
              <article
                className="space-y-2 rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#E8F0E4] px-2 py-0.5 text-[10px] font-semibold text-[#2D5A3D]">
                    {docType === "PRIVACY_CONSENT"
                      ? `${a.no || idx + 1}. 항목`
                      : `제${a.no || idx + 1}조`}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveArticle(a.id, -1)}
                    disabled={idx === 0}
                    aria-label="위로"
                    className="rounded border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[11px] text-[#6B6560] hover:bg-[#E8F0E4] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveArticle(a.id, 1)}
                    disabled={idx === articleCount - 1}
                    aria-label="아래로"
                    className="rounded border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[11px] text-[#6B6560] hover:bg-[#E8F0E4] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteArticle(a.id)}
                    className="ml-auto rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    🗑 삭제
                  </button>
                </header>

                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-[#8B7F75]">
                      번호
                    </label>
                    <input
                      type="text"
                      value={a.no}
                      onChange={(e) =>
                        updateArticle(a.id, { no: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5 text-center text-sm font-semibold focus:border-[#2D5A3D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-[#8B7F75]">
                      제목
                    </label>
                    <input
                      type="text"
                      value={a.title}
                      onChange={(e) =>
                        updateArticle(a.id, { title: e.target.value })
                      }
                      placeholder="예: 목적 / 계약 기간"
                      className="w-full rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5 text-sm font-semibold focus:border-[#2D5A3D] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-0.5 flex items-center justify-between text-[10px] text-[#8B7F75]">
                    <span>본문</span>
                    <span className="font-mono">
                      {a.body.length}자
                    </span>
                  </label>
                  <textarea
                    id={`body-${a.id}`}
                    value={a.body}
                    onChange={(e) =>
                      updateArticle(a.id, { body: e.target.value })
                    }
                    rows={Math.max(3, Math.min(12, a.body.split("\n").length + 1))}
                    className="w-full resize-y rounded-lg border border-[#D4E4BC] bg-[#FFF8F0] px-2 py-1.5 text-sm leading-relaxed text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none"
                  />
                  {/* 빠른 변수 삽입 */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["{{partner.business_name}}", "{{org.org_name}}", "___"].map(
                      (token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => insertVarToBody(a.id, token)}
                          className="rounded border border-[#D4E4BC] bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#2D5A3D] hover:bg-[#E8F0E4]"
                        >
                          + {token}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </article>
                {/* 각 조문 뒤 삽입 포인트 */}
                <InsertArticleBtn
                  onClick={() => addArticleAt(idx + 1)}
                  label={
                    idx === articleCount - 1
                      ? "마지막에 조문 추가"
                      : "여기에 조문 삽입"
                  }
                />
              </Fragment>
            ))
          )}
        </section>

        {/* 결미부 */}
        <section className="rounded-2xl border border-[#D4E4BC] bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-semibold text-[#6B6560]">
            결미부 (마지막 서약·확인 문단)
          </label>
          <textarea
            value={state.closing}
            onChange={(e) =>
              setState((p) => ({ ...p, closing: e.target.value }))
            }
            rows={3}
            className="w-full resize-y rounded-xl border border-[#D4E4BC] bg-[#FFF8F0] px-3 py-2 text-sm text-[#2C2C2C] focus:border-[#2D5A3D] focus:outline-none focus:ring-2 focus:ring-[#3A7A52]/30"
          />
        </section>
      </div>

      {/* 모바일 프리뷰 */}
      {showPreview && (
        <aside className="lg:hidden">
          <div className="rounded-2xl border border-[#D4E4BC] bg-white shadow-sm">
            <div className="border-b border-[#D4E4BC] bg-white/95 px-3 py-2">
              <span className="text-xs font-semibold text-[#6B6560]">
                👁 프리뷰
              </span>
            </div>
            <div className="bg-white p-4 font-serif text-[10pt] leading-relaxed text-black">
              <JsonTemplateRenderer
                docType={docType}
                tmpl={state}
                data={previewData}
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

/** 조문 사이사이에 삽입하는 얇은 버튼 (hover 시 강조) */
function InsertArticleBtn({
  onClick,
  label = "여기에 조문 삽입",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="group relative flex items-center justify-center py-1">
      <div className="absolute inset-x-6 top-1/2 h-px bg-[#D4E4BC] opacity-0 transition-opacity group-hover:opacity-100" />
      <button
        type="button"
        onClick={onClick}
        className="relative z-10 inline-flex items-center gap-1 rounded-full border border-dashed border-[#D4E4BC] bg-white/70 px-3 py-1 text-[10px] font-semibold text-[#8B7F75] opacity-60 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 hover:opacity-100"
      >
        <span aria-hidden>➕</span>
        <span>{label}</span>
      </button>
    </div>
  );
}
