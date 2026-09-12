export function recoveryObservation(input) {
  const time = (value) => {
    const match = typeof value === "string" && value.match(/^(\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d(?::?\d\d)?)$/);
    if (!match) throw new Error("恢复测量缺少带时区的有效源时间");
    let zone = match[3];
    if (/^[+-]\d\d$/.test(zone)) zone += ":00";
    else if (/^[+-]\d{4}$/.test(zone)) zone = zone.slice(0, 3) + ":" + zone.slice(3);
    const milliseconds = Date.parse(match[1].replace(" ", "T") + zone);
    if (!Number.isFinite(milliseconds)) throw new Error("恢复测量源时间无效");
    return BigInt(milliseconds) * 1000n + BigInt((match[2] ?? "").padEnd(6, "0"));
  };
  const incident = time(input.incidentAt); const coverage = time(input.guaranteedCoverageAt);
  const recorded = time(input.restoredMarker?.recordedAt); const confirmed = time(input.restoredMarker?.confirmedAt);
  const missing = time(input.missingMarker?.recordedAt); const missingConfirmed = time(input.missingMarker?.confirmedAt);
  if (!(recorded <= confirmed && confirmed <= coverage && coverage <= missing && missing <= missingConfirmed && missingConfirmed <= incident)) throw new Error("恢复测量源时钟或样本顺序不一致");
  if (!Number.isFinite(input.restoreMilliseconds) || input.restoreMilliseconds <= 0) throw new Error("恢复耗时未实际测量");
  if ([input.encryptedBytes, input.databaseBytes, input.businessDatabases].some((value) => !Number.isSafeInteger(value) || value < 1)) throw new Error("恢复测量数据规模无效");
  const floorMilliseconds = (value) => Number(value / 1000n);
  const ceilMilliseconds = (value) => Number((value + 999n) / 1000n);
  const confirmationWindow = confirmed - recorded > missingConfirmed - missing ? confirmed - recorded : missingConfirmed - missing;
  return { schema: "magictools-recovery-observation/1", scope: { database: "local-marker-drill", offsite: "not-measured", platformCutover: "not-measured" },
    rpo: { incidentAt: input.incidentAt, guaranteedCoverageAt: input.guaranteedCoverageAt,
      restoredMarker: input.restoredMarker, missingMarker: input.missingMarker,
      observedMarkerGapSeconds: Number(incident - recorded) / 1_000_000,
      recoveryPointAgeSeconds: { minimum: floorMilliseconds(incident - missing) / 1000, maximum: ceilMilliseconds(incident - coverage) / 1000 },
      commitConfirmationWindowMilliseconds: ceilMilliseconds(confirmationWindow), precisionMilliseconds: 1, timestampComparisonUnit: "microsecond" },
    rto: { databaseRestoreMilliseconds: input.restoreMilliseconds, imageSelectionAndPullIncluded: true, imageCache: input.imageCache ?? "not-recorded", backupDownloadIncluded: false,
      includes: ["manifest-authentication", "image-selection", "decryption", "native-WAL-verification", "database-startup", "catalog", "business-data-and-role-checks", "temporary-cleanup"] },
    size: { encryptedBytes: input.encryptedBytes, databaseBytes: input.databaseBytes, businessDatabases: input.businessDatabases } };
}
