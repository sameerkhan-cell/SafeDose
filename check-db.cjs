const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const [scans, genuine, duplicate, suspected, invalid, jobs, fraudAlerts, geoRows, pills, batches, recentLogs] = await Promise.all([
    p.verificationLog.count(),
    p.verificationLog.count({ where: { status: 'GENUINE' } }),
    p.verificationLog.count({ where: { status: 'DUPLICATE' } }),
    p.verificationLog.count({ where: { status: 'SUSPECTED' } }),
    p.verificationLog.count({ where: { status: 'INVALID' } }),
    p.blockchainJob.findMany({ take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, entityType: true, entityRef: true, status: true, txHash: true, createdAt: true } }),
    p.fraudAlert.count(),
    p.geoAnalytics.count(),
    p.pill.findMany({ take: 5, include: { batch: { include: { medicine: true } } }, orderBy: { createdAt: 'desc' } }),
    p.batch.findMany({ take: 3, include: { medicine: true }, orderBy: { createdAt: 'desc' } }),
    p.verificationLog.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { pill: { include: { batch: { include: { medicine: true } } } } } })
  ]);

  console.log(JSON.stringify({
    verificationLogs: { total: scans, genuine, duplicate, suspected, invalid },
    blockchainJobs: jobs.map(j => ({ entityType: j.entityType, entityRef: j.entityRef, status: j.status, txHash: j.txHash ? j.txHash.slice(0, 20) + '...' : null, createdAt: j.createdAt })),
    fraudAlerts,
    geoAnalyticsRows: geoRows,
    recentScans: recentLogs.map(l => ({ code: l.code, status: l.status, location: l.location, medicine: l.pill?.batch?.medicine?.name || 'N/A', createdAt: l.createdAt })),
    pills: pills.map(pi => ({ qrCode: pi.qrCode.slice(0,20), medicine: pi.batch?.medicine?.name, status: pi.status, blockchainStatus: pi.blockchainStatus, hasTxHash: !!pi.blockchainTx })),
    batches: batches.map(b => ({ batchNumber: b.batchNumber, medicine: b.medicine?.name, blockchainStatus: b.blockchainStatus, hasTxHash: !!b.txHash }))
  }, null, 2));

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
