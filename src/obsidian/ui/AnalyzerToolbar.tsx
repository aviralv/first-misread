import { useState } from "preact/hooks";

interface Props {
  onAnalyzeAgain: () => void;
  onResetHistory: () => Promise<void>;
  onCancel?: () => void;
  runCount: number;
  isAnalyzing: boolean;
}

export function AnalyzerToolbar({ onAnalyzeAgain, onResetHistory, onCancel, runCount, isAnalyzing }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (isAnalyzing && onCancel) {
    return (
      <div class="fm-toolbar">
        <button class="fm-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div class="fm-toolbar">
      <button class="fm-btn-secondary" onClick={onAnalyzeAgain}>
        Analyze Again
      </button>
      {runCount > 0 && !confirming && (
        <button
          class="fm-btn-secondary fm-btn-danger"
          onClick={() => setConfirming(true)}
        >
          Reset History
        </button>
      )}
      {confirming && (
        <span class="fm-inline-confirm">
          Clear {runCount} run{runCount !== 1 ? "s" : ""}?{" "}
          <button
            class="fm-btn-confirm-yes"
            onClick={async () => {
              await onResetHistory();
              setConfirming(false);
            }}
          >
            Yes
          </button>{" "}
          <button
            class="fm-btn-confirm-cancel"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
