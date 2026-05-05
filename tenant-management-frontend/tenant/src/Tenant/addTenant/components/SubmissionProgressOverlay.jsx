import { CheckCircle2Icon, Loader2Icon, UploadCloudIcon, FileTextIcon, BuildingIcon } from "lucide-react";

const STEP_DEFS = [
  {
    phases: ["validating", "preparing"],
    label: "Validating & preparing",
    icon: FileTextIcon,
  },
  {
    phases: ["uploading"],
    label: "Uploading documents",
    icon: UploadCloudIcon,
  },
  {
    phases: ["processing"],
    label: "Calculating rent & registering",
    icon: BuildingIcon,
  },
  {
    phases: ["done"],
    label: "Complete",
    icon: CheckCircle2Icon,
  },
];

const PHASE_ORDER = ["idle", "validating", "preparing", "uploading", "processing", "done"];

function phaseIndex(phase) {
  return PHASE_ORDER.indexOf(phase);
}

function stepStatus(stepDef, currentPhase) {
  const currentIdx = phaseIndex(currentPhase);
  const stepPhaseIndices = stepDef.phases.map(phaseIndex);
  const maxStepIdx = Math.max(...stepPhaseIndices);
  const minStepIdx = Math.min(...stepPhaseIndices);

  if (currentIdx > maxStepIdx) return "done";
  if (stepPhaseIndices.includes(currentPhase) || (currentIdx >= minStepIdx && currentIdx <= maxStepIdx)) return "active";
  return "pending";
}

export function SubmissionProgressOverlay({ progress }) {
  const { phase, percent, message } = progress;
  const isDone = phase === "done";

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {STEP_DEFS.map((step, i) => {
          const status = stepStatus(step, phase);
          const Icon = step.icon;
          const isLast = i === STEP_DEFS.length - 1;

          return (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    status === "done"
                      ? "bg-green-100 text-green-600"
                      : status === "active"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground/40",
                  ].join(" ")}
                >
                  {status === "done" ? (
                    <CheckCircle2Icon className="w-4 h-4" />
                  ) : status === "active" ? (
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={[
                    "text-[10px] font-medium text-center leading-tight max-w-[64px]",
                    status === "done"
                      ? "text-green-600"
                      : status === "active"
                        ? "text-primary"
                        : "text-muted-foreground/40",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-1 mb-5 rounded-full transition-all duration-500",
                    stepStatus(STEP_DEFS[i + 1], phase) !== "pending" || status === "done"
                      ? "bg-primary/40"
                      : "bg-muted-foreground/20",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground truncate">{message}</p>
          <span className="text-sm font-semibold text-primary tabular-nums shrink-0 ml-2">
            {percent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={[
              "h-full rounded-full transition-all duration-500 ease-out",
              isDone ? "bg-green-500" : "bg-primary",
            ].join(" ")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
