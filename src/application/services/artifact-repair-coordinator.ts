import {
  validateRepairLockedFields,
  type ArtifactValidationFailure,
} from "../../domain/assessments/evidence-first-validation";

export interface ArtifactRepairOutcome<T> {
  readonly status: "valid" | "controlled_failure";
  readonly artifact?: T;
  readonly firstPassFailures: readonly ArtifactValidationFailure[];
  readonly finalFailures: readonly ArtifactValidationFailure[];
  readonly repairAttempted: boolean;
  readonly repairSuccess: boolean;
  readonly providerAttemptCount: number;
  readonly logicalOperationCount: 1;
}

export class ArtifactRepairCoordinator {
  async execute<T extends Readonly<Record<string, unknown>>>(input: {
    readonly firstPass: T;
    readonly validate: (artifact: T) => readonly ArtifactValidationFailure[];
    readonly repair: (context: {
      readonly failureCodes: readonly string[];
      readonly invalidFields: T;
      readonly lockedFields: Readonly<Partial<T>>;
    }) => Promise<T>;
    readonly lockedFields: readonly (keyof T)[];
  }): Promise<ArtifactRepairOutcome<T>> {
    const firstPassFailures = input.validate(input.firstPass);
    if (firstPassFailures.length === 0) {
      return {
        status: "valid",
        artifact: input.firstPass,
        firstPassFailures: [],
        finalFailures: [],
        repairAttempted: false,
        repairSuccess: false,
        providerAttemptCount: 1,
        logicalOperationCount: 1,
      };
    }
    const lockedFields = Object.fromEntries(
      input.lockedFields.map((field) => [field, input.firstPass[field]]),
    ) as Readonly<Partial<T>>;
    const repaired = await input.repair({
      failureCodes: [...new Set(firstPassFailures.map((failure) => failure.code))],
      invalidFields: input.firstPass,
      lockedFields,
    });
    const lockedFailures = validateRepairLockedFields(
      input.firstPass,
      repaired,
      input.lockedFields,
    );
    const finalFailures = [
      ...lockedFailures,
      ...input.validate(repaired),
    ];
    if (finalFailures.length > 0) {
      return {
        status: "controlled_failure",
        firstPassFailures,
        finalFailures: [
          ...finalFailures,
          ...(!finalFailures.some((failure) => failure.code === "REPAIR_FAILED")
            ? [{ code: "REPAIR_FAILED" as const, path: "$" }]
            : []),
        ],
        repairAttempted: true,
        repairSuccess: false,
        providerAttemptCount: 2,
        logicalOperationCount: 1,
      };
    }
    return {
      status: "valid",
      artifact: repaired,
      firstPassFailures,
      finalFailures: [],
      repairAttempted: true,
      repairSuccess: true,
      providerAttemptCount: 2,
      logicalOperationCount: 1,
    };
  }
}
