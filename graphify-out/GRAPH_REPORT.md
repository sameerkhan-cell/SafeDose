# Graph Report - Mediverify  (2026-07-24)

## Corpus Check
- 311 files · ~177,690 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 765 nodes · 797 edges · 24 communities detected
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 221 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]

## God Nodes (most connected - your core abstractions)
1. `fetch()` - 49 edges
2. `VerificationEngine` - 14 edges
3. `getStoredSession()` - 13 edges
4. `ManufacturerDocumentService` - 12 edges
5. `processAnchorQueue()` - 12 edges
6. `handleAction()` - 11 edges
7. `AuthService` - 11 edges
8. `BatchService` - 11 edges
9. `BlockchainService` - 10 edges
10. `runLiveDiagnosticTest()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `fetchCards()` --calls--> `fetch()`  [INFERRED]
  src\components\blockchain\TransactionCard.tsx → src\server.ts
- `loadSessions()` --calls--> `fetch()`  [INFERRED]
  src\routes\dashboard\settings.tsx → src\server.ts
- `async()` --calls--> `fetch()`  [INFERRED]
  src\routes\dashboard\settings.tsx → src\server.ts
- `fetch()` --calls--> `handleResend()`  [INFERRED]
  src\server.ts → C:\Users\MICR TRAD\OneDrive\Desktop\New folder (8)\Mediverify\src\routes\auth\verify-mfa.tsx
- `normalizeCatastrophicSsrResponse()` --calls--> `consumeLastCapturedError()`  [INFERRED]
  src\server.ts → src\lib\error-capture.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (46): handleDownload(), fetchTimeline(), fetchMapData(), fetchDashboardData(), fetchJourney(), handleSearch(), handleSelectBatch(), loadSamples() (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (32): AuditLogService, enqueueBlockchainJobs(), BlockchainService, processAnchorQueue(), sleep(), BatchService, main(), main() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (20): DrapBatchRegistryService, fetchCards(), handleMouseLeave(), handleMouseMove(), CacheService, dismiss(), handleLogout(), GeoTrackingService (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (12): JwtService, onSubmit(), onSubmit(), handleResend(), onSubmit(), main(), AuthService, GeoIPService (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (5): AIService, FraudEngine, RealtimeEmitter, RealtimeService, VerificationEngine

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (14): handleAction(), setStatus(), ExportService, PrintingService, buildBoxQrCode(), buildPillQrCode(), createBatch(), createPillRecords() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (11): computeComplianceMetrics(), daysRemaining(), enrichDocumentExpiry(), getEffectiveStatus(), isExpired(), getManufacturerForUser(), logAudit(), ManufacturerDocumentService (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (7): handleUpload(), Page(), ProfilePage(), BatchDetailPanel(), loadBatches(), useAuth(), ThemeProvider()

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (4): handleClose(), handleReset(), handleClose(), reset()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (7): handleDownload(), handleFileUpload(), save(), GoogleDriveService, PharmacyService, toDto(), validatePharmacyProfileUpdate()

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (6): handleSend(), getCoords(), verify(), handleVerify(), SMSSimulator, VerificationService

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (3): ZIPExportService, PDFSheetService, QRService

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (5): handleApprove(), handleDownload(), handleRejectSubmit(), handleUnverify(), PharmacyAdminService

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (4): async(), loadSessions(), save(), validatePassword()

### Community 19 - "Community 19"
Cohesion: 0.8
Nodes (4): getMailerTransporter(), isPlaceholderCredential(), isSmtpConfigured(), sendDocumentNotificationEmail()

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (1): AdminService

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (1): MedicineService

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (1): ManufacturerReportService

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (1): ReportReviewService

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (1): MonitoringService

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (1): AIMedicineChatService

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (1): RecallService

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (1): AnalyticsService

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (1): ApiError

## Knowledge Gaps
- **1 isolated node(s):** `RealtimeEmitter`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 20`** (5 nodes): `AdminService`, `.blacklistPharmacy()`, `.getNationalRiskMetrics()`, `.issueRecall()`, `admin.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (4 nodes): `medicine.service.ts`, `MedicineService`, `.createBatch()`, `.getMedicineAnalytics()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (4 nodes): `ManufacturerReportService`, `.getManufacturerReport()`, `.listManufacturers()`, `manufacturer-report.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (4 nodes): `ReportReviewService`, `.listReports()`, `.updateReportStatus()`, `report-review.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (4 nodes): `monitoring.service.ts`, `MonitoringService`, `.logEvent()`, `.trackPerformance()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `AIMedicineChatService`, `.streamChatResponse()`, `ai-medicine-chat.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (3 nodes): `RecallService`, `.initiateManufacturerRecall()`, `recall.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (3 nodes): `AnalyticsService`, `.getGlobalFraudMetrics()`, `analytics.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (3 nodes): `api-response.ts`, `ApiError`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetch()` connect `Community 0` to `Community 2`, `Community 3`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 15`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `handleAction()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `testPort()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 45 inferred relationships involving `fetch()` (e.g. with `testPort()` and `main()`) actually correct?**
  _`fetch()` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `getStoredSession()` (e.g. with `handleDownload()` and `handleDownload()`) actually correct?**
  _`getStoredSession()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `processAnchorQueue()` (e.g. with `runLiveDiagnosticTest()` and `main()`) actually correct?**
  _`processAnchorQueue()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RealtimeEmitter` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._