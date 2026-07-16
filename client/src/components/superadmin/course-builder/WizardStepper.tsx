import { Check } from "lucide-react";

interface WizardStepperProps {
  steps: readonly string[];
  current: number;
}

export default function WizardStepper({ steps, current }: WizardStepperProps) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((label, i) => (
        <li
          key={label}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
            i === current
              ? "border-navy-900 bg-navy-900 text-white"
              : i < current
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-gray-200 text-gray-500"
          }`}
        >
          {i < current ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
          {label}
        </li>
      ))}
    </ol>
  );
}
