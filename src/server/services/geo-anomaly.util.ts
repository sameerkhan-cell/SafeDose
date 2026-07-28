export interface LocationTimestamp {
    location?: string | null;
    timestamp: Date | string | number;
}

export interface GeoAnomalyResult {
    isAnomaly: boolean;
    timeDiffMins: number;
    message: string;
}

/**
 * Checks for impossible travel anomaly when a single entity or code is scanned in two
 * different geographical locations within a short time window (default 60 minutes).
 */
export function isImpossibleTravel(
    prev: LocationTimestamp | null | undefined,
    currentLocation: string | null | undefined,
    currentTimestamp: Date | string | number = new Date(),
    thresholdMinutes: number = 60
): GeoAnomalyResult {
    if (!prev?.location || !currentLocation || prev.location === currentLocation) {
        return { isAnomaly: false, timeDiffMins: 0, message: "" };
    }

    // Skip comparison if either location is generic/local
    if (
        prev.location === "Unknown Location" ||
        currentLocation === "Unknown Location" ||
        prev.location === "Local Network" ||
        currentLocation === "Local Network"
    ) {
        return { isAnomaly: false, timeDiffMins: 0, message: "" };
    }

    const prevTime = new Date(prev.timestamp).getTime();
    const currTime = new Date(currentTimestamp).getTime();
    const timeDiffMins = (currTime - prevTime) / 1000 / 60;

    if (timeDiffMins >= 0 && timeDiffMins < thresholdMinutes) {
        const roundedMins = Math.round(timeDiffMins);
        return {
            isAnomaly: true,
            timeDiffMins: roundedMins,
            message: `Impossible travel detected: ${prev.location} to ${currentLocation} in ${roundedMins} mins.`
        };
    }

    return { isAnomaly: false, timeDiffMins: Math.round(timeDiffMins), message: "" };
}
