/**
 * StepProgressBar.jsx
 *
 * A horizontal stepper that shows numbered circles connected by a filling
 * progress line. Clicking a completed or current step navigates directly
 * to it. Future (not-yet-reached) steps are non-interactive.
 *
 * Props:
 *   steps       - Array<{ key: string, label: string, icon?: ReactNode }>
 *   activeKey   - The key of the currently active step
 *   onStepClick - (key: string) => void   called when a reachable step is clicked
 *   completedKeys - Array<string> of step keys the user has already visited
 */

import { Check } from "lucide-react";

export function StepProgressBar({ steps, activeKey, onStepClick, completedKeys = [] }) {
    const activeIndex = steps.findIndex((s) => s.key === activeKey);

    return (
        <div className="w-full mb-8 px-2">
            {/* ── Track + Circles ─────────────────────────────────────────── */}
            <div className="relative flex items-center justify-between">

                {/* Background connector line */}
                <div className="absolute top-5 left-0 right-0 h-[2px] bg-gray-200 z-0" />

                {/* Filled connector line — grows based on active step */}
                <div
                    className="absolute top-5 left-0 h-[2px] bg-black z-0 transition-all duration-500 ease-in-out"
                    style={{
                        width:
                            activeIndex === 0
                                ? "0%"
                                : `${(activeIndex / (steps.length - 1)) * 100}%`,
                    }}
                />

                {/* Step circles */}
                {steps.map((step, index) => {
                    const isCompleted = completedKeys.includes(step.key) && step.key !== activeKey;
                    const isActive = step.key === activeKey;
                    const isReachable = isCompleted || isActive;

                    return (
                        <div
                            key={step.key}
                            className="relative z-10 flex flex-col items-center gap-2"
                            style={{ flex: "0 0 auto" }}
                        >
                            {/* Circle */}
                            <button
                                type="button"
                                disabled={!isReachable}
                                onClick={() => isReachable && onStepClick(step.key)}
                                aria-current={isActive ? "step" : undefined}
                                className={[
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
                                    "border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
                                    isCompleted
                                        ? "bg-black border-black text-white cursor-pointer hover:bg-black/80 hover:border-black/80 scale-100"
                                        : isActive
                                            ? "bg-white border-black text-black cursor-default ring-4 ring-black/10 scale-110"
                                            : "bg-white border-gray-300 text-gray-400 cursor-not-allowed",
                                ].join(" ")}
                            >
                                {isCompleted ? (
                                    <Check className="w-4 h-4 stroke-[3]" />
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </button>

                            {/* Label */}
                            <span
                                className={[
                                    "text-xs font-medium text-center leading-tight whitespace-nowrap",
                                    "hidden sm:block", // hide on very small screens to prevent overlap
                                    isActive
                                        ? "text-black"
                                        : isCompleted
                                            ? "text-gray-700"
                                            : "text-gray-400",
                                ].join(" ")}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Mobile: show active step label below the track */}
            <div className="mt-3 text-center sm:hidden">
                <span className="text-sm font-semibold text-black">
                    Step {activeIndex + 1} of {steps.length}:{" "}
                    {steps[activeIndex]?.label}
                </span>
            </div>
        </div>
    );
}