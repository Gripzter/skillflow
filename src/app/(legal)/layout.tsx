export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="legal-content"
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "80px 32px 120px",
        color: "#aaa",
        fontSize: "14px",
        lineHeight: 1.7,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {children}
      <style jsx global>{`
        .legal-content h1 {
          font-size: 32px;
          font-weight: 500;
          color: #fff;
          letter-spacing: -1px;
          margin-bottom: 8px;
        }

        .legal-content h2 {
          font-size: 18px;
          font-weight: 500;
          color: #fff;
          margin-top: 40px;
          margin-bottom: 12px;
        }

        .legal-content p {
          color: #aaa;
          margin-bottom: 16px;
        }

        .legal-content ul {
          color: #aaa;
          padding-left: 20px;
          margin-bottom: 16px;
        }

        .legal-content li {
          margin-bottom: 8px;
        }

        .legal-content strong {
          color: #fff;
          font-weight: 500;
        }

        .legal-content a {
          color: #ff5e00;
          text-decoration: none;
        }

        .legal-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
