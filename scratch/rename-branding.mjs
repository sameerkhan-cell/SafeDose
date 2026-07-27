import fs from "fs";
import path from "path";

const root = path.resolve("src");

/** Files where every MediVerify/mediverify occurrence is Category A */
const PURE_A_FILES = [
  "components/site/Navbar.tsx",
  "components/site/Footer.tsx",
  "components/auth/AuthLayout.tsx",
  "components/dashboard/DashShell.tsx",
  "components/dashboard/MobileSidebar.tsx",
  "config/nav.ts",
  "routes/index.tsx",
  "routes/about.tsx",
  "routes/blockchain.tsx",
  "routes/auth/login.tsx",
  "routes/auth/signup.tsx",
  "routes/auth/reset-password.tsx",
  "routes/dashboard/blockchain.tsx",
  "routes/dashboard/patient.tsx",
  "routes/dashboard/settings.tsx",
  "routes/dashboard/regulator.tsx",
  "routes/dashboard/pharmacy.tsx",
  "server/services/auth.service.ts",
  "server/services/verification.service.ts",
  "services/verification/verification-service.ts",
  "components/accessibility/SMSSimulatorWidget.tsx",
  "components/patient/MedicineAIChat.tsx",
  "components/blockchain/LiveBlockchainDashboard.tsx",
  "server/services/ai-medicine-chat.service.ts",
  "services/fraud/fraud-engine.ts",
  "lib/gsap.ts",
  "lib/motion.ts",
  "services/printing/printing-service.ts",
  "services/export/export-service.ts",
  "services/qr/qr-generator.ts",
  "server/services/pdf/pdf-sheet.service.ts",
  "components/dashboard/admin/ManufacturersPanel.tsx",
  "components/batch-registration/DualQRModal.tsx",
  "components/batch-registration/ExtendBatchModal.tsx",
  "server/services/document-notification.service.ts",
  "components/dashboard/UserProfileMenu.tsx",
  "components/download-center/DownloadCenter.tsx",
];

function brandReplace(text) {
  return text
    .replace(/MediVerify/g, "SafeDose")
    .replace(/MEDIVERIFY/g, "SAFEDOSE")
    .replace(/mediverify_batches_/g, "safedose_batches_")
    .replace(/MediVerify_/g, "SafeDose_")
    .replace(/MediVerify-/g, "SafeDose-")
    .replace(/user@mediverify\.com/g, "user@safedose.com");
}

/** Per-file surgical replacements: [from, to] applied in order */
const SURGICAL = {
  "routes/__root.tsx": [
    ['{ title: "MediVerify — Scan Karo, Safe Raho" }', '{ title: "SafeDose — Scan Karo, Safe Raho" }'],
    ['{ name: "author", content: "MediVerify" }', '{ name: "author", content: "SafeDose" }'],
    ['{ property: "og:title", content: "MediVerify — Scan Karo, Safe Raho" }', '{ property: "og:title", content: "SafeDose — Scan Karo, Safe Raho" }'],
    ['{ name: "twitter:site", content: "@MediVerify" }', '{ name: "twitter:site", content: "@SafeDose" }'],
  ],
  "routes/report.tsx": [
    ['{ title: "Report Fake Medicine — MediVerify" }', '{ title: "Report Fake Medicine — SafeDose" }'],
  ],
  "routes/dashboard/manufacturer.tsx": [
    ['{ title: "Manufacturer Command Center — MediVerify" }', '{ title: "Manufacturer Command Center — SafeDose" }'],
    ["`mediverify_batches_${Date.now()}.csv`", "`safedose_batches_${Date.now()}.csv`"],
  ],
  "routes/dashboard/monitoring.tsx": [
    ['{ title: "Global Intelligence — MediVerify" }', '{ title: "Global Intelligence — SafeDose" }'],
  ],
  "routes/dashboard/profile.tsx": [
    ['{ title: "My Profile — MediVerify" }', '{ title: "My Profile — SafeDose" }'],
    ['content: "Manage your MediVerify profile and business information."', 'content: "Manage your SafeDose profile and business information."'],
  ],
  "routes/dashboard/qr-library.tsx": [
    ['{ title: "QR Library — MediVerify" }', '{ title: "QR Library — SafeDose" }'],
  ],
  "routes/auth/forgot-password.tsx": [
    ['{ title: "Forgot Password — MediVerify" }', '{ title: "Forgot Password — SafeDose" }'],
    ['content: "Reset your MediVerify password securely."', 'content: "Reset your SafeDose password securely."'],
    ["[MediVerify]", "[SafeDose]"],
  ],
  "routes/api/auth/-register.ts": [
    ["`Welcome to MediVerify, ${user.fullName}!`", "`Welcome to SafeDose, ${user.fullName}!`"],
  ],
  "routes/api/auth/-forgot-password.ts": [
    ["[MediVerify]", "[SafeDose]"],
  ],
  "routes/verify-lite.tsx": [
    ['{ title: "Lite Verification — MediVerify" }', '{ title: "Lite Verification — SafeDose" }'],
    ["<Zap className=\"h-5 w-5 fill-primary\" /> MediVerify LITE", "<Zap className=\"h-5 w-5 fill-primary\" /> SafeDose LITE"],
  ],
  "routes/api/blockchain/scan-history.ts": [
    [
      'if (/MediVerify Scanner/.test(ua)) return "MediVerify Scanner";',
      'if (/MediVerify Scanner|SafeDose Scanner/.test(ua)) return "SafeDose Scanner";',
    ],
  ],
  "components/dashboard/QRGeneratorModal.tsx": [
    ["`MediVerify · ${generated?.medicine || \"\"}`", "`SafeDose · ${generated?.medicine || \"\"}`"],
    ['link.download = `MediVerify-QR-${generated?.batchId || "batch"}.png`;', 'link.download = `SafeDose-QR-${generated?.batchId || "batch"}.png`;'],
    ["Registered on MediVerify blockchain", "Registered on SafeDose blockchain"],
  ],
  "server/services/mfa.service.ts": [
    ['"no-reply@mediverify.local"', '"no-reply@safedose.local"'],
    ["MediVerify - Your verification code", "SafeDose - Your verification code"],
    ["Your MediVerify verification code is", "Your SafeDose verification code is"],
    ["<h2 style=\"margin:0 0 12px;\">MediVerify Verification Code</h2>", "<h2 style=\"margin:0 0 12px;\">SafeDose Verification Code</h2>"],
    ["MediVerify — Reset your password", "SafeDose — Reset your password"],
    ["Reset your MediVerify password", "Reset your SafeDose password"],
    ['process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@mediverify.local"', 'process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@safedose.local"'],
    ['"no-reply@mediverify.local";', '"no-reply@safedose.local";'],
  ],
  "store/qr-store.ts": [
    [" * QR Store — MediVerify State Management", " * QR Store — SafeDose State Management"],
  ],
};

let filesChanged = 0;
let linesChanged = 0;

function countDiff(before, after) {
  const b = before.split("\n");
  const a = after.split("\n");
  let n = 0;
  for (let i = 0; i < Math.max(b.length, a.length); i++) {
    if (b[i] !== a[i]) n++;
  }
  return n;
}

function writeIfChanged(rel, after) {
  const full = path.join(root, rel);
  const before = fs.readFileSync(full, "utf8");
  if (before === after) return false;
  const diff = countDiff(before, after);
  fs.writeFileSync(full, after, "utf8");
  filesChanged++;
  linesChanged += diff;
  console.log(`  updated ${rel} (~${diff} lines)`);
  return true;
}

console.log("Pure A files:");
for (const rel of PURE_A_FILES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.warn(`  SKIP missing ${rel}`);
    continue;
  }
  const before = fs.readFileSync(full, "utf8");
  writeIfChanged(rel, brandReplace(before));
}

console.log("\nSurgical files:");
for (const [rel, pairs] of Object.entries(SURGICAL)) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.warn(`  SKIP missing ${rel}`);
    continue;
  }
  let text = fs.readFileSync(full, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      console.warn(`  WARN pattern not found in ${rel}: ${from.slice(0, 60)}...`);
      continue;
    }
    text = text.replace(from, to);
  }
  writeIfChanged(rel, text);
}

console.log(`\nDone: ${filesChanged} files, ~${linesChanged} lines changed.`);
