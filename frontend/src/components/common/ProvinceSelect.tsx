import { useEffect, useState } from "react";
import { referenceApi, ReferenceStateProvince } from "../../api/reference";

interface ProvinceSelectProps {
  countryId?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
}

export function ProvinceSelect({
  countryId,
  value = "",
  onChange,
  onBlur,
  disabled,
  id,
}: ProvinceSelectProps) {
  const [states, setStates] = useState<ReferenceStateProvince[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      return;
    }
    setLoading(true);
    referenceApi
      .states(countryId)
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoading(false));
  }, [countryId]);

  const sharedClass =
    "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed";

  if (states.length > 0) {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        disabled={disabled || loading}
        className={sharedClass}
      >
        <option value="">Select {states[0]?.type?.toLowerCase() ?? "province"}</option>
        {states.map((s) => (
          <option key={s.id} value={s.state_name}>
            {s.state_name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      disabled={disabled || loading}
      placeholder="State / Province"
      className={sharedClass}
    />
  );
}
