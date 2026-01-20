export declare function startRunPodJobProcessor(dbPath?: string): void;
/**
 * Manually trigger thread submission
 */
export declare function triggerThreadSubmission(limit?: number): Promise<{
    submitted: number;
    jobIds: string[];
}>;
/**
 * Manually trigger job status check
 */
export declare function triggerJobCheck(): Promise<{
    completed: number;
    failed: number;
    pending: number;
}>;
//# sourceMappingURL=runpodJobProcessor.d.ts.map