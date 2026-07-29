import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@astryxdesign/core/DropdownMenu";
import { Palette } from "lucide-react";
import { APP_THEMES, type AppThemeId } from "../theme/catalog";

type ThemePickerProps = {
  themeId: AppThemeId;
  onThemeIdChange: (id: AppThemeId) => void;
  className?: string;
};

export function ThemePicker({
  themeId,
  onThemeIdChange,
  className,
}: ThemePickerProps) {
  return (
    <DropdownMenu
      className={className ?? "no-drag"}
      hasChevron={false}
      placement="below"
      menuWidth="16rem"
      button={{
        label: "Theme",
        tooltip: "Choose theme",
        icon: <Palette />,
        variant: "ghost",
        size: "lg",
        isIconOnly: true,
      }}
    >
      <DropdownMenuRadioGroup
        value={themeId}
        onChange={(value) => onThemeIdChange(value as AppThemeId)}
        aria-label="App theme"
      >
        {APP_THEMES.map((option) => (
          <DropdownMenuRadioItem
            key={option.id}
            value={option.id}
            label={option.label}
            description={option.description}
          />
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenu>
  );
}
