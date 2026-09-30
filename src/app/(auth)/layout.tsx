export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-2xl font-bold tracking-tight text-accent">RoomSnap</p>
        <p className="mt-1 text-muted">
          Photograph a room and get a list of what&apos;s in it.
        </p>
      </div>
      {children}
    </main>
  );
}
