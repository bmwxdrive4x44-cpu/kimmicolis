import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
