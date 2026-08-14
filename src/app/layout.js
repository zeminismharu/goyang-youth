import './globals.css';

export const metadata = {
  title: '고양시 청년정책 — 지금 신청할 수 있는 정책',
  description:
    '고양시 청년이 지금 신청할 수 있는 정부지원 정책을 마감임박순으로 보여줍니다. 취업·주거·금융·복지·교육문화 정책을 한 곳에서.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="font-sans">{children}</body>
    </html>
  );
}
