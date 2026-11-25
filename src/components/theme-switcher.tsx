"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Labels = { theme: string; light: string; dark: string; system: string };

const subscribe = () => () => {};

/** Переключатель темы как группа радиокнопок: доступен с клавиатуры, подпись у каждой иконки. */
export function ThemeSwitcher({ labels }: { labels: Labels }) {
  const { theme, setTheme } = useTheme();
  // До гидратации тема неизвестна: не отмечаем ни один вариант, чтобы не было рассинхронизации.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const options = [
    { value: "light", label: labels.light, Icon: Sun },
    { value: "dark", label: labels.dark, Icon: Moon },
    { value: "system", label: labels.system, Icon: Monitor },
  ] as const;

  return (
    <fieldset className="flex border border-border">
      <legend className="sr-only">{labels.theme}</legend>
      {options.map(({ value, label, Icon }) => {
        const checked = mounted && theme === value;
        return (
          <label
            key={value}
            title={label}
            className={cn(
              "relative flex size-9 cursor-pointer items-center justify-center text-muted-foreground",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              checked && "bg-secondary text-secondary-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={checked}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden className="size-4" />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
