import { Modal } from "@/components/shared";

export type LegalDoc = "terms" | "privacy";

// Edit these two values before launch.
const EFFECTIVE_DATE = "[Effective date]";
const CONTACT_EMAIL = "support@kargo.example";

type Section = { heading: string; body: string[] };

const TERMS: Section[] = [
  {
    heading: "1. About these Terms",
    body: [
      "Kargo (\"Kargo\", \"we\", \"us\") provides a platform where sellers organize pasabuy batches and buyers reserve items from them. By creating an account or using Kargo you agree to these Terms of Service and to our Privacy Policy. If you do not agree, do not use Kargo.",
    ],
  },
  {
    heading: "2. Eligibility and accounts",
    body: [
      "You must be at least 18 years old, or have the consent of a parent or guardian, and be able to enter into a binding agreement under Philippine law.",
      "You are responsible for the information you give us, for keeping your password secret, and for everything done through your account. Give accurate details and keep them up to date. Tell us right away if you think your account has been accessed without your permission.",
      "Usernames are public. We may change or remove a username that is misleading, offensive, or impersonates someone else.",
    ],
  },
  {
    heading: "3. What Kargo is, and is not",
    body: [
      "Kargo is a tool that connects buyers and sellers. Kargo is not the seller, buyer, shipper or payment processor in any transaction, and is not a party to the sale between a buyer and a seller. Sellers are independent individuals or businesses and are solely responsible for the items they offer, their prices, their sourcing, and delivery.",
      "Linked social media accounts are shown as reference indicators only. Kargo does not verify them, and showing a link is not an endorsement or guarantee of the seller.",
    ],
  },
  {
    heading: "4. Buyers",
    body: [
      "Reserving an item is a commitment to buy it on the terms the seller listed. Review the item, price, batch deadline and any fees before you reserve.",
      "Provide a correct delivery address and contact details. Delays or losses caused by wrong details are your responsibility.",
      "Keep your social contact accounts reachable. Sellers use them to confirm reservations.",
    ],
  },
  {
    heading: "5. Sellers",
    body: [
      "Sellers must describe batches and items honestly, including prices, fees, timelines and any limits on refunds. You must be lawfully able to buy, import and sell what you list, and you are responsible for any taxes, permits and customs obligations that apply to you.",
      "You must not list prohibited, counterfeit, stolen or unlawful items, or items you do not genuinely intend to source.",
      "You must fulfil confirmed reservations, keep buyers informed about delays, and handle returns, refunds and disputes in good faith.",
    ],
  },
  {
    heading: "6. Payments",
    body: [
      "Payments are made directly between buyers and sellers using the methods the seller lists, such as GCash, Maya or bank transfer. Kargo does not hold, process or guarantee these payments.",
      "Check the account name and number before sending money. Kargo is not responsible for payments sent to the wrong account, or for payments a seller fails to honor. Keep proof of payment.",
    ],
  },
  {
    heading: "7. Acceptable use",
    body: [
      "You agree not to: break the law; post false, misleading or abusive content; harass others; impersonate any person; scrape, overload or probe Kargo; try to access accounts or data that are not yours; upload malware; or use Kargo to defraud anyone.",
      "We may remove content, limit features, suspend or close accounts that break these rules or put others at risk, with or without notice.",
    ],
  },
  {
    heading: "8. Admin access",
    body: [
      "Requesting admin access does not grant it. Admin accounts require approval from an existing administrator and may be revoked at any time.",
    ],
  },
  {
    heading: "9. Your content",
    body: [
      "You keep ownership of the content you post, such as photos, batch details and messages. You give Kargo a non-exclusive, worldwide, royalty-free license to host, display and process that content only to operate and improve Kargo.",
      "You confirm you have the right to post what you upload.",
    ],
  },
  {
    heading: "10. Disputes between users",
    body: [
      "Buyers and sellers should try to resolve disputes with each other first. Kargo may, but is not required to, review reports and take action on accounts. We do not guarantee any outcome, refund or recovery of money.",
    ],
  },
  {
    heading: "11. Disclaimers",
    body: [
      "Kargo is provided \"as is\" and \"as available\". We do not promise that it will always be available, error-free or secure, or that any user, item or listing is accurate, safe or lawful.",
    ],
  },
  {
    heading: "12. Limitation of liability",
    body: [
      "To the fullest extent allowed by law, Kargo is not liable for indirect, incidental or consequential losses, or for losses arising from transactions between users, including undelivered, delayed, damaged or misdescribed items and unreturned payments. Nothing in these Terms limits liability that cannot be limited under Philippine law.",
    ],
  },
  {
    heading: "13. Suspension and termination",
    body: [
      "You may stop using Kargo and request deletion of your account at any time. We may suspend or end your access if you breach these Terms or if required by law. Sections that by their nature should continue, such as 9 to 12, continue after termination.",
    ],
  },
  {
    heading: "14. Changes to these Terms",
    body: [
      "We may update these Terms. If a change is material we will tell you in the app or by email. Continuing to use Kargo after a change takes effect means you accept the updated Terms.",
    ],
  },
  {
    heading: "15. Governing law",
    body: [
      "These Terms are governed by the laws of the Republic of the Philippines. Disputes will be brought before the proper courts of the Philippines, unless the law requires otherwise.",
    ],
  },
  {
    heading: "16. Contact",
    body: [`Questions about these Terms: ${CONTACT_EMAIL}.`],
  },
];

const PRIVACY: Section[] = [
  {
    heading: "1. Overview",
    body: [
      "This Privacy Policy explains how Kargo collects, uses, shares and protects your personal information, in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules. By using Kargo you acknowledge this policy.",
    ],
  },
  {
    heading: "2. Information we collect",
    body: [
      "Account details: your name, username, email address, password (stored in protected form) and optional profile photo.",
      "Buyer details: delivery address and map location (latitude and longitude) you pin.",
      "Seller details: shop name and payment details you choose to show buyers, such as payment method, account name and account number.",
      "Contact and social links: the Facebook, TikTok or Instagram links you add.",
      "Activity: batches, reservations, claims, orders and payment records you create or take part in, and messages or notifications related to them.",
      "Technical data: device and browser information, log data and similar information needed to run and secure Kargo.",
    ],
  },
  {
    heading: "3. How we use it",
    body: [
      "To create and secure your account and confirm your email; to run batches, reservations, orders and payments tracking; to let buyers and sellers coordinate delivery; to send service messages such as confirmations and notifications; to prevent fraud and abuse; to fix problems and improve Kargo; and to comply with the law.",
      "We do not sell your personal information.",
    ],
  },
  {
    heading: "4. Legal basis",
    body: [
      "We process your information because you consented when signing up, because it is needed to provide the service you asked for, to meet legal obligations, and for our legitimate interests in keeping Kargo safe and working.",
    ],
  },
  {
    heading: "5. What other users can see",
    body: [
      "Your username and display name, profile photo and shop details are visible to other users. When a buyer reserves from a seller, the seller can see the buyer's name, contact and social links, and the delivery address needed to fulfil the order. Buyers can see a seller's shop name, social links and payment details.",
      "Do not put information in public fields that you do not want others to see.",
    ],
  },
  {
    heading: "6. Sharing with service providers",
    body: [
      "We use trusted providers to host data, authenticate users, send email and display maps. They may process your information only to provide those services to us. We may also disclose information when required by law or to protect the rights and safety of users and Kargo.",
    ],
  },
  {
    heading: "7. Retention",
    body: [
      "We keep your information while your account is active and as long as needed for the purposes above, including order records and dispute handling. When it is no longer needed, we delete or anonymize it, unless the law requires us to keep it longer.",
    ],
  },
  {
    heading: "8. Security",
    body: [
      "We use reasonable organizational, technical and physical measures to protect your information. No system is completely secure, so please use a strong, unique password and keep it private.",
      "If a breach likely to cause you serious harm occurs, we will notify you and the National Privacy Commission as the law requires.",
    ],
  },
  {
    heading: "9. Your rights",
    body: [
      "Under the Data Privacy Act you have the right to be informed, to access your information, to correct it, to object to processing, to request erasure or blocking, to data portability, to claim damages for unlawful use, and to file a complaint with the National Privacy Commission (privacy.gov.ph).",
      `To use these rights, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: "10. Children",
    body: [
      "Kargo is not meant for people under 18 without parent or guardian consent. If you believe a minor has given us information without consent, contact us and we will remove it.",
    ],
  },
  {
    heading: "11. Cookies and storage",
    body: [
      "Kargo uses browser storage and similar technology to keep you signed in and remember preferences. You can clear these in your browser settings, but parts of Kargo may stop working.",
    ],
  },
  {
    heading: "12. Changes to this policy",
    body: [
      "We may update this policy. Material changes will be announced in the app or by email, and the effective date above will change.",
    ],
  },
  {
    heading: "13. Contact",
    body: [`Questions or requests about your data: ${CONTACT_EMAIL}.`],
  },
];

export function LegalContent({ doc }: { doc: LegalDoc }) {
  const sections = doc === "terms" ? TERMS : PRIVACY;
  return (
    <div className="legal-doc">
      <p className="legal-doc__meta">Effective: {EFFECTIVE_DATE}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h3>{section.heading}</h3>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function LegalModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <Modal
      title={doc === "terms" ? "Terms of Service" : "Privacy Policy"}
      onClose={onClose}
      width={640}
      variant="detail"
      showTitleIcon={false}
      className="legal-modal"
    >
      <LegalContent doc={doc} />
    </Modal>
  );
}
