"use client";

import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [inputVal, setInputVal] = useState("");

  function addTag() {
    const tag = inputVal.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInputVal("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputVal && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="border border-input rounded-md p-2 flex flex-wrap gap-2 min-h-[42px] focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        className="border-0 shadow-none p-0 h-6 flex-1 min-w-24 focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder={placeholder ?? "Type and press Enter"}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addTag}
      />
    </div>
  );
}
