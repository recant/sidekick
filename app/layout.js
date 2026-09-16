import './globals.css';

export const metadata = {
  title: 'Ally Lead Engine',
  description: 'Turn public hiring signals into concrete project opportunities.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
