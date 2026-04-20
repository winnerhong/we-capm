import { NextRequest } from "next/server";
import {
  getOrgTemplate,
  getCustomerTemplate,
  getCompanyTemplate,
} from "@/lib/crm/csv-templates";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "ORG";
  let csv = "";
  let filename = "";
  if (type === "ORG") {
    csv = getOrgTemplate();
    filename = "토리로_기관_등록_템플릿.csv";
  } else if (type === "CUSTOMER") {
    csv = getCustomerTemplate();
    filename = "토리로_개인고객_등록_템플릿.csv";
  } else if (type === "COMPANY") {
    csv = getCompanyTemplate();
    filename = "토리로_기업_등록_템플릿.csv";
  } else {
    return new Response("invalid type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
