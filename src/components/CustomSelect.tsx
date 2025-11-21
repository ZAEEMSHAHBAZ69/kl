import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select...',
  className = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
        className="w-full px-4 py-2.5 bg-[#1E1E1E]/80 backdrop-blur-md border border-[#2C2C2C] rounded-[10px] text-[#FFFFFF] text-left focus:outline-none focus:border-[#48a77f] hover:border-[#48a77f] disabled:opacity-50 flex items-center justify-between transition-all duration-200 shadow-lg"
      >
        <span className={selectedOption ? 'text-[#FFFFFF]' : 'text-gray-400'}>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-[#161616] border border-[#2C2C2C] rounded-[10px] shadow-2xl max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-2.5 text-left transition-all duration-150 first:rounded-t-[10px] last:rounded-b-[10px] ${
                option.value === value
                  ? 'bg-[#48a77f] text-white'
                  : 'text-white hover:bg-[#1E1E1E]/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
