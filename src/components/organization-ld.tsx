export function OrganizationLD() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "토리로 TORIRO",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://toriro.com",
    logo: "/icon-512.png",
    description: "가족과 아이가 함께하는 자연 체험 플랫폼",
    sameAs: [],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
