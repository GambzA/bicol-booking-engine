import { forwardRef, useEffect, useState } from "react";
import { referenceApi, ReferenceCountry } from "../../api/reference";

interface CountrySelectProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
}

export const CountrySelect = forwardRef<HTMLSelectElement, CountrySelectProps>(
  ({ value = "", onChange, onBlur, disabled, id }, ref) => {
    const [countries, setCountries] = useState<ReferenceCountry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      referenceApi
        .countries()
        .then(setCountries)
        .finally(() => setLoading(false));
    }, []);

    return (
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        disabled={disabled || loading}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
      >
        <option value="">{loading ? "Loading..." : "Select country"}</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.country_name}
          </option>
        ))}
      </select>
    );
  }
);

CountrySelect.displayName = "CountrySelect";
