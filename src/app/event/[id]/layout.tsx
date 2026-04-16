import Link from "next/link";

export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      {children}
      <EventTabBar paramsPromise={params} />
    </>
  );
}

async function EventTabBar({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = await paramsPromise;

  const tabs = [
    { href: `/event/${id}`, icon: "🏠", label: "홈" },
    { href: `/event/${id}/missions`, icon: "🎯", label: "미션" },
    { href: `/event/${id}/leaderboard`, icon: "🏆", label: "순위" },
    { href: `/event/${id}/rewards`, icon: "🎁", label: "보상" },
    { href: `/event/${id}/team`, icon: "🤝", label: "팀" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs hover:bg-neutral-50"
          >
            <span className="text-lg">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
