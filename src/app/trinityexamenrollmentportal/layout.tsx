import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trinity College London Digital Exam Enrollment Portal | National Academy of Music",
  description: "Official candidate digital exam registration for Trinity College London. Classical & Jazz and Rock & Pop. Exam Centre: Kochi (4048) — National Academy of Music.",
  openGraph: {
    title: "Trinity College London Digital Exam Enrollment Portal",
    description: "Official Candidate Digital Exam Registration (Classical & Jazz, Rock & Pop). Exam Centre: Kochi (4048) — National Academy of Music.",
    url: "https://www.sangeetsarathi.com/trinityexamenrollmentportal",
    siteName: "National Academy of Music & Trinity College London",
    images: [
      {
        url: "/images/trinity-portal-preview.png",
        width: 1200,
        height: 630,
        alt: "Trinity College London Digital Exam Enrollment Portal - National Academy of Music",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinity College London Digital Exam Enrollment Portal",
    description: "Official Candidate Digital Exam Registration (Classical & Jazz, Rock & Pop). Exam Centre: Kochi (4048) — National Academy of Music.",
    images: ["/images/trinity-portal-preview.png"],
  },
};

export default function TrinityPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
