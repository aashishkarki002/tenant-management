/**
 * StepProgressBar.jsx
 *
 * Props:
 *   steps        - Array<{ key: string, label: string }>
 *   activeKey    - currently active step key
 *   onStepClick  - (key: string) => void
 *   completedKeys - Array<string> of visited step keys
 *   stepErrors   - Record<string, boolean>  — true = that step has validation errors
 */

import { Check, AlertCircle } from "lucide-react";

export function StepProgressBar({ steps, activeKey, onStepClick, completedKeys = [], stepErrors = {} }) {
    const activeIndex = steps.findIndex((s) => s.key === activeKey);

    return (
        <div className="w-full mb-8 px-2">
            <div className="relative flex items-center justify-between">

                {/* Background connector */}
                <div className="absolute top-5 left-0 right-0 h-[2px] bg-border z-0" />

                {/* Filled connector */}
                <div
                    className="absolute top-5 left-0 h-[2px] bg-foreground z-0 transition-all duration-500 ease-in-out"
                    style={{
                        width: activeIndex === 0
                            ? "0%"
                            : `${(activeIndex / (steps.length - 1)) * 100}%`,
                    }}
                />

                {steps.map((step, index) => {
                    const isCompleted = completedKeys.includes(step.key) && step.key !== activeKey;
                    const isActive = step.key === activeKey;
                    const isReachable = isCompleted || isActive;
                    const hasError = stepErrors[step.key] && isCompleted; // only show error on visited steps

                    return (
                        <div
                            key={step.key}
                            className="relative z-10 flex flex-col items-center gap-2"
                            style={{ flex: "0 0 auto" }}
                        >
                            <button
                                type="button"
                                disabled={!isReachable}
                                onClick={() => isReachable && onStepClick(step.key)}
                                aria-current={isActive ? "step" : undefined}
                                className={[
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
                                    "border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                    hasError
                                        ? "bg-red-50 border-red-400 text-red-600 cursor-pointer hover:bg-red-100 focus-visible:ring-red-400"
                                        : isCompleted
                                            ? "bg-primary border-primary text-primary-foreground cursor-pointer hover:bg-primary/80 focus-visible:ring-primary"
                                            : isActive
                                                ? "bg-white border-primary text-primary cursor-default ring-4 ring-primary/10 scale-110 focus-visible:ring-primary"
                                                : "bg-white border-border text-muted-foreground cursor-not-allowed",
                                ].join(" ")}
                            >
                                {hasError ? (
                                    <AlertCircle className="w-4 h-4" />
                                ) : isCompleted ? (
                                    <Check className="w-4 h-4 stroke-[3]" />
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </button>

                            <span
                                className={[
                                    "text-xs font-medium text-center leading-tight whitespace-nowrap hidden sm:block",
                                    hasError
                                        ? "text-red-500"
                                        : isActive
                                            ? "text-primary"
                                            : isCompleted
                                                ? "text-primary"
                                                : "text-muted-foreground",
                                ].join(" ")}
                            >
                                {step.label}
                                {hasError && (
                                    <span className="block text-[10px] text-red-400 font-normal">incomplete</span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Mobile label */}
            <div className="mt-3 text-center sm:hidden">
                <span className="text-sm font-semibold text-primary">
                    Step {activeIndex + 1} of {steps.length}: {steps[activeIndex]?.label}
                </span>
            </div>
        </div>
    );
}