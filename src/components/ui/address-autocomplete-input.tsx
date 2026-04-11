'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';

export type AddressSuggestion = {
  label: string;
  lat: number;
  lon: number;
  city: string;
  state: string;
  wilayaId: string | null;
};

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3 || disabled) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/geo/autocomplete?q=${encodeURIComponent(query)}&limit=6`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({ suggestions: [] }));
        const nextSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(nextSuggestions);
        setOpen(nextSuggestions.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, disabled]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
          {isLoading && <div className="px-3 py-2 text-xs text-slate-500">Recherche...</div>}
          {!isLoading && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Aucun resultat</div>}
          {!isLoading && suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.lat}-${suggestion.lon}-${index}`}
              type="button"
              className="w-full border-b px-3 py-2 text-left text-xs hover:bg-slate-50"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(suggestion);
                setOpen(false);
                setSuggestions([]);
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
